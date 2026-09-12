/**
 * The one editable surface in the panel.
 *
 * `plan-lane.tsx` renders the week read-only, and FLOWS.md flow 6 says the panel
 * does not edit — because editing needs a confirmation step and a bigger screen.
 * This is the single deliberate exception: reordering next week's six days is
 * the one edit that needs no typing, no confirmation dialogue, and no second
 * screen. She drags Thursday's drill in front of Tuesday's, taps once, and the
 * plan writes back as a new version beside the old one.
 *
 * ── Why pointer events and not HTML5 drag-and-drop ──────────────────────────
 * `draggable` / `dragstart` / `dragover` does not fire on touch. This panel
 * opens inside Telegram, on a phone, most of the time — HTML5 DnD would ship a
 * feature that only the developer's laptop can use. Pointer events are one API
 * for mouse, touch and pen, and `setPointerCapture` keeps the whole gesture
 * bound to the element the finger went down on even when the finger leaves it.
 *
 * ── Why the editable lane is vertical when the read-only one is horizontal ───
 * The read-only lane is six columns on a horizontally scrolling rail. Dragging
 * horizontally inside a horizontally scrolling container on a 360px phone means
 * fighting the scroller and hand-rolling edge auto-scroll. A vertical stack has
 * no such conflict: the drag axis is owned by a handle with `touch-action:none`
 * and the page keeps its scroll everywhere else. Colour, type scale, kind
 * accent and hairlines are the read-only lane's, exactly — only the axis turns.
 */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BriefComponent, PlanDay } from "agent-core/contracts";
import { AMBER, CREAM, GREEN, HAIRLINE, INK, MUTED, PAPER, RED, SANS } from "./tokens";

type PlanLaneComponent = Extract<BriefComponent, { type: "PlanLane" }>;

export type PlanLaneEditableProps = Omit<PlanLaneComponent, "type"> & {
  /** Whose week this is. Required — the write needs to know what to version. */
  student_id: string;
  /** The one sentence that says why the plan changed. Lives on `Plan.reason`. */
  reason?: string | null;
  /**
   * Telegram's signed `initData`. Optional: when absent the component reads it
   * off `window.Telegram.WebApp` itself, and in development the API route has a
   * dev path so the panel still works in a desktop browser.
   */
  initData?: string;
  /** Fired after a successful write, with the version the server stored. */
  onSaved?: (saved: { version: number; days: PlanDay[] }) => void;
};

/* ── the read-only lane's vocabulary, unchanged ───────────────────────────── */

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

/* ── motion constants ─────────────────────────────────────────────────────
   Only `transform` and `opacity` are ever transitioned. Nothing scales from
   zero; a lift is 1.03 and a press is 0.97, both from 1. */

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const SHIFT_MS = 200; // neighbours making room
const SETTLE_MS = 180; // the lifted cell dropping into its slot
const LIFT = 1.03;

/** Scoped CSS. `active:scale-[0.97]` has no Tailwind here, so it is written out. */
const PRESS_CSS = `
.ple-press {
  transition: transform ${SHIFT_MS}ms ${EASE}, opacity ${SHIFT_MS}ms ${EASE};
  transform: scale(1);
}
.ple-press:active { transform: scale(0.97); }
.ple-press:disabled { opacity: 0.5; }
@media (prefers-reduced-motion: reduce) {
  .ple-press { transition: none; }
  .ple-press:active { transform: scale(1); }
}
`;

/* ── pure helpers, all of them testable without a DOM ─────────────────────── */

/** A day plus the position it held in the plan the server last confirmed. */
type Cell = PlanDay & { origin: number };

function toCells(days: PlanDay[]): Cell[] {
  return days.map((day) => ({ ...day, origin: day.day }));
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [held] = next.splice(from, 1);
  next.splice(to, 0, held);
  return next;
}

/**
 * Which slot the lifted cell currently belongs in.
 *
 * To pass the next cell you have to travel past its midpoint, on top of the
 * distance already travelled. Expressed against measured heights rather than an
 * assumed row height, so cells holding a long prompt behave the same as short
 * ones. Monotone in `dy`, which is what stops the neighbours flickering.
 */
