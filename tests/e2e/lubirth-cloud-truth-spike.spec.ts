import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

declare global {
  interface Window {
    __MiraLithLuBirthAtmosphereLook?: string;
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
    __MiraLithLuBirthCloudTruthMode?: string;
    __MiraLithLuBirthCloudShellCount?: number;
    __MiraLithLuBirthCloudFieldTexture?: string;
    __MiraLithLuBirthCloudShellOffset?: number;
    __MiraLithLuBirthCloudShellTextureUuid?: string;
    __MiraLithLuBirthGroundCloudFieldTextureUuid?: string;
    __MiraLithLuBirthGroundCloudOffset?: number;
    __MiraLithLuBirthGroundCloudShadowActive?: boolean;
    __MiraLithLuBirthPostEffectMode?: string;
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthVisualPolicy?: {
      postEffectMode: string;
      cloudMode: string;
      groundShadow: boolean;
    };
    __MiraLithLuBirthSolarState?: {
      locationSunDot?: number;
    };
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
    __MiraLithHomeProjectionFrame?: {
      width: number;
      height: number;
      earthHorizonPath: string;
      moon: {
        x: number;
        y: number;
        radius: number;
      };
    };
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

async function sampleHomeHorizonBand(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    const frame = window.__MiraLithHomeProjectionFrame;
    if (!source || !frame) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = frame.width;
    sample.height = frame.height;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const coordinates = (frame.earthHorizonPath.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const points: Array<[number, number]> = [];
    for (let index = 0; index < coordinates.length; index += 2) {
      points.push([coordinates[index] ?? 0, coordinates[index + 1] ?? 0]);
    }

    const lumaAt = (x: number, y: number) => {
      const sampleX = Math.max(0, Math.min(sample.width - 1, Math.round(x)));
      const sampleY = Math.max(0, Math.min(sample.height - 1, Math.round(y)));
      const index = (sampleY * sample.width + sampleX) * 4;
      return (
        0.2126 * (pixels[index] ?? 0) +
        0.7152 * (pixels[index + 1] ?? 0) +
        0.0722 * (pixels[index + 2] ?? 0)
      );
    };

    let sampleCount = 0;
    let readableSampleCount = 0;
    let darkDipCount = 0;
    let edgeLuma = 0;
    let nearSurfaceLuma = 0;
    let innerSurfaceLuma = 0;

    for (let index = 2; index < points.length - 2; index += 3) {
      const [x, y] = points[index] ?? [0, 0];
      if (x < 40 || x > sample.width - 40 || y < 40 || y > sample.height - 40) {
        continue;
      }
      const [previousX, previousY] = points[index - 1] ?? [x - 1, y];
      const [nextX, nextY] = points[index + 1] ?? [x + 1, y];
      let normalX = -(nextY - previousY);
      let normalY = nextX - previousX;
      const normalLength = Math.max(Math.hypot(normalX, normalY), 1e-5);
      normalX /= normalLength;
      normalY /= normalLength;
      if (normalY < 0) {
        normalX *= -1;
        normalY *= -1;
      }

      const edge = lumaAt(x + normalX, y + normalY);
      const nearSurface = lumaAt(x + normalX * 3, y + normalY * 3);
      const midSurface = lumaAt(x + normalX * 6, y + normalY * 6);
      const innerSurface = lumaAt(x + normalX * 12, y + normalY * 12);
      edgeLuma += edge;
      nearSurfaceLuma += nearSurface;
      innerSurfaceLuma += innerSurface;
      sampleCount += 1;

      if (innerSurface > 8) {
        readableSampleCount += 1;
        if (nearSurface < innerSurface * 0.55 && nearSurface < midSurface * 0.65) {
          darkDipCount += 1;
        }
      }
    }

    return {
      darkDipRatio: darkDipCount / Math.max(readableSampleCount, 1),
      edgeLuma: edgeLuma / Math.max(sampleCount, 1),
      innerSurfaceLuma: innerSurfaceLuma / Math.max(sampleCount, 1),
      nearSurfaceLuma: nearSurfaceLuma / Math.max(sampleCount, 1),
      readableSampleCount,
      sampleCount
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
  const shaderErrors: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/assets/lubirth/")) {
      requests.add(pathname);
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /WebGLProgram|Shader Error|VALIDATE_STATUS|shader is not compiled/i.test(message.text())
    ) {
      shaderErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/WebGLProgram|Shader Error|VALIDATE_STATUS|shader is not compiled/i.test(error.message)) {
      shaderErrors.push(error.message);
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
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostEffectMode), { timeout: 25_000 })
    .toBe("analytic-halo");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudFieldTexture), { timeout: 25_000 })
    .toBe("/assets/lubirth/textures/earth-cloud-field-home.webp");
  await expect
    .poll(
      () => page.evaluate(() => ({
        ground: window.__MiraLithLuBirthGroundCloudFieldTextureUuid,
        shell: window.__MiraLithLuBirthCloudShellTextureUuid
      })),
      { timeout: 25_000 }
    )
    .toEqual(expect.objectContaining({
      ground: expect.any(String),
      shell: expect.any(String)
    }));
  await expect
    .poll(
      () => page.evaluate(() =>
        window.__MiraLithLuBirthGroundCloudFieldTextureUuid ===
        window.__MiraLithLuBirthCloudShellTextureUuid
      ),
      { timeout: 25_000 }
    )
    .toBe(true);
  await expect
    .poll(
      () => page.evaluate(() => ({
        ground: window.__MiraLithLuBirthGroundCloudOffset,
        shell: window.__MiraLithLuBirthCloudShellOffset
      })),
      { timeout: 25_000 }
    )
    .toEqual({
      ground: expect.any(Number),
      shell: expect.any(Number)
    });
  await expect
    .poll(
      () => page.evaluate(() =>
        Math.abs(
          (window.__MiraLithLuBirthGroundCloudOffset ?? 0) -
          (window.__MiraLithLuBirthCloudShellOffset ?? 0)
        )
      ),
      { timeout: 25_000 }
    )
    .toBeLessThan(1e-7);

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
  expect(shaderErrors).toEqual([]);
});

