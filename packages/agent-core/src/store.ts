/**
 * T-B1 — the store. One JSON file, `.data/between.json`.
 *
 * SERVER ONLY — this imports node:fs. Never re-export it from shared.ts, or the
 * panel's browser bundle fails with "Can't resolve 'fs'".
 *
 * Two processes read and write this: the Telegram channel (apps/channel) and the
 * panel's API routes (apps/web). They run on the same machine, so a whole-file
 * read/modify/write with an atomic rename is sufficient and costs zero setup.
 * This is not a database and must not become one — it is the thing that lets you
 * delete one file and get a clean take at 14:50.
 *
 * Concurrency: last-write-wins on the whole file, so `update()` re-reads inside
 * the call rather than trusting a value read earlier. `plans` and `attempts` are
 * append-only, which is what makes that safe in practice — two processes
 * appending different rows cannot lose each other's work unless they collide
 * inside the same millisecond, and nothing in this demo writes that fast.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { EMPTY_STORE, type Attempt, type Plan, type Store, type Student } from "./contracts";

/** Repo root, walking up from this file — both apps then share one file. */
function defaultPath(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "package-lock.json"))) break;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return join(dir, ".data", "between.json");
}

const FILE = process.env.BETWEEN_STORE ?? defaultPath();

export function storePath(): string {
  return FILE;
}

export function read(): Store {
  if (!existsSync(FILE)) return structuredClone(EMPTY_STORE);
  try {
    return { ...structuredClone(EMPTY_STORE), ...JSON.parse(readFileSync(FILE, "utf8")) } as Store;
  } catch {
    // A torn write beats a crashed bot mid-take. Start clean and say so.
    console.warn(`[store] ${FILE} was unreadable; starting from empty.`);
    return structuredClone(EMPTY_STORE);
  }
}

