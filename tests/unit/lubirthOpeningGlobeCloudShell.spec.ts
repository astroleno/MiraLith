import { expect, test } from "@playwright/test";
import {
  resolveOpeningGlobeCloudShellPolicy
} from "../../packages/lubirth-hero/src/LandingReliefCloudShell";
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
