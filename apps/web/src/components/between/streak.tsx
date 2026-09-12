import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { AMBER, HAIRLINE, INK, MUTED, PAPER, SANS } from "./tokens";

export type StreakProps = Extract<BriefComponent, { type: "Streak" }>;

/**
 * Compact. A small instrument, not a page: six cells in a row, filled or not,
 * and a count. It is the only component in the set that reads as a widget, and
 * it stays small enough that it never competes with whatever sits above it.
 *
 * `note` is nullable, not optional — an explicit `null` means "no line", and
 * the row below simply does not exist.
 */
export function Streak({ days_done, days_total, note }: StreakProps) {
  const cells = Array.from({ length: days_total }, (_, i) => i < days_done);

  return (
    <section
      aria-label={`${days_done} of ${days_total} days answered`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 8,
        background: PAPER,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 8,
        padding: "12px 14px",
        fontFamily: SANS,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
          {cells.map((filled, i) => (
            <span
              key={i}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                background: filled ? AMBER : "transparent",
                border: filled ? `1px solid ${AMBER}` : `1px solid ${HAIRLINE}`,
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: INK,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {days_done}/{days_total}
        </span>
      </div>

      {note === null ? null : (
        <span style={{ fontSize: 12, lineHeight: 1.4, color: MUTED }}>{note}</span>
      )}
    </section>
  );
}

export default Streak;
