export const TAKRAM_MIP_DIAGNOSTIC_TARGET_FRAMES = [16, 32, 48] as const;
export const TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE = 9;
export const TAKRAM_MIP_DIAGNOSTIC_MIN_DISTINCT_PIXELS = 512;
export const TAKRAM_MIP_DIAGNOSTIC_MIN_VALID_SAMPLES = 4096;

export type TakramMipDiagnosticScale = 1 | 80 | 120 | 160;
export type TakramMipDiagnosticCandidateScale = Exclude<TakramMipDiagnosticScale, 1>;

export interface TakramMipDiagnosticPopulationInput {
  readonly scale: TakramMipDiagnosticScale;
  readonly frames: readonly {
    readonly nativeFrame: number;
    readonly records: Float32Array;
  }[];
}

export interface TakramMipDiagnosticPopulationSummary {
  readonly scale: TakramMipDiagnosticScale;
  readonly valid: boolean;
  readonly distinctPixelCount: number;
  readonly validSampleCount: number;
  readonly roughWeatherHitFraction: number | null;
  readonly primaryHitFraction: number | null;
  readonly preTemporalOpacityP75: number | null;
  readonly mipExcessP50: number | null;
  readonly mipExcessAtLeastOneFraction: number | null;
  readonly actualMipFormulaErrorP95: number | null;
  readonly prematureMipThresholdPass: boolean;
}

export type TakramMipDiagnosticDecision =
  | "MIP_DIAGNOSTIC_INVALID_CANDIDATE_SET"
  | "MIP_DIAGNOSTIC_INCONCLUSIVE_EMPTY_POPULATION"
  | "MIP_DIAGNOSTIC_INVALID_HEALTHY_REFERENCE"
  | "MIP_CAUSAL_HYPOTHESIS_REJECTED"
  | "MIP_CAUSAL_THRESHOLD_PASS_PATCH_A_B_REQUIRES_AUTHORIZATION";

export interface TakramMipDiagnosticEvaluation {
  readonly decision: TakramMipDiagnosticDecision;
  readonly patchAuthorized: false;
  readonly healthy: TakramMipDiagnosticPopulationSummary;
  readonly candidates: readonly TakramMipDiagnosticPopulationSummary[];
  readonly qualifyingSecondaryScale: 80 | 160 | null;
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? null;
}

function hasFlag(flags: number, bit: number) {
  return (Math.round(flags) & bit) !== 0;
}

export function summarizeTakramMipDiagnosticPopulation(
  population: TakramMipDiagnosticPopulationInput
): TakramMipDiagnosticPopulationSummary {
  const pixels = new Set<string>();
  const opacityByPixel = new Map<string, number>();
  const mipExcess: number[] = [];
  const actualMipFormulaErrors: number[] = [];
  let validSampleCount = 0;
  let roughWeatherHitCount = 0;
  let primaryHitCount = 0;

  for (const frame of population.frames) {
    if (frame.records.length % TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE !== 0) {
      throw new Error("Takram mip diagnostic record buffer has an invalid stride.");
    }
    for (let offset = 0; offset < frame.records.length;
      offset += TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE) {
      const flags = frame.records[offset + 7] ?? 0;
      if (!hasFlag(flags, 1)) continue;
      const pixelIndex = Math.round(frame.records[offset] ?? -1);
      const rayDistanceMeters = frame.records[offset + 2] ?? Number.NaN;
      const rayStartTexelsPerPixel = frame.records[offset + 3] ?? Number.NaN;
      const actualMip = frame.records[offset + 4] ?? Number.NaN;
      const counterfactualMip = frame.records[offset + 5] ?? Number.NaN;
      const opacity = frame.records[offset + 8] ?? Number.NaN;
      if (pixelIndex < 0 || !Number.isFinite(rayDistanceMeters) ||
        !Number.isFinite(rayStartTexelsPerPixel) || !Number.isFinite(actualMip) ||
        !Number.isFinite(counterfactualMip) || !Number.isFinite(opacity)) {
        continue;
      }
      const pixelKey = `${frame.nativeFrame}:${pixelIndex}`;
      pixels.add(pixelKey);
      if (!opacityByPixel.has(pixelKey)) opacityByPixel.set(pixelKey, opacity);
      validSampleCount += 1;
      if (hasFlag(flags, 2)) roughWeatherHitCount += 1;
      if (hasFlag(flags, 4)) primaryHitCount += 1;
      mipExcess.push(actualMip - counterfactualMip);
      const nativeFormulaMip = Math.log2(Math.max(
        1,
        rayStartTexelsPerPixel + rayDistanceMeters * 1e-5
      ));
      actualMipFormulaErrors.push(Math.abs(actualMip - nativeFormulaMip));
    }
  }

  const valid = pixels.size >= TAKRAM_MIP_DIAGNOSTIC_MIN_DISTINCT_PIXELS &&
    validSampleCount >= TAKRAM_MIP_DIAGNOSTIC_MIN_VALID_SAMPLES;
  const mipExcessAtLeastOneFraction = validSampleCount > 0
    ? mipExcess.filter((value) => value >= 1).length / validSampleCount
    : null;
  const roughWeatherHitFraction = validSampleCount > 0
    ? roughWeatherHitCount / validSampleCount
    : null;
  const mipExcessP50 = percentile(mipExcess, 0.5);
  const prematureMipThresholdPass = valid &&
    (mipExcessAtLeastOneFraction ?? 0) >= 0.75 &&
    (mipExcessP50 ?? 0) >= 1 &&
    (roughWeatherHitFraction ?? 0) >= 0.25;

  return {
    scale: population.scale,
    valid,
    distinctPixelCount: pixels.size,
    validSampleCount,
    roughWeatherHitFraction,
    primaryHitFraction: validSampleCount > 0 ? primaryHitCount / validSampleCount : null,
    preTemporalOpacityP75: percentile(Array.from(opacityByPixel.values()), 0.75),
    mipExcessP50,
    mipExcessAtLeastOneFraction,
    actualMipFormulaErrorP95: percentile(actualMipFormulaErrors, 0.95),
    prematureMipThresholdPass
  };
}

