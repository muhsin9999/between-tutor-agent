/**
 * T-A6 — the explanation, in the chat.
 *
 * When he gets the same thing wrong twice, the bot does not send him somewhere
 * to find out why. There is no panel on the student's leg, no webview, no "tap
 * to review your mistakes". The premise of the product is that he will not open
 * a practice app — that is *why* the six days are empty — so an explanation has
 * to survive inside the conversation or it does not exist.
 *
 * What survives there is a monospace grid. The Telegram renderer turns <Table>
 * into a padded <pre> block, so three columns line up under one another on a
 * phone and the vowel change reads as a COLUMN rather than as a sentence about
 * German grammar:
 *
 *     verb      ✗         ✓
 *     nehmen    nehmte    nahm
 *     sehen     sehte     sah
 *     sprechen  sprechte  sprach
 *
 * Row one is the answer he just typed. The rows under it are the same rule —
 * his own earlier miss first, because it is evidence rather than a worked
 * example, then a verb he has not been asked yet. Three rows of one pattern is
 * what makes it a rule he can apply, not a correction he has to remember.
 *
 * <Chart> is skipped outright by the Telegram renderer, and <Image> would mean
 * generating and hosting a picture. A table is the only visual that arrives.
 */
import { Message, Section, Markdown, Context, Table, Row, Cell } from "@copilotkit/channels";
import type { ChannelNode } from "@copilotkit/channels";
import { normalizeAnswer } from "agent-core";
import type { Attempt, ErrorTag, PlanDay } from "agent-core/contracts";

/**
 * Six rows is the ceiling the phone allows; four is what reads without pushing
 * the question off the screen. One miss, one earlier miss, one or two verbs he
 * has not seen yet.
 */
const MAX_ROWS = 4;

/** A cell wider than this pushes the <pre> grid past the screen and it wraps. */
const MAX_CELL = 14;

/* ── the vocabulary ──────────────────────────────────────────────────────────
 *
 * `shift` is the whole lesson: these verbs change their stem vowel in the past
 * instead of taking `-te`. Grouping by it is what lets a miss be answered with
 * two other verbs that do the SAME thing, which is the difference between
 * showing a rule and issuing a correction.
 *
 * The tutor's closed set (gehen · sehen · nehmen · sprechen · trinken · fahren)
 * is here plus its nearest neighbours, so a sibling row is nearly always a verb
 * he already recognises.
 */
type StrongVerb = { infinitive: string; past: string; shift: string };

const STRONG_VERBS: readonly StrongVerb[] = [
  { infinitive: "sehen", past: "sah", shift: "e → a" },
  { infinitive: "nehmen", past: "nahm", shift: "e → a" },
  { infinitive: "sprechen", past: "sprach", shift: "e → a" },
  { infinitive: "geben", past: "gab", shift: "e → a" },
  { infinitive: "lesen", past: "las", shift: "e → a" },
  { infinitive: "essen", past: "aß", shift: "e → a" },
  { infinitive: "trinken", past: "trank", shift: "i → a" },
  { infinitive: "singen", past: "sang", shift: "i → a" },
  { infinitive: "finden", past: "fand", shift: "i → a" },
  { infinitive: "schwimmen", past: "schwamm", shift: "i → a" },
  { infinitive: "fahren", past: "fuhr", shift: "a → u" },
  { infinitive: "tragen", past: "trug", shift: "a → u" },
  { infinitive: "schlagen", past: "schlug", shift: "a → u" },
  { infinitive: "gehen", past: "ging", shift: "e → i" },
  { infinitive: "kommen", past: "kam", shift: "o → a" },
  { infinitive: "laufen", past: "lief", shift: "au → ie" },
];

/** The rule he applied: drop the infinitive ending, add `-te`. "sehen" → "sehte". */
function regularised(infinitive: string): string {
  const stem = infinitive.endsWith("en")
    ? infinitive.slice(0, -2)
    : infinitive.endsWith("n")
      ? infinitive.slice(0, -1)
      : infinitive;
  return `${stem}te`;
}

