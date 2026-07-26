"use client";

import { useGLTF } from "@react-three/drei";

export const RADIO_GAGA_OPENING_MODEL_SRC = "/model/radio_gaga.glb";

let openingPreloaded = false;

export function preloadRadioGagaOpeningAssets() {
  if (!openingPreloaded) {
    openingPreloaded = true;
    useGLTF.preload(RADIO_GAGA_OPENING_MODEL_SRC);
  }
}
