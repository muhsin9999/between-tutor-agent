/**
 * Better Auth — the browser door.
 *
 * `.planning/AUTH.md`: two doors, one identity. The Telegram Mini App proves who
 * the tutor is with a signed `initData` HMAC and needs no login screen. This file
 * is the *other* door — a tutor at a laptop, in a browser tab she can bookmark,
 * where there is no `initData` to verify. The two meet at `user.telegramUserId`.
 *
 * Three rules this file exists to keep:
 *
 * 1. **No passwords.** `emailAndPassword` is off. A tutor is not a developer, and
 *    this account holds a minor's practice record — a password is a support
 *    burden and a leak risk. Magic link, or Google.
 *
 * 2. **The student never touches this.** Better Auth owns tutors only. The
 *    student's identity is his Telegram chat, forever.
 *
 * 3. **A missing credential degrades; it never throws at import time.**
 *    `DATABASE_URL`, `GOOGLE_CLIENT_ID` and friends may all be absent — the app
 *    must still boot, the landing page must still render, and `/sign-in` must
 *    say plainly that it is not configured rather than pretending. Everything
 *    below is therefore lazy and guarded: `getAuth()` returns `null` instead of
 *    exploding, and every caller is required to handle that.
 */
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { Pool } from "pg";

/* ------------------------------------------------------------------ the env */

/** Read an env var, treating blank and whitespace as absent. */
function env(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * A dev-only fallback secret. Better Auth needs *a* secret to sign tokens; in
 * development an unset one would otherwise be a hard stop for a teammate who
 * only wants the page to render. In production there is no fallback — an
 * unconfigured secret leaves auth switched off rather than silently signing
 * sessions with a value that is public in this repository.
 */
const DEV_SECRET = "between-dashboard-development-only-not-a-secret";

/** How the magic link actually reaches the tutor, if at all. */
export type EmailDelivery = "resend" | "console" | "none";

/**
 * What is actually wired, right now. Safe to serialise to a browser: booleans
 * and one enum, never a key, a URL with a token, or a connection string.
 */
export interface AuthStatus {
  /** True when a session can genuinely be created. Everything hangs off this. */
  configured: boolean;
  /** `DATABASE_URL` is present. Better Auth cannot store a session without it. */
  database: boolean;
  /** Both Google OAuth credentials are present. */
  google: boolean;
  /** Magic link is mounted (it is, whenever the database is). */
  magicLink: boolean;
  /**
   * `resend` — the link is emailed.
   * `console` — no `RESEND_API_KEY`, so in development the link is printed to
   * the server console and the UI says so instead of claiming it was sent.
   * `none` — production with no sender configured; the link goes nowhere.
   */
  emailDelivery: EmailDelivery;
  /**
   * Always false. Better Auth ships no Telegram provider, and the Telegram Login
   * Widget is a different mechanism entirely — see `docs/AUTH-SETUP.md`.
   */
  telegram: false;
}

function emailDelivery(): EmailDelivery {
  if (env("RESEND_API_KEY")) return "resend";
  return isProduction ? "none" : "console";
}

/**
 * Computed per call rather than at module load, so editing `.env` and reloading
 * is enough in development.
 */
export function authStatus(): AuthStatus {
  const database = Boolean(env("DATABASE_URL"));
  const secret = Boolean(env("BETTER_AUTH_SECRET")) || !isProduction;
  return {
    configured: database && secret,
    database,
    google: Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
    magicLink: database && secret,
    emailDelivery: emailDelivery(),
    telegram: false,
  };
}

/** Where this app lives, for OAuth callbacks and magic-link URLs. */
export function baseURL(): string {
  return (
    env("BETTER_AUTH_URL") ??
    env("PUBLIC_APP_URL") ??
    "http://127.0.0.1:3200"
  );
}

/* ------------------------------------------------------- sending the link */

/**
 * Deliver a magic link.
 *
 * With `RESEND_API_KEY` set this is a real send. Without it, in development, the
 * link is printed to the server console — a developer can paste it and the flow
 * is genuinely end-to-end. The UI is told which of the two happened (see
 * `AuthStatus.emailDelivery`) so it never reports "check your email" for a link
 * that only ever reached a terminal.
 */
async function deliverMagicLink(email: string, url: string): Promise<void> {
  const key = env("RESEND_API_KEY");

  if (!key) {
    if (isProduction) {
      console.error(
        "[auth] magic link for %s could not be sent: RESEND_API_KEY is not set.",
        email,
      );
      return;
    }
    console.log(
      "\n[auth] magic link (not emailed — RESEND_API_KEY is not set)\n" +
        "       for: %s\n" +
        "       url: %s\n",
      email,
      url,
    );
    return;
  }

  const from = env("AUTH_EMAIL_FROM") ?? "Between <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your sign-in link for Between",
        text:
          `Click to sign in — this link expires in 5 minutes and works once.\n\n${url}\n\n` +
          `If you did not ask for this, ignore it. Nothing was created.`,
      }),
    });

    if (!response.ok) {
      console.error(
        "[auth] Resend rejected the magic link for %s: %s %s",
        email,
        response.status,
        await response.text().catch(() => ""),
      );
    }
  } catch (error) {
    console.error("[auth] magic link send failed for %s:", email, error);
  }
}

