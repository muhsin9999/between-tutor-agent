/**
 * T-A1 — the Telegram channel. Both legs of Between live here.
 *
 * ONE bot, TWO roles, fanned out on who is talking:
 *   - the tutor  → sends one line a week, gets an enrolment link and a panel button
 *   - a student  → gets one question at a time, in plain chat, forever
 *
 * The student NEVER gets a panel or a webview. ≤8 choices render as a native
 * Telegram inline keyboard and stay in the conversation. The product's premise
 * is that he will not open a practice app — that is *why* the six days are
 * empty — so a panel on his leg would rebuild the exact failure it exists to fix.
 *
 * Transport: the direct adapter path. `telegram({ token })` long-polls over
 * grammY, so there is no public URL and no webhook. (The tunnel in .env is for
 * the tutor's Mini App, which is a different surface entirely.)
 */
import {
  createChannel,
  defineChannelCommand,
  Message,
  Section,
  Markdown,
  Actions,
  Button,
} from "@copilotkit/channels";
import { telegram } from "@copilotkit/channels/telegram";
import { persistence as store } from "agent-core";
import { makeChannelAgent } from "./agent";
import {
  chatIdFrom,
  handleStudentAnswer,
  handleStudentVoice,
  handleTutorLine,
} from "./turns";
import { extractVoice } from "./voice";
import { handleLinkStart, isLinkStart, linkFailed, linkedConfirmation } from "./link";
import { required } from "./env";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "between_tutor_bot";
/**
 * The tutor's panel, behind the "Open the lesson brief" button.
 *
 * `||` not `??`: an env var set to an EMPTY STRING is not nullish, so `??`
 * would keep it and the button would read "/panel" with no origin. That is the
 * same trap CHANNEL_CODE fell into earlier today.
 *
 * The fallback is the deployed panel, not localhost. A bot running on Render
 * with PUBLIC_APP_URL unset would otherwise hand the tutor a link to a machine
 * that is not hers — and a dead button is the one thing that cannot be
 * explained away on camera.
 */
const PANEL_ORIGIN =
  (process.env.PUBLIC_APP_URL || "https://between-panel.vercel.app").replace(/\/+$/, "");
const PANEL_URL = `${PANEL_ORIGIN}/panel`;
const pendingEnrollments = new Map<number, { tutorChatId: number }>();

async function studentNamed(line: string) {
  const name = line.split(/[—–-]/, 1)[0]?.trim().toLowerCase();
  if (!name) return undefined;
  return Object.values((await store.read()).students).find((student) => student.name.toLowerCase() === name);
}

/* ── commands ────────────────────────────────────────────────────────────────
 *
 * Anything beginning with "/" is routed by the adapter to the COMMAND path, not
 * to onMessage — so a slash command with no registered handler is silently
 * DROPPED. That is why /tutor and /start produced nothing while "Hi" worked.
 *
 * Every command needs a NON-EMPTY description: the adapter registers them via
 * Telegram's setMyCommands, which 400s on an empty one and only warns at
 * startup. The descriptions are also what Telegram shows in its "/" menu, so
 * they are user-facing copy, not filler.
 *
 * Declared above createChannel because they are passed into it — a `const`
 * referenced before its declaration is a temporal-dead-zone throw at load.
 * ────────────────────────────────────────────────────────────────────────── */

const tutorCommand = defineChannelCommand({
  name: "tutor",
  description: "Set yourself up as the tutor",
  async handler({ thread }) {
    const tutorChatId = chatIdFrom((thread as unknown as { conversationKey: string }).conversationKey);
    await store.setTutorChat(tutorChatId);
    await thread.post(
      <Message accent="#16306B">
        <Section>
          <Markdown>
            {[
              "You're set up as the tutor.",
              "",
              "Send me one line at the end of a lesson — who, what, and anything human about how it went. I'll plan their six days and have a briefing ready five minutes before you next sit down.",
              "",
              "Share this with a student to enrol them:",
              `https://t.me/${BOT_USERNAME}?start=${tutorChatId}`,
            ].join("\n")}
          </Markdown>
        </Section>
        <Actions>
          <Button url={PANEL_URL}>Open the lesson brief</Button>
        </Actions>
      </Message>,
    );
  },
});

