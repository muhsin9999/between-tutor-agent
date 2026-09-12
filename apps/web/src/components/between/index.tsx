import React from "react";
import type { Brief, BriefComponent } from "agent-core/contracts";

import { AudioCompare } from "./audio-compare";
import { Breakthrough } from "./breakthrough";
import { ErrorGrid } from "./error-grid";
import { PlanLane } from "./plan-lane";
import { PraiseLine } from "./praise-line";
import { QuietCard } from "./quiet-card";
import { Streak } from "./streak";
import { INK, SANS } from "./tokens";

export { AudioCompare } from "./audio-compare";
export { Breakthrough } from "./breakthrough";
export { ErrorGrid } from "./error-grid";
export { PlanLane } from "./plan-lane";
export { PraiseLine } from "./praise-line";
export { QuietCard } from "./quiet-card";
export { Streak } from "./streak";

export type { AudioCompareProps } from "./audio-compare";
export type { BreakthroughProps } from "./breakthrough";
export type { ErrorGridProps } from "./error-grid";
export type { PlanLaneProps } from "./plan-lane";
export type { PraiseLineProps } from "./praise-line";
export type { QuietCardProps } from "./quiet-card";
export type { StreakProps } from "./streak";

/**
 * The whole vocabulary, in one place. If `BriefComponent` ever grows an eighth
 * member, the `never` assignment at the bottom of this switch stops the build
 * rather than letting the panel render a blank gap.
 */
function renderComponent(component: BriefComponent, planReason?: string | null) {
  switch (component.type) {
    case "Streak":
      return <Streak {...component} />;
    case "ErrorGrid":
      return <ErrorGrid {...component} />;
    case "AudioCompare":
      return <AudioCompare {...component} />;
    case "QuietCard":
      return <QuietCard {...component} />;
    case "Breakthrough":
      return <Breakthrough {...component} />;
    case "PraiseLine":
      return <PraiseLine {...component} />;
    case "PlanLane":
      return <PlanLane {...component} reason={planReason ?? null} />;
    default: {
      const unhandled: never = component;
      void unhandled;
      return null;
    }
  }
}

export type BriefRendererProps = {
  brief: Brief;
  /**
   * `Plan.reason` for the current plan version. Not carried by the
   * `BriefComponent` union, so it is threaded in from the caller and forwarded
   * to `PlanLane`, which is the only component that uses it.
   */
  planReason?: string | null;
  /** Set false when the page renders the headline itself. */
  showHeadline?: boolean;
};

/**
 * Maps `brief.components` to components, in the order the model composed them.
 *
 * The renderer supplies no card shell, no shared border and no shared
 * background — only vertical rhythm. Each component owns its own surface, which
 * is the only way two weeks can look genuinely unlike each other.
 */
export function BriefRenderer({ brief, planReason, showHeadline = true }: BriefRendererProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 560,
        margin: "0 auto",
        padding: "16px 0 40px",
        fontFamily: SANS,
        color: INK,
      }}
    >
      {showHeadline ? (
        <h1
          style={{
            margin: 0,
            padding: "0 20px",
            fontSize: 19,
            lineHeight: 1.35,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: INK,
          }}
        >
          {brief.headline}
        </h1>
      ) : null}

      {brief.components.map((component, i) => (
        <React.Fragment key={`${component.type}-${i}`}>
          {renderComponent(component, planReason)}
        </React.Fragment>
      ))}
    </div>
  );
}

export default BriefRenderer;
