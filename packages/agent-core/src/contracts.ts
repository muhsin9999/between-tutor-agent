/**
 * The two contracts. Frozen at 13:10 — see .planning/CONTRACTS.md.
 *
 * This file is why two people and several agents can write in parallel without
 * talking. Everything else is downstream of it. After 13:10 it changes only if
 * both humans agree out loud.
 *
 * Browser-safe: imports nothing from Node. The panel renders straight off these
 * types, and `composeBrief`'s structured-output schema IS `BRIEF_SCHEMA` — so a
 * component the renderer doesn't know about fails validation rather than
 * rendering blank.
 *
 * ── A note on `.nullable()` vs `.optional()` ────────────────────────────────
 * OpenAI structured outputs run in strict mode: every property must appear in
 * `required`, and `additionalProperties` must be false. An `.optional()` field
 * is therefore rejected outright. Model-facing fields that may be absent are
 * `.nullable()` instead, and the model is told to emit `null`. Do not "tidy"
 * these into optionals — it fails at request time, not at typecheck time, which
 * is the expensive way to find out.
 */
import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────────────────
   Contract 1 — the plan document
   A week is six days. The tutor's one line produces `days`; a revision rewrites
   only the days that haven't happened yet and stores a new version beside the
   old one. The earlier version is NEVER overwritten — v1 and v3 side by side is
   the evidence.
   ────────────────────────────────────────────────────────────────────────── */

export const DAY_KINDS = ["drill", "produce", "explain", "checkin"] as const;
export type DayKind = (typeof DAY_KINDS)[number];

export const PLAN_DAY_SCHEMA = z.object({
  day: z.number().int().min(1).max(6).describe("Which of the six days between lessons."),
  kind: z.enum(DAY_KINDS).describe(
    "drill = recall practice. produce = say or write something of his own. " +
      "explain = put the rule in his own words. checkin = a human question, no task.",
  ),
  prompt: z.string().describe("What the student is actually asked, in his language. One question."),
  target_items: z.array(z.string()).describe("The specific items under test. A closed set, reused across days."),
  expects: z.string().describe(
    "What a correct answer looks like. Graded by exact normalised comparison FIRST, " +
      "so keep it terse and unambiguous — one word where possible.",
  ),
});
export type PlanDay = z.infer<typeof PLAN_DAY_SCHEMA>;

export const PLAN_SCHEMA = z.object({
  student_id: z.string(),
  version: z.number().int().min(1).describe("1, 2, 3 … never overwritten."),
  reason: z.string().describe("ONE sentence. v1 is 'initial plan from tutor's brief'."),
  created_at: z.string().describe("ISO timestamp."),
  days: z.array(PLAN_DAY_SCHEMA).length(6).describe("Always exactly six."),
});
export type Plan = z.infer<typeof PLAN_SCHEMA>;

/** What the model is allowed to return from planWeek/revisePlan — the rest is ours. */
export const PLAN_DAYS_SCHEMA = z.object({
  days: z.array(PLAN_DAY_SCHEMA).length(6),
  reason: z.string(),
});

/**
 * Rules that are code, not preference. Call this on every plan before storing it.
 * A revision may not extend the week, and may not add material outside the
 * original target set.
 */
