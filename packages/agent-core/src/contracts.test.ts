import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_SCHEMA,
  DEFAULT_ERROR_TAGS,
  PLAN_SCHEMA,
  assertBriefLegal,
  assertRevisionLegal,
  errorTagsOf,
  normalizeErrorTags,
  type Plan,
} from "./contracts";

const days = (items: string[] = ["gehen"]) =>
  Array.from({ length: 6 }, (_, i) => ({
    day: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    kind: "drill" as const,
    prompt: "past tense of gehen",
    target_items: items,
    expects: "ging",
  }));

const planLane = { type: "PlanLane" as const, version: 1, prior_version: null, days: days() };

const plan: Plan = {
  student_id: "jonas",
  version: 1,
  reason: "initial plan from tutor's brief",
  created_at: new Date().toISOString(),
  days: days(["gehen", "sehen"]),
};

test("a valid plan parses", () => {
  assert.doesNotThrow(() => PLAN_SCHEMA.parse(plan));
});

// The claim the whole product rests on: the model composes from a CLOSED
// catalogue. A component the renderer doesn't know about must fail validation,
// not render blank.
test("an unknown component fails validation rather than rendering blank", () => {
  assert.throws(() =>
    BRIEF_SCHEMA.parse({
      student_id: "jonas",
      headline: "h",
      components: [{ type: "MotivationChart", data: [1, 2, 3] }, planLane],
    }),
  );
});

test("PlanLane must be last", () => {
  const brief = BRIEF_SCHEMA.parse({
    student_id: "jonas",
    headline: "h",
    components: [planLane, { type: "PraiseLine", line: "good week" }],
  });
  assert.throws(() => assertBriefLegal(brief), /PlanLane must be last/);
});

// A quiet week carries no data BECAUSE THERE ISN'T ANY. Padding it with a grid
// or a zeroed streak collapses the two fixture weeks into one look, and the
// back-to-back shot is the entire argument for generative UI.
test("a quiet week cannot also carry a grid or a streak", () => {
  const brief = BRIEF_SCHEMA.parse({
    student_id: "mara",
    headline: "h",
    components: [
      { type: "QuietCard", last_seen_day: 1, question: "Did something happen on Tuesday?" },
      { type: "Streak", days_done: 1, days_total: 6, note: null },
      planLane,
    ],
  });
  assert.throws(() => assertBriefLegal(brief), /must not also carry/);
});

test("a quiet week on its own is legal", () => {
  const brief = BRIEF_SCHEMA.parse({
    student_id: "mara",
    headline: "h",
    components: [
      { type: "QuietCard", last_seen_day: 1, question: "Did something happen on Tuesday?" },
      planLane,
    ],
  });
  assert.doesNotThrow(() => assertBriefLegal(brief));
});

// A revision rewrites the remaining days. It may not extend the week, and may
// not introduce material the tutor never set.
test("a revision cannot introduce material the tutor did not set", () => {
  assert.throws(
    () => assertRevisionLegal(plan, { days: days(["konjunktiv"]) }),
    /did not set/,
  );
});

test("a revision within the original target set is legal", () => {
  assert.doesNotThrow(() => assertRevisionLegal(plan, { days: days(["sehen"]) }));
});

/* ── the error vocabulary belongs to the plan ─────────────────────────────── */

test("a plan carries its own subject-shaped error tags", () => {
  const maths = { ...plan, error_tags: ["sign-error", "factorising", "order-of-operations"] };
  assert.doesNotThrow(() => PLAN_SCHEMA.parse(maths));
  assert.deepEqual(errorTagsOf(maths), maths.error_tags);
});

// `untagged` is what `detectEvidence` SKIPS. A plan that listed it as one of its
// own categories would be collecting misses into a bucket the trigger ignores.
test("'untagged' is reserved and cannot be one of a plan's error tags", () => {
  assert.throws(() => PLAN_SCHEMA.parse({ ...plan, error_tags: ["sign-error", "untagged", "factorising"] }));
  assert.deepEqual(normalizeErrorTags(["sign-error", "untagged", "factorising"]), ["sign-error", "factorising"]);
});

test("a model's tag list is cleaned rather than trusted", () => {
  assert.deepEqual(
    normalizeErrorTags(["Sign Error", "sign_error", "  Factorising  ", "order of operations"]),
    ["sign-error", "factorising", "order-of-operations"],
  );
  // Too few usable tags is worth less than the fallback, and never a crash on
  // the one line the tutor types all week.
  assert.deepEqual(normalizeErrorTags(["untagged"]), [...DEFAULT_ERROR_TAGS]);
  assert.deepEqual(normalizeErrorTags(undefined), [...DEFAULT_ERROR_TAGS]);
});

// There is live demo data in .data/between.json written before this field existed.
test("a plan stored without error_tags falls back instead of crashing", () => {
  assert.deepEqual(plan.error_tags, undefined);
  assert.doesNotThrow(() => PLAN_SCHEMA.parse(plan));
  assert.deepEqual(errorTagsOf(plan), [...DEFAULT_ERROR_TAGS]);
  assert.deepEqual(errorTagsOf(undefined), [...DEFAULT_ERROR_TAGS]);
  assert.equal(errorTagsOf(plan).includes("untagged"), false);
});
