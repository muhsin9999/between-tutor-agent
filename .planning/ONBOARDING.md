# Onboarding — how a tutor and a student actually start

← [BUILD.md](BUILD.md) · [DASHBOARD.md](DASHBOARD.md) · [AUTH.md](AUTH.md) · [SURFACES.md](SURFACES.md)

**Not today.** This needs the database and Better Auth first. It is specced now
because onboarding decides the schema, and getting it wrong costs a migration.

---

## The principle

> **The tutor signs up. The student never does.**

She has an account, an email, a password-less session, and a bill. He taps a link
and answers a question. Any design that asks the student to register has broken
the product — a practice app is the exact thing he will not open, which is *why*
the six days are empty.

The trick that makes this work: **the tutor already knows his name.** She types
it when she invites him. The student's "sign-up" is therefore a tap, because
everything the system needs to know about him, she supplied.

---

## 1 · The tutor · web first, then Telegram

One canonical direction. Not two, because two produces orphan accounts that have
to be merged, and merging identities is where the data leaks live.

```
1  between.app            →  "Start with one student"
2  Sign up                →  magic link to her email (AUTH.md)
3  Click the link         →  session, account exists
4  "Connect Telegram"     →  t.me/<bot>?start=tutor_<signed token>
5  She taps it            →  bot verifies the token, writes
                             user.telegram_user_id, replies in her chat
6  "Add your first student" → name, under-18?, invite link
7  Her first lesson ends  →  she sends one line in Telegram
```

**Step 4 is the whole join.** The token is signed, short-lived, single-use, and
bound to her `user.id`. The bot verifies it before writing anything — otherwise
anyone who guessed a token could attach their Telegram account to her tutor
record and read her students.

**Step 5 matters on camera.** She taps a button on a laptop and her phone lights
up with a message from a bot that already knows her name. That is the moment the
product stops feeling like two things.

If she never connects Telegram she can still use the dashboard — but she cannot
send the one line, which is the product. So step 4 is a blocking step in the
onboarding checklist, not a settings page afterthought.

## 2 · The student · a tap, not a sign-up

```
1  Tutor adds a student   →  name + "under 18?" in the dashboard
2  She gets a link        →  t.me/<bot>?start=inv_<token>
3  She sends it to him    →  however she already talks to him
4  He taps it             →  "Hi Jonas — Amara set this up. About ten
                              minutes a day, right here. Ready?"
5  He taps "Ready"        →  enrolled. That is the entire sign-up.
```

He is never asked his name, because **she already told us**. He is never asked
for an email, a password, or an app. The token carries `student_id`, so tapping
it is what binds his Telegram chat to the record she created.

### The rules on that token

- **Single use.** Tapped once, dead. A forwarded link cannot enrol a stranger.
- **Short-lived** — 7 days is generous; she can reissue.
- **Bound to one student row**, so it is an invitation, not a registration.
- **Revocable** from the dashboard, which also unbinds the chat.

### If he messages the bot with no link

> "Ask your tutor for your link — I only work with students a tutor has invited."

**No self-signup, deliberately.** A closed system is the correct shape for a
product that talks to minors: there is no route by which a stranger reaches a
student, and no route by which a stranger becomes one.

### What the dashboard shows her

Each student is `invited` → `joined` → `practising`. A student stuck on
`invited` for three days is a real thing she needs to see and chase, and it is
invisible in Telegram.

## 3 · The parent · the gate that is currently only a claim

The README says the product does not message under-18s except through a parent's
account. **Nothing enforces it** — see [SURFACES.md](SURFACES.md). Onboarding is
where that gets fixed, because it is the only place consent can be asked before
the first question.

```
Tutor marks the student under 18
   → the invite link goes to the PARENT, not the child
   → parent taps, sees who the tutor is and what will happen
   → parent accepts
   → THEN the parent gets the student's link to pass on
   → practice begins
```

No consent, no questions. Not "consent pending" with practice running — the
sequence is the safeguard, and a race here is not a bug, it is a breach.

The parent then keeps one thread: a weekly line saying he practised four days.
Not his answers, not his errors. Reading his mistakes is the tutor's job, and
putting them in front of a parent would break the trust the whole product runs
on.

---

## What this decides in the schema

Beyond [DASHBOARD.md](DASHBOARD.md):

```sql
ALTER TABLE student
  ADD COLUMN status TEXT NOT NULL DEFAULT 'invited',   -- invited|joined|practising|paused
  ADD COLUMN is_minor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN parent_chat_id BIGINT,
  ADD COLUMN consent_at TIMESTAMPTZ;

CREATE TABLE invite (
  token       TEXT PRIMARY KEY,          -- signed, single-use
  kind        TEXT NOT NULL,             -- 'tutor' | 'student' | 'parent'
  subject_id  TEXT NOT NULL,             -- user.id or student.id
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
```

`consent_at IS NULL AND is_minor` is the condition the channel checks before
asking anything. Put it in one guard, not in each handler.

## What exists today

`/start <token>` is already the enrolment hook in `apps/channel/src/channel.tsx`
— the token is currently ignored and every student becomes `jonas`. The shape is
right; it needs the invite table behind it and multi-student in front of it
([STRETCH.md](STRETCH.md) B).

## Order

1. Multi-student in the channel — nothing below works without it
2. The `invite` table and single-use token verification
3. Tutor: web sign-up → Telegram link (steps 4–5 above)
4. Student: invite → tap → enrolled, with `status` visible in the dashboard
5. **The parent gate.** Before a single real minor uses this.
