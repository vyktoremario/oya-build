import type { PlanSpec, Seg } from "./dsl";

/** Rectangle outline as four segments. */
const box = (x0: number, y0: number, x1: number, y1: number): Seg[] => [
  [x0, y0, x1, y0],
  [x1, y0, x1, y1],
  [x1, y1, x0, y1],
  [x0, y1, x0, y0],
];

/** The demo: a three-bedroom bungalow, 13.2 × 10.5 m on the centreline. */
export const bungalow: PlanSpec = {
  name: "Three-bedroom bungalow",
  walls: [
    ...box(0, 0, 13200, 10500),
    [0, 4500, 13200, 4500],
    [4200, 5700, 13200, 5700],
    [4200, 0, 4200, 5700],
    [6000, 0, 6000, 4500],
    [9600, 0, 9600, 4500],
    [7200, 5700, 7200, 10500],
    [10200, 5700, 10200, 10500],
    [10200, 8100, 13200, 8100],
  ],
  openings: [
    { at: [2400, 10500], spec: "door-entrance-steel" },
    { at: [0, 7500], spec: "window-casement-1200" },
    { at: [5400, 10500], spec: "window-casement-1200" },
    { at: [3000, 4500], spec: "door-flush-900" },
    { at: [2100, 0], spec: "window-casement-1200" },
    { at: [0, 2250], spec: "window-casement-1200" },
    { at: [5100, 4500], spec: "door-flush-750" },
    { at: [5100, 0], spec: "window-casement-600" },
    { at: [6900, 4500], spec: "door-flush-900" },
    { at: [7800, 0], spec: "window-casement-1200" },
    { at: [10500, 4500], spec: "door-flush-900" },
    { at: [11400, 0], spec: "window-casement-1200" },
    { at: [13200, 2250], spec: "window-casement-1200" },
    { at: [4200, 5100], spec: "door-flush-900" },
    { at: [7200, 8000], spec: "door-flush-900" },
    { at: [8700, 10500], spec: "window-casement-1200" },
    { at: [11700, 5700], spec: "door-flush-900" },
    { at: [13200, 6900], spec: "window-casement-600" },
    { at: [10200, 9300], spec: "door-flush-750" },
    { at: [13200, 9300], spec: "window-casement-600" },
  ],
  labels: [
    { at: [2100, 2250], name: "Bedroom 1" },
    { at: [5100, 2250], name: "Bath" },
    { at: [7800, 2250], name: "Bedroom 2" },
    { at: [11400, 2250], name: "Bedroom 3" },
    { at: [8700, 5100], name: "Corridor" },
    { at: [2600, 7800], name: "Living room" },
    { at: [8700, 8000], name: "Kitchen" },
    { at: [11700, 6900], name: "Store" },
    { at: [11700, 9300], name: "WC" },
  ],
};

/** A single room, 4.0 × 3.0 m (the worked example). */
export const singleRoom: PlanSpec = {
  name: "Single room 4.0 × 3.0 m",
  walls: box(0, 0, 4000, 3000),
  openings: [
    { at: [2000, 3000], spec: "door-entrance-steel" },
    { at: [2000, 0], spec: "window-casement-1200" },
  ],
  labels: [{ at: [2000, 1500], name: "Shop" }],
};

/** Self-contained room with bath ("self-con"), 6.0 × 4.2 m. */
export const selfCon: PlanSpec = {
  name: "Self-contained room 6.0 × 4.2 m",
  walls: [...box(0, 0, 6000, 4200), [3900, 0, 3900, 4200], [3900, 2400, 6000, 2400]],
  openings: [
    { at: [1500, 4200], spec: "door-entrance-steel" },
    { at: [0, 2100], spec: "window-casement-1200" },
    { at: [1950, 0], spec: "window-casement-1200" },
    { at: [3900, 3300], spec: "door-flush-900" },
    { at: [4950, 2400], spec: "door-flush-750" },
    { at: [4950, 0], spec: "window-casement-600" },
    { at: [6000, 3300], spec: "window-casement-1200" },
  ],
  labels: [
    { at: [1950, 2100], name: "Room" },
    { at: [4950, 1200], name: "Toilet/Bath" },
    { at: [4950, 3300], name: "Kitchenette" },
  ],
};

