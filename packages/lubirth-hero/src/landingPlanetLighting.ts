import type { MutableRefObject } from "react";
import type { Vector3 } from "three";

export interface LandingPlanetLightingFrame {
  cloudOffsetRef: MutableRefObject<number>;
  sunDirection: Vector3;
}

export interface LandingPlanetLightMasks {
  dayMask: number;
  deepNightMask: number;
  nightMask: number;
  twilightMask: number;
}

export function createLandingPlanetLightingFrame(
  sunDirection: Vector3,
  cloudOffsetRef: MutableRefObject<number>
): LandingPlanetLightingFrame {
  return { cloudOffsetRef, sunDirection };
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const unit = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-6)));
  return unit * unit * (3 - 2 * unit);
}

export function resolvePlanetLightMasks(
  normalSunDot: number,
  terminatorSoftness: number
): LandingPlanetLightMasks {
  const edge = Math.max(terminatorSoftness, 0.001);
  const dayMask = smoothstep(-edge, edge, normalSunDot);
  const nightMask = 1 - dayMask;
  const deepNightMask = 1 - smoothstep(-0.2, -0.035, normalSunDot);
  const twilightMask = 1 - smoothstep(edge * 0.28, edge * 1.65, Math.abs(normalSunDot));
  return { dayMask, deepNightMask, nightMask, twilightMask };
}

export const PLANET_LIGHTING_GLSL = `
  struct PlanetLightMasks {
    float dayMask;
    float deepNightMask;
    float nightMask;
    float twilightMask;
  };

  PlanetLightMasks resolvePlanetLightMasks(float normalSunDot, float terminatorSoftness) {
    float edge = max(terminatorSoftness, 0.001);
    PlanetLightMasks masks;
    masks.dayMask = smoothstep(-edge, edge, normalSunDot);
    masks.nightMask = 1.0 - masks.dayMask;
    masks.deepNightMask = 1.0 - smoothstep(-0.2, -0.035, normalSunDot);
    masks.twilightMask = 1.0 - smoothstep(
      edge * 0.28,
      edge * 1.65,
      abs(normalSunDot)
    );
    return masks;
  }

  void planetTangentFrame(vec3 normal, out vec3 east, out vec3 north) {
    vec3 equatorialEast = vec3(normal.z, 0.0, -normal.x);
    float equatorialLength = length(equatorialEast);
    east = equatorialLength > 0.00001
      ? equatorialEast / equatorialLength
      : vec3(1.0, 0.0, 0.0);
    north = normalize(cross(normal, east));
  }
`;
