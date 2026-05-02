import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __MiraLithLuBirthAuroraEnabled?: boolean;
    __MiraLithLuBirthAuroraProfile?: string;
    __MiraLithLuBirthAirglowActive?: boolean;
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
    __MiraLithLuBirthCloudDeckActive?: boolean;
    __MiraLithLuBirthCloudDeckTexture?: string;
    __MiraLithLuBirthHorizonAuroraRibbonActive?: boolean;
    __MiraLithLuBirthPostBloomActive?: boolean;
    __MiraLithLuBirthMoonPhase?: { date: string; source: string; phaseAngleRad: number };
    __MiraLithLuBirthProjectedAuroraCurtainActive?: boolean;
    __MiraLithLuBirthProjectedCloudPlateActive?: boolean;
    __MiraLithLuBirthProjectedCloudPlateTexture?: string;
    __MiraLithLuBirthProjectedHorizonCompositeActive?: boolean;
    __MiraLithLuBirthProjectedHorizonCompositeLayer?: string;
    __MiraLithLuBirthProjectedHorizonCompositeTexture?: string;
    __MiraLithLuBirthProjectedLimbScatteringActive?: boolean;
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthRuntimeLocation?: {
      latitudeDeg: number;
      longitudeDeg: number;
      label: string;
      source: string;
    };
  }
}

test("renders the revised LuBirth route in the production-owned canvas", async ({ page }) => {
  await page.goto("/lubirth-revised?visualTest=pixels&copy=visible");

  await expect(page.getByLabel("LuBirth revised opening frame")).toBeVisible();
  await expect(page.locator(".lubirth-revised__loading")).toBeHidden({ timeout: 25_000 });
  await expect(page.locator(".lubirth-revised__hero-copy").getByRole("heading", { name: "LuBirth" })).toBeVisible();
  await expect(page.getByText("把看见之物，刻成作品")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
});

test("keeps route copy readable in visual fallback", async ({ page }) => {
  await page.goto("/lubirth-revised?visual=fallback&copy=visible");

  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="lubirth"]')).toBeVisible();
  await expect(page.locator(".lubirth-revised__loading")).toBeHidden({ timeout: 25_000 });
  await expect(page.locator(".lubirth-revised__hero-copy").getByRole("heading", { name: "LuBirth" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__hero-copy").getByText("我出生那一刻的地球与月相合影")).toBeVisible();
});

test("reduced motion skips pinned scroll choreography", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lubirth-revised?copy=visible");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-motion", "reduced");
  await expect(page.getByRole("heading", { name: "LuBirth" })).toBeVisible();

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(scrollHeight).toBeLessThanOrEqual(Math.ceil(viewportHeight * 1.35));
});

test("exposes every LuBirth visual debug layer", async ({ page }) => {
  const expectedProfiles = {
    stars: "debug-stars",
    clouds: "debug-clouds",
    atmosphere: "debug-atmosphere",
    aurora: "debug-aurora",
    all: "nasa"
  };

  for (const layer of ["stars", "clouds", "atmosphere", "aurora", "all"] as const) {
    await page.goto(`/lubirth-revised?progress=0&copy=hidden&debug=${layer}&visualTest=pixels`);

    await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-debug-layer", layer);
    await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", expectedProfiles[layer]);
    await expect(page.locator("canvas")).toHaveCount(1);
  }
});

test("defaults the study route to the nasa Earth-limb profile", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&visualTest=pixels");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy", "hidden");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "nasa");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostBloomActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedLimbScatteringActive ?? false), { timeout: 25_000 })
    .toBe(true);
});

test("keeps a clean Earth-Moon comparison profile", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=clean&visualTest=pixels");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "clean");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(false);
});

test("uses high-detail Earth and sky assets for the nasa profile without projected-strip requests", async ({ page }) => {
  const assetRequests = new Set<string>();

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      assetRequests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=nasa&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "nasa");
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-day-8k.webp")), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-clouds-8k.webp")), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("8k_stars_milky_way.webp")), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostBloomActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthHorizonAuroraRibbonActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAirglowActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await page.waitForTimeout(900);

  const oldProjectionRequests = Array.from(assetRequests).filter(
    (path) => path.includes("earth-horizon-cloud-strip-2k")
  );

  expect(oldProjectionRequests).toEqual([]);
});

