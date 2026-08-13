import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "../../packages/lubirth-hero/node_modules/sharp";
import {
  resolveTakramOrbitalInitialStepMeters,
  resolveTakramOrbitalStepScale,
  TAKRAM_ORBITAL_SAMPLING_PROGRESS,
  TAKRAM_ORBITAL_STEP_SCALE_MODES,
  type TakramOrbitalStepScaleMode
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingCausality";
import {
  analyzeTakramV3MaskedFrameDifference,
  analyzeTakramV3NativeSampleCountReadback,
  analyzeTakramV3StageReadback
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyMetrics";
import type {
  TakramParitySampleCountReadback,
  TakramParityStageReadbackBuffer,
  TakramParityStageReadbackCapture,
  TakramParityTelemetry
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
import { writeTakramOrbitalLookdevEvidenceAtomically } from
  "../helpers/takramOrbitalLookdevEvidence";

test.setTimeout(900_000);

const captureEnabled =
  process.env.MIRALITH_TAKRAM_ORBITAL_SAMPLING_CAPTURE === "1";
const evidenceRoot = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-sampling-causality"
);
const systemChromeExecutable = process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const diagnostics = [
  "cloud-raw",
  "cloud-raw-off",
  "sample-count-debug",
  "stage-readback"
] as const;
const modes = TAKRAM_ORBITAL_STEP_SCALE_MODES;
const progresses = TAKRAM_ORBITAL_SAMPLING_PROGRESS;

type SamplingMode = TakramOrbitalStepScaleMode;
type SamplingDiagnostic = (typeof diagnostics)[number];

type MatchedCapture = {
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
};

type DecodedPng = {
  height: number;
  pixels: Uint8Array;
  width: number;
};

type CaptureResult = {
  diagnostic: SamplingDiagnostic;
  mode: SamplingMode;
  png: Buffer;
  progress: number;
  repeatIndex: number | null;
  sampleReadback: TakramParitySampleCountReadback | null;
  stageReadback: TakramParityStageReadbackCapture | null;
  telemetry: TakramParityTelemetry;
  temporalFrame: Omit<MatchedCapture, "dataUrl">;
};

type Artifact = {
  byteLength: number;
  kind: "contact-sheet" | "mask" | "native-sample-count" | "screenshot" |
    "stage-buffer";
  path: string;
  sha256: string;
};

type StoredArtifact = Artifact & { buffer: Buffer };

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function progressLabel(progress: number) {
  return progress.toFixed(2).replace(".", "-");
}

function captureKey(input: {
  diagnostic: SamplingDiagnostic;
  mode: SamplingMode;
  progress: number;
  repeatIndex?: number | null;
}) {
  return [
    input.mode,
    input.progress,
    input.diagnostic,
    input.repeatIndex ?? "base"
  ].join(":");
}

function samplingRoute(
  mode: SamplingMode,
  progress: number,
  diagnostic: SamplingDiagnostic
) {
  return "/lubirth-takram-parity-spike" +
    `?input=stock&view=opening&progress=${progress}` +
    "&orbitalPreset=h120&orbitalCoverage=0.55" +
    "&verticalScale=1&opticalDepthScale=1" +
    `&orbitalStepScale=${mode}&diagnostic=${diagnostic}` +
    "&visualTest=pixels";
}

async function readWindowValue<T>(page: Page, key: string) {
  return page.evaluate((windowKey) => Reflect.get(window, windowKey) ?? null, key) as
    Promise<T | null>;
}

async function captureSamplingDiagnostic(input: {
  diagnostic: SamplingDiagnostic;
  mode: SamplingMode;
  page: Page;
  progress: number;
  repeatIndex?: number | null;
}): Promise<CaptureResult> {
  const response = await input.page.goto(samplingRoute(
    input.mode,
    input.progress,
    input.diagnostic
  ));
  expect(response?.status()).toBe(200);
  const root = input.page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute("data-orbital-preset", "h120");
  await expect(root).toHaveAttribute("data-orbital-coverage", "0.55");
  await expect(root).toHaveAttribute("data-vertical-scale", "1");
  await expect(root).toHaveAttribute("data-optical-depth-scale", "1");
  await expect(root).toHaveAttribute("data-orbital-step-scale", input.mode);
  await expect(root).toHaveAttribute("data-runtime", "ready", {
    timeout: 180_000
  });
  await expect(input.page.locator("canvas")).toHaveCount(1);
  await expect(input.page.locator("[data-visual-fallback]")).toHaveCount(0);

  const telemetry = await readWindowValue<TakramParityTelemetry>(
    input.page,
    "__MiraLithTakramParity"
  );
  expect(telemetry).toMatchObject({
    active: true,
    diagnostic: input.diagnostic,
    driftAttemptLedgerOutcome: "none",
    input: "stock",
    lookdevSetupState: "ORBITAL_LOOKDEV_RUNTIME_READY",
    progress: input.progress,
    resetNonce: 0,
    transformFallback: null,
    view: "opening",
    orbitalLookdev: {
      drift: [],
      requested: {
        coverage: 0.55,
        opticalDepthScale: 1,
        preset: "h120",
        samplingPolicy: {
          kind: "causal",
          mode: input.mode
        },
        verticalScale: 1
      },
      readback: {
        clouds: {
          perspectiveStepScale: resolveTakramOrbitalStepScale(input.mode)
        }
      }
    }
  });
  expect(telemetry?.runtimeEvidenceEpoch)
    .toMatch(/^takram-runtime-evidence:/);
  expect(telemetry?.matchedTemporalFrameCapture).toMatchObject({
    cloudsFrame: 32,
    frameLockPass: true,
    nativeFrameCount: 32,
    resolveFrame: 32,
    shadowFrame: 32,
    temporalJitterIndex: 0
  });

  const matched = await readWindowValue<MatchedCapture>(
    input.page,
    "__MiraLithTakramMatchedTemporalFrame"
  );
  expect(matched).toMatchObject({
    cloudsFrame: 32,
    frameLockPass: true,
    height: 960,
    nativeFrameCount: 32,
    resolveFrame: 32,
    shadowFrame: 32,
    temporalJitterIndex: 0,
    width: 1440
  });
  expect(matched?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);

  const stageReadback = input.diagnostic === "stage-readback"
    ? await readWindowValue<TakramParityStageReadbackCapture>(
        input.page,
        "__MiraLithTakramStageReadback"
      )
    : null;
  if (input.diagnostic === "stage-readback") {
    expect(stageReadback).toMatchObject({
      aerialPerspectiveInputSource:
        "native-cloud-resolved-history-render-target",
      nativeFrameCount: 32,
      temporalFrame: {
        cloudsFrame: 32,
        frameLockPass: true,
        resolveFrame: 32,
        shadowFrame: 32,
        temporalJitterIndex: 0
      },
      preTemporal: {
        encoding: "linear-rgba",
        height: 240,
        origin: "bottom-left",
        precision: "half-float",
        scalar: "float32-le",
        source: "native-cloud-current-render-target",
        width: 360
      },
      resolvedHistory: {
        encoding: "linear-rgba",
        height: 960,
        origin: "bottom-left",
        precision: "half-float",
        scalar: "float32-le",
        source: "native-cloud-resolved-history-render-target",
        width: 1440
      },
      finalOutput: {
        encoding: "srgb-output-rgba",
        height: 960,
        origin: "bottom-left",
        precision: "unorm8",
        scalar: "uint8",
        source: "default-framebuffer-after-aerial-perspective",
        width: 1440
      }
    });
    expect(stageReadback?.preTemporal.byteLength).toBe(360 * 240 * 4 * 4);
    expect(stageReadback?.resolvedHistory.byteLength).toBe(1440 * 960 * 4 * 4);
    expect(stageReadback?.finalOutput.byteLength).toBe(1440 * 960 * 4);
  }

  const sampleReadback = input.diagnostic === "sample-count-debug"
    ? telemetry?.sampleCountReadback ?? null
    : null;
  if (input.diagnostic === "sample-count-debug") {
    expect(sampleReadback).toMatchObject({
      encoding:
        "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask",
      height: 240,
      origin: "bottom-left",
      precision: "half-float",
      source: "native-cloud-current-render-target-v1",
      width: 360
    });
    expect(sampleReadback?.values).toHaveLength(360 * 240 * 4);
  }

  const { dataUrl, ...temporalFrame } = matched!;
  return {
    diagnostic: input.diagnostic,
    mode: input.mode,
    png: Buffer.from(dataUrl.split(",")[1]!, "base64"),
    progress: input.progress,
    repeatIndex: input.repeatIndex ?? null,
    sampleReadback,
    stageReadback,
    telemetry: telemetry!,
    temporalFrame
  };
}

async function decodePng(buffer: Buffer): Promise<DecodedPng> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    height: info.height,
    pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width
  };
}

