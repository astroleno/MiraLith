import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import {
  TAKRAM_ORBITAL_GPU_STAGE_NAMES,
  type TakramOrbitalGpuProfileSnapshot
} from
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler";
import {
  resolveTakramOrbitalProductionStage0,
  type TakramOrbitalGpuPolicyPopulation,
  type TakramOrbitalPerformanceEnvironment,
  type TakramOrbitalProductionStage0Input
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy";
import {
  resolveTakramOrbitalSamplingOutcome,
  resolveTakramOrbitalStepScale
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingCausality";
import type {
  TakramOrbitalFeatureState,
  TakramOrbitalOutput,
  TakramParityPrimaryMarchReadback,
  TakramParityTelemetry
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
import {
  collectOrbitalEvidenceEnvironment,
  createOrbitalStagingRun,
  hashOrbitalFile,
  resolveAndPublishStageAtomically,
  resolveOrbitalStagingArtifactPath,
  runGpuPopulation,
  validateOrbitalEvidenceEnvironment,
  verifyFreshCompleteRemount,
  writeOrbitalArtifactManifest,
  type OrbitalEvidenceEnvironment
} from "../helpers/takramOrbitalProductionEvidence";

test.setTimeout(900_000);

const candidates = ["control", "fine", "confirmed", "coarse"] as const;
const policyRoot = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-13/" +
    "takram-orbital-production-step-policy"
);
const lookdevRoot = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-13/" +
    "takram-orbital-lookdev-v2"
);
const causalEvidenceRoot = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-13/" +
    "takram-orbital-sampling-causality"
);
const formalCaptureCommand =
  process.env.MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE ?? "";

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeRunJson(
  run: NonNullable<Awaited<ReturnType<typeof createOrbitalStagingRun>>>,
  relativePath: string,
  value: unknown
) {
  const filePath = resolveOrbitalStagingArtifactPath(run, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, stableJson(value));
}

function route(input: Readonly<{
  candidate: typeof candidates[number];
  featureState?: TakramOrbitalFeatureState;
  output?: TakramOrbitalOutput;
  progress?: 0 | 0.06 | 0.12 | 0.18;
}>) {
  const params = new URLSearchParams({
    diagnostic: input.output ?? "full",
    input: "stock",
    opticalDepthScale: "1",
    orbitalCoverage: "0.55",
    orbitalFeatureState: input.featureState ?? "native",
    orbitalPreset: "h120",
    orbitalProductionStep: input.candidate,
    progress: String(input.progress ?? 0.06),
    verticalScale: "1",
    view: "opening",
    visualTest: "pixels"
  });
  return `/lubirth-takram-parity-spike?${params.toString()}`;
}

function causalRoute(mode: "control" | "treatment") {
  const params = new URLSearchParams({
    diagnostic: "full",
    input: "stock",
    opticalDepthScale: "1",
    orbitalCoverage: "0.55",
    orbitalPreset: "h120",
    orbitalStepScale: mode,
    progress: "0.06",
    verticalScale: "1",
    view: "opening",
    visualTest: "pixels"
  });
  return `/lubirth-takram-parity-spike?${params.toString()}`;
}

