/**
 * Tests for the account-linking token.
 *
 *   node --import tsx --test apps/dashboard/src/lib/link-token.test.ts
 *
 * Four of these are the ones that matter, and they are the four ways this can be
 * attacked rather than the four ways it can be used: a token that outlives its
 * window, a token edited in flight, a token signed by someone else, and — the
 * one that is easy to forget — a token that is fine but too long to survive
 * Telegram's 64-character `/start` payload, which fails silently on the phone
 * and looks like the bot ignoring her.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LINK_PREFIX,
  LINK_TOKEN_TTL_SECONDS,
  MAX_TOKEN_LENGTH,
  linkStartPayload,
  mintLinkToken,
  verifyLinkToken,
} from "./link-token";

const SECRET = "a-test-secret-that-is-not-the-real-one";
const OTHER_SECRET = "a-different-secret-entirely";
/** A Better Auth id: 32 characters, [a-zA-Z0-9]. The realistic worst case. */
const USER_ID = "aB3xK9mQ7pL2zR5tV8wY1nC4dF6gH0jS";
const NOW = new Date("2026-09-12T10:00:00.000Z");

test("happy path — a fresh token verifies back to the same user", () => {
  const token = mintLinkToken(USER_ID, SECRET, NOW);
  assert.deepEqual(verifyLinkToken(token, SECRET, NOW), { userId: USER_ID });
});

test("happy path — still valid one second before it expires", () => {
  const token = mintLinkToken(USER_ID, SECRET, NOW);
  const justInTime = new Date(NOW.getTime() + (LINK_TOKEN_TTL_SECONDS - 1) * 1000);
  assert.deepEqual(verifyLinkToken(token, SECRET, justInTime), { userId: USER_ID });
});

test("expired — one second past fifteen minutes is null", () => {
  const token = mintLinkToken(USER_ID, SECRET, NOW);
  const tooLate = new Date(NOW.getTime() + (LINK_TOKEN_TTL_SECONDS + 1) * 1000);
  assert.equal(verifyLinkToken(token, SECRET, tooLate), null);
});

test("tampered — changing any single character invalidates the token", () => {
  const token = mintLinkToken(USER_ID, SECRET, NOW);

  for (let i = 0; i < token.length; i += 1) {
    const swap = token[i] === "A" ? "B" : "A";
    const edited = token.slice(0, i) + swap + token.slice(i + 1);
    if (edited === token) continue;
    assert.equal(
      verifyLinkToken(edited, SECRET, NOW),
      null,
      `character ${i} was editable — the signature did not cover it`,
    );
  }
});

test("tampered — a token re-signed for a different user id is not accepted", () => {
  // The forgery that matters: keep the shape, swap the tutor. Without the key
  // the attacker cannot produce a tag, so the edited head fails the compare.
  const mine = mintLinkToken(USER_ID, SECRET, NOW);
  const raw = Buffer.from(mine, "base64url");
  raw.write("zZ9yX8wV7uT6sR5qP4oN3mL2kJ1hG0fE", 0, "utf8");
  assert.equal(verifyLinkToken(raw.toString("base64url"), SECRET, NOW), null);
});

test("wrong secret — a valid token from another deployment is null", () => {
  const token = mintLinkToken(USER_ID, OTHER_SECRET, NOW);
  assert.equal(verifyLinkToken(token, SECRET, NOW), null);
  // And the same statement from the other side: our token is useless to them.
  assert.equal(verifyLinkToken(mintLinkToken(USER_ID, SECRET, NOW), OTHER_SECRET, NOW), null);
});

test("no secret — nothing can be minted, and nothing verifies", () => {
  assert.throws(() => mintLinkToken(USER_ID, undefined, NOW));
  assert.throws(() => mintLinkToken(USER_ID, "   ", NOW));
  assert.equal(verifyLinkToken(mintLinkToken(USER_ID, SECRET, NOW), undefined, NOW), null);
});

test("garbage in — never throws, always null", () => {
  for (const junk of ["", "   ", "link_", "not a token", "..", "AAAA", "a".repeat(200)]) {
    assert.equal(verifyLinkToken(junk, SECRET, NOW), null, `threw or accepted: ${junk}`);
  }
  // Deliberately not a string, because a route handler will eventually hand it
  // something from a query parameter.
  assert.equal(verifyLinkToken(undefined as unknown as string, SECRET, NOW), null);
});

test("the deep link fits inside Telegram's 64-character /start payload", () => {
  const token = mintLinkToken(USER_ID, SECRET, NOW);
  const payload = linkStartPayload(token);

  assert.ok(token.length <= MAX_TOKEN_LENGTH, `token is ${token.length} characters`);
  assert.equal(payload.length, 64, "a 32-character user id should sit exactly at the limit");
  assert.match(payload, /^[A-Za-z0-9_-]+$/, "Telegram only carries A-Za-z0-9_- through a deep link");
  assert.ok(payload.startsWith(LINK_PREFIX));
});

test("a user id too long for the payload is refused, not silently broken", () => {
  assert.throws(
    () => mintLinkToken("x".repeat(64), SECRET, NOW),
    /Telegram allows/,
    "a link that cannot be tapped must fail here, not on her phone",
  );
});
