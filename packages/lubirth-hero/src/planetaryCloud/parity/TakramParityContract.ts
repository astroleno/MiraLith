import { Ellipsoid } from "@takram/three-geospatial";
import {
  parseTakramCloudCoverageMode,
  parseTakramCloudScale,
  parseTakramStockWeatherControlMode,
  type TakramCloudCoverageMode,
  type TakramCloudScale,
  type TakramCloudScaleAtmosphereDomain,
  type TakramCloudScaleContract,
  type TakramStockWeatherControlContract,
  type TakramStockWeatherControlMode
} from "./TakramCloudScaleContract";
import type {
  TakramCloudScaleRuntimeDrift,
  TakramCloudScaleRuntimeReadback
} from "./TakramCloudScaleRuntime";
import {
  parseTakramOrbitalCoverage,
  parseTakramOrbitalOpticalDepthScale,
  parseTakramOrbitalPreset,
  parseTakramOrbitalVerticalScale,
  type TakramOrbitalCoverage,
  type TakramOrbitalOpticalDepthScale,
  type TakramOrbitalPreset,
  type TakramOrbitalLookdevContract,
  type TakramOrbitalVerticalScale
} from "./TakramOrbitalLookdevContract";
import type {
  TakramOrbitalLookdevRuntimeDrift,
  TakramOrbitalLookdevRuntimeReadback
} from "./TakramOrbitalLookdevRuntime";
import {
  parseTakramOrbitalStepScaleMode,
  type TakramOrbitalStepScaleMode
} from "./TakramOrbitalSamplingCausality";
import {
  parseTakramOrbitalProductionStepCandidate,
  type TakramOrbitalProductionStepCandidate
} from "./TakramOrbitalProductionSampling";
import type {
  TakramLookdevSetupState
} from "./TakramOrbitalLookdevIdentity";
import {
  TAKRAM_V3_MORPHOLOGY_BASELINE,
  TAKRAM_V3_MORPHOLOGY_SPHERICAL_UV,
  resolveTakramV3MorphologyCandidate,
  resolveTakramV3MorphologyView,
  type TakramV3MorphologyCandidateId,
  type TakramV3MorphologyViewId
} from "./TakramV3MorphologyContract";
import type { TakramV3MorphologyScaleAudit } from "./TakramV3MorphologyScaleAudit";
import type { TakramShaderInstrumentationAudit } from "./TakramSampleCountInstrumentation";
import type { TakramOrbitalGpuSubmissionAudit } from
  "./TakramOrbitalGpuSubmissionInstrumentation";
import type { TakramOrbitalGpuMeasurementMode } from
  "./TakramOrbitalGpuProfiler";

export const TAKRAM_PARITY_BOTTOM_RADIUS_M = 6_360_000;
export const TAKRAM_PARITY_ALTITUDE_LADDER_MAX_M = 20_000_000;
export const TAKRAM_PARITY_ELLIPSOID = new Ellipsoid(
  TAKRAM_PARITY_BOTTOM_RADIUS_M,
  TAKRAM_PARITY_BOTTOM_RADIUS_M,
  TAKRAM_PARITY_BOTTOM_RADIUS_M
);

export type TakramParityInput = "stock" | "v3";
export type TakramParityView = "control" | "opening";
export type TakramWeatherAdapterComparison = "explicit";
export type TakramParityCoordinateMode = "lubirth-bridge" | "upstream-ecef";
export type TakramParityDiagnostic =
  | "full"
  | "altitude-ladder"
  | "altitude-ladder-cloud-off"
  | "bsm-off"
  | "depth-off"
  | "density-debug"
  | "uv-debug"
  | "history-reset-first"
  | "cloud-raw"
  | "cloud-raw-off"
  | "sample-count-debug"
  | "primary-march-debug"
  | "stage-readback"
  | "aerial-final"
  | "mip-diagnostic";
export const TAKRAM_ORBITAL_FEATURE_STATES = Object.freeze([
  "native",
  "light-shafts-off",
  "bsm-off"
] as const);
export const TAKRAM_ORBITAL_OUTPUTS = Object.freeze([
  "full",
  "cloud-raw",
  "cloud-raw-off",
  "sample-count-debug",
  "primary-march-debug",
  "stage-readback",
  "aerial-final"
] as const);
export type TakramOrbitalFeatureState =
  (typeof TAKRAM_ORBITAL_FEATURE_STATES)[number];
export type TakramOrbitalOutput = (typeof TAKRAM_ORBITAL_OUTPUTS)[number];
export type UpstreamControlDecision = "PASS" | "UPSTREAM_CONTROL_FAIL";
export type StockOpeningDecision =
  | "PASS"
  | "STOCK_OPENING_LIMITATION"
  | "TAKRAM_NATIVE_OPENING_FAIL";
export type V3AdapterDecision = "PASS" | "V3_ADAPTER_VISUAL_FAIL";

export const TAKRAM_PARITY_CONTROL = Object.freeze({
  altitudeMeters: 2_500,
  coverage: 0.4,
  fovDegrees: 50,
  pitchDegrees: -8,
  sunAzimuthDegrees: 135,
  sunElevationDegrees: 25
});

export type TakramParityRouteQuery = {
  cloudCoverageMode?: TakramCloudCoverageMode;
  cloudScale?: TakramCloudScale;
  stockWeatherMode?: TakramStockWeatherControlMode;
  diagnostic: TakramParityDiagnostic;
  input: TakramParityInput;
  progress: number;
  view: TakramParityView;
  altitudeMeters?: number;
  morphologyCandidate?: TakramV3MorphologyCandidateId;
  morphologyView?: TakramV3MorphologyViewId;
  opticalDepthScale?: TakramOrbitalOpticalDepthScale;
  orbitalCoverage?: TakramOrbitalCoverage;
  orbitalPreset?: TakramOrbitalPreset;
  orbitalFeatureState?: TakramOrbitalFeatureState;
  orbitalOutput?: TakramOrbitalOutput;
  orbitalProductionStep?: TakramOrbitalProductionStepCandidate;
  orbitalStepScale?: TakramOrbitalStepScaleMode;
  verticalScale?: TakramOrbitalVerticalScale;
  weatherAdapterComparison?: TakramWeatherAdapterComparison;
};

export function isTakramParityAltitudeLadderDiagnostic(
  diagnostic: TakramParityDiagnostic
) {
  return diagnostic === "altitude-ladder" ||
    diagnostic === "altitude-ladder-cloud-off";
}

export function parseTakramOrbitalFeatureState(
  value: string | null
): TakramOrbitalFeatureState | null {
  return value !== null && TAKRAM_ORBITAL_FEATURE_STATES.includes(
    value as TakramOrbitalFeatureState
  )
    ? value as TakramOrbitalFeatureState
    : null;
}

export function parseTakramOrbitalOutput(
  value: string | null
): TakramOrbitalOutput | null {
  return value !== null && TAKRAM_ORBITAL_OUTPUTS.includes(
    value as TakramOrbitalOutput
  )
    ? value as TakramOrbitalOutput
    : null;
}

