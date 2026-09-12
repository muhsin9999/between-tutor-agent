import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { AMBER, GUTTER, SANS, TYPE } from "./tokens";

export type PraiseLineProps = Extract<BriefComponent, { type: "PraiseLine" }>;

/**
 * Not a card. One warm line, small, understated — the aside between two
 * heavier things. No border, no fill, no radius, no heading: the only marks it
 * spends are a single amber tick and the air the renderer's gap gives it, so
 * the eye files it as a note in the margin rather than as another panel.
 *
 * The measure is capped well under the column width. A margin note that runs
 * the full width of the things above and below it stops being a margin note.
 */
export function PraiseLine({ line }: PraiseLineProps) {
  return (
    <p
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        margin: 0,
        padding: `2px ${GUTTER}px`,
        maxWidth: "34em",
        fontFamily: SANS,
        fontSize: TYPE.small,
        lineHeight: 1.55,
        color: "#5A5140",
        textWrap: "pretty",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 2,
          alignSelf: "stretch",
          minHeight: "1.55em",
          background: AMBER,
          opacity: 0.85,
        }}
      />
      <span>{line}</span>
    </p>
  );
}

export default PraiseLine;
