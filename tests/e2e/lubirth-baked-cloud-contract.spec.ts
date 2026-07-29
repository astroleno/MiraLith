import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

type BakedCloudChannel = "colorOpacity" | "depthOptical" | "normalAoScatter";

interface BakedCloudAsset {
  byteLength: number;
  file: string;
  height: number;
  sha256: string;
  width: number;
}

interface BakedCloudView {
  assets: Record<BakedCloudChannel, BakedCloudAsset>;
  id: string;
  viewDirection: [number, number, number];
}

interface BakedCloudTier {
  id: "desktop" | "mobile";
  maxGpuResidencyBytes: number;
  maxTransferBytes: number;
  views: BakedCloudView[];
}

interface BakedCloudManifest {
  candidate: string;
  channels: Record<string, { numericRange: [number, number] }>;
  generator: {
    seed: number;
    sourceScenePath: string;
    tool: string;
    version: string;
  };
  license: string;
  provenance: string;
  schemaVersion: number;
  source: {
    kind: string;
    resolution: [number, number, number];
    sha256: string;
  };
  tiers: BakedCloudTier[];
}

const ASSET_ROOT = "apps/site/public/assets/lubirth/cloud-impostor";
const MANIFEST_PATH = path.join(process.cwd(), ASSET_ROOT, "manifest.json");

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readManifest() {
  const exists = existsSync(MANIFEST_PATH);
  expect(exists).toBe(true);
  if (!exists) {
    return null;
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as BakedCloudManifest;
}

async function decodeRgba(filePath: string) {
  const decoded = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
    height: decoded.info.height,
    width: decoded.info.width
  };
}

function componentRange(data: Uint8Array, component: number) {
  let maximum = 0;
  let minimum = 255;
  for (let index = component; index < data.length; index += 4) {
    minimum = Math.min(minimum, data[index]);
    maximum = Math.max(maximum, data[index]);
  }
  return { maximum, minimum };
}

test("packages an auditable internally-generated high-resolution procedural cloud bake", () => {
  const manifest = readManifest();
  if (!manifest) {
    return;
  }

  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.candidate).toBe("lubirth-offline-baked-cloud-impostor-v1");
  expect(manifest.provenance).toBe("internal-procedural");
  expect(manifest.license).toBe("internally-generated");
  expect(manifest.generator).toMatchObject({
    seed: 709183,
    sourceScenePath: "packages/lubirth-hero/scripts/prepare-baked-cloud-impostor.mjs",
    tool: "miralith-internal-procedural-volume-baker",
    version: "1.0.0"
  });
  expect(manifest.source).toMatchObject({
    kind: "high-resolution-internal-procedural-volume",
    resolution: [192, 128, 128],
    sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
  });
  expect(JSON.stringify(manifest)).not.toMatch(/local-volume|lobe-output|analytic-ellipsoid/i);
  expect(manifest.tiers.map((tier) => tier.id)).toEqual(["desktop", "mobile"]);
});

