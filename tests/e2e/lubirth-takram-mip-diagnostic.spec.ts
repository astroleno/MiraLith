import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  evaluateTakramMipDiagnostic,
  TAKRAM_MIP_DIAGNOSTIC_MIN_DISTINCT_PIXELS,
  TAKRAM_MIP_DIAGNOSTIC_MIN_VALID_SAMPLES,
  TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE,
  type TakramMipDiagnosticPopulationInput,
  type TakramMipDiagnosticScale
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramMipDiagnostic";
import { writeTakramCloudScaleEvidenceAtomically } from "../helpers/takramCloudScaleEvidence";

test.setTimeout(900_000);

const formalCaptureEnabled =
  process.env.MIRALITH_TAKRAM_MIP_DIAGNOSTIC_CAPTURE === "1";
const evidenceDirectory = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale/task-m-mip-diagnostic"
);

type MipCaptureMetadata = {
  completed: boolean;
  scale: 1 | 80 | 120 | 160;
  targetNativeFrames: readonly [16, 32, 48];
  runtimeFragmentShaderFnv1a64: string;
  frames: Array<{
    nativeFrame: 16 | 32 | 48;
    recordCount: number;
    lastSampleOrdinal: number;
    recordStride: 9;
    byteLength: number;
    dataBase64: string;
    temporalFrame: {
      cloudsFrame: number;
      resolveFrame: number;
      shadowFrame: number;
      frameLockPass: boolean;
      historyEpochHash: string;
    };
  }>;
};

async function openMipDiagnostic(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(200);
  const root = page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute("data-runtime", "ready", { timeout: 300_000 });
  return page.evaluate(() => {
    const capture = Reflect.get(window, "__MiraLithTakramMipDiagnostic") as
      | MipCaptureMetadata
      | undefined;
    const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
      | {
        active?: boolean;
        diagnostic?: string;
        mipDiagnostic?: MipCaptureMetadata;
        cloudScale?: null | {
          readback?: {
            mipDistancePatch?: {
              active?: boolean;
              nativeCoefficientOccurrences?: number;
              patchedCoefficientOccurrences?: number;
            };
          };
        };
      }
      | undefined;
    if (!capture) return { capture: null, telemetry: telemetry ?? null };
    return {
      capture: {
        ...capture,
        frames: capture.frames.map(({ dataBase64: _dataBase64, ...frame }) => frame)
      },
      telemetry: telemetry ?? null
    };
  });
}

function decodeFloat32LittleEndian(dataBase64: string) {
  const bytes = Buffer.from(dataBase64, "base64");
  if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error("Mip diagnostic buffer is not aligned to float32 records.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Float32Array(bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
  }
  return { bytes, values };
}

async function readFullMipCapture(page: Page) {
  return page.evaluate(() => Reflect.get(window, "__MiraLithTakramMipDiagnostic")) as
    Promise<MipCaptureMetadata | undefined>;
}

test("captures read-only exact-frame mip populations for healthy and scaled stock", async ({
  page
}) => {
  const healthy = await openMipDiagnostic(
    page,
    "/lubirth-takram-parity-spike?input=stock&view=control&diagnostic=mip-diagnostic"
  );
  const scaled = await openMipDiagnostic(
    page,
    "/lubirth-takram-parity-spike?input=stock&view=opening&progress=0.06" +
      "&cloudScale=120&cloudCoverage=parity&stockWeather=similarity" +
      "&diagnostic=mip-diagnostic"
  );

  for (const [expectedScale, result] of [[1, healthy], [120, scaled]] as const) {
    expect(result.telemetry).toMatchObject({
      active: true,
      diagnostic: "mip-diagnostic",
      mipDiagnostic: {
        completed: true,
        scale: expectedScale,
        targetNativeFrames: [16, 32, 48]
      }
    });
    expect(result.capture).toMatchObject({
      completed: true,
      scale: expectedScale,
      targetNativeFrames: [16, 32, 48]
    });
    expect(result.capture?.runtimeFragmentShaderFnv1a64)
      .toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
    expect(result.capture?.frames.map((frame) => frame.nativeFrame))
      .toEqual([16, 32, 48]);
    for (const frame of result.capture?.frames ?? []) {
      expect(frame.recordCount).toBeGreaterThan(0);
      expect(frame.byteLength).toBe(frame.recordCount * frame.recordStride * 4);
      expect(frame.temporalFrame).toMatchObject({
        cloudsFrame: frame.nativeFrame,
        resolveFrame: frame.nativeFrame,
        shadowFrame: frame.nativeFrame,
        frameLockPass: true
      });
    }
  }
  expect(healthy.capture?.runtimeFragmentShaderFnv1a64)
    .toBe(scaled.capture?.runtimeFragmentShaderFnv1a64);
});

