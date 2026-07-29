#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../../..");
const assetRoot = path.join(repoRoot, "apps/site/public/assets/lubirth/cloud-impostor");

const SEED = 709183;
const VOLUME_RESOLUTION = [192, 128, 128];
const WORLD_UP = [0, 1, 0];
const SUN_DIRECTION = normalize([-0.42, 0.73, 0.54]);
const CHANNEL_NAMES = ["colorOpacity", "depthOptical", "normalAoScatter"];

const DESKTOP_TIER = {
  id: "desktop",
  maxTransferBytes: 12_000_000,
  maxGpuResidencyBytes: 20_000_000,
  raySteps: 38,
  size: 448,
  views: [
    { id: "close-west", viewDirection: normalize([-0.42, 0.2, 0.88]) },
    { id: "close-center", viewDirection: normalize([-0.12, 0.17, 0.98]) },
    { id: "close-east", viewDirection: normalize([0.24, 0.22, 0.94]) },
    { id: "pullback-center", viewDirection: normalize([0.04, 0.35, 0.94]) },
    { id: "pullback-east", viewDirection: normalize([0.38, 0.31, 0.87]) }
  ]
};

const MOBILE_TIER = {
  id: "mobile",
  maxTransferBytes: 3_000_000,
  maxGpuResidencyBytes: 4_000_000,
  raySteps: 28,
  size: 256,
  views: [
    { id: "close-west", viewDirection: normalize([-0.38, 0.21, 0.9]) },
    { id: "close-center", viewDirection: normalize([-0.08, 0.2, 0.98]) },
    { id: "pullback-center", viewDirection: normalize([0.08, 0.34, 0.94]) },
    { id: "pullback-east", viewDirection: normalize([0.36, 0.3, 0.88]) }
  ]
};

const ART_DIRECTION_PARAMETERS = {
  anvilLift: 0.24,
  densityGain: 1.36,
  macroWarp: 0.18,
  noiseGrids: [
    [30, 20, 30],
    [56, 36, 56],
    [96, 64, 96]
  ],
  rayLength: 3.2,
  source: "internally-authored-procedural-weather-front",
  verticalCompression: 0.78
};

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function length(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const magnitude = Math.max(length(vector), 1e-6);
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(vector, amount) {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function hashUnit(index, seed) {
  let value = (index ^ seed) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2246822519);
  value = Math.imul(value ^ (value >>> 13), 3266489917);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function createNoiseGrid(width, height, depth, seed) {
  const data = new Float32Array(width * height * depth);
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (z * height + y) * width + x;
        data[index] = hashUnit(index + z * 7919 + y * 104729, seed);
      }
    }
  }
  return { data, depth, height, width };
}

