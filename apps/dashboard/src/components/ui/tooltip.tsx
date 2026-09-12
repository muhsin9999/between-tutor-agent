"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

/**
 * Tooltip — a thin wrapper over Radix.
 *
 * The panel scales out of the trigger using Radix's own
 * `--radix-tooltip-content-transform-origin`, so a tip below a button grows
 * downward and one above it grows upward. Enter and exit are both out-strong;
 * nothing here uses ease-in.
 *
 * The keyframes live in the provider (rendered once, near the app root) because
 * Radix only defers unmount for CSS animations, not transitions.
 */
const TOOLTIP_CSS = `
@keyframes bt-tip-in  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes bt-tip-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
.bt-tip { transform-origin: var(--radix-tooltip-content-transform-origin); will-change: transform, opacity; }
.bt-tip[data-state="delayed-open"],
.bt-tip[data-state="instant-open"] { animation: bt-tip-in 160ms var(--ease-out-strong) both; }
.bt-tip[data-state="closed"] { animation: bt-tip-out 125ms var(--ease-out-strong) both; }
`;

export function TooltipProvider({
  delayDuration = 250,
  skipDelayDuration = 300,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: TOOLTIP_CSS }} />
      {children}
    </TooltipPrimitive.Provider>
  );
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "bt-tip z-50 max-w-[260px]",
          "rounded-[5px] border border-line bg-ink-800 px-2.5 py-1.5",
          "text-[12px] leading-snug text-cream",
          "shadow-[0_12px_32px_-10px_rgb(0_0_0/0.75)]",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export interface TipProps {
  /** The tip text. Keep it to one short line — this is a label, not a doc. */
  content: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  align?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["align"];
  delayDuration?: number;
}

/**
 * The common case: wrap one element, give it one line of text.
 * Requires a `TooltipProvider` somewhere above it.
 */
export function Tip({ content, children, side = "top", align = "center", delayDuration }: TipProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
