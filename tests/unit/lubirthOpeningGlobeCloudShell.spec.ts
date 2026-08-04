import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  resolveOpeningCloudDetailOpacity,
  resolveOpeningGlobeCloudFieldUvOffset,
  resolveOpeningGlobeCloudShellPolicy
} from "../../packages/lubirth-hero/src/LandingReliefCloudShell";
import {
  HOME_CLOUD_FIELD_OFFSET_X,
  HOME_CLOUD_FIELD_OFFSET_Y
} from "../../packages/lubirth-hero/src/homeCloudField";
import {
  LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE
} from "../../packages/lubirth-hero/src/landingEarthLiteV2Policy";

test("uses a globe-UV shell below the limb atmosphere with a visibly deep ordered volume", () => {
  const desktop = resolveOpeningGlobeCloudShellPolicy(false);
  const mobile = resolveOpeningGlobeCloudShellPolicy(true);

  expect(desktop).toMatchObject({
    bottomScale: 1.0005,
    topScale: 1.0115,
    viewSteps: 3,
    sunSteps: 1,
    opacity: 0.84,
    debugBoost: 1,
    cloudIlluminationFloor: 0.46,
    reliefLightingScale: 1.24,
    fieldDecoder: "packed-video-field",
    textureColorSpace: "none"
  });
  expect(mobile).toMatchObject({
    bottomScale: 1.0005,
    topScale: 1.0115,
    viewSteps: 2,
    sunSteps: 1,
    opacity: 0.84,
    debugBoost: 1,
    cloudIlluminationFloor: 0.46,
    reliefLightingScale: 1.24
  });
  expect(desktop.topScale).toBeLessThan(LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE);
});

test("keeps a continuous Relief-lite base below a dense body and sparse high wisps", () => {
  const policy = resolveOpeningGlobeCloudShellPolicy(false);

  expect(policy).toMatchObject({
    base: {
      persistent: true,
      bottomScale: 1.0003,
      topScale: 1.0035
    },
    body: {
      bottomScale: 1.0035,
      topScale: 1.0062,
      opacity: 0.78,
      baseOpacityFloor: 0.3
    },
    wisps: {
      bottomScale: 1.0062,
      topScale: 1.0074,
      opacity: 0.28
    }
  });
  expect(resolveOpeningCloudDetailOpacity(39, 0.9)).toBe(0.9);
  expect(resolveOpeningCloudDetailOpacity(42, 0.9)).toBe(0);
  expect(policy.body.topScale).toBeLessThan(LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE);
  expect(policy.wisps.topScale).toBeLessThan(LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE);
});

test("samples temporary detail in the persistent Relief-lite field coordinate system", () => {
  expect(resolveOpeningGlobeCloudFieldUvOffset()).toEqual([
    HOME_CLOUD_FIELD_OFFSET_X,
    HOME_CLOUD_FIELD_OFFSET_Y
  ]);
});

test("offers opening-only body occlusion and height-band controls without replacing the shared shader", () => {
  const shaderSource = readFileSync(
    "packages/lubirth-hero/src/LandingReliefCloud.tsx",
    "utf8"
  );
  const shellSource = readFileSync(
    "packages/lubirth-hero/src/LandingReliefCloudShell.tsx",
    "utf8"
  );
  const sourceField = readFileSync(
    "packages/lubirth-hero/scripts/opening-globe-cloud-field.html",
    "utf8"
  );

  expect(shaderSource).toContain("cloudBodyOpacityFloor");
  expect(shaderSource).toContain("cloudHeightBand");
  expect(shaderSource).toContain("cloudOpacityCeiling");
  expect(shellSource).toContain("cloudBodyOpacityFloor?: number");
  expect(shellSource).toContain("cloudHeightBand?: readonly [number, number]");
  expect(sourceField).toContain("vec2 grid = vec2(128.0, 64.0);");
  expect(sourceField).toContain("float sourceCoverage = clamp(baseField.r, 0.0, 1.0);");
});
