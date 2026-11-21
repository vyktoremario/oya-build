# ADR-0004: react-three-fiber, segment-built walls, simple first-person walk

Status: Accepted · 2026-11-21

## Context
The 3D view is the "wow", but it must rebuild in real time while a wall is dragged and work on a
mid-range Android phone.

## Decision
- **react-three-fiber + drei** inside a client component, loaded with `next/dynamic` (no SSR).
- **Walls as box segments around openings**, not CSG: for each wall, split along its length at opening
  edges; full-height boxes between openings, plus a sill box under windows and a head box above every
  opening. Corners are handled by extending each segment by half the neighbour's thickness at shared nodes (mitre
  lite). Cheap, exact and stable during drags.
- Geometry built by pure functions in `packages/geometry/mesh` (testable: vertex counts, bounding
  boxes), memoised per wall by a hash of its inputs; dragging a node rebuilds only the walls attached to it.
- Materials: flat, slightly textured colours by wall kind; the selected wall is highlighted in both 2D and 3D.
- Roof: hip or gable generated from the footprint's bounding rectangle in v1 (L-shaped footprints get a
  flat-parapet fallback, flagged in the UI). Toggle to hide it.
- **Orbit** by default; **Walk** mode: `PointerLockControls` + WASD at eye height 1.6 m; collision is
  2D circle-vs-segment against wall segments (openings of kind door are gaps). Mobile: orbit + "tap a
  room to stand in it".
- An intro animation (walls rise over ~1.5 s) used in the demo, skipped on edits.

## Consequences
+ No CSG dependency or worker; edits are smooth.
- Complex roofs on irregular footprints are simplified in v1 (and the BoQ roof uses the same
  simplification, so view and cost agree).

## Alternatives considered
- `three-bvh-csg` boolean subtraction: nicer for arbitrary shapes, too slow to redo on every drag.
- Babylon.js: fine, but r3f fits the React app and the hiring signal better.
