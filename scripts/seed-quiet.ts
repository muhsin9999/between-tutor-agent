import { store } from "agent-core";
import { germanPlan } from "./demo-fixtures";

const student_id = "mara";
store.update((state) => {
  delete state.students[student_id];
  state.plans = state.plans.filter((plan) => plan.student_id !== student_id);
  state.attempts = state.attempts.filter((attempt) => attempt.student_id !== student_id);
});
store.upsertStudent({ id: student_id, name: "Mara", chat_id: 2002 });
store.addPlan(germanPlan(student_id));
store.addAttempt({
  student_id,
  plan_version: 1,
  day: 1,
  answered_at: new Date().toISOString(),
  gave: "ging",
  correct: true,
  error_tag: null,
});

console.log("Seeded Mara's quiet week: one answer on day 1, then silence.");
