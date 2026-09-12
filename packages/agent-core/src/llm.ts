/**
 * T-B0 — the one place a model is called.
 *
 * Everything goes through the Vercel AI SDK's `generateObject`, against the
 * schemas in contracts.ts. Two reasons that matters here:
 *
 *   1. The provider swap is already solved. `resolveModel()` (the starter's) reads
 *      MODEL_PROVIDER and returns either a model instance (OpenRouter, which needs
 *      a baseURL and /chat/completions) or a "provider:model" id for the AI SDK's
 *      global registry. So the Gate 0 fallback — OpenAI card declined, switch to
 *      OpenRouter — stays a three-line .env change with no code touched.
 *   2. `generateObject` does zod -> JSON Schema -> strict structured output and
 *      parses the result back through the same zod schema. The schema that
 *      constrains the model IS the schema the renderer types off. That is the
 *      whole "an unknown component fails validation rather than rendering blank"
 *      claim, enforced in one place.
 *
 * Reminder from contracts.ts: model-facing optional fields are `.nullable()`,
 * never `.optional()`. Strict structured outputs require every property in
 * `required`, and an optional field fails at REQUEST time, not typecheck time.
 */
import { generateObject, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { resolveModel } from "./model";
import {
  BRIEF_SCHEMA,
  PLAN_DAYS_SCHEMA,
  UNTAGGED,
  assertBriefLegal,
  assertRevisionLegal,
  errorTagsOf,
  normalizeErrorTags,
  type Attempt,
  type Brief,
  type Plan,
  type PlanDay,
} from "./contracts";

/**
 * resolveModel() returns a model INSTANCE for OpenRouter but a bare
 * "provider:model" STRING otherwise — and in AI SDK v6 a bare string is routed
 * through the Vercel AI Gateway, which wants its own AI_GATEWAY_API_KEY and
 * fails with GatewayAuthenticationError even though OPENAI_API_KEY is perfectly
 * good. So build a real provider instance here instead of passing the string on.
 *
 * Anything else calling an AI SDK function with resolveModel() directly will hit
 * the same wall.
 */
function model(): LanguageModel {
  const resolved = resolveModel();
  if (typeof resolved !== "string") return resolved; // OpenRouter: already an instance

  const separator = resolved.indexOf(":");
  const provider = resolved.slice(0, separator);
  const modelId = resolved.slice(separator + 1);

  if (provider === "openai") {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })(modelId);
  }
  throw new Error(
    `llm.ts talks to openai and openrouter. MODEL_PROVIDER='${provider}' needs its ` +
      `provider package added here — see .planning/GATE-0.md B1 for the fallback.`,
  );
}

