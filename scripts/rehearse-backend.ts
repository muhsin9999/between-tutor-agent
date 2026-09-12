import { getBrief, recordStudentTurn, store } from "agent-core";
import { germanPlan } from "./demo-fixtures";

const student_id = "jonas";
const startedAt = new Date("2026-09-12T12:00:00.000Z");

store.resetDemo();
store.upsertStudent({ id: student_id, name: "Jonas", chat_id: 1001 });
store.addPlan(germanPlan(student_id));
store.startClock("day:40s", startedAt);

await recordStudentTurn({
  student_id,
  day: 1,
  gave: "sehte",
  now: new Date(startedAt.getTime() + 1_000),
});
const revision = await recordStudentTurn({
  student_id,
  day: 2,
  gave: "nehmte",
  now: new Date(startedAt.getTime() + 40_001),
});

if (revision.trigger?.kind !== "same-error-twice" || !revision.revised_plan) {
  throw new Error("Expected the two scripted strong-verb misses to append a revised plan.");
}
const history = store.planHistory(student_id);
if (history.length !== 2 || history[0]?.version !== 1 || history[1]?.version !== 2) {
  throw new Error("Expected immutable v1 and appended v2 plan history.");
}
console.log("Revision check passed; composing the error-week briefing…");
const brief = await getBrief(student_id);
const types = brief.components.map((component) => component.type);
if (!types.includes("ErrorGrid") || types.at(-1) !== "PlanLane") {
  throw new Error(`Expected an error-week briefing ending in PlanLane; got ${types.join(", ")}.`);
}

console.log(JSON.stringify({
  result: "PASS",
  trigger: revision.trigger,
  plan_versions: history.map((plan) => ({ version: plan.version, reason: plan.reason })),
  brief_components: types,
}, null, 2));
