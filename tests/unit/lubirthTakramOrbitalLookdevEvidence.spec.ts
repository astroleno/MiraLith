import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeTakramOrbitalLookdevEvidenceAtomically } from
  "../helpers/takramOrbitalLookdevEvidence";

const evidenceModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence";

async function loadEvidence() {
  return import(evidenceModulePath);
}

const progressValues = [0, 0.06, 0.12, 0.18] as const;

function review(input: {
  candidateId: string;
  coverage?: number;
  hardFrame?: number;
  lowFrame?: number;
  scores?: Partial<Record<
    | "macroCoherence"
    | "cloudGroundSeparation"
    | "depthLayering"
    | "lightingBsmRead"
    | "openingIdentityStability"
    | "artifactFreedom",
    0 | 1 | 2
  >>;
}) {
  const baseScores = {
    macroCoherence: 1 as const,
    cloudGroundSeparation: 1 as const,
    depthLayering: 1 as const,
    lightingBsmRead: 1 as const,
    openingIdentityStability: 1 as const,
    artifactFreedom: 1 as const,
    ...input.scores
  };
  return {
    schema: "takram-orbital-lookdev-visual-review/v1" as const,
    reviewer: "human:aitoshuu",
    cleanCommit: "0123456789abcdef0123456789abcdef01234567",
    candidateId: input.candidateId,
    nativeFrame: 32 as const,
    viewport: { width: 1440 as const, height: 960 as const, dpr: 1 as const },
    referenceHashes: {
      nasa: "d1bf3d7478969acf7910ccb0688554a8074650df60f528ca91b84d91a04120eb",
      takram: "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5"
    },
    frames: progressValues.map((progress, index) => ({
      progress,
      hardFlags: index === input.hardFrame ? ["cube-face-seam"] : [],
      scores: {
        ...baseScores,
        ...(index === input.lowFrame ? { macroCoherence: 0 as const } : {})
      }
    }))
  };
}

