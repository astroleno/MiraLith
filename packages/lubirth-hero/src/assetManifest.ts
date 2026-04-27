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
  spaceBackground: {
    id: "stars-milky-way-8k",
    src: "/assets/lubirth/backgrounds/8k_stars_milky_way.webp",
    width: 8192,
    height: 4096,
    format: "webp",
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

function textureBudget(
  texture: LandingAssetManifest["earthDay"],
  bytesBudget: number,
  tier: LandingAsset["tier"],
  preload: boolean
): LandingAsset {
  return {
    id: texture.id,
    kind: "texture",
    tier,
    src: texture.src,
    bytesBudget,
    preload,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  };
}

export function getLandingAssetBudget(assets: Partial<LandingAssetManifest> = {}): LandingAsset[] {
  const resolvedAssets = resolveLandingAssets(assets);
  const budget = [
    textureBudget(resolvedAssets.earthDay, 2_400_000, "critical", true),
    textureBudget(
      resolvedAssets.earthNight ?? DEFAULT_LUBIRTH_ASSETS.earthNight ?? {
        id: "earth-night-8k",
        src: "/assets/lubirth/textures/earth-night-8k.webp",
        width: 8192,
        height: 4096,
        format: "webp",
        colorSpace: "srgb"
      },
      1_300_000,
      "critical",
      true
    ),
    textureBudget(
      resolvedAssets.earthClouds ?? DEFAULT_LUBIRTH_ASSETS.earthClouds ?? {
        id: "earth-clouds-8k",
        src: "/assets/lubirth/textures/earth-clouds-8k.webp",
        width: 8192,
        height: 4096,
        format: "webp",
        colorSpace: "srgb"
      },
      8_100_000,
      "critical",
      true
    ),
    textureBudget(resolvedAssets.moonColor, 1_060_000, "critical", true),
    resolvedAssets.fallbackPoster
  ];

  if (resolvedAssets.spaceBackground) {
    budget.push(textureBudget(resolvedAssets.spaceBackground, 700_000, "idle", false));
  }

  return budget;
}

export const LUBIRTH_ASSET_BUDGET: LandingAsset[] = getLandingAssetBudget();

export function getCriticalAssetBudget(assets: Partial<LandingAssetManifest> = {}) {
  return getLandingAssetBudget(assets)
    .filter((asset) => asset.tier === "critical")
    .reduce((total, asset) => total + asset.bytesBudget, 0);
}