async function openReady(
  page: Page,
  requestedRoute: string,
  navigation: "document" | "same-document" = "document"
) {
  if (navigation === "document") {
    const response = await page.goto(requestedRoute);
    expect(response?.status()).toBe(200);
  } else {
    await page.evaluate((nextRoute) => {
      window.history.pushState({}, "", nextRoute);
    }, requestedRoute);
  }
  const expected = new URL(requestedRoute, "http://127.0.0.1").searchParams;
  const root = page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute(
    "data-orbital-production-step",
    expected.get("orbitalProductionStep")!
  );
  await expect(root).toHaveAttribute(
    "data-orbital-feature-state",
    expected.get("orbitalFeatureState")!
  );
  await expect(root).toHaveAttribute(
    "data-orbital-output",
    expected.get("diagnostic")!
  );
  try {
    await expect(root).toHaveAttribute("data-runtime", "ready", {
      timeout: 180_000
    });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
        TakramParityTelemetry | undefined;
      return {
        diagnosticRestoration: Reflect.get(
          window,
          "__MiraLithTakramDiagnosticRestoration"
        ),
        hasPrimaryReadback: Reflect.get(
          window,
          "__MiraLithTakramPrimaryMarch"
        ) !== undefined,
        telemetry: telemetry === undefined
          ? null
          : {
              active: telemetry.active,
              diagnostic: telemetry.diagnostic,
              diagnosticApplied: telemetry.diagnosticApplied,
              diagnosticState: telemetry.diagnosticState,
              driftSignature: telemetry.driftSignature,
              lookdevSetupState: telemetry.lookdevSetupState,
              nativeFrameCount: telemetry.nativeFrameCount,
              orbitalLookdev: telemetry.orbitalLookdev,
              primaryMarchReadback: telemetry.primaryMarchReadback,
              temporalConverged: telemetry.temporalConverged
            }
      };
    });
    throw new Error(
      `orbital-route-never-ready:${JSON.stringify(diagnostic)}\n${String(error)}`
    );
  }
  await page.waitForFunction(() => {
    const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
      TakramParityTelemetry | undefined;
    return telemetry?.active === true && telemetry.nativeFrameCount >= 32 &&
      telemetry.matchedTemporalFrameCapture?.nativeFrameCount === 32 &&
      telemetry.matchedTemporalFrameCapture.frameLockPass === true;
  }, undefined, { timeout: 180_000 });
  return await page.evaluate(() =>
    structuredClone(Reflect.get(window, "__MiraLithTakramParity")) as
      TakramParityTelemetry
  );
}

function primaryHash(readback: TakramParityPrimaryMarchReadback) {
  const values = new Float32Array(readback.values);
  return createHash("sha256")
    .update(Buffer.from(values.buffer, values.byteOffset, values.byteLength))
    .digest("hex");
}

async function startGpuPopulation(input: Readonly<{
  candidate: typeof candidates[number];
  featureState: "native" | "light-shafts-off";
  measurementMode:
    | "total-only-time-elapsed"
    | "stage-only-sequential-time-elapsed";
  page: Page;
  telemetry: TakramParityTelemetry;
}>) {
  const result = await input.page.evaluate((request) => {
    const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
      TakramParityTelemetry | undefined;
    const start = Reflect.get(window, "__MiraLithStartTakramGpuProfile") as
      ((value: typeof request & Readonly<{
        lookdevMountKey: string;
        runtimeEvidenceEpoch: string;
      }>) => Readonly<{
        accepted: boolean;
        reason: string | null;
      }>) | undefined;
    if (telemetry?.lookdevMountKey === null ||
      telemetry?.runtimeEvidenceEpoch === null || telemetry === undefined) {
      return { accepted: false, reason: "runtime-evidence-identity-missing" };
    }
    return start?.({
      ...request,
      lookdevMountKey: telemetry.lookdevMountKey,
      runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch
    }) ?? {
      accepted: false,
      reason: "production-profiler-api-missing"
    };
  }, {
    candidateId: input.candidate,
    committedWinnerId: input.candidate,
    featureState: input.featureState,
    measurementMode: input.measurementMode,
    targetSampleCount: 8 as const,
    warmupFrameCount: 8 as const
  });
  if (!result.accepted) {
    const audit = await input.page.evaluate(() =>
      Reflect.get(window, "__MiraLithTakramGpuProfileStartAudit")
    );
    throw new Error(`gpu-population-rejected:${JSON.stringify({ result, audit })}`);
  }
  try {
    await input.page.waitForFunction(() => {
      const snapshot = Reflect.get(window, "__MiraLithTakramGpuProfile") as
        TakramOrbitalGpuProfileSnapshot | undefined;
      return snapshot?.state === "complete" || snapshot?.state === "unsupported";
    }, undefined, { timeout: 300_000 });
  } catch (error) {
    const diagnostic = await input.page.evaluate(() => ({
      profile: Reflect.get(window, "__MiraLithTakramGpuProfile"),
      telemetry: Reflect.get(window, "__MiraLithTakramParity")
    }));
    throw new Error(
      `gpu-population-never-completed:${JSON.stringify(diagnostic)}\n${String(error)}`
    );
  }
  return await input.page.evaluate(() =>
    structuredClone(Reflect.get(window, "__MiraLithTakramGpuProfile")) as
      TakramOrbitalGpuProfileSnapshot & Readonly<{
        submissionAudit: Readonly<{
          combinedPassName: string;
          effectOrder: readonly string[];
          hookSourceFnv1a64: string;
          installedBuildFnv1a64: string;
        }>;
      }>
  );
}