test("uses the 3D cloud deck for high quality cloud review", async ({ page }) => {
  const assetRequests = new Set<string>();

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      assetRequests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-clouds&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "debug-clouds");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudDeckActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedCloudPlateActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-cloud-deck-2k.png")), { timeout: 25_000 })
    .toBe(true);
  await page.waitForTimeout(900);
  expect(Array.from(assetRequests).filter((path) => path.includes("earth-horizon-cloud-strip-2k.png"))).toEqual([]);
});

test("uses the 3D atmosphere stack for atmosphere review", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-atmosphere&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "debug-atmosphere");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostBloomActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAirglowActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedLimbScatteringActive ?? false), { timeout: 25_000 })
    .toBe(true);
});

test("can drive the nasa profile from today's moon phase and visitor geo", async ({ page }) => {
  const samples = [
    {
      label: "Tokyo",
      latitudeDeg: 35.6812,
      longitudeDeg: 139.7671,
      moonDate: "2026-05-01T12:00:00Z"
    },
    {
      label: "Reykjavik",
      latitudeDeg: 64.1466,
      longitudeDeg: -21.9426,
      moonDate: "2026-05-08T12:00:00Z"
    },
    {
      label: "Sao Paulo",
      latitudeDeg: -23.5558,
      longitudeDeg: -46.6396,
      moonDate: "2026-05-15T12:00:00Z"
    }
  ];

  for (const sample of samples) {
    const params = new URLSearchParams({
      progress: "0",
      copy: "hidden",
      profile: "nasa",
      moonPhase: "today",
      moonDate: sample.moonDate,
      location: "ip",
      geoLat: String(sample.latitudeDeg),
      geoLon: String(sample.longitudeDeg),
      geoLabel: sample.label,
      visualTest: "pixels"
    });
    await page.goto(`/lubirth-revised?${params.toString()}`);

    await expect(page.locator("canvas")).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthMoonPhase?.source), { timeout: 25_000 })
      .toBe("runtime-ephemeris");
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthMoonPhase?.date), { timeout: 25_000 })
      .toBe(sample.moonDate.slice(0, 10));
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeLocation?.label), { timeout: 25_000 })
      .toBe(sample.label);
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeLocation?.source), { timeout: 25_000 })
      .toBe("manual");
  }
});

test("uses the horizon aurora ribbon for high quality aurora debug", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-aurora&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "debug-aurora");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedAuroraCurtainActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthHorizonAuroraRibbonActive ?? false), { timeout: 25_000 })
    .toBe(true);
});

test("does not request CloudDeck in low quality cloud review", async ({ page }) => {
  const assetRequests = new Set<string>();

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      assetRequests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=clouds&quality=low&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("low");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudDeckActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await page.waitForTimeout(900);
  expect(Array.from(assetRequests).filter((path) => path.includes("earth-cloud-deck-2k.png"))).toEqual([]);
  expect(Array.from(assetRequests).filter((path) => path.includes("earth-horizon-cloud-strip-2k.png"))).toEqual([]);
});

test("low quality keeps the atmosphere stack lightweight", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=nasa&quality=low&visualTest=pixels");

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("low");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraEnabled), { timeout: 25_000 })
    .toBe(false);
});

test("honors LuBirth quality URL overrides for aurora debugging", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-aurora&quality=low&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("low");
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraEnabled)).toBe(false);

  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-aurora&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("high");
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraEnabled)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraProfile)).toBe("hero");

  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-aurora&quality=high&auroraProfile=debug&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraProfile), { timeout: 25_000 })
    .toBe("debug");
});

test("visual pixel mode hides visible copy without fake future chapter anchors", async ({ page }) => {
  await page.goto("/lubirth-revised?visualTest=pixels#miralith-chapter-now-building");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy", "hidden");
  await expect(page.locator("#miralith-chapter-now-building")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__world-mark")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__hero-copy")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__title-rail")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
});
