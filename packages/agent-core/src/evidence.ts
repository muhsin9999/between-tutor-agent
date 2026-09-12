import {
  UNTAGGED,
  errorTagsOf,
  type Attempt,
  type Plan,
  type PlanDay,
} from "./contracts";
// Both sides of the merge: classifyError is the per-plan error taxonomy,
// persistence is the Neon-or-JSON boundary.
import { classifyError, revisePlan } from "./llm";
import * as store from "./persistence";

/**
 * Exact comparison is deliberately boring: it is the camera-safe happy path.
 *
 * One exception to "strip all punctuation": a minus sign in front of a digit is
 * not punctuation, it is the answer. Stripping it made "-2, -3" and "2, 3"
 * identical, so a maths week's most common miss — the sign error — graded as
 * CORRECT and never reached the tagger at all. Article-stripping stays German
 * because it only ever deletes German articles; a hyphen deletes arithmetic.
 */
export function normalizeAnswer(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, (mark, index: number, whole: string) =>
      /[-–−]/.test(mark) && /\d/.test(whole.charAt(index + 1)) ? "-" : " ",
    )
    .replace(/\b(?:a|an|the|der|die|das|ein|eine)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STRONG_PAST_FORMS = new Set(["ging", "sah", "nahm", "sprach", "trank", "fuhr"]);

/**
 * The cheap path. German grammar has tells a regex can read for free, so it
 * reads them — but only when the plan's own vocabulary contains the tag they
 * would produce. A maths week has no "wrong-ending" to file anything under, and
 * a heuristic that fires anyway would be inventing evidence.
 *
 * Returns null for "I cannot tell", which is the signal to pay for a model call.
 */
export function errorTagHeuristic(step: PlanDay, gave: string, tags: readonly string[]): string | null {
  const has = (tag: string) => (tags.includes(tag) ? tag : null);
  const answer = normalizeAnswer(gave);
  if (STRONG_PAST_FORMS.has(normalizeAnswer(step.expects)) && /te$/.test(answer)) {
    const tag = has("strong-verb-vowel");
    if (tag) return tag;
  }
  if (/\b(haben|sein)\b/.test(answer)) {
    const tag = has("wrong-auxiliary");
    if (tag) return tag;
  }
  if (/(st|t|en)$/.test(answer)) {
    const tag = has("wrong-ending");
    if (tag) return tag;
  }
  return null;
}

/** Injected in tests so the pivotal revision path never depends on a network call. */
export type Classifier = (args: { step: PlanDay; gave: string; error_tags: string[] }) => Promise<string>;

/**
 * Which of THIS PLAN's categories the miss belongs to.
 *
 * The tag set is a property of the plan, produced from the tutor's line, so a
 * subject the fixed German enum could not describe still gets misses that repeat
 * — and a repeat is the only thing that revises the week. A plan stored before
 * `error_tags` existed falls back to DEFAULT_ERROR_TAGS via `errorTagsOf`.
 *
 * Deterministic first, model second, and only ever on a MISS.
 */
export async function errorTagFor(
  step: PlanDay,
  gave: string,
  plan?: Pick<Plan, "error_tags"> | null,
  classify: Classifier = classifyError,
): Promise<string> {
  const tags = errorTagsOf(plan);
  const cheap = errorTagHeuristic(step, gave, tags);
  if (cheap) return cheap;
  try {
    const tag = await classify({ step, gave, error_tags: tags });
    return tags.includes(tag) ? tag : UNTAGGED;
  } catch (cause) {
    // A classifier outage must not cost the student his answer. An untagged miss
    // is still recorded, still shown, and simply does not vote on the trigger.
    console.warn(`[evidence] could not classify a miss; filing it ${UNTAGGED}.`, cause);
    return UNTAGGED;
  }
}

/**
 * Synchronous grading: exact normalised comparison, plus the deterministic tag
 * where one is obvious. No model, so callers without an await (and the voice
 * path's tests) keep working; `recordStudentTurn` is the one that pays for the
 * general case.
 */
export function gradeAttempt(
  step: PlanDay,
  gave: string,
  plan?: Pick<Plan, "error_tags"> | null,
): Pick<Attempt, "gave" | "correct" | "error_tag"> {
  const correct = normalizeAnswer(gave) === normalizeAnswer(step.expects);
  if (correct) return { gave, correct, error_tag: null };
  return { gave, correct, error_tag: errorTagHeuristic(step, gave, errorTagsOf(plan)) ?? UNTAGGED };
}

export type EvidenceTrigger =
  | { kind: "same-error-twice"; error_tag: string }
  | { kind: "three-correct"; target_items: string[] }
  | { kind: "quiet"; last_seen_day: number };

/** Returns at most one trigger so one incoming answer produces one clear action. */
export function detectEvidence(args: {
  plan: Plan;
  attempts: Attempt[];
  dueDay: number;
}): EvidenceTrigger | null {
  const allAttempts = args.attempts
    .filter((attempt) => attempt.student_id === args.plan.student_id)
    .sort((a, b) => Date.parse(a.answered_at) - Date.parse(b.answered_at));
  const attempts = allAttempts
    // A trigger revises the CURRENT plan. Looking back across every historical
    // version would re-fire the same two misses after v2 exists, producing an
    // infinite stream of revisions on every later answer.
    .filter(
      (attempt) =>
        attempt.student_id === args.plan.student_id && attempt.plan_version === args.plan.version,
    )
    .sort((a, b) => Date.parse(a.answered_at) - Date.parse(b.answered_at));

  // This plan's vocabulary, not a global one — which is what lets a maths week
  // repeat a sign-error twice and revise, exactly as a German week does.
  for (const tag of errorTagsOf(args.plan)) {
    if (tag === UNTAGGED) continue;
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

  // Silence is about the human, not a plan version: a day-two answer still
  // counts as being seen after it caused the plan to become v2.
  const lastSeenDay = allAttempts.reduce((latest, attempt) => Math.max(latest, attempt.day), 0);
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
  classify?: Classifier;
}): Promise<{ attempt: Attempt; trigger: EvidenceTrigger | null; revised_plan: Plan | null }> {
  const plan = await store.latestPlan(args.student_id);
  if (!plan) throw new Error(`No plan exists for ${args.student_id}.`);
  const step = plan.days.find((candidate) => candidate.day === args.day);
  if (!step) throw new Error(`Plan v${plan.version} has no day ${args.day}.`);

  const correct = normalizeAnswer(args.gave) === normalizeAnswer(step.expects);
  const attempt: Attempt = {
    student_id: args.student_id,
    plan_version: plan.version,
    day: args.day,
    answered_at: (args.now ?? new Date()).toISOString(),
    gave: args.gave,
    correct,
    // Costs a model call at most once per wrong answer, and nothing at all on a
    // right one or on a miss the heuristics already recognise.
    error_tag: correct ? null : await errorTagFor(step, args.gave, plan, args.classify),
  };
  await store.addAttempt(attempt);

  const trigger = detectEvidence({
    plan,
    attempts: await store.attemptsFor(args.student_id),
    dueDay: Math.max(args.day, store.currentDay(args.now ?? new Date(), await store.read())),
  });
  if (trigger?.kind !== "same-error-twice") return { attempt, trigger, revised_plan: null };

  const revised = await (args.revise ?? revisePlan)({
    plan,
    attempts: await store.attemptsFor(args.student_id),
    today: args.day,
    trigger: `Two ${trigger.error_tag} errors; replace the next drill with a short explanation.`,
  });
  await store.addPlan(revised);
  return { attempt, trigger, revised_plan: revised };
}