test.beforeEach(() => {
  if (formalCaptureCommand === "") {
    expect(existsSync(policyRoot)).toBe(false);
    expect(existsSync(lookdevRoot)).toBe(false);
  }
});

test.afterEach(() => {
  if (formalCaptureCommand === "") {
    expect(existsSync(policyRoot)).toBe(false);
    expect(existsSync(lookdevRoot)).toBe(false);
  }
});

test("formal Stage 0 publishes the capability gate", async ({ page }) => {
  test.skip(formalCaptureCommand !== "stage-0");
  expect(existsSync(policyRoot)).toBe(false);

  const mounted = await openReady(page, route({ candidate: "confirmed" }));
  expect(mounted.orbitalLookdev?.requested.samplingPolicy).toMatchObject({
    candidate: "confirmed",
    kind: "production"
  });
  const environment = await collectOrbitalEvidenceEnvironment({ page });
  expect(validateOrbitalEvidenceEnvironment(environment)).toEqual([]);
  const run = await createOrbitalStagingRun({
    captureCommand: formalCaptureCommand,
    environment,
    formalDirectory: policyRoot,
    stage: "stage-0"
  });
  expect(run).not.toBeNull();
  if (run === null) throw new Error("stage-0-staging-run-not-created");

  const causalManifest = JSON.parse(readFileSync(
    path.join(causalEvidenceRoot, "manifest.json"),
    "utf8"
  )) as {
    artifacts: readonly Readonly<{
      byteLength: number;
      path: string;
      sha256: string;
    }>[];
    cleanCommit: string;
    modes: Readonly<Record<string, number>>;
    records: readonly unknown[];
    schema: string;
  };
  const causalReview = JSON.parse(readFileSync(
    path.join(causalEvidenceRoot, "review.json"),
    "utf8"
  )) as {
    cleanCommit: string;
    frames: Parameters<typeof resolveTakramOrbitalSamplingOutcome>[0]["frames"];
    outcome: string;
    setupPass: boolean;
  };
  let verifiedArtifactCount = 0;
  for (const artifact of causalManifest.artifacts) {
    const artifactPath = path.resolve(causalEvidenceRoot, artifact.path);
    const inRoot = path.relative(causalEvidenceRoot, artifactPath);
    if (inRoot.startsWith("..") || path.isAbsolute(inRoot) ||
      !existsSync(artifactPath)) continue;
    if (statSync(artifactPath).size === artifact.byteLength &&
      await hashOrbitalFile(artifactPath) === artifact.sha256) {
      verifiedArtifactCount += 1;
    }
  }
  let commitReadable = true;
  try {
    execFileSync("git", [
      "cat-file",
      "-e",
      `${causalManifest.cleanCommit}^{commit}`
    ], { cwd: process.cwd() });
  } catch {
    commitReadable = false;
  }
  const causalEvidence = {
    artifactCount: causalManifest.artifacts.length,
    commitReadable: commitReadable &&
      causalReview.cleanCommit === causalManifest.cleanCommit,
    contractReadable: causalManifest.schema ===
      "takram-orbital-sampling-causality-manifest/v1" &&
      causalManifest.records.length > 0,
    exactStepValuesReproduced:
      causalManifest.modes.control === resolveTakramOrbitalStepScale("control") &&
      causalManifest.modes.treatment ===
        resolveTakramOrbitalStepScale("treatment"),
    outcomeReadable: causalReview.outcome ===
      "ORBITAL_SAMPLING_CAUSALITY_CONFIRMED",
    resolverReproduced: resolveTakramOrbitalSamplingOutcome({
      frames: causalReview.frames,
      setupPass: causalReview.setupPass
    }) === causalReview.outcome,
    verifiedArtifactCount
  };

  const readCausal = async (mode: "control" | "treatment") => {
    const response = await page.goto(causalRoute(mode));
    expect(response?.status()).toBe(200);
    const root = page.locator("[data-takram-parity-route='true']");
    await expect(root).toHaveAttribute("data-orbital-step-scale", mode);
    await expect(root).toHaveAttribute("data-runtime", "ready", {
      timeout: 180_000
    });
    return await page.evaluate(() => structuredClone(Reflect.get(
      window,
      "__MiraLithTakramParity"
    )) as TakramParityTelemetry);
  };
  const control = await readCausal("control");
  const treatment = await readCausal("treatment");
  const normalizeFingerprint = (telemetry: TakramParityTelemetry) => {
    const value = structuredClone(telemetry.rendererFingerprint) as any;
    delete value.clouds?.uniforms?.perspectiveStepScale;
    delete value.orbitalBaseline?.clouds?.perspectiveStepScale;
    return value;
  };
  const routeParity = {
    camera: JSON.stringify(control.cameraMatrixWorld) ===
        JSON.stringify(treatment.cameraMatrixWorld) &&
      JSON.stringify(control.earthMatrixWorld) ===
        JSON.stringify(treatment.earthMatrixWorld),
    fingerprint: JSON.stringify(normalizeFingerprint(control)) ===
      JSON.stringify(normalizeFingerprint(treatment)),
    query: control.orbitalLookdev?.requested.samplingPolicy.kind === "causal" &&
      control.orbitalLookdev.requested.samplingPolicy.mode === "control" &&
      treatment.orbitalLookdev?.requested.samplingPolicy.kind === "causal" &&
      treatment.orbitalLookdev.requested.samplingPolicy.mode === "treatment",
    runtime: control.orbitalLookdev?.drift.length === 0 &&
      treatment.orbitalLookdev?.drift.length === 0 &&
      control.orbitalLookdev?.readback.clouds.perspectiveStepScale === 1.01 &&
      treatment.orbitalLookdev?.readback.clouds.perspectiveStepScale === 1.0001
  };

  const toPolicyEnvironment = (
    value: OrbitalEvidenceEnvironment
  ): TakramOrbitalPerformanceEnvironment => ({
    acPower: value.power.source === "AC Power",
    browser: "headed-system-chrome",
    browserVersion: value.browser.chromeVersion.replace(
      /^Google Chrome /,
      "Chrome/"
    ),
    build: "production",
    chip: value.hardware.chip,
    commit: value.captureCommit,
    focused: value.browser.focused,
    gpuRenderer: value.gpu.renderer,
    gpuVendor: value.gpu.vendor,
    lowPowerMode: false,
    macOSVersion: value.macOSVersion,
    productionAssetFingerprint: `sha256:${value.build.fingerprintSha256}`,
    viewport: {
      cssHeight: value.display.innerHeight,
      cssWidth: value.display.innerWidth,
      dpr: value.display.devicePixelRatio,
      physicalHeight: value.display.canvasHeight,
      physicalWidth: value.display.canvasWidth
    } as TakramOrbitalPerformanceEnvironment["viewport"],
    visible: value.browser.visibilityState === "visible"
  });
  const productionRoute = route({ candidate: "confirmed" });
  const totalProfile = await runGpuPopulation({
    artifactPath: "stage-0/smoke-total.json",
    candidateId: "confirmed",
    committedWinnerId: "confirmed",
    expectedFeatureState: "native",
    expectedOutput: "full",
    expectedProductionStep: "confirmed",
    measurementMode: "total-only-time-elapsed",
    page,
    route: productionRoute,
    run,
    targetSampleCount: 8,
    warmupFrameCount: 8
  });
  const stageProfile = await runGpuPopulation({
    artifactPath: "stage-0/smoke-stage.json",
    candidateId: "confirmed",
    committedWinnerId: "confirmed",
    expectedFeatureState: "native",
    expectedOutput: "full",
    expectedProductionStep: "confirmed",
    measurementMode: "stage-only-sequential-time-elapsed",
    page,
    route: productionRoute,
    run,
    targetSampleCount: 8,
    warmupFrameCount: 8
  });
  const toPolicyPopulation = (
    profile: TakramOrbitalGpuProfileSnapshot,
    populationId: string
  ): TakramOrbitalGpuPolicyPopulation => ({
    invalidReasons: profile.invalidReasons,
    measurementMode: profile.measurementMode,
    p95Milliseconds: profile.p95Milliseconds,
    populationId,
    stageNames: profile.measurementMode ===
        "stage-only-sequential-time-elapsed"
      ? TAKRAM_ORBITAL_GPU_STAGE_NAMES
      : undefined,
    state: profile.state,
    targetSampleCount: profile.targetSampleCount,
    timestampBits: profile.timestampBits,
    validSampleCount: profile.validSampleCount,
    warmupFrameCount: profile.warmupFrameCount
  });
  const policyEnvironment = toPolicyEnvironment(environment);
  const resolverInputs: TakramOrbitalProductionStage0Input = {
    causalEvidence,
    environment: policyEnvironment,
    populationEnvironments: [
      "initial",
      "ranking",
      "final-winner",
      "confirmation"
    ].map((populationId) => ({
      environment: policyEnvironment,
      populationId
    })),
    routeParity,
    smoke: {
      stageOnly: toPolicyPopulation(stageProfile, "smoke-stage"),
      totalOnly: toPolicyPopulation(totalProfile, "smoke-total")
    }
  };
  const decision = resolveTakramOrbitalProductionStage0(resolverInputs);
  const checkpoint = {
    authorizedNextStage: decision.state === "ORBITAL_PRODUCTION_STAGE_1_READY"
      ? 1
      : null,
    invalidReasons: decision.invalidReasons,
    outcome: decision.state,
    stage: 0
  };
  writeRunJson(run, "resolver-inputs.json", resolverInputs);
  writeRunJson(run, "stage-0/causal-evidence.json", causalEvidence);
  writeRunJson(run, "stage-0/checkpoint.json", checkpoint);
  writeRunJson(run, "stage-0/environment.json", environment);
  writeRunJson(run, "stage-0/route-parity.json", routeParity);
  const captureManifest = await writeOrbitalArtifactManifest(run);
  const captureManifestSha256 = await hashOrbitalFile(path.join(
    run.root,
    "artifact-manifest.json"
  ));
  const currentEnvironment = await collectOrbitalEvidenceEnvironment({ page });
  await resolveAndPublishStageAtomically({
    currentEnvironment,
    expectedArtifactManifestSha256: captureManifestSha256,
    expectedContactSheetHashes: {},
    formalDirectory: policyRoot,
    publicationFiles: {
      "checkpoint.json": checkpoint,
      "manifest.json": {
        captureArtifactCount: captureManifest.artifacts.length,
        captureManifestSha256,
        evidenceCommit: environment.captureCommit,
        productionArtifactCommit: environment.build.productionArtifactCommit,
        runId: run.runId,
        schemaVersion: 1,
        stage: 0
      },
      ...(decision.state === "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED"
        ? {
            "OUTCOME.md": "# Orbital production sampling\n\n" +
              `State: ${decision.state}\n\n` +
              decision.invalidReasons.map((reason) => `- ${reason}`).join("\n") +
              "\n"
          }
        : {})
    },
    requireHumanReview: false,
    resolverInputs,
    run
  });
  expect(existsSync(path.join(policyRoot, "stage-0/checkpoint.json"))).toBe(true);
  expect(JSON.parse(readFileSync(
    path.join(policyRoot, "checkpoint.json"),
    "utf8"
  ))).toEqual(checkpoint);
});

