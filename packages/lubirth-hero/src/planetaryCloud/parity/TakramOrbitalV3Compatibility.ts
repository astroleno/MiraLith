import { deepFreeze, type DeepReadonly } from "./TakramCloudScaleDefaults";
import type {
  TakramOrbitalV2FinalClassificationDecision,
  TakramOrbitalV2FinalStockReplayDecision,
  TakramOrbitalV2StageDecision
} from "./TakramOrbitalLookdevEvidence";
import {
  TAKRAM_ORBITAL_PRODUCTION_PROGRESSES,
  type TakramOrbitalProductionProgress
} from "./TakramOrbitalProductionPolicy";

export const TAKRAM_ORBITAL_V3_TEMPORAL_FRAMES = Object.freeze([
  1,
  2,
  4,
  8,
  16,
  32
] as const);
export const TAKRAM_ORBITAL_V3_VISUAL_REVIEW_SCHEMA =
  "takram-orbital-v3-visual-review/v1" as const;
export const TAKRAM_ORBITAL_V3_VISUAL_DIMENSIONS = Object.freeze([
  "macroCoherence",
  "coverageUsability",
  "cloudGroundSeparation",
  "depthLayering",
  "lightingBsmRead",
  "artifactFreedom"
] as const);
export const TAKRAM_ORBITAL_V3_HARD_FLAGS = Object.freeze([
  "tiling-repeat",
  "isolated-speckle",
  "march-band",
  "temporal-ghost",
  "frame-pop",
  "ground-intersection",
  "clipped-solid-fill",
  "other-with-required-note"
] as const);

export type TakramOrbitalV3VisualDimension =
  (typeof TAKRAM_ORBITAL_V3_VISUAL_DIMENSIONS)[number];
export type TakramOrbitalV3HardFlag =
  (typeof TAKRAM_ORBITAL_V3_HARD_FLAGS)[number];
export type TakramOrbitalV3Outcome =
  | "V3_WEATHER_ADAPTER_SETUP_BLOCKED"
  | "V3_WEATHER_ADAPTER_FAIL"
  | "V3_WEATHER_ADAPTER_PASS";

export interface TakramOrbitalV3AdapterIdentity {
  readonly textureIdentity: string;
  readonly textureHash: string;
  readonly mapping: string;
  readonly repeat: readonly [number, number];
  readonly offset: readonly [number, number];
  readonly wrap: readonly [string, string];
  readonly channelTransform: string;
}

export interface TakramOrbitalV3ArtifactAudit {
  readonly artifactId: string;
  readonly declaredHash: string;
  readonly actualHash: string;
  readonly declaredByteLength: number;
  readonly actualByteLength: number;
}

export interface TakramOrbitalV3ArmSetup {
  readonly input: "stock" | "v3";
  readonly coreIdentity: Readonly<Record<string, unknown>>;
  readonly adapter: TakramOrbitalV3AdapterIdentity;
  readonly allocationEpoch: string;
  readonly repeatAllocationEpoch: string;
  readonly allocationGenerations: Readonly<{
    cloudCurrent: number;
    cloudHistory: number;
    shadowCurrent: number;
    shadowHistory: number;
    resolveCurrent: number;
    resolveHistory: number;
  }>;
  readonly temporalFrames: readonly number[];
  readonly readbackAudit: Readonly<{ invalidReasons: readonly string[] }>;
  readonly expectedArtifactIds: readonly string[];
  readonly artifacts: readonly TakramOrbitalV3ArtifactAudit[];
  readonly baseCaptureHash: string;
  readonly repeatCaptureHash: string;
}

export type TakramOrbitalV3FinalClassification = Extract<
  TakramOrbitalV2FinalClassificationDecision["state"],
  | "ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE"
  | "ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY"
  | "ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET"
  | "ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED"
>;

