"use client";

import { EarthMoonScene, resolveLandingAssets, resolveLandingPreset } from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type { EarthMoonHeroMode } from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";

interface LuBirthSceneSlotProps {
  mode: EarthMoonHeroMode;
  quality?: LandingQuality;
  paused?: boolean;
}

export function LuBirthSceneSlot({ mode, quality = "auto", paused = false }: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityProfile = useQualityTier(quality, reducedMotion);
  const composition = resolveLandingPreset(mode);
  const assets = resolveLandingAssets();

  if (qualityProfile.tier === "fallback") {
    return null;
  }

  return (
    <EarthMoonScene
      mode={mode}
      composition={composition}
      assets={assets}
      quality={qualityProfile}
      reducedMotion={reducedMotion}
      paused={paused}
    />
  );
}
