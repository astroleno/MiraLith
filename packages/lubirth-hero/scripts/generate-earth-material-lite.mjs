#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../../..");
const textureDir = path.join(repoRoot, "apps/site/public/assets/lubirth/textures");
const displacementPath = path.join(textureDir, "earth-displacement-8k.jpg");
const specularPath = path.join(textureDir, "earth-specular-4k.png");
const manifestPath = path.join(textureDir, "earth-material-lite-v1.manifest.json");

const CHANNEL_LAYOUT = "rg-normalxy-b-specular-a-roughness";
const NORMAL_STRENGTH = 14;
const ROUGHNESS_MULTIPLIER = 0.72;
const ROUGHNESS_MIN = 0.18;
const ROUGHNESS_MAX = 0.96;
const KTX2_MAGIC = Buffer.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a
]);

const outputs = [
  {
    height: 1024,
    id: "2k",
    ktx2MaxBytes: Math.floor(2.8 * 1024 * 1024),
    width: 2048
  },
  {
    height: 512,
    id: "1k",
    ktx2MaxBytes: Math.floor(0.8 * 1024 * 1024),
    width: 1024
  }
];

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const clamp01 = (value) => clamp(value, 0, 1);
const relativePath = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join("/");

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function encodeUnit(value) {
  return Math.round(clamp01(value) * 255);
}

function validateKtx2(filePath, expectedWidth, expectedHeight) {
  return readFile(filePath).then((bytes) => {
    if (!bytes.subarray(0, KTX2_MAGIC.length).equals(KTX2_MAGIC)) {
      throw new Error(`${relativePath(filePath)} is not a valid KTX2 container.`);
    }

    const width = bytes.readUInt32LE(20);
    const height = bytes.readUInt32LE(24);
    if (width !== expectedWidth || height !== expectedHeight) {
      throw new Error(
        `${relativePath(filePath)} dimensions are ${width}x${height}, expected ${expectedWidth}x${expectedHeight}.`
      );
    }
  });
}

function buildPackedTexture({
  displacement,
  displacementHeight,
  displacementWidth,
  outputHeight,
  outputWidth,
  specular,
  specularChannels,
  specularHeight,
  specularWidth
}) {
  const output = Buffer.allocUnsafe(outputWidth * outputHeight * 4);
  const wrapX = (x) => ((x % displacementWidth) + displacementWidth) % displacementWidth;
  const clampY = (y) => clamp(y, 0, displacementHeight - 1);
  const sampleDisplacement = (x, y) =>
    displacement[clampY(y) * displacementWidth + wrapX(x)] / 255;
  const sampleSpecular = (x, y) => {
    const sourceX = Math.min(
      specularWidth - 1,
      Math.floor((x * specularWidth) / displacementWidth)
    );
    const sourceY = Math.min(
      specularHeight - 1,
      Math.floor((y * specularHeight) / displacementHeight)
    );
    const offset = (sourceY * specularWidth + sourceX) * specularChannels;
    let total = 0;
    for (let channel = 0; channel < Math.min(specularChannels, 3); channel += 1) {
      total += specular[offset + channel];
    }
    return total / (Math.min(specularChannels, 3) * 255);
  };

  for (let outputY = 0; outputY < outputHeight; outputY += 1) {
    const y0 = Math.floor((outputY * displacementHeight) / outputHeight);
    const y1 = Math.max(
      y0 + 1,
      Math.floor(((outputY + 1) * displacementHeight) / outputHeight)
    );

    for (let outputX = 0; outputX < outputWidth; outputX += 1) {
      const x0 = Math.floor((outputX * displacementWidth) / outputWidth);
      const x1 = Math.max(
        x0 + 1,
        Math.floor(((outputX + 1) * displacementWidth) / outputWidth)
      );
      let normalX = 0;
      let normalY = 0;
      let specularMask = 0;
      let samples = 0;

      // Calculate every normal at the source resolution, then area-average it.
      for (let y = y0; y < y1; y += 1) {
        const latitude = ((y + 0.5) / displacementHeight - 0.5) * Math.PI;
        const longitudeScale = 1 / Math.max(Math.cos(latitude), 0.18);
        for (let x = x0; x < x1; x += 1) {
          const eastSlope = sampleDisplacement(x + 1, y) - sampleDisplacement(x - 1, y);
          const southSlope = sampleDisplacement(x, y + 1) - sampleDisplacement(x, y - 1);
          const nx = -eastSlope * NORMAL_STRENGTH * longitudeScale;
          const ny = -southSlope * NORMAL_STRENGTH;
          const inverseLength = 1 / Math.hypot(nx, ny, 1);
          normalX += nx * inverseLength;
          normalY += ny * inverseLength;
          specularMask += sampleSpecular(x, y);
          samples += 1;
        }
      }

      const outputOffset = (outputY * outputWidth + outputX) * 4;
      const normalizedX = normalX / samples;
      const normalizedY = normalY / samples;
      const normalizedSpecular = clamp01(specularMask / samples);
      output[outputOffset] = encodeUnit(normalizedX * 0.5 + 0.5);
      output[outputOffset + 1] = encodeUnit(normalizedY * 0.5 + 0.5);
      output[outputOffset + 2] = encodeUnit(normalizedSpecular);
      output[outputOffset + 3] = encodeUnit(
        clamp(1 - ROUGHNESS_MULTIPLIER * normalizedSpecular, ROUGHNESS_MIN, ROUGHNESS_MAX)
      );
    }
  }

  return output;
}

