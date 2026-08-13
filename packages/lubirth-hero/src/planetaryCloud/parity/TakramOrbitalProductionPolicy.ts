import { deepFreeze, type DeepReadonly } from "./TakramCloudScaleDefaults";
import {
  TAKRAM_ORBITAL_GPU_STAGE_NAMES,
  type TakramOrbitalGpuMeasurementMode,
  type TakramOrbitalGpuProfileState,
  type TakramOrbitalGpuStageName
} from "./TakramOrbitalGpuProfiler";
import type { TakramOrbitalFeatureState } from "./TakramParityContract";
import {
  resolveTakramOrbitalSamplingProgressDecision,
  type TakramOrbitalSamplingProgressMetrics
} from "./TakramOrbitalSamplingMetrics";
import {
  resolveTakramOrbitalProductionStepScale,
  TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES,
  type TakramOrbitalProductionStepCandidate
} from "./TakramOrbitalProductionSampling";

export const TAKRAM_ORBITAL_PRODUCTION_PROGRESSES = Object.freeze([
  0,
  0.06,
  0.12,
  0.18
] as const);
const TAKRAM_ORBITAL_PERFORMANCE_POPULATION_IDS = Object.freeze([
  "initial",
  "ranking",
  "final-winner",
  "confirmation"
] as const);

export type TakramOrbitalProductionProgress =
  (typeof TAKRAM_ORBITAL_PRODUCTION_PROGRESSES)[number];

export type TakramOrbitalProductionPolicyOutcome =
  | "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED"
  | "ORBITAL_PUBLIC_STEP_POLICY_WINNER"
  | "ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING"
  | "ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL"
  | "ORBITAL_PUBLIC_STEP_POLICY_OVER_BUDGET"
  | "ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED";

export interface TakramOrbitalPerformanceEnvironment {
  readonly build: "production";
  readonly browser: "headed-system-chrome";
  readonly browserVersion: string;
  readonly chip: string;
  readonly gpuRenderer: string;
  readonly gpuVendor: string;
  readonly macOSVersion: string;
  readonly viewport: Readonly<{
    cssWidth: 1440;
    cssHeight: 960;
    physicalWidth: 1440;
    physicalHeight: 960;
    dpr: 1;
  }>;
  readonly visible: boolean;
  readonly focused: boolean;
  readonly acPower: boolean;
  readonly lowPowerMode: false;
  readonly commit: string;
  readonly productionAssetFingerprint: string;
}

export interface TakramOrbitalPerformanceEnvironmentDecision {
  readonly valid: boolean;
  readonly invalidReasons: readonly string[];
}

export interface TakramOrbitalGpuPolicyPopulation {
  readonly populationId: string;
  readonly measurementMode: TakramOrbitalGpuMeasurementMode;
  readonly warmupFrameCount: number;
  readonly targetSampleCount: number;
  readonly validSampleCount: number;
  readonly state: TakramOrbitalGpuProfileState;
  readonly timestampBits: number;
  readonly p95Milliseconds: number | null;
  readonly invalidReasons: readonly string[];
  readonly stageNames?: readonly TakramOrbitalGpuStageName[];
}

export interface TakramOrbitalProductionStage0Input {
  readonly environment: TakramOrbitalPerformanceEnvironment;
  readonly populationEnvironments: readonly Readonly<{
    populationId: string;
    environment: TakramOrbitalPerformanceEnvironment;
  }>[];
  readonly causalEvidence: Readonly<{
    artifactCount: number;
    verifiedArtifactCount: number;
    outcomeReadable: boolean;
    contractReadable: boolean;
    commitReadable: boolean;
    resolverReproduced: boolean;
    exactStepValuesReproduced: boolean;
  }>;
  readonly routeParity: Readonly<{
    query: boolean;
    runtime: boolean;
    fingerprint: boolean;
    camera: boolean;
  }>;
  readonly smoke: Readonly<{
    totalOnly: TakramOrbitalGpuPolicyPopulation;
    stageOnly: TakramOrbitalGpuPolicyPopulation;
  }>;
}

export interface TakramOrbitalProductionStage0Decision {
  readonly state:
    | "ORBITAL_PRODUCTION_STAGE_1_READY"
    | "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED";
  readonly invalidReasons: readonly string[];
}

export type TakramOrbitalSamplingVisualReview =
  | "coherent-density-field"
  | "isolated-fragments"
  | "debug-color";

export interface TakramOrbitalProductionStage1Input {
  readonly candidates: readonly Readonly<{
    candidate: TakramOrbitalProductionStepCandidate;
    progresses: readonly Readonly<{
      progress: TakramOrbitalProductionProgress;
      metrics: TakramOrbitalSamplingProgressMetrics;
      visualReview: TakramOrbitalSamplingVisualReview;
    }>[];
  }>[];
}

