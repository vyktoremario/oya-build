import type { Plan } from "@oya/schema";
import { indexPlan, wallHeight } from "./graph";
import { renderEndAdjustments } from "./junctions";
import { area, boundingBox } from "./polygon";
import { topology } from "./faces";

/** An axis-aligned box in wall-local space, placed in plan space. Units: mm. Plan y maps to 3D z. */
export interface WallBox {
  key: string;
  wallId: string;
  /** Centre in plan coordinates. */
  cx: number;
  cy: number;
  /** Bottom and top heights. */
  z0: number;
  z1: number;
  length: number;
  thickness: number;
  /** Rotation about the vertical axis, radians, from plan +x towards plan +y. */
  angle: number;
}

export interface OpeningBox {
  openingId: string;
  kind: "door" | "window";
  cx: number;
  cy: number;
  z0: number;
  z1: number;
  width: number;
  thickness: number;
  angle: number;
}

/** Build each wall as boxes around its openings (no CSG): full-height piers, sills and heads. */
export function wallBoxes(plan: Plan): { walls: WallBox[]; openings: OpeningBox[] } {
  const ix = indexPlan(plan);
  const adj = renderEndAdjustments(plan, ix);
  const walls: WallBox[] = [];
  const openings: OpeningBox[] = [];
  for (const w of plan.walls) {
    const a = ix.nodes.get(w.a)!;
    const b = ix.nodes.get(w.b)!;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 1) continue;
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;
    const angle = Math.atan2(uy, ux);
    const H = wallHeight(plan, w);
    const [ea, eb] = adj.get(w.id)!;
    const start = -ea;
    const end = L + eb;
    const ops = (ix.openingsOn.get(w.id) ?? []).slice().sort((p, q) => p.offset - q.offset);
    const push = (s: number, e: number, z0: number, z1: number, key: string) => {
      if (e - s < 1 || z1 - z0 < 1) return;
      const mid = (s + e) / 2;
      walls.push({ key: `${w.id}:${key}`, wallId: w.id, cx: a.x + ux * mid, cy: a.y + uy * mid, z0, z1, length: e - s, thickness: w.thickness, angle });
    };
    let cursor = start;
    ops.forEach((o, i) => {
      const s = o.offset - o.width / 2;
      const e = o.offset + o.width / 2;
      push(cursor, s, 0, H, `p${i}`);
      push(s, e, 0, o.sill, `s${i}`);
      push(s, e, o.sill + o.height, H, `h${i}`);
      openings.push({
        openingId: o.id,
        kind: o.kind,
        cx: a.x + ux * o.offset,
        cy: a.y + uy * o.offset,
        z0: o.sill,
        z1: o.sill + o.height,
        width: o.width,
        thickness: w.thickness,
        angle,
      });
      cursor = Math.max(cursor, e);
    });
    push(cursor, end, 0, H, "end");
  }
  return { walls, openings };
}

export interface RoofMesh {
  /** Flat array of xyz triples in plan mm (x, height, y). */
  positions: number[];
  indices: number[];
  /** True when the footprint isn't a rectangle and the roof is drawn over its bounding box. */
  simplified: boolean;
  ridgeHeight: number;
}

/** Hip or gable roof over the outline's bounding rectangle, plus overhang, starting at wall top. */
export function roofMesh(plan: Plan): RoofMesh | null {
  const topo = topology(plan);
  if (!topo.footprintOuter) return null;
  const bb = boundingBox(topo.footprintOuter);
  const p = plan.params;
  const o = p.roofOverhang;
  const x0 = bb.minX - o;
  const x1 = bb.maxX + o;
  const y0 = bb.minY - o;
  const y1 = bb.maxY + o;
  const w = x1 - x0;
  const d = y1 - y0;
  const base = p.wallHeight;
  const tan = Math.tan((p.roofPitchDeg * Math.PI) / 180);
  const alongX = w >= d; // ridge runs along the longer side
  const half = (alongX ? d : w) / 2;
  const rise = half * tan;
  const top = base + rise;
  const simplified = area(topo.footprintOuter) / ((bb.maxX - bb.minX) * (bb.maxY - bb.minY)) < 0.97;

  const positions: number[] = [];
  const indices: number[] = [];
  const vtx = (x: number, z: number, y: number) => {
    positions.push(x, z, y);
    return positions.length / 3 - 1;
  };
  const c00 = vtx(x0, base, y0);
  const c10 = vtx(x1, base, y0);
  const c11 = vtx(x1, base, y1);
  const c01 = vtx(x0, base, y1);
  const quad = (a: number, b: number, c: number, e: number) => indices.push(a, b, c, a, c, e);

  if (alongX) {
    const ym = (y0 + y1) / 2;
    const inset = p.roofType === "hip" ? half : 0;
    const r0 = vtx(x0 + inset, top, ym);
    const r1 = vtx(x1 - inset, top, ym);
    quad(c00, c10, r1, r0); // front slope
    quad(c11, c01, r0, r1); // back slope
    indices.push(c01, c00, r0); // west end (hip slope or gable wall)
    indices.push(c10, c11, r1); // east end
  } else {
    const xm = (x0 + x1) / 2;
    const inset = p.roofType === "hip" ? half : 0;
    const r0 = vtx(xm, top, y0 + inset);
    const r1 = vtx(xm, top, y1 - inset);
    quad(c01, c00, r0, r1);
    quad(c10, c11, r1, r0);
    indices.push(c00, c10, r0);
    indices.push(c11, c01, r1);
  }
  return { positions, indices, simplified, ridgeHeight: top };
}
