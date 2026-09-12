/** Async persistence boundary: Neon in configured environments, JSON for local tests. */
import type { Attempt, Plan, Store, Student } from "./contracts";
import { EMPTY_STORE } from "./contracts";
import { hasNeonDatabase, neonSql } from "./neon";
import * as json from "./store";

function clockDay(now: Date, state: Store): number {
  return json.currentDay(now, state);
}

async function neonRead(): Promise<Store> {
  const sql = neonSql();
  const [tutors, students, plans, attempts, updates, clocks] = await Promise.all([
    sql`SELECT telegram_chat_id FROM tutors ORDER BY created_at LIMIT 1`,
    sql`SELECT id, name, telegram_chat_id FROM students`,
    sql`SELECT student_id, version, reason, created_at, days FROM plans ORDER BY version`,
    sql`SELECT student_id, plan_version, day, answered_at, gave, correct, error_tag FROM attempts ORDER BY answered_at`,
    sql`SELECT update_id FROM telegram_updates ORDER BY received_at DESC LIMIT 500`,
    sql`SELECT started_at, speed FROM demo_clocks ORDER BY started_at DESC LIMIT 1`,
  ]);
  return {
    tutor: { chat_id: tutors[0] ? Number(tutors[0].telegram_chat_id) : null },
    students: Object.fromEntries(students.map((row) => [String(row.id), { id: String(row.id), name: String(row.name), chat_id: Number(row.telegram_chat_id) }])),
    plans: plans.map((row) => ({ student_id: String(row.student_id), version: Number(row.version), reason: String(row.reason), created_at: new Date(String(row.created_at)).toISOString(), days: row.days as Plan["days"] })),
    attempts: attempts.map((row) => ({ student_id: String(row.student_id), plan_version: Number(row.plan_version), day: Number(row.day), answered_at: new Date(String(row.answered_at)).toISOString(), gave: String(row.gave), correct: Boolean(row.correct), error_tag: row.error_tag ? String(row.error_tag) : null })) as Attempt[],
    seen_updates: updates.map((row) => Number(row.update_id)),
    clock: clocks[0] ? { started_at: new Date(String(clocks[0].started_at)).toISOString(), speed: String(clocks[0].speed) } : EMPTY_STORE.clock,
  };
}

async function tutorId(): Promise<string> {
  const state = await neonRead();
  if (state.tutor.chat_id === null) throw new Error("Tutor chat must be set before student persistence.");
  return `telegram:${state.tutor.chat_id}`;
}

export async function read(): Promise<Store> { return hasNeonDatabase() ? neonRead() : json.read(); }
export async function setTutorChat(chat_id: number): Promise<void> {
  if (!hasNeonDatabase()) return json.setTutorChat(chat_id);
  await neonSql()`INSERT INTO tutors (id, telegram_chat_id) VALUES (${`telegram:${chat_id}`}, ${chat_id}) ON CONFLICT (telegram_chat_id) DO NOTHING`;
}
export async function upsertStudent(student: Student): Promise<void> {
  if (!hasNeonDatabase()) return json.upsertStudent(student);
  await neonSql()`INSERT INTO students (id, tutor_id, name, telegram_chat_id) VALUES (${student.id}, ${await tutorId()}, ${student.name}, ${student.chat_id}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, telegram_chat_id = EXCLUDED.telegram_chat_id`;
}
export async function studentByChat(chat_id: number): Promise<Student | undefined> { return Object.values((await read()).students).find((s) => s.chat_id === chat_id); }
export async function addPlan(plan: Plan): Promise<void> {
  if (!hasNeonDatabase()) return json.addPlan(plan);
  await neonSql()`INSERT INTO plans (student_id, version, reason, created_at, days) VALUES (${plan.student_id}, ${plan.version}, ${plan.reason}, ${plan.created_at}, ${JSON.stringify(plan.days)}::jsonb)`;
}
export async function latestPlan(student_id: string): Promise<Plan | undefined> { return (await read()).plans.filter((p) => p.student_id === student_id).sort((a,b) => b.version-a.version)[0]; }
export async function planHistory(student_id: string): Promise<Plan[]> { return (await read()).plans.filter((p) => p.student_id === student_id).sort((a,b) => a.version-b.version); }
export async function addAttempt(attempt: Attempt): Promise<void> {
  if (!hasNeonDatabase()) return json.addAttempt(attempt);
  await neonSql()`INSERT INTO attempts (student_id, plan_version, day, answered_at, gave, correct, error_tag) VALUES (${attempt.student_id}, ${attempt.plan_version}, ${attempt.day}, ${attempt.answered_at}, ${attempt.gave}, ${attempt.correct}, ${attempt.error_tag ?? null})`;
}
export async function attemptsFor(student_id: string): Promise<Attempt[]> { return (await read()).attempts.filter((a) => a.student_id === student_id); }
export async function claimUpdate(update_id: number): Promise<boolean> {
  if (!hasNeonDatabase()) return json.claimUpdate(update_id);
  const rows = await neonSql()`INSERT INTO telegram_updates (update_id) VALUES (${update_id}) ON CONFLICT DO NOTHING RETURNING update_id`;
  return rows.length === 1;
}
export function currentDay(now = new Date(), state?: Store): number { return clockDay(now, state ?? json.read()); }
export async function startClock(speed = process.env.DEMO_SPEED ?? "day:40s", startedAt = new Date()): Promise<void> {
  if (!hasNeonDatabase()) return json.startClock(speed, startedAt);
  await neonSql()`INSERT INTO demo_clocks (tutor_id, started_at, speed) VALUES (${await tutorId()}, ${startedAt.toISOString()}, ${speed}) ON CONFLICT (tutor_id) DO UPDATE SET started_at = EXCLUDED.started_at, speed = EXCLUDED.speed`;
}
export async function dueStep(student_id: string, now = new Date()) {
  const state = await read(); const plan = state.plans.filter((p) => p.student_id === student_id).sort((a,b) => b.version-a.version)[0];
  if (!plan) return null; const day = currentDay(now, state); if (day < 1) return null;
  const answered = new Set(state.attempts.filter((a) => a.student_id === student_id).map((a) => a.day));
  return plan.days.find((d) => d.day <= day && !answered.has(d.day)) ?? null;
}
export async function resetDemo(): Promise<void> {
  if (!hasNeonDatabase()) return json.resetDemo();
  const sql = neonSql(); await sql`DELETE FROM attempts`; await sql`DELETE FROM plans`; await sql`DELETE FROM telegram_updates`; await sql`DELETE FROM demo_clocks`;
}
