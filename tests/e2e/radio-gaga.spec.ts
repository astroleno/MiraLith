import { expect, test } from "@playwright/test";

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

test("radioGAGA canvas renders nonblank pixels", async ({ page }) => {
  await page.goto("/radio-gaga?visualTest=pixels");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 0.65, behavior: "instant" }));

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

test("radioGAGA memory phase renders process copy", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.7, behavior: "instant" }));

  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const processLayer = page.locator(".radio-gaga-copy__process");
  await expect(page.locator(".radio-gaga-copy").getByText("它不是把新闻读出来，而是把新闻翻译成父母能够接住的日常。")).toBeVisible();
  await expect
    .poll(() => memoryPanel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.28);

  if (testInfo.project.name === "desktop") {
    await expect(processLayer.getByText("say it plainly")).toBeVisible();
    await expect
      .poll(() => processLayer.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
      .toBeGreaterThan(0.2);
  } else {
    await expect(processLayer).toHaveCSS("display", "none");
  }
});

test("radioGAGA core phase exits earlier copy groups", async ({ page }, testInfo) => {
  await page.goto("/radio-gaga");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.45, behavior: "instant" }));

  const titlePanel = page.locator(".radio-gaga-copy__panel").first();
  const voicePanel = page.locator(".radio-gaga-copy__voice");
  const memoryPanel = page.locator(".radio-gaga-copy__memory");
  const corePanel = page.locator(".radio-gaga-copy__core");
  const processLayer = page.locator(".radio-gaga-copy__process");

  await expect
    .poll(() => corePanel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.4);
  await expect
    .poll(() => titlePanel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeLessThan(0.08);
  await expect
    .poll(() => voicePanel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeLessThan(0.08);
  await expect
    .poll(() => memoryPanel.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
    .toBeLessThan(0.08);

  if (testInfo.project.name !== "desktop") {
    await expect(processLayer).toHaveCSS("display", "none");
  } else {
    await expect
      .poll(() => processLayer.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
      .toBeLessThan(0.04);
  }
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
