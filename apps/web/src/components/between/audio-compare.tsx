import React from "react";
import type { BriefComponent } from "agent-core/contracts";
import { INK, MUTED, SANS, SERIF } from "./tokens";

export type AudioCompareProps = Extract<BriefComponent, { type: "AudioCompare" }>;

/**
 * Him, then the target, side by side.
 *
 * The native <audio> control is deliberately left unstyled — browser chrome
 * looks like nothing else in the panel, and it is the one component here the
 * tutor is meant to touch rather than read. The cool grey ground is the only
 * non-warm surface in the set.
 */
export function AudioCompare({ item, student_audio_url, reference_text }: AudioCompareProps) {
  return (
    <section
      aria-label={`Pronunciation: ${item}`}
      style={{
        background: "#EDF0F7",
        padding: "16px 18px 18px",
        fontFamily: SANS,
        borderLeft: `6px solid ${INK}`,
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: 10,
        }}
      >
        Listen &middot; {item}
      </span>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        <audio
          controls
          preload="none"
          src={student_audio_url}
          style={{ flex: "1 1 200px", minWidth: 0, maxWidth: "100%" }}
        >
          <a href={student_audio_url} style={{ color: INK }}>
            his recording
          </a>
        </audio>

        <p
          style={{
            flex: "1 1 160px",
            margin: 0,
            paddingLeft: 14,
            borderLeft: "1px solid #C3CBDF",
            fontFamily: SERIF,
            fontSize: 20,
            lineHeight: 1.35,
            color: INK,
          }}
        >
          {reference_text}
          <span
            style={{
              display: "block",
              marginTop: 6,
              fontFamily: SANS,
              fontSize: 10,
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