export function isTakramOrbitalFeatureOutputSupported(input: Readonly<{
  featureState: TakramOrbitalFeatureState;
  output: TakramOrbitalOutput;
}>): boolean {
  if (input.output === "aerial-final") return input.featureState === "native";
  if (input.featureState === "bsm-off") {
    return [
      "full",
      "sample-count-debug",
      "primary-march-debug",
      "stage-readback"
    ].includes(input.output);
  }
  return true;
}

export function isTakramOrbitalGpuOutputAuthorized(
  output: TakramOrbitalOutput
): boolean {
  return output === "full";
}

export interface TakramOrbitalProductionProfilerStartRequest {
  readonly candidateId: string;
  readonly committedWinnerId: string;
  readonly featureState: "native" | "light-shafts-off";
  readonly lookdevMountKey: string;
  readonly measurementMode:
    | "total-only-time-elapsed"
    | "stage-only-sequential-time-elapsed";
  readonly runtimeEvidenceEpoch: string;
  readonly targetSampleCount: 8 | 120;
  readonly warmupFrameCount: 8 | 120;
}

export interface TakramOrbitalProductionProfilerRuntimeState {
  readonly activePopulation: boolean;
  readonly combinedPassAuditValid: boolean;
  readonly featureState: TakramOrbitalFeatureState;
  readonly lookdevMountKey: string;
  readonly output: TakramOrbitalOutput;
  readonly productionCandidate: TakramOrbitalProductionStepCandidate | null;
  readonly runtimeEvidenceEpoch: string | null;
}

export type TakramOrbitalProductionProfilerAuthorizationReason =
  | "candidate-is-not-committed-stock-winner"
  | "candidate-is-not-mounted-policy"
  | "lookdev-mount-key-mismatch"
  | "runtime-evidence-epoch-mismatch"
  | "gpu-output-not-full"
  | "feature-state-mismatch"
  | "unsupported-measurement-mode"
  | "gpu-population-already-active"
  | "combined-pass-audit-failed"
  | "invalid-profiler-population-shape";

export function authorizeTakramOrbitalProductionProfilerStart(input: Readonly<{
  request: TakramOrbitalProductionProfilerStartRequest;
  runtime: TakramOrbitalProductionProfilerRuntimeState;
}>): Readonly<{
  authorized: boolean;
  reason: TakramOrbitalProductionProfilerAuthorizationReason | null;
}> {
  const { request, runtime } = input;
  let reason: TakramOrbitalProductionProfilerAuthorizationReason | null = null;
  if (request.candidateId !== request.committedWinnerId) {
    reason = "candidate-is-not-committed-stock-winner";
  } else if (request.candidateId !== runtime.productionCandidate) {
    reason = "candidate-is-not-mounted-policy";
  } else if (request.lookdevMountKey !== runtime.lookdevMountKey) {
    reason = "lookdev-mount-key-mismatch";
  } else if (!request.runtimeEvidenceEpoch ||
    request.runtimeEvidenceEpoch !== runtime.runtimeEvidenceEpoch) {
    reason = "runtime-evidence-epoch-mismatch";
  } else if (runtime.output !== "full") {
    reason = "gpu-output-not-full";
  } else if (request.featureState !== runtime.featureState) {
    reason = "feature-state-mismatch";
  } else if (request.measurementMode !== "total-only-time-elapsed" &&
    request.measurementMode !== "stage-only-sequential-time-elapsed") {
    reason = "unsupported-measurement-mode";
  } else if (runtime.activePopulation) {
    reason = "gpu-population-already-active";
  } else if (!runtime.combinedPassAuditValid) {
    reason = "combined-pass-audit-failed";
  } else if ((request.targetSampleCount !== 8 &&
      request.targetSampleCount !== 120) ||
    request.targetSampleCount !== request.warmupFrameCount) {
    reason = "invalid-profiler-population-shape";
  }
  return Object.freeze({ authorized: reason === null, reason });
}

export function shouldCaptureTakramHistoryFirstFrame(input: {
  diagnostic: string;
  nativeFrameCount: number;
  alreadyCaptured: boolean;
}) {
  return input.diagnostic === "history-reset-first" &&
    input.nativeFrameCount === 1 &&
    !input.alreadyCaptured;
}

export function shouldCaptureTakramMatchedTemporalFrame(input: {
  nativeFrameCount: number;
  targetNativeFrameCount: number;
  alreadyCaptured: boolean;
}) {
  return input.nativeFrameCount === input.targetNativeFrameCount &&
    !input.alreadyCaptured;
}

export interface TakramParityHistoryEpochInput {
  assetGeneration: number;
  atmosphereGeneration: number;
  cameraEarthTransformHash: string;
  cloudCoverage: number | null;
  cloudCoverageMode: string | null;
  cloudScale: number | null;
  coordinateMode: string;
  diagnostic: string;
  input: string;
  localWeatherHash: string | null;
  mipDistancePatchActive: boolean | null;
  mipDistanceRuntimeIdentity: string | null;
  morphologyCandidate: string | null;
  morphologyView: string | null;
  progress: number;
  rendererConfigurationHash: string | null;
  stockWeatherMode: string | null;
  view: string;
}

export function buildTakramParityHistoryEpoch(input: TakramParityHistoryEpochInput) {
  return JSON.stringify([
    input.assetGeneration,
    input.atmosphereGeneration,
    input.cameraEarthTransformHash,
    input.cloudScale,
    input.cloudCoverageMode,
    input.cloudCoverage,
    input.coordinateMode,
    input.diagnostic,
    input.input,
    input.localWeatherHash,
    input.mipDistancePatchActive,
    input.mipDistanceRuntimeIdentity,
    input.morphologyCandidate,
    input.morphologyView,
    input.progress,
    input.rendererConfigurationHash,
    input.stockWeatherMode,
    input.view
  ]);
}

function hashFnv1a64(value: string) {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `fnv1a-64:${hash.toString(16).padStart(16, "0")}`;
}

export function hashTakramParityCameraEarthTransform(input: {
  cameraMatrixWorld: readonly number[];
  cameraProjectionMatrix: readonly number[];
  earthMatrixWorld: readonly number[];
}) {
  return hashFnv1a64(JSON.stringify([
    input.cameraMatrixWorld,
    input.cameraProjectionMatrix,
    input.earthMatrixWorld
  ]));
}

