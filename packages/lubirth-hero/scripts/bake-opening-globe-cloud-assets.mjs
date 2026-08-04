import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const sourceScenePath = path.join(scriptDirectory, "opening-globe-cloud-field.html");
const publicAssetDirectory = path.join(
  repositoryRoot,
  "apps/site/public/assets/lubirth/opening-globe-clouds"
);
const manifestPath = path.join(publicAssetDirectory, "manifest.json");
const ffmpegPath = "/opt/homebrew/bin/ffmpeg";
const ffprobePath = "/opt/homebrew/bin/ffprobe";

const frameRate = 30;
const frameCount = 48;
const authoredDurationSeconds = 1.584;
const encodedDurationSeconds = 1.6;
const sourceSeed = "lubirth-opening-globe-cloud-v1";
const compressionQuality = {
  codec: "h264-all-i-crf-21",
  crf: 21,
  minAveragePsnr: 38,
  minAllSsim: 0.98
};
const variants = [
  {
    tier: "desktop",
    rawWidth: 1536,
    rawHeight: 768,
    maxTransferBytes: 6 * 1024 * 1024,
    maxPackedTextureBytes: 16 * 1024 * 1024
  },
  {
    tier: "mobile",
    rawWidth: 1024,
    rawHeight: 512,
    maxTransferBytes: 2 * 1024 * 1024,
    maxPackedTextureBytes: 8 * 1024 * 1024
  }
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options });
}

function inspectVideo(videoPath) {
  const streamProbe = JSON.parse(run(ffprobePath, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,avg_frame_rate,nb_frames",
    "-of", "json",
    videoPath
  ]));
  const frameProbe = JSON.parse(run(ffprobePath, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "frame=key_frame",
    "-of", "json",
    videoPath
  ]));
  return {
    stream: streamProbe.streams?.[0],
    frames: frameProbe.frames ?? []
  };
}

function measureCompressionFidelity(framePattern, encodedPath) {
  const measure = (filter) => {
    const result = spawnSync(ffmpegPath, [
      "-hide_banner",
      "-framerate", String(frameRate),
      "-start_number", "0",
      "-i", framePattern,
      "-i", encodedPath,
      "-lavfi", filter,
      "-f", "null",
      "-"
    ], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error("Unable to measure encoded globe field fidelity: " + result.stderr);
    }
    return result.stderr;
  };
  const psnrOutput = measure("[0:v][1:v]psnr");
  const ssimOutput = measure("[0:v][1:v]ssim");
  const averagePsnr = Number(psnrOutput.match(/average:([0-9.]+)/)?.[1]);
  const allSsim = Number(ssimOutput.match(/All:([0-9.]+)/)?.[1]);
  if (!Number.isFinite(averagePsnr) || !Number.isFinite(allSsim)) {
    throw new Error("Unable to parse encoded globe field fidelity metrics");
  }
  return { averagePsnr, allSsim };
}

async function bakeVariant(browser, temporaryDirectory, variant) {
  const packedWidth = variant.rawWidth * 2;
  const variantDirectory = path.join(temporaryDirectory, variant.tier);
  await mkdir(variantDirectory, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: packedWidth, height: variant.rawHeight },
    deviceScaleFactor: 1
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(pathToFileURL(sourceScenePath).href, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.renderOpeningGlobeCloudFieldFrame === "function");
  if (errors.length > 0) throw new Error(errors.join("\n"));

  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate((frameIndex) => window.renderOpeningGlobeCloudFieldFrame(frameIndex), frame);
    await page.screenshot({
      path: path.join(variantDirectory, "field-" + String(frame).padStart(3, "0") + ".png")
    });
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  await page.close();

  const encodedPath = path.join(variantDirectory, variant.tier + ".mp4");
  run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error",
    "-framerate", String(frameRate),
    "-start_number", "0",
    "-i", path.join(variantDirectory, "field-%03d.png"),
    "-frames:v", String(frameCount),
    "-an",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", String(compressionQuality.crf),
    "-pix_fmt", "yuv420p",
    "-g", "1",
    "-keyint_min", "1",
    "-sc_threshold", "0",
    "-movflags", "+faststart",
    "-f", "mp4",
    encodedPath
  ]);

  const inspection = inspectVideo(encodedPath);
  if (
    inspection.stream?.width !== packedWidth ||
    inspection.stream?.height !== variant.rawHeight ||
    inspection.stream?.avg_frame_rate !== "30/1" ||
    Number(inspection.stream?.nb_frames) !== frameCount ||
    inspection.frames.length !== frameCount ||
    !inspection.frames.every((frame) => frame.key_frame === 1)
  ) {
    throw new Error("Encoded " + variant.tier + " asset does not satisfy the all-I frame contract");
  }

  const encoded = await readFile(encodedPath);
  const quality = measureCompressionFidelity(
    path.join(variantDirectory, "field-%03d.png"),
    encodedPath
  );
  if (
    quality.averagePsnr < compressionQuality.minAveragePsnr ||
    quality.allSsim < compressionQuality.minAllSsim
  ) {
    throw new Error(
      variant.tier + " asset fails the compression quality gate: PSNR " +
        quality.averagePsnr.toFixed(3) + ", SSIM " + quality.allSsim.toFixed(6)
    );
  }
  if (encoded.byteLength > variant.maxTransferBytes) {
    throw new Error(
      variant.tier + " asset is " + encoded.byteLength + " bytes, above its " +
        variant.maxTransferBytes + " byte transfer gate at CRF " + compressionQuality.crf
    );
  }
  const estimatedPackedTextureBytes = packedWidth * variant.rawHeight * 4;
  if (estimatedPackedTextureBytes > variant.maxPackedTextureBytes) {
    throw new Error(variant.tier + " packed texture residency is above its hard limit");
  }

  return {
    ...variant,
    packedWidth,
    transferBytes: encoded.byteLength,
    estimatedPackedTextureBytes,
    sha256: sha256(encoded),
    quality,
    encoded
  };
}

