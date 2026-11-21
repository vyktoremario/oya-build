import type { Plan } from "@oya/schema";
import { type PlanIndex, indexPlan, otherEnd } from "./graph";
import { area, centroid, offsetPolygon, pointInPolygon, signedArea } from "./polygon";
import type { Vec2 } from "./vec";

export interface Face {
  nodeIds: string[];
  /** wallIds[i] is the wall between nodeIds[i] and nodeIds[i+1]. */
  wallIds: string[];
  polygon: Vec2[];
  signedArea: number;
}

export interface Room {
  id: string;
  name: string;
  labelId: string | null;
  /** Centreline polygon. */
  polygon: Vec2[];
  /** Polygon to the inner faces of the surrounding walls. */
  clearPolygon: Vec2[];
  /** mm² */
  clearArea: number;
  centre: Vec2;
}

export interface Topology {
  faces: Face[];
  rooms: Room[];
  /** Centreline polygon of the building outline (largest connected component), or null. */
  footprint: Face | null;
  /** Outline to the outer faces of the external walls. */
  footprintOuter: Vec2[] | null;
  /** Wall ids that bound the footprint. */
  perimeterWallIds: Set<string>;
  /** Walls that don't close any room (dangling or isolated). */
  openWallIds: Set<string>;
}

/** Remove back-and-forth spurs (…a, b, a…) caused by dangling walls inside a face walk. */
export function removeSpurs(nodeIds: string[], wallIds: string[]): { nodeIds: string[]; wallIds: string[] } {
  let n = [...nodeIds];
  let w = [...wallIds];
  let found = true;
  while (found && w.length >= 2) {
    found = false;
    for (let i = 0; i < w.length; i++) {
      const j = (i + 1) % w.length;
      if (w[i] !== w[j]) continue;
      // Rotate so the spur's outgoing edge is first: n[0]=a, n[1]=b (tip), n[2]=a; w[0]=w[1]=X.
      n = [...n.slice(i), ...n.slice(0, i)];
      w = [...w.slice(i), ...w.slice(0, i)];
      n.splice(1, 2);
      w.splice(0, 2);
      if (w.length === 0) n = [];
      found = true;
      break;
    }
  }
  return { nodeIds: n, wallIds: w };
}

export function planarFaces(plan: Plan, ix: PlanIndex = indexPlan(plan)): Face[] {
  // Sorted neighbour lists (by angle) for each node.
  const sorted = new Map<string, { to: string; wall: string; angle: number }[]>();
  for (const [nodeId, wallIds] of ix.wallsAt) {
    const here = ix.nodes.get(nodeId)!;
    const list = wallIds
      .map((wid) => {
        const w = ix.walls.get(wid)!;
        const to = otherEnd(w, nodeId);
        const there = ix.nodes.get(to)!;
        return { to, wall: wid, angle: Math.atan2(there.y - here.y, there.x - here.x) };
      })
      .filter((e) => e.to !== nodeId)
      .sort((a, b) => a.angle - b.angle);
    sorted.set(nodeId, list);
  }

  const visited = new Set<string>();
  const key = (from: string, wall: string) => `${from}>${wall}`;
  const faces: Face[] = [];

  for (const w of plan.walls) {
    if (w.a === w.b) continue;
    for (const [start, startTo] of [
      [w.a, w.b],
      [w.b, w.a],
    ] as const) {
      if (visited.has(key(start, w.id))) continue;
      const nodeIds: string[] = [];
      const wallIds: string[] = [];
      let from = start;
      let to: string = startTo;
      let wall = w.id;
      let guard = 0;
      while (!visited.has(key(from, wall)) && guard++ < 10000) {
        visited.add(key(from, wall));
        nodeIds.push(from);
        wallIds.push(wall);
        const list = sorted.get(to)!;
        const idx = list.findIndex((e) => e.wall === wall);
        const nextEdge = list[(idx - 1 + list.length) % list.length]!;
        from = to;
        to = nextEdge.to;
        wall = nextEdge.wall;
      }
      const polygon = nodeIds.map((id) => {
        const n = ix.nodes.get(id)!;
        return { x: n.x, y: n.y };
      });
      faces.push({ nodeIds, wallIds, polygon, signedArea: signedArea(polygon) });
    }
  }
  return faces;
}

function components(plan: Plan, ix: PlanIndex): Map<string, number> {
  const comp = new Map<string, number>();
  let c = 0;
  for (const n of plan.nodes) {
    if (comp.has(n.id)) continue;
    const stack = [n.id];
    comp.set(n.id, c);
    while (stack.length) {
      const id = stack.pop()!;
      for (const wid of ix.wallsAt.get(id) ?? []) {
        const o = otherEnd(ix.walls.get(wid)!, id);
        if (!comp.has(o)) {
          comp.set(o, c);
          stack.push(o);
        }
      }
    }
    c++;
  }
  return comp;
}

const MIN_ROOM_AREA = 0.5e6; // 0.5 m²

export function topology(plan: Plan, ix: PlanIndex = indexPlan(plan)): Topology {
  const faces = planarFaces(plan, ix).map((f) => {
    const cleaned = removeSpurs(f.nodeIds, f.wallIds);
    const polygon = cleaned.nodeIds.map((id) => {
      const n = ix.nodes.get(id)!;
      return { x: n.x, y: n.y };
    });
    return { ...cleaned, polygon, signedArea: signedArea(polygon) };
  });
  const comp = components(plan, ix);

  // The outer face of each component is the one with the largest absolute area.
  const outerByComp = new Map<number, Face>();
  for (const f of faces) {
    if (!f.nodeIds.length) continue;
    const c = comp.get(f.nodeIds[0]!)!;
    const cur = outerByComp.get(c);
    if (!cur || Math.abs(f.signedArea) > Math.abs(cur.signedArea)) outerByComp.set(c, f);
  }
  const outerFaces = new Set(outerByComp.values());

  let footprint: Face | null = null;
  for (const f of outerFaces) if (!footprint || Math.abs(f.signedArea) > Math.abs(footprint.signedArea)) footprint = f;
  if (footprint && Math.abs(footprint.signedArea) < MIN_ROOM_AREA) footprint = null;

  const thickness = (wid: string) => ix.walls.get(wid)?.thickness ?? 0;
  const roomFaces = faces.filter((f) => !outerFaces.has(f) && Math.abs(f.signedArea) >= MIN_ROOM_AREA);

  const usedLabels = new Set<string>();
  const rooms: Room[] = roomFaces.map((f, i) => {
    const clearPolygon = offsetPolygon(f.polygon, f.wallIds.map((w) => -thickness(w) / 2));
    const label = plan.labels.find((l) => !usedLabels.has(l.id) && pointInPolygon(l, f.polygon));
    if (label) usedLabels.add(label.id);
    return {
      id: `room_${f.nodeIds.slice().sort().join("_")}`,
      name: label?.name ?? `Room ${i + 1}`,
      labelId: label?.id ?? null,
      polygon: f.polygon,
      clearPolygon,
      clearArea: area(clearPolygon),
      centre: label ? { x: label.x, y: label.y } : centroid(clearPolygon),
    };
  });

  const footprintOuter = footprint ? offsetPolygon(footprint.polygon, footprint.wallIds.map((w) => thickness(w) / 2)) : null;
  const perimeterWallIds = new Set(footprint?.wallIds ?? []);
  const inRoom = new Set(roomFaces.flatMap((f) => f.wallIds));
  const openWallIds = new Set(plan.walls.filter((w) => !inRoom.has(w.id)).map((w) => w.id));

  return { faces, rooms, footprint, footprintOuter, perimeterWallIds, openWallIds };
}
