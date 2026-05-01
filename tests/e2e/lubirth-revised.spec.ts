import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __MiraLithLuBirthAuroraEnabled?: boolean;
    __MiraLithLuBirthAuroraProfile?: string;
    __MiraLithLuBirthAirglowActive?: boolean;
    __MiraLithLuBirthCloudDeckActive?: boolean;
    __MiraLithLuBirthCloudDeckTexture?: string;
    __MiraLithLuBirthProjectedAuroraCurtainActive?: boolean;
    __MiraLithLuBirthProjectedCloudPlateActive?: boolean;
    __MiraLithLuBirthProjectedCloudPlateTexture?: string;
    __MiraLithLuBirthProjectedHorizonCompositeActive?: boolean;
    __MiraLithLuBirthProjectedHorizonCompositeLayer?: string;
    __MiraLithLuBirthProjectedHorizonCompositeTexture?: string;
    __MiraLithLuBirthProjectedLimbScatteringActive?: boolean;
    __MiraLithLuBirthQualityTier?: string;
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
  for (const layer of ["stars", "clouds", "atmosphere", "aurora", "all"]) {
    await page.goto(`/lubirth-revised?progress=0&copy=hidden&debug=${layer}&visualTest=pixels`);

    await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-debug-layer", layer);
    await expect(page.locator("canvas")).toHaveCount(1);
  }
});

test("defaults the study route to an earth-moon only view", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&debug=all");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy", "hidden");
  await expect(page.locator(".lubirth-revised__hero-copy")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__title-rail")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("keeps revised route clear of 8K LuBirth texture requests", async ({ page }) => {
  const assetRequests = new Set<string>();

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      assetRequests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=all&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-day")), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudDeckActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAirglowActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await page.waitForTimeout(900);

  const heavyRequests = Array.from(assetRequests).filter(
    (path) =>
      path.includes("earth-day-8k") ||
      path.includes("earth-night-8k") ||
      path.includes("earth-clouds-8k") ||
      path.includes("earth-clouds-2k") ||
      path.includes("earth-horizon-cloud-strip-2k") ||
      path.includes("8k_stars_milky_way")
  );

  expect(heavyRequests).toEqual([]);
});

test("uses the projected horizon composite for high quality cloud review", async ({ page }) => {
  const assetRequests = new Set<string>();

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      assetRequests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=clouds&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeLayer), { timeout: 25_000 })
    .toBe("clouds");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeTexture), { timeout: 25_000 })
    .toContain("earth-horizon-cloud-strip-2k.png");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudDeckActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedCloudPlateActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => Array.from(assetRequests).some((path) => path.includes("earth-horizon-cloud-strip-2k.png")), { timeout: 25_000 })
    .toBe(true);
  await page.waitForTimeout(900);
  expect(Array.from(assetRequests).filter((path) => path.includes("earth-cloud-deck-2k.png"))).toEqual([]);
});

test("uses the projected horizon composite for atmosphere review", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=atmosphere&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeLayer), { timeout: 25_000 })
    .toBe("atmosphere");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAirglowActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedLimbScatteringActive ?? false), { timeout: 25_000 })
    .toBe(false);
});

test("uses the projected horizon composite for high quality aurora debug", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=aurora&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeLayer), { timeout: 25_000 })
    .toBe("aurora");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedAuroraCurtainActive ?? false), { timeout: 25_000 })
    .toBe(false);
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

test("honors LuBirth quality URL overrides for aurora debugging", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=aurora&quality=low&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("low");
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraEnabled)).toBe(false);

  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=aurora&quality=high&visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("high");
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraEnabled)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraProfile)).toBe("hero");

  await page.goto("/lubirth-revised?progress=0&copy=hidden&debug=aurora&quality=high&auroraProfile=debug&visualTest=pixels");
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
