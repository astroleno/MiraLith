import type {
  LandingReferenceAbsorptionCloudDebugMode,
  LandingReferenceAbsorptionVariant
} from "./types";

export const LANDING_REFERENCE_ABSORPTION_VARIANTS = [
  "baseline",
  "earth-material-v1",
  "cloud-scattering-v1",
  "combined-v1"
] as const;

export const LANDING_REFERENCE_ABSORPTION_CLOUD_DEBUG_MODES = [
  "none",
  "cloud-alpha",
  "cloud-lighting"
] as const;

export function resolveLandingReferenceAbsorptionVariant(
  value: string | null | undefined
): LandingReferenceAbsorptionVariant {
  return LANDING_REFERENCE_ABSORPTION_VARIANTS.includes(
    value as LandingReferenceAbsorptionVariant
  )
    ? (value as LandingReferenceAbsorptionVariant)
    : "baseline";
}

export function resolveLandingReferenceAbsorptionCloudDebugMode(
  value: string | null | undefined
): LandingReferenceAbsorptionCloudDebugMode {
  return LANDING_REFERENCE_ABSORPTION_CLOUD_DEBUG_MODES.includes(
    value as LandingReferenceAbsorptionCloudDebugMode
  )
    ? (value as LandingReferenceAbsorptionCloudDebugMode)
    : "none";
}

export function referenceVariantUsesEarthMaterial(
  variant: LandingReferenceAbsorptionVariant
) {
  return variant === "earth-material-v1" || variant === "combined-v1";
}

export function referenceVariantUsesCloudScattering(
  variant: LandingReferenceAbsorptionVariant
) {
  return variant === "cloud-scattering-v1" || variant === "combined-v1";
}