export function hashTakramParityHistoryEpoch(epoch: string) {
  return hashFnv1a64(epoch);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export function resolveTakramParityTemporalFrameMetadata(input: {
  cloudsFrame: number;
  resolveFrame: number;
  shadowFrame: number;
  stbnDepth: number;
  historyEpoch: string;
}) {
  const stbnDepth = Number.isInteger(input.stbnDepth) && input.stbnDepth > 0
    ? input.stbnDepth
    : 1;
  return {
    cloudsFrame: input.cloudsFrame,
    resolveFrame: input.resolveFrame,
    shadowFrame: input.shadowFrame,
    temporalJitterIndex: positiveModulo(input.cloudsFrame, 16),
    stbnSliceIndex: positiveModulo(input.cloudsFrame, stbnDepth),
    historyEpochHash: hashTakramParityHistoryEpoch(input.historyEpoch),
    frameLockPass: input.cloudsFrame === input.resolveFrame &&
      input.cloudsFrame === input.shadowFrame
  };
}

export interface TakramParityHistoryFirstFrameCapture {
  dataUrl: string;
  height: number;
  nativeFrameCount: 1;
  width: number;
}

export interface TakramParityMatchedTemporalFrameCapture {
  dataUrl: string;
  height: number;
  nativeFrameCount: number;
  width: number;
  cloudsFrame: number;
  resolveFrame: number;
  shadowFrame: number;
  temporalJitterIndex: number;
  stbnSliceIndex: number;
  historyEpochHash: string;
  frameLockPass: boolean;
}

export type TakramParityRouteQueryResult =
  | { ok: true; value: TakramParityRouteQuery }
  | {
    ok: false;
    reason:
      | "control-requires-stock"
      | "conflicting-orbital-sampling-policies"
      | "conflicting-orbital-lookdev-contracts"
      | "cloud-coverage-requires-scale"
      | "cloud-scale-requires-coverage-mode"
      | "cloud-scale-requires-opening"
      | "conflicting-scale-contracts"
      | "morphology-candidate-requires-view"
      | "morphology-requires-v3"
      | "mip-diagnostic-requires-stock"
      | "incomplete-orbital-lookdev"
      | "unknown-cloud-coverage-mode"
      | "unknown-cloud-scale"
      | "unknown-stock-weather-mode"
      | "stock-weather-mode-requires-scale"
      | "stock-weather-mode-requires-stock"
      | "orbital-lookdev-requires-opening"
      | "unsupported-orbital-feature-output"
      | "unknown-optical-depth-scale"
      | "unknown-orbital-coverage"
      | "unknown-orbital-feature-state"
      | "unknown-orbital-preset"
      | "unknown-orbital-production-step"
      | "unknown-orbital-step-scale"
      | "unknown-vertical-scale"
      | "unknown-weather-adapter-comparison"
      | "weather-adapter-comparison-requires-orbital-lookdev"
      | "unknown-morphology-candidate"
      | "unknown-morphology-view";
  };

export function resolveTakramParityRouteQuery(
  input: Pick<URLSearchParams, "get">
): TakramParityRouteQueryResult {
  const requestedInput = input.get("input");
  const requestedView = input.get("view");
  const requestedDiagnostic = input.get("diagnostic");
  const requestedCloudScale = input.get("cloudScale");
  const requestedCloudCoverage = input.get("cloudCoverage");
  const requestedStockWeather = input.get("stockWeather");
  const requestedMorphologyCandidate = input.get("morphologyCandidate");
  const requestedMorphologyView = input.get("morphologyView");
  const requestedOrbitalPreset = input.get("orbitalPreset");
  const requestedOrbitalCoverage = input.get("orbitalCoverage");
  const requestedOrbitalFeatureState = input.get("orbitalFeatureState");
  const requestedOrbitalProductionStep = input.get("orbitalProductionStep");
  const requestedOrbitalStepScale = input.get("orbitalStepScale");
  const requestedVerticalScale = input.get("verticalScale");
  const requestedOpticalDepthScale = input.get("opticalDepthScale");
  const requestedWeatherAdapterComparison = input.get("weatherAdapterComparison");
  const parsedProgress = Number.parseFloat(input.get("progress") ?? "0");
  const parsedAltitudeMeters = Number.parseFloat(input.get("altitudeMeters") ?? "0");
  const diagnostic = requestedDiagnostic === "altitude-ladder" ||
    requestedDiagnostic === "altitude-ladder-cloud-off" ||
    requestedDiagnostic === "bsm-off" ||
    requestedDiagnostic === "depth-off" ||
    requestedDiagnostic === "density-debug" ||
    requestedDiagnostic === "uv-debug" ||
    requestedDiagnostic === "history-reset-first" ||
    requestedDiagnostic === "cloud-raw" ||
    requestedDiagnostic === "cloud-raw-off" ||
    requestedDiagnostic === "sample-count-debug" ||
    requestedDiagnostic === "stage-readback" ||
    requestedDiagnostic === "aerial-final" ||
    requestedDiagnostic === "mip-diagnostic"
    ? requestedDiagnostic
    : "full";
  const value: TakramParityRouteQuery = {
    diagnostic,
    input: requestedInput === "v3" ? "v3" : "stock",
    progress: Number.isFinite(parsedProgress) ? Math.max(0, Math.min(0.18, parsedProgress)) : 0,
    view: requestedView === "control" ? "control" : "opening"
  };

  const orbitalFields = [
    requestedOrbitalPreset,
    requestedOrbitalCoverage,
    requestedVerticalScale,
    requestedOpticalDepthScale
  ];
  const hasProductionRoute = requestedOrbitalProductionStep !== null;
  const hasOrbitalLookdevQuery = orbitalFields.some((entry) => entry !== null) ||
    requestedOrbitalStepScale !== null || requestedOrbitalProductionStep !== null ||
    requestedOrbitalFeatureState !== null;
  if (requestedWeatherAdapterComparison !== null &&
    requestedWeatherAdapterComparison !== "explicit") {
    return { ok: false, reason: "unknown-weather-adapter-comparison" };
  }
  if (requestedWeatherAdapterComparison !== null && !hasOrbitalLookdevQuery) {
    return {
      ok: false,
      reason: "weather-adapter-comparison-requires-orbital-lookdev"
    };
  }
  if (hasOrbitalLookdevQuery && value.view !== "opening") {
    return { ok: false, reason: "orbital-lookdev-requires-opening" };
  }
  if (requestedOrbitalPreset !== null &&
    parseTakramOrbitalPreset(requestedOrbitalPreset) === null) {
    return { ok: false, reason: "unknown-orbital-preset" };
  }
  if (requestedOrbitalCoverage !== null &&
    parseTakramOrbitalCoverage(requestedOrbitalCoverage) === null) {
    return { ok: false, reason: "unknown-orbital-coverage" };
  }
  if (requestedVerticalScale !== null &&
    parseTakramOrbitalVerticalScale(requestedVerticalScale) === null) {
    return { ok: false, reason: "unknown-vertical-scale" };
  }
  if (requestedOpticalDepthScale !== null &&
    parseTakramOrbitalOpticalDepthScale(requestedOpticalDepthScale) === null) {
    return { ok: false, reason: "unknown-optical-depth-scale" };
  }
  const orbitalProductionStep = parseTakramOrbitalProductionStepCandidate(
    requestedOrbitalProductionStep
  );
  if (requestedOrbitalProductionStep !== null && orbitalProductionStep === null) {
    return { ok: false, reason: "unknown-orbital-production-step" };
  }
  const orbitalFeatureState = parseTakramOrbitalFeatureState(
    requestedOrbitalFeatureState
  );
  if (requestedOrbitalFeatureState !== null && orbitalFeatureState === null) {
    return { ok: false, reason: "unknown-orbital-feature-state" };
  }
  if (requestedOrbitalStepScale !== null &&
    parseTakramOrbitalStepScaleMode(requestedOrbitalStepScale) === null) {
    return { ok: false, reason: "unknown-orbital-step-scale" };
  }
  if (hasProductionRoute && requestedOrbitalStepScale !== null) {
    return { ok: false, reason: "conflicting-orbital-sampling-policies" };
  }
  if (requestedOrbitalFeatureState !== null && !hasProductionRoute) {
    return { ok: false, reason: "incomplete-orbital-lookdev" };
  }
  if (hasOrbitalLookdevQuery && orbitalFields.some((entry) => entry === null)) {
    return { ok: false, reason: "incomplete-orbital-lookdev" };
  }
  if (hasOrbitalLookdevQuery && (
    requestedCloudScale !== null || requestedCloudCoverage !== null ||
    requestedMorphologyCandidate !== null || requestedMorphologyView !== null ||
    requestedStockWeather !== null
  )) {
    return { ok: false, reason: "conflicting-orbital-lookdev-contracts" };
  }
  if (hasOrbitalLookdevQuery) {
    value.orbitalPreset = parseTakramOrbitalPreset(requestedOrbitalPreset)!;
    value.orbitalCoverage = parseTakramOrbitalCoverage(requestedOrbitalCoverage)!;
    if (orbitalProductionStep !== null) {
      const output = requestedDiagnostic === null
        ? "full"
        : parseTakramOrbitalOutput(requestedDiagnostic);
      const featureState = orbitalFeatureState ?? "native";
      if (output === null || !isTakramOrbitalFeatureOutputSupported({
        featureState,
        output
      })) {
        return { ok: false, reason: "unsupported-orbital-feature-output" };
      }
      value.diagnostic = output;
      value.orbitalFeatureState = featureState;
      value.orbitalOutput = output;
      value.orbitalProductionStep = orbitalProductionStep;
    } else {
      value.orbitalStepScale = requestedOrbitalStepScale === null
        ? "control"
        : parseTakramOrbitalStepScaleMode(requestedOrbitalStepScale)!;
    }
    value.verticalScale = parseTakramOrbitalVerticalScale(requestedVerticalScale)!;
    value.opticalDepthScale = parseTakramOrbitalOpticalDepthScale(
      requestedOpticalDepthScale
    )!;
    if (requestedWeatherAdapterComparison === "explicit") {
      value.weatherAdapterComparison = "explicit";
    }
  }

  const stockWeatherMode = parseTakramStockWeatherControlMode(requestedStockWeather);
  if (requestedStockWeather !== null && stockWeatherMode === null) {
    return { ok: false, reason: "unknown-stock-weather-mode" };
  }
  if (requestedStockWeather !== null && value.input !== "stock") {
    return { ok: false, reason: "stock-weather-mode-requires-stock" };
  }
  if (requestedStockWeather !== null && requestedCloudScale === null) {
    return { ok: false, reason: "stock-weather-mode-requires-scale" };
  }

  const hasMorphologyQuery = requestedMorphologyView !== null ||
    requestedMorphologyCandidate !== null;
  const hasCloudScaleQuery = requestedCloudScale !== null ||
    requestedCloudCoverage !== null;
  if (hasCloudScaleQuery && value.view !== "opening") {
    return { ok: false, reason: "cloud-scale-requires-opening" };
  }
  if (requestedCloudScale === null && requestedCloudCoverage !== null) {
    return { ok: false, reason: "cloud-coverage-requires-scale" };
  }
  const cloudScale = parseTakramCloudScale(requestedCloudScale);
  if (requestedCloudScale !== null && cloudScale === null) {
    return { ok: false, reason: "unknown-cloud-scale" };
  }
  if (cloudScale !== null && requestedCloudCoverage === null) {
    return { ok: false, reason: "cloud-scale-requires-coverage-mode" };
  }
  const cloudCoverageMode = parseTakramCloudCoverageMode(requestedCloudCoverage);
  if (requestedCloudCoverage !== null && cloudCoverageMode === null) {
    return { ok: false, reason: "unknown-cloud-coverage-mode" };
  }
  if (hasCloudScaleQuery && hasMorphologyQuery) {
    return { ok: false, reason: "conflicting-scale-contracts" };
  }
  if (cloudScale !== null && cloudCoverageMode !== null) {
    value.cloudScale = cloudScale;
    value.cloudCoverageMode = cloudCoverageMode;
    if (value.input === "stock") {
      value.stockWeatherMode = stockWeatherMode ?? "unscaled";
    }
  }
  if (hasMorphologyQuery && value.input !== "v3") {
    return { ok: false, reason: "morphology-requires-v3" };
  }
  if (requestedMorphologyCandidate !== null && requestedMorphologyView === null) {
    return { ok: false, reason: "morphology-candidate-requires-view" };
  }
  const morphologyView = requestedMorphologyView === null
    ? null
    : resolveTakramV3MorphologyView(requestedMorphologyView);
  if (requestedMorphologyView !== null && morphologyView === null) {
    return { ok: false, reason: "unknown-morphology-view" };
  }
  const morphologyCandidate = hasMorphologyQuery
    ? resolveTakramV3MorphologyCandidate(requestedMorphologyCandidate ?? "baseline")
    : null;
  if (hasMorphologyQuery && morphologyCandidate === null) {
    return { ok: false, reason: "unknown-morphology-candidate" };
  }
  if (morphologyView !== null && morphologyCandidate !== null) {
    value.morphologyView = morphologyView.id;
    value.morphologyCandidate = morphologyCandidate.id;
  }

  if (isTakramParityAltitudeLadderDiagnostic(diagnostic)) {
    value.altitudeMeters = Number.isFinite(parsedAltitudeMeters)
      ? Math.max(2_500, Math.min(TAKRAM_PARITY_ALTITUDE_LADDER_MAX_M, parsedAltitudeMeters))
      : 2_500;
  }

  if (value.view === "control" && value.input !== "stock") {
    return { ok: false, reason: "control-requires-stock" };
  }
  if (diagnostic === "mip-diagnostic" && value.input !== "stock") {
    return { ok: false, reason: "mip-diagnostic-requires-stock" };
  }

  // Opening has one narrow debug readback: stock/V3 review can compare the
  // native cloud buffer with the complete aerial composite. The control-only
  // BSM/history/Aerial probes are deliberately not exposed in this path.
  const morphologyDiagnostic = value.morphologyView !== undefined &&
    ["full", "cloud-raw", "cloud-raw-off", "history-reset-first", "bsm-off", "aerial-final", "sample-count-debug", "stage-readback"].includes(value.diagnostic);
  const cloudScaleDiagnostic = value.cloudScale !== undefined &&
    ["full", "cloud-raw", "cloud-raw-off", "history-reset-first", "bsm-off", "aerial-final", "sample-count-debug", "stage-readback", "mip-diagnostic"].includes(value.diagnostic);
  const orbitalDiagnostic = value.orbitalPreset !== undefined &&
    ["full", "cloud-raw", "cloud-raw-off", "history-reset-first", "bsm-off", "aerial-final", "sample-count-debug", "primary-march-debug", "stage-readback", "uv-debug"].includes(value.diagnostic);
  return {
    ok: true,
    value: value.view === "opening" && !morphologyDiagnostic && !cloudScaleDiagnostic &&
      !orbitalDiagnostic &&
      !["altitude-ladder", "altitude-ladder-cloud-off", "cloud-raw", "cloud-raw-off", "depth-off", "density-debug", "uv-debug", "sample-count-debug", "stage-readback", "mip-diagnostic"].includes(value.diagnostic)
      ? { ...value, diagnostic: "full" }
      : value
  };
}

export const TAKRAM_PARITY_NPM_PACKAGES = Object.freeze({
  "@react-three/postprocessing": "3.0.4",
  "@takram/three-atmosphere": "0.19.1",
  "@takram/three-clouds": "0.7.6",
  "@takram/three-geospatial": "0.9.1",
  postprocessing: "6.39.1"
});

export const TAKRAM_PARITY_LICENSE = "MIT" as const;

export const TAKRAM_PARITY_UPSTREAM = Object.freeze({
  repository: "https://github.com/takram-design-engineering/three-geospatial",
  visualReferenceCommit: "b012ad06d858fc035d88aacfd73f092f93c994e4"
});

export const TAKRAM_PARITY_DEFAULTS = Object.freeze({
  haze: true,
  lightShafts: true,
  qualityPreset: "high" as const,
  resolutionScale: 1,
  shapeDetail: true,
  temporalUpscale: true,
  turbulence: true
});

/**
 * V3-only opening presentation values. The official stock control and stock
 * opening never consume these values; keeping them explicit prevents a
 * visual comparator adjustment from silently rewriting the upstream control.
 */
export const TAKRAM_PARITY_V3_OPENING_PRESET = Object.freeze({
  coverage: TAKRAM_V3_MORPHOLOGY_BASELINE.coverage,
  shapeRepeat: TAKRAM_V3_MORPHOLOGY_BASELINE.shapeRepeat,
  shapeDetailRepeat: TAKRAM_V3_MORPHOLOGY_BASELINE.shapeDetailRepeat
});

/**
 * Fixed V3 geography for the planetary optical-signal ladder. The spherical
 * coordinate is derived from the centre of a non-polar, high-coverage source
 * weather patch (weather.png texel 64,257), after accounting for the V3 adapter
 * offset and Texture.flipY. This is an interior R-footprint texel rather than
 * a seam or clear-air sample. Every altitude rung uses this same ECEF
 * direction; it is deliberately not selected from the camera view per rung.
 */
export const TAKRAM_PARITY_V3_LADDER_SPHERICAL_UV = TAKRAM_V3_MORPHOLOGY_SPHERICAL_UV;

export interface TakramParityRendererFingerprint {
  // Version 3 remains byte-compatible for historical unscaled evidence.
  // Version 4 added declared cloud-scale readback; version 5 proves actual
  // runtime shader identity and mip state.
  schemaVersion: 3 | 4 | 5 | 6 | 7;
  cloudScale?: TakramCloudScaleRuntimeReadback;
  orbitalBaseline?: Omit<TakramOrbitalLookdevRuntimeReadback, "allocations">;
  orbitalGpuSubmission?: Readonly<{
    audit: TakramOrbitalGpuSubmissionAudit;
    measurementMode: TakramOrbitalGpuMeasurementMode;
  }>;
  orbitalRenderTargets?: {
    clouds: {
      clouds: Record<string, unknown>;
      resolve: Record<string, unknown>;
      history: Record<string, unknown>;
    };
    shadow: {
      clouds: Record<string, unknown>;
      resolve: Record<string, unknown>;
      history: Record<string, unknown>;
    };
  };
  packageVersions: typeof TAKRAM_PARITY_NPM_PACKAGES;
  composer: {
    order: readonly ["CloudsEffect", "AerialPerspectiveEffect"];
    normalPass: boolean;
  };
  clouds: {
    defines: Record<string, string | number | boolean>;
    properties: Record<string, boolean | number>;
    uniforms: Record<string, unknown>;
  };
  shadow: {
    defines: Record<string, string | number | boolean>;
    properties: Record<string, boolean | number>;
    uniforms: Record<string, unknown>;
  };
  aerialPerspective: {
    defines: Record<string, string | number | boolean>;
    properties: Record<string, boolean | number>;
    uniforms: Record<string, unknown>;
  };
  renderTargets: {
    clouds: Record<string, unknown>;
    resolve: Record<string, unknown>;
    history: Record<string, unknown>;
  };
  sharedAssets: Record<"shape" | "shapeDetail" | "stbn" | "turbulence", string>;
}

type RuntimeObject = Record<string, any>;

const FINGERPRINT_CLOUD_UNIFORMS = [
  "maxIterationCount",
  "minStepSize",
  "maxStepSize",
  "maxRayDistance",
  "perspectiveStepScale",
  "minDensity",
  "minExtinction",
  "minTransmittance",
  "maxIterationCountToSun",
  "maxIterationCountToGround",
  "minSecondaryStepSize",
  "secondaryStepScale",
  "maxShadowFilterRadius",
  "maxShadowLengthIterationCount",
  "minShadowLengthStepSize",
  "maxShadowLengthRayDistance",
  "hazeDensityScale",
  "hazeExponent",
  "hazeScatteringCoefficient",
  "hazeAbsorptionCoefficient",
  "skyLightScale",
  "groundBounceScale",
  "powderScale",
  "powderExponent",
  "scatteringCoefficient",
  "absorptionCoefficient",
  "coverage",
  "shapeRepeat",
  "shapeDetailRepeat"
] as const;

const FINGERPRINT_SHADOW_UNIFORMS = [
  "maxIterationCount",
  "minStepSize",
  "maxStepSize",
  "minDensity",
  "minExtinction",
  "minTransmittance",
  "opticalDepthTailScale"
] as const;

const FINGERPRINT_AERIAL_UNIFORMS = [
  "albedoScale",
  "geometricErrorCorrectionAmount",
  "shadowRadius",
  "lunarRadianceScale"
] as const;

function getUniformValue(uniforms: unknown, key: string): unknown {
  if (uniforms instanceof Map) {
    return (uniforms.get(key) as { value?: unknown } | undefined)?.value;
  }
  const entry = (uniforms as RuntimeObject | null | undefined)?.[key];
  return entry && typeof entry === "object" && "value" in entry
    ? entry.value
    : undefined;
}

function canonicalValue(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === "string" ||
    typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalValue(entry));
  }
  if (typeof value === "object") {
    const object = value as RuntimeObject;
    if (typeof object.x === "number" && typeof object.y === "number") {
      const result: RuntimeObject = { x: object.x, y: object.y };
      if (typeof object.z === "number") result.z = object.z;
      if (typeof object.w === "number") result.w = object.w;
      return result;
    }
    const result: RuntimeObject = {};
    for (const key of Object.keys(object).sort()) {
      if (key === "uuid" || key === "id" || key === "version") continue;
      const entry = object[key];
      if (typeof entry === "function") continue;
      if (key === "isTexture" || key === "isRenderTargetTexture") {
        result[key] = Boolean(entry);
        continue;
      }
      if (["format", "type", "colorSpace", "minFilter", "magFilter", "width", "height"].includes(key)) {
        result[key] = canonicalValue(entry);
      }
    }
    return result;
  }
  return String(value);
}

