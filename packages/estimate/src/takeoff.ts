import type { Mix, OpeningSpec, Params, Plan } from "@oya/schema";
import { area, indexPlan, measuredLengths, offsetPolygon, perimeter, topology, wallHeight } from "@oya/geometry";
import { CONSTANTS as C, barKgPerM } from "./constants";

export type GroupId = "substructure" | "superstructure" | "finishes" | "roof" | "openings";

export const GROUP_NAMES: Record<GroupId, string> = {
  substructure: "Substructure",
  superstructure: "Superstructure (walls & lintel)",
  finishes: "Plaster & screed",
  roof: "Roof & ceiling",
  openings: "Doors & windows",
};

/** A quantity of a priced material. `qty` includes waste; `net` does not. */
export interface MaterialQty {
  itemId: string;
  unit: string;
  net: number;
  waste: number;
  qty: number;
}

/** A measured item of work, in the units a QS would measure it, with the materials it needs. */
export interface WorkItem {
  code: string;
  group: GroupId;
  description: string;
  unit: string;
  qty: number;
  /** Human-readable formula with the actual numbers, e.g. "14.00 m × 0.675 m × 0.900 m". */
  formula: string;
  materials: MaterialQty[];
  notes?: string;
}

export interface TakeoffResult {
  items: WorkItem[];
  /** Headline geometry (m, m²) shown next to the BoQ. */
  summary: {
    floorClearArea: number;
    footprintArea: number;
    externalWallLength: number;
    internalWallLength: number;
    roofArea: number;
    rooms: { name: string; area: number }[];
  };
  warnings: string[];
}

const m = (mm: number) => mm / 1000;
const m2 = (mm2: number) => mm2 / 1e6;
const f2 = (n: number) => n.toFixed(2);
const f3 = (n: number) => n.toFixed(3);

const withWaste = (itemId: string, unit: string, net: number, waste: number): MaterialQty => ({
  itemId,
  unit,
  net,
  waste,
  qty: net * (1 + waste),
});

/** Cement (bags), sand (t) and granite (t) for a volume of wet concrete or mortar. */
function mixMaterials(wetVolume: number, mix: Mix, dryFactor: number, p: Params, sandItem = "sand-sharp"): MaterialQty[] {
  const parts = mix.cement + mix.sand + mix.granite;
  const dry = wetVolume * dryFactor;
  const out: MaterialQty[] = [
    withWaste("cement-50kg", "bag", ((dry * mix.cement) / parts) * (C.cementDensity / C.cementBagKg), p.waste.cement),
    withWaste(sandItem, "t", ((dry * mix.sand) / parts) * C.sandDensity, p.waste.sand),
  ];
  if (mix.granite > 0) out.push(withWaste("granite-19mm", "t", ((dry * mix.granite) / parts) * C.graniteDensity, p.waste.granite));
  return out;
}

const mixText = (mix: Mix) => (mix.granite > 0 ? `${mix.cement}:${mix.sand}:${mix.granite}` : `${mix.cement}:${mix.sand}`);

/** Blocks per m² of wall face: 1 / ((L + joint) × (H + joint)). */
export const blocksPerM2 = (p: Params) => 1 / (m(p.blockLength + p.mortarJoint) * m(p.blockHeight + p.mortarJoint));

/** Wet mortar per m² of blockwork: joint area per m² × wall thickness (full bed, stated). */
const mortarPerM2 = (p: Params, thicknessMm: number) => {
  const jointAreaPerBlock = m(p.blockLength + p.mortarJoint) * m(p.blockHeight + p.mortarJoint) - m(p.blockLength) * m(p.blockHeight);
  return blocksPerM2(p) * jointAreaPerBlock * m(thicknessMm);
};

/**
 * Take off quantities for a single-storey building from a plan. Pure function.
 * Conventions: centreline method (see @oya/geometry measuredLengths); openings deducted from
 * blockwork and plaster; continuous lintel band at lintel level.
 */
