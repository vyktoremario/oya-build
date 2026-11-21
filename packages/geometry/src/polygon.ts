import { type Vec2, add, cross, dist, norm, scale, sub } from "./vec";

/** Shoelace signed area. Sign depends on winding (and on the y-axis direction). */
export function signedArea(poly: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const area = (poly: Vec2[]): number => Math.abs(signedArea(poly));

export function perimeter(poly: Vec2[]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) p += dist(poly[i]!, poly[(i + 1) % poly.length]!);
  return p;
}

export function centroid(poly: Vec2[]): Vec2 {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function boundingBox(points: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Offset each edge of a simple polygon by its own distance (positive = outward) and
 * intersect neighbouring offset edges (mitred corners). Edge i runs from poly[i] to poly[i+1].
 */
export function offsetPolygon(poly: Vec2[], distances: number[] | number): Vec2[] {
  const n = poly.length;
  if (n < 3) return poly.slice();
  const d = (i: number) => (typeof distances === "number" ? distances : (distances[i] ?? 0));
  const orientation = Math.sign(signedArea(poly)) || 1;
  // For positive signed area, the outward normal of edge (dx,dy) is (dy,-dx).
  const normals = poly.map((p, i) => {
    const e = norm(sub(poly[(i + 1) % n]!, p));
    return scale({ x: e.y, y: -e.x }, orientation);
  });
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const p0 = add(poly[prev]!, scale(normals[prev]!, d(prev)));
    const dir0 = sub(poly[i]!, poly[prev]!);
    const p1 = add(poly[i]!, scale(normals[i]!, d(i)));
    const dir1 = sub(poly[(i + 1) % n]!, poly[i]!);
    const denom = cross(dir0, dir1);
    if (Math.abs(denom) < 1e-9 * Math.max(1, Math.hypot(dir0.x, dir0.y) * Math.hypot(dir1.x, dir1.y))) {
      out.push(add(poly[i]!, scale(normals[i]!, d(i))));
    } else {
      const t = cross(sub(p1, p0), dir1) / denom;
      out.push(add(p0, scale(dir0, t)));
    }
  }
  return out;
}
