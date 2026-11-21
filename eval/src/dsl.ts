import { type OpeningSpec, type Plan, emptyPlan } from "@oya/schema";
import { addOpening, addWall, classifyWallKinds, indexPlan, normalizePlan, projectToSegment, wallLength } from "@oya/geometry";

export type Seg = [number, number, number, number];

export interface PlanSpec {
  name: string;
  /** Wall centrelines in mm. Junctions are found automatically. */
  walls: Seg[];
  /** Openings by a point on a wall centreline and a spec id. */
  openings: { at: [number, number]; spec: string }[];
  labels: { at: [number, number]; name: string }[];
}

/** Build a clean, exact Plan from a compact description. Used for the demo sample and eval truth. */
export function buildPlan(spec: PlanSpec, specs: OpeningSpec[]): Plan {
  let plan = emptyPlan(spec.name);
  plan.source = { kind: "sample", mmPerPx: null, originX: 0, originY: 0, imageWidth: 0, imageHeight: 0, scaleSource: "exact" };
  for (const [x1, y1, x2, y2] of spec.walls) plan = addWall(plan, { x: x1, y: y1 }, { x: x2, y: y2 }, { snap: 5 }).plan;
  plan = classifyWallKinds(normalizePlan(plan, 5));
  for (const o of spec.openings) {
    const ix = indexPlan(plan);
    const s = specs.find((x) => x.id === o.spec);
    if (!s) throw new Error(`unknown spec ${o.spec}`);
    const p = { x: o.at[0], y: o.at[1] };
    const hit = plan.walls
      .map((w) => ({ w, pr: projectToSegment(p, ix.nodes.get(w.a)!, ix.nodes.get(w.b)!) }))
      .sort((a, b) => a.pr.distance - b.pr.distance)[0];
    if (!hit || hit.pr.distance > 5) throw new Error(`${spec.name}: opening at ${o.at} is not on a wall`);
    plan = addOpening(plan, hit.w.id, hit.pr.t * wallLength(ix, hit.w), s);
  }
  spec.labels.forEach((l, i) => plan.labels.push({ id: `l${i}`, x: l.at[0], y: l.at[1], name: l.name }));
  return plan;
}
