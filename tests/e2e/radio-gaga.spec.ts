import { expect, test, type Locator, type Page } from "@playwright/test";

type BoundingBox = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;
const RADIO_GAGA_SCROLL_DISTANCE_VH = 11.6;

async function scrollRadioGagaTo(page: Page, progress: number) {
  await page.evaluate(({ nextProgress, scrollDistanceVh }) => {
    window.scrollTo({
      top: Math.round(window.innerHeight * scrollDistanceVh * nextProgress),
      behavior: "instant"
    });
  }, { nextProgress: progress, scrollDistanceVh: RADIO_GAGA_SCROLL_DISTANCE_VH });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function opacityOf(locator: Locator) {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
}

async function requireBoundingBox(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, `${label} should have a rendered bounding box`).not.toBeNull();
  return box as BoundingBox;
}

function expectBoxInViewport(box: BoundingBox, viewport: { width: number; height: number }, label: string) {
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, `${label} bottom edge`).toBeLessThanOrEqual(viewport.height);
}

function boxesOverlap(a: BoundingBox, b: BoundingBox) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("renders radioGAGA route in one production canvas", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");

  const titlePanel = page.locator(".radio-gaga-copy__panel").first();
  await expect(page.locator(".radio-gaga-copy h1")).toHaveText("radioGAGA");
  await expect(
    page.locator(".radio-gaga-copy").getByText("把附近发生的事，变成家里听得懂的一句提醒", { exact: true })
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  await expect.poll(() => opacityOf(titlePanel)).toBeGreaterThan(0.85);

  if (testInfo.project.name === "desktop") {
    await expect(page.locator(".radio-gaga-title-rail li[data-active='true'] .radio-gaga-title-rail__title")).toHaveText(
      "Radio Gaga"
    );
  }

  if (testInfo.project.name === "mobile-portrait") {
    await expect(page.locator(".radio-gaga-mobile-title-bar__title")).toHaveText("Radio Gaga");
  }
});

test("radioGAGA fallback keeps chapter readable", async ({ page }) => {
  await page.goto("/radio-gaga?visual=fallback");

  await expect(page.locator("canvas")).toHaveCount(0);
  const fallback = page.locator('[data-visual-fallback="radio-gaga"]');
  await expect(fallback).toBeVisible();
  await expect(fallback.locator(".radio-gaga-fallback-poster")).toBeVisible();
  await expect(fallback.getByRole("heading", { name: "radioGAGA" })).toBeVisible();
  await expect(fallback.getByText("一台让距离变近的小机器。")).toBeVisible();
});

test("radioGAGA forced fallback is present in the initial server HTML", async ({ request }) => {
  const response = await request.get("/radio-gaga?visual=fallback");
  await expect(response).toBeOK();

  const html = await response.text();
  expect(html).toContain('data-visual-fallback="radio-gaga"');
  expect(html).not.toContain('data-visual-canvas="production"');
});

test("radioGAGA keeps copy visible while asset preflight is pending", async ({ page }) => {
  let releasePreflight!: () => void;
  const preflightPending = new Promise<void>((resolve) => {
    releasePreflight = resolve;
  });

  await page.route("**/model/*.glb", async (route) => {
    if (route.request().method() === "HEAD") {
      await preflightPending;
      await route.fulfill({ status: 200, body: "" });
      return;
    }
    await route.continue();
  });

  try {
    await page.goto("/radio-gaga");
    await expect(page.locator('[data-visual-fallback="radio-gaga"]')).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator(".radio-gaga-copy h1")).toHaveText("radioGAGA");
  } finally {
    releasePreflight();
  }
});

