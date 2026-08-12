import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "../../packages/lubirth-hero/node_modules/sharp";
import { writeTakramCloudScaleEvidenceAtomically } from "../helpers/takramCloudScaleEvidence";

test.setTimeout(900_000);

type Scale = 80 | 120 | 160;
type CoverageMode = "parity" | "presentation";
type StockWeatherMode = "unscaled" | "similarity";
const captureEnabled = process.env.MIRALITH_TAKRAM_CLOUD_SCALE_CAPTURE === "1";
const evidenceDirectory = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale"
);
const stageA1EvidenceDirectory = path.join(
  evidenceDirectory,
  "stage-a1-scaled-weather"
);

interface ScaleTelemetry {
  active: boolean;
  adapter: {
    cloudLayers: Array<{
      altitude: number;
      channel: "r" | "g" | "b" | "a";
      densityScale: number;
      height: number;
      shadow: boolean;
    }>;
    disableDefaultLayers: boolean;
    globalWeatherMapping: boolean;
    localWeatherHash: string | null;
    localWeatherOffset: [number, number] | null;
    localWeatherRepeat: [number, number] | null;
    localWeatherSource: "stock" | "v3" | null;
  };
  cloudScale: {
    atmosphereDomain: {
      atmosphereHeight: number;
      layersExceedingAtmosphere: Array<"r" | "g" | "b" | "a">;
      physicalAerialPerspectiveParityClaim: false;
      presentationDomain: "artistic-orbital";
    };
    drift: Array<{ actual: unknown; expected: unknown; path: string }>;
    readback: Record<string, any>;
    requested: Record<string, any>;
    stockWeatherControl: {
      classification: string;
      mode: StockWeatherMode;
      repeat: [number, number];
      scale: Scale;
      sourceRepeat: [100, 100];
    } | null;
  } | null;
  coverage: number | null;
  historyEpochHash: string;
  historyFirstFrameCapture: {
    nativeFrameCount: 1;
  } | null;
  input: "stock" | "v3";
  nativeFrameCount: number;
  presentationPreset: string;
  progress: number;
  rendererFingerprint: Record<string, any> | null;
  rendererFingerprintHash: string | null;
  shapeDetailRepeat: number | null;
  shapeRepeat: number | null;
}

function query(
  input: "stock" | "v3",
  scale: Scale,
  coverageMode: CoverageMode,
  progress = 0.06,
  stockWeatherMode?: StockWeatherMode
) {
  return `/lubirth-takram-parity-spike?input=${input}&view=opening&progress=${progress}` +
    `&cloudScale=${scale}&cloudCoverage=${coverageMode}` +
    (stockWeatherMode === undefined ? "" : `&stockWeather=${stockWeatherMode}`);
}

async function readTelemetry(page: Page): Promise<ScaleTelemetry | undefined> {
  return page.evaluate(() => Reflect.get(window, "__MiraLithTakramParity"));
}

