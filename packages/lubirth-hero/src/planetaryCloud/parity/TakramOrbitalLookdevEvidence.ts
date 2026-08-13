import { deepFreeze, type DeepReadonly } from "./TakramCloudScaleDefaults";
import type {
  TakramOrbitalCoverage,
  TakramOrbitalOpticalDepthScale,
  TakramOrbitalPreset,
  TakramOrbitalVerticalScale
} from "./TakramOrbitalLookdevContract";
import type { TakramOrbitalGpuPolicyPopulation } from
  "./TakramOrbitalProductionPolicy";
import {
  TAKRAM_ORBITAL_PRODUCTION_PROGRESSES,
  type TakramOrbitalProductionProgress
} from "./TakramOrbitalProductionPolicy";
import type { TakramOrbitalSamplingProgressMetrics } from
  "./TakramOrbitalSamplingMetrics";

export const TAKRAM_ORBITAL_VISUAL_REVIEW_SCHEMA =
  "takram-orbital-lookdev-visual-review/v1" as const;
export const TAKRAM_ORBITAL_EVIDENCE_SCHEMA =
  "takram-orbital-lookdev-evidence/v1" as const;
export const TAKRAM_ORBITAL_REVIEW_PROGRESS = Object.freeze([
  0,
  0.06,
  0.12,
  0.18
] as const);

export const TAKRAM_ORBITAL_REVIEW_DIMENSIONS = Object.freeze([
  "macroCoherence",
  "cloudGroundSeparation",
  "depthLayering",
  "lightingBsmRead",
  "openingIdentityStability",
  "artifactFreedom"
] as const);

export type TakramOrbitalReviewDimension =
  (typeof TAKRAM_ORBITAL_REVIEW_DIMENSIONS)[number];
export type TakramOrbitalReviewScore = 0 | 1 | 2;
export type TakramOrbitalReviewStage = "B" | "C" | "D";
export type TakramOrbitalTopologyDecision =
  | "TOPOLOGY_PASS"
  | "TOPOLOGY_AMBIGUOUS"
  | "TOPOLOGY_UNOBSERVABLE"
  | "HARD_ARTIFACT_FAIL";

export interface TakramOrbitalVisualReviewFrame {
  readonly hardFlags: readonly string[];
  readonly progress: (typeof TAKRAM_ORBITAL_REVIEW_PROGRESS)[number];
  readonly scores: Readonly<Record<
    TakramOrbitalReviewDimension,
    TakramOrbitalReviewScore
  >>;
}

export interface TakramOrbitalVisualReview {
  readonly candidateId: string;
  readonly cleanCommit: string;
  readonly frames: readonly TakramOrbitalVisualReviewFrame[];
  readonly nativeFrame: 32;
  readonly referenceHashes: Readonly<{ nasa: string; takram: string }>;
  readonly reviewer: string;
  readonly schema: typeof TAKRAM_ORBITAL_VISUAL_REVIEW_SCHEMA;
  readonly viewport: Readonly<{ dpr: 1; height: 960; width: 1440 }>;
}

export interface TakramOrbitalReviewedCandidate {
  readonly candidateId: string;
  readonly coverage: TakramOrbitalCoverage;
  readonly opticalDepthScale?: TakramOrbitalOpticalDepthScale;
  readonly preset: Exclude<TakramOrbitalPreset, "native">;
  readonly review: TakramOrbitalVisualReview;
  readonly verticalScale?: TakramOrbitalVerticalScale;
}

export interface TakramOrbitalReviewEvaluation {
  readonly aggregates: Readonly<{
    artifactFreedom: number;
    depthLayering: number;
    total: number;
  }>;
  readonly framePasses: readonly boolean[];
  readonly invalidReasons: readonly string[];
  readonly pass: boolean;
}

const SETUP_GATES = Object.freeze([
  ["cleanCommit", "working-tree-not-clean"],
  ["coordinateHdrReady", "coordinate-or-hdr-not-ready"],
  ["fingerprintParity", "baseline-fingerprint-mismatch"],
  ["fullComposerRemount", "complete-composer-remount-unproven"],
  ["nativeFrameLock", "native-frame-lock-incomplete"],
  ["referencesValid", "references-invalid"],
  ["repeatNoiseFloorPass", "repeat-noise-floor-failed"],
  ["runtimeReadbackMatch", "runtime-readback-drift"]
] as const);

export type TakramOrbitalStage0Gates = Readonly<Record<
  (typeof SETUP_GATES)[number][0],
  boolean
>>;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatProgress(progress: number) {
  return Number.isInteger(progress) ? String(progress) : String(progress);
}

function isReviewScore(value: unknown): value is TakramOrbitalReviewScore {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2;
}

export function evaluateTakramOrbitalVisualReview(
  review: TakramOrbitalVisualReview
): DeepReadonly<TakramOrbitalReviewEvaluation> {
  const invalidReasons: string[] = [];
  const framePasses: boolean[] = [];
  let total = 0;
  let artifactFreedom = 0;
  let depthLayering = 0;

  if (review.schema !== TAKRAM_ORBITAL_VISUAL_REVIEW_SCHEMA) {
    invalidReasons.push("invalid-review-schema");
  }
  if (!review.reviewer.trim()) invalidReasons.push("missing-reviewer");
  if (!/^[0-9a-f]{40}$/.test(review.cleanCommit)) {
    invalidReasons.push("invalid-clean-commit");
  }
  if (review.nativeFrame !== 32) invalidReasons.push("invalid-native-frame");
  if (review.viewport.width !== 1440 || review.viewport.height !== 960 ||
    review.viewport.dpr !== 1) {
    invalidReasons.push("invalid-viewport");
  }
  if (review.frames.length !== TAKRAM_ORBITAL_REVIEW_PROGRESS.length) {
    invalidReasons.push("invalid-frame-count");
  }

  for (const [index, expectedProgress] of TAKRAM_ORBITAL_REVIEW_PROGRESS.entries()) {
    const frame = review.frames[index];
    if (frame === undefined) {
      framePasses.push(false);
      continue;
    }
    let framePass = true;
    if (frame.progress !== expectedProgress) {
      invalidReasons.push(`frame-${index}-progress-mismatch`);
      framePass = false;
    }
    for (const flag of frame.hardFlags) {
      invalidReasons.push(`frame-${formatProgress(frame.progress)}-hard-flag:${flag}`);
      framePass = false;
    }
    for (const dimension of TAKRAM_ORBITAL_REVIEW_DIMENSIONS) {
      const score = frame.scores[dimension];
      if (!isReviewScore(score)) {
        invalidReasons.push(
          `frame-${formatProgress(frame.progress)}-score-${dimension}-invalid`
        );
        framePass = false;
        continue;
      }
      total += score;
      if (dimension === "artifactFreedom") artifactFreedom += score;
      if (dimension === "depthLayering") depthLayering += score;
      if (score < 1) {
        invalidReasons.push(
          `frame-${formatProgress(frame.progress)}-score-${dimension}-below-1`
        );
        framePass = false;
      }
    }
    framePasses.push(framePass);
  }

  return deepFreeze({
    aggregates: { artifactFreedom, depthLayering, total },
    framePasses,
    invalidReasons,
    pass: invalidReasons.length === 0 && framePasses.length === 4 &&
      framePasses.every(Boolean)
  });
}