/** Two-bedroom flat, 10.8 × 8.4 m. */
export const twoBed: PlanSpec = {
  name: "Two-bedroom flat 10.8 × 8.4 m",
  walls: [
    ...box(0, 0, 10800, 8400),
    [0, 4200, 10800, 4200],
    [3900, 0, 3900, 4200],
    [5700, 0, 5700, 4200],
    [6900, 4200, 6900, 8400],
    [6900, 6300, 10800, 6300],
  ],
  openings: [
    { at: [3000, 8400], spec: "door-entrance-steel" },
    { at: [0, 6300], spec: "window-casement-1200" },
    { at: [1950, 0], spec: "window-casement-1200" },
    { at: [8250, 0], spec: "window-casement-1200" },
    { at: [4800, 0], spec: "window-casement-600" },
    { at: [10800, 7350], spec: "window-casement-600" },
    { at: [10800, 5250], spec: "window-casement-1200" },
    { at: [1950, 4200], spec: "door-flush-900" },
    { at: [4800, 4200], spec: "door-flush-750" },
    { at: [6300, 4200], spec: "door-flush-900" },
    { at: [6900, 5250], spec: "door-flush-900" },
    { at: [6900, 7350], spec: "door-flush-750" },
  ],
  labels: [
    { at: [1950, 2100], name: "Bedroom 1" },
    { at: [4800, 2100], name: "Bath" },
    { at: [8250, 2100], name: "Bedroom 2" },
    { at: [3450, 6300], name: "Sitting Room" },
    { at: [8850, 5250], name: "Kitchen" },
    { at: [8850, 7350], name: "Store" },
  ],
};

/** L-shaped bungalow: 12.0 × 6.0 m main block with a 4.8 × 4.2 m wing. */
export const lShape: PlanSpec = {
  name: "L-shaped two-bedroom bungalow",
  walls: [
    [0, 0, 12000, 0],
    [12000, 0, 12000, 10200],
    [12000, 10200, 7200, 10200],
    [7200, 10200, 7200, 6000],
    [7200, 6000, 0, 6000],
    [0, 6000, 0, 0],
    [4200, 0, 4200, 6000],
    [7200, 0, 7200, 6000],
    [7200, 3600, 12000, 3600],
    [7200, 6000, 12000, 6000],
    [9600, 6000, 9600, 10200],
  ],
  openings: [
    { at: [2100, 6000], spec: "door-entrance-steel" },
    { at: [0, 3000], spec: "window-casement-1200" },
    { at: [2100, 0], spec: "window-casement-1200" },
    { at: [5700, 0], spec: "window-casement-1200" },
    { at: [9600, 0], spec: "window-casement-1200" },
    { at: [12000, 1800], spec: "window-casement-1200" },
    { at: [12000, 8100], spec: "window-casement-600" },
    { at: [8400, 10200], spec: "window-casement-1200" },
    { at: [4200, 3000], spec: "door-flush-900" },
    { at: [7200, 4800], spec: "door-flush-900" },
    { at: [8400, 3600], spec: "door-flush-900" },
    { at: [8400, 6000], spec: "door-flush-900" },
    { at: [9600, 8100], spec: "door-flush-750" },
  ],
  labels: [
    { at: [2100, 3000], name: "Living Room" },
    { at: [5700, 3000], name: "Dining" },
    { at: [9600, 1800], name: "Bedroom 1" },
    { at: [9600, 4800], name: "Passage" },
    { at: [8400, 8100], name: "Bedroom 2" },
    { at: [10800, 8100], name: "Bath" },
  ],
};

