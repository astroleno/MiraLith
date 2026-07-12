"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  Mesh,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
  type PerspectiveCamera
} from "three";
import { type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingProjectedEarthFrame } from "./types";

interface LandingProjectedLimbScatteringProps {
  composition: LandingComposition;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  emphasis?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthProjectedLimbScatteringActive?: boolean;
  }
}

const forward = new Vector3();
const HORIZON_POINT_COUNT = 56;

function fitOverlayToCamera(mesh: Mesh, camera: PerspectiveCamera, aspect: number) {
  const distance = 1;
  const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
  const width = height * aspect;

  forward.set(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(distance);
  mesh.position.copy(camera.position).add(forward);
  mesh.quaternion.copy(camera.quaternion);
  mesh.scale.set(width, height, 1);
}

function createLimbScatteringMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      earthCenter: { value: new Vector2(0, 0) },
      earthRadius: { value: 1 },
      sunDirection: { value: new Vector2(0, 1) },
      horizonPoints: {
        value: Array.from({ length: HORIZON_POINT_COUNT }, () => new Vector2(-9999, -9999))
      },
      horizonPointCount: { value: 0 },
      progress: { value: 0 },
      intensity: { value: composition.atmosphere.intensity },
      debugBoost: { value: 0 }
    },
    vertexShader: `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 earthCenter;
      uniform float earthRadius;
      uniform vec2 sunDirection;
      uniform vec2 horizonPoints[${HORIZON_POINT_COUNT}];
      uniform int horizonPointCount;
      uniform float progress;
      uniform float intensity;
      uniform float debugBoost;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i += 1) {
          value += noise2(p) * amplitude;
          p = p * 2.04 + vec2(4.3, 7.1);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 p = gl_FragCoord.xy;
        vec2 fromCenter = p - earthCenter;
        float distanceToCenter = length(fromCenter);
        vec2 edgeNormal = distanceToCenter > 0.001 ? fromCenter / distanceToCenter : vec2(0.0, 1.0);
        float circleSignedOutside = distanceToCenter - earthRadius;
        float pathDistance = 100000.0;
        vec2 nearestPoint = earthCenter + edgeNormal * earthRadius;
        for (int i = 0; i < ${HORIZON_POINT_COUNT - 1}; i += 1) {
          if (i < horizonPointCount - 1) {
            vec2 a = horizonPoints[i];
            vec2 b = horizonPoints[i + 1];
            vec2 segment = b - a;
            float segmentLengthSq = max(dot(segment, segment), 0.0001);
            float t = clamp(dot(p - a, segment) / segmentLengthSq, 0.0, 1.0);
            vec2 candidate = a + segment * t;
            float candidateDistance = length(p - candidate);
            if (candidateDistance < pathDistance) {
              pathDistance = candidateDistance;
              nearestPoint = candidate;
            }
          }
        }
        vec2 pathNormal = nearestPoint - earthCenter;
        pathNormal = length(pathNormal) > 0.001 ? normalize(pathNormal) : edgeNormal;
        float signedOutside = horizonPointCount > 2
          ? dot(p - nearestPoint, pathNormal)
          : circleSignedOutside;
        float closeStage = 1.0 - smoothstep(0.12, 0.78, progress);
        float coreInset = mix(1.25, 2.65, closeStage);
        float glowOutside = signedOutside + coreInset;
        float upperArc = smoothstep(0.02, 0.34, edgeNormal.y);
        float sideWindow = smoothstep(-0.98, -0.62, edgeNormal.x) * (1.0 - smoothstep(0.62, 0.98, edgeNormal.x));

        float sunDot = dot(edgeNormal, normalize(sunDirection));
        float day = smoothstep(-0.2, 0.34, sunDot);
        float night = 1.0 - smoothstep(-0.18, 0.18, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.28, abs(sunDot));
        float outsideMask = smoothstep(-1.1, 1.2, glowOutside);
        float tangentMask = smoothstep(-1.8, 0.5, glowOutside);
        float pathLock = horizonPointCount > 2
          ? exp(-pow(pathDistance / mix(260.0, 320.0, debugBoost), 2.0))
          : 1.0;
        float lineCore = horizonPointCount > 2 ? abs(glowOutside) : abs(circleSignedOutside);

        float angle = atan(edgeNormal.y, edgeNormal.x) / 3.14159265;
        float cloudOcclusion = smoothstep(0.58, 0.86, fbm(vec2(angle * 18.0 + 1.4, 2.0))) *
          smoothstep(-0.8, 8.0, signedOutside) *
          (1.0 - smoothstep(18.0, 44.0, signedOutside)) *
          0.22;
        float airglowBreakup = smoothstep(0.46, 0.84, fbm(vec2(angle * 11.0 + 4.2, 7.0)));

        float brightCore = exp(-pow((lineCore - 1.45) / mix(5.2, 6.8, debugBoost), 2.0)) *
          (0.42 + day * 0.72) *
          tangentMask;
        float whiteNeedle = brightCore * mix(0.024, 0.142, debugBoost);
        float surfaceGlow = exp(-pow(max(glowOutside, 0.0) / mix(26.0, 34.0, debugBoost), 1.16)) *
          smoothstep(-1.6, 7.0, glowOutside) *
          (0.076 + day * 0.112);
        float nearBlue = exp(-pow(max(glowOutside, 0.0) / mix(18.0, 24.0, debugBoost), 1.26)) *
          (0.074 + day * 0.106) *
          outsideMask;
        float blueThickness = exp(-pow(max(glowOutside - 1.8, 0.0) / mix(58.0, 98.0, debugBoost), 1.12)) *
          smoothstep(-1.0, 22.0, glowOutside) *
          (0.06 + day * 0.086);
        float diffuseBlue = exp(-pow(max(glowOutside - 2.0, 0.0) / mix(138.0, 218.0, debugBoost), 1.22)) *
          smoothstep(0.0, 58.0, glowOutside) *
          (0.04 + day * 0.052);
        float wideBloom = exp(-pow(max(glowOutside - 4.0, 0.0) / mix(210.0, 340.0, debugBoost), 1.14)) *
          smoothstep(2.0, 88.0, glowOutside) *
          (0.019 + day * 0.026);
        float oxygenGreen = smoothstep(2.0, mix(10.0, 16.0, debugBoost), glowOutside) *
          (1.0 - smoothstep(mix(24.0, 38.0, debugBoost), mix(62.0, 92.0, debugBoost), glowOutside)) *
          night *
          mix(0.07, 0.12, debugBoost);
        float amberTwilight = smoothstep(2.0, mix(12.0, 18.0, debugBoost), glowOutside) *
          (1.0 - smoothstep(mix(28.0, 42.0, debugBoost), mix(72.0, 104.0, debugBoost), glowOutside)) *
          twilight *
          mix(0.05, 0.11, debugBoost);
        float outerCyan = smoothstep(22.0, mix(52.0, 74.0, debugBoost), glowOutside) *
          (1.0 - smoothstep(mix(110.0, 150.0, debugBoost), mix(192.0, 260.0, debugBoost), glowOutside)) *
          mix(0.01, 0.024, debugBoost);
        surfaceGlow *= mix(0.92, 1.0, debugBoost);
        nearBlue *= mix(0.86, 1.0, debugBoost);
        blueThickness *= mix(0.64, 1.0, debugBoost);
        diffuseBlue *= mix(0.24, 1.0, debugBoost);
        wideBloom *= mix(0.16, 1.0, debugBoost);
        oxygenGreen *= mix(0.55 * airglowBreakup, 1.0, debugBoost);
        amberTwilight *= mix(0.55, 1.0, debugBoost);
        outerCyan *= mix(0.62, 1.0, debugBoost);
        whiteNeedle *= 1.0 - cloudOcclusion;
        surfaceGlow *= 1.0 - cloudOcclusion * 0.48;
        nearBlue *= 1.0 - cloudOcclusion * 0.42;
        blueThickness *= 1.0 - cloudOcclusion * 0.32;
        diffuseBlue *= 1.0 - cloudOcclusion * 0.38;
        wideBloom *= 1.0 - cloudOcclusion * 0.22;

        vec3 color =
          vec3(1.05, 1.18, 1.32) * whiteNeedle +
          vec3(0.34, 0.62, 0.96) * surfaceGlow +
          vec3(0.24, 0.52, 0.92) * nearBlue +
          vec3(0.1, 0.28, 0.66) * blueThickness +
          vec3(0.03, 0.12, 0.34) * diffuseBlue * 1.08 +
          vec3(0.014, 0.052, 0.16) * wideBloom * 1.18 +
          vec3(0.16, 0.66, 0.43) * oxygenGreen +
          vec3(0.92, 0.42, 0.14) * amberTwilight +
          vec3(0.1, 0.48, 0.72) * outerCyan;

        float alpha = whiteNeedle + surfaceGlow + nearBlue + blueThickness + diffuseBlue + wideBloom + oxygenGreen + amberTwilight + outerCyan;
        float arcMask = upperArc * sideWindow;
        float productionLimbAttenuation = mix(1.0, 1.0, debugBoost);
        float gain = intensity * (0.96 + closeStage * 0.22) * (1.0 + debugBoost * 0.18) * productionLimbAttenuation;
        alpha *= arcMask * outsideMask * pathLock * gain;
        color *= arcMask * outsideMask * pathLock * gain;

        if (alpha < 0.001) {
          discard;
        }

        gl_FragColor = vec4(min(color, vec3(1.8)), clamp(alpha, 0.0, mix(0.3, 0.62, debugBoost)));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingProjectedLimbScattering({
  composition,
  quality,
  projection,
  emphasis = false
}: LandingProjectedLimbScatteringProps) {
  const overlay = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(() => createLimbScatteringMaterial(composition), [composition]);
  const enabled =
    emphasis &&
    composition.atmosphere.enabled &&
    composition.atmosphere.intensity > 0 &&
    quality.tier !== "fallback";

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthProjectedLimbScatteringActive = enabled;
    return () => {
      window.__MiraLithLuBirthProjectedLimbScatteringActive = false;
    };
  }, [enabled]);

  useFrame(() => {
    if (!overlay.current || !enabled || !("fov" in camera)) {
      return;
    }

    fitOverlayToCamera(overlay.current, camera, size.width / Math.max(size.height, 1));
    material.uniforms.earthCenter.value.copy(projection.current.center);
    material.uniforms.earthRadius.value = projection.current.radius;
    material.uniforms.sunDirection.value.copy(projection.current.sunDirection);
    material.uniforms.horizonPointCount.value = Math.min(
      projection.current.horizonPointCount,
      HORIZON_POINT_COUNT
    );
    const horizonUniforms = material.uniforms.horizonPoints.value as Vector2[];
    for (let index = 0; index < HORIZON_POINT_COUNT; index += 1) {
      const source = projection.current.horizonPoints[index];
      if (source) {
        horizonUniforms[index].copy(source);
      } else {
        horizonUniforms[index].set(-9999, -9999);
      }
    }
    material.uniforms.progress.value = projection.current.progress;
    material.uniforms.intensity.value = composition.atmosphere.enabled ? composition.atmosphere.intensity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={overlay} material={material} renderOrder={20} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