const PRESET_H: Readonly<Record<Exclude<TakramOrbitalPreset, "native">, number>> =
  Object.freeze({ h40: 40, h80: 80, h120: 120 });

export interface TakramOrbitalRankedCandidate extends TakramOrbitalReviewedCandidate {
  readonly evaluation: TakramOrbitalReviewEvaluation;
}

function compareRankedCandidates(
  left: TakramOrbitalRankedCandidate,
  right: TakramOrbitalRankedCandidate,
  stage: TakramOrbitalReviewStage
) {
  const aggregateComparisons = [
    right.evaluation.aggregates.total - left.evaluation.aggregates.total,
    right.evaluation.aggregates.artifactFreedom -
      left.evaluation.aggregates.artifactFreedom,
    right.evaluation.aggregates.depthLayering -
      left.evaluation.aggregates.depthLayering
  ];
  for (const result of aggregateComparisons) {
    if (result !== 0) return result;
  }
  const departure = stage === "B"
    ? Math.abs(left.coverage - 0.3) - Math.abs(right.coverage - 0.3)
    : stage === "C"
      ? Math.abs((left.verticalScale ?? 1) - 1) -
        Math.abs((right.verticalScale ?? 1) - 1)
      : Math.abs((left.opticalDepthScale ?? 1) - 1) -
        Math.abs((right.opticalDepthScale ?? 1) - 1);
  if (departure !== 0) return departure;
  const h = PRESET_H[left.preset] - PRESET_H[right.preset];
  if (h !== 0) return h;
  return left.candidateId.localeCompare(right.candidateId);
}

export function rankTakramOrbitalPassingCandidates(
  candidates: readonly TakramOrbitalReviewedCandidate[],
  stage: TakramOrbitalReviewStage
): DeepReadonly<readonly TakramOrbitalRankedCandidate[]> {
  const ranked = candidates.flatMap((candidate) => {
    if (candidate.review.candidateId !== candidate.candidateId) return [];
    const evaluation = evaluateTakramOrbitalVisualReview(candidate.review);
    return evaluation.pass ? [{ ...candidate, evaluation }] : [];
  });
  ranked.sort((left, right) => compareRankedCandidates(left, right, stage));
  return deepFreeze(ranked);
}

export function resolveTakramOrbitalStage0(gates: TakramOrbitalStage0Gates) {
  const invalidReasons = SETUP_GATES.flatMap(([gate, reason]) =>
    gates[gate] ? [] : [reason]
  );
  return deepFreeze({
    invalidReasons,
    state: invalidReasons.length === 0
      ? "ORBITAL_STAGE_A_UNLOCKED" as const
      : "ORBITAL_LOOKDEV_SETUP_BLOCKED" as const
  });
}

export function resolveTakramOrbitalStageA(
  candidates: readonly Readonly<{
    candidateId: string;
    decision: TakramOrbitalTopologyDecision;
  }>[]
) {
  const survivorIds = candidates
    .filter(({ decision }) => decision !== "HARD_ARTIFACT_FAIL")
    .map(({ candidateId }) => candidateId);
  return deepFreeze({
    state: survivorIds.length === 0
      ? "BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED" as const
      : "ORBITAL_STAGE_B_UNLOCKED" as const,
    survivorIds
  });
}

export function resolveTakramOrbitalStageB(
  candidates: readonly TakramOrbitalReviewedCandidate[]
) {
  const winnersByPreset = (["h40", "h80", "h120"] as const).flatMap((preset) =>
    rankTakramOrbitalPassingCandidates(
      candidates.filter((candidate) => candidate.preset === preset),
      "B"
    ).slice(0, 1)
  );
  const ordering = rankTakramOrbitalPassingCandidates(winnersByPreset, "B")
    .map(({ candidateId }) => candidateId);
  const survivorIds = ordering.slice(0, 2);
  return deepFreeze({
    ordering,
    state: survivorIds.length === 0
      ? "BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED" as const
      : "ORBITAL_STAGE_C_UNLOCKED" as const,
    survivorIds
  });
}

export function resolveTakramOrbitalStageC(
  candidates: readonly TakramOrbitalReviewedCandidate[]
) {
  const ordering = rankTakramOrbitalPassingCandidates(candidates, "C")
    .map(({ candidateId }) => candidateId);
  return deepFreeze({
    ordering,
    state: ordering.length === 0
      ? "ORBITAL_VERTICAL_PROFILE_FAIL" as const
      : "ORBITAL_STAGE_D_UNLOCKED" as const,
    winnerId: ordering[0] ?? null
  });
}

export function resolveTakramOrbitalStageD(
  candidates: readonly TakramOrbitalReviewedCandidate[]
) {
  const ordering = rankTakramOrbitalPassingCandidates(candidates, "D")
    .map(({ candidateId }) => candidateId);
  return deepFreeze({
    ordering,
    state: ordering.length === 0
      ? "ORBITAL_OPTICAL_DEPTH_FAIL" as const
      : "ORBITAL_LOOKDEV_WINNER" as const,
    winnerId: ordering[0] ?? null
  });
}

export const TAKRAM_ORBITAL_V2_VISUAL_REVIEW_SCHEMA =
  "takram-orbital-lookdev-visual-review/v2" as const;
export const TAKRAM_ORBITAL_V2_HARD_FLAGS = Object.freeze([
  "cube-face-seam",
  "wrap-discontinuity",
  "unstable-opening-identity",
  "captured-signal-loss"
] as const);
export const TAKRAM_ORBITAL_V2_STAGE_DIMENSIONS = deepFreeze({
  "4A": [
    "macroCoherence",
    "openingIdentityStability",
    "artifactFreedom"
  ],
  "4B": [
    "macroCoherence",
    "coverageUsability",
    "openingIdentityStability",
    "artifactFreedom"
  ],
  "4C": [
    "macroCoherence",
    "cloudGroundSeparation",
    "depthLayering",
    "openingIdentityStability",
    "artifactFreedom"
  ],
  "4D": [
    "macroCoherence",
    "cloudGroundSeparation",
    "depthLayering",
    "lightingBsmRead",
    "openingIdentityStability",
    "artifactFreedom"
  ]
} as const);

