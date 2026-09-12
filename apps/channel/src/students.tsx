/**
 * T-A8 — which student is this?
 *
 * The demo shipped with one student: `STUDENT_ID = "jonas"`, hardcoded in
 * twelve places in turns.tsx, and `upsertStudent({ id: "jonas", ... })` on every
 * enrolment. Two people enrolling means the second one's `chat_id` lands on the
 * first one's record, and from then on the bot is asking one phone the other
 * phone's questions and grading the answers into one week. The store has always
 * been `Record<string, Student>`; nothing above it ever asked WHO.
 *
 * This file is the layer that asks. Three questions, three answers:
 *
 *   a message arrives  → `resolveStudent(chatId)`      — who owns this chat?
 *   someone taps /start → `enrolStudent(...)`          — mint them an identity
 *   the tutor types    → `matchStudentByName(line, …)` — who does she mean?
 *
 * The first two touch the store. Everything else here is pure, because the
 * interesting part — "Jonas" when there are two Jonases — is a decision, and a
 * decision you can't run in a test is a decision you find out about on camera.
 *
 * ── The one rule that matters ───────────────────────────────────────────────
 * `matchStudentByName` returns `one` ONLY when exactly one student matches.
 * Two Jonases return `ambiguous`, always. Picking the first one silently means
 * her Tuesday line about one boy's speaking nerves rewrites the other boy's
 * week, and neither she nor he will find out until the next lesson. Asking her
 * which costs one tap.
 */
import { Actions, Button, Context, Markdown, Message, Section } from "@copilotkit/channels";
import type { ChannelNode, ClickHandler } from "@copilotkit/channels";
import { store } from "agent-core";
import type { Student } from "agent-core/contracts";
import { MAX_INLINE_CHOICES, asChoices } from "./keyboard";

/* ── identity ─────────────────────────────────────────────────────────────────
 *
 * The id is `s${chatId}`, and it is NEVER derived from the name.
 *
 * A Telegram chat id is already the one globally unique, stable, never-reused
 * handle we are given for free — a student who changes their display name keeps
 * their week, and two students called Jonas get `s55501` and `s55502` and can
 * never collide. Deriving it from the name (`"jonas"`, or a slug of it) is the
 * exact bug this file exists to close: `name` is display text, two students may
 * share one, and it is the tutor's to change.
 *
 * Negative ids are normal (Telegram groups), and `s-100123` is a perfectly good
 * key. Nothing downstream parses an id — `student_id` is an opaque string in
 * every contract.
 * ───────────────────────────────────────────────────────────────────────────*/

export function studentId(chatId: number): string {
  return `s${chatId}`;
}

/** Who is this chat? Null when the chat is not an enrolled student. */
export function resolveStudent(chatId: number): Student | null {
  return store.studentByChat(chatId) ?? null;
}

/**
 * Mint a student on enrolment.
 *
 * Idempotent: the id comes from the chat, so a second /start from the same
 * phone updates the name in place rather than creating a twin, and the week
 * already attached to that id survives.
 *
 * `tutorChatId` is recorded as `class_id` — the contract is frozen and has no
 * tutor field, and one tutor is exactly one class in this product. It also
 * back-fills `store.tutor.chat_id` when nothing has claimed it yet, so a store
 * wiped between takes heals on the first enrolment instead of staying tutorless.
 */
export function enrolStudent(args: { chatId: number; name: string; tutorChatId: number }): Student {
  const student: Student = {
    id: studentId(args.chatId),
    name: displayName(args.name),
    chat_id: args.chatId,
    class_id: `t${args.tutorChatId}`,
  };
  store.upsertStudent(student);
  if (store.read().tutor.chat_id === null) store.setTutorChat(args.tutorChatId);
  return student;
}

/** Trimmed, collapsed, no trailing full stop. Display text, nothing more. */
function displayName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim().replace(/\.+$/, "").trim();
  return name || "Student";
}

/* ── the tutor's line ─────────────────────────────────────────────────────── */

export type NameMatch =
  | { kind: "one"; student: Student; rest: string }
  | { kind: "ambiguous"; candidates: Student[]; rest: string }
  | { kind: "none"; tried: string; known: Student[] };

