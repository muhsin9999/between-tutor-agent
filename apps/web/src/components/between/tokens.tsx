/**
 * The only thing the seven components share.
 *
 * Deliberately just colour and font stacks — no spacing scale, no card shell, no
 * shared wrapper. Every shared layout primitive is one more reason two
 * components drift into looking like each other, and the whole claim of the
 * panel is that they don't.
 */

export const INK = "#16306B"; // ink navy
export const AMBER = "#F5A623";
export const CREAM = "#FBF5E6";
export const RED = "#C0392B";
export const GREEN = "#2E7D4F";

export const PAPER = "#FFFFFF";
export const HAIRLINE = "#D8DCE6";
export const MUTED = "#6B7490";

export const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const SERIF = 'Georgia, "Times New Roman", Times, serif';
export const MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/**
 * Two alignment constants — not a layout kit.
 *
 * `GUTTER` is the horizontal inset every component sets its own text against,
 * so the first character of the error table, the pull quote and the plan reason
 * all sit on one vertical line down the page. It buys a shared reading edge
 * without buying a shared shell: each component still chooses its own fill,
 * rule and vertical rhythm, which is the part that has to stay different.
 *
 * `TYPE` is a 1.2-ish scale. Its only job is to stop the next size from being
 * invented — 9px here, 17px there — which is what makes a screen read as a
 * draft no matter how good the individual pieces are.
 */
export const GUTTER = 18;

export const TYPE = {
  /** eyebrows, table headers, attributions */
  micro: 11,
  /** captions, notes, the quieter half of a pair */
  fine: 12,
  /** table body, margin notes */
  small: 13,
  /** default reading size */
  body: 15,
  /** the one sentence a component is about */
  lead: 18,
  /** a component's own heading */
  title: 20,
} as const;