export type TakramOrbitalV2Stage = "4A" | "4B" | "4C" | "4D";
export type TakramOrbitalV2GateStage = TakramOrbitalV2Stage | "final-stock";
export type TakramOrbitalV2HardFlag =
  (typeof TAKRAM_ORBITAL_V2_HARD_FLAGS)[number];
export type TakramOrbitalV2VisualDimension =
  | "macroCoherence"
  | "coverageUsability"
  | "cloudGroundSeparation"
  | "depthLayering"
  | "lightingBsmRead"
  | "openingIdentityStability"
  | "artifactFreedom";

const ALL_V2_DIMENSIONS = Object.freeze([
  "macroCoherence",
  "coverageUsability",
  "cloudGroundSeparation",
  "depthLayering",
  "lightingBsmRead",
  "openingIdentityStability",
  "artifactFreedom"
] as const satisfies readonly TakramOrbitalV2VisualDimension[]);

export interface TakramOrbitalV2VisualReviewFrame {
  readonly progress: TakramOrbitalProductionProgress;
  readonly hardFlags: readonly TakramOrbitalV2HardFlag[];
  readonly scores: Partial<Readonly<Record<
    TakramOrbitalV2VisualDimension,
    TakramOrbitalReviewScore
  >>>;
}

export interface TakramOrbitalV2VisualReview {
  readonly schema: typeof TAKRAM_ORBITAL_V2_VISUAL_REVIEW_SCHEMA;
  readonly reviewer: string;
  readonly cleanCommit: string;
  readonly candidateId: string;
  readonly stage: TakramOrbitalV2Stage;
  readonly nativeFrame: 32;
  readonly viewport: Readonly<{ width: 1440; height: 960; dpr: 1 }>;
  readonly referenceHashes: Readonly<{ nasa: string; takram: string }>;
  readonly frames: readonly TakramOrbitalV2VisualReviewFrame[];
}

export interface TakramOrbitalV2VisualEvaluation {
  readonly valid: boolean;
  readonly pass: boolean;
  readonly invalidReasons: readonly string[];
  readonly failureReasons: readonly string[];
  readonly aggregateScore: number;
  readonly dimensionAggregates: Readonly<Record<
    TakramOrbitalV2VisualDimension,
    number
  >>;
}

export interface TakramOrbitalV2ProgressEvidence {
  readonly progress: TakramOrbitalProductionProgress;
  readonly setupInvalidReasons: readonly string[];
  readonly metrics: TakramOrbitalSamplingProgressMetrics;
  readonly nativeHitPixelCount: number;
}

export interface TakramOrbitalV2CandidateInput {
  readonly candidateId: string;
  readonly morphologyH: 40 | 80 | 120;
  readonly coverage: 0.3 | 0.4 | 0.45 | 0.55;
  readonly verticalScale: 1 | 2 | 4;
  readonly opticalDepthScale: 0.75 | 1 | 1.5;
  readonly progresses: readonly TakramOrbitalV2ProgressEvidence[];
  readonly review?: TakramOrbitalV2VisualReview;
}

export interface TakramOrbitalV2SharedGateInput {
  readonly stage: TakramOrbitalV2GateStage;
  readonly candidates: readonly TakramOrbitalV2CandidateInput[];
}

export interface TakramOrbitalV2SetupFailure {
  readonly candidateId: string;
  readonly progress: TakramOrbitalProductionProgress | null;
  readonly reasons: readonly string[];
}

export interface TakramOrbitalV2SamplingFailure {
  readonly candidateId: string;
  readonly progress: TakramOrbitalProductionProgress;
  readonly enteredPrimaryMarchPixelCount: number;
  readonly primaryCapSaturationFraction: number;
  readonly reasons: readonly string[];
}

export interface TakramOrbitalV2SharedGateDecision {
  readonly state:
    | "V2_SHARED_GATE_READY"
    | "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED"
    | "ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL";
  readonly failedStage: TakramOrbitalV2GateStage | null;
  readonly survivorIds: readonly string[];
  readonly setupFailures: readonly TakramOrbitalV2SetupFailure[];
  readonly samplingFailures: readonly TakramOrbitalV2SamplingFailure[];
}

function v2ExactProgresses(progresses: readonly TakramOrbitalV2ProgressEvidence[]) {
  return progresses.length === TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.length &&
    progresses.every((entry, index) =>
      entry.progress === TAKRAM_ORBITAL_PRODUCTION_PROGRESSES[index]
    );
}

function v2FiniteMetricReasons(metrics: TakramOrbitalSamplingProgressMetrics) {
  const reasons: string[] = [];
  for (const [name, value] of Object.entries(metrics)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      reasons.push(`non-finite-metric:${name}`);
    }
  }
  return reasons;
}

