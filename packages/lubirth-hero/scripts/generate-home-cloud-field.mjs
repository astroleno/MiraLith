#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import cloudAssetBudgets from "../src/landingCloudAssetBudgets.json" with { type: "json" };

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const profile = process.env.LUBIRTH_HOME_CLOUD_PROFILE === "nasa-lite" ? "nasa-lite" : "home";
const width = Number.parseInt(
  process.env.LUBIRTH_HOME_CLOUD_WIDTH ?? (profile === "nasa-lite" ? "2048" : "1024"),
  10
);
const height = Number.parseInt(process.env.LUBIRTH_HOME_CLOUD_HEIGHT ?? String(width / 2), 10);
const maxBytes = Number.parseInt(
  process.env.LUBIRTH_HOME_CLOUD_MAX_BYTES ?? String(
    profile === "nasa-lite"
      ? cloudAssetBudgets.cloudFieldNasaLitePng
      : cloudAssetBudgets.cloudFieldHomePng
  ),
  10
);
const ktx2MaxBytes = Number.parseInt(
  process.env.LUBIRTH_HOME_CLOUD_KTX2_MAX_BYTES ??
    String(cloudAssetBudgets.cloudFieldReliefLiteKtx2),
  10
);
const cpuTruthMaxBytes = Number.parseInt(
  process.env.LUBIRTH_HOME_CLOUD_CPU_TRUTH_MAX_BYTES ??
    String(cloudAssetBudgets.cloudFieldCpuTruthBin),
  10
);
const spatialScale = width / 1024;

function resolveRepoPath(value, fallback) {
  return value ? path.resolve(repoRoot, value) : fallback;
}

const inputPath = resolveRepoPath(
  process.env.LUBIRTH_HOME_CLOUD_INPUT,
  path.join(repoRoot, "apps/site/public/assets/lubirth/textures/earth-clouds-2k-light.jpg")
);
const outputPath = resolveRepoPath(
  process.env.LUBIRTH_HOME_CLOUD_OUTPUT,
  path.join(
    repoRoot,
    "apps/site/public/assets/lubirth/textures",
    profile === "nasa-lite" ? "earth-cloud-field-nasa-lite-2k.png" : "earth-cloud-field-home.png"
  )
);
const ktx2OutputPath = resolveRepoPath(
  process.env.LUBIRTH_HOME_CLOUD_KTX2_OUTPUT,
  path.join(
    repoRoot,
    "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.ktx2"
  )
);
const cpuTruthOutputPath = resolveRepoPath(
  process.env.LUBIRTH_HOME_CLOUD_CPU_TRUTH_OUTPUT,
  path.join(
    repoRoot,
    "apps/site/public/assets/lubirth/textures",
    profile === "nasa-lite"
      ? "earth-cloud-field-nasa-lite-v3-cpu-truth.bin"
      : "earth-cloud-field-home-v3-cpu-truth.bin"
  )
);
const generateKtx2 =
  profile === "nasa-lite" && process.env.LUBIRTH_HOME_CLOUD_KTX2 !== "off";
const fastPng = process.env.LUBIRTH_HOME_CLOUD_FAST === "1";
const debugTiming = process.env.LUBIRTH_HOME_CLOUD_DEBUG === "1";
const mark = (label) => {
  if (debugTiming) {
    console.log(`[cloud-field] ${label}`);
  }
};
const basisPublicDir = path.join(
  repoRoot,
  "apps/site/public/assets/three/basis"
);

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
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

function repairLongitudeSeam(
  source,
  featherWidth = Math.round(14 * spatialScale)
) {
  for (let y = 0; y < height; y += 1) {
    for (let distance = 0; distance < featherWidth; distance += 1) {
      const leftIndex = y * width + distance;
      const rightIndex = y * width + width - 1 - distance;
      const leftOriginal = source[leftIndex];
      const rightOriginal = source[rightIndex];
      const crossLeft = source[y * width + width - 1 - distance];
      const crossRight = source[y * width + distance];
      const weight = (1 - smoothstep(0, featherWidth, distance)) * 0.48;
      source[leftIndex] = mix(leftOriginal, crossLeft, weight);
      source[rightIndex] = mix(rightOriginal, crossRight, weight);
    }
  }
}

