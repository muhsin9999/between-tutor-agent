# Between — build control room

**Read this file first. It is the only file that tells you what to do *next*.**

One-line product: *a tutor sends one line after a lesson; the agent works the student through the six dead days in plain Telegram chat, then builds the tutor a briefing panel whose shape comes from what the week actually produced.*

| | |
|---|---|
| Event | AI Tinkerers × OpenAI — "Agents, Everywhere", Abuja |
| **Submit by** | **16:00 WAT today** |
| Code freeze | **15:05 WAT** — nothing but copy changes after this |
| Team | **Mcjethro = Lane A** · **Muhsin = Lane B** · plus AI agents |
| Repo | `muhsin9999/between-tutor-agent` — ✅ already public |

## The map

| File | What it is | When you read it |
|---|---|---|
| **[GATE-0.md](GATE-0.md)** | Pre-flight. Nothing else starts until this passes. | **Now** |
| **[TELEGRAM-SETUP.md](TELEGRAM-SETUP.md)** | BotFather, step by step. Bot + Mini App URL. | Gate 0 A2 |
| **[CONTRACTS.md](CONTRACTS.md)** | The two frozen data shapes. Single source of truth. | Gate 0, then never edit |
| **[LANE-A.md](LANE-A.md)** | A's tasks — Telegram, both chats, the panel shell | After Gate 0 |
| **[LANE-B.md](LANE-B.md)** | B's tasks — planning, revision, composition | After Gate 0 |
| **[FIXTURES.md](FIXTURES.md)** | The demo script, word for word. Seeded weeks. | Before you write prompts |
| **[AGENT-PROMPTS.md](AGENT-PROMPTS.md)** | Copy-paste briefs for dispatching AI agents | Every time you delegate |
| **[CUTS.md](CUTS.md)** | What to drop, at what time, in what order | 14:20 and whenever you're behind |
| **[SHIP.md](SHIP.md)** | Video shot list, writeup, social post, submission | 15:05 |
| **[STATUS.md](STATUS.md)** | Live board. Both of you edit it. | Every 20 minutes |
| **[STRETCH.md](STRETCH.md)** | What to add in the last 35 minutes, and what not to | 14:30 |
| **[SURFACES.md](SURFACES.md)** | Who else this product has to meet — the parent gap first | After the deadline |
| **[AUTH.md](AUTH.md)** | Better Auth on the browser door; Telegram keeps its own | After the deadline |
| **[HOSTING.md](HOSTING.md)** | Getting off the laptop: Vercel + a container host + Neon | After the deadline |

## Timeline

> **Lane assignment — swap it in the next 10 seconds if it's wrong, then leave it.**
> **Mcjethro on A** (the surface): BotFather, the tunnel and the Telegram spike.
> **Muhsin on B** (the engine): `revisePlan`
> and `composeBrief` are the don't-delegate work where knowing the product claim
> matters most. To swap, change this table and the two headings — nothing else
> depends on the letters.

| Time | Block | A · Mcjethro | B · Muhsin |
|---|---|---|---|
| **12:50–13:10** | [Gate 0](GATE-0.md) | Telegram adapter spike + BotFather | Prove model key + write [CONTRACTS.md](CONTRACTS.md) |
| **13:10–13:50** | Block 1 | Student chat alive, enrolment link | `planWeek` + `tick` + store |
| **13:50–14:20** | Block 2 | Teacher intake line → `planWeek` call | `revisePlan` + evidence triggers |
| **14:20–14:45** | Block 3 | Mini App shell + 7 components | `composeBrief` → validated tree |
| **14:45–15:05** | Integration | Both: wire panel to real data, run the compressed week twice, **record a backup take** |
| **15:05–15:30** | [Ship](SHIP.md) | Film | Writeup + social post + repo public |
| **15:30–16:00** | Submit | Portal, both watching | |

**If a block runs over, you do not extend it. You go to [CUTS.md](CUTS.md).**

## Architecture — decided, do not relitigate

```
apps/channel      →  TELEGRAM process (long-running). Student chat + teacher intake.
                     Repurposed from the Slack incident demo. Slack code gets deleted.
apps/web          →  TEACHER PANEL (Telegram Mini App) + /api/tick + /api/brief.
                     Next.js on :3100. CopilotKit React generative UI, NO chat sidebar.
packages/agent-core → planWeek · nextStep · revisePlan · composeBrief · evidence triggers
                     · the component vocabulary · the JSON store. Shared by both apps.
apps/mobile       →  UNUSED. Do not touch.
```

