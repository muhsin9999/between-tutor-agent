import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { AMBER, GUTTER, INK, MUTED, SANS, SERIF, TYPE } from "./tokens";

export type BreakthroughProps = Extract<BriefComponent, { type: "Breakthrough" }>;

/**
 * A pull quote. One sentence he wrote, large, alone, with air around it.
 *
 * It has no fill and no frame on purpose. A pull quote lives *in* the page, not
 * in a box beside it: the moment this grows a white ground and a top rule it
 * becomes the third card in a stack of cards and the sentence stops being the
 * loudest thing on the screen. What it spends instead is size and whitespace.
 *
 * The day is an attribution, set small enough that the eye lands on the words
 * first and reads the day second — the way a pull quote works in print.
 */
export function Breakthrough({ sentence, day }: BreakthroughProps) {
  return (
    <figure
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        margin: 0,
        padding: `20px ${GUTTER}px 24px`,
        maxWidth: "20em",
      }}
    >
      <blockquote
        style={{
          position: "relative",
          margin: 0,
          fontFamily: SERIF,
          // Big on a phone, bigger on a desktop, never wider than its measure.
          fontSize: "clamp(25px, 6.6vw, 31px)",
          lineHeight: 1.25,
          letterSpacing: "-0.015em",
          color: INK,
          textWrap: "balance",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            // Hung into the margin so the first letter, not the mark, keeps the
            // reading edge the rest of the panel is set against.
            left: "-0.42em",
            top: "-0.06em",
            fontFamily: SERIF,
            fontSize: "1.9em",
            lineHeight: 1,
            color: AMBER,
          }}
        >
          &ldquo;
        </span>
        {sentence}
      </blockquote>

      <figcaption
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: SANS,
          fontSize: TYPE.micro,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MUTED,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span aria-hidden="true" style={{ width: 22, height: 1, background: AMBER }} />
        day {day}
      </figcaption>
    </figure>
  );
}

export default Breakthrough;
