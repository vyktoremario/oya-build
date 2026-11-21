import type { Plan } from "@oya/schema";
import { type Vec2, indexPlan, projectToSegment } from "@oya/geometry";
import { DEFAULT_PRICE_BOOK, estimate } from "@oya/estimate";

export interface CaseScore {
  wallPrecision: number;
  wallRecall: number;
  wallF1: number;
  openingPrecision: number;
  openingRecall: number;
  openingF1: number;
  /** |extracted − true| / true, as a percentage. */
  scaleErrorPct: number | null;
  areaErrorPct: number;
  roomsTrue: number;
  roomsFound: number;
  estimateTrue: number;
  estimateExtracted: number;
  estimateErrorPct: number;
  groupErrorPct: Record<string, number>;
}

export const WALL_TOLERANCE_MM = 300;
export const OPENING_TOLERANCE_MM = 500;
const SAMPLE_STEP_MM = 100;

function segments(plan: Plan): [Vec2, Vec2][] {
  const ix = indexPlan(plan);
  return plan.walls.map((w) => [ix.nodes.get(w.a)!, ix.nodes.get(w.b)!]);
}

/** Points every 100 mm along each wall centreline. */
function samples(segs: [Vec2, Vec2][]): Vec2[] {
  const out: Vec2[] = [];
  for (const [a, b] of segs) {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(L / SAMPLE_STEP_MM));
    for (let i = 0; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  }
  return out;
}

/** Fraction of `pts` lying within `tol` of any segment in `segs`. */
function coverage(pts: Vec2[], segs: [Vec2, Vec2][], tol: number): number {
  if (!pts.length) return 0;
  let hit = 0;
  for (const p of pts) if (segs.some(([a, b]) => projectToSegment(p, a, b).distance <= tol)) hit++;
  return hit / pts.length;
}

function openingPoints(plan: Plan): { kind: string; p: Vec2 }[] {
  const ix = indexPlan(plan);
  return plan.openings.map((o) => {
    const w = ix.walls.get(o.wallId)!;
    const a = ix.nodes.get(w.a)!;
    const b = ix.nodes.get(w.b)!;
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { kind: o.kind, p: { x: a.x + ((b.x - a.x) * o.offset) / L, y: a.y + ((b.y - a.y) * o.offset) / L } };
  });
}

/** Greedy one-to-one matching of openings by kind and distance. */
function matchOpenings(truth: Plan, found: Plan): { tp: number; nTrue: number; nFound: number } {
  const t = openingPoints(truth);
  const f = openingPoints(found);
  const pairs: { i: number; j: number; d: number }[] = [];
  t.forEach((a, i) => f.forEach((b, j) => a.kind === b.kind && pairs.push({ i, j, d: Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) })));
  pairs.sort((x, y) => x.d - y.d);
  const ui = new Set<number>();
  const uj = new Set<number>();
  let tp = 0;
  for (const { i, j, d } of pairs) {
    if (d > OPENING_TOLERANCE_MM || ui.has(i) || uj.has(j)) continue;
    ui.add(i);
    uj.add(j);
    tp++;
  }
  return { tp, nTrue: t.length, nFound: f.length };
}

const f1 = (p: number, r: number) => (p + r === 0 ? 0 : (2 * p * r) / (p + r));
const pctErr = (got: number, want: number) => (want === 0 ? (got === 0 ? 0 : 100) : (Math.abs(got - want) / want) * 100);

/** Align by the bounding-box corner: both plans put their top-left wall node at the origin. */
function normalizeOrigin(plan: Plan): Plan {
  const minX = Math.min(...plan.nodes.map((n) => n.x));
  const minY = Math.min(...plan.nodes.map((n) => n.y));
  return { ...plan, nodes: plan.nodes.map((n) => ({ ...n, x: n.x - minX, y: n.y - minY })), labels: plan.labels.map((l) => ({ ...l, x: l.x - minX, y: l.y - minY })) };
}

export function scoreCase(truthIn: Plan, foundIn: Plan, trueMmPerPx: number | null): CaseScore {
  const truth = normalizeOrigin(truthIn);
  const found = foundIn.nodes.length ? normalizeOrigin(foundIn) : foundIn;
  const ts = segments(truth);
  const fs = segments(found);
  const wallRecall = coverage(samples(ts), fs, WALL_TOLERANCE_MM);
  const wallPrecision = coverage(samples(fs), ts, WALL_TOLERANCE_MM);
  const om = matchOpenings(truth, found);
  const openingPrecision = om.nFound ? om.tp / om.nFound : 0;
  const openingRecall = om.nTrue ? om.tp / om.nTrue : 1;

  const bt = estimate(truth, DEFAULT_PRICE_BOOK);
  const bf = estimate(found, DEFAULT_PRICE_BOOK);
  const groupErrorPct: Record<string, number> = {};
  for (const g of bt.groups) groupErrorPct[g.id] = pctErr(bf.groups.find((x) => x.id === g.id)?.subtotal ?? 0, g.subtotal);

  return {
    wallPrecision,
    wallRecall,
    wallF1: f1(wallPrecision, wallRecall),
    openingPrecision,
    openingRecall,
    openingF1: f1(openingPrecision, openingRecall),
    scaleErrorPct: trueMmPerPx && found.source.mmPerPx ? pctErr(found.source.mmPerPx, trueMmPerPx) : null,
    areaErrorPct: pctErr(bf.summary.floorClearArea, bt.summary.floorClearArea),
    roomsTrue: bt.summary.rooms.length,
    roomsFound: bf.summary.rooms.length,
    estimateTrue: bt.total,
    estimateExtracted: bf.total,
    estimateErrorPct: pctErr(bf.total, bt.total),
    groupErrorPct,
  };
}
