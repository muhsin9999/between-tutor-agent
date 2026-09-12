# Submission — Between

Everything the portal asks for, ready to paste.

---

## 1 · Project title

**Between**

---

## 2 · Written description

### What it is

A private tutor's work exists for the fifty-five minutes she is in the room. Then six dead days, and the next lesson opens with *"how did it go."*

**Between lives in those six days.** The tutor sends **one line** at the end of a lesson:

> Jonas — German past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud.

That is the only thing she types all week. The agent plans the six days, works them with her student **in plain Telegram chat**, and five minutes before the next lesson builds her a briefing panel **whose shape comes from what the week actually produced**.

The student installs nothing. No app, no account, no password. He answers on the bus, in the chat app already on his phone — by typing or by speaking.

### Why the environment is essential

The six dead days **are** the context. A standalone chatbox has no student to reach: he never created an account, and he will not open a practice app — which is precisely *why* those days are empty. Because the agent lives where he already is, it reaches him in eight seconds.

The asymmetry is the design:

| | Student | Tutor |
|---|---|---|
| Where | On a bus, phone in hand | At a desk, five minutes before a lesson |
| Needs | To answer in eight seconds | To see something different every week |
| Surface | **Plain chat, forever** | **A generated panel** |
| Setup | None | None — Telegram's signed `initData` carries her identity |

**The student never gets a screen.** Eight choices or fewer render as a native inline keyboard inside the conversation. A panel on his side would rebuild the exact failure the product exists to fix. The rule is written as code, in `apps/channel/src/keyboard.ts`, so anyone reading the repo can see it.

### What makes it an agent, not a scheduler

Triggers are computed **in code from attempt rows** — never by a model's judgement (`packages/agent-core/src/evidence.ts`):

- the same error tag twice
- three consecutive correct on a target
- no attempt for two due steps

A trigger calls `revisePlan`, which rewrites **only the remaining days** and stores version + 1 with a one-sentence reason. It may not extend the week past day 6, and may not introduce material the tutor never set — both enforced in code, not asked for in a prompt. **The earlier version is never overwritten**, so v1 and v2 sit side by side as evidence.

This happened live on Telegram during the build. Two regularised strong verbs, and:

> *"I've changed the rest of your week — this keeps tripping you up."*
> *Kept days 1–4 unchanged as instructed; replaced day 5 drill with an explanation to address vowel change errors; moved produce task to day 6 to build confidence gradually.*

Day 5 then **actually became** the explanation.

### The panel nobody drew

A model chooses which of **seven typed components** appear, in what order, holding what contents: `Streak` `ErrorGrid` `AudioCompare` `QuietCard` `Breakthrough` `PraiseLine` `PlanLane`.

**Composition from a closed catalogue, not code generation.** The model writes no JSX and nothing it emits is executed. `composeBrief`'s structured-output schema **is** the renderer's type — one declaration in `contracts.ts` — so a component the renderer does not know about **fails validation rather than rendering blank**.

Three weeks composed during the build, from the same code:

| The week | What rendered |
|---|---|
| He went quiet after day 1 | `QuietCard → PlanLane` — no grid, no zeroed streak. It carries no data because there isn't any |
| Two errors on one rule | `ErrorGrid → Streak → PlanLane` |
| The same week, minutes later | `ErrorGrid → PraiseLine → PlanLane` |

There is no chat sidebar in the panel. A chat sidebar inside a chat app would be absurd; only the generative-UI half of CopilotKit is mounted.

### It is not only German

The error vocabulary is **a property of the plan**, derived from the tutor's own sentence — `sign-error`, `factorising`, `order-of-operations` for quadratics; `timing`, `fingering` for piano. Without that, a maths student's every miss tags `untagged`, the trigger never fires and the plan never revises: planning would work and the agent would not.

### Sponsor technologies

**CopilotKit** — load-bearing on both legs. Channels (Telegram adapter, long-polling) carries the student conversation and renders native inline keyboards; the generative-UI half composes the tutor's panel. Deliberately mounted **without** its chat sidebar.

**OpenAI** — `gpt-4.1-mini` under structured outputs for planning, revision, replies and composition; `gpt-4o-mini-transcribe` for spoken answers; `gpt-image-1-mini` for generated diagrams.

---

## 3 · Public repository

https://github.com/muhsin9999/between-tutor-agent

A new participant can run it from a clean clone — README has the credentials table and the two processes. `npm run verify` runs 161 tests across four workspaces.

---

## 4 · Two-minute video

Shot list in [`.planning/SHIP.md`](.planning/SHIP.md).

Say out loud, or a judge assumes it broke:
- *"The clock is compressed — six days in four minutes."*
- *"There's no chat sidebar. A chat sidebar inside a chat app would be absurd."*
- *"The model composes from seven typed components. It doesn't write code."*

