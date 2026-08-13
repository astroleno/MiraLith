import { expect, test } from "@playwright/test";

const profilerModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler";

async function loadProfiler() {
  return import(profilerModulePath);
}

test("requires 120 warmup frames and 120 valid total-only samples", async () => {
  const { createTakramOrbitalGpuPopulation } = await loadProfiler();
  const population = createTakramOrbitalGpuPopulation({
    measurementMode: "total-only-time-elapsed",
    timestampBits: 64,
    warmupFrameCount: 120,
    targetSampleCount: 120
  });

  for (let frame = 1; frame <= 120; frame += 1) {
    expect(population.beginFrame()).toMatchObject({ measure: false, frameId: frame });
  }
  expect(population.snapshot()).toMatchObject({
    state: "sampling",
    warmupFramesCompleted: 120,
    validSampleCount: 0
  });
  for (let frame = 121; frame <= 240; frame += 1) {
    const instruction = population.beginFrame();
    expect(instruction).toEqual({ frameId: frame, measure: true });
    population.recordTotalSample({
      frameId: frame,
      milliseconds: frame === 240 ? 5 : 2,
      noopMilliseconds: 0.1
    });
  }

  expect(population.snapshot()).toMatchObject({
    classification: "SPIKE_VIABLE",
    eligibleForPromotionAmendment: true,
    measurementMode: "total-only-time-elapsed",
    p95Milliseconds: 2,
    rawSamplesMilliseconds: expect.arrayContaining([5]),
    state: "complete",
    validSampleCount: 120,
    warmupFramesCompleted: 120
  });
});

test("invalidates an entire disjoint epoch and disposes its pending queries", async () => {
  const { createTakramOrbitalGpuPopulation } = await loadProfiler();
  const disposed: string[] = [];
  const population = createTakramOrbitalGpuPopulation({
    measurementMode: "total-only-time-elapsed",
    targetSampleCount: 2,
    warmupFrameCount: 0,
    timestampBits: 64
  });
  population.trackPendingQuery({ epoch: 0, id: "q1", dispose: () => disposed.push("q1") });
  population.trackPendingQuery({ epoch: 0, id: "q2", dispose: () => disposed.push("q2") });
  population.recordTotalSample({ frameId: 1, milliseconds: 2, noopMilliseconds: 0.1 });
  population.invalidateDisjointEpoch();

  expect(disposed).toEqual(["q1", "q2"]);
  expect(population.snapshot()).toMatchObject({
    disjointEpochCount: 1,
    invalidReasons: ["gpu-disjoint-epoch-0"],
    rawSamplesMilliseconds: [],
    validSampleCount: 0
  });
  population.dispose();
  expect(disposed).toEqual(["q1", "q2"]);
});

test("sums same-frame stage samples before percentile calculation", async () => {
  const {
    createTakramOrbitalGpuPopulation,
    TAKRAM_ORBITAL_GPU_STAGE_NAMES
  } = await loadProfiler();
  expect(TAKRAM_ORBITAL_GPU_STAGE_NAMES).toEqual([
    "bsm-current",
    "bsm-resolve",
    "cloud-current",
    "cloud-resolve",
    "final-effect"
  ]);
  const population = createTakramOrbitalGpuPopulation({
    measurementMode: "stage-only-sequential-time-elapsed",
    stageNames: TAKRAM_ORBITAL_GPU_STAGE_NAMES,
    targetSampleCount: 2,
    warmupFrameCount: 0,
    timestampBits: 64
  });
  population.recordStageSample({ frameId: 1, stage: "bsm-current", milliseconds: 0.2 });
  population.recordStageSample({ frameId: 1, stage: "bsm-resolve", milliseconds: 0.1 });
  population.recordStageSample({ frameId: 1, stage: "cloud-current", milliseconds: 1 });
  population.recordStageSample({ frameId: 1, stage: "cloud-resolve", milliseconds: 0.4 });
  population.recordStageSample({ frameId: 1, stage: "final-effect", milliseconds: 0.5 });
  population.recordStageBaseline({ frameId: 1, milliseconds: 0.05 });
  population.finishStageFrame(1);
  population.recordStageSample({ frameId: 2, stage: "bsm-current", milliseconds: 0.3 });
  population.recordStageSample({ frameId: 2, stage: "bsm-resolve", milliseconds: 0.2 });
  population.recordStageSample({ frameId: 2, stage: "cloud-current", milliseconds: 1.2 });
  population.recordStageSample({ frameId: 2, stage: "cloud-resolve", milliseconds: 0.3 });
  population.recordStageSample({ frameId: 2, stage: "final-effect", milliseconds: 0.8 });
  population.recordStageBaseline({ frameId: 2, milliseconds: 0.06 });
  population.finishStageFrame(2);

  expect(population.snapshot()).toMatchObject({
    classification: "SPIKE_VIABLE",
    p95Milliseconds: 2.8,
    bsmCombinedP95Milliseconds: 0.5,
    emptyStageBaselineSamplesMilliseconds: [0.05, 0.06],
    rawSamplesMilliseconds: [2.2, 2.8],
    rawStageSamples: [
      expect.objectContaining({ frameId: 1, totalMilliseconds: 2.2 }),
      expect.objectContaining({ frameId: 2, totalMilliseconds: 2.8 })
    ],
    state: "complete"
  });
});

