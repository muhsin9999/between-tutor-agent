/**
 * The roster. Who needs me?
 *
 * A server component: it reads the store directly, so there is no fetch, no
 * loading state and no client JS for the list itself. The order of these rows is
 * the product — quiet first, because the student who has stopped is the only one
 * on the list who will not come back on her own.
 */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { roster, type RosterRow } from "@/lib/roster";
import { WeekBar } from "./_weekbar";
import { NEED_STYLE, stagger } from "./_need";
import { AddStudent } from "./add-student";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const rows = await roster();
  const needing = rows.filter((r) => r.need === "quiet" || r.need === "stuck").length;
  const day = rows[0]?.day ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <header className="rise">
        <p className="text-xs uppercase tracking-[0.14em] text-cream-faint">
          {day === 0 ? "Between lessons" : `Between lessons · day ${day} of 6`}
        </p>
        <h1 className="mt-3 text-pretty font-display text-3xl leading-tight text-cream md:text-4xl">
          {rows.length === 0
            ? "No students yet."
            : needing === 0
              ? "Everyone is moving."
              : `${needing} student${needing === 1 ? "" : "s"} need${needing === 1 ? "s" : ""} you this week.`}
        </h1>
        {rows.length > 0 && (
          <p className="mt-2 text-sm text-cream-dim">
            {needing === 0
              ? "Nobody has gone quiet and nobody is repeating the same mistake. Read the week before your next lesson."
              : "Sorted by who will not fix this on their own. Start at the top."}
          </p>
        )}
      </header>

      {/*
        Add student sits above the roster, always. When the roster is empty this
        card IS the empty state — a dead end and the way out of it should not be
        two separate boxes, so there is no second "no students yet" message here.
      */}
      <div className="rise mt-8" style={stagger(1)}>
        <AddStudent empty={rows.length === 0} />
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((row, i) => (
            <li key={row.id} className="rise" style={stagger(i + 2)}>
              <StudentRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentRow({ row }: { row: RosterRow }) {
  const style = NEED_STYLE[row.need];

  return (
    <Link href={`/app/s/${row.id}`} className="block rounded-lg">
      <Card interactive className="relative flex items-center gap-4 overflow-hidden p-4">
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-0.5 ${style.stripe}`} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-cream">{row.name}</p>
          <p className="mt-0.5 truncate text-sm text-cream-dim">{row.because}</p>
        </div>

        {row.revisedThisWeek && (
          <span
            title="The plan changed this week"
            className="hidden shrink-0 rounded border border-amber/30 px-1.5 py-0.5 font-mono text-[11px] text-amber sm:inline"
          >
            v{row.versions[0]}&rarr;v{row.versions[row.versions.length - 1]}
          </span>
        )}

        <div className="hidden w-28 shrink-0 sm:block">
          <WeekBar done={row.daysDone} total={row.daysTotal} />
          <p className="mt-1.5 text-right font-mono text-[11px] text-cream-faint">
            {row.daysDone}/{row.daysTotal}
          </p>
        </div>

        <Badge tone={style.tone} className="shrink-0">
          {style.label}
        </Badge>
      </Card>
    </Link>
  );
}
