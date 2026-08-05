#!/usr/bin/env node

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const textureDir = path.join(repoRoot, "apps/site/public/assets/lubirth/textures");

const jobs = [
  {
    input: path.join(textureDir, "earth-day-8k.webp"),
    output: path.join(textureDir, "earth-day-nasa-lite-4k.webp"),
    width: 4096,
    height: 2048,
    maxBytes: 1_800_000
  },
  {
    input: path.join(textureDir, "moon-2k.jpg"),
    output: path.join(textureDir, "moon-nasa-lite-1k.webp"),
    width: 1024,
    height: 512,
    maxBytes: 420_000
  },
  {
    input: path.join(textureDir, "moon-2k.jpg"),
    output: path.join(textureDir, "moon-nasa-lite-512.webp"),
    width: 512,
    height: 256,
    maxBytes: 160_000
  }
];

await mkdir(textureDir, { recursive: true });

for (const job of jobs) {
  await sharp(job.input)
    .resize(job.width, job.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .webp({ effort: 6, quality: 90, smartSubsample: true })
    .toFile(job.output);

  const outputStats = await stat(job.output);
  if (outputStats.size > job.maxBytes) {
    throw new Error(
      `${path.basename(job.output)} is ${outputStats.size} bytes; budget is ${job.maxBytes} bytes.`
    );
  }

  console.log(
    `Generated ${path.relative(repoRoot, job.output)} (${job.width}x${job.height}, ${outputStats.size} bytes)`
  );
}
