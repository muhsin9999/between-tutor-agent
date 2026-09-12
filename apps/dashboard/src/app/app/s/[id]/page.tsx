/**
 * One student, this week.
 *
 * The revision reason is the most important sentence on this page. It is the
 * product's agency claim in the tutor's own terms: something changed the plan
 * while she was not looking, and here is the one line saying why. Everything
 * else on the screen is evidence for it, so it gets the serif, the space and the
 * amber rule — and it is never shown without the version numbers beside it.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { persistence, store } from "agent-core";
import type { Attempt, DayKind, Plan, PlanDay, Store } from "agent-core/contracts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { roster } from "@/lib/roster";
import { NEED_STYLE, stagger } from "../../_need";
import { WeekBar } from "../../_weekbar";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<DayKind, string> = {
  drill: "Drill",
  produce: "Produce",
  explain: "Explain",
  checkin: "Check-in",
};

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // One Neon read for the whole page. `store` reads a JSON file that does not
  // exist on Vercel, which rendered every student as notFound() in production.
  const state = await persistence.read();
  const student = state.students[id];
  if (!student) notFound();

  const history = state.plans
    .filter((p) => p.student_id === id)
    .sort((a, b) => a.version - b.version);
  const plan = history[history.length - 1];
  const attempts = state.attempts.filter((a) => a.student_id === id);
  const today = store.currentDay(new Date(), state);
  const session = await getSession(await headers());
  const rows = await roster(session?.user.telegramUserId ?? null);
  const row = rows.find((r) => r.id === id);

  // Scoped, so a student who is not hers is not hers to read — even by id.
  // Without this the roster filter would be cosmetic: anyone signed in could
  // type another tutor's student id into the URL and get the whole week.
  if (!row) notFound();
  const style = row ? NEED_STYLE[row.need] : NEED_STYLE["not-started"];

  const daysDone = new Set(attempts.map((a) => a.day)).size;
  const daysTotal = plan?.days.length ?? 6;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <header className="rise">
        <Link href="/app" className="text-xs text-cream-faint hover:text-cream-dim">
          &larr; All students
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl leading-none text-cream md:text-4xl">
            {student.name}
          </h1>
          <Badge tone={style.tone}>{style.label}</Badge>
        </div>

        <p className="mt-2 text-sm text-cream-dim">
          {row?.because ?? "No week set yet"}
          <span className="text-cream-faint"> · day {today} of 6</span>
        </p>

        <div className="mt-5 max-w-xs">
          <WeekBar done={daysDone} total={daysTotal} />
          <p className="mt-1.5 font-mono text-[11px] text-cream-faint">
            {daysDone}/{daysTotal} days answered
          </p>
        </div>
      </header>

      <Revision history={history} state={state} className="rise mt-8" style={stagger(1)} />

      <section className="rise mt-10" style={stagger(2)}>
        <h2 className="text-xs uppercase tracking-[0.14em] text-cream-faint">This week</h2>

        {!plan ? (
          <Card className="mt-4 p-6">
            <p className="text-sm leading-relaxed text-cream-dim">
              {student.name} has no week yet. Send the bot one line about their last lesson and the
              six days write themselves.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {plan.days.map((day, i) => (
              <li key={day.day} className="rise" style={stagger(i + 3)}>
                <DayCard
                  day={day}
                  attempts={attempts.filter((a) => a.day === day.day)}
                  due={day.day <= today}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <History />
    </div>
  );
}

/* ── the claim ───────────────────────────────────────────────────────────── */

function Revision({
  history,
  state,
  className,
  style,
}: {
  history: Plan[];
  /** Passed down so the demo clock comes from Neon, not a local JSON file. */
  state: Store;
  className?: string;
  style?: React.CSSProperties;
}) {
  const latest = history.at(-1);
  const prior = history.at(-2);

  if (!latest || !prior) {
    return (
      <Card className={`p-5 ${className ?? ""}`} style={style}>
        <p className="text-sm text-cream-dim">
          The plan has not changed this week.{" "}
          <span className="font-mono text-xs text-cream-faint">
            v{latest?.version ?? 1} still stands.
          </span>
        </p>
      </Card>
    );
  }

  const changedOn = store.currentDay(new Date(latest.created_at), state);

  return (
    <Card className={`border-amber/30 p-6 md:p-7 ${className ?? ""}`} style={style}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-amber">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
        The plan changed{changedOn > 0 ? ` on day ${changedOn}` : ""}
      </div>

      <p className="mt-4 text-pretty font-display text-2xl leading-snug text-cream md:text-[28px]">
        {latest.reason}
      </p>

      <p className="mt-4 font-mono text-xs text-cream-faint">
        v{prior.version} &rarr; v{latest.version} · the earlier version is kept, not overwritten
      </p>
    </Card>
  );
}

/* ── the week ────────────────────────────────────────────────────────────── */

function DayCard({ day, attempts, due }: { day: PlanDay; attempts: Attempt[]; due: boolean }) {
  const answered = attempts.length > 0;

  return (
    <Card className="p-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-cream-faint">Day {day.day}</span>
        <span className="text-xs uppercase tracking-[0.12em] text-cream-dim">
          {KIND_LABEL[day.kind]}
        </span>
        <span className="ml-auto text-xs text-cream-faint">
          {answered ? null : due ? "No answer yet" : "Not due yet"}
        </span>
      </div>

      <p className="mt-2 text-[15px] leading-relaxed text-cream">{day.prompt}</p>

      {day.target_items.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-cream-faint">{day.target_items.join(" · ")}</p>
      )}

      {answered && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {attempts.map((attempt, i) => (
            <li key={`${attempt.answered_at}-${i}`} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  attempt.correct ? "bg-ahead" : "bg-quiet"
                }`}
              />
              <p className="min-w-0 text-sm text-cream-dim">
                <span
                  className={
                    attempt.correct ? "text-cream" : "text-cream line-through decoration-quiet/60"
                  }
                >
                  {attempt.gave}
                </span>
                {!attempt.correct && (
                  <>
                    <span className="text-cream-faint"> wanted </span>
                    <span className="text-cream">{day.expects}</span>
                    {attempt.error_tag && attempt.error_tag !== "untagged" && (
                      <span className="ml-2 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-cream-faint">
                        {attempt.error_tag.replace(/-/g, " ")}
                      </span>
                    )}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── the part that makes a tutor pay, and is not built yet ───────────────── */

function History() {
  return (
    <section className="rise mt-12" style={stagger(7)}>
      <h2 className="text-xs uppercase tracking-[0.14em] text-cream-faint">History</h2>

      <Card className="mt-4 border-dashed border-line bg-transparent p-5">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          {["Week 1", "Week 2", "Week 3"].map((label) => (
            <span
              key={label}
              className="rounded border border-line px-2.5 py-1 font-mono text-[11px] text-cream-faint"
            >
              {label}
            </span>
          ))}
          <span className="font-mono text-[11px] text-cream-faint">…</span>
        </div>

        <p className="mt-4 max-w-prose text-sm leading-relaxed text-cream-dim">
          Week 1 against week 12 — did the thing you taught in March hold in June? Coming next;
          every plan version and attempt is already stored for it, so nothing is being lost while
          you wait.
        </p>
      </Card>
    </section>
  );
}
