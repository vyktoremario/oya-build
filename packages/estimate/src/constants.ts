/**
 * Physical constants used by the take-off. Each is a textbook value, stated so a QS can disagree with it.
 */
export const CONSTANTS = {
  /** Dry volume of concrete materials per m³ of wet concrete (voids + shrinkage). */
  dryFactorConcrete: 1.54,
  /** Dry volume of mortar materials per m³ of wet mortar. */
  dryFactorMortar: 1.33,
  /** Bulk density of cement, kg/m³. */
  cementDensity: 1440,
  /** kg per bag of cement. */
  cementBagKg: 50,
  /** Bulk density of sharp/plaster sand, t/m³. */
  sandDensity: 1.6,
  /** Bulk density of 19 mm granite chippings, t/m³. */
  graniteDensity: 1.5,
  /** Density of compacted laterite fill, t/m³. */
  lateriteDensity: 1.8,
  /** Standard length of sawn timber sold in Nigerian markets: 12 ft. */
  timberPieceLength: 3.66,
  /** Lap/anchorage allowance on main bars. */
  rebarLapAllowance: 0.1,
  /** Hook length on each end of a link, in bar diameters. */
  linkHookDiameters: 10,
  /** Binding wire per tonne of reinforcement, kg. */
  bindingWirePerTonne: 10,
} as const;

/** Mass of a steel bar per metre: d²/162 kg/m (d in mm). */
export const barKgPerM = (diaMm: number) => (diaMm * diaMm) / 162;
