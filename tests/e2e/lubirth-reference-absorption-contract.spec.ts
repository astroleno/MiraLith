import { expect, test } from "@playwright/test";
import {
  referenceVariantUsesCloudScattering,
  referenceVariantUsesEarthMaterial,
  resolveLandingReferenceAbsorptionVariant
} from "../../packages/lubirth-hero/src";

test.setTimeout(120_000);

interface ReferenceEarthTelemetry {
  active: true;
  referenceAbsorptionVariant: string;
}

interface ReferenceCloudTelemetry {
  active: true;
  densityIntegration: "front-to-back";
  fragmentTextureReads: 3 | 4;
  premultipliedAlpha: true;
  referenceAbsorptionVariant: string;
}

declare global {
  interface Window {
    __MiraLithLuBirthEarthSurfaceLiteV2?: ReferenceEarthTelemetry;
    __MiraLithLuBirthReliefCloud?: ReferenceCloudTelemetry;
  }
}

function createSpikeUrl(overrides: Record<string, string> = {}) {
  return `/lubirth-reference-absorption-spike?${new URLSearchParams({
    copy: "hidden",
    progress: "0.22",
    quality: "high",
    visualTest: "pixels",
    ...overrides
  }).toString()}`;
}

async function waitForReferenceAbsorptionRoute(
  page: import("@playwright/test").Page,
  variant: string
) {
  await expect(page.locator(".lubirth-reference-absorption-spike")).toHaveAttribute(
    "data-reference-absorption-variant",
    variant,
    { timeout: 25_000 }
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-reference-absorption-variant",
    variant,
    { timeout: 25_000 }
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-cloud-mode",
    "relief-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-atmosphere-mode",
    "limb-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-post-effect-mode",
    "off"
  );
  await expect
    .poll(() => page.evaluate(() => ({
      cloud: window.__MiraLithLuBirthReliefCloud,
      earth: window.__MiraLithLuBirthEarthSurfaceLiteV2
    })), { timeout: 25_000 })
    .toMatchObject({
      cloud: {
        active: true,
        densityIntegration: "front-to-back",
        premultipliedAlpha: true,
        referenceAbsorptionVariant: variant
      },
      earth: {
        active: true,
        referenceAbsorptionVariant: variant
      }
    });
}

test("resolves the query-only reference absorption variant contract", () => {
  expect(resolveLandingReferenceAbsorptionVariant("earth-material-v1"))
    .toBe("earth-material-v1");
  expect(resolveLandingReferenceAbsorptionVariant("cloud-scattering-v1"))
    .toBe("cloud-scattering-v1");
  expect(resolveLandingReferenceAbsorptionVariant("combined-v1"))
    .toBe("combined-v1");
  expect(resolveLandingReferenceAbsorptionVariant("anything-else"))
    .toBe("baseline");
  expect(referenceVariantUsesEarthMaterial("combined-v1")).toBe(true);
  expect(referenceVariantUsesCloudScattering("combined-v1")).toBe(true);
});

test("routes only the dedicated spike through the reference absorption control plane", async ({
  page
}) => {
  await page.goto(createSpikeUrl({ variant: "earth-material-v1" }));
  await waitForReferenceAbsorptionRoute(page, "earth-material-v1");

  await page.goto(createSpikeUrl({ variant: "anything-else" }));
  await waitForReferenceAbsorptionRoute(page, "baseline");
});

test("keeps the homepage and revised route on the non-experimental baseline", async ({ page }) => {
  const requestedExperimentalAssets = new Set<string>();
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("earth-material-lite-v1")) {
      requestedExperimentalAssets.add(pathname);
    }
  });

  await page.goto("/?copy=hidden&progress=0&visualTest=pixels");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-reference-absorption-variant",
    "baseline",
    { timeout: 25_000 }
  );

  await page.goto("/lubirth-revised?copy=hidden&progress=0&visualTest=pixels");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-reference-absorption-variant",
    "baseline",
    { timeout: 25_000 }
  );
  expect([...requestedExperimentalAssets]).toEqual([]);
});
