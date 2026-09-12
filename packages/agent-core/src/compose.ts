import { assertBriefLegal, type Attempt, type Brief, type Plan } from "./contracts";
import { composeBrief as composeWithModel } from "./llm";
import * as store from "./store";

function isQuietWeek(plan: Plan, attempts: Attempt[]): boolean {
  const lastSeenDay = attempts.reduce((latest, attempt) => Math.max(latest, attempt.day), 0);
  return lastSeenDay > 0 && lastSeenDay <= 1;
}

/**
 * The model selects components and contents, but it cannot make up a student's
 * words or a PlanLane. Validate those claims after structured-output parsing.
 */
export function assertBriefGrounded(brief: Brief, plan: Plan, attempts: Attempt[]): void {
  assertBriefLegal(brief);
  const answers = new Set(attempts.map((attempt) => attempt.gave));
  const planByPrompt = new Map(plan.days.map((day) => [day.prompt, day]));

  for (const component of brief.components) {
    if (component.type === "ErrorGrid") {
      for (const row of component.rows) {
        if (!answers.has(row.gave)) throw new Error("ErrorGrid must quote a stored answer verbatim.");
        const day = planByPrompt.get(row.prompt);
        if (!day || day.expects !== row.wanted) throw new Error("ErrorGrid must use a real prompt and expected answer.");
      }
    }
    if (component.type === "Breakthrough" && !answers.has(component.sentence)) {
      throw new Error("Breakthrough must quote a stored answer verbatim.");
    }
    if (component.type === "PlanLane") {
      if (component.version !== plan.version || JSON.stringify(component.days) !== JSON.stringify(plan.days)) {
        throw new Error("PlanLane must display the stored current plan.");
      }
    }
  }

  if (isQuietWeek(plan, attempts) && (brief.components.length !== 2 || brief.components[0]?.type !== "QuietCard")) {
    throw new Error("A quiet week is QuietCard plus PlanLane, with no padded evidence.");
  }
}

/** The panel route calls this; it only ever receives a validated, grounded tree. */
export async function getBrief(student_id: string): Promise<Brief> {
  const plan = store.latestPlan(student_id);
  if (!plan) throw new Error(`No plan exists for ${student_id}.`);
  const attempts = store.attemptsFor(student_id);
  const brief = await composeWithModel({
    student_id,
    plan,
    attempts,
    quiet: isQuietWeek(plan, attempts),
  });
  assertBriefGrounded(brief, plan, attempts);
  return brief;
}