function sampleNoiseGrid(grid, u, v, w) {
  const x = clamp(u) * (grid.width - 1);
  const y = clamp(v) * (grid.height - 1);
  const z = clamp(w) * (grid.depth - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const x1 = Math.min(grid.width - 1, x0 + 1);
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const z1 = Math.min(grid.depth - 1, z0 + 1);
  const tx = smoothstep(0, 1, x - x0);
  const ty = smoothstep(0, 1, y - y0);
  const tz = smoothstep(0, 1, z - z0);
  const read = (xx, yy, zz) => grid.data[(zz * grid.height + yy) * grid.width + xx];
  const x00 = mix(read(x0, y0, z0), read(x1, y0, z0), tx);
  const x10 = mix(read(x0, y1, z0), read(x1, y1, z0), tx);
  const x01 = mix(read(x0, y0, z1), read(x1, y0, z1), tx);
  const x11 = mix(read(x0, y1, z1), read(x1, y1, z1), tx);
  return mix(mix(x00, x10, ty), mix(x01, x11, ty), tz);
}

function createSourceVolume() {
  const [width, height, depth] = VOLUME_RESOLUTION;
  const macro = createNoiseGrid(30, 20, 30, SEED + 17);
  const meso = createNoiseGrid(56, 36, 56, SEED + 71);
  const detail = createNoiseGrid(96, 64, 96, SEED + 191);
  const data = new Float32Array(width * height * depth);

  for (let z = 0; z < depth; z += 1) {
    const normalizedZ = (z / (depth - 1)) * 2 - 1;
    for (let y = 0; y < height; y += 1) {
      const normalizedY = (y / (height - 1)) * 2 - 1;
      for (let x = 0; x < width; x += 1) {
        const normalizedX = (x / (width - 1)) * 2 - 1;
        const flow = Math.sin(normalizedZ * 3.1 + normalizedY * 1.4) * 0.11;
        const warpedX = normalizedX + flow;
        const warpedZ = normalizedZ + Math.sin(normalizedX * 2.6 - normalizedY * 1.7) * 0.09;
        const u = (warpedX + 1) * 0.5;
        const v = (normalizedY + 1) * 0.5;
        const w = (warpedZ + 1) * 0.5;
        const broad = sampleNoiseGrid(macro, u, v, w);
        const folded = sampleNoiseGrid(meso, u * 0.96 + broad * 0.04, v, w);
        const fine = sampleNoiseGrid(detail, u, v, w);
        const verticalSpread = 0.46 +
          smoothstep(-0.78, -0.08, normalizedY) * 0.5 -
          smoothstep(0.16, 0.78, normalizedY) * 0.36;
        const horizontalRadius = Math.sqrt(
          Math.pow(warpedX / (0.94 * verticalSpread), 2) +
          Math.pow(warpedZ / (0.78 * verticalSpread), 2)
        );
        const horizontalBody = 1 - smoothstep(0.43, 0.98, horizontalRadius);
        const lowerDeck = smoothstep(-0.88, -0.56, normalizedY);
        const upperCap = 1 - smoothstep(0.3, 0.86, normalizedY);
        const crown = (1 - smoothstep(0.42, 1.04, horizontalRadius)) *
          smoothstep(0.2, 0.74, normalizedY) *
          smoothstep(0.62, 0.9, broad) *
          0.19;
        const tower = smoothstep(0.45, 0.9, broad) *
          smoothstep(-0.18, 0.78, normalizedY) *
          (1 - smoothstep(0.76, 1.04, horizontalRadius)) *
          0.28;
        const weather = broad * 0.52 + folded * 0.34 + fine * 0.14;
        const carved = smoothstep(0.27, 0.84, weather) - smoothstep(0.75, 0.97, fine) * 0.18;
        const density = (horizontalBody * lowerDeck * upperCap + crown + tower) *
          clamp(carved * 1.55 - 0.32);
        data[(z * height + y) * width + x] = clamp(density);
      }
    }
  }

  return { data, depth, height, width };
}

function sampleVolume(volume, x, y, z) {
  if (x < -1 || x > 1 || y < -1 || y > 1 || z < -1 || z > 1) {
    return 0;
  }
  const fx = ((x + 1) * 0.5) * (volume.width - 1);
  const fy = ((y + 1) * 0.5) * (volume.height - 1);
  const fz = ((z + 1) * 0.5) * (volume.depth - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const z0 = Math.floor(fz);
  const x1 = Math.min(volume.width - 1, x0 + 1);
  const y1 = Math.min(volume.height - 1, y0 + 1);
  const z1 = Math.min(volume.depth - 1, z0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const tz = fz - z0;
  const read = (xx, yy, zz) => volume.data[(zz * volume.height + yy) * volume.width + xx];
  const x00 = mix(read(x0, y0, z0), read(x1, y0, z0), tx);
  const x10 = mix(read(x0, y1, z0), read(x1, y1, z0), tx);
  const x01 = mix(read(x0, y0, z1), read(x1, y0, z1), tx);
  const x11 = mix(read(x0, y1, z1), read(x1, y1, z1), tx);
  return mix(mix(x00, x10, ty), mix(x01, x11, ty), tz);
}

function sampleNormal(volume, point) {
  const offset = 0.026;
  const gradient = [
    sampleVolume(volume, point[0] - offset, point[1], point[2]) -
      sampleVolume(volume, point[0] + offset, point[1], point[2]),
    sampleVolume(volume, point[0], point[1] - offset, point[2]) -
      sampleVolume(volume, point[0], point[1] + offset, point[2]),
    sampleVolume(volume, point[0], point[1], point[2] - offset) -
      sampleVolume(volume, point[0], point[1], point[2] + offset)
  ];
  const gradientLength = length(gradient);
  return gradientLength < 0.001 ? [0, 1, 0] : normalize(gradient);
}

function linearToSrgb(value) {
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

function byte(value) {
  return Math.round(clamp(value) * 255);
}

function bakeView(volume, tier, view) {
  const width = tier.size;
  const height = tier.size;
  const colorOpacity = new Uint8Array(width * height * 4);
  const depthOptical = new Uint8Array(width * height * 4);
  const normalAoScatter = new Uint8Array(width * height * 4);
  const cameraDirection = view.viewDirection;
  const right = normalize(cross(WORLD_UP, cameraDirection));
  const up = normalize(cross(cameraDirection, right));
  const rayDirection = scale(cameraDirection, -1);
  const rayLength = ART_DIRECTION_PARAMETERS.rayLength;
  const stepLength = rayLength / tier.raySteps;
  const planeWidth = 3.02;
  const planeHeight = 2.18;

  for (let y = 0; y < height; y += 1) {
    const v = ((y + 0.5) / height - 0.5) * planeHeight;
    for (let x = 0; x < width; x += 1) {
      const u = ((x + 0.5) / width - 0.5) * planeWidth;
      const cameraPoint = add(
        add(scale(cameraDirection, 1.58), scale(right, u)),
        scale(up, -v)
      );
      let transmittance = 1;
      let opticalDepth = 0;
      let frontDepth = 0;
      let scatter = 0;
      let peakDensity = 0;
      let peakPoint = [0, 0, 0];

      for (let step = 0; step < tier.raySteps; step += 1) {
        const travel = (step + 0.5) * stepLength;
        const point = add(cameraPoint, scale(rayDirection, travel));
        const density = sampleVolume(volume, point[0], point[1], point[2]);
        if (density <= 0.001) {
          continue;
        }
        if (frontDepth === 0 && density > 0.035) {
          frontDepth = travel / rayLength;
        }
        if (density > peakDensity) {
          peakDensity = density;
          peakPoint = point;
        }
        const verticalLight = clamp((point[1] + 1.1) / 2.2);
        const forwardLight = 0.38 + 0.62 * clamp(dot(scale(rayDirection, -1), SUN_DIRECTION) * 0.5 + 0.5);
        const localLight = 0.26 + verticalLight * 0.56 + forwardLight * 0.18;
        scatter += transmittance * density * localLight * stepLength;
        opticalDepth += density * stepLength * 2.85;
        transmittance *= Math.exp(-density * stepLength * 2.85);
      }

      const index = (y * width + x) * 4;
      const alpha = 1 - transmittance;
      if (alpha <= 0.002 || peakDensity <= 0.001) {
        continue;
      }

      const normal = sampleNormal(volume, peakPoint);
      const topLight = clamp(dot(normal, SUN_DIRECTION) * 0.5 + 0.5);
      const diffuse = 0.32 + topLight * 0.68;
      const colourScale = scatter / Math.max(alpha, 0.001);
      colorOpacity[index] = byte(linearToSrgb(colourScale * (0.67 + diffuse * 0.33)));
      colorOpacity[index + 1] = byte(linearToSrgb(colourScale * (0.74 + diffuse * 0.26)));
      colorOpacity[index + 2] = byte(linearToSrgb(colourScale * (0.86 + diffuse * 0.14)));
      colorOpacity[index + 3] = byte(alpha);

      depthOptical[index] = byte(frontDepth);
      depthOptical[index + 1] = byte(opticalDepth / 3.4);
      depthOptical[index + 2] = byte(peakDensity);
      depthOptical[index + 3] = byte(alpha);

      normalAoScatter[index] = byte(normal[0] * 0.5 + 0.5);
      normalAoScatter[index + 1] = byte(normal[1] * 0.5 + 0.5);
      normalAoScatter[index + 2] = byte(1 - Math.exp(-opticalDepth * 0.42));
      normalAoScatter[index + 3] = byte(scatter * 1.8);
    }
  }

  return { colorOpacity, depthOptical, height, normalAoScatter, width };
}

async function writePng(filePath, pixels, width, height) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await sharp(pixels, { raw: { channels: 4, height, width } })
    .png({ adaptiveFiltering: true, compressionLevel: 9 })
    .toFile(filePath);
}

async function describeAsset(filePath, width, height) {
  const output = await readFile(filePath);
  const fileStats = await stat(filePath);
  return {
    byteLength: fileStats.size,
    file: path.relative(assetRoot, filePath).split(path.sep).join("/"),
    height,
    sha256: createHash("sha256").update(output).digest("hex"),
    width
  };
}

async function writeTier(volume, tier) {
  const views = [];
  let transferBytes = 0;

  for (const view of tier.views) {
    const baked = bakeView(volume, tier, view);
    const baseName = path.join(assetRoot, tier.id, view.id);
    const outputPaths = {
      colorOpacity: baseName + "-color-opacity.png",
      depthOptical: baseName + "-depth-optical.png",
      normalAoScatter: baseName + "-normal-ao-scatter.png"
    };
    await writePng(outputPaths.colorOpacity, baked.colorOpacity, baked.width, baked.height);
    await writePng(outputPaths.depthOptical, baked.depthOptical, baked.width, baked.height);
    await writePng(outputPaths.normalAoScatter, baked.normalAoScatter, baked.width, baked.height);

    const assets = {};
    for (const channel of CHANNEL_NAMES) {
      assets[channel] = await describeAsset(outputPaths[channel], baked.width, baked.height);
      transferBytes += assets[channel].byteLength;
    }
    views.push({
      assets,
      id: view.id,
      viewDirection: view.viewDirection.map((component) => Number(component.toFixed(6)))
    });
  }

  if (transferBytes > tier.maxTransferBytes) {
    throw new Error(
      tier.id + " baked transfer is " + transferBytes + " bytes; budget is " + tier.maxTransferBytes + " bytes."
    );
  }

  return {
    id: tier.id,
    maxGpuResidencyBytes: tier.maxGpuResidencyBytes,
    maxTransferBytes: tier.maxTransferBytes,
    views
  };
}

function assetDigest(tiers) {
  const entries = [];
  for (const tier of tiers) {
    for (const view of tier.views) {
      for (const channel of CHANNEL_NAMES) {
        const asset = view.assets[channel];
        entries.push({ file: asset.file, sha256: asset.sha256 });
      }
    }
  }
  entries.sort((a, b) => a.file.localeCompare(b.file));
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

const volume = createSourceVolume();
const sourceSha256 = createHash("sha256")
  .update(Buffer.from(volume.data.buffer, volume.data.byteOffset, volume.data.byteLength))
  .digest("hex");
const sourceScriptSha256 = createHash("sha256").update(await readFile(scriptPath)).digest("hex");

await mkdir(assetRoot, { recursive: true });
const tiers = [
  await writeTier(volume, DESKTOP_TIER),
  await writeTier(volume, MOBILE_TIER)
];
const manifest = {
  candidate: "lubirth-offline-baked-cloud-impostor-v1",
  channels: {
    colorOpacity: {
      meaning: {
        a: "cloud-opacity",
        b: "linear-srgb-blue",
        g: "linear-srgb-green",
        r: "linear-srgb-red"
      },
      numericRange: [0, 1]
    },
    depthOptical: {
      meaning: {
        a: "coverage",
        b: "peak-density",
        g: "optical-depth-normalized",
        r: "front-depth-normalized"
      },
      numericRange: [0, 1]
    },
    normalAoScatter: {
      meaning: {
        a: "single-scatter-normalized",
        b: "ambient-occlusion",
        g: "bent-normal-y",
        r: "bent-normal-x"
      },
      numericRange: [0, 1]
    }
  },
  farFootprint: {
    field: "earth-cloud-field-nasa-lite-2k.png",
    sharedDriftBinding: "landing-lighting-frame-cloud-offset",
    terrainAttachment: "earth-local",
    UVFootprint: [0.704, 0.412, 0.782, 0.486]
  },
  generator: {
    parameterSummary: ART_DIRECTION_PARAMETERS,
    seed: SEED,
    sourceScenePath: "packages/lubirth-hero/scripts/prepare-baked-cloud-impostor.mjs",
    tool: "miralith-internal-procedural-volume-baker",
    version: "1.0.0"
  },
  license: "internally-generated",
  output: {
    assetAtlasSha256: assetDigest(tiers),
    outputChannels: CHANNEL_NAMES
  },
  provenance: "internal-procedural",
  schemaVersion: 1,
  source: {
    kind: "high-resolution-internal-procedural-volume",
    parameterSha256: createHash("sha256").update(JSON.stringify(ART_DIRECTION_PARAMETERS)).digest("hex"),
    resolution: VOLUME_RESOLUTION,
    scriptSha256: sourceScriptSha256,
    sha256: sourceSha256
  },
  tiers
};

await writeFile(path.join(assetRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(
  "Generated " + tiers.reduce((total, tier) => total + tier.views.length, 0) +
  " deep-impostor views at " + path.relative(repoRoot, assetRoot)
);
