# Two-minute video — shot by shot

Read this once, do a dry run, then record. **Aim for 1:50**, not 2:00.

---

## Before you press record

**Two devices, two people.**

| | |
|---|---|
| **Screen** | Laptop, Telegram **Desktop** — you are the tutor |
| **Phone** | Muhsin's Telegram — he is Jonas |
| **Browser tab, pre-opened** | `https://between-panel.vercel.app/tutor` |

**Reset the week** so the demo runs clean: send `/reset` to the bot.

**Check first, 30 seconds:**
- [ ] Bot replies at all (send `hi` from the phone)
- [ ] The menu button says **Lesson brief** and opens the Vercel panel
- [ ] Laptop volume off — no notification sounds on the recording

**Have these typed and ready to paste.** Do not type them live:

```
Jonas — German past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud.
```
```
ging
```
```
sehte
```
```
nehmte
```

---

## The script

> Timings are cumulative. Words in **bold** are the ones that carry the point — do not improvise these.

### 0:00 – 0:15 · The problem

**Show:** your face, or just the Telegram chat sitting empty.

> "A private tutor sees a student for fifty-five minutes a week.
> Then **six days of nothing** — and the next lesson opens with *'so, how did it go?'*
> Between lives in those six days."

---

### 0:15 – 0:30 · One line

**Show:** paste the tutor's line into Telegram. Send it. **Put the laptop down.**

> "She sends **one line** at the end of a lesson.
> That's the only thing she types all week."

**Expect:** ~5 seconds, then *"Got it — six days planned, starting today."*

> "Six days, planned. And it read the human half of that sentence — he's nervous about speaking, so the speaking task lands on **day five**, not day one."

---

### 0:30 – 0:50 · The student, where he already is

**Show:** switch to the **phone**. Muhsin sends `hi`, gets **Day 1**.

> "Her student installs **nothing**. No app, no account, no password.
> He answers in the chat app already on his phone — on a bus, in eight seconds."

**He sends:** `ging` → correct, warm reply.

> "That's the whole product for him. Plain chat, forever.
> He never gets a screen — because a practice app is **exactly the thing he won't open**. That's *why* those six days were empty."

---

### 0:50 – 1:15 · ⭐ The agent changes its own mind

> This is the most important twenty-five seconds. Do not rush it.

**He sends:** `sehte` → wrong.
**Wait for Day 2, then he sends:** `nehmte` → wrong again.

**Show:** the bot's reply arriving.

> "Twice on the same rule. That's a trigger **computed in code from his answers** — not a model deciding it felt like it."

**Show:** *"I've changed the rest of your week — this keeps tripping you up."* and the reason underneath.

> "So it **rewrote the rest of his week**, and told him why.
> It can't extend the week, and it can't add anything the tutor didn't set — both enforced in code."

**Show:** the next question arriving — day 5 is now an **explanation**, not a drill.

> "And there it is. Day five was a drill. Now it's an explanation."

---

### 1:15 – 1:40 · The panel nobody drew

**Show:** on the laptop, tap **Lesson brief** in the bot.

> "Five minutes before the next lesson, she taps one button."

**Show:** the panel. **Point at the contents, not the layout.**

> "Those are **his actual wrong answers** — sehte, nehmte — next to what he should have written.
> And the plan: **v1 to v2**, with the reason."

**Show:** switch to the browser tab already on `/tutor`.

> "A model picked which of seven components appear and what goes in them.
> A **quiet** week renders nothing like this — no grid, no streak. It carries no data, because there isn't any.
> **Nobody drew either of these screens.**"

---

### 1:40 – 1:55 · Close

> "The clock is compressed — **six days in four minutes**.
> It's hosted: the bot on Render, the panel on Vercel, the data in Neon.
> And it **stops rather than escalating** when a student goes quiet.
>
> Built today with **CopilotKit** and **OpenAI**. That's Between."

---

## Say these, or a judge assumes it broke

- **"The clock is compressed — six days in four minutes."** Don't let them work it out.
- **"Nobody drew this screen."** The whole generative-UI claim, in four words.
- **"The trigger is computed in code, not by a model."** This is what makes it an agent.
- **"He installed nothing."** The theme criterion, in three words.

## Never say

- ❌ "The AI generates the UI code" — it **doesn't**. It picks from seven typed components and nothing it emits is executed. Someone will read the repo.
- ❌ "It works with any subject" *without* adding "the error categories come from the tutor's own sentence."
- ❌ Anything about the dashboard sign-in being finished — it's real but new.

---

## If it goes wrong mid-take

| | |
|---|---|
| Bot silent | Render may have slept. Send anything, wait 40s, it wakes |
| Wrong answer graded right | Use `sehte` / `nehmte` exactly — those tag reliably |
| Revision doesn't fire | Both misses must be on **different days**. Wait for the next question before the second wrong answer |
| Panel empty | It reads Neon, not your laptop. Check `/tutor` in the browser first |
| You fumble a line | **Keep rolling.** Cut in the edit — retakes cost more than a stumble |

## Recording

- **OBS** or **Windows Game Bar** (`Win+G`) for the laptop
- Phone: screen-record natively, then drop it in as an inset — **don't film the phone with another phone**
- If you only get one pass, record the laptop and have Muhsin narrate his own screen aloud

## The one shot that matters

If everything else fails, get **0:50–1:15** — the two wrong answers, the plan rewriting itself, and the reason. That single beat is the difference between an agent and a scheduled-message bot, and it is the thing most submissions today will not have.