export interface TakramOrbitalProductionStage1CandidateDecision {
  readonly candidate: TakramOrbitalProductionStepCandidate;
  readonly samplingHealthy: boolean;
  readonly progressDecisions: readonly Readonly<{
    progress: TakramOrbitalProductionProgress;
    evidenceValid: boolean;
    samplingHealthy: boolean;
    coherentDensityField: boolean;
    samplingFailureReasons: readonly string[];
  }>[];
}

export interface TakramOrbitalProductionStage1Decision {
  readonly state:
    | "ORBITAL_PRODUCTION_STAGE_2_READY"
    | "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED"
    | "ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL";
  readonly invalidReasons: readonly string[];
  readonly healthyCandidates: readonly Exclude<
    TakramOrbitalProductionStepCandidate,
    "control"
  >[];
  readonly candidateDecisions:
    readonly TakramOrbitalProductionStage1CandidateDecision[];
}

export interface TakramOrbitalPrimarySignalState {
  readonly featureState: TakramOrbitalFeatureState;
  readonly primaryMarchBytes: Uint8Array;
  readonly nativeHitMask: Uint8Array;
  readonly preTemporalOpacity: ArrayLike<number>;
}

export interface TakramOrbitalPrimarySignalParityInput {
  readonly candidate: Exclude<TakramOrbitalProductionStepCandidate, "control">;
  readonly progress: TakramOrbitalProductionProgress;
  readonly repeatFloors: Readonly<{
    nativeHitMaskMismatch: number;
    opacityMae: number;
  }>;
  readonly states: readonly TakramOrbitalPrimarySignalState[];
}

export interface TakramOrbitalPrimarySignalComparison {
  readonly primaryMarchByteIdentical: boolean;
  readonly hitMaskMismatch: number;
  readonly opacityMae: number;
}

export interface TakramOrbitalPrimarySignalParityDecision {
  readonly evidenceValid: boolean;
  readonly invariantPass: boolean;
  readonly invalidReasons: readonly string[];
  readonly failureReasons: readonly string[];
  readonly comparisons: Readonly<Record<
    Exclude<TakramOrbitalFeatureState, "native">,
    TakramOrbitalPrimarySignalComparison
  >> | null;
}

export interface TakramOrbitalStage2CandidateInput {
  readonly candidate: Exclude<TakramOrbitalProductionStepCandidate, "control">;
  readonly progresses: readonly Readonly<{
    progress: TakramOrbitalProductionProgress;
    primarySignal: TakramOrbitalPrimarySignalParityInput;
    populations: Readonly<{
      fullTotal: TakramOrbitalGpuPolicyPopulation;
      lightShaftsOffTotal: TakramOrbitalGpuPolicyPopulation;
      fullStage: TakramOrbitalGpuPolicyPopulation;
      lightShaftsOffStage: TakramOrbitalGpuPolicyPopulation;
    }>;
    confirmation?: Readonly<{
      fullTotal: TakramOrbitalGpuPolicyPopulation;
      lightShaftsOffTotal: TakramOrbitalGpuPolicyPopulation;
    }>;
  }>[];
}

export interface TakramOrbitalProductionPolicyInput {
  readonly stage0: TakramOrbitalProductionStage0Input;
  readonly stage1: TakramOrbitalProductionStage1Input;
  readonly stage2Candidates: readonly TakramOrbitalStage2CandidateInput[];
}

export interface TakramOrbitalProductionCandidateRanking {
  readonly candidate: Exclude<TakramOrbitalProductionStepCandidate, "control">;
  readonly maxFullP95Milliseconds: number;
  readonly perspectiveStepScale: number;
  readonly productionEligible: boolean;
}

export interface TakramOrbitalProductionPolicyDecision {
  readonly outcome: TakramOrbitalProductionPolicyOutcome;
  readonly winner: Exclude<TakramOrbitalProductionStepCandidate, "control"> | null;
  readonly decouplingCandidate:
    | Exclude<TakramOrbitalProductionStepCandidate, "control">
    | null;
  readonly invalidReasons: readonly string[];
  readonly ranking: readonly TakramOrbitalProductionCandidateRanking[];
}

const EXACT_GPU_RENDERER =
  "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)";
const EXACT_GPU_VENDOR = "Google Inc. (Apple)";

