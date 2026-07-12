import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RADIO_GAGA_SCROLL_DISTANCE_VH = 11.6;

async function scrollRadioGagaTo(page: Page, progress: number) {
  await page.evaluate(({ nextProgress, scrollDistanceVh }) => {
    window.scrollTo({
      top: Math.round(window.innerHeight * scrollDistanceVh * nextProgress),
      behavior: "instant"
    });
  }, { nextProgress: progress, scrollDistanceVh: RADIO_GAGA_SCROLL_DISTANCE_VH });
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}

async function opacityOf(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("homepage and radioGAGA use one shared chapter navigation component", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The component architecture only needs one project.");

  const homepageSource = readFileSync(
    resolve(process.cwd(), "apps/site/components/LuBirthRevisedRoute.tsx"),
    "utf8"
  );
  const radioSource = readFileSync(
    resolve(process.cwd(), "apps/site/components/RadioGagaRoute.tsx"),
    "utf8"
  );

  expect(homepageSource).toContain("MiraLithChapterNavigation");
  expect(radioSource).toContain("MiraLithChapterNavigation");
});

test("chapter navigation expands only the current chapter", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The full chapter rail is a desktop pattern.");

  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.2);

  const navigation = page.locator(".radio-gaga-title-rail");
  await expect(navigation).toBeVisible();
  await expect(navigation.locator("li")).toHaveCount(7);
  await expect(navigation.locator("li[data-active='true'] .miralith-chapter-nav__title-anchor")).toHaveText(
    "Radio Gaga"
  );
  await expect(navigation.locator(".miralith-chapter-nav__meta")).toHaveCount(1);
  await expect(navigation.locator("li:not([data-active='true']) .miralith-chapter-nav__meta")).toHaveCount(0);
});

test("radioGAGA introduces the chapter frame late in act one and keeps it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The desktop rail owns the long-form timing contract.");

  await page.goto("/radio-gaga");

  await scrollRadioGagaTo(page, 0.04);
  await expect.poll(() => opacityOf(page, ".radio-gaga-title-rail")).toBeLessThan(0.08);

  await scrollRadioGagaTo(page, 0.2);
  await expect.poll(() => opacityOf(page, ".radio-gaga-title-rail")).toBeGreaterThan(0.85);

  await scrollRadioGagaTo(page, 0.82);
  await expect.poll(() => opacityOf(page, ".radio-gaga-title-rail")).toBeGreaterThan(0.85);
});

test("radioGAGA finale keeps its closing line clear of the chapter rail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The full rail only needs the desktop collision contract.");

  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 1);

  const railBox = await page.locator(".radio-gaga-title-rail").boundingBox();
  const finalBox = await page.locator(".radio-gaga-copy__final").boundingBox();
  expect(railBox).not.toBeNull();
  expect(finalBox).not.toBeNull();
  expect(boxesOverlap(railBox!, finalBox!)).toBe(false);
});

test("radioGAGA uses the compact shared chapter bar on small viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "The compact frame belongs to phone and short-landscape layouts.");

  await page.goto("/radio-gaga");
  await scrollRadioGagaTo(page, 0.2);

  const compactBar = page.locator(".radio-gaga-mobile-title-bar");
  await expect(compactBar).toBeVisible();
  await expect(compactBar.locator(".miralith-chapter-bar__title-anchor")).toHaveText("Radio Gaga");
  await expect(compactBar.locator(".miralith-chapter-bar__detail")).toContainText("照护 / Care");
  await expect(page.locator(".radio-gaga-title-rail")).toBeHidden();
});

test("homepage short landscape hands its identity to the compact chapter bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-landscape", "This collision contract targets short landscape only.");

  await page.goto("/");
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeSkipReady === "true";
  });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeIntroComplete === "true";
  });
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.9, behavior: "instant" }));
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));

  await expect(page.locator(".lubirth-revised__mobile-title-bar")).toBeVisible();
  await expect(page.locator(".lubirth-revised__title-rail")).toBeHidden();
  await expect.poll(() => opacityOf(page, ".lubirth-revised__home-signature")).toBeLessThan(0.05);
});