test("retains only complete unique five-stage frames with an empty baseline", async () => {
  const {
    createTakramOrbitalGpuPopulation,
    TAKRAM_ORBITAL_GPU_STAGE_NAMES
  } = await loadProfiler();
  const population = createTakramOrbitalGpuPopulation({
    measurementMode: "stage-only-sequential-time-elapsed",
    stageNames: TAKRAM_ORBITAL_GPU_STAGE_NAMES,
    targetSampleCount: 1,
    warmupFrameCount: 0,
    timestampBits: 64
  });
  for (const stage of TAKRAM_ORBITAL_GPU_STAGE_NAMES.slice(0, 4)) {
    population.recordStageSample({ frameId: 1, stage, milliseconds: 1 });
  }
  population.recordStageBaseline({ frameId: 1, milliseconds: 0.1 });
  population.finishStageFrame(1);
  expect(population.snapshot()).toMatchObject({
    invalidReasons: ["incomplete-stage-frame-1"],
    rawStageSamples: [],
    validSampleCount: 0
  });

  for (const stage of TAKRAM_ORBITAL_GPU_STAGE_NAMES) {
    population.recordStageSample({ frameId: 2, stage, milliseconds: 1 });
  }
  expect(() => population.recordStageSample({
    frameId: 2,
    stage: "bsm-current",
    milliseconds: 1
  })).toThrow("Duplicate GPU stage bsm-current for frame 2");
  expect(() => population.recordStageSample({
    frameId: 2,
    stage: "unknown",
    milliseconds: 1
  })).toThrow("Unknown GPU stage: unknown");
  expect(() => population.recordStageBaseline({
    frameId: 2,
    milliseconds: -1
  })).toThrow("milliseconds must be a non-negative finite number");
  population.recordStageBaseline({ frameId: 2, milliseconds: 0.1 });
  expect(() => population.recordStageBaseline({ frameId: 2, milliseconds: 0.1 }))
    .toThrow("Duplicate GPU stage baseline for frame 2");
  population.finishStageFrame(2);
  expect(population.snapshot()).toMatchObject({ validSampleCount: 1 });
});

test("rejects nested or mixed submission query modes", async () => {
  const { createTakramOrbitalSubmissionTimerProfiler } = await loadProfiler();
  const extension = {
    GPU_DISJOINT_EXT: 0x8fbb,
    QUERY_COUNTER_BITS_EXT: 0x8864,
    TIME_ELAPSED_EXT: 0x88bf
  };
  let active: object | null = null;
  let next = 0;
  const gl = {
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    beginQuery(_target: number, query: object) {
      if (active !== null) throw new Error("nested-webgl-query");
      active = query;
    },
    createQuery() { return { id: ++next }; },
    deleteQuery() {},
    endQuery() { active = null; },
    getExtension() { return extension; },
    getParameter() { return false; },
    getQuery() { return 64; },
    getQueryParameter(_query: object, parameter: number) {
      return parameter === this.QUERY_RESULT_AVAILABLE ? false : 0;
    }
  };
  const total = createTakramOrbitalSubmissionTimerProfiler(gl as any, {
    measurementMode: "total-only-time-elapsed",
    targetSampleCount: 1,
    warmupFrameCount: 0
  });
  const totalFrame = total.beginFrame();
  total.beginTotal(totalFrame.frameId);
  expect(() => total.beginTotal(totalFrame.frameId)).toThrow(
    "GPU submission query already active"
  );
  expect(() => total.beginStage(totalFrame.frameId, "bsm-current")).toThrow(
    "Stage queries cannot run in total-only mode"
  );
  total.endTotal(totalFrame.frameId);
  expect(() => total.endTotal(totalFrame.frameId)).toThrow(
    "No matching GPU total query is active"
  );
  total.finishFrame(totalFrame.frameId);
  total.dispose();
});

