"use client";

import { SOURCE_COSCROLL_EXCERPT_ASSETS } from "./assetManifest";
import { preloadCoScrollAnchorGeometry, preloadCoScrollMaterialTextures } from "./CoScrollJadeAnchor";
import { preloadCoScrollSourceFont } from "./CoScrollTextBillboard";

let openingAssetsPromise: Promise<void> | null = null;

export function preloadCoScrollOpeningAssets() {
  if (openingAssetsPromise) {
    return openingAssetsPromise;
  }

  const openingAnchor = SOURCE_COSCROLL_EXCERPT_ASSETS.anchors.find((anchor) => anchor.id === "观");
  openingAssetsPromise = Promise.all([
    openingAnchor ? preloadCoScrollAnchorGeometry(openingAnchor.modelSrc, true) : Promise.resolve(),
    preloadCoScrollMaterialTextures(),
    preloadCoScrollSourceFont()
  ]).then(() => undefined);
  return openingAssetsPromise;
}
