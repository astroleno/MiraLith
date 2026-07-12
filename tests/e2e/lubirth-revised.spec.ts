import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

const EVIDENCE_DIR = path.join(process.cwd(), "screenshots/lubirth-atmosphere-evidence-20260508");

function evidenceScreenshotPath(projectName: string, screenshotName: string) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  return path.join(EVIDENCE_DIR, `${projectName}-${screenshotName}.png`);
}

async function captureEvidenceScreenshot(
  page: import("@playwright/test").Page,
  projectName: string,
  screenshotName: string
) {
  const screenshotPath = evidenceScreenshotPath(projectName, screenshotName);
  try {
    const client = await page.context().newCDPSession(page);
    try {
      const result = await client.send("Page.captureScreenshot", {
        captureBeyondViewport: false,
        format: "png",
        fromSurface: true
      });
      writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
      return;
    } finally {
      await client.detach().catch(() => undefined);
    }
  } catch {
    // Fall through to Playwright's screenshot API for non-Chromium fallback projects.
  }

  const previousFontWait = process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";

  try {
    await page.screenshot({
      fullPage: false,
      path: screenshotPath,
      timeout: 30_000
    });
  } finally {
    if (previousFontWait === undefined) {
      delete process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
    } else {
      process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = previousFontWait;
    }
  }
}

async function gotoEvidenceUrl(page: import("@playwright/test").Page, url: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.goto(url, { timeout: 45_000 });
      return;
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !error.message.includes("ERR_CONNECTION_REFUSED")) {
        throw error;
      }

      await page.waitForTimeout(1_000);
    }
  }

  throw lastError;
}

declare global {
  interface Window {
    __MiraLithLuBirthAuroraEnabled?: boolean;
    __MiraLithLuBirthAuroraOvalActive?: boolean;
    __MiraLithLuBirthAuroraProfile?: string;
    __MiraLithLuBirthAirglowActive?: boolean;
    __MiraLithLuBirthAtmosphereLook?: string;
    __MiraLithLuBirthAtmospherePolicy?: string;
    __MiraLithLuBirthAtmospherePolicyReason?: string;
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
    __MiraLithLuBirthAtmosphereStackLayerCount?: number;
    __MiraLithLuBirthAtmosphereStackMode?: string;
    __MiraLithLuBirthAtmosphereVariant?: string;
    __MiraLithLuBirthCloudDeckActive?: boolean;
    __MiraLithLuBirthCloudDeckTexture?: string;
    __MiraLithLuBirthCloudShellsActive?: boolean;
    __MiraLithLuBirthCloudShellCount?: number;
    __MiraLithLuBirthCloudFieldTexture?: string;
    __MiraLithLuBirthGroundCloudShadowActive?: boolean;
    __MiraLithLuBirthHorizonAuroraRibbonActive?: boolean;
    __MiraLithLuBirthPostEffectActive?: boolean;
    __MiraLithLuBirthPostEffectMode?: string;
    __MiraLithLuBirthAnalyticHaloConfig?: {
      diameterScale: number;
      opacityMax: number;
      opacityMin: number;
      textureSize: number;
    };
    __MiraLithLuBirthVisualPolicy?: {
      atmosphereMode: string;
      postEffectMode: string;
      cloudMode: string;
      groundShadow: boolean;
      reason: string;
    };
    __MiraLithLuBirthCloseAtmosphereTuning?: {
      effective: {
        edgeGlowStrength: number;
        verticalGradientStrength: number;
      };
    };
    __MiraLithLuBirthMoonPhase?: { date: string; source: string; phaseAngleRad: number };
    __MiraLithLuBirthProjectedAuroraCurtainActive?: boolean;
    __MiraLithLuBirthProjectedCloudPlateActive?: boolean;
    __MiraLithLuBirthProjectedCloudPlateTexture?: string;
    __MiraLithLuBirthProjectedHorizonCompositeActive?: boolean;
    __MiraLithLuBirthProjectedHorizonCompositeLayer?: string;
    __MiraLithLuBirthProjectedHorizonCompositeTexture?: string;
    __MiraLithLuBirthProjectedLimbScatteringActive?: boolean;
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthRuntimeProfile?: string;
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
    __MiraLithLuBirthRuntimeLocation?: {
      latitudeDeg: number;
      longitudeDeg: number;
      label: string;
      source: string;
      timeZone?: string;
    };
    __MiraLithLuBirthSolarState?: {
      date: string;
      locationSunDot?: number;
      source: string;
      timeZone?: string;
    };
  }
}