export function resolveTakramOrbitalV2SharedGate(
  input: TakramOrbitalV2SharedGateInput
): DeepReadonly<TakramOrbitalV2SharedGateDecision> {
  const setupFailures: TakramOrbitalV2SetupFailure[] = [];
  const samplingFailures: TakramOrbitalV2SamplingFailure[] = [];
  const seenCandidateIds = new Set<string>();
  for (const candidate of input.candidates) {
    const candidateReasons: string[] = [];
    if (!candidate.candidateId.trim()) candidateReasons.push("missing-candidate-id");
    if (seenCandidateIds.has(candidate.candidateId)) {
      candidateReasons.push("duplicate-candidate-id");
    }
    seenCandidateIds.add(candidate.candidateId);
    if (!v2ExactProgresses(candidate.progresses)) {
      candidateReasons.push("invalid-progress-set");
    }
    if (candidateReasons.length > 0) {
      setupFailures.push({
        candidateId: candidate.candidateId,
        progress: null,
        reasons: candidateReasons
      });
    }
    for (const entry of candidate.progresses) {
      const reasons = [
        ...entry.setupInvalidReasons,
        ...entry.metrics.setupInvalidReasons,
        ...v2FiniteMetricReasons(entry.metrics)
      ];
      if (!entry.metrics.evidenceValid && reasons.length === 0) {
        reasons.push("invalid-machine-evidence");
      }
      if (!Number.isInteger(entry.nativeHitPixelCount) ||
        entry.nativeHitPixelCount < 0) {
        reasons.push("invalid-native-hit-pixel-count");
      }
      if (!Number.isInteger(entry.metrics.enteredPrimaryMarchPixelCount) ||
        entry.metrics.enteredPrimaryMarchPixelCount < 0) {
        reasons.push("invalid-entered-primary-march-count");
      }
      if (entry.metrics.primaryCapSaturationFraction < 0 ||
        entry.metrics.primaryCapSaturationFraction > 1) {
        reasons.push("invalid-primary-cap-saturation-fraction");
      }
      if (reasons.length > 0) {
        setupFailures.push({
          candidateId: candidate.candidateId,
          progress: entry.progress,
          reasons: [...new Set(reasons)]
        });
        continue;
      }
      const samplingReasons: string[] = [];
      if (entry.metrics.enteredPrimaryMarchPixelCount === 0) {
        samplingReasons.push("primary-march-entry-absent");
      }
      if (entry.metrics.primaryCapSaturationFraction > 0.01) {
        samplingReasons.push("primary-cap-saturation");
      }
      if (samplingReasons.length > 0) {
        samplingFailures.push({
          candidateId: candidate.candidateId,
          progress: entry.progress,
          enteredPrimaryMarchPixelCount:
            entry.metrics.enteredPrimaryMarchPixelCount,
          primaryCapSaturationFraction:
            entry.metrics.primaryCapSaturationFraction,
          reasons: samplingReasons
        });
      }
    }
  }
  if (input.candidates.length === 0) {
    setupFailures.push({
      candidateId: "",
      progress: null,
      reasons: ["missing-required-candidates"]
    });
  }
  if (setupFailures.length > 0) {
    return deepFreeze({
      state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED" as const,
      failedStage: input.stage,
      survivorIds: [],
      setupFailures,
      samplingFailures: []
    });
  }
  const failedCandidateIds = new Set(
    samplingFailures.map(({ candidateId }) => candidateId)
  );
  const survivorIds = input.candidates
    .map(({ candidateId }) => candidateId)
    .filter((candidateId) => !failedCandidateIds.has(candidateId));
  return deepFreeze({
    state: survivorIds.length > 0
      ? "V2_SHARED_GATE_READY" as const
      : "ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL" as const,
    failedStage: survivorIds.length > 0 ? null : input.stage,
    survivorIds,
    setupFailures: [],
    samplingFailures
  });
}

export interface TakramOrbitalV2SignalPresenceInput {
  readonly stage: "4A" | "4B";
  readonly candidates: readonly TakramOrbitalV2CandidateInput[];
}

export interface TakramOrbitalV2SignalPresenceFailure {
  readonly candidateId: string;
  readonly progress: TakramOrbitalProductionProgress;
  readonly reasons: readonly (
    | "native-hit-absent"
    | "pre-temporal-signal-absent"
  )[];
}

export interface TakramOrbitalV2SignalPresenceDecision {
  readonly state: "V2_SIGNAL_PRESENCE_READY" | "V2_SIGNAL_PRESENCE_EMPTY";
  readonly survivorIds: readonly string[];
  readonly machineFailures: readonly TakramOrbitalV2SignalPresenceFailure[];
}

export function resolveTakramOrbitalV2SignalPresenceGate(
  input: TakramOrbitalV2SignalPresenceInput
): DeepReadonly<TakramOrbitalV2SignalPresenceDecision> {
  const machineFailures: TakramOrbitalV2SignalPresenceFailure[] = [];
  for (const candidate of input.candidates) {
    for (const entry of candidate.progresses) {
      const reasons: TakramOrbitalV2SignalPresenceFailure["reasons"][number][] = [];
      if (entry.nativeHitPixelCount === 0) reasons.push("native-hit-absent");
      if (entry.metrics.preTemporalSignalPixelFraction === 0) {
        reasons.push("pre-temporal-signal-absent");
      }
      if (reasons.length > 0) {
        machineFailures.push({
          candidateId: candidate.candidateId,
          progress: entry.progress,
          reasons
        });
      }
    }
  }
  const failedCandidateIds = new Set(
    machineFailures.map(({ candidateId }) => candidateId)
  );
  const survivorIds = input.candidates
    .map(({ candidateId }) => candidateId)
    .filter((candidateId) => !failedCandidateIds.has(candidateId));
  return deepFreeze({
    state: survivorIds.length > 0
      ? "V2_SIGNAL_PRESENCE_READY" as const
      : "V2_SIGNAL_PRESENCE_EMPTY" as const,
    survivorIds,
    machineFailures
  });
}

function emptyV2DimensionAggregates(): Record<TakramOrbitalV2VisualDimension, number> {
  return {
    macroCoherence: 0,
    coverageUsability: 0,
    cloudGroundSeparation: 0,
    depthLayering: 0,
    lightingBsmRead: 0,
    openingIdentityStability: 0,
    artifactFreedom: 0
  };
}

export function evaluateTakramOrbitalV2VisualReview(
  review: TakramOrbitalV2VisualReview
): DeepReadonly<TakramOrbitalV2VisualEvaluation> {
  const invalidReasons: string[] = [];
  const failureReasons: string[] = [];
  const dimensionAggregates = emptyV2DimensionAggregates();
  if (review.schema !== TAKRAM_ORBITAL_V2_VISUAL_REVIEW_SCHEMA) {
    invalidReasons.push("invalid-review-schema");
  }
  if (!review.reviewer.trim()) invalidReasons.push("missing-reviewer");
  if (!/^[0-9a-f]{40}$/.test(review.cleanCommit)) {
    invalidReasons.push("invalid-clean-commit");
  }
  if (!review.candidateId.trim()) invalidReasons.push("missing-candidate-id");
  if (!(review.stage in TAKRAM_ORBITAL_V2_STAGE_DIMENSIONS)) {
    invalidReasons.push("invalid-review-stage");
  }
  if (review.nativeFrame !== 32) invalidReasons.push("invalid-native-frame");
  if (review.viewport.width !== 1440 || review.viewport.height !== 960 ||
    review.viewport.dpr !== 1) {
    invalidReasons.push("invalid-viewport");
  }
  if (!review.referenceHashes.nasa.trim() ||
    !review.referenceHashes.takram.trim()) {
    invalidReasons.push("missing-reference-hash");
  }
  if (review.frames.length !== TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.length) {
    invalidReasons.push("invalid-frame-count");
  }
  const requiredDimensions = TAKRAM_ORBITAL_V2_STAGE_DIMENSIONS[review.stage] ?? [];
  for (const [index, expectedProgress] of
    TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.entries()) {
    const frame = review.frames[index];
    if (frame === undefined) continue;
    if (frame.progress !== expectedProgress) {
      invalidReasons.push(`frame-${index}:progress-mismatch`);
    }
    for (const hardFlag of frame.hardFlags) {
      if (!(TAKRAM_ORBITAL_V2_HARD_FLAGS as readonly string[])
        .includes(hardFlag)) {
        invalidReasons.push(`frame-${frame.progress}:invalid-hard-flag:${hardFlag}`);
      } else {
        failureReasons.push(`frame-${frame.progress}:hard-flag:${hardFlag}`);
      }
    }
    for (const [dimension, score] of Object.entries(
      frame.scores as Readonly<Record<string, unknown>>
    )) {
      if (!(ALL_V2_DIMENSIONS as readonly string[]).includes(dimension)) {
        invalidReasons.push(`frame-${frame.progress}:invalid-dimension:${dimension}`);
        continue;
      }
      if (!isReviewScore(score)) {
        invalidReasons.push(`frame-${frame.progress}:invalid-score:${dimension}`);
      }
    }
    for (const dimension of requiredDimensions) {
      const score = frame.scores[dimension];
      if (!isReviewScore(score)) {
        invalidReasons.push(`frame-${frame.progress}:missing-score:${dimension}`);
        continue;
      }
      dimensionAggregates[dimension] += score;
      if (score < 1) {
        failureReasons.push(`frame-${frame.progress}:score-below-1:${dimension}`);
      }
    }
  }
  const aggregateScore = requiredDimensions.reduce(
    (sum, dimension) => sum + dimensionAggregates[dimension],
    0
  );
  return deepFreeze({
    valid: invalidReasons.length === 0,
    pass: invalidReasons.length === 0 && failureReasons.length === 0,
    invalidReasons,
    failureReasons,
    aggregateScore,
    dimensionAggregates
  });
}

