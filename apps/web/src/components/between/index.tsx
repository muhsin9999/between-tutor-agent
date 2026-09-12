import React from "react";
import type { Brief, BriefComponent, PlanDay } from "agent-core/contracts";

import { AudioCompare } from "./audio-compare";
import { Breakthrough } from "./breakthrough";
import { ErrorGrid } from "./error-grid";
import { PlanLane } from "./plan-lane";
import { PlanLaneEditable } from "./plan-lane-editable";
import { PraiseLine } from "./praise-line";
import { QuietCard } from "./quiet-card";
import { Streak } from "./streak";
import { INK, SANS } from "./tokens";

export { AudioCompare } from "./audio-compare";
export { Breakthrough } from "./breakthrough";
export { ErrorGrid } from "./error-grid";
export { PlanLane } from "./plan-lane";
export { PlanLaneEditable } from "./plan-lane-editable";
export { PraiseLine } from "./praise-line";
export { QuietCard } from "./quiet-card";
export { Streak } from "./streak";

export type { AudioCompareProps } from "./audio-compare";
export type { BreakthroughProps } from "./breakthrough";
export type { ErrorGridProps } from "./error-grid";
export type { PlanLaneProps } from "./plan-lane";
export type { PlanLaneEditableProps } from "./plan-lane-editable";
export type { PraiseLineProps } from "./praise-line";
export type { QuietCardProps } from "./quiet-card";
export type { StreakProps } from "./streak";

/**
 * What the editable lane needs that a `Brief` does not carry: whose week it is,
 * Telegram's signature, and somewhere to report a successful write.
 *
 * Held as one optional bundle rather than four loose props so the read-only
 * path stays exactly the call it always was. The save endpoint is not passed —
 * `PlanLaneEditable` owns `/api/plan`, which is the only route that will accept
 * a reorder, and giving the renderer a say in that would invite a second one.
 */
type PlanEditing = {
  studentId: string;
  initData?: string;
  onPlanSaved?: (saved: { version: number; days: PlanDay[] }) => void;
};

/**
 * The whole vocabulary, in one place. If `BriefComponent` ever grows an eighth
 * member, the `never` assignment at the bottom of this switch stops the build
 * rather than letting the panel render a blank gap.
 */
function renderComponent(
  component: BriefComponent,
  planReason?: string | null,
  editing?: PlanEditing,
) {
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
    case "PlanLane": {
      // One lane or the other, never both. `editing` is absent whenever the
      // caller did not ask for editing — or asked but has no student to write
      // against — and the read-only lane is what the panel has always shown.
      const { type: _type, ...plan } = component;
      void _type;
      return editing ? (
        <PlanLaneEditable
          {...plan}
          reason={planReason ?? null}
          student_id={editing.studentId}
          initData={editing.initData}
          onSaved={editing.onPlanSaved}
        />
      ) : (
        <PlanLane {...component} reason={planReason ?? null} />
      );
    }
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
  /**
   * Render the week as the drag-to-reorder lane instead of the read-only one.
   *
   * Needs `studentId` — the write has to know what it is versioning — so an
   * `editable` with no student falls back to the read-only lane rather than
   * rendering a Save button that cannot save. That fallback is also what a
   * desktop browser gets during development, where there is no `initData`.
   */
  editable?: boolean;
  /** Whose week this is. Required for `editable` to take effect. */
  studentId?: string;
  /** Telegram's signed `initData`, forwarded to the write. */
  initData?: string;
  /** Fired after a successful reorder, with the version the server stored. */
  onPlanSaved?: (saved: { version: number; days: PlanDay[] }) => void;
};

/**
 * Maps `brief.components` to components, in the order the model composed them.
 *
 * The renderer supplies no card shell, no shared border and no shared
 * background — only vertical rhythm. Each component owns its own surface, which
 * is the only way two weeks can look genuinely unlike each other.
 */
export function BriefRenderer({
  brief,
  planReason,
  showHeadline = true,
  editable = false,
  studentId,
  initData,
  onPlanSaved,
}: BriefRendererProps) {
  const editing: PlanEditing | undefined =
    editable && studentId ? { studentId, initData, onPlanSaved } : undefined;

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
          {renderComponent(component, planReason, editing)}
        </React.Fragment>
      ))}
    </div>
  );
}

export default BriefRenderer;