function downsampleRgbaNearestMean(source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const target = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor((y * sourceHeight) / targetHeight);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sourceHeight) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor((x * sourceWidth) / targetWidth);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sourceWidth) / targetWidth));
      const sums = [0, 0, 0, 0];
      let count = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const index = (yy * sourceWidth + wrapX(xx)) * 4;
          sums[0] += source[index];
          sums[1] += source[index + 1];
          sums[2] += source[index + 2];
          sums[3] += source[index + 3];
          count += 1;
        }
      }
      const targetIndex = (y * targetWidth + x) * 4;
      target[targetIndex] = Math.round(sums[0] / count);
      target[targetIndex + 1] = Math.round(sums[1] / count);
      target[targetIndex + 2] = Math.round(sums[2] / count);
      target[targetIndex + 3] = Math.round(sums[3] / count);
    }
  }
  return target;
}

function buildMinMaxLevel(source, sourceWidth, sourceHeight) {
  const targetWidth = Math.max(1, Math.floor(sourceWidth / 2));
  const targetHeight = Math.max(1, Math.floor(sourceHeight / 2));
  const target = new Uint8Array(targetWidth * targetHeight * 8);
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const minValues = [255, 255, 255, 255];
      const maxValues = [0, 0, 0, 0];
      for (let yy = 0; yy < 2; yy += 1) {
        for (let xx = 0; xx < 2; xx += 1) {
          const sourceIndex = ((Math.min(sourceHeight - 1, y * 2 + yy) * sourceWidth) +
            Math.min(sourceWidth - 1, x * 2 + xx)) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            const value = source[sourceIndex + channel];
            minValues[channel] = Math.min(minValues[channel], value);
            maxValues[channel] = Math.max(maxValues[channel], value);
          }
        }
      }
      const targetIndex = (y * targetWidth + x) * 8;
      for (let channel = 0; channel < 4; channel += 1) {
        target[targetIndex + channel] = minValues[channel];
        target[targetIndex + 4 + channel] = maxValues[channel];
      }
    }
  }
  return { data: target, height: targetHeight, width: targetWidth };
}

function buildCpuTruthBuffer(source, sourceWidth, sourceHeight, sourceSha256) {
  const truthWidth = 512;
  const truthHeight = 256;
  const rgbaLevel = downsampleRgbaNearestMean(
    source,
    sourceWidth,
    sourceHeight,
    truthWidth,
    truthHeight
  );
  const levels = [];
  const payloads = [];
  let currentRgba = rgbaLevel;
  let currentWidth = truthWidth;
  let currentHeight = truthHeight;
  while (true) {
    const minMaxLevel = buildMinMaxLevel(currentRgba, currentWidth, currentHeight);
    levels.push({
      height: currentHeight,
      minMaxLength: minMaxLevel.data.byteLength,
      minMaxOffset: 0,
      rgbaLength: currentRgba.byteLength,
      rgbaOffset: 0,
      width: currentWidth
    });
    payloads.push(currentRgba, minMaxLevel.data);
    if (currentWidth === 1 && currentHeight === 1) {
      break;
    }
    currentRgba = downsampleRgbaNearestMean(
      currentRgba,
      currentWidth,
      currentHeight,
      Math.max(1, Math.floor(currentWidth / 2)),
      Math.max(1, Math.floor(currentHeight / 2))
    );
    currentWidth = Math.max(1, Math.floor(currentWidth / 2));
    currentHeight = Math.max(1, Math.floor(currentHeight / 2));
  }

  let byteOffset = 0;
  for (let index = 0; index < levels.length; index += 1) {
    levels[index].rgbaOffset = byteOffset;
    byteOffset += levels[index].rgbaLength;
    levels[index].minMaxOffset = byteOffset;
    byteOffset += levels[index].minMaxLength;
  }
  const header = {
    byteLength: 0,
    generatorVersion: "home-cloud-field-v3-cpu-truth-1",
    height: truthHeight,
    layoutId: "v3-r-depth-g-height-b-morphology-a-concavity",
    levelCount: levels.length,
    levels,
    magic: "MLHC",
    offset: {
      x: 0.0,
      y: 0.0
    },
    orientation: "equirect-u-repeat-v-clamp-north-up",
    sourceSha256,
    version: 1,
    width: truthWidth
  };
  const payloadBuffer = Buffer.concat(payloads.map((payload) => Buffer.from(payload)));
  let finalHeader = header;
  let finalHeaderBuffer = Buffer.from(JSON.stringify(finalHeader), "utf8");
  while (true) {
    const byteLength = 4 + finalHeaderBuffer.byteLength + payloadBuffer.byteLength;
    const nextHeader = { ...header, byteLength };
    const nextHeaderBuffer = Buffer.from(JSON.stringify(nextHeader), "utf8");
    if (nextHeaderBuffer.byteLength === finalHeaderBuffer.byteLength) {
      finalHeader = nextHeader;
      finalHeaderBuffer = nextHeaderBuffer;
      break;
    }
    finalHeader = nextHeader;
    finalHeaderBuffer = nextHeaderBuffer;
  }
  const finalPrefix = Buffer.alloc(4);
  finalPrefix.writeUInt32LE(finalHeaderBuffer.byteLength, 0);
  return Buffer.concat([finalPrefix, finalHeaderBuffer, payloadBuffer]);
}