export interface TakramOrbitalV2StageInput<Stage extends TakramOrbitalV2Stage> {
  readonly stage: Stage;
  readonly candidates: readonly TakramOrbitalV2CandidateInput[];
}

export interface TakramOrbitalV2StageDecision {
  readonly state:
    | "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED"
    | "ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL"
    | "ORBITAL_LOOKDEV_V2_MORPHOLOGY_FAIL"
    | "ORBITAL_LOOKDEV_V2_COVERAGE_FAIL"
    | "ORBITAL_LOOKDEV_V2_VERTICAL_FAIL"
    | "ORBITAL_LOOKDEV_V2_OPTICAL_FAIL"
    | "ORBITAL_LOOKDEV_V2_STAGE_4B_READY"
    | "ORBITAL_LOOKDEV_V2_STAGE_4C_READY"
    | "ORBITAL_LOOKDEV_V2_STAGE_4D_READY"
    | "ORBITAL_STOCK_LOOKDEV_V2_WINNER";
  readonly failedStage: TakramOrbitalV2Stage | null;
  readonly survivorIds: readonly string[];
  readonly winnerId: string | null;
  readonly setupFailures: readonly TakramOrbitalV2SetupFailure[];
  readonly samplingFailures: readonly TakramOrbitalV2SamplingFailure[];
  readonly machineFailures: readonly TakramOrbitalV2SignalPresenceFailure[];
  readonly visualEvaluations: readonly Readonly<{
    candidateId: string;
    evaluation: TakramOrbitalV2VisualEvaluation;
  }>[];
}

function v2StageContractValid(
  candidate: TakramOrbitalV2CandidateInput,
  stage: TakramOrbitalV2Stage
) {
  const common = [40, 80, 120].includes(candidate.morphologyH) &&
    [0.3, 0.4, 0.45, 0.55].includes(candidate.coverage) &&
    [1, 2, 4].includes(candidate.verticalScale) &&
    [0.75, 1, 1.5].includes(candidate.opticalDepthScale);
  if (!common) return false;
  if (stage === "4A") {
    return candidate.coverage === 0.3 && candidate.verticalScale === 1 &&
      candidate.opticalDepthScale === 1;
  }
  if (stage === "4B") {
    return candidate.verticalScale === 1 && candidate.opticalDepthScale === 1;
  }
  if (stage === "4C") return candidate.opticalDepthScale === 1;
  return true;
}

function exactNumberSet(values: readonly number[], expected: readonly number[]) {
  return values.length === expected.length &&
    [...values].sort((left, right) => left - right).every(
      (value, index) => value === [...expected].sort((left, right) => left - right)[index]
    );
}

function v2CaptureMatrixValid(
  candidates: readonly TakramOrbitalV2CandidateInput[],
  stage: TakramOrbitalV2Stage
) {
  if (stage === "4A") {
    return exactNumberSet(candidates.map(({ morphologyH }) => morphologyH), [40, 80, 120]);
  }
  const groups = new Map<string, number[]>();
  for (const candidate of candidates) {
    const key = stage === "4B"
      ? String(candidate.morphologyH)
      : stage === "4C"
        ? `${candidate.morphologyH}/${candidate.coverage}`
        : `${candidate.morphologyH}/${candidate.coverage}/${candidate.verticalScale}`;
    const axisValue = stage === "4B"
      ? candidate.coverage
      : stage === "4C"
        ? candidate.verticalScale
        : candidate.opticalDepthScale;
    const group = groups.get(key) ?? [];
    group.push(axisValue);
    groups.set(key, group);
  }
  if (groups.size === 0 || (stage === "4D" && groups.size !== 1)) return false;
  const expected = stage === "4B"
    ? [0.3, 0.4, 0.45, 0.55]
    : stage === "4C"
      ? [1, 2, 4]
      : [0.75, 1, 1.5];
  return [...groups.values()].every((values) => exactNumberSet(values, expected));
}

interface V2EvaluatedCandidate {
  readonly candidate: TakramOrbitalV2CandidateInput;
  readonly evaluation: TakramOrbitalV2VisualEvaluation;
}

