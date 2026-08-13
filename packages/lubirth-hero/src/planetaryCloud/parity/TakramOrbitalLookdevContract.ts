import {
  deepFreeze,
  type DeepReadonly,
  TAKRAM_CLOUD_SCALE_DEFAULTS
} from "./TakramCloudScaleDefaults";
import type { TakramCloudScaleLayer } from "./TakramCloudScaleContract";
import {
  resolveTakramOrbitalStepScale,
  type TakramOrbitalStepScaleMode
} from "./TakramOrbitalSamplingCausality";
import {
  resolveTakramOrbitalProductionStepScale,
  type TakramOrbitalProductionStepCandidate
} from "./TakramOrbitalProductionSampling";

export const TAKRAM_ORBITAL_PRESETS = Object.freeze([
  "native",
  "h40",
  "h80",
  "h120"
] as const);
export const TAKRAM_ORBITAL_COVERAGES = Object.freeze([
  0.3,
  0.4,
  0.45,
  0.55
] as const);
export const TAKRAM_ORBITAL_VERTICAL_SCALES = Object.freeze([1, 2, 4] as const);
export const TAKRAM_ORBITAL_OPTICAL_DEPTH_SCALES = Object.freeze([
  0.75,
  1,
  1.5
] as const);

export type TakramOrbitalPreset = (typeof TAKRAM_ORBITAL_PRESETS)[number];
export type TakramOrbitalCoverage = (typeof TAKRAM_ORBITAL_COVERAGES)[number];
export type TakramOrbitalVerticalScale =
  (typeof TAKRAM_ORBITAL_VERTICAL_SCALES)[number];
export type TakramOrbitalOpticalDepthScale =
  (typeof TAKRAM_ORBITAL_OPTICAL_DEPTH_SCALES)[number];
export type TakramOrbitalLookdevClassification =
  "TAKRAM_ORBITAL_PARAMETER_LOOKDEV";
export type TakramOrbitalCubeFaceDiagnosticDecision =
  | "CUBE_FACE_DIAGNOSTIC_PASS"
  | "HARD_ARTIFACT_FAIL";

export type TakramOrbitalLookdevSamplingPolicyInput =
  | Readonly<{
      kind: "causal";
      mode: TakramOrbitalStepScaleMode;
    }>
  | Readonly<{
      kind: "production";
      candidate: TakramOrbitalProductionStepCandidate;
    }>;

export type TakramOrbitalLookdevSamplingPolicy =
  | Readonly<{
      kind: "causal";
      mode: TakramOrbitalStepScaleMode;
      perspectiveStepScale: number;
    }>
  | Readonly<{
      kind: "production";
      candidate: TakramOrbitalProductionStepCandidate;
      perspectiveStepScale: number;
    }>;

export interface TakramOrbitalLookdevInput {
  coverage: TakramOrbitalCoverage;
  opticalDepthScale: TakramOrbitalOpticalDepthScale;
  preset: TakramOrbitalPreset;
  samplingPolicy?: TakramOrbitalLookdevSamplingPolicyInput;
  /** Historical causal compatibility; rejected when samplingPolicy is present. */
  stepScaleMode?: TakramOrbitalStepScaleMode;
  verticalScale: TakramOrbitalVerticalScale;
}

export interface TakramOrbitalCloudsContract {
  accuratePhaseFunction: false;
  accurateSunSkyLight: true;
  hazeAbsorptionCoefficient: number;
  hazeDensityScale: number;
  hazeExponent: number;
  hazeScatteringCoefficient: number;
  maxIterationCount: number;
  maxIterationCountToGround: number;
  maxIterationCountToSun: number;
  maxRayDistance: number;
  maxShadowFilterRadius: number;
  maxShadowLengthIterationCount: number;
  maxShadowLengthRayDistance: number;
  maxStepSize: number;
  minDensity: number;
  minExtinction: number;
  minSecondaryStepSize: number;
  minShadowLengthStepSize: number;
  minStepSize: number;
  minTransmittance: number;
  multiScatteringOctaves: 8;
  perspectiveStepScale: number;
  secondaryStepScale: number;
}

export interface TakramOrbitalShadowContract {
  cascadeCount: number;
  mapSize: readonly [number, number];
  maxIterationCount: number;
  maxStepSize: number;
  minDensity: number;
  minExtinction: number;
  minStepSize: number;
  minTransmittance: number;
}

