import { DEFAULT_LUBIRTH_DATE, DEFAULT_LUBIRTH_MOON_PHASE, DEFAULT_LUBIRTH_SUN_DIRECTION } from "./constants";
import type { LandingComposition, LandingCompositionOverrides, LandingPresetName } from "./types";

const field: LandingComposition = {
  camera: { distance: 15, fov: 45, azimuthDeg: 0, elevationDeg: 0, lookAt: [0, 0, 0], viewOffsetY: 0, dpr: [1, 1.25] },
  earth: { radius: 1, segments: 144, yawDeg: 0, rotationSpeedDegPerSec: 2.2, useNightMap: true, useClouds: true, cloudOpacity: 0.84, terminatorSoftness: 0.16, nightIntensity: 0.34, specularStrength: 0.08, rimStrength: 1.72, rimWidth: 1.35 },
  moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.68, screenX: 0.5, screenY: 0.75, screenSize: 0.18, anchorDistance: 14, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: -90, lonDeg: -90, latDeg: 90, nightLift: 0.08 },
  light: { mode: "fixed-sun", fixedSunDir: DEFAULT_LUBIRTH_SUN_DIRECTION, intensity: 2.45, color: [1, 0.94, 0.78], ambientIntensity: 0.006 },
  atmosphere: { enabled: true, intensity: 1.32, thickness: 0.052, color: [0.43, 0.65, 1], fresnelPower: 2.8, nearShell: true, nearStrength: 0.76, karmanGlow: false },
  aurora: { enabled: false, intensity: 0, latitudeBandDeg: [58, 74], colorA: [0.46, 0.9, 0.62], colorB: [0.86, 0.66, 0.32], noiseScale: 2.8, noiseSpeed: 0.04, sampleCount: 0 },
  motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 1100 }
};

const windowPreset: LandingComposition = {
  ...field,
  motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 900 }
};

export const LUBIRTH_PRESETS: Record<LandingPresetName, LandingComposition> = {
  field: {
    ...field
  },
  window: {
    ...windowPreset
  },
  zoomed: {
    ...field,
    motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 720 }
  },
  expanded: {
    ...field,
    motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 680 }
  },
  mobileField: mergeLandingComposition(field, {
    earth: { segments: 96 },
    moon: { screenX: 0.5, screenY: 0.75, screenSize: 0.18 }
  }),
  mobileWindow: mergeLandingComposition(windowPreset, {
    earth: { segments: 96 },
    moon: { screenX: 0.5, screenY: 0.75, screenSize: 0.18 }
  }),
  fallback: mergeLandingComposition(field, {
    aurora: { enabled: false, intensity: 0, sampleCount: 0 },
    motion: { autoRotate: false, hoverSlowdown: false, scrollDriven: false }
  })
};

function mergeLandingComposition(
  base: LandingComposition,
  overrides: LandingCompositionOverrides = {}
): LandingComposition {
  return {
    camera: { ...base.camera, ...overrides.camera },
    earth: { ...base.earth, ...overrides.earth },
    moon: { ...base.moon, ...overrides.moon },
    light: { ...base.light, ...overrides.light },
    atmosphere: { ...base.atmosphere, ...overrides.atmosphere },
    aurora: { ...base.aurora, ...overrides.aurora },
    motion: { ...base.motion, ...overrides.motion }
  };
}

export function resolveLandingPreset(
  preset: LandingPresetName = "field",
  composition: LandingCompositionOverrides = {}
): LandingComposition {
  return mergeLandingComposition(LUBIRTH_PRESETS[preset], composition);
}