function byte(value) {
  return Math.round(clamp01(value) * 255);
}

mark(`decode input ${width}x${height}`);
const { data, info } = await sharp(inputPath)
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const coverage = new Float32Array(width * height);
const reliefSource = new Float32Array(width * height);
for (let index = 0; index < coverage.length; index += 1) {
  const sourceIndex = index * info.channels;
  const luminance =
    (data[sourceIndex] / 255) * 0.2126 +
    (data[sourceIndex + 1] / 255) * 0.7152 +
    (data[sourceIndex + 2] / 255) * 0.0722;
  coverage[index] = Math.pow(smoothstep(0.12, 0.68, luminance), 1.08);
  // Optical depth should remain a continuous data channel. The runtime now
  // lets Beer-Lambert integration produce opacity, so repeated top-bin plateaus
  // are treated as defects instead of as intentional opaque cloud cores.
  reliefSource[index] = Math.pow(smoothstep(0.025, 0.985, luminance), 0.92);
}

repairLongitudeSeam(coverage);
repairLongitudeSeam(reliefSource);
mark("build blur pyramids");

const shapeRadius = Math.max(2, Math.round(8 * spatialScale));
const bodyRadius = Math.max(4, Math.round(26 * spatialScale));
const reliefFineRadius = Math.max(1, Math.round(1 * spatialScale));
const reliefShapeRadius = Math.max(2, Math.round(4 * spatialScale));
const reliefBodyRadius = Math.max(4, Math.round(14 * spatialScale));
const reliefWeatherRadius = Math.max(8, Math.round(42 * spatialScale));
const normalDetailRadius = Math.max(1, Math.round(1 * spatialScale));
const normalShapeRadius = Math.max(2, Math.round(5 * spatialScale));
const coverageShape = boxBlur(coverage, shapeRadius, shapeRadius);
const coverageBody = boxBlur(coverage, bodyRadius, bodyRadius);
const reliefFine = boxBlur(reliefSource, reliefFineRadius, reliefFineRadius);
const reliefShape = boxBlur(reliefSource, reliefShapeRadius, reliefShapeRadius);
const reliefBody = boxBlur(reliefSource, reliefBodyRadius, reliefBodyRadius);
const reliefWeather = boxBlur(reliefSource, reliefWeatherRadius, reliefWeatherRadius);
const packedCoverageField = new Float32Array(width * height);
const heightField = new Float32Array(width * height);
const morphologyField = new Float32Array(width * height);
const concavityField = new Float32Array(width * height);
const output = Buffer.alloc(width * height * 4);
mark("pack channels");

