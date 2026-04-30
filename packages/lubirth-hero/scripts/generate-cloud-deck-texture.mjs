#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const inputPath = path.join(repoRoot, "apps/site/public/assets/lubirth/textures/earth-clouds-2k-light.jpg");
const outputPath = path.join(repoRoot, "apps/site/public/assets/lubirth/textures/earth-cloud-deck-2k.png");

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}

function wrapX(x, width) {
  return ((x % width) + width) % width;
}

function clampY(y, height) {
  return Math.min(height - 1, Math.max(0, y));
}

function sample(source, width, height, x, y) {
  return source[clampY(y, height) * width + wrapX(x, width)];
}

function boxBlur(source, width, height, radiusX, radiusY) {
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const horizontalWindow = radiusX * 2 + 1;
  const verticalWindow = radiusY * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let offset = -radiusX; offset <= radiusX; offset += 1) {
        sum += sample(source, width, height, x + offset, y);
      }
      horizontal[y * width + x] = sum / horizontalWindow;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let offset = -radiusY; offset <= radiusY; offset += 1) {
        sum += sample(horizontal, width, height, x, y + offset);
      }
      output[y * width + x] = sum / verticalWindow;
    }
  }

  return output;
}

function byte(value) {
  return Math.round(clamp01(value) * 255);
}

const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const pixelCount = width * height;
const coverage = new Float32Array(pixelCount);

for (let index = 0; index < pixelCount; index += 1) {
  const sourceIndex = index * channels;
  const r = data[sourceIndex] / 255;
  const g = data[sourceIndex + 1] / 255;
  const b = data[sourceIndex + 2] / 255;
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  coverage[index] = Math.pow(smoothstep(0.16, 0.58, luminance), 1.05);
}

const smallBlur = boxBlur(coverage, width, height, 3, 2);
const mediumBlur = boxBlur(coverage, width, height, 10, 6);
const largeBlur = boxBlur(coverage, width, height, 22, 12);
const output = Buffer.alloc(pixelCount * 4);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    const left = sample(smallBlur, width, height, x - 1, y);
    const right = sample(smallBlur, width, height, x + 1, y);
    const up = sample(smallBlur, width, height, x, y - 1);
    const down = sample(smallBlur, width, height, x, y + 1);
    const edge = clamp01(Math.hypot(right - left, down - up) * 3.4);
    const expanded = largeBlur[index] * 0.86 + mediumBlur[index] * 0.34 + coverage[index] * 0.18;
    const thickness = clamp01(smoothstep(0.08, 0.72, expanded) * (0.68 + coverage[index] * 0.38) - edge * 0.16);
    const offsetShadow = sample(mediumBlur, width, height, x - 18, y + 7);
    const ambientOcclusion = clamp01(
      smoothstep(0.08, 0.7, offsetShadow * 0.72 + largeBlur[index] * 0.24) * (0.52 + thickness * 0.48)
    );
    const highCore = smoothstep(0.38, 0.82, coverage[index]);
    const brightCap = clamp01(
      Math.pow(smoothstep(0.26, 0.78, smallBlur[index]) * highCore, 0.82) * (1 - edge * 0.28)
    );
    const target = index * 4;

    output[target] = byte(coverage[index]);
    output[target + 1] = byte(thickness);
    output[target + 2] = byte(ambientOcclusion);
    output[target + 3] = byte(brightCap);
  }
}

await mkdir(path.dirname(outputPath), { recursive: true });
await sharp(output, {
  raw: {
    width,
    height,
    channels: 4
  }
})
  .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false, effort: 10 })
  .toFile(outputPath);

console.log(`Generated ${path.relative(repoRoot, outputPath)} from ${path.relative(repoRoot, inputPath)}`);
