import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { GREEN, GUTTER, HAIRLINE, INK, MONO, MUTED, PAPER, RED, SANS, TYPE } from "./tokens";

export type ErrorGridProps = Extract<BriefComponent, { type: "ErrorGrid" }>;

/**
 * Dense, tabular, red. The opposite of QuietCard in every dimension that a
 * camera picks up: information density, rule weight, colour temperature.
 *
 * `gave` is the student's literal wrong answer and is rendered verbatim —
 * no trim, no capitalisation, no tidying. Tidied answers look synthesised.
 *
 * The rule is a sentence, so it is set as one. Uppercasing a full clause and
 * tracking it out is what the eyebrow above it is for; doing it to the heading
 * costs legibility exactly where the tutor is reading for meaning.
 */
export function ErrorGrid({ rule, rows }: ErrorGridProps) {
  // The 4px red rule is part of the component's left edge, so the text inset is
  // reduced by exactly that much: the first character still lands on the same
  // vertical line as every other component's, rule or no rule.
  const INSET = GUTTER - 4;

  const cell: React.CSSProperties = {
    padding: "7px 10px",
    borderBottom: `1px solid ${HAIRLINE}`,
    lineHeight: 1.35,
    verticalAlign: "top",
  };

  return (
    <section
      aria-label={`Errors: ${rule}`}
      style={{
        background: PAPER,
        border: `1px solid ${HAIRLINE}`,
        borderLeft: `4px solid ${RED}`,
        fontFamily: SANS,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          padding: `11px ${INSET}px 12px`,
          background: "#FBEDEB",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <h2
          style={{
            flex: "1 1 auto",
            margin: 0,
            fontSize: TYPE.body,
            fontWeight: 650,
            lineHeight: 1.3,
            letterSpacing: "-0.005em",
            color: RED,
            textWrap: "balance",
          }}
        >
          {rule}
        </h2>
        <span
          style={{
            flex: "0 0 auto",
            fontSize: TYPE.fine,
            fontWeight: 700,
            color: RED,
            opacity: 0.7,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {rows.length}&times;
        </span>
      </header>

      {/* Its own scroll box. The table may be wider than a phone; the page
          behind it must never be. */}
      <div style={{ overflowX: "auto", overscrollBehaviorX: "contain" }}>
        <table
          style={{
            width: "100%",
            minWidth: 320,
            borderCollapse: "collapse",
            fontSize: TYPE.small,
          }}
        >
          <thead>
            <tr>
              {["prompt", "he gave", "wanted"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "7px 10px",
                    paddingLeft: i === 0 ? INSET : 10,
                    paddingRight: i === 2 ? INSET : 10,
                    fontSize: TYPE.micro,
                    fontWeight: 600,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: MUTED,
                    borderBottom: `1px solid ${HAIRLINE}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.prompt}-${i}`} style={{ background: i % 2 ? "#FAFAFC" : PAPER }}>
                <td style={{ ...cell, paddingLeft: INSET, color: INK }}>{row.prompt}</td>
                <td
                  style={{
                    ...cell,
                    fontFamily: MONO,
                    fontSize: TYPE.small,
                    fontWeight: 600,
                    color: RED,
                    whiteSpace: "pre-wrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.gave}
                </td>
                <td
                  style={{
                    ...cell,
                    paddingRight: INSET,
                    fontFamily: MONO,
                    fontSize: TYPE.small,
                    color: GREEN,
                    whiteSpace: "pre-wrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.wanted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ErrorGrid;
