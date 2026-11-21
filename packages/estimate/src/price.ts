import type { PriceBook } from "@oya/schema";
import { GROUP_NAMES, type GroupId, type TakeoffResult, type WorkItem } from "./takeoff";

export interface PricedMaterial {
  itemId: string;
  name: string;
  unit: string;
  /** Quantity to buy: rounded up to whole units for countable items. */
  qty: number;
  rate: number;
  amount: number;
  overridden: boolean;
  source: string;
  observedAt: string;
}

export interface PricedWorkItem extends WorkItem {
  amount: number;
}

export interface BoqGroup {
  id: GroupId;
  name: string;
  items: PricedWorkItem[];
  subtotal: number;
}

export interface Boq {
  groups: BoqGroup[];
  materials: PricedMaterial[];
  materialsTotal: number;
  labourPercent: number;
  labour: number;
  total: number;
  priceBook: { id: string; region: string; asOf: string; disclaimer: string };
  warnings: string[];
  summary: TakeoffResult["summary"];
}

/** Units bought in whole numbers; everything else (t, kg, m²) is priced on the decimal quantity. */
const WHOLE_UNITS = new Set(["nr", "bag", "piece"]);

export function price(takeoffResult: TakeoffResult, book: PriceBook, overrides: Record<string, number> = {}, labourPercent = 0): Boq {
  const items = new Map(book.items.map((i) => [i.id, i]));
  const warnings = [...takeoffResult.warnings];
  const rateOf = (id: string) => overrides[id] ?? items.get(id)?.rate;

  // Materials schedule: totals per item, rounded up for whole units.
  const totals = new Map<string, { unit: string; qty: number }>();
  for (const wi of takeoffResult.items)
    for (const mq of wi.materials) {
      const t = totals.get(mq.itemId) ?? { unit: mq.unit, qty: 0 };
      t.qty += mq.qty;
      totals.set(mq.itemId, t);
    }
  const missing = new Set<string>();
  const materials: PricedMaterial[] = [...totals.entries()].map(([itemId, t]) => {
    const item = items.get(itemId);
    const rate = rateOf(itemId);
    if (rate === undefined) missing.add(itemId);
    const qty = WHOLE_UNITS.has(t.unit) ? Math.ceil(t.qty - 1e-9) : t.qty;
    return {
      itemId,
      name: item?.name ?? itemId,
      unit: item?.unit ?? t.unit,
      qty,
      rate: rate ?? 0,
      amount: qty * (rate ?? 0),
      overridden: overrides[itemId] !== undefined,
      source: item?.source ?? "—",
      observedAt: item?.observedAt ?? "—",
    };
  });
  for (const id of missing) warnings.push(`No price for "${id}": priced at ₦0.`);

  // Work items: cost of their own materials (unrounded, so groups add up to the schedule before rounding).
  const priced: PricedWorkItem[] = takeoffResult.items.map((wi) => ({
    ...wi,
    amount: wi.materials.reduce((s, mq) => s + mq.qty * (rateOf(mq.itemId) ?? 0), 0),
  }));
  const groups: BoqGroup[] = (Object.keys(GROUP_NAMES) as GroupId[])
    .map((id) => {
      const gi = priced.filter((p) => p.group === id);
      return { id, name: GROUP_NAMES[id], items: gi, subtotal: gi.reduce((s, x) => s + x.amount, 0) };
    })
    .filter((g) => g.items.length > 0);

  const materialsTotal = materials.reduce((s, x) => s + x.amount, 0);
  const labour = (materialsTotal * labourPercent) / 100;
  return {
    groups,
    materials: materials.sort((a, b) => b.amount - a.amount),
    materialsTotal,
    labourPercent,
    labour,
    total: materialsTotal + labour,
    priceBook: { id: book.id, region: book.region, asOf: book.asOf, disclaimer: book.disclaimer },
    warnings,
    summary: takeoffResult.summary,
  };
}
