<div align="center">

<img src="assets/brand/bot-avatar.png" width="96" alt="Between">

# Between

**A tutor's work exists for the fifty-five minutes she's in the room. Then six dead days, and the next lesson opens with "how did it go."**

[What it is](#what-it-is) · [Run it](#run-it) · [How it works](#how-it-works) · [What we built today](#what-we-built-today) · [Honest labels](#honest-labels)

</div>

## What it is

A private tutor, language teacher or coach sends **one line** at the end of a lesson:

> Jonas — German past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud.

That is the only thing she types all week.

The agent plans the six days, works them with the student **in plain Telegram chat**, and five minutes before the next lesson builds her a briefing panel **whose shape comes from what the week actually produced**.

The student installs nothing. No app, no account, no password — he answers in the chat app already on his phone.

### The asymmetry is the design

| | Student | Tutor |
|---|---|---|
| Where | On a bus, phone in hand | At a desk, five minutes before a lesson |
| Needs | To answer in eight seconds | To see something different every week |
| Surface | **Plain chat, forever** | **A generated panel** |
| Setup | None | None — `initData` carries her identity |

**The student never gets a panel.** The product's premise is that a practice app is the exact thing he will not open — that is *why* the six days are empty. A screen on his side would rebuild the failure the product exists to fix. Eight choices or fewer become a native inline keyboard and stay in the conversation; `apps/channel/src/keyboard.ts` states the rule in code so it is visible to anyone reading the repo.

## Run it

Node.js 22+. From a clean clone:

```bash
git clone https://github.com/muhsin9999/between-tutor-agent.git
cd between-tutor-agent
npm ci
cp .env.example .env
```

### Credentials you need

| Variable | Where from | Needed for |
|---|---|---|
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) | Planning, revision, composition |
| `MODEL` | — | `gpt-4.1-mini`. A reasoning model works but takes ~90s per call |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) → `/newbot` | The bot |
| `TELEGRAM_BOT_USERNAME` | BotFather | The enrolment link |
| `INTELLIGENCE_API_KEY` | [intelligence.copilotkit.ai](https://intelligence.copilotkit.ai/) | Required by the Channels runtime |
| `PUBLIC_APP_URL` | your tunnel | The Mini App URL |

Prove the model key before anything else — it takes ten seconds and is the only failure that costs you a whole session:

```bash
node --env-file=.env scripts/prove-key.mjs
```

`MODEL_PROVIDER=openrouter` with an `OPENROUTER_API_KEY` is a drop-in fallback; no code changes.

### Two processes, both required

```bash
npm run dev --workspace channel   # the Telegram bot, long-polling
npm run dev:web                   # the tutor's panel on :3100
```

The bot needs **no public URL** — the adapter long-polls out to Telegram. The *panel* does, because Telegram loads it in a webview:

```bash
cloudflared tunnel --url http://127.0.0.1:3100
```

Then in BotFather: `/newapp` pointed at `https://<tunnel>/panel`, and `/setmenubutton` at the same URL. Full walkthrough with every prompt and reply: [`.planning/TELEGRAM-SETUP.md`](.planning/TELEGRAM-SETUP.md).

### Try it

1. The student sends `/student` to the bot (dev command; in real use he taps the tutor's enrolment link)
2. The tutor sends her one line
3. The student answers — `ging`, then two wrong answers that regularise a strong verb (`sehte`, `nehmte`)
4. The second matching error fires a plan revision, visible in the chat
5. The tutor taps **Lesson brief**

`DEMO_SPEED=day:40s` compresses six days into four minutes. `/reset` clears the week but keeps both of you enrolled.

```bash
npm run verify   # typecheck + tests across all three workspaces
```

## How it works

```
apps/channel     Telegram. Student chat + tutor intake.
                 CopilotKit Channels, direct adapter, long-polling over grammY.
apps/web         The tutor's Mini App panel, /api/brief, /api/tick.
                 Next.js + CopilotKit generative UI — deliberately no chat sidebar.
packages/agent-core
                 planWeek · revisePlan · nextStep · composeBrief · evidence triggers
                 · the frozen contracts both sides build against.
```

### What makes it an agent rather than a scheduler

Triggers are computed **in code from attempt rows**, never by a model's judgement — `packages/agent-core/src/evidence.ts`:

- the same `error_tag` twice
- three consecutive correct on a target
- no attempt for two due steps

A trigger calls `revisePlan`, which rewrites **only the remaining days** and stores version+1 with a one-sentence reason. It may not extend the week past day 6, and may not introduce material the tutor never set — both enforced in code, not asked for in a prompt. **The earlier version is never overwritten**; v1 and v2 side by side is the evidence.

### What is generated

The model chooses which of **seven typed components** appear in the panel, in what order, holding what contents: `Streak` `ErrorGrid` `AudioCompare` `QuietCard` `Breakthrough` `PraiseLine` `PlanLane`.

**Composition from a closed catalogue, not code generation.** The model does not write JSX and nothing it emits is executed. `composeBrief`'s structured-output schema *is* the renderer's type — one declaration in `contracts.ts` — so a component the renderer does not know about **fails validation rather than rendering blank**.

Three weeks composed today, same code:

| The week | What rendered |
|---|---|
| He went quiet after day 1 | `QuietCard → PlanLane` — no grid, no zeroed streak. It carries no data because there isn't any |
| Two errors on one rule | `ErrorGrid → Streak → PlanLane` |
| The same week, minutes later | `ErrorGrid → PraiseLine → PlanLane` |

There is no chat sidebar in the panel. A chat sidebar inside a chat app would be absurd; only the generative-UI half of CopilotKit is mounted.

## What we built today

**Inherited:** the [Agents, Everywhere starter kit](docs/STARTER-KIT.md) — the monorepo layout, `resolveModel`, the Channels wiring in `apps/channel`, and the Next.js app shell. The Slack incident demo it ships with was deleted, not adapted.

**Built during the event:** the Telegram leg (both roles on one bot, enrolment, the turn loop), `planWeek` / `revisePlan` / `nextStep` / `composeBrief`, the deterministic evidence triggers, the seven components and their renderer, the `initData` verification, the brief API, the compressed clock, and the contracts both sides build against.

## Honest labels

Things a judge would otherwise have to discover:

- **Today’s demo state is a JSON file on disk** (`.data/between.json`), which makes a clean take one `rm`. The project now has a Neon PostgreSQL schema and setup guide in [`docs/NEON.md`](docs/NEON.md); the application store migration is the next backend step before multi-host deployment.
- **The clock is compressed.** `DEMO_SPEED=day:40s` — six days in four minutes. Said out loud in the demo rather than left to be noticed.
- **All fixtures are synthetic.** No real student data is in this repo, and none should be.
- **`/student` and `/reset` are dev commands**, not part of the product. In real use the student taps an enrolment link.
- **Voice notes were cut.** `AudioCompare` exists in the vocabulary and is unused — transcription was the cost, not the rendering.
- **The panel recomposes on every load**, so two opens of the same week can differ. That is the generation being real, not a cache miss.
- **Intelligence reports the Telegram channel as `provider: channel_not_declared`.** Expected — CopilotKit Intelligence declares only Slack and Teams, and our adapter polls Telegram directly. The startup gate checks transport instead.

## Where it stops

Not a curriculum, a course platform, or a replacement teacher. It works **only** on what the human tutor assigned and introduces no new material. It reports to nobody but that student's own tutor. It **stops rather than escalating** when a student goes quiet — one nudge, then silence. It does not message under-18s except through a parent's account.

## More

- [`docs/overview.html`](docs/overview.html) — the project at a glance: feature ledger, what shipped, what's next
- [`.planning/`](.planning/) — how two people and several agents built this in an afternoon without colliding
- [`docs/STARTER-KIT.md`](docs/STARTER-KIT.md) — the kit we started from

Built 12 September 2026 for **AI Tinkerers × OpenAI — Agents, Everywhere**, Abuja.
Telegram · CopilotKit · OpenAI.
