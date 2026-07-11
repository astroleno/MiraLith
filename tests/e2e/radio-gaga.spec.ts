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
  await expect
    .poll(() => titlePanel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.85);

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
    await expect(
      page.locator(".radio-gaga-copy").getByText("把附近发生的事，变成家里听得懂的一句提醒", { exact: true })
    ).toBeVisible();
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

test("standalone route exposes reusable chapter progress without nested canvases", async ({ page }) => {
  await page.goto("/radio-gaga");
  await expect(page.locator('[data-radio-gaga-experience="standalone"]')).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("radioGAGA memory phase renders embedded process copy after the radio handoff", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.58);

  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const instrumentLayer = page.locator(".radio-gaga-instrument");
  const proof2 = page.locator('.radio-gaga-proof-strip__item[data-radio-gaga-proof="2"]');
  await expect(page.locator(".radio-gaga-copy").getByText("收音机问今天有什么新鲜事，我把答案调成爸妈能接住的一句话。")).toBeVisible();

  if (testInfo.project.name === "mobile-portrait") {
    await expect
      .poll(() => opacityOf(memoryPanel))
      .toBeGreaterThan(0.45);
    await expect
      .poll(() => opacityOf(proof2))
      .toBeGreaterThan(0.3);
    await expect
      .poll(() => opacityOf(instrumentLayer))
      .toBeLessThan(0.18);

    await scrollRadioGagaTo(page, 0.66);
    await expect
      .poll(() => opacityOf(instrumentLayer))
      .toBeGreaterThan(0.45);
    await expect
      .poll(() => opacityOf(proof2))
      .toBeLessThan(0.22);
    return;
  }

  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeGreaterThan(0.45);

  if (testInfo.project.name === "desktop") {
    await expect
      .poll(() => opacityOf(instrumentLayer))
      .toBeGreaterThan(0.7);
    await expect(instrumentLayer.getByText("rewrite it as one family sentence")).toBeVisible();
    await expect
      .poll(() => opacityOf(page.locator('.radio-gaga-instrument__step[data-radio-gaga-dial="1"]')))
      .toBeGreaterThan(0.16);
    await expect
      .poll(() => opacityOf(page.locator('.radio-gaga-instrument__step[data-radio-gaga-dial="3"]')))
      .toBeGreaterThan(0.85);
  }
});

test("radioGAGA mobile landscape memory layout keeps copy separated", async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.58);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const activeStage = page.locator('.radio-gaga-step-marker__stage[data-radio-gaga-stage="3"]');

  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeGreaterThan(0.28);
  await expect
    .poll(() => opacityOf(activeStage))
    .toBeGreaterThan(0.85);

  const memoryBox = await requireBoundingBox(memoryPanel, "memory copy");
  const stageBox = await requireBoundingBox(activeStage, "step marker");
  const resolvedViewport = viewport as { width: number; height: number };

  expectBoxInViewport(memoryBox, resolvedViewport, "memory copy");
  expectBoxInViewport(stageBox, resolvedViewport, "step marker");
  expect(boxesOverlap(memoryBox, stageBox), "memory copy and step marker should not overlap").toBe(false);
  expect(memoryBox.x + memoryBox.width, "memory copy should stay in the left text lane").toBeLessThan(
    resolvedViewport.width * 0.48
  );
});

test("radioGAGA core phase exits earlier copy groups", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");

  const titlePanel = page.locator(".radio-gaga-copy__panel").first();
  const voicePanel = page.locator(".radio-gaga-copy__voice");
  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const corePanel = page.locator(".radio-gaga-copy__core");
  const coreProgress = 0.835;

  if (testInfo.project.name !== "mobile-portrait") {
    await scrollRadioGagaTo(page, 0.58);
    await expect
      .poll(() => opacityOf(memoryPanel))
      .toBeGreaterThan(0.45);

    await scrollRadioGagaTo(page, coreProgress);
    await expect
      .poll(() => opacityOf(corePanel))
      .toBeGreaterThan(0.7);
    await expect
      .poll(() => opacityOf(memoryPanel))
      .toBeLessThan(0.08);
  }

  await scrollRadioGagaTo(page, coreProgress);
  await expect
    .poll(() => opacityOf(corePanel))
    .toBeGreaterThan(0.7);
  await expect
    .poll(() => opacityOf(titlePanel))
    .toBeLessThan(0.2);
  await expect
    .poll(() => opacityOf(voicePanel))
    .toBeLessThan(0.2);
  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeLessThan(0.2);
});