function equalArrays<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function environmentEquals(
  left: TakramOrbitalPerformanceEnvironment,
  right: TakramOrbitalPerformanceEnvironment
) {
  return left.build === right.build &&
    left.browser === right.browser &&
    left.browserVersion === right.browserVersion &&
    left.chip === right.chip &&
    left.gpuRenderer === right.gpuRenderer &&
    left.gpuVendor === right.gpuVendor &&
    left.macOSVersion === right.macOSVersion &&
    left.viewport?.cssWidth === right.viewport?.cssWidth &&
    left.viewport?.cssHeight === right.viewport?.cssHeight &&
    left.viewport?.physicalWidth === right.viewport?.physicalWidth &&
    left.viewport?.physicalHeight === right.viewport?.physicalHeight &&
    left.viewport?.dpr === right.viewport?.dpr &&
    left.visible === right.visible &&
    left.focused === right.focused &&
    left.acPower === right.acPower &&
    left.lowPowerMode === right.lowPowerMode &&
    left.commit === right.commit &&
    left.productionAssetFingerprint === right.productionAssetFingerprint;
}

export function validateTakramOrbitalPerformanceEnvironment(
  input: TakramOrbitalPerformanceEnvironment
): DeepReadonly<TakramOrbitalPerformanceEnvironmentDecision> {
  const invalidReasons: string[] = [];
  if (input.build !== "production") invalidReasons.push("build-not-production");
  if (input.browser !== "headed-system-chrome") {
    invalidReasons.push("browser-not-headed-system-chrome");
  }
  if (!/^Chrome\/\d+(?:\.\d+){3}$/.test(input.browserVersion)) {
    invalidReasons.push("invalid-browser-version");
  }
  if (input.chip !== "Apple M4") invalidReasons.push("chip-not-apple-m4");
  if (input.gpuRenderer !== EXACT_GPU_RENDERER) {
    invalidReasons.push("gpu-renderer-not-angle-metal-m4");
  }
  if (input.gpuVendor !== EXACT_GPU_VENDOR) {
    invalidReasons.push("gpu-vendor-mismatch");
  }
  if (!/^\d+(?:\.\d+){1,2}$/.test(input.macOSVersion)) {
    invalidReasons.push("invalid-macos-version");
  }
  if (input.viewport?.cssWidth !== 1440 || input.viewport?.cssHeight !== 960) {
    invalidReasons.push("invalid-css-viewport");
  }
  if (input.viewport?.physicalWidth !== 1440 ||
    input.viewport?.physicalHeight !== 960) {
    invalidReasons.push("invalid-physical-viewport");
  }
  if (input.viewport?.dpr !== 1) invalidReasons.push("invalid-dpr");
  if (!input.visible) invalidReasons.push("page-not-visible");
  if (!input.focused) invalidReasons.push("page-not-focused");
  if (!input.acPower) invalidReasons.push("ac-power-required");
  if (input.lowPowerMode !== false) invalidReasons.push("low-power-mode-enabled");
  if (!/^[0-9a-f]{40}$/.test(input.commit)) invalidReasons.push("invalid-commit");
  if (typeof input.productionAssetFingerprint !== "string" ||
    !input.productionAssetFingerprint.trim()) {
    invalidReasons.push("missing-production-asset-fingerprint");
  }
  return deepFreeze({ valid: invalidReasons.length === 0, invalidReasons });
}

function validatePopulation(input: Readonly<{
  population: TakramOrbitalGpuPolicyPopulation;
  mode: TakramOrbitalGpuMeasurementMode;
  count: number;
  label: string;
}>): string[] {
  const reasons: string[] = [];
  const { population } = input;
  if (!population.populationId.trim()) reasons.push(`${input.label}:missing-id`);
  if (population.measurementMode !== input.mode ||
    population.warmupFrameCount !== input.count ||
    population.targetSampleCount !== input.count ||
    population.validSampleCount !== input.count ||
    population.state !== "complete" ||
    population.invalidReasons.length > 0 ||
    !Number.isFinite(population.p95Milliseconds) ||
    Number(population.p95Milliseconds) < 0 ||
    population.timestampBits <= 0) {
    reasons.push(`${input.label}:invalid-population`);
  }
  if (input.mode === "stage-only-sequential-time-elapsed" &&
    !equalArrays(population.stageNames ?? [], TAKRAM_ORBITAL_GPU_STAGE_NAMES)) {
    reasons.push(`${input.label}:invalid-stage-set`);
  }
  if (input.mode === "total-only-time-elapsed" &&
    population.stageNames !== undefined) {
    reasons.push(`${input.label}:unexpected-stage-set`);
  }
  return reasons;
}

function normalizeStage0Reason(reason: string) {
  if (reason.startsWith("total-smoke:")) return "total-smoke-invalid";
  if (reason.startsWith("stage-smoke:")) return "stage-smoke-invalid";
  return reason;
}

