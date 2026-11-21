import { describe, expect, it } from "vitest";
import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import { buildPlan } from "./dsl";
import { twoBed } from "./cases";
import { scoreCase } from "./score";

const truth = buildPlan(twoBed, DEFAULT_PRICE_BOOK.openingSpecs);

describe("scoreCase", () => {
  it("scores a perfect extraction as perfect", () => {
    const s = scoreCase(truth, truth, 10);
    expect(s.wallF1).toBe(1);
    expect(s.openingF1).toBe(1);
    expect(s.estimateErrorPct).toBe(0);
  });

  it("penalises a missing wall and a missing door", () => {
    const found = structuredClone(truth);
    const internal = found.walls.find((w) => w.kind === "internal")!;
    found.walls = found.walls.filter((w) => w.id !== internal.id);
    found.openings = found.openings.filter((o) => o.wallId !== internal.id).slice(1);
    const s = scoreCase(truth, found, null);
    expect(s.wallRecall).toBeLessThan(1);
    expect(s.wallPrecision).toBe(1);
    expect(s.openingRecall).toBeLessThan(1);
    expect(s.estimateErrorPct).toBeGreaterThan(0);
  });

  it("reports scale error as a percentage", () => {
    const found = structuredClone(truth);
    found.source.mmPerPx = 11;
    expect(scoreCase(truth, found, 10).scaleErrorPct).toBeCloseTo(10, 6);
  });
});
