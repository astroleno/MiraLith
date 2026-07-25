import {
  POST_COSCROLL_MEDIA_SOURCE_SPEC,
  POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256,
  type PostCoScrollMediaClipSource,
  type PostCoScrollSourceMaster
} from "./postCoScrollMediaSource";
import {
  isSafePostCoScrollAssetKey,
  resolvePostCoScrollMediaUrl
} from "../lib/media/resolvePostCoScrollMediaUrl";

export interface PostCoScrollMediaDiagnostic {
  code: string;
  message: string;
  mediaId?: string;
  field?: string;
  overByBytes?: number;
}

interface NormalizedFile {
  src: string;
  assetKey: string;
  bytes: number;
  sha256: string;
}

export interface NormalizedPostCoScrollMediaItem {
  id: string;
  workId: string;
  availability: "ready" | "fallback" | "missing-required" | "pending";
  mode: PostCoScrollMediaClipSource["mode"];
  sourceSegments: PostCoScrollMediaClipSource["sourceSegments"];
  poster: (NormalizedFile & {
    format: string;
    width: number;
    height: number;
    sourceFrameMd5: string;
  }) | null;
  variants: {
    desktop: NormalizedFile & {
      container: string;
      codec: string;
      pixelFormat: string;
      width: number;
      height: number;
      durationSeconds: number;
      frameRate: string;
      fastStart: boolean;
      firstFrameMd5: string;
      lastIncludedFrameMd5: string;
      outputFirstFrameMd5: string;
      outputLastFrameMd5: string;
    };
    mobile: NormalizedFile & {
      container: string;
      codec: string;
      pixelFormat: string;
      width: number;
      height: number;
      durationSeconds: number;
      frameRate: string;
      fastStart: boolean;
      firstFrameMd5: string;
      lastIncludedFrameMd5: string;
      outputFirstFrameMd5: string;
      outputLastFrameMd5: string;
    };
  } | null;
  fallback: PostCoScrollMediaClipSource["fallback"];
}

export interface NormalizedPostCoScrollMediaManifest {
  channel: "local-preview" | "published";
  generatedAt: string;
  sourceSpecSha256: string;
  editorialFreezeSha256: string;
  catalogBytes: number;
  items: Record<string, NormalizedPostCoScrollMediaItem>;
}

