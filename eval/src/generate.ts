/**
 * Generate the synthetic eval set and the demo sample image:
 *   eval/cases/<id>/truth.plan.json  (exact ground truth, mm)
 *   eval/cases/<id>/image.jpg        (what the model sees)
 *   eval/cases/<id>/source.md        (how it was made)
 * Run on macOS (uses system handwriting fonts for the sketches): pnpm --filter eval generate
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import { buildPlan } from "./dsl";
import { SYNTHETIC_CASES, bungalow } from "./cases";
import { renderPlan } from "./render";

const root = new URL("..", import.meta.url).pathname;
const specs = DEFAULT_PRICE_BOOK.openingSpecs;

for (const c of SYNTHETIC_CASES) {
  const dir = join(root, "cases", c.id);
  mkdirSync(dir, { recursive: true });
  const plan = buildPlan(c.spec, specs);
  // 1240 × 930 ≈ 1.15 MP: the same size the web client downsizes uploads to.
  const r = renderPlan(plan, { style: c.style, seed: c.seed, dimensionUnits: c.dimensionUnits, rotateDeg: c.rotateDeg, width: 1240, height: 930 });
  writeFileSync(join(dir, "truth.plan.json"), JSON.stringify(plan, null, 1));
  writeFileSync(join(dir, "image.png"), new Resvg(r.svg, { font: { loadSystemFonts: true } }).render().asPng());
  // JPEG, as a phone photo would be (and as the web client sends it).
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", join(dir, "image.png"), "--out", join(dir, "image.jpg")], { stdio: "ignore" });
  execFileSync("rm", [join(dir, "image.png")]);
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ category: `synthetic-${c.style}`, width: r.width, height: r.height, mmPerPx: 1 / r.pxPerMm }, null, 1));
  writeFileSync(
    join(dir, "source.md"),
    `# ${c.id}\n\n- Category: synthetic-${c.style}\n- Plan: ${c.spec.name}\n- Rendered by eval/src/render.ts (style ${c.style}, seed ${c.seed}, dimensions in ${c.dimensionUnits ?? "mm"}, rotation ${c.rotateDeg ?? 0}°)\n- Truth: exact (the plan the image was drawn from)\n- Licence: generated for this project (MIT)\n`,
  );
  console.log("wrote", c.id);
}

// Demo sample: the bungalow as a sketch, as a JPEG for the landing page and the /build demo.
const sample = renderPlan(buildPlan(bungalow, specs), { style: "sketch", seed: 7, rotateDeg: -1.2 });
const publicDir = join(root, "..", "apps", "web", "public", "samples");
mkdirSync(publicDir, { recursive: true });
const png = join(publicDir, "bungalow-sketch.png");
writeFileSync(png, new Resvg(sample.svg, { font: { loadSystemFonts: true } }).render().asPng());
execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", join(publicDir, "bungalow-sketch.jpg")], { stdio: "ignore" });
execFileSync("rm", [png]);
console.log("wrote demo sample");
