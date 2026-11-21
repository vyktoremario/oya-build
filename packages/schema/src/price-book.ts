import { z } from "zod";

export const PriceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  /** NGN per unit. */
  rate: z.number().nonnegative(),
  /** Where the rate came from: a URL or a short description. */
  source: z.string(),
  /** ISO date the source was read. */
  observedAt: z.string(),
  notes: z.string().optional(),
});
export type PriceItem = z.infer<typeof PriceItemSchema>;

export const OpeningSpecSchema = z.object({
  id: z.string(),
  kind: z.enum(["door", "window"]),
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sill: z.number().int().nonnegative(),
  /** Price item id for one unit of this opening. */
  priceItemId: z.string(),
  /** How it's drawn in 3D. */
  style: z.enum(["flush", "panel", "steel", "casement", "sliding"]).default("flush"),
  /** Main entrance doors are the ones extraction assigns to the front door. */
  entrance: z.boolean().default(false),
  /** Whether extraction may assign it automatically (otherwise it's a user choice in the editor). */
  autoDetect: z.boolean().default(true),
});
export type OpeningSpec = z.infer<typeof OpeningSpecSchema>;

export const PriceBookSchema = z.object({
  id: z.string(),
  region: z.string(),
  currency: z.literal("NGN"),
  /** Month the prices were collected, e.g. "2026-11". */
  asOf: z.string(),
  disclaimer: z.string(),
  items: z.array(PriceItemSchema),
  openingSpecs: z.array(OpeningSpecSchema),
});
export type PriceBook = z.infer<typeof PriceBookSchema>;

/** Price item ids the estimate engine prices against. A price book must define all of them. */
export const PRICE_ITEM_IDS = [
  "cement-50kg",
  "sand-sharp",
  "sand-plaster",
  "granite-19mm",
  "block-9in",
  "block-6in",
  "rebar-y12",
  "rebar-y8",
  "binding-wire",
  "dpm",
  "laterite-fill",
  "roofing-longspan",
  "timber-2x4",
  "timber-2x3",
  "fascia-1x10",
  "ceiling-pvc",
] as const;
export type PriceItemId = (typeof PRICE_ITEM_IDS)[number];
