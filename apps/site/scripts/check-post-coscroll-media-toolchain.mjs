import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function parseArgs(argv) {
  const options = {
    ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg",
    ffprobe: process.env.FFPROBE_PATH ?? "ffprobe",
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
    } else if (argument === "--ffmpeg" || argument === "--ffprobe") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value.`);
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      message:
        result.error?.message ||
        result.stderr.trim() ||
        `${binary} exited with status ${String(result.status)}`
    };
  }
  return { ok: true, stdout: result.stdout, stderr: result.stderr };
}

function firstLine(value) {
  return value.split(/\r?\n/, 1)[0].trim();
}

export function checkPostCoScrollMediaToolchain({
  ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobe = process.env.FFPROBE_PATH ?? "ffprobe"
} = {}) {
  const errors = [];
  const ffmpegVersionResult = run(ffmpeg, ["-version"]);
  const ffprobeVersionResult = run(ffprobe, ["-version"]);

  if (!ffmpegVersionResult.ok) {
    errors.push({
      code: "FFMPEG_UNAVAILABLE",
      message: `Could not execute FFmpeg (${ffmpeg}): ${ffmpegVersionResult.message}`
    });
  }
  if (!ffprobeVersionResult.ok) {
    errors.push({
      code: "FFPROBE_UNAVAILABLE",
      message: `Could not execute FFprobe (${ffprobe}): ${ffprobeVersionResult.message}`
    });
  }

  let encoders = "";
  let muxers = "";
  if (ffmpegVersionResult.ok) {
    const encoderResult = run(ffmpeg, ["-hide_banner", "-encoders"]);
    const muxerResult = run(ffmpeg, ["-hide_banner", "-muxers"]);
    if (!encoderResult.ok) {
      errors.push({ code: "FFMPEG_ENCODER_QUERY_FAILED", message: encoderResult.message });
    } else {
      encoders = encoderResult.stdout;
      if (!/\blibx264\b/.test(encoders)) {
        errors.push({
          code: "FFMPEG_LIBX264_MISSING",
          message: "FFmpeg does not expose the required libx264 encoder."
        });
      }
      if (!/\b(?:mjpeg|png)\b/.test(encoders)) {
        errors.push({
          code: "FFMPEG_POSTER_ENCODER_MISSING",
          message: "FFmpeg does not expose an MJPEG or PNG poster encoder."
        });
      }
    }
    if (!muxerResult.ok) {
      errors.push({ code: "FFMPEG_MUXER_QUERY_FAILED", message: muxerResult.message });
    } else {
      muxers = muxerResult.stdout;
      if (!/^\s*E\s+mp4\b/m.test(muxers)) {
        errors.push({
          code: "FFMPEG_MP4_MUXER_MISSING",
          message: "FFmpeg does not expose the required MP4 muxer."
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    ffmpegPath: ffmpeg,
    ffprobePath: ffprobe,
    ffmpegVersion: ffmpegVersionResult.ok ? firstLine(ffmpegVersionResult.stdout) : null,
    ffprobeVersion: ffprobeVersionResult.ok ? firstLine(ffprobeVersionResult.stdout) : null,
    capabilities: {
      libx264: /\blibx264\b/.test(encoders),
      webp: /\bwebp\b/.test(encoders),
      posterEncoder: /\bmjpeg\b/.test(encoders)
        ? "mjpeg"
        : /\bpng\b/.test(encoders)
          ? "png"
          : null,
      mp4: /^\s*E\s+mp4\b/m.test(muxers)
    },
    errors
  };
}

function printReport(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (report.ok) {
    process.stdout.write(
      `FFmpeg: ${report.ffmpegVersion}\nFFprobe: ${report.ffprobeVersion}\n`
    );
    return;
  }
  for (const error of report.errors) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = checkPostCoScrollMediaToolchain(options);
    printReport(report, options.json);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    const report = {
      ok: false,
      errors: [
        {
          code: "TOOLCHAIN_ARGUMENT_ERROR",
          message: error instanceof Error ? error.message : String(error)
        }
      ]
    };
    printReport(report, process.argv.includes("--json"));
    process.exitCode = 1;
  }
}
