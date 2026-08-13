import { expect, test } from "@playwright/test";

import {
  deriveTakramOrbitalV3ProgressDecision,
  evaluateTakramOrbitalV3VisualReview,
  resolveTakramOrbitalV3Compatibility,
  validateTakramOrbitalV3Setup,
  type TakramOrbitalV3ProgressMetrics,
  type TakramOrbitalV3SetupInput,
  type TakramOrbitalV3VisualReview
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalV3Compatibility";
import type { TakramOrbitalV2FinalStockReplayDecision } from
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence";

const PROGRESSES = [0, 0.06, 0.12, 0.18] as const;
const TEMPORAL_FRAMES = [1, 2, 4, 8, 16, 32] as const;
const WINNER_ID = "h80-c0.4-v2-o1";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

const READY_REPLAY: TakramOrbitalV2FinalStockReplayDecision = {
  state: "ORBITAL_LOOKDEV_V2_FINAL_STOCK_READY",
  failedStage: null,
  winnerId: WINNER_ID,
  gpuAuthorized: true,
  v3Authorized: true,
  setupFailures: [],
  samplingFailures: []
};

const CORE_IDENTITY = {
  query: "?input=stock&view=opening&featureState=native&output=full",
  runtime: { step: 1.0001, coverage: 0.4 },
  layers: ["r", "g", "b", "a"].map((channel) => ({ channel, shadow: true })),
  sampling: { policy: "confirmed", maxIterationCount: 500 },
  lookdev: { morphologyH: 80, verticalScale: 2, opticalDepthScale: 1 },
  camera: { projection: [1, 0, 0, 1], view: [1, 0, 0, 1] },
  renderer: { shader: "shader-hash", build: "build-hash" },
  outputTransform: "srgb",
  nativeFrame: 32,
  viewport: { width: 1440, height: 960, dpr: 1 },
  featureState: "native",
  disableDefaultLayers: true
};

function arm(input: "stock" | "v3", progress: number) {
  const id = `${input}-${progress}`;
  return {
    input,
    coreIdentity: structuredClone(CORE_IDENTITY),
    adapter: input === "stock"
      ? {
          textureIdentity: "stock-weather",
          textureHash: "stock-texture-hash",
          mapping: "cube-uv",
          repeat: [1, 1],
          offset: [0, 0],
          wrap: ["repeat", "repeat"],
          channelTransform: "rgba"
        }
      : {
          textureIdentity: "v3-weather",
          textureHash: "v3-texture-hash",
          mapping: "equirectangular",
          repeat: [2, 1],
          offset: [0.25, 0],
          wrap: ["repeat", "clamp"],
          channelTransform: "bgra-to-rgba"
        },
    allocationEpoch: `${id}-base-epoch`,
    repeatAllocationEpoch: `${id}-repeat-epoch`,
    allocationGenerations: {
      cloudCurrent: 1,
      cloudHistory: 1,
      shadowCurrent: 1,
      shadowHistory: 1,
      resolveCurrent: 1,
      resolveHistory: 1
    },
    temporalFrames: TEMPORAL_FRAMES,
    readbackAudit: { invalidReasons: [] },
    expectedArtifactIds: [`${id}-full`, `${id}-primary`, `${id}-stage`],
    artifacts: ["full", "primary", "stage"].map((name) => ({
      artifactId: `${id}-${name}`,
      declaredHash: `${id}-${name}-hash`,
      actualHash: `${id}-${name}-hash`,
      declaredByteLength: 128,
      actualByteLength: 128
    })),
    baseCaptureHash: `${id}-capture-hash`,
    repeatCaptureHash: `${id}-capture-hash`
  };
}

function setupInput(): TakramOrbitalV3SetupInput {
  const contract = {
    samplingPolicy: "confirmed",
    morphologyH: 80,
    coverage: 0.4,
    verticalScale: 2,
    opticalDepthScale: 1
  };
  return {
    stage4D: {
      state: "ORBITAL_STOCK_LOOKDEV_V2_WINNER",
      winnerId: WINNER_ID,
      contract
    },
    finalStock: {
      winnerId: WINNER_ID,
      contract: structuredClone(contract),
      replay: READY_REPLAY,
      classification: "ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY"
    },
    expectedAdapters: {
      stock: structuredClone(arm("stock", 0).adapter),
      v3: structuredClone(arm("v3", 0).adapter)
    },
    progresses: PROGRESSES.map((progress) => ({
      progress,
      stock: arm("stock", progress),
      v3: arm("v3", progress)
    }))
  };
}

const PASSING_METRICS: TakramOrbitalV3ProgressMetrics = {
  progress: 0,
  cloudPixelFraction: 0.002,
  preTemporalSignalPixelFraction: 0.002,
  largestConnectedAreaFraction: 0.25,
  singlePixelFragmentFraction: 0.02,
  smallFragmentFraction: 0.08,
  edgeDensity: 0.65,
  clearAirLeakage: 0.05,
  firstConvergedLumaDelta: 0.08,
  signalRetention: 0.9,
  signalLumaRetention: 0.8,
  enteredPrimaryMarchPixelCount: 1,
  primaryCapSaturationFraction: 0.01,
  noHitPrimaryCapSaturationFraction: 0.01,
  nativeHitPixelFraction: 0.2,
  rawFinalCloudSignalDifference: 0.1,
  fullBsmOffDifference: 0.1,
  opacityMean: 0.2,
  lumaMean: 0.2,
  baseRepeatByteIdentical: true
};

function review(
  override: Partial<TakramOrbitalV3VisualReview> = {}
): TakramOrbitalV3VisualReview {
  return {
    schema: "takram-orbital-v3-visual-review/v1",
    reviewer: "human:aitoshuu",
    cleanCommit: COMMIT,
    winnerId: WINNER_ID,
    identity: { stockMountKey: "stock-mount", v3MountKey: "v3-mount" },
    viewport: { width: 1440, height: 960, dpr: 1 },
    contactSheetHashes: { stock: "stock-sheet-hash", v3: "v3-sheet-hash" },
    referenceHashes: { nasa: "nasa-hash", takram: "takram-hash" },
    sequenceOpeningIdentityStability: 1,
    frames: PROGRESSES.map((progress) => ({
      progress,
      scores: {
        macroCoherence: 1,
        coverageUsability: 1,
        cloudGroundSeparation: 1,
        depthLayering: 1,
        lightingBsmRead: 1,
        artifactFreedom: 1
      },
      hardFlags: []
    })),
    ...override
  };
}

test("V3 setup normalizes only adapter fields and verifies complete fresh evidence", () => {
  expect(validateTakramOrbitalV3Setup(setupInput())).toMatchObject({
    required: true,
    valid: true,
    invalidReasons: []
  });

  const drifted = setupInput();
  drifted.progresses[1]!.v3.coreIdentity.camera.view[0] = 2;
  expect(validateTakramOrbitalV3Setup(drifted)).toMatchObject({
    required: true,
    valid: false,
    invalidReasons: expect.arrayContaining([
      "progress-0.06:stock-v3-core-identity-mismatch"
    ])
  });

  const stale = setupInput();
  stale.progresses[2]!.v3.repeatAllocationEpoch =
    stale.progresses[2]!.v3.allocationEpoch;
  stale.progresses[3]!.stock.temporalFrames = [1, 2, 4, 8, 32] as never;
  stale.progresses[0]!.v3.artifacts[0]!.actualByteLength = 127;
  stale.progresses[1]!.stock.repeatCaptureHash = "repeat-drift";
  expect(validateTakramOrbitalV3Setup(stale).invalidReasons).toEqual(
    expect.arrayContaining([
      "progress-0.12:v3:allocation-epoch-not-fresh",
      "progress-0.18:stock:invalid-temporal-frame-set",
      "progress-0:v3:artifact-mismatch",
      "progress-0.06:stock:fresh-mount-repeat-mismatch"
    ])
  );

  const wrongFrozenLayer = setupInput();
  wrongFrozenLayer.progresses[0]!.stock.coreIdentity.disableDefaultLayers = false;
  wrongFrozenLayer.progresses[2]!.v3.adapter.textureHash = "unexpected-v3-hash";
  expect(validateTakramOrbitalV3Setup(wrongFrozenLayer).invalidReasons).toEqual(
    expect.arrayContaining([
      "progress-0:stock:default-layers-not-disabled",
      "progress-0:stock-v3-core-identity-mismatch",
      "progress-0.12:v3:unexpected-adapter-identity"
    ])
  );

  const missingExpected = setupInput() as unknown as Record<string, unknown>;
  delete missingExpected.expectedAdapters;
  expect(validateTakramOrbitalV3Setup(
    missingExpected as unknown as TakramOrbitalV3SetupInput
  )).toMatchObject({
    valid: false,
    invalidReasons: expect.arrayContaining(["missing-expected-adapter-identities"])
  });
});

test("V3 setup requires the same committed/final winner and skips an unready replay", () => {
  const mismatch = setupInput();
  mismatch.finalStock.winnerId = "different-winner";
  expect(validateTakramOrbitalV3Setup(mismatch)).toMatchObject({
    required: true,
    valid: false,
    invalidReasons: expect.arrayContaining(["stage4d-final-stock-winner-mismatch"])
  });

  const skipped = setupInput();
  skipped.finalStock.replay = {
    ...READY_REPLAY,
    state: "ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL",
    failedStage: "final-stock",
    gpuAuthorized: false,
    v3Authorized: false
  };
  expect(validateTakramOrbitalV3Setup(skipped)).toMatchObject({
    required: false,
    valid: false,
    skipReason: "final-stock-replay-not-ready"
  });

  for (const classification of [
    "ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE",
    "ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY",
    "ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET",
    "ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED"
  ] as const) {
    const input = setupInput();
    input.finalStock.classification = classification;
    expect(validateTakramOrbitalV3Setup(input)).toMatchObject({
      required: true,
      valid: true
    });
  }
});

test("V3 progress decisions enforce every exact boundary independently", () => {
  expect(deriveTakramOrbitalV3ProgressDecision(PASSING_METRICS)).toMatchObject({
    evidenceValid: true,
    pass: true,
    failureReasons: [],
    primaryCapSaturationFraction: 0.01,
    noHitPrimaryCapSaturationFraction: 0.01
  });

  const failures: Array<[keyof TakramOrbitalV3ProgressMetrics, number, string]> = [
    ["cloudPixelFraction", 0.001999, "cloud-pixel-fraction"],
    ["preTemporalSignalPixelFraction", 0.001999, "pre-temporal-signal"],
    ["largestConnectedAreaFraction", 0.249999, "largest-connected-area"],
    ["singlePixelFragmentFraction", 0.020001, "single-pixel-fragments"],
    ["smallFragmentFraction", 0.080001, "small-fragments"],
    ["edgeDensity", 0.650001, "edge-density"],
    ["clearAirLeakage", 0.050001, "clear-air-leakage"],
    ["firstConvergedLumaDelta", 0.080001, "first-converged-luma-delta"],
    ["signalRetention", 1.100001, "signal-retention"],
    ["signalLumaRetention", 1.200001, "signal-luma-retention"],
    ["enteredPrimaryMarchPixelCount", 0, "primary-march-entry"],
    ["primaryCapSaturationFraction", 0.010001, "primary-cap-saturation"]
  ];
  for (const [field, value, reason] of failures) {
    const decision = deriveTakramOrbitalV3ProgressDecision({
      ...PASSING_METRICS,
      [field]: value
    });
    expect(decision.pass, field).toBe(false);
    expect(decision.failureReasons, field).toContain(reason);
  }
  expect(deriveTakramOrbitalV3ProgressDecision({
    ...PASSING_METRICS,
    metricPass: true
  } as unknown as TakramOrbitalV3ProgressMetrics)).toMatchObject({
    evidenceValid: false,
    invalidReasons: expect.arrayContaining(["forbidden-metric-field:metricPass"])
  });
});

test("V3 no-hit cap fraction is preserved but has no independent threshold", () => {
  for (const noHit of [0, 0.01] as const) {
    const decision = deriveTakramOrbitalV3ProgressDecision({
      ...PASSING_METRICS,
      noHitPrimaryCapSaturationFraction: noHit
    });
    expect(decision).toMatchObject({
      pass: true,
      noHitPrimaryCapSaturationFraction: noHit
    });
  }
  const over = deriveTakramOrbitalV3ProgressDecision({
    ...PASSING_METRICS,
    primaryCapSaturationFraction: 0.02,
    noHitPrimaryCapSaturationFraction: 0.02
  });
  expect(over.failureReasons).toEqual(["primary-cap-saturation"]);
  expect(over.noHitPrimaryCapSaturationFraction).toBe(0.02);
});

test("V3 visual review derives pass from six progress scores, sequence score, and flags", () => {
  expect(evaluateTakramOrbitalV3VisualReview(review())).toMatchObject({
    valid: true,
    pass: true
  });
  expect(evaluateTakramOrbitalV3VisualReview(review({
    sequenceOpeningIdentityStability: 0
  }))).toMatchObject({ valid: true, pass: false });

  const hard = review();
  hard.frames[0]!.hardFlags = [{ flag: "tiling-repeat" }];
  expect(evaluateTakramOrbitalV3VisualReview(hard)).toMatchObject({
    valid: true,
    pass: false
  });

  const missingNote = review();
  missingNote.frames[0]!.hardFlags = [{ flag: "other-with-required-note" }];
  expect(evaluateTakramOrbitalV3VisualReview(missingNote)).toMatchObject({
    valid: false,
    invalidReasons: expect.arrayContaining([
      "frame-0:other-hard-flag-requires-note"
    ])
  });
  const noted = review();
  noted.frames[0]!.hardFlags = [{
    flag: "other-with-required-note",
    note: "stable but unacceptable checker artifact"
  }];
  expect(evaluateTakramOrbitalV3VisualReview(noted)).toMatchObject({
    valid: true,
    pass: false
  });

  expect(evaluateTakramOrbitalV3VisualReview({
    ...review(),
    result: "PASS"
  } as unknown as TakramOrbitalV3VisualReview)).toMatchObject({
    valid: false,
    invalidReasons: expect.arrayContaining(["forbidden-result-field"])
  });
});

function progressDecisions(input: "stock" | "v3", failedProgress?: number) {
  return PROGRESSES.map((progress) => deriveTakramOrbitalV3ProgressDecision({
    ...PASSING_METRICS,
    progress,
    cloudPixelFraction: progress === failedProgress ? 0.001 : 0.002,
    rawFinalCloudSignalDifference: input === "stock" ? 0.1 : 0.2
  }));
}

test("V3 resolver blocks stock failures and cannot average away a V3 failed progress", () => {
  const setup = validateTakramOrbitalV3Setup(setupInput());
  const stockFailure = resolveTakramOrbitalV3Compatibility({
    setup,
    stockProgressDecisions: progressDecisions("stock", 0.06),
    v3ProgressDecisions: progressDecisions("v3"),
    visualReview: review()
  });
  expect(stockFailure.outcome).toBe("V3_WEATHER_ADAPTER_SETUP_BLOCKED");

  const v3Failure = resolveTakramOrbitalV3Compatibility({
    setup,
    stockProgressDecisions: progressDecisions("stock"),
    v3ProgressDecisions: progressDecisions("v3", 0.12),
    visualReview: review()
  });
  expect(v3Failure).toMatchObject({
    outcome: "V3_WEATHER_ADAPTER_FAIL",
    failedProgresses: [0.12]
  });

  expect(resolveTakramOrbitalV3Compatibility({
    setup,
    stockProgressDecisions: progressDecisions("stock"),
    v3ProgressDecisions: progressDecisions("v3"),
    visualReview: review()
  }).outcome).toBe("V3_WEATHER_ADAPTER_PASS");
});
