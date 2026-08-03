import type { LandingReferenceAbsorptionVariant } from "./types";

export const LANDING_REFERENCE_ABSORPTION_VARIANTS = [
  "baseline",
  "earth-material-v1",
  "cloud-scattering-v1",
  "combined-v1"
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
