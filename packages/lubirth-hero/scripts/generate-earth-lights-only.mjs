#!/usr/bin/env node

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const inputPath = path.join(
  repoRoot,
  "apps/site/public/assets/lubirth/textures/earth-night-2k.jpg"
);
const outputPath = path.join(
  repoRoot,
  "apps/site/public/assets/lubirth/textures/earth-lights-only-2k.webp"
);

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function smoothstep(edge0, edge1, value) {
  const unit = clamp01((value - edge0) / Math.max(edge1 - edge0, 1e-6));
  return unit * unit * (3 - 2 * unit);
}

const { data, info } = await sharp(inputPath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const output = Buffer.alloc(info.width * info.height * 3);

let nonBlackPixels = 0;
let maximumBackgroundChannel = 0;
for (let index = 0; index < info.width * info.height; index += 1) {
  const source = index * info.channels;
  const target = index * 3;
  const red = data[source] / 255;
  const green = data[source + 1] / 255;
  const blue = data[source + 2] / 255;
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const warmSignal = Math.max(0, red * 0.74 + green * 0.42 - blue * 0.58);
  const blackPoint = Math.max(0, luminance - 0.026);
  const lightGate = smoothstep(0.006, 0.13, blackPoint + warmSignal * 0.28);
  const intensity = Math.pow(clamp01(blackPoint * 1.68), 0.78) * lightGate;
  const colorTotal = Math.max(red + green + blue, 1e-5);
  const warmRed = clamp01(red / colorTotal * 1.78 + 0.22);
  const warmGreen = clamp01(green / colorTotal * 1.55 + 0.14);
  const warmBlue = clamp01(blue / colorTotal * 1.12 + 0.035);
  const outRed = Math.round(clamp01(intensity * warmRed * 2.25) * 255);
  const outGreen = Math.round(clamp01(intensity * warmGreen * 2.05) * 255);
  const outBlue = Math.round(clamp01(intensity * warmBlue * 1.25) * 255);

  output[target] = outRed;
  output[target + 1] = outGreen;
  output[target + 2] = outBlue;
  if (Math.max(outRed, outGreen, outBlue) > 3) {
    nonBlackPixels += 1;
  } else {
    maximumBackgroundChannel = Math.max(
      maximumBackgroundChannel,
      outRed,
      outGreen,
      outBlue
    );
  }
}

await mkdir(path.dirname(outputPath), { recursive: true });
await sharp(output, {
  raw: { width: info.width, height: info.height, channels: 3 }
})
  .webp({ effort: 6, lossless: true })
  .toFile(outputPath);

const outputStats = await stat(outputPath);
const nonBlackRatio = nonBlackPixels / (info.width * info.height);
const { data: decodedOutput, info: decodedInfo } = await sharp(outputPath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let decodedMismatchCount = 0;
let decodedMaximumBackgroundChannel = 0;
for (let index = 0; index < info.width * info.height; index += 1) {
  const source = index * 3;
  const decoded = index * decodedInfo.channels;
  const sourceMaximum = Math.max(
    output[source],
    output[source + 1],
    output[source + 2]
  );
  const decodedMaximum = Math.max(
    decodedOutput[decoded],
    decodedOutput[decoded + 1],
    decodedOutput[decoded + 2]
  );
  if (
    decodedOutput[decoded] !== output[source] ||
    decodedOutput[decoded + 1] !== output[source + 1] ||
    decodedOutput[decoded + 2] !== output[source + 2]
  ) {
    decodedMismatchCount += 1;
  }
  if (sourceMaximum <= 3) {
    decodedMaximumBackgroundChannel = Math.max(
      decodedMaximumBackgroundChannel,
      decodedMaximum
    );
  }
}

if (
  nonBlackRatio > 0.24 ||
  maximumBackgroundChannel > 3 ||
  decodedMaximumBackgroundChannel > 3 ||
  decodedMismatchCount > 0 ||
  outputStats.size > 360_000
) {
  throw new Error(`Lights-only map failed budget: ${JSON.stringify({
    bytes: outputStats.size,
    decodedMaximumBackgroundChannel,
    decodedMismatchCount,
    maximumBackgroundChannel,
    nonBlackRatio
  })}`);
}

console.log(
  `Generated ${path.relative(repoRoot, outputPath)} (${info.width}x${info.height}, ${outputStats.size} bytes, ${(nonBlackRatio * 100).toFixed(2)}% lit pixels)`
);
