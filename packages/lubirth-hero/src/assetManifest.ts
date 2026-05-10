import type { LandingAsset, LandingAssetManifest } from "./types";
import { LUBIRTH_CLOUD_DECK_TEXTURE } from "./cloudDeckTexture";

export const DEFAULT_LUBIRTH_ASSETS: LandingAssetManifest = {
  earthDay: {
    id: "earth-day-2k",
    src: "/assets/lubirth/textures/earth-day-2k.jpg",
    width: 2048,
    height: 1024,
    format: "jpg",
    colorSpace: "srgb"
  },
  earthNight: {
    id: "earth-night-2k",
    src: "/assets/lubirth/textures/earth-night-2k.jpg",
    width: 2048,
    height: 1024,
    format: "jpg",
    colorSpace: "srgb"
  },
  earthClouds: {
    id: "earth-clouds-2k-light",
    src: "/assets/lubirth/textures/earth-clouds-2k-light.jpg",
    width: 2048,
    height: 1024,
    format: "jpg",
    colorSpace: "srgb"
  },
  earthSpecular: {
    id: "earth-specular-4k",
    src: "/assets/lubirth/textures/earth-specular-4k.png",
    width: 4096,
    height: 2048,
    format: "png",
    colorSpace: "linear"
  },
  earthCloudDeck: LUBIRTH_CLOUD_DECK_TEXTURE,
  earthHorizonCloudStrip: {
    id: "earth-horizon-cloud-strip-2k",
    src: "/assets/lubirth/textures/earth-horizon-cloud-strip-2k.png",
    width: 2048,
    height: 256,
    format: "png",
    colorSpace: "linear"
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
    id: "8k-stars-milky-way",
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
    textureBudget(resolvedAssets.earthDay, 520_000, "critical", true),
    textureBudget(
      resolvedAssets.earthNight ?? DEFAULT_LUBIRTH_ASSETS.earthNight ?? {
        id: "earth-night-2k",
        src: "/assets/lubirth/textures/earth-night-2k.jpg",
        width: 2048,
        height: 1024,
        format: "jpg",
        colorSpace: "srgb"
      },
      320_000,
      "critical",
      true
    ),
    textureBudget(
      resolvedAssets.earthClouds ?? DEFAULT_LUBIRTH_ASSETS.earthClouds ?? {
        id: "earth-clouds-2k-light",
        src: "/assets/lubirth/textures/earth-clouds-2k-light.jpg",
        width: 2048,
        height: 1024,
        format: "jpg",
        colorSpace: "srgb"
      },
      680_000,
      "critical",
      true
    ),
    textureBudget(
      resolvedAssets.earthCloudDeck ?? LUBIRTH_CLOUD_DECK_TEXTURE,
      560_000,
      "critical",
      true
    ),
    ...(resolvedAssets.earthNormal
      ? [textureBudget(resolvedAssets.earthNormal, 420_000, "idle", false)]
      : []),
    ...(resolvedAssets.earthSpecular
      ? [textureBudget(resolvedAssets.earthSpecular, 900_000, "idle", false)]
      : []),
    ...(resolvedAssets.earthDisplacement
      ? [textureBudget(resolvedAssets.earthDisplacement, 1_600_000, "idle", false)]
      : []),
    textureBudget(
      resolvedAssets.earthHorizonCloudStrip ?? DEFAULT_LUBIRTH_ASSETS.earthHorizonCloudStrip ?? {
        id: "earth-horizon-cloud-strip-2k",
        src: "/assets/lubirth/textures/earth-horizon-cloud-strip-2k.png",
        width: 2048,
        height: 256,
        format: "png",
        colorSpace: "linear"
      },
      720_000,
      "idle",
      false
    ),
    textureBudget(resolvedAssets.moonColor, 1_100_000, "critical", true),
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
