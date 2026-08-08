import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { mapOpeningProgress } from "../../packages/visual-core/src/theatre/openingTimeline";

test.setTimeout(900_000);

const reviewViews = [
  "near-oblique",
  "aerial-oblique",
  "near-orbit",
  "opening-orbit"
] as const;
const diagnostics = [
  "full",
  "cloud-raw",
  "history-reset-first",
  "bsm-off",
  "aerial-final",
  "sample-count-debug"
] as const;
const evidenceDirectory = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology"
);
const captureDirectory = path.join(evidenceDirectory, "captures");
const shouldCapture = process.env.MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE === "1";

type MorphologyTelemetry = {
  active: boolean;
  adapter: {
    localWeatherHash: string | null;
    localWeatherOffset: [number, number] | null;
    localWeatherRepeat: [number, number] | null;
    localWeatherSource: "stock" | "v3" | null;
  };
  assetsReady: boolean;
  atmosphereReady: boolean;
  cameraHeightMeters: number | null;
  cameraMatrixWorld: number[];
  coordinateMode: "lubirth-bridge" | "upstream-ecef";
  diagnostic: string;
  diagnosticApplied: boolean;
  input: "stock" | "v3";
  morphologyCandidate:
    | "baseline"
    | "horizontal-orbit-shape-16-detail-4"
    | "horizontal-orbit-shape-32-detail-4"
    | null;
  morphologyView: string | null;
  morphologyScaleAudit: {
    shapeWavelengthMeters: number;
    detailWavelengthMeters: number;
    pixelsPerMeter: { east: number; north: number; up: number };
    horizontalPixelsPerMeter: number;
    shapeProjectedPixels: number;
    detailProjectedPixels: number;
    shapeStatus: string;
    detailStatus: string;
    layers: Array<{
      channel: "r" | "g" | "b" | "a";
      altitude: number;
      height: number;
      topAltitude: number;
      projectedThicknessPixels: number;
      status: string;
    }>;
    originScreenPixels: [number, number] | null;
    segmentMeters: number;
  } | null;
  nativeFrameCount: number;
  rendererFingerprint: Record<string, unknown> | null;
  rendererFingerprintHash: string | null;
  sceneDepthContract: "world-depth-to-ecef-v1";
  sceneDepthScale: number;
  shapeRepeat: number | null;
  shapeDetailRepeat: number | null;
  temporalConverged: boolean;
  transformFallback: string | null;
  earthMatrixWorld: number[];
  view: "opening";
};

declare global {
  interface Window {
    __MiraLithTakramParity?: MorphologyTelemetry;
  }
}

function resolveOpeningMatrices(progress: number) {
  const openingFrame = mapOpeningProgress(progress);
  const earthMatrixWorld = new Matrix4().compose(
    new Vector3(openingFrame.earthX, openingFrame.earthY, 0),
    new Quaternion().setFromEuler(new Euler(
      openingFrame.earthPitchDeg * Math.PI / 180,
      openingFrame.earthYawDeg * Math.PI / 180,
      0,
      "YXZ"
    )),
    new Vector3().setScalar(openingFrame.earthScale)
  );
  const camera = new PerspectiveCamera(45, 1440 / 960, 0.01, 100);
  camera.up.set(0, 1, 0);
  camera.position.set(
    Math.sin(openingFrame.cameraAzimuth) * openingFrame.cameraDistance,
    Math.sin(openingFrame.cameraElevation) * openingFrame.cameraDistance,
    Math.cos(openingFrame.cameraAzimuth) * openingFrame.cameraDistance
  );
  camera.lookAt(0, openingFrame.cameraLookAtY, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return {
    cameraMatrixWorld: camera.matrixWorld.toArray(),
    earthMatrixWorld: earthMatrixWorld.toArray()
  };
}

function expectMatrixCloseTo(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index]!, 6);
  });
}

async function waitForNativeMorphology(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(
    () => page.evaluate(() => window.__MiraLithTakramParity?.active ?? false),
    { timeout: 180_000 }
  ).toBe(true);
  await expect(page.locator("[data-visual-fallback]")).toHaveCount(0);
}

