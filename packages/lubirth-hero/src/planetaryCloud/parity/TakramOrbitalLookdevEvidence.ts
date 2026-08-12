import { deepFreeze, type DeepReadonly } from "./TakramCloudScaleDefaults";
import type {
  TakramOrbitalCoverage,
  TakramOrbitalOpticalDepthScale,
  TakramOrbitalPreset,
  TakramOrbitalVerticalScale
} from "./TakramOrbitalLookdevContract";

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
