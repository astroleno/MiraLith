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
        selectedTier: "desktop",
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
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCinematicPrelude), {
      timeout: 25_000
    })
    .toMatchObject({
      source: "live",
      progress: 0.22,
      normalizedComposition: { x: 0, y: 0, scale: 1 },
      selectedTier: "desktop",
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