function deriveCloudMask(input: {
  cloudRaw: DecodedPng;
  cloudRawOff: DecodedPng;
}) {
  expect(input.cloudRaw.width).toBe(input.cloudRawOff.width);
  expect(input.cloudRaw.height).toBe(input.cloudRawOff.height);
  const pixelCount = input.cloudRaw.width * input.cloudRaw.height;
  const mask = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const difference = Math.max(
      Math.abs(input.cloudRaw.pixels[offset]! - input.cloudRawOff.pixels[offset]!),
      Math.abs(input.cloudRaw.pixels[offset + 1]! - input.cloudRawOff.pixels[offset + 1]!),
      Math.abs(input.cloudRaw.pixels[offset + 2]! - input.cloudRawOff.pixels[offset + 2]!)
    );
    mask[index] = difference > 8 ? 1 : 0;
  }
  return mask;
}

function analyzeMask(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const componentSizes: number[] = [];
  let edgePixelCount = 0;
  const neighbors = (index: number) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const values: number[] = [];
    if (x > 0) values.push(index - 1);
    if (x + 1 < width) values.push(index + 1);
    if (y > 0) values.push(index - width);
    if (y + 1 < height) values.push(index + width);
    return values;
  };
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const adjacent = neighbors(index);
    if (adjacent.length < 4 || adjacent.some((entry) => mask[entry] === 0)) {
      edgePixelCount += 1;
    }
    if (visited[index] === 1) continue;
    const stack = [index];
    visited[index] = 1;
    let size = 0;
    while (stack.length > 0) {
      const current = stack.pop()!;
      size += 1;
      for (const neighbor of neighbors(current)) {
        if (mask[neighbor] === 1 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
    componentSizes.push(size);
  }
  const cloudPixelCount = mask.reduce((sum, value) => sum + value, 0);
  const safeCount = Math.max(cloudPixelCount, 1);
  return {
    cloudPixelCount,
    cloudPixelFraction: cloudPixelCount / (width * height),
    connectedComponentCount: componentSizes.length,
    largestConnectedAreaFraction: Math.max(0, ...componentSizes) / safeCount,
    singlePixelFragmentFraction:
      componentSizes.filter((size) => size === 1).length / safeCount,
    smallFragmentFraction: componentSizes
      .filter((size) => size <= 3)
      .reduce((sum, size) => sum + size, 0) / safeCount,
    edgeDensity: edgePixelCount / safeCount
  };
}

async function encodeMask(mask: Uint8Array, width: number, height: number) {
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < mask.length; index += 1) {
    const value = mask[index] === 1 ? 255 : 0;
    const offset = index * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  return sharp(pixels, { raw: { channels: 4, height, width } })
    .png()
    .toBuffer();
}

function encodeNativeSampleCountReadback(readback: TakramParitySampleCountReadback) {
  const raw = Buffer.allocUnsafe(readback.width * readback.height * 4 * 2);
  const scales = [500, 5, 5, 1] as const;
  for (let index = 0; index < readback.values.length; index += 1) {
    const value = Math.max(0, Math.min(
      65_535,
      Math.round((readback.values[index] ?? 0) * scales[index % 4]!)
    ));
    raw.writeUInt16LE(value, index * 2);
  }
  return gzipSync(raw, { level: 9 });
}

function encodeStageBuffer(readback: TakramParityStageReadbackBuffer) {
  const raw = Buffer.from(readback.dataBase64, "base64");
  expect(raw.byteLength).toBe(readback.byteLength);
  return gzipSync(raw, { level: 9 });
}

function decodeStageValues(readback: TakramParityStageReadbackBuffer) {
  const bytes = Buffer.from(readback.dataBase64, "base64");
  expect(bytes.byteLength).toBe(readback.byteLength);
  if (readback.scalar === "uint8") {
    return Float32Array.from(bytes, (value) => value / 255);
  }
  const values = new Float32Array(bytes.byteLength / 4);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = bytes.readFloatLE(index * 4);
  }
  return values;
}

