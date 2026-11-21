/**
 * Generate every brand asset from one definition of the mark:
 *   pnpm --filter web brand [baseURL]
 * baseURL (default http://localhost:3219) is a running build, used for the 3D shot in the OG image.
 *
 * Marks (64 × 64 grid):
 *   A1 line mark: orange roof over an ink floor plan (door gap + partition): header, landing, OG.
 *   A3 tile: the same drawing in paper lines on an ink tile: favicon, apple-touch, manifest.
 * The wordmark is Geist SemiBold converted to paths, so the SVGs don't depend on installed fonts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";
import { chromium } from "@playwright/test";

const INK = "#1c2430";
const ACCENT = "#d9541a";
const PAPER = "#f6f4ef";

const web = join(import.meta.dirname, "..");
const pub = join(web, "public");
const brandDir = join(pub, "brand");
const appDir = join(web, "src", "app");
mkdirSync(brandDir, { recursive: true });

const font = opentype.parse(readFileSync(join(web, "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")).buffer);

/** A1 drawing, in a 64-unit box. */
const markA1 = (plan = INK, roof = ACCENT, w = { roof: 6.5, plan: 5 }, partition = true) =>
  `<path d="M8 29 L32 10 L56 29" fill="none" stroke="${roof}" stroke-width="${w.roof}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M15 31.5 V53.5 H27 M37 53.5 H49 V31.5 H15${partition ? " M32 31.5 V42" : ""}" fill="none" stroke="${plan}" stroke-width="${w.plan}"/>`;

/** A3 drawing on a tile. Heavier strokes and no partition at small sizes. */
const tileA3 = (size: number, rounded = true) => {
  const small = size <= 48;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" ${rounded ? 'rx="15"' : ""} fill="${INK}"/>` +
    `<path d="M10 30 L32 12.5 L54 30" fill="none" stroke="${ACCENT}" stroke-width="${small ? 7.5 : 6}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M17 32.5 V52 H27.5 M36.5 52 H47 V32.5 H17${small ? "" : " M32 32.5 V42"}" fill="none" stroke="${PAPER}" stroke-width="${small ? 6.5 : 4.5}"/>` +
    `</svg>`
  );
};

/** "Oya" + "Build" as outlined paths; returns path markup and advance width at a given size. */
function wordmark(x: number, baseline: number, size: number, oya: string, build: string) {
  const wOya = font.getAdvanceWidth("Oya", size, { kerning: true });
  const width = wOya + font.getAdvanceWidth("Build", size, { kerning: true });
  return { svg: text("Oya", x, baseline, size, oya) + text("Build", x + wOya, baseline, size, build), width };
}

/** One <path> per glyph: resvg drops glyphs from very long single paths. */
function text(t: string, x: number, baseline: number, size: number, fill: string, f = font) {
  return f
    .getPaths(t, x, baseline, size, { kerning: true })
    .map((p) => p.toPathData(2))
    .filter(Boolean)
    .map((d) => `<path d="${d}" fill="${fill}"/>`)
    .join("");
}

/** Mark + wordmark on one line. */
function lockup(dark: boolean) {
  const h = 64;
  const wm = wordmark(76, 45, 38, dark ? PAPER : INK, ACCENT);
  const width = Math.ceil(76 + wm.width + 4);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" role="img" aria-label="Oya Build">` +
    `<title>Oya Build</title>${markA1(dark ? PAPER : INK)}${wm.svg}</svg>`
  );
}

const fontDir = join(web, "node_modules/geist/dist/fonts/geist-sans");
const png = (svg: string, width: number) =>
  new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: [join(fontDir, "Geist-SemiBold.ttf"), join(fontDir, "Geist-Regular.ttf")], loadSystemFonts: false, defaultFontFamily: "Geist" },
  })
    .render()
    .asPng();

/** Real text for raster-only artwork (the OG image), rendered by resvg with the Geist files above. */
const label = (t: string, x: number, y: number, size: number, fill: string, weight = 600) =>
  `<text x="${x}" y="${y}" font-family="Geist" font-weight="${weight}" font-size="${size}" fill="${fill}">${t.replace(/&/g, "&amp;")}</text>`;

