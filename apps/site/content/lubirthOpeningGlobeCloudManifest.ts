import rawManifest from "../public/assets/lubirth/opening-globe-clouds/manifest.json";

export const OPENING_GLOBE_CLOUD_MAPPING = "equirectangular-earth-uv" as const;
export const OPENING_GLOBE_CLOUD_PACKING = "left-rgb-right-concavity" as const;
export const OPENING_GLOBE_CLOUD_FIELD_COLOR_SPACE = "none" as const;
export const OPENING_GLOBE_CLOUD_FRAME_RATE = 30;
export const OPENING_GLOBE_CLOUD_FRAME_COUNT = 48;
export const OPENING_GLOBE_CLOUD_DESKTOP_TRANSFER_MAX_BYTES = 6 * 1024 * 1024;
export const OPENING_GLOBE_CLOUD_MOBILE_TRANSFER_MAX_BYTES = 2 * 1024 * 1024;
export const OPENING_GLOBE_CLOUD_DESKTOP_TEXTURE_MAX_BYTES = 16 * 1024 * 1024;
export const OPENING_GLOBE_CLOUD_MOBILE_TEXTURE_MAX_BYTES = 8 * 1024 * 1024;

export type OpeningGlobeCloudTier = "desktop" | "mobile";

export interface OpeningGlobeCloudVariant {
  tier: OpeningGlobeCloudTier;
  src: string;
  rawWidth: number;
  rawHeight: number;
  packedWidth: number;
  packedHeight: number;
  frameRate: number;
  frameCount: number;
  keyframePolicy: "all-i";
  packing: typeof OPENING_GLOBE_CLOUD_PACKING;
  transferBytes: number;
  maxTransferBytes: number;
  estimatedPackedTextureBytes: number;
  maxPackedTextureBytes: number;
  sha256: string;
}

export interface OpeningGlobeCloudManifest {
  schemaVersion: 1;
  id: string;
  cloudOnly: true;
  mapping: typeof OPENING_GLOBE_CLOUD_MAPPING;
  fieldColorSpace: typeof OPENING_GLOBE_CLOUD_FIELD_COLOR_SPACE;
  packing: typeof OPENING_GLOBE_CLOUD_PACKING;
  authoredDurationSeconds: number;
  encodedDurationSeconds: number;
  frameRate: number;
  frameCount: number;
  source: {
    provenance: "internal-procedural";
    generator: string;
    generatorVersion: string;
    scenePath: string;
    seed: string;
    parameterSummary: Record<string, string>;
    sourceSha256: string;
    license: "internally-generated";
  };
  handoff: {
    plateEndProgress: number;
    plateEndFrame: number;
    cutProgress: number;
    cutFrame: number;
    liveProgress: number;
    liveFrame: number;
    veilColorSrgb: string;
  };
  variants: Record<OpeningGlobeCloudTier, OpeningGlobeCloudVariant>;
}

function fail(label: string): never {
  throw new Error("Opening globe cloud manifest " + label);
}

function objectAt(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(label + " must be an object");
  }
  return value as Record<string, unknown>;
}

function stringAt(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    fail(label + "." + key + " must be a non-empty string");
  }
  return value;
}

function numberAt(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(label + "." + key + " must be a finite number");
  }
  return value;
}

function exactAt<T>(record: Record<string, unknown>, key: string, expected: T, label: string): T {
  if (record[key] !== expected) {
    fail(label + "." + key + " must equal " + String(expected));
  }
  return expected;
}

function shaAt(record: Record<string, unknown>, key: string, label: string) {
  const value = stringAt(record, key, label);
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    fail(label + "." + key + " must be a SHA-256 digest");
  }
  return value.toLowerCase();
}

function parseVariant(value: unknown, tier: OpeningGlobeCloudTier): OpeningGlobeCloudVariant {
  const record = objectAt(value, "variants." + tier);
  const limits = tier === "desktop"
    ? {
        rawWidth: 1536,
        rawHeight: 768,
        transfer: OPENING_GLOBE_CLOUD_DESKTOP_TRANSFER_MAX_BYTES,
        texture: OPENING_GLOBE_CLOUD_DESKTOP_TEXTURE_MAX_BYTES
      }
    : {
        rawWidth: 1024,
        rawHeight: 512,
        transfer: OPENING_GLOBE_CLOUD_MOBILE_TRANSFER_MAX_BYTES,
        texture: OPENING_GLOBE_CLOUD_MOBILE_TEXTURE_MAX_BYTES
      };
  const rawWidth = exactAt(record, "rawWidth", limits.rawWidth, "variants." + tier);
  const rawHeight = exactAt(record, "rawHeight", limits.rawHeight, "variants." + tier);
  const transferBytes = numberAt(record, "transferBytes", "variants." + tier);
  const estimatedPackedTextureBytes = numberAt(record, "estimatedPackedTextureBytes", "variants." + tier);
  if (rawWidth / rawHeight !== 2) {
    fail("variants." + tier + " raw field must be 2:1 equirectangular-earth-uv");
  }
  if (transferBytes < 1 || transferBytes > limits.transfer) {
    fail("variants." + tier + " transfer budget exceeded");
  }
  if (estimatedPackedTextureBytes !== rawWidth * 2 * rawHeight * 4) {
    fail("variants." + tier + " packed texture bytes must describe RGBA field residency");
  }
  if (estimatedPackedTextureBytes > limits.texture) {
    fail("variants." + tier + " packed texture residency exceeded");
  }
  return {
    tier: exactAt(record, "tier", tier, "variants." + tier),
    src: stringAt(record, "src", "variants." + tier),
    rawWidth,
    rawHeight,
    packedWidth: exactAt(record, "packedWidth", rawWidth * 2, "variants." + tier),
    packedHeight: exactAt(record, "packedHeight", rawHeight, "variants." + tier),
    frameRate: exactAt(record, "frameRate", OPENING_GLOBE_CLOUD_FRAME_RATE, "variants." + tier),
    frameCount: exactAt(record, "frameCount", OPENING_GLOBE_CLOUD_FRAME_COUNT, "variants." + tier),
    keyframePolicy: exactAt(record, "keyframePolicy", "all-i", "variants." + tier),
    packing: exactAt(record, "packing", OPENING_GLOBE_CLOUD_PACKING, "variants." + tier),
    transferBytes,
    maxTransferBytes: exactAt(record, "maxTransferBytes", limits.transfer, "variants." + tier),
    estimatedPackedTextureBytes,
    maxPackedTextureBytes: exactAt(record, "maxPackedTextureBytes", limits.texture, "variants." + tier),
    sha256: shaAt(record, "sha256", "variants." + tier)
  };
}

