import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const AUTHORED_DURATION_SECONDS = 1.584;
const ENCODED_DURATION_SECONDS = 1.6;
const FRAME_RATE = 30;
const FRAME_COUNT = 48;
const REFERENCE_CANVAS_SHA256 =
  "72d4b2e45ca8c17cf584dc33acb632c4f651951462838ca29d09faa926fdcaf8";

const VARIANTS = {
  desktop: {
    sourceSha256: "48e7bbbc55afee6784c82a48757ac00d4869909f5b44f93f9da743858badfcec",
    width: 1440,
    height: 810,
    byteCeiling: 6 * 1024 * 1024,
    firstFrameDeadlineMs: 1200,
    maxPresentationResidencyBytes: 16 * 1024 * 1024,
    estimatedPresentationResidencyBytes: 12_830_400,
    safeCrop: { left: 0.06, right: 0.06, top: 0.08, bottom: 0.08 },
    runtimeOverscanScale: 1.04,
    maxNormalizedTranslation: { x: 0.018, y: 0.012 }
  },
  mobile: {
    sourceSha256: "25074f3bb7def94e35f2ad227a13df7468062ffcd192fd57097416d37de3dbef",
    width: 960,
    height: 444,
    byteCeiling: 2 * 1024 * 1024,
    firstFrameDeadlineMs: 1800,
    maxPresentationResidencyBytes: 8 * 1024 * 1024,
    estimatedPresentationResidencyBytes: 4_688_640,
    safeCrop: { left: 0.06, right: 0.06, top: 0.08, bottom: 0.08 },
    runtimeOverscanScale: 1.05,
    maxNormalizedTranslation: { x: 0.015, y: 0.012 }
  }
};

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`invalid argument sequence near ${key ?? "<end>"}`);
    }
    options[key.slice(2)] = value;
  }
  for (const required of [
    "desktop-source",
    "mobile-source",
    "output-root",
    "ffmpeg",
    "ffprobe"
  ]) {
    if (!options[required]) throw new Error(`missing required option --${required}`);
  }
  return options;
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function run(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${label}: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return result.stdout;
}

function firstVersionLine(command) {
  return run(command, ["-version"], `${command} version`).split("\n")[0].trim();
}

function probeMedia(ffprobe, filePath, includeFrames) {
  const args = [
    "-v",
    "error",
    "-count_frames",
    ...(includeFrames ? ["-show_frames", "-show_entries", "frame=key_frame,pict_type"] : []),
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    filePath
  ];
  return JSON.parse(run(ffprobe, args, `ffprobe ${path.basename(filePath)}`));
}

function validateProbe(probe, contract, label, requireAllI) {
  const streams = probe.streams ?? [];
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  if (videoStreams.length !== 1) throw new Error(`${label}: expected exactly one video stream`);
  if (audioStreams.length !== 0) throw new Error(`${label}: audio is not allowed`);
  const video = videoStreams[0];
  if (video.width !== contract.width || video.height !== contract.height) {
    throw new Error(`${label}: expected ${contract.width}x${contract.height}`);
  }
  if (video.pix_fmt !== "yuv420p") throw new Error(`${label}: expected opaque yuv420p`);
  if (video.color_primaries !== "bt709" || video.color_transfer !== "bt709" || video.color_space !== "bt709") {
    throw new Error(`${label}: expected SDR BT.709 metadata`);
  }
  if (video.r_frame_rate !== "30/1") throw new Error(`${label}: expected 30 fps`);
  const frames = Number(video.nb_read_frames ?? video.nb_frames);
  if (frames !== FRAME_COUNT) throw new Error(`${label}: expected ${FRAME_COUNT} frames, got ${frames}`);
  const duration = Number(probe.format?.duration);
  if (Math.abs(duration - ENCODED_DURATION_SECONDS) > 1 / FRAME_RATE) {
    throw new Error(`${label}: unsupported duration ${duration}`);
  }
  if (requireAllI) {
    const nonI = (probe.frames ?? []).filter(
      (frame) => Number(frame.key_frame) !== 1 || frame.pict_type !== "I"
    ).length;
    if ((probe.frames ?? []).length !== FRAME_COUNT || nonI !== 0) {
      throw new Error(`${label}: output is not ${FRAME_COUNT}/${FRAME_COUNT} all-I`);
    }
  }
}

function transcode(ffmpeg, source, output) {
  run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-map",
      "0:v:0",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-tune",
      "stillimage",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "18",
      "-g",
      "1",
      "-keyint_min",
      "1",
      "-sc_threshold",
      "0",
      "-bf",
      "0",
      "-x264-params",
      "keyint=1:min-keyint=1:scenecut=0",
      "-movflags",
      "+faststart",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-colorspace",
      "bt709",
      output
    ],
    `ffmpeg ${path.basename(source)}`
  );
}

