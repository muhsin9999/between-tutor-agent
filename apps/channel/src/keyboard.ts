/**
 * The rule, in code, so it is visible to anyone reading the repo.
 *
 * ≤8 choices → an inline keyboard that STAYS IN THE CHAT.
 * Never a panel, never a webview, never "open the app to answer".
 *
 * The student's leg is plain chat forever. A practice app is the exact thing he
 * will not open — that is *why* the six days are empty — so a panel on his side
 * would rebuild the failure the product exists to fix. The tutor gets a panel
 * because she is at a desk with five minutes and a decision to make. He is on a
 * bus with eight seconds.
 *
 * Recall practice has no choices to offer, so most turns are free text, which is
 * also what lets the exact-match grader run before any model sees the answer.
 * This exists for the turns that DO have options — a multiple choice, a
 * "which of these did you mean", a yes/no check-in.
 */
export const MAX_INLINE_CHOICES = 8;

export type Choices =
  | { kind: "inline"; options: string[] }
  | { kind: "text"; reason: string };

export function asChoices(options: string[]): Choices {
  if (options.length === 0) {
    return { kind: "text", reason: "no options — free recall" };
  }
  if (options.length > MAX_INLINE_CHOICES) {
    return {
      kind: "text",
      reason: `${options.length} options is past the ${MAX_INLINE_CHOICES}-choice threshold; ` +
        `a keyboard that long is a menu, and a menu on a phone is a form`,
    };
  }
  return { kind: "inline", options };
}
