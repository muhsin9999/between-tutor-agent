/**
 * The bot's half of account linking — ONBOARDING.md flow 1, step 5.
 *
 * She tapped `t.me/<bot>?start=link_<token>` on her laptop. Telegram opens her
 * chat with the bot and sends us `/start link_<token>`. This file is what turns
 * that string into the join: verify the signature, then write
 * `user.telegram_user_id` onto the Better Auth row the token names.
 *
 * ── Two deliberate constraints ─────────────────────────────────────────────
 *
 * **It does not import the dashboard.** `apps/channel` is a separate deploy (a
 * long-lived Node process on Render; the dashboard is Next on Vercel) and has no
 * dependency on it. So the verification below is a knowing duplicate of
 * `apps/dashboard/src/lib/link-token.ts` — the canonical file, which carries the
 * full reasoning about Telegram's 64-character payload budget and why the
 * signature is truncated to 64 bits. The two must stay byte-compatible: they
 * read the same `BETTER_AUTH_SECRET` and pack the same three fields in the same
 * order. Change one, change the other.
 *
 * **It talks to Neon directly.** `DATABASE_URL`, `@neondatabase/serverless`, one
 * statement. Better Auth owns the `user` table; we write exactly one column of
 * it and touch nothing else.
 *
 * ── What stops someone linking to another tutor's account ──────────────────
 *
 * 1. The token is signed, so it cannot be forged or edited — the user id inside
 *    it is the one the dashboard put there.
 * 2. The dashboard only mints one for a tutor with a live session, so a token
 *    naming her id can only have come from her own browser.
 * 3. It expires in fifteen minutes, so a link scraped from a screen share or a
 *    shoulder is stale before it is useful.
 * 4. And below: a Telegram account already attached to a different tutor is
 *    refused, so a second account cannot be quietly stolen or shared.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { Markdown, Message, Section } from "@copilotkit/channels";
import type { ChannelNode } from "@copilotkit/channels";
import { jsx } from "@copilotkit/channels/jsx-runtime";

/* ────────────────────────────────────────────────────────── the token, again */

/** Must match `LINK_PREFIX` in the dashboard. */
const LINK_PREFIX = "link_";
/** 64 (Telegram's payload limit) minus the prefix. */
const MAX_TOKEN_LENGTH = 64 - LINK_PREFIX.length;
const EXPIRY_BYTES = 4;
const TAG_BYTES = 8;
const TELEGRAM_SAFE = /^[A-Za-z0-9_-]+$/;

function tag(head: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret).update(head).digest().subarray(0, TAG_BYTES);
}

/**
 * Verify a link token minted by the dashboard. `null` on every failure, and it
 * never throws and never says which failure it was.
 *
 * Exported for the tests that prove it agrees with the dashboard's minter.
 */
