import type { LandingQuality, ResolvedQualityTier } from "@miralith/visual-core";
import type { LandingAtmosphereLook, LandingAtmosphereVariant, LandingRenderProfile } from "./types";

export type LandingAtmospherePolicy = LandingAtmosphereVariant | "hybrid";
export type LuBirthAtmosphereRouteVariant = "home" | "study" | "spike";

export interface LuBirthAtmospherePolicyInput {
  policy: LandingAtmospherePolicy;
  routeVariant: LuBirthAtmosphereRouteVariant;
  renderProfile: LandingRenderProfile;
  requestedQuality: LandingQuality;
  resolvedQualityTier: ResolvedQualityTier;
  reducedMotion: boolean;
  mobileLandscape: boolean;
  homeIntroRendering: boolean;
  productionSurface: boolean;
  productionLook: LandingAtmosphereLook;
}

export interface LuBirthAtmospherePolicyResult {
  atmosphereLook: LandingAtmosphereLook;
  atmosphereVariant: LandingAtmosphereVariant;
  reason: string;
}

function stack(reason: string, productionLook: LandingAtmosphereLook): LuBirthAtmospherePolicyResult {
  return {
    atmosphereLook: productionLook,
    atmosphereVariant: "stack",
    reason
  };
}

function volumetric(reason: string, productionLook: LandingAtmosphereLook): LuBirthAtmospherePolicyResult {
  return {
    atmosphereLook: productionLook,
    atmosphereVariant: "volumetric",
    reason
  };
}

function isDebugProfile(renderProfile: LandingRenderProfile) {
  return renderProfile.startsWith("debug-");
}

export function resolveLuBirthAtmospherePolicy(
  input: LuBirthAtmospherePolicyInput
): LuBirthAtmospherePolicyResult {
  if (input.homeIntroRendering) {
    return stack("home-intro-stack", input.productionLook);
  }

  if (input.resolvedQualityTier === "low" || input.resolvedQualityTier === "fallback") {
    return stack(`quality-${input.resolvedQualityTier}-stack`, input.productionLook);
  }

  if (input.reducedMotion) {
    return stack("reduced-motion-stack", input.productionLook);
  }

  if (input.mobileLandscape && input.requestedQuality !== "high") {
    return stack("mobile-landscape-safe-stack", input.productionLook);
  }

  if (input.productionSurface && input.mobileLandscape) {
    return stack("production-mobile-landscape-stack", input.productionLook);
  }

  if (input.policy === "stack") {
    return stack("policy-stack", input.productionLook);
  }

  if (input.productionSurface && isDebugProfile(input.renderProfile)) {
    return stack("production-debug-profile-stack", input.productionLook);
  }

  if (input.policy === "volumetric") {
    if (input.productionSurface && input.resolvedQualityTier !== "high") {
      return stack("production-volumetric-requires-high-stack", input.productionLook);
    }

    return volumetric(
      input.productionSurface ? "production-volumetric-high" : "spike-volumetric-review",
      input.productionLook
    );
  }

  if (
    input.productionSurface &&
    input.routeVariant !== "spike" &&
    input.renderProfile === "nasa" &&
    input.resolvedQualityTier === "high"
  ) {
    return volumetric("hybrid-nasa-high-production", input.productionLook);
  }

  return stack("hybrid-safe-stack", input.productionLook);
}