export function takeoff(plan: Plan, openingSpecs: OpeningSpec[]): TakeoffResult {
  const p = plan.params;
  const ix = indexPlan(plan);
  const topo = topology(plan, ix);
  const warnings: string[] = [];
  const items: WorkItem[] = [];

  const lenWall = measuredLengths(plan, (w) => w.thickness, ix);
  // Below DPC every wall is built in 9" blocks on a strip footing.
  const lenFound = measuredLengths(plan, () => p.foundationWidth, ix);
  const lenSubBlock = measuredLengths(plan, () => 225, ix);

  const sum = (map: Map<string, number>, filter: (id: string) => boolean = () => true) =>
    [...map.entries()].filter(([id]) => filter(id)).reduce((s, [, v]) => s + v, 0);
  const kindOf = (id: string) => ix.walls.get(id)!.kind;

  const Lf = m(sum(lenFound));
  const Lsb = m(sum(lenSubBlock));
  const Lext = m(sum(lenWall, (id) => kindOf(id) === "external"));
  const Lint = m(sum(lenWall, (id) => kindOf(id) === "internal"));

  const wallPlanArea = plan.walls.reduce((s, w) => s + (lenWall.get(w.id) ?? 0) * w.thickness, 0);
  const footprintArea = topo.footprintOuter ? m2(area(topo.footprintOuter)) : 0;
  const floorClearArea = Math.max(0, footprintArea - m2(wallPlanArea));
  if (!topo.footprint) warnings.push("No closed outline: slab, fill, screed, roof and ceiling are not measured.");
  if (topo.openWallIds.size) warnings.push(`${topo.openWallIds.size} wall(s) don't enclose a room; they are still measured as walls.`);

  // ── Substructure ───────────────────────────────────────────────────────────
  const excav = Lf * m(p.foundationWidth) * m(p.foundationDepth);
  items.push({
    code: "S1", group: "substructure", description: "Excavate foundation trench", unit: "m³", qty: excav,
    formula: `${f2(Lf)} m × ${f3(m(p.foundationWidth))} m × ${f3(m(p.foundationDepth))} m`,
    materials: [], notes: "Labour/plant item: no materials. Measured on the centreline, trimmed at T-junctions.",
  });

  const footing = Lf * m(p.foundationWidth) * m(p.footingThickness);
  items.push({
    code: "S2", group: "substructure", description: `Strip footing concrete (${mixText(p.mixFooting)})`, unit: "m³", qty: footing,
    formula: `${f2(Lf)} m × ${f3(m(p.foundationWidth))} m × ${f3(m(p.footingThickness))} m`,
    materials: mixMaterials(footing, p.mixFooting, C.dryFactorConcrete, p),
  });

  const subH = m(p.foundationDepth - p.footingThickness + p.plinthHeight);
  const subArea = Lsb * subH;
  const subBlocks = subArea * blocksPerM2(p);
  const coreFill = subBlocks * m(p.blockLength) * m(p.blockHeight) * 0.225 * p.coreFillFraction;
  items.push({
    code: "S3", group: "substructure", description: "9\" sandcrete blockwork below DPC, cores filled", unit: "m²", qty: subArea,
    formula: `${f2(Lsb)} m × ${f3(subH)} m (footing top to DPC)`,
    materials: [
      withWaste("block-9in", "nr", subBlocks, p.waste.blocks),
      ...mixMaterials(subArea * mortarPerM2(p, 225), p.mixMortar, C.dryFactorMortar, p),
      ...mixMaterials(coreFill, p.mixCoreFill, C.dryFactorConcrete, p),
    ],
    notes: `${blocksPerM2(p).toFixed(2)} blocks/m²; core fill ${(coreFill).toFixed(2)} m³ of ${mixText(p.mixCoreFill)} concrete.`,
  });

  if (topo.footprint) {
    const fillDepth = m(p.plinthHeight - p.slabThickness);
    const fillVol = floorClearArea * fillDepth;
    items.push({
      code: "S4", group: "substructure", description: "Laterite filling, compacted in layers", unit: "m³", qty: fillVol,
      formula: `${f2(floorClearArea)} m² × ${f3(fillDepth)} m (plinth − slab)`,
      materials: [withWaste("laterite-fill", "t", fillVol * C.lateriteDensity, p.waste.fill)],
    });
    items.push({
      code: "S5", group: "substructure", description: "Damp-proof membrane (polythene)", unit: "m²", qty: floorClearArea,
      formula: `${f2(floorClearArea)} m² floor area`,
      materials: [withWaste("dpm", "m²", floorClearArea, p.waste.dpm)],
    });
    const slab = floorClearArea * m(p.slabThickness);
    items.push({
      code: "S6", group: "substructure", description: `Oversite concrete slab (${mixText(p.mixSlab)})`, unit: "m³", qty: slab,
      formula: `${f2(floorClearArea)} m² × ${f3(m(p.slabThickness))} m`,
      materials: mixMaterials(slab, p.mixSlab, C.dryFactorConcrete, p),
    });
  }

  // ── Superstructure ─────────────────────────────────────────────────────────
  for (const thickness of [225, 150] as const) {
    const walls = plan.walls.filter((w) => w.thickness === thickness);
    if (!walls.length) continue;
    let gross = 0;
    let openingArea = 0;
    let band = 0;
    for (const w of walls) {
      const L = m(lenWall.get(w.id) ?? 0);
      const H = m(wallHeight(plan, w));
      gross += L * H;
      band += L * m(p.lintelDepth);
      for (const o of ix.openingsOn.get(w.id) ?? []) openingArea += m(o.width) * m(o.height);
    }
    const net = Math.max(0, gross - openingArea - band);
    const blocks = net * blocksPerM2(p);
    const inches = thickness === 225 ? 9 : 6;
    items.push({
      code: thickness === 225 ? "B1" : "B2", group: "superstructure",
      description: `${inches}" hollow sandcrete blockwork in ${mixText(p.mixMortar)} mortar`, unit: "m²", qty: net,
      formula: `${f2(gross)} m² gross − ${f2(openingArea)} m² openings − ${f2(band)} m² lintel band`,
      materials: [
        withWaste(thickness === 225 ? "block-9in" : "block-6in", "nr", blocks, p.waste.blocks),
        ...mixMaterials(net * mortarPerM2(p, thickness), p.mixMortar, C.dryFactorMortar, p),
      ],
      notes: `${blocksPerM2(p).toFixed(2)} blocks/m² (450×225 face + ${p.mortarJoint} mm joints).`,
    });
  }

  // Lintel band: concrete + reinforcement.
  let bandVol = 0;
  let mainLen = 0;
  let linkLen = 0;
  for (const w of plan.walls) {
    const L = m(lenWall.get(w.id) ?? 0);
    if (L <= 0) continue;
    bandVol += L * m(w.thickness) * m(p.lintelDepth);
    mainLen += L * p.lintelMainBars * (1 + C.rebarLapAllowance);
    const links = Math.floor(L / m(p.lintelLinkSpacing)) + 1;
    const perimeterLink = 2 * (m(w.thickness - 2 * p.concreteCover) + m(p.lintelDepth - 2 * p.concreteCover));
    linkLen += links * (perimeterLink + 2 * C.linkHookDiameters * m(p.lintelLinkDia));
  }
  if (bandVol > 0) {
    items.push({
      code: "B3", group: "superstructure", description: `Continuous lintel band concrete (${mixText(p.mixLintel)})`, unit: "m³", qty: bandVol,
      formula: `Σ wall length × thickness × ${f3(m(p.lintelDepth))} m`,
      materials: mixMaterials(bandVol, p.mixLintel, C.dryFactorConcrete, p),
    });
    const mainKg = mainLen * barKgPerM(p.lintelMainBarDia);
    const linkKg = linkLen * barKgPerM(p.lintelLinkDia);
    items.push({
      code: "B4", group: "superstructure", description: `Lintel reinforcement: ${p.lintelMainBars}Y${p.lintelMainBarDia} main bars, Y${p.lintelLinkDia} links @ ${p.lintelLinkSpacing} mm`, unit: "kg", qty: mainKg + linkKg,
      formula: `${f2(mainLen)} m × ${barKgPerM(p.lintelMainBarDia).toFixed(3)} kg/m + ${f2(linkLen)} m × ${barKgPerM(p.lintelLinkDia).toFixed(3)} kg/m`,
      materials: [
        withWaste(`rebar-y${p.lintelMainBarDia}`, "kg", mainKg, p.waste.rebar),
        withWaste(`rebar-y${p.lintelLinkDia}`, "kg", linkKg, p.waste.rebar),
        withWaste("binding-wire", "kg", ((mainKg + linkKg) / 1000) * C.bindingWirePerTonne, 0),
      ],
      notes: "Standard detail, not a structural design. Main bars include 10% for laps.",
    });
  }

  // ── Finishes ───────────────────────────────────────────────────────────────
  let plasterArea = 0;
  for (const w of plan.walls) {
    const L = m(lenWall.get(w.id) ?? 0);
    const H = m(wallHeight(plan, w));
    let face = L * H;
    for (const o of ix.openingsOn.get(w.id) ?? []) face -= m(o.width) * m(o.height);
    plasterArea += 2 * Math.max(0, face);
    if (w.kind === "external") plasterArea += L * m(p.plinthHeight);
  }
  if (plasterArea > 0) {
    items.push({
      code: "F1", group: "finishes", description: `${p.plasterThickness} mm plaster/render, both faces (${mixText(p.mixPlaster)})`, unit: "m²", qty: plasterArea,
      formula: `2 faces × Σ (length × height − openings) + external plinth render`,
      materials: mixMaterials(plasterArea * m(p.plasterThickness), p.mixPlaster, C.dryFactorMortar, p, "sand-plaster"),
      notes: "Face lengths taken on the centreline (inside faces shorter, outside longer; they roughly cancel).",
    });
  }
  if (floorClearArea > 0) {
    items.push({
      code: "F2", group: "finishes", description: `${p.screedThickness} mm floor screed (${mixText(p.mixScreed)})`, unit: "m²", qty: floorClearArea,
      formula: `${f2(floorClearArea)} m²`,
      materials: mixMaterials(floorClearArea * m(p.screedThickness), p.mixScreed, C.dryFactorMortar, p),
    });
  }

  // ── Roof ───────────────────────────────────────────────────────────────────
  let roofArea = 0;
  if (topo.footprintOuter) {
    const eaves = offsetPolygon(topo.footprintOuter, p.roofOverhang);
    const planArea = m2(area(eaves));
    const cos = Math.cos((p.roofPitchDeg * Math.PI) / 180);
    roofArea = planArea / cos;
    items.push({
      code: "R1", group: "roof", description: "Long-span aluminium roofing sheets (0.55 mm)", unit: "m²", qty: roofArea,
      formula: `${f2(planArea)} m² on plan (incl. ${p.roofOverhang} mm overhang) ÷ cos ${p.roofPitchDeg}°`,
      materials: [withWaste("roofing-longspan", "m²", roofArea, p.waste.roofing)],
      notes: "Sloped area of a uniform-pitch hip or gable roof = plan area ÷ cos(pitch).",
    });
    const rafters = roofArea / m(p.rafterSpacing);
    const bracing = rafters * p.roofBracingAllowance;
    const wallPlate = m(perimeter(topo.footprint!.polygon));
    const twoByFour = rafters + bracing + wallPlate;
    items.push({
      code: "R2", group: "roof", description: "2\"×4\" rafters, bracing and wall plate", unit: "m", qty: twoByFour,
      formula: `${f2(roofArea)} m² ÷ ${f3(m(p.rafterSpacing))} m + ${Math.round(p.roofBracingAllowance * 100)}% bracing + ${f2(wallPlate)} m wall plate`,
      materials: [withWaste("timber-2x4", "piece", twoByFour / C.timberPieceLength, p.waste.timber)],
      notes: "Rule of thumb, not a truss design. Timber sold in 12 ft (3.66 m) pieces.",
    });
    const purlins = roofArea / m(p.purlinSpacing);
    items.push({
      code: "R3", group: "roof", description: "2\"×3\" purlins", unit: "m", qty: purlins,
      formula: `${f2(roofArea)} m² ÷ ${f3(m(p.purlinSpacing))} m`,
      materials: [withWaste("timber-2x3", "piece", purlins / C.timberPieceLength, p.waste.timber)],
    });
    const fascia = m(perimeter(eaves));
    items.push({
      code: "R4", group: "roof", description: "1\"×10\" fascia board", unit: "m", qty: fascia,
      formula: `eaves perimeter ${f2(fascia)} m`,
      materials: [withWaste("fascia-1x10", "piece", fascia / C.timberPieceLength, p.waste.timber)],
    });
    items.push({
      code: "R5", group: "roof", description: "PVC ceiling panels", unit: "m²", qty: floorClearArea,
      formula: `${f2(floorClearArea)} m² floor area`,
      materials: [withWaste("ceiling-pvc", "m²", floorClearArea, p.waste.ceiling)],
    });
  }

  // ── Openings ───────────────────────────────────────────────────────────────
  const specById = new Map(openingSpecs.map((s) => [s.id, s]));
  const counts = new Map<string, number>();
  for (const o of plan.openings) counts.set(o.specId, (counts.get(o.specId) ?? 0) + 1);
  let n = 1;
  for (const [specId, count] of [...counts.entries()].sort()) {
    const spec = specById.get(specId);
    if (!spec) {
      warnings.push(`Unknown door/window type "${specId}" is not priced.`);
      continue;
    }
    items.push({
      code: `O${n++}`, group: "openings", description: spec.name, unit: "nr", qty: count,
      formula: `${count} × ${spec.width} × ${spec.height} mm`,
      materials: [withWaste(spec.priceItemId, "nr", count, 0)],
    });
  }

  const rooms = topo.rooms.map((r) => ({ name: r.name, area: m2(r.clearArea) }));
  return {
    items,
    summary: { floorClearArea, footprintArea, externalWallLength: Lext, internalWallLength: Lint, roofArea, rooms },
    warnings,
  };
}
