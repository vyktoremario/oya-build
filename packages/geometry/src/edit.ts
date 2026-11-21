import { type Opening, type OpeningSpec, type Plan, type PlanNode, type Wall, type WallKind, newId } from "@oya/schema";
import { indexPlan, wallLength } from "./graph";
import { topology } from "./faces";
import { type Vec2, dist, projectToSegment, segmentIntersection } from "./vec";

/** Pure editing operations on a Plan. Each returns a new Plan; inputs are never mutated. */

export const THICKNESS: Record<WallKind, number> = { external: 225, internal: 150 };
const OPENING_EDGE_CLEARANCE = 50;

const clone = (plan: Plan): Plan => structuredClone(plan);
const round = (n: number) => Math.round(n);

export function moveNode(plan: Plan, nodeId: string, to: Vec2): Plan {
  const next = clone(plan);
  const n = next.nodes.find((x) => x.id === nodeId);
  if (!n) return plan;
  n.x = round(to.x);
  n.y = round(to.y);
  return clampOpenings(next);
}

/** Move a whole wall (both nodes) by a delta, dragging connected walls with it. */
export function moveWall(plan: Plan, wallId: string, delta: Vec2): Plan {
  const next = clone(plan);
  const w = next.walls.find((x) => x.id === wallId);
  if (!w) return plan;
  for (const id of new Set([w.a, w.b])) {
    const n = next.nodes.find((x) => x.id === id)!;
    n.x = round(n.x + delta.x);
    n.y = round(n.y + delta.y);
  }
  return clampOpenings(next);
}

export function setWallProps(plan: Plan, wallId: string, props: Partial<Pick<Wall, "kind" | "thickness" | "height">>): Plan {
  const next = clone(plan);
  const w = next.walls.find((x) => x.id === wallId);
  if (!w) return plan;
  Object.assign(w, props);
  if (props.kind && !props.thickness) w.thickness = THICKNESS[props.kind];
  return next;
}

export function deleteWall(plan: Plan, wallId: string): Plan {
  const next = clone(plan);
  next.walls = next.walls.filter((w) => w.id !== wallId);
  next.openings = next.openings.filter((o) => o.wallId !== wallId);
  return dropOrphanNodes(next);
}

export function deleteNode(plan: Plan, nodeId: string): Plan {
  let next = clone(plan);
  for (const w of plan.walls.filter((w) => w.a === nodeId || w.b === nodeId)) next = deleteWall(next, w.id);
  next.nodes = next.nodes.filter((n) => n.id !== nodeId);
  return next;
}

function dropOrphanNodes(plan: Plan): Plan {
  const used = new Set(plan.walls.flatMap((w) => [w.a, w.b]));
  plan.nodes = plan.nodes.filter((n) => used.has(n.id));
  return plan;
}

/** Split a wall at a distance along it from node a. Openings move to whichever half holds their centre. */
export function splitWall(plan: Plan, wallId: string, at: number, nodeId = newId("n")): Plan {
  const next = clone(plan);
  splitWallMut(next, wallId, at, nodeId);
  return next;
}

function splitWallMut(plan: Plan, wallId: string, at: number, nodeId: string): string | null {
  const ix = indexPlan(plan);
  const w = ix.walls.get(wallId);
  if (!w) return null;
  const a = ix.nodes.get(w.a)!;
  const b = ix.nodes.get(w.b)!;
  const l = dist(a, b);
  if (at <= 1 || at >= l - 1) return null;
  const t = at / l;
  const node: PlanNode = { id: nodeId, x: round(a.x + (b.x - a.x) * t), y: round(a.y + (b.y - a.y) * t) };
  plan.nodes.push(node);
  const w2: Wall = { ...w, id: newId("w"), a: node.id, b: w.b };
  const w1 = plan.walls.find((x) => x.id === wallId)!;
  w1.b = node.id;
  plan.walls.push(w2);
  for (const o of plan.openings) {
    if (o.wallId !== wallId) continue;
    if (o.offset > at) {
      o.wallId = w2.id;
      o.offset = o.offset - at;
    }
  }
  return node.id;
}

export interface AddWallOptions {
  kind?: WallKind;
  thickness?: number;
  /** Snap distance for reusing existing nodes / splitting existing walls. */
  snap?: number;
}

