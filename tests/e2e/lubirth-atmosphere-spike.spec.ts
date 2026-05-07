import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

declare global {
  interface Window {
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
    __MiraLithLuBirthAtmosphereVariant?: string;
    __MiraLithLuBirthRuntimeLocation?: unknown;
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
    __MiraLithLuBirthVolumetricAtmosphereQuality?: string;
  }
}

async function expectSpikeCanvas(page: import("@playwright/test").Page, count = 1) {
  await expect(page.locator("canvas")).toHaveCount(count, { timeout: 25_000 });
}

async function expectAtmosphereVariant(page: import("@playwright/test").Page, variant: "stack" | "volumetric") {
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereVariant), { timeout: 25_000 })
    .toBe(variant);
}

async function expectVolumetricActive(page: import("@playwright/test").Page, active: boolean) {
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false), {
      timeout: 25_000
    })
    .toBe(active);
}

async function expectStackActive(page: import("@playwright/test").Page, active: boolean) {
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(active);
}

async function openSpike(page: import("@playwright/test").Page, params: Record<string, string>) {
  const query = new URLSearchParams({
    copy: "hidden",
    progress: "0",
    visualTest: "pixels",
    ...params
  });

  await page.goto(`/lubirth-atmosphere-spike?${query.toString()}`);
}

async function sampleCanvasLuminance(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let bottomLuma = 0;
    let bottomCount = 0;
    let bottomBright = 0;
    let maxLuma = 0;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const luma = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        maxLuma = Math.max(maxLuma, luma);

        if (y > canvas.height * 0.5) {
          bottomLuma += luma;
          bottomCount += 1;
          if (luma > 35) {
            bottomBright += 1;
          }
        }
      }
    }

    return {
      bottomAverage: bottomLuma / Math.max(bottomCount, 1),
      bottomBrightRatio: bottomBright / Math.max(bottomCount, 1),
      maxLuma
    };
  });
}

test("atmo=stack activates the existing atmosphere stack only", async ({ page }) => {
  await openSpike(page, { atmo: "stack", quality: "high" });

  await expectSpikeCanvas(page);
  await expectAtmosphereVariant(page, "stack");
  await expectStackActive(page, true);
  await expectVolumetricActive(page, false);
});

test("atmo=volumetric activates the Three volumetric atmosphere pass only", async ({ page }) => {
  await openSpike(page, { atmo: "volumetric", quality: "high" });

  await expectSpikeCanvas(page);
  await expectAtmosphereVariant(page, "volumetric");
  await expectStackActive(page, false);
  await expectVolumetricActive(page, true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVolumetricAtmosphereQuality), { timeout: 25_000 })
    .toBe("high:16/8");
});

test("volumetric output keeps the near-earth frame visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Pixel luminance smoke test runs once on desktop.");

  for (const quality of ["high", "medium"]) {
    await openSpike(page, { atmo: "volumetric", quality, progress: "0" });
    await expectAtmosphereVariant(page, "volumetric");
    await expectVolumetricActive(page, true);
    await page.waitForTimeout(800);

    const luminance = await sampleCanvasLuminance(page);
    expect(luminance).not.toBeNull();
    expect(luminance?.bottomAverage).toBeGreaterThan(24);
    expect(luminance?.bottomBrightRatio).toBeGreaterThan(0.08);
    expect(luminance?.maxLuma).toBeGreaterThan(90);
  }
});

test("default spike route uses stable lookdev lighting instead of implicit visitor geo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Default route coverage runs once on desktop.");

  await page.goto("/lubirth-atmosphere-spike");
  await expectSpikeCanvas(page);
  await expectAtmosphereVariant(page, "volumetric");
  await expectVolumetricActive(page, true);
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeLocation), {
    timeout: 25_000
  }).toBeUndefined();
});

test("atmo=split renders isolated stack and volumetric canvases", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Split canvas coverage runs once on desktop.");

  await openSpike(page, { atmo: "split", quality: "high" });

  await expectSpikeCanvas(page, 2);
  await expect(page.locator('[data-atmo-pane="stack"] canvas')).toHaveCount(1);
  await expect(page.locator('[data-atmo-pane="volumetric"] canvas')).toHaveCount(1);
});

test("low quality volumetric requests fall back to the atmosphere stack", async ({ page }) => {
  await openSpike(page, { atmo: "volumetric", quality: "low" });

  await expectSpikeCanvas(page);
  await expectAtmosphereVariant(page, "stack");
  await expectStackActive(page, true);
  await expectVolumetricActive(page, false);
});

test("mobile landscape only enables volumetric when high quality is explicit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-landscape", "Mobile landscape fallback coverage only.");

  await openSpike(page, { atmo: "volumetric" });
  await expectSpikeCanvas(page);
  await expectAtmosphereVariant(page, "stack");
  await expectVolumetricActive(page, false);

  await openSpike(page, { atmo: "volumetric", quality: "high" });
  await expectSpikeCanvas(page);
  await expectAtmosphereVariant(page, "volumetric");
  await expectVolumetricActive(page, true);
});

test("captures volumetric atmosphere review screenshots", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  test.skip(
    testInfo.project.name !== "desktop" && testInfo.project.name !== "mobile-landscape",
    "Screenshot artifacts are captured on desktop and mobile landscape."
  );

  const samples = testInfo.project.name === "desktop"
    ? [
        {
          name: "desktop-high-progress0",
          params: { atmo: "volumetric", quality: "high", progress: "0" },
          viewport: { width: 1440, height: 960 }
        },
        {
          name: "desktop-high-progress05",
          params: { atmo: "volumetric", quality: "high", progress: "0.5" },
          viewport: { width: 1440, height: 960 }
        },
        {
          name: "desktop-high-progress1",
          params: { atmo: "volumetric", quality: "high", progress: "1" },
          viewport: { width: 1440, height: 960 }
        },
        {
          name: "desktop-high-debug-atmosphere",
          params: { atmo: "volumetric", debug: "atmosphere", quality: "high", progress: "0" },
          viewport: { width: 1440, height: 960 }
        },
        {
          name: "laptop-medium-progress0",
          params: { atmo: "volumetric", quality: "medium", progress: "0" },
          viewport: { width: 1280, height: 800 }
        }
      ]
    : [
        {
          name: "mobile-landscape-high-progress0",
          params: { atmo: "volumetric", quality: "high", progress: "0" },
          viewport: { width: 915, height: 412 }
        }
      ];

  for (const sample of samples) {
    await page.setViewportSize(sample.viewport);
    await openSpike(page, sample.params);
    await expectSpikeCanvas(page);
    await expectAtmosphereVariant(page, "volumetric");
    await expectVolumetricActive(page, true);
    await page.waitForTimeout(600);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${sample.name}.png`)
    });
  }
});
