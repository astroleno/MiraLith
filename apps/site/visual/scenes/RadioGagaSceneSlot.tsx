"use client";

import { RadioGagaSceneContent } from "@miralith/radio-gaga-scene";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";

interface RadioGagaSceneSlotProps {
  progress: number;
  active: boolean;
  onReady?: () => void;
}

export function RadioGagaSceneSlot({ progress, active, onReady }: RadioGagaSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const quality = useQualityTier("auto", reducedMotion);

  if (quality.tier === "fallback") {
    return null;
  }

  return (
    <RadioGagaSceneContent
      progress={progress}
      active={active}
      quality={quality}
      reducedMotion={reducedMotion}
      onReady={onReady}
    />
  );
}
