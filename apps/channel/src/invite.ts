/**
 * Per-student invites — the bot's half.
 *
 * The dashboard mints one token per student, carrying the name his tutor typed
 * when she invited him. He taps `t.me/<bot>?start=i<token>`, and this turns that
 * string into an enrolled student who is already called the right thing.
 *
 * That is the difference between this and the old generic link. The old payload
 * was the tutor's own chat id — the same link for everyone she taught — so the
 * bot knew only that *somebody's* tutor was that person and had to ask him his
 * name. ONBOARDING.md is explicit that it should not have to: "his sign-up is a
 * tap, because everything the system needs to know about him, she supplied."
 *
 * Like `link.ts`, this talks to Neon directly and imports nothing from the
 * dashboard — `apps/channel` is a separate deploy and must stay that way.
 */
import { neon } from "@neondatabase/serverless";

/** Distinguishes an invite payload from `link_<token>` and from a bare chat id. */
const INVITE_PREFIX = "i";

/** 16 hex characters. Must match the dashboard's minter. */
const TOKEN = /^[0-9a-f]{16}$/;

export type ClaimResult =
  | { ok: true; name: string; tutorTelegramId: string; alreadyClaimed: boolean }
  | { ok: false; reason: string };

/**
 * Is this `/start` payload a per-student invite?
 *
 * Deliberately strict. `/start link_abc` also begins with "i"... it does not,
 * but a bare tutor chat id is all digits and `link_` starts with "l", so the
 * shape check below is what keeps the three payload kinds from colliding as
 * more are added.
 */
export function isInviteStart(payload: string): boolean {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(INVITE_PREFIX)) return false;
  return TOKEN.test(trimmed.slice(INVITE_PREFIX.length));
}

/**
 * Claim an invite for this chat.
 *
 * Never throws; every failure comes back as `{ ok: false, reason }` so the bot
 * can say something true rather than falling over in front of a student.
 *
 * **Re-tapping is not an error.** A student who taps his own link twice — or
 * opens it again a week later to find the chat — gets `alreadyClaimed: true`
 * and the same name, not a refusal. What the guard actually prevents is a link
 * forwarded to a *different* person enrolling them under the first one's name.
 */
export async function claimInvite(
  payload: string,
  chatId: number,
): Promise<ClaimResult> {
  const trimmed = payload.trim();
  const token = trimmed.startsWith(INVITE_PREFIX)
    ? trimmed.slice(INVITE_PREFIX.length)
    : trimmed;

  if (!TOKEN.test(token)) {
    return { ok: false, reason: "That invite link doesn't look right. Ask your tutor to send it again." };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { ok: false, reason: "DATABASE_URL is not set, so there is no invite to look up." };
  }

  try {
    const sql = neon(databaseUrl);

    /*
     * One statement, so there is no window between "is this invite unclaimed?"
     * and "claim it". The WHERE clause is the guard: a token already claimed by
     * a DIFFERENT chat updates nothing, and the same chat re-tapping matches and
     * is harmlessly re-written.
     */
    const claimed = (await sql`
      UPDATE invites
         SET claimed_at = COALESCE(claimed_at, now()),
             claimed_chat_id = ${chatId}
       WHERE token = ${token}
         AND (claimed_chat_id IS NULL OR claimed_chat_id = ${chatId})
      RETURNING student_name, tutor_telegram_id,
                (claimed_at < now() - interval '1 second') AS was_claimed
    `) as Array<{ student_name: string; tutor_telegram_id: string; was_claimed: boolean }>;

    const row = claimed[0];
    if (row) {
      return {
        ok: true,
        name: String(row.student_name),
        tutorTelegramId: String(row.tutor_telegram_id),
        alreadyClaimed: Boolean(row.was_claimed),
      };
    }

    // Nothing updated: either no such token, or somebody else has it.
    const exists = (await sql`SELECT 1 FROM invites WHERE token = ${token}`) as unknown[];
    return {
      ok: false,
      reason:
        exists.length > 0
          ? "That invite has already been used by someone else. Ask your tutor for your own link."
          : "That invite link isn't valid. Ask your tutor to send you a new one.",
    };
  } catch (error) {
    console.error("[invite] could not claim:", error);
    return { ok: false, reason: "Something went wrong opening that link. Try again in a moment." };
  }
}
