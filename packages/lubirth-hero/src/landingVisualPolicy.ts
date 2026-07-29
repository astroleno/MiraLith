import type { ResolvedQualityTier } from "@miralith/visual-core";
import type {
  LandingAtmosphereMode,
  LandingCloudMode,
  LandingPostEffectMode,
  LandingRenderProfile,
  LandingRuntimeProfile,
  LandingVisualPolicy
} from "./types";

export interface LandingVisualPolicyOverrides {
  atmosphereMode?: LandingAtmosphereMode;
  cloudMode?: LandingCloudMode;
  postEffectMode?: LandingPostEffectMode;
}

export interface LandingVisualPolicyInput {
  overrides?: LandingVisualPolicyOverrides;
  runtimeProfile: LandingRuntimeProfile;
  qualityTier: ResolvedQualityTier;
  renderProfile: LandingRenderProfile;
}

function isDebugProfile(renderProfile: LandingRenderProfile) {
  return renderProfile.startsWith("debug-");
}

export function resolveLandingVisualPolicy(
  input: LandingVisualPolicyInput
): LandingVisualPolicy {
  let policy: LandingVisualPolicy;

  if (input.qualityTier === "low" || input.qualityTier === "fallback") {
    policy = {
      cloudMode: "surface",
      groundShadow: false,
      atmosphereMode: "surface-glow",
      postEffectMode: "off",
      reason: `quality-${input.qualityTier}`
    };
  } else if (isDebugProfile(input.renderProfile)) {
    policy = {
      cloudMode: "lookdev",
      groundShadow: true,
      atmosphereMode: input.renderProfile === "debug-atmosphere" ? "lookdev" : "surface-glow",
      postEffectMode: "full-bloom",
      reason: "debug-lookdev"
    };
  } else if (input.runtimeProfile === "home-lite") {
    policy = {
      cloudMode: "shell-lite",
      groundShadow: true,
      atmosphereMode: "surface-glow",
      postEffectMode: "analytic-halo",
      reason: "home-lite"
    };
  } else {
    policy = {
      cloudMode: "lookdev",
      groundShadow: true,
      atmosphereMode: "surface-glow",
      postEffectMode: "full-bloom",
      reason: "full-lookdev"
    };
  }

  return {
    ...policy,
    ...input.overrides
  };
}
