import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_LUBIRTH_ASSETS,
  LUBIRTH_REFERENCE_ABSORPTION_DESKTOP_ASSETS,
  LUBIRTH_REFERENCE_ABSORPTION_MOBILE_ASSETS,
  RELIEF_SCATTERING_CANDIDATES,
  RELIEF_SCATTERING_CONFIG,
  RELIEF_SCATTERING_GLSL,
  referenceVariantUsesCloudScattering,
  referenceVariantUsesEarthMaterial,
  resolveBeerTransmittance,
  resolveCheapMultiScatter,
  resolveHenyeyGreenstein,
  resolveLandingReferenceAbsorptionVariant
} from "../../packages/lubirth-hero/src";

test.setTimeout(120_000);

interface ReferenceEarthTelemetry {
  active: true;
  gpuTimer: {
    disjointResetCount: number;
    sampleCount: number;
    supported: boolean;
  };
  materialFragmentTextureReads: 0 | 1;
  materialMapActive: boolean;
  materialMapSource: string | null;
  materialModel: "baseline" | "packed-v1";
  referenceAbsorptionVariant: string;
}

interface ReferenceCloudTelemetry {
  active: true;
  densityIntegration: "front-to-back";
  fragmentTextureReads: 3 | 4;
  premultipliedAlpha: true;
  referenceAbsorptionVariant: string;
}

declare global {
  interface Window {
    __MiraLithLuBirthEarthSurfaceLiteV2?: ReferenceEarthTelemetry;
    __MiraLithLuBirthReliefCloud?: ReferenceCloudTelemetry;
  }
}

function createSpikeUrl(overrides: Record<string, string> = {}) {
  return `/lubirth-reference-absorption-spike?${new URLSearchParams({
    copy: "hidden",
    progress: "0.22",
    quality: "high",
    visualTest: "pixels",
    ...overrides
  }).toString()}`;
}

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readPngDimensions(filePath: string) {
  const bytes = readFileSync(filePath);
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16)
  };
}

