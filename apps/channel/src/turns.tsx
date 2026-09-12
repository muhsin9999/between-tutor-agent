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
import { planWeek, nextStep, recordStudentTurn, persistence as store } from "agent-core";
import type { PlanDay } from "agent-core/contracts";

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
export async function handleTutorLine(
  thread: Thread,
  studentId: string,
  line: string,
): Promise<void> {
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

  const plan = await planWeek({ student_id: studentId, tutor_line: line });
  await store.addPlan(plan);
  await store.startClock();

  await thread.post(
    <Message accent="#16306B">
      <Section>
        <Markdown>
          {"Got it — six days planned, starting today.\n\n" +
            "I'll have your briefing ready before the next lesson."}
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

/**
 * The outstanding question, per student: which plan version and which day we
 * actually PUT TO HIM.
 *
 * Three distinct failure modes this closes, all of which we hit live:
 *
 *  1. Nothing was asked. His first message after enrolling — "hi", "I want day
 *     1" — was graded as the answer to a question he was never asked, burning
 *     day 1 before the take started.
 *
 *  2. The question moved. He answers, the plan is revised, and a message already
 *     in flight is graded against a day that no longer exists in that form.
 *     Pinning the plan VERSION as well as the day means a stale answer is
 *     re-asked rather than mis-scored.
 *
 *  3. Two messages at once. Channels runs turns in PARALLEL by default, so two
 *     rapid messages both read dueStep() before either writes an attempt, and
 *     both grade against the same day. The queue below serialises per student.
 *
 * In-memory on purpose: it is per-run conversational state, not a fact about
 * the week, and /reset already clears the week between takes.
 */
const outstanding = new Map<string, { version: number; day: number }>();

/**
 * One turn at a time, per student. Each incoming message waits for the previous
 * one to finish before it reads any state.
 *
 * Without this, "sehte" and "nehmte" sent a second apart can both be recorded
 * against day 2 — and the "same error twice" trigger then fires on one day
 * rather than two, which is not the claim we are making on camera.
 */
const queues = new Map<string, Promise<void>>();

function serialize(key: string, work: () => Promise<void>): Promise<void> {
  const next = (queues.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(work);
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

/**
 * Telegram re-delivers updates. A duplicate message posted mid-take is one of
 * the two things that reliably ruins a recording, so claim each message id once
 * and drop the repeat. Falls open when the adapter gives us no id — dropping
 * real answers would be far worse than an occasional double.
 */
async function isDuplicate(message: unknown): Promise<boolean> {
  const id = (message as { id?: string | number } | null)?.id;
  if (id === undefined || id === null) return false;
  const numeric = typeof id === "number" ? id : hash(String(id));
  return !(await store.claimUpdate(numeric));
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function handleStudentAnswer(
  thread: Thread,
  studentId: string,
  text: string,
  message?: unknown,
): Promise<void> {
  if (message !== undefined && await isDuplicate(message)) return;
  return serialize(studentId, () => studentTurn(thread, studentId, text));
}

async function studentTurn(thread: Thread, studentId: string, text: string): Promise<void> {
  const plan = await store.latestPlan(studentId);
  const step = await store.dueStep(studentId);

  if (!step || !plan) {
    outstanding.delete(studentId);
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

  const pending = outstanding.get(studentId);

  // Grade ONLY a reply to the exact question we asked, from the plan version we
  // asked it under. Anything else — first contact, a revised plan, a message
  // that arrived while the week moved — gets asked, not scored.
  if (!pending || pending.day !== step.day || pending.version !== plan.version) {
    outstanding.set(studentId, { version: plan.version, day: step.day });
    await thread.post(ask(step));
    return;
  }

  // Claim the question before any await. A second message cannot now be graded
  // against the same day even if it slips past the queue.
  outstanding.delete(studentId);

  const answeredBefore = await store.attemptsFor(studentId);

  const { attempt, trigger, revised_plan } = await recordStudentTurn({
    student_id: studentId,
    day: step.day,
    gave: text,
  });

  const recentAttempts = await store.attemptsFor(studentId);
  const streak = recentAttempts.reverse().findIndex((attempt) => !attempt.correct);

  const { reply } = await nextStep({
    step,
    gave: attempt.gave,
    correct: attempt.correct,
    streak: streak === -1 ? answeredBefore.length + 1 : streak,
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

  // Ask the next thing, if anything is due. One question at a time, and pinned
  // to whichever plan version is current AFTER any revision.
  const current = await store.latestPlan(studentId);
  const next = await store.dueStep(studentId);
  if (next && current && next.day !== step.day) {
    outstanding.set(studentId, { version: current.version, day: next.day });
    await thread.post(ask(next));
  }
}