test("route contract reaches exact native frame 32 for all production candidates", async ({
  page
}) => {
  for (const [index, candidate] of candidates.entries()) {
    const telemetry = await openReady(
      page,
      route({ candidate }),
      index === 0 ? "document" : "same-document"
    );
    expect(telemetry).toMatchObject({
      active: true,
      diagnostic: "full",
      matchedTemporalFrameCapture: {
        cloudsFrame: 32,
        frameLockPass: true,
        nativeFrameCount: 32,
        resolveFrame: 32,
        shadowFrame: 32
      },
      orbitalLookdev: {
        readback: { featureState: "native" },
        requested: {
          samplingPolicy: { candidate, kind: "production" }
        }
      },
      temporalConverged: true
    });
    expect(telemetry.lookdevSetupState).toBe("ORBITAL_LOOKDEV_RUNTIME_READY");
    expect(telemetry.orbitalLookdev?.drift).toEqual([]);
  }
});

test("remount changes every allocation for candidate feature and output identity", async ({
  page
}) => {
  const control = await openReady(page, route({ candidate: "control" }));
  const fine = await openReady(
    page,
    route({ candidate: "fine" }),
    "same-document"
  );
  verifyFreshCompleteRemount(
    control.orbitalLookdev!.readback.allocations,
    fine.orbitalLookdev!.readback.allocations
  );
  const feature = await openReady(page, route({
    candidate: "fine",
    featureState: "light-shafts-off"
  }), "same-document");
  verifyFreshCompleteRemount(
    fine.orbitalLookdev!.readback.allocations,
    feature.orbitalLookdev!.readback.allocations
  );
  const output = await openReady(page, route({
    candidate: "fine",
    featureState: "light-shafts-off",
    output: "cloud-raw"
  }), "same-document");
  verifyFreshCompleteRemount(
    feature.orbitalLookdev!.readback.allocations,
    output.orbitalLookdev!.readback.allocations
  );
});

