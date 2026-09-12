"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface FieldProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
  /** Always required — this field has no unlabelled mode. */
  label: string;
  /** Error message. Presence also switches the field to its error colours. */
  error?: string;
  /** Quiet helper text, shown when there is no error. */
  hint?: string;
  /** Class for the outer wrapper (layout), as opposed to the input shell. */
  containerClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Field — a text input built from scratch, not a browser input with a border.
 *
 * The shell owns the chrome (surface, hairline, focus ring); the `<input>` is
 * stripped to bare text. The label starts optically centred and floats up when
 * the field is focused or filled, moving by transform alone so nothing reflows.
 */
export function Field({
  label,
  error,
  hint,
  className,
  containerClassName,
  id,
  disabled,
  onFocus,
  onBlur,
  onChange,
  placeholder,
  ref,
  ...props
}: FieldProps) {
  const autoId = React.useId();
  const inputId = id ?? `field-${autoId}`;
  const messageId = `${inputId}-message`;

  const [focused, setFocused] = React.useState(false);
  const [filled, setFilled] = React.useState(
    () => hasText(props.value) || hasText(props.defaultValue),
  );

  // Keep the float in sync when the field is driven from outside.
  const controlled = props.value !== undefined;
  React.useEffect(() => {
    if (controlled) setFilled(hasText(props.value));
  }, [controlled, props.value]);

  const floating = focused || filled || Boolean(placeholder);
  const invalid = Boolean(error);
  const message = error ?? hint;

  return (
    <div className={cn("w-full", containerClassName)}>
      <div
        data-invalid={invalid || undefined}
        data-focused={focused || undefined}
        data-disabled={disabled || undefined}
        className={cn(
          "relative rounded-[6px] border bg-ink-850",
          "transition-[background-color,border-color,color] duration-[150ms] ease-[var(--ease-out-strong)]",
          "border-line",
          "hover:border-ink-600",
          "data-[focused]:border-amber data-[focused]:ring-[3px] data-[focused]:ring-amber/20",
          "data-[invalid]:border-quiet data-[invalid]:data-[focused]:ring-quiet/20",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        )}
      >
        <label
          htmlFor={inputId}
          className={cn(
            "pointer-events-none absolute left-3 top-0 flex h-14 origin-[0_50%] items-center",
            "text-sm leading-none",
            "transition-[transform,color] duration-[150ms] ease-[var(--ease-out-strong)]",
            floating ? "-translate-y-[11px] scale-[0.78]" : "translate-y-0 scale-100",
            invalid
              ? "text-quiet"
              : focused
                ? "text-amber"
                : floating
                  ? "text-cream-faint"
                  : "text-cream-dim",
          )}
        >
          {label}
        </label>

        <input
          {...props}
          id={inputId}
          ref={ref}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={message ? messageId : undefined}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            if (!controlled) setFilled(hasText(event.currentTarget.value));
            onBlur?.(event);
          }}
          onChange={(event) => {
            if (!controlled) setFilled(hasText(event.currentTarget.value));
            onChange?.(event);
          }}
          className={cn(
            "peer h-14 w-full appearance-none bg-transparent px-3 pb-2 pt-[22px]",
            "text-sm leading-none text-cream caret-amber",
            "outline-none focus-visible:outline-none",
            "placeholder:text-cream-faint/60",
            "disabled:cursor-not-allowed",
            "[&::-webkit-search-cancel-button]:appearance-none",
            className,
          )}
        />
      </div>

      {/* Error slot. Reserved height, so a message never shifts the form. */}
      <div
        id={messageId}
        role={invalid ? "alert" : undefined}
        className={cn(
          "min-h-[18px] px-0.5 pt-1.5 text-[12px] leading-none",
          "transition-[opacity,transform,color] duration-[150ms] ease-[var(--ease-out-strong)]",
          message ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0",
          invalid ? "text-quiet" : "text-cream-faint",
        )}
      >
        {message}
      </div>
    </div>
  );
}

function hasText(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).length > 0;
}