/**
 * /start and /start <token> — enrolment. The student taps a link from his tutor
 * and is in. No app, no account, no password: that is the product.
 */
const startCommand = defineChannelCommand({
  name: "start",
  description: "Begin, or join with your tutor's link",
  async handler({ thread, text }) {
    const chatId = chatIdFrom((thread as unknown as { conversationKey: string }).conversationKey);
    const payload = (text ?? "").trim();

    // A tutor connecting her web account: /start link_<signed token>. Checked
    // before the student-invite path, because the two share one entry point and
    // a link token is not a tutor chat id.
    if (isLinkStart(payload)) {
      const linked = await handleLinkStart(payload, chatId);
      await thread.post(linked.ok ? linkedConfirmation(linked.name) : linkFailed(linked.reason));
      return;
    }

    const tutorChatId = Number(payload);
    const validInvite = Number.isSafeInteger(tutorChatId) && tutorChatId === (await store.read()).tutor.chat_id;
    if (validInvite) pendingEnrollments.set(chatId, { tutorChatId });
    await thread.post(
      <Message accent="#F5A623">
        <Section>
          <Markdown>
            {validInvite
              ? "You're in. What should I call you?"
              : "I'm **Between**. Your tutor sets the week; I keep you company through it.\n\nIf you have a link from your tutor, tap it to start."}
          </Markdown>
        </Section>
      </Message>,
    );
  },
});


/**
 * Dev escape hatches. Not part of the demo — during the take the tutor simply
 * types her line and the student simply answers.
 *
 * They exist because the same Telegram account on a laptop and a phone is ONE
 * chat with the bot, so "whoever speaks first is the tutor" cannot be tested
 * solo. Two accounts, two roles, claimed explicitly.
 */
const studentCommand = defineChannelCommand({
  name: "student",
  description: "Claim this chat as the student (testing)",
  async handler({ thread }) {
    // The command context's thread does not surface conversationKey in its
    // public type, but the handle is the same object.
    const chatId = chatIdFrom((thread as unknown as { conversationKey: string }).conversationKey);
    const studentId = `s${chatId}`;
    await store.upsertStudent({ id: studentId, name: "Jonas", chat_id: chatId });
    const plan = await store.latestPlan(studentId);
    await thread.post(
      <Message accent="#F5A623">
        <Section>
          <Markdown>
            {plan
              ? "You're the student. Say anything and I'll give you today's question."
              : "You're the student. Your tutor hasn't set the week yet."}
          </Markdown>
        </Section>
      </Message>,
    );
  },
});

const resetCommand = defineChannelCommand({
  name: "reset",
  description: "Clear the week and start a fresh take (testing)",
  async handler({ thread }) {
    await store.resetDemo();
    await thread.post(
      <Message accent="#16306B">
        <Section>
          <Markdown>
            {"Cleared. Plans, answers and the clock are gone; enrolment kept.\n\nTutor: send your line again."}
          </Markdown>
        </Section>
      </Message>,
    );
  },
});

/* ── the channel ─────────────────────────────────────────────────────────── */