export function resolveTakramOrbitalProductionStage0(
  input: TakramOrbitalProductionStage0Input
): DeepReadonly<TakramOrbitalProductionStage0Decision> {
  const invalidReasons = [
    ...validateTakramOrbitalPerformanceEnvironment(input.environment).invalidReasons
  ];
  const populationIds = new Set<string>();
  for (const population of input.populationEnvironments) {
    if (!population.populationId.trim() || populationIds.has(population.populationId)) {
      invalidReasons.push("invalid-population-environment-id");
    }
    populationIds.add(population.populationId);
    const environmentDecision = validateTakramOrbitalPerformanceEnvironment(
      population.environment
    );
    if (!environmentDecision.valid) {
      invalidReasons.push(
        ...environmentDecision.invalidReasons.map((reason) =>
          `population-${population.populationId}:${reason}`
        )
      );
    }
    if (!environmentEquals(input.environment, population.environment)) {
      invalidReasons.push(`population-${population.populationId}:environment-mismatch`);
    }
  }
  if (input.populationEnvironments.length === 0) {
    invalidReasons.push("missing-population-environments");
  }
  if (!equalArrays(
    [...populationIds].sort(),
    [...TAKRAM_ORBITAL_PERFORMANCE_POPULATION_IDS].sort()
  )) {
    invalidReasons.push("invalid-population-environment-set");
  }
  if (input.causalEvidence.artifactCount !== 93 ||
    input.causalEvidence.verifiedArtifactCount !== 93) {
    invalidReasons.push("causal-artifact-verification-failed");
  }
  for (const [field, reason] of [
    ["outcomeReadable", "causal-outcome-unreadable"],
    ["contractReadable", "causal-contract-unreadable"],
    ["commitReadable", "causal-commit-unreadable"],
    ["resolverReproduced", "causal-resolver-not-reproduced"],
    ["exactStepValuesReproduced", "causal-step-values-not-reproduced"]
  ] as const) {
    if (!input.causalEvidence[field]) invalidReasons.push(reason);
  }
  for (const [field, reason] of [
    ["query", "route-query-parity-failed"],
    ["runtime", "route-runtime-parity-failed"],
    ["fingerprint", "route-fingerprint-parity-failed"],
    ["camera", "route-camera-parity-failed"]
  ] as const) {
    if (!input.routeParity[field]) invalidReasons.push(reason);
  }
  invalidReasons.push(...validatePopulation({
    population: input.smoke.totalOnly,
    mode: "total-only-time-elapsed",
    count: 8,
    label: "total-smoke"
  }).map(normalizeStage0Reason));
  invalidReasons.push(...validatePopulation({
    population: input.smoke.stageOnly,
    mode: "stage-only-sequential-time-elapsed",
    count: 8,
    label: "stage-smoke"
  }).map(normalizeStage0Reason));
  if (input.smoke.totalOnly.populationId === input.smoke.stageOnly.populationId) {
    invalidReasons.push("smoke-populations-not-independent");
  }
  const uniqueReasons = [...new Set(invalidReasons)];
  return deepFreeze({
    state: uniqueReasons.length === 0
      ? "ORBITAL_PRODUCTION_STAGE_1_READY" as const
      : "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED" as const,
    invalidReasons: uniqueReasons
  });
}

function validateExactProgresses(
  progresses: readonly Readonly<{ progress: number }>[],
  label: string
) {
  return equalArrays(
    progresses.map(({ progress }) => progress),
    TAKRAM_ORBITAL_PRODUCTION_PROGRESSES
  ) ? [] : [`${label}:invalid-progress-set`];
}

