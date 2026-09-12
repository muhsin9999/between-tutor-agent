import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { AMBER, GUTTER, HAIRLINE, INK, MUTED, PAPER, SANS, TYPE } from "./tokens";

export type StreakProps = Extract<BriefComponent, { type: "Streak" }>;

/**
 * Compact. A small instrument, not a page: six cells in a row, filled or not,
 * and a count. It is the only component in the set that reads as a widget, so
 * it is the only one that earns all four separating marks at once — border,
 * fill, radius and a hairline shadow — and it stays small enough that it never
 * competes with whatever sits above it.
 *
 * `alignSelf: flex-start` matters more than it looks: the renderer is a column
 * flexbox, so without it the `inline-flex` would be stretched to the full
 * column width by `align-items: stretch` and this would read as another
 * full-bleed card — exactly the thing it is not.
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
        alignSelf: "flex-start",
        display: "inline-flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: `calc(100% - ${GUTTER * 2}px)`,
        marginInline: GUTTER,
        background: PAPER,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(22, 48, 107, 0.06)",
        padding: "12px 14px 13px",
        fontFamily: SANS,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }} aria-hidden="true">
          {cells.map((filled, i) => (
            <span
              key={i}
              style={{
                width: 20,
                height: 24,
                borderRadius: 3,
                background: filled ? AMBER : "transparent",
                border: filled ? `1px solid ${AMBER}` : `1px solid ${HAIRLINE}`,
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontSize: TYPE.body,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: INK,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {days_done}
          <span style={{ color: MUTED, fontWeight: 500 }}>/{days_total}</span>
        </span>
      </div>

      {note === null ? null : (
        <span
          style={{
            fontSize: TYPE.fine,
            lineHeight: 1.45,
            color: MUTED,
            maxWidth: "26em",
            textWrap: "pretty",
          }}
        >
          {note}
        </span>
      )}
    </section>
  );
}

export default Streak;