export function verifyLinkToken(
  token: string,
  secret: string | undefined = process.env.BETTER_AUTH_SECRET,
  now: Date = new Date(),
): { userId: string } | null {
  try {
    const key = secret?.trim();
    if (!key) return null;
    if (typeof token !== "string") return null;
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
    if (!TELEGRAM_SAFE.test(token)) return null;

    const raw = Buffer.from(token, "base64url");
    if (raw.toString("base64url") !== token) return null;

    const headLength = raw.length - TAG_BYTES;
    if (headLength <= EXPIRY_BYTES) return null;

    const head = raw.subarray(0, headLength);
    const presented = raw.subarray(headLength);
    const expected = tag(head, key);

    // Constant time. A short-circuiting compare leaks the tag byte by byte.
    if (presented.length !== expected.length) return null;
    if (!timingSafeEqual(presented, expected)) return null;

    const expiry = head.readUInt32BE(headLength - EXPIRY_BYTES);
    if (Math.floor(now.getTime() / 1000) >= expiry) return null;

    const userId = head.subarray(0, headLength - EXPIRY_BYTES).toString("utf8");
    if (userId.length === 0) return null;

    return { userId };
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────── the result */

export type LinkResult =
  | { ok: true; userId: string; name: string | null }
  | { ok: false; reason: string };

/**
 * Is this `/start` payload a link attempt at all?
 *
 * The same command carries student invites, so the bot needs to tell them apart
 * before it decides what to do.
 */
export function isLinkStart(payload: string): boolean {
  return payload.trim().startsWith(LINK_PREFIX);
}

/* ──────────────────────────────────────────────────────────────── the write */

/**
 * Complete the link.
 *
 * @param payload        the raw `/start` argument — `link_<token>`, or the bare
 *                       token if the caller already stripped the prefix.
 * @param telegramUserId the Telegram account that tapped it. Stored as text: a
 *                       64-bit Telegram id does not survive a JS number.
 *
 * Never throws. Every failure — bad token, missing database, deleted account, a
 * Telegram account already spoken for — comes back as `{ ok: false, reason }`
 * so the bot can say something true instead of falling over.
 */
export async function handleLinkStart(
  payload: string,
  telegramUserId: string | number,
): Promise<LinkResult> {
  const trimmed = payload.trim();
  const token = trimmed.startsWith(LINK_PREFIX)
    ? trimmed.slice(LINK_PREFIX.length)
    : trimmed;

  const verified = verifyLinkToken(token);
  if (!verified) {
    return {
      ok: false,
      reason:
        "That link is no longer valid — it lasts fifteen minutes. " +
        "Open Settings on the dashboard and tap Connect Telegram again.",
    };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { ok: false, reason: "DATABASE_URL is not set, so there is no account to link to." };
  }

  const telegram = String(telegramUserId);
  if (!/^-?\d+$/.test(telegram)) {
    return { ok: false, reason: "That Telegram id does not look like a Telegram id." };
  }

  try {
    const sql = neon(databaseUrl);

    /*
     * One statement, so there is no window between "is this Telegram account
     * free?" and "take it". The NOT EXISTS clause is the refusal: a Telegram
     * account already attached to a DIFFERENT tutor cannot be moved by tapping
     * a link. Re-tapping her own link is a no-op that still succeeds, which is
     * what a tutor who taps twice expects.
     *
     * The column has a UNIQUE constraint behind this as a second line; the
     * clause exists so the normal case is a clean refusal rather than a
     * constraint violation.
     */
    const rows = (await sql`
      UPDATE "user"
         SET telegram_user_id = ${telegram},
             "updatedAt" = now()
       WHERE id = ${verified.userId}
         AND NOT EXISTS (
               SELECT 1 FROM "user" other
                WHERE other.telegram_user_id = ${telegram}
                  AND other.id <> ${verified.userId}
             )
      RETURNING id, name
    `) as Array<{ id: string; name: string | null }>;

    const row = rows[0];
    if (row) {
      return { ok: true, userId: row.id, name: row.name?.trim() || null };
    }

    // Nothing updated. Two possible reasons, and they deserve different words.
    const taken = (await sql`
      SELECT id FROM "user" WHERE telegram_user_id = ${telegram} LIMIT 1
    `) as Array<{ id: string }>;

    if (taken.length > 0) {
      return {
        ok: false,
        reason:
          "This Telegram account is already connected to a different Between " +
          "account. Disconnect it there first, or use the Telegram account you " +
          "teach from.",
      };
    }

    return {
      ok: false,
      reason: "That account no longer exists. Sign in on the dashboard and try again.",
    };
  } catch (error) {
    console.error("[link] could not write telegram_user_id:", error);
    return { ok: false, reason: "Something went wrong saving the link. Try again in a moment." };
  }
}

/* ─────────────────────────────────────────────────────────── what she sees */

/**
 * The confirmation the bot posts into her chat.
 *
 * This is the step-5 moment in ONBOARDING.md: her phone lights up with a bot
 * that already knows her name. So it uses the name when there is one, and says
 * what changed in one line rather than congratulating her.
 *
 * Built with the JSX factory rather than JSX syntax because this file is `.ts`,
 * where `<Message>` will not parse. `#16306B` is the tutor accent, as in
 * `channel.tsx`.
 */
export function linkedConfirmation(name: string | null): ChannelNode {
  const greeting = name ? `Hello ${name} — connected.` : "Connected.";
  return jsx(Message, {
    accent: "#16306B",
    children: jsx(Section, {
      children: jsx(Markdown, {
        children:
          `${greeting} This chat and your dashboard are the same account now.\n\n` +
          "Send me a line after a lesson — start it with a student's name — and it shows up there.",
      }),
    }),
  });
}

/** The other half: a link that did not work, said plainly. */
export function linkFailed(reason: string): ChannelNode {
  return jsx(Message, {
    accent: "#16306B",
    children: jsx(Section, { children: jsx(Markdown, { children: reason }) }),
  });
}
