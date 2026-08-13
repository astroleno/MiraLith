import { deepFreeze, type DeepReadonly } from "./TakramCloudScaleDefaults";

export type TakramOrbitalGpuMeasurementMode =
  | "total-only-time-elapsed"
  | "stage-only-sequential-time-elapsed";
export type TakramOrbitalGpuClassification =
  | "SPIKE_VIABLE"
  | "ORBITAL_LOOKDEV_OVER_BUDGET";
export type TakramOrbitalGpuProfileState =
  | "warming"
  | "sampling"
  | "complete"
  | "unsupported";

export const TAKRAM_ORBITAL_GPU_STAGE_NAMES = Object.freeze([
  "bsm-current",
  "bsm-resolve",
  "cloud-current",
  "cloud-resolve",
  "final-effect"
] as const);
export type TakramOrbitalGpuStageName =
  (typeof TAKRAM_ORBITAL_GPU_STAGE_NAMES)[number];

export interface TakramOrbitalGpuStageFrame {
  readonly frameId: number;
  readonly stages: Readonly<Record<string, number>>;
  readonly totalMilliseconds: number;
}

export interface TakramOrbitalGpuProfileSnapshot {
  readonly classification: TakramOrbitalGpuClassification | null;
  readonly bsmCombinedP95Milliseconds: number | null;
  readonly copyOnlySamplesMilliseconds: readonly number[];
  readonly disjointEpochCount: number;
  readonly eligibleForPromotionAmendment: boolean;
  readonly emptyStageBaselineSamplesMilliseconds: readonly number[];
  readonly invalidReasons: readonly string[];
  readonly measurementMode: TakramOrbitalGpuMeasurementMode;
  readonly noopSamplesMilliseconds: readonly number[];
  readonly p95Milliseconds: number | null;
  readonly rawSamplesMilliseconds: readonly number[];
  readonly rawStageSamples: readonly TakramOrbitalGpuStageFrame[];
  readonly stageP95Milliseconds: Readonly<Record<string, number>> | null;
  readonly state: TakramOrbitalGpuProfileState;
  readonly targetSampleCount: number;
  readonly timestampBits: number;
  readonly validSampleCount: number;
  readonly warmupFrameCount: number;
  readonly warmupFramesCompleted: number;
}

interface PendingQuery {
  readonly dispose: () => void;
  readonly epoch: number;
  readonly id: string;
}

interface SampleRecord {
  readonly epoch: number;
  readonly frameId: number;
  readonly copyOnlyMilliseconds: number | null;
  readonly milliseconds: number;
  readonly noopMilliseconds: number | null;
}

export interface TakramOrbitalGpuPopulation {
  beginFrame(): Readonly<{ frameId: number; measure: boolean }>;
  dispose(): void;
  invalidateDisjointEpoch(): void;
  finishStageFrame(frameId: number): void;
  recordStageBaseline(input: Readonly<{
    frameId: number;
    milliseconds: number;
  }>): void;
  recordStageSample(input: Readonly<{
    frameId: number;
    milliseconds: number;
    stage: string;
  }>): void;
  recordTotalSample(input: Readonly<{
    frameId: number;
    copyOnlyMilliseconds?: number;
    milliseconds: number;
    noopMilliseconds?: number;
  }>): void;
  resolvePendingQuery(id: string): void;
  snapshot(): DeepReadonly<TakramOrbitalGpuProfileSnapshot>;
  trackPendingQuery(query: PendingQuery): void;
}

function assertNonNegativeFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

