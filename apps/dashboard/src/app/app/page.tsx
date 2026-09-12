/**
 * The roster. Who needs me?
 *
 * A server component: it reads the store directly, so there is no fetch, no
 * loading state and no client JS for the list itself. The order of these rows is
 * the product — quiet first, because the student who has stopped is the only one
 * on the list who will not come back on her own.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { roster, type RosterRow } from "@/lib/roster";
import { WeekBar } from "./_weekbar";
import { NEED_STYLE, stagger } from "./_need";
import { AddStudent } from "./add-student";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  // The roster is scoped to whoever is signed in. The layout has already
  // redirected anyone without a session, so this is never anonymous.
  const session = await getSession(await headers());
  const telegramUserId = session?.user.telegramUserId ?? null;
  const rows = await roster(telegramUserId);
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
            ? telegramUserId
              ? "No students yet."
              : "Connect Telegram to see your students."
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
        {telegramUserId ? (
          <AddStudent empty={rows.length === 0} />
        ) : (
          /*
            Without a linked Telegram account there is nothing to show and no
            invite to mint — an invite carries her Telegram id, which is how the
            bot knows whose student he is. So this replaces the add form rather
            than sitting next to a version of it that can only fail.
          */
          <div className="rounded-lg border border-line bg-ink-850 p-6 sheet">
            <p className="text-[15px] text-cream">Your Telegram account isn&apos;t connected yet.</p>
            <p className="mt-2 text-sm text-cream-dim">
              Your students live in Telegram, and an invite carries your Telegram
              id — it is how the bot knows whose student someone is. Connect it
              once and your roster fills in.
            </p>
            <Link
              href="/app/settings"
              className="mt-4 inline-flex items-center rounded-md bg-amber px-3.5 py-2 text-sm font-medium text-white transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Connect Telegram
            </Link>
          </div>
        )}
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
