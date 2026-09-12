/**
 * T-A6 — the tutor's identity, straight out of Telegram.
 *
 * `window.Telegram.WebApp.initData` is a query string Telegram signs with a key
 * derived from the bot token. Recompute the HMAC, compare, check freshness, and
 * you know who opened the panel. ~30 lines. No session, no OAuth, no login
 * screen — she taps the menu button and she is in.
 *
 * NEVER trust `initDataUnsafe` for anything that reads a row. It is the same
 * payload with the signature ignored, so anyone can post whatever they like.
 *
 * The scheme (Telegram's, not ours):
 *   secret = HMAC_SHA256(key = "WebAppData", message = botToken)
 *   check  = HMAC_SHA256(key = secret, message = dataCheckString)
 * where dataCheckString is every field except `hash`, sorted by key, joined
 * "k=v" with newlines. Getting the two keying steps the wrong way round is the
 * classic way to lose an hour here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: Date }
  | { ok: false; reason: string };

/** Reject anything older than this. Telegram's own guidance; stops replay. */
const MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifyInitData(
  initData: string,
  botToken = process.env.TELEGRAM_BOT_TOKEN,
  now: Date = new Date(),
): InitDataResult {
  if (!botToken) return { ok: false, reason: "TELEGRAM_BOT_TOKEN is not set" };
  if (!initData) return { ok: false, reason: "no initData" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "no hash in initData" };

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  // Constant-time: a comparison that short-circuits leaks the prefix.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature does not match" };
  }

  const authDateRaw = Number(params.get("auth_date"));
  if (!Number.isFinite(authDateRaw)) return { ok: false, reason: "no auth_date" };
  const authDate = new Date(authDateRaw * 1000);
  const ageSeconds = (now.getTime() - authDate.getTime()) / 1000;
  if (ageSeconds > MAX_AGE_SECONDS) {
    return { ok: false, reason: `initData is ${Math.round(ageSeconds / 3600)}h old` };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "no user in initData" };
  try {
    const user = JSON.parse(userRaw) as TelegramUser;
    if (typeof user?.id !== "number") return { ok: false, reason: "user has no id" };
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: "user is not valid JSON" };
  }
}
