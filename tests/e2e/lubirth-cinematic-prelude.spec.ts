import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("layers plate and veil inside a Canvas-scoped isolated stack", () => {
  const plate = source(
    "apps/site/components/lubirth-cinematic-prelude/CinematicPlate.tsx"
  );
  const veil = source(
    "apps/site/components/lubirth-cinematic-prelude/TransitionVeil.tsx"
  );
  const stack = source(
    "apps/site/components/lubirth-cinematic-prelude/LuBirthCinematicPreludeStack.tsx"
  );
  const css = source(
    "apps/site/components/LuBirthCinematicPreludeRoute.module.css"
  );

  expect(plate).toContain("data-cinematic-plate");
  expect(plate).toContain("data-active-source");
  expect(veil).toContain("data-transition-veil");
  expect(veil).toContain('data-layer-above="plate canvas"');
  expect(stack.indexOf("{children}")).toBeLessThan(
    stack.indexOf("<CinematicPlate")
  );
  expect(stack.indexOf("<CinematicPlate")).toBeLessThan(
    stack.indexOf("<TransitionVeil")
  );
  expect(css).toMatch(/\.stack\s*\{[^}]*isolation:\s*isolate/s);
  expect(css).toMatch(/\.plate\s*\{[^}]*z-index:\s*2/s);
  expect(css).toMatch(/\.veil\s*\{[^}]*z-index:\s*3/s);
  expect(css).toMatch(/pointer-events:\s*none/);
  expect(css).not.toContain(":global");
});

const IP_COMPOSITION_SAMPLES = [
  { label: "north", latitudeDeg: 31.2, longitudeDeg: 103.8 },
  { label: "south", latitudeDeg: -33.8688, longitudeDeg: 151.2093 },
  { label: "dateline", latitudeDeg: 12.4, longitudeDeg: 179.7 }
];

for (const sample of IP_COMPOSITION_SAMPLES) {
  test(`keeps real IP Relief-lite prewarmed beneath the normalized plate (${sample.label})`, async ({
    page
  }) => {
    const params = new URLSearchParams({
      copy: "hidden",
      location: "ip",
      geoLat: String(sample.latitudeDeg),
      geoLon: String(sample.longitudeDeg),
      progress: "0"
    });

    await page.goto(`/lubirth-cinematic-prelude?${params.toString()}`);
    await expect(page.locator("[data-cinematic-prelude-route]")).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("[data-cinematic-plate]")).toHaveAttribute(
      "data-active-source",
      "plate"
    );
    const expectedTier = await page.evaluate(() =>
      Math.min(window.innerWidth, window.innerHeight) < 760 ? "mobile" : "desktop"
    );

    await expect
      .poll(
        () =>
          page.evaluate(
            ({ latitudeDeg: expectedLatitude, longitudeDeg: expectedLongitude }) => {
              const location = window.__MiraLithLuBirthRuntimeLocation;
              const policy = window.__MiraLithLuBirthVisualPolicy;
              const telemetry = window.__MiraLithLuBirthCinematicPrelude;
              return {
                atmosphereMode: policy?.atmosphereMode,
                cloudMode: policy?.cloudMode,
                latitudeDeg: location?.latitudeDeg,
                longitudeDeg: location?.longitudeDeg,
                normalized: telemetry?.normalizedComposition,
                selectedTier: telemetry?.selectedTier,
                source: telemetry?.source,
                armStatus: telemetry?.armStatus,
                expectedLatitude,
                expectedLongitude
              };
            },
            sample
          ),
        { timeout: 25_000 }
      )
      .toMatchObject({
        atmosphereMode: "limb-lite",
        cloudMode: "relief-lite",
        latitudeDeg: sample.latitudeDeg,
        longitudeDeg: sample.longitudeDeg,
        normalized: {
          scale: 1
        },
        selectedTier: expectedTier,
        source: "plate",
        armStatus: "ready",
        expectedLatitude: sample.latitudeDeg,
        expectedLongitude: sample.longitudeDeg
      });
  });
}

test("keeps birth-default Relief-lite live for a direct post-handoff entry", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&quality=high&progress=0.22"
  );

  await expect(page.locator("canvas")).toHaveCount(1);
  const expectedTier = await page.evaluate(() =>
    Math.min(window.innerWidth, window.innerHeight) < 760 ? "mobile" : "desktop"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude), {
      timeout: 25_000
    })
    .toMatchObject({
      source: "live",
      progress: 0.22,
      normalizedComposition: { x: 0, y: 0, scale: 1 },
      selectedTier: expectedTier,
      armStatus: "late",
      fallbackReason: "late-first-frame",
      locationMode: "normalized-ip-composition"
    });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVisualPolicy))
    .toMatchObject({
      atmosphereMode: "limb-lite",
      cloudMode: "relief-lite",
      postEffectMode: "off"
    });
});

