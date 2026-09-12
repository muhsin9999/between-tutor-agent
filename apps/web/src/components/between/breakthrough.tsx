import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { AMBER, INK, SERIF } from "./tokens";

export type BreakthroughProps = Extract<BriefComponent, { type: "Breakthrough" }>;

/**
 * A pull quote. One sentence he wrote, large, alone, with air around it.
 *
 * Nothing competes with the sentence. The day is an attribution in the margin,
 * set small enough that the eye lands on the words first and reads the day
 * second — the way a pull quote works in print.
 */
export function Breakthrough({ sentence, day }: BreakthroughProps) {
  return (
    <figure
      style={{
        margin: 0,
        background: "#FFFFFF",
        padding: "48px 26px 40px",
        borderTop: `3px solid ${AMBER}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          fontFamily: SERIF,
          fontSize: 52,
          lineHeight: 0.6,
          color: AMBER,
          marginBottom: 20,
        }}
      >
        &ldquo;
      </span>

      <blockquote
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontSize: 30,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
          color: INK,
        }}
      >
        {sentence}
      </blockquote>

      <figcaption
        style={{
          marginTop: 32,
          textAlign: "right",
          fontFamily: SERIF,
          fontSize: 12,
          fontStyle: "italic",
          color: "#9AA0B4",
        }}
      >
        &mdash; day {day}
      </figcaption>
    </figure>
  );
}

export default Breakthrough;