function readKtx2Dimensions(filePath: string) {
  const bytes = readFileSync(filePath);
  expect(bytes.subarray(0, 12)).toEqual(
    Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  return {
    height: bytes.readUInt32LE(24),
    width: bytes.readUInt32LE(20)
  };
}

async function waitForReferenceAbsorptionRoute(
  page: import("@playwright/test").Page,
  variant: string
) {
  await expect(page.locator(".lubirth-reference-absorption-spike")).toHaveAttribute(
    "data-reference-absorption-variant",
    variant,
    { timeout: 25_000 }
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-reference-absorption-variant",
    variant,
    { timeout: 25_000 }
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-cloud-mode",
    "relief-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-atmosphere-mode",
    "limb-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-post-effect-mode",
    "off"
  );
  await expect
    .poll(() => page.evaluate(() => ({
      cloud: window.__MiraLithLuBirthReliefCloud,
      earth: window.__MiraLithLuBirthEarthSurfaceLiteV2
    })), { timeout: 25_000 })
    .toMatchObject({
      cloud: {
        active: true,
        densityIntegration: "front-to-back",
        premultipliedAlpha: true,
        referenceAbsorptionVariant: variant
      },
      earth: {
        active: true,
        referenceAbsorptionVariant: variant
      }
    });
}

test("resolves the query-only reference absorption variant contract", () => {
  expect(resolveLandingReferenceAbsorptionVariant("earth-material-v1"))
    .toBe("earth-material-v1");
  expect(resolveLandingReferenceAbsorptionVariant("cloud-scattering-v1"))
    .toBe("cloud-scattering-v1");
  expect(resolveLandingReferenceAbsorptionVariant("combined-v1"))
    .toBe("combined-v1");
  expect(resolveLandingReferenceAbsorptionVariant("anything-else"))
    .toBe("baseline");
  expect(referenceVariantUsesEarthMaterial("combined-v1")).toBe(true);
  expect(referenceVariantUsesCloudScattering("combined-v1")).toBe(true);
});

test("locks the Relief-lite scattering math and fixed candidate space", () => {
  expect(resolveHenyeyGreenstein(1, 0.72))
    .toBeGreaterThan(resolveHenyeyGreenstein(0, 0.72));
  expect(resolveHenyeyGreenstein(0, 0.72))
    .toBeGreaterThan(resolveHenyeyGreenstein(-1, 0.72));
  expect(resolveBeerTransmittance(0)).toBe(1);
  expect(resolveBeerTransmittance(8)).toBeLessThan(0.001);
  expect(resolveCheapMultiScatter(0, 0.72, 0.28)).toBeGreaterThan(0);
  expect(resolveCheapMultiScatter(8, 0.72, 0.28)).toBeLessThan(
    resolveCheapMultiScatter(1, 0.72, 0.28)
  );

  expect(RELIEF_SCATTERING_CONFIG).toEqual({
    octaves: [
      { gScale: 1, strengthPower: 0, tauScale: 1 },
      { gScale: 0.5, strengthPower: 1, tauScale: 0.25 },
      { gScale: 0.25, strengthPower: 2, tauScale: 0.0625 }
    ],
    phaseEpsilon: 0.001
  });
  expect(RELIEF_SCATTERING_CANDIDATES).toEqual([
    { id: "g065-ms018", g: 0.65, multiScatter: 0.18 },
    { id: "g065-ms028", g: 0.65, multiScatter: 0.28 },
    { id: "g072-ms018", g: 0.72, multiScatter: 0.18 },
    { id: "g072-ms028", g: 0.72, multiScatter: 0.28 },
    { id: "g078-ms018", g: 0.78, multiScatter: 0.18 },
    { id: "g078-ms028", g: 0.78, multiScatter: 0.28 }
  ]);
  expect(RELIEF_SCATTERING_GLSL).toContain(
    `max(1.0 + gg - 2.0 * g * cosTheta, ${RELIEF_SCATTERING_CONFIG.phaseEpsilon})`
  );
  expect(RELIEF_SCATTERING_GLSL).toContain("float cheapMultiScatter");
  expect(RELIEF_SCATTERING_GLSL).not.toMatch(/texture/i);

  for (let tau = 0; tau <= 12; tau += 0.25) {
    for (let cosTheta = -1; cosTheta <= 1; cosTheta += 0.1) {
      const phase = resolveHenyeyGreenstein(cosTheta, 0.72);
      const transmission = resolveBeerTransmittance(tau);
      const scatter = resolveCheapMultiScatter(tau, 0.72, 0.28, cosTheta);

      expect(Number.isFinite(phase)).toBe(true);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(transmission)).toBe(true);
      expect(transmission).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(scatter)).toBe(true);
      expect(scatter).toBeGreaterThanOrEqual(0);
    }
  }
});