/** Read-modify-write. The mutator gets the CURRENT store, never a stale one. */
export function update<T>(mutator: (store: Store) => T): T {
  const store = read();
  const result = mutator(store);
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  const contents = JSON.stringify(store, null, 2);
  writeFileSync(tmp, contents, "utf8");
  try {
    renameSync(tmp, FILE); // atomic on the same volume
  } catch (cause) {
    // OneDrive can momentarily hold the destination open on Windows. Retain the
    // atomic path normally, but do not let a transient sync lock kill a live
    // demo turn. The complete temp file is already written, so a direct replace
    // is the least surprising fallback for this single-machine prototype.
    const code = (cause as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EACCES") throw cause;
    writeFileSync(FILE, contents, "utf8");
    rmSync(tmp, { force: true });
  }
  return result;
}

/** How you get a clean take. Rehearse this before you need it. */
export function reset(): void {
  rmSync(FILE, { force: true });
}

/* ── identities ──────────────────────────────────────────────────────────── */

export function setTutorChat(chat_id: number): void {
  update((s) => {
    s.tutor.chat_id = chat_id;
  });
}

export function upsertStudent(student: Student): void {
  update((s) => {
    s.students[student.id] = { ...s.students[student.id], ...student };
  });
}

export function studentByChat(chat_id: number): Student | undefined {
  return Object.values(read().students).find((s) => s.chat_id === chat_id);
}

/* ── plans — append-only, every version kept ─────────────────────────────── */

/**
 * The earlier version is NEVER overwritten. v1 and v3 side by side is the
 * evidence, and it is what the camera points at.
 */
export function addPlan(plan: Plan): void {
  update((s) => {
    const clash = s.plans.find(
      (p) => p.student_id === plan.student_id && p.version === plan.version,
    );
    if (clash) throw new Error(`Plan v${plan.version} already exists for ${plan.student_id}.`);
    s.plans.push(plan);
  });
}

export function latestPlan(student_id: string): Plan | undefined {
  return read()
    .plans.filter((p) => p.student_id === student_id)
    .sort((a, b) => b.version - a.version)[0];
}

export function planHistory(student_id: string): Plan[] {
  return read()
    .plans.filter((p) => p.student_id === student_id)
    .sort((a, b) => a.version - b.version);
}

/* ── attempts ────────────────────────────────────────────────────────────── */

export function addAttempt(attempt: Attempt): void {
  update((s) => {
    s.attempts.push(attempt);
  });
}

export function attemptsFor(student_id: string): Attempt[] {
  return read().attempts.filter((a) => a.student_id === student_id);
}

/* ── Telegram dedupe ─────────────────────────────────────────────────────── */

/**
 * A re-delivered update posting a duplicate message is the classic third-take
 * killer. Returns true the FIRST time an id is seen, false every time after.
 */
export function claimUpdate(update_id: number): boolean {
  return update((s) => {
    if (s.seen_updates.includes(update_id)) return false;
    s.seen_updates.push(update_id);
    if (s.seen_updates.length > 500) s.seen_updates = s.seen_updates.slice(-500);
    return true;
  });
}

/* ── the demo clock ──────────────────────────────────────────────────────── */

/** "day:40s" -> 40000. Anything unparseable falls back to 40s rather than throwing. */
export function msPerDay(speed = read().clock.speed): number {
  const match = /^day:(\d+)(ms|s|m)$/.exec(speed.trim());
  if (!match) return 40_000;
  const value = Number(match[1]);
  return match[2] === "ms" ? value : match[2] === "m" ? value * 60_000 : value * 1_000;
}

export function startClock(
  speed = process.env.DEMO_SPEED ?? "day:40s",
  startedAt: Date = new Date(),
): void {
  update((s) => {
    s.clock = { started_at: startedAt.toISOString(), speed };
  });
}

/**
 * Reset a rehearsal without making the tutor and student enrol again. Plans and
 * attempts are session state; identities are the one bit worth keeping between
 * takes. This deliberately also clears seen update ids, otherwise replaying a
 * scripted Telegram take would be ignored as a duplicate.
 */
/**
 * Start a fresh week for ONE student: drop their plans and answers, keep
 * everyone else's and keep the enrolment.
 *
 * A tutor sends a line at the end of every lesson, so the second line about the
 * same student is the normal case, not an edge case. `planWeek` always returns
 * version 1 and `plans` is keyed on (student_id, version), so without this the
 * second line hit a duplicate key, the insert threw, and her turn died in
 * silence — she typed her line and nothing whatsoever came back.
 */
export function startWeek(student_id: string): void {
  update((s) => {
    s.plans = s.plans.filter((p) => p.student_id !== student_id);
    s.attempts = s.attempts.filter((a) => a.student_id !== student_id);
  });
}

export function resetDemo(): void {
  update((s) => {
    s.plans = [];
    s.attempts = [];
    s.seen_updates = [];
    s.clock = { started_at: new Date(0).toISOString(), speed: process.env.DEMO_SPEED ?? "day:40s" };
  });
}

/**
 * Which of the six days we are on. 0 before the clock starts, capped at 6.
 * Every beat of this demo depends on time passing — this is why the clock is
 * built at 13:30 and not at 15:00.
 */
export function currentDay(now: Date = new Date(), store: Store = read()): number {
  const started = Date.parse(store.clock.started_at);
  if (!Number.isFinite(started) || started <= 0) return 0;
  const elapsed = now.getTime() - started;
  if (elapsed < 0) return 0;
  return Math.min(6, Math.floor(elapsed / msPerDay(store.clock.speed)) + 1);
}

/** The step that is due now, or null when the student is up to date. */
export function dueStep(student_id: string, now: Date = new Date()) {
  const plan = latestPlan(student_id);
  if (!plan) return null;
  const day = currentDay(now);
  if (day < 1) return null;
  const answered = new Set(attemptsFor(student_id).map((a) => a.day));
  return plan.days.find((d) => d.day <= day && !answered.has(d.day)) ?? null;
}