/** ICO containing PNG images (supported by every current browser). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach((img, i) => {
    const o = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, o);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, o + 1);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(img.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += img.data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

// ── Logos ────────────────────────────────────────────────────────────────────
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Oya Build"><title>Oya Build</title>${markA1()}</svg>`;
writeFileSync(join(brandDir, "logo-mark.svg"), markSvg);
writeFileSync(join(brandDir, "logo.svg"), lockup(false));
writeFileSync(join(brandDir, "logo-on-dark.svg"), lockup(true));
writeFileSync(join(brandDir, "logo.png"), png(lockup(false), 960));
writeFileSync(join(brandDir, "logo-on-dark.png"), png(lockup(true), 960));
writeFileSync(join(brandDir, "icon.svg"), tileA3(512));

// ── Favicons and app icons (Next.js file conventions in src/app) ────────────
writeFileSync(join(appDir, "icon.svg"), tileA3(32));
writeFileSync(join(appDir, "favicon.ico"), ico([16, 32, 48].map((s) => ({ size: s, data: Buffer.from(png(tileA3(s), s)) }))));
writeFileSync(join(appDir, "apple-icon.png"), png(tileA3(180, false), 180));
writeFileSync(join(pub, "icon-192.png"), png(tileA3(192), 192));
writeFileSync(join(pub, "icon-512.png"), png(tileA3(512), 512));
// Maskable: full-bleed ink with the drawing inside the 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64"><rect width="64" height="64" fill="${INK}"/><g transform="translate(6.4 6.4) scale(0.8)"><path d="M10 30 L32 12.5 L54 30" fill="none" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 32.5 V52 H27.5 M36.5 52 H47 V32.5 H17 M32 32.5 V42" fill="none" stroke="${PAPER}" stroke-width="4.5"/></g></svg>`;
writeFileSync(join(pub, "icon-maskable-512.png"), png(maskable, 512));

// ── Open Graph image: lockup, the promise, and the 3D model ─────────────────
const base = process.argv[2] ?? "http://localhost:3219";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`${base}/build?sample=1`);
await page.getByTestId("boq-total").waitFor();
await page.getByTestId("focus-3d").click();
await page.getByRole("button", { name: "Hide roof" }).click();
await page.waitForTimeout(2500);
const shot = (await page.getByTestId("scene-3d").screenshot()).toString("base64");
await browser.close();

const W = 1200;
const H = 630;
const wm = wordmark(152, 136, 64, INK, ACCENT);
const og =
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="${W}" height="${H}" fill="${PAPER}"/>` +
  `<clipPath id="shot"><rect x="640" y="70" width="500" height="490" rx="18"/></clipPath>` +
  `<image x="560" y="40" width="680" height="557" preserveAspectRatio="xMidYMid slice" clip-path="url(#shot)" href="data:image/png;base64,${shot}"/>` +
  `<rect x="640" y="70" width="500" height="490" rx="18" fill="none" stroke="#e3e0d8" stroke-width="2"/>` +
  `<g transform="translate(60 76) scale(1.5)">${markA1()}</g>${wm.svg}` +
  label("Sketch a house.", 64, 270, 50, INK) +
  label("Walk through it.", 64, 334, 50, INK) +
  label("Price it in Naira.", 64, 398, 50, ACCENT) +
  label("Floor plan photo → 3D model → bill of quantities.", 64, 470, 24, "#4b5563", 400) +
  label("Cited Abuja prices, every rate editable.", 64, 504, 24, "#4b5563", 400) +
  label("oya-build.vercel.app", 64, 572, 22, "#6b7280", 400) +
  `</svg>`;
writeFileSync(join(appDir, "opengraph-image.png"), png(og, W));
writeFileSync(join(appDir, "twitter-image.png"), png(og, W));
writeFileSync(join(brandDir, "og.png"), png(og, W));
console.log("brand assets written");
