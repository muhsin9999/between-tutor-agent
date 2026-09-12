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
import { explainMiss, shouldExplain } from "./explain";
import { downloadVoice, VOICE_FILENAME, type VoiceNote } from "./voice";
// Reached by path, not by barrel: agent-core's `exports` map publishes ".",
// "./shared" and "./contracts" only, and transcribe.ts is behind none of them.
// Adding an entry would mean editing agent-core, which is somebody else's file
// right now. The module is pure — bytes in, a string out — so a second
// specifier for it costs nothing.
import {
  normalizeSpeech,
  transcribeVoice,
  uploadFilename,
  vocabularyHint,
} from "../../../packages/agent-core/src/transcribe";

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
function isDuplicate(message: unknown): boolean {
  const id = (message as { id?: string | number } | null)?.id;
  if (id === undefined || id === null) return false;
  const numeric = typeof id === "number" ? id : hash(String(id));
  return !store.claimUpdate(numeric);
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * `heard` is the transcript of a spoken answer, and is set ONLY by the voice
 * path. It changes nothing about grading — `text` is already the transcript by
 * the time it arrives here — it is echoed back in the reply so a mis-heard
 * answer is a visible one. A typed turn passes it undefined and is byte-for-byte
 * the turn it always was.
 */
export async function handleStudentAnswer(
  thread: Thread,
  text: string,
  message?: unknown,
  heard?: string,
): Promise<void> {
  if (message !== undefined && isDuplicate(message)) return;
  return serialize(STUDENT_ID, () => studentTurn(thread, text, heard));
}

async function studentTurn(thread: Thread, text: string, heard?: string): Promise<void> {
  const plan = store.latestPlan(STUDENT_ID);
  const step = store.dueStep(STUDENT_ID);

  if (!step || !plan) {
    outstanding.delete(STUDENT_ID);
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

  const pending = outstanding.get(STUDENT_ID);

  // Grade ONLY a reply to the exact question we asked, from the plan version we
  // asked it under. Anything else — first contact, a revised plan, a message
  // that arrived while the week moved — gets asked, not scored.
  if (!pending || pending.day !== step.day || pending.version !== plan.version) {
    outstanding.set(STUDENT_ID, { version: plan.version, day: step.day });
    await thread.post(ask(step));
    return;
  }

  // Claim the question before any await. A second message cannot now be graded
  // against the same day even if it slips past the queue.
  outstanding.delete(STUDENT_ID);

  const answeredBefore = store.attemptsFor(STUDENT_ID);

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
    streak: streak === -1 ? answeredBefore.length + 1 : streak,
  });

  await thread.post(
    <Message accent={attempt.correct ? "#2E7D4F" : "#F5A623"}>
      <Section>
        <Markdown>{heard ? `Heard: \`${heard}\`\n\n${reply}` : reply}</Markdown>
      </Section>
    </Message>,
  );

  // T-A6 · WHY, in the chat — but only AFTER the reply has landed.
  //
  // On a phone the order is the whole design: the short human sentence he
  // answers, then the grid that explains it, then the revision, then the next
  // question. A table arriving first turns a warm correction into a mark sheet,
  // and he reads the grid before he reads the answer.
  //
  // `shouldExplain` is the gate, not this call: it fires on two misses carrying
  // one tag inside one plan version — the same threshold evidence.ts revises
  // on — so the table and the revision land as one event. Everything is wrapped
  // because an explanation is a nicety and his turn is not: a throw in here must
  // never cost him the reply he already has, or the next question below.
  try {
    const attempts = store.attemptsFor(STUDENT_ID);
    if (shouldExplain(attempts, step)) {
      await thread.post(explainMiss({ step, gave: attempt.gave, attempts }));
    }
  } catch (error) {
    console.warn(
      `[explain] skipped for day ${step.day}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
  const current = store.latestPlan(STUDENT_ID);
  const next = store.dueStep(STUDENT_ID);
  if (next && current && next.day !== step.day) {
    outstanding.set(STUDENT_ID, { version: current.version, day: next.day });
    await thread.post(ask(next));
  }
}

/* ── T-A5 · the same turn, spoken ────────────────────────────────────────── */

/**
 * The vocabulary hint, built from the WEEK — every target item in the current
 * plan, not today's `expects`.
 *
 * Measured in transcribe.ts and the reason this helper exists at all: without a
 * hint, one-word German answers mostly come back wrong ("ging" → "Ding"). With
 * only today's answer in the hint you fix that by biasing the decoder toward
 * the one string that scores a point, which manufactures correct grades. All six
 * verbs together still resolved to the one actually spoken, and never turned a
 * wrong answer into the right one — so the whole set goes in, or nothing does.
 */
function weekHint(): string | undefined {
  const plan = store.latestPlan(STUDENT_ID);
  if (!plan) return undefined;
  return vocabularyHint(plan.days.flatMap((day) => day.target_items));
}

/**
 * A spoken answer, on its way to becoming a typed one.
 *
 * Everything here is about getting a STRING. The moment there is one it goes
 * through `handleStudentAnswer` — the same door a typed message walks through,
 * so it meets the same duplicate claim, the same per-student queue and the same
 * outstanding-question pin. There is no second grading path and there must
 * never be one.
 *
 * The other half of the contract is the failure case. Download, transcription
 * and normalisation each return `null` rather than throwing, and a `null` is
 * answered with one line asking him to type it — never with a grade. Nothing
 * below `null` reaches `recordStudentTurn`, so a failed transcription cannot
 * become an attempt, cannot tag an error and cannot revise his week. The
 * outstanding question is left pinned exactly where it was, so typing the
 * answer afterwards still scores against the day he was asked.
 */
export async function handleStudentVoice(
  thread: Thread,
  note: VoiceNote,
  message?: unknown,
): Promise<void> {
  let transcript: string | null = null;

  try {
    const audio = await downloadVoice(note.fileId, process.env.TELEGRAM_BOT_TOKEN ?? "");
    if (audio) {
      // `.oga` is what Telegram serves and what two of the three transcription
      // models reject by extension. `uploadFilename` renames it to `.ogg` — a
      // string edit, not a transcode; the bytes are untouched.
      const spoken = await transcribeVoice(audio, uploadFilename(VOICE_FILENAME), {
        prompt: weekHint(),
      });
      // transcribeVoice already normalises; doing it here too is idempotent and
      // keeps the guarantee local rather than borrowed.
      transcript = spoken ? normalizeSpeech(spoken) || null : null;
    }
  } catch (error) {
    // Belt and braces. Both halves promise to fail soft, and a promise is not a
    // guarantee when a student's turn is what it costs.
    console.warn(
      `[voice] turn fell back to typing: ${error instanceof Error ? error.message : String(error)}`,
    );
    transcript = null;
  }

  if (!transcript) {
    await thread.post(
      <Message accent="#F5A623">
        <Section>
          <Markdown>{"I couldn't make that one out — could you type it instead?"}</Markdown>
        </Section>
      </Message>,
    );
    return;
  }

  await handleStudentAnswer(thread, transcript, message, transcript);
}
