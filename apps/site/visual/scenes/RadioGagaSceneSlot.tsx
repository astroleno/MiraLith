"use client";

import { RadioGagaSceneContent } from "@miralith/radio-gaga-scene";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";

interface RadioGagaSceneSlotProps {
  progress?: number;
  progressRef?: { current: number };
  active: boolean;
  onReady?: () => void;
}

export function RadioGagaSceneSlot({ progress = 0, progressRef, active, onReady }: RadioGagaSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const quality = useQualityTier("auto", reducedMotion);

  if (quality.tier === "fallback") {
    return null;
  }

  return (
    <RadioGagaSceneContent
      progress={progress}
      progressRef={progressRef}
      active={active}
      quality={quality}
      reducedMotion={reducedMotion}
      onReady={onReady}
    />
  );
}