function createVariant(tier, contract, sourcePath, outputPath, outputSha256) {
  return {
    tier,
    src: `/assets/lubirth/cinematic-prelude/${tier}.mp4`,
    sourceSha256: contract.sourceSha256,
    sha256: outputSha256,
    transferBytes: statSync(outputPath).size,
    width: contract.width,
    height: contract.height,
    frameRate: FRAME_RATE,
    frameCount: FRAME_COUNT,
    durationSeconds: ENCODED_DURATION_SECONDS,
    keyframePolicy: "all-i",
    colorSpace: "rec709-srgb-sdr",
    opaque: true,
    audio: false,
    firstFrameDeadlineMs: contract.firstFrameDeadlineMs,
    maxPresentationResidencyBytes: contract.maxPresentationResidencyBytes,
    estimatedPresentationResidencyBytes: contract.estimatedPresentationResidencyBytes,
    safeCrop: contract.safeCrop,
    runtimeOverscanScale: contract.runtimeOverscanScale,
    maxNormalizedTranslation: contract.maxNormalizedTranslation,
    sourceBytes: statSync(sourcePath).size
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sources = {
    desktop: path.resolve(options["desktop-source"]),
    mobile: path.resolve(options["mobile-source"])
  };
  for (const tier of ["desktop", "mobile"]) {
    if (!existsSync(sources[tier])) {
      throw new Error(`${tier} source does not exist: ${sources[tier]}`);
    }
    const actualHash = sha256(sources[tier]);
    if (actualHash !== VARIANTS[tier].sourceSha256) {
      throw new Error(`${tier} source SHA-256 is not the approved master: ${actualHash}`);
    }
  }

  const outputRoot = path.resolve(options["output-root"]);
  mkdirSync(outputRoot, { recursive: true });
  const suffix = `.tmp-${process.pid}-${randomUUID()}`;
  const staged = {
    desktop: path.join(outputRoot, `desktop${suffix}.mp4`),
    mobile: path.join(outputRoot, `mobile${suffix}.mp4`),
    manifest: path.join(outputRoot, `manifest${suffix}.json`)
  };

  for (const tier of ["desktop", "mobile"]) {
    const sourceProbe = probeMedia(options.ffprobe, sources[tier], false);
    validateProbe(sourceProbe, VARIANTS[tier], `${tier} source`, false);
    transcode(options.ffmpeg, sources[tier], staged[tier]);
    const outputProbe = probeMedia(options.ffprobe, staged[tier], true);
    validateProbe(outputProbe, VARIANTS[tier], `${tier} output`, true);
    if (statSync(staged[tier]).size > VARIANTS[tier].byteCeiling) {
      throw new Error(`${tier} output exceeds hard transfer budget`);
    }
  }

  const manifest = {
    schemaVersion: 1,
    id: "lubirth-normalized-cinematic-prelude-v1",
    authoredDurationSeconds: AUTHORED_DURATION_SECONDS,
    encodedDurationSeconds: ENCODED_DURATION_SECONDS,
    source: {
      license: "internally-generated",
      renderer: "HyperFrames",
      rendererVersion: "0.7.88",
      scenePath: "lubirth-cinematic-prelude-master-2026-07-31/hyperframes/{desktop,mobile}/index.html",
      seed: null,
      parameterSummary: {
        cameraRetreatScale: "3.8-4.2%",
        cloudEntrySeconds: 1.296,
        occlusionPeakSeconds: 1.404,
        sourceStillGenerator: "OpenAI ImageGen",
        sourceStillSeedAvailable: false
      },
      referenceCanvasSha256: REFERENCE_CANVAS_SHA256,
      toolVersions: {
        ffmpeg: firstVersionLine(options.ffmpeg),
        ffprobe: firstVersionLine(options.ffprobe),
        encoder: "libx264 crf18 all-I"
      }
    },
    handoff: {
      plateEndProgress: 0.18,
      cutProgress: 0.195,
      veilPeakProgress: 0.195,
      liveProgress: 0.22,
      cloudEntryFrame: 39,
      cutFrame: 42,
      liveFrame: 47,
      veilProfile: {
        colorSrgb: "#142536",
        luminanceY: 0.018,
        peakOpacity: 1,
        edgeSoftness: 0.18
      }
    },
    variants: {
      desktop: createVariant(
        "desktop",
        VARIANTS.desktop,
        sources.desktop,
        staged.desktop,
        sha256(staged.desktop)
      ),
      mobile: createVariant(
        "mobile",
        VARIANTS.mobile,
        sources.mobile,
        staged.mobile,
        sha256(staged.mobile)
      )
    }
  };

  writeFileSync(staged.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  renameSync(staged.desktop, path.join(outputRoot, "desktop.mp4"));
  renameSync(staged.mobile, path.join(outputRoot, "mobile.mp4"));
  renameSync(staged.manifest, path.join(outputRoot, "manifest.json"));
  process.stdout.write(`${JSON.stringify({ ok: true, outputRoot, manifest }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
