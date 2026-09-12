/** T-B2 smoke: the real fixture line through planWeek. node --env-file=.env --import tsx scripts/try-plan.ts */
import { planWeek } from "../packages/agent-core/src/llm";

const t0 = Date.now();
const plan = await planWeek({
  student_id: "jonas",
  tutor_line: "Jonas — German past tense of irregular verbs, ten minutes a day. He's nervous about speaking out loud.",
});

console.log(`--- ${Date.now() - t0}ms · ${process.env.MODEL} · v${plan.version} ---`);
console.log("reason:", plan.reason);
console.log("targets:", [...new Set(plan.days.flatMap((d) => d.target_items))].join(", "));
for (const d of plan.days) {
  console.log(`  ${d.day} ${d.kind.padEnd(8)} ${JSON.stringify(d.expects).padEnd(14)} ${d.prompt}`);
}
const firstProduce = plan.days.find((d) => d.kind === "produce")?.day;
console.log(`\nCHECK first 'produce' day = ${firstProduce ?? "none"} — want >= 3.`);
console.log(`  Day 1 means the prompt read the nouns and ignored "nervous about speaking out loud".`);