export interface TakramOrbitalV3SetupInput {
  readonly stage4D: Readonly<{
    state: TakramOrbitalV2StageDecision["state"];
    winnerId: string | null;
    contract: Readonly<Record<string, unknown>>;
  }>;
  readonly finalStock: Readonly<{
    winnerId: string;
    contract: Readonly<Record<string, unknown>>;
    replay: TakramOrbitalV2FinalStockReplayDecision;
    classification: TakramOrbitalV3FinalClassification | null;
  }>;
  readonly expectedAdapters: Readonly<{
    stock: TakramOrbitalV3AdapterIdentity;
    v3: TakramOrbitalV3AdapterIdentity;
  }>;
  readonly progresses: readonly Readonly<{
    progress: TakramOrbitalProductionProgress;
    stock: TakramOrbitalV3ArmSetup;
    v3: TakramOrbitalV3ArmSetup;
  }>[];
}

export interface TakramOrbitalV3SetupDecision {
  readonly required: boolean;
  readonly valid: boolean;
  readonly winnerId: string | null;
  readonly skipReason:
    | "stage-4d-winner-not-ready"
    | "final-stock-replay-not-ready"
    | null;
  readonly invalidReasons: readonly string[];
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function exactArray<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function exactSet(left: readonly string[], right: readonly string[]) {
  return exactArray([...left].sort(), [...right].sort());
}

const ADAPTER_KEYS = Object.freeze([
  "channelTransform",
  "mapping",
  "offset",
  "repeat",
  "textureHash",
  "textureIdentity",
  "wrap"
] as const);

function validateAdapter(
  adapter: TakramOrbitalV3AdapterIdentity,
  prefix: string,
  reasons: string[]
) {
  if (!exactSet(Object.keys(adapter), ADAPTER_KEYS)) {
    reasons.push(`${prefix}:invalid-adapter-field-set`);
    return;
  }
  for (const field of [
    "textureIdentity",
    "textureHash",
    "mapping",
    "channelTransform"
  ] as const) {
    if (typeof adapter[field] !== "string" || !adapter[field].trim()) {
      reasons.push(`${prefix}:invalid-adapter-${field}`);
    }
  }
  for (const [field, values] of [
    ["repeat", adapter.repeat],
    ["offset", adapter.offset]
  ] as const) {
    if (values.length !== 2 || !values.every(Number.isFinite)) {
      reasons.push(`${prefix}:invalid-adapter-${field}`);
    }
  }
  if (adapter.wrap.length !== 2 || adapter.wrap.some((value) => !value.trim())) {
    reasons.push(`${prefix}:invalid-adapter-wrap`);
  }
}

function validateArm(
  arm: TakramOrbitalV3ArmSetup,
  expectedInput: "stock" | "v3",
  prefix: string,
  reasons: string[],
  epochIds: Set<string>
) {
  if (arm.input !== expectedInput) reasons.push(`${prefix}:input-mismatch`);
  if (Object.keys(arm.coreIdentity).length === 0) {
    reasons.push(`${prefix}:missing-core-identity`);
  }
  if (arm.coreIdentity.disableDefaultLayers !== true) {
    reasons.push(`${prefix}:default-layers-not-disabled`);
  }
  const layers = arm.coreIdentity.layers;
  if (!Array.isArray(layers) || !exactArray(
    layers.map((layer) =>
      layer !== null && typeof layer === "object"
        ? String((layer as Record<string, unknown>).channel)
        : ""
    ),
    ["r", "g", "b", "a"]
  )) {
    reasons.push(`${prefix}:invalid-official-layer-array`);
  }
  validateAdapter(arm.adapter, prefix, reasons);
  if (!arm.allocationEpoch.trim() || !arm.repeatAllocationEpoch.trim() ||
    arm.allocationEpoch === arm.repeatAllocationEpoch) {
    reasons.push(`${prefix}:allocation-epoch-not-fresh`);
  }
  for (const epoch of [arm.allocationEpoch, arm.repeatAllocationEpoch]) {
    if (epochIds.has(epoch)) reasons.push(`${prefix}:allocation-epoch-reused`);
    epochIds.add(epoch);
  }
  const generationKeys = [
    "cloudCurrent",
    "cloudHistory",
    "shadowCurrent",
    "shadowHistory",
    "resolveCurrent",
    "resolveHistory"
  ] as const;
  if (!exactSet(Object.keys(arm.allocationGenerations), generationKeys) ||
    generationKeys.some((key) =>
      !Number.isInteger(arm.allocationGenerations[key]) ||
      arm.allocationGenerations[key] <= 0
    )) {
    reasons.push(`${prefix}:invalid-allocation-generations`);
  }
  if (!exactArray(arm.temporalFrames, TAKRAM_ORBITAL_V3_TEMPORAL_FRAMES)) {
    reasons.push(`${prefix}:invalid-temporal-frame-set`);
  }
  if (arm.readbackAudit.invalidReasons.length > 0) {
    reasons.push(...arm.readbackAudit.invalidReasons.map((reason) =>
      `${prefix}:readback:${reason}`
    ));
  }
  if (arm.expectedArtifactIds.length === 0 ||
    !exactSet(
      arm.artifacts.map(({ artifactId }) => artifactId),
      arm.expectedArtifactIds
    )) {
    reasons.push(`${prefix}:artifact-set-mismatch`);
  }
  if (arm.artifacts.some((artifact) =>
    !artifact.artifactId.trim() ||
    !artifact.declaredHash.trim() ||
    artifact.declaredHash !== artifact.actualHash ||
    !Number.isInteger(artifact.declaredByteLength) ||
    artifact.declaredByteLength <= 0 ||
    artifact.declaredByteLength !== artifact.actualByteLength
  )) {
    reasons.push(`${prefix}:artifact-mismatch`);
  }
  if (!arm.baseCaptureHash.trim() ||
    arm.baseCaptureHash !== arm.repeatCaptureHash) {
    reasons.push(`${prefix}:fresh-mount-repeat-mismatch`);
  }
}

export function validateTakramOrbitalV3Setup(
  input: TakramOrbitalV3SetupInput
): DeepReadonly<TakramOrbitalV3SetupDecision> {
  if (input.stage4D.state !== "ORBITAL_STOCK_LOOKDEV_V2_WINNER" ||
    input.stage4D.winnerId === null) {
    return deepFreeze({
      required: false,
      valid: false,
      winnerId: input.stage4D.winnerId,
      skipReason: "stage-4d-winner-not-ready" as const,
      invalidReasons: []
    });
  }
  if (input.finalStock.replay.state !==
      "ORBITAL_LOOKDEV_V2_FINAL_STOCK_READY" ||
    !input.finalStock.replay.v3Authorized) {
    return deepFreeze({
      required: false,
      valid: false,
      winnerId: input.stage4D.winnerId,
      skipReason: "final-stock-replay-not-ready" as const,
      invalidReasons: []
    });
  }
  const invalidReasons: string[] = [];
  if (input.stage4D.winnerId !== input.finalStock.winnerId ||
    input.finalStock.replay.winnerId !== input.finalStock.winnerId) {
    invalidReasons.push("stage4d-final-stock-winner-mismatch");
  }
  if (stableJson(input.stage4D.contract) !== stableJson(input.finalStock.contract)) {
    invalidReasons.push("stage4d-final-stock-contract-mismatch");
  }
  if (![
    "ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE",
    "ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY",
    "ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET",
    "ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED"
  ].includes(input.finalStock.classification ?? "")) {
    invalidReasons.push("missing-final-stock-classification");
  }
  const expectedAdapters = input.expectedAdapters;
  if (expectedAdapters === undefined) {
    invalidReasons.push("missing-expected-adapter-identities");
  }
  if (input.progresses.length !== TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.length ||
    !input.progresses.every((entry, index) =>
      entry.progress === TAKRAM_ORBITAL_PRODUCTION_PROGRESSES[index]
    )) {
    invalidReasons.push("invalid-progress-set");
  }
  const epochIds = new Set<string>();
  for (const entry of input.progresses) {
    validateArm(
      entry.stock,
      "stock",
      `progress-${entry.progress}:stock`,
      invalidReasons,
      epochIds
    );
    if (expectedAdapters !== undefined && stableJson(entry.stock.adapter) !==
      stableJson(expectedAdapters.stock)) {
      invalidReasons.push(`progress-${entry.progress}:stock:unexpected-adapter-identity`);
    }
    if (expectedAdapters !== undefined && stableJson(entry.v3.adapter) !==
      stableJson(expectedAdapters.v3)) {
      invalidReasons.push(`progress-${entry.progress}:v3:unexpected-adapter-identity`);
    }
    validateArm(
      entry.v3,
      "v3",
      `progress-${entry.progress}:v3`,
      invalidReasons,
      epochIds
    );
    if (stableJson(entry.stock.coreIdentity) !==
      stableJson(entry.v3.coreIdentity)) {
      invalidReasons.push(
        `progress-${entry.progress}:stock-v3-core-identity-mismatch`
      );
    }
  }
  return deepFreeze({
    required: true,
    valid: invalidReasons.length === 0,
    winnerId: input.stage4D.winnerId,
    skipReason: null,
    invalidReasons: [...new Set(invalidReasons)]
  });
}

export interface TakramOrbitalV3ProgressMetrics {
  readonly progress: TakramOrbitalProductionProgress;
  readonly cloudPixelFraction: number;
  readonly preTemporalSignalPixelFraction: number;
  readonly largestConnectedAreaFraction: number;
  readonly singlePixelFragmentFraction: number;
  readonly smallFragmentFraction: number;
  readonly edgeDensity: number;
  readonly clearAirLeakage: number;
  readonly firstConvergedLumaDelta: number;
  readonly signalRetention: number;
  readonly signalLumaRetention: number;
  readonly enteredPrimaryMarchPixelCount: number;
  readonly primaryCapSaturationFraction: number;
  readonly noHitPrimaryCapSaturationFraction: number;
  readonly nativeHitPixelFraction: number;
  readonly rawFinalCloudSignalDifference: number;
  readonly fullBsmOffDifference: number;
  readonly opacityMean: number;
  readonly lumaMean: number;
  readonly baseRepeatByteIdentical: boolean;
}

export interface TakramOrbitalV3ProgressDecision {
  readonly progress: TakramOrbitalProductionProgress;
  readonly evidenceValid: boolean;
  readonly pass: boolean;
  readonly invalidReasons: readonly string[];
  readonly failureReasons: readonly string[];
  readonly primaryCapSaturationFraction: number;
  readonly noHitPrimaryCapSaturationFraction: number;
  readonly metrics: TakramOrbitalV3ProgressMetrics;
}

const V3_PROGRESS_METRIC_KEYS = Object.freeze([
  "baseRepeatByteIdentical",
  "clearAirLeakage",
  "cloudPixelFraction",
  "edgeDensity",
  "enteredPrimaryMarchPixelCount",
  "firstConvergedLumaDelta",
  "fullBsmOffDifference",
  "largestConnectedAreaFraction",
  "lumaMean",
  "nativeHitPixelFraction",
  "noHitPrimaryCapSaturationFraction",
  "opacityMean",
  "preTemporalSignalPixelFraction",
  "primaryCapSaturationFraction",
  "progress",
  "rawFinalCloudSignalDifference",
  "signalLumaRetention",
  "signalRetention",
  "singlePixelFragmentFraction",
  "smallFragmentFraction"
] as const);

export function deriveTakramOrbitalV3ProgressDecision(
  input: TakramOrbitalV3ProgressMetrics
): DeepReadonly<TakramOrbitalV3ProgressDecision> {
  const invalidReasons: string[] = [];
  for (const field of Object.keys(input)) {
    if (!(V3_PROGRESS_METRIC_KEYS as readonly string[]).includes(field)) {
      invalidReasons.push(`forbidden-metric-field:${field}`);
    }
  }
  if (!TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.includes(input.progress)) {
    invalidReasons.push("invalid-progress");
  }
  for (const [name, value] of Object.entries(input)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      invalidReasons.push(`non-finite:${name}`);
    }
  }
  if (!Number.isInteger(input.enteredPrimaryMarchPixelCount) ||
    input.enteredPrimaryMarchPixelCount < 0) {
    invalidReasons.push("invalid-entered-primary-march-count");
  }
  for (const field of [
    "cloudPixelFraction",
    "preTemporalSignalPixelFraction",
    "largestConnectedAreaFraction",
    "singlePixelFragmentFraction",
    "smallFragmentFraction",
    "edgeDensity",
    "clearAirLeakage",
    "primaryCapSaturationFraction",
    "noHitPrimaryCapSaturationFraction",
    "nativeHitPixelFraction"
  ] as const) {
    if (input[field] < 0 || input[field] > 1) {
      invalidReasons.push(`out-of-range:${field}`);
    }
  }
  for (const field of [
    "firstConvergedLumaDelta",
    "signalRetention",
    "signalLumaRetention",
    "rawFinalCloudSignalDifference",
    "fullBsmOffDifference",
    "opacityMean",
    "lumaMean"
  ] as const) {
    if (input[field] < 0) invalidReasons.push(`negative:${field}`);
  }
  if (!input.baseRepeatByteIdentical) {
    invalidReasons.push("fresh-mount-repeat-mismatch");
  }
  const failureReasons: string[] = [];
  if (input.cloudPixelFraction < 0.002) {
    failureReasons.push("cloud-pixel-fraction");
  }
  if (input.preTemporalSignalPixelFraction < 0.002) {
    failureReasons.push("pre-temporal-signal");
  }
  if (input.largestConnectedAreaFraction < 0.25) {
    failureReasons.push("largest-connected-area");
  }
  if (input.singlePixelFragmentFraction > 0.02) {
    failureReasons.push("single-pixel-fragments");
  }
  if (input.smallFragmentFraction > 0.08) {
    failureReasons.push("small-fragments");
  }
  if (input.edgeDensity > 0.65) failureReasons.push("edge-density");
  if (input.clearAirLeakage > 0.05) failureReasons.push("clear-air-leakage");
  if (input.firstConvergedLumaDelta > 0.08) {
    failureReasons.push("first-converged-luma-delta");
  }
  if (input.signalRetention < 0.9 || input.signalRetention > 1.1) {
    failureReasons.push("signal-retention");
  }
  if (input.signalLumaRetention < 0.8 || input.signalLumaRetention > 1.2) {
    failureReasons.push("signal-luma-retention");
  }
  if (input.enteredPrimaryMarchPixelCount <= 0) {
    failureReasons.push("primary-march-entry");
  }
  if (input.primaryCapSaturationFraction > 0.01) {
    failureReasons.push("primary-cap-saturation");
  }
  return deepFreeze({
    progress: input.progress,
    evidenceValid: invalidReasons.length === 0,
    pass: invalidReasons.length === 0 && failureReasons.length === 0,
    invalidReasons,
    failureReasons,
    primaryCapSaturationFraction: input.primaryCapSaturationFraction,
    noHitPrimaryCapSaturationFraction:
      input.noHitPrimaryCapSaturationFraction,
    metrics: { ...input }
  });
}