test("declares complete bounded deep-impostor views with verifiable channels", async () => {
  const manifest = readManifest();
  if (!manifest) {
    return;
  }

  expect(manifest.channels.colorOpacity.numericRange).toEqual([0, 1]);
  expect(manifest.channels.depthOptical.numericRange).toEqual([0, 1]);
  expect(manifest.channels.normalAoScatter.numericRange).toEqual([0, 1]);

  for (const tier of manifest.tiers) {
    expect(tier.views.length).toBeGreaterThanOrEqual(4);
    expect(tier.maxTransferBytes).toBeGreaterThan(0);
    expect(tier.maxGpuResidencyBytes).toBeGreaterThanOrEqual(tier.maxTransferBytes);

    const declaredFiles = new Set<string>();
    let transferBytes = 0;

    for (const view of tier.views) {
      expect(view.viewDirection).toHaveLength(3);
      for (const channel of ["colorOpacity", "depthOptical", "normalAoScatter"] as const) {
        const asset = view.assets[channel];
        const assetPath = path.join(process.cwd(), ASSET_ROOT, asset.file);
        expect(declaredFiles.has(asset.file)).toBe(false);
        declaredFiles.add(asset.file);
        expect(existsSync(assetPath)).toBe(true);
        if (!existsSync(assetPath)) {
          continue;
        }

        expect(statSync(assetPath).size).toBe(asset.byteLength);
        expect(sha256(assetPath)).toBe(asset.sha256);
        const decoded = await decodeRgba(assetPath);
        expect(decoded.width).toBe(asset.width);
        expect(decoded.height).toBe(asset.height);
        transferBytes += asset.byteLength;

        const red = componentRange(decoded.data, 0);
        const green = componentRange(decoded.data, 1);
        expect(red.minimum / 255).toBeGreaterThanOrEqual(manifest.channels[channel].numericRange[0]);
        expect(red.maximum / 255).toBeLessThanOrEqual(manifest.channels[channel].numericRange[1]);
        expect(green.minimum / 255).toBeGreaterThanOrEqual(manifest.channels[channel].numericRange[0]);
        expect(green.maximum / 255).toBeLessThanOrEqual(manifest.channels[channel].numericRange[1]);

        if (channel === "colorOpacity") {
          const alpha = componentRange(decoded.data, 3);
          expect(alpha.minimum).toBe(0);
          expect(alpha.maximum).toBeGreaterThan(180);
          expect(alpha.maximum - alpha.minimum).toBeGreaterThan(120);
        }
      }

      const color = await decodeRgba(path.join(process.cwd(), ASSET_ROOT, view.assets.colorOpacity.file));
      const depthOptical = await decodeRgba(path.join(process.cwd(), ASSET_ROOT, view.assets.depthOptical.file));
      let coveredPixels = 0;
      let maxDepth = 0;
      let minDepth = 1;
      let maxOpticalDepth = 0;
      let minOpticalDepth = 1;
      for (let index = 0; index < color.data.length; index += 4) {
        if (color.data[index + 3] <= 4) {
          continue;
        }
        coveredPixels += 1;
        const depth = depthOptical.data[index] / 255;
        const opticalDepth = depthOptical.data[index + 1] / 255;
        maxDepth = Math.max(maxDepth, depth);
        minDepth = Math.min(minDepth, depth);
        maxOpticalDepth = Math.max(maxOpticalDepth, opticalDepth);
        minOpticalDepth = Math.min(minOpticalDepth, opticalDepth);
      }
      expect(coveredPixels).toBeGreaterThan(color.width * color.height * 0.02);
      expect(maxDepth - minDepth).toBeGreaterThan(0.08);
      expect(maxOpticalDepth).toBeGreaterThan(0.35);
      expect(maxOpticalDepth - minOpticalDepth).toBeGreaterThan(0.12);
    }

    expect(transferBytes).toBeLessThanOrEqual(tier.maxTransferBytes);
  }
});

