# Lane B — the engine · planning, revision, composition

← [BUILD.md](BUILD.md) · contracts: [CONTRACTS.md](CONTRACTS.md) · script: [FIXTURES.md](FIXTURES.md) · delegating: [AGENT-PROMPTS.md](AGENT-PROMPTS.md)

**You own:** everything under `packages/agent-core/src/` and
`apps/web/src/app/api/tick/**`.
**You never touch** `apps/channel/**` or anything under `apps/web/src/components/between/`.
Need something there? Write it in [STATUS.md](STATUS.md) and say it out loud.

Your lane carries the thing that makes this an agent rather than a scheduler.
Everything else can be cut. **`revisePlan` cannot** — see [CUTS.md](CUTS.md).

---

## Block 1 · 13:10–13:50 — the week exists and time passes

### T-B1 · `store.ts` — 8 min

Exactly the `Store` shape in [CONTRACTS.md](CONTRACTS.md). Synchronous whole-file
read/write to `.data/between.json`, append-only for `plans` and `attempts`, plus
`reset()`. Do not build a database; you are building the thing that lets you get a
clean take at 14:50.

**Done when:** two node processes can both read and write it without stomping.

### T-B2 · `planWeek()` under structured outputs — 17 min

In `plan.ts`, calling through `llm.ts` (see T-B0 below). Input: the tutor's one
line. Output: a `Plan` at version 1, validated against `PLAN_SCHEMA`.

The tutor's line is deliberately thin — *"Jonas — past tense of irregular verbs,
ten minutes a day, he's nervous about speaking out loud."* Six days must come out
of that, and **the nervousness has to show up in the plan** as later `produce`
days rather than an oral drill on day 1. That is the moment a judge notices the
model read the human bit of the sentence, so make the prompt ask for it.

Constraints to put in the system prompt, not to hope for:
- exactly six days, one per day, ten minutes each
- **introduces no new material** — only what the tutor named
- `target_items` is a closed set, reused across days
- `expects` is graded by exact string comparison first, so it must be terse and unambiguous

**Done when:** the fixture line in [FIXTURES.md](FIXTURES.md) produces six sane days
twice in a row.

### T-B0 · `llm.ts` — do this first, 5 min

One file behind `LLM_PROVIDER`, four exported functions: `planWeek`, `nextStep`,
`revisePlan`, `composeBrief`. The starter already routes `MODEL_PROVIDER` between
OpenAI and OpenRouter — you are wrapping that, not rebuilding it. This is what
makes the [Gate 0](GATE-0.md) B1 fallback a one-line `.env` change instead of a rewrite.

### T-B3 · The clock — 10 min · **build it now, not at 15:00**

`apps/web/src/app/api/tick/route.ts`, `GET /api/tick?now=`, plus `DEMO_SPEED=day:40s`.
Six days compress into four minutes.

> Every beat of this demo depends on time passing. A clock added at the end is
> always what breaks on the third take. Vercel Hobby cron is daily-granularity, so
> the schedule could never have lived there anyway.

`/api/tick` advances the demo clock, works out which steps are now due, and hands
A the due step. Also expose `POST /api/tick/reset` — you will use it a lot between takes.

**Done when:** one command runs a whole week in four minutes and the due step
changes as it goes.

---

## Block 2 · 13:50–14:20 — the part that makes it an agent

### T-B4 · `evidence.ts` — deterministic triggers — 12 min

Triggers are computed **from attempt rows, in code, not by a model.** That is what
makes the revision defensible when a judge asks whether the model just felt like it.

```ts
// three consecutive correct on a target   -> that item is done, stop drilling it
// the same error_tag twice                -> he has a rule problem, not a memory problem
// no attempt for two due steps            -> he has gone quiet
```

`error_tag` comes from a **closed list you define here**. Free-text tags make
`ErrorGrid` unusable and make the trigger unfireable.

**Grading order matters:** exact normalised comparison runs **first** (trim,
lowercase, strip punctuation and articles), model only on a miss. A grader marking
a correct answer wrong on camera is one of the two failure modes that ruins takes.

**Done when:** feeding the scripted wrong answers from [FIXTURES.md](FIXTURES.md)
fires the "same tag twice" trigger, reliably, every time.

### T-B5 · `revisePlan()` — 18 min · **the one thing you never cut**

A trigger calls it. It rewrites **only the remaining days**, stores version+1 with
a **one-sentence reason**, and never overwrites the earlier version.

Enforce in code, not in the prompt:
- may not extend the week past day 6
- may not add material outside the original `target_items`
- must produce a reason short enough to render in `PlanLane`

**Done when:** v1 and v2 sit side by side in `.data/between.json`, with a reason on
v2 that reads like a teacher wrote it. That pair of rows is the single most
important artifact in the demo — it is what you point the camera at.

---

## Block 3 · 14:20–14:45 — the panel's brain

### T-B6 · `composeBrief()` — 25 min

`compose.ts`. Input: the week's attempt rows, the plan versions, the student. Output:
a `Brief` validated against `BRIEF_SCHEMA` — which **is** the component union from
[CONTRACTS.md](CONTRACTS.md), so an unknown component fails validation rather than
rendering blank.

The framing to protect, because it is what you will be asked about:

> **Composition from a closed catalogue, not code generation.** The model chooses
> which of seven typed components appear, in what order, holding what contents.
> Nothing it produces is executed. **Never claim the model writes JSX** — it
> doesn't, and someone will read the repo.

Expect this objection, and concede the true half of it:

> *"Seven components is a small space. A rules engine would produce the same tree."*

Partly true for the obvious weeks. What a rules engine would not produce is the
**contents**: which two error tags belong together and why, which single sentence
out of six days is worth praising. So put your prompt effort into contents, and
tell A to **lead the panel shot with contents, not layout.**

Hard rules in the prompt *and* in code:
- 2–5 components, never all seven
- `PlanLane` always last, always present
- `QuietCard` carries no data because there isn't any — do not let the model pad it

**Done when:** the two fixture weeks in [FIXTURES.md](FIXTURES.md) produce two briefs
with **different component sets in a different order**. One week proves nothing —
*the cut between the two is the entire argument for generative UI.*

---

## Integration · 14:45–15:05 — with A

- `GET /api/brief?student_id=` serves the validated `Brief`
- Seed the quiet-week fixture so both panels can be opened back to back on camera
- Run the compressed week twice; **second pass recorded as the backup take**

Then → [SHIP.md](SHIP.md).
