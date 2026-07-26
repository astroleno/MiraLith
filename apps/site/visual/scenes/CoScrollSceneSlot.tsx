"use client";

import {
  CoScrollSceneContent,
  DEFAULT_COSCROLL_TIMELINE,
  resolveCoScrollAssets,
  type CoScrollFallbackReason
} from "@miralith/coscroll-scene";
import { useQualityTier, useReducedMotionPreference, type LandingQuality } from "@miralith/visual-core";
import { useEffect } from "react";

interface CoScrollSceneSlotProps {
  progress?: number;
  active?: boolean;
  quality?: LandingQuality;
  paused?: boolean;
  onReady?: () => void;
  onFallback?: (reason: CoScrollFallbackReason) => void;
}

export function CoScrollSceneSlot({
  progress = 0,
  active = false,
  quality = "auto",
  paused = false,
  onReady,
  onFallback
}: CoScrollSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityProfile = useQualityTier(quality, reducedMotion);

  useEffect(() => {
    if (active && qualityProfile.tier === "fallback") {
      onFallback?.("quality-tier");
    }
  }, [active, onFallback, qualityProfile.tier]);

  if (qualityProfile.tier === "fallback") {
    return null;
  }

  return (
    <CoScrollSceneContent
      progress={progress}
      active={active}
      quality={qualityProfile}
      reducedMotion={reducedMotion}
      timeline={DEFAULT_COSCROLL_TIMELINE}
      assets={resolveCoScrollAssets()}
      paused={paused}
      onReady={onReady}
      onFallback={onFallback}
    />
  );
}