for (let index = 0; index < coverage.length; index += 1) {
  const x = index % width;
  const y = Math.floor(index / width);
  const u = x / width;
  const v = y / height;
  const latitudeBand = 1 - Math.abs(v - 0.5) * 2;
  const weatherType = clamp01(
    0.5 +
    Math.sin(u * Math.PI * 7.3 + v * Math.PI * 2.1) * 0.18 +
    Math.sin(u * Math.PI * 17.0 - v * Math.PI * 5.4) * 0.1 +
    Math.sin((u + v) * Math.PI * 11.6) * 0.07
  );
  const convectiveBias = clamp01(weatherType * 0.72 + latitudeBand * 0.28);
  const opticalDepthSource = clamp01(
    coverage[index] * 0.44 + coverageShape[index] * 0.34 + coverageBody[index] * 0.22
  );
  const packedCoverageBase = clamp01(
    Math.pow(opticalDepthSource, 1.56) * 0.86 +
      Math.pow(coverageShape[index], 1.42) * 0.035
  );
  const fineBand = clamp((reliefSource[index] - reliefFine[index]) * 2.15, -0.27, 0.3);
  const middleBand = clamp((reliefFine[index] - reliefShape[index]) * 1.55, -0.25, 0.28);
  const bodyBand = clamp((reliefShape[index] - reliefBody[index]) * 1.02, -0.23, 0.25);
  const towerResponse = Math.max(
    fineBand * 0.58 + middleBand * 0.64 + bodyBand * 0.32,
    0
  );
  const cavityResponse = Math.max(
    -fineBand * 0.42 - middleBand * 0.66 - bodyBand * 0.34,
    0
  );
  const topBinBreaker = clamp01(
    0.93 +
      convectiveBias * 0.045 +
      Math.abs(reliefShape[index] - reliefWeather[index]) * 0.34 +
      Math.max(bodyBand, 0) * 0.12 -
      Math.max(-bodyBand, 0) * 0.08
  );
  const packedCoverage = clamp01(packedCoverageBase * topBinBreaker);
  const tower = smoothstep(0.018, 0.3, towerResponse);
  const cavity = smoothstep(0.016, 0.25, cavityResponse);
  const coverageMask = smoothstep(0.025, 0.72, packedCoverage);
  const coreMask = smoothstep(0.22, 0.84, packedCoverage);
  const macroWeather = smoothstep(
    0.12,
    0.78,
    coverageBody[index] * 0.62 + reliefWeather[index] * 0.38
  );
  const mesoBreakup = smoothstep(0.018, 0.24, Math.abs(middleBand) + Math.abs(bodyBand) * 0.64);
  const microErosion = smoothstep(0.012, 0.19, Math.abs(fineBand) + Math.max(0, -fineBand) * 0.42);
  const reliefBase = clamp01(
    reliefSource[index] * 0.1 +
    reliefFine[index] * 0.12 +
    reliefShape[index] * 0.2 +
    reliefBody[index] * 0.38 +
    reliefWeather[index] * 0.2
  );
  const independentTopShape = clamp01(
    reliefShape[index] * 0.28 +
    reliefBody[index] * 0.42 +
    reliefWeather[index] * 0.3 +
    tower * (0.06 + convectiveBias * 0.08) -
    cavity * 0.05
  );
  const structuredRelief = clamp01(
    independentTopShape + tower * coreMask * 0.07 - cavity * coreMask * 0.045 + bodyBand * 0.055
  );

  packedCoverageField[index] = packedCoverage;
  const heightCoverageGate = smoothstep(0.026, 0.12, packedCoverage);
  const heightDecoupling = clamp01(
    1 - coreMask * (cavity * 0.32 + microErosion * 0.18 + (1 - convectiveBias) * 0.18) +
    (1 - coreMask) * mesoBreakup * 0.2
  );
  heightField[index] = clamp01(
    Math.pow(structuredRelief, 1.12) *
    heightCoverageGate *
    (0.27 + mesoBreakup * 0.24 + microErosion * 0.1 + macroWeather * 0.075 + convectiveBias * 0.25 + coreMask * 0.095) *
    heightDecoupling +
    (1 - heightCoverageGate) * convectiveBias * 0.065
  );
  morphologyField[index] = clamp01(
    microErosion * 0.25 +
    mesoBreakup * 0.32 +
    tower * 0.12 +
    macroWeather * 0.08
  );
  concavityField[index] = clamp01(
    cavity * 0.5 +
    coreMask * (1 - reliefBase) * 0.24 +
    smoothstep(0.42, 0.92, coverageBody[index]) * 0.16 +
    smoothstep(0.08, 0.52, towerResponse) * 0.1
  );
}

const heightSmoothRadius = Math.max(2, Math.round(3 * spatialScale));
const smoothedHeightField = boxBlur(heightField, heightSmoothRadius, heightSmoothRadius);
for (let index = 0; index < heightField.length; index += 1) {
  heightField[index] = clamp01(
    smoothedHeightField[index] * 0.46 + heightField[index] * 0.54
  );
}
repairLongitudeSeam(packedCoverageField);
repairLongitudeSeam(heightField);
repairLongitudeSeam(morphologyField);
repairLongitudeSeam(concavityField);
mark("write channel bytes");

