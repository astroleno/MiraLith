import { DEFAULT_LUBIRTH_DATE, DEFAULT_LUBIRTH_MOON_PHASE } from "./constants";
import type { LandingComposition, LandingCompositionOverrides, LandingPresetName } from "./types";

const field: LandingComposition = {
  camera: { distance: 7.4, fov: 42, azimuthDeg: 13, elevationDeg: 22, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.25] },
  earth: { radius: 1.88, segments: 96, yawDeg: 0, rotationSpeedDegPerSec: 2.6, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.08, rimStrength: 0.42, rimWidth: 0.22 },
  moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.28, screenX: -0.55, screenY: 0.92, screenSize: 0.18, anchorDistance: 3.8, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
  light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 1.9, color: [1, 0.96, 0.82], ambientIntensity: 0.42 },
  atmosphere: { enabled: true, intensity: 0.13, thickness: 0.055, color: [0.62, 0.78, 0.82], fresnelPower: 2.4, nearShell: true, nearStrength: 0.34, karmanGlow: true },
  aurora: { enabled: true, intensity: 0.34, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.8, noiseSpeed: 0.08, sampleCount: 3 },
  motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 900 }
};

const windowPreset: LandingComposition = {
  camera: { distance: 5.2, fov: 42, azimuthDeg: 9, elevationDeg: 19, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.25] },
  earth: { radius: 1.42, segments: 72, yawDeg: 0, rotationSpeedDegPerSec: 1.85, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.08, rimStrength: 0.38, rimWidth: 0.2 },
  moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.22, screenX: -0.18, screenY: 0.54, screenSize: 0.14, anchorDistance: 3.4, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
  light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 1.9, color: [1, 0.96, 0.82], ambientIntensity: 0.42 },
  atmosphere: { enabled: true, intensity: 0.11, thickness: 0.048, color: [0.62, 0.78, 0.82], fresnelPower: 2.4, nearShell: true, nearStrength: 0.28, karmanGlow: true },
  aurora: { enabled: true, intensity: 0.18, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.4, noiseSpeed: 0.065, sampleCount: 2 },
  motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 760 }
};

export const LUBIRTH_PRESETS: Record<LandingPresetName, LandingComposition> = {
  field: {
    ...field
  },
  window: {
    ...windowPreset
  },
  zoomed: {
    camera: { distance: 4.6, fov: 40, azimuthDeg: 7, elevationDeg: 17, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.25] },
    earth: { radius: 1.58, segments: 72, yawDeg: 0, rotationSpeedDegPerSec: 1.6, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.08, rimStrength: 0.4, rimWidth: 0.2 },
    moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.24, screenX: -0.1, screenY: 0.58, screenSize: 0.16, anchorDistance: 3.2, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
    light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 1.9, color: [1, 0.96, 0.82], ambientIntensity: 0.42 },
    atmosphere: { enabled: true, intensity: 0.12, thickness: 0.052, color: [0.62, 0.78, 0.82], fresnelPower: 2.4, nearShell: true, nearStrength: 0.3, karmanGlow: true },
    aurora: { enabled: true, intensity: 0.22, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.4, noiseSpeed: 0.065, sampleCount: 2 },
    motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 720 }
  },
  expanded: {
    camera: { distance: 4.1, fov: 38, azimuthDeg: 5, elevationDeg: 16, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.5] },
    earth: { radius: 1.82, segments: 96, yawDeg: 0, rotationSpeedDegPerSec: 1.4, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.1, rimStrength: 0.46, rimWidth: 0.24 },
    moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.3, screenX: -0.08, screenY: 0.62, screenSize: 0.22, anchorDistance: 3.0, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
    light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 2.0, color: [1, 0.96, 0.82], ambientIntensity: 0.44 },
    atmosphere: { enabled: true, intensity: 0.14, thickness: 0.058, color: [0.62, 0.78, 0.82], fresnelPower: 2.2, nearShell: true, nearStrength: 0.36, karmanGlow: true },
    aurora: { enabled: true, intensity: 0.28, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.2, noiseSpeed: 0.06, sampleCount: 3 },
    motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 680 }
  },
  mobileField: mergeLandingComposition(field, {
    camera: { distance: 7.9, elevationDeg: 19 },
    earth: { radius: 1.56, segments: 64 },
    moon: { screenX: -0.72, screenY: 0.72, screenSize: 0.15 }
  }),
  mobileWindow: mergeLandingComposition(windowPreset, {
    camera: { distance: 5.7, elevationDeg: 17 },
    earth: { radius: 1.18, segments: 56 },
    moon: { screenX: -0.54, screenY: 0.46, screenSize: 0.13 }
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
