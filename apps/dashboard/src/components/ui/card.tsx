import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Card — a surface, not a rounded rectangle.
 *
 * It reads as a raised plane: one step lighter than the page (ink-850 on
 * ink-900), a hairline in `line`, and a 6px radius. Padding is generous and
 * consistent so a column of cards forms a clean rhythm.
 */
export function Card({
  className,
  interactive = false,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  /** Adds press + hover affordance for cards that are themselves targets. */
  interactive?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[6px] border border-line bg-ink-850",
        "transition-[background-color,border-color,transform] duration-[160ms] ease-[var(--ease-out-strong)]",
        interactive &&
          "cursor-pointer hover:border-ink-600 hover:bg-ink-800 active:scale-[0.97]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Header. Sits above a hairline; keep it to a title plus at most one action.
 */
export function CardHeader({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

/** Title. Serif, because the display face is the one place we let it breathe. */
export function CardTitle({
  className,
  as: Comp = "h3",
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"h3"> & {
  as?: "h1" | "h2" | "h3" | "h4";
  ref?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <Comp
      ref={ref}
      className={cn(
        "font-display text-[17px] leading-tight tracking-[-0.01em] text-cream",
        className,
      )}
      {...props}
    />
  );
}

/** Optional one-line context under the title. */
export function CardDescription({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"p"> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return (
    <p
      ref={ref}
      className={cn("mt-1 text-[13px] leading-snug text-cream-faint", className)}
      {...props}
    />
  );
}

/** Body. The content well. */
export function CardBody({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn("px-5 py-5", className)} {...props} />;
}

/** Footer. Actions, right-aligned by default. */
export function CardFooter({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-2 border-t border-line px-5 py-3.5",
        className,
      )}
      {...props}
    />
  );
}
