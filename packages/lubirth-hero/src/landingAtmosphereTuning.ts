import type {
  LandingCloseAtmosphereTuning,
  LandingRuntimeProfile
} from "./types";

export const EMPTY_CLOSE_ATMOSPHERE_TUNING: LandingCloseAtmosphereTuning = {
  edgeGlowStrength: 0,
  verticalGradientStrength: 0,
  depthShadowStrength: 0,
  groundProjectionStrength: 0,
  cloudVolumeShadowStrength: 0
};

export const HOME_CLOSE_ATMOSPHERE_TUNING: LandingCloseAtmosphereTuning = {
  edgeGlowStrength: 0.82,
  verticalGradientStrength: 0.24,
  depthShadowStrength: 0.18,
  groundProjectionStrength: 0.32,
  cloudVolumeShadowStrength: 0.26
};

export function resolveLandingCloseAtmosphereTuning({
  runtimeProfile,
  overrides
}: {
  runtimeProfile: LandingRuntimeProfile;
  overrides?: Partial<LandingCloseAtmosphereTuning>;
}): LandingCloseAtmosphereTuning {
  return {
    ...(runtimeProfile === "home-lite"
      ? HOME_CLOSE_ATMOSPHERE_TUNING
      : EMPTY_CLOSE_ATMOSPHERE_TUNING),
    ...overrides
  };
}
