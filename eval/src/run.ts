/**
 * Evaluation harness.
 *   pnpm eval                      replay recorded model outputs and score them (free; runs in CI)
 *   pnpm eval:live                 call the model for every case, record outputs, then score (costs money)
 *   pnpm eval -- --only <text>     limit to cases whose id contains <text>
 *   pnpm eval -- --write-baseline  save current medians as the CI baseline
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ExtractionRecording, ExtractionRecordingSchema, PlanSchema } from "@oya/schema";
import { postProcess } from "@oya/geometry";
import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import { type CaseScore, scoreCase } from "./score";

const root = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2);
const live = args.includes("--live");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
const writeBaseline = args.includes("--write-baseline");

interface CaseMeta {
  category: string;
  width: number;
  height: number;
  /** True scale of the image, if known exactly (synthetic cases). */
  mmPerPx: number | null;
}

const casesDir = join(root, "cases");
const recDir = join(root, "recordings");
mkdirSync(recDir, { recursive: true });

const ids = readdirSync(casesDir)
  .filter((d) => existsSync(join(casesDir, d, "truth.plan.json")) && (!only || d.includes(only)))
  .sort();

async function record(id: string, meta: CaseMeta): Promise<ExtractionRecording> {
  const { extractRaw } = await import("@oya/extract");
  const img = readdirSync(join(casesDir, id)).find((f) => /^image\.(jpe?g|png)$/.test(f))!;
  const data = readFileSync(join(casesDir, id, img)).toString("base64");
  const rec = await extractRaw({
    imageBase64: data,
    mediaType: img.endsWith("png") ? "image/png" : "image/jpeg",
    width: meta.width,
    height: meta.height,
    model: process.env.OYA_MODEL,
    effort: (process.env.OYA_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" | undefined) ?? undefined,
  });
  writeFileSync(join(recDir, `${id}.json`), JSON.stringify(rec, null, 1));
  return rec;
}

interface Row extends Partial<CaseScore> {
  id: string;
  category: string;
  model: string;
  costUsd: number;
  latencyS: number;
  error?: string;
}

const rows: Row[] = [];
for (const id of ids) {
  const meta = JSON.parse(readFileSync(join(casesDir, id, "meta.json"), "utf8")) as CaseMeta;
  const truth = PlanSchema.parse(JSON.parse(readFileSync(join(casesDir, id, "truth.plan.json"), "utf8")));
  let rec: ExtractionRecording | null = null;
  try {
    if (live) {
      process.stdout.write(`extracting ${id}… `);
      rec = await record(id, meta);
      console.log(`${(rec.meta.latencyMs / 1000).toFixed(0)} s, $${rec.meta.costUsd.toFixed(3)}`);
    } else if (existsSync(join(recDir, `${id}.json`))) {
      rec = ExtractionRecordingSchema.parse(JSON.parse(readFileSync(join(recDir, `${id}.json`), "utf8")));
    }
  } catch (e) {
    console.log(`failed: ${(e as Error).message}`);
    rows.push({ id, category: meta.category, model: "-", costUsd: 0, latencyS: 0, error: (e as Error).message });
    continue;
  }
  if (!rec) {
    console.log(`skip ${id}: no recording (run pnpm eval:live)`);
    continue;
  }
  const out = postProcess(rec.raw, { openingSpecs: DEFAULT_PRICE_BOOK.openingSpecs });
  const s = scoreCase(truth, out.plan, meta.mmPerPx);
  rows.push({ id, category: meta.category, model: rec.meta.model, costUsd: rec.meta.costUsd, latencyS: rec.meta.latencyMs / 1000, ...s });
}

const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const scored = rows.filter((r) => !r.error) as (Row & CaseScore)[];
const categories = [...new Set(scored.map((r) => r.category))].sort().map((name) => {
  const rs = scored.filter((r) => r.category === name);
  return {
    name,
    n: rs.length,
    wallF1: median(rs.map((r) => r.wallF1)),
    openingF1: median(rs.map((r) => r.openingF1)),
    scaleErrorPct: median(rs.map((r) => r.scaleErrorPct ?? NaN)),
    areaErrorPct: median(rs.map((r) => r.areaErrorPct)),
    estimateErrorPct: median(rs.map((r) => r.estimateErrorPct)),
    estimateErrorMaxPct: Math.max(...rs.map((r) => r.estimateErrorPct)),
    costUsd: median(rs.map((r) => r.costUsd)),
    latencyS: median(rs.map((r) => r.latencyS)),
  };
});

const fmt = (x: number | null | undefined, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? "-" : x.toFixed(d));
console.log("\nper case:");
console.table(
  rows.map((r) => ({
    id: r.id,
    wallF1: fmt(r.wallF1),
    openingF1: fmt(r.openingF1),
    "scale%": fmt(r.scaleErrorPct, 1),
    "area%": fmt(r.areaErrorPct, 1),
    "estimate%": fmt(r.estimateErrorPct, 1),
    rooms: r.error ? "error" : `${r.roomsFound}/${r.roomsTrue}`,
    usd: fmt(r.costUsd, 3),
    s: fmt(r.latencyS, 0),
  })),
);
console.log("medians by category:");
console.table(categories);

if (!scored.length) {
  console.log("Nothing scored.");
  process.exit(0);
}

const result = { ranAt: new Date().toISOString(), mode: live ? "live" : "replay", model: [...new Set(scored.map((r) => r.model))].join(", "), cases: rows, categories };
if (live && !only) {
  const resDir = join(root, "results");
  mkdirSync(resDir, { recursive: true });
  writeFileSync(join(resDir, `${result.ranAt.slice(0, 10)}.json`), JSON.stringify(result, null, 1));
  writeFileSync(join(resDir, "latest.json"), JSON.stringify(result, null, 1));
}

const baselinePath = join(root, "baseline.json");
if (writeBaseline) {
  writeFileSync(baselinePath, JSON.stringify({ categories }, null, 1));
  console.log("baseline written");
} else if (!live && !only && existsSync(baselinePath)) {
  // CI gate: replaying the same recordings must not get worse (post-processing or scoring regressions).
  const base = JSON.parse(readFileSync(baselinePath, "utf8")) as { categories: typeof categories };
  const failures: string[] = [];
  for (const b of base.categories) {
    const c = categories.find((x) => x.name === b.name);
    if (!c) {
      failures.push(`${b.name}: no cases scored`);
      continue;
    }
    if (c.wallF1 < b.wallF1 - 0.02) failures.push(`${b.name}: wall F1 ${c.wallF1.toFixed(3)} < baseline ${b.wallF1.toFixed(3)}`);
    if (c.openingF1 < b.openingF1 - 0.02) failures.push(`${b.name}: opening F1 ${c.openingF1.toFixed(3)} < baseline ${b.openingF1.toFixed(3)}`);
    if (c.estimateErrorPct > b.estimateErrorPct + 2) failures.push(`${b.name}: estimate error ${c.estimateErrorPct.toFixed(1)}% > baseline ${b.estimateErrorPct.toFixed(1)}%`);
  }
  if (failures.length) {
    console.error(`Regression against eval/baseline.json:\n${failures.join("\n")}`);
    process.exit(1);
  }
  console.log("No regression against the baseline.");
}
