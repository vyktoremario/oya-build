"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { topology } from "@oya/geometry";
import { useStore } from "@/lib/store";
import { loadLocalPlan, planFromHash, savePlanLocally } from "@/lib/share";
import { loadSample } from "@/samples";
import { PlanEditor } from "./PlanEditor";
import { BoqPanel } from "./BoqPanel";
import { Toolbar } from "./Toolbar";
import { Inspector } from "./Inspector";
import { UploadDialog } from "./UploadDialog";
import { StyleMenu } from "./StyleMenu";
import { useBoq } from "./BoqPanel";
import { formatNaira } from "@/lib/format";

/** The running total, floating over the 3D view when the Cost panel is hidden. */
function TotalChip() {
  const showCostPane = useStore((s) => s.showCostPane);
  const set = useStore((s) => s.set);
  const boq = useBoq();
  if (showCostPane) return null;
  return (
    <button
      onClick={() => set({ showCostPane: true })}
      className="absolute bottom-3 left-3 z-10 hidden rounded-lg bg-white/95 px-3 py-2 text-left shadow-sm lg:block"
      title="Show the bill of quantities"
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Estimated materials</div>
      <div className="text-lg font-semibold tabular-nums">{formatNaira(boq.total)}</div>
    </button>
  );
}

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-xs text-[var(--muted)]">Loading 3D…</div> });

const TOOL_KEYS: Record<string, Parameters<ReturnType<typeof useStore.getState>["setTool"]>[0]> = { v: "select", w: "wall", d: "door", n: "window", l: "label", s: "scale" };