async function expectProductionAtmospherePolicy(page: import("@playwright/test").Page, reason: string) {
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereVariant), { timeout: 25_000 })
    .toBe("stack");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmospherePolicyReason), { timeout: 25_000 })
    .toBe(reason);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false), {
      timeout: 25_000
    })
    .toBe(false);
}

async function expectAtmosphereVariant(page: import("@playwright/test").Page, variant: "stack" | "volumetric") {
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereVariant), { timeout: 25_000 })
    .toBe(variant);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false), {
      timeout: 25_000
    })
    .toBe(variant === "volumetric");
}

async function expectAnyVisible(page: import("@playwright/test").Page, selectors: string[]) {
  await expect
    .poll(async () => {
      for (const selector of selectors) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          return selector;
        }
      }

      return null;
    }, { timeout: 25_000 })
    .not.toBeNull();
}

const STUDY_VISIBLE_COPY_SELECTORS = [
  ".lubirth-revised__hero-copy",
  ".lubirth-revised__loading",
  ".lubirth-revised__loading-title",
  ".lubirth-revised__loading-copy"
] as const;

test("renders the revised LuBirth route in the production-owned canvas", async ({ page }) => {
  await page.goto("/lubirth-revised?visualTest=pixels&copy=visible");

  await expect(page.getByLabel("LuBirth revised opening frame")).toBeVisible();
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy", "visible");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  await expectAnyVisible(page, [...STUDY_VISIBLE_COPY_SELECTORS]);
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
  await expectProductionAtmospherePolicy(page, "policy-stack");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostEffectActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedLimbScatteringActive ?? false), { timeout: 25_000 })
    .toBe(false);
});

test("keeps production home intro route on the stack renderer", async ({ page }) => {
  await page.goto("/?copy=visible");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-variant", "home", { timeout: 25_000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  await expectAtmosphereVariant(page, "stack");
});

test("keeps production home on the lightweight Earth renderer", async ({ page }) => {
  const assetRequests = new Set<string>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes("/assets/lubirth/")) {
      assetRequests.add(path);
    }
  });

  await page.goto("/?copy=visible");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeProfile), { timeout: 25_000 })
    .toBe("home-lite");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("medium");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudShellsActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudShellCount), { timeout: 25_000 })
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudFieldTexture), { timeout: 25_000 })
    .toBe("/assets/lubirth/textures/earth-cloud-field-home.webp");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthGroundCloudShadowActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostEffectActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostEffectMode), { timeout: 25_000 })
    .toBe("analytic-halo");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAnalyticHaloConfig), { timeout: 25_000 })
    .toEqual({ diameterScale: 2.5, opacityMax: 0.1, opacityMin: 0.085, textureSize: 64 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVisualPolicy), { timeout: 25_000 })
    .toEqual({
      atmosphereMode: "surface-glow",
      postEffectMode: "analytic-halo",
      cloudMode: "shell-lite",
      groundShadow: true,
      reason: "home-lite"
    });
  await expect
    .poll(() => page.evaluate(() => ({
      count: window.__MiraLithLuBirthAtmosphereStackLayerCount,
      mode: window.__MiraLithLuBirthAtmosphereStackMode
    })), { timeout: 25_000 })
    .toEqual({ count: 1, mode: "surface-glow" });
  await expect
    .poll(
      () => page.evaluate(() => window.__MiraLithLuBirthCloseAtmosphereTuning?.effective.edgeGlowStrength),
      { timeout: 25_000 }
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-visual-ready", "true", {
    timeout: 25_000
  });

  const canvasDpr = await page.locator("canvas").evaluate((canvas) =>
    Math.max(canvas.width / canvas.clientWidth, canvas.height / canvas.clientHeight)
  );
  expect(canvasDpr).toBeGreaterThanOrEqual(0.84);
  expect(canvasDpr).toBeLessThanOrEqual(0.86);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-day-2k"))).toBe(true);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-night-2k"))).toBe(true);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-cloud-field-home.webp"))).toBe(true);
  expect(Array.from(assetRequests).some((path) => path.includes("moon-2k"))).toBe(true);
  expect(Array.from(assetRequests).some((path) => path.includes("8k"))).toBe(false);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-clouds-2k"))).toBe(false);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-cloud-deck"))).toBe(false);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-specular-4k"))).toBe(false);

  const firstViewportTextures = [
    "earth-day-2k.jpg",
    "earth-night-2k.jpg",
    "earth-cloud-field-home.webp",
    "moon-2k.jpg"
  ].map((fileName) =>
    statSync(path.join(process.cwd(), "apps/site/public/assets/lubirth/textures", fileName)).size
  );
  const cloudFieldBytes = firstViewportTextures[2] ?? Number.POSITIVE_INFINITY;
  expect(cloudFieldBytes).toBeLessThanOrEqual(650_000);
  expect(firstViewportTextures.reduce((total, bytes) => total + bytes, 0)).toBeLessThan(3_000_000);
});

