export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export const TAKRAM_CLOUD_SCALE_VALUES = Object.freeze([80, 120, 160] as const);

export const TAKRAM_CLOUD_SCALE_COVERAGE = Object.freeze({
  parity: 0.3,
  presentation: 0.55
} as const);

const DEFAULT_DENSITY_PROFILE = {
  constantTerm: 0.25,
  exponent: 0,
  expTerm: 0,
  linearTerm: 0.75
} as const;

/**
 * Project-owned literal copy of the @takram/three-clouds 0.7.6 high preset.
 * Runtime code derives from this immutable value instead of importing the
 * package's mutable CloudLayers.DEFAULT or quality preset singleton.
 */
export const TAKRAM_CLOUD_SCALE_DEFAULTS = deepFreeze({
  source: {
    package: "@takram/three-clouds",
    qualityPreset: "high",
    version: "0.7.6"
  },
  shapeRepeat: 0.0003,
  shapeDetailRepeat: 0.006,
  turbulenceDisplacement: 350,
  layers: [
    {
      altitude: 750,
      channel: "r",
      coverageFilterWidth: 0.6,
      densityProfile: { ...DEFAULT_DENSITY_PROFILE },
      densityScale: 0.2,
      height: 650,
      shadow: true,
      shapeAlteringBias: 0.35,
      shapeAmount: 1,
      shapeDetailAmount: 1,
      weatherExponent: 1
    },
    {
      altitude: 1_000,
      channel: "g",
      coverageFilterWidth: 0.6,
      densityProfile: { ...DEFAULT_DENSITY_PROFILE },
      densityScale: 0.2,
      height: 1_200,
      shadow: true,
      shapeAlteringBias: 0.35,
      shapeAmount: 1,
      shapeDetailAmount: 1,
      weatherExponent: 1
    },
    {
      altitude: 7_500,
      channel: "b",
      coverageFilterWidth: 0.5,
      densityProfile: { ...DEFAULT_DENSITY_PROFILE },
      densityScale: 0.003,
      height: 500,
      shadow: false,
      shapeAlteringBias: 0.35,
      shapeAmount: 0.4,
      shapeDetailAmount: 0,
      weatherExponent: 1
    },
    {
      altitude: 0,
      channel: "a",
      coverageFilterWidth: 0.6,
      densityProfile: { ...DEFAULT_DENSITY_PROFILE },
      densityScale: 0.2,
      height: 0,
      shadow: false,
      shapeAlteringBias: 0.35,
      shapeAmount: 1,
      shapeDetailAmount: 1,
      weatherExponent: 1
    }
  ],
  clouds: {
    maxIterationCount: 500,
    minStepSize: 50,
    maxStepSize: 1_000,
    maxRayDistance: 200_000,
    perspectiveStepScale: 1.01,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minTransmittance: 1e-2,
    maxIterationCountToGround: 3,
    maxIterationCountToSun: 2,
    minSecondaryStepSize: 100,
    secondaryStepScale: 2,
    maxShadowFilterRadius: 6,
    maxShadowLengthIterationCount: 500,
    minShadowLengthStepSize: 50,
    maxShadowLengthRayDistance: 200_000
  },
  shadow: {
    cascadeCount: 3,
    mapSize: [512, 512] as const,
    maxIterationCount: 50,
    minStepSize: 100,
    maxStepSize: 1_000,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minTransmittance: 1e-4
  }
} as const);
