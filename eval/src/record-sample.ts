/** Record a live extraction of the demo sketch for the app's sample (pnpm --filter eval record:sample). */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { extractRaw } from "@oya/extract";

const root = new URL("..", import.meta.url).pathname;
const web = join(root, "..", "apps", "web");
const tmp = join(root, "cases-local", "_sample.jpg");
// Same size the web client would send.
execFileSync("sips", ["-z", "930", "1240", join(web, "public", "samples", "bungalow-sketch.jpg"), "--out", tmp], { stdio: "ignore" });
const rec = await extractRaw({ imageBase64: readFileSync(tmp).toString("base64"), mediaType: "image/jpeg", width: 1240, height: 930 });
writeFileSync(join(web, "src", "samples", "bungalow.recording.json"), JSON.stringify(rec, null, 1));
console.log(
  `recorded: ${rec.raw.walls.length} walls, ${rec.raw.openings.length} openings, ${rec.raw.dimensions.length} dimensions, $${rec.meta.costUsd.toFixed(3)}, ${Math.round(rec.meta.latencyMs / 1000)} s`,
);
