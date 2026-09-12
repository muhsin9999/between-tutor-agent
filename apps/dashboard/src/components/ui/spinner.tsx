import * as React from "react";
import { cn } from "@/lib/cn";

export interface SpinnerProps extends React.ComponentPropsWithoutRef<"span"> {
  /** Pixel diameter. Keep it small — this is an inline signal, not a scene. */
  size?: number;
  /** Announced to screen readers; pass `null` for a purely decorative spinner. */
  label?: string | null;
  ref?: React.Ref<HTMLSpanElement>;
}

/**
 * Spinner — small and fast.
 *
 * 600ms per revolution, well under the 1s default, because a slow spinner makes
 * the whole app feel slow. It rotates `transform` only. Inside a button it
 * inherits `currentColor`, so it is never a second colour decision.
 */
export function Spinner({ size = 14, label = "Loading", className, ref, ...props }: SpinnerProps) {
  return (
    <span
      ref={ref}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      className={cn("inline-flex items-center justify-center text-current", className)}
      {...props}
    >
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        className="animate-spin [animation-duration:600ms] [animation-timing-function:linear]"
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2" opacity="0.2" />
        <path
          d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