function rounded(value: number) {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function nearestRankPercentile(values: readonly number[], percentile: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[rank - 1]!;
}

export function classifyTakramOrbitalGpuP95(p95Milliseconds: number) {
  assertNonNegativeFinite(p95Milliseconds, "p95Milliseconds");
  return deepFreeze({
    classification: p95Milliseconds <= 4
      ? "SPIKE_VIABLE" as const
      : "ORBITAL_LOOKDEV_OVER_BUDGET" as const,
    eligibleForPromotionAmendment: p95Milliseconds <= 3
  });
}

export function createUnsupportedTakramOrbitalGpuProfile(input: Readonly<{
  invalidReason: string;
  timestampBits: number;
}>): DeepReadonly<TakramOrbitalGpuProfileSnapshot> {
  return deepFreeze({
    classification: null,
    bsmCombinedP95Milliseconds: null,
    copyOnlySamplesMilliseconds: [],
    disjointEpochCount: 0,
    eligibleForPromotionAmendment: false,
    emptyStageBaselineSamplesMilliseconds: [],
    invalidReasons: [input.invalidReason],
    measurementMode: "total-only-time-elapsed",
    noopSamplesMilliseconds: [],
    p95Milliseconds: null,
    rawSamplesMilliseconds: [],
    rawStageSamples: [],
    stageP95Milliseconds: null,
    state: "unsupported",
    targetSampleCount: 120,
    timestampBits: input.timestampBits,
    validSampleCount: 0,
    warmupFrameCount: 120,
    warmupFramesCompleted: 0
  });
}

export function createTakramOrbitalGpuPopulation(input: Readonly<{
  measurementMode: TakramOrbitalGpuMeasurementMode;
  stageNames?: readonly string[];
  targetSampleCount: number;
  timestampBits: number;
  warmupFrameCount: number;
}>): TakramOrbitalGpuPopulation {
  if (!Number.isInteger(input.targetSampleCount) || input.targetSampleCount <= 0) {
    throw new Error("targetSampleCount must be a positive integer");
  }
  if (!Number.isInteger(input.warmupFrameCount) || input.warmupFrameCount < 0) {
    throw new Error("warmupFrameCount must be a non-negative integer");
  }
  const stageNames = [...(input.stageNames ?? [])];
  if (input.measurementMode === "stage-only-sequential-time-elapsed" &&
    stageNames.length === 0) {
    throw new Error("Stage-only mode requires at least one stage name");
  }

  let currentEpoch = 0;
  let frameId = 0;
  let warmupFramesCompleted = 0;
  let disposed = false;
  const invalidReasons: string[] = [];
  const pendingQueries = new Map<string, PendingQuery>();
  let samples: SampleRecord[] = [];
  let completedStageFrames: Array<TakramOrbitalGpuStageFrame & { epoch: number }> = [];
  const partialStageFrames = new Map<number, {
    baselineMilliseconds: number | null;
    stages: Map<string, number>;
  }>();
  let stageBaselines: Array<{ epoch: number; frameId: number; milliseconds: number }> = [];

  function completed() {
    const count = input.measurementMode === "total-only-time-elapsed"
      ? samples.length
      : completedStageFrames.length;
    return count >= input.targetSampleCount;
  }

  function beginFrame() {
    frameId += 1;
    if (disposed || completed()) return { frameId, measure: false };
    if (warmupFramesCompleted < input.warmupFrameCount) {
      warmupFramesCompleted += 1;
      return { frameId, measure: false };
    }
    return { frameId, measure: true };
  }

  function recordTotalSample(sample: Readonly<{
    frameId: number;
    copyOnlyMilliseconds?: number;
    milliseconds: number;
    noopMilliseconds?: number;
  }>) {
    if (disposed || completed()) return;
    if (input.measurementMode !== "total-only-time-elapsed") {
      throw new Error("Total samples cannot be recorded in stage-only mode");
    }
    assertNonNegativeFinite(sample.milliseconds, "milliseconds");
    if (sample.noopMilliseconds !== undefined) {
      assertNonNegativeFinite(sample.noopMilliseconds, "noopMilliseconds");
    }
    if (sample.copyOnlyMilliseconds !== undefined) {
      assertNonNegativeFinite(sample.copyOnlyMilliseconds, "copyOnlyMilliseconds");
    }
    samples.push({
      epoch: currentEpoch,
      frameId: sample.frameId,
      copyOnlyMilliseconds: sample.copyOnlyMilliseconds ?? null,
      milliseconds: sample.milliseconds,
      noopMilliseconds: sample.noopMilliseconds ?? null
    });
  }

  function recordStageSample(sample: Readonly<{
    frameId: number;
    milliseconds: number;
    stage: string;
  }>) {
    if (disposed || completed()) return;
    if (input.measurementMode !== "stage-only-sequential-time-elapsed") {
      throw new Error("Stage samples cannot be recorded in total-only mode");
    }
    if (!stageNames.includes(sample.stage)) {
      throw new Error(`Unknown GPU stage: ${sample.stage}`);
    }
    assertNonNegativeFinite(sample.milliseconds, "milliseconds");
    const partial = partialStageFrames.get(sample.frameId) ?? {
      baselineMilliseconds: null,
      stages: new Map<string, number>()
    };
    const { stages } = partial;
    if (stages.has(sample.stage)) {
      throw new Error(`Duplicate GPU stage ${sample.stage} for frame ${sample.frameId}`);
    }
    stages.set(sample.stage, sample.milliseconds);
    partialStageFrames.set(sample.frameId, partial);
  }

  function recordStageBaseline(sample: Readonly<{
    frameId: number;
    milliseconds: number;
  }>) {
    if (disposed || completed()) return;
    if (input.measurementMode !== "stage-only-sequential-time-elapsed") {
      throw new Error("Stage baselines cannot be recorded in total-only mode");
    }
    assertNonNegativeFinite(sample.milliseconds, "milliseconds");
    const partial = partialStageFrames.get(sample.frameId) ?? {
      baselineMilliseconds: null,
      stages: new Map<string, number>()
    };
    if (partial.baselineMilliseconds !== null) {
      throw new Error(`Duplicate GPU stage baseline for frame ${sample.frameId}`);
    }
    partial.baselineMilliseconds = sample.milliseconds;
    partialStageFrames.set(sample.frameId, partial);
  }

  function finishStageFrame(frameIdToFinish: number) {
    if (disposed || completed()) return;
    if (input.measurementMode !== "stage-only-sequential-time-elapsed") {
      throw new Error("Stage frames cannot be finished in total-only mode");
    }
    const partial = partialStageFrames.get(frameIdToFinish);
    if (partial === undefined || partial.baselineMilliseconds === null ||
      !stageNames.every((stage) => partial.stages.has(stage))) {
      invalidReasons.push(`incomplete-stage-frame-${frameIdToFinish}`);
      partialStageFrames.delete(frameIdToFinish);
      return;
    }
    const record = Object.fromEntries(stageNames.map((stage) => [
      stage,
      partial.stages.get(stage)!
    ]));
    completedStageFrames.push({
      epoch: currentEpoch,
      frameId: frameIdToFinish,
      stages: record,
      totalMilliseconds: rounded(stageNames.reduce(
        (total, stage) => total + partial.stages.get(stage)!,
        0
      ))
    });
    stageBaselines.push({
      epoch: currentEpoch,
      frameId: frameIdToFinish,
      milliseconds: partial.baselineMilliseconds
    });
    partialStageFrames.delete(frameIdToFinish);
  }

  function trackPendingQuery(query: PendingQuery) {
    if (disposed) {
      query.dispose();
      return;
    }
    if (pendingQueries.has(query.id)) throw new Error(`Duplicate GPU query: ${query.id}`);
    pendingQueries.set(query.id, query);
  }

  function resolvePendingQuery(id: string) {
    pendingQueries.delete(id);
  }

  function invalidateDisjointEpoch() {
    for (const [id, query] of pendingQueries) {
      if (query.epoch === currentEpoch) {
        query.dispose();
        pendingQueries.delete(id);
      }
    }
    samples = samples.filter((sample) => sample.epoch !== currentEpoch);
    completedStageFrames = completedStageFrames.filter(
      (sample) => sample.epoch !== currentEpoch
    );
    stageBaselines = stageBaselines.filter(
      (sample) => sample.epoch !== currentEpoch
    );
    partialStageFrames.clear();
    invalidReasons.push(`gpu-disjoint-epoch-${currentEpoch}`);
    currentEpoch += 1;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const query of pendingQueries.values()) query.dispose();
    pendingQueries.clear();
  }

  function snapshot(): DeepReadonly<TakramOrbitalGpuProfileSnapshot> {
    const rawSamples = input.measurementMode === "total-only-time-elapsed"
      ? samples.map(({ milliseconds }) => milliseconds)
      : completedStageFrames.map(({ totalMilliseconds }) => totalMilliseconds);
    const p95Milliseconds = completed()
      ? nearestRankPercentile(rawSamples.slice(0, input.targetSampleCount), 0.95)
      : null;
    const classification = p95Milliseconds === null
      ? null
      : classifyTakramOrbitalGpuP95(p95Milliseconds);
    const completedFrames = completedStageFrames.slice(0, input.targetSampleCount);
    const stageP95Milliseconds = input.measurementMode ===
        "stage-only-sequential-time-elapsed" && completed()
      ? Object.fromEntries(stageNames.map((stage) => [
          stage,
          nearestRankPercentile(completedFrames.map((frame) => frame.stages[stage]!), 0.95)!
        ]))
      : null;
    const bsmCombinedP95Milliseconds = input.measurementMode ===
        "stage-only-sequential-time-elapsed" && completed() &&
        stageNames.includes("bsm-current") && stageNames.includes("bsm-resolve")
      ? nearestRankPercentile(completedFrames.map((frame) => rounded(
          frame.stages["bsm-current"]! + frame.stages["bsm-resolve"]!
        )), 0.95)
      : null;
    return deepFreeze({
      classification: classification?.classification ?? null,
      bsmCombinedP95Milliseconds,
      copyOnlySamplesMilliseconds: samples.flatMap(({ copyOnlyMilliseconds }) =>
        copyOnlyMilliseconds === null ? [] : [copyOnlyMilliseconds]
      ).slice(0, input.targetSampleCount),
      disjointEpochCount: currentEpoch,
      eligibleForPromotionAmendment:
        classification?.eligibleForPromotionAmendment ?? false,
      emptyStageBaselineSamplesMilliseconds: stageBaselines
        .slice(0, input.targetSampleCount)
        .map(({ milliseconds }) => milliseconds),
      invalidReasons,
      measurementMode: input.measurementMode,
      noopSamplesMilliseconds: samples.flatMap(({ noopMilliseconds }) =>
        noopMilliseconds === null ? [] : [noopMilliseconds]
      ).slice(0, input.targetSampleCount),
      p95Milliseconds,
      rawSamplesMilliseconds: rawSamples.slice(0, input.targetSampleCount),
      rawStageSamples: completedStageFrames.slice(0, input.targetSampleCount).map(
        ({ epoch: _epoch, ...sample }) => sample
      ),
      stageP95Milliseconds,
      state: completed()
        ? "complete"
        : warmupFramesCompleted < input.warmupFrameCount
          ? "warming"
          : "sampling",
      targetSampleCount: input.targetSampleCount,
      timestampBits: input.timestampBits,
      validSampleCount: Math.min(rawSamples.length, input.targetSampleCount),
      warmupFrameCount: input.warmupFrameCount,
      warmupFramesCompleted
    });
  }

  return {
    beginFrame,
    dispose,
    finishStageFrame,
    invalidateDisjointEpoch,
    recordStageBaseline,
    recordStageSample,
    recordTotalSample,
    resolvePendingQuery,
    snapshot,
    trackPendingQuery
  };
}

