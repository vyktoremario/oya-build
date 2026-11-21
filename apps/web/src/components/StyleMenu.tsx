"use client";

import { useState } from "react";
import type { Appearance } from "@oya/schema";
import { useStore } from "@/lib/store";

/** Common long-span colours in Nigerian markets, plus mill-finish silver. Cosmetic only. */
const ROOF = [
  { name: "Brick red", value: "#8e2f2a" },
  { name: "Blue", value: "#2f4f8a" },
  { name: "Forest green", value: "#2f5d3a" },
  { name: "Coffee brown", value: "#5a3b2a" },
  { name: "Charcoal", value: "#3a3d42" },
  { name: "Silver", value: "#b8bec4" },
];
const WALLS = [
  { name: "Cream", value: "#efe8da" },
  { name: "White", value: "#f7f6f2" },
  { name: "Sand", value: "#e3cfa8" },
  { name: "Terracotta", value: "#c98a64" },
  { name: "Sage", value: "#b9c4ad" },
  { name: "Sky", value: "#bcd0de" },
];

function Swatches({ options, value, onPick, label }: { options: { name: string; value: string }[]; value: string; onPick: (v: string) => void; label: string }) {
  return (
    <div>
      <div className="mb-1 font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            title={o.name}
            aria-label={`${label}: ${o.name}`}
            aria-pressed={value === o.value}
            onClick={() => onPick(o.value)}
            className={`h-6 w-6 rounded-full border ${value === o.value ? "ring-2 ring-[var(--accent)] ring-offset-1" : "border-black/10"}`}
            style={{ background: o.value }}
          />
        ))}
      </div>
    </div>
  );
}

export function StyleMenu() {
  const [open, setOpen] = useState(false);
  const appearance = useStore((s) => s.plan.appearance);
  const apply = useStore((s) => s.apply);
  const set = (patch: Partial<Appearance>) => apply((p) => ({ ...p, appearance: { ...p.appearance, ...patch } }));
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="rounded px-2 py-1 hover:bg-[var(--hover)]">
        Style
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-56 space-y-3 rounded-lg border border-[var(--line)] bg-white p-3 text-xs shadow-lg">
          <Swatches label="Roof sheets" options={ROOF} value={appearance.roofColor} onPick={(v) => set({ roofColor: v })} />
          <Swatches label="Wall paint" options={WALLS} value={appearance.wallColor} onPick={(v) => set({ wallColor: v })} />
          <div>
            <div className="mb-1 font-medium">Floor</div>
            <div className="flex gap-1">
              {(["tiles", "screed"] as const).map((f) => (
                <button key={f} onClick={() => set({ floor: f })} aria-pressed={appearance.floor === f} className={`rounded px-2 py-0.5 capitalize ${appearance.floor === f ? "bg-[var(--ink)] text-white" : "bg-[var(--hover)]"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[var(--muted)]">Colours change the model only, not the estimate. Door and window types (which are priced) are chosen by selecting one on the plan.</p>
        </div>
      )}
    </div>
  );
}