function canonicalDefines(defines: unknown) {
  const entries = defines instanceof Map
    ? Array.from(defines.entries())
    : Object.entries((defines as RuntimeObject | null | undefined) ?? {});
  return Object.fromEntries(
    entries
      .filter(([key]) => key !== "GLOBAL_WEATHER_MAPPING")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, canonicalValue(value)])
  ) as Record<string, string | number | boolean>;
}

function canonicalUniforms(uniforms: unknown, keys: readonly string[]) {
  return Object.fromEntries(
    keys
      .map((key) => [key, canonicalValue(getUniformValue(uniforms, key))])
      .filter(([, value]) => value !== undefined)
  );
}

function canonicalRenderTarget(target: unknown): Record<string, unknown> {
  const value = target as RuntimeObject | null | undefined;
  if (!value) return { present: false };
  const texture = value.texture as RuntimeObject | undefined;
  return {
    present: true,
    width: value.width ?? null,
    height: value.height ?? null,
    depthBuffer: Boolean(value.depthBuffer),
    stencilBuffer: Boolean(value.stencilBuffer),
    attachments: Array.isArray(value.textures)
      ? value.textures.map((entry) => canonicalValue(entry))
      : [],
    texture: canonicalValue(texture)
  };
}

function canonicalProperties(object: RuntimeObject, keys: readonly string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, canonicalValue(object[key])])
  ) as Record<string, boolean | number>;
}