export function targetIndex(from: number, dy: number, heights: number[]): number {
  let target = from;
  if (dy > 0) {
    let travelled = 0;
    for (let j = from + 1; j < heights.length; j += 1) {
      if (dy > travelled + heights[j] / 2) {
        target = j;
        travelled += heights[j];
      } else break;
    }
  } else if (dy < 0) {
    const up = -dy;
    let travelled = 0;
    for (let j = from - 1; j >= 0; j -= 1) {
      if (up > travelled + heights[j] / 2) {
        target = j;
        travelled += heights[j];
      } else break;
    }
  }
  return target;
}

/** Where the lifted cell has to sit for its slot to look like its slot. */
export function restingOffset(from: number, to: number, heights: number[]): number {
  if (to === from) return 0;
  let sum = 0;
  if (to > from) {
    for (let j = from + 1; j <= to; j += 1) sum += heights[j];
    return sum;
  }
  for (let j = to; j <= from - 1; j += 1) sum += heights[j];
  return -sum;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * The panel page already declares `window.Telegram` with its own shape, and this
 * component must not redeclare it — two `declare global` blocks with different
 * member types is a compile error. Read it through an unknown cast instead.
 */
function telegramInitData(): string {
  if (typeof window === "undefined") return "";
  const tg = (window as unknown as {
    Telegram?: { WebApp?: { initData?: string } };
  }).Telegram;
  return tg?.WebApp?.initData ?? "";
}

type DragState = {
  index: number; // where the lifted cell started
  target: number; // where it would land right now
  dy: number; // pointer travel, or the resting offset while settling
  height: number; // the lifted cell's measured outer height
  settling: boolean;
};

/* ── the component ────────────────────────────────────────────────────────── */

export function PlanLaneEditable({
  days,
  version,
  prior_version,
  reason,
  student_id,
  initData,
  onSaved,
}: PlanLaneEditableProps) {
  const reduced = usePrefersReducedMotion();

  const [baseline, setBaseline] = useState<Cell[]>(() => toCells(days));
  const [cells, setCells] = useState<Cell[]>(() => toCells(days));
  const [savedVersion, setSavedVersion] = useState(version);
  const [priorVersion, setPriorVersion] = useState<number | null>(prior_version ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // A new plan arriving from the server replaces everything, including any
  // half-made local order. The server's week is the week.
  useEffect(() => {
    setBaseline(toCells(days));
    setCells(toCells(days));
    setSavedVersion(version);
    setPriorVersion(prior_version ?? null);
    setError(null);
  }, [days, version, prior_version]);

  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const heights = useRef<number[]>([]);
  const pointerId = useRef<number | null>(null);
  const startY = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => () => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
  }, []);

  // Keyboard reorder moves the cell out from under the focus ring; put it back.
  useEffect(() => {
    if (focusIndex === null) return;
    handleRefs.current[focusIndex]?.focus();
    setFocusIndex(null);
  }, [focusIndex]);

  const changed = useMemo(
    () => cells.some((cell, i) => cell.origin !== baseline[i]?.origin),
    [cells, baseline],
  );

  /* ── the gesture ──────────────────────────────────────────────────────── */

  const onPointerDown = useCallback(
    (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
      if (drag || saving || event.button !== 0) return;
      // Measure before anything is transformed, so the numbers are the layout's.
      heights.current = rowRefs.current.map((node) =>
        node ? node.getBoundingClientRect().height : 0,
      );
      startY.current = event.clientY;
      pointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      // Stops the long-press selection / callout that would otherwise eat the
      // gesture on iOS before the first pointermove ever lands.
      event.preventDefault();
      setDrag({
        index,
        target: index,
        dy: 0,
        height: heights.current[index] ?? 0,
        settling: false,
      });
    },
    [drag, saving],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag || drag.settling || event.pointerId !== pointerId.current) return;
      const dy = event.clientY - startY.current;
      const target = targetIndex(drag.index, dy, heights.current);
      setDrag((current) =>
        current && !current.settling ? { ...current, dy, target } : current,
      );
    },
    [drag],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, commit: boolean) => {
      if (!drag || drag.settling || event.pointerId !== pointerId.current) return;
      pointerId.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const { index, target } = drag;
      if (!commit || target === index) {
        setDrag(null);
        return;
      }

      const apply = () => {
        setCells((current) => move(current, index, target));
        setDrag(null);
        setFocusIndex(target);
      };

      if (reduced) {
        apply();
        return;
      }

      // Glide the lifted cell into the slot it earned, then swap the DOM order
      // underneath it. Without this the cell teleports from wherever the finger
      // left it to its new row, which reads as a bug rather than a drop.
      setDrag({ ...drag, dy: restingOffset(index, target, heights.current), settling: true });
      settleTimer.current = setTimeout(apply, SETTLE_MS);
    },
    [drag, reduced],
  );

  const onKeyDown = useCallback(
    (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (saving || drag) return;
      const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (delta === 0) return;
      const to = index + delta;
      if (to < 0 || to >= cells.length) return;
      event.preventDefault();
      setCells((current) => move(current, index, to));
      setFocusIndex(to);
    },
    [cells.length, drag, saving],
  );

  /* ── the write ────────────────────────────────────────────────────────── */

  const save = useCallback(async () => {
    if (saving || !changed) return;
    const optimistic = cells;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_id,
          initData: initData ?? telegramInitData(),
          days: optimistic.map((cell, i) => ({
            day: i + 1,
            kind: cell.kind,
            prompt: cell.prompt,
            target_items: cell.target_items,
            expects: cell.expects,
          })),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        plan?: { version: number; days: PlanDay[] };
        error?: string;
      };
      if (!response.ok || !body.plan) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      const stored = toCells(body.plan.days);
      setBaseline(stored);
      setCells(stored);
      setPriorVersion(savedVersion);
      setSavedVersion(body.plan.version);
      onSaved?.({ version: body.plan.version, days: body.plan.days });
    } catch (cause) {
      // The optimistic order is on screen and the server does not have it. Put
      // the week back the way it really is and say so — a silent failure here
      // would have her walk into the lesson with the wrong plan in her head.
      setCells(baseline);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [baseline, cells, changed, initData, onSaved, saving, savedVersion, student_id]);

  /* ── layout maths ─────────────────────────────────────────────────────── */

  const offsetFor = (i: number): number => {
    if (!drag) return 0;
    if (i === drag.index) return drag.dy;
    if (drag.target > drag.index && i > drag.index && i <= drag.target) return -drag.height;
    if (drag.target < drag.index && i >= drag.target && i < drag.index) return drag.height;
    return 0;
  };

  /** The day number a cell would carry if the drag ended now. Renumbers live. */
  const projectedIndex = (i: number): number => {
    if (!drag) return i;
    if (i === drag.index) return drag.target;
    if (drag.target > drag.index && i > drag.index && i <= drag.target) return i - 1;
    if (drag.target < drag.index && i >= drag.target && i < drag.index) return i + 1;
    return i;
  };

  const revised = priorVersion !== null && priorVersion !== undefined;

  return (
    <section
      aria-label={`Plan version ${savedVersion} — drag to reorder the week`}
      style={{ background: PAPER, borderTop: `2px solid ${INK}`, fontFamily: SANS }}
    >
      <style>{PRESS_CSS}</style>

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
            <span style={{ color: MUTED, fontWeight: 500 }}>v{priorVersion}</span>
            <span aria-hidden="true" style={{ color: AMBER }}>
              &rarr;
            </span>
            <span>v{savedVersion}</span>
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
            <p style={{ margin: "10px 0 0", fontSize: 17, lineHeight: 1.4, color: INK, fontWeight: 500 }}>
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
          Next week &middot; v{savedVersion} &middot; drag to reorder
        </div>
      )}

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          position: "relative",
          userSelect: drag ? "none" : undefined,
          WebkitUserSelect: drag ? "none" : undefined,
        }}
      >
        {cells.map((cell, i) => {
          const lifted = drag?.index === i;
          const offset = offsetFor(i);
          const number = projectedIndex(i) + 1;
          const movedFromSaved = cell.origin !== number;
          const dropTarget = reduced && drag !== null && drag.target === i && !lifted;

          const transform = reduced
            ? undefined
            : `translate3d(0, ${offset}px, 0)${lifted && !drag?.settling ? ` scale(${LIFT})` : ""}`;

          const transition =
            reduced || (lifted && !drag?.settling)
              ? "none"
              : `transform ${lifted ? SETTLE_MS : SHIFT_MS}ms ${EASE}, opacity ${SHIFT_MS}ms ${EASE}`;

          return (
            <li
              key={cell.origin}
              ref={(node) => {
                rowRefs.current[i] = node;
              }}
              style={{
                position: "relative",
                zIndex: lifted ? 2 : 1,
                background: lifted ? CREAM : PAPER,
                borderBottom: `1px solid ${HAIRLINE}`,
                borderLeft: `3px solid ${KIND_COLOR[cell.kind]}`,
                outline: dropTarget ? `2px solid ${AMBER}` : undefined,
                outlineOffset: dropTarget ? -2 : undefined,
                opacity: reduced && lifted ? 0.6 : 1,
                padding: "10px 12px 14px 9px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                transform,
                transition,
                willChange: drag ? "transform" : undefined,
                // A lifted cell must read as lifted. The shadow is applied at
                // once and never transitioned — motion here is transform and
                // opacity only.
                boxShadow: lifted && !reduced ? "0 8px 20px rgba(22, 48, 107, 0.16)" : "none",
                touchAction: "pan-y",
              }}
            >
              <button
                type="button"
                ref={(node) => {
                  handleRefs.current[i] = node;
                }}
                className="ple-press"
                aria-label={`Day ${number}: ${KIND_LABEL[cell.kind]}. Drag, or use the arrow keys, to reorder.`}
                disabled={saving}
                onPointerDown={(event) => onPointerDown(i, event)}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => finish(event, true)}
                onPointerCancel={(event) => finish(event, false)}
                onKeyDown={(event) => onKeyDown(i, event)}
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  flex: "0 0 auto",
                  width: 34,
                  minHeight: 44,
                  margin: "-4px 0",
                  border: "none",
                  background: "transparent",
                  color: MUTED,
                  cursor: drag ? "grabbing" : "grab",
                  // The one place the vertical gesture beats the page scroll.
                  // Everywhere else on the row, `pan-y` keeps the panel usable.
                  touchAction: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1, letterSpacing: "0.15em" }}>
                  &#8942;&#8942;
                </span>
              </button>

              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
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
                    {number}
                    {movedFromSaved ? (
                      <span style={{ fontWeight: 500, color: AMBER }}> &middot; was {cell.origin}</span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: KIND_COLOR[cell.kind],
                      whiteSpace: "nowrap",
                    }}
                  >
                    {KIND_LABEL[cell.kind]}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.35, color: INK }}>{cell.prompt}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* The button exists only when there is something to save. An always-on
          Save on a read-mostly panel invites a write that changes nothing, and
          every write here costs a real version. */}
      {changed || error ? (
        <div style={{ padding: "12px 16px 16px", background: PAPER }}>
          {error ? (
            <p style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.4, color: RED, fontWeight: 600 }}>
              Not saved — {error}. The week is back as it was.
            </p>
          ) : null}

          {changed ? (
            <button
              type="button"
              className="ple-press"
              onClick={save}
              disabled={saving}
              style={{
                display: "block",
                width: "100%",
                minHeight: 44,
                border: "none",
                background: INK,
                color: PAPER,
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving…" : `Save next week as v${savedVersion + 1}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default PlanLaneEditable;