/** Which verb the day is testing — recovered from what a correct answer would be. */
function verbByPast(expects: string): StrongVerb | null {
  const wanted = normalizeAnswer(expects);
  return STRONG_VERBS.find((verb) => normalizeAnswer(verb.past) === wanted) ?? null;
}

/**
 * Which verb an earlier wrong answer was about. An `Attempt` carries his text
 * and a day, never that day's `expects`, so the only honest route back to the
 * verb is to match his answer against each regularised form. "sehte" is
 * reachable; "no idea" is not, and that row is simply left out.
 */
function verbByWrongForm(gave: string): StrongVerb | null {
  const written = normalizeAnswer(gave);
  return STRONG_VERBS.find((verb) => regularised(verb.infinitive) === written) ?? null;
}

/** Keep the grid narrower than the screen. His text is clipped, never cleaned up. */
function clip(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= MAX_CELL ? flat : `${flat.slice(0, MAX_CELL - 1)}…`;
}

const byTime = (a: Attempt, b: Attempt) => Date.parse(a.answered_at) - Date.parse(b.answered_at);

/**
 * The answer being explained: the most recent one, and only if it replies to the
 * day we actually put to him. A miss tagged `untagged` is never explained —
 * there is no pattern to draw, and an invented one is worse than silence.
 */
function latestMiss(attempts: readonly Attempt[], step: PlanDay): Attempt | null {
  const last = [...attempts].sort(byTime).at(-1);
  if (!last || last.day !== step.day || last.correct) return null;
  if (last.error_tag === null || last.error_tag === "untagged") return null;
  return last;
}

/** Misses carrying the same tag inside the same plan version — as evidence.ts counts them. */
function sameTagMisses(attempts: readonly Attempt[], latest: Attempt): Attempt[] {
  return attempts
    .filter(
      (attempt) =>
        attempt.student_id === latest.student_id &&
        attempt.plan_version === latest.plan_version &&
        !attempt.correct &&
        attempt.error_tag === latest.error_tag,
    )
    .sort(byTime);
}

/**
 * A single slip is a slip. Explaining every miss turns a warm one-line reply
 * into a lecture, and the reply is the thing he answers.
 *
 * The threshold is deliberately the one `evidence.ts` already revises the plan
 * on: two misses carrying one tag, inside one plan version. The explanation and
 * the revision then land as a single event he can feel, rather than as two
 * systems holding separate opinions about when he is stuck.
 */
export function shouldExplain(attempts: readonly Attempt[], step: PlanDay): boolean {
  const latest = latestMiss(attempts, step);
  if (!latest) return false;
  return sameTagMisses(attempts, latest).length >= 2;
}

/* ── the table ───────────────────────────────────────────────────────────── */

type Contrast = { verb: string; wrote: string; correct: string };

/**
 * Same-pattern verbs, drawn from the tutor's own closed set. Reaching outside it
 * would put a verb she never set in front of him — the thing `assertRevisionLegal`
 * refuses to let a revision do, and the reason is the same here: the week is hers.
 * The wider list is the fallback for a pattern her set happens not to cover twice.
 */
function siblingsOf(verb: StrongVerb, step: PlanDay): StrongVerb[] {
  const set = new Set(step.target_items.map((item) => normalizeAnswer(item)));
  const family = STRONG_VERBS.filter(
    (candidate) => candidate.shift === verb.shift && candidate.infinitive !== verb.infinitive,
  );
  const hers = family.filter((candidate) => set.has(candidate.infinitive));
  return hers.length > 0 ? hers : family;
}

