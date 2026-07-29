#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const inputPath = path.join(
  repositoryRoot,
  "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png"
);
const outputPath = path.join(
  repositoryRoot,
  "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-v3-phase12-patch-truth.bin"
);

// This is the immutable Phase -1/1.2 inspection patch. It intentionally
// retains its native 2K source texels instead of being sampled from the small
// 512×256 global CPU-truth atlas: the latter reduced this patch to 35×33
// pixels and made a local volume incapable of showing real V3 breakup.
const sourceUvBounds = {
  u0: 370 / 512,
  u1: 405 / 512,
  v0: 105 / 256,
  v1: 138 / 256
};

function downsampleRgbaMean(source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const target = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor(y * sourceHeight / targetHeight);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sourceHeight / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor(x * sourceWidth / targetWidth);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sourceWidth / targetWidth));
      const sum = [0, 0, 0, 0];
      let count = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const offset = (yy * sourceWidth + xx) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            sum[channel] += source[offset + channel];
          }
          count += 1;
        }
      }
      const targetOffset = (y * targetWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        target[targetOffset + channel] = Math.round(sum[channel] / Math.max(count, 1));
      }
    }
  }
  return target;
}

function buildMinMaxLevel(source, sourceWidth, sourceHeight) {
  const width = Math.max(1, Math.floor(sourceWidth / 2));
  const height = Math.max(1, Math.floor(sourceHeight / 2));
  const data = new Uint8Array(width * height * 8);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const minimum = [255, 255, 255, 255];
      const maximum = [0, 0, 0, 0];
      for (let yy = 0; yy < 2; yy += 1) {
        for (let xx = 0; xx < 2; xx += 1) {
          const sourceX = Math.min(sourceWidth - 1, x * 2 + xx);
          const sourceY = Math.min(sourceHeight - 1, y * 2 + yy);
          const offset = (sourceY * sourceWidth + sourceX) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            minimum[channel] = Math.min(minimum[channel], source[offset + channel]);
            maximum[channel] = Math.max(maximum[channel], source[offset + channel]);
          }
        }
      }
      const targetOffset = (y * width + x) * 8;
      for (let channel = 0; channel < 4; channel += 1) {
        data[targetOffset + channel] = minimum[channel];
        data[targetOffset + 4 + channel] = maximum[channel];
      }
    }
  }
  return { data, height, width };
}

function buildPatchTruth(source, width, height, sourceSha256, sourceResolution) {
  const levels = [];
  const payloads = [];
  let rgba = source;
  let levelWidth = width;
  let levelHeight = height;
  while (true) {
    const minMax = buildMinMaxLevel(rgba, levelWidth, levelHeight);
    levels.push({
      height: levelHeight,
      minMaxLength: minMax.data.byteLength,
      minMaxOffset: 0,
      rgbaLength: rgba.byteLength,
      rgbaOffset: 0,
      width: levelWidth
    });
    payloads.push(rgba, minMax.data);
    if (levelWidth === 1 && levelHeight === 1) {
      break;
    }
    rgba = downsampleRgbaMean(
      rgba,
      levelWidth,
      levelHeight,
      Math.max(1, Math.floor(levelWidth / 2)),
      Math.max(1, Math.floor(levelHeight / 2))
    );
    levelWidth = Math.max(1, Math.floor(levelWidth / 2));
    levelHeight = Math.max(1, Math.floor(levelHeight / 2));
  }

  let payloadOffset = 0;
  for (const level of levels) {
    level.rgbaOffset = payloadOffset;
    payloadOffset += level.rgbaLength;
    level.minMaxOffset = payloadOffset;
    payloadOffset += level.minMaxLength;
  }
  const payload = Buffer.concat(payloads.map((value) => Buffer.from(value)));
  const template = {
    byteLength: 0,
    generatorVersion: "home-cloud-field-v3-phase12-native-patch-truth-1",
    height,
    layoutId: "v3-r-depth-g-height-b-morphology-a-concavity",
    levelCount: levels.length,
    levels,
    magic: "MLHC",
    orientation: "equirect-u-repeat-v-clamp-north-up",
    sourceResolution,
    sourceSha256,
    sourceUvBounds: [sourceUvBounds.u0, sourceUvBounds.v0, sourceUvBounds.u1, sourceUvBounds.v1],
    version: 1,
    width
  };
  let header = template;
  let encoded = Buffer.from(JSON.stringify(header));
  while (true) {
    const next = { ...template, byteLength: 4 + encoded.byteLength + payload.byteLength };
    const nextEncoded = Buffer.from(JSON.stringify(next));
    if (nextEncoded.byteLength === encoded.byteLength) {
      header = next;
      encoded = nextEncoded;
      break;
    }
    header = next;
    encoded = nextEncoded;
  }
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(encoded.byteLength, 0);
  return Buffer.concat([prefix, encoded, payload]);
}

const input = await readFile(inputPath);
const sourceSha256 = createHash("sha256").update(input).digest("hex");
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.channels !== 4) {
  throw new Error(`Expected RGBA packed V3 input, received ${info.channels} channels.`);
}
const sourceX0 = Math.floor(info.width * sourceUvBounds.u0);
const sourceY0 = Math.floor(info.height * sourceUvBounds.v0);
const sourceX1 = Math.ceil(info.width * sourceUvBounds.u1);
const sourceY1 = Math.ceil(info.height * sourceUvBounds.v1);
const width = sourceX1 - sourceX0;
const height = sourceY1 - sourceY0;
const patch = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y += 1) {
  const sourceOffset = ((sourceY0 + y) * info.width + sourceX0) * 4;
  patch.set(data.subarray(sourceOffset, sourceOffset + width * 4), y * width * 4);
}
const output = buildPatchTruth(patch, width, height, sourceSha256, [info.width, info.height]);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
console.log(JSON.stringify({
  output: path.relative(repositoryRoot, outputPath),
  byteLength: output.byteLength,
  sourceResolution: [info.width, info.height],
  patchResolution: [width, height],
  sourceSha256,
  sourceUvBounds: [sourceUvBounds.u0, sourceUvBounds.v0, sourceUvBounds.u1, sourceUvBounds.v1]
}, null, 2));
