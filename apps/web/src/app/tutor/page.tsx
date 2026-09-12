/**
 * The tutor's dashboard. Who needs me?
 *
 * A server component: it reads the store directly, so there is no fetch, no
 * loading state and no client JS for the list itself. The roster logic lives in
 * `lib/tutor-roster.ts`.
 *
 * VISUAL LAYER IS YOURS — restyle freely. The contract from the data side is
 * `RosterRow[]`, already sorted by need.
 */
import Link from "next/link";
import { roster, type Need, type RosterRow } from "../../lib/tutor-roster";

export const dynamic = "force-dynamic";

/**
 * Semantic status, deliberately separate from the amber brand accent. The accent
 * is identity; these are state. A reader should see who is in trouble before
 * parsing a single digit.
 */
const STATE: Record<Need, { label: string; fg: string; bg: string }> = {
  quiet:         { label: "Quiet",       fg: "#B3261E", bg: "#FBE9E7" },
  stuck:         { label: "Stuck",       fg: "#8A5200", bg: "#FAEDD4" },
  ahead:         { label: "Ahead",       fg: "#1F6B45", bg: "#E4F0E7" },
  "on-track":    { label: "On track",    fg: "#3A4A6B", bg: "#E8ECF5" },
  "not-started": { label: "Not started", fg: "#6B6F7E", bg: "#EDEAE1" },
};

export default async function TutorDashboard() {
  const rows = await roster();
  const needing = rows.filter((r) => r.need === "quiet" || r.need === "stuck").length;

  return (
    <main style={shell}>
      <header style={{ marginBottom: 30 }}>
        <p style={eyebrow}>Week of practice</p>
        <h1 style={h1}>
          {rows.length === 0
            ? "No students yet"
            : needing === 0
              ? "Everyone is moving."
              : `${needing} student${needing === 1 ? "" : "s"} need${needing === 1 ? "s" : ""} you this week.`}
        </h1>
      </header>

      {rows.length === 0 ? (
        <p style={empty}>
          Send a student your enrolment link from the bot, then send one line after
          their next lesson.
        </p>
      ) : (
        <ul style={list}>
          {rows.map((row) => (
            <StudentRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </main>
  );
}

function StudentRow({ row }: { row: RosterRow }) {
  const state = STATE[row.need];
  return (
    <li>
      <Link href={`/panel?student_id=${row.id}`} style={rowStyle}>
        <span style={{ ...stripe, background: state.fg }} aria-hidden="true" />

        <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <span style={nameStyle}>{row.name}</span>
          <span style={becauseStyle}>{row.because}</span>
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {row.revisedThisWeek && (
            <span style={revised} title="The plan changed this week">
              v{row.versions[0]}&rarr;v{row.versions[row.versions.length - 1]}
            </span>
          )}
          <span style={progress}>
            {row.daysDone}/{row.daysTotal}
          </span>
          <span style={{ ...pill, color: state.fg, background: state.bg }}>{state.label}</span>
        </span>
      </Link>
    </li>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */

const SANS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const shell: React.CSSProperties = {
  maxWidth: 680,
  margin: "0 auto",
  padding: "22px 20px 72px",
  fontFamily: SANS,
  color: "#1f2430",
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#8a8578",
};

const h1: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 26,
  lineHeight: 1.25,
  fontWeight: 600,
  color: "#16306B",
  textWrap: "balance",
};

const empty: React.CSSProperties = {
  margin: 0,
  color: "#5E6478",
  fontSize: 15,
  lineHeight: 1.6,
  maxWidth: "44ch",
};

const list: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 8,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  background: "#fff",
  border: "1px solid #E2D9C3",
  borderRadius: 3,
  padding: "14px 16px 14px 0",
  textDecoration: "none",
  color: "inherit",
  position: "relative",
  overflow: "hidden",
};

const stripe: React.CSSProperties = {
  width: 4,
  alignSelf: "stretch",
  flexShrink: 0,
  marginRight: 12,
};

const nameStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600 };

const becauseStyle: React.CSSProperties = {
  fontSize: 13.5,
  color: "#5E6478",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const progress: React.CSSProperties = {
  fontSize: 13,
  color: "#5E6478",
  fontVariantNumeric: "tabular-nums",
};

const revised: React.CSSProperties = {
  fontSize: 11.5,
  letterSpacing: "0.04em",
  color: "#16306B",
  background: "#E8ECF5",
  padding: "3px 7px",
  borderRadius: 2,
  fontVariantNumeric: "tabular-nums",
};

const pill: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  fontWeight: 600,
  padding: "4px 9px",
  borderRadius: 2,
  whiteSpace: "nowrap",
};
