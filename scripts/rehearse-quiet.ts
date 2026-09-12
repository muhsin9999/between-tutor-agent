import { getBrief } from "agent-core";
import "./seed-quiet";

const brief = await getBrief("mara");
const types = brief.components.map((component) => component.type);
if (types.join(",") !== "QuietCard,PlanLane") {
  throw new Error(`Expected only QuietCard and PlanLane for a quiet week; got ${types.join(", ")}.`);
}
console.log(JSON.stringify({ result: "PASS", brief_components: types }, null, 2));
