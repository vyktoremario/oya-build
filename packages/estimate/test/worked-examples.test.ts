import { describe, expect, it } from "vitest";
import { type Plan, type WallKind, emptyPlan } from "@oya/schema";
import { takeoff } from "../src";
import hand from "./handcalc.json";

/** Build a plan from node coordinates and wall pairs. */
function makePlan(nodes: Record<string, [number, number]>, walls: [string, string, WallKind, number][]): Plan {
  const p = emptyPlan("worked example");
  p.nodes = Object.entries(nodes).map(([id, [x, y]]) => ({ id, x, y }));
  p.walls = walls.map(([a, b, kind, thickness], i) => ({ id: `w${i}`, a, b, kind, thickness }));
  return p;
}

const ITEM: Record<string, string> = {
  cement: "cement-50kg",
  sand: "sand-sharp",
  plaster_sand: "sand-plaster",
  granite: "granite-19mm",
  block9: "block-9in",
  block6: "block-6in",
  laterite: "laterite-fill",
  dpm: "dpm",
  y12: "rebar-y12",
  y8: "rebar-y8",
};

/** Sum material quantities across the take-off, limited to the items the hand calc covers (no roof, no openings). */
function materialTotals(plan: Plan): Record<string, number> {
  const t = takeoff(plan, []);
  const totals: Record<string, number> = {};
  for (const wi of t.items) {
    if (wi.group === "roof" || wi.group === "openings") continue;
    for (const m of wi.materials) totals[m.itemId] = (totals[m.itemId] ?? 0) + m.qty;
  }
  return totals;
}

function expectMatches(plan: Plan, expected: Record<string, number>) {
  const got = materialTotals(plan);
  for (const [k, v] of Object.entries(expected)) {
    const id = ITEM[k]!;
    expect(got[id], id).toBeDefined();
    expect(Math.abs(got[id]! - v) / v, `${id}: engine ${got[id]} vs hand ${v}`).toBeLessThan(0.005);
  }
}

describe("estimate engine matches the hand-worked examples (±0.5%)", () => {
  it("Example 1: single room 4.0 × 3.0 m", () => {
    const p = makePlan(
      { a: [0, 0], b: [4000, 0], c: [4000, 3000], d: [0, 3000] },
      [["a", "b", "external", 225], ["b", "c", "external", 225], ["c", "d", "external", 225], ["d", "a", "external", 225]],
    );
    p.openings.push(
      { id: "door", wallId: "w2", kind: "door", offset: 2000, width: 900, height: 2100, sill: 0, specId: "door-entrance-steel" },
      { id: "win", wallId: "w0", kind: "window", offset: 2000, width: 1200, height: 1200, sill: 900, specId: "window-casement-1200" },
    );
    expectMatches(p, hand.ex1);
  });

  it("Example 2: two rooms with a T-junction partition", () => {
    const p = makePlan(
      { a: [0, 0], m: [3000, 0], b: [6000, 0], c: [6000, 3000], n: [3000, 3000], d: [0, 3000] },
      [
        ["a", "m", "external", 225], ["m", "b", "external", 225], ["b", "c", "external", 225],
        ["c", "n", "external", 225], ["n", "d", "external", 225], ["d", "a", "external", 225],
        ["m", "n", "internal", 150],
      ],
    );
    p.openings.push({ id: "door", wallId: "w6", kind: "door", offset: 1500, width: 750, height: 2100, sill: 0, specId: "door-flush-750" });
    expectMatches(p, hand.ex2);
  });
});

describe("roof", () => {
  it("sloped roof area = plan area incl. overhang ÷ cos(pitch)", () => {
    const p = makePlan(
      { a: [0, 0], b: [4000, 0], c: [4000, 3000], d: [0, 3000] },
      [["a", "b", "external", 225], ["b", "c", "external", 225], ["c", "d", "external", 225], ["d", "a", "external", 225]],
    );
    const r1 = takeoff(p, []).items.find((i) => i.code === "R1")!;
    const plan = (4.225 + 1.2) * (3.225 + 1.2);
    expect(r1.qty).toBeCloseTo(plan / Math.cos((25 * Math.PI) / 180), 6);
  });
});