test("enforces Stage 0, bounded A-D transitions, and terminal outcomes", async () => {
  const {
    resolveTakramOrbitalStage0,
    resolveTakramOrbitalStageA,
    resolveTakramOrbitalStageB,
    resolveTakramOrbitalStageC,
    resolveTakramOrbitalStageD
  } = await loadEvidence();
  const passingGates = {
    cleanCommit: true,
    coordinateHdrReady: true,
    fingerprintParity: true,
    fullComposerRemount: true,
    nativeFrameLock: true,
    referencesValid: true,
    repeatNoiseFloorPass: true,
    runtimeReadbackMatch: true
  };

  expect(resolveTakramOrbitalStage0(passingGates)).toEqual({
    invalidReasons: [],
    state: "ORBITAL_STAGE_A_UNLOCKED"
  });
  expect(resolveTakramOrbitalStage0({ ...passingGates, referencesValid: false }))
    .toEqual({
      invalidReasons: ["references-invalid"],
      state: "ORBITAL_LOOKDEV_SETUP_BLOCKED"
    });

  expect(resolveTakramOrbitalStageA([
    { candidateId: "h40", decision: "HARD_ARTIFACT_FAIL" },
    { candidateId: "h80", decision: "HARD_ARTIFACT_FAIL" },
    { candidateId: "h120", decision: "HARD_ARTIFACT_FAIL" }
  ])).toEqual({
    state: "BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED",
    survivorIds: []
  });
  expect(resolveTakramOrbitalStageA([
    { candidateId: "h40", decision: "TOPOLOGY_AMBIGUOUS" },
    { candidateId: "h80", decision: "TOPOLOGY_PASS" },
    { candidateId: "h120", decision: "TOPOLOGY_UNOBSERVABLE" }
  ])).toEqual({
    state: "ORBITAL_STAGE_B_UNLOCKED",
    survivorIds: ["h40", "h80", "h120"]
  });

  const stageB = resolveTakramOrbitalStageB([
    { candidateId: "h40-c03", preset: "h40", coverage: 0.3, review: review({ candidateId: "h40-c03" }) },
    { candidateId: "h40-c04", preset: "h40", coverage: 0.4, review: review({ candidateId: "h40-c04", scores: { artifactFreedom: 2 } }) },
    { candidateId: "h80-c03", preset: "h80", coverage: 0.3, review: review({ candidateId: "h80-c03", scores: { depthLayering: 2 } }) },
    { candidateId: "h120-c03", preset: "h120", coverage: 0.3, review: review({ candidateId: "h120-c03", lowFrame: 2 }) }
  ]);
  expect(stageB.state).toBe("ORBITAL_STAGE_C_UNLOCKED");
  expect(stageB.survivorIds).toEqual(["h40-c04", "h80-c03"]);
  expect(stageB.ordering).toEqual(["h40-c04", "h80-c03"]);
  expect(resolveTakramOrbitalStageB([
    { candidateId: "h40", preset: "h40", coverage: 0.3, review: review({ candidateId: "h40", lowFrame: 0 }) }
  ]).state).toBe("BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED");

  const stageC = resolveTakramOrbitalStageC([
    { candidateId: "h40-v1", preset: "h40", coverage: 0.4, verticalScale: 1, review: review({ candidateId: "h40-v1" }) },
    { candidateId: "h80-v2", preset: "h80", coverage: 0.3, verticalScale: 2, review: review({ candidateId: "h80-v2", scores: { artifactFreedom: 2 } }) }
  ]);
  expect(stageC).toMatchObject({
    state: "ORBITAL_STAGE_D_UNLOCKED",
    winnerId: "h80-v2"
  });
  expect(resolveTakramOrbitalStageC([
    { candidateId: "flat", preset: "h40", coverage: 0.3, verticalScale: 1, review: review({ candidateId: "flat", hardFrame: 1 }) }
  ]).state).toBe("ORBITAL_VERTICAL_PROFILE_FAIL");

  const stageD = resolveTakramOrbitalStageD([
    { candidateId: "opt075", preset: "h80", coverage: 0.3, verticalScale: 2, opticalDepthScale: 0.75, review: review({ candidateId: "opt075" }) },
    { candidateId: "opt1", preset: "h80", coverage: 0.3, verticalScale: 2, opticalDepthScale: 1, review: review({ candidateId: "opt1" }) }
  ]);
  expect(stageD).toMatchObject({
    state: "ORBITAL_LOOKDEV_WINNER",
    winnerId: "opt1"
  });
  expect(resolveTakramOrbitalStageD([
    { candidateId: "crushed", preset: "h80", coverage: 0.3, verticalScale: 2, opticalDepthScale: 1.5, review: review({ candidateId: "crushed", lowFrame: 3 }) }
  ]).state).toBe("ORBITAL_OPTICAL_DEPTH_FAIL");
});

test("validates every review frame and applies the exact passing-only tie breaks", async () => {
  const {
    evaluateTakramOrbitalVisualReview,
    rankTakramOrbitalPassingCandidates
  } = await loadEvidence();
  const highTotalButFailing = review({
    candidateId: "failing",
    lowFrame: 1,
    scores: {
      macroCoherence: 2,
      cloudGroundSeparation: 2,
      depthLayering: 2,
      lightingBsmRead: 2,
      openingIdentityStability: 2,
      artifactFreedom: 2
    }
  });
  expect(evaluateTakramOrbitalVisualReview(highTotalButFailing)).toMatchObject({
    pass: false,
    invalidReasons: ["frame-0.06-score-macroCoherence-below-1"]
  });
  expect(evaluateTakramOrbitalVisualReview(review({ candidateId: "hard", hardFrame: 0 })))
    .toMatchObject({ pass: false, invalidReasons: ["frame-0-hard-flag:cube-face-seam"] });

  const candidates = [
    { candidateId: "h120", preset: "h120", coverage: 0.3, review: review({ candidateId: "h120", scores: { depthLayering: 2 } }) },
    { candidateId: "h80", preset: "h80", coverage: 0.4, review: review({ candidateId: "h80", scores: { artifactFreedom: 2 } }) },
    { candidateId: "h40", preset: "h40", coverage: 0.3, review: review({ candidateId: "h40", scores: { artifactFreedom: 2 } }) },
    { candidateId: "failing", preset: "h40", coverage: 0.3, review: highTotalButFailing }
  ];
  const ranked = rankTakramOrbitalPassingCandidates(candidates, "B");
  expect(ranked.map((entry: any) => entry.candidateId)).toEqual([
    "h40",
    "h80",
    "h120"
  ]);
  expect(ranked.some((entry: any) => entry.candidateId === "failing")).toBe(false);
});

