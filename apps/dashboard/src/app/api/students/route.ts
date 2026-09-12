/**
 * `POST /api/students` — the tutor adds a student, and the student never signs up.
 *
 * ONBOARDING.md flow 2: "The tutor already knows his name. She types it when she
 * invites him. The student's sign-up is therefore a tap, because everything the
 * system needs to know about him, she supplied."
 *
 * Body `{ name }`. Response `{ student, persisted, inviteUrl, message }`.
 *
 * **The session check is the security model, exactly as in `/api/link`.** The
 * invite this mints is bound to *her* Telegram chat id — the bot only accepts a
 * `/start <payload>` whose payload matches the tutor's chat. Minting one without
 * a session would let a stranger hand out links that enrol children into an
 * account that is not theirs. So: no session, no invite, 401. Her Telegram id
 * comes from the verified session's `user.telegram_user_id`, never from the body.
 *
 * **The invite is per student, and it carries his name.** It used to be
 * `t.me/<bot>?start=<her chat id>` — the same string for everyone she taught,
 * so the bot learned only whose tutor she was and had to ask him his name,
 * which is exactly the sign-up step ONBOARDING.md says a tap replaces. Now a
 * row in `invites` (`sql/002_invites.sql`) holds the name and the tutor against
 * a one-time token, and `apps/channel/src/invite.ts` redeems it.
 *
 * **What this endpoint still does not do.** `students.telegram_chat_id` is
 * `BIGINT NOT NULL UNIQUE` in `sql/001_initial.sql`, and his chat id cannot be
 * known until he taps. There is no correct value to write, and inventing one
 * would either collide with a real chat or plant a row the channel can never
 * match him to. So the student row appears when he taps; the invite row is
 * what exists in the meantime, and it is the thing that remembers his name.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth";

/** `node:crypto` and the `pg` session lookup. Never the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/** Longer than any name a tutor types, short enough to reject a pasted essay. */
const MAX_NAME = 80;

/** Read an env var, treating blank and whitespace as absent. */
function env(name: string): string | undefined {
  const trimmed = process.env[name]?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * What the dashboard gets back. `chat_id` is `null` rather than absent because
 * "not known yet" is a fact about this student, and hiding it behind an optional
 * field is how a caller ends up assuming he is enrolled.
 */
interface PendingStudent {
  id: string;
  name: string;
  chat_id: null;
}

/** Longer than this and it will not survive Telegram's 64-character payload. */
const MAX_TOKEN_PAYLOAD = 63;

/**
 * An invite token: 16 hex characters, matching `TOKEN` in
 * `apps/channel/src/invite.ts`. Short because Telegram caps the `/start`
 * payload at 64 characters and the token travels inside it with a prefix.
 *
 * **Never derived from the name.** Two students called Jonas are two people, and
 * a token like `jonas` would hand the second one the first one's invite. The
 * name is a label; this is an identity, and identities are minted, not spelled.
 *
 * 64 bits of randomness: the token is one-time, expires on use, and guessing one
 * wins nothing but the chance to be enrolled as somebody else's student.
 */
function inviteToken(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession(request.headers);
  if (!session) {
    return Response.json(
      {
        error: "unauthenticated",
        message:
          "Sign in first. An invite is bound to one tutor's Telegram chat, so " +
          "it is only ever minted for the tutor who asked for it.",
      },
      { status: 401, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length === 0) {
    return Response.json(
      {
        error: "name_required",
        message:
          "Type his name. It is the whole reason he never has to sign up — the " +
          "bot greets him by the name you gave it.",
      },
      { status: 400, headers: NO_STORE },
    );
  }
  if (name.length > MAX_NAME) {
    return Response.json(
      {
        error: "name_too_long",
        message: `That is longer than ${MAX_NAME} characters. Use the name you call him in a lesson.`,
      },
      { status: 400, headers: NO_STORE },
    );
  }

  // BotFather usernames are sometimes pasted with the @ still attached.
  const bot = env("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "");
  if (!bot) {
    return Response.json(
      {
        error: "bot_not_configured",
        message:
          "TELEGRAM_BOT_USERNAME is not set on this server, so there is no bot " +
          "for him to tap through to. See docs/AUTH-SETUP.md.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  /*
   * The invite names the tutor it belongs to, so it cannot be minted without
   * one: a link with no tutor behind it opens a chat with the bot and enrols
   * precisely nobody. That is a 409, not a link.
   */
  const tutorTelegramId = session.user.telegramUserId;
  if (!tutorTelegramId) {
    return Response.json(
      {
        error: "telegram_not_linked",
        message:
          "Connect Telegram first, in Settings. The invite carries your Telegram " +
          "id — it is how the bot knows whose student he is. Without it the link " +
          "opens a chat and enrols nobody.",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const token = inviteToken();
  const student: PendingStudent = { id: `pending_${token}`, name, chat_id: null };
  const inviteUrl = `https://t.me/${bot}?start=i${token}`;
  if (inviteUrl.length > MAX_TOKEN_PAYLOAD + `https://t.me/${bot}?start=`.length) {
    // Unreachable with a 16-character token; here so a future longer one fails
    // loudly at the source rather than as a Telegram link that silently does
    // nothing when tapped.
    return Response.json(
      { error: "token_too_long", message: "The invite token is too long for a Telegram link." },
      { status: 500, headers: NO_STORE },
    );
  }

  const connectionString = env("DATABASE_URL");
  if (!connectionString) {
    // A session exists, so this is close to unreachable — but a 500 here would
    // throw away a perfectly good invite link she can still send him.
    return Response.json(
      {
        student: null,
        persisted: false,
        inviteUrl,
        message:
          "DATABASE_URL is not set on this server, so the invite was not saved. " +
          "Send him the link anyway — he appears on your roster when he taps it.",
      },
      { headers: NO_STORE },
    );
  }

  try {
    const sql = neon(connectionString);

    /*
     * The invite row IS the record of this student until he taps. It holds the
     * name she typed and the tutor she is, so the bot can greet him correctly
     * and file him under her without ever asking him anything.
     *
     * No student row is written here on purpose: `students.telegram_chat_id` is
     * NOT NULL and his chat id cannot be known yet, so there is no honest value
     * to put there.
     */
    await sql`
      INSERT INTO invites (token, tutor_telegram_id, student_name)
      VALUES (${token}, ${String(tutorTelegramId)}, ${name})
    `;

    return Response.json(
      {
        student,
        persisted: true,
        inviteUrl,
        message:
          `Invite ready. When ${name} taps it the bot already knows his name — ` +
          "he is on your roster from that moment, with nothing to sign up for.",
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    // The invite is already valid and costs nothing to hand over, so a database
    // that is down loses the row, not the onboarding.
    console.error("[students] could not write the invite row:", error);
    return Response.json(
      {
        student: null,
        persisted: false,
        inviteUrl,
        message:
          "The database did not accept the invite, so his name was not saved. " +
          "The link still works; the bot will ask him his name when he taps it.",
      },
      { headers: NO_STORE },
    );
  }
}
