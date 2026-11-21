import {
  type OpeningSpec,
  type Plan,
  type RawExtraction,
  type Wall,
  emptyPlan,
  newId,
} from "@oya/schema";
import { THICKNESS, classifyWallKinds, clampOpenings, mergeNodeInto, normalizePlan } from "./edit";
import { indexPlan, wallLength } from "./graph";
import { topology } from "./faces";
import { type Vec2, axisAngleDeg, dist, projectToSegment, segmentIntersection } from "./vec";

export interface ExtractionFlag {
  level: "info" | "warn";
  /** Entity the flag points at, if any. */
  ref?: { kind: "wall" | "opening" | "label"; id: string };
  message: string;
}

export interface PostProcessResult {
  plan: Plan;
  flags: ExtractionFlag[];
  scale: { mmPerPx: number; source: "dimensions" | "guess"; used: number; rejected: number };
}

export interface PostProcessOptions {
  openingSpecs: OpeningSpec[];
  /** Plans with no readable dimension get this long side (mm) as a guess; the user must confirm. */
  guessLongSideMm?: number;
  /** Walls within this angle of horizontal/vertical are squared. */
  squareToleranceDeg?: number;
  grid?: number;
  lowConfidence?: number;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** mm per pixel from the dimension annotations: median, then reject >15% outliers and re-take the median. */
export function estimateScale(raw: RawExtraction): { mmPerPx: number; used: number; rejected: number } | null {
  const ratios = raw.dimensions
    .map((d) => ({ d, px: Math.hypot(d.x2 - d.x1, d.y2 - d.y1) }))
    .filter(({ d, px }) => d.valueMm > 0 && px > 5)
    .map(({ d, px }) => d.valueMm / px);
  if (ratios.length === 0) return null;
  const m = median(ratios);
  const kept = ratios.filter((r) => Math.abs(r - m) / m <= 0.15);
  return { mmPerPx: median(kept), used: kept.length, rejected: ratios.length - kept.length };
}

function snapAngle(a: Vec2, b: Vec2, tolDeg: number): [Vec2, Vec2] {
  const ang = axisAngleDeg(a, b);
  if (ang <= tolDeg || ang >= 180 - tolDeg) {
    const y = (a.y + b.y) / 2;
    return [{ x: a.x, y }, { x: b.x, y }];
  }
  if (Math.abs(ang - 90) <= tolDeg) {
    const x = (a.x + b.x) / 2;
    return [{ x, y: a.y }, { x, y: b.y }];
  }
  return [a, b];
}

interface Seg {
  a: Vec2;
  b: Vec2;
  confidence: number;
  kind: "external" | "internal" | "unknown";
}

/** Merge nearly collinear, overlapping segments (e.g. a wall drawn in two strokes, or both faces of a wall). */
function mergeCollinear(segs: Seg[], perpTol: number, gapTol: number): Seg[] {
  const out = [...segs];
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length && !merged; j++) {
        const s = out[i]!;
        const t = out[j]!;
        const angS = axisAngleDeg(s.a, s.b);
        const angT = axisAngleDeg(t.a, t.b);
        const dAng = Math.min(Math.abs(angS - angT), 180 - Math.abs(angS - angT));
        if (dAng > 5) continue;
        // Perpendicular distance of t's endpoints from s's line.
        const ls = dist(s.a, s.b);
        if (ls === 0) continue;
        const ux = (s.b.x - s.a.x) / ls;
        const uy = (s.b.y - s.a.y) / ls;
        const perp = (p: Vec2) => Math.abs((p.x - s.a.x) * uy - (p.y - s.a.y) * ux);
        if (Math.max(perp(t.a), perp(t.b)) > perpTol) continue;
        // Overlap (or small gap) along the line.
        const along = (p: Vec2) => (p.x - s.a.x) * ux + (p.y - s.a.y) * uy;
        const s0 = 0;
        const s1 = ls;
        const t0 = Math.min(along(t.a), along(t.b));
        const t1 = Math.max(along(t.a), along(t.b));
        if (t0 > s1 + gapTol || t1 < s0 - gapTol) continue;
        const lo = Math.min(s0, t0);
        const hi = Math.max(s1, t1);
        // Average offset of the two lines (both faces of a wall → centreline).
        const off = (((t.a.x - s.a.x) * uy - (t.a.y - s.a.y) * ux) + ((t.b.x - s.a.x) * uy - (t.b.y - s.a.y) * ux)) / 4;
        const nx = uy;
        const ny = -ux;
        const base = { x: s.a.x + nx * off, y: s.a.y + ny * off };
        out[i] = {
          a: { x: base.x + ux * lo, y: base.y + uy * lo },
          b: { x: base.x + ux * hi, y: base.y + uy * hi },
          confidence: Math.max(s.confidence, t.confidence),
          kind: s.kind === "unknown" ? t.kind : s.kind,
        };
        out.splice(j, 1);
        merged = true;
      }
    }
  }
  return out;
}

