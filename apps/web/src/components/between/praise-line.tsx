import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { AMBER, SANS } from "./tokens";

export type PraiseLineProps = Extract<BriefComponent, { type: "PraiseLine" }>;

/**
 * Not a card. One warm line, small, understated — the aside between two
 * heavier things. It has no border, no background and no heading, so it reads
 * as a margin note rather than as another panel.
 */
export function PraiseLine({ line }: PraiseLineProps) {
  return (
    <p
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        margin: 0,
        padding: "10px 26px",
        fontFamily: SANS,
        fontSize: 13,
        lineHeight: 1.5,
        color: "#5A5140",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 6,
          height: 6,
          marginTop: 7,
          borderRadius: "50%",
          background: AMBER,
        }}
      />
      <span>{line}</span>
    </p>
  );
}

export default PraiseLine;