interface DisjointTimerQueryExtension {
  readonly GPU_DISJOINT_EXT: number;
  readonly QUERY_COUNTER_BITS_EXT: number;
  readonly TIME_ELAPSED_EXT: number;
}

interface PendingWebGlQuery {
  readonly frameId: number;
  readonly id: string;
  readonly kind: "total" | "noop" | "copy";
  readonly query: WebGLQuery;
}

export interface TakramOrbitalWebGl2TimerProfiler {
  beginFrame(): boolean;
  dispose(): void;
  endFrame(copyOnlySubmission?: () => void): void;
  pendingQueriesForTesting(): readonly PendingWebGlQuery[];
  poll(): DeepReadonly<TakramOrbitalGpuProfileSnapshot>;
  snapshot(): DeepReadonly<TakramOrbitalGpuProfileSnapshot>;
}

function unsupportedWebGlTimerProfiler(
  snapshot: DeepReadonly<TakramOrbitalGpuProfileSnapshot>
): TakramOrbitalWebGl2TimerProfiler {
  return {
    beginFrame: () => false,
    dispose: () => undefined,
    endFrame: () => undefined,
    pendingQueriesForTesting: () => [],
    poll: () => snapshot,
    snapshot: () => snapshot
  };
}

export function createTakramOrbitalWebGl2TimerProfiler(
  gl: WebGL2RenderingContext,
  options: Readonly<{
    targetSampleCount?: number;
    warmupFrameCount?: number;
  }> = {}
): TakramOrbitalWebGl2TimerProfiler {
  const extension = gl.getExtension(
    "EXT_disjoint_timer_query_webgl2"
  ) as DisjointTimerQueryExtension | null;
  if (extension === null) {
    return unsupportedWebGlTimerProfiler(createUnsupportedTakramOrbitalGpuProfile({
      invalidReason: "ext-disjoint-timer-query-webgl2-unavailable",
      timestampBits: 0
    }));
  }
  const timerExtension = extension;
  let timestampBits = 0;
  try {
    timestampBits = Number(gl.getQuery(
      timerExtension.TIME_ELAPSED_EXT,
      timerExtension.QUERY_COUNTER_BITS_EXT
    ));
  } catch {
    timestampBits = 0;
  }
  const population = createTakramOrbitalGpuPopulation({
    measurementMode: "total-only-time-elapsed",
    targetSampleCount: options.targetSampleCount ?? 120,
    timestampBits,
    warmupFrameCount: options.warmupFrameCount ?? 120
  });
  let currentFrame: { frameId: number; query: WebGLQuery } | null = null;
  let pending: PendingWebGlQuery[] = [];

  function createQuery(kind: PendingWebGlQuery["kind"], frameId: number) {
    const query = gl.createQuery();
    if (query === null) throw new Error("WebGL2 failed to allocate a timer query");
    const id = `${kind}-${frameId}`;
    population.trackPendingQuery({
      dispose: () => gl.deleteQuery(query),
      epoch: population.snapshot().disjointEpochCount,
      id
    });
    return { frameId, id, kind, query };
  }

  function beginFrame() {
    if (currentFrame !== null) throw new Error("GPU total query already active");
    const instruction = population.beginFrame();
    if (!instruction.measure) return false;
    const pendingQuery = createQuery("total", instruction.frameId);
    gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, pendingQuery.query);
    currentFrame = { frameId: instruction.frameId, query: pendingQuery.query };
    pending.push(pendingQuery);
    return true;
  }

  function endFrame(copyOnlySubmission?: () => void) {
    if (currentFrame === null) return;
    const frameId = currentFrame.frameId;
    gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
    currentFrame = null;
    const noop = createQuery("noop", frameId);
    gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, noop.query);
    gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
    pending.push(noop);
    if (copyOnlySubmission !== undefined) {
      const copy = createQuery("copy", frameId);
      gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, copy.query);
      copyOnlySubmission();
      gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
      pending.push(copy);
    }
  }

  function deleteResolved(entry: PendingWebGlQuery) {
    gl.deleteQuery(entry.query);
    population.resolvePendingQuery(entry.id);
  }

  function poll() {
    if (Boolean(gl.getParameter(timerExtension.GPU_DISJOINT_EXT))) {
      population.invalidateDisjointEpoch();
      pending = [];
      currentFrame = null;
      return population.snapshot();
    }
    const frameIds = Array.from(new Set(pending.map(({ frameId }) => frameId))).sort(
      (left, right) => left - right
    );
    for (const frameId of frameIds) {
      const total = pending.find((entry) =>
        entry.frameId === frameId && entry.kind === "total"
      );
      const noop = pending.find((entry) =>
        entry.frameId === frameId && entry.kind === "noop"
      );
      const copy = pending.find((entry) =>
        entry.frameId === frameId && entry.kind === "copy"
      );
      if (total === undefined || noop === undefined) continue;
      const frameQueries = copy === undefined ? [total, noop] : [total, noop, copy];
      const available = frameQueries.every(({ query }) =>
        Boolean(gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
      );
      if (!available) continue;
      const totalNanoseconds = Number(gl.getQueryParameter(total.query, gl.QUERY_RESULT));
      const noopNanoseconds = Number(gl.getQueryParameter(noop.query, gl.QUERY_RESULT));
      const copyNanoseconds = copy === undefined
        ? undefined
        : Number(gl.getQueryParameter(copy.query, gl.QUERY_RESULT));
      deleteResolved(total);
      deleteResolved(noop);
      if (copy !== undefined) deleteResolved(copy);
      pending = pending.filter((entry) => entry.frameId !== frameId);
      population.recordTotalSample({
        frameId,
        ...(copyNanoseconds === undefined
          ? {}
          : { copyOnlyMilliseconds: copyNanoseconds / 1_000_000 }),
        milliseconds: totalNanoseconds / 1_000_000,
        noopMilliseconds: noopNanoseconds / 1_000_000
      });
    }
    return population.snapshot();
  }

  function dispose() {
    if (currentFrame !== null) {
      gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
      currentFrame = null;
    }
    population.dispose();
    pending = [];
  }

  return {
    beginFrame,
    dispose,
    endFrame,
    pendingQueriesForTesting: () => pending,
    poll,
    snapshot: () => population.snapshot()
  };
}

