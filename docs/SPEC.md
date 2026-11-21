# Oya Build — v1 spec

Status: **approved 2026-11-21** · 2026-11-21 · Author: Victor

> Photograph a floor plan. Walk through it in 3D. See what the carcass costs in Naira.
> Move a wall and watch both change.

## 1. Who it's for and why it's different

A Nigerian homeowner, small developer or site engineer with a plan on paper (an architect's print or
a sketch on graph paper) who wants a first-pass bill of quantities (BoQ) before talking to a
quantity surveyor (QS). It is a **first-pass estimate tool, not a QS replacement**, and the UI says so.

What makes it opinionated:
- **Nigerian construction defaults**: sandcrete hollow blocks (9" external, 6" internal), strip
  foundations, a continuous lintel band, long-span aluminium roofing on a timber hip roof, and prices
  in ₦.
- **Quantities a QS would recognise**: centreline method, stated wastage, mix ratios, and
  every number traceable to a formula and an assumption you can read and change.
- **Prices are data, not truth**: a dated price book with sources. Every BoQ shows the price-book date,
  and the user can override any rate.

## 2. The 15-second demo

| t | What you see |
|---|---|
| 0s | Landing page: one photo of a hand-drawn 3-bedroom bungalow sketch, button **"Build this"** (plus "Upload your own"). |
| 2s | The sketch fades into a clean 2D plan traced over it: walls, doors and windows highlighted. |
| 5s | Walls extrude up into 3D, the roof drops on and the camera orbits. |
| 8s | The BoQ panel counts up: blocks 4,8xx · cement 3xx bags · … · **Total ₦xx.x m** *(prices as of <date>)*. |
| 11s | Drag the kitchen wall 1 m: the 3D model and the total update together (Δ ₦ shown). |
| 14s | Press **Walk**: first-person view through the front door. |

The sample sketch uses a **pre-recorded extraction**, so the demo is instant, free and deterministic.
"Upload your own" runs the live model. The README GIF records exactly this path.

## 3. User flow (v1)

1. **Upload** a photo or PDF page (client downsizes it to a long edge of ≤1568 px before upload).
2. **Extract** (~20–60 s, with streamed progress): the vision model returns walls, openings, room labels and
   dimension annotations in image pixels; deterministic clean-up snaps, merges and squares them; the scale
   comes from the dimension annotations.
3. **Correct** (the human step, always shown): a 2D editor overlaid on the photo. Fix the scale
   ("this line is 3600 mm"), drag wall nodes, add or delete walls, place or move doors and windows, rename rooms.
   Low-confidence items are flagged in amber. **The corrected plan is the source of truth** (ADR-0001).
4. **Explore**: split view with the 2D plan, the 3D model (orbit or walk) and the BoQ. All three update live on every edit.
5. **Adjust**: building parameters (wall height, foundation depth, roof type and pitch, block sizes) and the
   price book (override any rate). Assumptions are listed next to the BoQ.
6. **Export/share**: a BoQ as CSV and a print-friendly page (PDF via the browser), and a share link that encodes the plan.

## 4. Geometry and data model (summary; details in ADR-0001)

- Units: **integer millimetres**, origin at the top-left of the plan, y down (as in the image).
- `Plan = { version, meta, params, nodes[], walls[], openings[], labels[], priceOverrides }`
- `walls` are edges between `nodes` (a wall graph), each with `kind: external | internal`, a
  `thickness` (225 or 150 mm) and an optional `height`.
- `openings` sit **on a wall**: `{ wallId, offset (along the wall from the start node), width, height, sill, kind: door | window, specId }`.
  Moving a wall moves its openings with it.
- **Rooms are derived**, not stored: the enclosed faces of the planar wall graph. A `label` point names
  the face that contains it. Footprint = outer face, which drives the slab, roof and foundation.
- `params`: storey height, foundation width/depth, DPC courses, roof type/pitch/overhang, mixes, and wastage.
  Every one has a default and a short explanation.
- Everything else (3D meshes, quantities, costs) is a **pure function of `Plan` + `PriceBook`**.

## 5. Extraction (summary; details in ADR-0002)

- Claude Opus 5.5 (vision) with **structured outputs** (JSON schema generated from the same Zod
  types), returning *raw* pixel-space geometry plus per-item confidence and any dimension strings
  it can read ("3600", "12'-0\"").