export function assertRevisionLegal(prior: Plan, next: Pick<Plan, "days">): void {
  if (next.days.length !== 6) {
    throw new Error(`A plan is six days. Got ${next.days.length}.`);
  }
  const allowed = new Set(prior.days.flatMap((d) => d.target_items));
  for (const day of next.days) {
    for (const item of day.target_items) {
      if (!allowed.has(item)) {
        throw new Error(
          `Revision introduced "${item}", which the tutor did not set. ` +
            `Allowed: ${[...allowed].join(", ")}`,
        );
      }
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Contract 2 — the component vocabulary
   Seven components. The model picks which appear, in what order, holding what
   contents. This union is the panel's renderer AND the model's output schema.
   The model COMPOSES; it does not write JSX. Nothing it emits is executed.
   ────────────────────────────────────────────────────────────────────────── */

export const BRIEF_COMPONENT_SCHEMA = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Streak"),
    days_done: z.number().int().min(0).max(6),
    days_total: z.number().int().min(1).max(6),
    note: z.string().nullable().describe("One short line, or null."),
  }),
  z.object({
    type: z.literal("ErrorGrid"),
    rule: z.string().describe("The rule they all break, named in plain language."),
    rows: z
      .array(
        z.object({
          prompt: z.string(),
          gave: z.string().describe("His literal wrong answer. Do not clean it up."),
          wanted: z.string(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("AudioCompare"),
    item: z.string(),
    student_audio_url: z.string(),
    reference_text: z.string(),
  }),
  z.object({
    type: z.literal("QuietCard"),
    last_seen_day: z.number().int().min(0).max(6),
    question: z.string().describe(
      "One human question for the tutor to ask. NOT a metric, NOT a suggestion to " +
        "send another reminder.",
    ),
  }),
  z.object({
    type: z.literal("Breakthrough"),
    sentence: z.string().describe("His sentence, verbatim. Nothing around it."),
    day: z.number().int().min(1).max(6),
  }),
  z.object({
    type: z.literal("PraiseLine"),
    line: z.string(),
  }),
  z.object({
    type: z.literal("PlanLane"),
    days: z.array(PLAN_DAY_SCHEMA).length(6),
    version: z.number().int().min(1),
    prior_version: z.number().int().min(1).nullable(),
  }),
]);
export type BriefComponent = z.infer<typeof BRIEF_COMPONENT_SCHEMA>;

export const BRIEF_SCHEMA = z.object({
  student_id: z.string(),
  headline: z.string().describe("One sentence the tutor reads first."),
  components: z
    .array(BRIEF_COMPONENT_SCHEMA)
    .min(2)
    .max(5)
    .describe("2–5 components. PlanLane is ALWAYS last. Never all seven."),
});
export type Brief = z.infer<typeof BRIEF_SCHEMA>;

/**
 * The rules the schema can't express. Run on every composed brief.
 * A brief that renders all seven components every week disproves the claim the
 * product is making, so this is load-bearing, not hygiene.
 */
export function assertBriefLegal(brief: Brief): void {
  const last = brief.components.at(-1);
  if (last?.type !== "PlanLane") {
    throw new Error(`PlanLane must be last. Got ${last?.type ?? "nothing"}.`);
  }
  if (brief.components.filter((c) => c.type === "PlanLane").length !== 1) {
    throw new Error("Exactly one PlanLane.");
  }
  const quiet = brief.components.find((c) => c.type === "QuietCard");
  if (quiet && brief.components.some((c) => c.type === "ErrorGrid" || c.type === "Streak")) {
    // A quiet week carries no data BECAUSE THERE ISN'T ANY. Padding it with a
    // grid or a zeroed streak is the single most likely way the model ruins the
    // back-to-back shot the whole generative-UI claim rests on.
    throw new Error("A QuietCard week must not also carry an ErrorGrid or a Streak.");
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Contract 3 — the student turn
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Closed list. `ErrorGrid` groups by this and the "same tag twice" trigger fires
 * on it — a free-text tag makes the grid unusable and the trigger unfireable.
 * Lives here rather than in evidence.ts because both lanes read it.
 */
export const ERROR_TAGS = [
  "strong-verb-vowel", // sehte / nehmte — regularised a strong verb
  "wrong-auxiliary",
  "wrong-ending",
  "word-order",
  "untagged",
] as const;
export type ErrorTag = (typeof ERROR_TAGS)[number];

export const ATTEMPT_SCHEMA = z.object({
  student_id: z.string(),
  plan_version: z.number().int().min(1),
  day: z.number().int().min(1).max(6),
  answered_at: z.string(),
  gave: z.string().describe("Raw student text, untrimmed. Normalise at compare time, not here."),
  correct: z.boolean(),
  error_tag: z.enum(ERROR_TAGS).nullable(),
});
export type Attempt = z.infer<typeof ATTEMPT_SCHEMA>;

/* ─────────────────────────────────────────────────────────────────────────────
   The store — one JSON file, .data/between.json
   ────────────────────────────────────────────────────────────────────────── */

export type Student = {
  id: string;
  name: string;
  chat_id: number;
  class_id?: string;
};

export type Store = {
  students: Record<string, Student>;
  tutor: { chat_id: number | null };
  plans: Plan[]; // append-only, all versions
  attempts: Attempt[]; // append-only
  seen_updates: number[]; // Telegram update ids, for dedupe
  clock: { started_at: string; speed: string }; // "day:40s"
};

export const EMPTY_STORE: Store = {
  students: {},
  tutor: { chat_id: null },
  plans: [],
  attempts: [],
  seen_updates: [],
  clock: { started_at: new Date(0).toISOString(), speed: "day:40s" },
};
