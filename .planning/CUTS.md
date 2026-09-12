# The cut list — in order, with trigger times

← [BUILD.md](BUILD.md)

**You will be behind. That is planned for.** What is not survivable is deciding
*what* to drop at 14:50 while a tunnel is down. Decide now; execute without
discussion.

Read a row as: *if it isn't working by this time, stop and drop it.*

| # | Time | Cut | What it costs | What survives |
|---|---|---|---|---|
| 1 | **14:00** | **Voice notes + transcription** | `AudioCompare`. Vocabulary drops to six — *update `BRIEF_SCHEMA` too, or the model will emit a component nothing renders.* | Everything. This was always cut #1. |
| 2 | **14:35** | **`PlanLane`'s drag** | The tactile beat. Replace with a typed line back to the bot. | The loop still closes — less impressively, but honestly. |
| 3 | **14:45** | **The seeded quiet week** | ⚠️ **Think hard.** Without the second panel the video *asserts* the UI is generated instead of *showing* it. | One panel and a weaker claim. Cut this only to save the demo itself. |
| 4 | **14:50** | **`initData` HMAC** → `?student_id=` in dev | Real auth. Say "auth is stubbed for the demo" in the writeup. | The panel. |
| 5 | **14:55** | **The Mini App entirely** | Generative UI. Ship the briefing as a formatted Telegram message and **say nothing about generative UI at all.** | A working product with a smaller claim — which beats a broken panel. |

## Never cut

**`revisePlan`.** It is the only thing separating this from a scheduled-message
product. If it goes, the honest writeup calls this a practice scheduler, not an
agent — and the heaviest judging criterion is about exactly that distinction.

If you are so far behind that `revisePlan` is the thing on the block: cut the
panel (row 5) and keep the revision. A text-only agent that genuinely changes its
plan scores above a beautiful panel driven by a scheduler.

## The rule about finishing things

When a block ends, the task ends. Do not finish it beautifully and lose the next
one. A half-built component that renders is worth more at 15:05 than a perfect one
that isn't wired up.

## Scope you should not add, however tempting

- **Classes / multiple students per tutor.** It genuinely makes the idea better and
  makes generative UI *more* load-bearing — nineteen students produce a *decision*,
  not a briefing. It is also eighteen synthetic weeks of fixtures. **Not today.**
  Put it in the writeup as the next step; that is where it earns you something.
- **Slack.** No webview surface exists, so it costs CopilotKit entirely.
- **A chat sidebar in the panel.** A chat sidebar inside a chat app is absurd. Its
  absence is a deliberate choice — [say it out loud](SHIP.md) rather than letting a
  judge assume it broke.