test("rejects mip diagnostics on V3", async ({ page }) => {
  const response = await page.goto(
    "/lubirth-takram-parity-spike?input=v3&view=opening&diagnostic=mip-diagnostic"
  );
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-takram-parity-route='true']"))
    .toHaveAttribute("data-runtime", "invalid-query");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("Conditional Task M records the frozen mip causality populations", async ({
  browser,
  page
}) => {
  test.skip(!formalCaptureEnabled, "formal Task M evidence requires explicit capture mode");
  expect(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
    .toBe("");

  const populationQueries: Array<{
    scale: TakramMipDiagnosticScale;
    query: string;
  }> = [
    {
      scale: 1,
      query: "/lubirth-takram-parity-spike?input=stock&view=control&diagnostic=mip-diagnostic"
    },
    ...([80, 120, 160] as const).map((scale) => ({
      scale,
      query: "/lubirth-takram-parity-spike?input=stock&view=opening&progress=0.06" +
        `&cloudScale=${scale}&cloudCoverage=parity&stockWeather=similarity` +
        "&diagnostic=mip-diagnostic"
    }))
  ];
  const populations: TakramMipDiagnosticPopulationInput[] = [];
  const artifacts: Array<{
    scale: TakramMipDiagnosticScale;
    query: string;
    runtimeFragmentShaderFnv1a64: string;
    telemetry: unknown;
    frames: Array<Record<string, unknown>>;
    rawFrames: Array<{ file: string; bytes: Buffer }>;
  }> = [];

  for (const populationQuery of populationQueries) {
    const result = await openMipDiagnostic(page, populationQuery.query);
    const capture = await readFullMipCapture(page);
    expect(capture).toMatchObject({
      completed: true,
      scale: populationQuery.scale,
      targetNativeFrames: [16, 32, 48]
    });
    if (populationQuery.scale !== 1) {
      expect(result.telemetry?.cloudScale?.readback?.mipDistancePatch).toMatchObject({
        active: false,
        nativeCoefficientOccurrences: 1,
        patchedCoefficientOccurrences: 0
      });
    }
    const frames = capture!.frames.map((frame) => {
      expect(frame.recordStride).toBe(TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE);
      const decoded = decodeFloat32LittleEndian(frame.dataBase64);
      expect(decoded.bytes.byteLength).toBe(frame.byteLength);
      expect(decoded.values.length)
        .toBe(frame.recordCount * TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE);
      const file = `raw/population-s${populationQuery.scale}-frame${String(frame.nativeFrame)
        .padStart(3, "0")}.f32le`;
      return {
        metadata: {
          nativeFrame: frame.nativeFrame,
          width: frame.width,
          height: frame.height,
          recordCount: frame.recordCount,
          lastSampleOrdinal: frame.lastSampleOrdinal,
          recordStride: frame.recordStride,
          scalar: "float32-le",
          byteLength: frame.byteLength,
          sha256: createHash("sha256").update(decoded.bytes).digest("hex"),
          temporalFrame: frame.temporalFrame,
          file
        },
        population: { nativeFrame: frame.nativeFrame, records: decoded.values },
        raw: { file, bytes: decoded.bytes }
      };
    });
    populations.push({
      scale: populationQuery.scale,
      frames: frames.map((frame) => frame.population)
    });
    artifacts.push({
      scale: populationQuery.scale,
      query: populationQuery.query,
      runtimeFragmentShaderFnv1a64: capture!.runtimeFragmentShaderFnv1a64,
      telemetry: result.telemetry,
      frames: frames.map((frame) => frame.metadata),
      rawFrames: frames.map((frame) => frame.raw)
    });
  }

  const healthy = populations.find((population) => population.scale === 1)!;
  const candidates = populations.filter((population) => population.scale !== 1);
  const evaluation = evaluateTakramMipDiagnostic({ healthy, candidates });
  const shaderIdentities = new Set(
    artifacts.map((artifact) => artifact.runtimeFragmentShaderFnv1a64)
  );
  expect(shaderIdentities.size).toBe(1);
  expect(artifacts.every((artifact) =>
    artifact.frames.every((frame) =>
      (frame.temporalFrame as { frameLockPass?: boolean }).frameLockPass === true
    )
  )).toBe(true);

  const gpu = await page.evaluate(() => {
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
  const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8"
  }).trim();
  const captureCommand =
    "MIRALITH_TAKRAM_MIP_DIAGNOSTIC_CAPTURE=1 pnpm exec playwright test " +
    "-c playwright.takram-parity-system-chrome.config.ts " +
    "lubirth-takram-mip-diagnostic.spec.ts --headed --grep \"Conditional Task M\"";
  const decisionMeaning = evaluation.decision ===
    "MIP_CAUSAL_THRESHOLD_PASS_PATCH_A_B_REQUIRES_AUTHORIZATION"
    ? "Mip causality met the frozen threshold; only the single mipDistanceScale=1/S A/B is eligible, and it remains unimplemented."
    : evaluation.decision === "MIP_CAUSAL_HYPOTHESIS_REJECTED"
      ? "Mip causality failed the frozen threshold; stop the mip direction and plan changes to vertical form, optical density, or atmosphere composition."
      : "The frozen diagnostic population was not sufficient to decide mip causality.";
  const manifest = {
    schemaVersion: 1,
    baseCommit,
    generatedAt: new Date().toISOString(),
    browser: {
      executable: process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      version: browser.version()
    },
    captureCommand,
    gpu,
    viewport: page.viewportSize(),
    scope: {
      diagnostic: "READ_ONLY_MIP_CAUSALITY",
      input: "stock",
      mipShaderModified: false,
      v3Run: false,
      task0PRun: false,
      originalTask0To8Run: false,
      openingProgress: 0.06,
      targetNativeFrames: [16, 32, 48]
    },
    thresholds: {
      minimumDistinctPixels: TAKRAM_MIP_DIAGNOSTIC_MIN_DISTINCT_PIXELS,
      minimumValidSamples: TAKRAM_MIP_DIAGNOSTIC_MIN_VALID_SAMPLES,
      healthyRoughWeatherHitFraction: 0.25,
      healthyPreTemporalOpacityP75: 0.05,
      candidateMipExcessAtLeastOneFraction: 0.75,
      candidateMipExcessP50: 1,
      candidateRoughWeatherHitFraction: 0.25,
      requiredScales: "S=120 and at least one of S=80/S=160"
    },
    runtimeFragmentShaderFnv1a64: artifacts[0]!.runtimeFragmentShaderFnv1a64,
    populations: artifacts.map(({ rawFrames: _rawFrames, ...artifact }) => artifact),
    evaluation
  };
  const checkpoint = {
    decision: evaluation.decision,
    decisionMeaning,
    mipDistancePatchAuthorized: false,
    mipDistancePatchImplemented: false,
    v3Locked: true,
    task0PLocked: true,
    task3To6Locked: true,
    originalTask0To8Locked: true,
    nextAction: evaluation.decision ===
      "MIP_CAUSAL_THRESHOLD_PASS_PATCH_A_B_REQUIRES_AUTHORIZATION"
      ? "REQUEST_EXPLICIT_AUTHORIZATION_FOR_SINGLE_MIP_DISTANCE_SCALE_A_B"
      : evaluation.decision === "MIP_CAUSAL_HYPOTHESIS_REJECTED"
        ? "STOP_MIP_DIRECTION_AND_WRITE_NEW_REPRESENTATION_PLAN"
        : "REPAIR_DIAGNOSTIC_POPULATION_BEFORE_ANY_PATCH"
  };

  await writeTakramCloudScaleEvidenceAtomically({
    enabled: formalCaptureEnabled,
    finalDirectory: evidenceDirectory,
    build: async (stagingDirectory) => {
      for (const artifact of artifacts) {
        for (const raw of artifact.rawFrames) {
          const absolute = path.join(stagingDirectory, raw.file);
          mkdirSync(path.dirname(absolute), { recursive: true });
          writeFileSync(absolute, raw.bytes);
        }
      }
      writeFileSync(
        path.join(stagingDirectory, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`
      );
      writeFileSync(
        path.join(stagingDirectory, "checkpoint.json"),
        `${JSON.stringify(checkpoint, null, 2)}\n`
      );
      writeFileSync(
        path.join(stagingDirectory, "README.md"),
        `# Conditional Task M — read-only mip causality\n\n` +
        `Decision: \`${evaluation.decision}\`.\n\n${decisionMeaning}\n\n` +
        `The capture compares the official S=1 stock control with stock ` +
        `S=80/120/160 similarity populations at opening progress 0.06 and ` +
        `native frames 16/32/48. Raw float32 joint records are persisted under ` +
        `\`raw/\`. The mip shader coefficient was not changed. V3, Task 0P, ` +
        `Task 3–6, and the original Task 0–8 did not run and remain locked.\n\n` +
        `## Reproduce\n\n\`\`\`bash\n${captureCommand}\n\`\`\`\n`
      );
    }
  });
});
