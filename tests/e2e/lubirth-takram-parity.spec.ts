import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

declare global {
  interface Window {
    __MiraLithTakramParity?: {
      active: boolean;
      assetGeneration: number;
      assetsReady: boolean;
      atmosphereReady: boolean;
      coordinateMode: "lubirth-bridge" | "upstream-ecef";
      input: "stock";
      native: {
        aerialPerspective: boolean;
        beerShadowMaps: boolean;
        defaultCloudLayers: boolean;
        haze: boolean;
        lightShafts: boolean;
        qualityPreset: "high";
        resolutionScale: number;
        shapeDetail: boolean;
        temporalUpscale: boolean;
        turbulence: boolean;
      };
      progress: number;
      stockWeatherRepeat: [number, number] | null;
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
    native: {
      aerialPerspective: true,
      beerShadowMaps: true,
      defaultCloudLayers: true,
      haze: true,
      lightShafts: true,
      qualityPreset: "high",
      resolutionScale: 1,
      shapeDetail: true,
      temporalUpscale: true,
      turbulence: true
    },
    progress: 0,
    stockWeatherRepeat: [100, 100],
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

test("V3 remains inert until the authorized 0V adapter task", async ({ page }) => {
  const requests = new Set<string>();
  page.on("request", (request) => requests.add(request.url()));

  const response = await page.goto(
    "/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06"
  );

  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
    "data-runtime",
    "v3-not-authorized"
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(Array.from(requests).some((url) =>
    /\/assets\/lubirth\/takram-parity\/|earth-cloud-field-nasa-lite/i.test(url)
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
