import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

test.setTimeout(120_000);

declare global {
  interface Window {
    __MiraLithLuBirthCloudMicrobench?: {
      active: boolean;
      cameraMatrixWorld: number[];
      cameraPosition: [number, number, number];
      caseId: "24/6" | "32/2" | "48/6";
      coordinateGate: "PASS" | "FAIL";
      earthMatrixWorld: number[];
      earthUniformScale: number;
      gammaGate: "PASS" | "FAIL";
      hdrColorGate: "PASS" | "FAIL";
      incrementalRtPeakBytes: number;
      occluderMode: "none" | "front" | "middle" | "behind";
      renderScale: number;
      resolvedSize: [number, number];
      showSceneDepthClamp: boolean;
      sourceTexture: string;
      transformScenario: "identity" | "enlarged" | "reduced";
    };
  }
}

test("planetary cloud microbenchmark is query-only, V3-backed, and free of Takram assets", async ({ page }) => {
  const requests = new Set<string>();
  const shaderErrors: string[] = [];
  page.on("request", (request) => requests.add(new URL(request.url()).pathname));
  page.on("console", (message) => {
    if (message.type() === "error" && /WebGLProgram|Shader Error|shader is not compiled/i.test(message.text())) {
      shaderErrors.push(message.text());
    }
  });

  const response = await page.goto(
    "/lubirth-planetary-cloud-microbench?case=24%2F6&progress=0&debug=raw&visualTest=pixels"
  );

  expect(response?.status()).toBe(200);
  await expect(page.locator(".lubirth-planetary-cloud-microbench")).toHaveAttribute(
    "data-case",
    "24/6"
  );
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(
    () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.active ?? false),
    { timeout: 25_000 }
  ).toBe(true);

  const telemetry = await page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench);
  expect(telemetry).toMatchObject({
    caseId: "24/6",
    coordinateGate: "PASS",
    gammaGate: "PASS",
    hdrColorGate: "PASS",
    renderScale: 0.5,
    sourceTexture: "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png"
  });
  expect(Array.from(requests).some((pathname) => pathname.includes("earth-cloud-field-nasa-lite-2k.png"))).toBe(true);
  expect(Array.from(requests).some((pathname) => /takram|three-clouds/i.test(pathname))).toBe(false);
  expect(shaderErrors).toEqual([]);
  expect(telemetry?.earthUniformScale).toBeGreaterThan(8);
  expect(telemetry?.cameraMatrixWorld).toHaveLength(16);
  expect(telemetry?.earthMatrixWorld).toHaveLength(16);
  expect(telemetry?.resolvedSize).toEqual([1440, 960]);
  expect(telemetry?.incrementalRtPeakBytes).toBe(33_177_632);

  const raster = await page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 120;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let litPixels = 0;
    let maxLuma = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luma = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      if (luma > 8) litPixels += 1;
      maxLuma = Math.max(maxLuma, luma);
    }
    return { litRatio: litPixels / (canvas.width * canvas.height), maxLuma };
  });
  expect(raster?.litRatio).toBeGreaterThan(0.03);
  expect(raster?.maxLuma).toBeGreaterThan(32);
});

test("microbenchmark keeps the general ray/depth contract under every required Earth transform", async ({ page }) => {
  for (const transformScenario of ["identity", "enlarged", "reduced"] as const) {
    await page.goto(
      `/lubirth-planetary-cloud-microbench?case=24%2F6&progress=0.12&debug=cloud&transform=${transformScenario}&showSceneDepthClamp=1&visualTest=pixels`
    );
    await expect.poll(
      () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.active ?? false),
      { timeout: 25_000 }
    ).toBe(true);
    const telemetry = await page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench);
    expect(telemetry).toMatchObject({
      coordinateGate: "PASS",
      showSceneDepthClamp: true,
      transformScenario
    });
    await expect(page.locator(".lubirth-planetary-cloud-microbench")).toHaveAttribute(
      "data-show-scene-depth-clamp",
      "true"
    );
  }
});

async function sampleCloudProbeLuminance(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 120;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let luminance = 0;
    let samples = 0;
    for (let y = 38; y < 82; y += 1) {
      for (let x = 68; x < 112; x += 1) {
        const index = (y * canvas.width + x) * 4;
        luminance += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
        samples += 1;
      }
    }
    return luminance / samples;
  });
}

