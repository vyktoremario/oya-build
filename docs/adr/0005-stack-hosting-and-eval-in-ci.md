# ADR-0005: Next.js on Vercel, no database in v1, eval replay in CI

Status: Accepted · 2026-11-21

## Context
Part-time project, deployed on Vercel, must cost close to nothing when idle, and must not be a
money pit if the extraction endpoint gets traffic.

## Decision
- **pnpm workspace**: `apps/web` (Next.js App Router), `packages/geometry`, `packages/estimate`,
  `packages/schema` (Zod), `eval/`. TypeScript strict everywhere.
- **No database in v1.** Plans persist in localStorage; share links carry the plan as compressed JSON in the URL
  **fragment** (never sent to the server). Uploaded images are processed in memory and not stored. We add
  Postgres when we need accounts or saved projects (v2).
- `/api/extract`: Node runtime, `maxDuration` 120 s, streams progress. **Upstash Redis** (Vercel
  Marketplace) for a per-IP sliding-window limit and a global daily spend counter; when the cap is hit,
  the page offers the sample plan and a "bring your own key" option (key kept in the browser and sent only for
  that request, never logged).
- **CI (GitHub Actions)**: install → typecheck → lint → unit tests → `pnpm eval` (replay mode, no API
  calls, fails if the scores drop more than a set margin from `eval/baseline.json`) → `next build` → one Playwright
  smoke test of the demo path against the built app. Vercel builds previews per PR and production from `main`.
- Live eval (`pnpm eval --live`) is run by hand when the prompt, model or post-processing changes; the results JSON
  is committed and the README table is generated from it (`pnpm eval:report`).

## Consequences
+ Near-zero idle cost; the only variable cost is extractions, capped.
+ Regressions in geometry/scoring caught for free in CI; model regressions caught when we choose to pay.
- No server-side history of user plans (privacy plus, analytics minus).

## Alternatives considered
- Separate NestJS API: more to deploy, and not needed for one route.
- Supabase/Neon from day one: no v1 feature needs it.
