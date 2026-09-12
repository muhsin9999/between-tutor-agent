/**
 * How a `Need` looks. One map, two screens — the roster and the student page
 * must never disagree about what "stuck" is coloured.
 *
 * Semantic colour is deliberately separate from amber. Amber is identity; these
 * are state. A tutor should see who is in trouble before parsing a single digit.
 * The tones here are `Badge`'s own vocabulary, so the colour decision lives in
 * the component and this file only decides which state maps to which word.
 */
import type { BadgeProps } from "@/components/ui/badge";
import type { Need } from "@/lib/roster";

type Tone = NonNullable<BadgeProps["tone"]>;

export type NeedStyle = {
  label: string;
  tone: Tone;
  /** The hairline rail down the left of a roster row. */
  stripe: string;
};

export const NEED_STYLE: Record<Need, NeedStyle> = {
  quiet: { label: "Quiet", tone: "quiet", stripe: "bg-quiet" },
  stuck: { label: "Stuck", tone: "stuck", stripe: "bg-stuck" },
  ahead: { label: "Ahead", tone: "ahead", stripe: "bg-ahead" },
  "on-track": { label: "On track", tone: "on-track", stripe: "bg-ontrack" },
  "not-started": { label: "Not started", tone: "neutral", stripe: "bg-cream-faint" },
};

/** Row entry stagger: 40ms apart, and never more than eight steps of it. */
export const MAX_STAGGER_ROWS = 8;
export function stagger(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, MAX_STAGGER_ROWS - 1) * 40}ms` };
}
