/**
 * The signed-in shell.
 *
 * A slim rail on the left at desk width, a bar across the top on a phone. It
 * carries the mark, who you are, and two links — and then gets out of the way,
 * because the thing worth looking at is the roster, not the furniture.
 *
 * The tutor's name is a placeholder until Better Auth lands (see AUTH.md); the
 * Telegram line beneath it is real, read from the store. Labelled honestly so
 * nobody mistakes the stub for a session.
 */
import Link from "next/link";
import { store } from "agent-core";
import { Nav } from "./_nav";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const tutorChat = store.read().tutor.chat_id;

  return (
    <div className="md:flex md:min-h-screen">
      <aside className="border-b border-line bg-ink-850 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 md:h-full md:flex-col md:items-stretch md:justify-start md:gap-8 md:py-6">
          <Link href="/app" className="flex items-baseline gap-2">
            <span className="font-display text-xl leading-none text-cream">Between</span>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
          </Link>

          <Nav />

          <div className="hidden md:mt-auto md:block">
            <p className="text-sm text-cream">Tutor</p>
            <p className="mt-0.5 text-xs text-cream-faint">
              {tutorChat === null ? "Telegram not linked" : "Telegram linked"}
            </p>
            <p className="mt-3 text-[11px] leading-snug text-cream-faint">
              Sign-in is not wired yet — this is the only account on the machine.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}
