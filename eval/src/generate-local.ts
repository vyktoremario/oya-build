/**
 * Prepare the real-sketch cases in eval/cases-local/ (git-ignored): resize the original photo to
 * the size the web client would send (≤ 1.15 MP) and write the hand-entered truth.
 */
import { existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import { buildPlan } from "./dsl";
import { REAL_CASES } from "./real-cases";

const root = new URL("..", import.meta.url).pathname;
for (const c of REAL_CASES) {
  const dir = join(root, "cases-local", c.id);
  const original = join(dir, "original.jpg");
  if (!existsSync(original)) {
    console.log(`skip ${c.id}: no original.jpg`);
    continue;
  }
  const size = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", original]).toString();
  const w = Number(/pixelWidth: (\d+)/.exec(size)![1]);
  const h = Number(/pixelHeight: (\d+)/.exec(size)![1]);
  const k = Math.min(1, 1568 / Math.max(w, h), Math.sqrt(1_150_000 / (w * h)));
  const width = Math.round(w * k);
  const height = Math.round(h * k);
  execFileSync("sips", ["-z", String(height), String(width), "-s", "format", "jpeg", original, "--out", join(dir, "image.jpg")], { stdio: "ignore" });
  writeFileSync(join(dir, "truth.plan.json"), JSON.stringify(buildPlan(c.spec, DEFAULT_PRICE_BOOK.openingSpecs), null, 1));
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ category: "real-sketch", width, height, mmPerPx: null }, null, 1));
  writeFileSync(join(dir, "source.md"), `# ${c.id}\n\n- Category: real-sketch\n- ${c.notes}\n- Truth: entered by hand from the written dimensions (eval/src/real-cases.ts); undimensioned positions ±300 mm.\n- Not redistributed: this folder is git-ignored.\n`);
  console.log(`prepared ${c.id} (${width}×${height})`);
}
