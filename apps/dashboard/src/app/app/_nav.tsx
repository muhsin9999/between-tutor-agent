"use client";

/**
 * The only client component in the signed-in area, and it exists for one
 * reason: a rail that does not say where you are is a rail you stop reading.
 * `usePathname` is the whole of it — no state, no effects.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Students" },
  { href: "/app/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app" || pathname.startsWith("/app/s");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname() ?? "/app";

  return (
    <nav aria-label="Sections" className="flex gap-1 md:flex-col">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-md px-3 py-2 text-sm transition-colors duration-150",
              active
                ? "bg-ink-800 text-cream"
                : "text-cream-dim hover:bg-ink-850 hover:text-cream",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