export const channel = createChannel({
  // Required even on the direct-adapter path — the runtime throws
  // "Intelligence Channel is missing a `name`" without it. Note `.env` ships
  // CHANNEL_CODE= as an EMPTY STRING, so `??` would keep it; `||` is correct.
  name: process.env.CHANNEL_CODE || "between",

  // Belongs HERE and not on CopilotRuntime — that one is for web requests and
  // must be absent on a Channels-only runtime.
  identifyUser: "platform",

  adapters: [
    telegram({
      token: required("TELEGRAM_BOT_TOKEN"),
      // "polling" is the default; stated so nobody later assumes a webhook.
      mode: "polling",
      greeting:
        "I'm Between. Your tutor sets the week; I keep you company through it.\n\n" +
        "If you have a link from your tutor, tap it to start.",
    }),
  ],

  agent: makeChannelAgent,
  commands: [tutorCommand, startCommand, studentCommand, resetCommand],

  context: [
    {
      description: "Surface",
      value:
        "This is a one-to-one Telegram chat on a phone, often read on a bus. " +
        "One question at a time. Never a wall of text, never a numbered list of five things. " +
        "Two short lines is a long message here.",
    },
  ],
});

/* ── everyone ────────────────────────────────────────────────────────────── */

channel.onWelcome(async ({ thread }) => {
  await thread.post(
    <Message accent="#F5A623">
      <Section>
        <Markdown>
          {"I'm **Between**.\n\nYour tutor sets the week. I'll keep you company through it — about ten minutes a day, right here."}
        </Markdown>
      </Section>
    </Message>,
  );
});

/**
 * ONE bot, TWO roles, fanned out on chat id.
 *
 * The FIRST person to message the bot is the tutor. No command, no setup screen
 * — because the pitch is that she types one line, and making her run /tutor
 * first would undercut it on camera. /tutor stays as a dev escape hatch.
 * Everyone after her is the student.
 */
channel.onMessage(async ({ thread, message }) => {
  const chatId = chatIdFrom(thread.conversationKey);
  const state = await store.read();
  const tutorChat = state.tutor.chat_id;

  // A voice note carries no `message.text`, so this MUST run before the empty
  // guard below — that line was silently eating every spoken answer. Students
  // only; a voice note from the tutor is still dropped.
  const note = extractVoice(message);
  if (note) {
    const speaking = await store.studentByChat(chatId);
    if (speaking) {
      await handleStudentVoice(thread as never, speaking.id, note, message);
      return;
    }
  }

  const text = (message.text ?? "").trim();
  if (!text) return;

  const pending = pendingEnrollments.get(chatId);
  if (pending) {
    const name = text.slice(0, 40).trim();
    if (name.length < 2) {
      await thread.post(<Message accent="#F5A623"><Section><Markdown>Tell me the first name your tutor uses for you.</Markdown></Section></Message>);
      return;
    }
    const studentId = `s${chatId}`;
    await store.upsertStudent({ id: studentId, name, chat_id: chatId });
    pendingEnrollments.delete(chatId);
    await thread.post(<Message accent="#F5A623"><Section><Markdown>{`You're in, ${name}. I'll practise with you here when your tutor sets your week.`}</Markdown></Section></Message>);
    return;
  }

  const student = await store.studentByChat(chatId);
  if (student) {
    await handleStudentAnswer(thread as never, student.id, text, message);
    return;
  }

  if (tutorChat === null) {
    await store.setTutorChat(chatId);
    await thread.post(<Message accent="#16306B"><Section><Markdown>You're the tutor. First share my enrolment link with a student using `/tutor`, then send a line beginning with their name.</Markdown></Section></Message>);
    return;
  }

  if (chatId === tutorChat) {
    const studentForLine = await studentNamed(text);
    if (!studentForLine) {
      const names = Object.values(state.students).map((student) => student.name).join(", ");
      await thread.post(<Message accent="#16306B"><Section><Markdown>{names ? `I don't recognise that student. I have: ${names}. Start your line with one of those names.` : "No students are enrolled yet. Share the link from `/tutor` first."}</Markdown></Section></Message>);
      return;
    }
    await handleTutorLine(thread as never, studentForLine.id, text);
    return;
  }

  await thread.post(<Message accent="#F5A623"><Section><Markdown>Ask your tutor for their enrolment link, then tap it to join.</Markdown></Section></Message>);
});