/** One call site, so a provider failure reads the same wherever it happens. */
async function object<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<z.infer<T>> {
  try {
    const { object } = await generateObject({
      model: model(),
      schema: opts.schema,
      system: opts.system,
      prompt: opts.prompt,
      temperature: opts.temperature ?? 0.4,
    });
    // generateObject's return type is conditional on the schema's inferred output
    // and does not narrow through a generic parameter. The value is already
    // parsed by the same zod schema, so this cast asserts nothing new.
    return object as z.infer<T>;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Model call failed (${process.env.MODEL_PROVIDER ?? "openai"} / ${process.env.MODEL ?? "default"}): ${detail}`,
      { cause },
    );
  }
}

const HOUSE_RULES = `
You are planning practice for ONE student between two lessons with a human tutor.

Hard rules:
- The tutor is the teacher. You introduce NO new material. You work only on what
  she named.
- Six days, one task per day, about ten minutes each.
- The student answers on his phone, in a chat, often on a bus. One question at a
  time. Never a wall of text, never a list of five things.
- "expects" is graded by exact normalised string comparison first, so it must be
  terse and unambiguous — one word wherever possible.
- Read the human half of what the tutor wrote. If she says he is nervous about
  speaking, do not put a "produce" day first; earn it later in the week.
`.trim();

/** The scripted demo is deliberately a closed, six-verb lesson—not a curriculum generator. */
export const GERMAN_FIXTURE_TARGETS = ["gehen", "sehen", "nehmen", "sprechen", "trinken", "fahren"] as const;

function isGermanFixture(tutorLine: string): boolean {
  return /german\s+past\s+tense\s+of\s+irregular\s+verbs/i.test(tutorLine);
}

/**
 * The model receives this rule in the prompt, and this post-condition keeps a
 * verbose completion from turning the fixed six-verb demonstration into an
 * invented curriculum. Other tutor lines preserve their explicitly supplied
 * target set untouched.
 */
export function constrainFixtureTargets(tutorLine: string, days: PlanDay[]): PlanDay[] {
  if (!isGermanFixture(tutorLine)) return days;
  return days.map((day) => ({ ...day, target_items: [...GERMAN_FIXTURE_TARGETS] }));
}

/**
 * T-B2 — the tutor's one line becomes six days.
 * This is the only thing she types all week, so the plan has to carry the weight.
 */
export async function planWeek(args: {
  student_id: string;
  tutor_line: string;
}): Promise<Plan> {
  const out = await object({
    schema: PLAN_DAYS_SCHEMA,
    system: HOUSE_RULES,
    prompt: `The tutor wrote this at the end of today's lesson:\n\n"${args.tutor_line}"\n\n` +
      `Plan the six days before the next lesson. Reuse one closed target_items set across the days. ` +
      `For the German irregular-past-tense demo, target_items MUST be exactly gehen, sehen, nehmen, sprechen, trinken, fahren—never add another verb. ` +
      `For "reason", write one sentence ` +
      `describing the shape of the week and why it is in that order.\n\n` +
      `For "error_tags": name 3-6 mistake types a student actually makes in THIS subject — ` +
      `the categories you would group his wrong answers under when you look at a week of them. ` +
      `Not topics, not skills: the shape of the mistake itself. ` +
      `German verbs: strong-verb-vowel, wrong-auxiliary, wrong-ending, word-order. ` +
      `Quadratic equations: sign-error, factorising, order-of-operations. ` +
      `Piano: timing, fingering, dynamics. ` +
      `lowercase-kebab-case, and never "${UNTAGGED}" — that one is reserved for a miss ` +
      `none of yours fits.`,
  });

  return {
    student_id: args.student_id,
    version: 1,
    reason: out.reason,
    created_at: new Date().toISOString(),
    days: constrainFixtureTargets(args.tutor_line, out.days),
    // Cleaned rather than trusted — see normalizeErrorTags. This runs on the one
    // line the tutor types all week, so it falls back instead of throwing.
    error_tags: normalizeErrorTags(out.error_tags),
  };
}

/**
 * T-B5 — the part that makes this an agent rather than a scheduler. NEVER CUT.
 *
 * Called by a DETERMINISTIC trigger in evidence.ts, never by the model's own
 * judgement — that is what makes it defensible when a judge asks whether the
 * model just felt like it. Rewrites only the days that have not happened, and
 * the earlier version is never overwritten.
 */
export async function revisePlan(args: {
  plan: Plan;
  attempts: Attempt[];
  today: number;
  trigger: string;
}): Promise<Plan> {
  const done = args.plan.days.filter((d) => d.day <= args.today);
  const remaining = args.plan.days.filter((d) => d.day > args.today);
  // The week's vocabulary is fixed at v1. A revision that renamed it would make
  // the two misses that caused it uncountable against the plan they now sit in.
  const error_tags = errorTagsOf(args.plan);

  const out = await object({
    schema: PLAN_DAYS_SCHEMA,
    system: HOUSE_RULES + `

You are REVISING a week already in progress.
- Days ${done.map((d) => d.day).join(", ") || "(none)"} have happened. Return them UNCHANGED.
- Rewrite only days ${remaining.map((d) => d.day).join(", ") || "(none)"}.
- You may NOT extend the week past day 6.
- You may NOT introduce any target item outside: ${[...new Set(args.plan.days.flatMap((d) => d.target_items))].join(", ")}.
- "error_tags" belongs to the week, not to you: return exactly ${error_tags.join(", ")}.
- "reason" is ONE sentence a tutor would accept, naming what you saw and what you changed.`,
    prompt: `Trigger: ${args.trigger}\n\n` +
      `Plan v${args.plan.version}:\n${JSON.stringify(args.plan.days, null, 2)}\n\n` +
      `What he has actually done:\n${JSON.stringify(
        args.attempts.map((a) => ({ day: a.day, gave: a.gave, correct: a.correct, error_tag: a.error_tag })),
        null,
        2,
      )}`,
  });

  // Enforced in code, not hoped for in the prompt.
  assertRevisionLegal(args.plan, out);
  for (const completed of done) {
    const returned = out.days.find((day) => day.day === completed.day);
    if (!returned || JSON.stringify(returned) !== JSON.stringify(completed)) {
      throw new Error(`Revision changed completed day ${completed.day}.`);
    }
  }

  return {
    student_id: args.plan.student_id,
    version: args.plan.version + 1,
    reason: out.reason,
    created_at: new Date().toISOString(),
    days: out.days,
    // Carried through in code, not taken from `out` — same reason the completed
    // days are checked above rather than asked for nicely.
    error_tags,
  };
}