let coreSampleCount = 0;
let coreHeightDelta = 0;
let coreMorphology = 0;
let coreConcavity = 0;
let coreOpticalDepthSum = 0;
let coreCloudTopHeightSum = 0;
let coreOpticalDepthSquareSum = 0;
let coreCloudTopHeightSquareSum = 0;
let coreOpticalHeightProductSum = 0;
let coreStrongErosionCount = 0;
let opticalDepthSaturationCount = 0;
let clearSkyLeakCount = 0;
let correlationSampleCount = 0;
let opticalDepthSum = 0;
let cloudTopHeightSum = 0;
let opticalDepthSquareSum = 0;
let cloudTopHeightSquareSum = 0;
let opticalHeightProductSum = 0;
const coreHeightGradientHistogram = new Uint32Array(1001);
const opticalDepthHistogram = new Uint32Array(256);
const coreOpticalDepthHistogram = new Uint32Array(256);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    const opticalDepth = packedCoverageField[index];
    const cloudTopHeight = heightField[index];
    const morphology = morphologyField[index];
    const concavity = concavityField[index];
    const opticalDepthByte = byte(opticalDepth);
    opticalDepthHistogram[opticalDepthByte] += 1;
    opticalDepthSaturationCount += opticalDepthByte >= 250 ? 1 : 0;
    clearSkyLeakCount += opticalDepth < 0.035 && cloudTopHeight > 0.12 ? 1 : 0;
    correlationSampleCount += 1;
    opticalDepthSum += opticalDepth;
    cloudTopHeightSum += cloudTopHeight;
    opticalDepthSquareSum += opticalDepth * opticalDepth;
    cloudTopHeightSquareSum += cloudTopHeight * cloudTopHeight;
    opticalHeightProductSum += opticalDepth * cloudTopHeight;

    if (opticalDepth > 0.42) {
      const localHeight = (
        sample(heightField, x - normalDetailRadius, y) +
        sample(heightField, x + normalDetailRadius, y) +
        sample(heightField, x, y - normalDetailRadius) +
        sample(heightField, x, y + normalDetailRadius)
      ) * 0.25;
      const gradientX = sample(heightField, x + normalShapeRadius, y) - sample(heightField, x - normalShapeRadius, y);
      const gradientY = sample(heightField, x, y + normalShapeRadius) - sample(heightField, x, y - normalShapeRadius);
      const gradientMagnitude = Math.hypot(gradientX, gradientY);
      coreSampleCount += 1;
      coreHeightDelta += Math.abs(cloudTopHeight - localHeight);
      coreMorphology += morphology;
      coreConcavity += concavity;
      coreOpticalDepthSum += opticalDepth;
      coreCloudTopHeightSum += cloudTopHeight;
      coreOpticalDepthSquareSum += opticalDepth * opticalDepth;
      coreCloudTopHeightSquareSum += cloudTopHeight * cloudTopHeight;
      coreOpticalHeightProductSum += opticalDepth * cloudTopHeight;
      coreOpticalDepthHistogram[opticalDepthByte] += 1;
      coreStrongErosionCount += morphology > 0.58 ? 1 : 0;
      coreHeightGradientHistogram[Math.min(1000, Math.floor(gradientMagnitude * 1000))] += 1;
    }

    const target = index * 4;
    output[target] = byte(opticalDepth);
    output[target + 1] = byte(cloudTopHeight);
    output[target + 2] = byte(morphology);
    output[target + 3] = byte(concavity);
  }
}
mark("write png buffer complete");

await mkdir(path.dirname(outputPath), { recursive: true });
await mkdir(path.dirname(cpuTruthOutputPath), { recursive: true });
const sourceSha256 = createHash("sha256")
  .update(await readFile(inputPath))
  .digest("hex");
mark("write png");
await sharp(output, { raw: { width, height, channels: 4 } })
  .png({
    adaptiveFiltering: false,
    compressionLevel: fastPng ? 3 : 9,
    effort: fastPng ? 1 : 10,
    palette: false
  })
  .toFile(outputPath);