async function openScaleCandidate(
  page: Page,
  input: "stock" | "v3",
  scale: Scale,
  coverageMode: CoverageMode,
  diagnostic = "full",
  progress = 0.06,
  stockWeatherMode?: StockWeatherMode
) {
  const response = await page.goto(
    `${query(input, scale, coverageMode, progress, stockWeatherMode)}&diagnostic=${diagnostic}`
  );
  expect(response?.status()).toBe(200);
  const root = page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute("data-cloud-scale", String(scale));
  await expect(root).toHaveAttribute("data-cloud-coverage", coverageMode);
  await expect(root).toHaveAttribute(
    "data-stock-weather",
    input === "stock" ? stockWeatherMode ?? "unscaled" : "none"
  );
  await expect(root).toHaveAttribute("data-runtime", "ready", { timeout: 120_000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  const telemetry = await readTelemetry(page);
  expect(telemetry).toBeDefined();
  return telemetry!;
}

async function readExactMatchedFrame(page: Page) {
  const capture = await page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramMatchedTemporalFrame")
  ) as {
    cloudsFrame: number;
    dataUrl: string;
    frameLockPass: boolean;
    height: number;
    historyEpochHash: string;
    nativeFrameCount: number;
    resolveFrame: number;
    shadowFrame: number;
    stbnSliceIndex: number;
    temporalJitterIndex: number;
    width: number;
  } | undefined;
  expect(capture).toMatchObject({
    cloudsFrame: 32,
    frameLockPass: true,
    nativeFrameCount: 32,
    resolveFrame: 32,
    shadowFrame: 32
  });
  expect(capture?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  return {
    buffer: Buffer.from(capture!.dataUrl.split(",")[1]!, "base64"),
    metadata: {
      cloudsFrame: capture!.cloudsFrame,
      frameLockPass: capture!.frameLockPass,
      height: capture!.height,
      historyEpochHash: capture!.historyEpochHash,
      nativeFrameCount: capture!.nativeFrameCount,
      resolveFrame: capture!.resolveFrame,
      shadowFrame: capture!.shadowFrame,
      stbnSliceIndex: capture!.stbnSliceIndex,
      temporalJitterIndex: capture!.temporalJitterIndex,
      width: capture!.width
    }
  };
}

async function buildStockContactSheet(
  frames: ReadonlyMap<string, Buffer>,
  scales: readonly Scale[],
  progresses: readonly number[],
  label = "stock"
) {
  const cellWidth = 360;
  const imageHeight = 240;
  const labelHeight = 32;
  const composites: Array<sharp.OverlayOptions> = [];
  for (const [row, scale] of scales.entries()) {
    for (const [column, progress] of progresses.entries()) {
      const frame = frames.get(`${scale}:${progress}`);
      expect(frame).toBeDefined();
      const left = column * cellWidth;
      const top = row * (imageHeight + labelHeight);
      composites.push({
        input: await sharp(frame).resize(cellWidth, imageHeight, { fit: "fill" }).png().toBuffer(),
        left,
        top
      });
      composites.push({
        input: Buffer.from(
          `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">` +
          `<rect width="100%" height="100%" fill="#10131a"/>` +
          `<text x="8" y="21" fill="#f4f6fa" font-family="monospace" font-size="13">` +
          `${label} · S=${scale} · p=${progress.toFixed(2)}</text></svg>`
        ),
        left,
        top: top + imageHeight
      });
    }
  }
  return sharp({
    create: {
      background: "#10131a",
      channels: 4,
      height: (imageHeight + labelHeight) * scales.length,
      width: cellWidth * progresses.length
    }
  }).composite(composites).png().toBuffer();
}

test("rejects invalid and conflicting cloud-scale route contracts", async ({ page }) => {
  const invalidQueries = [
    "input=stock&view=control&cloudScale=80&cloudCoverage=parity",
    "input=stock&view=opening&cloudScale=81&cloudCoverage=parity",
    "input=stock&view=opening&cloudScale=80",
    "input=stock&view=opening&cloudCoverage=parity",
    "input=stock&view=opening&cloudScale=80&cloudCoverage=legacy",
    "input=v3&view=opening&cloudScale=80&cloudCoverage=parity&morphologyView=opening-orbit",
    "input=v3&view=opening&cloudScale=80&cloudCoverage=parity&stockWeather=similarity",
    "input=stock&view=opening&stockWeather=similarity",
    "input=stock&view=opening&cloudScale=80&cloudCoverage=parity&stockWeather=scaled"
  ];

  for (const invalidQuery of invalidQueries) {
    const response = await page.goto(`/lubirth-takram-parity-spike?${invalidQuery}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-takram-parity-route='true']"))
      .toHaveAttribute("data-runtime", "invalid-query");
    await expect(page.locator("canvas")).toHaveCount(0);
  }
});

test("applies the same explicit official renderer contract to stock and V3", async ({ page }) => {
  const overflowByScale: Record<Scale, string[]> = {
    80: ["g"],
    120: ["r", "g", "b"],
    160: ["r", "g", "b"]
  };

  for (const scale of [80, 120, 160] as const) {
    for (const coverageMode of ["parity", "presentation"] as const) {
      const stock = await openScaleCandidate(page, "stock", scale, coverageMode);
      const v3 = await openScaleCandidate(page, "v3", scale, coverageMode);
      const expectedCoverage = coverageMode === "parity" ? 0.3 : 0.55;

      for (const telemetry of [stock, v3]) {
        expect(telemetry).toMatchObject({
          active: true,
          cloudScale: {
            atmosphereDomain: {
              atmosphereHeight: 60_000,
              layersExceedingAtmosphere: overflowByScale[scale],
              physicalAerialPerspectiveParityClaim: false,
              presentationDomain: "artistic-orbital"
            },
            drift: [],
            requested: {
              classification: "PUBLIC_PARAMETER_SIMILARITY",
              coverage: expectedCoverage,
              coverageMode,
              mipDistancePatch: { active: false, scale: 1 },
              scale
            }
          },
          coverage: expectedCoverage,
          presentationPreset: "cloud-scale-similarity",
          rendererFingerprint: {
            schemaVersion: 5
          },
          shapeDetailRepeat: 0.006 / scale,
          shapeRepeat: 0.0003 / scale
        });
        expect(telemetry.adapter.disableDefaultLayers).toBe(true);
        expect(telemetry.adapter.cloudLayers).toHaveLength(4);
        expect(telemetry.adapter.cloudLayers.map((layer) => layer.channel))
          .toEqual(["r", "g", "b", "a"]);
        expect(telemetry.adapter.cloudLayers[3]).toMatchObject({
          altitude: 0,
          channel: "a",
          height: 0,
          shadow: false
        });
        expect(telemetry.cloudScale?.readback.layers)
          .toEqual(telemetry.cloudScale?.requested.layers);
        expect(telemetry.cloudScale?.readback.mipDistancePatch).toMatchObject({
          active: false,
          classification: "native-hardcoded",
          nativeCoefficientOccurrences: 1,
          patchedCoefficientOccurrences: 0,
          scale: 1,
          auditedArtifacts: {
            installedBuildSharedSha256: "c2115702324e01760429187faf6203c2a118812c508429edbebe37e2e1d7c018",
            installedCloudsFragmentSha256: "b29eeac1f5edc205cc578edf2a711aa2ffc8b50e1ea835e8b1abb50de68b77ff",
            packagePatchSha256: "2bfa2dd78d4e9ac82c82eddba1273f9d2f95e932b7021584ce840f497b4f745c"
          }
        });
        expect(telemetry.cloudScale?.readback.mipDistancePatch.runtimeFragmentShaderFnv1a64)
          .toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
        expect(telemetry.rendererFingerprint?.cloudScale)
          .toEqual(telemetry.cloudScale?.readback);
      }

      expect(stock.cloudScale?.readback).toEqual(v3.cloudScale?.readback);
      expect(stock.adapter.cloudLayers).toEqual(v3.adapter.cloudLayers);
      expect(stock.rendererFingerprint).toEqual(v3.rendererFingerprint);
      expect(stock.rendererFingerprintHash).toBe(v3.rendererFingerprintHash);
      expect(stock.adapter).toMatchObject({
        disableDefaultLayers: true,
        globalWeatherMapping: false,
        localWeatherOffset: [0, 0],
        localWeatherRepeat: [100, 100],
        localWeatherSource: "stock"
      });
      expect(stock.cloudScale?.stockWeatherControl).toEqual({
        classification: "UNSCALED_STOCK_WEATHER_CONTROL",
        mode: "unscaled",
        repeat: [100, 100],
        scale,
        sourceRepeat: [100, 100]
      });
      expect(v3.cloudScale?.stockWeatherControl).toBeNull();
      expect(v3.adapter).toMatchObject({
        disableDefaultLayers: true,
        globalWeatherMapping: true,
        localWeatherOffset: [-0.045, 0.018],
        localWeatherRepeat: [1, 1],
        localWeatherSource: "v3"
      });
    }
  }
});

test("scales the stock weather repeat without changing the renderer fingerprint", async ({
  page
}) => {
  for (const scale of [80, 120, 160] as const) {
    const unscaled = await openScaleCandidate(
      page, "stock", scale, "parity", "full", 0.06, "unscaled"
    );
    const similarity = await openScaleCandidate(
      page, "stock", scale, "parity", "full", 0.06, "similarity"
    );

    expect(similarity.adapter.localWeatherRepeat).toEqual([100 / scale, 100 / scale]);
    expect(similarity.cloudScale?.stockWeatherControl).toEqual({
      classification: "SCALED_STOCK_WEATHER_CONTROL",
      mode: "similarity",
      repeat: [100 / scale, 100 / scale],
      scale,
      sourceRepeat: [100, 100]
    });
    expect(similarity.rendererFingerprintHash).toBe(unscaled.rendererFingerprintHash);
    expect(similarity.historyEpochHash).not.toBe(unscaled.historyEpochHash);
  }
});

test("Stage A0 captures the unscaled stock-weather historical control", async ({
  browser,
  page
}) => {
  test.skip(!captureEnabled, "formal evidence requires explicit capture mode");
  const scales = [80, 120, 160] as const;
  const progresses = [0, 0.06, 0.12, 0.18] as const;
  const frames = new Map<string, Buffer>();
  const records: Array<Record<string, unknown>> = [];
  let gpu: Record<string, string | null> | null = null;

  for (const scale of scales) {
    for (const progress of progresses) {
      const telemetry = await openScaleCandidate(
        page,
        "stock",
        scale,
        "parity",
        "full",
        progress
      );
      expect(telemetry.cloudScale?.drift).toEqual([]);
      expect(telemetry.rendererFingerprintHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
      const capture = await readExactMatchedFrame(page);
      const fileName = `stage-a-stock-s${scale}-p${Math.round(progress * 100)
        .toString().padStart(3, "0")}-full.png`;
      const screenshotSha256 = createHash("sha256")
        .update(capture.buffer)
        .digest("hex");
      frames.set(`${scale}:${progress}`, capture.buffer);
      records.push({
        capture: capture.metadata,
        file: `captures/${fileName}`,
        input: "stock",
        progress,
        query: query("stock", scale, "parity", progress),
        rendererFingerprintHash: telemetry.rendererFingerprintHash,
        screenshotSha256,
        telemetry
      });

      if (gpu === null) {
        gpu = await page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const gl = canvas?.getContext("webgl2");
          if (!gl) return null;
          const debug = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            renderer: String(gl.getParameter(gl.RENDERER)),
            unmaskedRenderer: debug
              ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
              : null,
            unmaskedVendor: debug
              ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL))
              : null,
            vendor: String(gl.getParameter(gl.VENDOR))
          };
        });
      }
    }
  }

  const contactSheet = await buildStockContactSheet(frames, scales, progresses);
  const contactSheetSha256 = createHash("sha256").update(contactSheet).digest("hex");
  const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8"
  }).trim();
  const viewport = page.viewportSize();
  const manifest = {
    baseCommit,
    browser: {
      executable: process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      version: browser.version()
    },
    captureCommand:
      "MIRALITH_TAKRAM_CLOUD_SCALE_CAPTURE=1 pnpm exec playwright test " +
      "-c playwright.takram-parity-system-chrome.config.ts " +
      "lubirth-takram-cloud-scale.spec.ts --headed --grep \"Stage A0\"",
    candidateContract: {
      classification: "UNSCALED_STOCK_WEATHER_CONTROL",
      coverageMode: "parity",
      coverage: 0.3,
      input: "stock",
      mipDistancePatchActive: false,
      localWeatherRepeat: [100, 100],
      progresses,
      scales
    },
    contactSheet: {
      path: "stage-a-stock-contact-sheet.png",
      sha256: contactSheetSha256
    },
    generatedAt: new Date().toISOString(),
    gpu,
    records,
    schemaVersion: 1,
    viewport: {
      deviceScaleFactor: 1,
      height: viewport?.height ?? null,
      width: viewport?.width ?? null
    }
  };

  await writeTakramCloudScaleEvidenceAtomically({
    build: async (stagingDirectory) => {
      const captureDirectory = path.join(stagingDirectory, "captures");
      mkdirSync(captureDirectory, { recursive: true });
      for (const record of records) {
        const fileName = path.basename(String(record.file));
        const scale = Number((record.telemetry as ScaleTelemetry).cloudScale?.requested.scale);
        const progress = Number(record.progress);
        writeFileSync(
          path.join(captureDirectory, fileName),
          frames.get(`${scale}:${progress}`)!
        );
      }
      writeFileSync(path.join(stagingDirectory, "stage-a-stock-contact-sheet.png"), contactSheet);
      writeFileSync(
        path.join(stagingDirectory, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`
      );
      writeFileSync(
        path.join(stagingDirectory, "checkpoint.json"),
        `${JSON.stringify({
          conditionalTaskMEligible: false,
          decision: "UNSCALED_STOCK_WEATHER_CONTROL",
          mipDistancePatchAuthorized: false,
          originalTask0To8Locked: true,
          stockPassingScales: [],
          task0PLocked: true
        }, null, 2)}\n`
      );
      writeFileSync(
        path.join(stagingDirectory, "README.md"),
        `# Takram cloud-scale similarity — Stage A0 historical control\n\n` +
        `Stock-only public-parameter control at coverage 0.3 with unscaled ` +
        `localWeatherRepeat=[100,100]. It is diagnostic-only and cannot authorize mip work.\n\n` +
        `## Reproduce\n\n\`\`\`bash\n${manifest.captureCommand}\n\`\`\`\n\n` +
        `Task 0P and the original Task 0–8 remain locked.\n`
      );
    },
    enabled: captureEnabled,
    finalDirectory: evidenceDirectory
  });
});