/**
 * The general path of `errorTagFor` — which of THIS plan's categories a miss
 * belongs to. Constrained to the plan's own list plus `untagged`, so the model
 * chooses between the tutor's categories and cannot invent a fifth one that
 * would never repeat and so could never fire the trigger.
 *
 * Called only on a miss the deterministic heuristics could not place, never on a
 * correct answer. One small structured call per unexplained wrong answer.
 */
export async function classifyError(args: {
  step: PlanDay;
  gave: string;
  error_tags: string[];
}): Promise<string> {
  // z.enum needs a non-empty tuple; the destructure is how that is proved rather
  // than asserted. `untagged` is always the last option and never a plan's own.
  const [first = UNTAGGED, ...rest] = [
    ...args.error_tags.filter((tag) => tag !== UNTAGGED),
    UNTAGGED,
  ];
  const vocabulary: [string, ...string[]] = [first, ...rest];
  const out = await object({
    schema: z.object({
      error_tag: z.enum(vocabulary).describe(`One of: ${vocabulary.join(", ")}. Nothing else.`),
    }),
    temperature: 0,
    system:
      `You are grouping one student's wrong answer under the mistake categories his own ` +
      `tutor set for this week. You are not marking it — it is already wrong — and you are ` +
      `not explaining it. You are filing it.\n\n` +
      `Pick the category that names WHAT WENT WRONG, not what the question was about. If none ` +
      `of them honestly fits, answer "${UNTAGGED}": a wrong category is worse than no category, ` +
      `because two answers filed under it will be read as one repeating mistake.`,
    prompt:
      `Categories: ${vocabulary.join(", ")}\n\n` +
      `He was asked: "${args.step.prompt}"\n` +
      `The answer was: "${args.step.expects}"\n` +
      `He wrote: "${args.gave}"`,
  });
  return out.error_tag;
}

/**
 * The student's reply to one question. Grading happens in evidence.ts BEFORE
 * this is called — exact normalised comparison first, model only on a miss — so
 * this writes the human line back, it does not decide right or wrong.
 */
export async function nextStep(args: {
  step: PlanDay;
  gave: string;
  correct: boolean;
  streak: number;
}): Promise<{ reply: string }> {
  return object({
    schema: z.object({
      reply: z.string().describe("One or two short lines. Warm, specific, not a report card."),
    }),
    temperature: 0.7,
    system: HOUSE_RULES,
    prompt: `He was asked: "${args.step.prompt}"\nHe answered: "${args.gave}"\n` +
      `That is ${args.correct ? "correct" : `wrong; the answer was "${args.step.expects}"`}.\n` +
      `He has ${args.streak} correct in a row.\n\n` +
      `Reply to him directly. If he was wrong, show the right answer once and move on — ` +
      `do not explain the whole rule, and do not ask him to try again now.`,
  });
}

/*
 * OpenAI strict structured outputs reject JSON Schema `oneOf`; zod's
 * discriminated union for BRIEF_COMPONENT_SCHEMA produces exactly that. The
 * renderer contract remains the discriminated union in contracts.ts. Only the
 * model transport is flattened, then converted straight back into the contract
 * and validated before anything can render.
 */
