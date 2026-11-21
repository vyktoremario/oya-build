# ADR-0001: A corrected wall-graph `Plan` (in mm) is the single source of truth

Status: Accepted · 2026-11-21

## Context
Extraction from a photo is imperfect. The 3D view, the BoQ and the editor must never disagree, and an
edit (moving a wall) must flow everywhere live. We need one model that is easy to edit, easy to derive
from, and stable enough to version and share.

## Decision
- One `Plan` document, validated by a Zod schema, versioned (`version: 1`) with migrations.
- Integer **millimetres**; plan coordinates are independent of the source image. The image transform
  (`mmPerPx`, offset, rotation) lives in `meta.source` only so the photo can be shown under the editor.
- Topology is a **wall graph**: `nodes {id,x,y}` and `walls {id,a,b,kind,thickness,height?}`. Walls meet
  at shared nodes; T-junctions are real nodes. Drag a node and every connected wall follows.
- `openings` reference a wall by id plus `offset` from node `a`; they are clamped to the wall on edit and
  dropped (with a warning) if the wall gets too short.
- Rooms are **derived** as faces of the planar graph (half-edge face walk). `labels {x,y,name}` name the face
  that contains them. The outer face is the building footprint.
- Everything downstream (`meshes(plan)`, `quantities(plan)`, `cost(quantities, priceBook, overrides)`) is a
  pure function. The UI memoises by wall id.
- The raw extraction is kept as a separate `ExtractionResult` and is never edited; it exists for the
  eval and for "reset to detected".

## Consequences
+ Edits are simple and consistent; undo/redo is just state snapshots of a small document.
+ Share links and eval fixtures are the same format.
+ Pure derivations are trivially unit-testable and run in the browser.
- Face detection must cope with dangling walls and near-misses (handled: dangling edges are ignored for
  rooms but still counted as walls; the editor flags open rooms).
- Curved walls and multi-storey need a v2 schema (deliberately out of scope).

## Alternatives considered
- **Rooms as stored polygons** (each room owns its walls): moving a shared wall means editing two polygons
  in sync, and shared walls get double-counted in quantities. Rejected.
- **Raster/vector of the image as truth**: not editable in engineering terms. Rejected.
