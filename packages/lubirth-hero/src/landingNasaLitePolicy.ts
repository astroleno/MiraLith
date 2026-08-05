import type { ResolvedQualityTier } from "@miralith/visual-core";

export type LandingNasaLiteBand = "far" | "middle" | "near";

export const LANDING_NASA_LITE_CLOUD_BOTTOM_SCALE = 1.003;
export const LANDING_NASA_LITE_CLOUD_TOP_SCALE = 1.012;
export const LANDING_NASA_LITE_ATMOSPHERE_RADIUS_SCALE = 1.014;
export const LANDING_NASA_LITE_ATMOSPHERE_OPTICAL_THICKNESS_SCALE = 0.01;

export interface LandingNasaLiteBudget {
  atmosphereSteps: 1 | 2 | 4;
  band: LandingNasaLiteBand;
  cloudLightSamples: 0 | 1;
  cloudViewSteps: 1 | 2 | 4;
  mobile: boolean;
  projectedRadiusRatio: number;
}

interface ResolveLandingNasaLiteBudgetInput {
  mobile: boolean;
  previousBand?: LandingNasaLiteBand;
  projectedRadiusRatio: number;
  qualityTier: ResolvedQualityTier;
}

const NEAR_ENTER = 0.7;
const NEAR_EXIT = 0.6;
const FAR_ENTER = 0.2;
const FAR_EXIT = 0.3;

export function isLandingNasaLiteMobileViewport(
  width: number,
  height: number,
  maxTouchPoints = 0
) {
  const shortEdge = Math.min(width, height);
  const compactViewport = width < 760 || shortEdge < 540;
  const touchViewport = maxTouchPoints > 0 && width < 1_120;
  return compactViewport || touchViewport;
}

export function resolveLandingNasaLiteBand(
  projectedRadiusRatio: number,
  previousBand?: LandingNasaLiteBand
): LandingNasaLiteBand {
  const ratio = Math.max(0, projectedRadiusRatio);

  if (previousBand === "near") {
    return ratio >= NEAR_EXIT ? "near" : ratio <= FAR_ENTER ? "far" : "middle";
  }
  if (previousBand === "far") {
    return ratio <= FAR_EXIT ? "far" : ratio >= NEAR_ENTER ? "near" : "middle";
  }
  if (previousBand === "middle") {
    if (ratio >= NEAR_ENTER) {
      return "near";
    }
    if (ratio <= FAR_ENTER) {
      return "far";
    }
    return "middle";
  }

  if (ratio >= 0.65) {
    return "near";
  }
  if (ratio < 0.25) {
    return "far";
  }
  return "middle";
}

export function resolveLandingNasaLiteBudget({
  mobile,
  previousBand,
  projectedRadiusRatio,
  qualityTier
}: ResolveLandingNasaLiteBudgetInput): LandingNasaLiteBudget {
  const band = resolveLandingNasaLiteBand(projectedRadiusRatio, previousBand);
  const constrainedMobile = mobile || qualityTier === "low" || qualityTier === "fallback";

  if (band === "near") {
    return {
      atmosphereSteps: constrainedMobile ? 2 : 4,
      band,
      cloudLightSamples: 1,
      cloudViewSteps: constrainedMobile ? 2 : 4,
      mobile: constrainedMobile,
      projectedRadiusRatio
    };
  }

  if (band === "middle" && !constrainedMobile) {
    return {
      atmosphereSteps: 2,
      band,
      cloudLightSamples: 1,
      cloudViewSteps: 2,
      mobile: false,
      projectedRadiusRatio
    };
  }

  return {
    atmosphereSteps: 1,
    band,
    cloudLightSamples: 0,
    cloudViewSteps: 1,
    mobile: constrainedMobile,
    projectedRadiusRatio
  };
}
