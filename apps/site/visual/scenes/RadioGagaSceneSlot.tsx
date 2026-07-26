"use client";

import { RadioGagaSceneContent } from "@miralith/radio-gaga-scene";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import { useEffect } from "react";

interface RadioGagaSceneSlotProps {
  progress?: number;
  progressRef?: { current: number };
  active: boolean;
  onReady?: () => void;
  onFallback?: () => void;
}

export function RadioGagaSceneSlot({ progress = 0, progressRef, active, onReady, onFallback }: RadioGagaSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const quality = useQualityTier("auto", reducedMotion);

  useEffect(() => {
    if (active && quality.tier === "fallback") {
      onFallback?.();
    }
  }, [active, onFallback, quality.tier]);

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