export interface TakramOrbitalV3VisualHardFlagRecord {
  readonly flag: TakramOrbitalV3HardFlag;
  readonly note?: string;
}

export interface TakramOrbitalV3VisualReview {
  readonly schema: typeof TAKRAM_ORBITAL_V3_VISUAL_REVIEW_SCHEMA;
  readonly reviewer: string;
  readonly cleanCommit: string;
  readonly winnerId: string;
  readonly identity: Readonly<Record<string, unknown>>;
  readonly viewport: Readonly<{ width: 1440; height: 960; dpr: 1 }>;
  readonly contactSheetHashes: Readonly<{ stock: string; v3: string }>;
  readonly referenceHashes: Readonly<{ nasa: string; takram: string }>;
  readonly sequenceOpeningIdentityStability: 0 | 1 | 2;
  readonly frames: readonly Readonly<{
    progress: TakramOrbitalProductionProgress;
    scores: Readonly<Record<TakramOrbitalV3VisualDimension, 0 | 1 | 2>>;
    hardFlags: readonly TakramOrbitalV3VisualHardFlagRecord[];
  }>[];
}

export interface TakramOrbitalV3VisualEvaluation {
  readonly valid: boolean;
  readonly pass: boolean;
  readonly invalidReasons: readonly string[];
  readonly failureReasons: readonly string[];
  readonly aggregateScore: number;
}