- Deterministic post-processing (tested on its own): endpoint clustering, T-junction splitting,
  near-axis squaring, duplicate/parallel-line merging (both faces of a drawn wall → one centreline + thickness),
  and scale estimation (median mm/px across dimension annotations; if there are none, the user must set one).
- The raw model output is kept alongside the corrected plan, so we can measure what the human had to fix.

## 6. Estimation engine (summary; details in ADR-0003)

Single-storey, carcass + roofing + openings. Each line = `quantity × rate`, carries the formula that
produced it, and is grouped as a QS would group it:

| Group | Items (unit) |
|---|---|
| Substructure | Excavation of foundation trench (m³) · blinding / strip footing concrete (m³) · foundation blockwork (9" solid / filled, nr) · hardcore fill (m³) · DPM (m²) · oversite concrete slab (m³) |
| Superstructure | 9" and 6" hollow sandcrete blocks (nr) · mortar → cement (bags) + sharp sand (t) · lintel band concrete (m³) + rebar (kg by bar size) + binding wire |
| Finishes (structural only) | Plaster/render both faces (m²) → cement + plaster sand · floor screed (m²) |
| Roof | Roof area from footprint + overhang ÷ cos(pitch) (m²) · long-span aluminium sheets (m²) · timber members (lengths, by rule of thumb per m², stated) · fascia (m) · ceiling (m²) |
| Openings | Doors and windows by spec (nr) |
| Labour | Optional, **% of materials** (default stated, editable). We won't pretend to know labour rates. |

Concrete materials come from mix ratio × dry-volume factor (1.54) → cement bags (50 kg), sand and granite (t).
Blockwork uses the centreline method, with openings deducted. Wastage is a separate, visible factor on each material.
The engine is **verified against hand calculations** (worked examples in `packages/estimate/test/fixtures`,
written in the form a QS would check: dimension paper style "timesing / dimension / squaring").

**Price book**: `price-books/abuja-2026-11.json`: one rate per item, plus `unit`, `source`, `observedAt`
and `notes`. Prices are gathered from public supplier/market listings at build time, with every source cited. The UI
shows "Prices as of Nov 2026, Abuja. Edit any rate." Overrides are stored in the plan.

## 7. 3D and walkthrough (summary; details in ADR-0004)

react-three-fiber + drei. Walls are built as box **segments around openings** (no CSG), with simple
door/window frames, a floor slab, an optional roof (toggle) and a room-label sprite per room. Orbit mode by default; **Walk** mode
uses pointer-lock + WASD with 2D circle-vs-segment collision against the wall graph (doors are passable).
Mobile gets orbit plus a tap-to-walk fallback. Meshes are memoised per wall, so dragging a node rebuilds only the touched walls.

## 8. Evaluation set (how accuracy numbers are produced)

Nothing in the README is a claimed number unless it came from `pnpm eval` and was committed under
`eval/results/`.

**Cases** (`eval/cases/<id>/`: `image.(jpg|png)`, `truth.plan.json`, `source.md` with origin + licence):
- **Synthetic-clean (≈8)**: plans authored as `Plan` JSON and rendered to PNG by our own renderer.
  Exact ground truth. Tests the pipeline, but flatters it.
- **Synthetic sketch-style (≈6)**: the same kind of plans rendered with pencil wobble, uneven
  line weight, handwritten-looking labels, paper texture and a slight perspective skew. Exact truth;
  labelled "synthetic" in every report.
- **Real hand sketches (2–3, drawn by Victor, provided during the build)**: they don't need to follow
  any dimensions of mine. Requirements: (a) the dimensions are written on the sketch (otherwise there is no ground truth for
  scale), (b) we may commit them to a public repo (own drawings, or an explicit permissive licence), (c)
  one plan per image. Truth is entered by hand in the editor from the written dimensions, then checked
  twice (sum of room dimensions = overall dimension). Where written dimensions don't add up, that's
  noted in `source.md` and the case is scored on the overall dimensions only.
- **Printed/architectural (≈4)**: openly licensed plans with dimension strings; truth entered the same way.

**Metrics** (per case, then aggregated by category, and reported with n so nobody over-reads them):
- Scale error (% of true mm/px).
- Wall precision / recall / F1, length-weighted: points every 100 mm along each centreline count as
  found when within 300 mm of the other plan's walls. *(Changed during the build from endpoint
  matching: walls split at different junctions in truth and extraction, so endpoint matching
  penalised correct geometry.)*
