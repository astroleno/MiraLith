import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

declare global {
  interface Window {
    __MiraLithLuBirthAtmospherePolicyReason?: string;
    __MiraLithLuBirthAtmosphereVariant?: string;
    __MiraLithLuBirthCloudShellCount?: number;
    __MiraLithLuBirthGroundCloudShadowActive?: boolean;
    __MiraLithLuBirthRuntimeProfile?: string;
    __MiraLithLuBirthPostEffectMode?: string;
    __MiraLithLuBirthVisualPolicy?: {
      postEffectMode: string;
      cloudMode: string;
      groundShadow: boolean;
    };
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
  }
}

async function measureHomePage(
  page: import("@playwright/test").Page,
  url: string,
  expectedPolicy: { postEffectMode: string; cloudMode: string; groundShadow: boolean },
  sampleMs = 1_800
) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-runtime", "ready", {
    timeout: 25_000
  });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVisualPolicy), { timeout: 25_000 })
    .toMatchObject(expectedPolicy);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthPostEffectMode), { timeout: 25_000 })
    .toBe(expectedPolicy.postEffectMode);
  if (expectedPolicy.cloudMode === "shell-lite") {
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudShellCount), { timeout: 25_000 })
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthGroundCloudShadowActive), { timeout: 25_000 })
      .toBe(expectedPolicy.groundShadow);
  }
  await page.waitForTimeout(1_500);
  return sampleStableRafStats(page, sampleMs);
}

async function measureFreshHomePage(
  browser: import("@playwright/test").Browser,
  viewport: { width: number; height: number },
  url: string,
  expectedPolicy: { postEffectMode: string; cloudMode: string; groundShadow: boolean }
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    return await measureHomePage(page, url, expectedPolicy);
  } finally {
    await context.close();
  }
}

interface RafStats {
  count: number;
  max: number;
  median: number;
  p95: number;
}

const STRICT_PERF = process.env.LUBIRTH_PERF_STRICT === "1";
// A 60 Hz RAF interval is 16.67 ms; allow sub-millisecond headless scheduler jitter.
const DESKTOP_HOME_P95_BUDGET_MS = 18;
const MOBILE_LANDSCAPE_HOME_P95_BUDGET_MS = 18.5;
const ANALYTIC_HALO_P95_OVERHEAD_BUDGET_MS = 0.5;

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index] ?? 0;
}

function summarizeDeltas(deltas: number[]): RafStats {
  return {
    count: deltas.length,
    max: Math.max(...deltas),
    median: percentile(deltas, 0.5),
    p95: percentile(deltas, 0.95)
  };
}

async function sampleRafStats(page: import("@playwright/test").Page, sampleMs = 1_800) {
  const deltas = await page.evaluate((durationMs) =>
    new Promise<number[]>((resolve) => {
      const samples: number[] = [];
      let previous = 0;
      let startedAt = 0;

      const tick = (timestamp: number) => {
        if (startedAt === 0) {
          startedAt = timestamp;
        }
        if (previous !== 0) {
          samples.push(timestamp - previous);
        }
        previous = timestamp;

        if (timestamp - startedAt >= durationMs) {
          resolve(samples);
          return;
        }

        window.requestAnimationFrame(tick);
      };

      window.requestAnimationFrame(tick);
    }), sampleMs);

  return summarizeDeltas(deltas);
}

async function sampleStableRafStats(
  page: import("@playwright/test").Page,
  sampleMs = 1_800,
  windowCount = 3
) {
  const windows: RafStats[] = [];
  for (let index = 0; index < windowCount; index += 1) {
    windows.push(await sampleRafStats(page, sampleMs));
  }

  // SwiftShader occasionally loses an entire vsync window to host scheduling.
  // Use the median of independent windows so a promotion result represents the
  // renderer's sustained cost while still failing a consistently slow shader.
  return {
    count: Math.min(...windows.map((stats) => stats.count)),
    max: percentile(windows.map((stats) => stats.max), 0.5),
    median: percentile(windows.map((stats) => stats.median), 0.5),
    p95: percentile(windows.map((stats) => stats.p95), 0.5)
  };
}

async function measurePage(
  page: import("@playwright/test").Page,
  url: string,
  expectedVariant: "stack" | "volumetric",
  warmupMs = 1_000
) {
  await page.goto(url);
  await expect(page.locator("canvas")).toHaveCount(expectedVariant === "stack" ? 1 : 1, { timeout: 25_000 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereVariant), { timeout: 25_000 })
    .toBe(expectedVariant);
  await page.waitForTimeout(warmupMs);
  return sampleRafStats(page);
}

function logStats(label: string, stats: RafStats) {
  console.log(`${label}: median=${stats.median.toFixed(2)}ms p95=${stats.p95.toFixed(2)}ms max=${stats.max.toFixed(2)}ms samples=${stats.count}`);
}

function expectRafSamples(label: string, stats: RafStats, testInfo: import("@playwright/test").TestInfo) {
  if (stats.count < 30) {
    const description = `${label} RAF sample count was ${stats.count}; measurement is invalid for promotion budgeting.`;
    testInfo.annotations.push({ type: "perf-invalid", description });
    console.log(description);
  }

  expect(stats.count).toBeGreaterThanOrEqual(30);
}

