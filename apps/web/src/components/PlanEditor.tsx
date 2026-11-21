"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Plan } from "@oya/schema";
import {
  type Vec2,
  addOpening,
  addWall,
  classifyWallKinds,
  deleteNode,
  deleteOpening,
  deleteWall,
  indexPlan,
  moveNode,
  moveWall,
  projectToSegment,
  rescalePlan,
  topology,
  updateOpening,
  wallLength,
} from "@oya/geometry";
import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import { useStore } from "@/lib/store";
import { formatMm } from "@/lib/format";

const GRID = 50;
const snapGrid = (n: number) => Math.round(n / GRID) * GRID;

type Drag =
  | { kind: "node"; id: string }
  | { kind: "wall"; id: string; start: Vec2; normal: Vec2; moved: Vec2 }
  | { kind: "opening"; id: string }
  | { kind: "label"; id: string }
  | { kind: "pan"; start: Vec2; view: View }
  | null;

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fitView(plan: Plan, aspect: number): View {
  const pts = plan.nodes.length ? plan.nodes : [{ x: 0, y: 0 }, { x: 10000, y: 8000 }];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 2000;
  let x = Math.min(...xs) - pad;
  let y = Math.min(...ys) - pad;
  let w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  let h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  if (w / h > aspect) {
    const nh = w / aspect;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * aspect;
    x -= (nw - w) / 2;
    w = nw;
  }
  return { x, y, w, h };
}

/** Snap a dragged node to the grid and to the x/y of its neighbours, so walls stay square. */
function snapNode(plan: Plan, nodeId: string, p: Vec2): Vec2 {
  let x = snapGrid(p.x);
  let y = snapGrid(p.y);
  const ix = indexPlan(plan);
  for (const wid of ix.wallsAt.get(nodeId) ?? []) {
    const w = ix.walls.get(wid)!;
    const o = ix.nodes.get(w.a === nodeId ? w.b : w.a)!;
    if (Math.abs(o.x - p.x) < 200) x = o.x;
    if (Math.abs(o.y - p.y) < 200) y = o.y;
  }
  return { x, y };
}

function snapPoint(plan: Plan, p: Vec2, from?: Vec2): Vec2 {
  for (const n of plan.nodes) if (Math.hypot(n.x - p.x, n.y - p.y) < 250) return { x: n.x, y: n.y };
  let q = { x: snapGrid(p.x), y: snapGrid(p.y) };
  if (from) {
    if (Math.abs(q.x - from.x) < 300) q = { ...q, x: from.x };
    if (Math.abs(q.y - from.y) < 300) q = { ...q, y: from.y };
  }
  return q;
}

