import type { QualityProfile, ResolvedQualityTier } from "@miralith/visual-core";

export type CoScrollAnchorId =
  | "观"
  | "心"
  | "空"
  | "苦"
  | "色"
  | "法"
  | "生"
  | "无"
  | "死"
  | "道"
  | "悟"
  | "明"
  | "真"
  | "圆";

export type CoScrollFallbackMode = "none" | "poster" | "dom-static";

export type CoScrollFallbackReason =
  | "webgl-unavailable"
  | "context-lost"
  | "asset-failed"
  | "quality-tier"
  | "reduced-motion"
  | "forced"
  | "timeout";

export interface CoScrollLyricSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  layer: "front" | "back";
  emphasis?: "quiet" | "normal" | "bright";
}

export interface CoScrollAnchorCue {
  anchor: CoScrollAnchorId;
  start: number;
  end: number;
}

export interface CoScrollTimelineConfig {
  duration: number;
  easing: "linear" | "ritual-slow-in" | "breath";
  anchorCues: CoScrollAnchorCue[];
  lyricSegments: CoScrollLyricSegment[];
}

export interface CoScrollAnchorAsset {
  id: CoScrollAnchorId;
  label: string;
  modelSrc: string;
  posterSrc?: string;
  materialPreset: "jade-dark" | "jade-gold" | "jade-blue";
  bytesBudget: number;
}

export interface CoScrollAssetManifest {
  anchors: CoScrollAnchorAsset[];
  fallback: {
    posterSrc: string;
    posterBytesBudget: number;
  };
}

export interface CoScrollVisualState {
  visualTime: number;
  duration: number;
  lyrics: CoScrollLyricSegment[];
  currentAnchor: CoScrollAnchorId;
  scrollVelocity: number;
  frontLayerOpacity: number;
  backLayerOpacity: number;
  backgroundIntensity: number;
  fallbackMode: CoScrollFallbackMode;
  shouldLoadModel: boolean;
}

export interface CoScrollRotationSignal {
  angle: number;
  speed: number;
}

export interface CoScrollRotationSignalRef {
  current: CoScrollRotationSignal;
}

/**
 * Review-only bridge fixture for the source anchor. The primary GLB stays opaque; these values
 * configure a separate blue particle residue layer. `particleization` is a source-side cutout
 * plus particle handoff: it never lowers GLB alpha. This does not implement or imply a terminal.
 */
export interface CoScrollAnchorResidueConfig {
  color?: string;
  intensity?: number;
  particleCount?: number;
  historySeconds?: number;
  targetSize?: number;
  /** 0–1 opaque-cutout / blue-particle handoff driven by an explicit caller. */
  particleization?: number;
  /** Local review-only playback; never enabled by production scene configuration. */
  reviewAutoParticleization?: boolean;
  /** Local review-only signal fired at the exact first target-phase frame before video takes over. */
  onReviewHandoff?: () => void;
}

export interface CoScrollSceneContentProps {
  progress: number;
  active: boolean;
  quality: QualityProfile;
  reducedMotion?: boolean;
  timeline: CoScrollTimelineConfig;
  assets: CoScrollAssetManifest;
  scrollVelocity?: number;
  paused?: boolean;
  viewport?: "desktop" | "mobile";
  anchorResidue?: CoScrollAnchorResidueConfig;
  rotationSignalRef?: CoScrollRotationSignalRef;
  readinessGeneration?: string;
  onReadinessGenerationChange?: (readinessGeneration: string) => void;
  onReady?: (readinessGeneration?: string) => void;
  onFallback?: (reason: CoScrollFallbackReason, readinessGeneration?: string) => void;
}

export type { QualityProfile, ResolvedQualityTier };