test("GPU depth probe fully, partially, and not-at-all clamps the cloud shell", async ({ page }) => {
  const captureEvidence = process.env.MIRALITH_CLOUD_MICROBENCH_CAPTURE === "1";
  const evidenceDirectory = path.join(
    process.cwd(),
    "docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/screenshots"
  );
  if (captureEvidence) {
    mkdirSync(evidenceDirectory, { recursive: true });
  }
  const luminanceByOccluder = new Map<string, number>();
  for (const occluderMode of ["front", "middle", "behind"] as const) {
    await page.goto(
      `/lubirth-planetary-cloud-microbench?case=24%2F6&progress=0.12&debug=cloud&transform=reduced&occluder=${occluderMode}&showSceneDepthClamp=1&visualTest=pixels`
    );
    await expect.poll(
      () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.active ?? false),
      { timeout: 25_000 }
    ).toBe(true);
    const telemetry = await page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench);
    expect(telemetry?.occluderMode).toBe(occluderMode);
    expect(telemetry?.showSceneDepthClamp).toBe(true);
    if (captureEvidence) {
      await page.locator("canvas").screenshot({
        path: path.join(evidenceDirectory, `depth-probe-${occluderMode}.png`)
      });
    }
    const luminance = await sampleCloudProbeLuminance(page);
    expect(luminance).not.toBeNull();
    luminanceByOccluder.set(occluderMode, luminance ?? 0);
  }

  const front = luminanceByOccluder.get("front") ?? 0;
  const middle = luminanceByOccluder.get("middle") ?? 0;
  const behind = luminanceByOccluder.get("behind") ?? 0;
  const probeValues = JSON.stringify({ front, middle, behind });
  expect(front, probeValues).toBeLessThan(behind * 0.15);
  expect(middle, probeValues).toBeGreaterThan(front + 1);
  expect(middle, probeValues).toBeLessThan(behind * 0.1);
});

test("microbenchmark exposes the fixed opening matrix and isolated debug buffers", async ({ page }) => {
  const captureEvidence = process.env.MIRALITH_CLOUD_MICROBENCH_CAPTURE === "1";
  const evidenceDirectory = path.join(
    process.cwd(),
    "docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/screenshots"
  );
  if (captureEvidence) {
    mkdirSync(evidenceDirectory, { recursive: true });
  }
  const matrixSamples: Array<{
    cameraMatrixWorld: number[];
    cameraPosition: number[];
    caseId: string;
    earthMatrixWorld: number[];
    earthUniformScale: number;
    progress: number;
  }> = [];

  for (const caseId of ["24/6", "32/2", "48/6"] as const) {
    for (const progress of [0, 0.06, 0.12, 0.18]) {
      await page.goto(
        `/lubirth-planetary-cloud-microbench?case=${encodeURIComponent(caseId)}&progress=${progress}&debug=raw&visualTest=pixels`
      );
      await expect.poll(
        () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.active ?? false),
        { timeout: 25_000 }
      ).toBe(true);
      await expect.poll(
        () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.progress),
        { timeout: 25_000 }
      ).toBe(progress);
      const telemetry = await page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench);
      expect(telemetry?.cameraMatrixWorld).toHaveLength(16);
      expect(telemetry?.earthMatrixWorld).toHaveLength(16);
      if (captureEvidence && telemetry) {
        matrixSamples.push({
          cameraMatrixWorld: telemetry.cameraMatrixWorld,
          cameraPosition: telemetry.cameraPosition ?? [],
          caseId,
          earthMatrixWorld: telemetry.earthMatrixWorld,
          earthUniformScale: telemetry.earthUniformScale,
          progress
        });
      }
      if (captureEvidence) {
        await page.locator("canvas").screenshot({
          path: path.join(evidenceDirectory, `${caseId.replace("/", "-")}-progress-${progress.toFixed(2)}-raw.png`)
        });
      }
    }

    for (const debugMode of ["cloud", "earth", "density"] as const) {
      await page.goto(
        `/lubirth-planetary-cloud-microbench?case=${encodeURIComponent(caseId)}&progress=0.12&debug=${debugMode}&visualTest=pixels`
      );
      await expect(page.locator(".lubirth-planetary-cloud-microbench")).toHaveAttribute("data-debug", debugMode);
      await expect.poll(
        () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.active ?? false),
        { timeout: 25_000 }
      ).toBe(true);
      if (captureEvidence) {
        await page.locator("canvas").screenshot({
          path: path.join(evidenceDirectory, `${caseId.replace("/", "-")}-progress-0.12-${debugMode}.png`)
        });
      }
    }
  }

  if (captureEvidence) {
    writeFileSync(
      path.join(evidenceDirectory, "opening-matrix-samples.json"),
      `${JSON.stringify({ samples: matrixSamples }, null, 2)}\n`
    );
  }
});
