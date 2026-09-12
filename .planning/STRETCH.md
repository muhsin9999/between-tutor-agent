# Stretch plan · 14:30–15:05 · 35 minutes

← [BUILD.md](BUILD.md) · cut order: [CUTS.md](CUTS.md) · filming: [SHIP.md](SHIP.md)

**Build stops at 15:05. Not 15:10.** Video, writeup and the social post need the
45 minutes after it, and a submission that misses 16:00 scores zero however good
the code is.

The demo already works end to end and is merged to `main`. **Everything below is
additive.** If any of it is not working at 15:05, drop it — `git switch main`
and film what you have. Nothing here is worth trading the working demo for.

---

## The one real hole: one tutor, one student

`STUDENT_ID = "jonas"` is hardcoded in twelve places in `apps/channel`. The store
already holds `students: Record<string, Student>` and `studentByChat()`, so the
**data model supports many; the channel does not.** A second student enrolling
today would overwrite Jonas's `chat_id` and start answering his questions.

A judge asks this in one question — *"what about her other nineteen clients?"* —
and it is the cheapest thing on the list to close.

---

## A · Mcjethro — multi-student · 20 min

**Files:** `apps/channel/src/turns.tsx`, `channel.tsx`

1. **Resolve the student from the chat, not a constant.**
   `store.studentByChat(chatId)` already exists. Replace every `STUDENT_ID` with
   the resolved id; there are twelve. Keep the per-student queue and the
   `outstanding` map keyed by that id — they already are, so they start working
   correctly for free.

2. **Enrolment creates a student.** `/start <token>` mints
   `student_id = "s" + chatId`, asks for a first name, and writes the row. The
   tutor's link becomes `t.me/<bot>?start=<her chat id>`, so a student is bound
   to the tutor who invited him.

3. **The tutor's line names who.** She already writes *"Jonas — German past
   tense…"*. Match the leading name against enrolled students, case-insensitive,
   first name only. No match → reply with the names she has, and do not plan.

**Done when:** two different Telegram accounts each hold their own week, and the
tutor's line goes to whichever one she named.

**If it fights you past 14:55, stop.** One student demonstrated beats two broken.

---

## B · Muhsin — the tutor's dashboard · 25 min

**Files:** `apps/web/src/app/tutor/**` — new route, no overlap with A.

The panel answers *"how did Jonas's week go"*. The dashboard answers the question
a tutor with twenty clients actually has on a Sunday night: **who needs me?**

- A list of enrolled students: name, day N of 6, answered/missed, whether a
  revision fired this week.
- Sorted by **who needs attention**, not alphabetically. Quiet students first,
  then repeat-error students, then everyone on track.
- Each row links to that student's panel: `/panel?student_id=<id>`.
- Build it against `store.read().students` + `store.attemptsFor()` +
  `store.latestPlan()`. **No model call** — this is a list, and a model here adds
  three seconds and nothing else.

Works with one student today and gets better with twenty. Reuse the palette in
`assets/brand/README.md` so it reads as the same product as the panel.

**Done when:** `/tutor` lists every enrolled student with a real status, ordered
by need, each linking to their panel.

---

## If both land before 15:00 · visual explanation in chat

**~15 min, A's lane.** The Telegram renderer supports `message` `section`
`markdown` `header` `fields` `context` `divider` `image` `table` `actions`
`select` `input` `code` `pre` — verified against the adapter. **`chart` is
skipped**, so charts are not an option.

On a wrong answer, post a two-row `<Table>`: what he wrote beside the correct
form, under the rule name. It stays **inside the conversation**, so it breaks no
rule — the constraint was never "no visuals", it was "no screen he has to open".

---

## Deliberately not attempted, and why

Put these in the writeup as next steps. They earn credit there and cost nothing.

| | Why not today |
|---|---|
| **Generated images** | 5–15s per image, needs public hosting, real per-image cost. The student leg's whole claim is that he answers in eight seconds on a bus; waiting on an image generation inverts it. A `<Table>` does the same explanatory job instantly and free. |
| **Voice notes + `AudioCompare`** | Transcription and `.oga` handling. It was cut #1 this morning for exactly this reason and nothing has changed. |
| **Drag to reorder next week** | A `sendData()` round trip plus a write-back path. ~30 min, and the loop already closes without it. |
| **Tutor-set pacing** | A contract change: `PlanDay`, `Attempt`, `dueStep`, `detectEvidence` and `composeBrief` all move. Changing the frozen contract with 35 minutes left is how a working demo stops working. |
| **Classes** | Eighteen synthetic weeks of fixtures before anything renders. It makes the idea better and it is the strongest thing to put in "what's next". |
| **Hosting it off the laptop** | The Channels runtime needs a long-running process, so it is a three-piece migration (Vercel + a container host + a hosted store), not a deploy button. Planned in [HOSTING.md](HOSTING.md); 45–60 minutes, and none of them are the 35 we have. |

---

## 15:05 · stop

Whatever state this is in:

1. `npm run verify`
2. Merge what works, abandon what doesn't
3. Update the ledger in `docs/overview.html` so it stays honest
4. → [SHIP.md](SHIP.md)
