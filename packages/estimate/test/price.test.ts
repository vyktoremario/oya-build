import { describe, expect, it } from "vitest";
import type { PriceBook } from "@oya/schema";
import { price, type TakeoffResult } from "../src";

const book: PriceBook = {
  id: "test", region: "Test", currency: "NGN", asOf: "2026-11", disclaimer: "test",
  items: [
    { id: "cement-50kg", name: "Cement", unit: "bag", rate: 10000, source: "s", observedAt: "2026-11-01" },
    { id: "sand-sharp", name: "Sand", unit: "t", rate: 5000, source: "s", observedAt: "2026-11-01" },
  ],
  openingSpecs: [],
};

const t: TakeoffResult = {
  items: [
    { code: "X", group: "substructure", description: "x", unit: "m³", qty: 1, formula: "", materials: [
      { itemId: "cement-50kg", unit: "bag", net: 6, waste: 0.05, qty: 6.3 },
      { itemId: "sand-sharp", unit: "t", net: 1, waste: 0.1, qty: 1.1 },
    ] },
    { code: "Y", group: "finishes", description: "y", unit: "m²", qty: 1, formula: "", materials: [
      { itemId: "cement-50kg", unit: "bag", net: 2, waste: 0, qty: 2 },
      { itemId: "mystery", unit: "nr", net: 1, waste: 0, qty: 1 },
    ] },
  ],
  summary: { floorClearArea: 0, footprintArea: 0, externalWallLength: 0, internalWallLength: 0, roofArea: 0, rooms: [] },
  warnings: [],
};

describe("price", () => {
  it("rounds countable materials up and prices the schedule", () => {
    const b = price(t, book);
    const cement = b.materials.find((m) => m.itemId === "cement-50kg")!;
    expect(cement.qty).toBe(9); // 8.3 bags → 9
    expect(cement.amount).toBe(90000);
    expect(b.materials.find((m) => m.itemId === "sand-sharp")!.amount).toBeCloseTo(5500, 6);
    expect(b.total).toBeCloseTo(95500, 6);
  });

  it("applies overrides and warns about unpriced items", () => {
    const b = price(t, book, { "cement-50kg": 12000 });
    expect(b.materials.find((m) => m.itemId === "cement-50kg")!.overridden).toBe(true);
    expect(b.warnings.some((w) => w.includes("mystery"))).toBe(true);
    expect(b.total).toBeCloseTo(9 * 12000 + 5500, 6);
  });

  it("adds labour as a percentage of materials", () => {
    const b = price(t, book, {}, 30);
    expect(b.labour).toBeCloseTo(95500 * 0.3, 6);
    expect(b.total).toBeCloseTo(95500 * 1.3, 6);
  });
});
