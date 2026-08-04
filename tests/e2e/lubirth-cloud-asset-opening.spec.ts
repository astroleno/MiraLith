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

test("composites changing cloud-only frames over a live IP Relief-lite Canvas with native scroll", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(
    "/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8&geoLabel=Mianyang"
  );

  await expect(page.locator("[data-opening-cloud-route]")).toHaveCount(1);
  await expect(page.locator("[data-live-ip-relief-lite] canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVisualPolicy))
    .toMatchObject({ cloudMode: "relief-lite", atmosphereMode: "limb-lite", postEffectMode: "off" });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({
      source: "cloud",
      renderedFrame: 0,
      cloudOnly: true,
      liveScene: "ip-relief-lite"
    });

  const cloudCanvas = page.locator("[data-opening-cloud-overlay]");
  const transitionVeil = page.locator("[data-transition-veil]");
  await expect(transitionVeil).toHaveCount(1);
  await expect(transitionVeil).toHaveAttribute("data-layer-above", "cloud canvas");
  await expect(cloudCanvas).toHaveAttribute("data-cloud-frame", "0");
  const firstFrame = await cloudCanvas.screenshot();

  await scrollToOpeningProgress(page, 0.12);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "cloud", renderedFrame: 26, veilOpacity: 0 });
  await expect(cloudCanvas).toHaveAttribute("data-cloud-frame", "26");
  const movingFrame = await cloudCanvas.screenshot();
  expect(movingFrame.equals(firstFrame)).toBe(false);

  await scrollToOpeningProgress(page, 0.2);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "forward-veil-open", presentationResourcesReleased: false });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud?.veilOpacity))
    .toBeGreaterThan(0);

  await scrollToOpeningProgress(page, 0.23);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "live", presentationResourcesReleased: true });
  await expect(page.locator("[data-opening-cloud-media]")).not.toHaveAttribute("src", /.+/);

  await scrollToOpeningProgress(page, 0.207);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "live", state: "reverse-veil-close" });
  await scrollToOpeningProgress(page, 0.18);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud))
    .toMatchObject({ source: "cloud", renderedFrame: 39 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud?.veilOpacity))
    .toBeLessThan(0.05);

  expect(consoleErrors).toEqual([]);
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

test("releases cloud presentation on decode and background-resume fallbacks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fallback policy is shared; cover it once in the desktop browser.");

  await page.goto("/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningCloud?.source))
    .toBe("cloud");
  await page.locator("[data-opening-cloud-media]").evaluate((media) => {
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