export interface TakramOrbitalLightingContract {
  absorptionCoefficient: number;
  groundBounceScale: number;
  powderExponent: number;
  powderScale: number;
  scatterAnisotropy1: number;
  scatterAnisotropy2: number;
  scatterAnisotropyMix: number;
  scatteringCoefficient: number;
  skyLightScale: number;
}

export interface TakramOrbitalRendererContract {
  accuratePhaseFunction: false;
  accurateSunSkyLight: true;
  haze: true;
  lightShafts: true;
  multiScatteringOctaves: 8;
  qualityPreset: "high";
  resolutionScale: 1;
  shapeDetail: true;
  temporalUpscale: true;
  turbulence: true;
}

export interface TakramOrbitalLookdevContract {
  classification: TakramOrbitalLookdevClassification;
  clouds: TakramOrbitalCloudsContract;
  coverage: TakramOrbitalCoverage;
  effectiveTurbulenceRepeat: readonly [number, number];
  layers: readonly TakramCloudScaleLayer[];
  lighting: TakramOrbitalLightingContract;
  localWeatherRepeat: readonly [number, number];
  mipDistancePatch: Readonly<{ active: false; scale: 1 }>;
  opticalDepthScale: TakramOrbitalOpticalDepthScale;
  presentationScale: 1 | 40 | 80 | 120;
  preset: TakramOrbitalPreset;
  renderer: TakramOrbitalRendererContract;
  samplingPolicy: TakramOrbitalLookdevSamplingPolicy;
  schemaVersion: 1;
  shadow: TakramOrbitalShadowContract;
  shapeDetailRepeat: number;
  shapeDetailWavelengthMeters: number;
  shapeRepeat: number;
  shapeWavelengthMeters: number;
  turbulenceDisplacement: number;
  turbulenceRepeat: readonly [20, 20];
  verticalScale: TakramOrbitalVerticalScale;
}

const MORPHOLOGY_PRESETS = deepFreeze({
  native: {
    presentationScale: 1,
    shapeRepeat: 0.0003,
    shapeDetailRepeat: 0.006,
    localWeatherRepeat: [100, 100]
  },
  h40: {
    presentationScale: 40,
    shapeRepeat: 0.0000075,
    shapeDetailRepeat: 0.00015,
    localWeatherRepeat: [2.5, 2.5]
  },
  h80: {
    presentationScale: 80,
    shapeRepeat: 0.00000375,
    shapeDetailRepeat: 0.000075,
    localWeatherRepeat: [1.25, 1.25]
  },
  h120: {
    presentationScale: 120,
    shapeRepeat: 0.0000025,
    shapeDetailRepeat: 0.00005,
    localWeatherRepeat: [100 / 120, 100 / 120]
  }
} as const);

const NATIVE_LIGHTING = Object.freeze({
  absorptionCoefficient: 0,
  groundBounceScale: 1,
  powderExponent: 150,
  powderScale: 0.8,
  scatterAnisotropy1: 0.7,
  scatterAnisotropy2: -0.2,
  scatterAnisotropyMix: 0.5,
  scatteringCoefficient: 1,
  skyLightScale: 1
} as const);

const NATIVE_RENDERER = Object.freeze({
  accuratePhaseFunction: false,
  accurateSunSkyLight: true,
  haze: true,
  lightShafts: true,
  multiScatteringOctaves: 8,
  qualityPreset: "high",
  resolutionScale: 1,
  shapeDetail: true,
  temporalUpscale: true,
  turbulence: true
} as const);

export function parseTakramOrbitalPreset(
  value: string | null
): TakramOrbitalPreset | null {
  return value !== null && TAKRAM_ORBITAL_PRESETS.includes(
    value as TakramOrbitalPreset
  )
    ? value as TakramOrbitalPreset
    : null;
}

export function parseTakramOrbitalCoverage(
  value: string | null
): TakramOrbitalCoverage | null {
  if (value !== "0.3" && value !== "0.4" && value !== "0.45" && value !== "0.55") {
    return null;
  }
  return Number(value) as TakramOrbitalCoverage;
}

export function parseTakramOrbitalVerticalScale(
  value: string | null
): TakramOrbitalVerticalScale | null {
  if (value !== "1" && value !== "2" && value !== "4") return null;
  return Number(value) as TakramOrbitalVerticalScale;
}

