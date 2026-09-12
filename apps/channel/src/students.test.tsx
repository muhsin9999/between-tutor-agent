/**
 * The two Jonases, in a test, so the answer is known before she asks.
 *
 * Everything that decides WHO — the separator, the surname, the tie — is pure,
 * so all of it runs here in milliseconds with no store, no network and no
 * Telegram. The two functions that do touch the store get a throwaway file.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Actions, Button } from "@copilotkit/channels";
import type { ChannelNode } from "@copilotkit/channels";
import type { Student } from "agent-core/contracts";

// Set before agent-core's store.ts is evaluated — it reads BETWEEN_STORE at
// module load, so these imports have to be dynamic and come after.
process.env.BETWEEN_STORE = join(mkdtempSync(join(tmpdir(), "between-students-")), "store.json");

const { store } = await import("agent-core");
const { askWhichStudent, enrolStudent, matchStudentByName, resolveStudent, studentId } =
  await import("./students");

const student = (id: string, name: string, chat_id: number): Student => ({ id, name, chat_id });

const jonasK = student("s5001", "Jonas Klein", 5001);
const jonasB = student("s5002", "Jonas Berg", 5002);
const mira = student("s5003", "Mira Osei", 5003);

const BRIEF = "German past tense of irregular verbs, ten minutes a day";

/* ── who does she mean ───────────────────────────────────────────────────── */

test("one student, one match — and the brief comes back without the name", () => {
  const got = matchStudentByName(`Jonas — ${BRIEF}.`, [jonasK, mira]);
  assert.equal(got.kind, "one");
  assert.equal(got.kind === "one" && got.student.id, "s5001");
  // The comma inside the brief must NOT split it — leftmost separator wins.
  assert.equal(got.kind === "one" && got.rest, `${BRIEF}.`);
});

// The whole reason this file exists. Silently picking the first Jonas rewrites
// the other boy's week and nobody finds out until the next lesson.
test("two Jonases are ambiguous — never a silent pick", () => {
  const got = matchStudentByName(`Jonas — ${BRIEF}.`, [jonasK, jonasB, mira]);
  assert.equal(got.kind, "ambiguous");
  assert.deepEqual(
    got.kind === "ambiguous" && got.candidates.map((s) => s.id),
    ["s5001", "s5002"],
  );
  assert.equal(got.kind === "ambiguous" && got.rest, `${BRIEF}.`);
});

test("a surname — even one letter of it — disambiguates two Jonases", () => {
  const got = matchStudentByName(`Jonas K — ${BRIEF}.`, [jonasK, jonasB, mira]);
  assert.equal(got.kind, "one");
  assert.equal(got.kind === "one" && got.student.id, "s5001");

  const other = matchStudentByName("Jonas Berg: revision", [jonasK, jonasB]);
  assert.equal(other.kind === "one" && other.student.id, "s5002");
});

test("no match carries the students she does have, so the reply can be useful", () => {
  const got = matchStudentByName(`Petra — ${BRIEF}.`, [jonasK, mira]);
  assert.equal(got.kind, "none");
  assert.equal(got.kind === "none" && got.tried, "Petra");
  assert.deepEqual(got.kind === "none" && got.known.map((s) => s.name), [
    "Jonas Klein",
    "Mira Osei",
  ]);
});

test("em dash, en dash, spaced hyphen, colon and comma all split the same way", () => {
  for (const line of [
    `Jonas — ${BRIEF}`,
    `Jonas – ${BRIEF}`,
    `Jonas - ${BRIEF}`,
    `Jonas: ${BRIEF}`,
    `Jonas, ${BRIEF}`,
    `Jonas—${BRIEF}`,
  ]) {
    const got = matchStudentByName(line, [jonasK, mira]);
    assert.equal(got.kind, "one", line);
    assert.equal(got.kind === "one" && got.rest, BRIEF, line);
  }
});

test("an unspaced hyphen is part of a name, not a separator", () => {
  const jeanLuc = student("s5004", "Jean-Luc Roy", 5004);
  const got = matchStudentByName("Jean-Luc — French subjunctive", [jeanLuc, mira]);
  assert.equal(got.kind === "one" && got.student.id, "s5004");
  assert.equal(got.kind === "one" && got.rest, "French subjunctive");
});

test("case, padding and a trailing full stop are tolerated", () => {
  const got = matchStudentByName("  jonas k.  —  revision  ", [jonasK, jonasB]);
  assert.equal(got.kind === "one" && got.student.id, "s5001");
  assert.equal(got.kind === "one" && got.rest, "revision");
});

// She forgets the dash and the only separator in the line is the comma inside
// her own brief. The name is still at the front, and the brief keeps its comma.
test("a line with no separator still finds the name at the front", () => {
  const got = matchStudentByName(`Jonas ${BRIEF}`, [jonasK, mira]);
  assert.equal(got.kind === "one" && got.student.id, "s5001");
  assert.equal(got.kind === "one" && got.rest, BRIEF);

  const bare = matchStudentByName("Jonas", [jonasK, mira]);
  assert.equal(bare.kind === "one" && bare.rest, "");
});

test("nobody enrolled yet is a miss, not a crash", () => {
  const got = matchStudentByName(`Jonas — ${BRIEF}`, []);
  assert.equal(got.kind, "none");
  assert.deepEqual(got.kind === "none" && got.known, []);
});

