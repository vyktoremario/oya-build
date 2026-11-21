import type { Params } from "./plan";

/**
 * Defaults for a typical single-storey Nigerian bungalow in sandcrete blockwork.
 * Every value is editable in the app; the reasons below are shown next to the BoQ.
 */
export const DEFAULT_PARAMS: Params = {
  wallHeight: 3000,
  lintelLevel: 2100,
  lintelDepth: 225,
  lintelMainBars: 4,
  lintelMainBarDia: 12,
  lintelLinkDia: 8,
  lintelLinkSpacing: 200,
  concreteCover: 25,

  foundationWidth: 675,
  foundationDepth: 900,
  footingThickness: 225,
  plinthHeight: 450,
  coreFillFraction: 0.5,
  slabThickness: 150,
  screedThickness: 25,
  plasterThickness: 15,

  blockLength: 450,
  blockHeight: 225,
  mortarJoint: 10,

  mixFooting: { cement: 1, sand: 2, granite: 4 },
  mixLintel: { cement: 1, sand: 2, granite: 4 },
  mixSlab: { cement: 1, sand: 2, granite: 4 },
  mixCoreFill: { cement: 1, sand: 3, granite: 6 },
  mixMortar: { cement: 1, sand: 6, granite: 0 },
  mixPlaster: { cement: 1, sand: 6, granite: 0 },
  mixScreed: { cement: 1, sand: 3, granite: 0 },

  roofType: "hip",
  roofPitchDeg: 25,
  roofOverhang: 600,
  rafterSpacing: 600,
  purlinSpacing: 900,
  roofBracingAllowance: 0.3,

  waste: {
    blocks: 0.05,
    cement: 0.05,
    sand: 0.1,
    granite: 0.05,
    rebar: 0.1,
    roofing: 0.1,
    timber: 0.1,
    dpm: 0.15,
    fill: 0.1,
    ceiling: 0.05,
  },
  labourPercent: 0,
};

type ParamKey = Exclude<keyof Params, "waste">;

export const PARAM_DOCS: Record<ParamKey, { label: string; unit: string; why: string }> = {
  wallHeight: { label: "Wall height", unit: "mm", why: "Floor to roof; 3.0 m is common for bungalows." },
  lintelLevel: { label: "Lintel level", unit: "mm", why: "Bottom of the continuous lintel band = standard door head (2.1 m)." },
  lintelDepth: { label: "Lintel depth", unit: "mm", why: "One block course (225 mm)." },
  lintelMainBars: { label: "Lintel main bars", unit: "nr", why: "Standard detail, not a structural design: 4 bars." },
  lintelMainBarDia: { label: "Lintel main bar size", unit: "mm", why: "Y12 high-yield bars." },
  lintelLinkDia: { label: "Lintel link size", unit: "mm", why: "Y8 links (stirrups)." },
  lintelLinkSpacing: { label: "Lintel link spacing", unit: "mm", why: "Links at 200 mm centres." },
  concreteCover: { label: "Concrete cover", unit: "mm", why: "Cover to links." },
  foundationWidth: { label: "Footing width", unit: "mm", why: "Common strip footing for 9\" walls on firm soil (3 × wall thickness)." },
  foundationDepth: { label: "Trench depth", unit: "mm", why: "Ground level to bottom of trench; depends on soil — ask an engineer." },
  footingThickness: { label: "Footing thickness", unit: "mm", why: "Strip footing concrete thickness." },
  plinthHeight: { label: "Plinth height", unit: "mm", why: "Ground level to DPC (two block courses)." },
  coreFillFraction: { label: "Block core fill", unit: "fraction", why: "Substructure blocks are filled with concrete; ~50% of a hollow block's volume is void." },
  slabThickness: { label: "Oversite slab", unit: "mm", why: "Ground-floor oversite concrete." },
  screedThickness: { label: "Floor screed", unit: "mm", why: "Levelling screed under finishes." },
  plasterThickness: { label: "Plaster/render", unit: "mm", why: "Each face." },
  blockLength: { label: "Block length", unit: "mm", why: "Standard sandcrete block face 450 × 225 mm." },
  blockHeight: { label: "Block height", unit: "mm", why: "Standard sandcrete block face 450 × 225 mm." },
  mortarJoint: { label: "Mortar joint", unit: "mm", why: "Bed and perpend joints." },
  mixFooting: { label: "Footing mix", unit: "ratio", why: "1:2:4 (cement:sand:granite) by volume." },
  mixLintel: { label: "Lintel mix", unit: "ratio", why: "1:2:4 for reinforced members." },
  mixSlab: { label: "Slab mix", unit: "ratio", why: "1:2:4 oversite concrete." },
  mixCoreFill: { label: "Core fill mix", unit: "ratio", why: "1:3:6 for filling block cores." },
  mixMortar: { label: "Mortar mix", unit: "ratio", why: "1:6 cement:sand for blockwork." },
  mixPlaster: { label: "Plaster mix", unit: "ratio", why: "1:6 cement:sand." },
  mixScreed: { label: "Screed mix", unit: "ratio", why: "1:3 cement:sand." },
  roofType: { label: "Roof type", unit: "", why: "Hip roof with long-span aluminium is the common choice." },
  roofPitchDeg: { label: "Roof pitch", unit: "°", why: "Typical 20–30° for long-span sheets." },
  roofOverhang: { label: "Eaves overhang", unit: "mm", why: "Horizontal overhang past the outer wall face." },
  rafterSpacing: { label: "Rafter spacing", unit: "mm", why: "Rafters (2\"×4\") at 600 mm centres." },
  purlinSpacing: { label: "Purlin spacing", unit: "mm", why: "Purlins (2\"×3\") at 900 mm centres." },
  roofBracingAllowance: { label: "Bracing allowance", unit: "fraction", why: "Rule of thumb: struts, ties and king posts ≈ 30% of rafter length." },
  labourPercent: { label: "Labour allowance", unit: "%", why: "Off by default: labour varies widely. Add your contractor's figure." },
};
