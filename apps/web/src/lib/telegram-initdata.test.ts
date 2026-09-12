import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyInitData } from "./telegram-initdata";

const BOT_TOKEN = "8608535988:TEST-not-a-real-token";

/** Build a correctly signed initData the way Telegram does. */
function sign(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = new Date("2026-09-12T13:00:00Z");
const fresh = () => ({
  auth_date: String(Math.floor(now.getTime() / 1000) - 60),
  query_id: "AAF",
  user: JSON.stringify({ id: 12345, first_name: "Kalu", username: "meta_v" }),
});

test("a correctly signed payload identifies the real Telegram user", () => {
  const result = verifyInitData(sign(fresh()), BOT_TOKEN, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.user.id, 12345);
    assert.equal(result.user.first_name, "Kalu");
  }
});

// The whole point of verifying: initDataUnsafe would have accepted this.
test("a tampered user id is rejected", () => {
  const signed = sign(fresh());
  const params = new URLSearchParams(signed);
  params.set("user", JSON.stringify({ id: 999, first_name: "Attacker" }));
  const result = verifyInitData(params.toString(), BOT_TOKEN, now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /signature/);
});

test("a payload signed with a different bot token is rejected", () => {
  const result = verifyInitData(sign(fresh(), "other-token"), BOT_TOKEN, now);
  assert.equal(result.ok, false);
});

test("a stale payload is rejected even though the signature is valid", () => {
  const old = { ...fresh(), auth_date: String(Math.floor(now.getTime() / 1000) - 60 * 60 * 48) };
  const result = verifyInitData(sign(old), BOT_TOKEN, now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /old/);
});

test("missing or empty initData is rejected, not crashed on", () => {
  assert.equal(verifyInitData("", BOT_TOKEN, now).ok, false);
  assert.equal(verifyInitData("user=%7B%7D", BOT_TOKEN, now).ok, false);
});
