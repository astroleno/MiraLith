import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type { TakramOrbitalGpuProfileSnapshot } from
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler";
import type {
  TakramOrbitalFeatureState,
  TakramOrbitalOutput,
  TakramParityPrimaryMarchReadback,
  TakramParityTelemetry
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
import {
  validateOrbitalEvidenceEnvironment,
  verifyFreshCompleteRemount,
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
  expect(existsSync(policyRoot)).toBe(false);
  expect(existsSync(lookdevRoot)).toBe(false);
});

test.afterEach(() => {
  expect(existsSync(policyRoot)).toBe(false);
  expect(existsSync(lookdevRoot)).toBe(false);
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