test("normalizes only the baseline wrapper and measures the exact repeat noise floor", async () => {
  const {
    normalizeTakramOrbitalBaselineFingerprint,
    resolveTakramOrbitalRepeatNoiseFloor
  } = await loadEvidence();
  const payload = {
    adapter: { repeat: [1, 1], channel: "rgba" },
    renderer: {
      composer: ["Clouds", "AerialPerspective"],
      layers: [{ channel: "r", height: 650 }],
      shader: "fnv1a-64:abc",
      targets: { clouds: { format: "RGBA16F", width: 1440 } }
    }
  };
  const legacy = {
    schemaVersion: 5,
    classification: "legacy-unscaled-stock",
    resolver: { kind: "legacy", value: payload }
  };
  const lookdev = {
    schemaVersion: 6,
    classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
    resolver: { kind: "orbital", value: payload }
  };
  expect(normalizeTakramOrbitalBaselineFingerprint(legacy))
    .toEqual(normalizeTakramOrbitalBaselineFingerprint(lookdev));
  const drifted = structuredClone(lookdev);
  drifted.resolver.value.renderer.targets.clouds.width = 720;
  expect(normalizeTakramOrbitalBaselineFingerprint(legacy))
    .not.toEqual(normalizeTakramOrbitalBaselineFingerprint(drifted));

  const mask = new Uint8Array([1, 1]);
  const frame = (a: number, b: number) =>
    new Uint8Array([a, a, a, a, b, b, b, b]);
  const passing = resolveTakramOrbitalRepeatNoiseFloor({
    legacyA: frame(0, 10),
    legacyB: frame(1, 11),
    lookdevA: frame(1, 11),
    lookdevB: frame(2, 12),
    mask
  });
  expect(passing).toEqual({
    crossRouteMae: { a: 1, b: 1 },
    pass: true,
    repeatNoiseFloor: 1,
    sameRouteMae: { legacy: 1, lookdev: 1 },
    sampledChannelCount: 8
  });
  expect(resolveTakramOrbitalRepeatNoiseFloor({
    legacyA: frame(0, 10),
    legacyB: frame(0, 10),
    lookdevA: frame(2, 12),
    lookdevB: frame(2, 12),
    mask
  })).toMatchObject({ pass: false, repeatNoiseFloor: 0 });
});

test("authorizes V3 and formal evidence for the committed stock winner only", async () => {
  const {
    authorizeTakramOrbitalStageCapture,
    createTakramOrbitalEvidenceManifest
  } = await loadEvidence();
  expect(authorizeTakramOrbitalStageCapture({
    stage: "E",
    candidateId: "winner",
    committedWinnerId: "winner"
  })).toEqual({ authorized: true, reason: null });
  expect(authorizeTakramOrbitalStageCapture({
    stage: "F",
    candidateId: "loser",
    committedWinnerId: "winner"
  })).toEqual({ authorized: false, reason: "candidate-is-not-committed-stock-winner" });

  const manifest = createTakramOrbitalEvidenceManifest({
    cleanCommit: "0123456789abcdef0123456789abcdef01234567",
    query: "?orbitalPreset=h80",
    requestedContract: { preset: "h80" },
    runtimeReadback: { preset: "h80" },
    rendererFingerprint: { schemaVersion: 6 },
    identities: {
      driftAttemptLedgerOutcome: "none",
      lookdevBaseKey: "base",
      lookdevMountKey: "mount",
      resetNonce: 0,
      runtimeEvidenceEpoch: "runtime"
    },
    hashes: {
      packages: { clouds: "package-hash" },
      patches: { clouds: "patch-hash" },
      references: { nasa: "nasa-hash", takram: "takram-hash" },
      screenshots: { frame: "frame-hash" },
      shaders: { clouds: "shader-hash" }
    },
    review: review({ candidateId: "winner" }),
    ranking: ["winner"],
    checkpointState: "ORBITAL_LOOKDEV_WINNER",
    winnerId: "winner",
    setupInvalidReasons: [],
    rawDiagnostics: { candidateId: "winner", references: ["raw/frame-32.bin"] },
    timer: { candidateId: "winner", state: "unsupported", invalidReasons: ["timer-query-unavailable"], rawPopulationReferences: [] }
  });
  expect(manifest).toMatchObject({
    schema: "takram-orbital-lookdev-evidence/v1",
    winnerId: "winner",
    rawDiagnostics: { candidateId: "winner" },
    timer: { state: "unsupported" }
  });
  expect(Object.isFrozen(manifest)).toBe(true);
  expect(() => createTakramOrbitalEvidenceManifest({
    ...manifest,
    rawDiagnostics: { candidateId: "loser", references: [] }
  })).toThrow(/committed stock winner/);
});

