/**
 * `POST /api/students` — the tutor adds a student, and the student never signs up.
 *
 * ONBOARDING.md flow 2: "The tutor already knows his name. She types it when she
 * invites him. The student's sign-up is therefore a tap, because everything the
 * system needs to know about him, she supplied."
 *
 * Body `{ name }`. Response `{ student, persisted, inviteUrl, message }`.
 *
 * **The session check is the security model, exactly as in `/api/link`.** The
 * invite this mints is bound to *her* Telegram chat id — the bot only accepts a
 * `/start <payload>` whose payload matches the tutor's chat. Minting one without
 * a session would let a stranger hand out links that enrol children into an
 * account that is not theirs. So: no session, no invite, 401. Her Telegram id
 * comes from the verified session's `user.telegram_user_id`, never from the body.
 *
 * **What this endpoint honestly does not do.** `students.telegram_chat_id` is
 * `BIGINT NOT NULL UNIQUE` in `packages/agent-core/sql/001_initial.sql`, and his
 * chat id cannot be known until he taps the link. There is no correct value to
 * write, and inventing one would either collide with a real chat or plant a row
 * that the channel can never match him to. So when the column is NOT NULL we
 * write nothing and say so: the invite is minted, the row appears when he taps.
 * The nullability is read at runtime rather than assumed, so the day a migration
 * relaxes that column this route starts persisting the row without an edit.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth";

/** `node:crypto` and the `pg` session lookup. Never the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/** Longer than any name a tutor types, short enough to reject a pasted essay. */
const MAX_NAME = 80;

/** Read an env var, treating blank and whitespace as absent. */
function env(name: string): string | undefined {
  const trimmed = process.env[name]?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * What the dashboard gets back. `chat_id` is `null` rather than absent because
 * "not known yet" is a fact about this student, and hiding it behind an optional
 * field is how a caller ends up assuming he is enrolled.
 */
interface PendingStudent {
  id: string;
  name: string;
  chat_id: null;
}

/**
 * A pending id: `pending_` plus 32 hex characters of randomness.
 *
 * **Never derived from the name.** Two students called Jonas are two people, and
 * an id like `s_jonas` would make the second one silently overwrite the first on
 * a primary key — a child answering questions from another child's plan. The
 * name is a label; the id is an identity, and identities are minted, not spelled.
 */
function pendingId(): string {
  return `pending_${randomUUID().replace(/-/g, "")}`;
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession(request.headers);
  if (!session) {
    return Response.json(
      {
        error: "unauthenticated",
        message:
          "Sign in first. An invite is bound to one tutor's Telegram chat, so " +
          "it is only ever minted for the tutor who asked for it.",
      },
      { status: 401, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length === 0) {
    return Response.json(
      {
        error: "name_required",
        message:
          "Type his name. It is the whole reason he never has to sign up — the " +
          "bot greets him by the name you gave it.",
      },
      { status: 400, headers: NO_STORE },
    );
  }
  if (name.length > MAX_NAME) {
    return Response.json(
      {
        error: "name_too_long",
        message: `That is longer than ${MAX_NAME} characters. Use the name you call him in a lesson.`,
      },
      { status: 400, headers: NO_STORE },
    );
  }

  // BotFather usernames are sometimes pasted with the @ still attached.
  const bot = env("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "");
  if (!bot) {
    return Response.json(
      {
        error: "bot_not_configured",
        message:
          "TELEGRAM_BOT_USERNAME is not set on this server, so there is no bot " +
          "for him to tap through to. See docs/AUTH-SETUP.md.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  /*
   * The invite payload IS her Telegram chat id — `apps/channel/src/channel.tsx`
   * checks `/start <payload>` against the stored tutor chat and only then asks
   * the student his name. An invite minted with no tutor behind it opens a chat
   * with the bot and enrols precisely nobody, so this is a 409 and not a link.
   */
  const tutorTelegramId = session.user.telegramUserId;
  if (!tutorTelegramId) {
    return Response.json(
      {
        error: "telegram_not_linked",
        message:
          "Connect Telegram first, in Settings. The invite carries your Telegram " +
          "id — it is how the bot knows whose student he is. Without it the link " +
          "opens a chat and enrols nobody.",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const student: PendingStudent = { id: pendingId(), name, chat_id: null };
  const inviteUrl = `https://t.me/${bot}?start=${encodeURIComponent(tutorTelegramId)}`;

  const connectionString = env("DATABASE_URL");
  if (!connectionString) {
    // A session exists, so this is close to unreachable — but a 500 here would
    // throw away a perfectly good invite link she can still send him.
    return Response.json(
      {
        student: null,
        persisted: false,
        inviteUrl,
        message:
          "DATABASE_URL is not set on this server, so nothing was saved. The " +
          "invite below still works — he appears on your roster when he taps it.",
      },
      { headers: NO_STORE },
    );
  }

  try {
    const sql = neon(connectionString);

    /*
     * Ask the database what it will actually accept rather than trusting the
     * checked-in migration. `telegram_chat_id NOT NULL` is the shipped shape and
     * means the row cannot exist before he taps; `tutor_id NOT NULL` means it
     * also needs a `tutors` row for her.
     */
    const columns = (await sql`
      SELECT column_name, is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'students'
         AND column_name IN ('telegram_chat_id', 'tutor_id')
    `) as { column_name: string; is_nullable: string }[];

    const nullable = (column: string) =>
      columns.find((c) => c.column_name === column)?.is_nullable === "YES";

    if (columns.length === 0) {
      return Response.json(
        {
          student: null,
          persisted: false,
          inviteUrl,
          message:
            "There is no students table on this database yet, so nothing was " +
            "saved. The invite still works — he appears when he taps it.",
        },
        { headers: NO_STORE },
      );
    }

    if (!nullable("telegram_chat_id")) {
      return Response.json(
        {
          student: null,
          persisted: false,
          inviteUrl,
          message:
            "Nothing is saved yet, on purpose: a student row needs his Telegram " +
            "chat id and he has not tapped the link, so there is no honest value " +
            "to write. Send him the link — he appears on your roster once he taps it.",
        },
        { headers: NO_STORE },
      );
    }

    const tutorRows = (await sql`
      SELECT id FROM tutors WHERE telegram_chat_id = ${tutorTelegramId}
    `) as { id: string }[];
    const tutorId = tutorRows[0]?.id ?? null;

    if (!tutorId && !nullable("tutor_id")) {
      return Response.json(
        {
          student: null,
          persisted: false,
          inviteUrl,
          message:
            "You do not have a tutor record on this database yet — send /tutor to " +
            "the bot once and it creates one. Nothing was saved, but the invite " +
            "below works and he appears when he taps it.",
        },
        { headers: NO_STORE },
      );
    }

    await sql`
      INSERT INTO students (id, tutor_id, name, telegram_chat_id)
      VALUES (${student.id}, ${tutorId}, ${student.name}, ${null})
    `;

    return Response.json(
      {
        student,
        persisted: true,
        inviteUrl,
        message:
          "Saved as invited. He is not enrolled until he taps the link and tells " +
          "the bot his name.",
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    // The invite is already valid and costs nothing to hand over, so a database
    // that is down loses the row, not the onboarding.
    console.error("[students] could not write the student row:", error);
    return Response.json(
      {
        student: null,
        persisted: false,
        inviteUrl,
        message:
          "The database did not accept the row, so nothing was saved. The invite " +
          "below still works — he appears on your roster when he taps it.",
      },
      { headers: NO_STORE },
    );
  }
}