mark("write cpu truth");
const cpuTruthBuffer = buildCpuTruthBuffer(output, width, height, sourceSha256);
if (cpuTruthBuffer.byteLength > cpuTruthMaxBytes) {
  throw new Error(`CPU truth cloud field is ${cpuTruthBuffer.byteLength} bytes; budget is ${cpuTruthMaxBytes} bytes.`);
}
await writeFile(cpuTruthOutputPath, cpuTruthBuffer);

let ktx2Stats;
if (generateKtx2) {
  mark("encode ktx2");
  const { encodeToKTX2 } = await import("ktx2-encoder");
  const pngBuffer = await readFile(outputPath);
  const ktx2 = await encodeToKTX2(pngBuffer, {
    enableDebug: false,
    enableRDO: false,
    generateMipmap: true,
    imageDecoder: async (buffer) => {
      const decodedImage = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return {
        data: new Uint8Array(
          decodedImage.data.buffer,
          decodedImage.data.byteOffset,
          decodedImage.data.byteLength
        ),
        height: decodedImage.info.height,
        width: decodedImage.info.width
      };
    },
    isKTX2File: true,
    isPerceptual: false,
    isSetKTX2SRGBTransferFunc: false,
    isUASTC: true,
    isYFlip: true,
    needSupercompression: true,
    uastcLDRQualityLevel: 3
  });
  const ktx2Magic = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
  if (ktx2Magic.some((value, index) => ktx2[index] !== value)) {
    throw new Error("Generated cloud field is not a valid KTX2 container.");
  }
  await writeFile(ktx2OutputPath, ktx2);
  ktx2Stats = await stat(ktx2OutputPath);
  if (ktx2Stats.size > ktx2MaxBytes) {
    throw new Error(`KTX2 cloud field is ${ktx2Stats.size} bytes; budget is ${ktx2MaxBytes} bytes.`);
  }

  const basisSourceDir = path.join(
    repoRoot,
    "packages/lubirth-hero/node_modules/three/examples/jsm/libs/basis"
  );
  await mkdir(basisPublicDir, { recursive: true });
  await Promise.all([
    copyFile(
      path.join(basisSourceDir, "basis_transcoder.js"),
      path.join(basisPublicDir, "basis_transcoder.js")
    ),
    copyFile(
      path.join(basisSourceDir, "basis_transcoder.wasm"),
      path.join(basisPublicDir, "basis_transcoder.wasm")
    )
  ]);
}

