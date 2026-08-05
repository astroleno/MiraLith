import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

test.setTimeout(600_000);

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
      frameId: number;
      gammaGate: "PASS" | "FAIL";
      gpu: {
        invalidFrames: number;
        p50Ms: number | null;
        p95Ms: number | null;
        sampleCount: number;
        stages: {
          cloudComposite: { p50Ms: number | null; p95Ms: number | null };
          densityAndLightRaymarch: { p50Ms: number | null; p95Ms: number | null };
          resolve: { p50Ms: number | null; p95Ms: number | null };
        };
        supported: boolean;
      };
      hdrColorGate: "PASS" | "FAIL";
      incrementalRtPeakBytes: number;
      measurement: {
        measurementReadyFrame: number | null;
        samplingStartFrame: number | null;
        warmupStartFrame: number | null;
        weatherReady: boolean;
      };
      measurementState: "awaiting-visual-review" | "awaiting-readiness" | "warming" | "sampling" | "complete" | "timer-unavailable";
      occluderMode: "none" | "front" | "middle" | "behind";
      representationVersion: "task-1r";
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
    representationVersion: "task-1r",
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

test("GPU timing restarts from a new ready frame after a render-target resize", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop" && testInfo.project.name !== "desktop-system-chrome",
    "Resize timing-state coverage is desktop-only."
  );

  await page.goto(
    "/lubirth-planetary-cloud-microbench?case=32%2F2&progress=0.12&debug=raw&measure=1&visualGate=pass"
  );
  await expect.poll(
    () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.active ?? false),
    { timeout: 25_000 }
  ).toBe(true);
  const timerSupported = await page.evaluate(
    () => window.__MiraLithLuBirthCloudMicrobench?.gpu.supported ?? false
  );
  test.skip(!timerSupported, "EXT_disjoint_timer_query_webgl2 is unavailable in this browser.");

  await expect.poll(
    () => page.evaluate(() => {
      const telemetry = window.__MiraLithLuBirthCloudMicrobench;
      return telemetry?.measurementState === "sampling" && (telemetry.gpu.sampleCount ?? 0) > 0;
    }),
    { timeout: 120_000 }
  ).toBe(true);
  const beforeResize = await page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench);
  expect(beforeResize?.measurement.measurementReadyFrame).not.toBeNull();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(
    () => page.evaluate((previousFrameId) => {
      const telemetry = window.__MiraLithLuBirthCloudMicrobench;
      return telemetry?.resolvedSize[0] === 1280 && telemetry.resolvedSize[1] === 900 &&
        (telemetry.measurement.measurementReadyFrame ?? -1) > previousFrameId;
    }, beforeResize?.frameId ?? -1),
    { timeout: 25_000 }
  ).toBe(true);

  const afterResize = await page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench);
  expect(afterResize?.gpu.sampleCount).toBe(0);
  expect(afterResize?.measurementState).toBe("warming");
  expect(afterResize?.measurement.warmupStartFrame).toBe(
    (afterResize?.measurement.measurementReadyFrame ?? 0) + 1
  );
  expect(afterResize?.measurement.samplingStartFrame).toBe(
    (afterResize?.measurement.warmupStartFrame ?? 0) + 120
  );
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
        path: path.join(evidenceDirectory, `task-1r-depth-probe-${occluderMode}.png`)
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
    representationVersion: "task-1r";
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
          progress,
          representationVersion: telemetry.representationVersion
        });
      }
      if (captureEvidence) {
        await page.locator("canvas").screenshot({
          path: path.join(
            evidenceDirectory,
            `${caseId.replace("/", "-")}-task-1r-progress-${progress.toFixed(2)}-raw.png`
          )
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
          path: path.join(
            evidenceDirectory,
            `${caseId.replace("/", "-")}-task-1r-progress-0.12-${debugMode}.png`
          )
        });
      }
    }
  }

  if (captureEvidence) {
    writeFileSync(
      path.join(evidenceDirectory, "task-1r-opening-matrix-samples.json"),
      `${JSON.stringify({ samples: matrixSamples }, null, 2)}\n`
    );
  }
});

