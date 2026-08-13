import { expect, test } from "@playwright/test";

import type {
  TakramOrbitalGpuPolicyPopulation,
  TakramOrbitalPerformanceEnvironment,
  TakramOrbitalPrimarySignalParityInput,
  TakramOrbitalProductionPolicyInput,
  TakramOrbitalProductionStage0Input,
  TakramOrbitalProductionStage1Input,
  TakramOrbitalStage2CandidateInput
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy";
import type { TakramOrbitalSamplingProgressMetrics } from
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics";
import type {
  TakramOrbitalProductionStepCandidate
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling";

const policyModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy";
const samplingModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling";
type PolicyModule = typeof import(
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy"
);
type SamplingModule = typeof import(
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling"
);
let createTakramOrbitalHealthyBaselineContract:
  PolicyModule["createTakramOrbitalHealthyBaselineContract"];
let resolveTakramOrbitalPrimarySignalParity:
  PolicyModule["resolveTakramOrbitalPrimarySignalParity"];
let resolveTakramOrbitalProductionPolicy:
  PolicyModule["resolveTakramOrbitalProductionPolicy"];
let resolveTakramOrbitalProductionStage0:
  PolicyModule["resolveTakramOrbitalProductionStage0"];
let resolveTakramOrbitalProductionStage1:
  PolicyModule["resolveTakramOrbitalProductionStage1"];
let validateTakramOrbitalPerformanceEnvironment:
  PolicyModule["validateTakramOrbitalPerformanceEnvironment"];
let TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES:
  SamplingModule["TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES"];

test.beforeAll(async () => {
  const policy = await import(policyModulePath);
  const sampling = await import(samplingModulePath);
  ({
    createTakramOrbitalHealthyBaselineContract,
    resolveTakramOrbitalPrimarySignalParity,
    resolveTakramOrbitalProductionPolicy,
    resolveTakramOrbitalProductionStage0,
    resolveTakramOrbitalProductionStage1,
    validateTakramOrbitalPerformanceEnvironment
  } = policy);
  ({ TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES } = sampling);
});

const PROGRESSES = [0, 0.06, 0.12, 0.18] as const;

const ENVIRONMENT: TakramOrbitalPerformanceEnvironment = {
  build: "production",
  browser: "headed-system-chrome",
  browserVersion: "Chrome/139.0.7258.67",
  chip: "Apple M4",
  gpuRenderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)",
  gpuVendor: "Google Inc. (Apple)",
  macOSVersion: "15.6.1",
  viewport: {
    cssWidth: 1440,
    cssHeight: 960,
    physicalWidth: 1440,
    physicalHeight: 960,
    dpr: 1
  },
  visible: true,
  focused: true,
  acPower: true,
  lowPowerMode: false,
  commit: "a".repeat(40),
  productionAssetFingerprint: "sha256:production-assets"
};

function makePopulation(
  measurementMode: TakramOrbitalGpuPolicyPopulation["measurementMode"],
  p95Milliseconds: number,
  populationId: string,
  count = 120
): TakramOrbitalGpuPolicyPopulation {
  return {
    populationId,
    measurementMode,
    warmupFrameCount: count,
    targetSampleCount: count,
    validSampleCount: count,
    state: "complete",
    timestampBits: 64,
    p95Milliseconds,
    invalidReasons: [],
    stageNames: measurementMode === "stage-only-sequential-time-elapsed"
      ? [
          "bsm-current",
          "bsm-resolve",
          "cloud-current",
          "cloud-resolve",
          "final-effect"
        ]
      : undefined
  };
}

function makeStage0(): TakramOrbitalProductionStage0Input {
  return {
    environment: ENVIRONMENT,
    populationEnvironments: [
      { populationId: "initial", environment: ENVIRONMENT },
      { populationId: "ranking", environment: { ...ENVIRONMENT } },
      { populationId: "final-winner", environment: { ...ENVIRONMENT } },
      { populationId: "confirmation", environment: { ...ENVIRONMENT } }
    ],
    causalEvidence: {
      artifactCount: 93,
      verifiedArtifactCount: 93,
      outcomeReadable: true,
      contractReadable: true,
      commitReadable: true,
      resolverReproduced: true,
      exactStepValuesReproduced: true
    },
    routeParity: {
      query: true,
      runtime: true,
      fingerprint: true,
      camera: true
    },
    smoke: {
      totalOnly: makePopulation("total-only-time-elapsed", 1, "smoke-total", 8),
      stageOnly: makePopulation(
        "stage-only-sequential-time-elapsed",
        0.8,
        "smoke-stage",
        8
      )
    }
  };
}

const HEALTHY_METRICS: TakramOrbitalSamplingProgressMetrics = {
  evidenceValid: true,
  setupInvalidReasons: [],
  nativeHitPixelFraction: 0.25,
  preTemporalSignalPixelFraction: 0.25,
  smallFragmentFraction: 0.05,
  signalRetention: 1,
  signalLumaRetention: 1,
  pairedChange: 0.02,
  repeatNoiseFloor: 0.005,
  enteredPrimaryMarchPixelCount: 64,
  primaryCapSaturationFraction: 0.01,
  noHitPrimaryCapSaturationFraction: 0
};

function makeStage1(
  healthy: readonly TakramOrbitalProductionStepCandidate[] = [
    "fine",
    "confirmed",
    "coarse"
  ]
): TakramOrbitalProductionStage1Input {
  return {
    candidates: TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES.map((candidate) => ({
      candidate,
      progresses: PROGRESSES.map((progress) => ({
        progress,
        metrics: healthy.includes(candidate)
          ? HEALTHY_METRICS
          : { ...HEALTHY_METRICS, nativeHitPixelFraction: 0.01 },
        visualReview: healthy.includes(candidate)
          ? "coherent-density-field" as const
          : "isolated-fragments" as const
      }))
    }))
  };
}

function makePrimarySignal(
  candidate: Exclude<TakramOrbitalProductionStepCandidate, "control">,
  progress: (typeof PROGRESSES)[number]
): TakramOrbitalPrimarySignalParityInput {
  const state = (featureState: "native" | "light-shafts-off" | "bsm-off") => ({
    featureState,
    primaryMarchBytes: new Uint8Array([1, 2, 3, 4]),
    nativeHitMask: new Uint8Array([1, 1, 0, 0]),
    preTemporalOpacity: new Float32Array([0.25, 0.5, 0, 0])
  });
  return {
    candidate,
    progress,
    repeatFloors: {
      nativeHitMaskMismatch: 0,
      opacityMae: 0
    },
    states: [state("native"), state("light-shafts-off"), state("bsm-off")]
  };
}

function makeStage2Candidate(
  candidate: Exclude<TakramOrbitalProductionStepCandidate, "control">,
  fullP95: readonly [number, number, number, number],
  lightP95: readonly [number, number, number, number],
  confirmation?: Readonly<{
    full: readonly [number, number, number, number];
    light: readonly [number, number, number, number];
  }>
): TakramOrbitalStage2CandidateInput {
  return {
    candidate,
    progresses: PROGRESSES.map((progress, index) => ({
      progress,
      primarySignal: makePrimarySignal(candidate, progress),
      populations: {
        fullTotal: makePopulation(
          "total-only-time-elapsed",
          fullP95[index],
          `${candidate}-${progress}-full-total`
        ),
        lightShaftsOffTotal: makePopulation(
          "total-only-time-elapsed",
          lightP95[index],
          `${candidate}-${progress}-light-total`
        ),
        fullStage: makePopulation(
          "stage-only-sequential-time-elapsed",
          fullP95[index] - 0.1,
          `${candidate}-${progress}-full-stage`
        ),
        lightShaftsOffStage: makePopulation(
          "stage-only-sequential-time-elapsed",
          lightP95[index] - 0.1,
          `${candidate}-${progress}-light-stage`
        )
      },
      confirmation: confirmation === undefined
        ? undefined
        : {
            fullTotal: makePopulation(
              "total-only-time-elapsed",
              confirmation.full[index],
              `${candidate}-${progress}-confirm-full`
            ),
            lightShaftsOffTotal: makePopulation(
              "total-only-time-elapsed",
              confirmation.light[index],
              `${candidate}-${progress}-confirm-light`
            )
          }
    }))
  };
}

function makePolicyInput(
  candidates: readonly TakramOrbitalStage2CandidateInput[],
  healthy: readonly TakramOrbitalProductionStepCandidate[] =
    candidates.map(({ candidate }) => candidate)
): TakramOrbitalProductionPolicyInput {
  return {
    stage0: makeStage0(),
    stage1: makeStage1(healthy),
    stage2Candidates: candidates
  };
}

test("accepts only the exact production M4 environment", () => {
  expect(validateTakramOrbitalPerformanceEnvironment(ENVIRONMENT)).toMatchObject({
    valid: true,
    invalidReasons: []
  });

  const invalid = validateTakramOrbitalPerformanceEnvironment({
    ...ENVIRONMENT,
    chip: "Apple M3"
  } as TakramOrbitalPerformanceEnvironment);
  expect(invalid.valid).toBe(false);
  expect(invalid.invalidReasons).toContain("chip-not-apple-m4");

  const missingViewport = { ...ENVIRONMENT } as Record<string, unknown>;
  delete missingViewport.viewport;
  expect(validateTakramOrbitalPerformanceEnvironment(
    missingViewport as unknown as TakramOrbitalPerformanceEnvironment
  )).toMatchObject({ valid: false });
});

test("Stage 0 requires exact environment equality, 93 artifacts, parity, and 8+8 smoke", () => {
  expect(resolveTakramOrbitalProductionStage0(makeStage0())).toMatchObject({
    state: "ORBITAL_PRODUCTION_STAGE_1_READY",
    invalidReasons: []
  });

  const input = makeStage0();
  const blocked = resolveTakramOrbitalProductionStage0({
    ...input,
    populationEnvironments: input.populationEnvironments.map((population, index) =>
      index === 2
        ? {
            ...population,
            environment: {
              ...population.environment,
              macOSVersion: "15.6.2",
              viewport: {
                ...population.environment.viewport,
                physicalWidth: 1439
              }
            } as TakramOrbitalPerformanceEnvironment
          }
        : population
    ),
    causalEvidence: { ...input.causalEvidence, verifiedArtifactCount: 92 },
    routeParity: { ...input.routeParity, camera: false },
    smoke: {
      ...input.smoke,
      stageOnly: { ...input.smoke.stageOnly, validSampleCount: 7 }
    }
  });
  expect(blocked.state).toBe("ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED");
  expect(blocked.invalidReasons).toEqual(expect.arrayContaining([
    "population-final-winner:environment-mismatch",
    "causal-artifact-verification-failed",
    "route-camera-parity-failed",
    "stage-smoke-invalid"
  ]));

  const missingPopulation = resolveTakramOrbitalProductionStage0({
    ...input,
    populationEnvironments: input.populationEnvironments.slice(0, 3)
  });
  expect(missingPopulation.invalidReasons).toContain(
    "invalid-population-environment-set"
  );
});

test("Stage 1 derives all-progress sampling health and never promotes control", () => {
  const decision = resolveTakramOrbitalProductionStage1(makeStage1([
    "control",
    "confirmed"
  ]));
  expect(decision.state).toBe("ORBITAL_PRODUCTION_STAGE_2_READY");
  expect(decision.healthyCandidates).toEqual(["confirmed"]);

  const qualityFail = resolveTakramOrbitalProductionStage1(makeStage1(["control"]));
  expect(qualityFail.state).toBe("ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL");
  expect(qualityFail.healthyCandidates).toEqual([]);
});

test("Stage 1 evidence failures block before quantitative quality", () => {
  const stage1 = makeStage1(["fine"]);
  const blocked = resolveTakramOrbitalProductionStage1({
    candidates: stage1.candidates.map((candidate) => candidate.candidate === "fine"
      ? {
          ...candidate,
          progresses: candidate.progresses.map((entry, index) => index === 0
            ? {
                ...entry,
                metrics: {
                  ...entry.metrics,
                  evidenceValid: false,
                  setupInvalidReasons: ["shader-anchor-drift"]
                }
              }
            : entry)
        }
      : candidate)
  });
  expect(blocked.state).toBe("ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED");
  expect(blocked.invalidReasons).toContain(
    "fine@0:shader-anchor-drift"
  );
});

test("primary-signal parity uses exact feature states and same-progress floors", () => {
  const passing = makePrimarySignal("confirmed", 0.06);
  expect(resolveTakramOrbitalPrimarySignalParity(passing)).toMatchObject({
    evidenceValid: true,
    invariantPass: true,
    comparisons: {
      "light-shafts-off": { hitMaskMismatch: 0, opacityMae: 0 },
      "bsm-off": { hitMaskMismatch: 0, opacityMae: 0 }
    }
  });

  const changed = {
    ...passing,
    repeatFloors: { nativeHitMaskMismatch: 0.25, opacityMae: 0.05 },
    states: passing.states.map((state) => state.featureState === "bsm-off"
      ? {
          ...state,
          nativeHitMask: new Uint8Array([0, 1, 0, 0]),
          preTemporalOpacity: new Float32Array([0.5, 0.5, 0, 0])
        }
      : state)
  } satisfies TakramOrbitalPrimarySignalParityInput;
  expect(resolveTakramOrbitalPrimarySignalParity(changed)).toMatchObject({
    evidenceValid: true,
    invariantPass: false
  });

  const fullIsNotAFeature = resolveTakramOrbitalPrimarySignalParity({
    ...passing,
    states: [
      ...passing.states.slice(0, 2),
      { ...passing.states[2]!, featureState: "full" }
    ]
  } as unknown as TakramOrbitalPrimarySignalParityInput);
  expect(fullIsNotAFeature.evidenceValid).toBe(false);
  expect(fullIsNotAFeature.invalidReasons).toContain("invalid-feature-state:full");
});

test("ranks valid <=4 ms candidates by production eligibility, max p95, and coarsest tie", () => {
  const decision = resolveTakramOrbitalProductionPolicy(makePolicyInput([
    makeStage2Candidate("fine", [2.8, 2.8, 2.8, 2.8], [2, 2, 2, 2]),
    makeStage2Candidate("confirmed", [3.2, 3.2, 3.2, 3.2], [2, 2, 2, 2]),
    makeStage2Candidate("coarse", [2.8, 2.8, 2.8, 2.8], [2, 2, 2, 2])
  ]));
  expect(decision.outcome).toBe("ORBITAL_PUBLIC_STEP_POLICY_WINNER");
  expect(decision.winner).toBe("coarse");
  expect(decision.ranking.map(({ candidate }) => candidate)).toEqual([
    "coarse",
    "fine",
    "confirmed"
  ]);
});

test("requires an independent confirmation before authorizing decoupling", () => {
  const confirmed = makeStage2Candidate(
    "confirmed",
    [4.2, 3.9, 3.8, 3.7],
    [3.4, 3.5, 3.6, 3.7],
    { full: [4.1, 3.9, 3.8, 3.7], light: [3.5, 3.6, 3.7, 3.8] }
  );
  expect(resolveTakramOrbitalProductionPolicy(makePolicyInput([confirmed])))
    .toMatchObject({
      outcome: "ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING",
      decouplingCandidate: "confirmed"
    });

  const failedConfirmation = makeStage2Candidate(
    "confirmed",
    [4.2, 4.1, 4.4, 4.3],
    [3.4, 3.5, 3.6, 3.7],
    { full: [3.9, 3.9, 3.9, 3.9], light: [3.5, 3.6, 3.7, 3.8] }
  );
  expect(resolveTakramOrbitalProductionPolicy(
    makePolicyInput([failedConfirmation])
  ).outcome).toBe("ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED");
});

test("general over-budget and invalid populations resolve to distinct outcomes", () => {
  const overBudget = makeStage2Candidate(
    "fine",
    [4.2, 4.1, 4.4, 4.3],
    [4.1, 4.2, 4.3, 4.4]
  );
  expect(resolveTakramOrbitalProductionPolicy(makePolicyInput([overBudget])).outcome)
    .toBe("ORBITAL_PUBLIC_STEP_POLICY_OVER_BUDGET");

  const invalid = makeStage2Candidate(
    "fine",
    [4.2, 4.1, 4.4, 4.3],
    [4.1, 4.2, 4.3, 4.4]
  );
  const first = invalid.progresses[0]!;
  const blocked = resolveTakramOrbitalProductionPolicy(makePolicyInput([{
    ...invalid,
    progresses: [
      {
        ...first,
        populations: {
          ...first.populations,
          fullTotal: { ...first.populations.fullTotal, state: "unsupported" }
        }
      },
      ...invalid.progresses.slice(1)
    ]
  }]));
  expect(blocked.outcome).toBe("ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED");
});

test("publishes a deeply frozen healthy baseline only for the exact winner", () => {
  const candidate = makeStage2Candidate(
    "confirmed",
    [2.8, 2.9, 2.7, 2.8],
    [2.1, 2.2, 2.1, 2.2]
  );
  const policyInput = makePolicyInput([candidate]);
  const machineDecision = resolveTakramOrbitalProductionPolicy(policyInput);
  const baseline = createTakramOrbitalHealthyBaselineContract({
    candidate: "confirmed",
    machineDecision,
    renderContract: { preset: "h120", coverage: 0.55, layers: ["cloud", "bsm"] },
    progressEvidence: candidate.progresses.map((entry) => ({
      progress: entry.progress,
      identity: { mountKey: `mount-${entry.progress}` },
      metrics: HEALTHY_METRICS,
      featureComparison: resolveTakramOrbitalPrimarySignalParity(
        entry.primarySignal
      ),
      gpuPopulations: entry.populations
    })),
    boundedReview: {
      reviewer: "human-reviewer",
      coherent: true,
      observable: true,
      notes: "bounded review"
    }
  });
  expect(baseline.state).toBe("ORBITAL_HEALTHY_STOCK_BASELINE_READY");
  expect(baseline.query).toEqual({
    key: "orbitalStepPolicy",
    value: "confirmed"
  });
  expect(baseline.perspectiveStepScale).toBe(1.0001);
  expect(Object.isFrozen(baseline)).toBe(true);
  expect(Object.isFrozen(baseline.progressEvidence)).toBe(true);

  expect(() => createTakramOrbitalHealthyBaselineContract({
    ...baseline,
    candidate: "fine",
    machineDecision
  })).toThrow(/exact policy winner/i);
});