test("diagnostic teardown restores shader source and feature-state primary evidence", async ({
  page
}) => {
  const hashes: string[] = [];
  for (const [index, featureState] of ([
    "native",
    "light-shafts-off",
    "bsm-off"
  ] as const).entries()) {
    await openReady(page, route({
      candidate: "confirmed",
      featureState,
      output: "primary-march-debug"
    }), index === 0 ? "document" : "same-document");
    const readback = await page.evaluate(() =>
      structuredClone(Reflect.get(window, "__MiraLithTakramPrimaryMarch")) as
        TakramParityPrimaryMarchReadback
    );
    expect(readback).toMatchObject({
      encoding: "rgba16f-loop-entry-cap-hit-direct",
      maxIterationCount: 500,
      origin: "bottom-left",
      precision: "half-float"
    });
    hashes.push(primaryHash(readback));
  }
  expect(new Set(hashes).size).toBe(1);

  const native = await openReady(page, route({
    candidate: "confirmed",
    featureState: "native",
    output: "full"
  }), "same-document");
  const restoration = await page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramDiagnosticRestoration") as
      Readonly<{ restored: boolean }> | undefined
  );
  expect(restoration).toMatchObject({ restored: true });
  expect(native.orbitalLookdev?.readback.renderer.lightShafts).toBe(true);
  expect(native.orbitalLookdev?.readback.layers.map(
    (layer: Readonly<{ shadow: boolean }>) => layer.shadow
  )).toEqual(native.orbitalLookdev?.requested.layers.map(
    (layer: Readonly<{ shadow: boolean }>) => layer.shadow
  ));
});

