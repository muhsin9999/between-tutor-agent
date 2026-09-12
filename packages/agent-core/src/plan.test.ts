import { test } from "node:test";
import assert from "node:assert/strict";
import { constrainFixtureTargets, GERMAN_FIXTURE_TARGETS } from "./llm";
import type { PlanDay } from "./contracts";

const day: PlanDay = {
  day: 1,
  kind: "drill",
  prompt: "What is the past tense of gehen?",
  target_items: ["gehen", "bleiben", "kommen", "finden", "geben", "lesen", "schreiben", "tragen", "werfen", "werden"],
  expects: "ging",
};

test("the German demo cannot expand beyond its six fixture verbs", () => {
  const constrained = constrainFixtureTargets(
    "Jonas — German past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud.",
    [day],
  );
  assert.deepEqual(constrained[0]?.target_items, [...GERMAN_FIXTURE_TARGETS]);
});

test("a non-fixture tutor line is not rewritten", () => {
  const constrained = constrainFixtureTargets("Jonas — violin scales, ten minutes a day.", [day]);
  assert.deepEqual(constrained[0]?.target_items, day.target_items);
});