function compareV2Candidates(
  left: V2EvaluatedCandidate,
  right: V2EvaluatedCandidate,
  stage: TakramOrbitalV2Stage
) {
  const leftScores = left.evaluation.dimensionAggregates;
  const rightScores = right.evaluation.dimensionAggregates;
  const common = [right.evaluation.aggregateScore - left.evaluation.aggregateScore];
  if (stage === "4B") {
    common.push(
      rightScores.artifactFreedom - leftScores.artifactFreedom,
      rightScores.macroCoherence - leftScores.macroCoherence,
      Math.abs(left.candidate.coverage - 0.3) -
        Math.abs(right.candidate.coverage - 0.3),
      left.candidate.morphologyH - right.candidate.morphologyH
    );
  } else if (stage === "4C") {
    common.push(
      rightScores.depthLayering - leftScores.depthLayering,
      rightScores.cloudGroundSeparation - leftScores.cloudGroundSeparation,
      rightScores.artifactFreedom - leftScores.artifactFreedom,
      Math.abs(left.candidate.verticalScale - 1) -
        Math.abs(right.candidate.verticalScale - 1),
      Math.abs(left.candidate.coverage - 0.3) -
        Math.abs(right.candidate.coverage - 0.3),
      left.candidate.morphologyH - right.candidate.morphologyH
    );
  } else if (stage === "4D") {
    common.push(
      rightScores.lightingBsmRead - leftScores.lightingBsmRead,
      rightScores.depthLayering - leftScores.depthLayering,
      rightScores.artifactFreedom - leftScores.artifactFreedom,
      Math.abs(left.candidate.opticalDepthScale - 1) -
        Math.abs(right.candidate.opticalDepthScale - 1),
      Math.abs(left.candidate.verticalScale - 1) -
        Math.abs(right.candidate.verticalScale - 1),
      Math.abs(left.candidate.coverage - 0.3) -
        Math.abs(right.candidate.coverage - 0.3),
      left.candidate.morphologyH - right.candidate.morphologyH
    );
  }
  for (const result of common) {
    if (result !== 0) return result;
  }
  return left.candidate.candidateId.localeCompare(right.candidate.candidateId);
}

function v2StageDecision(input: Readonly<{
  state: TakramOrbitalV2StageDecision["state"];
  failedStage?: TakramOrbitalV2Stage | null;
  survivorIds?: readonly string[];
  winnerId?: string | null;
  setupFailures?: readonly TakramOrbitalV2SetupFailure[];
  samplingFailures?: readonly TakramOrbitalV2SamplingFailure[];
  machineFailures?: readonly TakramOrbitalV2SignalPresenceFailure[];
  visualEvaluations?: TakramOrbitalV2StageDecision["visualEvaluations"];
}>): DeepReadonly<TakramOrbitalV2StageDecision> {
  return deepFreeze({
    state: input.state,
    failedStage: input.failedStage ?? null,
    survivorIds: [...(input.survivorIds ?? [])],
    winnerId: input.winnerId ?? null,
    setupFailures: [...(input.setupFailures ?? [])],
    samplingFailures: [...(input.samplingFailures ?? [])],
    machineFailures: [...(input.machineFailures ?? [])],
    visualEvaluations: [...(input.visualEvaluations ?? [])]
  });
}

function resolveV2Stage(
  input: TakramOrbitalV2StageInput<TakramOrbitalV2Stage>
): DeepReadonly<TakramOrbitalV2StageDecision> {
  const contractFailures = input.candidates.flatMap((candidate) =>
    v2StageContractValid(candidate, input.stage)
      ? []
      : [{
          candidateId: candidate.candidateId,
          progress: null,
          reasons: ["invalid-stage-contract"]
        } satisfies TakramOrbitalV2SetupFailure]
  );
  if (contractFailures.length > 0) {
    return v2StageDecision({
      state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED",
      failedStage: input.stage,
      setupFailures: contractFailures
    });
  }
  if (!v2CaptureMatrixValid(input.candidates, input.stage)) {
    return v2StageDecision({
      state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED",
      failedStage: input.stage,
      setupFailures: [{
        candidateId: "",
        progress: null,
        reasons: ["invalid-stage-capture-matrix"]
      }]
    });
  }
  const shared = resolveTakramOrbitalV2SharedGate(input);
  if (shared.state !== "V2_SHARED_GATE_READY") {
    return v2StageDecision({
      state: shared.state,
      failedStage: input.stage,
      setupFailures: shared.setupFailures,
      samplingFailures: shared.samplingFailures
    });
  }
  let survivors = input.candidates.filter(({ candidateId }) =>
    shared.survivorIds.includes(candidateId)
  );
  let machineFailures: readonly TakramOrbitalV2SignalPresenceFailure[] = [];
  if (input.stage === "4A" || input.stage === "4B") {
    const signal = resolveTakramOrbitalV2SignalPresenceGate({
      stage: input.stage,
      candidates: survivors
    });
    machineFailures = signal.machineFailures;
    survivors = survivors.filter(({ candidateId }) =>
      signal.survivorIds.includes(candidateId)
    );
    if (survivors.length === 0) {
      return v2StageDecision({
        state: input.stage === "4A"
          ? "ORBITAL_LOOKDEV_V2_MORPHOLOGY_FAIL"
          : "ORBITAL_LOOKDEV_V2_COVERAGE_FAIL",
        failedStage: input.stage,
        machineFailures,
        samplingFailures: shared.samplingFailures
      });
    }
  }

  const visualEvaluations = survivors.map((candidate) => ({
    candidate,
    evaluation: candidate.review === undefined
      ? null
      : evaluateTakramOrbitalV2VisualReview(candidate.review)
  }));
  const invalidReviews = visualEvaluations.flatMap(({ candidate, evaluation }) => {
    const reasons = evaluation === null
      ? ["missing-required-review"]
      : [
          ...(candidate.review?.candidateId === candidate.candidateId
            ? []
            : ["review-candidate-mismatch"]),
          ...(candidate.review?.stage === input.stage
            ? []
            : ["review-stage-mismatch"]),
          ...evaluation.invalidReasons
        ];
    return reasons.length === 0
      ? []
      : [{
          candidateId: candidate.candidateId,
          progress: null,
          reasons: reasons.map((reason) => `visual-review:${reason}`)
        } satisfies TakramOrbitalV2SetupFailure];
  });
  if (invalidReviews.length > 0) {
    return v2StageDecision({
      state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED",
      failedStage: input.stage,
      setupFailures: invalidReviews,
      samplingFailures: shared.samplingFailures,
      machineFailures
    });
  }
  const passing = visualEvaluations.flatMap(({ candidate, evaluation }) =>
    evaluation?.pass ? [{ candidate, evaluation }] : []
  );
  const publishedVisualEvaluations = visualEvaluations.flatMap(
    ({ candidate, evaluation }) => evaluation === null
      ? []
      : [{ candidateId: candidate.candidateId, evaluation }]
  );
  if (passing.length === 0) {
    const failStates = {
      "4A": "ORBITAL_LOOKDEV_V2_MORPHOLOGY_FAIL",
      "4B": "ORBITAL_LOOKDEV_V2_COVERAGE_FAIL",
      "4C": "ORBITAL_LOOKDEV_V2_VERTICAL_FAIL",
      "4D": "ORBITAL_LOOKDEV_V2_OPTICAL_FAIL"
    } as const;
    return v2StageDecision({
      state: failStates[input.stage],
      failedStage: input.stage,
      samplingFailures: shared.samplingFailures,
      machineFailures,
      visualEvaluations: publishedVisualEvaluations
    });
  }
  if (input.stage === "4A") {
    return v2StageDecision({
      state: "ORBITAL_LOOKDEV_V2_STAGE_4B_READY",
      survivorIds: passing.map(({ candidate }) => candidate.candidateId),
      samplingFailures: shared.samplingFailures,
      machineFailures,
      visualEvaluations: publishedVisualEvaluations
    });
  }
  passing.sort((left, right) => compareV2Candidates(left, right, input.stage));
  if (input.stage === "4B") {
    const retainedMorphologies = new Set<number>();
    const survivorIds = passing.flatMap(({ candidate }) => {
      if (retainedMorphologies.has(candidate.morphologyH)) return [];
      retainedMorphologies.add(candidate.morphologyH);
      return [candidate.candidateId];
    }).slice(0, 2);
    return v2StageDecision({
      state: "ORBITAL_LOOKDEV_V2_STAGE_4C_READY",
      survivorIds,
      samplingFailures: shared.samplingFailures,
      machineFailures,
      visualEvaluations: publishedVisualEvaluations
    });
  }
  const winnerId = passing[0]!.candidate.candidateId;
  return v2StageDecision({
    state: input.stage === "4C"
      ? "ORBITAL_LOOKDEV_V2_STAGE_4D_READY"
      : "ORBITAL_STOCK_LOOKDEV_V2_WINNER",
    survivorIds: [winnerId],
    winnerId,
    samplingFailures: shared.samplingFailures,
    visualEvaluations: publishedVisualEvaluations
  });
}

