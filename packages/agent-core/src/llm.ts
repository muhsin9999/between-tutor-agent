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
import { generateObject } from "ai";
import { z } from "zod";
import { resolveModel } from "./model";
import {
  PLAN_DAYS_SCHEMA,
  assertRevisionLegal,
  type Attempt,
  type Plan,
  type PlanDay,
} from "./contracts";

/** One call site, so a provider failure reads the same wherever it happens. */
async function object<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<z.infer<T>> {
  try {
    const { object } = await generateObject({
      model: resolveModel(),
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
      `Plan the six days before the next lesson. Derive target_items from her line and ` +
      `reuse that same closed set across the days. For "reason", write one sentence ` +
      `describing the shape of the week and why it is in that order.`,
  });

  return {
    student_id: args.student_id,
    version: 1,
    reason: out.reason,
    created_at: new Date().toISOString(),
    days: out.days,
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

  const out = await object({
    schema: PLAN_DAYS_SCHEMA,
    system: HOUSE_RULES + `

You are REVISING a week already in progress.
- Days ${done.map((d) => d.day).join(", ") || "(none)"} have happened. Return them UNCHANGED.
- Rewrite only days ${remaining.map((d) => d.day).join(", ") || "(none)"}.
- You may NOT extend the week past day 6.
- You may NOT introduce any target item outside: ${[...new Set(args.plan.days.flatMap((d) => d.target_items))].join(", ")}.
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

  return {
    student_id: args.plan.student_id,
    version: args.plan.version + 1,
    reason: out.reason,
    created_at: new Date().toISOString(),
    days: out.days,
  };
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