test("publishes orbital evidence atomically and stays inert outside capture mode", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "miralith-orbital-evidence-"));
  const finalDirectory = path.join(root, "formal");
  let buildCount = 0;
  try {
    expect(await writeTakramOrbitalLookdevEvidenceAtomically({
      build: async () => { buildCount += 1; },
      enabled: false,
      finalDirectory
    })).toBe(false);
    expect(buildCount).toBe(0);

    await writeTakramOrbitalLookdevEvidenceAtomically({
      build: async (directory: string) => {
        writeFileSync(path.join(directory, "manifest.json"), "first");
      },
      enabled: true,
      finalDirectory
    });
    await writeTakramOrbitalLookdevEvidenceAtomically({
      build: async (directory: string) => {
        writeFileSync(path.join(directory, "manifest.json"), "second");
      },
      enabled: true,
      finalDirectory
    });
    expect(readFileSync(path.join(finalDirectory, "manifest.json"), "utf8"))
      .toBe("second");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

const v2HealthyMetrics = {
  evidenceValid: true,
  setupInvalidReasons: [],
  nativeHitPixelFraction: 0.25,
  preTemporalSignalPixelFraction: 0.25,
  smallFragmentFraction: 0.05,
  signalRetention: 1,
  signalLumaRetention: 1,
  pairedChange: 0.02,
  repeatNoiseFloor: 0.005,
  enteredPrimaryMarchPixelCount: 12,
  primaryCapSaturationFraction: 0.01,
  noHitPrimaryCapSaturationFraction: 0
};

const v2StageDimensions = {
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
} as const;

function v2Review(input: Readonly<{
  candidateId: string;
  stage: keyof typeof v2StageDimensions;
  lowDimension?: string;
  hardFlag?: string;
  scoreOverrides?: Readonly<Record<string, number>>;
  deferredScores?: Readonly<Record<string, number>>;
}>) {
  const required = Object.fromEntries(
    v2StageDimensions[input.stage].map((dimension) => [dimension, 1])
  );
  return {
    schema: "takram-orbital-lookdev-visual-review/v2",
    reviewer: "human:aitoshuu",
    cleanCommit: "0123456789abcdef0123456789abcdef01234567",
    candidateId: input.candidateId,
    stage: input.stage,
    nativeFrame: 32,
    viewport: { width: 1440, height: 960, dpr: 1 },
    referenceHashes: { nasa: "nasa-hash", takram: "takram-hash" },
    frames: progressValues.map((progress, index) => ({
      progress,
      hardFlags: index === 0 && input.hardFlag ? [input.hardFlag] : [],
      scores: {
        ...required,
        ...input.deferredScores,
        ...input.scoreOverrides,
        ...(index === 0 && input.lowDimension
          ? { [input.lowDimension]: 0 }
          : {})
      }
    }))
  };
}

function v2Candidate(input: Readonly<{
  candidateId: string;
  morphologyH?: 40 | 80 | 120;
  coverage?: 0.3 | 0.4 | 0.45 | 0.55;
  verticalScale?: 1 | 2 | 4;
  opticalDepthScale?: 0.75 | 1 | 1.5;
  stage: keyof typeof v2StageDimensions | "final-stock";
  metrics?: typeof v2HealthyMetrics;
  nativeHitPixelCount?: number;
  preTemporalSignalPixelFraction?: number;
  setupInvalidReasons?: readonly string[];
  review?: ReturnType<typeof v2Review> | null;
}>) {
  const metrics = input.metrics ?? v2HealthyMetrics;
  return {
    candidateId: input.candidateId,
    morphologyH: input.morphologyH ?? 80,
    coverage: input.coverage ?? 0.3,
    verticalScale: input.verticalScale ?? 1,
    opticalDepthScale: input.opticalDepthScale ?? 1,
    progresses: progressValues.map((progress) => ({
      progress,
      setupInvalidReasons: input.setupInvalidReasons ?? [],
      metrics: {
        ...metrics,
        preTemporalSignalPixelFraction:
          input.preTemporalSignalPixelFraction ??
          metrics.preTemporalSignalPixelFraction
      },
      nativeHitPixelCount: input.nativeHitPixelCount ?? 1
    })),
    review: input.stage === "final-stock"
      ? undefined
      : input.review === null
        ? undefined
        : input.review ?? v2Review({
            candidateId: input.candidateId,
            stage: input.stage
          })
  };
}

test("V2 shared gate resolves setup before per-candidate sampling health", async () => {
  const { resolveTakramOrbitalV2SharedGate } = await loadEvidence();
  const healthy = v2Candidate({ candidateId: "healthy", stage: "4A" });
  const invalid = v2Candidate({
    candidateId: "invalid",
    stage: "4A",
    setupInvalidReasons: ["shader-anchor-drift"],
    metrics: {
      ...v2HealthyMetrics,
      enteredPrimaryMarchPixelCount: 0,
      primaryCapSaturationFraction: 0.5
    }
  });
  const blocked = resolveTakramOrbitalV2SharedGate({
    stage: "4A",
    candidates: [healthy, invalid]
  });
  expect(blocked).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED",
    failedStage: "4A",
    survivorIds: []
  });
  expect(blocked.setupFailures).toEqual(expect.arrayContaining([
    expect.objectContaining({
      candidateId: "invalid",
      progress: 0,
      reasons: ["shader-anchor-drift"]
    })
  ]));

  const noEntry = v2Candidate({
    candidateId: "no-entry",
    stage: "4A",
    metrics: { ...v2HealthyMetrics, enteredPrimaryMarchPixelCount: 0 }
  });
  const capped = v2Candidate({
    candidateId: "capped",
    stage: "4A",
    metrics: { ...v2HealthyMetrics, primaryCapSaturationFraction: 0.010001 }
  });
  const failed = resolveTakramOrbitalV2SharedGate({
    stage: "4A",
    candidates: [noEntry, capped]
  });
  expect(failed).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL",
    failedStage: "4A",
    survivorIds: []
  });
  expect(failed.samplingFailures).toEqual(expect.arrayContaining([
    expect.objectContaining({
      candidateId: "no-entry",
      progress: 0,
      enteredPrimaryMarchPixelCount: 0,
      primaryCapSaturationFraction: 0.01
    }),
    expect.objectContaining({
      candidateId: "capped",
      progress: 0,
      enteredPrimaryMarchPixelCount: 12,
      primaryCapSaturationFraction: 0.010001
    })
  ]));

  const mixed = resolveTakramOrbitalV2SharedGate({
    stage: "4A",
    candidates: [healthy, noEntry]
  });
  expect(mixed).toMatchObject({ state: "V2_SHARED_GATE_READY" });
  expect(mixed.survivorIds).toEqual(["healthy"]);
});