export function resolveTakramOrbitalV2Stage4A(
  input: TakramOrbitalV2StageInput<"4A">
) {
  return resolveV2Stage(input);
}

export function resolveTakramOrbitalV2Stage4B(
  input: TakramOrbitalV2StageInput<"4B">
) {
  return resolveV2Stage(input);
}

export function resolveTakramOrbitalV2Stage4C(
  input: TakramOrbitalV2StageInput<"4C">
) {
  return resolveV2Stage(input);
}

export function resolveTakramOrbitalV2Stage4D(
  input: TakramOrbitalV2StageInput<"4D">
) {
  return resolveV2Stage(input);
}

export interface TakramOrbitalV2FinalStockReplayInput {
  readonly winnerId: string;
  readonly candidate: TakramOrbitalV2CandidateInput;
}

export interface TakramOrbitalV2FinalStockReplayDecision {
  readonly state:
    | "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED"
    | "ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL"
    | "ORBITAL_LOOKDEV_V2_FINAL_STOCK_READY";
  readonly failedStage: "final-stock" | null;
  readonly winnerId: string;
  readonly gpuAuthorized: boolean;
  readonly v3Authorized: boolean;
  readonly setupFailures: readonly TakramOrbitalV2SetupFailure[];
  readonly samplingFailures: readonly TakramOrbitalV2SamplingFailure[];
}

export function resolveTakramOrbitalV2FinalStockReplay(
  input: TakramOrbitalV2FinalStockReplayInput
): DeepReadonly<TakramOrbitalV2FinalStockReplayDecision> {
  if (!input.winnerId.trim() || input.candidate.candidateId !== input.winnerId) {
    return deepFreeze({
      state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED" as const,
      failedStage: "final-stock" as const,
      winnerId: input.winnerId,
      gpuAuthorized: false,
      v3Authorized: false,
      setupFailures: [{
        candidateId: input.candidate.candidateId,
        progress: null,
        reasons: ["final-stock-winner-mismatch"]
      }],
      samplingFailures: []
    });
  }
  const shared = resolveTakramOrbitalV2SharedGate({
    stage: "final-stock",
    candidates: [input.candidate]
  });
  const ready = shared.state === "V2_SHARED_GATE_READY";
  return deepFreeze({
    state: ready
      ? "ORBITAL_LOOKDEV_V2_FINAL_STOCK_READY" as const
      : shared.state,
    failedStage: ready ? null : "final-stock" as const,
    winnerId: input.winnerId,
    gpuAuthorized: ready,
    v3Authorized: ready,
    setupFailures: shared.setupFailures,
    samplingFailures: shared.samplingFailures
  });
}

export interface TakramOrbitalV2FinalClassificationInput {
  readonly replay: TakramOrbitalV2FinalStockReplayDecision;
  readonly winnerId: string;
  readonly populations: readonly Readonly<{
    progress: TakramOrbitalProductionProgress;
    population: TakramOrbitalGpuPolicyPopulation;
  }>[];
}

export interface TakramOrbitalV2FinalClassificationDecision {
  readonly state:
    | TakramOrbitalV2FinalStockReplayDecision["state"]
    | "ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE"
    | "ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY"
    | "ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET"
    | "ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED";
  readonly winnerId: string;
  readonly maxP95Milliseconds: number | null;
  readonly homepagePromotionAuthorized: boolean;
  readonly v3Authorized: boolean;
  readonly invalidReasons: readonly string[];
}

function validV2FinalPopulation(population: TakramOrbitalGpuPolicyPopulation) {
  return population.measurementMode === "total-only-time-elapsed" &&
    population.warmupFrameCount === 120 &&
    population.targetSampleCount === 120 &&
    population.validSampleCount === 120 &&
    population.state === "complete" &&
    population.timestampBits > 0 &&
    population.invalidReasons.length === 0 &&
    Number.isFinite(population.p95Milliseconds) &&
    Number(population.p95Milliseconds) >= 0 &&
    population.stageNames === undefined;
}

