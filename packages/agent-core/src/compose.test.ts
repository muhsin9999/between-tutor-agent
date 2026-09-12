import { test } from "node:test";
import assert from "node:assert/strict";
import { assertBriefGrounded } from "./compose";
import type { Attempt, Brief, Plan } from "./contracts";

const days = Array.from({ length: 6 }, (_, index) => ({
  day: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
  kind: "drill" as const,
  prompt: `past tense ${index + 1}`,
  target_items: ["gehen"],
  expects: "ging",
}));
const plan: Plan = { student_id: "jonas", version: 2, reason: "same error twice", created_at: new Date().toISOString(), days };
const attempts: Attempt[] = [
  { student_id: "jonas", plan_version: 1, day: 1, answered_at: new Date().toISOString(), gave: "sehte", correct: false, error_tag: "strong-verb-vowel" },
];

test("a briefing cannot invent the student's wrong answer", () => {
  const brief: Brief = {
    student_id: "jonas", headline: "He regularises strong verbs.", components: [
      { type: "ErrorGrid", rule: "strong verbs", rows: [{ prompt: "past tense 1", gave: "invented", wanted: "ging" }] },
      { type: "PlanLane", days, version: 2, prior_version: 1 },
    ],
  };
  assert.throws(() => assertBriefGrounded(brief, plan, attempts), /stored answer/);
});

test("a quiet week is deliberately sparse", () => {
  const quietAttempts: Attempt[] = [{ ...attempts[0]!, correct: true, error_tag: null, gave: "ging" }];
  const brief: Brief = {
    student_id: "jonas", headline: "Ask what made practice difficult after day one.", components: [
      { type: "QuietCard", last_seen_day: 1, question: "What got in the way after Tuesday?" },
      { type: "PlanLane", days, version: 2, prior_version: 1 },
    ],
  };
  assert.doesNotThrow(() => assertBriefGrounded(brief, plan, quietAttempts));
});
