-- One invite, one student.
--
-- Before this table the dashboard handed out `t.me/<bot>?start=<tutor chat id>`
-- — the SAME link for every student, carrying nothing but "somebody's tutor is
-- this person". The name the tutor typed was thrown away and the bot had to ask
-- the student for it again, which is precisely the sign-up step ONBOARDING.md
-- promises he never has to do: "his sign-up is a tap, because everything the
-- system needs to know about him, she supplied."
--
-- A token here carries the name and the tutor, so the bot can greet him by name
-- and file him under the right tutor on the first message.

CREATE TABLE IF NOT EXISTS invites (
  -- Short: Telegram's /start payload is capped at 64 characters and the token
  -- travels inside it with a one-character prefix.
  token TEXT PRIMARY KEY,

  -- The tutor's Telegram id, as text. A 64-bit Telegram id does not survive a
  -- JS number, and every other column in this schema that holds one is BIGINT
  -- precisely because it is read back through `Number()` — here it is only ever
  -- compared and concatenated, so text is both safe and honest.
  tutor_telegram_id TEXT NOT NULL,

  -- What she called him when she invited him. This is the whole point.
  student_name TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Claiming is a one-time transition. A second tap on the same link must not
  -- enrol a second person, so the claim is an UPDATE guarded on these being
  -- NULL rather than a read-then-write.
  claimed_at TIMESTAMPTZ,
  claimed_chat_id BIGINT
);

-- She opens the dashboard and wants to see who she has invited and who has
-- actually tapped. That query is "her tokens, newest first".
CREATE INDEX IF NOT EXISTS invites_by_tutor ON invites (tutor_telegram_id, created_at DESC);
