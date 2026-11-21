import { DEFAULT_PARAMS } from "./params";
import type { Plan } from "./plan";

let counter = 0;
/** Short, unique-enough ids for plan entities. Prefix shows the type when debugging. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyPlan(name = "Untitled plan"): Plan {
  return {
    version: 1,
    name,
    source: { kind: "blank", mmPerPx: null, originX: 0, originY: 0, imageWidth: 0, imageHeight: 0, scaleSource: "exact" },
    params: structuredClone(DEFAULT_PARAMS),
    nodes: [],
    walls: [],
    openings: [],
    labels: [],
    priceOverrides: {},
    appearance: { roofColor: "#8e2f2a", wallColor: "#efe8da", floor: "tiles" },
  };
}
