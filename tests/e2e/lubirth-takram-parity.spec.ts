import { expect, test } from "@playwright/test";

// Each stock/V3 navigation owns a fresh atmosphere LUT precompute and native
// convergence window. Keep the contract test long enough to cover two cold
// routes on the software/WebGL CI renderer without weakening its assertions.
test.setTimeout(360_000);

function resolveEarthWorldScale(matrix: number[] | undefined) {
  if (!matrix || matrix.length < 3) {
    return Number.NaN;
  }
  return Math.hypot(matrix[0] ?? Number.NaN, matrix[1] ?? Number.NaN, matrix[2] ?? Number.NaN);
}

function normalizePresentationFingerprint(
  fingerprint: Record<string, unknown> | null | undefined
) {
  if (!fingerprint) return null;
  const normalized = JSON.parse(JSON.stringify(fingerprint)) as Record<string, unknown>;
  // Production orbital evidence extends the stock fingerprint with audited
  // baseline/target diagnostics. They are not emitted by the V3 adapter and
  // do not change the native renderer fields this assertion compares.
  delete normalized.schemaVersion;
  delete normalized.orbitalBaseline;
  delete normalized.orbitalRenderTargets;
  delete normalized.orbitalGpuSubmission;
  const clouds = normalized.clouds as Record<string, unknown> | undefined;
  const uniforms = clouds?.uniforms as Record<string, unknown> | undefined;
  if (uniforms) {
    delete uniforms.coverage;
    delete uniforms.shapeRepeat;
    delete uniforms.shapeDetailRepeat;
  }
  return normalized;
}

declare global {
  interface Window {
    __MiraLithTakramParity?: {
      active: boolean;
      assetGeneration: number;
      assetsReady: boolean;
      adapter: {
        cloudLayers: Array<{
          altitude: number;
          channel: "r" | "g" | "b" | "a";
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
      atmosphereReady: boolean;
      coordinateMode: "lubirth-bridge" | "upstream-ecef";
      input: "stock" | "v3";
      native: {
        aerialPerspective: boolean;
        beerShadowMaps: boolean;
        haze: boolean;
        lightShafts: boolean;
        qualityPreset: "high";
        resolutionScale: number;
        shapeDetail: boolean;
        temporalUpscale: boolean;
        turbulence: boolean;
      };
      progress: number;
      rendererFingerprint: Record<string, unknown> | null;
      rendererFingerprintHash: string | null;
      presentationPreset: "official-stock" | "v3-opening-coarse";
      coverage: number | null;
      sceneDepthContract: "world-depth-to-ecef-v1";
      sceneDepthScale: number;
      shapeRepeat: number | null;
      shapeDetailRepeat: number | null;
      view: "control" | "opening";
    };
  }
}

test("stock control renders through one local native Takram pipeline", async ({ page }) => {
  const requests = new Set<string>();
  page.on("request", (request) => requests.add(request.url()));

  const response = await page.goto(
    "/lubirth-takram-parity-spike?input=stock&view=control&progress=0"
  );

  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
    "data-input",
    "stock"
  );
  await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
    "data-view",
    "control"
  );
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(
    () => page.evaluate(() => window.__MiraLithTakramParity?.active ?? false),
    { timeout: 120_000 }
  ).toBe(true);

  expect(await page.evaluate(() => window.__MiraLithTakramParity)).toMatchObject({
    active: true,
    assetsReady: true,
    atmosphereReady: true,
    coordinateMode: "upstream-ecef",
    control: {
      altitudeMeters: 2_500,
      coverage: 0.4,
      fovDegrees: 50,
      pitchDegrees: -8,
      sunAzimuthDegrees: 135,
      sunElevationDegrees: 25
    },
    input: "stock",
    adapter: {
      disableDefaultLayers: false,
      globalWeatherMapping: false,
      localWeatherHash: "b84daef855dc5eebcc9b174fe832ba75a98e44b846dde201bce354417cc08031",
      localWeatherOffset: [0, 0],
      localWeatherRepeat: [100, 100],
      localWeatherSource: "stock"
    },
    native: {
      aerialPerspective: true,
      beerShadowMaps: true,
      haze: true,
      lightShafts: true,
      qualityPreset: "high",
      resolutionScale: 1,
      shapeDetail: true,
      temporalUpscale: true,
      turbulence: true
    },
    progress: 0,
    view: "control"
  });

  const requestPaths = Array.from(requests).map((url) => new URL(url).pathname);
  expect(requestPaths).toEqual(expect.arrayContaining([
    "/assets/lubirth/takram-parity/stock/local-weather.png",
    "/assets/lubirth/takram-parity/stock/shape.bin",
    "/assets/lubirth/takram-parity/stock/shape-detail.bin",
    "/assets/lubirth/takram-parity/stock/stbn.bin",
    "/assets/lubirth/takram-parity/stock/turbulence.png"
  ]));
  expect(Array.from(requests).some((url) =>
    /githubusercontent|media\.githubusercontent|earth-cloud-field-nasa-lite/i.test(url)
  )).toBe(false);
});