function rowsFor(args: {
  step: PlanDay;
  gave: string;
  verb: StrongVerb;
  history: readonly Attempt[];
}): Contrast[] {
  const rows: Contrast[] = [
    { verb: args.verb.infinitive, wrote: clip(args.gave), correct: args.verb.past },
  ];

  // His own earlier misses beat any example we could invent: he typed them, and
  // seeing two of his own answers side by side IS the repetition being named. A
  // miss from a different vowel family is a different lesson, so it is skipped.
  for (const attempt of [...args.history].sort(byTime).reverse()) {
    if (rows.length >= MAX_ROWS - 1) break;
    const earlier = verbByWrongForm(attempt.gave);
    if (!earlier || earlier.shift !== args.verb.shift) continue;
    if (rows.some((row) => row.verb === earlier.infinitive)) continue;
    rows.push({ verb: earlier.infinitive, wrote: clip(attempt.gave), correct: earlier.past });
  }

  // Then one he has not been asked yet. Without it the table is a mark sheet;
  // with it, it is a rule he can use tomorrow.
  for (const sibling of siblingsOf(args.verb, args.step)) {
    if (rows.length >= MAX_ROWS) break;
    if (rows.some((row) => row.verb === sibling.infinitive)) continue;
    rows.push({
      verb: sibling.infinitive,
      wrote: regularised(sibling.infinitive),
      correct: sibling.past,
    });
  }

  return rows.slice(0, MAX_ROWS);
}

/**
 * One line, never a paragraph. He reads it above the keyboard, between two
 * questions, and the table underneath is doing the explaining.
 */
const LEAD: Record<Exclude<ErrorTag, "untagged">, string> = {
  "strong-verb-vowel": "these verbs change the vowel, they never take `-te`:",
  "wrong-auxiliary": "the auxiliary flips with this one:",
  "wrong-ending": "the stem is right, the ending is not:",
  "word-order": "right words, wrong order — the verb goes last:",
};

function tagOf(attempt: Attempt | null): Exclude<ErrorTag, "untagged"> {
  const tag = attempt?.error_tag;
  return tag && tag !== "untagged" ? tag : "wrong-ending";
}

/**
 * Show him WHY, in the chat, in one message.
 *
 * `attempts` is the append-only history INCLUDING the answer just recorded — so
 * pass `store.attemptsFor(student)` straight after `recordStudentTurn`. Call it
 * only when {@link shouldExplain} agrees.
 */
export function explainMiss(args: {
  step: PlanDay;
  gave: string;
  attempts: readonly Attempt[];
}): ChannelNode {
  const latest = latestMiss(args.attempts, args.step);
  const tag = tagOf(latest);
  const verb = verbByPast(args.step.expects);

  // Anything outside the strong-verb pattern has no family to line up, so it
  // gets the same shape with one row: his answer against the real one. Still a
  // grid, still in the chat — just without the third line that teaches.
  if (tag !== "strong-verb-vowel" || !verb) {
    return (
      <Message accent="#F5A623">
        <Section>
          <Markdown>{`Twice now — ${LEAD[tag]}`}</Markdown>
        </Section>
        <Table columns={[{ header: "✗" }, { header: "✓" }]}>
          <Row>
            <Cell>{clip(args.gave)}</Cell>
            <Cell>{clip(args.step.expects)}</Cell>
          </Row>
        </Table>
      </Message>
    );
  }

  const history = latest
    ? sameTagMisses(args.attempts, latest).filter(
        (attempt) => attempt.answered_at !== latest.answered_at || attempt.gave !== latest.gave,
      )
    : [];
  const rows = rowsFor({ step: args.step, gave: args.gave, verb, history });

  return (
    <Message accent="#F5A623">
      <Section>
        <Markdown>{`\`${clip(args.gave)}\` again — ${LEAD["strong-verb-vowel"]}`}</Markdown>
      </Section>
      <Table columns={[{ header: "verb" }, { header: "✗" }, { header: "✓" }]}>
        {rows.map((row) => (
          <Row key={row.verb}>
            <Cell>{row.verb}</Cell>
            <Cell>{row.wrote}</Cell>
            <Cell>{row.correct}</Cell>
          </Row>
        ))}
      </Table>
      <Context>
        {rows.length > 2
          ? `${verb.shift}, all ${rows.length} of them.`
          : `${verb.shift}, every time.`}
      </Context>
    </Message>
  );
}