type TakramSubmissionQueryKind = "total" | "noop" | "copy" | "stage-baseline" |
  TakramOrbitalGpuStageName;

interface PendingSubmissionQuery {
  readonly frameId: number;
  readonly id: string;
  readonly kind: TakramSubmissionQueryKind;
  readonly query: WebGLQuery;
}

export interface TakramOrbitalSubmissionTimerProfilerOptions {
  readonly measurementMode: TakramOrbitalGpuMeasurementMode;
  readonly targetSampleCount?: number;
  readonly warmupFrameCount?: number;
}

export interface TakramOrbitalSubmissionTimerProfiler {
  readonly measurementMode: TakramOrbitalGpuMeasurementMode;
  beginFrame(): Readonly<{ frameId: number; measure: boolean }>;
  beginTotal(frameId: number): void;
  endTotal(frameId: number): void;
  beginStage(frameId: number, stage: TakramOrbitalGpuStageName): void;
  endStage(frameId: number, stage: TakramOrbitalGpuStageName): void;
  finishFrame(frameId: number, copyOnlySubmission?: () => void): void;
  poll(): DeepReadonly<TakramOrbitalGpuProfileSnapshot>;
  snapshot(): DeepReadonly<TakramOrbitalGpuProfileSnapshot>;
  dispose(): void;
}

