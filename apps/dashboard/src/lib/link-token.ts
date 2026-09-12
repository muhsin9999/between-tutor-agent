/**
 * The account-linking token — ONBOARDING.md flow 1, step 4.
 *
 * She signs in on the web with Google. Her phone already has the bot. Nothing
 * yet says those are the same person. This mints the short-lived, signed
 * bearer of exactly one fact — "user X asked to link, and asked recently" —
 * that travels through a `t.me` deep link and comes back to us inside the
 * bot's `/start` payload, where `apps/channel/src/link.ts` verifies it with the
 * same secret and writes `user.telegram_user_id`.
 *
 * The HMAC pattern is the one already proven in
 * `apps/web/src/lib/telegram-initdata.ts`: recompute, compare in constant time,
 * reject on age. Not re-derived — reused.
 *
 * ── Why the token looks the way it does ────────────────────────────────────
 *
 * **Telegram's deep-link budget is 64 characters, and the alphabet is
 * `A-Za-z0-9_-` only.** `https://t.me/<bot>?start=<payload>` silently drops or
 * mangles a payload that breaks either rule — there is no error, the tap just
 * opens the bot with nothing attached, and the tutor sees a bot that does not
 * know her. So the budget is a hard constraint, not a nicety:
 *
 *     "link_"  (5)  +  token  (<= 59)   =  64
 *
 * That rules out the obvious shape. `base64url(userId.expiry)` with a literal
 * `.` joining the encoded payload to the signature costs two things we cannot
 * afford: the `.` is not in Telegram's alphabet at all, and base64-ing the two
 * halves separately pays the +33% expansion twice. So the same three fields are
 * packed once and encoded once:
 *
 *     base64url( utf8(userId) ‖ uint32be(expiry) ‖ hmac-sha256(…)[0..8) )
 *
 * The `userId.expiry` join still exists — it is the concatenation inside the
 * blob, split on verify by fixed offsets from the END, which is what lets the
 * user id stay variable length.
 *
 * A Better Auth id is 32 characters, so the usual token is exactly
 * 32 + 4 + 8 = 44 bytes → 59 base64url characters → 64 with the prefix. Exactly
 * at the limit, with no slack: {@link mintLinkToken} therefore refuses to emit a
 * token that would not survive the trip, rather than handing back a link that
 * fails silently on a phone.
 *
 * The signature is truncated to 64 bits. That is the one place the budget costs
 * us something, and it is affordable: forging a link means guessing a 64-bit tag
 * against a live bot, online, inside a 15-minute window, for one specific user
 * id — there is no offline oracle, because the tag is never shown to anyone but
 * the tutor who asked for it.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Telegram's hard limit on a `/start` payload. Not ours to raise. */
const TELEGRAM_START_PAYLOAD_MAX = 64;

/** What the bot matches on, so it can tell a link from a student invite. */
export const LINK_PREFIX = "link_";

/** Everything left for the token itself once the prefix is paid for. */
export const MAX_TOKEN_LENGTH = TELEGRAM_START_PAYLOAD_MAX - LINK_PREFIX.length;

/**
 * Fifteen minutes. Long enough to walk to the other room and find your phone,
 * short enough that a link left open in a tab is not a standing invitation.
 */
export const LINK_TOKEN_TTL_SECONDS = 15 * 60;

/** `uint32be` seconds since the epoch. Good until 2106; see the comment there. */
const EXPIRY_BYTES = 4;

/** Truncated HMAC-SHA256. 64 bits, online-only attack surface. */
const TAG_BYTES = 8;

/** Telegram's `/start` alphabet — anything else never survives the tap. */
const TELEGRAM_SAFE = /^[A-Za-z0-9_-]+$/;

/** The signing key. The bot reads the same variable, so the two agree by construction. */
function secretOrThrow(secret: string | undefined): string {
  const trimmed = secret?.trim();
  if (!trimmed) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set — a Telegram link token cannot be signed.",
    );
  }
  return trimmed;
}

/** HMAC-SHA256 over the packed head, truncated to {@link TAG_BYTES}. */
function tag(head: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret).update(head).digest().subarray(0, TAG_BYTES);
}

/**
 * Mint a link token for one tutor.
 *
 * Throws — rather than returning something unusable — when the secret is
 * missing or the resulting deep link would exceed Telegram's budget. Both are
 * server misconfiguration, not user input, and both are invisible failures on a
 * phone if they are allowed through.
 */
export function mintLinkToken(
  userId: string,
  secret: string | undefined = process.env.BETTER_AUTH_SECRET,
  now: Date = new Date(),
): string {
  const key = secretOrThrow(secret);

  const id = Buffer.from(userId, "utf8");
  if (id.length === 0) throw new Error("mintLinkToken: userId is empty.");

  // Seconds, not milliseconds: four bytes hold seconds until 2106 and would
  // hold barely seven weeks of milliseconds.
  const expiry = Math.floor(now.getTime() / 1000) + LINK_TOKEN_TTL_SECONDS;

  const head = Buffer.alloc(id.length + EXPIRY_BYTES);
  id.copy(head, 0);
  head.writeUInt32BE(expiry, id.length);

  const token = Buffer.concat([head, tag(head, key)]).toString("base64url");

  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error(
      `mintLinkToken: token is ${token.length} characters; Telegram allows ` +
        `${MAX_TOKEN_LENGTH} after the "${LINK_PREFIX}" prefix. The user id is ` +
        `${id.length} bytes — a deep link built from this would break silently.`,
    );
  }

  return token;
}

/** The exact string the bot receives as `/start <payload>`. */
export function linkStartPayload(token: string): string {
  return `${LINK_PREFIX}${token}`;
}

/**
 * Verify a link token.
 *
 * Returns `null` for every failure — expired, tampered, signed with a different
 * secret, truncated, not a token at all — and never throws and never says which.
 * A caller that learns *why* a token failed is a caller that can be used as an
 * oracle.
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
    // Node's base64 decoder is lenient — it skips what it cannot read. Round-
    // tripping is what turns "mostly base64url" back into a rejection.
    if (raw.toString("base64url") !== token) return null;

    const headLength = raw.length - TAG_BYTES;
    if (headLength <= EXPIRY_BYTES) return null; // no room for a user id

    const head = raw.subarray(0, headLength);
    const presented = raw.subarray(headLength);
    const expected = tag(head, key);

    // Constant time: a comparison that short-circuits leaks the tag one byte
    // at a time, and a 64-bit tag leaked a byte at a time is an 8-guess forgery.
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
