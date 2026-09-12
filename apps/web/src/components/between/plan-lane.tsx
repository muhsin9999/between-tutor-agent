import React from "react";
import type { BriefComponent, PlanDay } from "agent-core/contracts";
import { AMBER, CREAM, GREEN, GUTTER, HAIRLINE, INK, MUTED, PAPER, SANS, TYPE } from "./tokens";

type PlanLaneComponent = Extract<BriefComponent, { type: "PlanLane" }>;

export type PlanLaneProps = PlanLaneComponent & {
  /**
   * The one sentence that says why the plan changed.
   *
   * NOT part of the frozen `BriefComponent` union — `PlanLane` carries only
   * `days`, `version` and `prior_version` — so it is optional here and the
   * renderer forwards it only if a caller has it (it lives on `Plan.reason`).
   * When it is present it is the single most important thing on the panel, and
   * it is set accordingly: it is the largest type in the component, and the
   * version bump that occasioned it is demoted to an eyebrow above it.
   */
  reason?: string | null;
};

const KIND_COLOR: Record<PlanDay["kind"], string> = {
  drill: INK,
  produce: AMBER,
  explain: GREEN,
  checkin: "#8A7B5C",
};

const KIND_LABEL: Record<PlanDay["kind"], string> = {
  drill: "drill",
  produce: "produce",
  explain: "explain",
  checkin: "check-in",
};

const EYEBROW: React.CSSProperties = {
  fontSize: TYPE.micro,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: MUTED,
};

/**
 * The week itself: six columns on one horizontal lane, read left to right.
 *
 * A revision is the evidence the thing has agency, so the reason it revised is
 * the headline of this component and the version numbers are the footnote — a
 * tutor with five minutes needs to read *what changed and why* before she needs
 * to read that a counter went from 1 to 2. When `prior_version` is null there
 * is nothing to explain and the banner is absent entirely; an unrevised week
 * must not render an empty slot where the reason would have gone.
 *
 * The lane scrolls inside itself. Six columns never fit a phone, and the fix is
 * a scroll box here rather than a page that slides sideways under the thumb.
 */
export function PlanLane({ days, version, prior_version, reason }: PlanLaneProps) {
  const revised = prior_version !== null && prior_version !== undefined;
  const hasReason = typeof reason === "string" && reason.length > 0;

  return (
    <section
      aria-label={`Plan version ${version}`}
      style={{
        background: PAPER,
        borderTop: `2px solid ${INK}`,
        fontFamily: SANS,
      }}
    >
      {revised ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: CREAM,
            padding: `14px ${GUTTER}px 18px`,
            borderBottom: `1px solid ${HAIRLINE}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              ...EYEBROW,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>Plan changed</span>
            <span aria-hidden="true" style={{ color: HAIRLINE }}>
              &middot;
            </span>
            <span style={{ letterSpacing: "0.06em" }}>
              v{prior_version}
              <span aria-hidden="true" style={{ color: AMBER, padding: "0 4px" }}>
                &rarr;
              </span>
              <span style={{ color: INK }}>v{version}</span>
            </span>
          </div>

          {hasReason ? (
            <p
              style={{
                margin: 0,
                maxWidth: "30em",
                fontSize: TYPE.lead,
                lineHeight: 1.4,
                letterSpacing: "-0.01em",
                color: INK,
                fontWeight: 550,
                textWrap: "pretty",
              }}
            >
              {reason}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            padding: `11px ${GUTTER}px 12px`,
            borderBottom: `1px solid ${HAIRLINE}`,
            ...EYEBROW,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          The week &middot; v{version}
        </div>
      )}

      {/* Its own scroll box, so the lane runs off the edge of the card and not
          off the edge of the page. */}
      <ol
        style={{
          display: "flex",
          gap: 0,
          listStyle: "none",
          margin: 0,
          padding: 0,
          overflowX: "auto",
          overscrollBehaviorX: "contain",
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {days.map((day, i) => (
          <li
            key={day.day}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: "1 0 auto",
              width: 158,
              minWidth: 158,
              scrollSnapAlign: "start",
              padding: `12px ${GUTTER}px 16px`,
              boxSizing: "border-box",
              borderRight: i === days.length - 1 ? "none" : `1px solid ${HAIRLINE}`,
              borderTop: `3px solid ${KIND_COLOR[day.kind]}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: TYPE.fine,
                  fontWeight: 700,
                  color: MUTED,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {day.day}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: KIND_COLOR[day.kind],
                  whiteSpace: "nowrap",
                }}
              >
                {KIND_LABEL[day.kind]}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: TYPE.small,
                lineHeight: 1.4,
                color: INK,
                textWrap: "pretty",
              }}
            >
              {day.prompt}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default PlanLane;
