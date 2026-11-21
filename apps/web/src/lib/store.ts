"use client";

import { create } from "zustand";
import { type ExtractionMeta, type Plan, type RawExtraction, emptyPlan } from "@oya/schema";
import type { ExtractionFlag } from "@oya/geometry";

export type Tool = "select" | "wall" | "door" | "window" | "label" | "scale";
export type Selection = { kind: "wall" | "node" | "opening" | "label"; id: string } | null;

export interface SourceImage {
  url: string;
  width: number;
  height: number;
}

interface State {
  plan: Plan;
  past: Plan[];
  future: Plan[];
  /** Snapshot taken when a drag starts, so the whole drag is one undo step. */
  gestureStart: Plan | null;
  image: SourceImage | null;
  showImage: boolean;
  flags: ExtractionFlag[];
  extraction: { raw: RawExtraction; meta: ExtractionMeta; recorded: boolean } | null;
  selection: Selection;
  tool: Tool;
  walk: boolean;
  showRoof: boolean;
  /** Desktop panes; the 3D view always shows. */
  showPlanPane: boolean;
  showCostPane: boolean;
  /** Bumps when a new plan is loaded, so the 3D view can replay its intro. */
  loadId: number;

  load: (plan: Plan, extras?: { image?: SourceImage | null; flags?: ExtractionFlag[]; extraction?: State["extraction"] }) => void;
  /** Apply an edit. With history (default) it becomes an undo step. */
  apply: (fn: (p: Plan) => Plan, opts?: { history?: boolean }) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  select: (s: Selection) => void;
  setTool: (t: Tool) => void;
  set: (partial: Partial<Pick<State, "walk" | "showRoof" | "showImage" | "flags" | "showPlanPane" | "showCostPane">>) => void;
}

const HISTORY_LIMIT = 100;

export const useStore = create<State>((set, get) => ({
  plan: emptyPlan(),
  past: [],
  future: [],
  gestureStart: null,
  image: null,
  showImage: true,
  flags: [],
  extraction: null,
  selection: null,
  tool: "select",
  walk: false,
  showRoof: true,
  showPlanPane: true,
  showCostPane: true,
  loadId: 0,

  load: (plan, extras = {}) =>
    set((s) => ({
      plan,
      past: [],
      future: [],
      gestureStart: null,
      image: extras.image ?? null,
      flags: extras.flags ?? [],
      extraction: extras.extraction ?? null,
      selection: null,
      tool: "select",
      walk: false,
      loadId: s.loadId + 1,
    })),

  apply: (fn, opts = {}) => {
    const { plan, past, gestureStart } = get();
    const next = fn(plan);
    if (next === plan) return;
    const history = (opts.history ?? true) && !gestureStart;
    set({ plan: next, ...(history ? { past: [...past, plan].slice(-HISTORY_LIMIT), future: [] } : {}) });
  },

  beginGesture: () => set({ gestureStart: get().plan }),
  endGesture: () => {
    const { gestureStart, plan, past } = get();
    if (gestureStart && gestureStart !== plan) set({ past: [...past, gestureStart].slice(-HISTORY_LIMIT), future: [] });
    set({ gestureStart: null });
  },

  undo: () => {
    const { past, plan, future } = get();
    const prev = past.at(-1);
    if (!prev) return;
    set({ plan: prev, past: past.slice(0, -1), future: [plan, ...future], selection: null });
  },
  redo: () => {
    const { past, plan, future } = get();
    const next = future[0];
    if (!next) return;
    set({ plan: next, past: [...past, plan], future: future.slice(1), selection: null });
  },

  select: (selection) => set({ selection }),
  setTool: (tool) => set({ tool, selection: null }),
  set: (partial) => set(partial),
}));
