"use client";

import { EarthMoonScene, resolveLandingAssets, resolveLandingPreset } from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type {
  EarthMoonHeroMode,
  LandingMoonLightingMode,
  LandingVisualDebugLayer,
  LuBirthProjectionFrame
} from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";

interface LuBirthSceneSlotProps {
  mode: EarthMoonHeroMode;
  quality?: LandingQuality;
  debugMianyang?: boolean;
  visualDebugLayer?: LandingVisualDebugLayer;
  paused?: boolean;
  onProjectionFrame?: (frame: LuBirthProjectionFrame) => void;
}

function readMoonLightingMode(): LandingMoonLightingMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const mode = new URLSearchParams(window.location.search).get("moonLight");
  return mode === "birthPhase" || mode === "sceneLit" || mode === "mixed" ? mode : undefined;
}

export function LuBirthSceneSlot({
  mode,
  quality = "auto",
  debugMianyang = false,
  visualDebugLayer = "all",
  paused = false,
  onProjectionFrame
}: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityProfile = useQualityTier(quality, reducedMotion);
  const moonLightingMode = readMoonLightingMode();
  const composition = resolveLandingPreset(
    mode,
    moonLightingMode ? { moon: { lightingMode: moonLightingMode } } : undefined
  );
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
      debugMianyang={debugMianyang}
      visualDebugLayer={visualDebugLayer}
      reducedMotion={reducedMotion}
      paused={paused}
      onProjectionFrame={onProjectionFrame}
    />
  );
}
