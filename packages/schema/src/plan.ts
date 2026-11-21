import { z } from "zod";

/** All lengths are integer millimetres. Origin top-left, y pointing down (as in the source image). */
const mm = z.number().int();
const posMm = z.number().int().positive();
const id = z.string().min(1);

export const PlanNodeSchema = z.object({ id, x: mm, y: mm });
export type PlanNode = z.infer<typeof PlanNodeSchema>;

export const WallKindSchema = z.enum(["external", "internal"]);
export type WallKind = z.infer<typeof WallKindSchema>;

export const WallSchema = z.object({
  id,
  a: id,
  b: id,
  kind: WallKindSchema,
  /** 225 = 9" sandcrete block, 150 = 6" sandcrete block. */
  thickness: posMm,
  /** Overrides params.wallHeight for this wall. */
  height: posMm.optional(),
});
export type Wall = z.infer<typeof WallSchema>;

export const OpeningKindSchema = z.enum(["door", "window"]);
export type OpeningKind = z.infer<typeof OpeningKindSchema>;

export const OpeningSchema = z.object({
  id,
  wallId: id,
  kind: OpeningKindSchema,
  /** Distance from the wall's node `a` to the opening's centre, along the centreline. */
  offset: mm,
  width: posMm,
  height: posMm,
  /** Height of the bottom of the opening above finished floor (0 for doors). */
  sill: mm.nonnegative(),
  /** Key into the price book's opening specs, e.g. "door-flush-900". */
  specId: z.string(),
});
export type Opening = z.infer<typeof OpeningSchema>;

export const RoomLabelSchema = z.object({ id, x: mm, y: mm, name: z.string() });
export type RoomLabel = z.infer<typeof RoomLabelSchema>;

export const RoofTypeSchema = z.enum(["hip", "gable"]);
export type RoofType = z.infer<typeof RoofTypeSchema>;

/** A mix ratio by volume, cement : fine aggregate (: coarse aggregate). */
export const MixSchema = z.object({
  cement: z.number().positive(),
  sand: z.number().positive(),
  granite: z.number().nonnegative(),
});
export type Mix = z.infer<typeof MixSchema>;

export const ParamsSchema = z.object({
  /** Floor (top of slab) to underside of roof structure. */
  wallHeight: posMm,
  /** Continuous lintel band: bottom of band = door head height. */
  lintelLevel: posMm,
  lintelDepth: posMm,
  lintelMainBars: z.number().int().positive(),
  lintelMainBarDia: posMm,
  lintelLinkDia: posMm,
  lintelLinkSpacing: posMm,
  concreteCover: posMm,

  foundationWidth: posMm,
  /** Ground level to bottom of the trench. */
  foundationDepth: posMm,
  footingThickness: posMm,
  /** Ground level to damp-proof course (top of substructure blockwork). */
  plinthHeight: posMm,
  /** Fraction of a 9" hollow block's gross volume filled with concrete in the substructure. */
  coreFillFraction: z.number().min(0).max(1),
  slabThickness: posMm,
  screedThickness: posMm,
  plasterThickness: posMm,

  blockLength: posMm,
  blockHeight: posMm,
  mortarJoint: posMm,

  mixFooting: MixSchema,
  mixLintel: MixSchema,
  mixSlab: MixSchema,
  mixCoreFill: MixSchema,
  mixMortar: MixSchema,
  mixPlaster: MixSchema,
  mixScreed: MixSchema,

  roofType: RoofTypeSchema,
  roofPitchDeg: z.number().min(5).max(60),
  roofOverhang: mm.nonnegative(),
  rafterSpacing: posMm,
  purlinSpacing: posMm,
  /** Struts, ties, king posts etc. as a fraction of rafter length. Rule of thumb. */
  roofBracingAllowance: z.number().min(0).max(2),

  waste: z.object({
    blocks: z.number().min(0).max(1),
    cement: z.number().min(0).max(1),
    sand: z.number().min(0).max(1),
    granite: z.number().min(0).max(1),
    rebar: z.number().min(0).max(1),
    roofing: z.number().min(0).max(1),
    timber: z.number().min(0).max(1),
    dpm: z.number().min(0).max(1),
    fill: z.number().min(0).max(1),
    ceiling: z.number().min(0).max(1),
  }),
  /** Optional labour allowance as a % of materials. 0 = materials-only estimate. */
  labourPercent: z.number().min(0).max(200),
});
export type Params = z.infer<typeof ParamsSchema>;

export const PlanSourceSchema = z.object({
  kind: z.enum(["upload", "sample", "blank"]),
  /** mm per source-image pixel. null when the scale is unknown. */
  mmPerPx: z.number().positive().nullable(),
  /** Plan coordinates of the image's top-left pixel. */
  originX: mm,
  originY: mm,
  imageWidth: z.number().int().nonnegative(),
  imageHeight: z.number().int().nonnegative(),
  scaleSource: z.enum(["dimensions", "user", "guess", "exact"]),
});
export type PlanSource = z.infer<typeof PlanSourceSchema>;

/** Purely visual choices: they change the 3D model, never the estimate. */
export const AppearanceSchema = z.object({
  roofColor: z.string().default("#8e2f2a"),
  wallColor: z.string().default("#efe8da"),
  floor: z.enum(["tiles", "screed"]).default("tiles"),
});
export type Appearance = z.infer<typeof AppearanceSchema>;

export const PlanSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  source: PlanSourceSchema,
  params: ParamsSchema,
  nodes: z.array(PlanNodeSchema),
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  labels: z.array(RoomLabelSchema),
  /** Price overrides keyed by price-book item id, in NGN per item unit. */
  priceOverrides: z.record(z.string(), z.number().nonnegative()),
  appearance: AppearanceSchema.default({ roofColor: "#8e2f2a", wallColor: "#efe8da", floor: "tiles" }),
});
export type Plan = z.infer<typeof PlanSchema>;
