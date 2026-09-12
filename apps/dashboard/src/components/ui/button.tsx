"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Button.
 *
 * Amber is identity, so `primary` is rationed — one per view, on the thing the
 * tutor actually came to do. Everything else is `subtle` or `ghost`.
 *
 * Motion: named properties only, 140ms out-strong, and a 0.97 press. The press
 * is the whole feedback model; there is no hover lift.
 */
const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2",
    "rounded-[5px] font-medium leading-none whitespace-nowrap",
    "transition-[background-color,border-color,color,opacity,transform]",
    "duration-[140ms] ease-[var(--ease-out-strong)]",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "border border-amber bg-amber text-ink-900 hover:bg-amber-soft hover:border-amber-soft",
        ghost: "border border-transparent bg-transparent text-cream-dim hover:bg-ink-800 hover:text-cream",
        danger: "border border-quiet/45 bg-transparent text-quiet hover:border-quiet hover:bg-quiet hover:text-cream",
        subtle: "border border-line bg-ink-800 text-cream hover:border-ink-600 hover:bg-ink-700",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-10 px-4 text-sm [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>`, keeping every style. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref as React.Ref<HTMLButtonElement>}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
