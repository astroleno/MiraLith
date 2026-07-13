import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

const LIGHTING_EVIDENCE_DIR = path.join(process.cwd(), "output/playwright/lubirth-lighting-revision");

function lightingEvidencePath(name: string) {
  mkdirSync(LIGHTING_EVIDENCE_DIR, { recursive: true });
  return path.join(LIGHTING_EVIDENCE_DIR, `${name}.png`);
}

declare global {
  interface Window {
    __MiraLithLuBirthProjectedEarthLighting?: {
      center: [number, number];
      progress: number;
      radius: number;
      sunDirection: [number, number];
    };
    __MiraLithLuBirthRuntimeProfile?: string;
  }
}

async function waitForLightingFrame(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeProfile), { timeout: 25_000 })
    .toBe("home-lite");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedEarthLighting), { timeout: 25_000 })
    .toBeTruthy();
  await page.waitForTimeout(800);
}

async function sampleEarthLighting(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    const frame = window.__MiraLithLuBirthProjectedEarthLighting;
    if (!source || !frame) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;

    const patchMedian = (centerX: number, centerY: number, radius: number) => {
      const values: number[] = [];
      const minX = Math.max(0, Math.floor(centerX - radius));
      const maxX = Math.min(sample.width - 1, Math.ceil(centerX + radius));
      const minY = Math.max(0, Math.floor(centerY - radius));
      const maxY = Math.min(sample.height - 1, Math.ceil(centerY + radius));
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (Math.hypot(x - centerX, y - centerY) > radius) {
            continue;
          }
          const index = (y * sample.width + x) * 4;
          values.push(
            0.2126 * (pixels[index] ?? 0) +
            0.7152 * (pixels[index + 1] ?? 0) +
            0.0722 * (pixels[index + 2] ?? 0)
          );
        }
      }
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length * 0.5)] ?? 0;
    };

    const [centerX, centerY] = frame.center;
    const [sunX, sunY] = frame.sunDirection;
    const interiorOffset = frame.radius * 0.52;
    const patchRadius = Math.max(3, frame.radius * 0.055);
    const day = patchMedian(centerX + sunX * interiorOffset, centerY + sunY * interiorOffset, patchRadius);
    const night = patchMedian(centerX - sunX * interiorOffset, centerY - sunY * interiorOffset, patchRadius);
    const perpendicularX = -sunY;
    const perpendicularY = sunX;
    const background = patchMedian(
      centerX + perpendicularX * frame.radius * 1.22,
      centerY + perpendicularY * frame.radius * 1.22,
      patchRadius
    );

    return {
      background,
      day,
      night,
      ratio: day / Math.max(night, 1),
      sampleFrame: {
        center: [centerX, centerY],
        dayPoint: [centerX + sunX * interiorOffset, centerY + sunY * interiorOffset],
        nightPoint: [centerX - sunX * interiorOffset, centerY - sunY * interiorOffset],
        radius: frame.radius,
        sunDirection: [sunX, sunY]
      }
    };
  });
}

test("far view keeps a readable dark side with bounded day-night contrast", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Lighting pixels are calibrated once at 1440×960.");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    "/?progress=1&copy=hidden&quality=medium&visualTest=pixels&location=birth&sunDate=2026-07-12T09:00:00Z&moonPhase=birth&postEffect=off"
  );
  await waitForLightingFrame(page);

  const lighting = await sampleEarthLighting(page);
  expect(lighting).not.toBeNull();
  console.log(`far Earth lighting ${JSON.stringify(lighting)}`);
  await page.screenshot({ path: lightingEvidencePath("earth-far-night-readability"), timeout: 30_000 });
  expect(lighting?.ratio).toBeGreaterThanOrEqual(2);
  expect(lighting?.ratio).toBeLessThanOrEqual(20);
  expect(lighting?.night).toBeGreaterThanOrEqual(5.5);
  expect(lighting?.night).toBeGreaterThanOrEqual((lighting?.background ?? 0) + 3.5);
  await testInfo.attach("far-day-night-lighting-metrics", {
    body: Buffer.from(JSON.stringify(lighting, null, 2)),
    contentType: "application/json"
  });
  await testInfo.attach("far-day-night-lighting", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("production home renders the 2K photographic star field above black", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Star-field pixels are calibrated once at 1440×960.");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    "/?progress=1&copy=hidden&quality=medium&visualTest=pixels&location=birth&sunDate=2026-07-12T09:00:00Z&moonPhase=birth&postEffect=off"
  );
  await waitForLightingFrame(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthSpaceBackgroundTexture), { timeout: 25_000 })
    .toBe("/assets/lubirth/backgrounds/stars-milky-way-2k.webp");

  const sky = await page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const values: number[] = [];
    const minX = Math.floor(sample.width * 0.06);
    const maxX = Math.floor(sample.width * 0.4);
    const minY = Math.floor(sample.height * 0.12);
    const maxY = Math.floor(sample.height * 0.44);
    for (let y = minY; y < maxY; y += 2) {
      for (let x = minX; x < maxX; x += 2) {
        const index = (y * sample.width + x) * 4;
        values.push(
          0.2126 * (pixels[index] ?? 0) +
          0.7152 * (pixels[index + 1] ?? 0) +
          0.0722 * (pixels[index + 2] ?? 0)
        );
      }
    }
    values.sort((a, b) => a - b);
    const mean = values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
    const p95 = values[Math.floor(values.length * 0.95)] ?? 0;
    const brightFraction = values.filter((value) => value >= 3).length / Math.max(values.length, 1);
    return { brightFraction, mean, p95 };
  });

  expect(sky).not.toBeNull();
  console.log(`production sky lighting ${JSON.stringify(sky)}`);
  expect(sky?.mean).toBeGreaterThanOrEqual(0.4);
  expect(sky?.p95).toBeGreaterThanOrEqual(0.75);
  expect(sky?.brightFraction).toBeGreaterThanOrEqual(0.002);
});

