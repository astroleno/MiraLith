import { expect, test } from "@playwright/test";

test("renders LuBirth in one production-owned canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Opening frame")).toBeVisible();
  await expect(page.getByLabel("Project frame")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-hero canvas")).toHaveCount(0);
});
