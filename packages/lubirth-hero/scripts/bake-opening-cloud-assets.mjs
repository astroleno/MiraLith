import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const sourceScenePath = path.join(scriptDirectory, "opening-cloud-volume.html");
const publicAssetDirectory = path.join(
  repositoryRoot,
  "apps/site/public/assets/lubirth/opening-clouds"
);
const evidenceDirectory = path.join(
  repositoryRoot,
  "docs/lubirth-cloud-asset-opening-evidence/2026-08-03"
);
const ffmpegPath = "/opt/homebrew/bin/ffmpeg";
const ffprobePath = "/opt/homebrew/bin/ffprobe";

const frameRate = 30;
const frameCount = 48;
const authoredDurationSeconds = 1.584;
const encodedDurationSeconds = 1.6;
const sourceSeed = "lubirth-opening-cloud-v1";
const selectedFrames = [0, 12, 24, 36, 39, 42];
const variants = [
  {
    tier: "desktop",
    width: 1440,
    height: 810,
    maxTransferBytes: 6 * 1024 * 1024,
    maxPresentationResidencyBytes: 16 * 1024 * 1024
  },
  {
    tier: "mobile",
    width: 960,
    height: 444,
    maxTransferBytes: 2 * 1024 * 1024,
    maxPresentationResidencyBytes: 8 * 1024 * 1024
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

async function packRgbaFrame(inputPath, outputPath, width, height) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || info.channels !== 4) {
    throw new Error("Unexpected source frame geometry for " + inputPath);
  }

  const packed = Buffer.alloc(width * 2 * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;
      const rgbIndex = (y * width * 2 + x) * 3;
      const alphaIndex = (y * width * 2 + width + x) * 3;
      const alpha = data[sourceIndex + 3];
      packed[rgbIndex] = data[sourceIndex];
      packed[rgbIndex + 1] = data[sourceIndex + 1];
      packed[rgbIndex + 2] = data[sourceIndex + 2];
      packed[alphaIndex] = alpha;
      packed[alphaIndex + 1] = alpha;
      packed[alphaIndex + 2] = alpha;
    }
  }

  await sharp(packed, {
    raw: { width: width * 2, height, channels: 3 }
  }).png({ compressionLevel: 9, palette: false }).toFile(outputPath);
}

function svgLabel(width, label) {
  return Buffer.from(
    "<svg width=\"" + width + "\" height=\"38\" xmlns=\"http://www.w3.org/2000/svg\">" +
      "<rect width=\"100%\" height=\"100%\" fill=\"#07101b\"/>" +
      "<text x=\"18\" y=\"25\" fill=\"#d9ecff\" font-size=\"16\" font-family=\"Arial, sans-serif\">" +
      label +
      "</text></svg>"
  );
}

async function writeContactSheet(framePaths, outputPath, width, height, labelPrefix) {
  const columns = 3;
  const rows = Math.ceil(framePaths.length / columns);
  const tileWidth = Math.floor(width / columns);
  const tileHeight = Math.round(tileWidth * (height / width));
  const labelHeight = 38;
  const composites = [];
  for (let index = 0; index < framePaths.length; index += 1) {
    const frame = selectedFrames[index];
    const x = (index % columns) * tileWidth;
    const y = Math.floor(index / columns) * (tileHeight + labelHeight);
    const cloudTile = await sharp(framePaths[index])
      .resize(tileWidth, tileHeight, { fit: "cover" })
      .png()
      .toBuffer();
    composites.push({ input: cloudTile, left: x, top: y });
    composites.push({
      input: svgLabel(tileWidth, labelPrefix + " · frame " + String(frame).padStart(2, "0")),
      left: x,
      top: y + tileHeight
    });
  }
  await sharp({
    create: {
      width: tileWidth * columns,
      height: rows * (tileHeight + labelHeight),
      channels: 4,
      background: { r: 9, g: 25, b: 42, alpha: 1 }
    }
  }).composite(composites).png().toFile(outputPath);
}

async function bakeVariant(browser, temporaryDirectory, variant) {
  const variantDirectory = path.join(temporaryDirectory, variant.tier);
  await mkdir(variantDirectory, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(pathToFileURL(sourceScenePath).href, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.renderOpeningCloudFrame === "function");
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const framePaths = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate((frameIndex) => window.renderOpeningCloudFrame(frameIndex), frame);
    const framePath = path.join(variantDirectory, "cloud-" + String(frame).padStart(3, "0") + ".png");
    await page.screenshot({ path: framePath, omitBackground: true });
    framePaths.push(framePath);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  await page.close();

  const packedDirectory = path.join(variantDirectory, "packed");
  await mkdir(packedDirectory, { recursive: true });
  for (let frame = 0; frame < frameCount; frame += 1) {
    await packRgbaFrame(
      framePaths[frame],
      path.join(packedDirectory, "packed-" + String(frame).padStart(3, "0") + ".png"),
      variant.width,
      variant.height
    );
  }

  const encodedPath = path.join(variantDirectory, variant.tier + ".mp4");
  run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error",
    "-framerate", String(frameRate),
    "-start_number", "0",
    "-i", path.join(packedDirectory, "packed-%03d.png"),
    "-frames:v", String(frameCount),
    "-an",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "18",
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
    inspection.stream?.width !== variant.width * 2 ||
    inspection.stream?.height !== variant.height ||
    inspection.stream?.avg_frame_rate !== "30/1" ||
    Number(inspection.stream?.nb_frames) !== frameCount ||
    inspection.frames.length !== frameCount ||
    !inspection.frames.every((frame) => frame.key_frame === 1)
  ) {
    throw new Error("Encoded " + variant.tier + " asset does not satisfy the all-I frame contract");
  }

  const encoded = await readFile(encodedPath);
  if (encoded.byteLength > variant.maxTransferBytes) {
    throw new Error(
      variant.tier + " asset is " + encoded.byteLength + " bytes, above its " +
        variant.maxTransferBytes + " byte quality gate"
    );
  }

  return {
    ...variant,
    encodedPath,
    framePaths,
    transferBytes: encoded.byteLength,
    sha256: sha256(encoded),
    estimatedPresentationResidencyBytes: variant.width * variant.height * 4
  };
}

