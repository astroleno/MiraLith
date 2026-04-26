import type { LandingAsset, LandingAssetManifest } from "./types";

export const DEFAULT_LUBIRTH_ASSETS: LandingAssetManifest = {
  earthDay: {
    id: "earth-day-8k",
    src: "/assets/lubirth/textures/earth-day-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  },
  earthNight: {
    id: "earth-night-8k",
    src: "/assets/lubirth/textures/earth-night-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  },
  earthClouds: {
    id: "earth-clouds-8k",
    src: "/assets/lubirth/textures/earth-clouds-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  },
  moonColor: {
    id: "moon-2k",
    src: "/assets/lubirth/textures/moon-2k.jpg",
    width: 2048,
    height: 1024,
    format: "jpg",
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

export const LUBIRTH_ASSET_BUDGET: LandingAsset[] = [
  {
    id: DEFAULT_LUBIRTH_ASSETS.earthDay.id,
    kind: "texture",
    tier: "critical",
    src: DEFAULT_LUBIRTH_ASSETS.earthDay.src,
    bytesBudget: 2_400_000,
    preload: true,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  },
  {
    id: DEFAULT_LUBIRTH_ASSETS.earthNight?.id ?? "earth-night-8k",
    kind: "texture",
    tier: "critical",
    src: DEFAULT_LUBIRTH_ASSETS.earthNight?.src ?? "/assets/lubirth/textures/earth-night-8k.webp",
    bytesBudget: 1_300_000,
    preload: true,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  },
  {
    id: DEFAULT_LUBIRTH_ASSETS.earthClouds?.id ?? "earth-clouds-8k",
    kind: "texture",
    tier: "critical",
    src: DEFAULT_LUBIRTH_ASSETS.earthClouds?.src ?? "/assets/lubirth/textures/earth-clouds-8k.webp",
    bytesBudget: 8_100_000,
    preload: true,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  },
  {
    id: DEFAULT_LUBIRTH_ASSETS.moonColor.id,
    kind: "texture",
    tier: "critical",
    src: DEFAULT_LUBIRTH_ASSETS.moonColor.src,
    bytesBudget: 1_060_000,
    preload: true,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  },
  DEFAULT_LUBIRTH_ASSETS.fallbackPoster
];

export function getCriticalAssetBudget() {
  return LUBIRTH_ASSET_BUDGET
    .filter((asset) => asset.tier === "critical")
    .reduce((total, asset) => total + asset.bytesBudget, 0);
}