test("V3 changes only resolved adapter fields while preserving the native renderer", async ({ page }) => {
  const requests = new Set<string>();
  page.on("request", (request) => requests.add(request.url()));

  await page.goto(
    "/lubirth-takram-parity-spike?input=stock&view=opening&progress=0.06"
  );
  await expect.poll(
    () => page.evaluate(() => window.__MiraLithTakramParity?.active ?? false),
    { timeout: 120_000 }
  ).toBe(true);
  const stock = await page.evaluate(() => window.__MiraLithTakramParity);
  requests.clear();

  const response = await page.goto(
    "/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06"
  );

  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
    "data-input",
    "v3"
  );
  await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
    "data-runtime",
    "ready",
    { timeout: 120_000 }
  );
  await expect(page.locator("canvas")).toHaveCount(1);
  const v3 = await page.evaluate(() => window.__MiraLithTakramParity);

  expect(normalizePresentationFingerprint(stock?.rendererFingerprint))
    .toEqual(normalizePresentationFingerprint(v3?.rendererFingerprint));
  expect(stock?.rendererFingerprint).not.toEqual(v3?.rendererFingerprint);
  expect(stock?.rendererFingerprintHash).not.toBe(v3?.rendererFingerprintHash);
  expect(stock?.native).toEqual(v3?.native);
  expect(stock?.adapter).toMatchObject({
    disableDefaultLayers: false,
    globalWeatherMapping: false,
    localWeatherOffset: [0, 0],
    localWeatherRepeat: [100, 100],
    localWeatherSource: "stock"
  });
  expect(v3).toMatchObject({
    active: true,
    assetsReady: true,
    atmosphereReady: true,
    coordinateMode: "lubirth-bridge",
    input: "v3",
    progress: 0.06,
    presentationPreset: "v3-opening-coarse",
    coverage: 0.55,
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006,
    adapter: {
      disableDefaultLayers: true,
      globalWeatherMapping: true,
      localWeatherHash: "ff2b7715cc59a4031a7eb6ff7e77ce52a730996c9dfe9d529dfa25aa01481a9b",
      localWeatherOffset: [-0.045, 0.018],
      localWeatherRepeat: [1, 1],
      localWeatherSource: "v3"
    },
    rendererFingerprintHash: expect.stringMatching(/^fnv1a-64:[0-9a-f]{16}$/),
    sceneDepthContract: "world-depth-to-ecef-v1"
  });
  expect(stock?.rendererFingerprint).not.toBeNull();
  expect(v3?.rendererFingerprint).not.toBeNull();
  expect(stock).toMatchObject({
    presentationPreset: "official-stock",
    coverage: 0.3,
    shapeRepeat: 0.0003,
    shapeDetailRepeat: 0.006
  });
  expect(v3?.rendererFingerprintHash).not.toBe(stock?.rendererFingerprintHash);
  expect(v3?.sceneDepthScale).toBeGreaterThan(1);
  const expectedSceneDepthScale = 6_360_000 / resolveEarthWorldScale(v3?.earthMatrixWorld);
  expect(v3?.sceneDepthScale).toBeCloseTo(expectedSceneDepthScale, 3);
  expect(stock?.sceneDepthScale).toBeCloseTo(expectedSceneDepthScale, 3);
  expect(v3?.adapter.cloudLayers).toMatchObject([
    { channel: "r", altitude: 8_000, height: 26_000, shadow: true },
    { channel: "g", altitude: 10_000, height: 50_000, shadow: true },
    { channel: "b", altitude: 8_000, height: 36_000, shadow: false },
    { channel: "a", altitude: 18_000, height: 20_000, shadow: false }
  ]);

  const requestPaths = Array.from(requests).map((url) => new URL(url).pathname);
  expect(requestPaths).toEqual(expect.arrayContaining([
    "/assets/lubirth/takram-parity/v3/weather.png",
    "/assets/lubirth/takram-parity/stock/shape.bin",
    "/assets/lubirth/takram-parity/stock/shape-detail.bin",
    "/assets/lubirth/takram-parity/stock/stbn.bin",
    "/assets/lubirth/takram-parity/stock/turbulence.png"
  ]));
  expect(requestPaths).not.toContain(
    "/assets/lubirth/takram-parity/stock/local-weather.png"
  );
  expect(Array.from(requests).some((url) =>
    /githubusercontent|media\.githubusercontent|earth-cloud-field-nasa-lite/i.test(url)
  )).toBe(false);
});

test("Takram parity remains isolated from default and revised routes", async ({ page }) => {
  for (const route of ["/", "/lubirth-revised?visual=fallback"]) {
    const requests = new Set<string>();
    const handleRequest = (request: import("@playwright/test").Request) => {
      requests.add(request.url());
    };
    page.on("request", handleRequest);

    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    // Permit client hydration to request every route-owned visual asset before
    // asserting that the query-only parity chunk/asset family stays absent.
    await page.waitForTimeout(1_000);

    expect(Array.from(requests).some((url) =>
      /takram-parity|three-clouds|three-atmosphere|@takram/i.test(url)
    )).toBe(false);
    expect(await page.evaluate(() => window.__MiraLithTakramParity)).toBeUndefined();
    page.off("request", handleRequest);
  }
});
