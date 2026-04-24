import { expect, test } from "@playwright/test";

test("renders LuBirth in one production-owned canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Opening frame")).toBeVisible();
  await expect(page.getByLabel("Project frame")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-hero canvas")).toHaveCount(0);
});

test("opens and closes the LuBirth expanded view with keyboard flow", async ({ page }) => {
  await page.goto("/");
  const openButton = page.getByRole("button", { name: "Open LuBirth expanded view" });
  await openButton.focus();
  await openButton.press("Enter");

  const dialog = page.getByRole("dialog", { name: "LuBirth expanded view" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(openButton).toBeFocused();
});

test("mobile landscape keeps LuBirth visual and project frame usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Opening frame")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.15, behavior: "instant" }));
  await expect(page.locator('[data-screen-label="02 Project Window"]')).toBeInViewport();
  await expect(page.getByRole("button", { name: "Open LuBirth expanded view" })).toBeVisible();
});

test("production canvas renders nonblank pixels", async ({ page }) => {
  await page.goto("/?visualTest=pixels");
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

test("forced visual fallback keeps DOM content available", async ({ page }) => {
  await page.goto("/?visual=fallback");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="lubirth"]')).toBeVisible();
  await expect(page.getByText("MiraLith")).toBeVisible();
  await expect(page.getByText("LuBirth 地月人")).toBeVisible();
  const marker = await page.waitForFunction(() => window.__MiraLithFirstUsableAt, null, { timeout: 3000 });
  expect(await marker.jsonValue()).toBeLessThan(3000);
});

test("first usable viewport marker is under 3 seconds", async ({ page }) => {
  await page.goto("/");
  const marker = await page.waitForFunction(() => window.__MiraLithFirstUsableAt, null, { timeout: 3000 });
  const value = await marker.jsonValue();
  expect(typeof value).toBe("number");
  expect(value).toBeLessThan(3000);
});