test("keeps packed Earth material assets linear, bounded, and spike-only", () => {
  const textureDir = path.resolve(
    process.cwd(),
    "apps/site/public/assets/lubirth/textures"
  );
  const manifestPath = path.join(textureDir, "earth-material-lite-v1.manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    channelLayout: string;
    colorSpace: string;
    generator: { path: string; sha256: string };
    inputs: Array<{ path: string; sha256: string }>;
    outputs: Record<string, { height: number; sha256: string; width: number }>;
  };
  const expectedOutputs = {
    "earth-material-lite-v1-1k.ktx2": { height: 512, width: 1024 },
    "earth-material-lite-v1-1k.png": { height: 512, width: 1024 },
    "earth-material-lite-v1-2k.ktx2": { height: 1024, width: 2048 },
    "earth-material-lite-v1-2k.png": { height: 1024, width: 2048 }
  };

  expect(manifest.channelLayout).toBe("rg-normalxy-b-specular-a-roughness");
  expect(manifest.colorSpace).toBe("linear");
  expect(manifest.generator.path).toBe(
    "packages/lubirth-hero/scripts/generate-earth-material-lite.mjs"
  );
  expect(manifest.generator.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(manifest.inputs.map((input) => input.path).sort()).toEqual([
    "apps/site/public/assets/lubirth/textures/earth-displacement-8k.jpg",
    "apps/site/public/assets/lubirth/textures/earth-specular-4k.png"
  ]);
  expect(manifest.inputs.every((input) => /^[a-f0-9]{64}$/.test(input.sha256))).toBe(true);

  for (const [fileName, dimensions] of Object.entries(expectedOutputs)) {
    const filePath = path.join(textureDir, fileName);
    const output = manifest.outputs[fileName];
    expect(output).toMatchObject(dimensions);
    expect(output.sha256).toBe(sha256(filePath));
    expect(fileName.endsWith(".png")
      ? readPngDimensions(filePath)
      : readKtx2Dimensions(filePath)
    ).toEqual(dimensions);
  }

  expect(statSync(path.join(textureDir, "earth-material-lite-v1-2k.ktx2")).size)
    .toBeLessThanOrEqual(2.8 * 1024 * 1024);
  expect(statSync(path.join(textureDir, "earth-material-lite-v1-1k.ktx2")).size)
    .toBeLessThanOrEqual(0.8 * 1024 * 1024);
  expect(DEFAULT_LUBIRTH_ASSETS.earthMaterialLite).toBeUndefined();
  expect(LUBIRTH_REFERENCE_ABSORPTION_DESKTOP_ASSETS.earthMaterialLite).toMatchObject({
    colorSpace: "linear",
    format: "ktx2",
    height: 1024,
    src: "/assets/lubirth/textures/earth-material-lite-v1-2k.ktx2",
    width: 2048
  });
  expect(LUBIRTH_REFERENCE_ABSORPTION_MOBILE_ASSETS.earthMaterialLite).toMatchObject({
    colorSpace: "linear",
    format: "ktx2",
    height: 512,
    src: "/assets/lubirth/textures/earth-material-lite-v1-1k.ktx2",
    width: 1024
  });
});

test("routes only the dedicated spike through the reference absorption control plane", async ({
  page
}) => {
  await page.goto(createSpikeUrl({ variant: "earth-material-v1" }));
  await waitForReferenceAbsorptionRoute(page, "earth-material-v1");

  await page.goto(createSpikeUrl({ variant: "anything-else" }));
  await waitForReferenceAbsorptionRoute(page, "baseline");
});

test("uses one packed material read only when the spike asset is ready", async ({ page }) => {
  await page.goto(createSpikeUrl({
    referenceAbsorptionGpuTimer: "on",
    variant: "baseline"
  }));
  await waitForReferenceAbsorptionRoute(page, "baseline");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthEarthSurfaceLiteV2))
    .toMatchObject({
      active: true,
      gpuTimer: {
        disjointResetCount: expect.any(Number),
        sampleCount: expect.any(Number),
        supported: expect.any(Boolean)
      },
      materialFragmentTextureReads: 0,
      materialMapActive: false,
      materialMapSource: null,
      materialModel: "baseline"
    });

  await page.goto(createSpikeUrl({
    referenceAbsorptionGpuTimer: "on",
    variant: "earth-material-v1"
  }));
  await waitForReferenceAbsorptionRoute(page, "earth-material-v1");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthEarthSurfaceLiteV2), {
      timeout: 25_000
    })
    .toMatchObject({
      active: true,
      gpuTimer: {
        disjointResetCount: expect.any(Number),
        sampleCount: expect.any(Number),
        supported: expect.any(Boolean)
      },
      materialFragmentTextureReads: 1,
      materialMapActive: true,
      materialMapSource: expect.stringContaining("earth-material-lite-v1"),
      materialModel: "packed-v1"
    });

  await page.goto(createSpikeUrl({
    referenceAbsorptionForceEarthMaterialFailure: "on",
    variant: "earth-material-v1"
  }));
  await waitForReferenceAbsorptionRoute(page, "earth-material-v1");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthEarthSurfaceLiteV2), {
      timeout: 25_000
    })
    .toMatchObject({
      active: true,
      materialFragmentTextureReads: 0,
      materialMapActive: false,
      materialMapSource: null,
      materialModel: "baseline"
    });
});

test("keeps the homepage and revised route on the non-experimental baseline", async ({ page }) => {
  const requestedExperimentalAssets = new Set<string>();
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("earth-material-lite-v1")) {
      requestedExperimentalAssets.add(pathname);
    }
  });

  await page.goto("/?copy=hidden&progress=0&visualTest=pixels");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-reference-absorption-variant",
    "baseline",
    { timeout: 25_000 }
  );

  await page.goto("/lubirth-revised?copy=hidden&progress=0&visualTest=pixels");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-reference-absorption-variant",
    "baseline",
    { timeout: 25_000 }
  );
  expect([...requestedExperimentalAssets]).toEqual([]);
});
