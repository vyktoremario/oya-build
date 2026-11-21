# ADR-0003: A pure, assumption-explicit estimation engine with a dated, editable price book

Status: Accepted · 2026-11-21

## Context
The estimate is the part an engineer or QS will scrutinise. It must use recognisable measurement
conventions, show its working, and never present volatile Naira prices as fact.

## Decision
- `packages/estimate`: `takeoff(plan, params) → Quantity[]`, then `price(quantities, priceBook, overrides) → BoQ`.
  No I/O, no framework; it runs in the browser on every edit (target <5 ms for a typical bungalow).
- Every `Quantity` carries `{ code, group, description, unit, qty, formula, inputs, assumptions[] }`. The
  formula string is rendered in the UI (e.g. `blocks = (Σ L·H − Σ openings) × 10/m² × 1.05 waste`).
- **Measurement conventions**: centreline girth for external walls (girth corrected at corners by
  4 × thickness for a simple rectangle, generalised as the true centreline length of the wall graph); internal walls
  measured between faces; openings deducted from blockwork and plaster; lintel band measured as continuous
  girth; trench excavation on the centreline × footing width × depth.
- **Material derivations**: concrete materials via mix ratio × 1.54 dry-volume factor → cement
  (50 kg bags at 1440 kg/m³), sand and granite (t, using stated bulk densities); mortar per m² of blockwork and
  plaster per m² per face from stated thickness and mix; rebar by bar size and length → kg (d²/162); roof
  timber as a stated rule-of-thumb rate per m² of roof (marked "rule of thumb" in the UI).
- **All constants live in `params` with defaults and a one-line reason**, all editable. Wastage is a
  separate visible factor per material.
- **Price book**: JSON files `price-books/<region>-<yyyy-mm>.json` with `{ item, unit, rate, currency: "NGN",
  source, observedAt, notes }` per line. Prices gathered at build time from cited public listings, and
  labelled "indicative". The BoQ footer always shows the price-book date. Overrides are stored in the plan and
  marked as such in exports.
- **Verification**: hand-worked fixtures (a 4 m × 3 m single room; a 2-bedroom with a T-junction; one with
  a 9"/6" mix) where the expected quantities are computed by hand in the fixture's markdown, in dimension-paper
  form, and asserted to ±0.5% in tests.

## Consequences
+ Traceable numbers; easy for a QS to dispute a single assumption rather than the whole tool.
+ Price changes are a data PR, not a code change.
- The rule-of-thumb items (roof timber, labour %) are visibly approximate; that's intended.
- We are not a QS; the UI and README say "first-pass estimate".

## Alternatives considered
- LLM-generated BoQ: not reproducible or auditable. Rejected outright.
- Hard-coded prices in code: goes stale silently. Rejected.
- Scraping live prices: fragile and of unclear legality; maybe later as a "suggest update" job feeding a PR.
