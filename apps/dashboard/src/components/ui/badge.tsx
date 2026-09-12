import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Badge — semantic only.
 *
 * There is no "primary" badge and no decorative colour here. A badge means the
 * student is quiet, stuck, ahead, on track, or that the fact is neutral. Amber
 * appears only as `stuck`, which is the one state that also happens to be the
 * brand hue — deliberate, and the reason nothing else in this file is amber.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 rounded-[4px] border",
    "px-2 py-[3px] text-[11px] font-medium uppercase leading-none tracking-[0.06em]",
    "transition-[background-color,border-color,color] duration-[140ms] ease-[var(--ease-out-strong)]",
  ],
  {
    variants: {
      tone: {
        quiet: "border-quiet/30 bg-quiet/12 text-quiet",
        stuck: "border-stuck/30 bg-stuck/12 text-stuck",
        ahead: "border-ahead/30 bg-ahead/12 text-ahead",
        "on-track": "border-ontrack/35 bg-ontrack/12 text-ontrack",
        neutral: "border-line bg-ink-800 text-cream-dim",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const dotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    tone: {
      quiet: "bg-quiet",
      stuck: "bg-stuck",
      ahead: "bg-ahead",
      "on-track": "bg-ontrack",
      neutral: "bg-cream-faint",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface BadgeProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof badgeVariants> {
  /** Show the leading status dot. On by default — it carries the state without colour alone. */
  dot?: boolean;
}

export function Badge({
  className,
  tone,
  dot = true,
  children,
  ref,
  ...props
}: BadgeProps & { ref?: React.Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className={dotVariants({ tone })} /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