export function evaluateTakramMipDiagnostic(input: {
  healthy: TakramMipDiagnosticPopulationInput;
  candidates: readonly TakramMipDiagnosticPopulationInput[];
}): TakramMipDiagnosticEvaluation {
  const healthy = summarizeTakramMipDiagnosticPopulation(input.healthy);
  const candidates = input.candidates.map(summarizeTakramMipDiagnosticPopulation);
  const base = { healthy, candidates, patchAuthorized: false as const };
  const candidateScales = input.candidates.map((candidate) => candidate.scale);
  const expectedCandidateScales: readonly TakramMipDiagnosticCandidateScale[] = [80, 120, 160];
  const candidateSetValid = candidateScales.length === expectedCandidateScales.length &&
    expectedCandidateScales.every((scale) =>
      candidateScales.filter((candidateScale) => candidateScale === scale).length === 1
    );
  if (!candidateSetValid) {
    return {
      ...base,
      decision: "MIP_DIAGNOSTIC_INVALID_CANDIDATE_SET",
      qualifyingSecondaryScale: null
    };
  }
  if (!healthy.valid || candidates.some((candidate) => !candidate.valid)) {
    return {
      ...base,
      decision: "MIP_DIAGNOSTIC_INCONCLUSIVE_EMPTY_POPULATION",
      qualifyingSecondaryScale: null
    };
  }
  if ((healthy.roughWeatherHitFraction ?? 0) < 0.25 ||
    (healthy.preTemporalOpacityP75 ?? 0) < 0.05) {
    return {
      ...base,
      decision: "MIP_DIAGNOSTIC_INVALID_HEALTHY_REFERENCE",
      qualifyingSecondaryScale: null
    };
  }
  const central = candidates.find((candidate) => candidate.scale === 120);
  const qualifyingSecondary = candidates.find((candidate) =>
    (candidate.scale === 80 || candidate.scale === 160) &&
    candidate.prematureMipThresholdPass
  );
  if (!central?.prematureMipThresholdPass || !qualifyingSecondary) {
    return {
      ...base,
      decision: "MIP_CAUSAL_HYPOTHESIS_REJECTED",
      qualifyingSecondaryScale: null
    };
  }
  return {
    ...base,
    decision: "MIP_CAUSAL_THRESHOLD_PASS_PATCH_A_B_REQUIRES_AUTHORIZATION",
    qualifyingSecondaryScale: qualifyingSecondary.scale as 80 | 160
  };
}