const BRIEF_DRAFT_COMPONENT_SCHEMA = z.object({
  type: z.enum(["Streak", "ErrorGrid", "AudioCompare", "QuietCard", "Breakthrough", "PraiseLine", "PlanLane"]),
  days_done: z.number().int().nullable(),
  days_total: z.number().int().nullable(),
  note: z.string().nullable(),
  rule: z.string().nullable(),
  rows: z.array(z.object({ prompt: z.string(), gave: z.string(), wanted: z.string() })).nullable(),
  item: z.string().nullable(),
  student_audio_url: z.string().nullable(),
  reference_text: z.string().nullable(),
  last_seen_day: z.number().int().nullable(),
  question: z.string().nullable(),
  sentence: z.string().nullable(),
  day: z.number().int().nullable(),
  line: z.string().nullable(),
  days: z.array(PLAN_DAYS_SCHEMA.shape.days.element).length(6).nullable(),
  version: z.number().int().nullable(),
  prior_version: z.number().int().nullable(),
});

const BRIEF_DRAFT_SCHEMA = z.object({
  student_id: z.string(),
  headline: z.string(),
  components: z.array(BRIEF_DRAFT_COMPONENT_SCHEMA).min(2).max(5),
});

type BriefDraftComponent = z.infer<typeof BRIEF_DRAFT_COMPONENT_SCHEMA>;

function required<T>(value: T | null, field: string): T {
  if (value === null) throw new Error(`Brief component omitted required field '${field}'.`);
  return value;
}

function toBriefComponent(component: BriefDraftComponent): Brief["components"][number] {
  switch (component.type) {
    case "Streak":
      return { type: component.type, days_done: required(component.days_done, "days_done"), days_total: required(component.days_total, "days_total"), note: component.note };
    case "ErrorGrid":
      return { type: component.type, rule: required(component.rule, "rule"), rows: required(component.rows, "rows") };
    case "AudioCompare":
      return { type: component.type, item: required(component.item, "item"), student_audio_url: required(component.student_audio_url, "student_audio_url"), reference_text: required(component.reference_text, "reference_text") };
    case "QuietCard":
      return { type: component.type, last_seen_day: required(component.last_seen_day, "last_seen_day"), question: required(component.question, "question") };
    case "Breakthrough":
      return { type: component.type, sentence: required(component.sentence, "sentence"), day: required(component.day, "day") };
    case "PraiseLine":
      return { type: component.type, line: required(component.line, "line") };
    case "PlanLane":
      return { type: component.type, days: required(component.days, "days"), version: required(component.version, "version"), prior_version: component.prior_version };
  }
}

const BRIEF_LAYOUT_SCHEMA = z.object({
  headline: z.string(),
  component_types: z
    .array(z.enum(["Streak", "ErrorGrid", "AudioCompare", "QuietCard", "Breakthrough", "PraiseLine", "PlanLane"]))
    .min(2)
    .max(5),
});

function buildBriefComponents(args: {
  plan: Plan;
  attempts: Attempt[];
  quiet: boolean;
  component_types: z.infer<typeof BRIEF_LAYOUT_SCHEMA>["component_types"];
}): Brief["components"] {
  const byDay = new Map(args.plan.days.map((day) => [day.day, day]));
  const errors = args.attempts.filter((attempt) => !attempt.correct && attempt.error_tag !== UNTAGGED);
  const breakthrough = args.attempts.find(
    (attempt) => attempt.correct && attempt.gave.trim().split(/\s+/).length >= 3,
  );
  const available = new Set<Brief["components"][number]["type"]>(["PlanLane", "PraiseLine"]);
  if (errors.length) available.add("ErrorGrid");
  if (args.attempts.length) available.add("Streak");
  if (args.quiet) available.add("QuietCard");
  if (breakthrough) available.add("Breakthrough");

  const requested: Brief["components"][number]["type"][] = args.quiet
    ? ["QuietCard"]
    : args.component_types.filter((type) => type !== "PlanLane" && available.has(type));
  const fallback: Brief["components"][number]["type"][] = errors.length
    ? ["ErrorGrid", "PraiseLine"]
    : ["Streak", "PraiseLine"];
  const types: Brief["components"][number]["type"][] = [
    ...new Set(requested.length ? requested : fallback),
    "PlanLane",
  ];

  return types.map((type) => {
    switch (type) {
      case "Streak":
        return { type, days_done: new Set(args.attempts.map((attempt) => attempt.day)).size, days_total: 6, note: null };
      case "ErrorGrid": {
        const tag = errors[0]?.error_tag ?? UNTAGGED;
        return {
          type,
          // The German set has an earned sentence; any other subject's tag is
          // the tutor's own words already, so it is unhyphenated, not rewritten.
          rule:
            tag === "strong-verb-vowel"
              ? "Strong verbs change their vowel in the past tense"
              : tag.replace(/-/g, " "),
          rows: errors.map((attempt) => {
            const day = byDay.get(attempt.day);
            if (!day) throw new Error(`No plan day exists for attempt ${attempt.day}.`);
            return { prompt: day.prompt, gave: attempt.gave, wanted: day.expects };
          }),
        };
      }
      case "QuietCard":
        return { type, last_seen_day: Math.max(...args.attempts.map((attempt) => attempt.day), 0), question: "What made practice hard after the first day?" };
      case "Breakthrough":
        if (!breakthrough) throw new Error("Breakthrough was requested without a student sentence.");
        return { type, sentence: breakthrough.gave, day: breakthrough.day };
      case "PraiseLine":
        return { type, line: errors.length ? "The repeated pattern is clear enough to address together." : "The week shows steady follow-through." };
      case "PlanLane":
        return { type, days: args.plan.days, version: args.plan.version, prior_version: args.plan.version > 1 ? args.plan.version - 1 : null };
      case "AudioCompare":
        throw new Error("AudioCompare needs a stored voice asset and is unavailable in this rehearsal.");
      default:
        throw new Error(`Unknown briefing component: ${String(type)}`);
    }
  });
}