export function resolveTakramOrbitalProductionStage1(
  input: TakramOrbitalProductionStage1Input
): DeepReadonly<TakramOrbitalProductionStage1Decision> {
  const invalidReasons: string[] = [];
  if (!equalArrays(
    input.candidates.map(({ candidate }) => candidate),
    TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES
  )) {
    invalidReasons.push("invalid-stage-1-candidate-set");
  }
  const candidateDecisions = input.candidates.map((candidateInput) => {
    invalidReasons.push(...validateExactProgresses(
      candidateInput.progresses,
      candidateInput.candidate
    ));
    const progressDecisions = candidateInput.progresses.map((entry) => {
      const metricDecision = resolveTakramOrbitalSamplingProgressDecision(
        entry.metrics
      );
      if (!metricDecision.evidenceValid) {
        const reasons = metricDecision.setupInvalidReasons.length > 0
          ? metricDecision.setupInvalidReasons
          : ["invalid-evidence"];
        invalidReasons.push(...reasons.map((reason) =>
          `${candidateInput.candidate}@${entry.progress}:${reason}`
        ));
      }
      const coherentDensityField = entry.visualReview ===
        "coherent-density-field";
      if (!["coherent-density-field", "isolated-fragments", "debug-color"]
        .includes(entry.visualReview)) {
        invalidReasons.push(
          `${candidateInput.candidate}@${entry.progress}:invalid-visual-review`
        );
      }
      return {
        progress: entry.progress,
        evidenceValid: metricDecision.evidenceValid,
        samplingHealthy: metricDecision.samplingHealthy && coherentDensityField,
        coherentDensityField,
        samplingFailureReasons: [
          ...metricDecision.samplingFailureReasons,
          ...(coherentDensityField ? [] : ["cloud-field-not-coherent"])
        ]
      };
    });
    return {
      candidate: candidateInput.candidate,
      samplingHealthy: progressDecisions.length === 4 &&
        progressDecisions.every((decision) => decision.samplingHealthy),
      progressDecisions
    };
  });
  const healthyCandidates = candidateDecisions.flatMap((decision) =>
    decision.candidate !== "control" && decision.samplingHealthy
      ? [decision.candidate]
      : []
  );
  const uniqueReasons = [...new Set(invalidReasons)];
  return deepFreeze({
    state: uniqueReasons.length > 0
      ? "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED" as const
      : healthyCandidates.length === 0
        ? "ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL" as const
        : "ORBITAL_PRODUCTION_STAGE_2_READY" as const,
    invalidReasons: uniqueReasons,
    healthyCandidates,
    candidateDecisions
  });
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every(
    (value, index) => value === right[index]
  );
}

export function resolveTakramOrbitalPrimarySignalParity(
  input: TakramOrbitalPrimarySignalParityInput
): DeepReadonly<TakramOrbitalPrimarySignalParityDecision> {
  const invalidReasons: string[] = [];
  if (!TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.includes(input.progress)) {
    invalidReasons.push("invalid-progress");
  }
  for (const [name, value] of Object.entries(input.repeatFloors)) {
    if (!Number.isFinite(value) || value < 0) {
      invalidReasons.push(`invalid-repeat-floor:${name}`);
    }
  }
  const expectedStates = ["native", "light-shafts-off", "bsm-off"] as const;
  const states = new Map<string, TakramOrbitalPrimarySignalState>();
  for (const state of input.states) {
    if (!(expectedStates as readonly string[]).includes(state.featureState)) {
      invalidReasons.push(`invalid-feature-state:${state.featureState}`);
      continue;
    }
    if (states.has(state.featureState)) {
      invalidReasons.push(`duplicate-feature-state:${state.featureState}`);
    }
    states.set(state.featureState, state);
  }
  if (!equalArrays(input.states.map(({ featureState }) => featureState), expectedStates)) {
    invalidReasons.push("invalid-feature-state-set");
  }
  const native = states.get("native");
  if (native === undefined) invalidReasons.push("missing-native-state");
  if (native !== undefined) {
    if (native.primaryMarchBytes.length === 0 || native.nativeHitMask.length === 0 ||
      native.preTemporalOpacity.length === 0) {
      invalidReasons.push("empty-primary-signal-buffer");
    }
    for (const stateName of expectedStates) {
      const state = states.get(stateName);
      if (state === undefined) continue;
      if (state.primaryMarchBytes.length !== native.primaryMarchBytes.length ||
        state.nativeHitMask.length !== native.nativeHitMask.length ||
        state.preTemporalOpacity.length !== native.preTemporalOpacity.length) {
        invalidReasons.push(`${stateName}:buffer-length-mismatch`);
      }
      for (let index = 0; index < state.nativeHitMask.length; index += 1) {
        if (state.nativeHitMask[index] !== 0 && state.nativeHitMask[index] !== 1) {
          invalidReasons.push(`${stateName}:invalid-hit-mask`);
          break;
        }
      }
      for (let index = 0; index < state.preTemporalOpacity.length; index += 1) {
        if (!Number.isFinite(Number(state.preTemporalOpacity[index]))) {
          invalidReasons.push(`${stateName}:non-finite-opacity`);
          break;
        }
      }
    }
  }
  if (invalidReasons.length > 0 || native === undefined) {
    return deepFreeze({
      evidenceValid: false,
      invariantPass: false,
      invalidReasons: [...new Set(invalidReasons)],
      failureReasons: [],
      comparisons: null
    });
  }

  const failureReasons: string[] = [];
  const comparisons = Object.fromEntries(
    (["light-shafts-off", "bsm-off"] as const).map((stateName) => {
      const state = states.get(stateName)!;
      let mismatchCount = 0;
      let opacityDelta = 0;
      for (let index = 0; index < native.nativeHitMask.length; index += 1) {
        if (native.nativeHitMask[index] !== state.nativeHitMask[index]) {
          mismatchCount += 1;
        }
      }
      for (let index = 0; index < native.preTemporalOpacity.length; index += 1) {
        opacityDelta += Math.abs(
          Number(native.preTemporalOpacity[index]) -
          Number(state.preTemporalOpacity[index])
        );
      }
      const comparison = {
        primaryMarchByteIdentical: bytesEqual(
          native.primaryMarchBytes,
          state.primaryMarchBytes
        ),
        hitMaskMismatch: mismatchCount / native.nativeHitMask.length,
        opacityMae: opacityDelta / native.preTemporalOpacity.length
      };
      if (!comparison.primaryMarchByteIdentical) {
        failureReasons.push(`${stateName}:primary-march-bytes`);
      }
      if (comparison.hitMaskMismatch > input.repeatFloors.nativeHitMaskMismatch) {
        failureReasons.push(`${stateName}:hit-mask-repeat-floor`);
      }
      if (comparison.opacityMae > input.repeatFloors.opacityMae) {
        failureReasons.push(`${stateName}:opacity-repeat-floor`);
      }
      return [stateName, comparison] as const;
    })
  ) as Record<Exclude<TakramOrbitalFeatureState, "native">,
    TakramOrbitalPrimarySignalComparison>;
  return deepFreeze({
    evidenceValid: true,
    invariantPass: failureReasons.length === 0,
    invalidReasons: [],
    failureReasons,
    comparisons
  });
}

