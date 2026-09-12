# Fixtures and the demo script — word for word

← [BUILD.md](BUILD.md) · used by [LANE-A](LANE-A.md) · [LANE-B](LANE-B.md) · [SHIP](SHIP.md)

**Write these before you write prompts.** Improvising a demo at 14:50 is how the
revision beat fails to fire on camera and you find out with nine minutes left.

German irregular past tense is the subject **because right and wrong are
unambiguous on camera.** A judge who speaks no German can still see the grid.

Everything here is **synthetic.** Never commit real personal data to a public repo.

---

## The tutor's opening line — type it exactly

> **Jonas — past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud.**

One line. That is the only thing she types all week, and it is the pitch.

Watch for: the plan should put `produce` days **later in the week**, because of the
second sentence. If day 1 is an oral drill, the prompt in `plan.ts` isn't reading
the human half of the sentence — fix the prompt, not the fixture.

**Target items (the closed set):** `gehen · sehen · nehmen · sprechen · trinken · fahren`

## The scripted student answers

Typed by whoever holds the handset. The wrong answers are wrong **on purpose and
in a pattern** — same `error_tag` twice is what fires the revision.

| Day | Prompt | Type this | Result |
|---|---|---|---|
| 1 | past tense of *gehen* | `ging` | ✅ correct |
| 1 | past tense of *sehen* | `sehte` | ❌ `strong-verb-vowel` |
| 2 | past tense of *nehmen* | `nehmte` | ❌ `strong-verb-vowel` ← **trigger fires here** |
| 2 | past tense of *trinken* | `trank` | ✅ correct |
| 3 | *(revised plan — explain, not drill)* | `it changes in the middle` | ✅ the breakthrough line |
| 4 | past tense of *sprechen* | `sprach` | ✅ correct |
| 5 | past tense of *fahren* | `fuhr` | ✅ correct |

Day 3 is the payoff: **the plan changed because of days 1–2**, and the student says
something in his own words. `Breakthrough` renders that sentence alone.

> Two `strong-verb-vowel` misses in a row must fire `revisePlan`. Rehearse this
> once at 14:45. If it doesn't fire reliably it is a bug in `evidence.ts`, not bad
> luck — see [LANE-B T-B4](LANE-B.md).

## The two weeks — you need both

**The cut between them is the entire argument for generative UI. One week proves
nothing.** Seed the second so both panels open back to back on camera.

### Week A — "the error week" · run live on the handset

Produces: `ErrorGrid` (two rows, same rule) → `Breakthrough` (day 3) → `PraiseLine` → `PlanLane` (v2 beside v1)

### Week B — "the quiet week" · seeded fixture, student `mara`

Mara answers on day 1, then nothing. Two due steps pass. The agent nudges **once**
and then stops.

Produces: `QuietCard` (last seen day 1, one human question, **no data because there
isn't any**) → `PlanLane` (v1, unchanged — nothing to revise for someone who isn't there)

Two components, not four. A different order. No grid, no praise line.
*That* is the shot.

> Seed Mara with `npm run seed:quiet`. If you cut the seeded week you lose the
> back-to-back comparison and the video **asserts** the UI is generated instead of
> **showing** it. Think hard before cutting it — see [CUTS.md](CUTS.md).

## Reset between takes

```bash
curl -X POST localhost:3100/api/tick/reset   # clock + attempts, keeps enrolment
rm -f .data/between.json                      # full reset, re-enrol both accounts
npm run seed:quiet                            # re-seed Mara
```

Rehearse the reset **before** you need it. Fumbling this between takes is where
the last fifteen minutes go.

## The two failure modes that ruin takes

1. **A duplicate message from a re-delivered Telegram update.** Dedupe on update id — [LANE-A T-A3](LANE-A.md).
2. **The grader marking a correct answer wrong.** Exact normalised comparison runs first, model only on a miss — [LANE-B T-B4](LANE-B.md).

Both are already assigned. Neither is acceptable to discover live.
