/**
 * How much of the six days has actually happened.
 *
 * Local on purpose: `@/components/ui` has Badge, Button, Card, Field and Select,
 * but no Progress. Rather than import a component that does not exist — or add
 * one to a directory another lane owns — the roster keeps its own six-cell bar.
 * Six cells, not a percentage: a week here is a countable number of days, and
 * "4/6" is a truer read than "67%".
 *
 * Swap the body for `<Progress />` the day that component lands; the props are
 * already the ones it would take.
 */
export function WeekBar({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const cells = Array.from({ length: Math.max(total, 1) }, (_, i) => i < done);

  return (
    <div
      role="img"
      aria-label={`${done} of ${total} days answered`}
      className={`flex items-center gap-[3px] ${className ?? ""}`}
    >
      {cells.map((filled, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full ${filled ? "bg-cream-dim" : "bg-ink-700"}`}
        />
      ))}
    </div>
  );
}