test("rejects incomplete and incompatible atlases instead of falling back to a flat card", async () => {
  type ManifestValidator = (input: unknown) => { reason?: string; valid: boolean };
  const modulePath = "../../packages/lubirth-hero/src/bakedCloudManifest";
  const loaded = await import(modulePath).catch(() => null) as {
    validateBakedCloudImpostorManifest?: ManifestValidator;
  } | null;
  const validate = loaded?.validateBakedCloudImpostorManifest;

  expect(validate).toBeDefined();
  if (!validate) {
    return;
  }

  expect(validate({})).toMatchObject({
    reason: "missing-required-tier:desktop",
    valid: false
  });

  const manifest = readManifest();
  if (!manifest) {
    return;
  }
  const incompatible = JSON.parse(JSON.stringify(manifest)) as BakedCloudManifest;
  delete incompatible.tiers[0].views[0].assets.depthOptical;
  expect(validate(incompatible)).toMatchObject({
    reason: "missing-channel:depthOptical",
    valid: false
  });
});
test("keeps an art-directed cloud top, underside, and attenuated interior in the baked reference", async () => {
  const manifest = readManifest();
  if (!manifest) {
    return;
  }
  const desktop = manifest.tiers.find((tier) => tier.id === "desktop");
  expect(desktop).toBeDefined();
  const reference = desktop?.views.find((view) => view.id === "close-center");
  expect(reference).toBeDefined();
  if (!reference) {
    return;
  }

  const color = await decodeRgba(path.join(process.cwd(), ASSET_ROOT, reference.assets.colorOpacity.file));
  const depthOptical = await decodeRgba(
    path.join(process.cwd(), ASSET_ROOT, reference.assets.depthOptical.file)
  );
  const normals = await decodeRgba(
    path.join(process.cwd(), ASSET_ROOT, reference.assets.normalAoScatter.file)
  );
  let topLuminance = 0;
  let topCount = 0;
  let undersideLuminance = 0;
  let undersideCount = 0;
  let covered = 0;
  let partiallyAttenuated = 0;

  for (let y = 0; y < color.height; y += 1) {
    for (let x = 0; x < color.width; x += 1) {
      const index = (y * color.width + x) * 4;
      const alpha = color.data[index + 3];
      if (alpha <= 8) {
        continue;
      }
      const luminance = color.data[index] * 0.2126 +
        color.data[index + 1] * 0.7152 +
        color.data[index + 2] * 0.0722;
      covered += 1;
      if (alpha > 20 && alpha < 220) {
        partiallyAttenuated += 1;
      }
      if (y < color.height / 3) {
        topLuminance += luminance;
        topCount += 1;
      } else if (y > (color.height * 2) / 3) {
        undersideLuminance += luminance;
        undersideCount += 1;
      }
    }
  }

  expect(topCount).toBeGreaterThan(0);
  expect(undersideCount).toBeGreaterThan(0);
  expect(topLuminance / topCount - undersideLuminance / undersideCount).toBeGreaterThan(22);
  expect(partiallyAttenuated / covered).toBeGreaterThan(0.2);
  const depth = componentRange(depthOptical.data, 0);
  const bentNormal = componentRange(normals.data, 1);
  expect(depth.maximum - depth.minimum).toBeGreaterThan(70);
  expect(bentNormal.maximum - bentNormal.minimum).toBeGreaterThan(36);
});
test("frames the close baked cloud with transparent sky above and below its sculpted mass", async () => {
  const manifest = readManifest();
  if (!manifest) {
    return;
  }
  const desktop = manifest.tiers.find((tier) => tier.id === "desktop");
  const reference = desktop?.views.find((view) => view.id === "close-center");
  expect(reference).toBeDefined();
  if (!reference) {
    return;
  }

  const color = await decodeRgba(path.join(process.cwd(), ASSET_ROOT, reference.assets.colorOpacity.file));
  const bandHeight = Math.floor(color.height * 0.08);
  const transparentRatio = (fromRow: number, toRow: number) => {
    let transparent = 0;
    let total = 0;
    for (let y = fromRow; y < toRow; y += 1) {
      for (let x = 0; x < color.width; x += 1) {
        total += 1;
        if (color.data[(y * color.width + x) * 4 + 3] <= 8) {
          transparent += 1;
        }
      }
    }
    return transparent / total;
  };

  expect(transparentRatio(0, bandHeight)).toBeGreaterThan(0.28);
  expect(transparentRatio(color.height - bandHeight, color.height)).toBeGreaterThan(0.28);
});
test("uses a sculpted crown and narrowing underside instead of a rectangular cloud wall", async () => {
  const manifest = readManifest();
  if (!manifest) {
    return;
  }
  const desktop = manifest.tiers.find((tier) => tier.id === "desktop");
  const reference = desktop?.views.find((view) => view.id === "close-center");
  expect(reference).toBeDefined();
  if (!reference) {
    return;
  }

  const color = await decodeRgba(path.join(process.cwd(), ASSET_ROOT, reference.assets.colorOpacity.file));
  const averageCoverage = (from: number, to: number) => {
    let covered = 0;
    let total = 0;
    for (let y = Math.floor(color.height * from); y < Math.floor(color.height * to); y += 1) {
      for (let x = 0; x < color.width; x += 1) {
        total += 1;
        if (color.data[(y * color.width + x) * 4 + 3] > 8) {
          covered += 1;
        }
      }
    }
    return covered / total;
  };

  const crownCoverage = averageCoverage(0.14, 0.3);
  const coreCoverage = averageCoverage(0.42, 0.58);
  const undersideCoverage = averageCoverage(0.7, 0.86);
  expect(coreCoverage).toBeGreaterThan(crownCoverage * 1.16);
  expect(coreCoverage).toBeGreaterThan(undersideCoverage * 1.22);
});
