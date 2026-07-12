#!/usr/bin/env node

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const width = 1536;
const height = 768;
const maxBytes = 650_000;

function resolveRepoPath(value, fallback) {
  return value ? path.resolve(repoRoot, value) : fallback;
}

const inputPath = resolveRepoPath(
  process.env.LUBIRTH_HOME_CLOUD_INPUT,
  path.join(repoRoot, "apps/site/public/assets/lubirth/textures/earth-clouds-2k-light.jpg")
);
const outputPath = resolveRepoPath(
  process.env.LUBIRTH_HOME_CLOUD_OUTPUT,
  path.join(repoRoot, "apps/site/public/assets/lubirth/textures/earth-cloud-field-home.webp")
);

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const mix = (a, b, amount) => a + (b - a) * amount;

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}

function wrapX(x) {
  return ((x % width) + width) % width;
}

function clampY(y) {
  return Math.min(height - 1, Math.max(0, y));
}

function sample(source, x, y) {
  return source[clampY(y) * width + wrapX(x)];
}

function boxBlur(source, radiusX, radiusY) {
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const horizontalWindow = radiusX * 2 + 1;
  const verticalWindow = radiusY * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let offset = -radiusX; offset <= radiusX; offset += 1) {
      sum += source[row + wrapX(offset)];
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = sum / horizontalWindow;
      sum -= source[row + wrapX(x - radiusX)];
      sum += source[row + wrapX(x + radiusX + 1)];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let offset = -radiusY; offset <= radiusY; offset += 1) {
      sum += horizontal[clampY(offset) * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / verticalWindow;
      sum -= horizontal[clampY(y - radiusY) * width + x];
      sum += horizontal[clampY(y + radiusY + 1) * width + x];
    }
  }

  return output;
}

function repairLongitudeSeam(source, featherWidth = 64, plateauWidth = 16) {
  for (let y = 0; y < height; y += 1) {
    let common = 0;
    for (let distance = 0; distance < plateauWidth; distance += 1) {
      common += source[y * width + distance];
      common += source[y * width + width - 1 - distance];
    }
    common /= plateauWidth * 2;

    for (let distance = 0; distance < featherWidth; distance += 1) {
      const leftIndex = y * width + distance;
      const rightIndex = y * width + width - 1 - distance;
      const weight = 1 - smoothstep(plateauWidth, featherWidth, distance);
      source[leftIndex] = mix(source[leftIndex], common, weight);
      source[rightIndex] = mix(source[rightIndex], common, weight);
    }
  }
}

function byte(value) {
  return Math.round(clamp01(value) * 255);
}

const { data, info } = await sharp(inputPath)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const coverage = new Float32Array(width * height);
for (let index = 0; index < coverage.length; index += 1) {
  const sourceIndex = index * info.channels;
  const luminance =
    (data[sourceIndex] / 255) * 0.2126 +
    (data[sourceIndex + 1] / 255) * 0.7152 +
    (data[sourceIndex + 2] / 255) * 0.0722;
  coverage[index] = Math.pow(smoothstep(0.2, 0.76, luminance), 1.18);
}

repairLongitudeSeam(coverage);

const detail = boxBlur(coverage, 2, 2);
const shape = boxBlur(coverage, 7, 4);
const body = boxBlur(coverage, 20, 11);
const weather = boxBlur(coverage, 48, 24);
const output = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    const packedCoverage = clamp01(
      smoothstep(0.12, 0.9, coverage[index] * 0.66 + shape[index] * 0.24 + body[index] * 0.1)
    );
    const thickness = clamp01(
      smoothstep(0.16, 0.82, detail[index] * 0.42 + shape[index] * 0.34 + body[index] * 0.24)
    );
    const ambientOcclusion = smoothstep(
      0.18,
      0.74,
      body[index] * 0.54 + weather[index] * 0.28 + thickness * 0.18
    );
    const packedThickness = clamp01(thickness * (1 - ambientOcclusion * 0.18));

    const gradientX = sample(shape, x + 1, y) - sample(shape, x - 1, y);
    const gradientY = sample(shape, x, y + 1) - sample(shape, x, y - 1);
    let normalX = -gradientX * 4.6;
    let normalY = gradientY * 4.6;
    const tangentLength = Math.hypot(normalX, normalY);
    if (tangentLength > 0.88) {
      normalX *= 0.88 / tangentLength;
      normalY *= 0.88 / tangentLength;
    }

    const target = index * 4;
    output[target] = byte(packedCoverage);
    output[target + 1] = byte(normalX * 0.5 + 0.5);
    output[target + 2] = byte(normalY * 0.5 + 0.5);
    output[target + 3] = byte(packedThickness);
  }
}

await mkdir(path.dirname(outputPath), { recursive: true });
await sharp(output, { raw: { width, height, channels: 4 } })
  .webp({ alphaQuality: 86, effort: 6, quality: 82, smartSubsample: false })
  .toFile(outputPath);

const outputStats = await stat(outputPath);
if (outputStats.size > maxBytes) {
  throw new Error(`Packed cloud field is ${outputStats.size} bytes; budget is ${maxBytes} bytes.`);
}

console.log(
  `Generated ${path.relative(repoRoot, outputPath)} (${width}x${height}, ${outputStats.size} bytes) from ${path.relative(repoRoot, inputPath)}`
);