test("V2 4A/4B signal gate enforces exact zero and accepts smallest positive", async () => {
  const { resolveTakramOrbitalV2SignalPresenceGate } = await loadEvidence();
  for (const stage of ["4A", "4B"] as const) {
    const nativeZero = v2Candidate({
      candidateId: `${stage}-native-zero`,
      stage,
      nativeHitPixelCount: 0
    });
    const signalZero = v2Candidate({
      candidateId: `${stage}-signal-zero`,
      stage,
      preTemporalSignalPixelFraction: 0
    });
    const smallestPositive = v2Candidate({
      candidateId: `${stage}-positive`,
      stage,
      nativeHitPixelCount: 1,
      preTemporalSignalPixelFraction: Number.MIN_VALUE
    });
    const decision = resolveTakramOrbitalV2SignalPresenceGate({
      stage,
      candidates: [nativeZero, signalZero, smallestPositive]
    });
    expect(decision.survivorIds).toEqual([`${stage}-positive`]);
    expect(decision.machineFailures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateId: `${stage}-native-zero`,
        reasons: ["native-hit-absent"]
      }),
      expect.objectContaining({
        candidateId: `${stage}-signal-zero`,
        reasons: ["pre-temporal-signal-absent"]
      })
    ]));
  }
});

test("V2 reviews use exact stage dimensions and enumerated hard flags", async () => {
  const { evaluateTakramOrbitalV2VisualReview } = await loadEvidence();
  const deferredZeros = v2Review({
    candidateId: "morphology",
    stage: "4A",
    deferredScores: {
      cloudGroundSeparation: 0,
      depthLayering: 0,
      lightingBsmRead: 0
    }
  });
  expect(evaluateTakramOrbitalV2VisualReview(deferredZeros)).toMatchObject({
    valid: true,
    pass: true
  });
  expect(evaluateTakramOrbitalV2VisualReview(v2Review({
    candidateId: "coverage",
    stage: "4B",
    lowDimension: "coverageUsability"
  }))).toMatchObject({ pass: false });
  expect(evaluateTakramOrbitalV2VisualReview(v2Review({
    candidateId: "hard",
    stage: "4D",
    hardFlag: "cube-face-seam"
  }))).toMatchObject({ pass: false });
  expect(evaluateTakramOrbitalV2VisualReview(v2Review({
    candidateId: "invalid-hard",
    stage: "4D",
    hardFlag: "non-finite-output"
  }))).toMatchObject({
    valid: false,
    invalidReasons: expect.arrayContaining([
      "frame-0:invalid-hard-flag:non-finite-output"
    ])
  });
});

