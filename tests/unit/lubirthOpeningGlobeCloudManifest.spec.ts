import { expect, test } from "@playwright/test";
import {
  mapOpeningGlobeCloudProgressToFrame,
  validateOpeningGlobeCloudManifest
} from "../../apps/site/content/lubirthOpeningGlobeCloudManifest";

const SHA = "a".repeat(64);

const validManifestFixture = {
  schemaVersion: 1,
  id: "lubirth-opening-globe-cloud-field-v1",
  cloudOnly: true,
  mapping: "equirectangular-earth-uv",
  fieldColorSpace: "none",
  packing: "left-rgb-right-concavity",
  authoredDurationSeconds: 1.584,
  encodedDurationSeconds: 1.6,
  frameRate: 30,
  frameCount: 48,
  source: {
    provenance: "internal-procedural",
    generator: "packages/lubirth-hero/scripts/bake-opening-globe-cloud-assets.mjs",
    generatorVersion: "1.0.0",
    scenePath: "packages/lubirth-hero/scripts/opening-globe-cloud-field.html",
    seed: "lubirth-opening-globe-cloud-v1",
    parameterSummary: {
      densityModel: "high-resolution-worley-fbm-sphere-field",
      windDistance: "0.28",
      sourceResolution: "1536x768"
    },
    sourceSha256: SHA,
    license: "internally-generated"
  },
  handoff: {
    plateEndProgress: 0.18,
    plateEndFrame: 39,
    cutProgress: 0.195,
    cutFrame: 42,
    liveProgress: 0.22,
    liveFrame: 47,
    veilColorSrgb: "#142536"
  },
  variants: {
    desktop: {
      tier: "desktop",
      src: "/assets/lubirth/opening-globe-clouds/desktop.mp4",
      rawWidth: 1536,
      rawHeight: 768,
      packedWidth: 3072,
      packedHeight: 768,
      frameRate: 30,
      frameCount: 48,
      keyframePolicy: "all-i",
      packing: "left-rgb-right-concavity",
      transferBytes: 6 * 1024 * 1024,
      maxTransferBytes: 6 * 1024 * 1024,
      estimatedPackedTextureBytes: 9_437_184,
      maxPackedTextureBytes: 16 * 1024 * 1024,
      sha256: SHA
    },
    mobile: {
      tier: "mobile",
      src: "/assets/lubirth/opening-globe-clouds/mobile.mp4",
      rawWidth: 1024,
      rawHeight: 512,
      packedWidth: 2048,
      packedHeight: 512,
      frameRate: 30,
      frameCount: 48,
      keyframePolicy: "all-i",
      packing: "left-rgb-right-concavity",
      transferBytes: 2 * 1024 * 1024,
      maxTransferBytes: 2 * 1024 * 1024,
      estimatedPackedTextureBytes: 4_194_304,
      maxPackedTextureBytes: 8 * 1024 * 1024,
      sha256: SHA
    }
  }
};

test("opening globe cloud manifest rejects a screen-space or color-art asset", () => {
  expect(() =>
    validateOpeningGlobeCloudManifest({
      ...validManifestFixture,
      mapping: "screen-space",
      packing: "left-rgb-right-alpha",
      fieldColorSpace: "rec709-srgb-sdr"
    })
  ).toThrow(/equirectangular-earth-uv.*field/i);
});

test("opening globe cloud manifest rejects a full-scene source or non-2:1 field", () => {
  expect(() =>
    validateOpeningGlobeCloudManifest({
      ...validManifestFixture,
      cloudOnly: false,
      source: {
        ...validManifestFixture.source,
        provenance: "imagegen-full-scene"
      },
      variants: {
        ...validManifestFixture.variants,
        desktop: {
          ...validManifestFixture.variants.desktop,
          rawHeight: 810
        }
      }
    })
  ).toThrow(/internal-procedural cloud-only globe field/i);
});

test("opening globe cloud manifest maps authored handoff progress to seekable field frames", () => {
  const manifest = validateOpeningGlobeCloudManifest(validManifestFixture);

  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0)).toBe(0);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.09)).toBe(20);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.18)).toBe(39);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.195)).toBe(42);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.22)).toBe(42);
});
