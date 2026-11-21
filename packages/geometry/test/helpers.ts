import { type Plan, type WallKind, emptyPlan } from "@oya/schema";
import { THICKNESS } from "../src/edit";

/** Build a plan from node coordinates and wall pairs: walls given as [nodeA, nodeB, kind?]. */
export function makePlan(nodes: Record<string, [number, number]>, walls: [string, string, WallKind?][]): Plan {
  const p = emptyPlan("test");
  p.nodes = Object.entries(nodes).map(([id, [x, y]]) => ({ id, x, y }));
  p.walls = walls.map(([a, b, kind = "external"], i) => ({ id: `w${i}`, a, b, kind, thickness: THICKNESS[kind] }));
  return p;
}

/** A W×D rectangle of external walls with corners a(0,0) b(W,0) c(W,D) d(0,D). */
export const rect = (W: number, D: number) =>
  makePlan({ a: [0, 0], b: [W, 0], c: [W, D], d: [0, D] }, [["a", "b"], ["b", "c"], ["c", "d"], ["d", "a"]]);
