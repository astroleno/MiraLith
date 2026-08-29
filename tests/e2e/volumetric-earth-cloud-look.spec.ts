import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

declare global {
  interface Window {
    __MiraLithVolumetricEarthCloudLook?: string;
    __MiraLithVolumetricEarthCloudFbmEnabled?: boolean;
  }
}

test("earth volumetric route exposes an explicit baseline versus FBM cloud A/B", async ({ page }) => {
  await page.goto("/earth-volumetric?quality=low&cloudLook=baseline");

  await expect(page.locator("main.volumetric-earth")).toHaveAttribute("data-cloud-look", "baseline");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithVolumetricEarthCloudLook), { timeout: 25_000 })
    .toBe("baseline");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithVolumetricEarthCloudFbmEnabled), { timeout: 25_000 })
    .toBe(false);

  await page.goto("/earth-volumetric?quality=low&cloudLook=fbm");

  await expect(page.locator("main.volumetric-earth")).toHaveAttribute("data-cloud-look", "fbm");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithVolumetricEarthCloudLook), { timeout: 25_000 })
    .toBe("fbm");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithVolumetricEarthCloudFbmEnabled), { timeout: 25_000 })
    .toBe(true);
});
