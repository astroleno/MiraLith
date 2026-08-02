export type CinematicPreludeTier = "desktop" | "mobile";

export interface CinematicPreludeSafeCrop {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CinematicPreludeVariant {
  tier: CinematicPreludeTier;
  src: string;
  sourceSha256: string;
  sha256: string;
  transferBytes: number;
  width: number;
  height: number;
  frameRate: number;
  frameCount: number;
  durationSeconds: number;
  keyframePolicy: "all-i";
  colorSpace: "rec709-srgb-sdr";
  opaque: true;
  audio: false;
  firstFrameDeadlineMs: number;
  maxPresentationResidencyBytes: number;
  estimatedPresentationResidencyBytes: number;
  safeCrop: CinematicPreludeSafeCrop;
  runtimeOverscanScale: number;
  maxNormalizedTranslation: { x: number; y: number };
}

export interface CinematicPreludeManifest {
  schemaVersion: 1;
  id: string;
  authoredDurationSeconds: number;
  encodedDurationSeconds: number;
  source: {
    license: "internally-generated";
    renderer: string;
    rendererVersion: string;
    scenePath: string;
    seed: string | null;
    parameterSummary: Record<string, unknown>;
    referenceCanvasSha256: string;
    toolVersions: Record<string, string>;
  };
  handoff: {
    plateEndProgress: 0.18;
    cutProgress: 0.195;
    veilPeakProgress: 0.195;
    liveProgress: 0.22;
    cloudEntryFrame: number;
    cutFrame: number;
    liveFrame: number;
    veilProfile: {
      colorSrgb: string;
      luminanceY: number;
      peakOpacity: 1;
      edgeSoftness: number;
    };
  };
  variants: {
    desktop: CinematicPreludeVariant;
    mobile: CinematicPreludeVariant;
  };
}

const SHA256 = /^[0-9a-f]{64}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function fail(path: string, message: string): never {
  throw new Error(`Invalid cinematic prelude manifest: ${path} ${message}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
  return value as Record<string, unknown>;
}

function numberAt(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "must be a finite number");
  }
  return value;
}

function stringAt(value: unknown, path: string) {
  if (typeof value !== "string" || value.length === 0) {
    fail(path, "must be a non-empty string");
  }
  return value;
}

function exactAt<T>(value: unknown, expected: T, path: string): T {
  if (value !== expected) {
    fail(path, `must equal ${String(expected)}`);
  }
  return expected;
}

function shaAt(value: unknown, path: string) {
  const hash = stringAt(value, path);
  if (!SHA256.test(hash)) fail(path, "must be a lowercase SHA-256 digest");
  return hash;
}

function safeCropAt(value: unknown, path: string): CinematicPreludeSafeCrop {
  const crop = objectAt(value, path);
  const parsed = {
    left: numberAt(crop.left, `${path}.left`),
    right: numberAt(crop.right, `${path}.right`),
    top: numberAt(crop.top, `${path}.top`),
    bottom: numberAt(crop.bottom, `${path}.bottom`)
  };
  for (const [edge, amount] of Object.entries(parsed)) {
    if (amount < 0 || amount > 0.25) fail(`${path}.${edge}`, "must be in [0, 0.25]");
  }
  return parsed;
}

function variantAt(
  value: unknown,
  tier: CinematicPreludeTier
): CinematicPreludeVariant {
  const path = `variants.${tier}`;
  const variant = objectAt(value, path);
  const desktop = tier === "desktop";
  const maxTransferBytes = desktop ? 6 * 1024 * 1024 : 2 * 1024 * 1024;
  const firstFrameDeadlineMs = desktop ? 1200 : 1800;
  const maxPresentationResidencyBytes = desktop ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
  const transferBytes = numberAt(variant.transferBytes, `${path}.transferBytes`);
  const estimatedPresentationResidencyBytes = numberAt(
    variant.estimatedPresentationResidencyBytes,
    `${path}.estimatedPresentationResidencyBytes`
  );
  if (transferBytes > maxTransferBytes) fail(`${path}.transferBytes`, "exceeds tier budget");
  if (estimatedPresentationResidencyBytes > maxPresentationResidencyBytes) {
    fail(`${path}.estimatedPresentationResidencyBytes`, "exceeds tier budget");
  }

  const translation = objectAt(
    variant.maxNormalizedTranslation,
    `${path}.maxNormalizedTranslation`
  );

  return {
    tier: exactAt(variant.tier, tier, `${path}.tier`),
    src: stringAt(variant.src, `${path}.src`),
    sourceSha256: shaAt(variant.sourceSha256, `${path}.sourceSha256`),
    sha256: shaAt(variant.sha256, `${path}.sha256`),
    transferBytes,
    width: numberAt(variant.width, `${path}.width`),
    height: numberAt(variant.height, `${path}.height`),
    frameRate: exactAt(variant.frameRate, 30, `${path}.frameRate`),
    frameCount: exactAt(variant.frameCount, 48, `${path}.frameCount`),
    durationSeconds: exactAt(variant.durationSeconds, 1.6, `${path}.durationSeconds`),
    keyframePolicy: exactAt(variant.keyframePolicy, "all-i", `${path}.keyframePolicy`),
    colorSpace: exactAt(
      variant.colorSpace,
      "rec709-srgb-sdr",
      `${path}.colorSpace`
    ),
    opaque: exactAt(variant.opaque, true, `${path}.opaque`),
    audio: exactAt(variant.audio, false, `${path}.audio`),
    firstFrameDeadlineMs: exactAt(
      variant.firstFrameDeadlineMs,
      firstFrameDeadlineMs,
      `${path}.firstFrameDeadlineMs`
    ),
    maxPresentationResidencyBytes: exactAt(
      variant.maxPresentationResidencyBytes,
      maxPresentationResidencyBytes,
      `${path}.maxPresentationResidencyBytes`
    ),
    estimatedPresentationResidencyBytes,
    safeCrop: safeCropAt(variant.safeCrop, `${path}.safeCrop`),
    runtimeOverscanScale: numberAt(
      variant.runtimeOverscanScale,
      `${path}.runtimeOverscanScale`
    ),
    maxNormalizedTranslation: {
      x: numberAt(translation.x, `${path}.maxNormalizedTranslation.x`),
      y: numberAt(translation.y, `${path}.maxNormalizedTranslation.y`)
    }
  };
}

export function validateCinematicPreludeManifest(
  value: unknown
): CinematicPreludeManifest {
  const manifest = objectAt(value, "manifest");
  const source = objectAt(manifest.source, "source");
  const handoff = objectAt(manifest.handoff, "handoff");
  const veilProfile = objectAt(handoff.veilProfile, "handoff.veilProfile");
  const variants = objectAt(manifest.variants, "variants");
  const colorSrgb = stringAt(veilProfile.colorSrgb, "handoff.veilProfile.colorSrgb");
  if (!HEX_COLOR.test(colorSrgb)) {
    fail("handoff.veilProfile.colorSrgb", "must be a six-digit sRGB hex color");
  }

  return {
    schemaVersion: exactAt(manifest.schemaVersion, 1, "schemaVersion"),
    id: stringAt(manifest.id, "id"),
    authoredDurationSeconds: exactAt(
      manifest.authoredDurationSeconds,
      1.584,
      "authoredDurationSeconds"
    ),
    encodedDurationSeconds: exactAt(
      manifest.encodedDurationSeconds,
      1.6,
      "encodedDurationSeconds"
    ),
    source: {
      license: exactAt(source.license, "internally-generated", "source.license"),
      renderer: stringAt(source.renderer, "source.renderer"),
      rendererVersion: stringAt(source.rendererVersion, "source.rendererVersion"),
      scenePath: stringAt(source.scenePath, "source.scenePath"),
      seed:
        source.seed === null ? null : stringAt(source.seed, "source.seed"),
      parameterSummary: objectAt(source.parameterSummary, "source.parameterSummary"),
      referenceCanvasSha256: shaAt(
        source.referenceCanvasSha256,
        "source.referenceCanvasSha256"
      ),
      toolVersions: Object.fromEntries(
        Object.entries(objectAt(source.toolVersions, "source.toolVersions")).map(
          ([tool, version]) => [tool, stringAt(version, `source.toolVersions.${tool}`)]
        )
      )
    },
    handoff: {
      plateEndProgress: exactAt(handoff.plateEndProgress, 0.18, "handoff.plateEndProgress"),
      cutProgress: exactAt(handoff.cutProgress, 0.195, "handoff.cutProgress"),
      veilPeakProgress: exactAt(
        handoff.veilPeakProgress,
        0.195,
        "handoff.veilPeakProgress"
      ),
      liveProgress: exactAt(handoff.liveProgress, 0.22, "handoff.liveProgress"),
      cloudEntryFrame: exactAt(handoff.cloudEntryFrame, 39, "handoff.cloudEntryFrame"),
      cutFrame: exactAt(handoff.cutFrame, 42, "handoff.cutFrame"),
      liveFrame: exactAt(handoff.liveFrame, 47, "handoff.liveFrame"),
      veilProfile: {
        colorSrgb,
        luminanceY: numberAt(veilProfile.luminanceY, "handoff.veilProfile.luminanceY"),
        peakOpacity: exactAt(
          veilProfile.peakOpacity,
          1,
          "handoff.veilProfile.peakOpacity"
        ),
        edgeSoftness: numberAt(
          veilProfile.edgeSoftness,
          "handoff.veilProfile.edgeSoftness"
        )
      }
    },
    variants: {
      desktop: variantAt(variants.desktop, "desktop"),
      mobile: variantAt(variants.mobile, "mobile")
    }
  };
}

export function mapPreludeProgressToFrame(
  progress: number,
  manifest: CinematicPreludeManifest,
  tier: CinematicPreludeTier = "desktop"
) {
  const frameCount = manifest.variants[tier].frameCount;
  const clamped = Math.min(manifest.handoff.liveProgress, Math.max(0, progress));
  return Math.min(
    frameCount - 1,
    Math.floor((clamped / manifest.handoff.liveProgress) * frameCount)
  );
}
