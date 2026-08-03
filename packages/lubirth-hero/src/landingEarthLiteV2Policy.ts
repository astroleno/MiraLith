export const LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE = 1.0003;
export const LANDING_RELIEF_LITE_CLOUD_TOP_SCALE = 1.0035;
export const LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE = 1.014;
export const LANDING_LIMB_LITE_SUPPORT_RADIUS_SCALE = 1.018;
export const LANDING_LIMB_LITE_DIFFUSE_RADIUS_SCALE = 1.032;
export const LANDING_LIMB_LITE_DIFFUSE_SUPPORT_RADIUS_SCALE = 1.044;

export const LANDING_RELIEF_LITE_MOBILE_TEXTURE_READS = 3;
export const LANDING_RELIEF_LITE_DESKTOP_TEXTURE_READS = 4;
export const LANDING_RELIEF_LITE_MOBILE_VIEW_STEPS = 2;
export const LANDING_RELIEF_LITE_DESKTOP_VIEW_STEPS = 3;
export const LANDING_RELIEF_LITE_SUN_STEPS = 1;
export const LANDING_RELIEF_LITE_TEMPORAL_JITTER = false;

export interface LandingReliefLiteBudget {
  mobile: boolean;
  textureReads: 3 | 4;
  viewSteps: 2 | 3;
  sunSteps: 1;
}

export function isLandingReliefLiteMobileViewport(
  width: number,
  height: number,
  maxTouchPoints = 0
) {
  const shortEdge = Math.min(width, height);
  return width < 760 || shortEdge < 540 || (maxTouchPoints > 0 && width < 1_120);
}

export function resolveLandingReliefLiteBudget(mobile: boolean): LandingReliefLiteBudget {
  return {
    mobile,
    sunSteps: LANDING_RELIEF_LITE_SUN_STEPS,
    textureReads: mobile
      ? LANDING_RELIEF_LITE_MOBILE_TEXTURE_READS
      : LANDING_RELIEF_LITE_DESKTOP_TEXTURE_READS,
    viewSteps: mobile
      ? LANDING_RELIEF_LITE_MOBILE_VIEW_STEPS
      : LANDING_RELIEF_LITE_DESKTOP_VIEW_STEPS
  };
}

export function hasValidReliefLiteLayerOrdering() {
  return (
    LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE > 1 &&
    LANDING_RELIEF_LITE_CLOUD_TOP_SCALE > LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE &&
    LANDING_RELIEF_LITE_CLOUD_TOP_SCALE < LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE &&
    LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE < LANDING_LIMB_LITE_SUPPORT_RADIUS_SCALE
  );
}