export function PlanEditor() {
  const plan = useStore((s) => s.plan);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const image = useStore((s) => s.image);
  const showImage = useStore((s) => s.showImage);
  const flags = useStore((s) => s.flags);
  const loadId = useStore((s) => s.loadId);
  const { apply, select, beginGesture, endGesture, setTool } = useStore.getState();

  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: -2000, y: -2000, w: 16000, h: 12000 });
  const [drag, setDrag] = useState<Drag>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [chainStart, setChainStart] = useState<Vec2 | null>(null);
  const [scaleStart, setScaleStart] = useState<Vec2 | null>(null);

  const ix = useMemo(() => indexPlan(plan), [plan]);
  const topo = useMemo(() => topology(plan, ix), [plan, ix]);
  const flagged = useMemo(() => new Set(flags.map((f) => f.ref?.id).filter(Boolean) as string[]), [flags]);

  // Fit the view whenever a new plan is loaded.
  useEffect(() => {
    const el = svgRef.current;
    const aspect = el ? el.clientWidth / Math.max(1, el.clientHeight) : 4 / 3;
    setView(fitView(useStore.getState().plan, aspect || 4 / 3));
  }, [loadId]);

  useEffect(() => {
    setChainStart(null);
    setScaleStart(null);
  }, [tool]);

  const toPlan = useCallback((e: { clientX: number; clientY: number }): Vec2 => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  // Zoom with the wheel around the cursor.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toPlan(e);
      const k = Math.exp(e.deltaY * 0.0015);
      setView((v) => {
        const w = Math.min(80000, Math.max(1500, v.w * k));
        const h = (v.h / v.w) * w;
        return { x: p.x - ((p.x - v.x) * w) / v.w, y: p.y - ((p.y - v.y) * h) / v.h, w, h };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toPlan]);

  // Keyboard: delete, undo/redo, escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.isContentEditable) return;
      const s = useStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (e.key === "Escape") {
        setChainStart(null);
        setScaleStart(null);
        s.select(null);
        if (s.tool !== "select") s.setTool("select");
      }
      if ((e.key === "Delete" || e.key === "Backspace") && s.selection) {
        e.preventDefault();
        const sel = s.selection;
        s.apply((p) => {
          if (sel.kind === "wall") return deleteWall(p, sel.id);
          if (sel.kind === "node") return deleteNode(p, sel.id);
          if (sel.kind === "opening") return deleteOpening(p, sel.id);
          return { ...p, labels: p.labels.filter((l) => l.id !== sel.id) };
        });
        s.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nearestWall = (p: Vec2, max = 400) => {
    let best: { id: string; t: number; d: number } | null = null;
    for (const w of plan.walls) {
      const pr = projectToSegment(p, ix.nodes.get(w.a)!, ix.nodes.get(w.b)!);
      if (pr.distance < max && (!best || pr.distance < best.d)) best = { id: w.id, t: pr.t, d: pr.distance };
    }
    return best;
  };

  const onBackgroundDown = (e: React.PointerEvent) => {
    const p = toPlan(e);
    if (tool === "select") {
      select(null);
      setDrag({ kind: "pan", start: { x: e.clientX, y: e.clientY }, view });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === "wall") {
      const q = snapPoint(plan, p, chainStart ?? undefined);
      if (!chainStart) {
        setChainStart(q);
        return;
      }
      if (Math.hypot(q.x - chainStart.x, q.y - chainStart.y) < 100) {
        setChainStart(null);
        return;
      }
      apply((pl) => classifyWallKinds(addWall(pl, chainStart, q, { snap: 120 }).plan));
      setChainStart(q);
      return;
    }
    if (tool === "door" || tool === "window") {
      const hit = nearestWall(p);
      if (!hit) return;
      const w = ix.walls.get(hit.id)!;
      const external = w.kind === "external";
      const specId = tool === "door" ? (external ? "door-entrance-steel" : "door-flush-900") : "window-casement-1200";
      const spec = DEFAULT_PRICE_BOOK.openingSpecs.find((s) => s.id === specId)!;
      apply((pl) => addOpening(pl, hit.id, hit.t * wallLength(ix, w), spec));
      return;
    }
    if (tool === "label") {
      const name = window.prompt("Room name", "Room");
      if (name) apply((pl) => ({ ...pl, labels: [...pl.labels, { id: `l_${Date.now().toString(36)}`, x: Math.round(p.x), y: Math.round(p.y), name }] }));
      setTool("select");
      return;
    }
    if (tool === "scale") {
      if (!scaleStart) {
        setScaleStart(p);
        return;
      }
      const measured = Math.hypot(p.x - scaleStart.x, p.y - scaleStart.y);
      const answer = window.prompt(`This line measures ${Math.round(measured)} mm at the current scale. What is its real length in mm?`, String(Math.round(measured)));
      const real = Number(answer);
      if (answer && Number.isFinite(real) && real > 0 && measured > 0) {
        apply((pl) => rescalePlan(pl, real / measured));
        useStore.getState().set({ flags: useStore.getState().flags.filter((f) => !f.message.includes("scale")) });
      }
      setScaleStart(null);
      setTool("select");
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toPlan(e);
    setCursor(p);
    if (!drag) return;
    if (drag.kind === "pan") {
      const svg = svgRef.current!;
      const k = drag.view.w / svg.clientWidth;
      setView({ ...drag.view, x: drag.view.x - (e.clientX - drag.start.x) * k, y: drag.view.y - (e.clientY - drag.start.y) * k });
    } else if (drag.kind === "node") {
      const q = snapNode(plan, drag.id, p);
      apply((pl) => moveNode(pl, drag.id, q));
    } else if (drag.kind === "wall") {
      const along = (p.x - drag.start.x) * drag.normal.x + (p.y - drag.start.y) * drag.normal.y;
      const dist = snapGrid(along);
      const target = { x: drag.normal.x * dist, y: drag.normal.y * dist };
      const delta = { x: target.x - drag.moved.x, y: target.y - drag.moved.y };
      if (delta.x || delta.y) {
        apply((pl) => moveWall(pl, drag.id, delta));
        setDrag({ ...drag, moved: target });
      }
    } else if (drag.kind === "opening") {
      const o = plan.openings.find((x) => x.id === drag.id);
      if (!o) return;
      const w = ix.walls.get(o.wallId)!;
      const pr = projectToSegment(p, ix.nodes.get(w.a)!, ix.nodes.get(w.b)!);
      apply((pl) => updateOpening(pl, drag.id, { offset: snapGrid(pr.t * wallLength(ix, w)) }));
    } else if (drag.kind === "label") {
      apply((pl) => ({ ...pl, labels: pl.labels.map((l) => (l.id === drag.id ? { ...l, x: Math.round(p.x), y: Math.round(p.y) } : l)) }));
    }
  };

  const onUp = () => {
    if (drag && drag.kind !== "pan") endGesture();
    setDrag(null);
  };

  const startDrag = (e: React.PointerEvent, d: Exclude<Drag, null>, sel: NonNullable<ReturnType<typeof useStore.getState>["selection"]>) => {
    if (tool !== "select") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    select(sel);
    beginGesture();
    setDrag(d);
  };

  const px = view.w / 900; // ~1 screen pixel in mm at typical widths
  const wallPolys = plan.walls.map((w) => {
    const a = ix.nodes.get(w.a)!;
    const b = ix.nodes.get(w.b)!;
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / L) * (w.thickness / 2);
    const ny = ((b.x - a.x) / L) * (w.thickness / 2);
    return { w, a, b, L, points: `${a.x + nx},${a.y + ny} ${b.x + nx},${b.y + ny} ${b.x - nx},${b.y - ny} ${a.x - nx},${a.y - ny}` };
  });

  const cursorSnap = cursor && (tool === "wall" ? snapPoint(plan, cursor, chainStart ?? undefined) : null);
  const ghostWall = tool === "door" || tool === "window" ? (cursor ? nearestWall(cursor) : null) : null;

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[var(--paper)]">
      <svg
        ref={svgRef}
        data-testid="plan-editor"
        className={`h-full w-full touch-none ${tool === "select" ? (drag?.kind === "pan" ? "cursor-grabbing" : "cursor-default") : "cursor-crosshair"}`}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setCursor(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setChainStart(null);
        }}
      >
        <defs>
          <pattern id="grid" width="1000" height="1000" patternUnits="userSpaceOnUse">
            <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="var(--grid)" strokeWidth={px} />
          </pattern>
        </defs>
        <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#grid)" onPointerDown={onBackgroundDown} />

        {image && showImage && plan.source.mmPerPx && (
          <image
            href={image.url}
            x={plan.source.originX}
            y={plan.source.originY}
            width={image.width * plan.source.mmPerPx}
            height={image.height * plan.source.mmPerPx}
            opacity={0.45}
            pointerEvents="none"
            preserveAspectRatio="none"
          />
        )}

        {topo.rooms.map((r) => (
          <g key={r.id} pointerEvents="none">
            <polygon points={r.clearPolygon.map((p) => `${p.x},${p.y}`).join(" ")} fill="var(--room)" />
          </g>
        ))}

        {wallPolys.map(({ w, points }) => {
          const selected = selection?.kind === "wall" && selection.id === w.id;
          return (
            <polygon
              key={w.id}
              data-wall={w.id}
              points={points}
              fill={selected ? "var(--accent)" : flagged.has(w.id) ? "var(--warn)" : w.kind === "external" ? "var(--ink)" : "var(--ink-soft)"}
              stroke={selected ? "var(--accent)" : "none"}
              strokeWidth={px * 2}
              className={tool === "select" ? "cursor-move" : ""}
              onPointerDown={(e) => {
                if (tool !== "select") return onBackgroundDown(e);
                const a = ix.nodes.get(w.a)!;
                const b = ix.nodes.get(w.b)!;
                const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                startDrag(e, { kind: "wall", id: w.id, start: toPlan(e), normal: { x: -(b.y - a.y) / L, y: (b.x - a.x) / L }, moved: { x: 0, y: 0 } }, { kind: "wall", id: w.id });
              }}
            />
          );
        })}

        {plan.openings.map((o) => {
          const w = ix.walls.get(o.wallId);
          if (!w) return null;
          const a = ix.nodes.get(w.a)!;
          const b = ix.nodes.get(w.b)!;
          const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          const cx = a.x + ((b.x - a.x) * o.offset) / L;
          const cy = a.y + ((b.y - a.y) * o.offset) / L;
          const selected = selection?.kind === "opening" && selection.id === o.id;
          const t = w.thickness;
          return (
            <g
              key={o.id}
              data-opening={o.id}
              transform={`translate(${cx} ${cy}) rotate(${ang})`}
              className={tool === "select" ? "cursor-ew-resize" : ""}
              onPointerDown={(e) => startDrag(e, { kind: "opening", id: o.id }, { kind: "opening", id: o.id })}
            >
              <rect x={-o.width / 2} y={-t / 2 - 1} width={o.width} height={t + 2} fill="var(--paper)" />
              {o.kind === "door" ? (
                <>
                  <line x1={-o.width / 2} y1={t / 2} x2={-o.width / 2} y2={t / 2 + o.width} stroke={selected ? "var(--accent)" : "var(--ink)"} strokeWidth={px * 1.5} />
                  <path d={`M ${-o.width / 2} ${t / 2 + o.width} A ${o.width} ${o.width} 0 0 0 ${o.width / 2} ${t / 2}`} fill="none" stroke={selected ? "var(--accent)" : "var(--ink-soft)"} strokeWidth={px} strokeDasharray={`${px * 4} ${px * 3}`} />
                </>
              ) : (
                <>
                  <rect x={-o.width / 2} y={-t / 2} width={o.width} height={t} fill="none" stroke={selected ? "var(--accent)" : "var(--ink)"} strokeWidth={px * 1.2} />
                  <line x1={-o.width / 2} y1={0} x2={o.width / 2} y2={0} stroke={selected ? "var(--accent)" : "var(--sky)"} strokeWidth={px * 2} />
                </>
              )}
              {flagged.has(o.id) && <circle r={t} fill="none" stroke="var(--warn)" strokeWidth={px * 2} />}
            </g>
          );
        })}

        {topo.rooms.map((r) => (
          <g key={`t-${r.id}`} pointerEvents="none" fontFamily="var(--font-sans)">
            <text x={r.centre.x} y={r.centre.y} textAnchor="middle" fontSize={px * 13} fontWeight={600} fill="var(--ink)">
              {r.name}
            </text>
            <text x={r.centre.x} y={r.centre.y + px * 16} textAnchor="middle" fontSize={px * 11} fill="var(--muted)">
              {(r.clearArea / 1e6).toFixed(1)} m²
            </text>
          </g>
        ))}

        {/* Label drag handles (labels that are inside rooms are drawn as room names above). */}
        {tool === "select" &&
          plan.labels.map((l) => (
            <circle
              key={l.id}
              cx={l.x}
              cy={l.y - px * 22}
              r={px * 5}
              fill={selection?.id === l.id ? "var(--accent)" : "var(--muted)"}
              opacity={0.6}
              className="cursor-move"
              onPointerDown={(e) => startDrag(e, { kind: "label", id: l.id }, { kind: "label", id: l.id })}
            />
          ))}

        {tool === "select" &&
          plan.nodes.map((n) => (
            <circle
              key={n.id}
              data-node={n.id}
              cx={n.x}
              cy={n.y}
              r={px * 6}
              fill={selection?.id === n.id ? "var(--accent)" : "var(--paper)"}
              stroke="var(--accent)"
              strokeWidth={px * 1.5}
              className="cursor-grab"
              onPointerDown={(e) => startDrag(e, { kind: "node", id: n.id }, { kind: "node", id: n.id })}
            />
          ))}

        {selection?.kind === "wall" &&
          (() => {
            const w = ix.walls.get(selection.id);
            if (!w) return null;
            const a = ix.nodes.get(w.a)!;
            const b = ix.nodes.get(w.b)!;
            return (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - px * 14} textAnchor="middle" fontSize={px * 12} fill="var(--accent)" fontWeight={600} pointerEvents="none">
                {formatMm(wallLength(ix, w))}
              </text>
            );
          })()}

        {tool === "wall" && cursorSnap && (
          <>
            <circle cx={cursorSnap.x} cy={cursorSnap.y} r={px * 5} fill="var(--accent)" pointerEvents="none" />
            {chainStart && (
              <>
                <line x1={chainStart.x} y1={chainStart.y} x2={cursorSnap.x} y2={cursorSnap.y} stroke="var(--accent)" strokeWidth={150} opacity={0.5} pointerEvents="none" />
                <text x={(chainStart.x + cursorSnap.x) / 2} y={(chainStart.y + cursorSnap.y) / 2 - px * 12} fontSize={px * 12} fill="var(--accent)" textAnchor="middle" pointerEvents="none">
                  {formatMm(Math.hypot(cursorSnap.x - chainStart.x, cursorSnap.y - chainStart.y))}
                </text>
              </>
            )}
          </>
        )}
        {ghostWall &&
          cursor &&
          (() => {
            const w = ix.walls.get(ghostWall.id)!;
            const a = ix.nodes.get(w.a)!;
            const b = ix.nodes.get(w.b)!;
            const p = { x: a.x + (b.x - a.x) * ghostWall.t, y: a.y + (b.y - a.y) * ghostWall.t };
            return <circle cx={p.x} cy={p.y} r={450} fill="var(--accent)" opacity={0.3} pointerEvents="none" />;
          })()}
        {tool === "scale" && scaleStart && cursor && (
          <line x1={scaleStart.x} y1={scaleStart.y} x2={cursor.x} y2={cursor.y} stroke="var(--accent)" strokeWidth={px * 2} strokeDasharray={`${px * 6} ${px * 4}`} pointerEvents="none" />
        )}
      </svg>
      <ToolHint />
    </div>
  );
}

function ToolHint() {
  const tool = useStore((s) => s.tool);
  const hints: Record<string, string> = {
    select: "Drag a wall to move it · drag a corner · drag doors along walls · scroll to zoom · drag empty space to pan",
    wall: "Click to start, click to place each corner · right-click or Esc to stop",
    door: "Click a wall to add a door",
    window: "Click a wall to add a window",
    label: "Click inside a room to name it",
    scale: "Click both ends of a line whose real length you know",
  };
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 right-2 truncate rounded-md bg-[var(--paper)]/90 px-2 py-1 text-[11px] text-[var(--muted)]">
      {hints[tool]}
    </div>
  );
}
