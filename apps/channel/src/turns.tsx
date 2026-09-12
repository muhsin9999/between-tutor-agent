/**
 * T-A4 and T-A5 — the two turns.
 *
 * T-A4  the tutor sends ONE LINE and the week exists.
 * T-A5  the student answers one question at a time, in plain chat, forever.
 *
 * All the thinking lives in agent-core. This file is only the surface: who is
 * talking, what to say back, and how it looks in Telegram.
 */
import { Message, Section, Markdown, Context } from "@copilotkit/channels";
import { planWeek, nextStep, recordStudentTurn, store } from "agent-core";
import type { PlanDay } from "agent-core/contracts";

/** The demo runs one student. Fixtures name him; see .planning/FIXTURES.md. */
export const STUDENT_ID = "jonas";

type Thread = {
  conversationKey: string;
  post: (ui: unknown) => Promise<unknown>;
};

/**
 * Telegram conversation keys carry the chat id. We only need a stable number
 * per chat, so the trailing digits are enough — and it keeps `Store.chat_id`
 * (agent-core's contract, which is B's) unchanged.
 */
export function chatIdFrom(conversationKey: string): number {
  const digits = conversationKey.match(/(-?\d+)(?!.*\d)/)?.[1];
  return digits ? Number(digits) : 0;
}

/* ── T-A4 · the tutor's one line ─────────────────────────────────────────── */

/**
 * She types one line at the end of a lesson. That is the only thing she types
 * all week, so the reply is TWO LINES — a confirmation, not the plan. Printing
 * six days back at her would undo the entire pitch.
 */
export async function handleTutorLine(thread: Thread, line: string): Promise<void> {
  if (line.length < 12) {
    await thread.post(
      <Message accent="#16306B">
        <Section>
          <Markdown>
            {"Tell me who, and what you worked on — one line is enough.\n\n" +
              "_Jonas — German past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud._"}
          </Markdown>
        </Section>
      </Message>,
    );
    return;
  }

  const plan = await planWeek({ student_id: STUDENT_ID, tutor_line: line });
  store.addPlan(plan);
  store.startClock();

  await thread.post(
    <Message accent="#16306B">
      <Section>
        <Markdown>
          {`Got it. Six days planned for ${plan.days[0]?.target_items.length ?? 0} items, ` +
            `starting today.\n\nI'll have your briefing ready before the next lesson.`}
        </Markdown>
      </Section>
      <Context>{plan.reason}</Context>
    </Message>,
  );
}

/* ── T-A5 · the student's turn ───────────────────────────────────────────── */

/**
 * One question. Never a wall of text, never a list of five things.
 *
 * ≤8 choices would render as a native Telegram inline keyboard and stay in the
 * conversation — see keyboard.ts. Recall practice has no choices to offer, so
 * these are free-text, which is also what makes the exact-match grader work.
 */
function ask(step: PlanDay) {
  return (
    <Message accent="#F5A623">
      <Section>
        <Markdown>{`**Day ${step.day}.** ${step.prompt}`}</Markdown>
      </Section>
    </Message>
  );
}

export async function handleStudentAnswer(thread: Thread, text: string): Promise<void> {
  const step = store.dueStep(STUDENT_ID);

  if (!step) {
    const plan = store.latestPlan(STUDENT_ID);
    await thread.post(
      <Message accent="#F5A623">
        <Section>
          <Markdown>
            {plan
              ? "Nothing due right now — I'll come back to you tomorrow."
              : "Your tutor hasn't set this week yet. I'll message you when she does."}
          </Markdown>
        </Section>
      </Message>,
    );
    return;
  }

  // The first message after enrolment is not an answer to anything — ask, don't grade.
  const answered = store.attemptsFor(STUDENT_ID);
  const isFirstContact = answered.length === 0 && !/\w/.test(text.replace(/^\/\w+/, ""));
  if (isFirstContact) {
    await thread.post(ask(step));
    return;
  }

  // Grading, evidence and any revision all happen in agent-core. Exact
  // normalised comparison runs FIRST; the model only sees a miss.
  const { attempt, trigger, revised_plan } = await recordStudentTurn({
    student_id: STUDENT_ID,
    day: step.day,
    gave: text,
  });

  const streak = store
    .attemptsFor(STUDENT_ID)
    .reverse()
    .findIndex((a) => !a.correct);

  const { reply } = await nextStep({
    step,
    gave: attempt.gave,
    correct: attempt.correct,
    streak: streak === -1 ? answered.length + 1 : streak,
  });

  await thread.post(
    <Message accent={attempt.correct ? "#2E7D4F" : "#F5A623"}>
      <Section>
        <Markdown>{reply}</Markdown>
      </Section>
    </Message>,
  );

  // The revision is the beat the whole demo turns on, so it is visible to the
  // student in one quiet line rather than happening silently behind the panel.
  if (revised_plan) {
    console.log(
      `[revise] ${trigger?.kind} → plan v${revised_plan.version}: ${revised_plan.reason}`,
    );
    await thread.post(
      <Message accent="#16306B">
        <Section>
          <Markdown>{"I've changed the rest of your week — this keeps tripping you up."}</Markdown>
        </Section>
        <Context>{revised_plan.reason}</Context>
      </Message>,
    );
  }

  // Ask the next thing, if anything is due. One question at a time.
  const next = store.dueStep(STUDENT_ID);
  if (next && next.day !== step.day) await thread.post(ask(next));
}