test("GPU boundaries are exact mutually exclusive submission populations", async ({
  page
}) => {
  const native = await openReady(page, route({ candidate: "confirmed" }));
  const total = await startGpuPopulation({
    candidate: "confirmed",
    featureState: "native",
    measurementMode: "total-only-time-elapsed",
    page,
    telemetry: native
  });
  expect(total).toMatchObject({
    invalidReasons: [],
    measurementMode: "total-only-time-elapsed",
    state: "complete",
    targetSampleCount: 8,
    validSampleCount: 8,
    warmupFrameCount: 8,
    warmupFramesCompleted: 8
  });
  expect(total.rawStageSamples).toEqual([]);
  expect(total.rawSamplesMilliseconds).toHaveLength(8);
  expect(total.copyOnlySamplesMilliseconds).toHaveLength(8);
  expect(total.submissionAudit.effectOrder)
    .toEqual(["CloudsEffect", "AerialPerspectiveEffect"]);
  expect(total.submissionAudit.hookSourceFnv1a64).toMatch(/^fnv1a-64:/);

  const feature = await openReady(page, route({
    candidate: "confirmed",
    featureState: "light-shafts-off"
  }), "same-document");
  const stages = await startGpuPopulation({
    candidate: "confirmed",
    featureState: "light-shafts-off",
    measurementMode: "stage-only-sequential-time-elapsed",
    page,
    telemetry: feature
  });
  expect(stages).toMatchObject({
    invalidReasons: [],
    measurementMode: "stage-only-sequential-time-elapsed",
    state: "complete",
    targetSampleCount: 8,
    validSampleCount: 8,
    warmupFrameCount: 8,
    warmupFramesCompleted: 8
  });
  expect(stages.rawSamplesMilliseconds).toHaveLength(8);
  expect(stages.rawStageSamples).toHaveLength(8);
  expect(stages.rawSamplesMilliseconds).toEqual(
    stages.rawStageSamples.map((frame) => frame.totalMilliseconds)
  );
  for (const frame of stages.rawStageSamples) {
    expect(Object.keys(frame.stages).sort()).toEqual([
      "bsm-current",
      "bsm-resolve",
      "cloud-current",
      "cloud-resolve",
      "final-effect"
    ]);
  }

  const mismatched = {
    browser: { chromeVersion: "Chromium 140", focused: false,
      visibilityState: "hidden" },
    build: { buildId: "dev", buildIdSha256: "x", fingerprintSha256: "y",
      mode: "development", productionArtifactCommit: "build" },
    captureCommit: "capture",
    display: { canvasHeight: 1920, canvasWidth: 2880,
      devicePixelRatio: 2, innerHeight: 960, innerWidth: 1440 },
    gpu: { renderer: "SwiftShader", vendor: "Google" },
    hardware: { chip: "Apple M3" },
    macOSVersion: "",
    power: { lowPowerMode: 1, source: "Battery Power" }
  } as unknown as OrbitalEvidenceEnvironment;
  expect(validateOrbitalEvidenceEnvironment(mismatched)).toEqual(
    expect.arrayContaining([
      "hardware-chip-not-apple-m4",
      "system-chrome-required",
      "angle-metal-apple-m4-renderer-required",
      "physical-canvas-size-mismatch",
      "device-pixel-ratio-mismatch",
      "page-not-visible",
      "page-not-focused",
      "ac-power-required",
      "low-power-mode-enabled",
      "production-build-required"
    ])
  );
});