test("radioGAGA uses one broadcast tuner instead of detached status panels", async ({ page }) => {
  await page.goto("/radio-gaga");

  await expect(page.locator(".radio-gaga-broadcast-tuner")).toHaveCount(1);
  await expect(page.locator(".radio-gaga-proof-strip")).toHaveCount(0);
  await expect(page.locator(".radio-gaga-step-marker")).toHaveCount(0);
  await expect(page.locator(".radio-gaga-copy__core")).toHaveCount(0);
  await expect(page.locator(".radio-gaga-final-dialog")).toHaveCount(0);
  await expect(page.locator(".radio-gaga-copy__intro")).toHaveCount(0);
});

test("radioGAGA canvas renders nonblank pixels", async ({ page }) => {
  await page.goto("/radio-gaga?visualTest=pixels");
  await scrollRadioGagaTo(page, 0.2);

  const nonblank = await page.waitForFunction(() => {
    const source = document.querySelector("canvas");
    if (!source) return false;

    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) return false;

    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) return true;
    }
    return false;
  });

  expect(await nonblank.jsonValue()).toBe(true);
});

test("radioGAGA model composite shader compiles without WebGL program errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The shader contract only needs one browser project.");

  const shaderErrors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/WebGLProgram|Shader Error|program not valid/i.test(text)) {
      shaderErrors.push(text);
    }
  });

  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.2);
  await page.waitForTimeout(1_500);

  expect(shaderErrors).toEqual([]);
});

test("radioGAGA keeps a visible center subject through the particle-to-proof handoff", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The center-pixel contract only needs one project.");

  await page.goto("/radio-gaga?visualTest=pixels");
  await scrollRadioGagaTo(page, 0.2);
  await expect.poll(async () => {
    return page.evaluate(() => {
      const source = document.querySelector("canvas");
      if (!source) return 0;
      const sample = document.createElement("canvas");
      sample.width = 32;
      sample.height = 32;
      const context = sample.getContext("2d");
      if (!context) return 0;
      context.drawImage(source, 0, 0, 32, 32);
      return context.getImageData(0, 0, 32, 32).data.reduce((total, channel) => total + channel, 0);
    });
  }).toBeGreaterThan(0);
  await scrollRadioGagaTo(page, 0.3);

  const brightCenterPixelCount = await page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) return 0;

    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) return 0;

    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    let brightPixels = 0;
    for (let y = 14; y < 50; y += 1) {
      for (let x = 14; x < 50; x += 1) {
        const index = (y * 64 + x) * 4;
        if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 48) brightPixels += 1;
      }
    }
    return brightPixels;
  });

  expect(brightCenterPixelCount).toBeGreaterThan(50);
});

test("radioGAGA writing phase keeps proof and progress inside the tuner", async ({ page }) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.58);

  const memory = page.locator(".radio-gaga-copy__memory");
  const tuner = page.locator(".radio-gaga-broadcast-tuner");
  const writingReadout = tuner.locator('[data-radio-gaga-readout="3"]');

  await expect.poll(() => opacityOf(memory)).toBeGreaterThan(0.7);
  await expect.poll(() => opacityOf(tuner)).toBeGreaterThan(0.8);
  await expect.poll(() => opacityOf(writingReadout)).toBeGreaterThan(0.8);
  await expect(tuner.getByText("写成我会说出口的节目稿", { exact: true })).toHaveCount(1);
  await expect(tuner.getByText("筛出今天真的要回家的消息", { exact: true })).toHaveCount(1);
});

test("radioGAGA desktop tuner uses one horizontal signal rail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This composition contract targets the desktop tuner.");

  await page.setViewportSize({ width: 2048, height: 1153 });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.58);

  const scale = page.locator(".radio-gaga-broadcast-tuner__scale");
  const scan = scale.locator(".radio-gaga-broadcast-tuner__scan");
  const steps = scale.locator(".radio-gaga-broadcast-tuner__step");
  await expect.poll(() => opacityOf(page.locator(".radio-gaga-broadcast-tuner"))).toBeGreaterThan(0.8);

  const firstStep = await requireBoundingBox(steps.first(), "first tuner step");
  const lastStep = await requireBoundingBox(steps.last(), "last tuner step");
  const scanBox = await requireBoundingBox(scan, "tuner signal rail");

  expect(Math.abs(firstStep.y - lastStep.y), "all tuner steps should share one row").toBeLessThan(2);
  expect(lastStep.x, "the last tuner step should sit to the right of the first").toBeGreaterThan(firstStep.x);
  expect(scanBox.width, "the signal rail should be horizontal").toBeGreaterThan(scanBox.height * 8);
});

