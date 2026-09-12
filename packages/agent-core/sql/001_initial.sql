-- Between's durable, multi-tutor state.
--
-- Plans and attempts are append-only by design: a tutor can see what changed,
-- and a revision never rewrites a completed part of the week.

CREATE TABLE IF NOT EXISTS tutors (
  id TEXT PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  days JSONB NOT NULL,
  PRIMARY KEY (student_id, version)
);

CREATE TABLE IF NOT EXISTS attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_version INTEGER NOT NULL,
  day SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 6),
  answered_at TIMESTAMPTZ NOT NULL,
  gave TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  error_tag TEXT,
  FOREIGN KEY (student_id, plan_version) REFERENCES plans(student_id, version)
);

CREATE INDEX IF NOT EXISTS attempts_by_student_and_day
  ON attempts (student_id, day, answered_at);

-- A duplicate Telegram update must be rejected atomically before it can add a
-- second attempt or fire a second revision.
CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id BIGINT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_clocks (
  tutor_id TEXT PRIMARY KEY REFERENCES tutors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  speed TEXT NOT NULL
);
