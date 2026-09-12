/**
 * The dashboard's own shell.
 *
 * /tutor and /panel are two views of the same product but two different jobs:
 * the dashboard is the week across every student, the panel is one student's
 * week. They share a palette and a nav; everything else differs, because the
 * questions differ.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your students — Between",
  description: "Who needs you this week.",
};

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#FBF5E6", minHeight: "100vh" }}>
      <nav style={nav}>
        <Link href="/tutor" style={brand}>
          <svg width="20" height="20" viewBox="0 0 54 54" aria-hidden="true">
            <rect width="54" height="54" rx="12" fill="#16306B" />
            <rect x="14" y="13" width="6.5" height="28" rx="3.25" fill="#FBF5E6" />
            <rect x="33.5" y="13" width="6.5" height="28" rx="3.25" fill="#FBF5E6" />
            <circle cx="27" cy="19" r="2.6" fill="#F5A623" />
            <circle cx="27" cy="27" r="2.6" fill="#F5A623" />
            <circle cx="27" cy="35" r="2.6" fill="#F5A623" />
          </svg>
          Between
        </Link>
        <span style={hint}>Tutor</span>
      </nav>
      {children}
    </div>
  );
}

const nav: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  maxWidth: 680,
  margin: "0 auto",
  padding: "16px 20px 0",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
  color: "#16306B",
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: "-0.01em",
};

const hint: React.CSSProperties = {
  fontSize: 11.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#8a8578",
};
