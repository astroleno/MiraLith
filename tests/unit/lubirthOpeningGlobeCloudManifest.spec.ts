import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
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
  quality: {
    codec: "h264-all-i-crf-21",
    minAveragePsnr: 38,
    minAllSsim: 0.98,
    variants: {
      desktop: { averagePsnr: 39.2, allSsim: 0.982 },
      mobile: { averagePsnr: 38.9, allSsim: 0.981 }
    }
  },
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

test("opening globe cloud manifest rejects a mobile encoding without its visual fidelity gate", () => {
  expect(() =>
    validateOpeningGlobeCloudManifest({
      ...validManifestFixture,
      quality: {
        ...validManifestFixture.quality,
        variants: {
          ...validManifestFixture.quality.variants,
          mobile: { averagePsnr: 37.9, allSsim: 0.979 }
        }
      }
    })
  ).toThrow(/compression quality gate/i);
});

test("opening globe cloud manifest maps authored handoff progress to seekable field frames", () => {
  const manifest = validateOpeningGlobeCloudManifest(validManifestFixture);

  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0)).toBe(0);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.09)).toBe(20);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.18)).toBe(39);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.195)).toBe(42);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.22)).toBe(42);
});

function publicAssetPath(src: string) {
  return path.join(
    process.cwd(),
    "apps/site/public",
    src.replace(/^\/assets\//, "assets/")
  );
}

function ffprobeJson(assetPath: string, entries: string) {
  return JSON.parse(
    execFileSync(
      "/opt/homebrew/bin/ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", entries,
        "-of", "json",
        assetPath
      ],
      { encoding: "utf8" }
    )
  ) as Record<string, unknown>;
}

function decodePackedFieldChannel(
  assetPath: string,
  rawWidth: number,
  rawHeight: number,
  frame: number,
  channel: 0 | 1 | 2 | 3
) {
  const cropLeft = channel === 3 ? rawWidth : 0;
  const rgb = execFileSync(
    "/opt/homebrew/bin/ffmpeg",
    [
      "-v", "error",
      "-i", assetPath,
      "-vf", "select=eq(n\\," + frame + "),crop=" + rawWidth + ":" + rawHeight + ":" + cropLeft + ":0",
      "-frames:v", "1",
      "-f", "rawvideo",
      "-pix_fmt", "rgb24",
      "pipe:1"
    ],
    { encoding: "buffer", maxBuffer: rawWidth * rawHeight * 4 }
  );
  const component = channel === 3 ? 0 : channel;
  const values = Buffer.alloc(rawWidth * rawHeight);
  for (let index = 0; index < values.byteLength; index += 1) {
    values[index] = rgb[index * 3 + component];
  }
  return values;
}

function normalizedMeanAbsoluteDifference(left: Buffer, right: Buffer) {
  expect(left.byteLength).toBe(right.byteLength);
  let sum = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    sum += Math.abs(left[index] - right[index]);
  }
  return sum / Math.max(1, left.byteLength * 255);
}

function normalizedStandardDeviation(values: Buffer) {
  let sum = 0;
  for (const value of values) sum += value;
  const mean = sum / Math.max(1, values.byteLength);
  let squaredDifference = 0;
  for (const value of values) squaredDifference += (value - mean) ** 2;
  return Math.sqrt(squaredDifference / Math.max(1, values.byteLength)) / 255;
}

test("publishes all-I globe fields with high-frequency height and temporal change", () => {
  test.setTimeout(60_000);
  const manifest = validateOpeningGlobeCloudManifest(
    JSON.parse(readFileSync(
      path.join(process.cwd(), "apps/site/public/assets/lubirth/opening-globe-clouds/manifest.json"),
      "utf8"
    ))
  );
  const sourcePath = path.join(process.cwd(), manifest.source.scenePath);
  expect(existsSync(sourcePath)).toBe(true);
  expect(createHash("sha256").update(readFileSync(sourcePath)).digest("hex")).toBe(
    manifest.source.sourceSha256
  );

  for (const tier of ["desktop", "mobile"] as const) {
    const variant = manifest.variants[tier];
    const assetPath = publicAssetPath(variant.src);
    expect(existsSync(assetPath)).toBe(true);
    expect(statSync(assetPath).size).toBe(variant.transferBytes);
    expect(createHash("sha256").update(readFileSync(assetPath)).digest("hex")).toBe(variant.sha256);

    const stream = ffprobeJson(
      assetPath,
      "stream=width,height,avg_frame_rate,nb_frames"
    ).streams as Array<Record<string, string | number>>;
    expect(stream[0]).toMatchObject({
      width: variant.packedWidth,
      height: variant.packedHeight,
      avg_frame_rate: "30/1",
      nb_frames: "48"
    });

    const frames = ffprobeJson(assetPath, "frame=key_frame").frames as Array<{ key_frame: number }>;
    expect(frames).toHaveLength(48);
    expect(frames.every((frame) => frame.key_frame === 1)).toBe(true);
  }

  const desktop = manifest.variants.desktop;
  const assetPath = publicAssetPath(desktop.src);
  const heightAtStart = decodePackedFieldChannel(assetPath, desktop.rawWidth, desktop.rawHeight, 0, 1);
  const heightAtMiddle = decodePackedFieldChannel(assetPath, desktop.rawWidth, desktop.rawHeight, 24, 1);
  const concavity = decodePackedFieldChannel(assetPath, desktop.rawWidth, desktop.rawHeight, 12, 3);
  expect(normalizedMeanAbsoluteDifference(heightAtStart, heightAtMiddle)).toBeGreaterThan(0.012);
  expect(normalizedStandardDeviation(heightAtMiddle)).toBeGreaterThan(0.08);
  expect(normalizedStandardDeviation(concavity)).toBeGreaterThan(0.03);
});