**State lives in one JSON file**, `.data/between.json`, written through
`packages/agent-core/src/store.ts`. Both processes run on the same machine, so this
is sufficient and costs zero setup. No Neon, no Drizzle, no migrations.
*Label it honestly in the writeup as session state on disk* — [SHIP.md](SHIP.md) has the wording.

## File ownership — the rule that stops you colliding

Two people and several agents are writing at once. **Never edit a file in the other
lane's column.** If you need a change there, write it in [STATUS.md](STATUS.md) and say it out loud.

| A · Mcjethro owns | B · Muhsin owns | Shared — frozen at 13:10 |
|---|---|---|
| `apps/channel/src/**` | `packages/agent-core/src/llm.ts` | `packages/agent-core/src/contracts.ts` |
| `apps/web/src/app/panel/**` | `packages/agent-core/src/plan.ts` | [CONTRACTS.md](CONTRACTS.md) |
| `apps/web/src/components/between/**` | `packages/agent-core/src/evidence.ts` | `.env` |
| `apps/web/src/app/api/brief/**` | `packages/agent-core/src/compose.ts` | |
| | `packages/agent-core/src/store.ts` | |
| | `apps/web/src/app/api/tick/**` | |

`packages/agent-core/src/contracts.ts` is written **once**, by B, during Gate 0.
After 13:10 it changes only if **both** of you agree out loud. It is the file that
makes parallel work possible — everything else is downstream of it.

## Commit protocol

**Branch → push → PR → merge.** One branch per task, named for the lane and the task:

```
a/telegram-channel      b/evidence-triggers
a/mini-app-shell        b/compose-brief
```

- `git switch -c a/<thing>` off an up-to-date `main`.
- Commit every time something works. Small and often beats one big push.
- Prefix messages `A:` or `B:` so the log reads as two lanes.
- `gh pr create --fill` then **merge your own** — `gh pr merge --squash --delete-branch`.
  There is no third person and no time to block on a reviewer. The PR is there for
  the record and so the other lane can see what landed, not as a gate.
- **Keep branches under ~30 minutes of work.** A long-lived branch in a 2-hour
  build is how the two lanes discover a conflict at 14:50.
- `git pull --rebase origin main` before you open the PR. Never `--force`.
- **Never commit `.env` or `.data/`.** Check `.gitignore` covers both in Gate 0.

> If a PR would block you — the other person is mid-task and you need their file —
> that is the signal you have crossed a lane boundary. Go back to the ownership
> table rather than waiting.

## The three rules that are the product

These came out of the design work and are the reason this scores. Breaking one
under time pressure costs more than the feature you saved.

1. **The student never gets a panel.** Plain chat, forever. ≤8 choices → inline
   keyboard in the conversation. The premise is that he will not open an app — a
   panel on his leg rebuilds the exact failure the product exists to fix.
2. **Never cut `revisePlan`.** It is the only thing separating this from a
   scheduled-message product. If it goes, the honest writeup says "practice
   scheduler", not "agent".
3. **The model composes; it does not write JSX.** It picks which of the seven
   typed components appear, in what order, holding what contents. An unknown
   component fails schema validation rather than rendering blank. Nothing the
   model emits is executed. Say this out loud in the video.

## Known hazards, pre-solved

| Hazard | Answer |
|---|---|
| Nigerian card declined on OpenAI API billing | Gate 0 proves the key with a real call. OpenRouter fallback is already wired via `MODEL_PROVIDER`. |
| Vercel Hobby cron is daily-granularity | We never use cron. `/api/tick?now=` + `DEMO_SPEED=day:40s`, built in Block 1. |
| Duplicate Telegram update ruins a take | Dedupe on update id in the store. [LANE-A.md](LANE-A.md) T-A3. |
| Grader marks a correct answer wrong | Exact normalised comparison runs **first**; model only on a miss. [LANE-B.md](LANE-B.md) T-B4. |
| `@ag-ui/client` duplicated → nothing compiles | Root `overrides` already pins it. If you bump Channels, re-run `npm ls @ag-ui/client`. |
| "You built a web app and put a frame around it" | The student leg is native chat with zero webview. Lead the demo there. |