mark("verify decode");
const { data: decoded, info: decodedInfo } = await sharp(outputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const channelMaxError = [0, 0, 0, 0];
const seamMeanError = [0, 0, 0, 0];
const seamMaxError = [0, 0, 0, 0];
const seamBandWidth = Math.max(8, Math.round(18 * spatialScale));
const seamBandMean = [0, 0, 0, 0];
const seamBandSquareMean = [0, 0, 0, 0];
const seamInteriorMean = [0, 0, 0, 0];
const seamInteriorSquareMean = [0, 0, 0, 0];
const seamGradientMean = [0, 0, 0, 0];
const seamInteriorGradientMean = [0, 0, 0, 0];
let seamBandCount = 0;
let seamInteriorCount = 0;
for (let index = 0; index < output.length; index += 1) {
  const channel = index % 4;
  channelMaxError[channel] = Math.max(channelMaxError[channel], Math.abs(output[index] - decoded[index]));
}
for (let y = 0; y < height; y += 1) {
  const left = y * width * 4;
  const right = (y * width + width - 1) * 4;
  for (let channel = 0; channel < 4; channel += 1) {
    const difference = Math.abs(output[left + channel] - output[right + channel]);
    seamMeanError[channel] += difference;
    seamMaxError[channel] = Math.max(seamMaxError[channel], difference);
  }
  for (let distance = 0; distance < seamBandWidth; distance += 1) {
    const leftBand = (y * width + distance) * 4;
    const rightBand = (y * width + width - 1 - distance) * 4;
    const leftInterior = (y * width + seamBandWidth + distance) * 4;
    const rightInterior = (y * width + width - 1 - seamBandWidth - distance) * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      const bandA = output[leftBand + channel];
      const bandB = output[rightBand + channel];
      const interiorA = output[leftInterior + channel];
      const interiorB = output[rightInterior + channel];
      seamBandMean[channel] += bandA + bandB;
      seamBandSquareMean[channel] += bandA * bandA + bandB * bandB;
      seamInteriorMean[channel] += interiorA + interiorB;
      seamInteriorSquareMean[channel] += interiorA * interiorA + interiorB * interiorB;
      if (distance < seamBandWidth - 1) {
        seamGradientMean[channel] +=
          Math.abs(output[leftBand + 4 + channel] - bandA) +
          Math.abs(output[rightBand - 4 + channel] - bandB);
        seamInteriorGradientMean[channel] +=
          Math.abs(output[leftInterior + 4 + channel] - interiorA) +
          Math.abs(output[rightInterior - 4 + channel] - interiorB);
      }
    }
  }
  seamBandCount += seamBandWidth * 2;
  seamInteriorCount += seamBandWidth * 2;
}
for (let channel = 0; channel < 4; channel += 1) {
  seamMeanError[channel] /= height;
  seamBandMean[channel] /= Math.max(seamBandCount, 1);
  seamBandSquareMean[channel] /= Math.max(seamBandCount, 1);
  seamInteriorMean[channel] /= Math.max(seamInteriorCount, 1);
  seamInteriorSquareMean[channel] /= Math.max(seamInteriorCount, 1);
  seamGradientMean[channel] /= Math.max((seamBandWidth - 1) * height * 2, 1);
  seamInteriorGradientMean[channel] /= Math.max((seamBandWidth - 1) * height * 2, 1);
}
const seamBandStdDev = seamBandMean.map((mean, channel) =>
  Math.sqrt(Math.max(seamBandSquareMean[channel] - mean * mean, 0))
);
const seamInteriorStdDev = seamInteriorMean.map((mean, channel) =>
  Math.sqrt(Math.max(seamInteriorSquareMean[channel] - mean * mean, 0))
);
if (
  decodedInfo.width !== width ||
  decodedInfo.height !== height ||
  decodedInfo.channels !== 4 ||
  channelMaxError.some((value) => value !== 0)
) {
  throw new Error(
    `Packed cloud field is not byte-exact after decode: ${JSON.stringify({ decodedInfo, channelMaxError })}`
  );
}
if (
  seamMeanError.some((value) => value > 1.5) ||
  seamMaxError.some((value) => value > 10)
) {
  throw new Error(
    `Packed cloud field has visible longitude seam: ${JSON.stringify({ seamMeanError, seamMaxError })}`
  );
}
if (
  seamBandStdDev.some((value, channel) => value < seamInteriorStdDev[channel] * 0.42) ||
  seamGradientMean.some((value, channel) => value < seamInteriorGradientMean[channel] * 0.22) ||
  seamGradientMean.some((value, channel) => value > seamInteriorGradientMean[channel] * 2.8 + 1.5)
) {
  throw new Error(
    `Packed cloud field seam repair damaged local structure: ${JSON.stringify({
      seamBandStdDev,
      seamGradientMean,
      seamInteriorGradientMean,
      seamInteriorStdDev
    })}`
  );
}

const outputStats = await stat(outputPath);
if (outputStats.size > maxBytes) {
  throw new Error(`Packed cloud field is ${outputStats.size} bytes; budget is ${maxBytes} bytes.`);
}

function histogramPercentile(histogram, sampleCount, position) {
  const target = Math.max(1, Math.ceil(sampleCount * position));
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= target) {
      return index / 1000;
    }
  }
  return 1;
}

function byteHistogramPercentile(histogram, sampleCount, position) {
  const target = Math.max(1, Math.ceil(sampleCount * position));
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= target) {
      return index / 255;
    }
  }
  return 1;
}

function correlation({
  count,
  productSum,
  xSquareSum,
  xSum,
  ySquareSum,
  ySum
}) {
  const numerator = count * productSum - xSum * ySum;
  const xVariance = count * xSquareSum - xSum * xSum;
  const yVariance = count * ySquareSum - ySum * ySum;
  return numerator / Math.max(Math.sqrt(Math.max(xVariance, 0) * Math.max(yVariance, 0)), 1e-6);
}

let coreOpticalDepthMaxByte = 0;
for (let value = 255; value >= 0; value -= 1) {
  if (coreOpticalDepthHistogram[value] > 0) {
    coreOpticalDepthMaxByte = value;
    break;
  }
}
let coreOpticalDepthTopFourBinCount = 0;
for (
  let value = Math.max(0, coreOpticalDepthMaxByte - 3);
  value <= coreOpticalDepthMaxByte;
  value += 1
) {
  coreOpticalDepthTopFourBinCount += coreOpticalDepthHistogram[value] ?? 0;
}