test("radioGAGA desktop reading stage keeps one caption inside the left safe lane", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This composition contract targets the desktop reading lane.");

  await page.setViewportSize({ width: 2048, height: 1153 });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.3);

  const voice = page.locator(".radio-gaga-copy__voice");
  const tuner = page.locator(".radio-gaga-broadcast-tuner");
  await expect.poll(() => opacityOf(voice)).toBeGreaterThan(0.7);
  await expect.poll(() => opacityOf(tuner)).toBeGreaterThan(0.8);

  const voiceBox = await requireBoundingBox(voice, "voice copy");
  const tunerBox = await requireBoundingBox(tuner, "broadcast tuner");
  expect(boxesOverlap(voiceBox, tunerBox), "voice and broadcast tuner should not overlap").toBe(false);
  expect(voiceBox.x + voiceBox.width, "reading copy should stay inside the left safe lane").toBeLessThan(2048 * 0.28);
  expect(tunerBox.x, "tuner should stay inside the right safe lane").toBeGreaterThan(2048 * 0.68);
});

test("radioGAGA tuner stays fixed while its active readout changes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This composition contract targets the desktop tuner.");

  await page.setViewportSize({ width: 2048, height: 1153 });
  await page.goto("/radio-gaga");

  const tuner = page.locator(".radio-gaga-broadcast-tuner");
  await scrollRadioGagaTo(page, 0.3);
  const readingBox = await requireBoundingBox(tuner, "reading tuner");
  await expect.poll(() => opacityOf(tuner.locator('[data-radio-gaga-readout="2"]'))).toBeGreaterThan(0.8);

  await scrollRadioGagaTo(page, 0.66);
  const writingBox = await requireBoundingBox(tuner, "writing tuner");
  await expect.poll(() => opacityOf(tuner.locator('[data-radio-gaga-readout="3"]'))).toBeGreaterThan(0.8);

  expect(Math.abs(readingBox.x - writingBox.x)).toBeLessThan(1);
  expect(Math.abs(readingBox.y - writingBox.y)).toBeLessThan(1);
  expect(Math.abs(readingBox.width - writingBox.width)).toBeLessThan(1);
});

test("radioGAGA mobile landscape keeps story and tuner in separate lanes", async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.58);

  const viewport = page.viewportSize() as { width: number; height: number };
  const memory = page.locator(".radio-gaga-copy__memory");
  const tuner = page.locator(".radio-gaga-broadcast-tuner");
  await expect.poll(() => opacityOf(memory)).toBeGreaterThan(0.7);
  await expect.poll(() => opacityOf(tuner)).toBeGreaterThan(0.8);

  const memoryBox = await requireBoundingBox(memory, "memory copy");
  const tunerBox = await requireBoundingBox(tuner, "broadcast tuner");
  expectBoxInViewport(memoryBox, viewport, "memory copy");
  expectBoxInViewport(tunerBox, viewport, "broadcast tuner");
  expect(boxesOverlap(memoryBox, tunerBox), "story and tuner should not overlap").toBe(false);
  expect(memoryBox.x + memoryBox.width, "story should leave the center visual lane clear").toBeLessThan(
    viewport.width * 0.31
  );
  expect(tunerBox.x, "tuner should leave the center visual lane clear").toBeGreaterThan(viewport.width * 0.62);
});