export function resolveTakramOrbitalV2FinalClassification(
  input: TakramOrbitalV2FinalClassificationInput
): DeepReadonly<TakramOrbitalV2FinalClassificationDecision> {
  if (input.replay.state !== "ORBITAL_LOOKDEV_V2_FINAL_STOCK_READY" ||
    !input.replay.gpuAuthorized || input.replay.winnerId !== input.winnerId) {
    return deepFreeze({
      state: input.replay.state,
      winnerId: input.winnerId,
      maxP95Milliseconds: null,
      homepagePromotionAuthorized: false,
      v3Authorized: false,
      invalidReasons: input.replay.setupFailures.flatMap(({ reasons }) => reasons)
    });
  }
  const invalidReasons: string[] = [];
  if (input.populations.length !== TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.length ||
    !input.populations.every((entry, index) =>
      entry.progress === TAKRAM_ORBITAL_PRODUCTION_PROGRESSES[index]
    )) {
    invalidReasons.push("invalid-final-gpu-progress-set");
  }
  const populationIds = new Set<string>();
  for (const entry of input.populations) {
    if (!validV2FinalPopulation(entry.population)) {
      invalidReasons.push(`progress-${entry.progress}:invalid-timer-population`);
    }
    if (!entry.population.populationId.trim() ||
      populationIds.has(entry.population.populationId)) {
      invalidReasons.push(`progress-${entry.progress}:non-independent-population`);
    }
    populationIds.add(entry.population.populationId);
  }
  if (invalidReasons.length > 0) {
    return deepFreeze({
      state: "ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED" as const,
      winnerId: input.winnerId,
      maxP95Milliseconds: null,
      homepagePromotionAuthorized: false,
      v3Authorized: true,
      invalidReasons
    });
  }
  const maxP95Milliseconds = Math.max(...input.populations.map(({ population }) =>
    Number(population.p95Milliseconds)
  ));
  const state = maxP95Milliseconds <= 3
    ? "ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE" as const
    : maxP95Milliseconds <= 4
      ? "ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY" as const
      : "ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET" as const;
  return deepFreeze({
    state,
    winnerId: input.winnerId,
    maxP95Milliseconds,
    homepagePromotionAuthorized: maxP95Milliseconds <= 3,
    v3Authorized: true,
    invalidReasons: []
  });
}

export function authorizeTakramOrbitalStageCapture(input: Readonly<{
  candidateId: string;
  committedWinnerId: string | null;
  stage: "E" | "F";
}>) {
  const authorized = input.committedWinnerId !== null &&
    input.candidateId === input.committedWinnerId;
  return deepFreeze({
    authorized,
    reason: authorized ? null : "candidate-is-not-committed-stock-winner" as const
  });
}

export interface TakramOrbitalBaselineFingerprint {
  readonly classification: string;
  readonly resolver: Readonly<{
    kind: string;
    value: Record<string, unknown>;
  }>;
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export function normalizeTakramOrbitalBaselineFingerprint(
  fingerprint: TakramOrbitalBaselineFingerprint
): DeepReadonly<Record<string, unknown>> {
  if (!isObject(fingerprint) || !isObject(fingerprint.resolver) ||
    !isObject(fingerprint.resolver.value)) {
    throw new Error("Invalid orbital baseline fingerprint resolver wrapper");
  }
  const {
    schemaVersion: _schemaVersion,
    classification: _classification,
    resolver,
    ...outerEvidence
  } = fingerprint;
  const { kind: _kind, value, ...resolverEvidence } = resolver;
  return deepFreeze(structuredClone({
    ...outerEvidence,
    ...resolverEvidence,
    ...value
  }));
}

function maskedRgbaMae(
  left: Uint8Array,
  right: Uint8Array,
  mask: Uint8Array
) {
  if (left.length !== right.length || left.length % 4 !== 0) {
    throw new Error("RGBA frames must have equal lengths divisible by four");
  }
  if (mask.length !== left.length / 4) {
    throw new Error("Mask must contain one byte per RGBA pixel");
  }
  let absoluteDelta = 0;
  let sampledChannelCount = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] === 0) continue;
    const offset = pixel * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      absoluteDelta += Math.abs(left[offset + channel]! - right[offset + channel]!);
      sampledChannelCount += 1;
    }
  }
  if (sampledChannelCount === 0) throw new Error("Mask selects no RGBA channels");
  return { mae: absoluteDelta / sampledChannelCount, sampledChannelCount };
}

export function resolveTakramOrbitalRepeatNoiseFloor(input: Readonly<{
  legacyA: Uint8Array;
  legacyB: Uint8Array;
  lookdevA: Uint8Array;
  lookdevB: Uint8Array;
  mask: Uint8Array;
}>) {
  const legacy = maskedRgbaMae(input.legacyA, input.legacyB, input.mask);
  const lookdev = maskedRgbaMae(input.lookdevA, input.lookdevB, input.mask);
  const crossA = maskedRgbaMae(input.legacyA, input.lookdevA, input.mask);
  const crossB = maskedRgbaMae(input.legacyB, input.lookdevB, input.mask);
  const repeatNoiseFloor = Math.max(legacy.mae, lookdev.mae);
  return deepFreeze({
    crossRouteMae: { a: crossA.mae, b: crossB.mae },
    pass: crossA.mae <= repeatNoiseFloor && crossB.mae <= repeatNoiseFloor,
    repeatNoiseFloor,
    sameRouteMae: { legacy: legacy.mae, lookdev: lookdev.mae },
    sampledChannelCount: legacy.sampledChannelCount
  });
}

export interface TakramOrbitalEvidenceManifestInput {
  readonly checkpointState: string;
  readonly cleanCommit: string;
  readonly hashes: Readonly<{
    packages: Readonly<Record<string, string>>;
    patches: Readonly<Record<string, string>>;
    references: Readonly<Record<string, string>>;
    screenshots: Readonly<Record<string, string>>;
    shaders: Readonly<Record<string, string>>;
  }>;
  readonly identities: Readonly<{
    driftAttemptLedgerOutcome: string;
    lookdevBaseKey: string;
    lookdevMountKey: string;
    resetNonce: number;
    runtimeEvidenceEpoch: string;
  }>;
  readonly query: string;
  readonly ranking: readonly string[];
  readonly rawDiagnostics: Readonly<{
    candidateId: string;
    references: readonly string[];
  }> | null;
  readonly rendererFingerprint: unknown;
  readonly requestedContract: unknown;
  readonly review: TakramOrbitalVisualReview | null;
  readonly runtimeReadback: unknown;
  readonly setupInvalidReasons: readonly string[];
  readonly timer: Readonly<{
    candidateId: string;
    invalidReasons: readonly string[];
    rawPopulationReferences: readonly string[];
    state: string;
  }> | null;
  readonly winnerId: string | null;
  readonly [key: string]: unknown;
}

export function createTakramOrbitalEvidenceManifest(
  input: TakramOrbitalEvidenceManifestInput
) {
  if (input.rawDiagnostics !== null &&
    (input.winnerId === null || input.rawDiagnostics.candidateId !== input.winnerId)) {
    throw new Error("Raw diagnostics are restricted to the committed stock winner");
  }
  if (input.timer !== null &&
    (input.winnerId === null || input.timer.candidateId !== input.winnerId)) {
    throw new Error("GPU timing is restricted to the committed stock winner");
  }
  const { schema: _schema, ...evidence } = input as
    TakramOrbitalEvidenceManifestInput & { schema?: unknown };
  return deepFreeze(structuredClone({
    ...evidence,
    schema: TAKRAM_ORBITAL_EVIDENCE_SCHEMA
  }));
}
