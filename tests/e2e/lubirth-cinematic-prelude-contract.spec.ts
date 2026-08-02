import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  mapPreludeProgressToFrame,
  validateCinematicPreludeManifest,
  type CinematicPreludeManifest
} from "../../apps/site/content/lubirthCinematicPreludeManifest";

const publicManifestPath = path.join(
  process.cwd(),
  "apps/site/public/assets/lubirth/cinematic-prelude/manifest.json"
);

function readPublicManifest() {
  return JSON.parse(readFileSync(publicManifestPath, "utf8")) as unknown;
}

function cloneManifest(manifest: CinematicPreludeManifest) {
  return structuredClone(manifest) as CinematicPreludeManifest;
}

test("publishes source-bound opaque all-I variants within both hard budgets", () => {
  const manifest = validateCinematicPreludeManifest(readPublicManifest());

  expect(manifest.handoff).toMatchObject({
    cutProgress: 0.195,
    liveProgress: 0.22,
    plateEndProgress: 0.18,
    veilPeakProgress: 0.195
  });
  expect(manifest.handoff.veilProfile).toMatchObject({
    colorSrgb: expect.stringMatching(/^#[0-9a-f]{6}$/i),
    peakOpacity: 1,
    luminanceY: expect.any(Number)
  });
  expect(manifest.source).toMatchObject({
    license: "internally-generated",
    renderer: expect.any(String),
    scenePath: expect.any(String),
    referenceCanvasSha256: expect.stringMatching(/^[0-9a-f]{64}$/)
  });

  for (const variant of [manifest.variants.desktop, manifest.variants.mobile]) {
    const desktop = variant.tier === "desktop";
    expect(variant.transferBytes).toBeLessThanOrEqual(
      desktop ? 6 * 1024 * 1024 : 2 * 1024 * 1024
    );
    expect(variant.firstFrameDeadlineMs).toBe(desktop ? 1200 : 1800);
    expect(variant.maxPresentationResidencyBytes).toBe(
      desktop ? 16 * 1024 * 1024 : 8 * 1024 * 1024
    );
    expect(variant.estimatedPresentationResidencyBytes).toBeLessThanOrEqual(
      variant.maxPresentationResidencyBytes
    );
    expect(variant.keyframePolicy).toBe("all-i");
    expect(variant.colorSpace).toBe("rec709-srgb-sdr");
    expect(variant.opaque).toBe(true);
    expect(variant.audio).toBe(false);
    expect(variant.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(variant.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(variant.safeCrop).toMatchObject({
      left: expect.any(Number),
      right: expect.any(Number),
      top: expect.any(Number),
      bottom: expect.any(Number)
    });
  }
});

test("rejects manifests with missing provenance, visual-critical metadata, or mobile media", () => {
  const valid = validateCinematicPreludeManifest(readPublicManifest());

  const missingHash = cloneManifest(valid);
  missingHash.variants.desktop.sha256 = "";
  expect(() => validateCinematicPreludeManifest(missingHash)).toThrow(/desktop\.sha256/);

  const missingVeil = cloneManifest(valid) as CinematicPreludeManifest & {
    handoff: Partial<CinematicPreludeManifest["handoff"]>;
  };
  delete missingVeil.handoff.veilProfile;
  expect(() => validateCinematicPreludeManifest(missingVeil)).toThrow(/veilProfile/);

  const transparent = cloneManifest(valid);
  transparent.variants.desktop.opaque = false;
  expect(() => validateCinematicPreludeManifest(transparent)).toThrow(/opaque/);

  const missingMobile = cloneManifest(valid) as CinematicPreludeManifest & {
    variants: Partial<CinematicPreludeManifest["variants"]>;
  };
  delete missingMobile.variants.mobile;
  expect(() => validateCinematicPreludeManifest(missingMobile)).toThrow(/variants\.mobile/);

  const missingSourceHash = cloneManifest(valid);
  missingSourceHash.variants.mobile.sourceSha256 = "";
  expect(() => validateCinematicPreludeManifest(missingSourceHash)).toThrow(
    /mobile\.sourceSha256/
  );
});

test("maps the approved representation boundaries to deterministic target frames", () => {
  const manifest = validateCinematicPreludeManifest(readPublicManifest());

  expect(mapPreludeProgressToFrame(-1, manifest)).toBe(0);
  expect(mapPreludeProgressToFrame(0.18, manifest)).toBe(39);
  expect(mapPreludeProgressToFrame(0.195, manifest)).toBe(42);
  expect(mapPreludeProgressToFrame(0.22, manifest)).toBe(47);
  expect(mapPreludeProgressToFrame(1, manifest)).toBe(47);
});

test("preparation fails closed when an approved source path is missing", () => {
  const result = spawnSync(
    process.execPath,
    [
      "apps/site/scripts/prepare-lubirth-cinematic-prelude.mjs",
      "--desktop-source",
      "/definitely/missing/lubirth-desktop.mp4",
      "--mobile-source",
      "/definitely/missing/lubirth-mobile.mp4",
      "--output-root",
      "/private/tmp/lubirth-cinematic-prelude-missing-source",
      "--ffmpeg",
      "ffmpeg",
      "--ffprobe",
      "ffprobe"
    ],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    "desktop source does not exist: /definitely/missing/lubirth-desktop.mp4"
  );
});
