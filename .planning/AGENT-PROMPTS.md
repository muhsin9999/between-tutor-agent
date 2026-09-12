# Dispatching AI agents — copy-paste briefs

← [BUILD.md](BUILD.md)

You have two humans and unlimited agents. The bottleneck is **not** typing speed —
it is the twenty minutes lost when an agent invents an API, or when two agents
edit the same file. These briefs exist to stop both.

## The rules

1. **One agent, one lane, one file set.** Never dispatch an agent that writes
   outside your ownership column in [BUILD.md](BUILD.md).
2. **Paste the contract, don't reference it.** An agent told to go read
   [CONTRACTS.md](CONTRACTS.md) will paraphrase it. Paste the actual type.
3. **Every brief ends with a done-when the agent can run.** `npm run typecheck` at
   minimum.
4. **Never let an agent touch `apps/channel/` without the skill.** Point it at
   `.agents/skills/build-channels-agent/SKILL.md` explicitly — the most common
   failure in this codebase is a plausible-looking Channels API that doesn't exist.
5. **Delegate the wide, shallow work** (seven components, fixtures, the README) and
   **keep the narrow, deep work** (`revisePlan`, the HMAC, the trigger logic).

## The preamble — put this at the top of every brief

```
Repo: between-tutor-agent. Read .planning/BUILD.md and .planning/CONTRACTS.md first.

Product: a tutor sends one line after a lesson; an agent works the student through
the six days between lessons in plain Telegram chat, then builds the tutor a
briefing panel whose shape comes from what the week actually produced.

Three rules you must not break:
1. The student NEVER gets a panel or a webview. Plain chat; <=8 choices -> inline
   keyboard in the conversation.
2. The model COMPOSES from a closed catalogue of 7 typed components. It does not
   write JSX, and nothing it emits is executed. An unknown component must FAIL
   VALIDATION, not render blank.
3. Do not create or edit files outside the list I give you. Two people are writing
   in parallel.

Run `npm run typecheck` before you claim anything works.
```

---

## T-A7 · The seven components 🤖 — the best delegation in the build

> **Files you may create or edit — nothing else:** `apps/web/src/components/between/*.tsx`
>
> Build seven presentational React components taking exactly these props and
> nothing else:
>
> ```ts
> [paste the BriefComponent union from CONTRACTS.md here]
> ```
>
> **The hard requirement: they must look genuinely unrelated to each other.** A
> quiet week and a pronunciation week rendering as two variations of the same card
> destroys the central claim of the product. Specifically:
>
> - `QuietCard` — mostly white space, one human question, **no data, no zeroes, no empty chart.** The emptiness is the point.
> - `ErrorGrid` — dense, tabular, red. The student's literal wrong answers beside what was wanted, grouped by rule.
> - `Breakthrough` — one sentence, large, alone on the card. Nothing else on it.
> - `PraiseLine` — a single warm line, small.
> - `Streak` — six day cells, filled or not.
> - `PlanLane` — six day cells in a row, each showing kind and prompt. If `prior_version` is set, show the version bump and the one-sentence reason.
> - `AudioCompare` — the student's audio element beside the reference text.
>
> No design system, no component library, no Tailwind config changes. Plain CSS
> modules or inline styles. Dark text on white — this is opened on a phone, in a
> classroom, five minutes before a lesson.
>
> **Done when:** `npm run typecheck` passes, and a page rendering
> `[QuietCard, PlanLane]` looks nothing like one rendering
> `[ErrorGrid, Breakthrough, PraiseLine, PlanLane]`.

## T-B2 / T-B6 · Prompt work for `planWeek` and `composeBrief` 🤖

> **Files:** `packages/agent-core/src/plan.ts` **or** `compose.ts` — one only, never both.
>
> [paste Contract 1 or Contract 2 here]
>
> Use structured outputs against that exact schema. The schema is also the
> renderer's type, so an unknown component must fail validation rather than render
> blank.
>
> For `composeBrief`, the objection to defend against is *"a rules engine would
> produce the same tree."* Layout is partly rules-shaped — concede that. Put the
> prompt effort into **contents**: which two error tags belong together and why,
> which single sentence out of six days is worth praising.
>
> **Done when:** the two fixture weeks in `.planning/FIXTURES.md` produce briefs with
> **different component sets in a different order**, twice in a row.

## T-A1 · Anything inside `apps/channel/` 🤖 — dispatch with care

> **Read `.agents/skills/build-channels-agent/SKILL.md` in full before writing a
> line.** This API is recent and not reliably in model memory. Do not guess it from
> what a Slack or Discord SDK usually looks like.
>
> - `createChannel`, `defineChannelTool`, `ChannelToolContext`. **`createBot` and `defineBotTool` exist nowhere** in the shipped packages and fail to compile.
> - Files containing JSX must be `.tsx`, and tsconfig sets `jsxImportSource: "@copilotkit/channels"`. This is not React.
> - `maxSteps` defaults to **1**. Any agent with tools needs more, or it calls one tool and stops before seeing the result.
> - Handlers return `void`. `thread.post()` returns a `MessageRef`, so a concise arrow body fails under strict — use a block body and `await`.
> - Never invent a component or prop. The vocabulary is fixed in `references/ui-components.md`.
> - Do not add `identifyUser` to `CopilotRuntime` — it belongs on `createChannel`.
>
> **Done when:** `npm run typecheck` passes and the bot replies in a real Telegram chat.

## Also worth delegating, once the build is safe

- **The README** — quickstart from a clean clone, the credentials required, and the
  two separate processes. A judging criterion checks exactly this.
- **The seeded quiet week** ([FIXTURES.md](FIXTURES.md) Week B) as `scripts/seed-quiet.ts`.
- **`SUBMISSION.md`** — inherited vs built-today. That is an eligibility checkbox,
  not a nicety.

## Do not delegate

`revisePlan` · the `initData` HMAC · the evidence triggers · the demo script.

These are short, load-bearing, and exactly where a confident wrong answer costs the
most time to detect.