function v3Score(value: unknown): value is 0 | 1 | 2 {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2;
}

export function evaluateTakramOrbitalV3VisualReview(
  review: TakramOrbitalV3VisualReview
): DeepReadonly<TakramOrbitalV3VisualEvaluation> {
  const invalidReasons: string[] = [];
  const failureReasons: string[] = [];
  let aggregateScore = 0;
  for (const field of ["result", "pass", "outcome", "metricPass"]) {
    if (field in (review as unknown as Record<string, unknown>)) {
      invalidReasons.push(`forbidden-${field === "result" ? "result" : field}-field`);
    }
  }
  if (review.schema !== TAKRAM_ORBITAL_V3_VISUAL_REVIEW_SCHEMA) {
    invalidReasons.push("invalid-review-schema");
  }
  if (!review.reviewer.trim()) invalidReasons.push("missing-reviewer");
  if (!/^[0-9a-f]{40}$/.test(review.cleanCommit)) {
    invalidReasons.push("invalid-clean-commit");
  }
  if (!review.winnerId.trim()) invalidReasons.push("missing-winner-id");
  if (Object.keys(review.identity).length === 0) {
    invalidReasons.push("missing-review-identity");
  }
  if (review.viewport.width !== 1440 || review.viewport.height !== 960 ||
    review.viewport.dpr !== 1) {
    invalidReasons.push("invalid-viewport");
  }
  for (const [name, hash] of [
    ...Object.entries(review.contactSheetHashes),
    ...Object.entries(review.referenceHashes)
  ]) {
    if (!String(hash).trim()) invalidReasons.push(`missing-hash:${name}`);
  }
  if (!v3Score(review.sequenceOpeningIdentityStability)) {
    invalidReasons.push("invalid-sequence-opening-score");
  } else {
    aggregateScore += review.sequenceOpeningIdentityStability;
    if (review.sequenceOpeningIdentityStability < 1) {
      failureReasons.push("sequence-opening-identity-stability");
    }
  }
  if (review.frames.length !== TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.length) {
    invalidReasons.push("invalid-frame-count");
  }
  for (const [index, expectedProgress] of
    TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.entries()) {
    const frame = review.frames[index];
    if (frame === undefined) continue;
    if (frame.progress !== expectedProgress) {
      invalidReasons.push(`frame-${index}:progress-mismatch`);
    }
    if (!exactSet(
      Object.keys(frame.scores),
      TAKRAM_ORBITAL_V3_VISUAL_DIMENSIONS
    )) {
      invalidReasons.push(`frame-${frame.progress}:invalid-score-field-set`);
    }
    for (const dimension of TAKRAM_ORBITAL_V3_VISUAL_DIMENSIONS) {
      const score = frame.scores[dimension];
      if (!v3Score(score)) {
        invalidReasons.push(`frame-${frame.progress}:invalid-score:${dimension}`);
        continue;
      }
      aggregateScore += score;
      if (score < 1) {
        failureReasons.push(`frame-${frame.progress}:score-below-1:${dimension}`);
      }
    }
    for (const record of frame.hardFlags) {
      if (!(TAKRAM_ORBITAL_V3_HARD_FLAGS as readonly string[])
        .includes(record.flag)) {
        invalidReasons.push(`frame-${frame.progress}:invalid-hard-flag:${record.flag}`);
        continue;
      }
      if (record.flag === "other-with-required-note" && !record.note?.trim()) {
        invalidReasons.push(`frame-${frame.progress}:other-hard-flag-requires-note`);
        continue;
      }
      failureReasons.push(`frame-${frame.progress}:hard-flag:${record.flag}`);
    }
  }
  return deepFreeze({
    valid: invalidReasons.length === 0,
    pass: invalidReasons.length === 0 && failureReasons.length === 0,
    invalidReasons,
    failureReasons,
    aggregateScore
  });
}

