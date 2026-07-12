"use client";

import {
  CoScrollSceneContent,
  DEFAULT_COSCROLL_TIMELINE,
  resolveCoScrollAssets
} from "@miralith/coscroll-scene";
import { useQualityTier, useReducedMotionPreference, type LandingQuality } from "@miralith/visual-core";

interface CoScrollSceneSlotProps {
  progress?: number;
  active?: boolean;
  quality?: LandingQuality;
  paused?: boolean;
}

export function CoScrollSceneSlot({
  progress = 0,
  active = false,
  quality = "auto",
  paused = false
}: CoScrollSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityProfile = useQualityTier(quality, reducedMotion);

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
    />
  );
}
