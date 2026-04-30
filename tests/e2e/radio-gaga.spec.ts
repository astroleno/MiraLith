import { expect, test, type Locator, type Page } from "@playwright/test";

type BoundingBox = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

async function scrollRadioGagaTo(page: Page, progress: number) {
  await page.evaluate((nextProgress) => {
    window.scrollTo({
      top: Math.round(window.innerHeight * 3.4 * nextProgress),
      behavior: "instant"
    });
  }, progress);
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

test("renders radioGAGA route in one production canvas", async ({ page }) => {
  await page.goto("/radio-gaga");

  const titlePanel = page.locator(".radio-gaga-copy__panel").first();
  await expect(page.locator(".radio-gaga-copy h1")).toHaveText("radioGAGA");
  await expect(page.locator(".radio-gaga-copy").getByText("一台装着本地新闻、父母记忆与我自己声音的收音机")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  await expect
    .poll(() => titlePanel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.85);
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
    await expect(page.locator(".radio-gaga-copy").getByText("一台装着本地新闻、父母记忆与我自己声音的收音机")).toBeVisible();
  } finally {
    releasePreflight();
  }
});

test("radioGAGA canvas renders nonblank pixels", async ({ page }) => {
  await page.goto("/radio-gaga?visualTest=pixels");
  await scrollRadioGagaTo(page, 0.2);

  const nonblank = await page.waitForFunction(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return false;
    }

    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) {
      return false;
    }

    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) {
        return true;
      }
    }
    return false;
  });

  expect(await nonblank.jsonValue()).toBe(true);
});

test("radioGAGA memory phase renders embedded instrument copy", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.5);

  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const instrumentLayer = page.locator(".radio-gaga-instrument");
  const broadcastLine = page.locator(".radio-gaga-instrument__broadcast");
  await expect(page.locator(".radio-gaga-copy").getByText("它不是把新闻读出来，而是把新闻翻译成父母能够接住的日常。")).toBeVisible();
  await expect(page.locator(".radio-gaga-copy").getByText("妈，社区门口那条路明天施工，出门绕一下。")).toBeVisible();
  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeGreaterThan(0.28);
  await expect
    .poll(() => opacityOf(instrumentLayer))
    .toBeGreaterThan(0.28);
  await expect
    .poll(() => opacityOf(broadcastLine))
    .toBeGreaterThan(0.28);

  if (testInfo.project.name === "desktop") {
    await expect(instrumentLayer.getByText("say it plainly")).toBeVisible();
  }
});

test("radioGAGA mobile landscape memory layout keeps copy separated", async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.5);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const broadcastLine = page.locator(".radio-gaga-instrument__broadcast");
  const activeStage = page.locator('.radio-gaga-step-marker__stage[data-radio-gaga-stage="3"]');

  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeGreaterThan(0.28);
  await expect
    .poll(() => opacityOf(broadcastLine))
    .toBeGreaterThan(0.28);
  await expect
    .poll(() => opacityOf(activeStage))
    .toBeGreaterThan(0.85);

  const memoryBox = await requireBoundingBox(memoryPanel, "memory copy");
  const broadcastBox = await requireBoundingBox(broadcastLine, "broadcast line");
  const stageBox = await requireBoundingBox(activeStage, "step marker");
  const resolvedViewport = viewport as { width: number; height: number };

  expectBoxInViewport(memoryBox, resolvedViewport, "memory copy");
  expectBoxInViewport(broadcastBox, resolvedViewport, "broadcast line");
  expectBoxInViewport(stageBox, resolvedViewport, "step marker");
  expect(boxesOverlap(memoryBox, broadcastBox), "memory copy and broadcast line should not overlap").toBe(false);
  expect(boxesOverlap(memoryBox, stageBox), "memory copy and step marker should not overlap").toBe(false);
  expect(boxesOverlap(broadcastBox, stageBox), "broadcast line and step marker should not overlap").toBe(false);
  expect(memoryBox.x + memoryBox.width, "memory copy should stay in the left text lane").toBeLessThan(
    resolvedViewport.width * 0.48
  );
});

test("radioGAGA core phase exits earlier copy groups", async ({ page }) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.72);

  const titlePanel = page.locator(".radio-gaga-copy__panel").first();
  const voicePanel = page.locator(".radio-gaga-copy__voice");
  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const corePanel = page.locator(".radio-gaga-copy__core");

  await expect
    .poll(() => opacityOf(corePanel))
    .toBeGreaterThan(0.4);
  await expect
    .poll(() => opacityOf(titlePanel))
    .toBeLessThan(0.08);
  await expect
    .poll(() => opacityOf(voicePanel))
    .toBeLessThan(0.08);
  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeLessThan(0.08);
});

test("radioGAGA finale completes and exits earlier copy groups", async ({ page }) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 1);

  const titlePanel = page.locator(".radio-gaga-copy__panel").first();
  const voicePanel = page.locator(".radio-gaga-copy__voice");
  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const corePanel = page.locator(".radio-gaga-copy__core");
  const finalPanel = page.locator(".radio-gaga-copy__final");

  await expect(finalPanel.getByText("A small machine for staying close.")).toBeVisible();
  await expect(finalPanel.getByText("一台让距离变近的小机器。")).toBeVisible();
  await expect
    .poll(() => opacityOf(finalPanel))
    .toBeGreaterThan(0.85);
  await expect
    .poll(() => opacityOf(titlePanel))
    .toBeLessThan(0.08);
  await expect
    .poll(() => opacityOf(voicePanel))
    .toBeLessThan(0.08);
  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeLessThan(0.08);
  await expect
    .poll(() => opacityOf(corePanel))
    .toBeLessThan(0.08);
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
