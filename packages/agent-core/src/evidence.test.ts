import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ERROR_TAGS, type Plan } from "./contracts";

process.env.BETWEEN_STORE = process.env.BETWEEN_STORE ?? ".data/evidence-test.json";
const evidence = await import("./evidence");
const store = await import("./store");

const plan: Plan = {
  student_id: "jonas",
  version: 1,
  reason: "initial plan from tutor brief",
  created_at: new Date(0).toISOString(),
  days: [
    [1, "gehen", "ging"], [2, "sehen", "sah"], [3, "nehmen", "nahm"],
    [4, "sprechen", "sprach"], [5, "trinken", "trank"], [6, "fahren", "fuhr"],
  ].map(([day, item, expects]) => ({
    day: day as 1 | 2 | 3 | 4 | 5 | 6,
    kind: "drill" as const,
    prompt: `past tense of ${item}`,
    target_items: [item as string],
    expects: expects as string,
  })),
};

beforeEach(() => {
  store.reset();
  store.addPlan(plan);
});

test("normalisation makes harmless formatting differences correct", () => {
  assert.equal(evidence.normalizeAnswer(" The, GING! "), "ging");
  assert.equal(evidence.gradeAttempt(plan.days[0]!, "GING.").correct, true);
});

test("two regularised strong verbs fire a deterministic repeat-error trigger", () => {
  store.addAttempt({ student_id: "jonas", plan_version: 1, day: 1, answered_at: "2026-01-01T00:00:00.000Z", gave: "sehte", correct: false, error_tag: "strong-verb-vowel" });
  store.addAttempt({ student_id: "jonas", plan_version: 1, day: 2, answered_at: "2026-01-02T00:00:00.000Z", gave: "nehmte", correct: false, error_tag: "strong-verb-vowel" });
  assert.deepEqual(evidence.detectEvidence({ plan, attempts: store.attemptsFor("jonas"), dueDay: 2 }), {
    kind: "same-error-twice", error_tag: "strong-verb-vowel",
  });
});

test("a repeat error appends a legal v2 instead of overwriting v1", async () => {
  await evidence.recordStudentTurn({ student_id: "jonas", day: 1, gave: "sehte", now: new Date("2026-01-01"), revise: async (args) => ({ ...args.plan, version: 2, reason: "Two strong-verb vowel errors; explain the pattern on day 3.", created_at: new Date().toISOString() }) });
  const result = await evidence.recordStudentTurn({ student_id: "jonas", day: 2, gave: "nehmte", now: new Date("2026-01-02"), revise: async (args) => ({ ...args.plan, version: 2, reason: "Two strong-verb vowel errors; explain the pattern on day 3.", created_at: new Date().toISOString() }) });
  assert.equal(result.trigger?.kind, "same-error-twice");
  assert.equal(result.revised_plan?.version, 2);
  assert.deepEqual(store.planHistory("jonas").map((item) => item.version), [1, 2]);
});

test("a prior version's trigger does not re-fire after the plan is revised", () => {
  const v2 = { ...plan, version: 2, reason: "same error twice" };
  const oldAttempts = [
    { student_id: "jonas", plan_version: 1, day: 1, answered_at: "2026-01-01T00:00:00.000Z", gave: "sehte", correct: false, error_tag: "strong-verb-vowel" as const },
    { student_id: "jonas", plan_version: 1, day: 2, answered_at: "2026-01-02T00:00:00.000Z", gave: "nehmte", correct: false, error_tag: "strong-verb-vowel" as const },
  ];
  assert.equal(evidence.detectEvidence({ plan: v2, attempts: oldAttempts, dueDay: 3 }), null);
});

/* ── a subject that is not German ─────────────────────────────────────────────
 *
 * The error vocabulary used to be a fixed German enum, so every wrong answer a
 * maths student gave was tagged `untagged` — and `detectEvidence` skips
 * `untagged`. The repeat-error trigger could never fire, so the plan could never
 * revise, so the product was a scheduled-message app for everyone who does not
 * teach German verbs. These tests are that limit, gone.
 */

const maths: Plan = {
  student_id: "amara",
  version: 1,
  reason: "initial plan from tutor's brief",
  created_at: new Date(0).toISOString(),
  error_tags: ["sign-error", "factorising", "order-of-operations"],
  days: [
    [1, "x^2 - 5x + 6 = 0", "2, 3"], [2, "x^2 + x - 6 = 0", "-3, 2"],
    [3, "x^2 - 9 = 0", "-3, 3"], [4, "x^2 + 4x + 4 = 0", "-2"],
    [5, "x^2 - 2x - 8 = 0", "-2, 4"], [6, "x^2 + 6x + 9 = 0", "-3"],
  ].map(([day, prompt, expects]) => ({
    day: day as 1 | 2 | 3 | 4 | 5 | 6,
    kind: "drill" as const,
    prompt: `solve ${prompt}`,
    target_items: ["quadratic equations"],
    expects: expects as string,
  })),
};