/* ── the buttons ─────────────────────────────────────────────────────────── */

function walk(node: unknown, out: ChannelNode[] = []): ChannelNode[] {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return out;
  }
  if (!node || typeof node !== "object" || !("type" in node)) return out;
  const element = node as ChannelNode;
  out.push(element);
  return walk((element.props as { children?: unknown }).children, out);
}

const textOf = (node: ChannelNode): string =>
  String((node.props as { children?: unknown }).children ?? "");

test("two candidates become two tappable buttons that tell them apart", () => {
  const ui = askWhichStudent({
    candidates: [
      { student: jonasK, lastSeenDay: 3 },
      { student: jonasB, lastSeenDay: null },
    ],
    rest: BRIEF,
  });
  const tree = walk(ui);
  assert.equal(tree.filter((n) => n.type === Actions).length, 1);

  const buttons = tree.filter((n) => n.type === Button);
  assert.equal(buttons.length, 2);
  // The value is the id, never the name — that is what the caller acts on.
  assert.deepEqual(buttons.map((b) => (b.props as { value?: string }).value), ["s5001", "s5002"]);

  const captions = buttons.map(textOf);
  assert.equal(captions[0], "Jonas Klein · last answered day 3");
  assert.equal(captions[1], "Jonas Berg · not started");
  assert.notEqual(captions[0], captions[1]);
});

test("the bare Student[] from an ambiguous match can be passed straight in", () => {
  const got = matchStudentByName("Jonas — revision", [jonasK, jonasB]);
  assert.equal(got.kind, "ambiguous");
  const buttons = walk(
    askWhichStudent({ candidates: got.kind === "ambiguous" ? got.candidates : [] }),
  ).filter((n) => n.type === Button);
  assert.equal(buttons.length, 2);
});

// Identical names AND no distinguishing facts is the one outcome the UI must
// not have: two buttons reading the same word.
test("identical labels are numbered rather than repeated", () => {
  const twin = student("s5005", "Jonas", 5005);
  const captions = walk(
    askWhichStudent({ candidates: [student("s5006", "Jonas", 5006), twin] }),
  )
    .filter((n) => n.type === Button)
    .map(textOf);
  assert.deepEqual(captions, ["Jonas (1)", "Jonas (2)"]);
});

// The product's own ≤8-choice rule, from keyboard.ts.
test("past eight candidates she is asked for a surname instead of a menu", () => {
  const many = Array.from({ length: 9 }, (_, i) => student(`s${i}`, `Jonas ${i}`, i));
  const tree = walk(askWhichStudent({ candidates: many }));
  assert.equal(tree.filter((n) => n.type === Button).length, 0);
  assert.equal(tree.filter((n) => n.type === Actions).length, 0);
  assert.match(tree.map(textOf).join(" "), /surname/);
});

/* ── identity ────────────────────────────────────────────────────────────── */

beforeEach(() => store.reset());

test("the id comes from the chat, so two students called Jonas never collide", () => {
  const a = enrolStudent({ chatId: 8001, name: "Jonas", tutorChatId: 99 });
  const b = enrolStudent({ chatId: 8002, name: "Jonas", tutorChatId: 99 });

  assert.equal(a.id, studentId(8001));
  assert.notEqual(a.id, b.id);
  // The bug this closes: the second enrolment used to overwrite the first.
  assert.equal(Object.keys(store.read().students).length, 2);
  assert.equal(resolveStudent(8001)?.id, a.id);
  assert.equal(resolveStudent(8002)?.id, b.id);
});

test("re-enrolling the same chat updates the name in place, it does not twin", () => {
  enrolStudent({ chatId: 8003, name: "Jonas", tutorChatId: 99 });
  const again = enrolStudent({ chatId: 8003, name: "Jonas Klein", tutorChatId: 99 });
  assert.equal(Object.keys(store.read().students).length, 1);
  assert.equal(again.name, "Jonas Klein");
  assert.equal(resolveStudent(8003)?.name, "Jonas Klein");
});

test("an unknown chat is null — not somebody else's week", () => {
  enrolStudent({ chatId: 8004, name: "Jonas", tutorChatId: 99 });
  assert.equal(resolveStudent(1234), null);
});

test("enrolment records the tutor and back-fills an unclaimed tutor chat", () => {
  const enrolled = enrolStudent({ chatId: 8005, name: "Mira", tutorChatId: 77 });
  assert.equal(enrolled.class_id, "t77");
  assert.equal(store.read().tutor.chat_id, 77);

  // ...but never steals the role from a tutor who already holds it.
  enrolStudent({ chatId: 8006, name: "Jonas", tutorChatId: 88 });
  assert.equal(store.read().tutor.chat_id, 77);
});

test("a group chat's negative id is a perfectly good student id", () => {
  const enrolled = enrolStudent({ chatId: -1001234, name: "Jonas", tutorChatId: 99 });
  assert.equal(enrolled.id, "s-1001234");
  assert.equal(resolveStudent(-1001234)?.id, "s-1001234");
});

test("a resolved student matches by name the way the tutor writes it", () => {
  const enrolled = enrolStudent({ chatId: 8007, name: "Jonas Klein", tutorChatId: 99 });
  const got = matchStudentByName(`Jonas — ${BRIEF}`, Object.values(store.read().students));
  assert.equal(got.kind === "one" && got.student.id, enrolled.id);
});