export function validateOpeningGlobeCloudManifest(value: unknown): OpeningGlobeCloudManifest {
  const record = objectAt(value, "root");
  const source = objectAt(record.source, "source");
  const handoff = objectAt(record.handoff, "handoff");
  const variants = objectAt(record.variants, "variants");
  if (record.cloudOnly !== true || source.provenance !== "internal-procedural") {
    fail("must be an internal-procedural cloud-only globe field");
  }
  if (
    record.mapping !== OPENING_GLOBE_CLOUD_MAPPING ||
    record.fieldColorSpace !== OPENING_GLOBE_CLOUD_FIELD_COLOR_SPACE ||
    record.packing !== OPENING_GLOBE_CLOUD_PACKING
  ) {
    fail("must be equirectangular-earth-uv field data, not screen-space color art");
  }
  const parameterSummary = objectAt(source.parameterSummary, "source.parameterSummary");
  const normalizedParameters = Object.fromEntries(
    Object.entries(parameterSummary).map(([key, parameter]) => {
      if (typeof parameter !== "string" || parameter.trim() === "") {
        fail("source.parameterSummary." + key + " must be a non-empty string");
      }
      return [key, parameter];
    })
  );
  const plateEndProgress = exactAt(handoff, "plateEndProgress", 0.18, "handoff");
  const cutProgress = exactAt(handoff, "cutProgress", 0.195, "handoff");
  const liveProgress = exactAt(handoff, "liveProgress", 0.22, "handoff");
  const plateEndFrame = exactAt(handoff, "plateEndFrame", 39, "handoff");
  const cutFrame = exactAt(handoff, "cutFrame", 42, "handoff");
  const liveFrame = exactAt(handoff, "liveFrame", 47, "handoff");
  if (!(plateEndProgress < cutProgress && cutProgress < liveProgress)) {
    fail("handoff progress must increase");
  }
  if (!(plateEndFrame < cutFrame && cutFrame < liveFrame)) {
    fail("handoff frames must increase");
  }
  return {
    schemaVersion: exactAt(record, "schemaVersion", 1, "root"),
    id: stringAt(record, "id", "root"),
    cloudOnly: exactAt(record, "cloudOnly", true, "root"),
    mapping: exactAt(record, "mapping", OPENING_GLOBE_CLOUD_MAPPING, "root"),
    fieldColorSpace: exactAt(record, "fieldColorSpace", OPENING_GLOBE_CLOUD_FIELD_COLOR_SPACE, "root"),
    packing: exactAt(record, "packing", OPENING_GLOBE_CLOUD_PACKING, "root"),
    authoredDurationSeconds: exactAt(record, "authoredDurationSeconds", 1.584, "root"),
    encodedDurationSeconds: exactAt(record, "encodedDurationSeconds", 1.6, "root"),
    frameRate: exactAt(record, "frameRate", OPENING_GLOBE_CLOUD_FRAME_RATE, "root"),
    frameCount: exactAt(record, "frameCount", OPENING_GLOBE_CLOUD_FRAME_COUNT, "root"),
    source: {
      provenance: exactAt(source, "provenance", "internal-procedural", "source"),
      generator: stringAt(source, "generator", "source"),
      generatorVersion: stringAt(source, "generatorVersion", "source"),
      scenePath: stringAt(source, "scenePath", "source"),
      seed: stringAt(source, "seed", "source"),
      parameterSummary: normalizedParameters,
      sourceSha256: shaAt(source, "sourceSha256", "source"),
      license: exactAt(source, "license", "internally-generated", "source")
    },
    handoff: {
      plateEndProgress,
      plateEndFrame,
      cutProgress,
      cutFrame,
      liveProgress,
      liveFrame,
      veilColorSrgb: exactAt(handoff, "veilColorSrgb", "#142536", "handoff")
    },
    variants: {
      desktop: parseVariant(variants.desktop, "desktop"),
      mobile: parseVariant(variants.mobile, "mobile")
    }
  };
}

export function mapOpeningGlobeCloudProgressToFrame(manifest: OpeningGlobeCloudManifest, progress: number) {
  const clamped = Math.min(manifest.handoff.cutProgress, Math.max(0, progress));
  if (clamped <= manifest.handoff.plateEndProgress) {
    return Math.round((clamped / manifest.handoff.plateEndProgress) * manifest.handoff.plateEndFrame);
  }
  const transition = (clamped - manifest.handoff.plateEndProgress) /
    (manifest.handoff.cutProgress - manifest.handoff.plateEndProgress);
  return Math.round(manifest.handoff.plateEndFrame + transition *
    (manifest.handoff.cutFrame - manifest.handoff.plateEndFrame));
}

export const openingGlobeCloudManifest = validateOpeningGlobeCloudManifest(rawManifest);
