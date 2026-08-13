import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "../../packages/lubirth-hero/node_modules/sharp";
import {
  TAKRAM_ORBITAL_GPU_STAGE_NAMES,
  type TakramOrbitalGpuProfileSnapshot
} from
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler";
import {
  resolveTakramOrbitalProductionStage0,
  resolveTakramOrbitalProductionStage1,
  TAKRAM_ORBITAL_PRODUCTION_PROGRESSES,
  type TakramOrbitalGpuPolicyPopulation,
  type TakramOrbitalPerformanceEnvironment,
  type TakramOrbitalProductionStage0Input,
  type TakramOrbitalProductionStage1Input
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy";
import {
  analyzeTakramOrbitalSamplingProgress,
  resolveTakramOrbitalSamplingProgressDecision,
  type TakramOrbitalSamplingProgressMetrics
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics";
import {
  resolveTakramOrbitalSamplingOutcome,
  resolveTakramOrbitalStepScale
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingCausality";
import {
  estimateTakramOrbitalInitialStepMeters,
  resolveTakramOrbitalProductionStepScale,
  type TakramOrbitalProductionStepCandidate
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling";
import type {
  TakramOrbitalFeatureState,
  TakramOrbitalOutput,
  TakramParityPrimaryMarchReadback,
  TakramParitySampleCountReadback,
  TakramParityStageReadbackBuffer,
  TakramParityStageReadbackCapture,
  TakramParityTelemetry
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
import {
  collectOrbitalEvidenceEnvironment,
  createOrbitalStagingRun,
  hashOrbitalFile,
  readActiveOrbitalStagingRun,
  resolveAndPublishStageAtomically,
  resolveOrbitalStagingArtifactPath,
  runGpuPopulation,
  validateOrbitalEvidenceEnvironment,
  verifyFreshCompleteRemount,
  writeOrbitalArtifactManifest,
  writeOrbitalReviewTemplate,
  type OrbitalArtifactRecord,
  type OrbitalEvidenceEnvironment,
  type OrbitalStageCheckpoint,
  type OrbitalStagingRun
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
const stage1FormalDirectory = path.join(policyRoot, "stage-1");
const referenceInputs = Object.freeze({
  nasa: Object.freeze({
    expectedSha256:
      "d1bf3d7478969acf7910ccb0688554a8074650df60f528ca91b84d91a04120eb",
    source: path.resolve(
      process.cwd(),
      "screenshots/current-vs-nasa-20260501/comparison-current-day-aurora.png"
    )
  }),
  takram: Object.freeze({
    expectedSha256:
      "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5",
    source: path.resolve(
      process.cwd(),
      "docs/lubirth-planetary-cloud-evidence/2026-08-05/" +
        "takram-parity/reference/upstream-tokyo.jpg"
    )
  })
});
const stage1Outputs = Object.freeze([
  "cloud-raw",
  "cloud-raw-off",
  "sample-count-debug",
  "primary-march-debug",
  "stage-readback"
] as const);
const stage1ReviewRubric = Object.freeze([
  "Set coherentDensityField to 0, 1, or 2 from cloud-raw only.",
  "Set isolatedFragments to true only for visibly disconnected fragments.",
  "Record aesthetic observations in notes; do not add result or outcome fields."
]);

type Stage1Output = (typeof stage1Outputs)[number];
type Stage1Repeat = "base" | "repeat";

interface Stage1DecodedPng {
  readonly height: number;
  readonly values: Uint8Array;
  readonly width: number;
}

interface Stage1MountedCapture {
  readonly identity: Readonly<Record<string, unknown>>;
  readonly png: Buffer;
  readonly primaryMarch: TakramParityPrimaryMarchReadback | null;
  readonly sampleCount: TakramParitySampleCountReadback | null;
  readonly stageReadback: TakramParityStageReadbackCapture | null;
}

interface Stage1ProgressCapture {
  readonly candidate: TakramOrbitalProductionStepCandidate;
  readonly cloudRaw: Readonly<Record<Stage1Repeat, Stage1MountedCapture>>;
  readonly cloudRawOff: Readonly<Record<Stage1Repeat, Stage1MountedCapture>>;
  readonly primaryMarch: Readonly<Record<Stage1Repeat, Stage1MountedCapture>>;
  readonly progress: (typeof TAKRAM_ORBITAL_PRODUCTION_PROGRESSES)[number];
  readonly sampleCount: Readonly<Record<Stage1Repeat, Stage1MountedCapture>>;
  readonly stageReadback: Readonly<Record<Stage1Repeat, Stage1MountedCapture>>;
}

let noCaptureFormalSnapshot: string | null = null;

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function snapshotFormalEvidenceRoots() {
  const roots = [policyRoot, lookdevRoot];
  return JSON.stringify(roots.map((root) => ({
    exists: existsSync(root),
    files: existsSync(root)
      ? listPolicyFiles(root).map((relative) => {
          const value = readFileSync(path.join(root, relative));
          return {
            byteLength: value.byteLength,
            path: relative,
            sha256: createHash("sha256").update(value).digest("hex")
          };
        })
      : [],
    root
  })));
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

function writeRunBuffer(
  run: OrbitalStagingRun,
  relativePath: string,
  value: Buffer
) {
  const filePath = resolveOrbitalStagingArtifactPath(run, relativePath);
  if (existsSync(filePath)) {
    throw new Error(`stage-1-artifact-already-exists:${relativePath}`);
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
  return Object.freeze({
    byteLength: value.byteLength,
    path: relativePath,
    sha256: createHash("sha256").update(value).digest("hex")
  }) satisfies OrbitalArtifactRecord;
}

function progressLabel(progress: number) {
  return progress.toFixed(2).replace(".", "-");
}

function stage1CaptureKey(input: Readonly<{
  candidate: TakramOrbitalProductionStepCandidate;
  output: Stage1Output;
  progress: number;
  repeat: Stage1Repeat;
}>) {
  return [input.candidate, progressLabel(input.progress), input.output, input.repeat]
    .join(":");
}

function stage1Prefix(input: Readonly<{
  candidate: TakramOrbitalProductionStepCandidate;
  progress: number;
  repeat: Stage1Repeat;
}>) {
  return `${input.candidate}-p${progressLabel(input.progress)}-${input.repeat}`;
}

function stripStageReadbackData(buffer: TakramParityStageReadbackBuffer) {
  const { dataBase64: _dataBase64, ...metadata } = buffer;
  return metadata;
}

function stripReadbackValues<T extends Readonly<{ values: readonly number[] }>>(
  readback: T
) {
  const { values: _values, ...metadata } = readback;
  return metadata;
}

function float32Buffer(values: ArrayLike<number>) {
  const array = Float32Array.from(values);
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
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

function opacityMae(
  left: TakramParityStageReadbackBuffer,
  right: TakramParityStageReadbackBuffer
) {
  if (left.width !== right.width || left.height !== right.height ||
    left.scalar !== right.scalar || left.origin !== right.origin ||
    left.precision !== right.precision) {
    throw new Error("stage-1-opacity-buffer-mismatch");
  }
  const leftValues = decodeStageValues(left);
  const rightValues = decodeStageValues(right);
  if (leftValues.length !== rightValues.length || leftValues.length === 0) {
    throw new Error("stage-1-opacity-buffer-length-mismatch");
  }
  let total = 0;
  for (let offset = 3; offset < leftValues.length; offset += 4) {
    total += Math.abs(leftValues[offset]! - rightValues[offset]!);
  }
  return total / (leftValues.length / 4);
}

async function decodeStage1Png(value: Buffer): Promise<Stage1DecodedPng> {
  const decoded = await sharp(value)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Object.freeze({
    height: decoded.info.height,
    values: new Uint8Array(
      decoded.data.buffer,
      decoded.data.byteOffset,
      decoded.data.byteLength
    ),
    width: decoded.info.width
  });
}

function stage1Identity(
  telemetry: TakramParityTelemetry,
  candidate: TakramOrbitalProductionStepCandidate,
  output: Stage1Output,
  progress: number,
  repeat: Stage1Repeat
) {
  const cameraHeightMeters = telemetry.cameraHeightMeters;
  const perspectiveStepScale = resolveTakramOrbitalProductionStepScale(candidate);
  return Object.freeze({
    allocations: telemetry.orbitalLookdev?.readback.allocations,
    camera: {
      cameraHeightMeters,
      cameraMatrixWorld: telemetry.cameraMatrixWorld,
      cameraPosition: telemetry.cameraPosition,
      earthMatrixWorld: telemetry.earthMatrixWorld
    },
    candidate,
    featureState: telemetry.orbitalLookdev?.readback.featureState,
    frame: telemetry.matchedTemporalFrameCapture,
    historyEpochHash: telemetry.historyEpochHash,
    lookdevBaseKey: telemetry.lookdevBaseKey,
    lookdevMountKey: telemetry.lookdevMountKey,
    output,
    progress,
    rendererFingerprint: telemetry.rendererFingerprint,
    rendererFingerprintHash: telemetry.rendererFingerprintHash,
    repeat,
    requested: telemetry.orbitalLookdev?.requested,
    runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch,
    runtimeReadback: telemetry.orbitalLookdev?.readback,
    stepEstimates: cameraHeightMeters === null
      ? null
      : {
          approximateLimbMeters: estimateTakramOrbitalInitialStepMeters({
            minStepSizeMeters: 50,
            perspectiveStepScale,
            rayNearEstimateMeters: cameraHeightMeters * 2
          }),
          label: "diagnostic estimate; limb rayNear approximated as 2x camera height",
          nearNadirMeters: estimateTakramOrbitalInitialStepMeters({
            minStepSizeMeters: 50,
            perspectiveStepScale,
            rayNearEstimateMeters: cameraHeightMeters
          }),
          perspectiveStepScale
        }
  });
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

async function captureStage1Mounted(input: Readonly<{
  candidate: TakramOrbitalProductionStepCandidate;
  output: Stage1Output;
  page: Page;
  progress: (typeof TAKRAM_ORBITAL_PRODUCTION_PROGRESSES)[number];
  repeat: Stage1Repeat;
  run: OrbitalStagingRun;
}>) {
  const telemetry = await openReady(input.page, route({
    candidate: input.candidate,
    output: input.output,
    progress: input.progress
  }), "same-document");
  expect(telemetry).toMatchObject({
    active: true,
    diagnostic: input.output,
    input: "stock",
    matchedTemporalFrameCapture: {
      cloudsFrame: 32,
      frameLockPass: true,
      nativeFrameCount: 32,
      resolveFrame: 32,
      shadowFrame: 32
    },
    orbitalLookdev: {
      drift: [],
      readback: {
        coverage: 0.55,
        featureState: "native",
        opticalDepthScale: 1,
        preset: "h120",
        renderer: { lightShafts: true, qualityPreset: "high" },
        verticalScale: 1
      },
      requested: {
        coverage: 0.55,
        opticalDepthScale: 1,
        preset: "h120",
        renderer: { lightShafts: true, qualityPreset: "high" },
        samplingPolicy: { candidate: input.candidate, kind: "production" },
        verticalScale: 1
      }
    },
    progress: input.progress,
    view: "opening"
  });
  const captured = await input.page.evaluate(() => ({
    frame: structuredClone(Reflect.get(
      window,
      "__MiraLithTakramMatchedTemporalFrame"
    )) as (Readonly<Record<string, unknown>> & { dataUrl: string }) | undefined,
    primaryMarch: structuredClone(Reflect.get(
      window,
      "__MiraLithTakramPrimaryMarch"
    )) as TakramParityPrimaryMarchReadback | undefined,
    sampleCount: (structuredClone(Reflect.get(
      window,
      "__MiraLithTakramParity"
    )) as TakramParityTelemetry | undefined)?.sampleCountReadback ?? undefined,
    restoration: structuredClone(Reflect.get(
      window,
      "__MiraLithTakramDiagnosticRestoration"
    )) as Readonly<{
      mode: string;
      restored: boolean;
      restoredSourceFnv1a64: string;
      upstreamSourceFnv1a64: string;
    }> | undefined,
    stageReadback: structuredClone(Reflect.get(
      window,
      "__MiraLithTakramStageReadback"
    )) as TakramParityStageReadbackCapture | undefined
  }));
  if (captured.frame === undefined ||
    !captured.frame.dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("stage-1-matched-frame-missing");
  }
  const prefix = stage1Prefix(input);
  const png = Buffer.from(captured.frame.dataUrl.split(",")[1]!, "base64");
  const pngArtifact = writeRunBuffer(
    input.run,
    `captures/${prefix}-${input.output}.png`,
    png
  );
  if (input.output === "primary-march-debug") {
    expect(captured.restoration).toMatchObject({
      mode: "sample-count-debug",
      restored: true
    });
  }
  if (input.output === "stage-readback") {
    expect(captured.restoration).toMatchObject({
      mode: "primary-march-debug",
      restored: true
    });
  }
  if (captured.restoration !== undefined &&
    captured.restoration.restoredSourceFnv1a64 !==
      captured.restoration.upstreamSourceFnv1a64) {
    throw new Error("stage-1-diagnostic-restoration-hash-mismatch");
  }
  const identity = Object.freeze({
    ...stage1Identity(
      telemetry,
      input.candidate,
      input.output,
      input.progress,
      input.repeat
    ),
    precedingDiagnosticRestoration: captured.restoration ?? null
  });
  writeRunJson(
    input.run,
    `identities/${prefix}-${input.output}.json`,
    { identity, screenshot: pngArtifact }
  );

  const sampleCount = input.output === "sample-count-debug"
    ? captured.sampleCount ?? null
    : null;
  if (input.output === "sample-count-debug") {
    if (sampleCount === null) throw new Error("stage-1-sample-readback-missing");
    const lossless = gzipSync(float32Buffer(sampleCount.values), { level: 9 });
    const artifact = writeRunBuffer(
      input.run,
      `lossless/${prefix}-sample-count-rgba-f32le.gz`,
      lossless
    );
    writeRunJson(
      input.run,
      `lossless/${prefix}-sample-count-metadata.json`,
      { artifact, ...stripReadbackValues(sampleCount), channels: 4,
        maxIterationCount: 500, valueCount: sampleCount.values.length }
    );
  }

  const primaryMarch = input.output === "primary-march-debug"
    ? captured.primaryMarch ?? null
    : null;
  if (input.output === "primary-march-debug") {
    if (primaryMarch === null) throw new Error("stage-1-primary-readback-missing");
    const lossless = gzipSync(float32Buffer(primaryMarch.values), { level: 9 });
    const artifact = writeRunBuffer(
      input.run,
      `lossless/${prefix}-primary-march-rgba-f32le.gz`,
      lossless
    );
    writeRunJson(
      input.run,
      `lossless/${prefix}-primary-march-metadata.json`,
      { artifact, ...stripReadbackValues(primaryMarch), channels: 4,
        valueCount: primaryMarch.values.length }
    );
  }

  const stageReadback = input.output === "stage-readback"
    ? captured.stageReadback ?? null
    : null;
  if (input.output === "stage-readback") {
    if (stageReadback === null) throw new Error("stage-1-stage-readback-missing");
    for (const [stageName, buffer] of [
      ["pre-temporal", stageReadback.preTemporal],
      ["resolved-history", stageReadback.resolvedHistory],
      ["final-output", stageReadback.finalOutput]
    ] as const) {
      const raw = Buffer.from(buffer.dataBase64, "base64");
      if (raw.byteLength !== buffer.byteLength) {
        throw new Error(`stage-1-stage-buffer-length-mismatch:${stageName}`);
      }
      if (buffer.scalar === "float32-le") {
        assertFiniteStageBuffer(stageName, buffer);
      }
      const artifact = writeRunBuffer(
        input.run,
        `lossless/${prefix}-${stageName}-${buffer.scalar}.gz`,
        gzipSync(raw, { level: 9 })
      );
      writeRunJson(
        input.run,
        `lossless/${prefix}-${stageName}-metadata.json`,
        { artifact, ...stripStageReadbackData(buffer) }
      );
    }
  }

  return Object.freeze({
    identity,
    png,
    primaryMarch,
    sampleCount,
    stageReadback
  }) satisfies Stage1MountedCapture;
}

async function captureStage1Progress(input: Readonly<{
  candidate: TakramOrbitalProductionStepCandidate;
  page: Page;
  progress: (typeof TAKRAM_ORBITAL_PRODUCTION_PROGRESSES)[number];
  run: OrbitalStagingRun;
}>) {
  // Bound renderer/WebGL lifetime per matrix cell. The ten diagnostic mounts
  // still share one document so allocation generations prove each remount,
  // while the next candidate/progress releases the large lossless readbacks.
  await openReady(input.page, route({
    candidate: input.candidate,
    output: "full",
    progress: input.progress
  }));
  const captures = new Map<string, Stage1MountedCapture>();
  let previousAllocations: NonNullable<
    TakramParityTelemetry["orbitalLookdev"]
  >["readback"]["allocations"] | null = null;
  for (const repeat of ["base", "repeat"] as const) {
    for (const output of stage1Outputs) {
      const capture = await captureStage1Mounted({ ...input, output, repeat });
      const allocations = capture.identity.allocations as NonNullable<
        TakramParityTelemetry["orbitalLookdev"]
      >["readback"]["allocations"];
      if (previousAllocations !== null) {
        verifyFreshCompleteRemount(previousAllocations, allocations);
      }
      previousAllocations = allocations;
      captures.set(stage1CaptureKey({ ...input, output, repeat }), capture);
    }
  }
  const requireCapture = (output: Stage1Output, repeat: Stage1Repeat) => {
    const capture = captures.get(stage1CaptureKey({ ...input, output, repeat }));
    if (capture === undefined) throw new Error("stage-1-capture-missing");
    return capture;
  };
  return Object.freeze({
    candidate: input.candidate,
    cloudRaw: Object.freeze({
      base: requireCapture("cloud-raw", "base"),
      repeat: requireCapture("cloud-raw", "repeat")
    }),
    cloudRawOff: Object.freeze({
      base: requireCapture("cloud-raw-off", "base"),
      repeat: requireCapture("cloud-raw-off", "repeat")
    }),
    primaryMarch: Object.freeze({
      base: requireCapture("primary-march-debug", "base"),
      repeat: requireCapture("primary-march-debug", "repeat")
    }),
    progress: input.progress,
    sampleCount: Object.freeze({
      base: requireCapture("sample-count-debug", "base"),
      repeat: requireCapture("sample-count-debug", "repeat")
    }),
    stageReadback: Object.freeze({
      base: requireCapture("stage-readback", "base"),
      repeat: requireCapture("stage-readback", "repeat")
    })
  }) satisfies Stage1ProgressCapture;
}

function stage1OutputCapture(
  capture: Stage1ProgressCapture,
  output: Stage1Output,
  repeat: Stage1Repeat
) {
  switch (output) {
    case "cloud-raw": return capture.cloudRaw[repeat];
    case "cloud-raw-off": return capture.cloudRawOff[repeat];
    case "sample-count-debug": return capture.sampleCount[repeat];
    case "primary-march-debug": return capture.primaryMarch[repeat];
    case "stage-readback": return capture.stageReadback[repeat];
  }
}

async function buildStage1ContactSheet(input: Readonly<{
  captures: ReadonlyMap<string, Stage1MountedCapture>;
  output: Stage1Output;
}>) {
  const cellWidth = 360;
  const imageHeight = 240;
  const labelHeight = 30;
  const cellHeight = imageHeight + labelHeight;
  const composites: sharp.OverlayOptions[] = [];
  let row = 0;
  for (const progress of TAKRAM_ORBITAL_PRODUCTION_PROGRESSES) {
    for (const repeat of ["base", "repeat"] as const) {
      for (const [column, candidate] of candidates.entries()) {
        const capture = input.captures.get(stage1CaptureKey({
          candidate,
          output: input.output,
          progress,
          repeat
        }));
        if (capture === undefined) {
          throw new Error(`stage-1-contact-capture-missing:${candidate}:${progress}`);
        }
        const left = column * cellWidth;
        const top = row * cellHeight;
        composites.push({
          input: await sharp(capture.png)
            .resize(cellWidth, imageHeight, { fit: "fill" })
            .png()
            .toBuffer(),
          left,
          top
        });
        composites.push({
          input: Buffer.from(
            `<svg width="${cellWidth}" height="${labelHeight}" ` +
            `xmlns="http://www.w3.org/2000/svg"><rect width="100%" ` +
            `height="100%" fill="#10131a"/><text x="8" y="20" ` +
            `fill="#f4f6fa" font-family="monospace" font-size="12">` +
            `${candidate} · p=${progress.toFixed(2)} · ${repeat}</text></svg>`
          ),
          left,
          top: top + imageHeight
        });
      }
      row += 1;
    }
  }
  return await sharp({
    create: {
      background: "#10131a",
      channels: 4,
      height: cellHeight * row,
      width: cellWidth * candidates.length
    }
  }).composite(composites).png().toBuffer();
}

async function buildStage1ReferenceSheet() {
  const width = 1440;
  const imageHeight = 405;
  const labelHeight = 40;
  const sources = [
    ["NASA comparison board", referenceInputs.nasa.source],
    ["Takram upstream control", referenceInputs.takram.source]
  ] as const;
  const composites: sharp.OverlayOptions[] = [];
  for (const [index, [label, source]] of sources.entries()) {
    const top = index * (imageHeight + labelHeight);
    composites.push({
      input: await sharp(source)
        .resize(width, imageHeight, { fit: "contain", background: "#10131a" })
        .png()
        .toBuffer(),
      left: 0,
      top
    });
    composites.push({
      input: Buffer.from(
        `<svg width="${width}" height="${labelHeight}" ` +
        `xmlns="http://www.w3.org/2000/svg"><rect width="100%" ` +
        `height="100%" fill="#10131a"/><text x="12" y="27" ` +
        `fill="#f4f6fa" font-family="monospace" font-size="16">` +
        `${label}</text></svg>`
      ),
      left: 0,
      top: top + imageHeight
    });
  }
  return await sharp({
    create: {
      background: "#10131a",
      channels: 4,
      height: (imageHeight + labelHeight) * sources.length,
      width
    }
  }).composite(composites).png().toBuffer();
}

function assertFiniteStageBuffer(
  label: string,
  buffer: TakramParityStageReadbackBuffer
) {
  const values = decodeStageValues(buffer);
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) {
      throw new Error(`stage-1-stage-buffer-non-finite:${label}:${index}`);
    }
  }
}

function auditStage1Instrumentation(input: Readonly<{
  audit: TakramParitySampleCountReadback["instrumentationAudit"];
  expectedAnchorCounts: Readonly<Record<string, number>>;
  label: string;
}>) {
  const reasons: string[] = [];
  const hashPattern = /^fnv1a-64:[0-9a-f]{16}$/;
  for (const [field, value] of Object.entries({
    injected: input.audit.injectedSourceFnv1a64,
    instrumentation: input.audit.instrumentationFnv1a64,
    upstream: input.audit.upstreamSourceFnv1a64
  })) {
    if (!hashPattern.test(value)) reasons.push(`${input.label}:${field}-hash`);
  }
  if (input.audit.injectedSourceFnv1a64 === input.audit.upstreamSourceFnv1a64) {
    reasons.push(`${input.label}:source-not-instrumented`);
  }
  if (JSON.stringify(input.audit.sourceAnchorCounts) !==
    JSON.stringify(input.expectedAnchorCounts)) {
    reasons.push(`${input.label}:source-anchor-counts`);
  }
  return reasons;
}

async function deriveStage1ProgressMetrics(input: Readonly<{
  capture: Stage1ProgressCapture;
  controlPreTemporal: Readonly<Record<
    Stage1Repeat,
    TakramParityStageReadbackBuffer
  >>;
}>) {
  const baseStage = input.capture.stageReadback.base.stageReadback;
  const repeatStage = input.capture.stageReadback.repeat.stageReadback;
  const sampleCount = input.capture.sampleCount.base.sampleCount;
  const primaryMarch = input.capture.primaryMarch.base.primaryMarch;
  if (baseStage === null || repeatStage === null || sampleCount === null ||
    primaryMarch === null) {
    throw new Error("stage-1-required-lossless-evidence-missing");
  }
  for (const [label, stage] of [
    ["pre-temporal", baseStage.preTemporal],
    ["resolved-history", baseStage.resolvedHistory],
    ["final-output", baseStage.finalOutput]
  ] as const) {
    assertFiniteStageBuffer(label, stage);
  }
  const cloudRaw = await decodeStage1Png(input.capture.cloudRaw.base.png);
  const cloudRawOff = await decodeStage1Png(input.capture.cloudRawOff.base.png);
  const pairedChange = opacityMae(
    baseStage.preTemporal,
    input.controlPreTemporal.base
  );
  const candidateRepeatFloor = opacityMae(
    baseStage.preTemporal,
    repeatStage.preTemporal
  );
  const controlRepeatFloor = opacityMae(
    input.controlPreTemporal.base,
    input.controlPreTemporal.repeat
  );
  const sampleRepeat = input.capture.sampleCount.repeat.sampleCount;
  const primaryRepeat = input.capture.primaryMarch.repeat.primaryMarch;
  if (sampleRepeat === null || primaryRepeat === null) {
    throw new Error("stage-1-repeat-instrumentation-missing");
  }
  const instrumentationReasons = [
    ...auditStage1Instrumentation({
      audit: sampleCount.instrumentationAudit,
      expectedAnchorCounts: {
        marchCloudsSampleCountParameter: 1,
        sampleMediaSampleCountParameter: 1,
        sampleCountDebugOutput: 1
      },
      label: "sample-count-base"
    }),
    ...auditStage1Instrumentation({
      audit: sampleRepeat.instrumentationAudit,
      expectedAnchorCounts: {
        marchCloudsSampleCountParameter: 1,
        sampleMediaSampleCountParameter: 1,
        sampleCountDebugOutput: 1
      },
      label: "sample-count-repeat"
    }),
    ...auditStage1Instrumentation({
      audit: primaryMarch.instrumentationAudit,
      expectedAnchorCounts: {
        caller: 1,
        earlyBreak: 2,
        functionEntry: 1,
        loopBody: 1,
        primaryDebugOutput: 1
      },
      label: "primary-march-base"
    }),
    ...auditStage1Instrumentation({
      audit: primaryRepeat.instrumentationAudit,
      expectedAnchorCounts: {
        caller: 1,
        earlyBreak: 2,
        functionEntry: 1,
        loopBody: 1,
        primaryDebugOutput: 1
      },
      label: "primary-march-repeat"
    })
  ];
  const analyzed = analyzeTakramOrbitalSamplingProgress({
    cloudRaw: { channels: 4, ...cloudRaw, origin: "top-left" },
    cloudRawOff: { channels: 4, ...cloudRawOff, origin: "top-left" },
    pairedChange,
    preTemporal: {
      channels: 4,
      height: baseStage.preTemporal.height,
      origin: baseStage.preTemporal.origin,
      precision: "float32",
      values: decodeStageValues(baseStage.preTemporal),
      width: baseStage.preTemporal.width
    },
    primaryMarch: {
      ...primaryMarch,
      channels: 4,
      values: primaryMarch.values
    },
    repeatNoiseFloor: Math.max(candidateRepeatFloor, controlRepeatFloor),
    resolvedHistory: {
      channels: 4,
      height: baseStage.resolvedHistory.height,
      origin: baseStage.resolvedHistory.origin,
      precision: "float32",
      values: decodeStageValues(baseStage.resolvedHistory),
      width: baseStage.resolvedHistory.width
    },
    sampleCount: {
      ...sampleCount,
      channels: 4,
      maxIterationCount: 500,
      values: sampleCount.values
    }
  });
  const metrics = instrumentationReasons.length === 0
    ? analyzed
    : Object.freeze({
        ...analyzed,
        evidenceValid: false,
        setupInvalidReasons: Object.freeze([
          ...analyzed.setupInvalidReasons,
          ...instrumentationReasons
        ])
      });
  return Object.freeze({
    metricDecision: resolveTakramOrbitalSamplingProgressDecision(metrics),
    metrics,
    repeatEvidence: Object.freeze({
      candidateOpacityMae: candidateRepeatFloor,
      controlOpacityMae: controlRepeatFloor,
      nativeHitMaskMismatch: nativeHitMaskMismatch(
        sampleCount,
        input.capture.sampleCount.repeat.sampleCount
      ),
      opacityMae: candidateRepeatFloor
    })
  });
}

function nativeHitMaskMismatch(
  left: TakramParitySampleCountReadback,
  right: TakramParitySampleCountReadback | null
) {
  if (right === null || left.width !== right.width || left.height !== right.height ||
    left.values.length !== right.values.length) {
    throw new Error("stage-1-sample-repeat-buffer-mismatch");
  }
  let mismatch = 0;
  for (let offset = 3; offset < left.values.length; offset += 4) {
    if ((left.values[offset]! >= 0.5) !== (right.values[offset]! >= 0.5)) {
      mismatch += 1;
    }
  }
  return mismatch / (left.values.length / 4);
}

interface Stage1MachineEvidence {
  readonly candidates: readonly Readonly<{
    candidate: TakramOrbitalProductionStepCandidate;
    progresses: readonly Readonly<{
      metricDecision: ReturnType<
        typeof resolveTakramOrbitalSamplingProgressDecision
      >;
      metrics: TakramOrbitalSamplingProgressMetrics;
      progress: (typeof TAKRAM_ORBITAL_PRODUCTION_PROGRESSES)[number];
      repeatEvidence: Readonly<{
        candidateOpacityMae: number;
        controlOpacityMae: number;
        nativeHitMaskMismatch: number;
        opacityMae: number;
      }>;
    }>[];
  }>[];
  readonly contactSheetHashes: Readonly<Record<string, string>>;
  readonly environment: OrbitalEvidenceEnvironment;
  readonly references: Readonly<Record<string, Readonly<{
    expectedSha256: string;
    sha256: string;
    stagingPath: string;
  }>>>;
  readonly schema: "takram-orbital-production-stage-1-machine/v1";
}

interface Stage1Review {
  readonly entries: readonly Readonly<{
    candidateId: Exclude<TakramOrbitalProductionStepCandidate, "control">;
    captureCommit: string;
    coherentDensityField: 0 | 1 | 2 | null;
    contactSheetHashes: Readonly<Record<string, string>>;
    isolatedFragments: boolean | null;
    notes: string;
    progress: (typeof TAKRAM_ORBITAL_PRODUCTION_PROGRESSES)[number];
    referenceHashes: Readonly<Record<string, string>>;
    viewport: OrbitalEvidenceEnvironment["display"];
  }>[];
  readonly reviewer: Readonly<{ name: string; reviewedAt: string }>;
  readonly rubric: readonly string[];
  readonly runId: string;
  readonly schemaVersion: 1;
  readonly stage: "stage-1";
}

function validateAndBuildStage1ResolverInput(
  machine: Stage1MachineEvidence,
  review: Stage1Review,
  run: OrbitalStagingRun
): TakramOrbitalProductionStage1Input {
  const expectedEntries = machine.candidates.flatMap((candidate) =>
    candidate.candidate === "control"
      ? []
      : candidate.progresses
        .filter(({ metrics }) => metrics.evidenceValid)
        .map(({ progress }) => ({ candidateId: candidate.candidate, progress }))
  );
  if (review.entries.length !== expectedEntries.length) {
    throw new Error("stage-1-human-review-entry-set-mismatch");
  }
  if (JSON.stringify(review.rubric) !== JSON.stringify(stage1ReviewRubric)) {
    throw new Error("stage-1-human-review-rubric-mismatch");
  }
  const reviews = new Map<string, Stage1Review["entries"][number]>();
  for (const [index, entry] of review.entries.entries()) {
    const expected = expectedEntries[index];
    if (expected === undefined || entry.candidateId !== expected.candidateId ||
      entry.progress !== expected.progress) {
      throw new Error("stage-1-human-review-entry-order-mismatch");
    }
    if (entry.captureCommit !== run.captureCommit ||
      JSON.stringify(entry.contactSheetHashes) !==
        JSON.stringify(machine.contactSheetHashes) ||
      JSON.stringify(entry.referenceHashes) !== JSON.stringify(Object.fromEntries(
        Object.entries(machine.references).map(([name, value]) => [name, value.sha256])
      )) || JSON.stringify(entry.viewport) !==
        JSON.stringify(machine.environment.display)) {
      throw new Error("stage-1-human-review-identity-mismatch");
    }
    if ((entry.coherentDensityField !== 0 &&
      entry.coherentDensityField !== 1 &&
      entry.coherentDensityField !== 2) ||
      typeof entry.isolatedFragments !== "boolean" ||
      typeof entry.notes !== "string") {
      throw new Error("stage-1-human-review-incomplete");
    }
    const allowedKeys = [
      "candidateId",
      "captureCommit",
      "coherentDensityField",
      "contactSheetHashes",
      "isolatedFragments",
      "notes",
      "progress",
      "referenceHashes",
      "viewport"
    ];
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(allowedKeys)) {
      throw new Error("stage-1-human-review-fields-invalid");
    }
    reviews.set(`${entry.candidateId}:${entry.progress}`, entry);
  }
  return Object.freeze({
    candidates: machine.candidates.map((candidate) => ({
      candidate: candidate.candidate,
      progresses: candidate.progresses.map((entry) => {
        const boundedReview = reviews.get(
          `${candidate.candidate}:${entry.progress}`
        );
        return {
          metrics: entry.metrics,
          progress: entry.progress,
          visualReview: candidate.candidate === "control"
            ? "debug-color" as const
            : boundedReview?.isolatedFragments === true
              ? "isolated-fragments" as const
              : Number(boundedReview?.coherentDensityField) >= 1
                ? "coherent-density-field" as const
                : "debug-color" as const
        };
      })
    }))
  });
}

function listPolicyFiles(root: string) {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        files.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  };
  walk(root);
  return files;
}

function writePolicyRootFileAtomically(
  relativePath: string,
  value: unknown,
  runId: string
) {
  const destination = path.join(policyRoot, relativePath);
  const temporary = `${destination}.tmp-${runId}`;
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(temporary, typeof value === "string" ? value : stableJson(value));
  renameSync(temporary, destination);
}

async function refreshPolicyRootArtifactManifest(run: OrbitalStagingRun) {
  const artifacts = await Promise.all(listPolicyFiles(policyRoot)
    .filter((relative) => relative !== "artifact-manifest.json")
    .map(async (relative) => {
      const absolute = path.join(policyRoot, relative);
      return {
        byteLength: statSync(absolute).size,
        path: relative,
        sha256: await hashOrbitalFile(absolute)
      };
    }));
  writePolicyRootFileAtomically("artifact-manifest.json", {
    artifacts,
    purpose: "publication",
    runId: run.runId,
    schemaVersion: 1,
    stage: run.stage
  }, run.runId);
}

async function publishStage1PolicyRoot(input: Readonly<{
  captureManifestSha256: string;
  checkpoint: OrbitalStageCheckpoint & Readonly<{ invalidReasons: readonly string[] }>;
  decision: ReturnType<typeof resolveTakramOrbitalProductionStage1>;
  machine: Stage1MachineEvidence;
  review: Stage1Review;
  run: OrbitalStagingRun;
}>) {
  const rootManifest = {
    captureManifestSha256: input.captureManifestSha256,
    contactSheetHashes: input.machine.contactSheetHashes,
    evidenceCommit: input.run.captureCommit,
    productionArtifactCommit:
      input.run.environment.build.productionArtifactCommit,
    runId: input.run.runId,
    schemaVersion: 1,
    stage: 1,
    stage1Outcome: input.decision.state
  };
  const outcome = "# Orbital production sampling\n\n" +
    `State: ${input.decision.state}\n\n` +
    `Healthy candidates: ${input.decision.healthyCandidates.join(", ") || "none"}\n` +
    (input.decision.invalidReasons.length === 0
      ? ""
      : `\nInvalid reasons:\n${input.decision.invalidReasons
        .map((reason) => `- ${reason}`).join("\n")}\n`);
  writePolicyRootFileAtomically("manifest.json", rootManifest, input.run.runId);
  writePolicyRootFileAtomically("metrics.json", input.machine, input.run.runId);
  writePolicyRootFileAtomically(
    "metric-decision.json",
    input.decision,
    input.run.runId
  );
  writePolicyRootFileAtomically(
    "visual-review.json",
    input.review,
    input.run.runId
  );
  writePolicyRootFileAtomically(
    "checkpoint.json",
    input.checkpoint,
    input.run.runId
  );
  writePolicyRootFileAtomically("OUTCOME.md", outcome, input.run.runId);
  await refreshPolicyRootArtifactManifest(input.run);
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
    noCaptureFormalSnapshot = snapshotFormalEvidenceRoots();
  }
});

test.afterEach(() => {
  if (formalCaptureCommand === "") {
    expect(snapshotFormalEvidenceRoots()).toBe(noCaptureFormalSnapshot);
    noCaptureFormalSnapshot = null;
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

test("formal Stage 1 capture writes the complete immutable review run", async ({
  page
}) => {
  test.skip(formalCaptureCommand !== "stage-1-capture");
  test.setTimeout(3_600_000);
  expect(existsSync(stage1FormalDirectory)).toBe(false);

  const stage0Checkpoint = JSON.parse(readFileSync(
    path.join(policyRoot, "checkpoint.json"),
    "utf8"
  )) as OrbitalStageCheckpoint;
  const stage0Manifest = JSON.parse(readFileSync(
    path.join(policyRoot, "manifest.json"),
    "utf8"
  )) as Readonly<{ productionArtifactCommit: string }>;
  await openReady(page, route({ candidate: "confirmed" }));
  const environment = await collectOrbitalEvidenceEnvironment({
    page,
    productionArtifactCommit: stage0Manifest.productionArtifactCommit
  });
  expect(environment.build.productionArtifactCommit)
    .toBe(stage0Manifest.productionArtifactCommit);
  const run = await createOrbitalStagingRun({
    captureCommand: formalCaptureCommand,
    environment,
    formalDirectory: stage1FormalDirectory,
    precedingCheckpoint: stage0Checkpoint,
    stage: "stage-1"
  });
  expect(run).not.toBeNull();
  if (run === null) throw new Error("stage-1-staging-run-not-created");

  const references: Stage1MachineEvidence["references"] = Object.freeze(
    Object.fromEntries(await Promise.all(Object.entries(referenceInputs).map(
      async ([name, reference]) => {
        const actualSha256 = await hashOrbitalFile(reference.source);
        if (actualSha256 !== reference.expectedSha256) {
          throw new Error(`stage-1-reference-hash-mismatch:${name}`);
        }
        const extension = path.extname(reference.source);
        const stagingPath = `references/${name}${extension}`;
        const artifact = writeRunBuffer(
          run,
          stagingPath,
          readFileSync(reference.source)
        );
        return [name, {
          expectedSha256: reference.expectedSha256,
          sha256: artifact.sha256,
          stagingPath
        }] as const;
      }
    )))
  );

  const contactCaptures = new Map<string, Stage1MountedCapture>();
  const controlPreTemporal = new Map<number, Readonly<Record<
    Stage1Repeat,
    TakramParityStageReadbackBuffer
  >>>();
  const machineCandidates: Array<Stage1MachineEvidence["candidates"][number]> = [];
  for (const candidate of candidates) {
    const progressRecords: Array<
      Stage1MachineEvidence["candidates"][number]["progresses"][number]
    > = [];
    for (const progress of TAKRAM_ORBITAL_PRODUCTION_PROGRESSES) {
      const capture = await captureStage1Progress({
        candidate,
        page,
        progress,
        run
      });
      for (const output of stage1Outputs) {
        for (const repeat of ["base", "repeat"] as const) {
          const mounted = stage1OutputCapture(capture, output, repeat);
          contactCaptures.set(stage1CaptureKey({
            candidate,
            output,
            progress,
            repeat
          }), Object.freeze({
            identity: mounted.identity,
            png: mounted.png,
            primaryMarch: null,
            sampleCount: null,
            stageReadback: null
          }));
        }
      }
      const baseStage = capture.stageReadback.base.stageReadback;
      const repeatStage = capture.stageReadback.repeat.stageReadback;
      if (baseStage === null || repeatStage === null) {
        throw new Error("stage-1-control-pre-temporal-missing");
      }
      if (candidate === "control") {
        controlPreTemporal.set(progress, Object.freeze({
          base: baseStage.preTemporal,
          repeat: repeatStage.preTemporal
        }));
      }
      const control = controlPreTemporal.get(progress);
      if (control === undefined) {
        throw new Error(`stage-1-control-capture-missing:${progress}`);
      }
      const derived = await deriveStage1ProgressMetrics({
        capture,
        controlPreTemporal: control
      });
      progressRecords.push(Object.freeze({ ...derived, progress }));
    }
    machineCandidates.push(Object.freeze({
      candidate,
      progresses: Object.freeze(progressRecords)
    }));
  }

  const contactSheetHashes: Record<string, string> = {};
  for (const output of stage1Outputs) {
    const relativePath = `contact-sheets/${output}.png`;
    const artifact = writeRunBuffer(
      run,
      relativePath,
      await buildStage1ContactSheet({ captures: contactCaptures, output })
    );
    contactSheetHashes[relativePath] = artifact.sha256;
  }
  const referenceSheetPath = "contact-sheets/frozen-references.png";
  const referenceSheet = writeRunBuffer(
    run,
    referenceSheetPath,
    await buildStage1ReferenceSheet()
  );
  contactSheetHashes[referenceSheetPath] = referenceSheet.sha256;

  const machine: Stage1MachineEvidence = Object.freeze({
    candidates: Object.freeze(machineCandidates),
    contactSheetHashes: Object.freeze(contactSheetHashes),
    environment,
    references,
    schema: "takram-orbital-production-stage-1-machine/v1"
  });
  writeRunJson(run, "metrics.json", machine);
  writeRunJson(run, "metric-decision.json", {
    candidates: machine.candidates.map((candidate) => ({
      candidate: candidate.candidate,
      progresses: candidate.progresses.map((entry) => ({
        decision: entry.metricDecision,
        progress: entry.progress
      }))
    })),
    schema: "takram-orbital-production-stage-1-metric-decision/v1"
  });
  writeRunJson(run, "references.json", references);
  writeRunJson(run, "contact-sheet-hashes.json", contactSheetHashes);
  writeRunJson(run, "resolver-inputs.json", machine);
  const referenceHashes = Object.fromEntries(Object.entries(references)
    .map(([name, value]) => [name, value.sha256]));
  await writeOrbitalReviewTemplate({
    entries: machine.candidates.flatMap((candidate) =>
      candidate.candidate === "control"
        ? []
        : candidate.progresses
          .filter(({ metrics }) => metrics.evidenceValid)
          .map(({ progress }) => ({
            candidateId: candidate.candidate,
            captureCommit: run.captureCommit,
            coherentDensityField: null,
            contactSheetHashes,
            isolatedFragments: null,
            notes: "",
            progress,
            referenceHashes,
            viewport: environment.display
          }))
    ),
    rubric: stage1ReviewRubric,
    run
  });
  await writeOrbitalArtifactManifest(run);
  expect(existsSync(stage1FormalDirectory)).toBe(false);
});

test("formal Stage 1 resolve publishes only a human-reviewed pure decision", async ({
  page
}) => {
  test.skip(formalCaptureCommand !== "stage-1-resolve");
  test.setTimeout(900_000);
  expect(existsSync(stage1FormalDirectory)).toBe(false);
  const run = readActiveOrbitalStagingRun(process.cwd(), "stage-1");
  if (process.env.MIRALITH_TAKRAM_ORBITAL_STAGING_RUN !== run.runId) {
    throw new Error("stage-1-explicit-staging-run-mismatch");
  }
  const machine = JSON.parse(readFileSync(
    path.join(run.root, "resolver-inputs.json"),
    "utf8"
  )) as Stage1MachineEvidence;
  const review = JSON.parse(readFileSync(
    path.join(run.root, "visual-review.json"),
    "utf8"
  )) as Stage1Review;
  const resolverInput = validateAndBuildStage1ResolverInput(machine, review, run);
  const decision = resolveTakramOrbitalProductionStage1(resolverInput);
  const checkpoint = Object.freeze({
    authorizedNextStage: decision.state === "ORBITAL_PRODUCTION_STAGE_2_READY"
      ? 2
      : null,
    invalidReasons: decision.invalidReasons,
    outcome: decision.state,
    stage: 1
  });
  const captureManifestSha256 = await hashOrbitalFile(path.join(
    run.root,
    "artifact-manifest.json"
  ));
  await openReady(page, route({ candidate: "confirmed" }));
  const currentEnvironment = await collectOrbitalEvidenceEnvironment({
    page,
    productionArtifactCommit: run.environment.build.productionArtifactCommit
  });
  await resolveAndPublishStageAtomically({
    currentEnvironment,
    expectedArtifactManifestSha256: captureManifestSha256,
    expectedContactSheetHashes: machine.contactSheetHashes,
    formalDirectory: stage1FormalDirectory,
    publicationFiles: {
      "checkpoint.json": checkpoint,
      "decision.json": decision,
      "resolution.json": {
        captureManifestSha256,
        resolver: "resolveTakramOrbitalProductionStage1",
        resolverInput,
        state: decision.state
      }
    },
    requireHumanReview: true,
    resolverInputs: machine,
    run
  });
  await publishStage1PolicyRoot({
    captureManifestSha256,
    checkpoint,
    decision,
    machine,
    review,
    run
  });
  expect(JSON.parse(readFileSync(
    path.join(stage1FormalDirectory, "checkpoint.json"),
    "utf8"
  ))).toEqual(checkpoint);
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
