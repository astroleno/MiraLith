import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

const EVIDENCE_DIR = path.join(process.cwd(), "screenshots/lubirth-close-atmosphere-polish-20260512");

test.afterEach(async ({ page }) => {
  await page.goto("about:blank").catch(() => undefined);
});

declare global {
  interface Window {
    __MiraLithLuBirthAtmosphereVariant?: string;
    __MiraLithLuBirthCloseAtmosphereTuning?: {
      allowed: boolean;
      effective: {
        edgeGlowStrength: number;
        verticalGradientStrength: number;
        depthShadowStrength: number;
        groundProjectionStrength: number;
        cloudVolumeShadowStrength: number;
      };
      requested: {
        edgeGlowStrength: number;
        verticalGradientStrength: number;
        depthShadowStrength: number;
        groundProjectionStrength: number;
        cloudVolumeShadowStrength: number;
      };
    };
    __MiraLithLuBirthRuntimeLocation?: unknown;
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
  }
}

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

function closeAtmosphereUrl(params: Record<string, string>, options: { pixels?: boolean } = { pixels: true }) {
  const defaults: Record<string, string> = {
    copy: "hidden",
    progress: "0",
    quality: "high"
  };
  if (options.pixels !== false) {
    defaults.visualTest = "pixels";
  }

  const url = new URLSearchParams({
    ...defaults,
    ...params
  });
  return `/lubirth-close-atmosphere-spike?${url.toString()}`;
}

async function waitForCloseScene(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereVariant), { timeout: 60_000 })
    .toBe("stack");
  await page.waitForTimeout(900);
}

async function sampleCanvasRegions(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 100;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const readRegion = (x0: number, y0: number, x1: number, y1: number) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let luma = 0;
      let count = 0;
      for (let y = Math.floor(y0 * canvas.height); y < Math.floor(y1 * canvas.height); y += 1) {
        for (let x = Math.floor(x0 * canvas.width); x < Math.floor(x1 * canvas.width); x += 1) {
          const pixel = (y * canvas.width + x) * 4;
          const pr = data[pixel];
          const pg = data[pixel + 1];
          const pb = data[pixel + 2];
          r += pr;
          g += pg;
          b += pb;
          luma += 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
          count += 1;
        }
      }

      const safeCount = Math.max(count, 1);
      return {
        blue: b / safeCount,
        green: g / safeCount,
        luma: luma / safeCount,
        red: r / safeCount
      };
    };

    return {
      blackField: readRegion(0.72, 0.06, 0.96, 0.26),
      closeLimb: readRegion(0.08, 0.62, 0.58, 0.92),
      terrainBand: readRegion(0.18, 0.70, 0.70, 0.96),
      upperAtmosphere: readRegion(0.08, 0.48, 0.62, 0.68)
    };
  });
}

test("close atmosphere spike is deterministic by default", async ({ page }) => {
  const geoRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/api/lubirth-geo")) {
      geoRequests.push(url.pathname);
    }
  });

  await page.goto(closeAtmosphereUrl({
    cloudDepth: "1",
    depth: "1",
    edge: "1",
    gradient: "1",
    projection: "1"
  }, { pixels: false }));
  await waitForCloseScene(page);

  expect(geoRequests).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeLocation ?? null), { timeout: 10_000 })
    .toBeNull();
});

test("close atmosphere all-on changes limb pixels while preserving black field", async ({ page }) => {
  await page.goto(closeAtmosphereUrl({
    cloudDepth: "0",
    depth: "0",
    edge: "0",
    gradient: "0",
    projection: "0"
  }));
  await waitForCloseScene(page);
  const off = await sampleCanvasRegions(page);

  await page.goto(closeAtmosphereUrl({
    cloudDepth: "1",
    depth: "1",
    edge: "1",
    gradient: "1",
    projection: "1"
  }));
  await waitForCloseScene(page);
  const on = await sampleCanvasRegions(page);

  expect(off).not.toBeNull();
  expect(on).not.toBeNull();
  expect(on!.blackField.luma).toBeLessThanOrEqual(Math.max(12, off!.blackField.luma + 4));
  expect(on!.closeLimb.luma).toBeGreaterThan(off!.closeLimb.luma + 3);
  expect(on!.closeLimb.blue).toBeGreaterThan(off!.closeLimb.blue + 4);
  expect(on!.upperAtmosphere.blue).toBeGreaterThanOrEqual(off!.upperAtmosphere.blue);
  expect(Math.abs(on!.terrainBand.luma - off!.terrainBand.luma)).toBeLessThanOrEqual(42);
});

