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
