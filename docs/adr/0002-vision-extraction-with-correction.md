# ADR-0002: Extraction = vision model (structured output) → deterministic clean-up → mandatory human correction

Status: Accepted · 2026-11-21

## Context
Inputs range from clean architectural prints to pencil sketches on graph paper, photographed at an angle.
Classic CV (Hough lines, OCR) is brittle on sketches; a vision LLM reads intent (what is a door swing,
which number is a dimension) but is imprecise with coordinates. Users must be able to fix anything.

## Decision
1. **Client** downsizes to a long edge of ≤1568 px (the useful vision resolution; it keeps tokens and latency down) and
   sends JPEG to `POST /api/extract`.
2. **Model**: Claude Opus 5.5 via the Anthropic TypeScript SDK, adaptive thinking, effort `high`
   (to be tuned against the eval: we will also try `medium`, and Sonnet 5.5 at its default, and pick on measured
   F1 per dollar). Structured outputs (`output_config.format` with a JSON schema generated from Zod)
   guarantee parseable output. Server-side refusal fallback enabled. Responses streamed; the route
   streams progress events to the browser.
3. **Output contract is raw, not clever**: pixel-space line segments for each drawn wall face or
   centreline, openings (kind, host segment, position, width in px), room label text + position,
   dimension annotations (text, the two pixel endpoints it spans, parsed mm), and a confidence per
   item. We ask the model to *describe what is drawn*, not to produce a final building.
4. **Deterministic post-processing** (`packages/geometry/extract`), fully unit-tested:
   cluster endpoints → split at T-junctions → square near-axis lines (±4°) → merge parallel face pairs
   into centreline + thickness → scale = median(mm/px) over dimension annotations (outliers >15% from the median
   rejected) → snap to 50 mm → classify external vs internal walls by the outer face.
5. **Correction is a required step**, not an optional one: the editor opens on the extracted plan over the photo, with
   low-confidence items in amber and a scale banner when the scale was guessed or missing.
6. Cost and abuse control: Upstash rate limit (per IP: 5/hour), a global daily spend cap computed from
   `usage` (ADR-0005), 8 MB upload limit, images not stored.

## Consequences
+ Model weaknesses (coordinate jitter) are absorbed by tested geometry code; the model is used for
  what it is good at (semantics, reading handwriting).
+ The eval can score the model and post-processing separately (raw recordings are replayable).
- Per-extraction cost and 20–60 s latency; mitigated by the pre-recorded demo sample and progress UI.
- Perspective-distorted photos: v1 asks the user to shoot top-down; a 4-corner perspective correction
  in the browser is a stretch goal for week 7–8.

## Alternatives considered
- **OpenCV/Hough + OCR**: good on clean prints, poor on sketches, lots of tuning. May come back as a
  *refinement* step for prints if the eval shows coordinate error dominates.
- **Model returns final `Plan` directly**: harder to debug, mixes semantic and geometric error, and makes
  the eval less informative.
- **Fine-tuned floor-plan segmentation model (e.g. trained on CubiCasa5k)**: better coordinates on prints, but
  dataset licensing, GPU hosting and poor sketch coverage don't fit 6–8 weeks.