const miss = (day: 1 | 2 | 3, gave: string, error_tag: string) => ({
  student_id: "amara",
  plan_version: 1,
  day,
  answered_at: `2026-01-0${day}T00:00:00.000Z`,
  gave,
  correct: false,
  error_tag,
});

test("a minus sign survives normalisation, so a sign error is a miss at all", () => {
  // Stripped, "-2, -3" and "2, 3" were the same string: the defining miss of a
  // maths week graded CORRECT and never reached the tagger.
  assert.equal(evidence.gradeAttempt(maths.days[0]!, "-2, -3").correct, false);
  assert.equal(evidence.gradeAttempt(maths.days[0]!, "2, 3").correct, true);
  assert.equal(evidence.normalizeAnswer("x = -2, -3"), "x -2 -3");
  // Ordinary punctuation is still ordinary punctuation.
  assert.equal(evidence.normalizeAnswer("well-known"), "well known");
});

test("a maths week fires the same repeat-error trigger a German week does", () => {
  // Two sign errors. Same tag, same plan version — the exact shape that revises
  // a German week, in a subject the old enum could not describe at all.
  const attempts = [miss(1, "-2, -3", "sign-error"), miss(2, "3, -2", "sign-error")];
  assert.deepEqual(evidence.detectEvidence({ plan: maths, attempts, dueDay: 2 }), {
    kind: "same-error-twice", error_tag: "sign-error",
  });
});

test("two misses under DIFFERENT tags of the same plan are not a pattern", () => {
  const attempts = [miss(1, "-2, -3", "sign-error"), miss(2, "x(x + 1)", "factorising")];
  assert.equal(evidence.detectEvidence({ plan: maths, attempts, dueDay: 2 }), null);
});

test("a maths miss is classified against the maths plan's own tags, and revises", async () => {
  store.addPlan(maths);
  const classify = async (args: { error_tags: string[] }) => {
    // The classifier only ever chooses from the plan's vocabulary — it is handed
    // the list and constrained to it by z.enum on the other side of this seam.
    assert.deepEqual(args.error_tags, maths.error_tags);
    return "sign-error";
  };
  const revise = async (args: { plan: Plan }) => ({
    ...args.plan, version: 2, reason: "Two sign errors; day 3 explains the signs.",
    created_at: new Date().toISOString(),
  });

  const first = await evidence.recordStudentTurn({
    student_id: "amara", day: 1, gave: "-2, -3", now: new Date("2026-01-01"), classify, revise,
  });
  assert.equal(first.attempt.error_tag, "sign-error");
  assert.equal(first.revised_plan, null);

  const second = await evidence.recordStudentTurn({
    student_id: "amara", day: 2, gave: "3, -2", now: new Date("2026-01-02"), classify, revise,
  });
  assert.equal(second.trigger?.kind, "same-error-twice");
  assert.equal(second.revised_plan?.version, 2);
  assert.deepEqual(second.revised_plan?.error_tags, maths.error_tags);
});

test("a German heuristic never files a miss under a tag the plan does not have", () => {
  // "sehte" reads as a regularised strong verb to the cheap path. On a maths
  // plan there is no such category, so the deterministic answer is "I can't
  // tell" — a model call — not a German tag pinned to an algebra week.
  assert.equal(evidence.errorTagHeuristic(maths.days[0]!, "sehte", maths.error_tags!), null);
  assert.equal(evidence.errorTagHeuristic(plan.days[1]!, "sehte", [...DEFAULT_ERROR_TAGS]), "strong-verb-vowel");
});

test("a classifier answer outside the plan's vocabulary is refused, not stored", async () => {
  const tag = await evidence.errorTagFor(maths.days[0]!, "-2, -3", maths, async () => "vibes");
  assert.equal(tag, "untagged");
});

test("a classifier outage files the miss untagged rather than losing the answer", async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const tag = await evidence.errorTagFor(maths.days[0]!, "-2, -3", maths, async () => {
      throw new Error("provider down");
    });
    assert.equal(tag, "untagged");
  } finally {
    console.warn = warn;
  }
});

/* ── back-compat ─────────────────────────────────────────────────────────────
 * `.data/between.json` holds plans written before `error_tags` existed. They
 * must keep grading, keep triggering, and never reach for a model to do it.
 */
test("a plan stored without error_tags still grades and triggers on the German set", async () => {
  assert.deepEqual(plan.error_tags, undefined);
  assert.equal(evidence.gradeAttempt(plan.days[1]!, "sehte").error_tag, "strong-verb-vowel");
  const tag = await evidence.errorTagFor(plan.days[1]!, "sehte", plan, async () => {
    throw new Error("the cheap path must answer this without a model call");
  });
  assert.equal(tag, "strong-verb-vowel");
});
