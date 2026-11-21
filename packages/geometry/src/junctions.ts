import type { Plan, Wall } from "@oya/schema";
import { type PlanIndex, indexPlan, otherEnd, wallLength } from "./graph";
import { dot, norm, sub } from "./vec";

/**
 * How each wall end meets its neighbours. "through" walls run past the junction; "abutting"
 * walls stop against the face of a through wall.
 */
export type EndRole = "free" | "corner" | "through" | "abutting";

export interface WallEndInfo {
  role: EndRole;
  /** Thickness of the through wall this end abuts (0 unless role === "abutting"). */
  abutsThickness: number;
  /** Thickness of the wall it meets at a corner (0 unless role === "corner"). */
  cornerThickness: number;
}

const COLLINEAR_COS = Math.cos((10 * Math.PI) / 180);

function directionFrom(ix: PlanIndex, w: Wall, nodeId: string) {
  const here = ix.nodes.get(nodeId)!;
  const there = ix.nodes.get(otherEnd(w, nodeId))!;
  return norm(sub(there, here));
}

/** Classify both ends of every wall. Pure function of topology and thicknesses. */
export function classifyEnds(plan: Plan, ix: PlanIndex = indexPlan(plan)): Map<string, [WallEndInfo, WallEndInfo]> {
  const result = new Map<string, [WallEndInfo, WallEndInfo]>();
  const free: WallEndInfo = { role: "free", abutsThickness: 0, cornerThickness: 0 };
  for (const w of plan.walls) result.set(w.id, [free, free]);

  for (const [nodeId, wallIds] of ix.wallsAt) {
    const walls = wallIds.map((id) => ix.walls.get(id)!).filter(Boolean);
    const set = (w: Wall, info: WallEndInfo) => {
      const pair = result.get(w.id)!;
      // A wall whose both ends are the same node is degenerate; ignore.
      if (w.a === nodeId) pair[0] = info;
      if (w.b === nodeId) pair[1] = info;
    };
    if (walls.length === 2) {
      const [w1, w2] = walls as [Wall, Wall];
      const straight = dot(directionFrom(ix, w1, nodeId), directionFrom(ix, w2, nodeId)) < -COLLINEAR_COS;
      set(w1, { role: straight ? "through" : "corner", abutsThickness: 0, cornerThickness: straight ? 0 : w2.thickness });
      set(w2, { role: straight ? "through" : "corner", abutsThickness: 0, cornerThickness: straight ? 0 : w1.thickness });
    } else if (walls.length >= 3) {
      // Through pair: the thickest pair of (nearly) opposite walls. Otherwise the thickest wall alone.
      let best: [Wall, Wall | null] | null = null;
      let bestScore = -1;
      for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
          const wi = walls[i]!;
          const wj = walls[j]!;
          if (dot(directionFrom(ix, wi, nodeId), directionFrom(ix, wj, nodeId)) < -COLLINEAR_COS) {
            const score = wi.thickness + wj.thickness;
            if (score > bestScore) {
              bestScore = score;
              best = [wi, wj];
            }
          }
        }
      }
      if (!best) {
        const thickest = walls.reduce((m, w) => (w.thickness > m.thickness ? w : m));
        best = [thickest, null];
      }
      const throughThickness = Math.max(best[0].thickness, best[1]?.thickness ?? 0);
      for (const w of walls) {
        if (w === best[0] || w === best[1]) set(w, { role: "through", abutsThickness: 0, cornerThickness: 0 });
        else set(w, { role: "abutting", abutsThickness: throughThickness, cornerThickness: 0 });
      }
    }
  }
  return result;
}

/**
 * Measured length of each wall for taking off quantities, centreline method:
 * corners are measured to the centreline intersection (exact for square corners of equal thickness);
 * abutting walls stop at the face of the through wall. `widthOf` lets substructure items use the
 * footing width instead of the wall thickness when trimming at T-junctions.
 */
export function measuredLengths(
  plan: Plan,
  widthOf: (w: Wall) => number = (w) => w.thickness,
  ix: PlanIndex = indexPlan(plan),
): Map<string, number> {
  const ends = classifyEnds(plan, ix);
  const out = new Map<string, number>();
  for (const w of plan.walls) {
    const [ea, eb] = ends.get(w.id)!;
    let l = wallLength(ix, w);
    for (const [e, nodeId] of [[ea, w.a], [eb, w.b]] as const) {
      if (e.role !== "abutting") continue;
      // Half the width of the through element at this node (thickness or footing width).
      const through = (ix.wallsAt.get(nodeId) ?? [])
        .map((id) => ix.walls.get(id)!)
        .filter((x) => x.id !== w.id && ends.get(x.id)!.some((info, k) => (k === 0 ? x.a : x.b) === nodeId && info.role === "through"));
      const half = Math.max(0, ...through.map((t) => widthOf(t))) / 2;
      l -= half;
    }
    out.set(w.id, Math.max(0, l));
  }
  return out;
}

/**
 * How far to extend (+) or trim (−) each end of a wall when drawing it as a box so corners close
 * neatly: corners extend by half the other wall's thickness, abutting ends trim to the through wall's face.
 */
export function renderEndAdjustments(plan: Plan, ix: PlanIndex = indexPlan(plan)): Map<string, [number, number]> {
  const ends = classifyEnds(plan, ix);
  const out = new Map<string, [number, number]>();
  for (const w of plan.walls) {
    const adj = ends.get(w.id)!.map((e) => {
      if (e.role === "corner") return e.cornerThickness / 2;
      if (e.role === "abutting") return -e.abutsThickness / 2;
      return 0;
    }) as [number, number];
    out.set(w.id, adj);
  }
  return out;
}
