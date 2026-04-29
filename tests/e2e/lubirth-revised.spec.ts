import { expect, test } from "@playwright/test";

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
  await page.goto("/lubirth-revised");

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

test("visual pixel mode hides visible copy without fake future chapter anchors", async ({ page }) => {
  await page.goto("/lubirth-revised?visualTest=pixels#miralith-chapter-now-building");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy", "hidden");
  await expect(page.locator("#miralith-chapter-now-building")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__world-mark")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__hero-copy")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__title-rail")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
});
