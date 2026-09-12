# Status board — both of you edit this

← [BUILD.md](BUILD.md)

**Update at the end of every block, and any time you get blocked.** Thirty seconds
here saves the ten minutes of "wait, what are you working on" that you cannot
afford at 14:30.

Rule: if a change is needed in the other lane's files, **write it under Asks** and
say it out loud. Never reach across.

---

## Now

> **`npm install` had never been run** — done at 13:05, lockfile committed. Pull before you start.
> `.env` created from the example; Muhsin's `TELEGRAM_BOT_TOKEN` slot is in there waiting.

| | |
|---|---|
| Block | **Gate 0** |
| Clock | 12:50 → 13:10 |
| A · Muhsin is on | A1 Telegram adapter spike |
| B · Mcjethro is on | B1 prove the key (needs the key pasted into .env) |
| Next gate | 13:10 — all five [Gate 0 exit criteria](GATE-0.md#gate-0-exit-criteria) said out loud |

## Gate 0

| Check | Owner | State | Note |
|---|---|---|---|
| A1 transport decided — (a) (b) or (c) | A | ⬜ | |
| A2 bot + Mini App URL registered | A | ⬜ | |
| A3 Telegram Desktop logged in | A | ⬜ | |
| B1 real completion came back | B | ⬜ | provider: |
| B2 `contracts.ts` typechecks both apps | B | ✅ | 7 tests pin the closed-catalogue + quiet-week rules |
| `.env` + `.data/` gitignored | either | ✅ | verified |

## Tasks

| # | Task | Owner | State |
|---|---|---|---|
| T-A1 | Strip Slack, Telegram channel up | A | ⬜ |
| T-A2 | Two roles on one bot, enrolment link | A | ⬜ |
| T-A3 | Dedupe + ≤8-choice keyboard rule | A | ⬜ |
| T-A4 | Tutor intake line → `planWeek` | A | ⬜ |
| T-A5 | Student turn loop | A | ⬜ |
| T-A6 | Mini App shell + `initData` | A | ⬜ |
| T-A7 | The seven components 🤖 | agent | ⬜ |
| T-B0 | `llm.ts` behind `LLM_PROVIDER` | B | 🟨 next |
| T-B1 | `store.ts` | B | ⬜ |
| T-B2 | `planWeek()` | B | ⬜ |
| T-B3 | The clock — `/api/tick` + `DEMO_SPEED` | B | ⬜ |
| T-B4 | `evidence.ts` triggers + grading order | B | ⬜ |
| T-B5 | **`revisePlan()`** — never cut | B | ⬜ |
| T-B6 | `composeBrief()` | B | ⬜ |
| INT | Panel on real data, week run twice | both | ⬜ |
| REC | **Backup take recorded** | both | ⬜ |

⬜ not started · 🟨 in progress · ✅ done · ✂️ cut · 🔴 blocked

## Agents running

| Agent | Task | Files it may touch | Dispatched | Back |
|---|---|---|---|---|
| | | | | |

## Asks — changes needed in the other lane

| From | To | What | Done |
|---|---|---|---|
| | | | |

## Cuts taken

Log each one with the time, so the writeup is honest and you don't re-litigate it.
See [CUTS.md](CUTS.md) for the order and the trigger times.

| Time | Cut | Why |
|---|---|---|
| | | |

## Decisions made mid-build

Anything that contradicts a planning file goes here, so the other person and every
agent can see it. A contract change needs **both** of you, out loud.

| Time | Decision |
|---|---|
| | |