test("records blank RAF control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Performance sampling is calibrated for desktop review.");

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.setContent("<!doctype html><main>RAF control</main>");
  const control = await sampleRafStats(page);

  logStats("blank RAF control", control);
  expectRafSamples("blank RAF control", control, testInfo);

  if (STRICT_PERF) {
    expect(control.median).toBeLessThanOrEqual(24);
    expect(control.p95).toBeLessThanOrEqual(40);
  }
});

test("records spike stack vs volumetric RAF performance", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Performance sampling is calibrated for desktop review.");
  test.skip(STRICT_PERF, "Strict promotion budgeting is scoped to the production home renderer.");

  await page.setViewportSize({ width: 1440, height: 960 });

  const stack = await measurePage(
    page,
    "/lubirth-atmosphere-spike?atmo=stack&look=lubirth&quality=high&copy=hidden&perfTest=raf",
    "stack"
  );
  const volumetric = await measurePage(
    page,
    "/lubirth-atmosphere-spike?atmo=volumetric&look=lubirth&quality=high&copy=hidden&perfTest=raf",
    "volumetric"
  );
  const regressionRatio = stack.median > 0 ? volumetric.median / stack.median - 1 : 0;

  logStats("spike stack high", stack);
  logStats("spike volumetric high", volumetric);
  console.log(`spike volumetric regression=${(regressionRatio * 100).toFixed(1)}%`);

  expectRafSamples("spike stack high", stack, testInfo);
  expectRafSamples("spike volumetric high", volumetric, testInfo);

  if (STRICT_PERF) {
    expect(volumetric.median).toBeLessThanOrEqual(24);
    expect(volumetric.p95).toBeLessThanOrEqual(40);
    expect(regressionRatio).toBeLessThanOrEqual(0.25);
  }
});

test("records production visible-copy RAF performance", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Performance sampling is calibrated for desktop review.");
  test.skip(STRICT_PERF, "Strict promotion budgeting is scoped to the production home renderer.");

  await page.setViewportSize({ width: 1440, height: 960 });

  const studyStack = await measurePage(
    page,
    "/lubirth-revised?copy=visible&profile=nasa&perfTest=raf",
    "stack"
  );
  const studyCandidate = await measurePage(
    page,
    "/lubirth-revised?copy=visible&profile=nasa&quality=high&atmoPolicy=hybrid&perfTest=raf",
    "volumetric"
  );

  await page.goto("/?copy=visible&perfTest=raf");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-variant", "home", { timeout: 25_000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereVariant), { timeout: 25_000 })
    .toBe("stack");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeProfile), { timeout: 25_000 })
    .toBe("home-lite");
  await page.waitForTimeout(1_000);
  const homeIntro = await sampleRafStats(page, 2_500);

  logStats("production study visible stack", studyStack);
  logStats("production study visible hybrid candidate", studyCandidate);
  logStats("production home intro stack", homeIntro);

  expectRafSamples("production study visible stack", studyStack, testInfo);
  expectRafSamples("production study visible hybrid candidate", studyCandidate, testInfo);
  expectRafSamples("production home intro stack", homeIntro, testInfo);

  if (STRICT_PERF) {
    expect(studyCandidate.median).toBeLessThanOrEqual(24);
    expect(studyCandidate.p95).toBeLessThanOrEqual(40);
    expect(homeIntro.max).toBeLessThanOrEqual(100);
  }
});

test("keeps production home cloud and analytic halo inside the frame budget", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Performance sampling is calibrated for desktop review.");

  const desktopViewport = { width: 1440, height: 960 };
  const desktopLite = await measureFreshHomePage(
    browser,
    desktopViewport,
    "/?progress=0.5&copy=hidden&quality=medium&perfTest=raf",
    { postEffectMode: "analytic-halo", cloudMode: "shell-lite", groundShadow: true }
  );
  const desktopNoHalo = await measureFreshHomePage(
    browser,
    desktopViewport,
    "/?progress=0.5&copy=hidden&quality=medium&postEffect=off&perfTest=raf",
    { postEffectMode: "off", cloudMode: "shell-lite", groundShadow: true }
  );

  const mobileLandscapeLite = await measureFreshHomePage(
    browser,
    { width: 844, height: 390 },
    "/?progress=0.5&copy=hidden&quality=medium&perfTest=raf",
    { postEffectMode: "analytic-halo", cloudMode: "shell-lite", groundShadow: true }
  );
  const analyticHaloP95Overhead = desktopLite.p95 - desktopNoHalo.p95;

  logStats("production home desktop shell-lite + analytic-halo", desktopLite);
  logStats("production home desktop shell-lite + post-effect-off", desktopNoHalo);
  logStats("production home mobile landscape shell-lite + analytic-halo", mobileLandscapeLite);
  console.log(`home analytic-halo p95 overhead=${analyticHaloP95Overhead.toFixed(2)}ms`);

  expectRafSamples("production home desktop shell-lite + analytic-halo", desktopLite, testInfo);
  expectRafSamples("production home desktop shell-lite + post-effect-off", desktopNoHalo, testInfo);
  expectRafSamples("production home mobile landscape shell-lite + analytic-halo", mobileLandscapeLite, testInfo);

  if (STRICT_PERF) {
    expect(desktopLite.p95).toBeLessThanOrEqual(DESKTOP_HOME_P95_BUDGET_MS);
    expect(mobileLandscapeLite.p95).toBeLessThanOrEqual(MOBILE_LANDSCAPE_HOME_P95_BUDGET_MS);
    expect(analyticHaloP95Overhead).toBeLessThanOrEqual(ANALYTIC_HALO_P95_OVERHEAD_BUDGET_MS);
  }
});
