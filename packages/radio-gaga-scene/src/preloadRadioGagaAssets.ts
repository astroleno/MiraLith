"use client";

import { useGLTF } from "@react-three/drei";

export const RADIO_GAGA_OPENING_MODEL_SRC = "/model/radio_gaga.glb";
export const RADIO_GAGA_FINALE_MODEL_SRC = "/model/xiaozhi_esp32.glb";

let openingPreloaded = false;
let finalePreloaded = false;

export function preloadRadioGagaOpeningAssets() {
  if (!openingPreloaded) {
    openingPreloaded = true;
    useGLTF.preload(RADIO_GAGA_OPENING_MODEL_SRC);
  }
}

export function preloadRadioGagaFinaleAssets() {
  if (!finalePreloaded) {
    finalePreloaded = true;
    useGLTF.preload(RADIO_GAGA_FINALE_MODEL_SRC);
  }
}
