import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import sharp from "../../packages/lubirth-hero/node_modules/sharp";
import { mapOpeningProgress } from "../../packages/visual-core/src/theatre/openingTimeline";
import { writeTakramV3FormalEvidence } from "../helpers/takramV3MorphologyEvidence";

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
const openingEvidenceDirectory = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-opening-morphology"
);
const openingCaptureDirectory = path.join(openingEvidenceDirectory, "captures");
const shouldCapture = process.env.MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE === "1";
const systemChromeExecutable = process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

type MorphologyTelemetry = {
  active: boolean;
  adapter: {
    cloudLayers: Array<{
      altitude: number;
      channel: "r" | "g" | "b" | "a";
      coverageFilterWidth: number;
      densityScale: number;
      height: number;
      shadow: boolean;
      shapeAmount: number;
      shapeDetailAmount: number;
      weatherExponent: number;
    }>;
    disableDefaultLayers: boolean;
    globalWeatherMapping: boolean;
    localWeatherHash: string | null;
    localWeatherOffset: [number, number] | null;
    localWeatherRepeat: [number, number] | null;
    localWeatherSource: "stock" | "v3" | null;
  };
  assetGeneration: number;
  assetsReady: boolean;
  atmosphereGeneration: number;
  atmosphereReady: boolean;
  cameraHeightMeters: number | null;
  cameraMatrixWorld: number[];
  coordinateMode: "lubirth-bridge" | "upstream-ecef";
  coverage: number | null;
  diagnostic: string;
  diagnosticApplied: boolean;
  diagnosticState: {
    cloudOff: boolean;
    aerialPerspectiveComposite: boolean;
    beerShadowOcclusion: boolean;
    cloudRawOutput: boolean;
    sampleCountDebug: boolean;
  };
  ecefSunDirection: [number, number, number] | null;
  input: "stock" | "v3";
  morphologyCandidate: string | null;
  morphologyView: string | null;
  morphologyScaleAudit: {
    shapeWavelengthMeters: number;
    detailWavelengthMeters: number;
    pixelsPerMeter: { east: number; north: number; up: number };
    horizontalPixelsPerMeter: number;
    horizontalProjectionJacobian: {
      east: [number, number];
      north: [number, number];
      singularValues: {
        major: number;
        minor: number;
        conditionNumber: number;
      };
    };
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
  sampleCountReadback: {
    width: number;
    height: number;
    precision: "half-float" | "unorm8";
    source: "native-cloud-current-render-target-v1";
    origin: "bottom-left";
    encoding: "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask";
    values: number[];
  } | null;
  nativeFrameCount: number;
  progress: number;
  historyFirstFrameCapture: {
    height: number;
    nativeFrameCount: 1;
    width: number;
  } | null;
  matchedTemporalFrameCapture: {
    height: number;
    nativeFrameCount: number;
    width: number;
    cloudsFrame: number;
    resolveFrame: number;
    shadowFrame: number;
    temporalJitterIndex: number;
    stbnSliceIndex: number;
    historyEpochHash: string;
    frameLockPass: boolean;
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
    __MiraLithTakramMatchedTemporalFrame?: NonNullable<
      MorphologyTelemetry["matchedTemporalFrameCapture"]
    > & { dataUrl: string };
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

async function encodeCloudOnlyMask(mask: Uint8Array, width: number, height: number) {
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < mask.length; index += 1) {
    const value = mask[index] === 1 ? 255 : 0;
    const offset = index * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  return sharp(pixels, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();
}

function encodeNativeSampleCountReadback(
  readback: NonNullable<MorphologyTelemetry["sampleCountReadback"]>
) {
  const buffer = Buffer.allocUnsafe(readback.width * readback.height * 4 * 2);
  const scales = [500, 5, 5, 1] as const;
  for (let index = 0; index < readback.values.length; index += 1) {
    const channel = index % 4;
    const count = Math.max(0, Math.min(65_535,
      Math.round((readback.values[index] ?? 0) * scales[channel]!)));
    buffer.writeUInt16LE(count, index * 2);
  }
  return gzipSync(buffer, { level: 9 });
}

async function captureMorphologyFrame(
  page: import("@playwright/test").Page,
  diagnostic: string
) {
  if (diagnostic !== "history-reset-first") {
    const capture = await page.evaluate(() => window.__MiraLithTakramMatchedTemporalFrame);
    expect(capture).toMatchObject({
      height: 960,
      nativeFrameCount: 32,
      width: 1440,
      cloudsFrame: 32,
      resolveFrame: 32,
      shadowFrame: 32,
      temporalJitterIndex: 0,
      frameLockPass: true
    });
    expect(capture?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    return Buffer.from(capture!.dataUrl.split(",")[1]!, "base64");
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

async function buildOpeningContactSheet(input: {
  candidates: readonly string[];
  diagnostic: string;
  frames: ReadonlyMap<string, Buffer>;
  progresses: readonly number[];
}) {
  const cellWidth = 360;
  const imageHeight = 240;
  const labelHeight = 32;
  const cellHeight = imageHeight + labelHeight;
  const composites: Array<sharp.OverlayOptions> = [];
  for (const [row, candidate] of input.candidates.entries()) {
    for (const [column, progress] of input.progresses.entries()) {
      const frame = input.frames.get(`${candidate}:${progress}:${input.diagnostic}`);
      expect(frame).toBeDefined();
      const left = column * cellWidth;
      const top = row * cellHeight;
      composites.push({
        input: await sharp(frame).resize(cellWidth, imageHeight, { fit: "fill" }).png().toBuffer(),
        left,
        top
      });
      composites.push({
        input: Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#10131a"/><text x="8" y="21" fill="#f4f6fa" font-family="monospace" font-size="13">${candidate} · p=${progress.toFixed(2)}</text></svg>`),
        left,
        top: top + imageHeight
      });
    }
  }
  return sharp({
    create: {
      width: cellWidth * input.progresses.length,
      height: cellHeight * input.candidates.length,
      channels: 4,
      background: "#10131a"
    }
  }).composite(composites).png().toBuffer();
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

  writeTakramV3FormalEvidence(shouldCapture, () => {
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

test("native sample-count diagnostic preserves accumulated count ordering", async ({ page }) => {
  await page.goto(
    "/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=sample-count-debug&morphologyView=opening-orbit&morphologyCandidate=opening-shape-260-detail-40"
  );
  await waitForNativeMorphology(page);
  const readback = await page.evaluate(() =>
    window.__MiraLithTakramParity?.sampleCountReadback ?? null
  );
  expect(readback).toMatchObject({
    width: 360,
    height: 240,
    precision: "half-float",
    source: "native-cloud-current-render-target-v1",
    origin: "bottom-left",
    encoding: "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask"
  });
  let nonZeroPrimaryPixelCount = 0;
  let nativeHitPixelCount = 0;
  let invariantViolationCount = 0;
  for (let offset = 0; offset < readback!.values.length; offset += 4) {
    const primary = Math.round((readback!.values[offset] ?? 0) * 500);
    const shape = Math.round((readback!.values[offset + 1] ?? 0) * 5);
    const detail = Math.round((readback!.values[offset + 2] ?? 0) * 5);
    const nativeHit = (readback!.values[offset + 3] ?? 0) >= 0.5;
    if (primary > 0) nonZeroPrimaryPixelCount += 1;
    if (nativeHit) nativeHitPixelCount += 1;
    if (primary < shape || shape < detail) invariantViolationCount += 1;
  }
  expect(nonZeroPrimaryPixelCount).toBeGreaterThan(0);
  expect(nativeHitPixelCount).toBeGreaterThan(0);
  expect(invariantViolationCount).toBe(0);
});

test("in-place morphology changes recapture exact native frame one", async ({ page }) => {
  const route = page.locator("[data-takram-parity-route='true']");
  await page.goto(
    "/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=history-reset-first&morphologyView=near-oblique&morphologyCandidate=baseline"
  );
  await waitForNativeMorphology(page);
  const baselineCapture = await page.evaluate(() => window.__MiraLithTakramHistoryFirstFrame);
  expect(baselineCapture).toMatchObject({ nativeFrameCount: 1 });

  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set(
      "morphologyCandidate",
      "horizontal-near-oblique-shape-32-detail-4"
    );
    window.history.pushState({}, "", url);
  });
  await expect(route).toHaveAttribute(
    "data-morphology-candidate",
    "horizontal-near-oblique-shape-32-detail-4"
  );
  await expect.poll(
    () => page.evaluate(() => ({
      active: window.__MiraLithTakramParity?.active,
      candidate: window.__MiraLithTakramParity?.morphologyCandidate,
      nativeFrameCount: window.__MiraLithTakramParity?.historyFirstFrameCapture?.nativeFrameCount
    })),
    { timeout: 180_000 }
  ).toEqual({
    active: true,
    candidate: "horizontal-near-oblique-shape-32-detail-4",
    nativeFrameCount: 1
  });
  const candidateCapture = await page.evaluate(() => window.__MiraLithTakramHistoryFirstFrame);
  expect(candidateCapture).toMatchObject({ nativeFrameCount: 1 });

  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("morphologyView", "aerial-oblique");
    window.history.pushState({}, "", url);
  });
  await expect(route).toHaveAttribute("data-morphology-view", "aerial-oblique");
  await expect.poll(
    () => page.evaluate(() => ({
      active: window.__MiraLithTakramParity?.active,
      candidate: window.__MiraLithTakramParity?.morphologyCandidate,
      nativeFrameCount: window.__MiraLithTakramParity?.historyFirstFrameCapture?.nativeFrameCount,
      view: window.__MiraLithTakramParity?.morphologyView
    })),
    { timeout: 180_000 }
  ).toEqual({
    active: true,
    candidate: "horizontal-near-oblique-shape-32-detail-4",
    nativeFrameCount: 1,
    view: "aerial-oblique"
  });
  const viewCapture = await page.evaluate(() => window.__MiraLithTakramHistoryFirstFrame);
  expect(viewCapture).toMatchObject({ nativeFrameCount: 1 });
  expect(candidateCapture?.dataUrl).not.toBe(baselineCapture?.dataUrl);
  expect(viewCapture?.dataUrl).not.toBe(candidateCapture?.dataUrl);
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
    expect(audit.horizontalProjectionJacobian.singularValues.major).toBeGreaterThan(0);
    expect(audit.horizontalProjectionJacobian.singularValues.minor).toBeGreaterThan(0);
    expect(audit.horizontalProjectionJacobian.singularValues.conditionNumber).toBeGreaterThanOrEqual(1);
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

  writeTakramV3FormalEvidence(shouldCapture, () => {
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
});

test("opening-only morphology matrix covers every production review frame", async ({ page }) => {
  const morphologyContract = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract"
  );
  const morphologyMetrics = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyMetrics"
  );
  const candidates = Object.keys(
    morphologyContract.TAKRAM_V3_OPENING_MORPHOLOGY_CANDIDATES
  );
  const progresses = morphologyContract.TAKRAM_V3_OPENING_MORPHOLOGY_PROGRESS_VALUES;
  const openingDiagnostics = morphologyContract.TAKRAM_V3_OPENING_MORPHOLOGY_DIAGNOSTICS;
  const frames = new Map<string, Buffer>();
  const comparisonFrames = new Map<string, {
    cloudMask: Uint8Array;
    cloudRaw: Uint8Array;
    full: Uint8Array;
    width: number;
    height: number;
  }>();
  const stageIsolationRecords: Array<{
    candidateId: string;
    progress: number;
    cloudMaskPath: string;
    cloudMaskSha256: string;
    metrics: ReturnType<typeof morphologyMetrics.analyzeTakramV3OpeningStageIsolation>["metrics"];
    nativeSampleCount: {
      artifact: {
        path: string;
        sha256: string;
            compression: "gzip";
            scalar: "uint16-le";
            channels: readonly ["primary", "shape", "detail", "hit"];
            origin: "bottom-left";
      };
      metrics: ReturnType<typeof morphologyMetrics.analyzeTakramV3NativeSampleCountReadback>;
    };
    runtimeContract: {
      adapter: MorphologyTelemetry["adapter"];
      assetGeneration: number;
      atmosphereGeneration: number;
      ecefSunDirection: [number, number, number] | null;
      rendererFingerprintHash: string | null;
      shapeRepeat: number | null;
      shapeDetailRepeat: number | null;
    };
  }> = [];
  let gpu: {
    vendor: string;
    renderer: string;
    unmaskedVendor: string | null;
    unmaskedRenderer: string | null;
  } | null = null;
  const records: Array<{
    candidateId: string;
    progress: number;
    diagnostic: typeof openingDiagnostics[number];
    screenshotSha256: string;
    telemetry: MorphologyTelemetry;
  }> = [];

  for (const candidateId of candidates) {
    const candidate = morphologyContract.resolveTakramV3MorphologyCandidate(candidateId);
    expect(candidate).not.toBeNull();
    for (const progress of progresses) {
      const decodedFrames = new Map<
        (typeof openingDiagnostics)[number],
        Awaited<ReturnType<typeof decodeScreenshot>>
      >();
      let fullTelemetry: MorphologyTelemetry | null = null;
      let nativeSampleCountReadback: NonNullable<MorphologyTelemetry["sampleCountReadback"]> | null = null;
      for (const diagnostic of openingDiagnostics) {
        await page.goto(
          `/lubirth-takram-parity-spike?input=v3&view=opening&progress=${progress}&diagnostic=${diagnostic}&morphologyView=opening-orbit&morphologyCandidate=${candidateId}`
        );
        await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
          "data-morphology-candidate",
          candidateId
        );
        await waitForNativeMorphology(page);
        const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
        expect(telemetry).toMatchObject({
          active: true,
          coverage: 0.55,
          diagnostic,
          input: "v3",
          morphologyCandidate: candidateId,
          morphologyView: "opening-orbit",
          progress,
          transformFallback: null,
          view: "opening"
        });
        expect(telemetry?.cameraHeightMeters).toBeGreaterThan(3_000_000);
        expect(telemetry?.shapeRepeat).toBeCloseTo(candidate!.shapeRepeat, 12);
        expect(telemetry?.shapeDetailRepeat).toBeCloseTo(candidate!.shapeDetailRepeat, 12);
        expect(telemetry?.adapter.cloudLayers).toHaveLength(4);
        expect(telemetry?.adapter.localWeatherHash).not.toBeNull();
        expect(telemetry?.adapter.localWeatherRepeat).not.toBeNull();
        expect(telemetry?.adapter.localWeatherOffset).not.toBeNull();
        expect(telemetry?.ecefSunDirection).toHaveLength(3);
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
        const screenshot = await captureMorphologyFrame(page, diagnostic);
        frames.set(`${candidateId}:${progress}:${diagnostic}`, screenshot);
        decodedFrames.set(diagnostic, await decodeScreenshot(screenshot));
        if (diagnostic === "full") fullTelemetry = telemetry!;
        if (diagnostic === "sample-count-debug") {
          expect(telemetry?.sampleCountReadback).toMatchObject({
            precision: "half-float",
            source: "native-cloud-current-render-target-v1",
            origin: "bottom-left",
            encoding: "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask"
          });
          nativeSampleCountReadback = telemetry!.sampleCountReadback;
        }
        if (shouldCapture) {
          mkdirSync(openingCaptureDirectory, { recursive: true });
          writeFileSync(
            path.join(
              openingCaptureDirectory,
              `${candidateId}-p${progress.toFixed(2).replace(".", "-")}-${diagnostic}.png`
            ),
            screenshot
          );
        }
        records.push({
          candidateId,
          progress,
          diagnostic,
          screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
          telemetry: telemetry!
        });
      }
      const requireFrame = (diagnostic: (typeof openingDiagnostics)[number]) => {
        const frame = decodedFrames.get(diagnostic);
        expect(frame).toBeDefined();
        return frame!;
      };
      const full = requireFrame("full");
      const cloudRaw = requireFrame("cloud-raw");
      const cloudRawOff = requireFrame("cloud-raw-off");
      const bsmOff = requireFrame("bsm-off");
      const aerialFinal = requireFrame("aerial-final");
      const sampleCountDebug = requireFrame("sample-count-debug");
      for (const frame of [cloudRaw, cloudRawOff, bsmOff, aerialFinal, sampleCountDebug]) {
        expect(frame.width).toBe(full.width);
        expect(frame.height).toBe(full.height);
      }
      expect(fullTelemetry).not.toBeNull();
      const stageIsolation = morphologyMetrics.analyzeTakramV3OpeningStageIsolation({
        width: full.width,
        height: full.height,
        cloudRaw: cloudRaw.pixels,
        cloudRawOff: cloudRawOff.pixels,
        full: full.pixels,
        aerialFinal: aerialFinal.pixels,
        bsmOff: bsmOff.pixels
      });
      const cloudMask = await encodeCloudOnlyMask(
        stageIsolation.cloudMask,
        full.width,
        full.height
      );
      const progressLabel = progress.toFixed(2).replace(".", "-");
      const cloudMaskName = `${candidateId}-p${progressLabel}-cloud-only-mask.png`;
      frames.set(`${candidateId}:${progress}:cloud-only-mask`, cloudMask);
      if (shouldCapture) {
        writeFileSync(path.join(openingCaptureDirectory, cloudMaskName), cloudMask);
      }
      expect(nativeSampleCountReadback).not.toBeNull();
      const nativeSampleCountMetrics = morphologyMetrics.analyzeTakramV3NativeSampleCountReadback({
        cloudMask: stageIsolation.cloudMask,
        cloudMaskWidth: full.width,
        cloudMaskHeight: full.height,
        readback: {
          ...nativeSampleCountReadback!,
          values: nativeSampleCountReadback!.values
        }
      });
      expect(nativeSampleCountMetrics.nativeHitPixelCount).toBeGreaterThan(0);
      expect(nativeSampleCountMetrics.invariantPass).toBe(true);
      const nativeSampleCountArtifact = encodeNativeSampleCountReadback(
        nativeSampleCountReadback!
      );
      const nativeSampleCountName =
        `${candidateId}-p${progressLabel}-native-sample-count-rgba-u16le.gz`;
      if (shouldCapture) {
        writeFileSync(
          path.join(openingCaptureDirectory, nativeSampleCountName),
          nativeSampleCountArtifact
        );
      }
      comparisonFrames.set(`${candidateId}:${progress}`, {
        cloudMask: stageIsolation.cloudMask,
        cloudRaw: cloudRaw.pixels,
        full: full.pixels,
        width: full.width,
        height: full.height
      });
      stageIsolationRecords.push({
        candidateId,
        progress,
        cloudMaskPath: `captures/${cloudMaskName}`,
        cloudMaskSha256: createHash("sha256").update(cloudMask).digest("hex"),
        metrics: stageIsolation.metrics,
        nativeSampleCount: {
          artifact: {
            path: `captures/${nativeSampleCountName}`,
            sha256: createHash("sha256").update(nativeSampleCountArtifact).digest("hex"),
            compression: "gzip",
            scalar: "uint16-le",
            channels: ["primary", "shape", "detail", "hit"],
            origin: "bottom-left"
          },
          metrics: nativeSampleCountMetrics
        },
        runtimeContract: {
          adapter: fullTelemetry!.adapter,
          assetGeneration: fullTelemetry!.assetGeneration,
          atmosphereGeneration: fullTelemetry!.atmosphereGeneration,
          ecefSunDirection: fullTelemetry!.ecefSunDirection,
          rendererFingerprintHash: fullTelemetry!.rendererFingerprintHash,
          shapeRepeat: fullTelemetry!.shapeRepeat,
          shapeDetailRepeat: fullTelemetry!.shapeDetailRepeat
        }
      });
    }
  }

  const referenceCandidateId = candidates[0]!;
  const candidateDifferenceRecords: Array<{
    candidateId: string;
    referenceCandidateId: string;
    progress: number;
    rawDifference: ReturnType<typeof morphologyMetrics.analyzeTakramV3MaskedFrameDifference>;
    fullDifference: ReturnType<typeof morphologyMetrics.analyzeTakramV3MaskedFrameDifference>;
  }> = [];
  for (const progress of progresses) {
    const reference = comparisonFrames.get(`${referenceCandidateId}:${progress}`)!;
    for (const candidateId of candidates) {
      const candidateFrame = comparisonFrames.get(`${candidateId}:${progress}`)!;
      expect(candidateFrame.width).toBe(reference.width);
      expect(candidateFrame.height).toBe(reference.height);
      const unionMask = reference.cloudMask.map((value, index) =>
        value === 1 || candidateFrame.cloudMask[index] === 1 ? 1 : 0
      );
      candidateDifferenceRecords.push({
        candidateId,
        referenceCandidateId,
        progress,
        rawDifference: morphologyMetrics.analyzeTakramV3MaskedFrameDifference({
          width: reference.width,
          height: reference.height,
          mask: unionMask,
          left: reference.cloudRaw,
          right: candidateFrame.cloudRaw
        }),
        fullDifference: morphologyMetrics.analyzeTakramV3MaskedFrameDifference({
          width: reference.width,
          height: reference.height,
          mask: unionMask,
          left: reference.full,
          right: candidateFrame.full
        })
      });
    }
  }
  const scaleQualification = candidates.map((candidateId) => {
    const fullRecords = records.filter((record) =>
      record.candidateId === candidateId && record.diagnostic === "full"
    );
    return {
      candidateId,
      shapeTargetReachedAtEveryProgress: fullRecords.every((record) =>
        record.telemetry.morphologyScaleAudit?.shapeStatus === "target"
      ),
      detailTargetReachedAtEveryProgress: fullRecords.every((record) =>
        record.telemetry.morphologyScaleAudit?.detailStatus === "target"
      ),
      detailStatuses: Array.from(new Set(fullRecords.map((record) =>
        record.telemetry.morphologyScaleAudit?.detailStatus ?? "missing"
      )))
    };
  });
  const frozenAdapter = JSON.stringify(stageIsolationRecords[0]!.runtimeContract.adapter);
  expect(stageIsolationRecords.every((record) =>
    JSON.stringify(record.runtimeContract.adapter) === frozenAdapter
  )).toBe(true);
  expect(stageIsolationRecords.every((record) =>
    record.runtimeContract.adapter.localWeatherHash ===
      stageIsolationRecords[0]!.runtimeContract.adapter.localWeatherHash
  )).toBe(true);
  expect(records.every(({ telemetry }) =>
    telemetry.matchedTemporalFrameCapture?.nativeFrameCount === 32 &&
    telemetry.matchedTemporalFrameCapture.cloudsFrame === 32 &&
    telemetry.matchedTemporalFrameCapture.resolveFrame === 32 &&
    telemetry.matchedTemporalFrameCapture.shadowFrame === 32 &&
    telemetry.matchedTemporalFrameCapture.temporalJitterIndex === 0 &&
    telemetry.matchedTemporalFrameCapture.frameLockPass
  )).toBe(true);

  const repeatCandidateId = "opening-shape-260-detail-40";
  const repeatProgress = 0.06;
  const repeatMask = comparisonFrames.get(`${repeatCandidateId}:${repeatProgress}`)?.cloudMask;
  expect(repeatMask).toBeDefined();
  const temporalRepeatNoiseFloor: Array<{
    candidateId: string;
    progress: number;
    diagnostic: "full" | "cloud-raw" | "bsm-off";
    repeatIndex: number;
    screenshotSha256: string;
    difference: ReturnType<typeof morphologyMetrics.analyzeTakramV3MaskedFrameDifference>;
    temporalFrame: NonNullable<MorphologyTelemetry["matchedTemporalFrameCapture"]>;
  }> = [];
  for (const diagnostic of ["full", "cloud-raw", "bsm-off"] as const) {
    const referenceBuffer = frames.get(`${repeatCandidateId}:${repeatProgress}:${diagnostic}`);
    expect(referenceBuffer).toBeDefined();
    const referenceFrame = await decodeScreenshot(referenceBuffer!);
    for (const repeatIndex of [1, 2]) {
      await page.goto(
        `/lubirth-takram-parity-spike?input=v3&view=opening&progress=${repeatProgress}&diagnostic=${diagnostic}&morphologyView=opening-orbit&morphologyCandidate=${repeatCandidateId}`
      );
      await waitForNativeMorphology(page);
      const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
      const repeatBuffer = await captureMorphologyFrame(page, diagnostic);
      const repeatFrame = await decodeScreenshot(repeatBuffer);
      const screenshotSha256 = createHash("sha256").update(repeatBuffer).digest("hex");
      if (shouldCapture) {
        writeFileSync(
          path.join(
            openingCaptureDirectory,
            `${repeatCandidateId}-p0-06-${diagnostic}-repeat-${repeatIndex}.png`
          ),
          repeatBuffer
        );
      }
      temporalRepeatNoiseFloor.push({
        candidateId: repeatCandidateId,
        progress: repeatProgress,
        diagnostic,
        repeatIndex,
        screenshotSha256,
        difference: morphologyMetrics.analyzeTakramV3MaskedFrameDifference({
          width: referenceFrame.width,
          height: referenceFrame.height,
          mask: repeatMask!,
          left: referenceFrame.pixels,
          right: repeatFrame.pixels
        }),
        temporalFrame: telemetry!.matchedTemporalFrameCapture!
      });
    }
  }
  expect(temporalRepeatNoiseFloor.every(({ temporalFrame }) =>
    temporalFrame.nativeFrameCount === 32 &&
    temporalFrame.cloudsFrame === 32 &&
    temporalFrame.resolveFrame === 32 &&
    temporalFrame.shadowFrame === 32 &&
    temporalFrame.temporalJitterIndex === 0 &&
    temporalFrame.frameLockPass
  )).toBe(true);

  const checkpointRecords = candidates.flatMap((candidateId) =>
    progresses.map((progress) => ({
      candidateId,
      progress,
      diagnostics: records.filter((record) =>
        record.candidateId === candidateId && record.progress === progress
      ).map((record) => record.diagnostic)
    }))
  );
  const checkpoint = morphologyContract.resolveTakramV3HorizontalMorphologyCheckpoint({
    candidateIds: candidates,
    records: checkpointRecords,
    visualDecisions: null
  });
  expect(checkpoint).toEqual({
    id: "OPENING_MORPHOLOGY_VISUAL_REVIEW_REQUIRED",
    task3Unlocked: false,
    winnerCandidateId: null
  });

  writeTakramV3FormalEvidence(shouldCapture, () => {
    mkdirSync(openingEvidenceDirectory, { recursive: true });
  });
  const contactSheets: Record<string, { path: string; sha256: string }> = {};
  const contactSheetDiagnostics = [
    ...openingDiagnostics,
    "cloud-only-mask"
  ] as const;
  for (const diagnostic of contactSheetDiagnostics) {
    const contactSheet = await buildOpeningContactSheet({
      candidates,
      diagnostic,
      frames,
      progresses
    });
    const contactSheetName = `${diagnostic}-contact-sheet.png`;
    if (shouldCapture) {
      writeFileSync(path.join(openingEvidenceDirectory, contactSheetName), contactSheet);
    }
    contactSheets[diagnostic] = {
      path: contactSheetName,
      sha256: createHash("sha256").update(contactSheet).digest("hex")
    };
  }
  writeTakramV3FormalEvidence(shouldCapture, () => writeFileSync(
    path.join(openingEvidenceDirectory, "candidate-matrix.json"),
    `${JSON.stringify({
      schemaVersion: 4,
      baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      generatedAt: new Date().toISOString(),
      scope: "opening-only-production-contract",
      nearViewsRole: "diagnostic-only",
      browserExecutable: systemChromeExecutable,
      browserVersion: execFileSync(systemChromeExecutable, ["--version"], {
        encoding: "utf8"
      }).trim(),
      gpu,
      reproductionCommand: "MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE=1 pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts tests/e2e/lubirth-takram-v3-morphology.spec.ts --project=desktop-system-chrome --grep 'opening-only morphology matrix'",
      fixedContract: {
        coverage: 0.55,
        progresses,
        diagnostics: openingDiagnostics,
        derivedDiagnostics: [
          "cloud-only-mask",
          "native-sample-count-rgba-u16le"
        ],
        orbitalVisualGates: morphologyContract.TAKRAM_V3_OPENING_ORBITAL_VISUAL_GATES,
        viewport: { width: 1440, height: 960, dpr: 1 },
        renderer: "stock-takram-0.7.6",
        weather: "v3"
      },
      candidates: candidates.map((candidateId) => {
        const candidate = morphologyContract.resolveTakramV3MorphologyCandidate(candidateId)!;
        return {
          id: candidateId,
          shapeWavelengthMeters: candidate.shapeWavelengthMeters,
          detailWavelengthMeters: candidate.detailWavelengthMeters,
          shapeRepeat: candidate.shapeRepeat,
          shapeDetailRepeat: candidate.shapeDetailRepeat
        };
      }),
      records: records.map(({ candidateId, progress, diagnostic, screenshotSha256, telemetry }) => ({
        candidateId,
        progress,
        diagnostic,
        screenshotSha256,
        cameraHeightMeters: telemetry.cameraHeightMeters,
        diagnosticState: telemetry.diagnosticState,
        rendererFingerprintHash: telemetry.rendererFingerprintHash,
        morphologyScaleAudit: telemetry.morphologyScaleAudit,
        matchedTemporalFrameCapture: telemetry.matchedTemporalFrameCapture
      })),
      scaleQualification,
      stageIsolationRecords,
      temporalPairing: {
        targetNativeFrame: 32,
        targetTemporalJitterIndex: 0,
        allSourceFramesLocked: true,
        repeatNoiseFloor: temporalRepeatNoiseFloor
      },
      candidateDifferenceRecords,
      contactSheets,
      checkpoint
    }, null, 2)}\n`
  ));
});

test("near morphology remains diagnostic-only", async ({ page }) => {
  const morphologyContract = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract"
  );
  const morphologyMetrics = await import(
    "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyMetrics"
  );
  const preflightRecords: Array<{
    view: typeof reviewViews[number];
    screenshotSha256: string;
    telemetry: MorphologyTelemetry;
  }> = [];
  for (const morphologyView of reviewViews) {
    await page.goto(
      `/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=full&morphologyView=${morphologyView}&morphologyCandidate=baseline`
    );
    await waitForNativeMorphology(page);
    const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
    expect(telemetry?.morphologyScaleAudit).not.toBeNull();
    const screenshot = await page.screenshot({ scale: "css" });
    preflightRecords.push({
      view: morphologyView,
      screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
      telemetry: telemetry!
    });
  }
  const projectionInputs = preflightRecords.map(({ view, telemetry }) => ({
    view,
    pixelsPerMeter: {
      east: telemetry.morphologyScaleAudit?.pixelsPerMeter.east ?? Number.NaN,
      north: telemetry.morphologyScaleAudit?.pixelsPerMeter.north ?? Number.NaN
    },
    projectionConditionNumber:
      telemetry.morphologyScaleAudit?.horizontalProjectionJacobian.singularValues.conditionNumber ??
      Number.NaN
  }));
  const preflightCheckpoint = morphologyContract.resolveTakramV3NearMorphologyDiagnosticCheckpoint({
    audits: preflightRecords
      .filter(({ view }) => view !== "opening-orbit")
      .map(({ view, telemetry }) => ({
        view,
        pixelsPerMeter: {
          east: telemetry.morphologyScaleAudit?.pixelsPerMeter.east ?? Number.NaN,
          north: telemetry.morphologyScaleAudit?.pixelsPerMeter.north ?? Number.NaN
        },
        projectionConditionNumber:
          telemetry.morphologyScaleAudit?.horizontalProjectionJacobian.singularValues.conditionNumber ??
          Number.NaN,
        originScreenPixels: telemetry.morphologyScaleAudit?.originScreenPixels ?? null,
        viewport: { width: 1440, height: 960 }
      })),
    metricCandidateCount: 0,
    passingMetricCandidateCount: 0
  });
  if (preflightCheckpoint.id === "VIEW_SPACE_ACCEPTANCE_CONTRACT_FAIL") {
    const candidateResolution = morphologyContract.buildTakramV3MorphologyCandidateResolution(
      projectionInputs
    );
    writeTakramV3FormalEvidence(shouldCapture, () => {
      mkdirSync(evidenceDirectory, { recursive: true });
      writeFileSync(
      path.join(evidenceDirectory, "near-diagnostic.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        generatedAt: new Date().toISOString(),
        status: "STOPPED_BEFORE_CANDIDATE_REPLAY",
        reason: "VIEW_SPACE_ACCEPTANCE_CONTRACT_FAIL",
        interpretation: {
          axisMagnitudes: "diagnostic-only",
          conditionNumberThreshold:
            morphologyContract.TAKRAM_V3_MAX_VIEW_SPACE_CONDITION_NUMBER,
          anisotropicEnuAuthorization: false,
          historicalCandidateCaptures: "not-used-by-current-checkpoint"
        },
        fixedContract: {
          coverage: 0.55,
          weather: "v3",
          renderer: "stock-takram-0.7.6",
          replayViews: reviewViews
        },
        preflightRecords: preflightRecords.map(({ view, screenshotSha256, telemetry }) => ({
          view,
          screenshotSha256,
          cameraHeightMeters: telemetry.cameraHeightMeters,
          morphologyScaleAudit: telemetry.morphologyScaleAudit,
          rendererFingerprintHash: telemetry.rendererFingerprintHash
        })),
        candidateResolution,
        commonRepeatIntervals: {
          role: "diagnostic-only-until-view-space-contract-is-replaced",
          shape: morphologyContract.resolveTakramV3MorphologyCommonRepeatInterval(
            projectionInputs.filter(({ view }) => view !== "opening-orbit"),
            "shape"
          ),
          detail: morphologyContract.resolveTakramV3MorphologyCommonRepeatInterval(
            projectionInputs.filter(({ view }) => view !== "opening-orbit"),
            "detail"
          )
        },
        connectedAreaSemantics: {
          maximumDominance: "diagnostic-only",
          minimumConnectedMass: "fragmentation-gate"
        },
        checkpoint: {
          ...preflightCheckpoint,
          task4Unlocked: false,
          task5Unlocked: false,
          task6Unlocked: false,
          task0pLocked: true
        }
      }, null, 2)}\n`
      );
    });
    expect(candidateResolution.generatedCandidates.every((candidate) =>
      candidate.axisRangePass && candidate.physicalRangePass
    )).toBe(true);
    return;
  }
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
  const checkpoint = morphologyContract.resolveTakramV3NearMorphologyDiagnosticCheckpoint({
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
        projectionConditionNumber:
          audit?.horizontalProjectionJacobian.singularValues.conditionNumber ?? Number.NaN,
        originScreenPixels: audit?.originScreenPixels ?? null,
        viewport: { width: 1440, height: 960 }
      };
    }),
    metricCandidateCount: candidates.length,
    passingMetricCandidateCount: passingCandidates.length
  });
  writeTakramV3FormalEvidence(shouldCapture, () => {
    mkdirSync(evidenceDirectory, { recursive: true });
    writeFileSync(
    path.join(evidenceDirectory, "near-diagnostic.json"),
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
          },
          projectionConditionNumber: atlas.find((record) =>
            record.view === view && record.diagnostic === "full"
          )?.telemetry.morphologyScaleAudit?.horizontalProjectionJacobian.singularValues.conditionNumber ??
            Number.NaN
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
            },
            projectionConditionNumber: atlas.find((record) =>
              record.view === view && record.diagnostic === "full"
            )?.telemetry.morphologyScaleAudit?.horizontalProjectionJacobian.singularValues.conditionNumber ??
              Number.NaN
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
            },
            projectionConditionNumber: atlas.find((record) =>
              record.view === view && record.diagnostic === "full"
            )?.telemetry.morphologyScaleAudit?.horizontalProjectionJacobian.singularValues.conditionNumber ??
              Number.NaN
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
});