---

## 5 · Social post

> Most agents wait in a chat window.
>
> A tutor's week is fifty-five minutes in the room and six days of nothing. **Between** lives in those six days — she sends one line, it works her student through the week in plain Telegram chat, and rebuilds her pre-lesson briefing around whatever actually happened.
>
> When he made the same mistake twice, it rewrote the rest of his week and told him why.
>
> Built today at #AgentsEverywhere with @CopilotKit and @OpenAI 🇳🇬

---

## Build eligibility

- [x] Net-new build, created during the official hackathon period
- [x] Core functionality built during the event
- [x] Inherited building blocks identified separately below

### What we inherited

The [Agents, Everywhere starter kit](docs/STARTER-KIT.md): the monorepo layout, `resolveModel`, the CopilotKit Channels wiring in `apps/channel`, and the Next.js app shell. Libraries: CopilotKit Channels + Runtime, Vercel AI SDK, Next.js, zod, Better Auth, Neon.

**The Slack incident demo the kit ships with was deleted, not adapted** — 1,479 lines removed in the first commit of the Telegram leg.

### What we built during the hackathon

The entire product.

| Built today | Where |
|---|---|
| Telegram leg — two roles on one bot, enrolment, the turn loop | `apps/channel/src/channel.tsx`, `turns.tsx` |
| Week planning from one line | `agent-core/src/llm.ts` → `planWeek` |
| Deterministic evidence triggers | `agent-core/src/evidence.ts` |
| Mid-week plan revision | `llm.ts` → `revisePlan`, `assertRevisionLegal` |
| Subject-derived error taxonomy | `contracts.ts`, `llm.ts` |
| Panel composition from a closed catalogue | `compose.ts`, `composeBrief` |
| The seven typed components + renderer | `apps/web/src/components/between/` |
| Telegram Mini App auth | `apps/web/src/lib/telegram-initdata.ts` |
| Compressed demo clock | `api/tick/`, `store.ts` |
| Voice answers | `agent-core/src/transcribe.ts`, `apps/channel/src/voice.ts` |
| In-chat visual explanations | `apps/channel/src/explain.tsx` |
| Drag-to-reorder next week | `plan-lane-editable.tsx`, `api/plan/route.ts` |
| Tutor web app + Better Auth | `apps/dashboard/` |
| Neon persistence | `agent-core/src/persistence.ts` |
| The frozen contracts both sides build against | `agent-core/src/contracts.ts` |

---

## Evidence for the judging criteria

| Criterion | Where to look |
|---|---|
| **Core requirements & functionality** | The full loop on live Telegram: one line in → six days worked → plan revises itself → panel out. Demonstrated end to end during the build |
| **Innovation & theme alignment** | The six dead days **are** the context. Remove the surface and there is no student to reach — he installed nothing and would not open an app |
| **Technical execution & integration** | Deterministic triggers in code, not model judgement; one schema that is both the model's output contract and the renderer's type; turns serialised per student against parallel delivery; transcription failure writes no attempt |
| **Usefulness & agentic experience** | She types one line a week. The agent changes its own plan and shows its reason. She can drag next week back |

The heaviest question is *"would this still work in a normal chat window?"* Our answer is the student's leg: **he never opens an app — and that is not decoration, it is the reason the six days were empty.**

---

## Honest labels

Things a judge would otherwise have to discover:

- **The clock is compressed.** `DEMO_SPEED=day:40s` — six days in four minutes.
- **All fixtures are synthetic.** No real student data is in this repo.
- **`/student` and `/reset` are dev commands**, not the product.
- **Image generation is off the hot path.** Measured at 13.65s cold, so it is cache-first and pre-warmed — never awaited inside a student's turn.
- **Voice needs a vocabulary hint.** Without the week's target items, bare one-word answers mis-transcribe.
- **The panel recomposes on every load**, so two opens of the same week can differ. That is the generation being real.
- **Intelligence reports the Telegram channel as `provider: channel_not_declared`** — expected; CopilotKit Intelligence declares only Slack and Teams, and our adapter polls Telegram directly.
- **The tutor dashboard is new and partly stubbed.** Sign-in is real (Better Auth + Neon, tables migrated); plan history and editing are stubs.

## Where it stops

Not a curriculum, a course platform, or a replacement teacher. It works **only** on what the human tutor assigned and introduces no new material. It reports to nobody but that student's own tutor. It **stops rather than escalating** when a student goes quiet. It does not message under-18s except through a parent's account — [`.planning/SURFACES.md`](.planning/SURFACES.md) records honestly that the consent gate is designed and not yet enforced, and that closing it ranks ahead of every feature.
