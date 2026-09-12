# Flows — what happens where, and nowhere else

← [BUILD.md](BUILD.md) · [ONBOARDING.md](ONBOARDING.md) · [DASHBOARD.md](DASHBOARD.md) · [SURFACES.md](SURFACES.md)

There are now **three surfaces and four people**. This file is the single place
that says which feature lives where, so no two of them drift into doing the same
job badly.

---

## The three surfaces

| | `apps/channel` | `apps/web` `/panel` | `apps/dashboard` |
|---|---|---|---|
| **Is** | The bot | The Mini App | The web app |
| **Who** | Student, tutor, parent | Tutor | Tutor |
| **Opened from** | A chat | The bot's menu button | A bookmark |
| **Auth** | Telegram chat id | `initData` HMAC | Better Auth session |
| **Scope** | One message | One student, this week | Every student, every week |
| **Can it change data?** | Records answers | **No — read only** | **Yes** |
| **Lives** | Long-running process | Vercel | Vercel |

**The rule that keeps them apart:** the panel is *this student, this week,
read-only, on a phone, five minutes before a lesson.* The dashboard is
*everything, over time, editable, at a desk.* If a feature needs history or a
confirmation step, it is the dashboard's. If it must be glanceable in ten
seconds, it is the panel's.

---

## Flow 1 · Tutor signs up

**Surface: web → Telegram.** One direction only. See [ONBOARDING.md](ONBOARDING.md).

```
between.app  →  email  →  magic link  →  session exists
             →  "Connect Telegram"  →  t.me/<bot>?start=tutor_<signed token>
             →  she taps  →  bot verifies, writes user.telegram_user_id
             →  "Add your first student"
```

- The token is **signed, single-use, short-lived, bound to her `user.id`**.
- Connecting Telegram is a **blocking onboarding step**, not a settings
  afterthought — without it she cannot send the one line, which is the product.
- There is no Telegram-first signup. Two directions produce orphan accounts.

## Flow 2 · A student is invited

**Surface: dashboard → Telegram.** The student never signs up.

```
Dashboard: name + "under 18?"  →  t.me/<bot>?start=inv_<token>
She sends it however she already talks to him
He taps  →  "Hi Jonas — Amara set this up. Ready?"  →  enrolled
```

- His **name comes from her**, not from him. That is what removes the sign-up.
- Token: single-use, 7 days, bound to one student row, revocable.
- A cold message with no token → *"Ask your tutor for your link."* **No
  self-signup**, deliberately: no route by which a stranger reaches a student.
- Status the dashboard shows: `invited → joined → practising → paused`.

### 2a · If the student is under 18

The invite goes to the **parent first**. Parent accepts → parent receives the
student's link → practice begins. **No consent, no questions.** The sequence is
the safeguard; a race here is a breach, not a bug.

## Flow 3 · The tutor's one line

**Surface: the bot.** ~5 seconds.

```
"Jonas — German past tense of irregular verbs, ten minutes a day.
 He's nervous about speaking out loud."
     → match the leading name against her students
     → planWeek() → six days, structured output
     → store plan v1, start the clock
     → reply TWO LINES + the plan's reason
```

- The reply is **never the six days**. Printing the plan back at her undoes the
  entire "she types one line" pitch.
- No name match → reply with the names she has, and **do not plan**.

## Flow 4 · The student's day

**Surface: the bot.** Plain chat, forever. No panel, no webview, ever.

```
Bot asks ONE question  →  he answers
     → exact normalised comparison FIRST; the model only sees a miss
     → record an attempt (append-only)
     → warm one-line reply
     → next question only if the next day is due
```

Guards that took a live failure each to learn:
- **Only grade a reply to a question we actually asked.** Pinned to plan version
  *and* day, so a greeting is re-asked rather than scored.
- **One turn at a time, per student.** Channels runs turns in parallel by
  default; two fast messages would otherwise score against the same day.
- **Dedupe on message id.** Telegram re-delivers.

## Flow 5 · The plan revises itself

**Surface: the bot (visible), the panel and dashboard (evidenced).**

```
Deterministic trigger in evidence.ts — NOT a model's judgement:
   same error_tag twice · three correct in a row · two due steps missed
        → revisePlan() rewrites ONLY the remaining days
        → store as version + 1, never overwriting
        → tell the student in one quiet line, with the reason
```

Enforced in code, not asked for in a prompt: may not extend past day 6, may not
introduce material the tutor never set.

**This is the product's agency claim.** The one-sentence reason is the most
important text anywhere in the system — it appears in the chat, in `PlanLane`,
and at the top of the dashboard's student page.

## Flow 6 · Five minutes before the lesson

**Surface: the Mini App panel.** Read-only, one student.

```
She taps "Lesson brief"  →  initData HMAC verified server-side
     → composeBrief() picks 2–5 of seven typed components
     → validated against the same schema the renderer types off
     → rendered
```

- An unknown component **fails validation**; it never renders blank.
- `PlanLane` is always last. A quiet week is `QuietCard + PlanLane` and must not
  be padded with a grid or a zeroed streak.
- **No editing here.** Editing needs a confirmation step and a bigger screen.

## Flow 7 · Sunday night

**Surface: the web dashboard.** Everything, over time, editable.

```
/app          who needs me — sorted by need, never alphabetically
              quiet first (the only ones who won't come back on their own),
              then repeated-error, then ahead, then on track
/app/s/[id]   this week + history + the plan editor
/app/settings account, Telegram connection, pacing, danger zone
```

Dashboard-only, and deliberately absent from the panel: **history across weeks**,
**editing a plan**, **pausing a student**, **deleting their data**, **inviting a
student**, **export**.

---

## Ownership, so nothing is built twice

| Feature | Owner | Never in |
|---|---|---|
| Asking a question | bot | anywhere else |
| Grading an answer | `agent-core/evidence.ts` | the surfaces |
| Deciding to revise | `agent-core/evidence.ts` | a model |
| Composing the brief | `agent-core/compose.ts` | the panel |
| Rendering the brief | panel (7 components) | the bot |
| Roster / "who needs me" | dashboard | the panel |
| History | dashboard | the panel |
| Editing a plan | dashboard | bot, panel |
| Invites & consent | dashboard → bot | the panel |
| Deletion | dashboard | everywhere else |

**`agent-core` owns every rule.** The three surfaces read and render; none of
them re-implements a decision. A rule that exists in two places is a rule that
will disagree with itself.

---

## Status right now

Built and live: flows **3, 4, 5, 6**, end to end on real Telegram.
Specced, not built: flows **1, 2, 2a, 7** — they need the database
([HOSTING.md](HOSTING.md)) and Better Auth ([AUTH.md](AUTH.md)).
In progress on a branch: the dashboard shell for flow 7.
