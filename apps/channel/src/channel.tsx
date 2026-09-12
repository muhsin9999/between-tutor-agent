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
import { makeChannelAgent } from "./agent";
import { required } from "./env";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "between_tutor_bot";
const PANEL_URL = `${process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3100"}/panel`;

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
              `https://t.me/${BOT_USERNAME}?start=demo`,
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
    const enrolled = Boolean((text ?? "").trim());
    await thread.post(
      <Message accent="#F5A623">
        <Section>
          <Markdown>
            {enrolled
              ? "You're in. Your tutor set this week's practice — about ten minutes a day, right here.\n\nI'll ask you the first thing shortly."
              : "I'm **Between**. Your tutor sets the week; I keep you company through it.\n\nIf you have a link from your tutor, tap it to start."}
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
  commands: [tutorCommand, startCommand],

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

channel.onMessage(async ({ thread }) => {
  await thread.runAgent();
});
