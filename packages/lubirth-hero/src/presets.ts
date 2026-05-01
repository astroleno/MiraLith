import { DEFAULT_LUBIRTH_DATE, DEFAULT_LUBIRTH_MOON_PHASE, DEFAULT_LUBIRTH_SUN_DIRECTION } from "./constants";
import type { LandingComposition, LandingCompositionOverrides, LandingPresetName } from "./types";

const field: LandingComposition = {
  camera: { distance: 15, fov: 45, azimuthDeg: 0, elevationDeg: 0, lookAt: [0, 0, 0], viewOffsetY: 0, dpr: [1, 1.1] },
  earth: {
    radius: 1,
    segments: 192,
    yawDeg: 0,
    rotationSpeedDegPerSec: 2.2,
    useNightMap: true,
    useClouds: true,
    cloudOpacity: 0.72,
    terminatorSoftness: 0.13,
    nightIntensity: 0.38,
    specularStrength: 0.12,
    rimStrength: 1.08,
    rimWidth: 1.58,
    edgeLightStrength: 1.06,
    edgeLightWidth: 5.4,
    edgeLightColor: [0.62, 0.82, 1.0],
    edgeNeedleStrength: 0.72,
    edgeShadowSoftness: 0.18
  },
  moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.68, screenX: 0.5, screenY: 0.75, screenSize: 0.18, anchorDistance: 14, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: -90, lonDeg: -90, latDeg: 90, nightLift: 0.08, lightingMode: "mixed" },
  light: { mode: "fixed-sun", fixedSunDir: DEFAULT_LUBIRTH_SUN_DIRECTION, intensity: 2.45, color: [1, 0.94, 0.78], ambientIntensity: 0.006 },
  atmosphere: {
    enabled: true,
    intensity: 1.32,
    thickness: 0.078,
    color: [0.34, 0.58, 1],
    fresnelPower: 2.35,
    nearShell: true,
    nearStrength: 0.9,
    karmanGlow: true,
    innerWhiteStrength: 0.92,
    blueThicknessStrength: 0.62,
    karmanStrength: 0.08,
    outerHaloStrength: 0.2
  },
  aurora: { enabled: true, intensity: 0.9, latitudeBandDeg: [58, 74], colorA: [0.28, 0.78, 0.66], colorB: [0.5, 0.76, 0.55], noiseScale: 2.18, noiseSpeed: 0.04, sampleCount: 4 },
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
    atmosphere: {
      blueThicknessStrength: 0.5,
      karmanStrength: 0.05,
      outerHaloStrength: 0.12
    },
    aurora: { intensity: 0.32, sampleCount: 2 },
    moon: { screenX: 0.5, screenY: 0.75, screenSize: 0.18 }
  }),
  mobileWindow: mergeLandingComposition(windowPreset, {
    earth: { segments: 96 },
    atmosphere: {
      blueThicknessStrength: 0.5,
      karmanStrength: 0.05,
      outerHaloStrength: 0.12
    },
    aurora: { intensity: 0.32, sampleCount: 2 },
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
