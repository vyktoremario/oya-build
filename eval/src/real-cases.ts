import type { PlanSpec, Seg } from "./dsl";

/**
 * Ground truth for real hand sketches (phone photos), entered by hand from the dimensions written
 * on each drawing; positions that aren't dimensioned were read off the drawing at its own scale
 * (about ±300 mm). Images are in eval/cases/real-sketch-N (from Unsplash, Unsplash License).
 */

const box = (x0: number, y0: number, x1: number, y1: number): Seg[] => [
  [x0, y0, x1, y0],
  [x1, y0, x1, y1],
  [x1, y1, x0, y1],
  [x0, y1, x0, y0],
];

/** Blue-marker sketch: two bedrooms, two toilets, kitchen/dining, living area, terrace. 3 + 3 + 2 m wide. */
export const realSketch1: PlanSpec = {
  name: "Real sketch 1: two-bedroom with terrace",
  walls: [
    [0, 0, 8000, 0],
    [8000, 0, 8000, 4000],
    [8000, 4000, 6000, 4000],
    [6000, 4000, 6000, 7000],
    [6000, 7000, 3000, 7000],
    [3000, 7000, 3000, 8500],
    [3000, 8500, 0, 8500],
    [0, 8500, 0, 0],
    [0, 3000, 3000, 3000],
    [3000, 0, 3000, 7000],
    [4250, 0, 4250, 2000],
    [3000, 2000, 4250, 2000],
    [0, 5000, 3000, 5000],
    [1500, 3000, 1500, 5000],
    [4250, 4000, 6000, 4000],
  ],
  openings: [
    { at: [3000, 2600], spec: "door-flush-900" },
    { at: [3800, 2000], spec: "door-flush-750" },
    { at: [950, 5000], spec: "door-flush-750" },
    { at: [2450, 5000], spec: "door-flush-900" },
    { at: [7000, 4000], spec: "door-entrance-steel" },
    { at: [3700, 7000], spec: "door-entrance-steel" },
    { at: [1750, 0], spec: "window-casement-1200" },
    { at: [0, 1700], spec: "window-casement-1200" },
    { at: [5800, 0], spec: "window-casement-1200" },
    { at: [8000, 2700], spec: "window-casement-1200" },
    { at: [6000, 5500], spec: "window-casement-1200" },
    { at: [5000, 7000], spec: "window-casement-1200" },
    { at: [0, 7000], spec: "window-casement-1200" },
    { at: [1800, 8500], spec: "window-casement-1200" },
    { at: [3600, 0], spec: "window-casement-600" },
    { at: [0, 3900], spec: "window-casement-600" },
  ],
  labels: [
    { at: [1500, 1500], name: "Bedroom 1" },
    { at: [3600, 1000], name: "Toilet" },
    { at: [6200, 2000], name: "Kitchen" },
    { at: [750, 4000], name: "Toilet" },
    { at: [2250, 4000], name: "Storage" },
    { at: [1500, 6700], name: "Master Bedroom" },
    { at: [4500, 5500], name: "Living Area" },
  ],
};

/**
 * Black-marker concept sketch, 14.0 × 8.0 m (bays 2500/3000/2000/4500/2000; 4000+4000 left,
 * 5000+3000 right). Walls drawn as heavy strokes with glazing between; the terrace above the
 * main block has posts only and is not part of the building outline. No room names are written.
 */
export const realSketch2: PlanSpec = {
  name: "Real sketch 2: concept plan 14.0 × 8.0 m",
  walls: [
    ...box(0, 0, 14000, 8000),
    [0, 4000, 2500, 4000],
    [2500, 3300, 2500, 8000],
    [10500, 0, 10500, 4000],
    [4600, 5000, 10500, 5000],
    [10500, 5000, 10500, 6300],
    [12000, 5000, 14000, 5000],
    [12000, 4000, 12000, 8000],
    [7500, 5000, 7500, 8000],
    [5500, 5000, 5500, 8000],
  ],
  openings: [
    { at: [4100, 8000], spec: "door-entrance-steel" },
    { at: [5500, 6500], spec: "door-flush-900" },
    { at: [2500, 4600], spec: "door-flush-900" },
    { at: [12000, 5600], spec: "door-flush-750" },
    { at: [2100, 0], spec: "window-casement-1200" },
    { at: [8600, 0], spec: "window-casement-1200" },
    { at: [12300, 0], spec: "window-casement-1200" },
    { at: [14000, 1700], spec: "window-casement-1200" },
    { at: [0, 1700], spec: "window-casement-1200" },
    { at: [1200, 8000], spec: "window-casement-1200" },
    { at: [6500, 8000], spec: "window-casement-1200" },
    { at: [9000, 8000], spec: "window-casement-1200" },
    { at: [12900, 8000], spec: "window-casement-1200" },
  ],
  labels: [],
};

/**
 * Pencil "measured drawing" of a single room on a drawing board: 3025 × 3185 mm internal, with a
 * 945 × 515 recess at the top right and a wall continuing off the left edge. Internal-face
 * dimensions are used as centrelines (the drawn walls are ~120 mm thick).
 */
export const realSketch3: PlanSpec = {
  name: "Real sketch 3: measured drawing of one room",
  walls: [
    [0, 0, 2080, 0],
    [2080, 0, 2080, -515],
    [2080, -515, 3025, -515],
    [3025, -515, 3025, 3185],
    [3025, 3185, 0, 3185],
    [0, 3185, 0, 0],
    [-600, 1390, 0, 1390],
  ],
  openings: [
    { at: [3025, 1060], spec: "window-casement-1200" },
    { at: [3025, 2560], spec: "door-flush-900" },
    { at: [445, 3185], spec: "door-entrance-steel" },
    { at: [0, 970], spec: "door-flush-750" },
  ],
  labels: [],
};

export const REAL_CASES = [
  { id: "real-sketch-1", spec: realSketch1, notes: "Blue marker on paper, phone photo. Dimensions in metres (3M, 2M, 1.5M…)." },
  { id: "real-sketch-2", spec: realSketch2, notes: "Black marker concept sketch with furniture and hatching; dimensions in mm; overall width written as \"1400\" (a slip for 14000)." },
  { id: "real-sketch-3", spec: realSketch3, notes: "Pencil measured drawing photographed with set squares, ruler and pencils in frame; dimensions in mm." },
] as const;
