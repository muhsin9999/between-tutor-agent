import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_SCHEMA,
  PLAN_SCHEMA,
  assertBriefLegal,
  assertRevisionLegal,
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