export interface TakramOrbitalV3ResolverInput {
  readonly setup: TakramOrbitalV3SetupDecision;
  readonly stockProgressDecisions: readonly TakramOrbitalV3ProgressDecision[];
  readonly v3ProgressDecisions: readonly TakramOrbitalV3ProgressDecision[];
  readonly visualReview: TakramOrbitalV3VisualReview;
}

export interface TakramOrbitalV3ResolverDecision {
  readonly outcome: TakramOrbitalV3Outcome;
  readonly winnerId: string | null;
  readonly invalidReasons: readonly string[];
  readonly failedProgresses: readonly TakramOrbitalProductionProgress[];
  readonly stockProgressDecisions: readonly TakramOrbitalV3ProgressDecision[];
  readonly v3ProgressDecisions: readonly TakramOrbitalV3ProgressDecision[];
  readonly visualEvaluation: TakramOrbitalV3VisualEvaluation | null;
}

function exactProgressDecisions(
  decisions: readonly TakramOrbitalV3ProgressDecision[]
) {
  return decisions.length === TAKRAM_ORBITAL_PRODUCTION_PROGRESSES.length &&
    decisions.every((decision, index) =>
      decision.progress === TAKRAM_ORBITAL_PRODUCTION_PROGRESSES[index]
    );
}