async function setPreludeProgress(page: import("@playwright/test").Page, progress: number) {
  await page.evaluate((nextProgress) => {
    window.__MiraLithSetCinematicPreludeProgress?.(nextProgress);
  }, progress);
}

test("does not enter a plate when the first frame arrives late", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=late-first-frame"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({
      source: "live",
      state: "fallback-live",
      armStatus: "late",
      fallbackReason: "late-first-frame",
      sourceCutCount: 0
    });

  await setPreludeProgress(page, 0.1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({
      source: "live",
      progress: 0.1,
      fallbackReason: "late-first-frame",
      sourceCutCount: 0
    });
  await expect(page.locator("[data-cinematic-plate]")).toHaveAttribute(
    "data-visible",
    "false"
  );
});

test("reopens live after a reverse target timeout", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=reverse-timeout"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.source))
    .toBe("plate");
  await setPreludeProgress(page, 0.22);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.state))
    .toBe("live");
  await setPreludeProgress(page, 0.18);

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({
      source: "live",
      state: "fallback-live",
      veilOpacity: 0,
      fallbackReason: "reverse-timeout",
      sourceCutCount: 1
    });
});

test("retains live content while a reverse frame is pending", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=reverse-pending"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.source))
    .toBe("plate");
  await setPreludeProgress(page, 0.22);
  await setPreludeProgress(page, 0.18);

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({
      source: "live",
      state: "reverse-wait-frame",
      veilOpacity: 1,
      requestedFrame: 39,
      sourceCutCount: 1
    });
});

test("hysteresis prevents source oscillation inside the dead band", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=reverse-ready"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.source))
    .toBe("plate");

  await setPreludeProgress(page, 0.196);
  await setPreludeProgress(page, 0.19);
  await setPreludeProgress(page, 0.205);
  await setPreludeProgress(page, 0.185);

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({
      source: "live",
      sourceCutCount: 1
    });
});

test("reverse exposes a ready frame only after leaving the dead band", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=reverse-ready"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.source))
    .toBe("plate");
  await setPreludeProgress(page, 0.22);
  await setPreludeProgress(page, 0.19);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({ source: "live", sourceCutCount: 1 });

  await setPreludeProgress(page, 0.18);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({
      source: "plate",
      requestedFrame: 39,
      renderedFrame: 39,
      sourceCutCount: 2
    });
});

test("released HTML video resources reattach for a real reverse seek", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.source), {
      timeout: 25_000
    })
    .toBe("plate");

  await setPreludeProgress(page, 0.22);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({
      source: "live",
      state: "live",
      presentationResourcesReleased: true
    });
  await expect(page.locator("[data-cinematic-prelude-media]")).not.toHaveAttribute("src", /.+/);

  await setPreludeProgress(page, 0.18);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude), {
      timeout: 25_000
    })
    .toMatchObject({
      source: "plate",
      requestedFrame: 39,
      renderedFrame: 39,
      sourceCutCount: 2,
      fallbackReason: null
    });
  await expect(page.locator("[data-cinematic-prelude-media]")).toHaveAttribute(
    "src",
    new RegExp(
      `/assets/lubirth/cinematic-prelude/${
        (await page.evaluate(() => Math.min(innerWidth, innerHeight))) < 760
          ? "mobile"
          : "desktop"
      }\\.mp4`
    )
  );
});

for (const testCase of [
  { mode: "decode-error", reason: "decode-error" },
  { mode: "reduced-motion", reason: "reduced-motion" }
]) {
  test(`${testCase.mode} selects an explicit live fallback`, async ({ page }) => {
    await page.goto(
      `/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=${testCase.mode}`
    );
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
      .toMatchObject({
        source: "live",
        state: "fallback-live",
        veilOpacity: 0,
        fallbackReason: testCase.reason
      });
  });
}

test("background resume selects live fallback", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=reverse-ready"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.source))
    .toBe("plate");
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({ source: "live", fallbackReason: "background-unverified" });
});

test("low memory hook selects live fallback", async ({ page }) => {
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=reverse-ready"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude?.source))
    .toBe("plate");
  await page.evaluate(() => window.__MiraLithTriggerCinematicPreludeLowMemory?.());
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({ source: "live", fallbackReason: "low-memory" });
});

test("selects the mobile plate tier in mobile landscape", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(
    "/lubirth-cinematic-prelude?copy=hidden&location=birth&progress=0&preludeTest=reverse-ready"
  );
  await expect(page.locator("[data-cinematic-prelude-route]")).toHaveAttribute(
    "data-tier",
    "mobile"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude))
    .toMatchObject({ source: "plate", selectedTier: "mobile" });
});
