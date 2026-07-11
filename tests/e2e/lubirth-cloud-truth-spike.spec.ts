import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __MiraLithLuBirthAtmosphereLook?: string;
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
    __MiraLithLuBirthCloudTruthMode?: string;
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
  }
}

async function sampleCanvasVisibility(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = 180;
    sample.height = 100;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(source, 0, 0, sample.width, sample.height);
    const data = context.getImageData(0, 0, sample.width, sample.height).data;
    let litPixels = 0;
    let maxLuma = 0;
    let totalLuma = 0;
    let lowerLuma = 0;
    let lowerCount = 0;

    for (let y = 0; y < sample.height; y += 1) {
      for (let x = 0; x < sample.width; x += 1) {
        const index = (y * sample.width + x) * 4;
        const luma = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        totalLuma += luma;
        maxLuma = Math.max(maxLuma, luma);
        if (luma > 8) {
          litPixels += 1;
        }
        if (y > sample.height * 0.6) {
          lowerLuma += luma;
          lowerCount += 1;
        }
      }
    }

    const pixelCount = sample.width * sample.height;
    return {
      averageLuma: totalLuma / pixelCount,
      litPixelRatio: litPixels / pixelCount,
      lowerLuma: lowerLuma / Math.max(lowerCount, 1),
      maxLuma
    };
  });
}

test("cloud truth spike renders one production canvas with stack atmosphere", async ({ page }) => {
  const requests = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      requests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-cloud-truth-spike?mode=all&quality=high&progress=0&copy=hidden");

  await expect(page.locator(".lubirth-cloud-truth-spike")).toHaveAttribute("data-cloud-truth-mode", "all");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudTruthMode), { timeout: 25_000 })
    .toBe("all");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereLook), { timeout: 25_000 })
    .toBe("reference");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false), { timeout: 25_000 })
    .toBe(false);
  await page.waitForTimeout(900);

  expect(Array.from(requests).some((path) => path.includes("earth-cloud-deck-4k"))).toBe(true);
  expect(Array.from(requests).some((path) => path.includes("earth-cloud-deck-2k"))).toBe(false);
});

test("cloud truth baseline does not request cloud deck", async ({ page }) => {
  const requests = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      requests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-cloud-truth-spike?mode=baseline&quality=high&progress=0&copy=hidden");
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.waitForTimeout(900);

  expect(Array.from(requests).filter((path) => path.includes("earth-cloud-deck-"))).toEqual([]);
});

test("cloud truth low quality keeps candidate cloud effects disabled", async ({ page }) => {
  await page.goto("/lubirth-cloud-truth-spike?mode=all&quality=low&progress=0&copy=hidden");

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("low");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudTruthMode), { timeout: 25_000 })
    .toBe("all");
  await expect(page.locator("canvas")).toHaveCount(1);
});

for (const mode of ["baseline", "edge", "volume", "shadow", "all"] as const) {
  test(`captures cloud truth evidence for ${mode}`, async ({ page }, testInfo) => {
    await page.goto(`/lubirth-cloud-truth-spike?mode=${mode}&quality=high&progress=0&copy=hidden&visualTest=pixels`);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
      .toBe("high");
    await page.waitForTimeout(1200);

    const visibility = await sampleCanvasVisibility(page);
    expect(visibility).not.toBeNull();
    expect(visibility!.maxLuma).toBeGreaterThan(28);
    expect(visibility!.litPixelRatio).toBeGreaterThan(0.025);
    expect(visibility!.lowerLuma).toBeGreaterThan(5);

    const screenshot = await page.screenshot({ fullPage: false });
    await testInfo.attach(`cloud-truth-${mode}-progress0.png`, {
      body: screenshot,
      contentType: "image/png"
    });
  });
}