test("forced fallback is hydration-stable and serves its poster", async ({ page }) => {
  const runtimeErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|server rendered html|did not match/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydration|server rendered html|did not match/i.test(error.message)) {
      runtimeErrors.push(error.message);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes("/assets/lubirth/") && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url.pathname}`);
    }
  });

  const posterResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/assets/lubirth/poster-field.webp"
  );
  await page.goto("/?visual=fallback&copy=visible", { waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="lubirth"]')).toBeVisible();
  expect((await posterResponse).status()).toBe(200);
  await page.waitForTimeout(150);
  expect(runtimeErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

test("captures the deterministic loading, halo, moon, progress, and landscape matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The visual matrix is captured once from Chromium.");

  await page.setViewportSize({ width: 1440, height: 960 });
  const fixedBase = "copy=hidden&quality=medium&visualTest=pixels&location=birth&sunDate=2026-07-12T09:00:00Z";
  const samples = [
    { name: "earth-close-birth-halo", query: `progress=0&${fixedBase}&moonPhase=birth&postEffect=analytic-halo` },
    { name: "earth-close-birth-no-halo", query: `progress=0&${fixedBase}&moonPhase=birth&postEffect=off` },
    { name: "earth-middle-birth-halo", query: `progress=0.5&${fixedBase}&moonPhase=birth&postEffect=analytic-halo` },
    { name: "earth-far-birth-halo", query: `progress=1&${fixedBase}&moonPhase=birth&postEffect=analytic-halo` },
    {
      name: "earth-close-today-halo",
      query: `progress=0&${fixedBase}&moonPhase=today&moonDate=2026-07-12T12:00:00Z&postEffect=analytic-halo`
    }
  ];

  for (const sample of samples) {
    await page.goto(`/?${sample.query}`);
    await waitForLightingFrame(page);
    await page.screenshot({ path: lightingEvidencePath(sample.name), timeout: 30_000 });
  }

  await page.setViewportSize({ width: 844, height: 390 });
  for (const sample of [
    { name: "landscape-close", progress: 0 },
    { name: "landscape-final", progress: 1 }
  ]) {
    await page.goto(`/?progress=${sample.progress}&${fixedBase}&moonPhase=birth&postEffect=analytic-halo`);
    await waitForLightingFrame(page);
    await page.screenshot({ path: lightingEvidencePath(sample.name), timeout: 30_000 });
  }

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/?visual=fallback&copy=visible", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const moon = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--draw");
    if (root?.dataset.homeLoading !== "active" || !moon) {
      return false;
    }
    const style = window.getComputedStyle(moon);
    const offset = Number.parseFloat(style.strokeDashoffset);
    return offset > 0.2 && offset < 0.8 && Number.parseFloat(style.opacity) > 0.5;
  });
  await page.screenshot({ path: lightingEvidencePath("loading-moon-drawing"), timeout: 30_000 });

  await page.waitForFunction(() => {
    const moon = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--draw");
    if (!moon) {
      return false;
    }
    const style = window.getComputedStyle(moon);
    return /1px,\s*0px/.test(style.strokeDasharray) && Number.parseFloat(style.opacity) > 0.82;
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: lightingEvidencePath("loading-moon-closed-hold"), timeout: 30_000 });
});
