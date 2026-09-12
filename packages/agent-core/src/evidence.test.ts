import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { Plan } from "./contracts";

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