test("Stage A1 captures the scaled stock-weather health control", async ({
  browser,
  page
}) => {
  test.skip(!captureEnabled, "formal evidence requires explicit capture mode");
  expect(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
    .toBe("");

  const scales = [80, 120, 160] as const;
  const progresses = [0, 0.06, 0.12, 0.18] as const;
  const frames = new Map<string, Buffer>();
  const records: Array<Record<string, unknown>> = [];
  let gpu: Record<string, string | null> | null = null;

  for (const scale of scales) {
    for (const progress of progresses) {
      const telemetry = await openScaleCandidate(
        page,
        "stock",
        scale,
        "parity",
        "full",
        progress,
        "similarity"
      );
      expect(telemetry.cloudScale?.drift).toEqual([]);
      expect(telemetry.cloudScale?.stockWeatherControl).toEqual({
        classification: "SCALED_STOCK_WEATHER_CONTROL",
        mode: "similarity",
        repeat: [100 / scale, 100 / scale],
        scale,
        sourceRepeat: [100, 100]
      });
      expect(telemetry.adapter.localWeatherRepeat).toEqual([100 / scale, 100 / scale]);
      expect(telemetry.cloudScale?.readback.mipDistancePatch).toMatchObject({
        active: false,
        classification: "native-hardcoded",
        nativeCoefficientOccurrences: 1,
        patchedCoefficientOccurrences: 0,
        scale: 1
      });
      expect(telemetry.rendererFingerprintHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);

      const capture = await readExactMatchedFrame(page);
      const fileName = `stage-a1-stock-weather-s${scale}-p${Math.round(progress * 100)
        .toString().padStart(3, "0")}-full.png`;
      const screenshotSha256 = createHash("sha256")
        .update(capture.buffer)
        .digest("hex");
      frames.set(`${scale}:${progress}`, capture.buffer);
      records.push({
        capture: capture.metadata,
        file: `captures/${fileName}`,
        input: "stock",
        progress,
        query: query("stock", scale, "parity", progress, "similarity"),
        rendererFingerprintHash: telemetry.rendererFingerprintHash,
        screenshotSha256,
        telemetry
      });

      if (gpu === null) {
        gpu = await page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const gl = canvas?.getContext("webgl2");
          if (!gl) return null;
          const debug = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            renderer: String(gl.getParameter(gl.RENDERER)),
            unmaskedRenderer: debug
              ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
              : null,
            unmaskedVendor: debug
              ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL))
              : null,
            vendor: String(gl.getParameter(gl.VENDOR))
          };
        });
      }
    }
  }

  const contactSheet = await buildStockContactSheet(
    frames,
    scales,
    progresses,
    "stock 100/S"
  );
  const contactSheetSha256 = createHash("sha256").update(contactSheet).digest("hex");
  const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8"
  }).trim();
  const viewport = page.viewportSize();
  const firstTelemetry = records[0]?.telemetry as ScaleTelemetry;
  const runtimeMipIdentity = firstTelemetry.cloudScale?.readback.mipDistancePatch;
  const manifest = {
    baseCommit,
    browser: {
      executable: process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      version: browser.version()
    },
    captureCommand:
      "MIRALITH_TAKRAM_CLOUD_SCALE_CAPTURE=1 pnpm exec playwright test " +
      "-c playwright.takram-parity-system-chrome.config.ts " +
      "lubirth-takram-cloud-scale.spec.ts --headed --grep \"Stage A1 captures\"",
    candidateContract: {
      classification: "SCALED_STOCK_WEATHER_CONTROL",
      coverage: 0.3,
      coverageMode: "parity",
      input: "stock",
      localWeatherRepeat: "100/S",
      progresses,
      scales
    },
    contactSheet: {
      path: "stage-a1-stock-weather-contact-sheet.png",
      sha256: contactSheetSha256
    },
    generatedAt: new Date().toISOString(),
    gpu,
    records,
    runtimeMipIdentity,
    schemaVersion: 2,
    viewport: {
      deviceScaleFactor: 1,
      height: viewport?.height ?? null,
      width: viewport?.width ?? null
    }
  };

  await writeTakramCloudScaleEvidenceAtomically({
    build: async (stagingDirectory) => {
      const captureDirectory = path.join(stagingDirectory, "captures");
      mkdirSync(captureDirectory, { recursive: true });
      for (const record of records) {
        const fileName = path.basename(String(record.file));
        const scale = Number((record.telemetry as ScaleTelemetry).cloudScale?.requested.scale);
        const progress = Number(record.progress);
        writeFileSync(
          path.join(captureDirectory, fileName),
          frames.get(`${scale}:${progress}`)!
        );
      }
      writeFileSync(
        path.join(stagingDirectory, "stage-a1-stock-weather-contact-sheet.png"),
        contactSheet
      );
      writeFileSync(
        path.join(stagingDirectory, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`
      );
      writeFileSync(
        path.join(stagingDirectory, "checkpoint.json"),
        `${JSON.stringify({
          decision: "SCALED_STOCK_WEATHER_VISUAL_REVIEW_PENDING",
          mipDistancePatchAuthorized: false,
          originalTask0To8Locked: true,
          stageBRun: false,
          stageCRun: false,
          stockPassingScales: [],
          task0PLocked: true
        }, null, 2)}\n`
      );
      writeFileSync(
        path.join(stagingDirectory, "README.md"),
        `# Stage A1 scaled stock-weather health control\n\n` +
        `Stock coverage 0.3 with localWeatherRepeat=[100/S,100/S]. ` +
        `Visual review is pending; mip remains unpatched and V3 has not run.\n\n` +
        `## Reproduce\n\n\`\`\`bash\n${manifest.captureCommand}\n\`\`\`\n\n` +
        `Task 0P and the original Task 0–8 remain locked.\n`
      );
    },
    enabled: captureEnabled,
    finalDirectory: stageA1EvidenceDirectory
  });
});