/** T-B6 — model-selected composition over the fixed briefing vocabulary. */
export async function composeBrief(args: {
  student_id: string;
  plan: Plan;
  attempts: Attempt[];
  quiet: boolean;
}): Promise<Brief> {
  const layout = await object({
    schema: BRIEF_LAYOUT_SCHEMA,
    system: `You are writing ONE sentence to a tutor who is about to walk into a
lesson in five minutes. She taught this student last week. She knows the subject.
She does not need teaching advice — she needs to know what happened while she
wasn't there, and what to do with the fifty-five minutes.

VOICE: a colleague who sat in on his week and is telling her about it on the way
to the classroom. Plain, specific, warm, short. Fewer than twenty words.

NEVER write these — they are pedagogy filler and say nothing:
  "focus on"  "reinforce"  "continue to"  "areas for improvement"
  "is struggling with"  "practice more"  "work on"  "before production"
  "shows progress in"  "needs support with"

DO:
  - Name the actual thing, not the category. "the vowel change", not "verb forms".
  - Quote HIS word when it carries the point. Untidied.
  - Say what is worth doing with the lesson, if anything is.
  - If he went quiet, say that and nothing else. Do not fill the silence.

Bad:  "Focus on correcting vowel changes in past tense strong verbs before production."
Good: "He keeps adding -te to strong verbs — sehte, nehmte. Ten minutes on the vowel would fix it."

Bad:  "Jonas shows progress but needs support with irregular forms."
Good: "Four days in a row, then nothing since Wednesday. Worth asking what changed."

Bad:  "Student demonstrates understanding of the past tense rule."
Good: "He explained the vowel rule back in his own words on Thursday. It's landed."

The UI vocabulary is closed. Pick between two and five component_types; PlanLane
is always last. You never write JSX or invent a component. If this is a quiet
week, return ONLY QuietCard and PlanLane: no grid, no streak, no invented
evidence. Only select a Breakthrough when the student wrote a complete sentence
of his own.`,
    prompt: `Student: ${args.student_id}
Current plan v${args.plan.version}: ${JSON.stringify(args.plan.days)}
Attempts: ${JSON.stringify(args.attempts.map((attempt) => ({ day: attempt.day, gave: attempt.gave, correct: attempt.correct, error_tag: attempt.error_tag })))}
Quiet week: ${args.quiet}

Write the headline she reads first, then choose the smallest set of components
that carries the evidence for it. The headline must tell her something she could
NOT work out from the component labels alone.`,
  });
  const out = BRIEF_SCHEMA.parse({
    student_id: args.student_id,
    headline: layout.headline,
    components: buildBriefComponents({ ...args, component_types: layout.component_types }),
  });
  assertBriefLegal(out);
  return out;
}
