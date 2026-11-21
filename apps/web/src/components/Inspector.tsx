"use client";

import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import { THICKNESS, indexPlan, setWallProps, updateOpening, wallLength } from "@oya/geometry";
import { useStore } from "@/lib/store";
import { formatMm } from "@/lib/format";

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const plan = useStore((s) => s.plan);
  const apply = useStore((s) => s.apply);
  if (!selection) return null;
  const ix = indexPlan(plan);
  let body: React.ReactNode = null;

  if (selection.kind === "wall") {
    const w = ix.walls.get(selection.id);
    if (!w) return null;
    body = (
      <>
        <div className="font-semibold">Wall · {formatMm(wallLength(ix, w))}</div>
        <label className="flex items-center justify-between gap-2">
          Type
          <select
            className="rounded border border-[var(--line)] px-1 py-0.5"
            value={`${w.kind}:${w.thickness}`}
            onChange={(e) => {
              const [kind, t] = e.target.value.split(":") as ["external" | "internal", string];
              apply((p) => setWallProps(p, w.id, { kind, thickness: Number(t) }));
            }}
          >
            <option value={`external:${THICKNESS.external}`}>9&quot; external (225 mm)</option>
            <option value={`internal:${THICKNESS.internal}`}>6&quot; internal (150 mm)</option>
            <option value="internal:225">9&quot; internal (225 mm)</option>
          </select>
        </label>
        <div className="text-[11px] text-[var(--muted)]">Drag the wall to move it; drag its end dots to reshape. Delete removes it.</div>
      </>
    );
  } else if (selection.kind === "opening") {
    const o = plan.openings.find((x) => x.id === selection.id);
    if (!o) return null;
    const specs = DEFAULT_PRICE_BOOK.openingSpecs.filter((s) => s.kind === o.kind);
    body = (
      <>
        <div className="font-semibold capitalize">{o.kind}</div>
        <select
          className="w-full rounded border border-[var(--line)] px-1 py-0.5"
          value={o.specId}
          onChange={(e) => {
            const s = specs.find((x) => x.id === e.target.value)!;
            apply((p) => updateOpening(p, o.id, { specId: s.id, width: s.width, height: s.height, sill: s.sill }));
          }}
        >
          {specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="text-[11px] text-[var(--muted)]">Drag it along the wall. Delete removes it.</div>
      </>
    );
  } else if (selection.kind === "label") {
    const l = plan.labels.find((x) => x.id === selection.id);
    if (!l) return null;
    body = (
      <label className="block">
        <span className="font-semibold">Room name</span>
        <input
          className="mt-1 w-full rounded border border-[var(--line)] px-1 py-0.5"
          defaultValue={l.name}
          key={l.id}
          onBlur={(e) => apply((p) => ({ ...p, labels: p.labels.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)) }))}
        />
      </label>
    );
  } else {
    body = <div className="text-[11px] text-[var(--muted)]">Corner selected. Drag to move; Delete removes it and its walls.</div>;
  }

  return <div className="absolute right-2 top-2 z-10 w-60 space-y-2 rounded-lg border border-[var(--line)] bg-white/95 p-3 text-xs shadow-sm">{body}</div>;
}