test("records a Task -1R System Chrome GPU window after visual confirmation", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-system-chrome",
    "Formal GPU evidence is scoped to headed System Chrome."
  );

  const results: Array<{
    caseId: "24/6" | "32/2" | "48/6";
    gpu: NonNullable<Window["__MiraLithLuBirthCloudMicrobench"]>["gpu"];
    measurement: NonNullable<Window["__MiraLithLuBirthCloudMicrobench"]>["measurement"];
    renderScale: number;
    resolvedSize: [number, number];
  }> = [];
  // 32/2 has the fewest fixed density evaluations (32 * 2) and is the
  // visual-passing lower-cost candidate. A complete 120-sample window here
  // is the required early-cost proof before any higher-cost configuration.
  for (const caseId of ["32/2"] as const) {
    await page.goto(
      `/lubirth-planetary-cloud-microbench?case=${encodeURIComponent(caseId)}&progress=0.12&debug=raw&measure=1&visualGate=pass`
    );
    await page.bringToFront();
    await expect.poll(
      () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.active ?? false),
      { timeout: 25_000 }
    ).toBe(true);
    await expect.poll(
      () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.gpu.supported ?? false),
      { timeout: 25_000 }
    ).toBe(true);
    await expect.poll(
      () => page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench?.gpu.sampleCount ?? 0),
      { timeout: 480_000 }
    ).toBeGreaterThanOrEqual(120);

    const telemetry = await page.evaluate(() => window.__MiraLithLuBirthCloudMicrobench);
    expect(telemetry).toMatchObject({
      caseId,
      measurementState: "complete",
      representationVersion: "task-1r"
    });
    expect(telemetry?.gpu.p50Ms).not.toBeNull();
    expect(telemetry?.gpu.p95Ms).not.toBeNull();
    expect(telemetry?.gpu.stages.densityAndLightRaymarch.p95Ms).not.toBeNull();
    expect(telemetry?.gpu.stages.resolve.p95Ms).not.toBeNull();
    expect(telemetry?.gpu.stages.cloudComposite.p95Ms).not.toBeNull();
    expect(telemetry?.measurement.weatherReady).toBe(true);
    expect(telemetry?.measurement.measurementReadyFrame).not.toBeNull();
    expect(telemetry?.measurement.warmupStartFrame).toBe(
      (telemetry?.measurement.measurementReadyFrame ?? 0) + 1
    );
    expect(telemetry?.measurement.samplingStartFrame).toBe(
      (telemetry?.measurement.warmupStartFrame ?? 0) + 120
    );
    results.push({
      caseId,
      gpu: telemetry!.gpu,
      measurement: telemetry!.measurement,
      renderScale: telemetry!.renderScale,
      resolvedSize: telemetry!.resolvedSize
    });
  }

  const systemChrome = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    const rendererInfo = context?.getExtension("WEBGL_debug_renderer_info");
    return {
      devicePixelRatio: window.devicePixelRatio,
      renderer: rendererInfo && context
        ? context.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
        : "unavailable",
      userAgent: navigator.userAgent,
      vendor: rendererInfo && context
        ? context.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL)
        : "unavailable"
    };
  });

  const serialized = `${JSON.stringify({
    candidateSelection: "32/2 is the lowest fixed primary×light sample cost visual-pass case",
    environment: {
      browser: "headed System Chrome",
      ...systemChrome
    },
    representationVersion: "task-1r",
    results
  }, null, 2)}\n`;
  testInfo.attach("task-1r-system-chrome-gpu.json", {
    body: serialized,
    contentType: "application/json"
  });
  if (process.env.MIRALITH_CLOUD_MICROBENCH_PERF_EVIDENCE === "1") {
    const evidenceDirectory = path.join(
      process.cwd(),
      "docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench"
    );
    mkdirSync(evidenceDirectory, { recursive: true });
    writeFileSync(path.join(evidenceDirectory, "task-1r-system-chrome-gpu.json"), serialized);
  }
});
