import type { Opening, Plan, PlanNode, Wall } from "@oya/schema";
import { type Vec2, dist, lerp, norm, sub } from "./vec";

export interface PlanIndex {
  nodes: Map<string, PlanNode>;
  walls: Map<string, Wall>;
  /** Wall ids touching each node. */
  wallsAt: Map<string, string[]>;
  openingsOn: Map<string, Opening[]>;
}

export function indexPlan(plan: Plan): PlanIndex {
  const nodes = new Map(plan.nodes.map((n) => [n.id, n]));
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  const wallsAt = new Map<string, string[]>();
  for (const n of plan.nodes) wallsAt.set(n.id, []);
  for (const w of plan.walls) {
    wallsAt.get(w.a)?.push(w.id);
    wallsAt.get(w.b)?.push(w.id);
  }
  const openingsOn = new Map<string, Opening[]>();
  for (const o of plan.openings) {
    const list = openingsOn.get(o.wallId) ?? [];
    list.push(o);
    openingsOn.set(o.wallId, list);
  }
  return { nodes, walls, wallsAt, openingsOn };
}

export function wallEnds(ix: PlanIndex, w: Wall): [Vec2, Vec2] {
  const a = ix.nodes.get(w.a);
  const b = ix.nodes.get(w.b);
  if (!a || !b) throw new Error(`wall ${w.id} references a missing node`);
  return [a, b];
}

export function wallLength(ix: PlanIndex, w: Wall): number {
  const [a, b] = wallEnds(ix, w);
  return dist(a, b);
}

export function wallDirection(ix: PlanIndex, w: Wall): Vec2 {
  const [a, b] = wallEnds(ix, w);
  return norm(sub(b, a));
}

export function pointAlongWall(ix: PlanIndex, w: Wall, offset: number): Vec2 {
  const [a, b] = wallEnds(ix, w);
  const l = dist(a, b);
  return lerp(a, b, l === 0 ? 0 : offset / l);
}

export const wallHeight = (plan: Plan, w: Wall): number => w.height ?? plan.params.wallHeight;

/** The node at the other end of a wall. */
export const otherEnd = (w: Wall, nodeId: string): string => (w.a === nodeId ? w.b : w.a);
