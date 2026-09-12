# Submission checklist

Choose your city on the [global event page](https://aitinkerers.org/hackathons/global/agents-everywhere). Use that city's participant portal for the submission deadline and published judging criteria, and its handbook for eligibility and required deliverables. See [hackathon-rules.md](hackathon-rules.md) for the agent-readable summary.

## Build eligibility

- [ ] Our submitted project is a net-new build created during the official hackathon period
- [ ] Its core functionality was built during the event; we are not resubmitting or extending a pre-existing project and entering it as new
- [ ] We identify inherited templates, libraries, prompts, components, and starter code separately from our event work

**What we inherited**

The [Agents, Everywhere starter kit](docs/STARTER-KIT.md): the monorepo layout, `resolveModel`, the CopilotKit Channels wiring in `apps/channel`, and the Next.js app shell in `apps/web`. Libraries: CopilotKit Channels + Runtime, the Vercel AI SDK, Next.js, zod.

The Slack incident demo the kit ships with was **deleted, not adapted** — 1,479 lines removed in the first commit of the Telegram leg.

**What we built during the hackathon**

The entire product. A tutor sends one line; an agent works her student through the six days between lessons in Telegram, then composes her a briefing panel from what the week produced.

| Built today | Where |
|---|---|
| Telegram leg — two roles on one bot, enrolment, the turn loop | `apps/channel/src/channel.tsx`, `turns.tsx` |
| Week planning from one line | `packages/agent-core/src/llm.ts` → `planWeek` |
| Deterministic evidence triggers | `packages/agent-core/src/evidence.ts` |
| Mid-week plan revision | `llm.ts` → `revisePlan`, with `assertRevisionLegal` in `contracts.ts` |
| Panel composition from a closed catalogue | `compose.ts`, `llm.ts` → `composeBrief` |
| The seven typed components + renderer | `apps/web/src/components/between/` |
| Telegram Mini App auth | `apps/web/src/lib/telegram-initdata.ts` |
| Compressed demo clock | `apps/web/src/app/api/tick/`, `store.ts` |
| The frozen contracts both sides build against | `packages/agent-core/src/contracts.ts` |

## Title and description

**What you built**

A tutor types one line at the end of a lesson — *"Jonas — German past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud."* That is the only thing she types all week.

Between plans the six days before the next lesson and works them with the student in plain Telegram chat, one question at a time. When he regularises a strong verb twice, a trigger computed in code rewrites the rest of his week — day 5 changes from a drill to an explanation — and tells him why. Five minutes before the next lesson, the tutor taps one button and gets a briefing panel composed from what the week actually produced.

**Who it is for**

A private tutor, language teacher or coach with around twenty weekly one-to-one clients. Her work exists for the fifty-five minutes she is in the room. Then six days of nothing, and the next lesson opens with "how did it go."

Her student is a teenager with a phone. He will not install a practice app — that is *why* those six days are empty.

**Why the context matters**

The six dead days **are** the context. A standalone chatbox has no student to reach: he installed nothing, created no account, and would not open a practice app. Because the agent lives in the chat app already on his phone, it reaches him on a bus in eight seconds — and it deliberately never gives him a screen to open, because that is the exact failure it exists to fix.

The tutor's half is the mirror image: she is at a desk with five minutes, so she gets the one surface in the product that has a screen, and its shape changes with the week.

**Sponsor technologies used**

**CopilotKit** — load-bearing on both legs. Channels (Telegram adapter, long-polling) carries the student conversation and renders native inline keyboards; the generative-UI half composes the tutor's panel from seven typed components. Deliberately mounted *without* its chat sidebar — a chat sidebar inside a chat app would be absurd.

**OpenAI** — `gpt-4.1-mini` under structured outputs for planning, revision, the student's replies, and panel composition. The output schema and the renderer's types are one declaration.

## Evidence for the judging criteria

Judges score each of the four official criteria from 1–5. This checklist helps you gather evidence; it does not guarantee a score. A working starter is a foundation for your own project.

| Official criterion | Show in your project and demo |
|---|---|
| Core Requirements & Functionality | Run one complete workflow in the intended environment, from user request through tools to a verified result. Repeat it with live integrations; offline tests alone do not prove the deployed flow. |
| Innovation & Theme Alignment | Show the surrounding context before the prompt and explain the original interaction it enables. Compare with the context removed: what value would a standalone chatbox lose? |
| Technical Execution & Integration | Show how tools, data, and the environment connect. Demonstrate a relevant failure or cancellation path and explain recovery, state persistence, and integration limits. |
| Usefulness & Agentic Experience | Identify the user and problem, show a meaningful action in the surface, and demonstrate clear feedback and appropriate user control. Explain what work the agent saves. |

- [ ] We can point to visible evidence for every criterion
- [ ] We distinguish live services, sample data, session-only state, and standalone recipes
- [ ] Sponsor technologies contribute to the workflow; their count is not a judging criterion

## Public repository

- [ ] A new participant can run the quickstart from a clean clone
- [ ] The README lists the credentials and separate processes required
- [ ] `npm run verify` passes; optional recipe checks pass if used
- [ ] `.env`, tokens, generated traces with sensitive data, and account secrets are excluded
- [ ] Sample data, session-only state, and unimplemented integrations are clearly labeled

## Two-minute demo video

- [ ] Show the surface and existing context before the prompt
- [ ] Demonstrate one complete interaction
- [ ] Show a visible result: an actual record, local state change, or research source links
- [ ] If showing an approval, distinguish the decision from execution and demonstrate the resulting behavior
- [ ] State which sponsor technologies made the interaction possible
- [ ] Keep the video within the event's limit and check audio

See [demo prompts](dev-docs/demo-prompts.md) for a reproducible incident workflow.

## Social post and final submission

- [ ] Follow the organizer's posting and sponsor-tagging instructions
- [ ] Link the public repository and video
- [ ] Credit the sponsors you used and applicable local partners
- [ ] Check the live integration once more before recording or submitting
- [ ] Inspect the repository, video and screenshots for secrets

Prepare the post and submission for a human to publish; running the starter kit
does not publish either automatically.