/**
 * Where the name stops and the brief starts.
 *
 * Em dash, en dash, colon and comma split on their own; a plain hyphen only
 * splits when it is spaced, so "Jean-Luc — French subjunctive" keeps its name
 * intact. Leftmost wins, which is why "Jonas — past tense, ten minutes a day"
 * splits on the dash and not on the comma inside the brief.
 */
const SEPARATOR = /\s*[—–]\s*|\s*[:,]\s*|\s+-{1,2}(?:\s+|$)/;


/** Lowercase, collapsed, trailing full stops off each word. "Jonas K." → ["jonas","k"] */
function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/\.+$/, "").trim())
    .filter(Boolean);
}

/**
 * First name, or a "first last" pair. The trailing words are matched as
 * PREFIXES, which is what makes "Jonas K" pick one of two Jonases without
 * making her type a surname she may not use out loud.
 */
function matchesName(student: Student, query: string[]): boolean {
  const name = words(student.name);
  if (name.length === 0 || query.length === 0) return false;
  if (query[0] !== name[0]) return false;
  return query.slice(1).every((word, i) => (name[i + 1] ?? "").startsWith(word));
}

/** Fallback tier only: "Klein" alone, when nothing matched on a first name. */
function matchesSurname(student: Student, query: string[]): boolean {
  if (query.length !== 1) return false;
  return words(student.name)
    .slice(1)
    .some((word) => word.startsWith(query[0]));
}

function findByName(name: string, students: readonly Student[]): Student[] {
  const query = words(name);
  if (query.length === 0) return [];
  const byFirstName = students.filter((s) => matchesName(s, query));
  if (byFirstName.length > 0) return byFirstName;
  return students.filter((s) => matchesSurname(s, query));
}

/**
 * The name segment, and the ways to read it — longest first.
 *
 * The segment before the separator is the name as she wrote it, so it is tried
 * first and "Jonas K" beats a bare "Jonas". After that we walk back to two
 * words, then one, because the separator is not always where the name ends:
 * "Jonas German past tense, ten minutes a day" has no dash, and its first
 * separator is the comma INSIDE the brief. Whichever reading matches also
 * decides `rest`, which is spliced out of the original line rather than
 * rebuilt, so her punctuation survives intact.
 */
type Reading = { name: string; rest: string };

function readings(line: string): { tried: string; options: Reading[] } {
  const trimmed = line.trim();
  const found = SEPARATOR.exec(trimmed);
  const at = found && found.index > 0 ? found.index : trimmed.length;

  const segment = trimmed.slice(0, at);
  const afterSeparator = found && found.index > 0
    ? trimmed.slice(found.index + found[0].length).trim()
    : "";
  // The separator and everything past it, verbatim — what a short reading of
  // the name has to carry forward with the words it did not claim.
  const tail = trimmed.slice(at);

  const parts = [...segment.matchAll(/\S+/g)].map((m) => ({ word: m[0], at: m.index ?? 0 }));

  const options: Reading[] = [];
  for (const take of [parts.length, 2, 1]) {
    if (take < 1 || take > parts.length) continue;
    const name = parts.slice(0, take).map((p) => p.word).join(" ");
    if (options.some((o) => o.name === name)) continue;
    const rest =
      take === parts.length ? afterSeparator : `${segment.slice(parts[take].at)}${tail}`.trim();
    options.push({ name, rest });
  }

  return { tried: segment.trim() || trimmed, options };
}

/**
 * "Jonas — German past tense…" → who does she mean, and what goes to planWeek.
 *
 * `rest` is the brief, with the name and the separator stripped. `one` means
 * EXACTLY one student matched; two Jonases are `ambiguous` and the caller has
 * to ask. A miss carries `known` so the reply can name the students she does
 * have rather than just saying no.
 */
export function matchStudentByName(line: string, students: Student[]): NameMatch {
  const known = [...students];
  const { tried, options } = readings(line ?? "");

  for (const option of options) {
    const found = findByName(option.name, known);
    if (found.length === 1) return { kind: "one", student: found[0], rest: option.rest };
    if (found.length > 1) return { kind: "ambiguous", candidates: found, rest: option.rest };
  }

  return { kind: "none", tried, known };
}

