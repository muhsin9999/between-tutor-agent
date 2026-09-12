import {
  ERROR_TAGS,
  type Attempt,
  type ErrorTag,
  type Plan,
  type PlanDay,
} from "./contracts";
import { revisePlan } from "./llm";
import * as store from "./store";

/** Exact comparison is deliberately boring: it is the camera-safe happy path. */
export function normalizeAnswer(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\b(?:a|an|the|der|die|das|ein|eine)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STRONG_PAST_FORMS = new Set(["ging", "sah", "nahm", "sprach", "trank", "fuhr"]);

/**
 * Error tags are a closed, deterministic vocabulary. A model may explain a
 * miss later, but it never decides whether the repeat-error trigger fires.
 */
export function errorTagFor(step: PlanDay, gave: string): ErrorTag {
  const answer = normalizeAnswer(gave);
  if (STRONG_PAST_FORMS.has(normalizeAnswer(step.expects)) && /te$/.test(answer)) {
    return "strong-verb-vowel";
  }
  if (/\b(haben|sein)\b/.test(answer)) return "wrong-auxiliary";
  if (/(st|t|en)$/.test(answer)) return "wrong-ending";
  return "untagged";
}

export function gradeAttempt(step: PlanDay, gave: string): Pick<Attempt, "gave" | "correct" | "error_tag"> {
  const correct = normalizeAnswer(gave) === normalizeAnswer(step.expects);
  return { gave, correct, error_tag: correct ? null : errorTagFor(step, gave) };
}

export type EvidenceTrigger =
  | { kind: "same-error-twice"; error_tag: Exclude<ErrorTag, "untagged"> }
  | { kind: "three-correct"; target_items: string[] }
  | { kind: "quiet"; last_seen_day: number };

/** Returns at most one trigger so one incoming answer produces one clear action. */
export function detectEvidence(args: {
  plan: Plan;
  attempts: Attempt[];
  dueDay: number;
}): EvidenceTrigger | null {
  const attempts = args.attempts
    .filter((attempt) => attempt.student_id === args.plan.student_id)
    .sort((a, b) => Date.parse(a.answered_at) - Date.parse(b.answered_at));

  for (const tag of ERROR_TAGS) {
    if (tag === "untagged") continue;
    const matching = attempts.filter((attempt) => !attempt.correct && attempt.error_tag === tag);
    if (matching.length >= 2) return { kind: "same-error-twice", error_tag: tag };
  }

  let correctStreak = 0;
  for (const attempt of [...attempts].reverse()) {
    if (!attempt.correct) break;
    correctStreak += 1;
  }
  if (correctStreak >= 3) {
    const recentDays = new Set(attempts.slice(-correctStreak).map((attempt) => attempt.day));
    const target_items = args.plan.days
      .filter((day) => recentDays.has(day.day))
      .flatMap((day) => day.target_items);
    return { kind: "three-correct", target_items: [...new Set(target_items)] };
  }

  const lastSeenDay = attempts.reduce((latest, attempt) => Math.max(latest, attempt.day), 0);
  if (args.dueDay - lastSeenDay >= 2) return { kind: "quiet", last_seen_day: lastSeenDay };
  return null;
}

type Reviser = typeof revisePlan;

/**
 * The channel calls this one function after receiving a student's answer. It
 * writes the immutable attempt, computes evidence in code, and appends a new
 * plan only for a repeat error. Dependency injection keeps the pivotal revision
 * path fast and deterministic in tests.
 */
export async function recordStudentTurn(args: {
  student_id: string;
  day: number;
  gave: string;
  now?: Date;
  revise?: Reviser;
}): Promise<{ attempt: Attempt; trigger: EvidenceTrigger | null; revised_plan: Plan | null }> {
  const plan = store.latestPlan(args.student_id);
  if (!plan) throw new Error(`No plan exists for ${args.student_id}.`);
  const step = plan.days.find((candidate) => candidate.day === args.day);
  if (!step) throw new Error(`Plan v${plan.version} has no day ${args.day}.`);

  const graded = gradeAttempt(step, args.gave);
  const attempt: Attempt = {
    student_id: args.student_id,
    plan_version: plan.version,
    day: args.day,
    answered_at: (args.now ?? new Date()).toISOString(),
    ...graded,
  };
  store.addAttempt(attempt);

  const trigger = detectEvidence({
    plan,
    attempts: store.attemptsFor(args.student_id),
    dueDay: Math.max(args.day, store.currentDay(args.now ?? new Date())),
  });
  if (trigger?.kind !== "same-error-twice") return { attempt, trigger, revised_plan: null };

  const revised = await (args.revise ?? revisePlan)({
    plan,
    attempts: store.attemptsFor(args.student_id),
    today: args.day,
    trigger: `Two ${trigger.error_tag} errors; replace the next drill with a short explanation.`,
  });
  store.addPlan(revised);
  return { attempt, trigger, revised_plan: revised };
}