test("radioGAGA particle handoff clears story while the tuner remains contextual", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This composition contract targets the desktop handoff.");

  await page.setViewportSize({ width: 2048, height: 1153 });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.76);

  const memory = page.locator(".radio-gaga-copy__memory");
  const tuner = page.locator(".radio-gaga-broadcast-tuner");
  const transmitReadout = tuner.locator('[data-radio-gaga-readout="4"]');
  await expect.poll(() => opacityOf(memory)).toBeLessThan(0.02);
  await expect.poll(() => opacityOf(tuner)).toBeGreaterThan(0.8);
  await expect.poll(() => opacityOf(transmitReadout)).toBeGreaterThan(0.8);
  await expect(tuner.getByText("ESP32 正在接收", { exact: true })).toHaveCount(1);
});

test("radioGAGA finale waits for the front lock before exposing output copy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This composition contract targets the desktop finale.");

  await page.setViewportSize({ width: 2048, height: 1153 });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.95);
  await expect(page.locator(".radio-gaga-broadcast-tuner__output")).toHaveCount(0);

  await scrollRadioGagaTo(page, 0.96);
  await expect(page.locator(".radio-gaga-broadcast-tuner__output")).toHaveCount(1);
  await expect.poll(() => opacityOf(page.locator('[data-radio-gaga-readout="5"]'))).toBeGreaterThan(0.8);
});

test("radioGAGA mobile finale keeps the tuner in the bottom reading lane", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "This composition contract targets portrait mobile.");

  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.96);

  const viewport = page.viewportSize() as { width: number; height: number };
  const tuner = page.locator(".radio-gaga-broadcast-tuner");
  const tunerBox = await requireBoundingBox(tuner, "mobile broadcast tuner");
  expectBoxInViewport(tunerBox, viewport, "mobile broadcast tuner");
  expect(tunerBox.y).toBeGreaterThan(viewport.height * 0.52);
});

test("radioGAGA finale shows one reminder, then yields to the closing line", async ({ page }) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.98);

  const tuner = page.locator(".radio-gaga-broadcast-tuner");
  const finalPanel = page.locator(".radio-gaga-copy__final");
  await expect.poll(() => opacityOf(tuner)).toBeGreaterThan(0.8);
  await expect(tuner.getByText("下午可能降温，出门前把外套放包里，我晚点再问你。", { exact: true })).toBeVisible();
  await expect(tuner.getByText("妈，社区门口那条路明天施工，出门从东门绕一下。", { exact: true })).toHaveCount(0);
  await expect(tuner.getByText("morning market", { exact: true })).toHaveCount(0);

  await scrollRadioGagaTo(page, 1);
  await expect.poll(() => opacityOf(tuner)).toBeLessThan(0.02);
  await expect.poll(() => opacityOf(finalPanel)).toBeGreaterThan(0.8);
  await expect(finalPanel.getByText("一台让距离变近的小机器。")).toBeVisible();
  await expect.poll(() => opacityOf(page.locator(".radio-gaga-copy__voice"))).toBeLessThan(0.02);
  await expect.poll(() => opacityOf(page.locator(".radio-gaga-copy__memory"))).toBeLessThan(0.02);
});

test("radioGAGA reduced motion reveals the final reminder without typing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The reduced-motion contract only needs one project.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.96);

  await expect(
    page.locator(".radio-gaga-broadcast-tuner__output").getByText(
      "下午可能降温，出门前把外套放包里，我晚点再问你。",
      { exact: true }
    )
  ).toBeVisible();
});

test("radioGAGA falls back when the radio model fails to load", async ({ page }) => {
  await page.route("**/model/radio_gaga.glb", (route) => route.abort());
  await page.goto("/radio-gaga");

  const fallback = page.locator('[data-visual-fallback="radio-gaga"]');
  await expect(fallback).toBeVisible();
  await expect(fallback.locator(".radio-gaga-fallback-poster")).toBeVisible();
  await expect(fallback.getByRole("heading", { name: "radioGAGA" })).toBeVisible();
  await expect(fallback.getByText("一台让距离变近的小机器。")).toBeVisible();
});