- Opening F1: same kind, centre within 500 mm, one-to-one greedy matching.
- Total floor-area error and room counts.
- **Estimate error**: |BoQ total(extracted, uncorrected) − BoQ total(truth)| / BoQ total(truth), plus
  per-group error. This measures *extraction-induced* error with the same engine and prices.
- Cost and latency per extraction (from `usage` and wall clock).
- *Deferred to v2*: correction effort (editor operations needed to fix a plan).
- As built, the real sketches are 3 drawings Victor supplied; they are scored locally and not committed
  (`eval/cases-local/`, git-ignored) because the images may not be ours to redistribute.

What we **don't** measure in v1, and say so: the error of the engine against a real QS-prepared BoQ
or a real build cost. If you can get one real QS BoQ for a simple bungalow, it becomes case #1 of
`eval/external/` and the README reports it as a single data point.

**Harness**: `pnpm eval --live` calls the model (costs money, run by hand) and records the raw
outputs to `eval/recordings/`; `pnpm eval` replays the recordings and scores them (free, runs in CI, so
regressions in post-processing or scoring show up without API spend).

## 9. Stack and hosting (details in ADR-0005)

pnpm workspace · TypeScript strict · Next.js (App Router) on **Vercel** · `packages/geometry`,
`packages/estimate` (pure, framework-free, the same code runs in the browser for live updates and in tests)
· Zod for the plan schema and the model's output schema · zustand + zundo (undo/redo) · react-three-fiber/drei ·
Anthropic TypeScript SDK in a Node route handler, with streamed progress · Upstash Redis rate limiting plus a
daily spend cap on `/api/extract` (see §11.4) · Vitest (unit), Playwright (one e2e demo-path smoke test) · GitHub
Actions CI (typecheck, lint, test, eval-replay, build) · Vercel preview per PR, production on `main`.

**No database in v1.** Plans live in the browser (localStorage) and in share links (compressed
JSON in the URL fragment, so it never reaches the server). Uploaded images aren't stored server-side.

## 10. v1 scope and plan (≈6–8 weeks part-time, ~10–12 h/week)

| Week | Deliverable |
|---|---|
| 1 | Repo, CI, `geometry` (wall graph, faces, footprint) + `estimate` engine with hand-checked fixtures |
| 2 | 2D editor (drag/add/split/delete walls, openings, scale tool, undo) + live 3D (orbit) |
| 3 | Extraction route + prompt + post-processing + correction overlay; demo sample recorded |
| 4 | Eval cases + harness + first honest numbers; iterate the prompt/post-processing once |
| 5 | Price book research (cited), BoQ UI with formulas and assumptions, CSV/print export |
| 6 | Walk mode, roof, landing page and the 15-s demo, deploy, README + GIF |
| 7–8 | Buffer: improve on whatever the eval says is worst; hand-sketch cases |

**In v1**: single storey, straight walls, rectangular/orthogonal-ish plans (diagonals allowed but not
optimised), one region's price book, English.

**Out of v1**: multi-storey, curved walls, structural design (bar sizes are standard details, not
calculated), MEP, full finishes (tiles, paint), accounts, cloud saves, multiple regions, mobile walk
controls beyond the basics.

## 11. Decisions (answered 2026-11-21)

1. **Price region**: price books are per **city**; v1 ships **Abuja** with a region selector ready for
   Lagos / Port Harcourt as data-only additions. (A national average would be wrong everywhere: sand,
   granite and haulage vary a lot by city.)
2. **Defaults confirmed**: hip roof with long-span aluminium (0.55 mm), 9" external and 6" internal
   sandcrete, 3.0 m wall height, 675×225 mm strip footing at 900 mm depth.
3. **Eval sketches**: synthetic sketch-style plus 2–3 real hand sketches drawn by Victor (rules in §8).
4. **API billing**: a Claude subscription can't be used by a deployed app, so the app uses a
   Console API key (prepaid credit, separate from the subscription). Plan: ~$10 of credit, a Console
   monthly spend limit as a hard backstop, and an in-app cap of **$2/day** computed from each response's
   token `usage` × the published per-token price, stored in Upstash Redis. When it's hit: the sample
   plans plus "bring your own key". The real cost per extraction is measured by the eval and reported.
5. **Name**: **Oya Build** ("oya" = come on, let's go). Repo `oya-build`, deploy to
   `oya-build.vercel.app` unless a domain comes later.
