/**
 * The signed-in shell.
 *
 * A slim rail on the left at desk width, a bar across the top on a phone. It
 * carries the mark, who you are, and two links — and then gets out of the way,
 * because the thing worth looking at is the roster, not the furniture.
 *
 * **This layout is the session guard.** Every route under `/app` renders inside
 * it, so a redirect here is a redirect for all of them, and there is no page a
 * signed-out visitor can reach by typing its URL. `getSession` returns `null`
 * rather than throwing when auth is unconfigured, which is the same answer as
 * "nobody is signed in" — so an unprovisioned server sends you to `/sign-in`,
 * where the page explains exactly what is missing, instead of showing a shell
 * that implies an account exists.
 *
 * The Telegram line beneath the name is read from the store and is real; per
 * AUTH.md it becomes `user.telegramUserId` once the link flow lands.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { persistence } from "agent-core";
import { getSession } from "@/lib/auth";
import { Nav } from "./_nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession(await headers());
  if (!session) redirect("/sign-in");

  // `persistence`, not `store`: the JSON file `store` reads does not exist on
  // Vercel, so this was always null in production.
  const tutorChat = (await persistence.read()).tutor.chat_id;
  const tutorName = session.user.name?.trim() || session.user.email;

  return (
    <div className="md:flex md:min-h-screen">
      <aside
        // Sticky on desktop: the roster scrolls, the rail does not. It is
        // capped at the viewport and scrolls internally only if the nav ever
        // outgrows the screen, so a long student list never pushes it away.
        className="border-b border-line bg-ink-850 md:sticky md:top-0 md:h-screen md:max-h-screen md:w-56 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 md:h-full md:flex-col md:items-stretch md:justify-start md:gap-8 md:py-6">
          <Link href="/app" className="flex items-baseline gap-2">
            <span className="font-display text-xl leading-none text-cream">Between</span>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
          </Link>

          <Nav />

          <div className="hidden md:mt-auto md:block">
            <p className="truncate text-sm text-cream" title={tutorName}>
              {tutorName}
            </p>
            <p className="mt-0.5 text-xs text-cream-faint">
              {tutorChat === null ? "Telegram not linked" : "Telegram linked"}
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}
