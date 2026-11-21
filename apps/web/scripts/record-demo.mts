/**
 * Record the README demo GIF from a running app: pnpm --filter web demo:gif [baseURL]
 * Captures screenshots along the 15-second demo path and encodes them with gifenc.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const base = process.argv[2] ?? "http://localhost:3217";
const W = 1200;
const H = 750;
const { GIFEncoder, applyPalette, quantize } = gifenc;
const frames: { data: Uint8Array; delay: number }[] = [];

async function snap(page: Page, delay = 120, count = 1, gap = 0) {
  for (let i = 0; i < count; i++) {
    const png = PNG.sync.read(await page.screenshot());
    frames.push({ data: new Uint8Array(png.data), delay });
    if (gap) await page.waitForTimeout(gap);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

await page.goto(`${base}/`);
await page.waitForTimeout(800);
await snap(page, 1800);

await page.getByTestId("cta-sample").click();
await page.getByTestId("boq-total").waitFor();
await page.waitForTimeout(400);
await snap(page, 110, 14, 60); // walls rise, total counts up
await snap(page, 1200);

// Drag the right-hand external wall outwards: plan, 3D and total move together.
const wall = await page.evaluate(() => {
  const rects = [...document.querySelectorAll<SVGPolygonElement>("[data-wall]")].map((p) => p.getBoundingClientRect());
  const r = rects.filter((x) => x.height > x.width).sort((a, b) => b.right - a.right)[0]!;
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.3 };
});
await page.mouse.move(wall.x, wall.y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(wall.x + i * 4, wall.y);
  await snap(page, 110);
}
await page.mouse.up();
await page.waitForTimeout(300);
await snap(page, 110, 6, 80);
await snap(page, 1500);

// Full view without the roof, then walk in through the front door.
await page.getByRole("button", { name: "Hide roof" }).click();
await page.getByTestId("focus-3d").click();
await page.waitForTimeout(900);
await snap(page, 1600);
await page.getByTestId("walk-button").click();
await page.waitForTimeout(600);
await snap(page, 900);
await page.keyboard.down("w");
await snap(page, 110, 7, 30);
await page.keyboard.up("w");
await snap(page, 1800);
await browser.close();

const gif = GIFEncoder();
for (const f of frames) {
  // Downscale 2× for size: sample every other pixel.
  const w = W / 2;
  const h = H / 2;
  const small = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((y * 2) * W + x * 2) * 4;
      const d = (y * w + x) * 4;
      small.set(f.data.subarray(s, s + 4), d);
    }
  const palette = quantize(small, 256);
  gif.writeFrame(applyPalette(small, palette), w, h, { palette, delay: f.delay });
}
gif.finish();
// Optional: dump a few frames as PNG to check the sequence (DEMO_FRAMES_DIR=/some/dir).
if (process.env.DEMO_FRAMES_DIR) {
  for (const i of [0, 8, 16, 28, 36, 44, frames.length - 1]) {
    const f = frames[i];
    if (!f) continue;
    const png = new PNG({ width: W, height: H });
    png.data = Buffer.from(f.data);
    writeFileSync(join(process.env.DEMO_FRAMES_DIR, `frame-${String(i).padStart(2, "0")}.png`), PNG.sync.write(png));
  }
}
const out = join(import.meta.dirname, "..", "..", "..", "docs", "demo.gif");
writeFileSync(out, gif.bytes());
console.log(`wrote ${out} (${frames.length} frames, ${(gif.bytes().length / 1e6).toFixed(1)} MB)`);
