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