/** Square near-axis walls by aligning their nodes (several passes so chains settle). */
function orthogonalize(plan: Plan, tolDeg: number): void {
  for (let pass = 0; pass < 4; pass++) {
    const byId = new Map(plan.nodes.map((n) => [n.id, n]));
    for (const w of plan.walls) {
      const a = byId.get(w.a)!;
      const b = byId.get(w.b)!;
      const ang = axisAngleDeg(a, b);
      if (ang <= tolDeg || ang >= 180 - tolDeg) {
        const y = Math.round((a.y + b.y) / 2);
        a.y = y;
        b.y = y;
      } else if (Math.abs(ang - 90) <= tolDeg) {
        const x = Math.round((a.x + b.x) / 2);
        a.x = x;
        b.x = x;
      }
    }
  }
}

/** Wall ends that touch nothing else (degree-1 nodes), with the wall they belong to. */
function freeEnds(plan: Plan) {
  const ix = indexPlan(plan);
  const out: { nodeId: string; wall: Wall; other: Vec2; at: Vec2 }[] = [];
  for (const [nodeId, walls] of ix.wallsAt) {
    if (walls.length !== 1) continue;
    const wall = ix.walls.get(walls[0]!)!;
    const at = ix.nodes.get(nodeId)!;
    const other = ix.nodes.get(wall.a === nodeId ? wall.b : wall.a)!;
    out.push({ nodeId, wall, other, at });
  }
  return out;
}

function lineIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/**
 * Hand-drawn corners rarely meet: ends stop short or overshoot by a few hundred mm.
 * 1. Two free ends whose wall lines cross near both ends → meet at the crossing (an L corner).
 * 2. A free end whose wall, extended, hits another wall within `tol` → extend to it (a T).
 * 3. Short dangling stubs left by overshoots are removed.
 */
export function closeCorners(input: Plan, tol = 600): Plan {
  let plan = structuredClone(input);
  // 1. L corners.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    const ends = freeEnds(plan);
    let best: { a: (typeof ends)[number]; b: (typeof ends)[number]; p: Vec2; d: number } | null = null;
    for (let i = 0; i < ends.length; i++)
      for (let j = i + 1; j < ends.length; j++) {
        const a = ends[i]!;
        const b = ends[j]!;
        if (a.wall.id === b.wall.id) continue;
        const p = lineIntersection(a.other, a.at, b.other, b.at);
        if (!p) continue;
        const d = Math.max(dist(p, a.at), dist(p, b.at));
        if (d <= tol && (!best || d < best.d)) best = { a, b, p, d };
      }
    if (best) {
      const na = plan.nodes.find((n) => n.id === best!.a.nodeId)!;
      na.x = Math.round(best.p.x);
      na.y = Math.round(best.p.y);
      mergeNodeInto(plan, best.b.nodeId, best.a.nodeId);
      changed = true;
    }
  }
  // 2. T junctions by extension.
  for (const e of freeEnds(plan)) {
    const L = dist(e.other, e.at);
    if (L === 0) continue;
    const dir = { x: (e.at.x - e.other.x) / L, y: (e.at.y - e.other.y) / L };
    const far = { x: e.at.x + dir.x * tol, y: e.at.y + dir.y * tol };
    const ix = indexPlan(plan);
    let hit: { p: Vec2; d: number } | null = null;
    for (const w of plan.walls) {
      if (w.id === e.wall.id) continue;
      const a = ix.nodes.get(w.a)!;
      const b = ix.nodes.get(w.b)!;
      const x = segmentIntersection(e.at, far, a, b);
      if (x && (!hit || x.t < hit.d)) hit = { p: x.point, d: x.t };
    }
    if (hit) {
      const n = plan.nodes.find((x) => x.id === e.nodeId)!;
      n.x = Math.round(hit.p.x);
      n.y = Math.round(hit.p.y);
    }
  }
  plan = normalizePlan(plan, 60);
  // 3. Remove short stubs that only overshoot a junction.
  for (let pass = 0; pass < 3; pass++) {
    const ix = indexPlan(plan);
    const stubs = new Set(
      freeEnds(plan)
        .filter((e) => (ix.wallsAt.get(e.wall.a === e.nodeId ? e.wall.b : e.wall.a)?.length ?? 0) >= 3 && wallLength(ix, e.wall) < tol)
        .map((e) => e.wall.id),
    );
    if (!stubs.size) break;
    plan.walls = plan.walls.filter((w) => !stubs.has(w.id));
    plan.openings = plan.openings.filter((o) => !stubs.has(o.wallId));
    plan.nodes = plan.nodes.filter((n) => plan.walls.some((w) => w.a === n.id || w.b === n.id));
    plan = normalizePlan(plan, 60);
  }
  return plan;
}