function Flags() {
  const allFlags = useStore((s) => s.flags);
  const plan = useStore((s) => s.plan);
  // Topology problems are computed live, so they disappear as soon as they're fixed.
  const openWalls = useMemo(() => topology(plan).openWallIds.size, [plan]);
  const flags = allFlags.filter((f) => !f.message.includes("don't close a room"));
  const extraction = useStore((s) => s.extraction);
  const source = useStore((s) => s.plan.source);
  const [open, setOpen] = useState(true);
  if (!extraction && flags.length === 0 && openWalls === 0) return null;
  const warn = [...flags.filter((f) => f.level === "warn"), ...(openWalls ? [null] : [])];
  const grouped = [...flags.reduce((m, f) => m.set(f.message, { ...f, count: (m.get(f.message)?.count ?? 0) + 1 }), new Map<string, (typeof flags)[number] & { count: number }>()).values()];
  return (
    <div className="absolute left-2 top-2 z-10 max-w-sm rounded-lg border border-[var(--line)] bg-white/95 text-xs shadow-sm">
      <button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left" onClick={() => setOpen(!open)}>
        <span className="font-semibold">
          {warn.length ? `Check ${warn.length} thing${warn.length > 1 ? "s" : ""} before trusting the estimate` : "Check the walls against the photo"}
        </span>
        <span className="text-[var(--muted)]">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-[var(--line)] px-3 py-2">
          {source.scaleSource === "guess" && <p className="font-medium text-[var(--warn-ink)]">Scale is a guess: use “Set scale” on a line you know.</p>}
          {openWalls > 0 && (
            <p className="font-medium text-[var(--warn-ink)]">
              {openWalls} wall{openWalls > 1 ? "s" : ""} in amber {openWalls > 1 ? "don't" : "doesn't"} close a room. A wall is probably missing: compare with the photo and draw it with the Wall tool.
            </p>
          )}
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {grouped.map((f) => (
              <li key={f.message} className={f.level === "warn" ? "text-[var(--warn-ink)]" : "text-[var(--muted)]"}>
                {f.count > 1 ? `${f.count} × ${f.message.replace(": check it.", "")} (marked in amber)` : f.message}
              </li>
            ))}
          </ul>
          {extraction && (
            <p className="text-[10px] text-[var(--muted)]">
              {extraction.recorded ? "Pre-recorded extraction" : "Extracted"} by {extraction.meta.model} in {Math.round(extraction.meta.latencyMs / 1000)} s · $
              {extraction.meta.costUsd.toFixed(3)}. The edited plan is what gets priced.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ViewControls() {
  const walk = useStore((s) => s.walk);
  const showRoof = useStore((s) => s.showRoof);
  const focused = useStore((s) => !s.showPlanPane && !s.showCostPane);
  const set = useStore((s) => s.set);
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-lg bg-white/90 p-1 text-xs shadow-sm">
      <button onClick={() => set({ walk: false })} aria-pressed={!walk} className={`rounded px-2 py-1 ${!walk ? "bg-[var(--ink)] text-white" : ""}`}>
        Orbit
      </button>
      {!touch && (
        <button onClick={() => set({ walk: true, showPlanPane: false, showCostPane: false })} aria-pressed={walk} className={`rounded px-2 py-1 ${walk ? "bg-[var(--ink)] text-white" : ""}`} data-testid="walk-button">
          Walk
        </button>
      )}
      <button onClick={() => set({ showRoof: !showRoof })} className="rounded px-2 py-1 hover:bg-[var(--hover)]">
        {showRoof ? "Hide roof" : "Show roof"}
      </button>
      <StyleMenu />
      <button
        onClick={() => set({ showPlanPane: focused, showCostPane: focused })}
        className="hidden rounded px-2 py-1 hover:bg-[var(--hover)] lg:inline"
        title={focused ? "Show the plan and the bill again" : "Hide the side panels"}
        data-testid="focus-3d"
      >
        {focused ? "Exit full view" : "Full view"}
      </button>
    </div>
  );
}

/** Load the initial plan from a share link, the sample, or this browser's last plan. Runs once, before the first render. */
export function initFromLocation(): { openUpload: boolean } {
  const { load } = useStore.getState();
  const params = new URLSearchParams(location.search);
  const shared = planFromHash(location.hash);
  if (shared) {
    load(shared);
    history.replaceState(null, "", location.pathname);
    return { openUpload: false };
  }
  const local = params.has("sample") ? null : loadLocalPlan();
  if (local && local.walls.length) load(local);
  else {
    const s = loadSample();
    load(s.plan, { image: s.image, flags: s.flags, extraction: s.extraction });
  }
  return { openUpload: params.has("upload") };
}

export default function Workspace({ openUpload = false }: { openUpload?: boolean }) {
  const plan = useStore((s) => s.plan);
  const [dialog, setDialog] = useState(openUpload);
  const [tab, setTab] = useState<"plan" | "3d" | "cost">("plan");
  useEffect(() => {
    const t = setTimeout(() => savePlanLocally(plan), 400);
    return () => clearTimeout(t);
  }, [plan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return;
      if (useStore.getState().walk) return;
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) useStore.getState().setTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showPlanPane = useStore((s) => s.showPlanPane);
  const showCostPane = useStore((s) => s.showCostPane);
  const pane = (id: typeof tab, visible = true) => `${tab === id ? "flex" : "hidden"} ${visible ? "lg:flex" : "lg:hidden"}`;
  const cols = [showPlanPane ? "minmax(0,1fr)" : null, "minmax(0,1fr)", showCostPane ? "380px" : null].filter(Boolean).join(" ");

  return (
    <div className="flex h-dvh flex-col bg-[var(--paper)] text-[var(--ink)]">
      <Toolbar onNew={() => setDialog(true)} />
      <nav className="flex border-b border-[var(--line)] bg-white text-sm lg:hidden" role="tablist">
        {(["plan", "3d", "cost"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 py-2 ${tab === t ? "border-b-2 border-[var(--accent)] font-semibold" : "text-[var(--muted)]"}`}>
            {t === "plan" ? "Plan" : t === "3d" ? "3D" : "Cost"}
          </button>
        ))}
      </nav>
      <main className="grid min-h-0 flex-1 grid-cols-1 lg:[grid-template-columns:var(--cols)]" style={{ "--cols": cols } as React.CSSProperties}>
        <section className={`${pane("plan", showPlanPane)} relative min-h-0 border-r border-[var(--line)]`} aria-label="2D plan">
          <PlanEditor />
          <Flags />
          <Inspector />
        </section>
        <section className={`${pane("3d")} relative min-h-0 border-r border-[var(--line)]`} aria-label="3D model">
          <Scene3D />
          <ViewControls />
          <TotalChip />
        </section>
        <aside className={`${pane("cost", showCostPane)} min-h-0 flex-col bg-white`} aria-label="Bill of quantities">
          <BoqPanel />
        </aside>
      </main>
      {dialog && <UploadDialog onClose={() => setDialog(false)} />}
    </div>
  );
}