function unsupportedSubmissionTimerProfiler(
  measurementMode: TakramOrbitalGpuMeasurementMode,
  snapshot: DeepReadonly<TakramOrbitalGpuProfileSnapshot>
): TakramOrbitalSubmissionTimerProfiler {
  const normalized = deepFreeze({ ...snapshot, measurementMode });
  return {
    measurementMode,
    beginFrame: () => ({ frameId: 0, measure: false }),
    beginTotal: () => undefined,
    endTotal: () => undefined,
    beginStage: () => undefined,
    endStage: () => undefined,
    finishFrame: () => undefined,
    poll: () => normalized,
    snapshot: () => normalized,
    dispose: () => undefined
  };
}

export function createTakramOrbitalSubmissionTimerProfiler(
  gl: WebGL2RenderingContext,
  options: TakramOrbitalSubmissionTimerProfilerOptions
): TakramOrbitalSubmissionTimerProfiler {
  const extension = gl.getExtension(
    "EXT_disjoint_timer_query_webgl2"
  ) as DisjointTimerQueryExtension | null;
  if (extension === null) {
    return unsupportedSubmissionTimerProfiler(
      options.measurementMode,
      createUnsupportedTakramOrbitalGpuProfile({
        invalidReason: "ext-disjoint-timer-query-webgl2-unavailable",
        timestampBits: 0
      })
    );
  }
  const timerExtension = extension;
  let timestampBits = 0;
  try {
    timestampBits = Number(gl.getQuery(
      timerExtension.TIME_ELAPSED_EXT,
      timerExtension.QUERY_COUNTER_BITS_EXT
    ));
  } catch {
    timestampBits = 0;
  }
  const population = createTakramOrbitalGpuPopulation({
    measurementMode: options.measurementMode,
    stageNames: options.measurementMode === "stage-only-sequential-time-elapsed"
      ? TAKRAM_ORBITAL_GPU_STAGE_NAMES
      : undefined,
    targetSampleCount: options.targetSampleCount ?? 120,
    timestampBits,
    warmupFrameCount: options.warmupFrameCount ?? 120
  });
  let activeFrame: { frameId: number; measure: boolean } | null = null;
  let activeQuery: {
    frameId: number;
    kind: TakramSubmissionQueryKind;
    query: WebGLQuery;
  } | null = null;
  let pending: PendingSubmissionQuery[] = [];
  const frameKinds = new Map<number, Set<TakramSubmissionQueryKind>>();

  function allocateQuery(kind: TakramSubmissionQueryKind, frameId: number) {
    const kinds = frameKinds.get(frameId) ?? new Set<TakramSubmissionQueryKind>();
    if (kinds.has(kind)) {
      throw new Error(`Duplicate GPU submission query ${kind} for frame ${frameId}`);
    }
    const query = gl.createQuery();
    if (query === null) throw new Error("WebGL2 failed to allocate a timer query");
    kinds.add(kind);
    frameKinds.set(frameId, kinds);
    const id = `${kind}-${frameId}`;
    population.trackPendingQuery({
      dispose: () => gl.deleteQuery(query),
      epoch: population.snapshot().disjointEpochCount,
      id
    });
    return { frameId, id, kind, query };
  }

  function beginQuery(frameId: number, kind: TakramSubmissionQueryKind) {
    if (activeQuery !== null) throw new Error("GPU submission query already active");
    if (activeFrame?.frameId !== frameId || !activeFrame.measure) {
      throw new Error("GPU submission frame is not active for measurement");
    }
    const entry = allocateQuery(kind, frameId);
    gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, entry.query);
    activeQuery = { frameId, kind, query: entry.query };
    pending.push(entry);
  }

  function endQuery(frameId: number, kind: TakramSubmissionQueryKind) {
    if (activeQuery === null || activeQuery.frameId !== frameId ||
      activeQuery.kind !== kind) {
      throw new Error(kind === "total"
        ? "No matching GPU total query is active"
        : `No matching GPU stage query ${kind} is active`);
    }
    gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
    activeQuery = null;
  }

  function issueImmediateQuery(
    frameId: number,
    kind: "noop" | "copy" | "stage-baseline",
    submission?: () => void
  ) {
    beginQuery(frameId, kind);
    try {
      submission?.();
    } finally {
      endQuery(frameId, kind);
    }
  }

  function beginFrame() {
    if (activeFrame !== null) throw new Error("GPU submission frame already active");
    const instruction = population.beginFrame();
    activeFrame = instruction;
    return instruction;
  }

  function beginTotal(frameId: number) {
    if (options.measurementMode !== "total-only-time-elapsed") {
      throw new Error("Total queries cannot run in stage-only mode");
    }
    beginQuery(frameId, "total");
  }

  function endTotal(frameId: number) {
    if (options.measurementMode !== "total-only-time-elapsed") {
      throw new Error("Total queries cannot run in stage-only mode");
    }
    endQuery(frameId, "total");
  }

  function beginStage(frameId: number, stage: TakramOrbitalGpuStageName) {
    if (options.measurementMode !== "stage-only-sequential-time-elapsed") {
      throw new Error("Stage queries cannot run in total-only mode");
    }
    beginQuery(frameId, stage);
  }

  function endStage(frameId: number, stage: TakramOrbitalGpuStageName) {
    if (options.measurementMode !== "stage-only-sequential-time-elapsed") {
      throw new Error("Stage queries cannot run in total-only mode");
    }
    endQuery(frameId, stage);
  }

  function finishFrame(frameId: number, copyOnlySubmission?: () => void) {
    if (activeFrame?.frameId !== frameId) {
      throw new Error("GPU submission frame does not match finishFrame");
    }
    if (activeQuery !== null) {
      throw new Error(`GPU submission query ${activeQuery.kind} is missing its end`);
    }
    if (!activeFrame.measure) {
      activeFrame = null;
      return;
    }
    const kinds = frameKinds.get(frameId) ?? new Set<TakramSubmissionQueryKind>();
    if (options.measurementMode === "total-only-time-elapsed") {
      if (!kinds.has("total")) throw new Error("GPU total frame is missing its total query");
      issueImmediateQuery(frameId, "noop");
      if (copyOnlySubmission !== undefined) {
        issueImmediateQuery(frameId, "copy", copyOnlySubmission);
      }
    } else {
      const missing = TAKRAM_ORBITAL_GPU_STAGE_NAMES.filter(
        (stage) => !kinds.has(stage)
      );
      if (missing.length > 0) {
        throw new Error(`GPU stage frame is incomplete: ${missing.join(",")}`);
      }
      issueImmediateQuery(frameId, "stage-baseline");
    }
    activeFrame = null;
  }

  function deleteResolved(entry: PendingSubmissionQuery) {
    gl.deleteQuery(entry.query);
    population.resolvePendingQuery(entry.id);
  }

  function poll() {
    if (Boolean(gl.getParameter(timerExtension.GPU_DISJOINT_EXT))) {
      population.invalidateDisjointEpoch();
      pending = [];
      activeFrame = null;
      activeQuery = null;
      frameKinds.clear();
      return population.snapshot();
    }
    const frameIds = Array.from(new Set(pending.map(({ frameId }) => frameId)))
      .sort((left, right) => left - right);
    for (const frameId of frameIds) {
      const entries = pending.filter((entry) => entry.frameId === frameId);
      const requiredKinds: readonly TakramSubmissionQueryKind[] =
        options.measurementMode === "total-only-time-elapsed"
          ? frameKinds.get(frameId)?.has("copy")
            ? ["total", "noop", "copy"]
            : ["total", "noop"]
          : [...TAKRAM_ORBITAL_GPU_STAGE_NAMES, "stage-baseline"];
      if (!requiredKinds.every((kind) => entries.some((entry) => entry.kind === kind))) {
        continue;
      }
      if (!entries.every(({ query }) => Boolean(
        gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)
      ))) {
        continue;
      }
      const milliseconds = new Map(entries.map((entry) => [
        entry.kind,
        Number(gl.getQueryParameter(entry.query, gl.QUERY_RESULT)) / 1_000_000
      ]));
      if (options.measurementMode === "total-only-time-elapsed") {
        population.recordTotalSample({
          frameId,
          milliseconds: milliseconds.get("total")!,
          noopMilliseconds: milliseconds.get("noop")!,
          ...(milliseconds.has("copy")
            ? { copyOnlyMilliseconds: milliseconds.get("copy")! }
            : {})
        });
      } else {
        for (const stage of TAKRAM_ORBITAL_GPU_STAGE_NAMES) {
          population.recordStageSample({
            frameId,
            stage,
            milliseconds: milliseconds.get(stage)!
          });
        }
        population.recordStageBaseline({
          frameId,
          milliseconds: milliseconds.get("stage-baseline")!
        });
        population.finishStageFrame(frameId);
      }
      for (const entry of entries) deleteResolved(entry);
      pending = pending.filter((entry) => entry.frameId !== frameId);
      frameKinds.delete(frameId);
    }
    return population.snapshot();
  }

  function dispose() {
    if (activeQuery !== null) {
      gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
      activeQuery = null;
    }
    activeFrame = null;
    population.dispose();
    pending = [];
    frameKinds.clear();
  }

  return {
    measurementMode: options.measurementMode,
    beginFrame,
    beginTotal,
    endTotal,
    beginStage,
    endStage,
    finishFrame,
    poll,
    snapshot: () => population.snapshot(),
    dispose
  };
}