const STANDARD_WIDTHS = { door: [750, 900, 1200], window: [600, 900, 1200, 1500] } as const;

function pickSpec(specs: OpeningSpec[], kind: "door" | "window", widthMm: number, entrance: boolean): OpeningSpec | undefined {
  const ofKind = specs.filter((s) => s.kind === kind);
  if (kind === "door" && entrance) {
    const entrance = ofKind.find((s) => s.id.includes("entrance"));
    if (entrance) return entrance;
  }
  const candidates = kind === "door" ? ofKind.filter((s) => !s.id.includes("entrance")) : ofKind;
  return candidates.reduce<OpeningSpec | undefined>(
    (best, s) => (!best || Math.abs(s.width - widthMm) < Math.abs(best.width - widthMm) ? s : best),
    undefined,
  );
}

/**
 * Turn the model's raw pixel-space description into a clean Plan in millimetres.
 * Deterministic: the same raw input always gives the same geometry (ids aside).
 */
export function postProcess(raw: RawExtraction, opts: PostProcessOptions): PostProcessResult {
  const tolDeg = opts.squareToleranceDeg ?? 4;
  const grid = opts.grid ?? 50;
  const lowConf = opts.lowConfidence ?? 0.6;
  const flags: ExtractionFlag[] = [];

  const scaleEst = estimateScale(raw);
  let mmPerPx: number;
  let source: "dimensions" | "guess";
  if (scaleEst) {
    mmPerPx = scaleEst.mmPerPx;
    source = "dimensions";
    if (scaleEst.rejected > 0) flags.push({ level: "warn", message: `${scaleEst.rejected} dimension(s) disagreed with the others and were ignored for the scale.` });
  } else {
    const pts = raw.walls.flatMap((w) => [w.x1, w.x2]);
    const ptsY = raw.walls.flatMap((w) => [w.y1, w.y2]);
    const longPx = Math.max(Math.max(...pts) - Math.min(...pts), Math.max(...ptsY) - Math.min(...ptsY), 1);
    mmPerPx = (opts.guessLongSideMm ?? 12000) / longPx;
    source = "guess";
    flags.push({ level: "warn", message: "No readable dimensions: the scale is a guess. Set one known length before trusting the estimate." });
  }

  const toMm = (x: number, y: number): Vec2 => ({ x: x * mmPerPx, y: y * mmPerPx });

  // 1. Segments in mm, squared, collinear pieces merged.
  let segs: Seg[] = raw.walls
    .map((w) => {
      const [a, b] = snapAngle(toMm(w.x1, w.y1), toMm(w.x2, w.y2), tolDeg);
      return { a, b, confidence: w.confidence, kind: w.kind };
    })
    .filter((s) => dist(s.a, s.b) >= 200);
  // Both faces of a drawn wall (≤ ~260 mm apart) collapse to one centreline; pieces with small gaps join.
  segs = mergeCollinear(segs, 260, 120);

  // 2. Build a plan and normalise topology.
  let plan = emptyPlan("Extracted plan");
  const lowConfWalls = new Set<string>();
  for (const s of segs) {
    const a = { id: newId("n"), x: Math.round(s.a.x), y: Math.round(s.a.y) };
    const b = { id: newId("n"), x: Math.round(s.b.x), y: Math.round(s.b.y) };
    const kind = s.kind === "external" ? "external" : "internal";
    const w: Wall = { id: newId("w"), a: a.id, b: b.id, kind, thickness: THICKNESS[kind] };
    plan.nodes.push(a, b);
    plan.walls.push(w);
    if (s.confidence < lowConf) lowConfWalls.add(`${a.id}|${b.id}`);
  }
  // Snap distance: generous for sketches (endpoints rarely meet), capped.
  plan = normalizePlan(plan, 250);
  orthogonalize(plan, tolDeg);
  plan = closeCorners(plan, 600);
  orthogonalize(plan, tolDeg);
  for (const n of plan.nodes) {
    n.x = Math.round(n.x / grid) * grid;
    n.y = Math.round(n.y / grid) * grid;
  }
  plan = normalizePlan(plan, grid);

  // 3. Origin at the top-left of the plan.
  const minX = Math.min(...plan.nodes.map((n) => n.x));
  const minY = Math.min(...plan.nodes.map((n) => n.y));
  const shift = (p: Vec2) => ({ x: Math.round(p.x - minX), y: Math.round(p.y - minY) });
  for (const n of plan.nodes) Object.assign(n, shift(n));
  plan.source = {
    kind: "upload",
    mmPerPx,
    originX: Math.round(-minX),
    originY: Math.round(-minY),
    imageWidth: Math.round(raw.imageWidth),
    imageHeight: Math.round(raw.imageHeight),
    scaleSource: source === "dimensions" ? "dimensions" : "guess",
  };

  // 4. External vs internal from the outline.
  plan = classifyWallKinds(plan);

  // 5. Openings onto their nearest wall. One external door (the widest) is the main entrance;
  //    the rest are priced by width like internal doors.
  const ix = indexPlan(plan);
  const nearestWallOf = (o: { x: number; y: number }) => {
    const c = shift(toMm(o.x, o.y));
    let best: { wall: Wall; d: number } | null = null;
    for (const w of plan.walls) {
      const d = projectToSegment(c, ix.nodes.get(w.a)!, ix.nodes.get(w.b)!).distance;
      if (!best || d < best.d) best = { wall: w, d };
    }
    return best;
  };
  const externalDoors = raw.openings.filter((o) => o.kind === "door" && nearestWallOf(o)?.wall.kind === "external");
  const mainEntrance = externalDoors.sort((a, b) => b.widthPx - a.widthPx || b.confidence - a.confidence)[0];
  for (const o of raw.openings) {
    const c = shift(toMm(o.x, o.y));
    let best: { wall: Wall; t: number; d: number } | null = null;
    for (const w of plan.walls) {
      const a = ix.nodes.get(w.a)!;
      const b = ix.nodes.get(w.b)!;
      const pr = projectToSegment(c, a, b);
      if (!best || pr.distance < best.d) best = { wall: w, t: pr.t, d: pr.distance };
    }
    if (!best || best.d > 500) {
      flags.push({ level: "warn", message: `A ${o.kind} was detected away from any wall and was skipped.` });
      continue;
    }
    const widthMm = o.widthPx * mmPerPx;
    const spec = pickSpec(opts.openingSpecs, o.kind, widthMm || STANDARD_WIDTHS[o.kind][1], o === mainEntrance);
    if (!spec) continue;
    const id = newId("o");
    plan.openings.push({
      id,
      wallId: best.wall.id,
      kind: o.kind,
      offset: Math.round(best.t * wallLength(ix, best.wall)),
      width: spec.width,
      height: spec.height,
      sill: spec.sill,
      specId: spec.id,
    });
    if (o.confidence < lowConf) flags.push({ level: "warn", ref: { kind: "opening", id }, message: `Low-confidence ${o.kind}: check it.` });
  }
  plan = clampOpenings(plan);

  // 6. Room labels.
  for (const r of raw.rooms) {
    const p = shift(toMm(r.x, r.y));
    plan.labels.push({ id: newId("l"), x: p.x, y: p.y, name: r.name.trim() || "Room" });
  }

  // 7. Flags about topology.
  for (const w of plan.walls) {
    const a = ix.nodes.get(w.a);
    const b = ix.nodes.get(w.b);
    if (a && b && lowConfWalls.has(`${a.id}|${b.id}`)) flags.push({ level: "warn", ref: { kind: "wall", id: w.id }, message: "Low-confidence wall: check it." });
  }
  const topo = topology(plan);
  if (!topo.footprint) flags.push({ level: "warn", message: "The outer walls don't form a closed outline yet. Join them to get a roof, slab and areas." });
  if (topo.openWallIds.size > 0) flags.push({ level: "info", message: `${topo.openWallIds.size} wall(s) don't close a room.` });
  for (const note of raw.notes) flags.push({ level: "info", message: `Model note: ${note}` });

  return { plan, flags, scale: { mmPerPx, source, used: scaleEst?.used ?? 0, rejected: scaleEst?.rejected ?? 0 } };
}

/** Rescale a plan around its origin, e.g. after the user sets a known length. */
export function rescalePlan(plan: Plan, factor: number): Plan {
  const next = structuredClone(plan);
  for (const n of next.nodes) {
    n.x = Math.round(n.x * factor);
    n.y = Math.round(n.y * factor);
  }
  for (const l of next.labels) {
    l.x = Math.round(l.x * factor);
    l.y = Math.round(l.y * factor);
  }
  for (const o of next.openings) o.offset = Math.round(o.offset * factor);
  if (next.source.mmPerPx) next.source.mmPerPx *= factor;
  next.source.originX = Math.round(next.source.originX * factor);
  next.source.originY = Math.round(next.source.originY * factor);
  next.source.scaleSource = "user";
  return clampOpenings(next);
}