const reliefMetrics = {
  channelLayout: "v3-r-depth-g-height-b-morphology-a-concavity",
  clearSkyHeightLeakRatio: clearSkyLeakCount / Math.max(correlationSampleCount, 1),
  coreMeanConcavity: coreConcavity / Math.max(coreSampleCount, 1),
  coreMeanHeightDelta: coreHeightDelta / Math.max(coreSampleCount, 1),
  coreMeanMorphology: coreMorphology / Math.max(coreSampleCount, 1),
  coreOpticalDepthHeightCorrelation: correlation({
    count: coreSampleCount,
    productSum: coreOpticalHeightProductSum,
    xSquareSum: coreOpticalDepthSquareSum,
    xSum: coreOpticalDepthSum,
    ySquareSum: coreCloudTopHeightSquareSum,
    ySum: coreCloudTopHeightSum
  }),
  coreOpticalDepthMaxByte,
  coreOpticalDepthTopBinRatio:
    (coreOpticalDepthHistogram[coreOpticalDepthMaxByte] ?? 0) / Math.max(coreSampleCount, 1),
  coreOpticalDepthTopFourBinRatio:
    coreOpticalDepthTopFourBinCount / Math.max(coreSampleCount, 1),
  coreHeightGradientP90: histogramPercentile(coreHeightGradientHistogram, coreSampleCount, 0.9),
  coreHeightGradientP99: histogramPercentile(coreHeightGradientHistogram, coreSampleCount, 0.99),
  coreStrongErosionRatio: coreStrongErosionCount / Math.max(coreSampleCount, 1),
  coreSampleCount,
  opticalDepthHeightCorrelation: correlation({
    count: correlationSampleCount,
    productSum: opticalHeightProductSum,
    xSquareSum: opticalDepthSquareSum,
    xSum: opticalDepthSum,
    ySquareSum: cloudTopHeightSquareSum,
    ySum: cloudTopHeightSum
  }),
  opticalDepthP90: byteHistogramPercentile(opticalDepthHistogram, correlationSampleCount, 0.9),
  opticalDepthSaturationRatio: opticalDepthSaturationCount / Math.max(correlationSampleCount, 1)
};
if (
  reliefMetrics.coreSampleCount < width * height * 0.02 ||
  reliefMetrics.clearSkyHeightLeakRatio > 0.01 ||
  reliefMetrics.coreMeanHeightDelta < 0.01 ||
  reliefMetrics.coreMeanHeightDelta > 0.085 ||
  reliefMetrics.coreMeanMorphology < 0.14 ||
  reliefMetrics.coreMeanMorphology > 0.48 ||
  reliefMetrics.coreMeanConcavity < 0.1 ||
  reliefMetrics.coreMeanConcavity > 0.5 ||
  reliefMetrics.coreHeightGradientP90 < 0.035 ||
  reliefMetrics.coreHeightGradientP90 > 0.38 ||
  reliefMetrics.coreHeightGradientP99 > 0.54 ||
  reliefMetrics.coreStrongErosionRatio < 0.02 ||
  reliefMetrics.coreStrongErosionRatio > 0.36 ||
  reliefMetrics.coreOpticalDepthHeightCorrelation < 0.72 ||
  reliefMetrics.coreOpticalDepthHeightCorrelation > 0.86 ||
  reliefMetrics.coreOpticalDepthTopBinRatio > 0.035 ||
  reliefMetrics.coreOpticalDepthTopFourBinRatio > 0.11 ||
  reliefMetrics.opticalDepthP90 > 0.9 ||
  reliefMetrics.opticalDepthSaturationRatio > 0.02
) {
  throw new Error(
    `Packed Cloud Field V3 lacks bounded internal structure: ${JSON.stringify(reliefMetrics)}`
  );
}

console.log(
  `Generated ${path.relative(repoRoot, outputPath)} (${width}x${height}, ${outputStats.size} bytes, decode max error ${channelMaxError.join("/")}, relief ${JSON.stringify(reliefMetrics)})${ktx2Stats ? ` and ${path.relative(repoRoot, ktx2OutputPath)} (${ktx2Stats.size} bytes, UASTC + Zstd)` : ""} from ${path.relative(repoRoot, inputPath)}`
);
