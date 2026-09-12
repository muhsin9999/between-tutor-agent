import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { GREEN, HAIRLINE, INK, MONO, MUTED, PAPER, RED, SANS } from "./tokens";

export type ErrorGridProps = Extract<BriefComponent, { type: "ErrorGrid" }>;

/**
 * Dense, tabular, red. The opposite of QuietCard in every dimension that a
 * camera picks up: information density, rule weight, colour temperature.
 *
 * `gave` is the student's literal wrong answer and is rendered verbatim —
 * no trim, no capitalisation, no tidying. Tidied answers look synthesised.
 */
export function ErrorGrid({ rule, rows }: ErrorGridProps) {
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
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          background: "#FBEDEB",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: RED,
          }}
        >
          {rule}
        </span>
        <span style={{ fontSize: 11, color: RED, fontVariantNumeric: "tabular-nums" }}>
          {rows.length}&times;
        </span>
      </header>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 300,
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {["prompt", "he gave", "wanted"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "5px 10px",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
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
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${HAIRLINE}`,
                    color: INK,
                    lineHeight: 1.3,
                    verticalAlign: "top",
                  }}
                >
                  {row.prompt}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${HAIRLINE}`,
                    fontFamily: MONO,
                    fontSize: 13,
                    fontWeight: 600,
                    color: RED,
                    lineHeight: 1.3,
                    verticalAlign: "top",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {row.gave}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${HAIRLINE}`,
                    fontFamily: MONO,
                    fontSize: 13,
                    color: GREEN,
                    lineHeight: 1.3,
                    verticalAlign: "top",
                    whiteSpace: "pre-wrap",
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
