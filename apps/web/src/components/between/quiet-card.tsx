import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { GUTTER, HAIRLINE, INK, MUTED, SANS, SERIF, TYPE } from "./tokens";

export type QuietCardProps = Extract<BriefComponent, { type: "QuietCard" }>;

/**
 * A quiet week. Almost nothing on the card, on purpose.
 *
 * No number is rendered as a number, no track is drawn with zero cells filled,
 * no chart is drawn empty. If this ever grows a metric, the back-to-back shot
 * against ErrorGrid stops reading and the product's central claim goes with it.
 *
 * The only thing it spends is vertical space, which is why the whitespace here
 * is deliberately larger than anywhere else in the set: emptiness only reads as
 * a finding if there is enough of it to look chosen.
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
        display: "flex",
        flexDirection: "column",
        gap: 48,
        // No fill: the page's own cream shows through, so this reads as a gap
        // in the week rather than as a card that happens to be underfilled.
        padding: `56px ${GUTTER}px 64px`,
        borderTop: `1px solid ${HAIRLINE}`,
        borderBottom: `1px solid ${HAIRLINE}`,
        fontFamily: SANS,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: TYPE.fine,
          lineHeight: 1.6,
          letterSpacing: "0.02em",
          color: MUTED,
          maxWidth: "24em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {since}
      </p>

      <p
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontSize: "clamp(22px, 5.8vw, 26px)",
          lineHeight: 1.4,
          letterSpacing: "-0.01em",
          color: INK,
          maxWidth: "17em",
          fontWeight: 400,
          textWrap: "balance",
        }}
      >
        {question}
      </p>

      <p
        style={{
          margin: 0,
          fontSize: TYPE.micro,
          fontWeight: 600,
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
