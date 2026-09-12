import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { GUTTER, HAIRLINE, INK, MUTED, SANS, SERIF, TYPE } from "./tokens";

export type AudioCompareProps = Extract<BriefComponent, { type: "AudioCompare" }>;

/**
 * Him, then the target, side by side.
 *
 * The native <audio> control is deliberately left unstyled — browser chrome
 * looks like nothing else in the panel, and it is the one component here the
 * tutor is meant to touch rather than read. The cool grey ground is the only
 * non-warm surface in the set, which is what makes it findable in a scroll of
 * cream and white.
 *
 * The first thing is the item, not the word "listen": what the tutor needs to
 * recognise in a glance is which sound this is about.
 */
export function AudioCompare({ item, student_audio_url, reference_text }: AudioCompareProps) {
  return (
    <section
      aria-label={`Pronunciation: ${item}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: "#EDF0F7",
        padding: `16px ${GUTTER - 4}px 18px`,
        fontFamily: SANS,
        borderLeft: `4px solid ${INK}`,
      }}
    >
      <h2
        style={{
          display: "flex",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 8,
          margin: 0,
          fontSize: TYPE.lead,
          fontWeight: 600,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          color: INK,
          textWrap: "balance",
        }}
      >
        {item}
        <span
          style={{
            fontSize: TYPE.micro,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          listen
        </span>
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        <audio
          controls
          preload="none"
          src={student_audio_url}
          style={{ flex: "1 1 200px", minWidth: 0, maxWidth: "100%", height: 36 }}
        >
          <a href={student_audio_url} style={{ color: INK }}>
            his recording
          </a>
        </audio>

        <p
          style={{
            flex: "1 1 180px",
            minWidth: 0,
            margin: 0,
            paddingLeft: 14,
            borderLeft: `2px solid ${HAIRLINE}`,
            fontFamily: SERIF,
            fontSize: TYPE.title,
            lineHeight: 1.3,
            color: INK,
            textWrap: "balance",
          }}
        >
          {reference_text}
          <span
            style={{
              display: "block",
              marginTop: 8,
              fontFamily: SANS,
              fontSize: TYPE.micro,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            what it should sound like
          </span>
        </p>
      </div>
    </section>
  );
}

export default AudioCompare;