function normalizeRequestedContract(value: unknown) {
  const normalized = structuredClone(value) as any;
  delete normalized.stepScaleMode;
  delete normalized.clouds?.perspectiveStepScale;
  return normalized;
}

function normalizeRuntimeReadback(value: unknown) {
  const normalized = structuredClone(value) as any;
  delete normalized.allocations;
  delete normalized.clouds?.perspectiveStepScale;
  return normalized;
}

function normalizeRendererFingerprint(value: unknown) {
  const normalized = structuredClone(value) as any;
  delete normalized.clouds?.uniforms?.perspectiveStepScale;
  delete normalized.orbitalBaseline?.clouds?.perspectiveStepScale;
  return normalized;
}

function runtimeRecord(capture: CaptureResult) {
  const telemetry = capture.telemetry;
  return {
    adapter: telemetry.adapter,
    assetGeneration: telemetry.assetGeneration,
    atmosphereGeneration: telemetry.atmosphereGeneration,
    cameraHeightMeters: telemetry.cameraHeightMeters,
    cameraMatrixWorld: telemetry.cameraMatrixWorld,
    diagnostic: capture.diagnostic,
    driftAttemptLedgerOutcome: telemetry.driftAttemptLedgerOutcome,
    earthMatrixWorld: telemetry.earthMatrixWorld,
    ecefSunDirection: telemetry.ecefSunDirection,
    historyEpochHash: telemetry.historyEpochHash,
    lookdevBaseKey: telemetry.lookdevBaseKey,
    lookdevMountKey: telemetry.lookdevMountKey,
    lookdevSetupState: telemetry.lookdevSetupState,
    mode: capture.mode,
    orbitalLookdev: telemetry.orbitalLookdev,
    progress: capture.progress,
    rendererFingerprint: telemetry.rendererFingerprint,
    rendererFingerprintHash: telemetry.rendererFingerprintHash,
    repeatIndex: capture.repeatIndex,
    runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch,
    temporalFrame: capture.temporalFrame
  };
}

