# The tutor's web app — `apps/dashboard`

← [BUILD.md](BUILD.md) · needs [AUTH.md](AUTH.md) and [HOSTING.md](HOSTING.md)

**Not today.** Neon + Drizzle + Better Auth + the app itself is 2–4 hours. This
is the spec so that build starts with nothing left to decide.

---

## Why it is separate, and not another route

There is already a tutor surface: the Telegram Mini App at `/panel`. It is opened
from a chat, authenticated by `initData`, and it answers exactly one question —
*how did this student's week go?* That is the right shape for a phone, five
minutes before a lesson.

The web app is a different job for the same person:

| | Mini App (`/panel`) | Web app (`apps/dashboard`) |
|---|---|---|
| Opened from | A Telegram chat | A bookmark |
| Authenticated by | `initData` HMAC | Better Auth session |
| Scope | One student, this week | Every student, every week |
| When | Five minutes before a lesson | Sunday night, Monday morning |
| Can do | Read | **Read and change** |

**If the web app only shows what the panel shows, it should not exist.** What
justifies it is the third row: everything below is something Telegram either
cannot do or does badly.

## What it does that Telegram cannot

1. **All students at once.** The panel is per-student because it opens from a
   student's chat. A tutor with twenty clients needs the roster first and the
   detail second. *(Prototyped today — `apps/web/src/app/tutor/` and
   `lib/tutor-roster.ts`. That logic moves across unchanged.)*

2. **History.** Week 1 against week 12. Did the thing she taught in March hold in
   June? A chat surface has no good way to show twelve weeks, and this is the
   question that makes a tutor pay.

3. **Editing a plan.** Reorder the days, drop one, change a target. Dragging six
   cells is genuinely spatial — it is the one interaction that earns a screen
   rather than a message.

4. **Administration.** Pause a student for exam week. End a relationship and
   delete their data. Set pacing. Invite a co-tutor. None of this belongs in a
   chat; all of it needs a confirmation step.

5. **Export.** A PDF or a link for a parent, a school, or her own records.

## Stack

| | | Why |
|---|---|---|
| **Next.js 15, App Router** | its own app under `apps/dashboard` | Own domain, own auth, own deploy cadence |
| **Better Auth** + `magicLink` | `/api/auth/[...all]` | Tutors are not developers; no password to leak or reset. See [AUTH.md](AUTH.md) |
| **Neon Postgres** | serverless, free tier | Reachable from the bot process *and* the web app. See [HOSTING.md](HOSTING.md) |
| **Drizzle** | schema + migrations | Types flow from the schema; `agent-core` already speaks TypeScript end to end |
| **Vercel** | deploy | Same as the panel, different project |

`agent-core` stays the single source of truth for planning, revision and
composition. The dashboard is a **reader and editor of the same data**, never a
second implementation of the rules.

## Routes

```
/                     marketing + sign in          (public)
/app                  the roster — who needs me    (session)
/app/s/[id]           one student: this week, history, the plan editor
/app/s/[id]/week/[n]  an archived week's brief
/app/settings         account, pacing defaults, Telegram link
/app/settings/danger  pause, end relationship, delete data
/api/auth/[...all]    Better Auth
```

`/app` is the roster built today, moved over. `/app/s/[id]` is the panel's brief
plus history plus editing — the panel stays as it is for the phone.

## Schema

Better Auth owns `user`, `session`, `account`, `verification`. Ours:

```sql
-- the join between the two doors (AUTH.md)
ALTER TABLE "user" ADD COLUMN telegram_user_id BIGINT UNIQUE;

CREATE TABLE student (
  id           TEXT PRIMARY KEY,
  tutor_id     TEXT NOT NULL REFERENCES "user"(id),
  name         TEXT NOT NULL,
  chat_id      BIGINT UNIQUE,
  paused_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plan (            -- append-only; a version is never overwritten
  student_id   TEXT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  version      INT  NOT NULL,
  reason       TEXT NOT NULL,
  days         JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, version)
);

CREATE TABLE attempt (         -- append-only
  id           BIGSERIAL PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  plan_version INT  NOT NULL,
  day          INT  NOT NULL,
  gave         TEXT NOT NULL,
  correct      BOOLEAN NOT NULL,
  error_tag    TEXT,
  answered_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX ON student (tutor_id);
CREATE INDEX ON attempt (student_id, answered_at);
```

**`tutor_id` on `student` is the whole multi-tenancy story.** Every query is
scoped by it. This is where a leak between tutors would live, so it belongs in a
query helper, not in each route.

`ON DELETE CASCADE` is deliberate: "delete this student's data" has to actually
delete it. This product holds practice records of named minors.

## Migration from the JSON store

`packages/agent-core/src/store.ts` is small on purpose — `read()`, `update()`,
and about a dozen helpers with the same names the rest of the code already calls.
Reimplement that surface against Drizzle and **nothing upstream changes**:
`dueStep`, `latestPlan`, `attemptsFor`, `claimUpdate` keep their signatures.

Two things that must change shape, not just storage:

- `store.tutor.chat_id` is a single field today. It becomes a row per tutor.
- `STUDENT_ID = "jonas"` is hardcoded in the channel. Multi-student
  ([STRETCH.md](STRETCH.md) B) has to land first, or the dashboard is a list
  of one.

## Order of work

1. **Neon + Drizzle schema**, `store.ts` reimplemented against it. ~60 min.
   Everything else is blocked on this; do not start the app first.
2. **Multi-student in the channel** — otherwise there is nothing to list.
3. **Better Auth + magic link + the `telegram_user_id` join.** ~50 min.
4. **`/app` roster** — move today's `tutor-roster.ts` across, add the session scope.
5. **`/app/s/[id]`** — brief, history, then the plan editor.
6. **Settings and deletion.** Before a single real student exists.

## What today's work contributes

Not wasted:

- `lib/tutor-roster.ts` — the "who needs me" logic, computed in code from attempt
  rows. Moves across unchanged.
- `app/tutor/` — the roster view, and the proof it reads well.
- `lib/telegram-initdata.ts` — still the Mini App's auth. The web app never
  replaces it; the two doors coexist ([AUTH.md](AUTH.md)).
- `contracts.ts` — the plan and brief shapes are already the database's shape.