function manifestFor(results, sourceSha256) {
  const byTier = Object.fromEntries(results.map((result) => [result.tier, {
    tier: result.tier,
    src: "/assets/lubirth/opening-globe-clouds/" + result.tier + ".mp4",
    rawWidth: result.rawWidth,
    rawHeight: result.rawHeight,
    packedWidth: result.packedWidth,
    packedHeight: result.rawHeight,
    frameRate,
    frameCount,
    keyframePolicy: "all-i",
    packing: "left-rgb-right-concavity",
    transferBytes: result.transferBytes,
    maxTransferBytes: result.maxTransferBytes,
    estimatedPackedTextureBytes: result.estimatedPackedTextureBytes,
    maxPackedTextureBytes: result.maxPackedTextureBytes,
    sha256: result.sha256
  }]));
  return {
    schemaVersion: 1,
    id: "lubirth-opening-globe-cloud-field-v1",
    cloudOnly: true,
    mapping: "equirectangular-earth-uv",
    fieldColorSpace: "none",
    packing: "left-rgb-right-concavity",
    authoredDurationSeconds,
    encodedDurationSeconds,
    frameRate,
    frameCount,
    quality: {
      codec: compressionQuality.codec,
      minAveragePsnr: compressionQuality.minAveragePsnr,
      minAllSsim: compressionQuality.minAllSsim,
      variants: Object.fromEntries(results.map((result) => [result.tier, result.quality]))
    },
    source: {
      provenance: "internal-procedural",
      generator: "packages/lubirth-hero/scripts/bake-opening-globe-cloud-assets.mjs",
      generatorVersion: "1.0.0",
      scenePath: "packages/lubirth-hero/scripts/opening-globe-cloud-field.html",
      seed: sourceSeed,
      parameterSummary: {
        densityModel: "analytic high-resolution globe-UV weather field with latitude shaping",
        windDistance: "0.28 radians of deterministic longitudinal advection over 1.6 seconds",
        cloudOnly: "scalar field only; no Earth, Moon, stars, sky, text, or UI",
        packing: "left RGB optical-depth/top-height/morphology | right red concavity",
        colorSpace: "raw scalar data sampled with Three.js NoColorSpace"
      },
      sourceSha256,
      license: "internally-generated"
    },
    handoff: {
      plateEndProgress: 0.18,
      plateEndFrame: 39,
      cutProgress: 0.195,
      cutFrame: 42,
      liveProgress: 0.22,
      liveFrame: 47,
      veilColorSrgb: "#142536"
    },
    variants: byTier
  };
}

async function main() {
  await mkdir(publicAssetDirectory, { recursive: true });
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "miralith-opening-globe-cloud-"));
  const sourceSha256 = sha256(await readFile(sourceScenePath));
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const variant of variants) {
      process.stdout.write("Baking " + variant.tier + " globe field…\n");
      results.push(await bakeVariant(browser, temporaryDirectory, variant));
    }
    for (const result of results) {
      await writeFile(path.join(publicAssetDirectory, result.tier + ".mp4"), result.encoded);
    }
    await writeFile(
      manifestPath,
      JSON.stringify(manifestFor(results, sourceSha256), null, 2) + "\n"
    );
    process.stdout.write(
      results.map((result) => result.tier + ": " + result.transferBytes + " bytes").join("\n") + "\n"
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
