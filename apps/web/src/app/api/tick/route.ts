import { store } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNow(value: string | null): Date | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  const parsed = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * The demo clock. Production would be driven by a scheduler; the demo injects
 * `?now=` so six days can pass in minutes without pretending rows were seeded
 * in the past. It only reports due work — the Telegram process owns delivery.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const suppliedNow = url.searchParams.get("now");
  const now = parseNow(suppliedNow);
  if (suppliedNow && !now) {
    return Response.json({ error: "now must be an ISO date or Unix milliseconds." }, { status: 400 });
  }

  const clockNow = now ?? new Date();
  if (store.currentDay(clockNow) === 0) {
    store.startClock(process.env.DEMO_SPEED ?? "day:40s", clockNow);
  }

  const snapshot = store.read();
  const day = store.currentDay(clockNow, snapshot);
  const due = Object.values(snapshot.students)
    .map((student) => ({ student_id: student.id, step: store.dueStep(student.id, clockNow) }))
    .filter((entry) => entry.step !== null);

  return Response.json({
    now: clockNow.toISOString(),
    day,
    speed: snapshot.clock.speed,
    due,
  });
}

/** A clean rehearsal while preserving the tutor/student enrolment. */
export async function POST() {
  store.resetDemo();
  return Response.json({ ok: true, preserved: ["students", "tutor"] });
}