async function encodeKtx2(pngPath, outputPath) {
  const { encodeToKTX2 } = await import("ktx2-encoder");
  const ktx2 = await encodeToKTX2(await readFile(pngPath), {
    enableDebug: false,
    enableRDO: false,
    generateMipmap: true,
    imageDecoder: async (buffer) => {
      const decoded = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return {
        data: new Uint8Array(
          decoded.data.buffer,
          decoded.data.byteOffset,
          decoded.data.byteLength
        ),
        height: decoded.info.height,
        width: decoded.info.width
      };
    },
    isKTX2File: true,
    isPerceptual: false,
    isSetKTX2SRGBTransferFunc: false,
    isUASTC: true,
    isYFlip: true,
    needSupercompression: true,
    uastcLDRQualityLevel: 2
  });
  await writeFile(outputPath, ktx2);
}

const [displacementImage, specularImage] = await Promise.all([
  sharp(displacementPath).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }),
  sharp(specularPath).removeAlpha().raw().toBuffer({ resolveWithObject: true })
]);

if (
  displacementImage.info.width !== 8192 ||
  displacementImage.info.height !== 4096 ||
  displacementImage.info.channels !== 1
) {
  throw new Error("earth-displacement-8k.jpg must be an 8192x4096 single-channel image.");
}
if (
  specularImage.info.width !== 4096 ||
  specularImage.info.height !== 2048 ||
  specularImage.info.channels < 1
) {
  throw new Error("earth-specular-4k.png must be a 4096x2048 image.");
}

await mkdir(textureDir, { recursive: true });
const manifestOutputs = {};

for (const output of outputs) {
  const packed = buildPackedTexture({
    displacement: displacementImage.data,
    displacementHeight: displacementImage.info.height,
    displacementWidth: displacementImage.info.width,
    outputHeight: output.height,
    outputWidth: output.width,
    specular: specularImage.data,
    specularChannels: specularImage.info.channels,
    specularHeight: specularImage.info.height,
    specularWidth: specularImage.info.width
  });
  const pngFileName = `earth-material-lite-v1-${output.id}.png`;
  const ktx2FileName = `earth-material-lite-v1-${output.id}.ktx2`;
  const pngPath = path.join(textureDir, pngFileName);
  const ktx2Path = path.join(textureDir, ktx2FileName);

  await sharp(packed, {
    raw: { channels: 4, height: output.height, width: output.width }
  })
    .png({ adaptiveFiltering: false, compressionLevel: 9 })
    .toFile(pngPath);
  await encodeKtx2(pngPath, ktx2Path);
  await validateKtx2(ktx2Path, output.width, output.height);

  const [pngStats, ktx2Stats] = await Promise.all([stat(pngPath), stat(ktx2Path)]);
  if (ktx2Stats.size > output.ktx2MaxBytes) {
    throw new Error(
      `${ktx2FileName} is ${ktx2Stats.size} bytes; budget is ${output.ktx2MaxBytes} bytes.`
    );
  }

  manifestOutputs[pngFileName] = {
    bytes: pngStats.size,
    format: "png",
    height: output.height,
    sha256: await sha256(pngPath),
    width: output.width
  };
  manifestOutputs[ktx2FileName] = {
    bytes: ktx2Stats.size,
    format: "ktx2",
    height: output.height,
    sha256: await sha256(ktx2Path),
    width: output.width
  };
}

const manifest = {
  channelLayout: CHANNEL_LAYOUT,
  colorSpace: "linear",
  generator: {
    path: relativePath(scriptPath),
    sha256: await sha256(scriptPath)
  },
  inputs: [
    {
      path: relativePath(displacementPath),
      sha256: await sha256(displacementPath)
    },
    {
      path: relativePath(specularPath),
      sha256: await sha256(specularPath)
    }
  ],
  outputs: manifestOutputs,
  version: 1
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Generated packed Earth material assets (${CHANNEL_LAYOUT}) at ${relativePath(textureDir)}.`
);