test("V2 stage resolvers apply exact bounded ranking and no-winner terminals", async () => {
  const {
    resolveTakramOrbitalV2Stage4A,
    resolveTakramOrbitalV2Stage4B,
    resolveTakramOrbitalV2Stage4C,
    resolveTakramOrbitalV2Stage4D
  } = await loadEvidence();
  const stageA = resolveTakramOrbitalV2Stage4A({
    stage: "4A",
    candidates: [40, 80, 120].map((morphologyH) => v2Candidate({
      candidateId: `h${morphologyH}`,
      morphologyH: morphologyH as 40 | 80 | 120,
      stage: "4A"
    }))
  });
  expect(stageA).toMatchObject({ state: "ORBITAL_LOOKDEV_V2_STAGE_4B_READY" });
  expect(stageA.survivorIds).toEqual(["h40", "h80", "h120"]);

  const stageB = resolveTakramOrbitalV2Stage4B({
    stage: "4B",
    candidates: ([40, 80, 120] as const).flatMap((morphologyH) =>
      ([0.3, 0.4, 0.45, 0.55] as const).map((coverage) => v2Candidate({
        candidateId: `h${morphologyH}-c${coverage}`,
        morphologyH,
        coverage,
        stage: "4B"
      }))
    )
  });
  expect(stageB).toMatchObject({ state: "ORBITAL_LOOKDEV_V2_STAGE_4C_READY" });
  expect(stageB.survivorIds).toEqual(["h40-c0.3", "h80-c0.3"]);

  expect(resolveTakramOrbitalV2Stage4B({
    stage: "4B",
    candidates: [v2Candidate({
      candidateId: "incomplete",
      morphologyH: 40,
      coverage: 0.3,
      stage: "4B"
    })]
  })).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED",
    setupFailures: expect.arrayContaining([
      expect.objectContaining({ reasons: ["invalid-stage-capture-matrix"] })
    ])
  });

  const stageC = resolveTakramOrbitalV2Stage4C({
    stage: "4C",
    candidates: ([1, 2, 4] as const).map((verticalScale) => v2Candidate({
      candidateId: `vertical-${verticalScale}`,
      morphologyH: 40,
      coverage: 0.3,
      verticalScale,
      stage: "4C"
    }))
  });
  expect(stageC).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_STAGE_4D_READY",
    winnerId: "vertical-1"
  });

  const stageD = resolveTakramOrbitalV2Stage4D({
    stage: "4D",
    candidates: ([0.75, 1, 1.5] as const).map((opticalDepthScale) =>
      v2Candidate({
        candidateId: `optical-${opticalDepthScale}`,
        opticalDepthScale,
        stage: "4D"
      })
    )
  });
  expect(stageD).toMatchObject({
    state: "ORBITAL_STOCK_LOOKDEV_V2_WINNER",
    winnerId: "optical-1"
  });

  const machineFail = resolveTakramOrbitalV2Stage4A({
    stage: "4A",
    candidates: ([40, 80, 120] as const).map((morphologyH) => v2Candidate({
      candidateId: `no-signal-h${morphologyH}`,
      morphologyH,
      nativeHitPixelCount: 0,
      review: null,
      stage: "4A"
    }))
  });
  expect(machineFail).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_MORPHOLOGY_FAIL",
    visualEvaluations: [],
    machineFailures: expect.arrayContaining([
      expect.objectContaining({ reasons: ["native-hit-absent"] })
    ])
  });
});