async function buildContactSheet(input: {
  captures: ReadonlyMap<string, CaptureResult>;
  diagnostic: SamplingDiagnostic;
}) {
  const cellWidth = 360;
  const imageHeight = 240;
  const labelHeight = 32;
  const cellHeight = imageHeight + labelHeight;
  const composites: sharp.OverlayOptions[] = [];
  for (const [row, progress] of progresses.entries()) {
    for (const [column, mode] of modes.entries()) {
      const capture = input.captures.get(captureKey({
        diagnostic: input.diagnostic,
        mode,
        progress
      }));
      expect(capture).toBeDefined();
      const left = column * cellWidth;
      const top = row * cellHeight;
      composites.push({
        input: await sharp(capture!.png)
          .resize(cellWidth, imageHeight, { fit: "fill" })
          .png()
          .toBuffer(),
        left,
        top
      });
      composites.push({
        input: Buffer.from(
          `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#10131a"/><text x="8" y="21" fill="#f4f6fa" font-family="monospace" font-size="13">${mode} (${resolveTakramOrbitalStepScale(mode)}) · p=${progress.toFixed(2)}</text></svg>`
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
      height: cellHeight * progresses.length,
      width: cellWidth * modes.length
    }
  }).composite(composites).png().toBuffer();
}

test("publishes bounded sampling diagnostics", async ({ page }) => {
  for (const mode of modes) {
    const sample = await captureSamplingDiagnostic({
      diagnostic: "sample-count-debug",
      mode,
      page,
      progress: 0.06
    });
    expect(sample.sampleReadback).not.toBeNull();

    const stage = await captureSamplingDiagnostic({
      diagnostic: "stage-readback",
      mode,
      page,
      progress: 0.06
    });
    expect(stage.stageReadback?.preTemporal.byteLength).toBeGreaterThan(0);
    expect(stage.stageReadback?.resolvedHistory.byteLength).toBeGreaterThan(0);
    expect(stage.stageReadback?.finalOutput.byteLength).toBeGreaterThan(0);
  }
});

test("captures orbital sampling causality A/B", async ({ page }) => {
  test.skip(!captureEnabled,
    "Set MIRALITH_TAKRAM_ORBITAL_SAMPLING_CAPTURE=1 for formal evidence.");
  expect(execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim())
    .toBe("");
  expect(execFileSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf8"
  }).trim()).toBe("");

  const cleanCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8"
  }).trim();
  const captures = new Map<string, CaptureResult>();
  const storedArtifacts = new Map<string, StoredArtifact>();
  const addArtifact = (
    artifactPath: string,
    buffer: Buffer,
    kind: Artifact["kind"]
  ) => {
    const artifact: StoredArtifact = {
      buffer,
      byteLength: buffer.byteLength,
      kind,
      path: artifactPath,
      sha256: sha256(buffer)
    };
    storedArtifacts.set(artifactPath, artifact);
    return artifact;
  };
  const publishArtifact = ({ buffer: _buffer, ...artifact }: StoredArtifact) =>
    artifact;

  let gpu: Record<string, string | null> | null = null;
  for (const mode of modes) {
    for (const progress of progresses) {
      for (const diagnostic of diagnostics) {
        const capture = await captureSamplingDiagnostic({
          diagnostic,
          mode,
          page,
          progress
        });
        captures.set(captureKey(capture), capture);
        const name = `${mode}-p${progressLabel(progress)}-${diagnostic}.png`;
        addArtifact(`captures/${name}`, capture.png, "screenshot");
        if (gpu === null) {
          gpu = await page.evaluate(() => {
            const gl = document.querySelector("canvas")?.getContext("webgl2");
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
  }
  for (const mode of modes) {
    for (const diagnostic of diagnostics) {
      const capture = await captureSamplingDiagnostic({
        diagnostic,
        mode,
        page,
        progress: 0.06,
        repeatIndex: 1
      });
      captures.set(captureKey(capture), capture);
      const name = `${mode}-p0-06-${diagnostic}-repeat-1.png`;
      addArtifact(`captures/${name}`, capture.png, "screenshot");
    }
  }

  const requireCapture = (
    mode: SamplingMode,
    progress: number,
    diagnostic: SamplingDiagnostic,
    repeatIndex: number | null = null
  ) => {
    const capture = captures.get(captureKey({
      diagnostic,
      mode,
      progress,
      repeatIndex
    }));
    expect(capture).toBeDefined();
    return capture!;
  };

  const analyses = new Map<string, {
    cloudMask: Uint8Array;
    cloudRaw: DecodedPng;
    final: DecodedPng;
    metrics: Record<string, unknown>;
  }>();
  for (const mode of modes) {
    for (const progress of progresses) {
      for (const repeatIndex of progress === 0.06 ? [null, 1] : [null]) {
        const cloudRawCapture = requireCapture(
          mode,
          progress,
          "cloud-raw",
          repeatIndex
        );
        const cloudRawOffCapture = requireCapture(
          mode,
          progress,
          "cloud-raw-off",
          repeatIndex
        );
        const sampleCapture = requireCapture(
          mode,
          progress,
          "sample-count-debug",
          repeatIndex
        );
        const stageCapture = requireCapture(
          mode,
          progress,
          "stage-readback",
          repeatIndex
        );
        const cloudRaw = await decodePng(cloudRawCapture.png);
        const cloudRawOff = await decodePng(cloudRawOffCapture.png);
        const final = await decodePng(stageCapture.png);
        const cloudMask = deriveCloudMask({ cloudRaw, cloudRawOff });
        const maskBuffer = await encodeMask(
          cloudMask,
          cloudRaw.width,
          cloudRaw.height
        );
        const repeatSuffix = repeatIndex === null ? "" : `-repeat-${repeatIndex}`;
        const prefix = `${mode}-p${progressLabel(progress)}${repeatSuffix}`;
        const maskArtifact = addArtifact(
          `captures/${prefix}-cloud-signal-mask.png`,
          maskBuffer,
          "mask"
        );

        expect(sampleCapture.sampleReadback).not.toBeNull();
        const sampleBuffer = encodeNativeSampleCountReadback(
          sampleCapture.sampleReadback!
        );
        const sampleArtifact = addArtifact(
          `captures/${prefix}-native-sample-count-rgba-u16le.gz`,
          sampleBuffer,
          "native-sample-count"
        );
        const sampleMetrics = analyzeTakramV3NativeSampleCountReadback({
          cloudMask,
          cloudMaskHeight: cloudRaw.height,
          cloudMaskWidth: cloudRaw.width,
          readback: sampleCapture.sampleReadback!
        });
        expect(sampleMetrics.invariantViolationCount).toBe(0);

        expect(stageCapture.stageReadback).not.toBeNull();
        const stageMetrics = ([
          ["pre-temporal", stageCapture.stageReadback!.preTemporal],
          ["resolved-history", stageCapture.stageReadback!.resolvedHistory],
          ["final-output", stageCapture.stageReadback!.finalOutput]
        ] as const).map(([stage, readback]) => {
          const extension = readback.scalar === "uint8"
            ? "rgba-u8"
            : "rgba-f32le";
          const artifact = addArtifact(
            `captures/${prefix}-${stage}-${extension}.gz`,
            encodeStageBuffer(readback),
            "stage-buffer"
          );
          const { dataBase64: _dataBase64, ...metadata } = readback;
          return {
            artifact: publishArtifact(artifact),
            metadata,
            stage,
            summary: analyzeTakramV3StageReadback({
              height: readback.height,
              values: decodeStageValues(readback),
              width: readback.width
            })
          };
        });
        const preTemporal = stageMetrics[0]!.summary;
        const resolvedHistory = stageMetrics[1]!.summary;
        analyses.set(`${mode}:${progress}:${repeatIndex ?? "base"}`, {
          cloudMask,
          cloudRaw,
          final,
          metrics: {
            mask: {
              artifact: publishArtifact(maskArtifact),
              ...analyzeMask(cloudMask, cloudRaw.width, cloudRaw.height)
            },
            rawSignal: analyzeTakramV3MaskedFrameDifference({
              height: cloudRaw.height,
              left: cloudRaw.pixels,
              mask: cloudMask,
              right: cloudRawOff.pixels,
              width: cloudRaw.width
            }),
            sampleCount: {
              artifact: publishArtifact(sampleArtifact),
              metrics: sampleMetrics
            },
            stages: stageMetrics,
            retention: {
              signalPixelFraction: preTemporal.signalPixelFraction > 0
                ? resolvedHistory.signalPixelFraction /
                  preTemporal.signalPixelFraction
                : 0,
              signalMeanLuma: preTemporal.signalMeanLuma > 0
                ? resolvedHistory.signalMeanLuma / preTemporal.signalMeanLuma
                : 0
            }
          }
        });
      }
    }
  }

  const setupChecks = [];
  for (const progress of progresses) {
    for (const diagnostic of diagnostics) {
      const control = requireCapture("control", progress, diagnostic);
      const treatment = requireCapture("treatment", progress, diagnostic);
      const requestedParity = JSON.stringify(normalizeRequestedContract(
        control.telemetry.orbitalLookdev?.requested
      )) === JSON.stringify(normalizeRequestedContract(
        treatment.telemetry.orbitalLookdev?.requested
      ));
      const runtimeParity = JSON.stringify(normalizeRuntimeReadback(
        control.telemetry.orbitalLookdev?.readback
      )) === JSON.stringify(normalizeRuntimeReadback(
        treatment.telemetry.orbitalLookdev?.readback
      ));
      const fingerprintParity = JSON.stringify(normalizeRendererFingerprint(
        control.telemetry.rendererFingerprint
      )) === JSON.stringify(normalizeRendererFingerprint(
        treatment.telemetry.rendererFingerprint
      ));
      const cameraParity = control.telemetry.cameraHeightMeters ===
        treatment.telemetry.cameraHeightMeters &&
        JSON.stringify(control.telemetry.cameraMatrixWorld) ===
          JSON.stringify(treatment.telemetry.cameraMatrixWorld) &&
        JSON.stringify(control.telemetry.earthMatrixWorld) ===
          JSON.stringify(treatment.telemetry.earthMatrixWorld);
      setupChecks.push({
        cameraParity,
        diagnostic,
        fingerprintParity,
        progress,
        requestedParity,
        runtimeParity
      });
    }
  }
  expect(setupChecks.every((entry) =>
    entry.cameraParity && entry.fingerprintParity && entry.requestedParity &&
    entry.runtimeParity
  )).toBe(true);

  const repeatNoise = modes.map((mode) => {
    const base = analyses.get(`${mode}:0.06:base`)!;
    const repeat = analyses.get(`${mode}:0.06:1`)!;
    const unionMask = Uint8Array.from(base.cloudMask, (value, index) =>
      value === 1 || repeat.cloudMask[index] === 1 ? 1 : 0
    );
    const fullMask = new Uint8Array(base.final.width * base.final.height).fill(1);
    return {
      mode,
      cloudRaw: analyzeTakramV3MaskedFrameDifference({
        height: base.cloudRaw.height,
        left: base.cloudRaw.pixels,
        mask: unionMask,
        right: repeat.cloudRaw.pixels,
        width: base.cloudRaw.width
      }),
      finalOutput: analyzeTakramV3MaskedFrameDifference({
        height: base.final.height,
        left: base.final.pixels,
        mask: fullMask,
        right: repeat.final.pixels,
        width: base.final.width
      })
    };
  });

  const paired = progresses.map((progress) => {
    const control = analyses.get(`control:${progress}:base`)!;
    const treatment = analyses.get(`treatment:${progress}:base`)!;
    const unionMask = Uint8Array.from(control.cloudMask, (value, index) =>
      value === 1 || treatment.cloudMask[index] === 1 ? 1 : 0
    );
    const fullMask = new Uint8Array(control.final.width * control.final.height).fill(1);
    return {
      progress,
      cloudRawDifference: analyzeTakramV3MaskedFrameDifference({
        height: control.cloudRaw.height,
        left: control.cloudRaw.pixels,
        mask: unionMask,
        right: treatment.cloudRaw.pixels,
        width: control.cloudRaw.width
      }),
      finalOutputFullFrameDifference: analyzeTakramV3MaskedFrameDifference({
        height: control.final.height,
        left: control.final.pixels,
        mask: fullMask,
        right: treatment.final.pixels,
        width: control.final.width
      })
    };
  });

  const contactSheets: Record<string, Artifact> = {};
  for (const [name, diagnostic] of [
    ["cloud-raw", "cloud-raw"],
    ["sample-count", "sample-count-debug"],
    ["final-output", "stage-readback"]
  ] as const) {
    const buffer = await buildContactSheet({ captures, diagnostic });
    const artifact = addArtifact(`${name}-contact-sheet.png`, buffer, "contact-sheet");
    const { buffer: _buffer, ...published } = artifact;
    contactSheets[name] = published;
  }

  const firstStage = requireCapture("control", 0.06, "stage-readback");
  const cameraHeightMeters = firstStage.telemetry.cameraHeightMeters!;
  const initialStepEstimates = Object.fromEntries(modes.map((mode) => [
    mode,
    {
      nearNadirMeters: resolveTakramOrbitalInitialStepMeters({
        minStepSize: 50,
        perspectiveStepScale: resolveTakramOrbitalStepScale(mode),
        rayNearMeters: cameraHeightMeters
      }),
      approximateLimbMeters: resolveTakramOrbitalInitialStepMeters({
        minStepSize: 50,
        perspectiveStepScale: resolveTakramOrbitalStepScale(mode),
        rayNearMeters: cameraHeightMeters * 2
      }),
      limbApproximation: "2x camera-height rayNear diagnostic bound"
    }
  ]));
  const records = Array.from(captures.values()).map((capture) => {
    const screenshotName = capture.repeatIndex === null
      ? `${capture.mode}-p${progressLabel(capture.progress)}-${capture.diagnostic}.png`
      : `${capture.mode}-p${progressLabel(capture.progress)}-${capture.diagnostic}-repeat-${capture.repeatIndex}.png`;
    return {
      ...runtimeRecord(capture),
      initialStepEstimate: initialStepEstimates[capture.mode],
      screenshot: publishArtifact(
        storedArtifacts.get(`captures/${screenshotName}`)!
      )
    };
  });
  const publishedArtifacts = Array.from(storedArtifacts.values())
    .map(({ buffer: _buffer, ...artifact }) => artifact)
    .sort((left, right) => left.path.localeCompare(right.path));
  const metrics = {
    schema: "takram-orbital-sampling-causality-metrics/v1",
    arms: Array.from(analyses, ([key, analysis]) => ({
      key,
      metrics: analysis.metrics
    })),
    paired,
    repeatNoise,
    setupChecks
  };

  await writeTakramOrbitalLookdevEvidenceAtomically({
    enabled: captureEnabled,
    finalDirectory: evidenceRoot,
    build: async (directory) => {
      for (const artifact of storedArtifacts.values()) {
        const destination = path.join(directory, artifact.path);
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, artifact.buffer);
      }
      writeFileSync(path.join(directory, "metrics.json"),
        `${JSON.stringify(metrics, null, 2)}\n`);
      writeFileSync(path.join(directory, "manifest.json"),
        `${JSON.stringify({
          schema: "takram-orbital-sampling-causality-manifest/v1",
          artifacts: publishedArtifacts,
          browser: {
            executable: systemChromeExecutable,
            version: execFileSync(systemChromeExecutable, ["--version"], {
              encoding: "utf8"
            }).trim()
          },
          cleanCommit,
          contactSheets,
          diagnostics,
          generatedAt: new Date().toISOString(),
          gpu,
          initialStepEstimates,
          modes: {
            control: resolveTakramOrbitalStepScale("control"),
            treatment: resolveTakramOrbitalStepScale("treatment")
          },
          progresses,
          records,
          reproductionCommand:
            "MIRALITH_TAKRAM_ORBITAL_SAMPLING_CAPTURE=1 pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts --project=desktop-system-chrome --workers=1 --grep 'captures orbital sampling causality A/B'",
          repeats: { progress: 0.06, countPerArm: 1 },
          viewport: { dpr: 1, height: 960, width: 1440 }
        }, null, 2)}\n`);
      writeFileSync(path.join(directory, "review-template.json"),
        `${JSON.stringify({
          schema: "takram-orbital-sampling-causality-review/v1",
          cleanCommit,
          outcome: null,
          instructions:
            "Review cloud-raw structure and stage retention; sample count alone cannot pass.",
          frames: progresses.map((progress) => ({
            downstreamSignalObservable: null,
            nativeSamplingIncreased: null,
            preTemporalSignalRecovered: null,
            progress,
            repeatNoiseExceeded: null,
            structuredRawSignalRecovered: null,
            reviewerNotes: ""
          }))
        }, null, 2)}\n`);
      writeFileSync(path.join(directory, "OUTCOME.md"), `# Takram Orbital Sampling Causality A/B

**State:** \`ORBITAL_SAMPLING_REVIEW_PENDING\`

The clean, two-arm exact-frame capture is complete. Numerical metrics are in \`metrics.json\`; visual adjudication is still required before assigning a causal terminal outcome. A sample-count increase alone is not a visual pass.
`);
    }
  });
});
