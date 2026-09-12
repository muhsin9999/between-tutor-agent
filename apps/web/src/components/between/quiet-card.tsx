import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { CREAM, INK, MUTED, SANS, SERIF } from "./tokens";

export type QuietCardProps = Extract<BriefComponent, { type: "QuietCard" }>;

/**
 * A quiet week. Almost nothing on the card, on purpose.
 *
 * No number is rendered as a number, no track is drawn with zero cells filled,
 * no chart is drawn empty. If this ever grows a metric, the back-to-back shot
 * against ErrorGrid stops reading and the product's central claim goes with it.
 */
export function QuietCard({ last_seen_day, question }: QuietCardProps) {
  const since =
    last_seen_day === 0
      ? "He hasn't answered anything this week."
      : `The last you heard from him was day ${last_seen_day}.`;

  return (
    <section
      aria-label="A quiet week"
      style={{
        background: CREAM,
        padding: "72px 28px 84px",
        fontFamily: SANS,
      }}
    >
      <p
        style={{
          margin: "0 0 56px",
          fontSize: 12,
          lineHeight: 1.6,
          letterSpacing: "0.02em",
          color: MUTED,
          maxWidth: "22em",
        }}
      >
        {since}
      </p>

      <p
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontSize: 26,
          lineHeight: 1.45,
          color: INK,
          maxWidth: "17em",
          fontWeight: 400,
        }}
      >
        {question}
      </p>

      <p
        style={{
          margin: "56px 0 0",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#B7AE99",
        }}
      >
        Ask him this first
      </p>
    </section>
  );
}

export default QuietCard;