test("morphology baseline reproduces all fixed views and diagnostics", async ({ page }) => {
  const records: Array<{
    view: string;
    diagnostic: string;
    telemetry: MorphologyTelemetry;
  }> = [];

  for (const morphologyView of reviewViews) {
    for (const diagnostic of diagnostics) {
      await page.goto(
        `/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=${diagnostic}&morphologyView=${morphologyView}&morphologyCandidate=baseline`
      );
      await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
        "data-morphology-view",
        morphologyView
      );
      await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
        "data-morphology-candidate",
        "baseline"
      );
      await waitForNativeMorphology(page);
      const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
      expect(telemetry).not.toBeUndefined();
      expect(telemetry).toMatchObject({
        active: true,
        assetsReady: true,
        atmosphereReady: true,
        coordinateMode: "lubirth-bridge",
        diagnostic,
        diagnosticApplied: true,
        input: "v3",
        morphologyCandidate: "baseline",
        morphologyView,
        nativeFrameCount: expect.any(Number),
        sceneDepthContract: "world-depth-to-ecef-v1",
        shapeRepeat: 0.000025,
        shapeDetailRepeat: 0.0006,
        transformFallback: null,
        view: "opening"
      });
      expect(telemetry?.cameraHeightMeters).toBeGreaterThan(0);
      if (morphologyView === "opening-orbit") {
        const expected = resolveOpeningMatrices(0.06);
        expectMatrixCloseTo(telemetry!.cameraMatrixWorld, expected.cameraMatrixWorld);
        expectMatrixCloseTo(telemetry!.earthMatrixWorld, expected.earthMatrixWorld);
      } else {
        expect(telemetry?.earthMatrixWorld).toEqual([
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ]);
      }
      if (shouldCapture) {
        mkdirSync(captureDirectory, { recursive: true });
        await page.screenshot({
          path: path.join(captureDirectory, `${morphologyView}-${diagnostic}.png`),
          scale: "css"
        });
      }
      records.push({ view: morphologyView, diagnostic, telemetry: telemetry! });
    }
  }

  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    path.join(evidenceDirectory, "baseline.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      generatedAt: new Date().toISOString(),
      viewport: { width: 1440, height: 960, dpr: 1 },
      route: {
        input: "v3",
        progress: 0.06,
        candidate: "baseline",
        diagnostics,
        views: reviewViews,
        fixedRenderer: "stock-takram-0.7.6"
      },
      records
    }, null, 2)}\n`
  );
});

test("morphology candidate query is V3-only and fails closed for stock", async ({ page }) => {
  await page.goto(
    "/lubirth-takram-parity-spike?input=stock&view=opening&progress=0.06&morphologyView=near-oblique&morphologyCandidate=baseline"
  );
  await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
    "data-runtime",
    "invalid-query"
  );
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("scale audit reports projected shape, detail and layer thickness", async ({ page }) => {
  const records: Array<{ view: string; telemetry: MorphologyTelemetry }> = [];
  for (const morphologyView of reviewViews) {
    await page.goto(
      `/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=full&morphologyView=${morphologyView}&morphologyCandidate=baseline`
    );
    await waitForNativeMorphology(page);
    const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
    expect(telemetry?.morphologyScaleAudit).not.toBeNull();
    const audit = telemetry!.morphologyScaleAudit!;
    expect(audit.shapeWavelengthMeters).toBe(40_000);
    expect(audit.detailWavelengthMeters).toBeCloseTo(1_666.6666666667, 6);
    expect(audit.segmentMeters).toBe(1_000);
    expect(audit.pixelsPerMeter.east).toBeGreaterThan(0);
    expect(audit.pixelsPerMeter.north).toBeGreaterThan(0);
    expect(audit.pixelsPerMeter.up).toBeGreaterThan(0);
    expect(audit.shapeProjectedPixels).toBeGreaterThan(0);
    expect(audit.detailProjectedPixels).toBeGreaterThan(0);
    expect(audit.layers).toHaveLength(4);
    records.push({ view: morphologyView, telemetry: telemetry! });
  }

  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    path.join(evidenceDirectory, "scale-audit.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      generatedAt: new Date().toISOString(),
      candidate: {
        id: "baseline",
        coverage: 0.55,
        shapeRepeat: 0.000025,
        shapeDetailRepeat: 0.0006
      },
      records: records.map(({ view, telemetry }) => ({
        view,
        cameraHeightMeters: telemetry.cameraHeightMeters,
        cameraMatrixWorld: telemetry.cameraMatrixWorld,
        earthMatrixWorld: telemetry.earthMatrixWorld,
        rendererFingerprintHash: telemetry.rendererFingerprintHash,
        morphologyScaleAudit: telemetry.morphologyScaleAudit
      }))
    }, null, 2)}\n`
  );
});