function manifestFor(results, sourceSha256) {
  const byTier = Object.fromEntries(results.map((result) => [result.tier, {
    tier: result.tier,
    src: "/assets/lubirth/opening-clouds/" + result.tier + ".mp4",
    width: result.width,
    height: result.height,
    packedWidth: result.width * 2,
    packedHeight: result.height,
    frameRate,
    frameCount,
    keyframePolicy: "all-i",
    packing: "left-rgb-right-alpha",
    transferBytes: result.transferBytes,
    maxTransferBytes: result.maxTransferBytes,
    estimatedPresentationResidencyBytes: result.estimatedPresentationResidencyBytes,
    maxPresentationResidencyBytes: result.maxPresentationResidencyBytes,
    sha256: result.sha256
  }]));
  return {
    schemaVersion: 1,
    id: "lubirth-opening-cloud-pack-v1",
    cloudOnly: true,
    colorSpace: "rec709-srgb-sdr",
    packing: "left-rgb-right-alpha",
    authoredDurationSeconds,
    encodedDurationSeconds,
    frameRate,
    frameCount,
    source: {
      provenance: "internal-procedural",
      generator: "packages/lubirth-hero/scripts/bake-opening-cloud-assets.mjs",
      generatorVersion: "1.0.0",
      scenePath: "packages/lubirth-hero/scripts/opening-cloud-volume.html",
      seed: sourceSeed,
      parameterSummary: {
        densityModel: "68-step front-to-back Worley/fBm procedural volume",
        windDistance: "1.6 seconds, diagonal wind plus erosion",
        cloudOnly: "RGBA cloud layer; no Earth, Moon, stars, sky, text, or UI",
        packing: "left RGB | right replicated alpha"
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
  await mkdir(evidenceDirectory, { recursive: true });
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "miralith-opening-cloud-"));
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const variant of variants) {
      process.stdout.write("Baking " + variant.tier + " cloud-only master…\n");
      results.push(await bakeVariant(browser, temporaryDirectory, variant));
    }
    const sourceSha256 = sha256(await readFile(sourceScenePath));
    const manifest = manifestFor(results, sourceSha256);

    for (const result of results) {
      await rename(result.encodedPath, path.join(publicAssetDirectory, result.tier + ".mp4"));
    }
    await writeFile(
      path.join(publicAssetDirectory, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n"
    );
    await writeContactSheet(
      selectedFrames.map((frame) => results[0].framePaths[frame]),
      path.join(evidenceDirectory, "desktop-cloud-contact-sheet.png"),
      results[0].width,
      results[0].height,
      "desktop"
    );
    await writeContactSheet(
      selectedFrames.map((frame) => results[1].framePaths[frame]),
      path.join(evidenceDirectory, "mobile-cloud-contact-sheet.png"),
      results[1].width,
      results[1].height,
      "mobile"
    );
    const checksumLines = [];
    for (const result of results) {
      checksumLines.push(result.sha256 + "  " + result.tier + ".mp4");
    }
    checksumLines.push(sourceSha256 + "  opening-cloud-volume.html");
    await writeFile(path.join(evidenceDirectory, "checksums.sha256"), checksumLines.join("\n") + "\n");
    await writeFile(path.join(evidenceDirectory, "README.md"), [
      "# LuBirth opening cloud asset evidence",
      "",
      "- Source: deterministic internal procedural WebGL2 volume; cloud pixels only.",
      "- Timeline: 48 all-I frames at 30 fps; source duration 1.584s maps to opening progress 0–0.195.",
      "- Handoff: the cloud asset ends under an independent shared veil; real IP Relief-lite remains behind it.",
      "- Desktop/mobile contact sheets show frames 0, 12, 24, 36, 39, and 42 over an evidence-only dark matte.",
      "- `desktop.mp4` and `mobile.mp4` pack RGB in the left half and replicated alpha in the right half.",
      "",
      "The actual payload is transparent cloud media; it contains no baked Earth, moon, sky, copy, or UI."
    ].join("\n") + "\n");
    for (const result of results) {
      const destination = path.join(publicAssetDirectory, result.tier + ".mp4");
      const destinationStat = await stat(destination);
      process.stdout.write(result.tier + ": " + destinationStat.size + " bytes\n");
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
