import { type ExtractionRecording, ExtractionRecordingSchema, type Plan, PlanSchema } from "@oya/schema";
import { postProcess } from "@oya/geometry";
import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import truthJson from "./bungalow.truth.plan.json";
import recordingJson from "./bungalow.recording.json";

export const SAMPLE_IMAGE = { url: "/samples/bungalow-sketch.jpg", width: 1568, height: 1176 };

const recording: ExtractionRecording | null = recordingJson ? ExtractionRecordingSchema.parse(recordingJson) : null;

/**
 * The demo sample. When a recorded model extraction exists, the demo replays it through the same
 * post-processing as a live upload (so it is honest about what extraction produces); otherwise it
 * falls back to the hand-entered plan and says so.
 */
export function loadSample() {
  if (recording) {
    const out = postProcess(recording.raw, { openingSpecs: DEFAULT_PRICE_BOOK.openingSpecs });
    out.plan.name = "Three-bedroom bungalow (sample sketch)";
    return { plan: out.plan, flags: out.flags, extraction: { raw: recording.raw, meta: recording.meta, recorded: true }, image: { ...SAMPLE_IMAGE, width: recording.raw.imageWidth, height: recording.raw.imageHeight } };
  }
  const plan: Plan = PlanSchema.parse(truthJson);
  return { plan, flags: [], extraction: null, image: null };
}