test("home cloud matrix stays visible across progress, lighting, viewport, and fallback modes", async ({ page }) => {
  const lightingSamples = [
    { label: "day", progress: "0", sunDate: "2026-05-01T03:00:00Z", geoLat: "31.4675", geoLon: "104.6796" },
    { label: "terminator", progress: "0.5", sunDate: "2026-05-01T10:30:00Z", geoLat: "31.4675", geoLon: "104.6796" },
    { label: "backlit", progress: "1", sunDate: "2026-05-01T15:00:00Z", geoLat: "31.4675", geoLon: "104.6796" },
    { label: "north-polar", progress: "0", sunDate: "2026-06-21T12:00:00Z", geoLat: "89", geoLon: "0" }
  ] as const;
  const profiles = [
    {
      postEffectMode: "analytic-halo",
      cloudMode: "shell-lite",
      groundShadow: true,
      quality: "medium",
      viewport: { width: 1280, height: 720 }
    },
    {
      postEffectMode: "off",
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
        geoLabel: sample.label === "north-polar" ? "North polar test" : "Mianyang",
        geoLat: sample.geoLat,
        geoLon: sample.geoLon,
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
          postEffectMode: profile.postEffectMode,
          cloudMode: profile.cloudMode,
          groundShadow: profile.groundShadow
        });
      const visibility = await sampleCanvasVisibility(page);
      expect(visibility, `${profile.quality}-${sample.label}`).not.toBeNull();
      expect(visibility!.maxLuma, `${profile.quality}-${sample.label}`).toBeGreaterThan(20);
      expect(visibility!.litPixelRatio, `${profile.quality}-${sample.label}`).toBeGreaterThan(0.012);
      expect(visibility!.averageLuma, `${profile.quality}-${sample.label}`).toBeGreaterThan(0.7);
      if (profile.cloudMode === "shell-lite" && sample.progress === "0") {
        await expect
          .poll(() => page.evaluate(() => Boolean(window.__MiraLithHomeProjectionFrame)), { timeout: 25_000 })
          .toBe(true);
        const horizonBand = await sampleHomeHorizonBand(page);
        expect(horizonBand, `${profile.quality}-${sample.label}-horizon`).not.toBeNull();
        expect(horizonBand!.sampleCount, `${profile.quality}-${sample.label}-horizon`).toBeGreaterThan(20);
        expect(horizonBand!.readableSampleCount, `${profile.quality}-${sample.label}-horizon`).toBeGreaterThan(15);
        expect(horizonBand!.darkDipRatio, `${profile.quality}-${sample.label}-horizon`).toBeLessThan(0.12);
        expect(horizonBand!.nearSurfaceLuma, `${profile.quality}-${sample.label}-horizon`).toBeGreaterThan(
          horizonBand!.innerSurfaceLuma * 0.7
        );
      }
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