test("keeps the loading and prelude phase branded as MiraLith with one continuous moon path", async ({ page }) => {
  await page.goto("/?copy=visible");

  const loading = page.locator(".lubirth-revised__home-loading");
  await expect(loading).toBeVisible();
  await expect(loading.locator(".lubirth-revised__home-loading-title")).toHaveText("MiraLith");
  await expect(loading.locator(".lubirth-revised__home-loading-subtitle")).toHaveText("把看见之物，刻成作品");
  await expect(loading.locator(".lubirth-revised__home-loading-moon-path")).toHaveCount(1);
  await expect(loading.locator(".lubirth-revised__home-loading-moon-path--complete")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__travelling-title")).toBeHidden();
});

test("uses one persistent LuBirth title node from the home hero to the chapter rail", async ({ page }) => {
  await page.goto("/?progress=0.58&copy=visible&visualTest=pixels");

  await expect(page.locator(".lubirth-revised__travelling-title")).toHaveCount(1);
  await expect(page.locator(".lubirth-revised__travelling-title")).toBeVisible();
  await expect(page.locator(".miralith-chapter-nav__title-anchor")).toHaveCount(1);
  await expect(page.locator(".lubirth-revised__opening-title")).toHaveCount(0);
});

test("captures production route atmosphere evidence screenshots", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  test.skip(testInfo.project.name !== "desktop", "Production evidence screenshots are captured once on desktop.");

  const samples = [
    {
      copySelectors: null,
      name: "production-study-canvas-stack-baseline",
      url: "/lubirth-revised?progress=0&copy=hidden&profile=nasa&visualTest=pixels",
      variant: "stack" as const
    },
    {
      copySelectors: STUDY_VISIBLE_COPY_SELECTORS,
      name: "production-study-visible-stack-baseline",
      url: "/lubirth-revised?copy=visible&profile=nasa&visualTest=pixels",
      variant: "stack" as const
    },
    {
      copySelectors: STUDY_VISIBLE_COPY_SELECTORS,
      name: "production-study-visible-hybrid-candidate",
      url: "/lubirth-revised?copy=visible&profile=nasa&quality=high&atmoPolicy=hybrid&visualTest=pixels",
      variant: "volumetric" as const
    },
    {
      copySelectors: [".lubirth-revised__home-loading", ".lubirth-revised__travelling-title", ".lubirth-revised__home-signature"],
      name: "production-home-visible-stack-intro",
      url: "/?copy=visible&visualTest=pixels",
      variant: "stack" as const
    },
    {
      copySelectors: null,
      name: "production-home-hidden-hybrid-candidate",
      url: "/?progress=0&copy=hidden&profile=nasa&quality=high&atmoPolicy=hybrid&visualTest=pixels",
      variant: "volumetric" as const
    }
  ];

  for (const sample of samples) {
    await test.step(sample.name, async () => {
      await page.setViewportSize({ width: 1440, height: 960 });
      await gotoEvidenceUrl(page, sample.url);
      await expect(page.locator("canvas")).toHaveCount(1);
      await expectAtmosphereVariant(page, sample.variant);
      if (sample.copySelectors) {
        await expectAnyVisible(page, [...sample.copySelectors]);
      }
      await page.waitForTimeout(900);
      await captureEvidenceScreenshot(page, testInfo.project.name, sample.name);
    });
  }
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
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-night-8k.webp")), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-night-2k.jpg")), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-normal-2k.jpg")), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-displacement-8k.jpg")), { timeout: 25_000 })
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
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostEffectActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraOvalActive ?? false), { timeout: 25_000 })
    .toBe(false);
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
    .poll(() => page.evaluate(() => ({
      count: window.__MiraLithLuBirthAtmosphereStackLayerCount,
      mode: window.__MiraLithLuBirthAtmosphereStackMode
    })), { timeout: 25_000 })
    .toEqual({ count: 3, mode: "lookdev" });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostEffectActive ?? false), { timeout: 25_000 })
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

interface RuntimeMoonGeoSample {
  label: string;
  latitudeDeg: number;
  longitudeDeg: number;
  timeZone: string;
  sunDate: string;
  moonDate: string;
}