/** Find or create a node at p: reuse a nearby node, or split a nearby wall, or add a free node. */
function nodeAt(plan: Plan, p: Vec2, snap: number): string {
  let best: PlanNode | null = null;
  let bestD = snap;
  for (const n of plan.nodes) {
    const d = dist(n, p);
    if (d <= bestD) {
      best = n;
      bestD = d;
    }
  }
  if (best) return best.id;
  const ix = indexPlan(plan);
  for (const w of plan.walls) {
    const a = ix.nodes.get(w.a)!;
    const b = ix.nodes.get(w.b)!;
    const pr = projectToSegment(p, a, b);
    if (pr.distance <= snap && pr.t > 0 && pr.t < 1) {
      const id = splitWallMut(plan, w.id, pr.t * dist(a, b), newId("n"));
      if (id) return id;
    }
  }
  const id = newId("n");
  plan.nodes.push({ id, x: round(p.x), y: round(p.y) });
  return id;
}

export function addWall(plan: Plan, from: Vec2, to: Vec2, opts: AddWallOptions = {}): { plan: Plan; wallIds: string[] } {
  const snap = opts.snap ?? 100;
  const kind = opts.kind ?? "internal";
  const next = clone(plan);
  const a = nodeAt(next, from, snap);
  const b = nodeAt(next, to, snap);
  if (a === b) return { plan, wallIds: [] };
  const id = newId("w");
  next.walls.push({ id, a, b, kind, thickness: opts.thickness ?? THICKNESS[kind] });
  const before = new Set(next.walls.map((w) => w.id));
  const normalized = splitCrossings(next);
  const wallIds = normalized.walls.filter((w) => w.id === id || !before.has(w.id)).map((w) => w.id);
  return { plan: normalized, wallIds };
}

export function addOpening(plan: Plan, wallId: string, offset: number, spec: OpeningSpec): Plan {
  const next = clone(plan);
  next.openings.push({
    id: newId("o"),
    wallId,
    kind: spec.kind,
    offset: round(offset),
    width: spec.width,
    height: spec.height,
    sill: spec.sill,
    specId: spec.id,
  });
  return clampOpenings(next);
}

export function updateOpening(plan: Plan, openingId: string, props: Partial<Omit<Opening, "id">>): Plan {
  const next = clone(plan);
  const o = next.openings.find((x) => x.id === openingId);
  if (!o) return plan;
  Object.assign(o, props);
  if (props.offset !== undefined) o.offset = round(props.offset);
  return clampOpenings(next);
}

export function deleteOpening(plan: Plan, openingId: string): Plan {
  const next = clone(plan);
  next.openings = next.openings.filter((o) => o.id !== openingId);
  return next;
}

/** Keep openings inside their walls; drop openings on walls too short to hold them. */
export function clampOpenings(plan: Plan): Plan {
  const ix = indexPlan(plan);
  plan.openings = plan.openings.filter((o) => {
    const w = ix.walls.get(o.wallId);
    if (!w) return false;
    const l = wallLength(ix, w);
    const min = o.width / 2 + OPENING_EDGE_CLEARANCE;
    const max = l - o.width / 2 - OPENING_EDGE_CLEARANCE;
    if (max < min) return false;
    o.offset = round(Math.min(max, Math.max(min, o.offset)));
    return true;
  });
  return plan;
}

/** Split walls where they cross each other, so every junction is a node. */
export function splitCrossings(plan: Plan): Plan {
  const next = clone(plan);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 1000) {
    changed = false;
    const ix = indexPlan(next);
    outer: for (let i = 0; i < next.walls.length; i++) {
      for (let j = i + 1; j < next.walls.length; j++) {
        const w1 = next.walls[i]!;
        const w2 = next.walls[j]!;
        if (w1.a === w2.a || w1.a === w2.b || w1.b === w2.a || w1.b === w2.b) continue;
        const a = ix.nodes.get(w1.a)!;
        const b = ix.nodes.get(w1.b)!;
        const c = ix.nodes.get(w2.a)!;
        const d = ix.nodes.get(w2.b)!;
        const hit = segmentIntersection(a, b, c, d);
        if (!hit) continue;
        const l1 = dist(a, b);
        const l2 = dist(c, d);
        const at1 = hit.t * l1;
        const at2 = hit.u * l2;
        const interior1 = at1 > 1 && at1 < l1 - 1;
        const interior2 = at2 > 1 && at2 < l2 - 1;
        if (!interior1 && !interior2) continue;
        let junction: string;
        if (interior1) {
          junction = newId("n");
          splitWallMut(next, w1.id, at1, junction);
        } else {
          junction = at1 <= 1 ? w1.a : w1.b;
        }
        if (interior2) {
          const tmp = splitWallMut(next, w2.id, at2, newId("n"));
          if (tmp) mergeNodeInto(next, tmp, junction);
        } else {
          mergeNodeInto(next, at2 <= 1 ? w2.a : w2.b, junction);
        }
        changed = true;
        break outer;
      }
    }
  }
  return next;
}

