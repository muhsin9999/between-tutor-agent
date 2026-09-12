/**
 * Generated-image explanations — a small teaching diagram for a grammar rule.
 *
 * MODEL SURVEY (GET https://api.openai.com/v1/models, run against this account
 * on 2026-09-12). The image models actually available were:
 *
 *     gpt-image-1                 gpt-image-2
 *     gpt-image-1-mini    <-- chosen
 *     gpt-image-1.5               gpt-image-2.5-flare
 *     chatgpt-image-latest        gpt-image-2.5-sunburst
 *
 * No dall-e-2 / dall-e-3 on this key at all, so the "256x256 for a tenth of a
 * cent" escape hatch does not exist here. `gpt-image-1-mini` is the only -mini
 * variant and is the cheapest of the set; the brief says cost beats fidelity,
 * so that is the pick. The smallest size any gpt-image-* model accepts is
 * 1024x1024 (there is no 256 or 512 tier), and the cheapest rung on top of that
 * is quality:"low" — both are set below.
 *
 * Cost, per OpenAI's published image pricing for gpt-image-1-mini at
 * 1024x1024 / low quality: roughly $0.005 per image (about half a cent).
 * Rendered once per distinct rule then cached on disk forever, so a class of
 * thirty students sharing six rules pays for six pictures.
 *
 * LATENCY IS THE REAL COST HERE, NOT MONEY. See the note on illustrate().
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Cheapest image model on this account. See survey above. */
const MODEL = "gpt-image-1-mini";

/** Smallest size gpt-image-* accepts, and its cheapest quality rung. */
const SIZE = "1024x1024";
const QUALITY = "low";

/**
 * Hard ceiling on paid generations per UTC day. A runaway agent loop calling
 * illustrate() in a retry spiral is the only way this feature spends real
 * money; past this number we hand back null and the turn proceeds without a
 * picture. Cache hits do not count — they cost nothing.
 */
export const MAX_IMAGES_PER_DAY = 40;

/** Wall-clock ceiling on the API call. Past this the student waits for nothing. */
const TIMEOUT_MS = 30_000;

export type IllustrateInput = {
  /** The rule in plain words, e.g. "e -> a in the simple past of strong verbs". */
  rule: string;
  /** Worked pairs, e.g. ["sehen -> sah", "nehmen -> nahm"]. */
  examples: string[];
};

/**
 * Where the bytes land. Telegram fetches `<Image url>` over the public
 * internet, so the file has to sit in the web app's static dir and be served
 * from PUBLIC_APP_URL (the tunnel). Resolved off this module's own location so
 * it does not depend on which app's cwd we were started from.
 */
function explainDir(): string {
  const override = process.env.BETWEEN_EXPLAIN_DIR;
  if (override) return resolve(override);
  const here = dirname(fileURLToPath(import.meta.url)); // packages/agent-core/src
  return resolve(here, "..", "..", "..", "apps", "web", "public", "explain");
}

/**
 * Content hash of the request. Same rule + same examples means the same
 * filename and so never paying twice — across restarts too, because the cache
 * is the filesystem rather than anything held in memory.
 */
export function cacheKey(input: IllustrateInput): string {
  const canonical = JSON.stringify({
    rule: input.rule,
    examples: [...input.examples],
    model: MODEL,
    size: SIZE,
    quality: QUALITY,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

// ── budget ───────────────────────────────────────────────────────────────────

let spendDay = "";
let spentToday = 0;

function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC day
}

function budgetRemaining(): number {
  const day = today();
  if (day !== spendDay) {
    spendDay = day;
    spentToday = 0;
  }
  return MAX_IMAGES_PER_DAY - spentToday;
}

// ── prompt ───────────────────────────────────────────────────────────────────

/**
 * A diagram, not an illustration. The failure mode of an image model asked
 * about German verbs is a watercolour of a man walking; every line here pushes
 * away from that and towards something a student could have drawn on the back
 * of an exercise book.
 *
 * KNOWN DEFECT, from the one real generation run against this prompt: the model
 * obeyed "diagram, not art" and spelled the German correctly, but it ran the
 * longer rows off the right edge — "nahmen" and "sprachen" are clipped mid-word
 * — and it circled the whole past-tense word instead of just the changed vowel.
 * The prompt is left exactly as measured rather than tuned blind; a fix worth
 * trying is an explicit margin instruction ("keep all text inside the frame
 * with a wide margin on all four sides") plus dropping to two examples, but
 * that costs another generation to confirm and changes every cache key.
 */
function diagramPrompt(rule: string, examples: string[]): string {
  const pairs = examples.slice(0, 3);
  return [
    "A minimal black-on-white teaching diagram for a German grammar lesson.",
    "Flat vector style, thick clean lines, no shading, no background scenery,",
    "no people, no illustration — this is a chalkboard explainer, not art.",
    "",
    `The rule being shown: ${rule}`,
    pairs.length ? `Worked examples to lay out: ${pairs.join("; ")}` : "",
    "",
    "Layout: each example on its own row, present tense on the left and past",
    "tense on the right, joined by a single bold arrow. Set the vowel that",
    "changes in a heavy contrasting colour and circle it on both sides, so the",
    "eye lands on the vowel and nothing else. Every other letter stays black.",
    "Large, correctly spelled German words. At most six words of label text.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── main ─────────────────────────────────────────────────────────────────────

/**
 * Returns a publicly fetchable PNG url for this rule, or null.
 *
 * Never throws. A missing picture is a missing picture; it must not take the
 * student's turn down with it, so every failure path — no key, no budget, bad
 * response, unwritable disk, timeout — returns null and the caller sends text.
 *
 * TIMING: a cache hit is a single stat(), sub-millisecond, safe on the hot
 * path. A cache MISS is a real generation and is measured in SECONDS, not
 * milliseconds. Do not await this inline in a reply the student is waiting on.
 * Warm the cache for a day's rules ahead of time, or generate after the reply
 * has already gone out.
 */
export async function illustrate(input: IllustrateInput): Promise<{ url: string } | null> {
  try {
    if (!input || typeof input.rule !== "string" || !input.rule.trim()) return null;
    const examples = Array.isArray(input.examples) ? input.examples : [];

    const base = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "");
    if (!base) return null; // no tunnel, no url Telegram could fetch, so nothing worth paying for

    const hash = cacheKey({ rule: input.rule, examples });
    const file = join(explainDir(), `${hash}.png`);
    const url = `${base}/explain/${hash}.png`;

    // Cache by content hash. Check disk BEFORE spending anything.
    try {
      await access(file);
      return { url };
    } catch {
      // not cached yet — fall through and generate
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    // Budget guard: refuse rather than let a loop spend real money.
    if (budgetRemaining() <= 0) return null;
    spentToday += 1;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: diagramPrompt(input.rule, examples),
        size: SIZE,
        quality: QUALITY,
        n: 1,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) return null;

    const bytes = Buffer.from(b64, "base64");
    if (bytes.length === 0) return null;

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);

    return { url };
  } catch {
    // Fail soft, always.
    return null;
  }
}

/** Test seam. Not part of the surface the agent calls. */
export const __testing = {
  diagramPrompt,
  explainDir,
  resetBudget() {
    spendDay = "";
    spentToday = 0;
  },
  spend(n: number) {
    budgetRemaining();
    spentToday += n;
  },
};