export type NormalizePostCoScrollMediaResult =
  | { ok: true; manifest: NormalizedPostCoScrollMediaManifest; diagnostics: [] }
  | { ok: false; diagnostics: PostCoScrollMediaDiagnostic[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHex(value: unknown, length: number): value is string {
  return typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function sourceForClip(clip: PostCoScrollMediaClipSource): PostCoScrollSourceMaster | undefined {
  return POST_COSCROLL_MEDIA_SOURCE_SPEC.sources.find((source) => source.id === clip.sourceId);
}

function expectedDurationSeconds(clip: PostCoScrollMediaClipSource): number {
  const source = sourceForClip(clip);
  if (!source?.sourceTimeBase) return 0;
  const [numerator, denominator] = source.sourceTimeBase.split("/").map(Number);
  const sourceDuration = clip.sourceSegments.reduce(
    (total, segment) =>
      total + ((segment.endPTSExclusive - segment.startPTS) * numerator) / denominator,
    0
  );
  const transitionFrames =
    clip.id === "artbreeze-first-sequence" && clip.editorial
      ? clip.editorial.returnTransitionFrames - 1
      : 0;
  return sourceDuration + transitionFrames / 30;
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validatePostCoScrollMediaSourceSpec(
  spec: typeof POST_COSCROLL_MEDIA_SOURCE_SPEC
): { errors: string[]; missingRequiredIds: string[]; pendingIds: string[] } {
  const errors: string[] = [];
  const missingRequiredIds: string[] = [];
  const pendingIds: string[] = [];
  const sourceIds = new Set<string>();
  const clipIds = new Set<string>();

  for (const source of spec.sources) {
    if (sourceIds.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    if (
      source.sourceFileLabel &&
      (source.sourceFileLabel.startsWith("/") || source.sourceFileLabel.includes("\\"))
    ) {
      errors.push(`Source labels must not contain machine paths: ${source.id}`);
    }
  }

  for (const clip of spec.clips) {
    if (clipIds.has(clip.id)) errors.push(`Duplicate clip id: ${clip.id}`);
    clipIds.add(clip.id);

    const source = spec.sources.find((candidate) => candidate.id === clip.sourceId);
    if (!source) {
      errors.push(`Unknown source ${String(clip.sourceId)} for ${clip.id}`);
      continue;
    }
    if (source.availability !== clip.availability) {
      errors.push(`Availability mismatch for ${clip.id}`);
    }

    if (clip.availability === "missing-required") missingRequiredIds.push(clip.id);
    if (clip.availability === "pending") pendingIds.push(clip.id);

    if (clip.availability === "available" && clip.sourceSegments.length === 0) {
      errors.push(`Available clip has no PTS segments: ${clip.id}`);
    }
    if (clip.availability !== "available" && clip.sourceSegments.length > 0) {
      errors.push(`Unavailable clip must not guess PTS segments: ${clip.id}`);
    }

    for (const segment of clip.sourceSegments) {
      if (segment.startPTS < 0 || segment.endPTSExclusive <= segment.startPTS) {
        errors.push(`Invalid half-open PTS interval for ${clip.id}`);
      }
      if (
        source.frameStepPTS &&
        (segment.startPTS % source.frameStepPTS !== 0 ||
          segment.endPTSExclusive % source.frameStepPTS !== 0)
      ) {
        errors.push(`Unaligned PTS interval for ${clip.id}`);
      }
      if (source.durationPTS && segment.endPTSExclusive > source.durationPTS) {
        errors.push(`PTS interval exceeds source duration for ${clip.id}`);
      }
      if (!isHex(segment.firstFrameMd5, 32) || !isHex(segment.lastIncludedFrameMd5, 32)) {
        errors.push(`Invalid source frame MD5 for ${clip.id}`);
      }
    }
  }

  const aescapeScrub = spec.clips.find((clip) => clip.id === "aescape-scrub");
  const aescapeShowcase = spec.clips.find((clip) => clip.id === "aescape-showcase");
  if (
    !aescapeScrub ||
    !aescapeShowcase ||
    aescapeScrub.sourceSegments[0]?.endPTSExclusive !==
      aescapeShowcase.sourceSegments[0]?.startPTS
  ) {
    errors.push("AeScape scrub/showcase boundary is not adjacent.");
  }

  return { errors, missingRequiredIds, pendingIds };
}

function diagnostic(
  diagnostics: PostCoScrollMediaDiagnostic[],
  code: string,
  message: string,
  details: Pick<PostCoScrollMediaDiagnostic, "mediaId" | "field" | "overByBytes"> = {}
) {
  diagnostics.push({ code, message, ...details });
}

function normalizeAssetFile(
  value: unknown,
  options: {
    assetBaseUrl: string;
    mediaId: string;
    field: string;
    maxBytes: number;
    diagnostics: PostCoScrollMediaDiagnostic[];
  }
): (NormalizedFile & UnknownRecord) | null {
  const { assetBaseUrl, mediaId, field, maxBytes, diagnostics } = options;
  if (!isRecord(value)) {
    diagnostic(diagnostics, "MISSING_MEDIA_FILE", `Missing ${field} for ${mediaId}.`, {
      mediaId,
      field
    });
    return null;
  }

  const assetKey = value.assetKey;
  if (typeof assetKey !== "string" || !isSafePostCoScrollAssetKey(assetKey)) {
    diagnostic(diagnostics, "UNSAFE_ASSET_KEY", `Unsafe ${field} asset key for ${mediaId}.`, {
      mediaId,
      field
    });
    return null;
  }
  const bytes = readPositiveInteger(value.bytes);
  if (bytes === null) {
    diagnostic(diagnostics, "INVALID_MEDIA_BYTES", `Invalid ${field} byte size for ${mediaId}.`, {
      mediaId,
      field
    });
    return null;
  }
  if (bytes > maxBytes) {
    diagnostic(
      diagnostics,
      "MEDIA_BUDGET_EXCEEDED",
      `${mediaId} ${field} exceeds its budget by ${bytes - maxBytes} bytes.`,
      { mediaId, field, overByBytes: bytes - maxBytes }
    );
  }
  if (!isHex(value.sha256, 64)) {
    diagnostic(diagnostics, "INVALID_MEDIA_HASH", `Invalid ${field} SHA-256 for ${mediaId}.`, {
      mediaId,
      field
    });
    return null;
  }

  return {
    ...value,
    src: resolvePostCoScrollMediaUrl(assetBaseUrl, assetKey),
    assetKey,
    bytes,
    sha256: value.sha256
  };
}

export function normalizePostCoScrollMediaManifest(
  input: unknown,
  options: { assetBaseUrl: string }
): NormalizePostCoScrollMediaResult {
  const diagnostics: PostCoScrollMediaDiagnostic[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      diagnostics: [{ code: "INVALID_MANIFEST", message: "Manifest must be an object." }]
    };
  }

  if (input.kind !== "miralith-post-coscroll-media-manifest" || input.version !== 1) {
    diagnostic(diagnostics, "INVALID_MANIFEST_IDENTITY", "Unsupported media manifest identity.");
  }
  if (input.sourceSpecSha256 !== POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256) {
    diagnostic(diagnostics, "SOURCE_SPEC_HASH_MISMATCH", "Preview manifest is stale.");
  }
  if (input.editorialFreezeSha256 !== POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256) {
    diagnostic(diagnostics, "EDITORIAL_FREEZE_HASH_MISMATCH", "Editorial freeze binding is stale.");
  }
  if (input.channel !== "local-preview" && input.channel !== "published") {
    diagnostic(diagnostics, "INVALID_MANIFEST_CHANNEL", "Unknown media manifest channel.");
  }
  if (
    typeof input.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(input.generatedAt))
  ) {
    diagnostic(diagnostics, "INVALID_GENERATED_AT", "Manifest generatedAt is invalid.");
  }
  if (
    !isRecord(input.toolchain) ||
    typeof input.toolchain.ffmpegVersion !== "string" ||
    typeof input.toolchain.ffprobeVersion !== "string"
  ) {
    diagnostic(diagnostics, "INVALID_TOOLCHAIN_REPORT", "Manifest toolchain report is missing.");
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!Array.isArray(input.items)) {
    diagnostic(diagnostics, "INVALID_MANIFEST_ITEMS", "Manifest items must be an array.");
  }
  const itemById = new Map<string, UnknownRecord>();
  for (const item of rawItems) {
    if (!isRecord(item) || typeof item.id !== "string") {
      diagnostic(diagnostics, "INVALID_MEDIA_ITEM", "Manifest contains an invalid media item.");
      continue;
    }
    if (itemById.has(item.id)) {
      diagnostic(diagnostics, "DUPLICATE_MEDIA_ID", `Duplicate media id ${item.id}.`, {
        mediaId: item.id
      });
    }
    itemById.set(item.id, item);
  }

  const normalizedItems: Record<string, NormalizedPostCoScrollMediaItem> = {};
  const assetKeys = new Set<string>();
  let catalogBytes = 0;

  for (const clip of POST_COSCROLL_MEDIA_SOURCE_SPEC.clips) {
    const raw = itemById.get(clip.id);
    if (!raw) {
      diagnostic(diagnostics, "MISSING_MEDIA_ID", `Manifest is missing ${clip.id}.`, {
        mediaId: clip.id
      });
      continue;
    }
    itemById.delete(clip.id);

    const expectedAvailability = clip.availability === "available" ? "ready" : clip.availability;
    if (
      raw.workId !== clip.workId ||
      raw.mode !== clip.mode ||
      raw.availability !== expectedAvailability ||
      !equalJson(raw.sourceSegments, clip.sourceSegments) ||
      !equalJson(raw.fallback, clip.fallback)
    ) {
      diagnostic(diagnostics, "MEDIA_CONTRACT_MISMATCH", `${clip.id} does not match source spec.`, {
        mediaId: clip.id
      });
      continue;
    }

    if (clip.availability !== "available") {
      if (raw.poster !== null || raw.variants !== null) {
        diagnostic(
          diagnostics,
          "UNAVAILABLE_MEDIA_HAS_ASSET",
          `${clip.id} must not expose playable or poster URLs.`,
          { mediaId: clip.id }
        );
      }
      normalizedItems[clip.id] = {
        id: clip.id,
        workId: clip.workId,
        availability: clip.availability,
        mode: clip.mode,
        sourceSegments: clip.sourceSegments,
        poster: null,
        variants: null,
        fallback: clip.fallback
      };
      continue;
    }

    const posterFile = normalizeAssetFile(raw.poster, {
      assetBaseUrl: options.assetBaseUrl,
      mediaId: clip.id,
      field: "poster",
      maxBytes: clip.poster.maxBytes,
      diagnostics
    });
    let poster: NormalizedPostCoScrollMediaItem["poster"] = null;
    if (posterFile) {
      if (
        (posterFile.format !== "webp" && posterFile.format !== "jpeg") ||
        typeof posterFile.width !== "number" ||
        typeof posterFile.height !== "number" ||
        !isHex(posterFile.sourceFrameMd5, 32)
      ) {
        diagnostic(diagnostics, "INVALID_POSTER_METADATA", `Invalid poster metadata for ${clip.id}.`, {
          mediaId: clip.id,
          field: "poster"
        });
      } else {
        poster = {
          src: posterFile.src,
          assetKey: posterFile.assetKey,
          bytes: posterFile.bytes,
          sha256: posterFile.sha256,
          format: posterFile.format,
          width: posterFile.width,
          height: posterFile.height,
          sourceFrameMd5: posterFile.sourceFrameMd5
        };
      }
    }

    let normalizedVariants: NormalizedPostCoScrollMediaItem["variants"] = null;
    if (clip.mode === "frame-hold") {
      if (raw.variants !== null) {
        diagnostic(
          diagnostics,
          "FRAME_HOLD_HAS_VIDEO",
          `${clip.id} must resolve to its extracted frame only.`,
          { mediaId: clip.id }
        );
      }
    } else if (!isRecord(raw.variants) || !clip.variants) {
      diagnostic(diagnostics, "MISSING_MEDIA_VARIANTS", `Missing variants for ${clip.id}.`, {
        mediaId: clip.id
      });
    } else {
      const variants: Partial<NormalizedPostCoScrollMediaItem["variants"]> = {};
      for (const variantName of ["desktop", "mobile"] as const) {
        const intent = clip.variants[variantName];
        const file = normalizeAssetFile(raw.variants[variantName], {
          assetBaseUrl: options.assetBaseUrl,
          mediaId: clip.id,
          field: variantName,
          maxBytes: intent.maxBytes,
          diagnostics
        });
        if (!file) continue;

        const expectedDuration = expectedDurationSeconds(clip);
        const firstFrameMd5 = clip.sourceSegments[0].firstFrameMd5;
        const lastIncludedFrameMd5 =
          clip.sourceSegments[clip.sourceSegments.length - 1].lastIncludedFrameMd5;
        if (
          file.container !== intent.container ||
          file.codec !== intent.videoCodec ||
          file.pixelFormat !== intent.pixelFormat ||
          file.width !== intent.width ||
          typeof file.height !== "number" ||
          file.height <= 0 ||
          file.height > intent.maxHeight ||
          file.frameRate !== "30/1" ||
          file.fastStart !== true ||
          typeof file.durationSeconds !== "number" ||
          Math.abs(file.durationSeconds - expectedDuration) > 1 / 30 + 0.001 ||
          file.firstFrameMd5 !== firstFrameMd5 ||
          file.lastIncludedFrameMd5 !== lastIncludedFrameMd5 ||
          !isHex(file.outputFirstFrameMd5, 32) ||
          !isHex(file.outputLastFrameMd5, 32)
        ) {
          diagnostic(
            diagnostics,
            "MEDIA_METADATA_MISMATCH",
            `${clip.id} ${variantName} metadata does not match source spec.`,
            { mediaId: clip.id, field: variantName }
          );
          continue;
        }
        variants[variantName] = {
          src: file.src,
          assetKey: file.assetKey,
          bytes: file.bytes,
          sha256: file.sha256,
          container: file.container,
          codec: file.codec,
          pixelFormat: file.pixelFormat,
          width: file.width,
          height: file.height,
          durationSeconds: file.durationSeconds,
          frameRate: file.frameRate,
          fastStart: file.fastStart,
          firstFrameMd5: file.firstFrameMd5,
          lastIncludedFrameMd5: file.lastIncludedFrameMd5,
          outputFirstFrameMd5: file.outputFirstFrameMd5,
          outputLastFrameMd5: file.outputLastFrameMd5
        };
      }
      if (variants.desktop && variants.mobile) {
        normalizedVariants = {
          desktop: variants.desktop,
          mobile: variants.mobile
        };
      }
    }

    for (const file of [
      poster,
      normalizedVariants?.desktop ?? null,
      normalizedVariants?.mobile ?? null
    ]) {
      if (!file) continue;
      if (assetKeys.has(file.assetKey)) {
        diagnostic(diagnostics, "DUPLICATE_ASSET_KEY", `Duplicate asset key ${file.assetKey}.`, {
          mediaId: clip.id
        });
      }
      assetKeys.add(file.assetKey);
      catalogBytes += file.bytes;
    }

    normalizedItems[clip.id] = {
      id: clip.id,
      workId: clip.workId,
      availability: "ready",
      mode: clip.mode,
      sourceSegments: clip.sourceSegments,
      poster,
      variants: normalizedVariants,
      fallback: clip.fallback
    };
  }

  for (const unknownId of itemById.keys()) {
    diagnostic(diagnostics, "UNKNOWN_MEDIA_ID", `Unknown media id ${unknownId}.`, {
      mediaId: unknownId
    });
  }

  if (catalogBytes > POST_COSCROLL_MEDIA_SOURCE_SPEC.constraints.productionCatalogMaxBytes) {
    diagnostic(
      diagnostics,
      "CATALOG_BUDGET_EXCEEDED",
      `Catalog exceeds its budget by ${
        catalogBytes - POST_COSCROLL_MEDIA_SOURCE_SPEC.constraints.productionCatalogMaxBytes
      } bytes.`,
      {
        overByBytes:
          catalogBytes - POST_COSCROLL_MEDIA_SOURCE_SPEC.constraints.productionCatalogMaxBytes
      }
    );
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return {
    ok: true,
    diagnostics: [],
    manifest: {
      channel: input.channel as NormalizedPostCoScrollMediaManifest["channel"],
      generatedAt: input.generatedAt as string,
      sourceSpecSha256: input.sourceSpecSha256 as string,
      editorialFreezeSha256: input.editorialFreezeSha256 as string,
      catalogBytes,
      items: normalizedItems
    }
  };
}
