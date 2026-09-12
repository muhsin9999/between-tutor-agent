import React from "react";
import type { BriefComponent, PlanDay } from "agent-core/contracts";
import { AMBER, CREAM, GREEN, HAIRLINE, INK, MUTED, PAPER, SANS } from "./tokens";

type PlanLaneComponent = Extract<BriefComponent, { type: "PlanLane" }>;

export type PlanLaneProps = PlanLaneComponent & {
  /**
   * The one sentence that says why the plan changed.
   *
   * NOT part of the frozen `BriefComponent` union — `PlanLane` carries only
   * `days`, `version` and `prior_version` — so it is optional here and the
   * renderer forwards it only if a caller has it (it lives on `Plan.reason`).
   * When it is present it is the single most important thing on the panel, and
   * it is set accordingly.
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

/**
 * The week itself: six columns on one horizontal lane, read left to right.
 *
 * A revision is the evidence the thing has agency, so the version bump and its
 * reason sit above the lane at the largest type in the component. When
 * `prior_version` is null there is nothing to explain and the banner is absent
 * entirely — an unrevised week must not render an empty slot where the reason
 * would have gone.
 */
export function PlanLane({ days, version, prior_version, reason }: PlanLaneProps) {
  const revised = prior_version !== null && prior_version !== undefined;

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
            background: CREAM,
            padding: "14px 16px 16px",
            borderBottom: `1px solid ${HAIRLINE}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 18,
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.01em",
            }}
          >
            <span style={{ color: MUTED, fontWeight: 500 }}>v{prior_version}</span>
            <span aria-hidden="true" style={{ color: AMBER }}>
              &rarr;
            </span>
            <span>v{version}</span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              plan changed
            </span>
          </div>

          {typeof reason === "string" && reason.length > 0 ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 17,
                lineHeight: 1.4,
                color: INK,
                fontWeight: 500,
              }}
            >
              {reason}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${HAIRLINE}`,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          The week &middot; v{version}
        </div>
      )}

      <ol
        style={{
          display: "flex",
          gap: 0,
          listStyle: "none",
          margin: 0,
          padding: 0,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {days.map((day) => (
          <li
            key={day.day}
            style={{
              flex: "1 0 128px",
              minWidth: 128,
              padding: "10px 12px 14px",
              borderRight: `1px solid ${HAIRLINE}`,
              borderTop: `3px solid ${KIND_COLOR[day.kind]}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: MUTED,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {day.day}
              </span>
              <span
                style={{
                  fontSize: 9,
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
                fontSize: 12,
                lineHeight: 1.35,
                color: INK,
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
