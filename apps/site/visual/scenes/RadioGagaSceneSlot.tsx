"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { RadioGagaSceneContent } from "@miralith/radio-gaga-scene";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";

const RADIO_GAGA_MODEL_ASSETS = [
  "/model/radio_gaga.glb",
  "/model/xiaozhi_esp32.glb"
] as const;
const RADIO_GAGA_PROOF_ASSETS = [
  "/img/website1.PNG",
  "/img/website2.png"
] as const;
let radioGagaAssetsPreloaded = false;

export function preloadRadioGagaSceneAssets() {
  if (radioGagaAssetsPreloaded) {
    return;
  }

  radioGagaAssetsPreloaded = true;
  RADIO_GAGA_MODEL_ASSETS.forEach((asset) => useGLTF.preload(asset));
  useTexture.preload([...RADIO_GAGA_PROOF_ASSETS]);
}

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
