import type { LandingAssetManifest } from "./types";

export const DEFAULT_LUBIRTH_ASSETS: LandingAssetManifest = {
  earthDay: {
    id: "earth-procedural",
    src: "procedural:earth-canvas-texture",
    width: 1024,
    height: 512,
    format: "png",
    colorSpace: "srgb"
  },
  moonColor: {
    id: "moon-procedural",
    src: "procedural:moon-canvas-texture",
    width: 512,
    height: 512,
    format: "png",
    colorSpace: "srgb"
  },
  fallbackPoster: {
    id: "lubirth-poster-field",
    kind: "poster",
    tier: "fallback",
    src: "/assets/lubirth/poster-field.webp",
    bytesBudget: 240_000,
    preload: false,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  }
};

export function resolveLandingAssets(assets: Partial<LandingAssetManifest> = {}): LandingAssetManifest {
  return {
    ...DEFAULT_LUBIRTH_ASSETS,
    ...assets
  };
}
