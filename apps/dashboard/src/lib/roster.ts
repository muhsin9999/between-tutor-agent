/**
 * The roster behind the tutor's dashboard.
 *
 * SERVER ONLY — reads the store, which imports node:fs.
 *
 * The panel answers "how did Jonas's week go". This answers the question a tutor
 * with twenty clients actually has on a Sunday night: **who needs me?**
 *
 * Everything here is computed in code from attempt rows — the same discipline as
 * `evidence.ts`. A list does not need a model, and a model here would add three
 * seconds and nothing else.
 *
 * Re-homed from `apps/web/src/lib/tutor-roster.ts`. The prototype proved it
 * reads well; the dashboard is where it lives now.
 *
 * **It reads `persistence`, not `store`.** `store` is the synchronous JSON file
 * under `.data/`, which exists on a laptop and NOWHERE on Vercel — a serverless
 * function gets a fresh, empty filesystem. Reading it in production returned an
 * empty roster for every tutor, always, no matter how many students the bot had
 * actually enrolled: the dashboard and the bot were looking at two different
 * databases. `persistence` is the async one that uses Neon when `DATABASE_URL`
 * is set and falls back to the same JSON file when it is not, so this works in
 * both places. That is why `roster()` is async.
 */
import { persistence, store } from "agent-core";
import type { Attempt, Plan } from "agent-core/contracts";

/** Ordered by urgency. The array order IS the sort order — see `compareNeed`. */
export const NEED_ORDER = ["quiet", "stuck", "ahead", "on-track", "not-started"] as const;
export type Need = (typeof NEED_ORDER)[number];

export type RosterRow = {
  id: string;
  name: string;
  need: Need;
  /** One short line saying why this row is where it is. */
  because: string;
  day: number;
  daysDone: number;
  daysTotal: number;
  lastSeenDay: number;
  /** Every plan version so far. Length > 1 means the agent revised this week. */
  versions: number[];
  revisedThisWeek: boolean;
};

function lastSeen(attempts: Attempt[]): number {
  return attempts.reduce((latest, a) => Math.max(latest, a.day), 0);
}

function repeatedErrorTag(attempts: Attempt[]): string | null {
  const counts = new Map<string, number>();
  for (const a of attempts) {
    if (a.correct || !a.error_tag || a.error_tag === "untagged") continue;
    counts.set(a.error_tag, (counts.get(a.error_tag) ?? 0) + 1);
  }
  for (const [tag, n] of counts) if (n >= 2) return tag;
  return null;
}

function correctStreak(attempts: Attempt[]): number {
  let streak = 0;
  for (const a of [...attempts].reverse()) {
    if (!a.correct) break;
    streak += 1;
  }
  return streak;
}

function assess(
  plan: Plan | undefined,
  attempts: Attempt[],
  day: number,
): { need: Need; because: string } {
  if (!plan) return { need: "not-started", because: "No week set yet" };

  const seen = lastSeen(attempts);

  // Quiet outranks everything. Someone who has stopped is the only person on
  // this list who will not come back on their own.
  if (day - seen >= 2) {
    return {
      need: "quiet",
      because: seen === 0 ? "Never started this week" : `Nothing since day ${seen}`,
    };
  }

  const tag = repeatedErrorTag(attempts);
  if (tag) {
    return { need: "stuck", because: `Same error twice — ${tag.replace(/-/g, " ")}` };
  }

  if (correctStreak(attempts) >= 3) {
    return { need: "ahead", because: `${correctStreak(attempts)} correct in a row` };
  }

  return { need: "on-track", because: `Day ${seen} of 6 done` };
}

const rank = (need: Need) => NEED_ORDER.indexOf(need);

/** Quiet first, then stuck, then ahead, then on track. Never alphabetical. */
export function compareNeed(a: RosterRow, b: RosterRow): number {
  const byNeed = rank(a.need) - rank(b.need);
  if (byNeed !== 0) return byNeed;
  // Within a bucket, whoever has been silent longest comes first.
  return a.lastSeenDay - b.lastSeenDay;
}

export async function roster(now: Date = new Date()): Promise<RosterRow[]> {
  const state = await persistence.read();
  const day = store.currentDay(now, state);

  // One read, then everything derived from it in memory. A per-student query
  // here would be one Neon round trip per row on a page that renders every row.
  const rows = Object.values(state.students).map((student): RosterRow => {
    const history = state.plans
      .filter((p) => p.student_id === student.id)
      .sort((a, b) => a.version - b.version);
    const plan = history[history.length - 1];
    const attempts = state.attempts.filter((a) => a.student_id === student.id);
    const versions = history.map((p) => p.version);
    const { need, because } = assess(plan, attempts, day);

    return {
      id: student.id,
      // A student who has tapped his invite but not yet typed his name is a real
      // row with an empty name. He belongs on the roster — she needs to see the
      // tap landed — but a blank line reads as a rendering bug, so he is labelled.
      name: student.name.trim() || "Just joined — no name yet",
      need,
      because,
      day,
      daysDone: new Set(attempts.map((a) => a.day)).size,
      daysTotal: plan?.days.length ?? 6,
      lastSeenDay: lastSeen(attempts),
      versions,
      revisedThisWeek: versions.length > 1,
    };
  });

  return rows.sort(compareNeed);
}