interface ResolvedStage2Candidate extends TakramOrbitalProductionCandidateRanking {
  readonly primarySignalPass: boolean;
  readonly progresses: TakramOrbitalStage2CandidateInput["progresses"];
}

function comparePolicyCandidates(
  left: TakramOrbitalProductionCandidateRanking,
  right: TakramOrbitalProductionCandidateRanking
) {
  if (left.productionEligible !== right.productionEligible) {
    return left.productionEligible ? -1 : 1;
  }
  if (left.maxFullP95Milliseconds !== right.maxFullP95Milliseconds) {
    return left.maxFullP95Milliseconds - right.maxFullP95Milliseconds;
  }
  if (left.perspectiveStepScale !== right.perspectiveStepScale) {
    return right.perspectiveStepScale - left.perspectiveStepScale;
  }
  if (left.candidate === "confirmed" && right.candidate !== "confirmed") return -1;
  if (right.candidate === "confirmed" && left.candidate !== "confirmed") return 1;
  return left.candidate.localeCompare(right.candidate);
}

function toPublicRanking(
  candidates: readonly ResolvedStage2Candidate[]
): readonly TakramOrbitalProductionCandidateRanking[] {
  return candidates.map((candidate) => ({
    candidate: candidate.candidate,
    maxFullP95Milliseconds: candidate.maxFullP95Milliseconds,
    perspectiveStepScale: candidate.perspectiveStepScale,
    productionEligible: candidate.productionEligible
  }));
}

function validateStage2PopulationSet(
  candidate: TakramOrbitalStage2CandidateInput,
  invalidReasons: string[]
): ResolvedStage2Candidate {
  invalidReasons.push(...validateExactProgresses(
    candidate.progresses,
    candidate.candidate
  ));
  let primarySignalPass = true;
  const fullValues: number[] = [];
  for (const entry of candidate.progresses) {
    if (entry.primarySignal.candidate !== candidate.candidate ||
      entry.primarySignal.progress !== entry.progress) {
      invalidReasons.push(`${candidate.candidate}@${entry.progress}:primary-identity-drift`);
      primarySignalPass = false;
    }
    const parity = resolveTakramOrbitalPrimarySignalParity(entry.primarySignal);
    if (!parity.evidenceValid) {
      invalidReasons.push(...parity.invalidReasons.map((reason) =>
        `${candidate.candidate}@${entry.progress}:primary:${reason}`
      ));
    }
    if (!parity.invariantPass) primarySignalPass = false;
    const labels = [
      ["full-total", entry.populations.fullTotal, "total-only-time-elapsed"],
      [
        "light-total",
        entry.populations.lightShaftsOffTotal,
        "total-only-time-elapsed"
      ],
      ["full-stage", entry.populations.fullStage, "stage-only-sequential-time-elapsed"],
      [
        "light-stage",
        entry.populations.lightShaftsOffStage,
        "stage-only-sequential-time-elapsed"
      ]
    ] as const;
    for (const [label, population, mode] of labels) {
      invalidReasons.push(...validatePopulation({
        population,
        mode,
        count: 120,
        label: `${candidate.candidate}@${entry.progress}:${label}`
      }));
    }
    if (entry.populations.fullTotal.p95Milliseconds !== null) {
      fullValues.push(entry.populations.fullTotal.p95Milliseconds);
    }
  }
  const maxFullP95Milliseconds = fullValues.length === 4
    ? Math.max(...fullValues)
    : Number.POSITIVE_INFINITY;
  return {
    candidate: candidate.candidate,
    maxFullP95Milliseconds,
    perspectiveStepScale: resolveTakramOrbitalProductionStepScale(
      candidate.candidate
    ),
    productionEligible: maxFullP95Milliseconds <= 3,
    primarySignalPass,
    progresses: candidate.progresses
  };
}