/** Replace node `from` by node `into` everywhere; removes walls that collapse or duplicate. */
export function mergeNodeInto(plan: Plan, from: string, into: string): void {
  if (from === into) return;
  for (const w of plan.walls) {
    if (w.a === from) w.a = into;
    if (w.b === from) w.b = into;
  }
  plan.nodes = plan.nodes.filter((n) => n.id !== from);
  dedupeWalls(plan);
}

function dedupeWalls(plan: Plan): void {
  const seen = new Map<string, string>();
  const removed = new Map<string, string>();
  plan.walls = plan.walls.filter((w) => {
    if (w.a === w.b) {
      removed.set(w.id, "");
      return false;
    }
    const k = [w.a, w.b].sort().join("|");
    const keep = seen.get(k);
    if (keep) {
      removed.set(w.id, keep);
      return false;
    }
    seen.set(k, w.id);
    return true;
  });
  plan.openings = plan.openings.filter((o) => {
    const r = removed.get(o.wallId);
    if (r === undefined) return true;
    if (r === "") return false;
    o.wallId = r;
    return true;
  });
}

/**
 * Clean up a plan: merge nodes closer than `tolerance`, join wall ends that stop just short of
 * (or just past) another wall, split crossings, remove duplicates and orphans.
 */
export function normalizePlan(plan: Plan, tolerance = 100): Plan {
  const next = clone(plan);
  // 1. Merge close nodes (greedy clustering).
  for (let i = 0; i < next.nodes.length; i++) {
    const n = next.nodes[i]!;
    for (let j = next.nodes.length - 1; j > i; j--) {
      const m = next.nodes[j]!;
      if (dist(n, m) <= tolerance) {
        const deg = (id: string) => next.walls.filter((w) => w.a === id || w.b === id).length;
        const wn = deg(n.id) || 1;
        const wm = deg(m.id) || 1;
        n.x = round((n.x * wn + m.x * wm) / (wn + wm));
        n.y = round((n.y * wn + m.y * wm) / (wn + wm));
        mergeNodeInto(next, m.id, n.id);
      }
    }
  }
  // 2. T-junctions: a wall end close to another wall's interior gets snapped onto it.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    const ix = indexPlan(next);
    for (const n of next.nodes) {
      const walls = ix.wallsAt.get(n.id) ?? [];
      for (const w of next.walls) {
        if (walls.includes(w.id)) continue;
        const a = ix.nodes.get(w.a)!;
        const b = ix.nodes.get(w.b)!;
        const pr = projectToSegment(n, a, b);
        const l = dist(a, b);
        if (pr.distance <= tolerance && pr.t * l > tolerance && pr.t * l < l - tolerance) {
          const id = splitWallMut(next, w.id, pr.t * l, newId("n"));
          if (id) {
            mergeNodeInto(next, id, n.id);
            // Keep the through wall straight: put the junction node on the wall line.
            n.x = round(pr.point.x);
            n.y = round(pr.point.y);
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }
  }
  // 3. Crossings, duplicates, tiny walls, orphans.
  let out = splitCrossings(next);
  const ix = indexPlan(out);
  out.walls = out.walls.filter((w) => wallLength(ix, w) >= Math.max(50, tolerance / 2));
  dedupeWalls(out);
  out = dropOrphanNodes(out);
  return clampOpenings(out);
}

/** Classify walls on the building outline as external (9") and the rest as internal (6"). */
export function classifyWallKinds(plan: Plan): Plan {
  const next = clone(plan);
  const topo = topology(next);
  if (!topo.footprint) return next;
  for (const w of next.walls) {
    const kind: WallKind = topo.perimeterWallIds.has(w.id) ? "external" : "internal";
    w.kind = kind;
    w.thickness = THICKNESS[kind];
  }
  return next;
}
