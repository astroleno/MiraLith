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
  coverage[index] = Math.pow(smoothstep(0.24, 0.72, luminance), 1.42);
}

const smallBlur = boxBlur(coverage, width, height, 3, 2);
const mediumBlur = boxBlur(coverage, width, height, 10, 6);
const largeBlur = boxBlur(coverage, width, height, 22, 12);
const synopticBlur = boxBlur(coverage, width, height, 40, 22);
const regionalBlur = boxBlur(coverage, width, height, 72, 36);
const output = Buffer.alloc(pixelCount * 4);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    const left = sample(smallBlur, width, height, x - 1, y);
    const right = sample(smallBlur, width, height, x + 1, y);
    const up = sample(smallBlur, width, height, x, y - 1);
    const down = sample(smallBlur, width, height, x, y + 1);
    const synopticLeft = sample(synopticBlur, width, height, x - 6, y);
    const synopticRight = sample(synopticBlur, width, height, x + 6, y);
    const synopticUp = sample(synopticBlur, width, height, x, y - 4);
    const synopticDown = sample(synopticBlur, width, height, x, y + 4);
    const edge = clamp01(Math.hypot(right - left, down - up) * 3.4);
    const synopticEdge = clamp01(Math.hypot(synopticRight - synopticLeft, synopticDown - synopticUp) * 4.8);
    const denseCore = smoothstep(0.36, 0.78, coverage[index] * 0.72 + smallBlur[index] * 0.22 + mediumBlur[index] * 0.08);
    const weatherCore = smoothstep(
      0.24,
      0.68,
      regionalBlur[index] * 0.38 + synopticBlur[index] * 0.28 + largeBlur[index] * 0.18 + mediumBlur[index] * 0.08
    );
    const expanded =
      denseCore * 0.68 +
      coverage[index] * 0.24 +
      mediumBlur[index] * 0.12 +
      weatherCore * 0.12 +
      edge * 0.08;
    const thickness = clamp01(
      smoothstep(0.28, 0.82, expanded) * (0.48 + denseCore * 0.42 + coverage[index] * 0.22) -
      edge * 0.05
    );
    const offsetShadow = sample(synopticBlur, width, height, x - 24, y + 10);
    const ambientOcclusion = clamp01(
      smoothstep(0.22, 0.72, offsetShadow * 0.5 + denseCore * 0.36 + weatherCore * 0.16 + largeBlur[index] * 0.12) *
      (0.34 + thickness * 0.66)
    );
    const highCore = smoothstep(0.38, 0.86, coverage[index] * 0.78 + smallBlur[index] * 0.24 + synopticEdge * 0.1);
    const brightCap = clamp01(
      Math.pow(smoothstep(0.34, 0.84, smallBlur[index] * 0.74 + denseCore * 0.18 + synopticEdge * 0.12) * highCore, 0.92) *
      (1 - edge * 0.2)
    );
    const synopticCoverage = clamp01(coverage[index] * 0.86 + denseCore * 0.12 + mediumBlur[index] * 0.04);
    const target = index * 4;

    output[target] = byte(synopticCoverage);
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