function directBudgetCrossing(candidate: ResolvedStage2Candidate) {
  return candidate.primarySignalPass &&
    candidate.progresses.some((entry) =>
      Number(entry.populations.fullTotal.p95Milliseconds) > 4
    ) &&
    candidate.progresses.every((entry) =>
      Number(entry.populations.lightShaftsOffTotal.p95Milliseconds) <= 4
    );
}

function confirmationResult(
  candidate: ResolvedStage2Candidate,
  invalidReasons: string[]
) {
  let present = true;
  let hasFullBudgetCrossing = false;
  let lightWithinBudgetEverywhere = true;
  for (const entry of candidate.progresses) {
    if (entry.confirmation === undefined) {
      present = false;
      lightWithinBudgetEverywhere = false;
      continue;
    }
    for (const [label, population] of [
      ["confirm-full", entry.confirmation.fullTotal],
      ["confirm-light", entry.confirmation.lightShaftsOffTotal]
    ] as const) {
      invalidReasons.push(...validatePopulation({
        population,
        mode: "total-only-time-elapsed",
        count: 120,
        label: `${candidate.candidate}@${entry.progress}:${label}`
      }));
    }
    if (entry.confirmation.fullTotal.populationId ===
        entry.populations.fullTotal.populationId ||
      entry.confirmation.lightShaftsOffTotal.populationId ===
        entry.populations.lightShaftsOffTotal.populationId) {
      invalidReasons.push(
        `${candidate.candidate}@${entry.progress}:confirmation-not-independent`
      );
    }
    if (Number(entry.confirmation.fullTotal.p95Milliseconds) > 4) {
      hasFullBudgetCrossing = true;
    }
    if (!(Number(entry.confirmation.lightShaftsOffTotal.p95Milliseconds) <= 4)) {
      lightWithinBudgetEverywhere = false;
    }
  }
  return {
    present,
    reproduces: present && hasFullBudgetCrossing && lightWithinBudgetEverywhere
  };
}

function policyDecision(input: Readonly<{
  outcome: TakramOrbitalProductionPolicyOutcome;
  winner?: Exclude<TakramOrbitalProductionStepCandidate, "control"> | null;
  decouplingCandidate?:
    Exclude<TakramOrbitalProductionStepCandidate, "control"> | null;
  invalidReasons?: readonly string[];
  ranking?: readonly TakramOrbitalProductionCandidateRanking[];
}>): DeepReadonly<TakramOrbitalProductionPolicyDecision> {
  return deepFreeze({
    outcome: input.outcome,
    winner: input.winner ?? null,
    decouplingCandidate: input.decouplingCandidate ?? null,
    invalidReasons: [...(input.invalidReasons ?? [])],
    ranking: [...(input.ranking ?? [])]
  });
}

export function resolveTakramOrbitalProductionPolicy(
  input: TakramOrbitalProductionPolicyInput
): DeepReadonly<TakramOrbitalProductionPolicyDecision> {
  const stage0 = resolveTakramOrbitalProductionStage0(input.stage0);
  if (stage0.state === "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED") {
    return policyDecision({
      outcome: "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED",
      invalidReasons: stage0.invalidReasons
    });
  }
  const stage1 = resolveTakramOrbitalProductionStage1(input.stage1);
  if (stage1.state === "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED") {
    return policyDecision({
      outcome: "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED",
      invalidReasons: stage1.invalidReasons
    });
  }
  if (stage1.state === "ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL") {
    return policyDecision({ outcome: "ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL" });
  }

  const invalidReasons: string[] = [];
  const stage2Names = input.stage2Candidates.map(({ candidate }) => candidate);
  if (!equalArrays(stage2Names, stage1.healthyCandidates)) {
    invalidReasons.push("stage-2-candidate-set-does-not-match-stage-1");
  }
  const resolved = input.stage2Candidates.map((candidate) =>
    validateStage2PopulationSet(candidate, invalidReasons)
  );
  if (invalidReasons.length > 0) {
    return policyDecision({
      outcome: "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED",
      invalidReasons: [...new Set(invalidReasons)]
    });
  }

  const ranking = resolved
    .filter((candidate) => candidate.primarySignalPass &&
      candidate.maxFullP95Milliseconds <= 4)
    .sort(comparePolicyCandidates);
  if (ranking.length > 0) {
    return policyDecision({
      outcome: "ORBITAL_PUBLIC_STEP_POLICY_WINNER",
      winner: ranking[0]!.candidate,
      ranking: toPublicRanking(ranking)
    });
  }

  const crossing = resolved.filter(directBudgetCrossing)
    .sort(comparePolicyCandidates);
  if (crossing.length > 0) {
    const confirmed: ResolvedStage2Candidate[] = [];
    let missingOrFailed = false;
    for (const candidate of crossing) {
      const confirmation = confirmationResult(candidate, invalidReasons);
      if (confirmation.present && confirmation.reproduces) {
        confirmed.push(candidate);
      } else {
        missingOrFailed = true;
      }
    }
    if (invalidReasons.length > 0) {
      return policyDecision({
        outcome: "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED",
        invalidReasons: [...new Set(invalidReasons)]
      });
    }
    if (confirmed.length > 0) {
      confirmed.sort(comparePolicyCandidates);
      return policyDecision({
        outcome: "ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING",
        decouplingCandidate: confirmed[0]!.candidate,
        ranking: toPublicRanking(confirmed)
      });
    }
    if (missingOrFailed) {
      return policyDecision({
        outcome: "ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED",
        ranking: toPublicRanking(crossing)
      });
    }
  }

  if (resolved.some((candidate) =>
    candidate.maxFullP95Milliseconds <= 4 && !candidate.primarySignalPass
  )) {
    return policyDecision({ outcome: "ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED" });
  }
  return policyDecision({ outcome: "ORBITAL_PUBLIC_STEP_POLICY_OVER_BUDGET" });
}

