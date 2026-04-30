"use client";

import { useEffect } from "react";
import { EarthMoonScene, resolveLandingAssets, resolveLandingPreset } from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type {
  LandingAuroraProfile,
  EarthMoonHeroMode,
  LandingMoonLightingMode,
  LandingVisualDebugLayer,
  LuBirthProjectionFrame
} from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";

declare global {
  interface Window {
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthAuroraEnabled?: boolean;
    __MiraLithLuBirthAuroraProfile?: LandingAuroraProfile;
  }
}

interface LuBirthSceneSlotProps {
  mode: EarthMoonHeroMode;
  quality?: LandingQuality;
  debugMianyang?: boolean;
  visualDebugLayer?: LandingVisualDebugLayer;
  paused?: boolean;
  onProjectionFrame?: (frame: LuBirthProjectionFrame) => void;
  onVisualReadyEnough?: () => void;
}

function readMoonLightingMode(): LandingMoonLightingMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const mode = new URLSearchParams(window.location.search).get("moonLight");
  return mode === "birthPhase" || mode === "sceneLit" || mode === "mixed" ? mode : undefined;
}

function readQualityOverride(): LandingQuality | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const quality = new URLSearchParams(window.location.search).get("quality");
  return quality === "high" || quality === "medium" || quality === "low" || quality === "auto" ? quality : undefined;
}

function readAuroraProfile(): LandingAuroraProfile {
  if (typeof window === "undefined") {
    return "hero";
  }

  const profile = new URLSearchParams(window.location.search).get("auroraProfile");
  return profile === "debug" ? "debug" : "hero";
}

export function LuBirthSceneSlot({
  mode,
  quality = "auto",
  debugMianyang = false,
  visualDebugLayer = "all",
  paused = false,
  onProjectionFrame,
  onVisualReadyEnough
}: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityOverride = readQualityOverride();
  const auroraProfile = readAuroraProfile();
  const qualityProfile = useQualityTier(qualityOverride ?? quality, reducedMotion);
  const moonLightingMode = readMoonLightingMode();
  const composition = resolveLandingPreset(
    mode,
    moonLightingMode ? { moon: { lightingMode: moonLightingMode } } : undefined
  );
  const assets = resolveLandingAssets();

  useEffect(() => {
    window.__MiraLithLuBirthQualityTier = qualityProfile.tier;
    window.__MiraLithLuBirthAuroraEnabled = qualityProfile.aurora;
    window.__MiraLithLuBirthAuroraProfile = auroraProfile;
  }, [auroraProfile, qualityProfile.aurora, qualityProfile.tier]);

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
      auroraProfile={auroraProfile}
      reducedMotion={reducedMotion}
      paused={paused}
      onProjectionFrame={onProjectionFrame}
      onVisualReadyEnough={onVisualReadyEnough}
    />
  );
}