function readCloudsRenderTargets(cloudsPass: RuntimeObject) {
  return {
    clouds: canonicalRenderTarget(cloudsPass.currentRenderTarget),
    resolve: canonicalRenderTarget(cloudsPass.resolveRenderTarget),
    history: canonicalRenderTarget(cloudsPass.historyRenderTarget)
  };
}

export interface TakramParityRendererRuntimeInputs {
  clouds: RuntimeObject;
  aerialPerspective: RuntimeObject;
  cloudScaleRuntime?: TakramCloudScaleRuntimeReadback;
  orbitalBaselineRuntime?: TakramOrbitalLookdevRuntimeReadback;
  orbitalLookdevRuntime?: TakramOrbitalLookdevRuntimeReadback;
  orbitalGpuSubmission?: Readonly<{
    audit: TakramOrbitalGpuSubmissionAudit;
    measurementMode: TakramOrbitalGpuMeasurementMode;
  }>;
  sharedAssets: Record<"shape" | "shapeDetail" | "stbn" | "turbulence", string>;
}

/**
 * Build the parity fingerprint from resolved native runtime state. Adapter
 * fields (weather texture, spherical mapping, layers and offsets) are omitted
 * deliberately; any other native define, budget, material uniform, target
 * format or shared asset drift changes the resulting fingerprint.
 */
