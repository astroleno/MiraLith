import type { ResolvedQualityTier } from "@miralith/visual-core";
import type {
  LandingRenderProfile,
  LandingRuntimeProfile,
  LandingVisualPolicy
} from "./types";

export interface LandingVisualPolicyInput {
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
  if (input.qualityTier === "low" || input.qualityTier === "fallback") {
    return {
      cloudMode: "surface",
      groundShadow: false,
      atmosphereMode: "surface-glow",
      postEffectMode: "off",
      reason: `quality-${input.qualityTier}`
    };
  }

  if (isDebugProfile(input.renderProfile)) {
    return {
      cloudMode: "lookdev",
      groundShadow: true,
      atmosphereMode: input.renderProfile === "debug-atmosphere" ? "lookdev" : "surface-glow",
      postEffectMode: "full-bloom",
      reason: "debug-lookdev"
    };
  }

  if (input.runtimeProfile === "home-lite") {
    return {
      cloudMode: "shell-lite",
      groundShadow: true,
      atmosphereMode: "surface-glow",
      postEffectMode: "analytic-halo",
      reason: "home-lite"
    };
  }

  return {
    cloudMode: "lookdev",
    groundShadow: true,
    atmosphereMode: "surface-glow",
    postEffectMode: "full-bloom",
    reason: "full-lookdev"
  };
}
