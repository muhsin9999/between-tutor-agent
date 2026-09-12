"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional second line, e.g. "12 students". */
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /** Visible label rendered above the trigger. */
  label?: string;
  disabled?: boolean;
  /** Emits a hidden input so the select can live inside a plain form. */
  name?: string;
  id?: string;
  align?: "start" | "end";
  className?: string;
  contentClassName?: string;
}

const OPEN_MS = 180;

/**
 * Select — a listbox, not a native `<select>`.
 *
 * Focus never leaves the trigger. The trigger is the combobox and it points at
 * the highlighted option with `aria-activedescendant`, which keeps the focus
 * ring in one place and lets the panel scale open from its own top edge
 * without ever stealing the caret.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select an option",
  label,
  disabled,
  name,
  id,
  align = "start",
  className,
  contentClassName,
}: SelectProps) {
  const autoId = React.useId();
  const triggerId = id ?? `select-${autoId}`;
  const listboxId = `${triggerId}-listbox`;
  const labelId = `${triggerId}-label`;

  const controlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const selectedValue = controlled ? (value ?? "") : uncontrolled;

  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<(HTMLLIElement | null)[]>([]);
  const typeahead = React.useRef({ query: "", timer: 0 });

  const selectedIndex = options.findIndex((o) => o.value === selectedValue);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const firstEnabled = React.useCallback(
    (from: number, step: number) => {
      for (let i = from; i >= 0 && i < options.length; i += step) {
        if (!options[i].disabled) return i;
      }
      return -1;
    },
    [options],
  );

  // Mount first, paint at scale(0.95)/opacity 0, then transition in on the next
  // frame. Unmount is deferred by exactly the exit duration.
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Dismiss on outside pointer down, or when the window itself loses focus.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onWindowBlur = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const commit = React.useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      if (!controlled) setUncontrolled(option.value);
      onValueChange?.(option.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [controlled, onValueChange, options],
  );

  const openList = React.useCallback(
    (preferred: number) => {
      setActiveIndex(
        preferred >= 0 && !options[preferred]?.disabled
          ? preferred
          : firstEnabled(0, 1),
      );
      setOpen(true);
    },
    [firstEnabled, options],
  );

  const runTypeahead = React.useCallback(
    (char: string, isOpen: boolean) => {
      const state = typeahead.current;
      window.clearTimeout(state.timer);
      state.query += char.toLowerCase();
      state.timer = window.setTimeout(() => {
        state.query = "";
      }, 500);

      const match = options.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(state.query),
      );
      if (match < 0) return;
      if (isOpen) setActiveIndex(match);
      else commit(match);
    },
    [commit, options],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const { key, altKey } = event;

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        openList(selectedIndex);
        return;
      }
      if (key.length === 1 && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        runTypeahead(key, false);
      }
      return;
    }

    switch (key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        return;
      case "Tab":
        // Commit what is highlighted, then let focus move on.
        if (activeIndex >= 0) commit(activeIndex);
        setOpen(false);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        return;
      case "ArrowDown": {
        event.preventDefault();
        if (altKey) return;
        const next = firstEnabled(activeIndex + 1, 1);
        if (next >= 0) setActiveIndex(next);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (altKey) {
          setOpen(false);
          return;
        }
        const prev = firstEnabled(activeIndex - 1, -1);
        if (prev >= 0) setActiveIndex(prev);
        return;
      }
      case "Home": {
        event.preventDefault();
        const first = firstEnabled(0, 1);
        if (first >= 0) setActiveIndex(first);
        return;
      }
      case "End": {
        event.preventDefault();
        const last = firstEnabled(options.length - 1, -1);
        if (last >= 0) setActiveIndex(last);
        return;
      }
      default:
        if (key.length === 1 && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          runTypeahead(key, true);
        }
    }
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {label ? (
        <span
          id={labelId}
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-cream-faint"
        >
          {label}
        </span>
      ) : null}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        aria-labelledby={label ? `${labelId} ${triggerId}` : undefined}
        onClick={() => (open ? setOpen(false) : openList(selectedIndex))}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-10 w-full select-none items-center justify-between gap-2",
          "rounded-[5px] border border-line bg-ink-850 px-3 text-left text-sm",
          "transition-[background-color,border-color,color,transform] duration-[140ms] ease-[var(--ease-out-strong)]",
          "hover:border-ink-600 hover:bg-ink-800",
          "active:scale-[0.97]",
          "disabled:pointer-events-none disabled:opacity-40",
          open && "border-amber bg-ink-800",
          selected ? "text-cream" : "text-cream-faint",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <Chevron open={open} />
      </button>

      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}

      {mounted ? (
        <ul
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={label ? labelId : triggerId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          style={{ transitionDuration: `${OPEN_MS}ms` }}
          className={cn(
            "absolute z-50 mt-1.5 max-h-64 min-w-full overflow-y-auto",
            "rounded-[6px] border border-line bg-ink-850 p-1",
            "shadow-[0_16px_40px_-12px_rgb(0_0_0/0.7)]",
            "transition-[opacity,transform] ease-[var(--ease-out-strong)]",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
            contentClassName,
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === selectedValue;
            const isActive = index === activeIndex;
            return (
              <li
                key={option.value}
                id={`${listboxId}-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onPointerMove={() => {
                  if (!option.disabled && index !== activeIndex) setActiveIndex(index);
                }}
                onClick={() => commit(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-[4px]",
                  "px-2.5 py-2 text-sm leading-none",
                  "transition-[background-color,color] duration-[120ms] ease-[var(--ease-out-strong)]",
                  option.disabled
                    ? "cursor-not-allowed text-cream-faint/50"
                    : isActive
                      ? "bg-ink-700 text-cream"
                      : "text-cream-dim",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="mt-1 block truncate text-[12px] text-cream-faint">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {isSelected ? <Tick /> : null}
              </li>
            );
          })}
          {options.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled
              className="px-2.5 py-2 text-sm text-cream-faint"
            >
              Nothing to choose
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={cn(
        "size-3 shrink-0 text-cream-faint",
        "transition-transform duration-[180ms] ease-[var(--ease-out-strong)]",
        open && "-scale-y-100",
      )}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tick() {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 text-amber">
      <path
        d="M2 6.5 4.8 9 10 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