export function buildTakramParityRendererFingerprint({
  clouds,
  aerialPerspective,
  cloudScaleRuntime,
  orbitalBaselineRuntime,
  orbitalLookdevRuntime,
  orbitalGpuSubmission,
  sharedAssets
}: TakramParityRendererRuntimeInputs): TakramParityRendererFingerprint {
  const cloudsMaterial = clouds.cloudsPass.currentMaterial as RuntimeObject;
  const shadowMaterial = clouds.shadowPass.currentMaterial as RuntimeObject;
  const cloudsPass = clouds.cloudsPass as RuntimeObject;
  const shadowPass = clouds.shadowPass as RuntimeObject;
  const fingerprint: TakramParityRendererFingerprint = {
    schemaVersion: 3,
    packageVersions: TAKRAM_PARITY_NPM_PACKAGES,
    composer: {
      order: ["CloudsEffect", "AerialPerspectiveEffect"],
      normalPass: true
    },
    clouds: {
      defines: canonicalDefines(cloudsMaterial.defines),
      properties: canonicalProperties(cloudsMaterial, [
        "temporalUpscale",
        "shapeDetail",
        "turbulence",
        "shadowLength",
        "haze",
        "multiScatteringOctaves",
        "accurateSunSkyLight",
        "accuratePhaseFunction",
        "shadowCascadeCount",
        "shadowSampleCount",
        "scatterAnisotropy1",
        "scatterAnisotropy2",
        "scatterAnisotropyMix"
      ]),
      uniforms: canonicalUniforms(cloudsMaterial.uniforms, FINGERPRINT_CLOUD_UNIFORMS)
    },
    shadow: {
      defines: canonicalDefines(shadowMaterial.defines),
      properties: canonicalProperties(shadowMaterial, [
        "temporalPass",
        "temporalJitter",
        "shapeDetail",
        "turbulence",
        "cascadeCount"
      ]),
      uniforms: canonicalUniforms(shadowMaterial.uniforms, FINGERPRINT_SHADOW_UNIFORMS)
    },
    aerialPerspective: {
      defines: canonicalDefines(aerialPerspective.defines),
      properties: canonicalProperties(aerialPerspective, [
        "correctGeometricError",
        "sunLight",
        "skyLight",
        "transmittance",
        "inscatter",
        "sky",
        "sun",
        "moon",
        "ground",
        "octEncodedNormal",
        "reconstructNormal"
      ]),
      uniforms: canonicalUniforms(aerialPerspective.uniforms, FINGERPRINT_AERIAL_UNIFORMS)
    },
    renderTargets: readCloudsRenderTargets(cloudsPass),
    sharedAssets: { ...sharedAssets }
  };
  const baselineRuntime = orbitalBaselineRuntime ?? orbitalLookdevRuntime;
  if (baselineRuntime !== undefined) {
    const {
      allocations: _allocationGenerations,
      ...stableOrbitalLookdevRuntime
    } = baselineRuntime;
    const materializedRenderer = stableOrbitalLookdevRuntime.renderer;
    return {
      ...fingerprint,
      orbitalBaseline: {
        ...stableOrbitalLookdevRuntime,
        renderer: {
          ...materializedRenderer,
          // These upstream properties are setter-only or material macros on a
          // freshly constructed legacy effect. Canonicalize them from the
          // audited material state so legacy and explicit-native compare the
          // same submitted renderer rather than JS setter provenance.
          accuratePhaseFunction:
            fingerprint.clouds.properties.accuratePhaseFunction as false,
          accurateSunSkyLight:
            fingerprint.clouds.properties.accurateSunSkyLight as true,
          multiScatteringOctaves:
            fingerprint.clouds.properties.multiScatteringOctaves as 8,
          qualityPreset: TAKRAM_PARITY_DEFAULTS.qualityPreset
        }
      },
      orbitalRenderTargets: {
        clouds: readCloudsRenderTargets(cloudsPass),
        shadow: readCloudsRenderTargets(shadowPass)
      },
      ...(orbitalGpuSubmission === undefined
        ? {}
        : { orbitalGpuSubmission }),
      schemaVersion: orbitalGpuSubmission === undefined ? 6 : 7
    };
  }
  return cloudScaleRuntime === undefined
    ? fingerprint
    : {
        ...fingerprint,
        cloudScale: cloudScaleRuntime,
        schemaVersion: 5
      };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as RuntimeObject).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStringify((value as RuntimeObject)[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashTakramParityRendererFingerprint(
  fingerprint: TakramParityRendererFingerprint
) {
  return hashFnv1a64(stableStringify(fingerprint));
}

export interface TakramParityNativeFeatures {
  aerialPerspective: boolean;
  beerShadowMaps: boolean;
  haze: boolean;
  lightShafts: boolean;
  qualityPreset: "high";
  resolutionScale: number;
  shapeDetail: boolean;
  temporalUpscale: boolean;
  turbulence: boolean;
}

export type TakramParityPresentationPreset =
  | "cloud-scale-similarity"
  | "orbital-parameter-lookdev"
  | "official-stock"
  | "v3-opening-coarse";

export interface TakramParityCloudScaleTelemetry {
  atmosphereDomain: TakramCloudScaleAtmosphereDomain;
  drift: readonly TakramCloudScaleRuntimeDrift[];
  readback: TakramCloudScaleRuntimeReadback;
  requested: TakramCloudScaleContract;
  stockWeatherControl: TakramStockWeatherControlContract | null;
}

export interface TakramParityOrbitalLookdevTelemetry {
  drift: readonly TakramOrbitalLookdevRuntimeDrift[];
  readback: TakramOrbitalLookdevRuntimeReadback;
  requested: Readonly<TakramOrbitalLookdevContract>;
}

export interface TakramParityResolvedCloudLayer {
  altitude: number;
  channel: "r" | "g" | "b" | "a";
  coverageFilterWidth: number;
  densityScale: number;
  height: number;
  shadow: boolean;
  shapeAmount: number;
  shapeDetailAmount: number;
  weatherExponent: number;
}

/**
 * This is the complete adapter allow-list for stock/V3 comparison. No native
 * renderer parameter belongs here: changing anything else invalidates parity.
 */
export interface TakramParityAdapterTelemetry {
  cloudLayers: readonly TakramParityResolvedCloudLayer[];
  disableDefaultLayers: boolean;
  globalWeatherMapping: boolean;
  localWeatherHash: string | null;
  localWeatherOffset: [number, number] | null;
  localWeatherRepeat: [number, number] | null;
  localWeatherSource: "stock" | "v3" | null;
}

/**
 * Capture-only switches used to make the stock pipeline's individual native
 * contributions reviewable. `beerShadowMaps` in `native` remains a renderer
 * capability; this state says whether the stock cloud layers contribute
 * extinction to those maps for the current diagnostic frame.
 */
export interface TakramParityDiagnosticState {
  altitudeLadder: boolean;
  cloudOff: boolean;
  aerialPerspectiveComposite: boolean;
  beerShadowOcclusion: boolean;
  cloudRawOutput: boolean;
  densityDebug: boolean;
  uvDebug: boolean;
  sceneDepthClamp: boolean;
  sampleCountDebug: boolean;
  primaryMarchDebug: boolean;
  stageReadback: boolean;
  historyResetFirstFrame: boolean;
  mipDiagnostic: boolean;
}

export interface TakramMipDiagnosticEncodedFrameCapture {
  nativeFrame: 16 | 32 | 48;
  width: number;
  height: number;
  recordCount: number;
  lastSampleOrdinal: number;
  recordStride: 9;
  scalar: "float32-le";
  byteLength: number;
  dataBase64: string;
  temporalFrame: Omit<TakramParityMatchedTemporalFrameCapture, "dataUrl" | "height" | "width">;
}

export interface TakramMipDiagnosticCapture {
  completed: boolean;
  scale: 1 | 80 | 120 | 160;
  targetNativeFrames: readonly [16, 32, 48];
  runtimeFragmentShaderFnv1a64: string;
  frames: TakramMipDiagnosticEncodedFrameCapture[];
}

export interface TakramParityStageReadbackBuffer {
  width: number;
  height: number;
  precision: "half-float" | "unorm8";
  source:
    | "native-cloud-current-render-target"
    | "native-cloud-resolved-history-render-target"
    | "default-framebuffer-after-aerial-perspective";
  origin: "bottom-left";
  encoding: "linear-rgba" | "srgb-output-rgba";
  scalar: "float32-le" | "uint8";
  byteLength: number;
  dataBase64: string;
}

export interface TakramParityStageReadbackCapture {
  nativeFrameCount: number;
  temporalFrame: Omit<TakramParityMatchedTemporalFrameCapture, "dataUrl" | "height" | "width">;
  aerialPerspectiveInputSource: "native-cloud-resolved-history-render-target";
  preTemporal: TakramParityStageReadbackBuffer;
  resolvedHistory: TakramParityStageReadbackBuffer;
  finalOutput: TakramParityStageReadbackBuffer;
}

export interface TakramParitySampleCountReadback {
  width: number;
  height: number;
  precision: "half-float" | "unorm8";
  source: "native-cloud-current-render-target-v1";
  origin: "bottom-left";
  encoding: "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask";
  /** Packed normalized RGBA copied from the native pre-temporal cloud target. */
  values: number[];
  instrumentationAudit: TakramShaderInstrumentationAudit;
}

export interface TakramParityPrimaryMarchReadback {
  width: number;
  height: number;
  precision: "half-float";
  source: "native-cloud-current-render-target-primary-march-v1";
  origin: "bottom-left";
  encoding: "rgba16f-loop-entry-cap-hit-direct";
  maxIterationCount: 500;
  values: readonly number[];
  instrumentationAudit: TakramShaderInstrumentationAudit;
}

export interface TakramParityTelemetry {
  active: boolean;
  adapter: TakramParityAdapterTelemetry;
  assetGeneration: number;
  assetsReady: boolean;
  atmosphereGeneration: number;
  atmosphereReady: boolean;
  cameraMatrixWorld: number[];
  cameraHeightMeters: number | null;
  cameraPosition: [number, number, number];
  cloudScale: TakramParityCloudScaleTelemetry | null;
  driftAttemptLedgerOutcome: "none" | "remount" | "blocked";
  driftSignature: string | null;
  coordinateMode: TakramParityCoordinateMode;
  control: typeof TAKRAM_PARITY_CONTROL | null;
  diagnostic: TakramParityDiagnostic;
  diagnosticApplied: boolean;
  diagnosticState: TakramParityDiagnosticState;
  earthMatrixWorld: number[];
  ecefSunDirection: [number, number, number] | null;
  input: TakramParityInput;
  lookdevBaseKey: string | null;
  lookdevMountKey: string | null;
  lookdevSetupState: TakramLookdevSetupState | null;
  native: TakramParityNativeFeatures;
  nativeFrameCount: number;
  orbitalBaselineReadback: TakramOrbitalLookdevRuntimeReadback | null;
  orbitalLookdev: TakramParityOrbitalLookdevTelemetry | null;
  historyEpochHash: string;
  historyFirstFrameCapture: Omit<TakramParityHistoryFirstFrameCapture, "dataUrl"> | null;
  matchedTemporalFrameCapture: Omit<TakramParityMatchedTemporalFrameCapture, "dataUrl"> | null;
  mipDiagnostic: null | Omit<TakramMipDiagnosticCapture, "frames"> & {
    frames: Array<Omit<TakramMipDiagnosticEncodedFrameCapture, "dataBase64">>;
  };
  stageReadback: Omit<TakramParityStageReadbackCapture, "preTemporal" | "resolvedHistory" | "finalOutput"> & {
    preTemporal: Omit<TakramParityStageReadbackBuffer, "dataBase64">;
    resolvedHistory: Omit<TakramParityStageReadbackBuffer, "dataBase64">;
    finalOutput: Omit<TakramParityStageReadbackBuffer, "dataBase64">;
  } | null;
  morphologyCandidate: TakramV3MorphologyCandidateId | null;
  morphologyView: TakramV3MorphologyViewId | null;
  morphologyScaleAudit: TakramV3MorphologyScaleAudit | null;
  sampleCountReadback: TakramParitySampleCountReadback | null;
  primaryMarchReadback: TakramParityPrimaryMarchReadback | null;
  progress: number;
  resetNonce: number;
  rendererFingerprint: TakramParityRendererFingerprint | null;
  rendererFingerprintHash: string | null;
  runtimeEvidenceEpoch: string | null;
  presentationPreset: TakramParityPresentationPreset;
  coverage: number | null;
  sceneDepthContract: "world-depth-to-ecef-v1";
  sceneDepthScale: number;
  shapeRepeat: number | null;
  shapeDetailRepeat: number | null;
  temporalConverged: boolean;
  transformFallback:
    | "invalid-composition-radius"
    | "negative-determinant"
    | "non-uniform-scale"
    | "singular-scale"
    | null;
  view: TakramParityView;
  altitudeLadder: TakramParityAltitudeLadderTelemetry | null;
}

export interface TakramParityAltitudeLadderTelemetry {
  completed: boolean;
  cameraHeightMeters: number | null;
  requestedAltitudeMeters: number;
  sphericalUv: readonly [number, number];
  centerRayShellIntervalMeters: number | null;
  shellIntervalLengthMeters: number | null;
  validPrimarySampleCount: number | null;
  maxDensity: number | null;
  averageDensity: number | null;
  weatherMaxDensity: number | null;
  weatherAverageDensity: number | null;
  accumulatedOpticalDepth: number | null;
  peakAccumulatedOpticalDepth: number | null;
  centerAccumulatedOpticalDepth: number | null;
  transmittance: number | null;
  minimumTransmittance: number | null;
  centerTransmittance: number | null;
  preTemporalInScatteredRadiance: number | null;
  preTemporalInScatteredRadiancePeak: number | null;
  preTemporalInScatteredRadianceCenter: number | null;
  postTemporalInScatteredRadiance: number | null;
  postTemporalInScatteredRadiancePeak: number | null;
  postTemporalInScatteredRadianceCenter: number | null;
  aerialPerspectiveResult: number | null;
  aerialPerspectiveResultPeak: number | null;
  aerialPerspectiveResultCenter: number | null;
  finalCloudSignal: number | null;
  finalCloudSignalPeak: number | null;
  finalCloudSignalCenter: number | null;
  readback: {
    cloudTargetWidth: number;
    cloudTargetHeight: number;
    precision: "half-float" | "unorm8";
    source: "gpu-readback-v1";
  } | null;
}

export type TakramParityStockAssetId =
  | "localWeather"
  | "shape"
  | "shapeDetail"
  | "stbn"
  | "turbulence"
  | "upstreamTokyo";

export interface TakramParityStockAsset {
  byteLength: number;
  dimensions: readonly [number, number, number];
  format: "rgba8" | "r8" | "rgb8";
  id: TakramParityStockAssetId;
  localPath: string;
  runtimeUrl: string | null;
  sha256: string;
  sourceRef: string;
  sourceUrl: string;
}

const CLOUDS_ASSET_REF = "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff";
const GEOSPATIAL_STBN_ASSET_REF = "9627216cc50057994c98a2118f3c4a23765d43b9";
const STOCK_ASSET_BASE_PATH = "apps/site/public/assets/lubirth/takram-parity/stock";
const STOCK_ASSET_BASE_URL = "/assets/lubirth/takram-parity/stock";
const UPSTREAM_MEDIA_BASE_URL =
  "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial";

export const TAKRAM_PARITY_STOCK_ASSETS: readonly TakramParityStockAsset[] = Object.freeze([
  {
    byteLength: 679_653,
    dimensions: [512, 512, 1],
    format: "rgba8",
    id: "localWeather",
    localPath: `${STOCK_ASSET_BASE_PATH}/local-weather.png`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/local-weather.png`,
    sha256: "b84daef855dc5eebcc9b174fe832ba75a98e44b846dde201bce354417cc08031",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/local_weather.png`
  },
  {
    byteLength: 2_097_152,
    dimensions: [128, 128, 128],
    format: "r8",
    id: "shape",
    localPath: `${STOCK_ASSET_BASE_PATH}/shape.bin`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/shape.bin`,
    sha256: "ef65cf6156894720c00bf572c49e3e254f8899c4b5158246e5a35a1922e2519c",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/shape.bin`
  },
  {
    byteLength: 32_768,
    dimensions: [32, 32, 32],
    format: "r8",
    id: "shapeDetail",
    localPath: `${STOCK_ASSET_BASE_PATH}/shape-detail.bin`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/shape-detail.bin`,
    sha256: "c09112199c6e0281b74ff5283c11c2943ae082650b9b67978cf5d59ed2956e4f",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/shape_detail.bin`
  },
  {
    byteLength: 49_691,
    dimensions: [128, 128, 1],
    format: "rgba8",
    id: "turbulence",
    localPath: `${STOCK_ASSET_BASE_PATH}/turbulence.png`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/turbulence.png`,
    sha256: "ec2b1b0af4a6a6104102b21e58beb300b0a3d334c0281d84fde8c91d322910f9",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/turbulence.png`
  },
  {
    byteLength: 1_048_576,
    dimensions: [128, 128, 64],
    format: "r8",
    id: "stbn",
    localPath: `${STOCK_ASSET_BASE_PATH}/stbn.bin`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/stbn.bin`,
    sha256: "51f52f21e5578384585050390821a0a486dcb81e11a716fa7b92fbb6515ba852",
    sourceRef: GEOSPATIAL_STBN_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${GEOSPATIAL_STBN_ASSET_REF}/packages/core/assets/stbn.bin`
  },
  {
    byteLength: 1_728_473,
    dimensions: [1920, 1080, 1],
    format: "rgb8",
    id: "upstreamTokyo",
    localPath: "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/reference/upstream-tokyo.jpg",
    runtimeUrl: null,
    sha256: "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5",
    sourceRef: TAKRAM_PARITY_UPSTREAM.visualReferenceCommit,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${TAKRAM_PARITY_UPSTREAM.visualReferenceCommit}/packages/clouds/docs/tokyo.jpg`
  }
]);

export function isTakramParityLocalAssetUrl(value: string) {
  return value.startsWith("/assets/lubirth/takram-parity/");
}
