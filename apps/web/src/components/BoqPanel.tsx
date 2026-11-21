"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Boq, CONSTANTS, DEFAULT_PRICE_BOOK, estimate } from "@oya/estimate";
import { DEFAULT_PARAMS, PARAM_DOCS, type Params } from "@oya/schema";
import { useStore } from "@/lib/store";
import { formatNaira, formatNairaShort, formatQty } from "@/lib/format";

function useAnimatedNumber(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const v0 = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = v0 + (target - v0) * eased;
      setValue(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function useBoq(): Boq {
  const plan = useStore((s) => s.plan);
  return useMemo(() => estimate(plan, DEFAULT_PRICE_BOOK), [plan]);
}

function toCsv(boq: Boq): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [["Section", "Ref", "Description", "Qty", "Unit", "Amount (NGN)", "Working"]];
  for (const g of boq.groups) for (const i of g.items) rows.push([g.name, i.code, i.description, i.qty.toFixed(3), i.unit, Math.round(i.amount), i.formula]);
  rows.push([]);
  rows.push(["Materials", "Item", "Name", "Qty", "Unit", "Rate (NGN)", "Amount (NGN)", "Source", "Observed"]);
  for (const m of boq.materials) rows.push(["", m.itemId, m.name, m.qty.toFixed(3), m.unit, m.rate, Math.round(m.amount), m.overridden ? "your rate" : m.source, m.observedAt]);
  rows.push([]);
  rows.push(["Materials total", "", "", "", "", Math.round(boq.materialsTotal)]);
  rows.push([`Labour (${boq.labourPercent}%)`, "", "", "", "", Math.round(boq.labour)]);
  rows.push(["Total", "", "", "", "", Math.round(boq.total)]);
  rows.push([`Prices: ${boq.priceBook.region}, ${boq.priceBook.asOf}. ${boq.priceBook.disclaimer}`]);
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function BoqPanel() {
  const boq = useBoq();
  const plan = useStore((s) => s.plan);
  const [tab, setTab] = useState<"bill" | "materials" | "assumptions">("bill");
  const total = useAnimatedNumber(boq.total);

  // Show the change caused by the latest edit for a few seconds.
  const prev = useRef(boq.total);
  const [delta, setDelta] = useState<number | null>(null);
  const loadId = useStore((s) => s.loadId);
  const lastLoad = useRef(loadId);
  useEffect(() => {
    if (lastLoad.current !== loadId) {
      lastLoad.current = loadId;
      prev.current = boq.total;
      return;
    }
    const d = boq.total - prev.current;
    prev.current = boq.total;
    if (Math.abs(d) < 1) return;
    setDelta(d);
    const t = setTimeout(() => setDelta(null), 3500);
    return () => clearTimeout(t);
  }, [boq.total, loadId]);

  return (
    <div className="flex h-full flex-col" data-print>
      <div className="border-b border-[var(--line)] px-4 pb-3 pt-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          Estimated materials{boq.labourPercent > 0 ? " + labour" : ""}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-semibold tabular-nums text-[var(--ink)]" data-testid="boq-total">
            {formatNaira(total)}
          </div>
          {delta !== null && (
            <div className={`text-sm font-semibold tabular-nums ${delta > 0 ? "text-[var(--accent)]" : "text-[var(--money)]"}`}>
              {delta > 0 ? "+" : "−"}
              {formatNairaShort(Math.abs(delta))}
            </div>
          )}
        </div>
        <div className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
          {boq.summary.floorClearArea.toFixed(0)} m² floor · {boq.summary.rooms.length} rooms ·{" "}
          {boq.summary.floorClearArea > 0 ? `${formatNairaShort(boq.total / boq.summary.floorClearArea)}/m²` : "—"} · Prices:{" "}
          {boq.priceBook.region}, {boq.priceBook.asOf} (indicative)
        </div>
        <div className="mt-3 flex gap-1 text-xs" role="tablist">
          {(["bill", "materials", "assumptions"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 capitalize ${tab === t ? "bg-[var(--ink)] text-white" : "text-[var(--muted)] hover:bg-[var(--hover)]"}`}
            >
              {t === "materials" ? "Materials & rates" : t}
            </button>
          ))}
          <button
            onClick={() => download(`${plan.name.replace(/\W+/g, "-").toLowerCase()}-boq.csv`, toCsv(boq))}
            className="ml-auto rounded-md px-2 py-1 text-[var(--muted)] hover:bg-[var(--hover)]"
            title="Download the bill of quantities as CSV"
          >
            CSV
          </button>
          <button onClick={() => window.print()} className="rounded-md px-2 py-1 text-[var(--muted)] hover:bg-[var(--hover)]" title="Print or save as PDF">
            Print
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
        {boq.warnings.length > 0 && (
          <ul className="mb-3 space-y-1 rounded-md bg-[var(--warn-bg)] p-2 text-xs text-[var(--warn-ink)]">
            {boq.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        {tab === "bill" && <Bill boq={boq} />}
        {tab === "materials" && <Materials boq={boq} />}
        {tab === "assumptions" && <Assumptions />}
        <p className="mt-4 text-[11px] leading-snug text-[var(--muted)]">
          First-pass estimate, not a QS bill. {boq.priceBook.disclaimer}
        </p>
      </div>
    </div>
  );
}

function Bill({ boq }: { boq: Boq }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {boq.groups.map((g) => (
        <section key={g.id}>
          <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">{g.name}</h3>
            <span className="tabular-nums text-xs font-semibold">{formatNaira(g.subtotal)}</span>
          </div>
          <ul>
            {g.items.map((i) => (
              <li key={i.code} className="border-b border-dashed border-[var(--line)] py-1.5">
                <button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(open === i.code ? null : i.code)}>
                  <span className="w-6 shrink-0 font-mono text-[10px] text-[var(--muted)]">{i.code}</span>
                  <span className="flex-1 text-[13px] leading-snug">{i.description}</span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums text-[13px]">{i.amount > 0 ? formatNaira(i.amount) : "—"}</span>
                    <span className="block tabular-nums text-[11px] text-[var(--muted)]">{formatQty(i.qty, i.unit)}</span>
                  </span>
                </button>
                {open === i.code && (
                  <div className="ml-8 mt-1 space-y-1 rounded bg-[var(--hover)] p-2 text-[11px] text-[var(--muted)]">
                    <div className="font-mono">{i.formula}</div>
                    {i.notes && <div>{i.notes}</div>}
                    {i.materials.map((m) => (
                      <div key={m.itemId} className="flex justify-between">
                        <span>{m.itemId}</span>
                        <span className="tabular-nums">
                          {formatQty(m.net, m.unit)}
                          {m.waste > 0 ? ` + ${Math.round(m.waste * 100)}% waste` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="space-y-1 border-t border-[var(--ink)] pt-2 text-[13px]">
        <div className="flex justify-between">
          <span>Materials</span>
          <span className="tabular-nums">{formatNaira(boq.materialsTotal)}</span>
        </div>
        <div className="flex justify-between text-[var(--muted)]">
          <span>Labour {boq.labourPercent > 0 ? `(${boq.labourPercent}% of materials)` : "(not included — set a % under Assumptions)"}</span>
          <span className="tabular-nums">{formatNaira(boq.labour)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatNaira(boq.total)}</span>
        </div>
      </div>
    </div>
  );
}

function Materials({ boq }: { boq: Boq }) {
  const apply = useStore((s) => s.apply);
  const setRate = (id: string, value: number | null) =>
    apply((p) => {
      const priceOverrides = { ...p.priceOverrides };
      if (value === null) delete priceOverrides[id];
      else priceOverrides[id] = value;
      return { ...p, priceOverrides };
    });
  return (
    <div>
      <p className="mb-2 text-[11px] text-[var(--muted)]">Rates from the {boq.priceBook.region} price book ({boq.priceBook.asOf}). Type your own supplier quote to override; hover a name to see the source.</p>
      <table className="w-full text-[12px]">
        <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--muted)]">
          <tr>
            <th className="pb-1 font-medium">Material</th>
            <th className="pb-1 text-right font-medium">Qty</th>
            <th className="pb-1 text-right font-medium">Rate ₦</th>
            <th className="pb-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {boq.materials.map((m) => (
            <tr key={m.itemId} className="border-t border-[var(--line)] align-top">
              <td className="py-1.5 pr-2" title={`Source: ${m.source} (${m.observedAt})`}>
                {m.name}
                {m.overridden && (
                  <button className="ml-1 text-[10px] text-[var(--accent)] underline" onClick={() => setRate(m.itemId, null)}>
                    reset
                  </button>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatQty(m.qty, m.unit)}</td>
              <td className="py-1 text-right">
                <input
                  aria-label={`Rate for ${m.name}`}
                  className={`w-20 rounded border px-1 py-0.5 text-right tabular-nums ${m.overridden ? "border-[var(--accent)] bg-orange-50" : "border-[var(--line)] bg-transparent"}`}
                  type="number"
                  min={0}
                  defaultValue={m.rate}
                  key={`${m.itemId}-${m.rate}`}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0 && v !== m.rate) setRate(m.itemId, v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatNaira(m.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EDITABLE: (keyof typeof PARAM_DOCS)[] = [
  "wallHeight",
  "foundationDepth",
  "foundationWidth",
  "footingThickness",
  "plinthHeight",
  "slabThickness",
  "plasterThickness",
  "roofPitchDeg",
  "roofOverhang",
  "labourPercent",
];

function Assumptions() {
  const params = useStore((s) => s.plan.params);
  const apply = useStore((s) => s.apply);
  const setParam = (k: keyof Params, v: Params[keyof Params]) => apply((p) => ({ ...p, params: { ...p.params, [k]: v } }));
  return (
    <div className="space-y-3 text-[12px]">
      <div className="space-y-2">
        {EDITABLE.map((k) => {
          const doc = PARAM_DOCS[k];
          const value = params[k] as number;
          return (
            <label key={k} className="block">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{doc.label}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    className={`w-20 rounded border px-1 py-0.5 text-right tabular-nums ${value !== DEFAULT_PARAMS[k] ? "border-[var(--accent)]" : "border-[var(--line)]"}`}
                    defaultValue={value}
                    key={`${k}-${value}`}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0 && v !== value) setParam(k, k === "roofPitchDeg" || k === "labourPercent" ? v : Math.round(v));
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                  <span className="w-6 text-[var(--muted)]">{doc.unit}</span>
                </span>
              </span>
              <span className="text-[11px] text-[var(--muted)]">{doc.why}</span>
            </label>
          );
        })}
        <label className="flex items-center justify-between">
          <span className="font-medium">Roof type</span>
          <select className="rounded border border-[var(--line)] px-1 py-0.5" value={params.roofType} onChange={(e) => setParam("roofType", e.target.value as Params["roofType"])}>
            <option value="hip">Hip</option>
            <option value="gable">Gable</option>
          </select>
        </label>
      </div>
      <div>
        <h4 className="mb-1 font-semibold">Fixed by default (standard details)</h4>
        <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-[var(--muted)]">
          <li>Mixes: footing, lintel and slab 1:2:4; block cores 1:3:6; mortar and plaster 1:6; screed 1:3.</li>
          <li>
            Lintel band {params.lintelDepth} mm deep with {params.lintelMainBars}Y{params.lintelMainBarDia} and Y{params.lintelLinkDia} links @ {params.lintelLinkSpacing} mm. A standard detail, not a structural design.
          </li>
          <li>
            Waste: blocks {params.waste.blocks * 100}%, cement {params.waste.cement * 100}%, sand {params.waste.sand * 100}%, rebar {params.waste.rebar * 100}%, roofing {params.waste.roofing * 100}%, laterite {params.waste.fill * 100}% (incl. compaction).
          </li>
          <li>
            Dry-volume factors {CONSTANTS.dryFactorConcrete} (concrete) and {CONSTANTS.dryFactorMortar} (mortar); cement {CONSTANTS.cementDensity} kg/m³; sand {CONSTANTS.sandDensity} t/m³; granite {CONSTANTS.graniteDensity} t/m³.
          </li>
          <li>Roof timber is a rule of thumb (rafters @ 600, purlins @ 900, +30% bracing), not a truss design.</li>
          <li>Not included: labour (unless set), electrical, plumbing, tiles, paint, external works, professional fees, VAT.</li>
        </ul>
      </div>
    </div>
  );
}
