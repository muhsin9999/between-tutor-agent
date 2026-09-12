import * as React from "react";
import { cn } from "@/lib/cn";

export interface ProgressProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  /** Days completed, clamped to 0..total. */
  value: number;
  /** The week is six days long in this product. Override only if that changes. */
  total?: number;
  /** The day currently in play. Defaults to the one after the last completed day. */
  current?: number;
  /** Colour of the completed cells. Amber is the default because progress is the product. */
  tone?: "amber" | "ahead" | "stuck" | "quiet";
  /** Print 1..6 under the track. */
  showDays?: boolean;
  /** Accessible name, e.g. "Ama's week". */
  label?: string;
  ref?: React.Ref<HTMLDivElement>;
}

const FILLED: Record<NonNullable<ProgressProps["tone"]>, string> = {
  amber: "bg-amber",
  ahead: "bg-ahead",
  stuck: "bg-stuck",
  quiet: "bg-quiet",
};

const CURRENT: Record<NonNullable<ProgressProps["tone"]>, string> = {
  amber: "bg-amber/35",
  ahead: "bg-ahead/35",
  stuck: "bg-stuck/35",
  quiet: "bg-quiet/35",
};

/**
 * Progress — a six-cell day track.
 *
 * This product counts in days, not percentages, so the track is six discrete
 * cells and never a continuous bar. A tutor should be able to glance at it and
 * say "day four" without reading a number.
 *
 * Cells settle in sequence: each one carries a 28ms-per-index delay on its
 * transform, which reads as the week filling left to right rather than the
 * whole row snapping at once.
 */
export function Progress({
  value,
  total = 6,
  current,
  tone = "amber",
  showDays = false,
  label,
  className,
  ref,
  ...props
}: ProgressProps) {
  const done = Math.max(0, Math.min(total, Math.round(value)));
  const active = current ?? (done < total ? done + 1 : 0);
  const cells = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`Day ${done} of ${total}`}
      className={cn("w-full", className)}
      {...props}
    >
      <div className="flex items-center gap-1">
        {cells.map((day) => {
          const isDone = day <= done;
          const isActive = day === active && !isDone;
          return (
            <span
              key={day}
              aria-hidden
              style={{ transitionDelay: `${(day - 1) * 28}ms` }}
              className={cn(
                "h-1.5 flex-1 origin-left rounded-[2px]",
                "transition-[background-color,transform,opacity] duration-[200ms] ease-[var(--ease-out-strong)]",
                isDone
                  ? cn(FILLED[tone], "scale-x-100 opacity-100")
                  : isActive
                    ? cn(CURRENT[tone], "scale-x-100 opacity-100")
                    : "scale-x-100 bg-ink-700 opacity-100",
              )}
            />
          );
        })}
      </div>

      {showDays ? (
        <div className="mt-1.5 flex items-center gap-1">
          {cells.map((day) => (
            <span
              key={day}
              aria-hidden
              className={cn(
                "flex-1 text-center text-[10px] leading-none tabular-nums",
                "transition-[color] duration-[200ms] ease-[var(--ease-out-strong)]",
                day <= done ? "text-cream-dim" : day === active ? "text-cream" : "text-cream-faint/60",
              )}
            >
              {day}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Named for what it actually is, at call sites that prefer the domain word. */
export const DayTrack = Progress;
