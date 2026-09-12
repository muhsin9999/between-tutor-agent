import type { Plan } from "../packages/agent-core/src/contracts";

export function germanPlan(student_id: string, version = 1): Plan {
  const rows = [
    ["gehen", "ging"],
    ["sehen", "sah"],
    ["nehmen", "nahm"],
    ["sprechen", "sprach"],
    ["trinken", "trank"],
    ["fahren", "fuhr"],
  ] as const;

  return {
    student_id,
    version,
    reason: version === 1 ? "initial plan from tutor's brief" : "fixture revision",
    created_at: new Date().toISOString(),
    days: rows.map(([item, expects], index) => ({
      day: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      kind: index === 4 ? "produce" : "drill",
      prompt: `What is the past tense of ${item}?`,
      target_items: [...rows.map(([target]) => target)],
      expects,
    })),
  };
}
