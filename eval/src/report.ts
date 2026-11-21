/** Turn eval/results/latest.json into the README table and the landing-page summary. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Category {
  name: string;
  n: number;
  wallF1: number;
  openingF1: number;
  scaleErrorPct: number;
  areaErrorPct: number;
  estimateErrorPct: number;
  estimateErrorMaxPct: number;
  costUsd: number;
  latencyS: number;
}

const root = new URL("..", import.meta.url).pathname;
const latest = JSON.parse(readFileSync(join(root, "results", "latest.json"), "utf8")) as { ranAt: string; model: string; categories: Category[] };
const label: Record<string, string> = {
  "synthetic-clean": "Synthetic, printed style",
  "synthetic-sketch": "Synthetic, sketch style",
  "real-sketch": "Real hand sketches (phone photos)",
};
const categories = latest.categories.map((c) => ({ ...c, name: label[c.name] ?? c.name }));
writeFileSync(
  join(root, "..", "apps", "web", "src", "samples", "eval-summary.json"),
  JSON.stringify({ ranAt: latest.ranAt, model: latest.model, categories }, null, 1),
);

const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "–");
const table = [
  `Run ${latest.ranAt.slice(0, 10)} · ${latest.model} · medians per category, before any human correction.`,
  "",
  "| Plans | n | Wall F1 | Door/window F1 | Scale error | Floor-area error | Estimate error (median / worst) | Cost per plan | Time per plan |",
  "|---|---|---|---|---|---|---|---|---|",
  ...categories.map(
    (c) =>
      `| ${c.name} | ${c.n} | ${f(c.wallF1)} | ${f(c.openingF1)} | ${f(c.scaleErrorPct, 1)}% | ${f(c.areaErrorPct, 1)}% | ${f(c.estimateErrorPct, 1)}% / ${f(c.estimateErrorMaxPct, 1)}% | $${f(c.costUsd, 3)} | ${f(c.latencyS, 0)} s |`,
  ),
].join("\n");

const readmePath = join(root, "..", "README.md");
const readme = readFileSync(readmePath, "utf8");
writeFileSync(readmePath, readme.replace(/<!-- eval:start -->[\s\S]*<!-- eval:end -->/, `<!-- eval:start -->\n${table}\n<!-- eval:end -->`));
console.log(table);