test("radioGAGA second act keeps the voice to memory handoff quiet", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.46);

  const voicePanel = page.locator(".radio-gaga-copy__voice");
  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const instrumentLayer = page.locator(".radio-gaga-instrument");
  const proof1 = page.locator('.radio-gaga-proof-strip__item[data-radio-gaga-proof="1"]');
  const stage2 = page.locator('.radio-gaga-step-marker__stage[data-radio-gaga-stage="2"]');
  const stage3 = page.locator('.radio-gaga-step-marker__stage[data-radio-gaga-stage="3"]');
  const stepMarker = page.locator(".radio-gaga-step-marker");
  const dial3 = page.locator('.radio-gaga-instrument__step[data-radio-gaga-dial="3"]');

  await expect
    .poll(() => opacityOf(voicePanel))
    .toBeLessThan(0.15);
  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeLessThan(0.08);
  if (testInfo.project.name === "mobile-portrait") {
    await expect
      .poll(() => opacityOf(instrumentLayer))
      .toBeLessThan(0.18);
  } else {
    await expect
      .poll(() => opacityOf(instrumentLayer))
      .toBeLessThan(0.24);
  }
  await expect
    .poll(() => opacityOf(proof1))
    .toBeGreaterThan(0.25);
  await expect
    .poll(() => opacityOf(stage2))
    .toBeLessThan(0.25);
  await expect
    .poll(() => opacityOf(stage3))
    .toBeLessThan(0.08);
  await expect
    .poll(() => opacityOf(stepMarker))
    .toBeLessThan(0.12);
  await expect
    .poll(() => opacityOf(dial3))
    .toBeLessThan(0.26);
});

test("radioGAGA proof copy stages the processing frames before the ESP32 handoff", async ({ page }) => {
  await page.goto("/radio-gaga");

  const proof1 = page.locator('.radio-gaga-proof-strip__item[data-radio-gaga-proof="1"]');
  const proof2 = page.locator('.radio-gaga-proof-strip__item[data-radio-gaga-proof="2"]');

  await expect(proof1.getByText("筛出今天真的要回家的消息")).toHaveCount(1);
  await expect(proof2.getByText("写成我会说出口的节目稿")).toHaveCount(1);

  await scrollRadioGagaTo(page, 0.44);
  await expect
    .poll(() => opacityOf(proof1))
    .toBeGreaterThan(0.2);

  await scrollRadioGagaTo(page, 0.58);
  await expect
    .poll(() => opacityOf(proof2))
    .toBeGreaterThan(0.2);
});

test("radioGAGA mobile finale transition avoids partial sheet chrome", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "The partial sheet entrance is a portrait mobile polish check.");

  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.945);

  const finalDialog = page.locator(".radio-gaga-final-dialog");
  const stepMarker = page.locator(".radio-gaga-step-marker");

  await expect
    .poll(() => opacityOf(finalDialog))
    .toBeLessThan(0.02);
  await expect
    .poll(() => opacityOf(stepMarker))
    .toBeLessThan(0.02);
});

test("radioGAGA finale completes and exits earlier copy groups", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 1);

  const titlePanel = page.locator(".radio-gaga-copy__panel").first();
  const voicePanel = page.locator(".radio-gaga-copy__voice");
  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const corePanel = page.locator(".radio-gaga-copy__core");
  const finalPanel = page.locator(".radio-gaga-copy__final");
  const finalDialog = page.locator(".radio-gaga-final-dialog");
  const communityGateOutput = finalDialog.getByText("妈，社区门口那条路明天施工，出门从东门绕一下。");
  const activeWeatherOutput = finalDialog.getByText("下午可能降温，出门前把外套放包里，我晚点再问你。");

  await expect(finalPanel.getByText("A small machine for staying close.")).toBeVisible();
  await expect(finalPanel.getByText("一台让距离变近的小机器。")).toBeVisible();
  await expect(activeWeatherOutput).toBeVisible();
  if (testInfo.project.name === "mobile-portrait") {
    await expect(communityGateOutput).toBeHidden();
  } else {
    await expect(communityGateOutput).toBeVisible();
  }
  if (testInfo.project.name === "mobile-portrait") {
    await expect(finalDialog.getByText("morning market")).toBeHidden();
  } else if (testInfo.project.name === "desktop") {
    await expect(finalDialog.getByText("morning market")).toBeVisible();
  }
  await expect
    .poll(() => opacityOf(finalPanel))
    .toBeGreaterThan(0.25);
  await expect
    .poll(() => opacityOf(finalDialog))
    .toBeGreaterThan(0.65);
  if (testInfo.project.name === "mobile-portrait") {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const dialogBox = await requireBoundingBox(finalDialog, "mobile finale sheet");
    expect(dialogBox.y, "mobile finale sheet should stay in the bottom reading lane").toBeGreaterThan(
      (viewport as { width: number; height: number }).height * 0.62
    );
  }
  await expect
    .poll(() => opacityOf(titlePanel))
    .toBeLessThan(0.2);
  await expect
    .poll(() => opacityOf(voicePanel))
    .toBeLessThan(0.2);
  await expect
    .poll(() => opacityOf(memoryPanel))
    .toBeLessThan(0.2);
  await expect
    .poll(() => opacityOf(corePanel))
    .toBeLessThan(0.2);
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
