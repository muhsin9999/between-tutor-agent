# Authentication — two doors, one identity

← [BUILD.md](BUILD.md) · depends on [HOSTING.md](HOSTING.md)

**Not today.** Better Auth needs a database, and the store is still a JSON file —
so this lands *after* the Neon migration in [HOSTING.md](HOSTING.md), not before.
Budget 60–90 minutes for the two together.

---

## What already exists, and is not a stub

The tutor's panel is authenticated **cryptographically**, today, in production
form: `apps/web/src/lib/telegram-initdata.ts`.

Telegram signs `initData` with a key derived from the bot token. We recompute the
HMAC, compare it in constant time, reject a stale `auth_date`, and read the user
id from the verified payload — never from `initDataUnsafe`. Five tests cover it,
including a tampered user id that `initDataUnsafe` would have waved through.

**Do not put a login screen in front of this.** She taps the menu button and she
is in, with her real Telegram identity proven. Adding a password to that flow
makes the product worse on precisely the axis it is being judged on — the whole
premise is that nobody installs, registers, or remembers anything.

## What is missing

**A tutor at a laptop, not inside Telegram.** She wants a browser tab she can
bookmark: the dashboard across all her students, on a real screen, on Monday
morning. There is no `initData` there, so there is nothing to verify.

That is the door Better Auth opens — and only that door.

---

## The architecture: two doors, one identity

```
Telegram Mini App  ──initData HMAC──┐
                                     ├──> one tutor record ──> her students
Browser dashboard  ──Better Auth────┘
```

The thing to get right is that **both doors must resolve to the same tutor**. A
tutor who onboarded through Telegram and later signs in on the web must see her
students, not an empty account. That is the only real design problem here; the
rest is wiring.

### Schema

Better Auth owns its own tables (`user`, `session`, `account`, `verification`)
through its Postgres adapter. We add one column and one table:

```sql
-- Better Auth's user table, extended
ALTER TABLE "user" ADD COLUMN telegram_user_id BIGINT UNIQUE;

-- our own
CREATE TABLE tutor_student (
  tutor_id  TEXT REFERENCES "user"(id),
  student_id TEXT,
  PRIMARY KEY (tutor_id, student_id)
);
```

`telegram_user_id` is the join between the two doors. It is unique, so a Telegram
account can back exactly one tutor.

### Linking, in both directions

**Telegram first, web later** (the common case). She uses the bot for a week,
then wants the dashboard. On `/link` the bot sends her a one-time URL containing
a short-lived signed token bound to her Telegram id. She opens it, signs up with
Better Auth, and the callback writes `telegram_user_id` onto the new user row.
Her students are already attached.

**Web first, Telegram later.** She signs up on the dashboard, then the settings
page shows a `t.me/<bot>?start=link_<token>` link. The bot verifies the token and
writes the same column. Same code path, opposite order.

### Which method

**Magic link, not passwords.** Tutors are not developers; a password is a support
burden and a leak risk for an account holding minors' practice records. Better
Auth ships a `magicLink` plugin — email in, link out, session cookie back. Add
Google as a second option if it is cheap to wire.

### What stays unauthenticated

**The student. Forever.** No account, no email, no password, nothing to install.
His identity is his Telegram chat and that is the entire point. Better Auth must
never touch the student leg.

---

## Order of work

1. **Neon migration first** ([HOSTING.md](HOSTING.md)). Better Auth needs a real
   database; it cannot sit on a JSON file.
2. **Better Auth with the Postgres adapter + magicLink**, mounted at
   `apps/web/src/app/api/auth/[...all]`. ~30 min.
3. **The `telegram_user_id` link**, both directions. ~20 min. This is the part
   worth testing properly — a tutor who signs in and sees an empty dashboard will
   assume the product lost her data.
4. **Route protection.** `/tutor` requires a session. `/panel` accepts *either* a
   valid session **or** valid `initData` — it is the same person through two
   doors, and the panel must keep working inside Telegram with no session at all.
5. **Multi-tenancy.** Once tutors are real accounts, every store read gets scoped
   by `tutor_id`. Today `store.tutor.chat_id` is a single field; that becomes a
   row per tutor. Do not skip this — it is the difference between a demo and a
   product, and it is where a data leak would live.

---

## Why it is not today

It needs a database we do not have yet, and the 35 minutes left are the
difference between a working demo and a broken one. Today's position is honest
and defensible:

> The tutor's panel is authenticated by Telegram's own signed `initData`,
> verified server-side. The student needs no account at all — that is the
> product. A browser dashboard with Better Auth accounts is the next step, and it
> lands with the database migration.

That reads as a considered architecture. A half-wired login screen at 15:00
reads as a broken one.
