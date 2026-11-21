import type { Plan } from "@oya/schema";
import { indexPlan, topology } from "@oya/geometry";

/** Deterministic PRNG so rendered cases are reproducible. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RenderOptions {
  style: "clean" | "sketch";
  seed: number;
  width?: number;
  height?: number;
  /** "mm" writes 3600, "m" writes 3.6m. */
  dimensionUnits?: "mm" | "m";
  /** Rotate the whole drawing (degrees) to mimic a hand-held photo. */
  rotateDeg?: number;
  /** Leave out the room names. */
  noLabels?: boolean;
  /** Leave out all dimensions (tests the "scale is a guess" path). */
  noDimensions?: boolean;
}

export interface Rendered {
  svg: string;
  width: number;
  height: number;
  /** px per mm and offset used, so truth can be mapped into image space. */
  pxPerMm: number;
  offsetX: number;
  offsetY: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Render a plan as an image an architect or a homeowner might produce: a clean printed plan with
 * filled walls, or a pencil sketch on graph paper with wobbly double lines and handwritten labels.
 */
export function renderPlan(plan: Plan, o: RenderOptions): Rendered {
  const W = o.width ?? 1568;
  const H = o.height ?? 1176;
  const rand = rng(o.seed);
  const sketch = o.style === "sketch";
  const ix = indexPlan(plan);
  const xs = plan.nodes.map((n) => n.x);
  const ys = plan.nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const margin = Math.round(W * 0.11);
  const pxPerMm = Math.min((W - 2 * margin) / spanX, (H - 2 * margin) / spanY);
  const offsetX = (W - spanX * pxPerMm) / 2 - minX * pxPerMm;
  const offsetY = (H - spanY * pxPerMm) / 2 - minY * pxPerMm;
  const X = (mm: number) => mm * pxPerMm + offsetX;
  const Y = (mm: number) => mm * pxPerMm + offsetY;

  const ink = sketch ? "#2a2d34" : "#111";
  const font = sketch ? "Noteworthy, 'Bradley Hand', 'Comic Sans MS', cursive" : "Helvetica, Arial, sans-serif";
  const parts: string[] = [];
  const j = (amp: number) => (sketch ? (rand() - 0.5) * 2 * amp : 0);

  /** A pencil stroke: slight bow, wobble and overshoot. */
  const stroke = (x1: number, y1: number, x2: number, y2: number, width: number) => {
    if (!sketch) return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${ink}" stroke-width="${width}" stroke-linecap="square"/>`;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    const over0 = rand() * 9;
    const over1 = rand() * 9;
    const sx = x1 - ux * over0;
    const sy = y1 - uy * over0;
    const ex = x2 + ux * over1;
    const ey = y2 + uy * over1;
    const n = Math.max(3, Math.round(L / 60));
    const bow = (rand() - 0.5) * Math.min(6, L / 80);
    let d = `M ${(sx + j(1.2)).toFixed(1)} ${(sy + j(1.2)).toFixed(1)}`;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const off = Math.sin(t * Math.PI) * bow + j(0.9);
      d += ` L ${(sx + (ex - sx) * t - uy * off).toFixed(1)} ${(sy + (ey - sy) * t + ux * off).toFixed(1)}`;
    }
    return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${(width * (0.8 + rand() * 0.5)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${(0.78 + rand() * 0.2).toFixed(2)}"/>`;
  };

  // Paper.
  parts.push(`<rect width="${W}" height="${H}" fill="${sketch ? "#fbf9f2" : "#ffffff"}"/>`);
  if (sketch) {
    for (let x = 0; x < W; x += 28) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#bcd3e6" stroke-width="0.6" opacity="0.55"/>`);
    for (let y = 0; y < H; y += 28) parts.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#bcd3e6" stroke-width="0.6" opacity="0.55"/>`);
  }

  const g: string[] = [];

  // Walls: each wall's two faces, broken at openings.
  for (const w of plan.walls) {
    const a = ix.nodes.get(w.a)!;
    const b = ix.nodes.get(w.b)!;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;
    const nx = -uy;
    const ny = ux;
    const half = w.thickness / 2;
    const ops = (ix.openingsOn.get(w.id) ?? []).slice().sort((p, q) => p.offset - q.offset);
    const pieces: [number, number][] = [];
    let cursor = -half;
    for (const op of ops) {
      pieces.push([cursor, op.offset - op.width / 2]);
      cursor = op.offset + op.width / 2;
    }
    pieces.push([cursor, L + half]);
    for (const [s, e] of pieces) {
      if (e - s <= 1) continue;
      if (!sketch) {
        const pts = [
          [a.x + ux * s + nx * half, a.y + uy * s + ny * half],
          [a.x + ux * e + nx * half, a.y + uy * e + ny * half],
          [a.x + ux * e - nx * half, a.y + uy * e - ny * half],
          [a.x + ux * s - nx * half, a.y + uy * s - ny * half],
        ];
        g.push(`<polygon points="${pts.map(([x, y]) => `${X(x!).toFixed(1)},${Y(y!).toFixed(1)}`).join(" ")}" fill="${w.kind === "external" ? "#222" : "#555"}"/>`);
      } else {
        for (const side of [1, -1]) {
          g.push(stroke(X(a.x + ux * s + nx * half * side), Y(a.y + uy * s + ny * half * side), X(a.x + ux * e + nx * half * side), Y(a.y + uy * e + ny * half * side), w.kind === "external" ? 2.6 : 1.9));
        }
      }
    }
    // Openings.
    for (const op of ops) {
      const c = { x: a.x + ux * op.offset, y: a.y + uy * op.offset };
      const s = { x: c.x - (ux * op.width) / 2, y: c.y - (uy * op.width) / 2 };
      const e = { x: c.x + (ux * op.width) / 2, y: c.y + (uy * op.width) / 2 };
      if (op.kind === "window") {
        for (const k of [-half, 0, half]) g.push(stroke(X(s.x + nx * k), Y(s.y + ny * k), X(e.x + nx * k), Y(e.y + ny * k), sketch ? 1.2 : 1));
      } else {
        // Door leaf and swing arc on the +normal side.
        const r = op.width * pxPerMm;
        const hx = X(s.x + nx * half);
        const hy = Y(s.y + ny * half);
        const lx = X(s.x + nx * (half + op.width));
        const ly = Y(s.y + ny * (half + op.width));
        const ex2 = X(e.x + nx * half);
        const ey2 = Y(e.y + ny * half);
        g.push(stroke(hx, hy, lx, ly, sketch ? 1.4 : 1.2));
        const sweep = ux * ny - uy * nx > 0 ? 0 : 1;
        g.push(`<path d="M ${lx.toFixed(1)} ${ly.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${ex2.toFixed(1)} ${ey2.toFixed(1)}" fill="none" stroke="${ink}" stroke-width="${sketch ? 1 : 0.8}" ${sketch ? "" : 'stroke-dasharray="4 3"'} opacity="0.8"/>`);
      }
    }
  }

  // Room names.
  if (!o.noLabels) {
    const rooms = topology(plan).rooms;
    for (const r of rooms) {
      const name = sketch ? r.name.toUpperCase() : r.name;
      g.push(`<text x="${(X(r.centre.x) + j(6)).toFixed(1)}" y="${(Y(r.centre.y) + j(6)).toFixed(1)}" font-family="${font}" font-size="${sketch ? 21 : 17}" fill="${ink}" text-anchor="middle" transform="rotate(${j(3).toFixed(1)} ${X(r.centre.x).toFixed(1)} ${Y(r.centre.y).toFixed(1)})">${esc(name)}</text>`);
    }
  }

  // Dimensions: overall width (top) and depth (left), plus the bays along the top and left walls.
  if (!o.noDimensions) {
    const fmt = (mm: number) => (o.dimensionUnits === "m" ? `${(mm / 1000).toFixed(mm % 100 === 0 ? 1 : 2)}m` : `${Math.round(mm)}`);
    const dimH = (x1: number, x2: number, y: number) => {
      g.push(stroke(X(x1), y, X(x2), y, 1));
      for (const x of [x1, x2]) g.push(stroke(X(x) - 6, y + 6, X(x) + 6, y - 6, 1.2));
      g.push(`<text x="${((X(x1) + X(x2)) / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" font-family="${font}" font-size="${sketch ? 19 : 15}" fill="${ink}" text-anchor="middle">${fmt(x2 - x1)}</text>`);
    };
    const dimV = (y1: number, y2: number, x: number) => {
      g.push(stroke(x, Y(y1), x, Y(y2), 1));
      for (const y of [y1, y2]) g.push(stroke(x - 6, Y(y) + 6, x + 6, Y(y) - 6, 1.2));
      const cy = (Y(y1) + Y(y2)) / 2;
      g.push(`<text x="${(x - 9).toFixed(1)}" y="${cy.toFixed(1)}" font-family="${font}" font-size="${sketch ? 19 : 15}" fill="${ink}" text-anchor="middle" transform="rotate(-90 ${(x - 9).toFixed(1)} ${cy.toFixed(1)})">${fmt(y2 - y1)}</text>`);
    };
    const maxX = minX + spanX;
    const maxY = minY + spanY;
    dimH(minX, maxX, Y(minY) - 95);
    dimV(minY, maxY, X(minX) - 95);
    // Bays: node x positions on the top edge, node y positions on the left edge.
    const topXs = [...new Set(plan.nodes.filter((n) => n.y === minY).map((n) => n.x))].sort((a, b) => a - b);
    const leftYs = [...new Set(plan.nodes.filter((n) => n.x === minX).map((n) => n.y))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < topXs.length; i++) dimH(topXs[i]!, topXs[i + 1]!, Y(minY) - 45);
    for (let i = 0; i + 1 < leftYs.length; i++) dimV(leftYs[i]!, leftYs[i + 1]!, X(minX) - 45);
  }

  const rot = o.rotateDeg ?? 0;
  parts.push(`<g transform="rotate(${rot} ${W / 2} ${H / 2})">${g.join("")}</g>`);
  if (sketch) {
    parts.push(
      `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${o.seed % 1000}"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0.10 0"/></filter><rect width="${W}" height="${H}" filter="url(#grain)"/>`,
    );
    // Uneven light, like a phone photo.
    parts.push(`<radialGradient id="light" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#6b5d45" stop-opacity="0.16"/></radialGradient><rect width="${W}" height="${H}" fill="url(#light)"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
  return { svg, width: W, height: H, pxPerMm, offsetX, offsetY };
}