test("resets exact first-frame history when the scale contract changes", async ({ page }) => {
  const first = await openScaleCandidate(page, "stock", 80, "parity", "history-reset-first");
  const second = await openScaleCandidate(page, "stock", 120, "parity", "history-reset-first");
  const weatherScaled = await openScaleCandidate(
    page, "stock", 120, "parity", "history-reset-first", 0.06, "similarity"
  );

  expect(first.historyFirstFrameCapture?.nativeFrameCount).toBe(1);
  expect(second.historyFirstFrameCapture?.nativeFrameCount).toBe(1);
  expect(weatherScaled.historyFirstFrameCapture?.nativeFrameCount).toBe(1);
  expect(first.historyEpochHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
  expect(second.historyEpochHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
  expect(first.historyEpochHash).not.toBe(second.historyEpochHash);
  expect(first.rendererFingerprintHash).not.toBe(second.rendererFingerprintHash);
  expect(weatherScaled.rendererFingerprintHash).toBe(second.rendererFingerprintHash);
  expect(weatherScaled.historyEpochHash).not.toBe(second.historyEpochHash);
});

test("resets the temporal epoch and exact-frame capture on same-page query changes", async ({
  page
}) => {
  const initial = await openScaleCandidate(
    page, "stock", 80, "parity", "full", 0, "unscaled"
  );
  let previousCapture = await readExactMatchedFrame(page);
  expect(previousCapture.metadata.historyEpochHash).toBe(initial.historyEpochHash);

  const changes = [
    {
      expected: { coverageMode: "parity", progress: 0.06, scale: 80, weather: "unscaled" },
      query: { progress: "0.06" }
    },
    {
      expected: { coverageMode: "parity", progress: 0.06, scale: 120, weather: "unscaled" },
      query: { cloudScale: "120" }
    },
    {
      expected: {
        coverageMode: "presentation",
        progress: 0.06,
        scale: 120,
        weather: "unscaled"
      },
      query: { cloudCoverage: "presentation" }
    },
    {
      expected: {
        coverageMode: "presentation",
        progress: 0.06,
        scale: 120,
        weather: "similarity"
      },
      query: { stockWeather: "similarity" }
    }
  ] as const;

  for (const change of changes) {
    const previousEpochHash = previousCapture.metadata.historyEpochHash;
    await page.evaluate((query) => {
      const nextUrl = new URL(window.location.href);
      for (const [key, value] of Object.entries(query)) {
        nextUrl.searchParams.set(key, value);
      }
      window.history.pushState(null, "", nextUrl);
    }, change.query);
    await page.waitForFunction(({ expected, previousEpochHash }) => {
      const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
        | ScaleTelemetry
        | undefined;
      const capture = Reflect.get(window, "__MiraLithTakramMatchedTemporalFrame") as
        | { historyEpochHash?: string; nativeFrameCount?: number }
        | undefined;
      return telemetry?.active === true &&
        telemetry.historyEpochHash !== previousEpochHash &&
        telemetry.historyEpochHash === capture?.historyEpochHash &&
        telemetry.nativeFrameCount >= 32 &&
        capture?.nativeFrameCount === 32 &&
        telemetry.progress === expected.progress &&
        telemetry.cloudScale?.requested.scale === expected.scale &&
        telemetry.cloudScale?.requested.coverageMode === expected.coverageMode &&
        telemetry.cloudScale?.stockWeatherControl?.mode === expected.weather;
    }, { expected: change.expected, previousEpochHash }, { timeout: 120_000 });

    const telemetry = await readTelemetry(page);
    expect(telemetry?.historyFirstFrameCapture).toBeNull();
    previousCapture = await readExactMatchedFrame(page);
    expect(previousCapture.metadata.historyEpochHash).toBe(telemetry?.historyEpochHash);
    expect(previousCapture.metadata.historyEpochHash).not.toBe(previousEpochHash);
  }
});
