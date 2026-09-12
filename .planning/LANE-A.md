# Lane A · Muhsin — the surface · Telegram + the panel shell

← [BUILD.md](BUILD.md) · contracts: [CONTRACTS.md](CONTRACTS.md) · script: [FIXTURES.md](FIXTURES.md) · delegating: [AGENT-PROMPTS.md](AGENT-PROMPTS.md)

**You own:** `apps/channel/src/**`, `apps/web/src/app/panel/**`,
`apps/web/src/components/between/**`, `apps/web/src/app/api/brief/**`.
**You never touch** `packages/agent-core/src/**` — that is B's. Need something there?
Write it in [STATUS.md](STATUS.md) and say it out loud.

Every task below: **owner check → done when.** If a task isn't done when its block
ends, it goes to [CUTS.md](CUTS.md). Don't finish it beautifully and lose the next one.

---

## Block 1 · 13:10–13:50 — the student chat is alive

### T-A1 · Strip Slack, stand up the Telegram channel — 15 min

Delete the incident demo; keep the wiring. Files: `apps/channel/src/agent.ts`,
`channel.tsx`, `server.ts`, `env.ts`. Delete `search.tsx`, `tools.tsx`,
`components.tsx` and every `*.test.tsx` that references them.

Per [Gate 0](GATE-0.md) A1, either:

```ts
// path (a) — direct token
import { telegram } from "@copilotkit/channels/telegram";
const channel = createChannel({
  name: "between",
  identifyUser: "platform",
  adapters: [telegram({ botToken: process.env.TELEGRAM_BOT_TOKEN! })],
  agent: makeAgent,
});
```

…or path (c), `grammy` long-polling in the same file. Same downstream shape either way.

> Read `.agents/skills/build-channels-agent/SKILL.md` before you write a line of
> this. The most common failure in this codebase is inventing a plausible-looking
> Channels API. `createChannel`, not `createBot`. JSX files must be `.tsx` with
> `jsxImportSource: "@copilotkit/channels"`. `maxSteps` defaults to **1** — any
> agent with tools needs more or it calls one tool and stops.

**Done when:** you message the bot and it echoes back in Telegram.

### T-A2 · Two roles on one bot — 10 min

One bot, fanned out on chat id. `store.tutor.chat_id` is whoever sends `/tutor`.
Everyone else is a student.

- `/tutor` → registers the tutor chat, replies with the enrolment link
- `/start <token>` → enrols a student, asks their name, writes `students[id]`
- anything else → routed to the student turn handler

The enrolment link is `t.me/<bot>?start=<token>`. The tutor drops it into the
class group that already exists. **No account, no install, no password** — and it
is a good demo beat, so make the reply one clean line.

**Done when:** two Telegram accounts (your phone, your desktop) are registered as
tutor and student, and `.data/between.json` shows both chat ids.

### T-A3 · Dedupe + the ≤8-choice rule — 15 min

Two things that ruin takes, fixed now rather than at 14:50.

**Dedupe.** A re-delivered Telegram update posting a duplicate message is the
classic third-take killer. Check `store.seen_updates` before handling; push after.

**The keyboard rule.** Write `apps/channel/src/keyboard.ts` — it exists so the rule
is visible to anyone reading the repo:

```ts
// ≤8 choices -> inline keyboard, stays in the chat. Never a panel, never a webview.
// The student's leg is plain chat forever. A practice app is the exact thing he
// will not open — that's WHY the six days are empty.
export const asChoices = (opts: string[]) =>
  opts.length <= 8 ? { kind: "inline", opts } as const : { kind: "text" } as const;
```

**Done when:** sending the same update twice produces one message, and a 4-option
question renders as tappable buttons in the chat.

---

## Block 2 · 13:50–14:20 — the loop closes

### T-A4 · Tutor intake → `planWeek` — 10 min

The tutor sends **one line** (exact wording in [FIXTURES.md](FIXTURES.md)). You call
B's `planWeek(line)`, store the returned `Plan` at version 1, reply with a
two-line confirmation — *not* the whole plan. The tutor typing one line and
getting on with her day is the pitch.

**Done when:** the tutor's line produces a v1 plan in `.data/between.json`.

### T-A5 · The student turn — 20 min

One question at a time. Never a wall of text. Driven by B's `getDueStep()`.

- Ask → student answers → `recordAttempt()` → immediate reaction (one line, warm, not a report card)
- Silence handling: **stop rather than escalate.** One nudge, then nothing. This is a stated ethical position, not laziness — it goes in the README and in one line of video.
- Voice note? Leave the hook, transcription is B's and it is [cut #1](CUTS.md).

**Done when:** you can walk a student through days 1–3 on the phone and see three
attempt rows land.

---

## Block 3 · 14:20–14:45 — the panel

### T-A6 · Mini App shell + `initData` — 12 min

Route `apps/web/src/app/panel/page.tsx`. The tutor's identity arrives in
`window.Telegram.WebApp.initData` — an HMAC-SHA256 over the sorted params, keyed
by the bot token.

```ts
// ~20 lines. No session, no OAuth, no login screen.
// Recompute the HMAC, compare, reject a stale auth_date. Return the real user id.
// NEVER trust initDataUnsafe for anything that reads a row.
```

> This is historically **the single task most likely to eat an hour.** Timebox it to
> 12 minutes. If it fights you: accept `?student_id=` in dev, ship it, and say
> "auth is stubbed for the demo" in the writeup. A working panel with an honest
> caveat beats an unfinished one with real auth.

**Done when:** opening the menu button on your phone renders the panel with the
tutor's real Telegram name in it.

### T-A7 · The seven components — 18 min · **delegate this** 🤖

Pure presentational React, one file per component, in
`apps/web/src/components/between/`. They take exactly the props in
[CONTRACTS.md](CONTRACTS.md) and nothing else. This is the most agent-friendly task in
the build — hand it off with the brief in [AGENT-PROMPTS.md](AGENT-PROMPTS.md#t-a7)
and do T-A6 yourself while it runs.

`Streak` · `ErrorGrid` · `AudioCompare` · `QuietCard` · `Breakthrough` · `PraiseLine` · `PlanLane`

**They must look genuinely unrelated to each other.** A quiet week and a
pronunciation week rendering as two variations of the same card destroys the
claim. `QuietCard` is mostly white space and one question; `ErrorGrid` is dense
and red; `Breakthrough` is one sentence, large, alone.

CopilotKit renders them via `useCopilotAction` + `render` — **no chat sidebar.**
Shipping a chat sidebar inside a chat app would be absurd; say the missing sidebar
out loud in the writeup rather than letting a judge assume it broke.

**Done when:** `/panel?fixture=quiet` and `/panel?fixture=errors` render two panels
that a stranger would not guess came from the same codebase.

---

## Integration · 14:45–15:05 — with B

- Panel fetches `GET /api/brief?student_id=` → B's validated `Brief` → renders
- The `PlanLane` drag writes plan v+1 back through `sendData()` *(cut #2 — a typed line closes the loop too)*
- **Run the compressed week end to end. Twice.** Record the second pass as a backup take before you try for a better one.

Then → [SHIP.md](SHIP.md).
