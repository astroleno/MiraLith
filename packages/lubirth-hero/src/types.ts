import type { CSSProperties } from "react";
import type { Vector2 } from "three";
import type { LandingQuality, QualityProfile, ResolvedQualityTier } from "@miralith/visual-core";

export type EarthMoonHeroMode = "field" | "window" | "zoomed" | "expanded";
export type LandingVisualDebugLayer = "all" | "stars" | "clouds" | "atmosphere" | "aurora";
export type LandingAuroraProfile = "hero" | "debug";
export type LandingPresetName =
  | "field"
  | "window"
  | "zoomed"
  | "expanded"
  | "mobileField"
  | "mobileWindow"
  | "fallback";

export interface TextureRef {
  id: string;
  src: string;
  width: number;
  height: number;
  format: "webp" | "avif" | "ktx2" | "jpg" | "png";
  colorSpace: "srgb" | "linear";
}

export interface LandingAsset {
  id: string;
  kind: "texture" | "poster" | "model" | "shader" | "data";
  tier: "critical" | "idle" | "expanded" | "fallback";
  src: string;
  bytesBudget: number;
  preload: boolean;
  requiredFor: LandingPresetName[];
}

export interface LandingAssetManifest {
  earthDay: TextureRef;
  earthNight?: TextureRef;
  earthClouds?: TextureRef;
  earthCloudDeck?: TextureRef;
  moonColor: TextureRef;
  spaceBackground?: TextureRef;
  fallbackPoster: LandingAsset;
  expandedEarthDay?: TextureRef;
  expandedMoonColor?: TextureRef;
}

export type LandingResolvedAssets = LandingAssetManifest;

export interface LandingCameraConfig {
  distance: number;
  fov: number;
  azimuthDeg: number;
  elevationDeg: number;
  lookAt: [number, number, number];
  viewOffsetY: number;
  dpr: [number, number] | number;
}

export interface LandingEarthConfig {
  radius: number;
  segments: number;
  yawDeg: number;
  rotationSpeedDegPerSec: number;
  dayTexture?: TextureRef;
  nightTexture?: TextureRef;
  cloudTexture?: TextureRef;
  useNightMap: boolean;
  useClouds: boolean;
  cloudOpacity: number;
  terminatorSoftness: number;
  nightIntensity: number;
  specularStrength: number;
  rimStrength: number;
  rimWidth: number;
}

export interface LandingMoonPhase {
  date: string;
  illumination: number;
  phaseAngleRad: number;
  sunDirection: [number, number, number];
  positionAngleRad?: number;
  source: "precomputed" | "runtime-ephemeris" | "constant-vector";
}

export type LandingMoonLightingMode = "birthPhase" | "sceneLit" | "mixed";

export interface LandingMoonConfig {
  visible: boolean;
  date: string;
  radius: number;
  screenX: number;
  screenY: number;
  screenSize: number;
  anchorDistance: number;
  phaseMode: "fixed-date" | "constant-vector" | "runtime-ephemeris";
  fixedPhase?: LandingMoonPhase;
  yawDeg: number;
  lonDeg: number;
  latDeg: number;
  nightLift: number;
  lightingMode: LandingMoonLightingMode;
}

export interface LandingLightConfig {
  mode: "fixed-sun";
  fixedSunDir: [number, number, number];
  intensity: number;
  color: [number, number, number];
  ambientIntensity: number;
}

export interface LandingAtmosphereConfig {
  enabled: boolean;
  intensity: number;
  thickness: number;
  color: [number, number, number];
  fresnelPower: number;
  nearShell: boolean;
  nearStrength: number;
  karmanGlow: boolean;
}

export interface LandingAuroraConfig {
  enabled: boolean;
  intensity: number;
  latitudeBandDeg: [number, number];
  colorA: [number, number, number];
  colorB: [number, number, number];
  noiseScale: number;
  noiseSpeed: number;
  sampleCount: number;
}

export interface LandingMotionConfig {
  autoRotate: boolean;
  hoverSlowdown: boolean;
  scrollDriven: boolean;
  transitionDurationMs: number;
}

export interface LandingComposition {
  camera: LandingCameraConfig;
  earth: LandingEarthConfig;
  moon: LandingMoonConfig;
  light: LandingLightConfig;
  atmosphere: LandingAtmosphereConfig;
  aurora: LandingAuroraConfig;
  motion: LandingMotionConfig;
}

export interface LandingCompositionOverrides {
  camera?: Partial<LandingCameraConfig>;
  earth?: Partial<LandingEarthConfig>;
  moon?: Partial<LandingMoonConfig>;
  light?: Partial<LandingLightConfig>;
  atmosphere?: Partial<LandingAtmosphereConfig>;
  aurora?: Partial<LandingAuroraConfig>;
  motion?: Partial<LandingMotionConfig>;
}

export interface EarthMoonSceneProps {
  mode: EarthMoonHeroMode;
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  scrollProgress?: number;
  sectionProgress?: number;
  debugMianyang?: boolean;
  visualDebugLayer?: LandingVisualDebugLayer;
  auroraProfile?: LandingAuroraProfile;
  reducedMotion?: boolean;
  paused?: boolean;
  onSceneReady?: () => void;
  onProjectionFrame?: (frame: LuBirthProjectionFrame) => void;
  onVisualReadyEnough?: () => void;
  onMoonTextureReady?: () => void;
  useCloudDeckV2?: boolean;
  useAirglowV2?: boolean;
  useAuroraOval?: boolean;
  useHorizonAuroraRibbon?: boolean;
  showAuroraInAll?: boolean;
  useProjectedHorizonPasses?: boolean;
}

export interface LuBirthProjectionFrame {
  width: number;
  height: number;
  earthHorizonPath: string;
  moon: {
    x: number;
    y: number;
    radius: number;
  };
}

export interface LandingProjectedEarthFrame {
  center: Vector2;
  sunDirection: Vector2;
  radius: number;
  progress: number;
}

export type EarthMoonHeroInteraction =
  | "none"
  | "hover-zoom"
  | "tap-expand"
  | "hover-and-click-expand"
  | "scroll-driven";

export interface AccessibilityProps {
  ariaLabel?: string;
  describedById?: string;
  decorative?: boolean;
}

export interface EarthMoonHeroEvent {
  mode: EarthMoonHeroMode;
  quality: ResolvedQualityTier;
}

export interface EarthMoonHeroError {
  message: string;
}

export interface EarthMoonHeroProps {
  mode?: EarthMoonHeroMode;
  preset?: LandingPresetName;
  date?: string;
  quality?: LandingQuality;
  interaction?: EarthMoonHeroInteraction;
  className?: string;
  style?: CSSProperties;
  accessibility?: AccessibilityProps;
  reducedMotion?: boolean;
  paused?: boolean;
  posterSrc?: string;
  assets?: Partial<LandingAssetManifest>;
  composition?: LandingCompositionOverrides;
  onReady?: (event: EarthMoonHeroEvent) => void;
  onQualityChange?: (quality: ResolvedQualityTier) => void;
  onExpandChange?: (expanded: boolean) => void;
  onError?: (error: EarthMoonHeroError) => void;
}