/* ── the disambiguation, in the chat ──────────────────────────────────────────
 *
 * She gets buttons, not a request to retype her line. She is at a desk with
 * five minutes between lessons; the whole promise is that one line is all she
 * types, so making the ambiguous case cost a second line would spend the
 * product's one claim on an edge she hits weekly with two Jonases in a class.
 *
 * ≤8 candidates become an inline keyboard that stays in the conversation —
 * keyboard.ts, the same rule the student's leg lives under. Past eight, a
 * keyboard is a menu and a menu is a form, so we ask for a surname instead.
 * ───────────────────────────────────────────────────────────────────────────*/

export type Candidate = {
  student: Student;
  /**
   * The last day this student answered anything; null when they never have.
   * Preferred over `day` because it actually differs BETWEEN students — the
   * clock is global, so "day 3 of 6" is the same on every button.
   */
  lastSeenDay?: number | null;
  /** Which of the six days the week is on — `store.currentDay()`. */
  day?: number;
};

function toCandidate(value: Student | Candidate): Candidate {
  return "student" in value ? value : { student: value };
}

/** Something that tells two students of the same name apart. */
function describe(candidate: Candidate): string {
  const { lastSeenDay, day } = candidate;
  if (lastSeenDay === null) return "not started";
  if (typeof lastSeenDay === "number") {
    return lastSeenDay > 0 ? `last answered day ${lastSeenDay}` : "not started";
  }
  if (typeof day === "number") return day > 0 ? `day ${Math.min(6, day)} of 6` : "not started";
  return "";
}

/** Telegram truncates a long button; 60 keeps the label on one line on a phone. */
const MAX_LABEL = 60;

function label(candidate: Candidate): string {
  const name = candidate.student.name.trim() || "Student";
  const hint = describe(candidate);
  return (hint ? `${name} · ${hint}` : name).slice(0, MAX_LABEL);
}

/**
 * Two buttons reading exactly the same is the one outcome this UI must not
 * have. If the caller passed nothing that tells them apart, number them —
 * unhelpful, but never wrong.
 */
function labels(candidates: readonly Candidate[]): string[] {
  const plain = candidates.map(label);
  const seen: Record<string, number> = {};
  return plain.map((text) => {
    if (plain.filter((other) => other === text).length === 1) return text;
    seen[text] = (seen[text] ?? 0) + 1;
    return `${text} (${seen[text]})`;
  });
}

/**
 * "Which Jonas?" — one tappable button per candidate.
 *
 * `onPick` receives the chosen student's id as `ctx.action.value`; wire it to
 * whatever would have run had the name been unambiguous. Accepts either the
 * bare `Student[]` that `matchStudentByName` hands back or `Candidate[]` with
 * the day hints filled in, so the caller can add the store lookup without this
 * file reaching for the store.
 */
export function askWhichStudent(args: {
  candidates: readonly (Student | Candidate)[];
  rest?: string;
  onPick?: ClickHandler<string>;
}): ChannelNode {
  const candidates = args.candidates.map(toCandidate);
  const options = labels(candidates);
  const choices = asChoices(options);

  if (choices.kind === "text") {
    return (
      <Message accent="#16306B">
        <Section>
          <Markdown>
            {`${candidates.length} of your students answer to that name — past ${MAX_INLINE_CHOICES}, ` +
              "buttons stop being a shortcut.\n\nSend it again with a surname:\n\n" +
              "_Jonas Klein — German past tense, ten minutes a day._"}
          </Markdown>
        </Section>
        <Context>{choices.reason}</Context>
      </Message>
    );
  }

  return (
    <Message accent="#16306B">
      <Section>
        <Markdown>{"Two of yours go by that name. Which one?"}</Markdown>
      </Section>
      <Actions>
        {candidates.map((candidate, i) => (
          <Button key={candidate.student.id} value={candidate.student.id} onClick={args.onPick}>
            {choices.options[i]}
          </Button>
        ))}
      </Actions>
      {args.rest ? <Context>{`I'll plan: ${args.rest}`}</Context> : null}
    </Message>
  );
}
