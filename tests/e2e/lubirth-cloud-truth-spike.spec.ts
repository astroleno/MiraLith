import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

declare global {
  interface Window {
    __MiraLithLuBirthAtmosphereLook?: string;
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
    __MiraLithLuBirthCloudTruthMode?: string;
    __MiraLithLuBirthCloudShellCount?: number;
    __MiraLithLuBirthCloudFieldTexture?: string;
    __MiraLithLuBirthGroundCloudShadowActive?: boolean;
    __MiraLithLuBirthPostBloomMode?: string;
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthVisualPolicy?: {
      bloomMode: string;
      cloudMode: string;
      groundShadow: boolean;
    };
    __MiraLithLuBirthSolarState?: {
      locationSunDot?: number;
    };
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
  }
}

async function waitForHomeVisual(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-runtime", "ready", {
    timeout: 25_000
  });
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

  await expect(page.locator(".lubirth-cloud-truth-spike")).toHaveAttribute("data-mode", "all");
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

  expect(Array.from(requests).some((path) => path.includes("earth-cloud-deck-2k"))).toBe(true);
  expect(Array.from(requests).some((path) => path.includes("earth-cloud-deck-4k"))).toBe(false);
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

test("production home uses one packed-normal cloud shell and one ground shadow source", async ({ page }) => {
  const requests = new Set<string>();
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/assets/lubirth/")) {
      requests.add(pathname);
    }
  });

  await page.goto("/?progress=0&copy=hidden&visualTest=pixels");
  await waitForHomeVisual(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudShellCount), { timeout: 25_000 })
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthGroundCloudShadowActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostBloomMode), { timeout: 25_000 })
    .toBe("lite");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudFieldTexture), { timeout: 25_000 })
    .toBe("/assets/lubirth/textures/earth-cloud-field-home.webp");

  const packedChannels = await page.evaluate(async () => {
    const image = new Image();
    image.src = "/assets/lubirth/textures/earth-cloud-field-home.webp";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 96;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const minima = [255, 255, 255, 255];
    const maxima = [0, 0, 0, 0];
    for (let index = 0; index < data.length; index += 4) {
      for (let channel = 0; channel < 4; channel += 1) {
        const value = data[index + channel] ?? 0;
        minima[channel] = Math.min(minima[channel] ?? 255, value);
        maxima[channel] = Math.max(maxima[channel] ?? 0, value);
      }
    }
    return {
      height: image.naturalHeight,
      ranges: maxima.map((maximum, index) => maximum - (minima[index] ?? maximum)),
      width: image.naturalWidth
    };
  });

  expect(packedChannels).not.toBeNull();
  expect(packedChannels).toMatchObject({ width: 1536, height: 768 });
  expect(packedChannels!.ranges[0]).toBeGreaterThan(120);
  expect(packedChannels!.ranges[1]).toBeGreaterThan(24);
  expect(packedChannels!.ranges[2]).toBeGreaterThan(24);
  expect(packedChannels!.ranges[3]).toBeGreaterThan(90);
  expect(Array.from(requests).some((pathname) => pathname.includes("earth-cloud-field-home.webp"))).toBe(true);
  expect(Array.from(requests).some((pathname) => pathname.includes("earth-clouds-2k"))).toBe(false);
  expect(Array.from(requests).some((pathname) => pathname.includes("earth-cloud-deck"))).toBe(false);
});

test("home cloud matrix stays visible across progress, lighting, viewport, and fallback modes", async ({ page }) => {
  const lightingSamples = [
    { label: "day", progress: "0", sunDate: "2026-05-01T03:00:00Z" },
    { label: "terminator", progress: "0.5", sunDate: "2026-05-01T10:30:00Z" },
    { label: "backlit", progress: "1", sunDate: "2026-05-01T15:00:00Z" }
  ] as const;
  const profiles = [
    {
      bloomMode: "lite",
      cloudMode: "shell-lite",
      groundShadow: true,
      quality: "medium",
      viewport: { width: 1280, height: 720 }
    },
    {
      bloomMode: "off",
      cloudMode: "surface",
      groundShadow: false,
      quality: "low",
      viewport: { width: 844, height: 390 }
    }
  ] as const;

  for (const profile of profiles) {
    await page.setViewportSize(profile.viewport);
    for (const sample of lightingSamples) {
      const params = new URLSearchParams({
        copy: "hidden",
        geoLabel: "Mianyang",
        geoLat: "31.4675",
        geoLon: "104.6796",
        geoTimeZone: "Asia/Shanghai",
        location: "ip",
        progress: sample.progress,
        quality: profile.quality,
        sunDate: sample.sunDate,
        visualTest: "pixels"
      });
      await page.goto(`/?${params.toString()}`);
      await waitForHomeVisual(page);
      await expect
        .poll(() => page.evaluate(() => window.__MiraLithLuBirthVisualPolicy), { timeout: 25_000 })
        .toMatchObject({
          bloomMode: profile.bloomMode,
          cloudMode: profile.cloudMode,
          groundShadow: profile.groundShadow
        });
      const visibility = await sampleCanvasVisibility(page);
      expect(visibility, `${profile.quality}-${sample.label}`).not.toBeNull();
      expect(visibility!.maxLuma, `${profile.quality}-${sample.label}`).toBeGreaterThan(20);
      expect(visibility!.litPixelRatio, `${profile.quality}-${sample.label}`).toBeGreaterThan(0.012);
      expect(visibility!.averageLuma, `${profile.quality}-${sample.label}`).toBeGreaterThan(0.7);
    }
  }
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
