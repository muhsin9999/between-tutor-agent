"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const avatarVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
    "rounded-[6px] border border-line bg-ink-700 text-cream-dim",
    "font-medium uppercase leading-none tracking-[0.02em]",
  ],
  {
    variants: {
      size: {
        sm: "size-7 text-[11px]",
        md: "size-9 text-[13px]",
        lg: "size-12 text-[15px]",
      },
      tone: {
        neutral: "",
        /** For the one person the view is about. Amber stays rare. */
        accent: "border-amber/40 bg-amber/12 text-amber",
      },
    },
    defaultVariants: { size: "md", tone: "neutral" },
  },
);

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<"span">,
    VariantProps<typeof avatarVariants> {
  /** Full name. Initials are derived from it; no image is required. */
  name: string;
  /** Optional photo. Falls back to initials if it is missing or fails to load. */
  src?: string;
}

/**
 * Avatar — initials first.
 *
 * Most students in this product will never upload a photo, so the initials are
 * the real design and the image is the exception. Square-ish (6px) rather than
 * a circle, to sit in the same family as cards and buttons.
 */
export function Avatar({
  name,
  src,
  size,
  tone,
  className,
  ref,
  ...props
}: AvatarProps & { ref?: React.Ref<HTMLSpanElement> }) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      ref={ref}
      title={name}
      className={cn(avatarVariants({ size, tone }), className)}
      {...props}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** First letter of the first word, plus the first letter of the last word. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

/** Overlapping row of avatars, newest first. */
export function AvatarGroup({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center -space-x-2 [&>*]:ring-2 [&>*]:ring-ink-900", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { avatarVariants };
