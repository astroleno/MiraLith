import type { QualityProfile } from "@miralith/visual-core";

export type RadioGagaQualityProfile = QualityProfile;

export interface RadioGagaProgressRef {
  current: number;
}

export interface RadioGagaSceneProps {
  progress: number;
  progressRef?: RadioGagaProgressRef;
  active: boolean;
  quality: RadioGagaQualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
  onReady?: () => void;
}

export interface RadioGagaFrame {
  progress: number;
  radioOpacity: number;
  radioGhostOpacity: number;
  radioScale: number;
  radioRotationY: number;
  esp32Opacity: number;
  coreLightIntensity: number;
  signatureMomentProgress: number;
  speakerGlow: number;
  voiceLinesOpacity: number;
  memoryLayerOpacity: number;
  titleOpacity: number;
  bodyOpacity: number;
  calloutOpacity: number;
  finalLineOpacity: number;
  cameraZ: number;
  backgroundWarmth: number;
}

export interface RadioGagaFrameRef {
  current: RadioGagaFrame;
}

export interface RadioGagaSceneMotion {
  rotationX: number;
  rotationY: number;
}

export interface RadioGagaSceneMotionRef {
  current: RadioGagaSceneMotion;
}
