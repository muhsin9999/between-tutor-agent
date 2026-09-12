# The two contracts — frozen at 13:10

← back to [BUILD.md](BUILD.md)

**B transcribes this into `packages/agent-core/src/contracts.ts` during [Gate 0](GATE-0.md).**
After 13:10 it changes only if both humans agree out loud, and the change is
announced in [STATUS.md](STATUS.md).

Why this file exists: two people and several agents are generating code in
parallel against shapes they cannot see each other define. Agree the shapes once
and the lanes never need to talk. Discover a mismatch at 14:00 and the build is over.

**The schema *is* the vocabulary.** `composeBrief`'s structured-output schema and
the panel's renderer read the same union, so a component the renderer doesn't
know about fails validation instead of rendering blank.

---

## Contract 1 — the plan document

A week is six days. The tutor's one line produces `days`; a revision rewrites only
the days that haven't happened yet and stores a new version beside the old one.

```ts
export type DayKind = "drill" | "produce" | "explain" | "checkin";

export type PlanDay = {
  day: 1 | 2 | 3 | 4 | 5 | 6;
  kind: DayKind;
  prompt: string;          // what the student is actually asked, in his language
  target_items: string[];  // the specific items under test, e.g. ["gehen", "sehen"]
  expects: string;         // what a correct answer looks like — graded against this
};

export type Plan = {
  student_id: string;
  version: number;         // 1, 2, 3 … never overwritten
  reason: string;          // ONE sentence. v1 is "initial plan from tutor's brief".
  created_at: string;      // ISO
  days: PlanDay[];         // always exactly 6
};
```

**Rules that are code, not preference:**

- A revision **may not extend the week** past day 6.
- A revision **may not add material outside the original `target_items` set.**
- The earlier version is **never overwritten.** v1 and v3 side by side is the evidence.

## Contract 2 — the component vocabulary

Seven components. The model picks which appear, in what order, holding what
contents. This union is the panel's renderer *and* the model's output schema.

```ts
export type BriefComponent =
  | { type: "Streak";       days_done: number; days_total: number; note?: string }
  | { type: "ErrorGrid";    rule: string; rows: { prompt: string; gave: string; wanted: string }[] }
  | { type: "AudioCompare"; item: string; student_audio_url: string; reference_text: string }
  | { type: "QuietCard";    last_seen_day: number; question: string }
  | { type: "Breakthrough"; sentence: string; day: number }
  | { type: "PraiseLine";   line: string }
  | { type: "PlanLane";     days: PlanDay[]; version: number; prior_version?: number };

export type Brief = {
  student_id: string;
  headline: string;              // one sentence the tutor reads first
  components: BriefComponent[];  // 2–5 of them. PlanLane is ALWAYS last.
};
```

**Rules:**

- `PlanLane` is **always last** and **always present.**
- `QuietCard` carries **no data, because there isn't any** — a last-seen day and one
  human question. Do not pad it with zeroes; the emptiness is the point.
- `AudioCompare` is the **first thing cut** — see [CUTS.md](CUTS.md). If cut, the union
  drops to six and the schema must drop it too, or the model will emit it.
- Between 2 and 5 components. A brief with all seven every week disproves the claim.

## Contract 3 — the student turn (small, but both lanes touch it)

```ts
export type Attempt = {
  student_id: string;
  plan_version: number;
  day: number;
  answered_at: string;      // ISO
  gave: string;
  correct: boolean;
  error_tag?: string;       // set only when correct === false, e.g. "strong-verb-vowel"
};
```

`error_tag` is what `ErrorGrid` groups by and what the "same tag twice" trigger
fires on. It comes from a **closed list** B defines in `evidence.ts` — a free-text
tag makes the grid unusable.

---

## The store

One JSON file, `.data/between.json`, through `packages/agent-core/src/store.ts`.
B owns it. Both processes read and write it.

```ts
export type Store = {
  students: Record<string, { id: string; name: string; chat_id: number; class_id?: string }>;
  tutor:    { chat_id: number | null };
  plans:    Plan[];         // all versions, append-only
  attempts: Attempt[];      // append-only
  seen_updates: number[];   // Telegram update ids, for dedupe
  clock:    { started_at: string; speed: string };  // "day:40s"
};
```

`read()` / `write(mutator)` — synchronous, whole-file, last-write-wins. It is a
demo; do not build a database. `reset()` deletes the file, which is how you get a
clean take.

---

## What each lane may assume

| A assumes | B assumes |
|---|---|
| `getDueStep(student_id)` returns a `PlanDay` or `null` | Telegram delivers `{chat_id, text, update_id}` |
| `recordAttempt(a: Attempt)` exists and is safe to call twice | The panel fetches `GET /api/brief?student_id=` |
| `getBrief(student_id)` returns a validated `Brief` | `Attempt.gave` is the raw student text, untrimmed |
| A never imports from `plan.ts`/`compose.ts` directly — only through `index.ts` | B never touches anything under `apps/channel/` |

Related: [LANE-A.md](LANE-A.md) · [LANE-B.md](LANE-B.md) · [FIXTURES.md](FIXTURES.md)
