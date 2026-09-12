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
> `.env` created from the example; the `TELEGRAM_BOT_TOKEN` slot is in there waiting.

| | |
|---|---|
| Block | **Gate 0** |
| Clock | 12:50 → 13:10 |
| A · Mcjethro is on | A1 Telegram adapter spike |
| B · Muhsin is on | B1 prove the key (needs the key pasted into .env) |
| Next gate | 13:10 — all five [Gate 0 exit criteria](GATE-0.md#gate-0-exit-criteria) said out loud |

## Gate 0

| Check | Owner | State | Note |
|---|---|---|---|
| A1 transport decided — (a) (b) or (c) | A | ✅ | **(a)** `telegram({ token })` direct, long-polling by default. No tunnel for the bot. |
| A2 bot + Mini App URL registered | A | ✅ | @between_tutor_bot · id 8608535988 · getMe verified |
| A3 Telegram Desktop logged in | A | ⬜ | |
| B1 real completion came back | B | ✅ | openai · gpt-4.1-mini · ~5s |
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
| T-B0 | `llm.ts` on the AI SDK (`generateObject`) | B | ✅ |
| T-B1 | `store.ts` | B | ✅ | 
| T-B2 | `planWeek()` | B | ✅ | runs live, 6 sane German days, produce lands day 5 |
| T-B3 | The clock — `/api/tick` + `DEMO_SPEED` | B | ⬜ |
| T-B4 | `evidence.ts` triggers + grading order | B | ⬜ |
| T-B5 | **`revisePlan()`** — never cut | B | 🟨 written + legality-checked, not called live |
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
| B | A | `apps/channel/package.json` test script quotes its glob in **single** quotes — cmd doesn't strip them, so node matches nothing and reports success having run zero tests. Change to double quotes. I fixed the identical bug in agent-core; leaving yours alone per file ownership. | ⬜ |
| B | A | `agent-core/contracts` is live: `PlanDay`, `Plan`, `Attempt`, `ERROR_TAGS`, `BriefComponent`. `agent-core` also exports `store.*` — use `store.claimUpdate(update_id)` for dedupe (T-A3) and `store.dueStep(student_id)` for the student turn (T-A5). Don't write your own. | ⬜ |

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
| 12:58 | **Transport = path (a).** `@copilotkit/channels/telegram` exports `telegram(opts)` taking a bot token directly; `mode` defaults to `"polling"` (long-polling over grammY), so the bot needs **no public URL and no ngrok**. Webhook mode exists but is opt-in. The grammy fallback is dead — we ride Channels on both legs, so CopilotKit is load-bearing in the student chat too, not just the panel. |
| 12:58 | **The option is `token`, NOT `botToken`.** The Slack example in SKILL.md uses `botToken` — adapters differ. `TelegramAdapterOptions = { token, mode?, webhook?, greeting?, suggestedPrompts?, showToolStatus?, interruptEventNames? }`. |
| 12:58 | `TelegramInlineButton` is a first-class payload type, so Channels `<Button>` renders as a **native inline keyboard**. The ≤8-choice rule costs us nothing to honour. |
| 13:00 | **Tunnel up:** `https://deal-blake-miller-los.trycloudflare.com` -> :3100, verified 200. Mini App URL is that + `/panel`. UDP/QUIC is blocked on this network — cloudflared fell back to HTTP/2; if it flaps, restart with `--protocol http2`. The URL dies with the process, so if you restart the tunnel you must re-run `/newapp` with the new one. |
| 12:58 | A tunnel is still needed for the **Mini App panel** (apps/web on :3100) — just not for the bot. |
