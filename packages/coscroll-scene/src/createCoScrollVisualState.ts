import type {
  CoScrollAssetManifest,
  CoScrollFallbackMode,
  CoScrollTimelineConfig,
  CoScrollVisualState
} from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function ease(progress: number, easing: CoScrollTimelineConfig["easing"]) {
  if (easing === "ritual-slow-in") {
    return progress * progress;
  }

  if (easing === "breath") {
    return progress * progress * (3 - 2 * progress);
  }

  return progress;
}

function resolveFallbackMode(input: {
  active: boolean;
  reducedMotion: boolean;
  qualityTier: string;
}): CoScrollFallbackMode {
  if (input.qualityTier === "fallback") {
    return "poster";
  }

  if (input.reducedMotion) {
    return "dom-static";
  }

  if (!input.active) {
    return "poster";
  }

  return "none";
}

export function createCoScrollVisualState(input: {
  progress: number;
  active: boolean;
  qualityTier: "high" | "medium" | "low" | "fallback";
  reducedMotion: boolean;
  timeline: CoScrollTimelineConfig;
  assets: CoScrollAssetManifest;
  scrollVelocity?: number;
}): CoScrollVisualState {
  const progress = clamp01(input.progress);
  const eased = ease(progress, input.timeline.easing);
  const duration = Math.max(1, input.timeline.duration);
  const visualTime = eased * duration;
  const fallbackMode = resolveFallbackMode({
    active: input.active,
    reducedMotion: input.reducedMotion,
    qualityTier: input.qualityTier
  });
  const currentAnchor =
    input.timeline.anchorCues.find((cue) => visualTime >= cue.start && visualTime <= cue.end)?.anchor ??
    input.timeline.anchorCues[0]?.anchor ??
    "心";
  const velocity = input.reducedMotion ? 0 : Math.max(-1, Math.min(1, input.scrollVelocity ?? 0));
  const activeLyrics = input.timeline.lyricSegments.filter((line) => {
    const paddedStart = Math.max(0, line.start - 2.5);
    const paddedEnd = Math.min(duration, line.end + 2.5);
    return visualTime >= paddedStart && visualTime <= paddedEnd;
  });
  const hasCurrentAnchorAsset = input.assets.anchors.some((anchor) => anchor.id === currentAnchor);

  return {
    visualTime,
    duration,
    lyrics: activeLyrics.length > 0 ? activeLyrics : input.timeline.lyricSegments.slice(0, 4),
    currentAnchor,
    scrollVelocity: velocity,
    frontLayerOpacity: fallbackMode === "none" ? 1 : 0.72,
    backLayerOpacity: fallbackMode === "none" ? 0.62 : 0.28,
    backgroundIntensity: input.active ? 1 : 0.35,
    fallbackMode,
    shouldLoadModel: (fallbackMode === "none" || fallbackMode === "dom-static") && hasCurrentAnchorAsset
  };
}
