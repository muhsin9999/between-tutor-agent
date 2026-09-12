"use client";

import * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

/**
 * OAuthButton — one identity provider, one row.
 *
 * Full width because a provider is a door, not a preference: it should be as
 * wide as the thing it replaces. The mark sits in a fixed left column and an
 * equal empty column balances it on the right, so the label is centred on the
 * button rather than on whatever is left over after the icon.
 *
 * Motion follows the rest of the app: named properties, 160ms, out-strong, and
 * a 0.97 press as the only feedback. No hover lift.
 *
 * Disabled is a state, not a failure. The border stays, the surface stays, the
 * label drops to `cream-faint` and the brand mark desaturates — it reads as
 * "not now", which is true, rather than as a rendering bug.
 */
export interface OAuthButtonProps
  extends React.ComponentPropsWithoutRef<"button"> {
  /**
   * Provider name as the tutor reads it — "Telegram", "Google". It becomes the
   * default label, so the provider is always in the accessible name.
   */
  provider: string;
  /** The brand mark. Inline SVG, decorative — the label carries the meaning. */
  icon: React.ReactNode;
  /** True only while a real handoff is in flight. Sets `aria-busy`. */
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function OAuthButton({
  provider,
  icon,
  loading = false,
  disabled,
  className,
  type,
  children,
  ref,
  ...props
}: OAuthButtonProps) {
  const inert = Boolean(disabled) || loading;

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={inert}
      aria-busy={loading || undefined}
      className={cn(
        "flex w-full items-center rounded-[3px] border border-line bg-ink-850 px-4 py-3.5",
        "text-[14px] font-medium text-cream",
        "transition-[background-color,border-color,color,transform] duration-[160ms] ease-[var(--ease-out-strong)]",
        "hover:border-ink-600 hover:bg-ink-800",
        "active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:text-cream-faint",
        "disabled:hover:border-line disabled:hover:bg-ink-850 disabled:active:scale-100",
        className,
      )}
      {...props}
    >
      <span className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-center gap-3">
        <span
          className={cn(
            "flex items-center justify-center",
            "transition-[filter,opacity] duration-[160ms] ease-[var(--ease-out-strong)]",
            inert && !loading && "opacity-70 saturate-0",
          )}
        >
          {loading ? <Spinner size={16} label={null} /> : icon}
        </span>

        <span className="text-center">
          {children ?? `Continue with ${provider}`}
        </span>

        {/* Balances the mark so the label is centred on the button. */}
        <span aria-hidden="true" />
      </span>
    </button>
  );
}
