import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import sharp from "../../packages/lubirth-hero/node_modules/sharp";
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
const systemChromeExecutable = process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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
  morphologyCandidate: string | null;
  morphologyView: string | null;
  morphologyScaleAudit: {
    shapeWavelengthMeters: number;
    detailWavelengthMeters: number;
    pixelsPerMeter: { east: number; north: number; up: number };
    horizontalPixelsPerMeter: number;
    shapeProjectedPixelsByAxis: { east: number; north: number };
    detailProjectedPixelsByAxis: { east: number; north: number };
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
    targetSphericalUv: [number, number] | null;
    segmentMeters: number;
  } | null;
  nativeFrameCount: number;
  historyFirstFrameCapture: {
    height: number;
    nativeFrameCount: 1;
    width: number;
  } | null;
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
    __MiraLithTakramHistoryFirstFrame?: {
      dataUrl: string;
      height: number;
      nativeFrameCount: 1;
      width: number;
    };
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

async function decodeScreenshot(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  };
}

async function captureMorphologyFrame(
  page: import("@playwright/test").Page,
  diagnostic: string
) {
  if (diagnostic !== "history-reset-first") {
    return page.screenshot({ scale: "css" });
  }
  const capture = await page.evaluate(() => window.__MiraLithTakramHistoryFirstFrame);
  expect(capture).toMatchObject({
    height: 960,
    nativeFrameCount: 1,
    width: 1440
  });
  expect(capture?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  return Buffer.from(capture!.dataUrl.split(",")[1]!, "base64");
}

test("morphology baseline reproduces all fixed views and diagnostics", async ({ page }) => {
  const records: Array<{
    view: string;
    diagnostic: string;
    screenshotSha256: string;
    telemetry: MorphologyTelemetry;
  }> = [];
  let gpu: {
    vendor: string;
    renderer: string;
    unmaskedVendor: string | null;
    unmaskedRenderer: string | null;
  } | null = null;

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
      if (gpu === null) {
        gpu = await page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const gl = canvas?.getContext("webgl2");
          if (!gl) return null;
          const debug = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            vendor: String(gl.getParameter(gl.VENDOR)),
            renderer: String(gl.getParameter(gl.RENDERER)),
            unmaskedVendor: debug
              ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL))
              : null,
            unmaskedRenderer: debug
              ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
              : null
          };
        });
      }
      const screenshotBuffer = await captureMorphologyFrame(page, diagnostic);
      const screenshotSha256 = createHash("sha256").update(screenshotBuffer).digest("hex");
      if (shouldCapture) {
        mkdirSync(captureDirectory, { recursive: true });
        writeFileSync(
          path.join(captureDirectory, `${morphologyView}-${diagnostic}.png`),
          screenshotBuffer
        );
      }
      records.push({
        view: morphologyView,
        diagnostic,
        screenshotSha256,
        telemetry: telemetry!
      });
    }
  }

  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(
    path.join(evidenceDirectory, "baseline.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      generatedAt: new Date().toISOString(),
      browserExecutable: systemChromeExecutable,
      gpu,
      reproductionCommand: "MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE=1 pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts tests/e2e/lubirth-takram-v3-morphology.spec.ts --project=desktop-system-chrome --grep 'morphology baseline'",
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
    expect(audit.originScreenPixels).not.toBeNull();
    expect(audit.targetSphericalUv).toEqual([0.076494140625, 0.73053515625]);
    expect(audit.originScreenPixels![0]).toBeGreaterThanOrEqual(0);
    expect(audit.originScreenPixels![0]).toBeLessThanOrEqual(1440);
    expect(audit.originScreenPixels![1]).toBeGreaterThanOrEqual(0);
    expect(audit.originScreenPixels![1]).toBeLessThanOrEqual(960);
    if (morphologyView !== "opening-orbit") {
      expect(audit.originScreenPixels![0]).toBeCloseTo(720, 3);
      expect(audit.originScreenPixels![1]).toBeCloseTo(480, 3);
    }
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
  const morphologyContract = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract"
  );
  const morphologyMetrics = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyMetrics"
  );
  const candidates = Object.keys(
    morphologyContract.TAKRAM_V3_MORPHOLOGY_HORIZONTAL_CANDIDATES
  );
  const atlasDiagnostics = [
    "full",
    "cloud-raw",
    "cloud-raw-off",
    "history-reset-first",
    "aerial-final",
    "sample-count-debug"
  ] as const;
  const persistedAtlasDiagnostics = [
    ...atlasDiagnostics
  ] as const;
  const atlas: Array<{
    candidate: string;
    view: string;
    diagnostic: typeof atlasDiagnostics[number];
    screenshotSha256: string;
    telemetry: MorphologyTelemetry;
  }> = [];
  const screenshots = new Map<string, Awaited<ReturnType<typeof decodeScreenshot>>>();
  for (const candidate of candidates) {
    for (const morphologyView of reviewViews) {
      for (const diagnostic of atlasDiagnostics) {
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
        const screenshotBuffer = await captureMorphologyFrame(page, diagnostic);
        const screenshotSha256 = createHash("sha256").update(screenshotBuffer).digest("hex");
        screenshots.set(
          `${candidate}:${morphologyView}:${diagnostic}`,
          await decodeScreenshot(screenshotBuffer)
        );
        if (shouldCapture && (persistedAtlasDiagnostics as readonly string[]).includes(diagnostic)) {
          mkdirSync(captureDirectory, { recursive: true });
          writeFileSync(
            path.join(captureDirectory, `${candidate}-${morphologyView}-${diagnostic}.png`),
            screenshotBuffer
          );
        }
        atlas.push({
          candidate,
          view: morphologyView,
          diagnostic,
          screenshotSha256,
          telemetry: telemetry!
        });
      }
    }
  }
  const imageMetricRecords = candidates.flatMap((candidate) =>
    reviewViews.map((view) => {
      const frames = Object.fromEntries(atlasDiagnostics.map((diagnostic) => [
        diagnostic,
        screenshots.get(`${candidate}:${view}:${diagnostic}`)
      ])) as Record<typeof atlasDiagnostics[number],
        Awaited<ReturnType<typeof decodeScreenshot>> | undefined>;
      expect(frames.full).toBeDefined();
      expect(frames["cloud-raw"]).toBeDefined();
      expect(frames["cloud-raw-off"]).toBeDefined();
      expect(frames["history-reset-first"]).toBeDefined();
      expect(frames["aerial-final"]).toBeDefined();
      const decoded = frames.full!;
      for (const frame of [
        frames["cloud-raw"]!,
        frames["cloud-raw-off"]!,
        frames["history-reset-first"]!,
        frames["aerial-final"]!
      ]) {
        expect(frame.width).toBe(decoded.width);
        expect(frame.height).toBe(decoded.height);
      }
      const metrics = morphologyMetrics.analyzeTakramV3MorphologyImageMetrics({
        width: decoded.width,
        height: decoded.height,
        cloudRaw: frames["cloud-raw"]!.pixels,
        cloudRawOff: frames["cloud-raw-off"]!.pixels,
        cloudOff: frames["aerial-final"]!.pixels,
        firstFrame: frames["history-reset-first"]!.pixels,
        convergedFull: decoded.pixels
      });
      return {
        candidate,
        view,
        metrics,
        classification: morphologyMetrics.classifyTakramV3MorphologyImageMetrics(metrics)
      };
    })
  );
  const nearViews = reviewViews.filter((view) => view !== "opening-orbit");
  const axisEligibleCandidates = candidates.filter((candidate) => nearViews.every((view) => {
    const audit = atlas.find((record) =>
      record.candidate === candidate && record.view === view && record.diagnostic === "full"
    )?.telemetry.morphologyScaleAudit;
    return audit !== undefined && audit !== null &&
      Object.values(audit.shapeProjectedPixelsByAxis).every((pixels) =>
        pixels >= 16 && pixels <= 48
      ) && Object.values(audit.detailProjectedPixelsByAxis).every((pixels) =>
        pixels >= 3 && pixels <= 10
      );
  }));
  const passingCandidates = axisEligibleCandidates.filter((candidate) => nearViews.every((view) =>
    imageMetricRecords.find((record) =>
      record.candidate === candidate && record.view === view
    )?.classification.pass === true
  ));
  const checkpoint = morphologyContract.resolveTakramV3HorizontalMorphologyCheckpoint({
    audits: nearViews.map((view) => {
      const audit = atlas.find((record) =>
        record.view === view && record.diagnostic === "full"
      )?.telemetry.morphologyScaleAudit;
      return {
        view,
        pixelsPerMeter: {
          east: audit?.pixelsPerMeter.east ?? Number.NaN,
          north: audit?.pixelsPerMeter.north ?? Number.NaN
        },
        originScreenPixels: audit?.originScreenPixels ?? null,
        viewport: { width: 1440, height: 960 }
      };
    }),
    metricCandidateCount: candidates.length,
    passingMetricCandidateCount: passingCandidates.length
  });
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
        metricThresholds: morphologyMetrics.TAKRAM_V3_MORPHOLOGY_METRIC_THRESHOLDS,
        persistedDiagnostics: persistedAtlasDiagnostics,
        replayViews: reviewViews
      },
      generatedCandidates: morphologyContract.buildTakramV3MorphologyCandidates(
        reviewViews.map((view) => ({
          view,
          pixelsPerMeter: {
            east: atlas.find((record) =>
              record.view === view && record.diagnostic === "full"
            )?.telemetry.morphologyScaleAudit?.pixelsPerMeter.east ?? Number.NaN,
            north: atlas.find((record) =>
              record.view === view && record.diagnostic === "full"
            )?.telemetry.morphologyScaleAudit?.pixelsPerMeter.north ?? Number.NaN
          }
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
        screenshotSha256: atlas.find((record) =>
          record.candidate === candidate && record.view === view && record.diagnostic === diagnostic
        )?.screenshotSha256,
        cameraHeightMeters: telemetry.cameraHeightMeters,
        morphologyScaleAudit: telemetry.morphologyScaleAudit,
        rendererFingerprintHash: telemetry.rendererFingerprintHash
      })),
      imageMetricRecords,
      axisEligibleCandidates,
      passingCandidates,
      commonRepeatIntervals: {
        shape: morphologyContract.resolveTakramV3MorphologyCommonRepeatInterval(
          reviewViews.filter((view) => view !== "opening-orbit").map((view) => ({
            view,
            pixelsPerMeter: {
              east: atlas.find((record) =>
                record.view === view && record.diagnostic === "full"
              )?.telemetry.morphologyScaleAudit?.pixelsPerMeter.east ?? Number.NaN,
              north: atlas.find((record) =>
                record.view === view && record.diagnostic === "full"
              )?.telemetry.morphologyScaleAudit?.pixelsPerMeter.north ?? Number.NaN
            }
          })),
          "shape"
        ),
        detail: morphologyContract.resolveTakramV3MorphologyCommonRepeatInterval(
          reviewViews.filter((view) => view !== "opening-orbit").map((view) => ({
            view,
            pixelsPerMeter: {
              east: atlas.find((record) =>
                record.view === view && record.diagnostic === "full"
              )?.telemetry.morphologyScaleAudit?.pixelsPerMeter.east ?? Number.NaN,
              north: atlas.find((record) =>
                record.view === view && record.diagnostic === "full"
              )?.telemetry.morphologyScaleAudit?.pixelsPerMeter.north ?? Number.NaN
            }
          })),
          "detail"
        )
      },
      checkpoint: {
        ...checkpoint,
        nearViews: ["near-oblique", "aerial-oblique", "near-orbit"],
        task4Unlocked: false,
        task5Unlocked: false,
        task6Unlocked: false,
        task0pLocked: true
      }
    }, null, 2)}\n`
  );
});
