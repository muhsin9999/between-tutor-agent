/** One-way, idempotent bootstrap of local rehearsal state into Neon. */
import { neonSql, store } from "agent-core";

const snapshot = store.read();
const tutorChatId = snapshot.tutor.chat_id;

if (tutorChatId === null) {
  console.log("No enrolled tutor in the JSON store; Neon schema is ready and no data needs copying.");
  process.exit(0);
}

const sql = neonSql();
const tutorId = `telegram:${tutorChatId}`;

await sql`INSERT INTO tutors (id, telegram_chat_id) VALUES (${tutorId}, ${tutorChatId}) ON CONFLICT (id) DO NOTHING`;

for (const student of Object.values(snapshot.students)) {
  await sql`
    INSERT INTO students (id, tutor_id, name, telegram_chat_id)
    VALUES (${student.id}, ${tutorId}, ${student.name}, ${student.chat_id})
    ON CONFLICT (id) DO NOTHING
  `;
}

for (const plan of snapshot.plans) {
  await sql`
    INSERT INTO plans (student_id, version, reason, created_at, days)
    VALUES (${plan.student_id}, ${plan.version}, ${plan.reason}, ${plan.created_at}, ${JSON.stringify(plan.days)}::jsonb)
    ON CONFLICT (student_id, version) DO NOTHING
  `;
}

for (const attempt of snapshot.attempts) {
  await sql`
    INSERT INTO attempts (student_id, plan_version, day, answered_at, gave, correct, error_tag)
    VALUES (${attempt.student_id}, ${attempt.plan_version}, ${attempt.day}, ${attempt.answered_at}, ${attempt.gave}, ${attempt.correct}, ${attempt.error_tag ?? null})
    ON CONFLICT DO NOTHING
  `;
}

for (const updateId of snapshot.seen_updates) {
  await sql`INSERT INTO telegram_updates (update_id) VALUES (${updateId}) ON CONFLICT DO NOTHING`;
}

await sql`
  INSERT INTO demo_clocks (tutor_id, started_at, speed)
  VALUES (${tutorId}, ${snapshot.clock.started_at}, ${snapshot.clock.speed})
  ON CONFLICT (tutor_id) DO UPDATE SET started_at = EXCLUDED.started_at, speed = EXCLUDED.speed
`;

console.log(`Migrated ${Object.keys(snapshot.students).length} students, ${snapshot.plans.length} plans, and ${snapshot.attempts.length} attempts to Neon.`);