export function parseTakramOrbitalOpticalDepthScale(
  value: string | null
): TakramOrbitalOpticalDepthScale | null {
  if (value !== "0.75" && value !== "1" && value !== "1.5") return null;
  return Number(value) as TakramOrbitalOpticalDepthScale;
}

export function classifyTakramOrbitalCubeFaceDiagnostic(input: {
  faceBoundaryVisible: boolean;
  finiteUv: boolean;
  wrapDiscontinuityVisible: boolean;
}): TakramOrbitalCubeFaceDiagnosticDecision {
  return input.finiteUv && !input.faceBoundaryVisible &&
    !input.wrapDiscontinuityVisible
    ? "CUBE_FACE_DIAGNOSTIC_PASS"
    : "HARD_ARTIFACT_FAIL";
}

export function resolveTakramOrbitalLookdevContract(
  input: TakramOrbitalLookdevInput
): DeepReadonly<TakramOrbitalLookdevContract> {
  if (input.samplingPolicy !== undefined && input.stepScaleMode !== undefined) {
    throw new Error("samplingPolicy cannot be combined with stepScaleMode");
  }
  const morphology = MORPHOLOGY_PRESETS[input.preset];
  const samplingPolicyInput = input.samplingPolicy ?? {
    kind: "causal" as const,
    mode: input.stepScaleMode ?? "control"
  };
  const samplingPolicy: TakramOrbitalLookdevSamplingPolicy =
    samplingPolicyInput.kind === "causal"
      ? {
          kind: "causal",
          mode: samplingPolicyInput.mode,
          perspectiveStepScale: resolveTakramOrbitalStepScale(
            samplingPolicyInput.mode
          )
        }
      : {
          kind: "production",
          candidate: samplingPolicyInput.candidate,
          perspectiveStepScale: resolveTakramOrbitalProductionStepScale(
            samplingPolicyInput.candidate
          )
        };
  const verticalOpticalScale = input.opticalDepthScale / input.verticalScale;
  const layers = TAKRAM_CLOUD_SCALE_DEFAULTS.layers.map((layer) => ({
    ...layer,
    densityProfile: { ...layer.densityProfile },
    densityScale: layer.densityScale * verticalOpticalScale,
    height: layer.height * input.verticalScale
  }));
  const clouds = TAKRAM_CLOUD_SCALE_DEFAULTS.clouds;
  const shadow = TAKRAM_CLOUD_SCALE_DEFAULTS.shadow;
  const turbulenceRepeat = [20, 20] as [20, 20];
  const localWeatherRepeat = [
    morphology.localWeatherRepeat[0],
    morphology.localWeatherRepeat[1]
  ] as [number, number];

  return deepFreeze({
    classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
    clouds: {
      ...clouds,
      accuratePhaseFunction: false,
      accurateSunSkyLight: true,
      hazeAbsorptionCoefficient: 0.5,
      hazeDensityScale: 3e-5,
      hazeExponent: 1e-3,
      hazeScatteringCoefficient: 0.9,
      minExtinction: clouds.minExtinction * verticalOpticalScale,
      multiScatteringOctaves: 8,
      perspectiveStepScale: samplingPolicy.perspectiveStepScale
    },
    coverage: input.coverage,
    effectiveTurbulenceRepeat: [
      localWeatherRepeat[0] * turbulenceRepeat[0],
      localWeatherRepeat[1] * turbulenceRepeat[1]
    ] as [number, number],
    layers,
    lighting: { ...NATIVE_LIGHTING },
    localWeatherRepeat,
    mipDistancePatch: { active: false, scale: 1 },
    opticalDepthScale: input.opticalDepthScale,
    presentationScale: morphology.presentationScale,
    preset: input.preset,
    renderer: { ...NATIVE_RENDERER },
    samplingPolicy,
    schemaVersion: 1,
    shadow: {
      ...shadow,
      mapSize: [...shadow.mapSize] as [number, number],
      minExtinction: shadow.minExtinction * verticalOpticalScale
    },
    shapeDetailRepeat: morphology.shapeDetailRepeat,
    shapeDetailWavelengthMeters: 1 / morphology.shapeDetailRepeat,
    shapeRepeat: morphology.shapeRepeat,
    shapeWavelengthMeters: 1 / morphology.shapeRepeat,
    turbulenceDisplacement: TAKRAM_CLOUD_SCALE_DEFAULTS.turbulenceDisplacement,
    turbulenceRepeat,
    verticalScale: input.verticalScale
  });
}