test("reports unsupported/incomplete timing without turning it into a visual failure", async () => {
  const {
    classifyTakramOrbitalGpuP95,
    createUnsupportedTakramOrbitalGpuProfile
  } = await loadProfiler();
  expect(classifyTakramOrbitalGpuP95(3)).toEqual({
    classification: "SPIKE_VIABLE",
    eligibleForPromotionAmendment: true
  });
  expect(classifyTakramOrbitalGpuP95(4)).toEqual({
    classification: "SPIKE_VIABLE",
    eligibleForPromotionAmendment: false
  });
  expect(createUnsupportedTakramOrbitalGpuProfile({
    invalidReason: "ext-disjoint-timer-query-webgl2-unavailable",
    timestampBits: 0
  })).toMatchObject({
    classification: null,
    invalidReasons: ["ext-disjoint-timer-query-webgl2-unavailable"],
    state: "unsupported",
    timestampBits: 0
  });
});

test("uses non-nested WebGL2 total and no-op queries and polls raw nanoseconds", async () => {
  const { createTakramOrbitalWebGl2TimerProfiler } = await loadProfiler();
  const extension = {
    GPU_DISJOINT_EXT: 0x8fbb,
    QUERY_COUNTER_BITS_EXT: 0x8864,
    TIME_ELAPSED_EXT: 0x88bf
  };
  let nextQuery = 0;
  let activeQuery: object | null = null;
  const available = new Set<object>();
  const results = new Map<object, number>();
  const calls: string[] = [];
  const gl = {
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_COUNTER_BITS: 0x8864,
    beginQuery(_target: number, query: object) {
      expect(activeQuery).toBeNull();
      activeQuery = query;
      calls.push("begin");
    },
    createQuery() {
      nextQuery += 1;
      return { id: nextQuery };
    },
    deleteQuery(query: object) {
      calls.push(`delete:${(query as { id: number }).id}`);
    },
    endQuery() {
      expect(activeQuery).not.toBeNull();
      activeQuery = null;
      calls.push("end");
    },
    getExtension(name: string) {
      return name === "EXT_disjoint_timer_query_webgl2" ? extension : null;
    },
    getParameter(parameter: number) {
      return parameter === extension.GPU_DISJOINT_EXT ? false : null;
    },
    getQuery(_target: number, parameter: number) {
      return parameter === this.QUERY_COUNTER_BITS ? 64 : 0;
    },
    getQueryParameter(query: object, parameter: number) {
      return parameter === this.QUERY_RESULT_AVAILABLE
        ? available.has(query)
        : results.get(query);
    }
  };
  const profiler = createTakramOrbitalWebGl2TimerProfiler(gl as any, {
    targetSampleCount: 1,
    warmupFrameCount: 0
  });
  expect(profiler.beginFrame()).toBe(true);
  profiler.endFrame(() => calls.push("copy"));
  expect(calls).toEqual(["begin", "end", "begin", "end", "begin", "copy", "end"]);
  expect(profiler.poll().state).toBe("sampling");
  const queries = Array.from(results.keys());
  expect(queries).toHaveLength(0);
  const createdQueries = [{ id: 1 }, { id: 2 }, { id: 3 }];
  // Fake query identity is discoverable from the profiler's pending snapshot.
  const pending = profiler.pendingQueriesForTesting();
  expect(pending.map((entry: any) => entry.kind)).toEqual(["total", "noop", "copy"]);
  available.add(pending[0].query);
  available.add(pending[1].query);
  available.add(pending[2].query);
  results.set(pending[0].query, 2_000_000);
  results.set(pending[1].query, 100_000);
  results.set(pending[2].query, 250_000);
  expect(profiler.poll()).toMatchObject({
    copyOnlySamplesMilliseconds: [0.25],
    noopSamplesMilliseconds: [0.1],
    rawSamplesMilliseconds: [2],
    state: "complete",
    timestampBits: 64
  });
  profiler.dispose();
  expect(createdQueries).toHaveLength(3);
  expect(calls).toContain("delete:1");
  expect(calls).toContain("delete:2");
  expect(calls).toContain("delete:3");
});
