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

    return { background, day, night, ratio: day / Math.max(night, 1) };
  });
}

test("far view keeps a readable dark side and at least 2:1 day-night separation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Lighting pixels are calibrated once at 1440×960.");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    "/?progress=1&copy=hidden&quality=medium&visualTest=pixels&location=birth&sunDate=2026-07-12T09:00:00Z&moonPhase=birth&postEffect=off"
  );
  await waitForLightingFrame(page);

  const lighting = await sampleEarthLighting(page);
  expect(lighting).not.toBeNull();
  console.log(`far Earth lighting ${JSON.stringify(lighting)}`);
  expect(lighting?.ratio).toBeGreaterThanOrEqual(2);
  expect(lighting?.night).toBeGreaterThan(2.5);
  expect(lighting?.night).toBeGreaterThan((lighting?.background ?? 0) + 1);
  await testInfo.attach("far-day-night-lighting-metrics", {
    body: Buffer.from(JSON.stringify(lighting, null, 2)),
    contentType: "application/json"
  });
  await testInfo.attach("far-day-night-lighting", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
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