test("cloudDepth knob affects cloud volume treatment independently", async ({ page }) => {
  await page.goto(closeAtmosphereUrl({
    cloudDepth: "0",
    depth: "0",
    edge: "1",
    gradient: "1",
    projection: "0"
  }));
  await waitForCloseScene(page);
  const cloudOff = await sampleCanvasRegions(page);

  await page.goto(closeAtmosphereUrl({
    cloudDepth: "1",
    depth: "0",
    edge: "1",
    gradient: "1",
    projection: "0"
  }));
  await waitForCloseScene(page);
  const cloudOn = await sampleCanvasRegions(page);

  expect(cloudOff).not.toBeNull();
  expect(cloudOn).not.toBeNull();
  expect(Math.abs(cloudOn!.terrainBand.luma - cloudOff!.terrainBand.luma)).toBeGreaterThan(0.8);
  expect(Math.abs(cloudOn!.terrainBand.luma - cloudOff!.terrainBand.luma)).toBeLessThan(36);
});

test("low quality disables effective close atmosphere additions", async ({ page }) => {
  await page.goto(closeAtmosphereUrl({
    cloudDepth: "2",
    depth: "2",
    edge: "2",
    gradient: "2",
    projection: "2",
    quality: "low"
  }, { pixels: false }));
  await waitForCloseScene(page);

  const state = await page.evaluate(() => ({
    tuning: window.__MiraLithLuBirthCloseAtmosphereTuning,
    volumetric: window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false
  }));

  expect(state.volumetric).toBe(false);
  expect(state.tuning?.allowed).toBe(false);
  expect(state.tuning?.requested.edgeGlowStrength).toBe(2);
  expect(state.tuning?.effective.edgeGlowStrength).toBe(0);
  expect(state.tuning?.effective.verticalGradientStrength).toBe(0);
  expect(state.tuning?.effective.depthShadowStrength).toBe(0);
  expect(state.tuning?.effective.groundProjectionStrength).toBe(0);
  expect(state.tuning?.effective.cloudVolumeShadowStrength).toBe(0);
});

test("captures close atmosphere evidence frames", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  test.skip(testInfo.project.name !== "desktop", "Close atmosphere evidence is captured once on desktop.");

  await page.setViewportSize({ width: 1440, height: 960 });

  const samples = [
    {
      name: "progress0-high-all-on",
      url: closeAtmosphereUrl({
        cloudDepth: "1",
        depth: "1",
        edge: "1",
        gradient: "1",
        projection: "1"
      }, { pixels: false })
    },
    {
      name: "progress05-high-all-on",
      url: closeAtmosphereUrl({
        cloudDepth: "1",
        depth: "1",
        edge: "1",
        gradient: "1",
        progress: "0.5",
        projection: "1"
      }, { pixels: false })
    },
    {
      name: "progress1-high-all-on",
      url: closeAtmosphereUrl({
        cloudDepth: "1",
        depth: "1",
        edge: "1",
        gradient: "1",
        progress: "1",
        projection: "1"
      }, { pixels: false })
    },
    {
      name: "progress0-medium-all-on",
      url: closeAtmosphereUrl({
        cloudDepth: "1",
        depth: "1",
        edge: "1",
        gradient: "1",
        projection: "1",
        quality: "medium"
      }, { pixels: false })
    },
    {
      name: "progress0-low-high-intensity",
      url: closeAtmosphereUrl({
        cloudDepth: "2",
        depth: "2",
        edge: "2",
        gradient: "2",
        projection: "2",
        quality: "low"
      }, { pixels: false })
    }
  ];

  for (const sample of samples) {
    await test.step(sample.name, async () => {
      await page.goto(sample.url);
      await waitForCloseScene(page);
      await captureEvidenceScreenshot(page, testInfo.project.name, sample.name);
    });
  }
});
