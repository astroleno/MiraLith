import { expect, test } from "@playwright/test";

async function scrollToOpeningProgress(page: import("@playwright/test").Page, progress: number) {
  await page.evaluate((nextProgress) => {
    const root = document.querySelector<HTMLElement>("[data-opening-cloud-route]");
    if (!root) throw new Error("Opening cloud route is unavailable");
    const rootStart = root.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(1, root.offsetHeight - window.innerHeight);
    window.scrollTo({ top: rootStart + range * nextProgress, behavior: "instant" });
  }, progress);
}

test("renders a seekable globe field inside the Earth group instead of a DOM cloud overlay", async ({ page }) => {
  await page.goto(
    "/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8&geoLabel=Mianyang"
  );

  await expect(page.locator("[data-live-ip-relief-lite] canvas")).toHaveCount(1);
  await expect(page.locator("[data-opening-cloud-overlay]")).toHaveCount(0);
  await expect(page.locator("[data-opening-globe-cloud-media]")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "cloud", renderedFrame: 0, cloudOnly: true });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningGlobeCloud))
    .toMatchObject({
      active: true,
      attachment: "earth-group",
      fieldPacking: "left-rgb-right-concavity",
      mapping: "equirectangular-earth-uv",
      frame: 0,
      topScale: 1.007,
      viewSteps: 3
    });

  await scrollToOpeningProgress(page, 0.12);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningGlobeCloud?.frame))
    .toBe(26);

  await scrollToOpeningProgress(page, 0.2);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "forward-veil-open" });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningGlobeCloud))
    .toBeUndefined();
  await expect(page.locator("[data-transition-veil]")).toHaveAttribute(
    "data-layer-above",
    "earth canvas and globe cloud shell"
  );

  await scrollToOpeningProgress(page, 0.23);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "live", presentationResourcesReleased: true });
  await expect(page.locator("[data-opening-globe-cloud-media]")).not.toHaveAttribute("src", /.+/);

  await scrollToOpeningProgress(page, 0.207);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "reverse-veil-close" });
  await scrollToOpeningProgress(page, 0.18);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningGlobeCloud))
    .toMatchObject({ active: true, frame: 39, attachment: "earth-group" });
});

test("falls back to live Relief-lite for reduced motion and a late first frame", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fallback policy is shared; cover it once in the desktop browser.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8");
  await expect(page.locator("[data-live-ip-relief-lite] canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "fallback-live", fallbackReason: "reduced-motion" });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8&progress=0.12");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "fallback-live", fallbackReason: "late-first-frame" });
});

test("releases the globe field on decode and background-resume fallbacks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fallback policy is shared; cover it once in the desktop browser.");
  await page.goto("/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud?.source))
    .toBe("cloud");
  await page.locator("[data-opening-globe-cloud-media]").evaluate((media) => {
    media.dispatchEvent(new Event("error"));
  });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({
      source: "live",
      state: "fallback-live",
      fallbackReason: "decode-error",
      presentationResourcesReleased: true
    });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningGlobeCloud))
    .toBeUndefined();

  await page.goto("/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud?.source))
    .toBe("cloud");
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({
      source: "live",
      state: "fallback-live",
      fallbackReason: "background-unverified",
      presentationResourcesReleased: true
    });
});