test("horizontal morphology atlas replays each candidate across all views", async ({ page }) => {
  const candidates = [
    "horizontal-orbit-shape-16-detail-4",
    "horizontal-orbit-shape-32-detail-4"
  ] as const;
  const atlas: Array<{
    candidate: string;
    view: string;
    diagnostic: "full" | "cloud-raw" | "sample-count-debug";
    telemetry: MorphologyTelemetry;
  }> = [];
  const morphologyContract = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract"
  );
  for (const candidate of candidates) {
    for (const morphologyView of reviewViews) {
      for (const diagnostic of ["full", "cloud-raw", "sample-count-debug"] as const) {
        await page.goto(
          `/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=${diagnostic}&morphologyView=${morphologyView}&morphologyCandidate=${candidate}`
        );
        await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
          "data-morphology-candidate",
          candidate
        );
        await waitForNativeMorphology(page);
        const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
        expect(telemetry).toMatchObject({
          active: true,
          coverage: 0.55,
          diagnostic,
          input: "v3",
          morphologyCandidate: candidate,
          morphologyView,
          transformFallback: null,
          view: "opening"
        });
        expect(telemetry?.shapeRepeat).toBeGreaterThan(0);
        expect(telemetry?.shapeDetailRepeat).toBeGreaterThan(0);
        expect(telemetry?.morphologyScaleAudit?.shapeWavelengthMeters).toBeGreaterThan(0);
        if (shouldCapture) {
          mkdirSync(captureDirectory, { recursive: true });
          await page.screenshot({
            path: path.join(captureDirectory, `${candidate}-${morphologyView}-${diagnostic}.png`),
            scale: "css"
          });
        }
        atlas.push({ candidate, view: morphologyView, diagnostic, telemetry: telemetry! });
      }
    }
  }
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    path.join(evidenceDirectory, "candidate-matrix.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      generatedAt: new Date().toISOString(),
      fixedContract: {
        coverage: 0.55,
        weather: "v3",
        renderer: "stock-takram-0.7.6",
        candidateCount: candidates.length,
        replayViews: reviewViews
      },
      generatedCandidates: morphologyContract.buildTakramV3MorphologyCandidates(
        reviewViews.map((view) => ({
          view,
          horizontalPixelsPerMeter: atlas.find((record) =>
            record.view === view && record.diagnostic === "full"
          )?.telemetry.morphologyScaleAudit?.horizontalPixelsPerMeter ?? Number.NaN
        }))
      ),
      candidates: candidates.map((candidate) => ({
        id: candidate,
        shapeRepeat: atlas.find((record) => record.candidate === candidate)?.telemetry.shapeRepeat,
        shapeDetailRepeat: atlas.find((record) => record.candidate === candidate)?.telemetry.shapeDetailRepeat
      })),
      records: atlas.map(({ candidate, view, diagnostic, telemetry }) => ({
        candidate,
        view,
        diagnostic,
        cameraHeightMeters: telemetry.cameraHeightMeters,
        morphologyScaleAudit: telemetry.morphologyScaleAudit,
        rendererFingerprintHash: telemetry.rendererFingerprintHash
      })),
      checkpoint: {
        id: "HORIZONTAL_MORPHOLOGY_SCALE_FAIL",
        nearViews: ["near-oblique", "aerial-oblique", "near-orbit"],
        reason: "No single repeat pair reaches both shape 16-48 px and detail 3-10 px in all three near views while remaining inside each view's physical wavelength range.",
        task3Unlocked: false,
        task4Unlocked: false,
        task5Unlocked: false,
        task6Unlocked: false,
        task0pLocked: true
      }
    }, null, 2)}\n`
  );
});