const RUNTIME_MOON_GEO_SAMPLES: RuntimeMoonGeoSample[] = [
  {
    label: "Tokyo",
    latitudeDeg: 35.6812,
    longitudeDeg: 139.7671,
    timeZone: "Asia/Tokyo",
    sunDate: "2026-05-01T03:00:00Z",
    moonDate: "2026-05-01T12:00:00Z"
  },
  {
    label: "Reykjavik",
    latitudeDeg: 64.1466,
    longitudeDeg: -21.9426,
    timeZone: "Atlantic/Reykjavik",
    sunDate: "2026-05-08T13:00:00Z",
    moonDate: "2026-05-08T12:00:00Z"
  },
  {
    label: "Sao Paulo",
    latitudeDeg: -23.5558,
    longitudeDeg: -46.6396,
    timeZone: "America/Sao_Paulo",
    sunDate: "2026-05-15T15:00:00Z",
    moonDate: "2026-05-15T12:00:00Z"
  }
];

async function openRuntimeMoonGeoSample(page: import("@playwright/test").Page, sample: RuntimeMoonGeoSample) {
  const params = new URLSearchParams({
    progress: "0",
    copy: "hidden",
    profile: "nasa",
    moonPhase: "today",
    moonDate: sample.moonDate,
    sunDate: sample.sunDate,
    location: "ip",
    geoLat: String(sample.latitudeDeg),
    geoLon: String(sample.longitudeDeg),
    geoLabel: sample.label,
    geoTimeZone: sample.timeZone,
    visualTest: "pixels"
  });

  await gotoEvidenceUrl(page, `/lubirth-revised?${params.toString()}`);
}

async function expectRuntimeMoonGeoState(
  page: import("@playwright/test").Page,
  sample: RuntimeMoonGeoSample,
  solarMode: "day" | "night" = "day"
) {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ expected, mode }) => {
            const moon = window.__MiraLithLuBirthMoonPhase;
            const location = window.__MiraLithLuBirthRuntimeLocation;
            const solar = window.__MiraLithLuBirthSolarState;
            const sunDot = solar?.locationSunDot;

            return Boolean(
              moon?.source === "runtime-ephemeris" &&
                moon.date === expected.moonDate.slice(0, 10) &&
                location?.label === expected.label &&
                location.source === "manual" &&
                location.timeZone === expected.timeZone &&
                solar?.date === new Date(expected.sunDate).toISOString() &&
                typeof sunDot === "number" &&
                (mode === "day" ? sunDot > 0.42 : sunDot < -0.32)
            );
          },
          { expected: sample, mode: solarMode }
        ),
      { timeout: 25_000 }
    )
    .toBe(true);
}

for (const sample of RUNTIME_MOON_GEO_SAMPLES) {
  test(`can drive the nasa profile from moon phase and visitor geo for ${sample.label}`, async ({ page }) => {
    test.setTimeout(60_000);

    await openRuntimeMoonGeoSample(page, sample);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expectRuntimeMoonGeoState(page, sample);
  });
}

test("can drive the nasa profile into local night from visitor geo", async ({ page }) => {
  test.setTimeout(60_000);

  await openRuntimeMoonGeoSample(page, {
    label: "Tokyo",
    latitudeDeg: 35.6812,
    longitudeDeg: 139.7671,
    timeZone: "Asia/Tokyo",
    sunDate: "2026-05-01T15:00:00Z",
    moonDate: "2026-05-01T12:00:00Z"
  });
  await expect(page.locator("canvas")).toHaveCount(1);
  await expectRuntimeMoonGeoState(
    page,
    {
      label: "Tokyo",
      latitudeDeg: 35.6812,
      longitudeDeg: 139.7671,
      timeZone: "Asia/Tokyo",
      sunDate: "2026-05-01T15:00:00Z",
      moonDate: "2026-05-01T12:00:00Z"
    },
    "night"
  );
});

test("uses the IP geo endpoint when visitor location has no manual override", async ({ page }) => {
  await page.route("**/api/lubirth-geo", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        located: true,
        latitudeDeg: 47.6062,
        longitudeDeg: -122.3321,
        label: "Seattle, Washington, US",
        source: "edge-geo",
        timeZone: "America/Los_Angeles"
      })
    });
  });

  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=nasa&location=ip&visualTest=pixels");

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeLocation?.source), { timeout: 25_000 })
    .toBe("ip-geo");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeLocation?.label), { timeout: 25_000 })
    .toBe("Seattle, Washington, US");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthSolarState?.timeZone), { timeout: 25_000 })
    .toBe("America/Los_Angeles");
});

test("uses the earth-local aurora oval for high quality aurora debug", async ({ page }) => {
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
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraOvalActive ?? false), { timeout: 25_000 })
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