/* ------------------------------------------------------------- the instance */

function build(connectionString: string) {
  return betterAuth({
    baseURL: baseURL(),
    secret: env("BETTER_AUTH_SECRET") ?? DEV_SECRET,
    trustedOrigins: [baseURL()],

    /**
     * The same Neon database the rest of the product uses. Better Auth owns
     * `user`, `session`, `account` and `verification`; nothing here writes to a
     * table the agent owns, so the two schemas sit side by side without
     * colliding. Run the migration before first use — `docs/AUTH-SETUP.md`.
     */
    database: new Pool({
      connectionString,
      // Neon requires TLS. `pg` will not enable it from the URL alone.
      ssl: /\bsslmode=(disable|allow)\b/.test(connectionString)
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    }),

    /** Deliberate. See AUTH.md — a password here is a liability, not a feature. */
    emailAndPassword: { enabled: false },

    socialProviders:
      env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")
        ? {
            google: {
              clientId: env("GOOGLE_CLIENT_ID")!,
              clientSecret: env("GOOGLE_CLIENT_SECRET")!,
            },
          }
        : {},

    user: {
      additionalFields: {
        /**
         * **The join between the two doors.** A tutor who onboarded through the
         * bot and later signs in here must see her students, not an empty
         * account; this column is what makes those the same tutor.
         *
         * `input: false` is load-bearing: the value is written server-side after
         * a signed, single-use, short-lived token is verified (ONBOARDING.md
         * step 4). If a client could set it during sign-up, anyone who guessed a
         * Telegram id could attach themselves to another tutor's students.
         *
         * Stored as text rather than bigint so a 64-bit Telegram id survives
         * JavaScript's 53-bit number precision intact.
         */
        telegramUserId: {
          type: "string",
          fieldName: "telegram_user_id",
          required: false,
          input: false,
          unique: true,
        },
      },
    },

    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        sendMagicLink: async ({ email, url }) => {
          await deliverMagicLink(email, url);
        },
      }),
      // Must stay last: it is what lets a server action set the session cookie.
      nextCookies(),
    ],
  });
}

type AuthInstance = ReturnType<typeof build>;

/** `undefined` = not tried yet. `null` = tried, not available. */
let cached: AuthInstance | null | undefined;

/**
 * The auth instance, or `null` when it cannot exist.
 *
 * Never throws. A caller that ignores the `null` and reaches for `.api` is the
 * bug this signature exists to prevent.
 */
export function getAuth(): AuthInstance | null {
  if (cached !== undefined) return cached;

  const connectionString = env("DATABASE_URL");
  if (!connectionString) {
    cached = null;
    return cached;
  }
  if (isProduction && !env("BETTER_AUTH_SECRET")) {
    console.error(
      "[auth] BETTER_AUTH_SECRET is not set — auth is disabled in production.",
    );
    cached = null;
    return cached;
  }

  try {
    cached = build(connectionString);
  } catch (error) {
    console.error("[auth] could not start Better Auth:", error);
    cached = null;
  }
  return cached;
}

/**
 * The same instance under the name the Better Auth CLI looks for.
 *
 * `npx @better-auth/cli migrate --config apps/dashboard/src/lib/auth.ts` scans
 * the file for a default export or an export literally named `auth`. Evaluating
 * it here is safe: `getAuth()` is guarded and returns `null` when nothing is
 * configured, so importing this module on an unprovisioned machine still does
 * nothing but read four environment variables.
 *
 * Application code should call `getAuth()` instead — the `null` is easier to
 * forget when it is hiding behind a noun.
 */
export const auth = getAuth();

/**
 * The signed-in tutor, or `null`. Returns `null` — rather than throwing — when
 * auth is not configured, which is the same answer as "nobody is signed in".
 */
export async function getSession(
  headers: Headers,
): Promise<Awaited<ReturnType<AuthInstance["api"]["getSession"]>>> {
  const auth = getAuth();
  if (!auth) return null;
  try {
    return await auth.api.getSession({ headers });
  } catch (error) {
    console.error("[auth] session lookup failed:", error);
    return null;
  }
}
