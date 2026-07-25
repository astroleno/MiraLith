import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  POST_COSCROLL_MEDIA_SOURCE_SPEC,
  POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256
} from "../content/postCoScrollMediaSource.ts";
import { checkPostCoScrollMediaToolchain } from "./check-post-coscroll-media-toolchain.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteDirectory = resolve(scriptDirectory, "..");
const repoRoot = resolve(siteDirectory, "../..");
const defaultFreezeFile = join(
  repoRoot,
  "docs/post-coscroll/evidence/cp0.4-b-ring-first-v9-editorial-freeze.json"
);

class MediaPreparationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MediaPreparationError";
    this.code = code;
    this.details = details;
  }
}

function parseArgs(argv) {
  const options = {
    sourceRoot: null,
    sourceFiles: new Map(),
    outputRoot: null,
    editorialFreezeFile: defaultFreezeFile,
    ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg",
    ffprobe: process.env.FFPROBE_PATH ?? "ffprobe",
    checkOnly: false,
    printPlan: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--check-only") {
      options.checkOnly = true;
      continue;
    }
    if (argument === "--print-plan") {
      options.printPlan = true;
      continue;
    }
    if (argument === "--source-file") {
      const value = argv[index + 1];
      const separator = value?.indexOf("=") ?? -1;
      if (separator <= 0 || separator === value.length - 1) {
        throw new MediaPreparationError(
          "ARGUMENT_ERROR",
          "--source-file requires an id=/absolute/or/relative/path value."
        );
      }
      const sourceId = value.slice(0, separator);
      if (options.sourceFiles.has(sourceId)) {
        throw new MediaPreparationError(
          "ARGUMENT_ERROR",
          `--source-file was provided more than once for ${sourceId}.`
        );
      }
      options.sourceFiles.set(sourceId, resolve(value.slice(separator + 1)));
      index += 1;
      continue;
    }
    const keys = {
      "--source-root": "sourceRoot",
      "--output-root": "outputRoot",
      "--editorial-freeze-file": "editorialFreezeFile",
      "--ffmpeg": "ffmpeg",
      "--ffprobe": "ffprobe"
    };
    const key = keys[argument];
    if (!key) throw new MediaPreparationError("ARGUMENT_ERROR", `Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value) {
      throw new MediaPreparationError("ARGUMENT_ERROR", `${argument} requires a value.`);
    }
    options[key] = resolve(value);
    index += 1;
  }
  if (!options.printPlan && (!options.sourceRoot || !options.outputRoot)) {
    throw new MediaPreparationError(
      "ARGUMENT_ERROR",
      "--source-root and --output-root are both required."
    );
  }
  return options;
}

function ptsToSeconds(pts, sourceTimeBase) {
  const [numerator, denominator] = sourceTimeBase.split("/").map(Number);
  return Number(((pts * numerator) / denominator).toFixed(9));
}

function variantEncodingIntent(clip, source, variantName) {
  const durationSeconds = expectedClipDurationSeconds(clip, source);
  const intent = clip.variants[variantName];
  const audioBitrateBitsPerSecond =
    clip.audio.policy === "source-on-unlock"
      ? variantName === "desktop"
        ? 160_000
        : 128_000
      : 0;
  const averageVideoBitrateCap = variantName === "desktop" ? 2_800_000 : 1_400_000;
  const budgetVideoBitrate =
    (intent.maxBytes * 8 * 0.95) / durationSeconds - audioBitrateBitsPerSecond;
  const targetVideoBitrateBitsPerSecond =
    Math.floor(Math.min(averageVideoBitrateCap, budgetVideoBitrate) / 1_000) * 1_000;

  if (targetVideoBitrateBitsPerSecond < 100_000) {
    throw new MediaPreparationError(
      "MEDIA_BUDGET_IMPOSSIBLE",
      `${clip.id} ${variantName} leaves less than 100kb/s for video.`
    );
  }

  return {
    rateControl: "two-pass-abr",
    targetVideoBitrateBitsPerSecond,
    audioBitrateBitsPerSecond,
    budgetHeadroomRatio: 0.05,
    outputPixelFormat: "yuv420p",
    outputColorRange: "tv"
  };
}

export function buildPostCoScrollTranscodePlan() {
  return {
    kind: "miralith-post-coscroll-transcode-plan",
    version: 1,
    sourceSpecSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256,
    editorialFreezeSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256,
    clips: POST_COSCROLL_MEDIA_SOURCE_SPEC.clips.map((clip) => {
      const source = POST_COSCROLL_MEDIA_SOURCE_SPEC.sources.find(
        (candidate) => candidate.id === clip.sourceId
      );
      const sourceFrameRangesHalfOpen =
        source?.frameStepPTS && clip.sourceSegments.length > 0
          ? clip.sourceSegments.map((segment) => [
              segment.startPTS / source.frameStepPTS,
              segment.endPTSExclusive / source.frameStepPTS
            ])
          : [];
      const sourceFrameCount = sourceFrameRangesHalfOpen.reduce(
        (total, [start, end]) => total + end - start,
        0
      );
      const transitionExpansion =
        clip.id === "artbreeze-first-sequence" && clip.editorial
          ? clip.editorial.returnTransitionFrames - 1
          : 0;
      const expectedFrameCount = sourceFrameCount + transitionExpansion;
      const expectedDurationSeconds =
        source?.sourceFrameRate === "30/1"
          ? Number((expectedFrameCount / 30).toFixed(9))
          : source?.sourceTimeBase
            ? Number(
                clip.sourceSegments
                  .reduce(
                    (total, segment) =>
                      total +
                      ptsToSeconds(
                        segment.endPTSExclusive - segment.startPTS,
                        source.sourceTimeBase
                      ),
                    0
                  )
                  .toFixed(9)
              )
            : 0;

      const base = {
        id: clip.id,
        workId: clip.workId,
        availability: clip.availability,
        mode: clip.mode,
        sourceId: clip.sourceId,
        sourceSegments: clip.sourceSegments,
        sourceFrameRangesHalfOpen,
        expectedFrameCount,
        expectedDurationSeconds,
        poster: clip.poster,
        variants: clip.variants,
        variantEncoding:
          clip.availability === "available" && clip.variants && source
            ? {
                desktop: variantEncodingIntent(clip, source, "desktop"),
                mobile: variantEncodingIntent(clip, source, "mobile")
              }
            : null
      };
      if (clip.id !== "artbreeze-first-sequence" || !clip.editorial || !source) {
        return {
          ...base,
          video: {
            kind: clip.mode === "frame-hold" ? "frame-hold" : "pts-concat",
            sourceFrameRangesHalfOpen
          },
          audio: {
            policy: clip.audio.policy,
            sourceRangesSecondsHalfOpen: source?.sourceTimeBase
              ? clip.sourceSegments.map((segment) => [
                  ptsToSeconds(segment.startPTS, source.sourceTimeBase),
                  ptsToSeconds(segment.endPTSExclusive, source.sourceTimeBase)
                ])
              : []
          }
        };
      }

      return {
        ...base,
        video: {
          kind: "ring-first-reorder",
          sourceFrameRangesHalfOpen,
          transitionFrames: clip.editorial.returnTransitionFrames,
          outputOrder: [
            "source[355,556)",
            "blend(n555,n4)[1/4…4/4]",
            "source[5,355)"
          ]
        },
        audio: {
          policy: clip.audio.policy,
          sourceRangesSecondsHalfOpen: clip.sourceSegments.map((segment) => [
            ptsToSeconds(segment.startPTS, source.sourceTimeBase),
            ptsToSeconds(segment.endPTSExclusive, source.sourceTimeBase)
          ]),
          restartSilenceSeconds: clip.editorial.restartSilenceSeconds,
          fadeSeconds: clip.editorial.sourceAudioFadeSeconds
        }
      };
    })
  };
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256File(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function isWithinRoot(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function assertDirectory(path, code) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new MediaPreparationError(code, `${path} is not an existing directory.`);
  }
}

function validateRoots(options) {
  assertDirectory(options.sourceRoot, "SOURCE_ROOT_MISSING");
  if (resolve(options.sourceRoot) === resolve(options.outputRoot)) {
    throw new MediaPreparationError(
      "OUTPUT_ROOT_UNSAFE",
      "The output root must not equal the source root."
    );
  }
  if (
    isWithinRoot(resolve(options.sourceRoot), resolve(options.outputRoot)) ||
    isWithinRoot(resolve(options.outputRoot), resolve(options.sourceRoot))
  ) {
    throw new MediaPreparationError(
      "OUTPUT_ROOT_UNSAFE",
      "The source root and generated output root must not contain one another."
    );
  }
  for (const sourcePath of sourceFileOverrideEntries(options).map(([, path]) => path)) {
    if (isWithinRoot(resolve(options.outputRoot), resolve(sourcePath))) {
      throw new MediaPreparationError(
        "OUTPUT_ROOT_UNSAFE",
        "The generated output root must not contain an explicit source file."
      );
    }
  }
}

function validateSourceSpecHash() {
  const actual = sha256Buffer(Buffer.from(JSON.stringify(POST_COSCROLL_MEDIA_SOURCE_SPEC)));
  if (actual !== POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256) {
    throw new MediaPreparationError(
      "SOURCE_SPEC_HASH_MISMATCH",
      `Committed source spec digest is stale: expected ${POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256}, got ${actual}.`
    );
  }
}

function validateFreeze(freezeFile) {
  if (!existsSync(freezeFile)) {
    throw new MediaPreparationError(
      "EDITORIAL_FREEZE_MISSING",
      `Editorial freeze file is missing: ${freezeFile}`
    );
  }
  const buffer = readFileSync(freezeFile);
  const actual = sha256Buffer(buffer);
  if (actual !== POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256) {
    throw new MediaPreparationError(
      "EDITORIAL_FREEZE_HASH_MISMATCH",
      `Expected ${POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256}, got ${actual}.`
    );
  }

  let freeze;
  try {
    freeze = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new MediaPreparationError(
      "EDITORIAL_FREEZE_INVALID",
      error instanceof Error ? error.message : String(error)
    );
  }
  if (
    freeze.freezeVersion !== POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.version ||
    freeze.selectedMedia?.linear?.sha256 !==
      POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.selectedLinearSha256
  ) {
    throw new MediaPreparationError(
      "EDITORIAL_FREEZE_IDENTITY_MISMATCH",
      "Editorial freeze version or selected B v9 media identity does not match the source spec."
    );
  }
}

function sourceFileOverrideEntries(options) {
  if (options.sourceFiles instanceof Map) return [...options.sourceFiles.entries()];
  return Object.entries(options.sourceFiles ?? {});
}

function validateSourceFileOverrides(options) {
  const knownSourceIds = new Set(
    POST_COSCROLL_MEDIA_SOURCE_SPEC.sources.map((source) => source.id)
  );
  for (const [sourceId] of sourceFileOverrideEntries(options)) {
    if (!knownSourceIds.has(sourceId)) {
      throw new MediaPreparationError(
        "UNKNOWN_SOURCE_FILE_ID",
        `Unknown --source-file id: ${sourceId}.`
      );
    }
  }
}

function sourcePathFor(options, source) {
  const override = sourceFileOverrideEntries(options).find(([sourceId]) => sourceId === source.id);
  return override?.[1] ?? resolve(options.sourceRoot, source.sourceFileLabel);
}

function collectMissingSources(options) {
  const missing = [];
  for (const source of POST_COSCROLL_MEDIA_SOURCE_SPEC.sources) {
    if (source.availability === "pending") continue;
    if (source.availability === "missing-required" || !source.sourceFileLabel) {
      missing.push(source.id);
      continue;
    }
    const candidate = sourcePathFor(options, source);
    const hasExplicitSourceFile = sourceFileOverrideEntries(options).some(
      ([sourceId]) => sourceId === source.id
    );
    if (
      (!hasExplicitSourceFile && !isWithinRoot(resolve(options.sourceRoot), candidate)) ||
      !existsSync(candidate) ||
      !statSync(candidate).isFile()
    ) {
      missing.push(source.id);
    }
  }
  return missing;
}

function validateToolchain(options) {
  const report = checkPostCoScrollMediaToolchain({
    ffmpeg: options.ffmpeg,
    ffprobe: options.ffprobe
  });
  if (!report.ok) {
    throw new MediaPreparationError(
      "MEDIA_TOOLCHAIN_INVALID",
      report.errors.map((error) => `${error.code}: ${error.message}`).join("; "),
      { report }
    );
  }
  return report;
}

export function preflightPostCoScrollMedia(options) {
  validateRoots(options);
  validateSourceFileOverrides(options);
  const toolchain = validateToolchain(options);
  validateSourceSpecHash();
  validateFreeze(options.editorialFreezeFile);
  const missingSourceIds = collectMissingSources(options);
  if (missingSourceIds.length > 0) {
    throw new MediaPreparationError(
      "MISSING_SOURCE_IDS",
      `Missing required source ids: ${missingSourceIds.join(", ")}`,
      { missingSourceIds }
    );
  }
  return { toolchain, missingSourceIds: [] };
}

function runCommand(binary, args, { captureStdout = false, label = binary } = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", captureStdout ? "pipe" : "ignore", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    if (child.stdout) child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk);
      if (stderr.reduce((total, item) => total + item.length, 0) > 2_000_000) {
        stderr.shift();
      }
    });
    child.on("error", (error) => {
      reject(
        new MediaPreparationError(
          "MEDIA_COMMAND_UNAVAILABLE",
          `${label} could not start: ${error.message}`
        )
      );
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new MediaPreparationError(
            "MEDIA_COMMAND_FAILED",
            `${label} exited with ${String(code)}: ${Buffer.concat(stderr).toString("utf8").trim()}`
          )
        );
        return;
      }
      resolveCommand({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

async function ffprobeJson(ffprobe, path, countFrames = false) {
  const args = [
    "-v",
    "error",
    ...(countFrames ? ["-count_frames"] : []),
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    path
  ];
  const result = await runCommand(ffprobe, args, {
    captureStdout: true,
    label: `ffprobe ${basename(path)}`
  });
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new MediaPreparationError(
      "FFPROBE_JSON_INVALID",
      `Could not parse FFprobe output for ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function parseFrameMd5(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter((line) => /^\s*\d+,/.test(line))
    .map((line) => line.split(",").at(-1)?.trim())
    .filter(Boolean);
}

async function decodedFrameMd5s(ffmpeg, path) {
  const result = await runCommand(
    ffmpeg,
    ["-v", "error", "-i", path, "-map", "0:v:0", "-an", "-f", "framemd5", "-"],
    { captureStdout: true, label: `framemd5 ${basename(path)}` }
  );
  return parseFrameMd5(result.stdout);
}

function sourceMetadataIssues(source, probe) {
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const issues = [];
  if (!video) return ["video stream missing"];
  if (video.codec_name !== source.video.codec) issues.push(`codec ${video.codec_name}`);
  if (video.width !== source.video.width || video.height !== source.video.height) {
    issues.push(`raster ${video.width}x${video.height}`);
  }
  if (video.time_base !== source.sourceTimeBase) issues.push(`time_base ${video.time_base}`);
  if (video.avg_frame_rate !== source.sourceFrameRate) {
    issues.push(`frame_rate ${video.avg_frame_rate}`);
  }
  if (Number(video.duration_ts) !== source.durationPTS) {
    issues.push(`duration_ts ${String(video.duration_ts)}`);
  }
  if (!audio) {
    issues.push("audio stream missing");
  } else {
    if (audio.codec_name !== source.audio.codec) issues.push(`audio codec ${audio.codec_name}`);
    if (Number(audio.sample_rate) !== source.audio.sampleRate) {
      issues.push(`sample rate ${String(audio.sample_rate)}`);
    }
    if (audio.channels !== source.audio.channels) issues.push(`channels ${String(audio.channels)}`);
  }
  return issues;
}

function expectedSourceFrameCount(source) {
  return source.durationPTS && source.frameStepPTS
    ? source.durationPTS / source.frameStepPTS
    : null;
}

function verifyClipSourceFrameHashes(source, frameMd5s) {
  for (const clip of POST_COSCROLL_MEDIA_SOURCE_SPEC.clips.filter(
    (candidate) => candidate.sourceId === source.id && candidate.availability === "available"
  )) {
    for (const segment of clip.sourceSegments) {
      const firstFrame = segment.startPTS / source.frameStepPTS;
      const lastFrame = segment.endPTSExclusive / source.frameStepPTS - 1;
      if (frameMd5s[firstFrame] !== segment.firstFrameMd5) {
        throw new MediaPreparationError(
          "SOURCE_FIRST_FRAME_HASH_MISMATCH",
          `${clip.id} source frame ${firstFrame} does not match committed MD5.`
        );
      }
      if (frameMd5s[lastFrame] !== segment.lastIncludedFrameMd5) {
        throw new MediaPreparationError(
          "SOURCE_LAST_FRAME_HASH_MISMATCH",
          `${clip.id} source frame ${lastFrame} does not match committed MD5.`
        );
      }
    }
    if (clip.excludedSourceSentinel) {
      const sentinel = clip.excludedSourceSentinel;
      if (frameMd5s[sentinel.sourceFrame] !== sentinel.frameMd5) {
        throw new MediaPreparationError(
          "SOURCE_EXCLUDED_SENTINEL_HASH_MISMATCH",
          `${clip.id} excluded ${sentinel.content} frame does not match committed MD5.`
        );
      }
    }
  }
}

async function verifyAvailableSource(options, source) {
  const path = sourcePathFor(options, source);
  process.stderr.write(`verify source ${source.id}\n`);
  const [sourceSha256, probe, frameMd5s] = await Promise.all([
    sha256File(path),
    ffprobeJson(options.ffprobe, path),
    decodedFrameMd5s(options.ffmpeg, path)
  ]);
  if (sourceSha256 !== source.sourceSha256) {
    throw new MediaPreparationError(
      "SOURCE_SHA256_MISMATCH",
      `${source.id} expected ${source.sourceSha256}, got ${sourceSha256}.`
    );
  }
  const metadata = await stat(path);
  if (metadata.size !== source.sourceBytes) {
    throw new MediaPreparationError(
      "SOURCE_BYTES_MISMATCH",
      `${source.id} expected ${source.sourceBytes} bytes, got ${metadata.size}.`
    );
  }
  const metadataIssues = sourceMetadataIssues(source, probe);
  if (metadataIssues.length > 0) {
    throw new MediaPreparationError(
      "SOURCE_METADATA_MISMATCH",
      `${source.id}: ${metadataIssues.join(", ")}`
    );
  }
  const expectedFrames = expectedSourceFrameCount(source);
  if (expectedFrames !== frameMd5s.length) {
    throw new MediaPreparationError(
      "SOURCE_FRAME_COUNT_MISMATCH",
      `${source.id} expected ${String(expectedFrames)} frames, decoded ${frameMd5s.length}.`
    );
  }
  verifyClipSourceFrameHashes(source, frameMd5s);
  return {
    spec: source,
    path,
    probe,
    frameMd5s,
    sourceSha256
  };
}

async function verifyAvailableSources(options) {
  const result = new Map();
  for (const source of POST_COSCROLL_MEDIA_SOURCE_SPEC.sources) {
    if (source.availability !== "available") continue;
    result.set(source.id, await verifyAvailableSource(options, source));
  }
  return result;
}

function videoScaleFilter(width, height) {
  return [
    `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease:` +
      "flags=lanczos:in_range=auto:out_range=tv",
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1",
    "setparams=range=limited",
    "format=yuv420p"
  ].join(",");
}

function genericVideoFilter(clip, width, height) {
  const pieces = clip.sourceSegments.map(
    (segment, index) =>
      `[0:v]trim=start_pts=${segment.startPTS}:end_pts=${segment.endPTSExclusive},` +
      `setpts=PTS-STARTPTS[v${index}]`
  );
  const inputLabels = clip.sourceSegments.map((_, index) => `[v${index}]`).join("");
  if (clip.sourceSegments.length === 1) {
    pieces.push(`[v0]${videoScaleFilter(width, height)}[vout]`);
  } else {
    pieces.push(
      `${inputLabels}concat=n=${clip.sourceSegments.length}:v=1:a=0[vcat]`,
      `[vcat]${videoScaleFilter(width, height)}[vout]`
    );
  }
  return pieces;
}

function genericAudioFilter(clip, source) {
  if (clip.audio.policy !== "source-on-unlock") return [];
  const pieces = clip.sourceSegments.map((segment, index) => {
    const start = ptsToSeconds(segment.startPTS, source.sourceTimeBase);
    const end = ptsToSeconds(segment.endPTSExclusive, source.sourceTimeBase);
    return `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${index}]`;
  });
  if (clip.sourceSegments.length === 1) {
    pieces.push("[a0]anull[aout]");
  } else {
    pieces.push(
      `${clip.sourceSegments.map((_, index) => `[a${index}]`).join("")}` +
        `concat=n=${clip.sourceSegments.length}:v=0:a=1[aout]`
    );
  }
  return pieces;
}

function firstSequenceFilter(clip, source, width, height) {
  const [ring, waiting] = clip.sourceSegments;
  const step = source.frameStepPTS;
  const ringLastStart = ring.endPTSExclusive - step;
  const waitingFirstEnd = waiting.startPTS + step;
  const waitingTailStart = waitingFirstEnd;
  const transitionFrames = clip.editorial.returnTransitionFrames;
  const firstDuration = ptsToSeconds(ring.endPTSExclusive - ring.startPTS, source.sourceTimeBase);
  const secondStart = ptsToSeconds(waiting.startPTS, source.sourceTimeBase);
  const secondEnd = ptsToSeconds(waiting.endPTSExclusive, source.sourceTimeBase);
  const firstStart = ptsToSeconds(ring.startPTS, source.sourceTimeBase);
  const firstEnd = ptsToSeconds(ring.endPTSExclusive, source.sourceTimeBase);
  const fade = clip.editorial.sourceAudioFadeSeconds;

  return {
    video: [
      `[0:v]trim=start_pts=${ring.startPTS}:end_pts=${ring.endPTSExclusive},setpts=PTS-STARTPTS[ring]`,
      `[0:v]trim=start_pts=${ringLastStart}:end_pts=${ring.endPTSExclusive},` +
        `setpts=PTS-STARTPTS,loop=loop=${transitionFrames - 1}:size=1:start=0,` +
        "setpts=N/(30*TB)[left]",
      `[0:v]trim=start_pts=${waiting.startPTS}:end_pts=${waitingFirstEnd},` +
        `setpts=PTS-STARTPTS,loop=loop=${transitionFrames - 1}:size=1:start=0,` +
        "setpts=N/(30*TB)[right]",
      `[left][right]blend=all_expr=A*(1-(N+1)/${transitionFrames})+B*((N+1)/${transitionFrames}):` +
        "shortest=1[return]",
      `[0:v]trim=start_pts=${waitingTailStart}:end_pts=${waiting.endPTSExclusive},` +
        "setpts=PTS-STARTPTS[waiting]",
      "[ring][return][waiting]concat=n=3:v=1:a=0[vcat]",
      `[vcat]${videoScaleFilter(width, height)}[vout]`
    ],
    audio: [
      `[0:a]atrim=start=${firstStart}:end=${firstEnd},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=${fade},afade=t=out:st=${firstDuration - fade}:d=${fade}[aring]`,
      `anullsrc=r=${source.audio.sampleRate}:cl=${
        source.audio.channels === 1 ? "mono" : "stereo"
      }:d=${clip.editorial.restartSilenceSeconds}[gap]`,
      `[0:a]atrim=start=${secondStart}:end=${secondEnd},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=${fade}[awaiting]`,
      "[aring][gap][awaiting]concat=n=3:v=0:a=1[aout]"
    ]
  };
}

function expectedClipFrameCount(clip, source) {
  const sourceFrames = clip.sourceSegments.reduce(
    (total, segment) =>
      total + (segment.endPTSExclusive - segment.startPTS) / source.frameStepPTS,
    0
  );
  return (
    sourceFrames +
    (clip.id === "artbreeze-first-sequence"
      ? clip.editorial.returnTransitionFrames - 1
      : 0)
  );
}

function expectedClipDurationSeconds(clip, source) {
  return expectedClipFrameCount(clip, source) / 30;
}

async function encodeVariant(options, clip, sourceRecord, variantName, outputPath) {
  const intent = clip.variants[variantName];
  const height = variantName === "desktop" ? 1_080 : 540;
  const filters =
    clip.id === "artbreeze-first-sequence"
      ? firstSequenceFilter(clip, sourceRecord.spec, intent.width, height)
      : {
          video: genericVideoFilter(clip, intent.width, height),
          audio: genericAudioFilter(clip, sourceRecord.spec)
        };
  const hasAudio = clip.audio.policy === "source-on-unlock";
  const encoding = variantEncodingIntent(clip, sourceRecord.spec, variantName);
  const duration = expectedClipDurationSeconds(clip, sourceRecord.spec).toFixed(9);
  const passLogFile = `${outputPath}.x264-pass`;
  const commonVideoArgs = [
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-b:v",
    String(encoding.targetVideoBitrateBitsPerSecond),
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-color_range",
    "tv",
    "-g",
    String(intent.keyframeIntervalFrames),
    "-keyint_min",
    String(intent.keyframeIntervalFrames),
    "-sc_threshold",
    "0",
    "-fps_mode",
    "cfr",
    "-t",
    duration
  ];
  const firstPassArgs = [
    "-y",
    "-v",
    "error",
    "-i",
    sourceRecord.path,
    "-filter_complex",
    filters.video.join(";"),
    "-map",
    "[vout]",
    "-an",
    ...commonVideoArgs,
    "-pass",
    "1",
    "-passlogfile",
    passLogFile,
    "-f",
    "null",
    "-"
  ];
  const secondPassArgs = [
    "-y",
    "-v",
    "error",
    "-i",
    sourceRecord.path,
    "-filter_complex",
    [...filters.video, ...filters.audio].join(";"),
    "-map",
    "[vout]",
    ...(hasAudio ? ["-map", "[aout]"] : ["-an"]),
    ...commonVideoArgs,
    "-pass",
    "2",
    "-passlogfile",
    passLogFile,
    ...(hasAudio
      ? [
          "-c:a",
          "aac",
          "-b:a",
          String(encoding.audioBitrateBitsPerSecond),
          "-ar",
          String(sourceRecord.spec.audio.sampleRate),
          "-ac",
          String(sourceRecord.spec.audio.channels)
        ]
      : []),
    "-movflags",
    "+faststart",
    "-video_track_timescale",
    "90000",
    outputPath
  ];
  try {
    await runCommand(options.ffmpeg, firstPassArgs, {
      label: `encode ${clip.id} ${variantName} pass 1`
    });
    await runCommand(options.ffmpeg, secondPassArgs, {
      label: `encode ${clip.id} ${variantName} pass 2`
    });
  } finally {
    await Promise.all([
      rm(`${passLogFile}-0.log`, { force: true }),
      rm(`${passLogFile}-0.log.mbtree`, { force: true })
    ]);
  }
}

async function encodePoster(options, clip, sourceRecord, outputPath) {
  const startPTS = clip.poster.sourcePTS;
  const endPTS = startPTS + sourceRecord.spec.frameStepPTS;
  const filter =
    `trim=start_pts=${startPTS}:end_pts=${endPTS},setpts=PTS-STARTPTS,` +
    videoScaleFilter(960, 540).replace(",format=yuv420p", "");
  await runCommand(
    options.ffmpeg,
    [
      "-y",
      "-v",
      "error",
      "-i",
      sourceRecord.path,
      "-an",
      "-vf",
      filter,
      "-frames:v",
      "1",
      "-c:v",
      "mjpeg",
      "-q:v",
      "5",
      outputPath
    ],
    { label: `poster ${clip.id}` }
  );
}

function mp4HasFastStart(buffer) {
  const moov = buffer.indexOf(Buffer.from("moov"));
  const mdat = buffer.indexOf(Buffer.from("mdat"));
  return moov >= 0 && mdat >= 0 && moov < mdat;
}

async function inspectDerivedVideo(options, path, clip, source, intent, variantName) {
  const [buffer, probe, outputFrameMd5s] = await Promise.all([
    readFile(path),
    ffprobeJson(options.ffprobe, path, true),
    decodedFrameMd5s(options.ffmpeg, path)
  ]);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const expectedFrames = expectedClipFrameCount(clip, source);
  const expectedDuration = expectedClipDurationSeconds(clip, source);
  const outputHeight = variantName === "desktop" ? 1_080 : 540;
  const actualDuration = Number(video?.duration ?? probe.format?.duration);
  const fastStart = mp4HasFastStart(buffer);
  const issues = [];
  if (video?.codec_name !== "h264") issues.push(`codec=${String(video?.codec_name)}`);
  if (video?.pix_fmt !== "yuv420p") issues.push(`pix_fmt=${String(video?.pix_fmt)}`);
  if (video?.width !== intent.width || video?.height !== outputHeight) {
    issues.push(`raster=${String(video?.width)}x${String(video?.height)}`);
  }
  if (video?.avg_frame_rate !== "30/1") issues.push(`fps=${String(video?.avg_frame_rate)}`);
  if (Number(video?.nb_read_frames) !== expectedFrames) {
    issues.push(`frames=${String(video?.nb_read_frames)} expected=${expectedFrames}`);
  }
  if (!Number.isFinite(actualDuration) || Math.abs(actualDuration - expectedDuration) > 1 / 30 + 0.001) {
    issues.push(`duration=${String(actualDuration)} expected=${expectedDuration}`);
  }
  if (!fastStart) issues.push("moov atom is not before mdat");
  if (buffer.byteLength > intent.maxBytes) {
    issues.push(`bytes=${buffer.byteLength} budget=${intent.maxBytes}`);
  }
  if (outputFrameMd5s.length !== expectedFrames) {
    issues.push(`framemd5 count=${outputFrameMd5s.length} expected=${expectedFrames}`);
  }
  if (issues.length > 0) {
    throw new MediaPreparationError(
      "DERIVED_MEDIA_VALIDATION_FAILED",
      `${clip.id} ${variantName}: ${issues.join(", ")}`
    );
  }

  return {
    bytes: buffer.byteLength,
    sha256: sha256Buffer(buffer),
    container: "mp4",
    codec: "h264",
    pixelFormat: "yuv420p",
    width: intent.width,
    height: outputHeight,
    durationSeconds: Number(actualDuration.toFixed(9)),
    frameRate: "30/1",
    fastStart,
    firstFrameMd5: clip.sourceSegments[0].firstFrameMd5,
    lastIncludedFrameMd5:
      clip.sourceSegments[clip.sourceSegments.length - 1].lastIncludedFrameMd5,
    outputFirstFrameMd5: outputFrameMd5s[0],
    outputLastFrameMd5: outputFrameMd5s.at(-1)
  };
}

async function inspectPoster(path, clip, sourceRecord) {
  const buffer = await readFile(path);
  if (buffer.byteLength > clip.poster.maxBytes) {
    throw new MediaPreparationError(
      "POSTER_BUDGET_EXCEEDED",
      `${clip.id} poster is ${buffer.byteLength} bytes; budget is ${clip.poster.maxBytes}.`
    );
  }
  const sourceFrame = clip.poster.sourcePTS / sourceRecord.spec.frameStepPTS;
  return {
    bytes: buffer.byteLength,
    sha256: sha256Buffer(buffer),
    format: "jpeg",
    width: 960,
    height: 540,
    sourceFrameMd5: sourceRecord.frameMd5s[sourceFrame]
  };
}

async function buildPreviewItem(options, stagingRoot, clip, sourceRecords) {
  if (clip.availability !== "available") {
    return {
      id: clip.id,
      workId: clip.workId,
      availability: clip.availability,
      mode: clip.mode,
      sourceSegments: clip.sourceSegments,
      poster: null,
      variants: null,
      fallback: clip.fallback
    };
  }

  const sourceRecord = sourceRecords.get(clip.sourceId);
  const itemRoot = join(stagingRoot, clip.id);
  await mkdir(itemRoot, { recursive: true });
  const posterPath = join(itemRoot, "poster.jpg");
  process.stderr.write(`encode ${clip.id} poster\n`);
  await encodePoster(options, clip, sourceRecord, posterPath);
  const poster = {
    assetKey: `post-coscroll/${clip.id}/poster.jpg`,
    ...(await inspectPoster(posterPath, clip, sourceRecord))
  };

  let variants = null;
  if (clip.mode !== "frame-hold") {
    variants = {};
    for (const variantName of ["desktop", "mobile"]) {
      const outputPath = join(itemRoot, `${variantName}.mp4`);
      process.stderr.write(`encode ${clip.id} ${variantName}\n`);
      await encodeVariant(options, clip, sourceRecord, variantName, outputPath);
      variants[variantName] = {
        assetKey: `post-coscroll/${clip.id}/${variantName}.mp4`,
        ...(await inspectDerivedVideo(
          options,
          outputPath,
          clip,
          sourceRecord.spec,
          clip.variants[variantName],
          variantName
        ))
      };
    }
  }

  return {
    id: clip.id,
    workId: clip.workId,
    availability: "ready",
    mode: clip.mode,
    sourceSegments: clip.sourceSegments,
    poster,
    variants,
    fallback: clip.fallback
  };
}

export async function transcodePostCoScrollClipForVerification({
  clipId,
  sourceRoot,
  outputRoot,
  ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobe = process.env.FFPROBE_PATH ?? "ffprobe"
}) {
  const clip = POST_COSCROLL_MEDIA_SOURCE_SPEC.clips.find(
    (candidate) => candidate.id === clipId
  );
  if (!clip || clip.availability !== "available") {
    throw new MediaPreparationError(
      "CLIP_NOT_AVAILABLE",
      `${clipId} is not an available source-spec clip.`
    );
  }
  const source = POST_COSCROLL_MEDIA_SOURCE_SPEC.sources.find(
    (candidate) => candidate.id === clip.sourceId
  );
  const options = {
    sourceRoot: resolve(sourceRoot),
    outputRoot: resolve(outputRoot),
    ffmpeg,
    ffprobe
  };
  assertDirectory(options.sourceRoot, "SOURCE_ROOT_MISSING");
  const sourceRecord = await verifyAvailableSource(options, source);
  const records = new Map([[source.id, sourceRecord]]);
  await mkdir(options.outputRoot, { recursive: true });
  return buildPreviewItem(options, options.outputRoot, clip, records);
}

async function replaceGeneratedOutput(stagingRoot, outputRoot) {
  const marker = ".miralith-post-coscroll-generated.json";
  const backupRoot = `${outputRoot}.backup-${process.pid}`;
  if (!existsSync(outputRoot)) {
    await rename(stagingRoot, outputRoot);
    return;
  }
  if (!existsSync(join(outputRoot, marker))) {
    throw new MediaPreparationError(
      "OUTPUT_ROOT_NOT_OWNED",
      `Refusing to replace ${outputRoot} because its generated marker is absent.`
    );
  }

  await rename(outputRoot, backupRoot);
  try {
    await rename(stagingRoot, outputRoot);
    await rm(backupRoot, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(outputRoot) && existsSync(backupRoot)) {
      await rename(backupRoot, outputRoot);
    }
    throw error;
  }
}

async function generatePreviewManifest(options, toolchain) {
  if (basename(options.outputRoot) !== "post-coscroll") {
    throw new MediaPreparationError(
      "OUTPUT_ROOT_UNSAFE",
      "Generated preview output must end in /post-coscroll so stable asset keys match /media/post-coscroll/."
    );
  }

  const sourceRecords = await verifyAvailableSources(options);
  const parent = dirname(options.outputRoot);
  await mkdir(parent, { recursive: true });
  const stagingRoot = join(parent, `.post-coscroll.staging-${process.pid}-${Date.now()}`);
  await mkdir(stagingRoot);

  try {
    const items = [];
    for (const clip of POST_COSCROLL_MEDIA_SOURCE_SPEC.clips) {
      items.push(await buildPreviewItem(options, stagingRoot, clip, sourceRecords));
    }
    const manifest = {
      kind: "miralith-post-coscroll-media-manifest",
      version: 1,
      channel: "local-preview",
      generatedAt: new Date().toISOString(),
      sourceSpecSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256,
      editorialFreezeSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256,
      toolchain: {
        ffmpegVersion: toolchain.ffmpegVersion,
        ffprobeVersion: toolchain.ffprobeVersion
      },
      sources: [...sourceRecords.values()].map((record) => ({
        id: record.spec.id,
        sourceFileLabel: record.spec.sourceFileLabel,
        sourceSha256: record.sourceSha256,
        sourceTimeBase: record.spec.sourceTimeBase,
        sourceFrameRate: record.spec.sourceFrameRate
      })),
      items
    };
    await writeFile(
      join(stagingRoot, "manifest.preview.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    await writeFile(
      join(stagingRoot, ".miralith-post-coscroll-generated.json"),
      `${JSON.stringify(
        {
          kind: "miralith-post-coscroll-generated-output",
          sourceSpecSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256,
          editorialFreezeSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256
        },
        null,
        2
      )}\n`
    );
    await replaceGeneratedOutput(stagingRoot, options.outputRoot);
    return {
      ok: true,
      checkOnly: false,
      outputRoot: options.outputRoot,
      manifestPath: join(options.outputRoot, "manifest.preview.json"),
      itemCount: items.length,
      sourceSpecSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256,
      editorialFreezeSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256
    };
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

function printError(error) {
  if (error instanceof MediaPreparationError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    return;
  }
  process.stderr.write(`MEDIA_PREPARATION_FAILED: ${error instanceof Error ? error.stack : error}\n`);
}

export async function preparePostCoScrollMedia(options) {
  if (options.printPlan) return buildPostCoScrollTranscodePlan();
  const preflight = preflightPostCoScrollMedia(options);
  if (options.checkOnly) {
    return {
      ok: true,
      checkOnly: true,
      sourceSpecSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256,
      editorialFreezeSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256,
      toolchain: preflight.toolchain
    };
  }
  return generatePreviewManifest(options, preflight.toolchain);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = await preparePostCoScrollMedia(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