function resolverDecision(input: Readonly<{
  outcome: TakramOrbitalV3Outcome;
  source: TakramOrbitalV3ResolverInput;
  invalidReasons?: readonly string[];
  failedProgresses?: readonly TakramOrbitalProductionProgress[];
  visualEvaluation?: TakramOrbitalV3VisualEvaluation | null;
}>): DeepReadonly<TakramOrbitalV3ResolverDecision> {
  return deepFreeze({
    outcome: input.outcome,
    winnerId: input.source.setup.winnerId,
    invalidReasons: [...(input.invalidReasons ?? [])],
    failedProgresses: [...(input.failedProgresses ?? [])],
    stockProgressDecisions: [...input.source.stockProgressDecisions],
    v3ProgressDecisions: [...input.source.v3ProgressDecisions],
    visualEvaluation: input.visualEvaluation ?? null
  });
}

export function resolveTakramOrbitalV3Compatibility(
  input: TakramOrbitalV3ResolverInput
): DeepReadonly<TakramOrbitalV3ResolverDecision> {
  if (!input.setup.required || !input.setup.valid) {
    return resolverDecision({
      outcome: "V3_WEATHER_ADAPTER_SETUP_BLOCKED",
      source: input,
      invalidReasons: input.setup.required
        ? input.setup.invalidReasons
        : [input.setup.skipReason ?? "v3-not-authorized"]
    });
  }
  const invalidReasons: string[] = [];
  if (!exactProgressDecisions(input.stockProgressDecisions)) {
    invalidReasons.push("invalid-stock-progress-set");
  }
  if (!exactProgressDecisions(input.v3ProgressDecisions)) {
    invalidReasons.push("invalid-v3-progress-set");
  }
  for (const decision of input.stockProgressDecisions) {
    if (!decision.evidenceValid) {
      invalidReasons.push(...decision.invalidReasons.map((reason) =>
        `stock@${decision.progress}:${reason}`
      ));
    } else if (!decision.pass) {
      invalidReasons.push(...decision.failureReasons.map((reason) =>
        `stock@${decision.progress}:${reason}`
      ));
    }
  }
  for (const decision of input.v3ProgressDecisions) {
    if (!decision.evidenceValid) {
      invalidReasons.push(...decision.invalidReasons.map((reason) =>
        `v3@${decision.progress}:${reason}`
      ));
    }
  }
  const visualEvaluation = evaluateTakramOrbitalV3VisualReview(
    input.visualReview
  );
  if (input.visualReview.winnerId !== input.setup.winnerId) {
    invalidReasons.push("review-winner-mismatch");
  }
  if (!visualEvaluation.valid) {
    invalidReasons.push(...visualEvaluation.invalidReasons.map((reason) =>
      `review:${reason}`
    ));
  }
  if (invalidReasons.length > 0) {
    return resolverDecision({
      outcome: "V3_WEATHER_ADAPTER_SETUP_BLOCKED",
      source: input,
      invalidReasons,
      visualEvaluation
    });
  }
  const failedProgresses = input.v3ProgressDecisions
    .filter(({ pass }) => !pass)
    .map(({ progress }) => progress);
  if (failedProgresses.length > 0 || !visualEvaluation.pass) {
    return resolverDecision({
      outcome: "V3_WEATHER_ADAPTER_FAIL",
      source: input,
      failedProgresses,
      visualEvaluation
    });
  }
  return resolverDecision({
    outcome: "V3_WEATHER_ADAPTER_PASS",
    source: input,
    visualEvaluation
  });
}
