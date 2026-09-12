import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the cache at a throwaway dir BEFORE importing, so no test can ever
// write into apps/web/public or reach the network by accident.
const dir = mkdtempSync(join(tmpdir(), "illustrate-"));
process.env.BETWEEN_EXPLAIN_DIR = dir;
process.env.PUBLIC_APP_URL = "https://tunnel.example/";
process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";

const { illustrate, cacheKey, MAX_IMAGES_PER_DAY, __testing } = await import("./illustrate");

const input = {
  rule: "e -> a in the simple past of strong verbs",
  examples: ["sehen -> sah", "nehmen -> nahm"],
};

/** Pretend the picture is already on disk, so illustrate() never calls out. */
function seedCache(of: typeof input) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${cacheKey(of)}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
}

const realFetch = globalThis.fetch;
let fetchCalls = 0;

beforeEach(() => {
  fetchCalls = 0;
  __testing.resetBudget();
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Any network reach during a unit test is a bug in the test or the module.
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("no network in unit tests");
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a cached hash is served from disk without paying for it again", async () => {
  seedCache(input);
  const first = await illustrate(input);
  const second = await illustrate({ ...input, examples: [...input.examples] });

  assert.deepEqual(first, { url: `https://tunnel.example/explain/${cacheKey(input)}.png` });
  assert.deepEqual(second, first, "same rule + examples must resolve to the same url");
  assert.equal(fetchCalls, 0, "a cache hit must never touch the API");
});

test("the url is the public tunnel url, with no double slash", async () => {
  seedCache(input);
  const got = await illustrate(input);
  assert.ok(got);
  assert.match(got.url, /^https:\/\/tunnel\.example\/explain\/[0-9a-f]{16}\.png$/);
});

test("different rules hash differently; whitespace changes count", () => {
  const a = cacheKey(input);
  const b = cacheKey({ ...input, rule: "i -> a in the simple past" });
  const c = cacheKey({ ...input, examples: ["sehen -> sah"] });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(a, cacheKey({ rule: input.rule, examples: [...input.examples] }));
});

test("a transport failure returns null instead of throwing", async () => {
  const got = await illustrate({ rule: "uncached rule", examples: [] });
  assert.equal(got, null);
  assert.equal(fetchCalls, 1, "uncached input should have attempted the call");
  assert.equal(readdirSync(dir).length, 0, "a failed generation must not leave a file behind");
});

test("a non-ok response returns null and writes nothing", async () => {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("nope", { status: 429 });
  }) as typeof fetch;

  const got = await illustrate({ rule: "rate limited rule", examples: [] });
  assert.equal(got, null);
  assert.equal(readdirSync(dir).length, 0);
});

test("a success writes the bytes and returns the url", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return Response.json({ data: [{ b64_json: png.toString("base64") }] });
  }) as typeof fetch;

  const subject = { rule: "a fresh rule", examples: ["fahren -> fuhr"] };
  const got = await illustrate(subject);
  assert.deepEqual(got, { url: `https://tunnel.example/explain/${cacheKey(subject)}.png` });
  assert.deepEqual(readdirSync(dir), [`${cacheKey(subject)}.png`]);

  // And the second call is free.
  const again = await illustrate(subject);
  assert.deepEqual(again, got);
  assert.equal(fetchCalls, 1);
});

test("a response with no image bytes returns null", async () => {
  globalThis.fetch = (async () => Response.json({ data: [] })) as typeof fetch;
  assert.equal(await illustrate({ rule: "empty payload", examples: [] }), null);
});

test("the budget guard refuses past MAX_IMAGES_PER_DAY without calling out", async () => {
  assert.ok(MAX_IMAGES_PER_DAY > 0);
  __testing.spend(MAX_IMAGES_PER_DAY);

  const got = await illustrate({ rule: "one rule too many", examples: [] });
  assert.equal(got, null);
  assert.equal(fetchCalls, 0, "past budget we must not spend anything");
});

test("a cached picture is still served after the budget is spent", async () => {
  seedCache(input);
  __testing.spend(MAX_IMAGES_PER_DAY);
  assert.ok(await illustrate(input), "the budget caps spending, not serving");
});

test("missing config fails soft rather than throwing", async () => {
  const url = process.env.PUBLIC_APP_URL;
  const key = process.env.OPENAI_API_KEY;
  try {
    delete process.env.PUBLIC_APP_URL;
    assert.equal(await illustrate(input), null, "no public url means no reachable image");

    process.env.PUBLIC_APP_URL = url;
    delete process.env.OPENAI_API_KEY;
    assert.equal(await illustrate({ rule: "no key", examples: [] }), null);
    assert.equal(fetchCalls, 0);
  } finally {
    process.env.PUBLIC_APP_URL = url;
    process.env.OPENAI_API_KEY = key;
  }
});

test("junk input returns null rather than exploding", async () => {
  assert.equal(await illustrate({ rule: "   ", examples: [] }), null);
  assert.equal(await illustrate({ rule: "ok", examples: null as never }), null);
  assert.equal(await illustrate(null as never), null);
  assert.equal(fetchCalls, 1, "only the one well-formed-but-uncached call goes out");
});

test("the prompt asks for a diagram, not an illustration", () => {
  const prompt = __testing.diagramPrompt(input.rule, input.examples);
  assert.match(prompt, /diagram/i);
  assert.match(prompt, /no people/i);
  assert.ok(prompt.includes("sehen -> sah"), "worked examples must reach the model");
  assert.ok(prompt.includes(input.rule));
});
