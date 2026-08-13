export const TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES = Object.freeze([
  "control",
  "fine",
  "confirmed",
  "coarse"
] as const);

export const TAKRAM_ORBITAL_PRODUCTION_STEP_VALUES = Object.freeze({
  control: 1.01,
  fine: 1.00005,
  confirmed: 1.0001,
  coarse: 1.0002
} as const);

export type TakramOrbitalProductionStepCandidate =
  (typeof TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES)[number];

export function parseTakramOrbitalProductionStepCandidate(
  value: string | null
): TakramOrbitalProductionStepCandidate | null {
  return value !== null && TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES.includes(
    value as TakramOrbitalProductionStepCandidate
  )
    ? value as TakramOrbitalProductionStepCandidate
    : null;
}

export function resolveTakramOrbitalProductionStepScale(
  candidate: TakramOrbitalProductionStepCandidate
): number {
  return TAKRAM_ORBITAL_PRODUCTION_STEP_VALUES[candidate];
}

/**
 * Estimates the first primary-march step from an estimated ray-near distance.
 * The result is explanatory lookdev metadata, not measured per-pixel ray data.
 */
export function estimateTakramOrbitalInitialStepMeters(input: Readonly<{
  minStepSizeMeters: number;
  perspectiveStepScale: number;
  rayNearEstimateMeters: number;
}>): number {
  return input.minStepSizeMeters +
    (input.perspectiveStepScale - 1) * input.rayNearEstimateMeters;
}
