import { describe, expect, it } from "vitest";
import type { OpeningSpec, RawExtraction } from "@oya/schema";
import { estimateScale, postProcess, rescalePlan, topology } from "../src";

const specs: OpeningSpec[] = [
  { id: "door-entrance-steel", kind: "door", name: "Entrance", width: 900, height: 2100, sill: 0, priceItemId: "a" },
  { id: "door-flush-900", kind: "door", name: "Flush", width: 900, height: 2100, sill: 0, priceItemId: "b" },
  { id: "door-flush-750", kind: "door", name: "Flush 750", width: 750, height: 2100, sill: 0, priceItemId: "c" },
  { id: "window-casement-1200", kind: "window", name: "W", width: 1200, height: 1200, sill: 900, priceItemId: "d" },
  { id: "window-casement-600", kind: "window", name: "W small", width: 600, height: 600, sill: 1500, priceItemId: "e" },
];

const w = (x1: number, y1: number, x2: number, y2: number, kind: "external" | "internal" | "unknown" = "unknown", confidence = 0.9) => ({ x1, y1, x2, y2, thicknessPx: 0, kind, confidence });

/** A 6 m × 4 m two-room sketch at 0.1 px/mm (600 × 400 px), drawn sloppily. */
const raw: RawExtraction = {
  imageWidth: 800,
  imageHeight: 600,
  drawingType: "hand_sketch",
  walls: [
    w(100, 100, 702, 104, "external"),
    w(698, 98, 700, 502, "external"),
    w(705, 500, 96, 497, "external"),
    w(100, 505, 103, 101, "external"),
    w(400, 108, 402, 495, "internal", 0.4),
  ],
  openings: [
    { kind: "door", x: 250, y: 500, widthPx: 90, confidence: 0.9 },
    { kind: "window", x: 550, y: 101, widthPx: 120, confidence: 0.5 },
    { kind: "door", x: 401, y: 300, widthPx: 75, confidence: 0.9 },
  ],
  rooms: [
    { name: "Bedroom", x: 250, y: 300, confidence: 0.9 },
    { name: "Parlour", x: 550, y: 300, confidence: 0.9 },
  ],
  dimensions: [
    { text: "6000", valueMm: 6000, x1: 100, y1: 60, x2: 700, y2: 60, confidence: 0.9 },
    { text: "4000", valueMm: 4000, x1: 60, y1: 100, x2: 60, y2: 500, confidence: 0.9 },
    { text: "9000", valueMm: 9000, x1: 100, y1: 560, x2: 400, y2: 560, confidence: 0.3 },
  ],
  notes: [],
};

describe("estimateScale", () => {
  it("takes the median and rejects an outlier", () => {
    const s = estimateScale(raw)!;
    expect(s.mmPerPx).toBeCloseTo(10, 6);
    expect(s.rejected).toBe(1);
  });
  it("returns null without dimensions", () => {
    expect(estimateScale({ ...raw, dimensions: [] })).toBeNull();
  });
});

describe("postProcess", () => {
  const out = postProcess(raw, { openingSpecs: specs });

  it("recovers a clean 6 × 4 m outline split into two rooms", () => {
    const t = topology(out.plan);
    expect(t.rooms).toHaveLength(2);
    const xs = out.plan.nodes.map((n) => n.x);
    const ys = out.plan.nodes.map((n) => n.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(6000);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(4000);
    expect(out.plan.walls.filter((x) => x.kind === "external")).toHaveLength(6);
    expect(out.plan.source.scaleSource).toBe("dimensions");
  });

  it("places openings on walls with standard specs", () => {
    const ids = out.plan.openings.map((o) => o.specId).sort();
    expect(ids).toEqual(["door-entrance-steel", "door-flush-750", "window-casement-1200"]);
  });

  it("names rooms and flags low-confidence items", () => {
    expect(topology(out.plan).rooms.map((r) => r.name).sort()).toEqual(["Bedroom", "Parlour"]);
    expect(out.flags.some((f) => f.ref?.kind === "opening")).toBe(true);
    expect(out.flags.some((f) => f.message.includes("disagreed"))).toBe(true);
  });

  it("guesses a scale and says so when there are no dimensions", () => {
    const g = postProcess({ ...raw, dimensions: [] }, { openingSpecs: specs });
    expect(g.scale.source).toBe("guess");
    expect(g.flags[0]!.message).toMatch(/guess/);
  });

  it("rescalePlan doubles everything", () => {
    const r = rescalePlan(out.plan, 2);
    const xs = r.nodes.map((n) => n.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(12000);
    expect(r.source.scaleSource).toBe("user");
  });
});