export interface TakramOrbitalHealthyBaselineProgressEvidence {
  readonly progress: TakramOrbitalProductionProgress;
  readonly identity: Readonly<Record<string, unknown>>;
  readonly metrics: TakramOrbitalSamplingProgressMetrics;
  readonly featureComparison: TakramOrbitalPrimarySignalParityDecision;
  readonly gpuPopulations: TakramOrbitalStage2CandidateInput["progresses"][number]["populations"];
}

export interface TakramOrbitalHealthyBaselineInput {
  readonly candidate: Exclude<TakramOrbitalProductionStepCandidate, "control">;
  readonly machineDecision: TakramOrbitalProductionPolicyDecision;
  readonly renderContract: Readonly<Record<string, unknown>>;
  readonly progressEvidence: readonly TakramOrbitalHealthyBaselineProgressEvidence[];
  readonly boundedReview: Readonly<{
    reviewer: string;
    coherent: boolean;
    observable: boolean;
    notes: string;
  }>;
}

export interface TakramOrbitalHealthyBaselineContract
  extends TakramOrbitalHealthyBaselineInput {
  readonly state: "ORBITAL_HEALTHY_STOCK_BASELINE_READY";
  readonly query: Readonly<{
    key: "orbitalStepPolicy";
    value: Exclude<TakramOrbitalProductionStepCandidate, "control">;
  }>;
  readonly perspectiveStepScale: number;
}

export function createTakramOrbitalHealthyBaselineContract(
  input: TakramOrbitalHealthyBaselineInput
): DeepReadonly<TakramOrbitalHealthyBaselineContract> {
  if (input.machineDecision.outcome !== "ORBITAL_PUBLIC_STEP_POLICY_WINNER" ||
    input.machineDecision.winner !== input.candidate) {
    throw new Error("Healthy baseline candidate must be the exact policy winner");
  }
  if (!equalArrays(
    input.progressEvidence.map(({ progress }) => progress),
    TAKRAM_ORBITAL_PRODUCTION_PROGRESSES
  )) {
    throw new Error("Healthy baseline requires all four exact progresses");
  }
  if (Object.keys(input.renderContract).length === 0) {
    throw new Error("Healthy baseline requires a complete render contract");
  }
  for (const entry of input.progressEvidence) {
    if (Object.keys(entry.identity).length === 0) {
      throw new Error(`Healthy baseline identity missing at ${entry.progress}`);
    }
    if (!entry.metrics.evidenceValid ||
      !entry.featureComparison.evidenceValid ||
      !entry.featureComparison.invariantPass) {
      throw new Error(`Healthy baseline evidence invalid at ${entry.progress}`);
    }
  }
  if (!input.boundedReview.reviewer.trim() ||
    !input.boundedReview.coherent ||
    !input.boundedReview.observable) {
    throw new Error("Healthy baseline requires bounded coherence review");
  }
  return deepFreeze({
    ...input,
    state: "ORBITAL_HEALTHY_STOCK_BASELINE_READY" as const,
    query: {
      key: "orbitalStepPolicy" as const,
      value: input.candidate
    },
    perspectiveStepScale: resolveTakramOrbitalProductionStepScale(
      input.candidate
    )
  });
}
