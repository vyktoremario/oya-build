import { z } from "zod";

/**
 * What the vision model returns: a description of what is drawn, in source-image pixels.
 * Deliberately "raw": post-processing in @oya/geometry turns it into a Plan.
 * Kept JSON-schema friendly for structured outputs (no unions, no optional numbers).
 */
const px = z.number();
const confidence = z.number().min(0).max(1);

export const RawWallSchema = z.object({
  x1: px,
  y1: px,
  x2: px,
  y2: px,
  /** Drawn thickness in pixels if visible, else 0. */
  thicknessPx: z.number().min(0),
  kind: z.enum(["external", "internal", "unknown"]),
  confidence,
});
export type RawWall = z.infer<typeof RawWallSchema>;

export const RawOpeningSchema = z.object({
  kind: z.enum(["door", "window"]),
  /** Centre of the opening in pixels. */
  x: px,
  y: px,
  widthPx: z.number().min(0),
  confidence,
});
export type RawOpening = z.infer<typeof RawOpeningSchema>;

export const RawRoomSchema = z.object({ name: z.string(), x: px, y: px, confidence });
export type RawRoom = z.infer<typeof RawRoomSchema>;

export const RawDimensionSchema = z.object({
  /** The text exactly as written, e.g. "3600", "12'-0\"", "3.6m". */
  text: z.string(),
  /** The parsed value in millimetres, or 0 if it can't be parsed. */
  valueMm: z.number().min(0),
  /** The two points the dimension line spans, in pixels. */
  x1: px,
  y1: px,
  x2: px,
  y2: px,
  confidence,
});
export type RawDimension = z.infer<typeof RawDimensionSchema>;

export const RawExtractionSchema = z.object({
  imageWidth: z.number(),
  imageHeight: z.number(),
  drawingType: z.enum(["hand_sketch", "printed_plan", "not_a_floor_plan"]),
  walls: z.array(RawWallSchema),
  openings: z.array(RawOpeningSchema),
  rooms: z.array(RawRoomSchema),
  dimensions: z.array(RawDimensionSchema),
  /** Anything the model could not represent (curved walls, stairs, multiple storeys…). */
  notes: z.array(z.string()),
});
export type RawExtraction = z.infer<typeof RawExtractionSchema>;

export const ExtractionMetaSchema = z.object({
  model: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  costUsd: z.number(),
  latencyMs: z.number().int(),
  at: z.string(),
});
export type ExtractionMeta = z.infer<typeof ExtractionMetaSchema>;

export const ExtractionRecordingSchema = z.object({
  raw: RawExtractionSchema,
  meta: ExtractionMetaSchema,
});
export type ExtractionRecording = z.infer<typeof ExtractionRecordingSchema>;
