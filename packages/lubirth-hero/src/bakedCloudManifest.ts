export const BAKED_CLOUD_CHANNELS = [
  "colorOpacity",
  "depthOptical",
  "normalAoScatter"
] as const;

export type BakedCloudChannel = (typeof BAKED_CLOUD_CHANNELS)[number];
export type BakedCloudTierId = "desktop" | "mobile";

export interface BakedCloudAssetDescriptor {
  byteLength: number;
  file: string;
  height: number;
  sha256: string;
  width: number;
}

export interface BakedCloudView {
  assets: Record<BakedCloudChannel, BakedCloudAssetDescriptor>;
  id: string;
  viewDirection: [number, number, number];
}

export interface BakedCloudTier {
  id: BakedCloudTierId;
  maxGpuResidencyBytes: number;
  maxTransferBytes: number;
  views: BakedCloudView[];
}

export interface BakedCloudImpostorManifest {
  candidate: string;
  license: "internally-generated";
  provenance: "internal-procedural";
  schemaVersion: 1;
  tiers: BakedCloudTier[];
}

export type BakedCloudManifestValidation =
  | { tierIds: BakedCloudTierId[]; valid: true }
  | { reason: string; valid: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFinitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isSha256(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function invalid(reason: string): BakedCloudManifestValidation {
  return { reason, valid: false };
}

function hasAssetDescriptor(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.file === "string" &&
    value.file.length > 0 &&
    isFinitePositive(value.byteLength) &&
    isFinitePositive(value.width) &&
    isFinitePositive(value.height) &&
    isSha256(value.sha256)
  );
}

function validateView(value: unknown): string | null {
  if (!isRecord(value)) {
    return "invalid-view";
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return "invalid-view-id";
  }
  if (
    !Array.isArray(value.viewDirection) ||
    value.viewDirection.length !== 3 ||
    value.viewDirection.some((component) => typeof component !== "number" || !Number.isFinite(component))
  ) {
    return "invalid-view-direction";
  }
  if (!isRecord(value.assets)) {
    return "missing-channel:colorOpacity";
  }
  for (const channel of BAKED_CLOUD_CHANNELS) {
    const descriptor = value.assets[channel];
    if (descriptor === undefined) {
      return "missing-channel:" + channel;
    }
    if (!hasAssetDescriptor(descriptor)) {
      return "invalid-asset:" + channel;
    }
  }
  return null;
}

function findTier(tiers: unknown[], tierId: BakedCloudTierId) {
  return tiers.find((tier) => isRecord(tier) && tier.id === tierId);
}

export function validateBakedCloudImpostorManifest(input: unknown): BakedCloudManifestValidation {
  if (!isRecord(input) || !Array.isArray(input.tiers)) {
    return invalid("missing-required-tier:desktop");
  }

  for (const tierId of ["desktop", "mobile"] as const) {
    const tier = findTier(input.tiers, tierId);
    if (!isRecord(tier)) {
      return invalid("missing-required-tier:" + tierId);
    }
    if (
      !isFinitePositive(tier.maxTransferBytes) ||
      !isFinitePositive(tier.maxGpuResidencyBytes) ||
      (tier.maxGpuResidencyBytes as number) < (tier.maxTransferBytes as number)
    ) {
      return invalid("invalid-budget:" + tierId);
    }
    if (!Array.isArray(tier.views) || tier.views.length < 4) {
      return invalid("missing-views:" + tierId);
    }
    for (const view of tier.views) {
      const viewError = validateView(view);
      if (viewError) {
        return invalid(viewError);
      }
    }
  }

  if (input.schemaVersion !== 1) {
    return invalid("invalid-schema-version");
  }
  if (input.provenance !== "internal-procedural") {
    return invalid("invalid-provenance");
  }
  if (input.license !== "internally-generated") {
    return invalid("invalid-license");
  }

  return { tierIds: ["desktop", "mobile"], valid: true };
}
