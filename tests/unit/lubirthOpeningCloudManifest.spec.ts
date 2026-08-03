import { expect, test } from "@playwright/test";
import {
  mapOpeningCloudProgressToFrame,
  validateOpeningCloudManifest
} from "../../apps/site/content/lubirthOpeningCloudManifest";

const SHA = "a".repeat(64);

const validManifestFixture = {
  schemaVersion: 1,
  id: "lubirth-opening-cloud-pack-v1",
  cloudOnly: true,
  colorSpace: "rec709-srgb-sdr",
  packing: "left-rgb-right-alpha",
  authoredDurationSeconds: 1.584,
  encodedDurationSeconds: 1.6,
  frameRate: 30,
  frameCount: 48,
  source: {
    provenance: "internal-procedural",
    generator: "packages/lubirth-hero/scripts/bake-opening-cloud-assets.mjs",
    generatorVersion: "1.0.0",
    scenePath: "packages/lubirth-hero/scripts/opening-cloud-volume.html",
    seed: "lubirth-opening-cloud-v1",
    parameterSummary: {
      densityModel: "worley-fbm-front-to-back",
      windDistance: "0.28"
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
      src: "/assets/lubirth/opening-clouds/desktop.mp4",
      width: 1440,
      height: 810,
      packedWidth: 2880,
      packedHeight: 810,
      frameRate: 30,
      frameCount: 48,
      keyframePolicy: "all-i",
      packing: "left-rgb-right-alpha",
      transferBytes: 5_900_000,
      maxTransferBytes: 6 * 1024 * 1024,
      estimatedPresentationResidencyBytes: 12_830_400,
      maxPresentationResidencyBytes: 16 * 1024 * 1024,
      sha256: SHA
    },
    mobile: {
      tier: "mobile",
      src: "/assets/lubirth/opening-clouds/mobile.mp4",
      width: 960,
      height: 444,
      packedWidth: 1920,
      packedHeight: 444,
      frameRate: 30,
      frameCount: 48,
      keyframePolicy: "all-i",
      packing: "left-rgb-right-alpha",
      transferBytes: 1_900_000,
      maxTransferBytes: 2 * 1024 * 1024,
      estimatedPresentationResidencyBytes: 4_688_640,
      maxPresentationResidencyBytes: 8 * 1024 * 1024,
      sha256: SHA
    }
  }
};

test("opening cloud manifest rejects a full-scene source", () => {
  expect(() =>
    validateOpeningCloudManifest({
      ...validManifestFixture,
      cloudOnly: false,
      source: {
        ...validManifestFixture.source,
        provenance: "imagegen-full-scene"
      }
    })
  ).toThrow(/internal-procedural cloud-only asset/i);
});

test("opening cloud manifest rejects an alpha-less or over-budget variant", () => {
  expect(() =>
    validateOpeningCloudManifest({
      ...validManifestFixture,
      variants: {
        ...validManifestFixture.variants,
        desktop: {
          ...validManifestFixture.variants.desktop,
          packing: "opaque-rgb",
          transferBytes: 6 * 1024 * 1024 + 1
        }
      }
    })
  ).toThrow(/packed alpha|transfer budget/i);
});

test("opening cloud manifest maps progress to the authored frame boundaries", () => {
  const manifest = validateOpeningCloudManifest(validManifestFixture);

  expect(mapOpeningCloudProgressToFrame(manifest, 0)).toBe(0);
  expect(mapOpeningCloudProgressToFrame(manifest, 0.09)).toBe(20);
  expect(mapOpeningCloudProgressToFrame(manifest, 0.18)).toBe(39);
  expect(mapOpeningCloudProgressToFrame(manifest, 0.195)).toBe(42);
  expect(mapOpeningCloudProgressToFrame(manifest, 0.22)).toBe(42);
});
