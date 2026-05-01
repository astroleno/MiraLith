"use client";

import { useEffect } from "react";
import { EarthMoonScene, resolveLandingAssets, resolveLandingPreset } from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type {
  LandingAssetManifest,
  LandingAuroraProfile,
  EarthMoonHeroMode,
  LandingMoonLightingMode,
  LandingRenderProfile,
  LandingVisualDebugLayer,
  LuBirthProjectionFrame
} from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";

const HIGH_DETAIL_EARTH_ASSETS: Partial<LandingAssetManifest> = {
  earthDay: {
    id: "earth-day-8k",
    src: "/assets/lubirth/textures/earth-day-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  },
  earthNight: {
    id: "earth-night-8k",
    src: "/assets/lubirth/textures/earth-night-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  },
  earthClouds: {
    id: "earth-clouds-8k",
    src: "/assets/lubirth/textures/earth-clouds-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  }
};

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
  renderProfile?: LandingRenderProfile;
  paused?: boolean;
  onProjectionFrame?: (frame: LuBirthProjectionFrame) => void;
  onVisualReadyEnough?: () => void;
  onMoonTextureReady?: () => void;
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

function readRenderProfileOverride(): LandingRenderProfile | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const profile = new URLSearchParams(window.location.search).get("profile");
  if (
    profile === "clean" ||
    profile === "nasa" ||
    profile === "debug-stars" ||
    profile === "debug-clouds" ||
    profile === "debug-atmosphere" ||
    profile === "debug-aurora"
  ) {
    return profile;
  }

  return undefined;
}

export function LuBirthSceneSlot({
  mode,
  quality = "auto",
  debugMianyang = false,
  visualDebugLayer = "all",
  renderProfile,
  paused = false,
  onProjectionFrame,
  onVisualReadyEnough,
  onMoonTextureReady
}: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityOverride = readQualityOverride();
  const auroraProfile = readAuroraProfile();
  const renderProfileOverride = readRenderProfileOverride();
  const activeRenderProfile = renderProfileOverride ?? renderProfile;
  const qualityProfile = useQualityTier(qualityOverride ?? quality, reducedMotion);
  const moonLightingMode = readMoonLightingMode();
  const composition = resolveLandingPreset(
    mode,
    moonLightingMode ? { moon: { lightingMode: moonLightingMode } } : undefined
  );
  const useHighDetailEarthAssets = qualityProfile.tier === "high" && activeRenderProfile !== "clean";
  const assets = resolveLandingAssets(useHighDetailEarthAssets ? HIGH_DETAIL_EARTH_ASSETS : undefined);

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
      renderProfile={activeRenderProfile}
      auroraProfile={auroraProfile}
      reducedMotion={reducedMotion}
      paused={paused}
      onProjectionFrame={onProjectionFrame}
      onVisualReadyEnough={onVisualReadyEnough}
      onMoonTextureReady={onMoonTextureReady}
    />
  );
}