/** Four-bedroom bungalow, 16.8 × 12.0 m, with a central corridor. */
export const fourBed: PlanSpec = {
  name: "Four-bedroom bungalow 16.8 × 12.0 m",
  walls: [
    ...box(0, 0, 16800, 12000),
    [0, 4500, 16800, 4500],
    [0, 5700, 16800, 5700],
    [4200, 0, 4200, 4500],
    [6000, 0, 6000, 4500],
    [10200, 0, 10200, 4500],
    [12600, 0, 12600, 4500],
    [7200, 5700, 7200, 12000],
    [11400, 5700, 11400, 12000],
    [11400, 9000, 16800, 9000],
    [14100, 9000, 14100, 12000],
  ],
  openings: [
    { at: [3600, 12000], spec: "door-entrance-steel" },
    { at: [0, 8850], spec: "window-casement-1200" },
    { at: [1800, 12000], spec: "window-casement-1200" },
    { at: [5400, 12000], spec: "window-casement-1200" },
    { at: [2100, 0], spec: "window-casement-1200" },
    { at: [5100, 0], spec: "window-casement-600" },
    { at: [8100, 0], spec: "window-casement-1200" },
    { at: [11400, 0], spec: "window-casement-600" },
    { at: [14700, 0], spec: "window-casement-1200" },
    { at: [16800, 2250], spec: "window-casement-1200" },
    { at: [16800, 7350], spec: "window-casement-1200" },
    { at: [9300, 12000], spec: "window-casement-1200" },
    { at: [12750, 12000], spec: "window-casement-600" },
    { at: [15450, 12000], spec: "window-casement-600" },
    { at: [2100, 4500], spec: "door-flush-900" },
    { at: [5100, 4500], spec: "door-flush-750" },
    { at: [8100, 4500], spec: "door-flush-900" },
    { at: [11400, 4500], spec: "door-flush-750" },
    { at: [14700, 4500], spec: "door-flush-900" },
    { at: [3600, 5700], spec: "door-flush-900" },
    { at: [9300, 5700], spec: "door-flush-900" },
    { at: [14100, 5700], spec: "door-flush-900" },
    { at: [12750, 9000], spec: "door-flush-750" },
    { at: [15450, 9000], spec: "door-flush-750" },
  ],
  labels: [
    { at: [2100, 2250], name: "Bedroom 1" },
    { at: [5100, 2250], name: "Bath 1" },
    { at: [8100, 2250], name: "Bedroom 2" },
    { at: [11400, 2250], name: "Bath 2" },
    { at: [14700, 2250], name: "Bedroom 3" },
    { at: [8400, 5100], name: "Corridor" },
    { at: [3600, 8850], name: "Living Room" },
    { at: [9300, 8850], name: "Bedroom 4" },
    { at: [14100, 7350], name: "Kitchen" },
    { at: [12750, 10500], name: "Store" },
    { at: [15450, 10500], name: "Laundry" },
  ],
};

/** Shop with a back store and office, 7.2 × 9.0 m. */
export const shop: PlanSpec = {
  name: "Shop with store and office 7.2 × 9.0 m",
  walls: [...box(0, 0, 7200, 9000), [0, 5400, 7200, 5400], [3600, 5400, 3600, 9000]],
  openings: [
    { at: [3600, 0], spec: "door-entrance-steel" },
    { at: [1500, 0], spec: "window-casement-1200" },
    { at: [5700, 0], spec: "window-casement-1200" },
    { at: [1800, 5400], spec: "door-flush-900" },
    { at: [5400, 5400], spec: "door-flush-900" },
    { at: [0, 7200], spec: "window-casement-600" },
    { at: [7200, 7200], spec: "window-casement-1200" },
  ],
  labels: [
    { at: [3600, 2700], name: "Shop Floor" },
    { at: [1800, 7200], name: "Store" },
    { at: [5400, 7200], name: "Office" },
  ],
};

/** Boys' quarters: two rooms and a shared toilet in a row, 10.2 × 3.6 m. */
export const boysQuarters: PlanSpec = {
  name: "Boys' quarters 10.2 × 3.6 m",
  walls: [...box(0, 0, 10200, 3600), [3900, 0, 3900, 3600], [6300, 0, 6300, 3600]],
  openings: [
    { at: [1950, 3600], spec: "door-flush-900" },
    { at: [5100, 3600], spec: "door-flush-750" },
    { at: [8250, 3600], spec: "door-flush-900" },
    { at: [1950, 0], spec: "window-casement-1200" },
    { at: [5100, 0], spec: "window-casement-600" },
    { at: [8250, 0], spec: "window-casement-1200" },
  ],
  labels: [
    { at: [1950, 1800], name: "Room 1" },
    { at: [5100, 1800], name: "Toilet" },
    { at: [8250, 1800], name: "Room 2" },
  ],
};

export interface EvalCaseDef {
  id: string;
  spec: PlanSpec;
  style: "clean" | "sketch";
  seed: number;
  dimensionUnits?: "mm" | "m";
  rotateDeg?: number;
}

/** The synthetic evaluation set: every plan drawn twice, clean and as a sketch. */
export const SYNTHETIC_CASES: EvalCaseDef[] = (
  [
    ["single-room", singleRoom],
    ["self-con", selfCon],
    ["two-bed", twoBed],
    ["l-shape", lShape],
    ["three-bed", bungalow],
    ["four-bed", fourBed],
    ["shop", shop],
    ["boys-quarters", boysQuarters],
  ] as const
).flatMap(([id, spec], i) => [
  { id: `clean-${id}`, spec, style: "clean" as const, seed: 100 + i, dimensionUnits: i % 3 === 2 ? ("m" as const) : ("mm" as const) },
  { id: `sketch-${id}`, spec, style: "sketch" as const, seed: 200 + i, dimensionUnits: i % 2 ? ("m" as const) : ("mm" as const), rotateDeg: ((i % 5) - 2) * 0.8 },
]);
