# Between — standing rules for every agent in this repo

**This file is loaded automatically at the start of every session, including after
`/clear` and `/compact`. If you have just been compacted or cleared: re-read
`.planning/BUILD.md` and `.planning/STATUS.md` before doing anything. They hold
the current state; this conversation does not.**

Today is build day. Submission closes **16:00 WAT**. Code freeze **15:05**.

## What this is

A private tutor sends **one line** at the end of a lesson. An agent plans the six
dead days before the next lesson, works them with the student **in plain Telegram
chat**, and five minutes before the next lesson builds the tutor a briefing panel
**whose shape comes from what the week actually produced**.

## Where the plan lives

`.planning/` — ten interconnected files. **[`.planning/BUILD.md`](.planning/BUILD.md)
is the entry point and the only file that tells you what to do next.**

| | |
|---|---|
| Control room, timeline, file ownership | `.planning/BUILD.md` |
| The frozen types | `.planning/CONTRACTS.md` → `packages/agent-core/src/contracts.ts` |
| Per-person tasks | `.planning/LANE-A.md` (Muhsin) · `.planning/LANE-B.md` (Mcjethro) |
| Demo script, fixtures | `.planning/FIXTURES.md` |
| What to drop and when | `.planning/CUTS.md` |
| Live state | `.planning/STATUS.md` |

## The five rules. Do not break these to save time.

1. **The student never gets a panel or a webview.** Plain chat, forever. ≤8 choices
   → inline keyboard **in the conversation**. The product's premise is that he will
   not open a practice app — that is *why* the six days are empty. A panel on his
   leg rebuilds the exact failure the product exists to fix.

2. **Never cut `revisePlan`.** It is the only thing separating this from a
   scheduled-message product. If it goes, the honest writeup says "practice
   scheduler", not "agent" — and the heaviest judging criterion is exactly that
   distinction. If you are so far behind that `revisePlan` is on the block, cut the
   panel instead.

3. **The model composes; it does not write JSX.** It chooses which of seven typed
   components appear, in what order, holding what contents. An unknown component
   **fails schema validation** rather than rendering blank. Nothing the model emits
   is executed. Never write or say that the model generates code — someone will
   read the repo.

4. **Stay inside your lane's file ownership.** The table is in `.planning/BUILD.md`.
   Two humans and several agents are writing in parallel. Need a change in the other
   lane? Write it under **Asks** in `.planning/STATUS.md`. Never reach across.

5. **`packages/agent-core/src/contracts.ts` is frozen.** It changes only if both
   humans agree out loud, and the change gets logged in `.planning/STATUS.md`.
   Every parallel task is downstream of it.

## Technical rules that will cost you an hour if ignored

- **Read `.agents/skills/build-channels-agent/SKILL.md` before touching
  `apps/channel/`.** The Channels API is recent and not reliably in model memory.
  The most common failure in this codebase is inventing a plausible-looking
  Channels API. `createChannel`, not `createBot` — `createBot` and `defineBotTool`
  exist **nowhere** in the shipped packages.
- **`maxSteps` defaults to 1** on `BuiltInAgent`. Any agent with tools needs more,
  or it calls one tool and stops before seeing the result.
- **JSX files in `apps/channel` must be `.tsx`** with `jsxImportSource:
  "@copilotkit/channels"`. That is not React.
- **`@ag-ui/client` must stay deduped** — the root `overrides` pins it. Two copies
  means two `AbstractAgent` types and every `createChannel({ agent })` fails on a
  private `_debug` property.
- **OpenAI structured outputs run strict**: every property must be in `required`
  and `additionalProperties` false. Use `.nullable()`, never `.optional()`, on
  model-facing schema fields. This fails at request time, not typecheck time.
- **Grade with exact normalised comparison FIRST**, model only on a miss. A grader
  marking a correct answer wrong on camera is one of the two things that ruins takes.
- **Dedupe Telegram updates on update id.** The other thing that ruins takes.
- **No cron.** Vercel Hobby is daily-granularity. Time passes via
  `/api/tick?now=` + `DEMO_SPEED=day:40s`.
- **Run `npm run typecheck` before claiming anything works.**

## Repo hygiene — non-negotiable

- **Never commit `.env` or `.data/`.** Both are gitignored; keep it that way.
- **Never commit real personal data.** Every fixture is synthetic. This repo is public.
- Commit small and often, prefix `A:` or `B:`, `git pull --rebase` before pushing.
- Both push to `main`. No branches, no PRs — there is no time and no reviewer.

## Scope discipline

Do not add: classes/multi-student, Slack, a chat sidebar in the panel, a real
database, auth beyond `initData`, or tests beyond what `npm run verify` runs.
If it is not in your lane file, it is not in scope today. `.planning/CUTS.md`
lists what to drop, in order, with trigger times.

## How to report

State what is done against the **done-when** in the lane file, not what you
attempted. If something is broken, say so with the output. If you skipped
something, say that. Update `.planning/STATUS.md` when a task changes state.