test("V2 invalid required review blocks the stage instead of dropping its candidate", async () => {
  const { resolveTakramOrbitalV2Stage4C } = await loadEvidence();
  const invalid = v2Candidate({
    candidateId: "invalid-review",
    verticalScale: 2,
    stage: "4C"
  });
  const decision = resolveTakramOrbitalV2Stage4C({
    stage: "4C",
    candidates: [
      v2Candidate({ candidateId: "valid-1", verticalScale: 1, stage: "4C" }),
      {
        ...invalid,
        review: { ...invalid.review, cleanCommit: "dirty" }
      },
      v2Candidate({ candidateId: "valid-4", verticalScale: 4, stage: "4C" })
    ]
  });
  expect(decision).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED",
    failedStage: "4C",
    winnerId: null
  });
});

function finalStockCandidate(input: Readonly<{
  setupInvalidReasons?: readonly string[];
  entered?: number;
  cap?: number;
}> = {}) {
  return v2Candidate({
    candidateId: "stock-winner",
    stage: "final-stock",
    setupInvalidReasons: input.setupInvalidReasons,
    metrics: {
      ...v2HealthyMetrics,
      enteredPrimaryMarchPixelCount: input.entered ?? 12,
      primaryCapSaturationFraction: input.cap ?? 0.01
    }
  });
}

function finalPopulation(progress: number, p95: number) {
  return {
    populationId: `final-${progress}`,
    measurementMode: "total-only-time-elapsed",
    warmupFrameCount: 120,
    targetSampleCount: 120,
    validSampleCount: 120,
    state: "complete",
    timestampBits: 64,
    p95Milliseconds: p95,
    invalidReasons: []
  };
}

test("V2 final stock replay gates GPU and V3 before exact p95 classification", async () => {
  const {
    resolveTakramOrbitalV2FinalStockReplay,
    resolveTakramOrbitalV2FinalClassification
  } = await loadEvidence();
  const setupBlocked = resolveTakramOrbitalV2FinalStockReplay({
    winnerId: "stock-winner",
    candidate: finalStockCandidate({ setupInvalidReasons: ["hash-mismatch"] })
  });
  expect(setupBlocked).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_SETUP_BLOCKED",
    failedStage: "final-stock",
    gpuAuthorized: false,
    v3Authorized: false
  });

  const samplingFailed = resolveTakramOrbitalV2FinalStockReplay({
    winnerId: "stock-winner",
    candidate: finalStockCandidate({ cap: 0.010001 })
  });
  expect(samplingFailed).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL",
    failedStage: "final-stock",
    gpuAuthorized: false,
    v3Authorized: false
  });

  const replay = resolveTakramOrbitalV2FinalStockReplay({
    winnerId: "stock-winner",
    candidate: finalStockCandidate()
  });
  expect(replay).toMatchObject({
    state: "ORBITAL_LOOKDEV_V2_FINAL_STOCK_READY",
    gpuAuthorized: true,
    v3Authorized: true
  });

  const classify = (values: readonly number[]) =>
    resolveTakramOrbitalV2FinalClassification({
      replay,
      winnerId: "stock-winner",
      populations: progressValues.map((progress, index) => ({
        progress,
        population: finalPopulation(progress, values[index]!)
      }))
    });
  expect(classify([2.8, 3, 2.9, 2.7])).toMatchObject({
    state: "ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE",
    maxP95Milliseconds: 3,
    v3Authorized: true
  });
  expect(classify([3.1, 4, 3.5, 3.8]).state)
    .toBe("ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY");
  expect(classify([4.01, 3, 3, 3]).state)
    .toBe("ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET");

  const invalidTimer = classify([2.8, 3, 2.9, 2.7]);
  const perfBlocked = resolveTakramOrbitalV2FinalClassification({
    replay,
    winnerId: "stock-winner",
    populations: progressValues.map((progress, index) => ({
      progress,
      population: index === 2
        ? { ...finalPopulation(progress, 2.9), state: "unsupported" }
        : finalPopulation(progress, 2.8)
    }))
  });
  expect(invalidTimer.state).toBe("ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE");
  expect(perfBlocked).toMatchObject({
    state: "ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED",
    v3Authorized: true
  });
});
