"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingLimbScatteringLookProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
}

const LIMB_LOOK_RADIUS = 1.018;
const lightDirection = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createLimbScatteringLookMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      closeStage: { value: 1 },
      intensity: { value: composition.atmosphere.intensity },
      debugBoost: { value: 0 },
      lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float closeStage;
      uniform float intensity;
      uniform float debugBoost;
      uniform vec3 lightDir;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 l = normalize(lightDir);
        float rim = 1.0 - max(dot(n, v), 0.0);
        float sun = dot(n, l);
        float day = smoothstep(-0.24, 0.34, sun);
        float night = 1.0 - smoothstep(-0.14, 0.26, sun);
        float twilight = 1.0 - smoothstep(0.0, 0.36, abs(sun));
        float limb = smoothstep(0.62, 0.84, rim) * (1.0 - smoothstep(0.986, 1.0, rim));
        float nearEdge = smoothstep(0.86, 0.948, rim) * (1.0 - smoothstep(0.972, 0.994, rim));
        float needleMask = smoothstep(0.918, 0.958, rim) * (1.0 - smoothstep(0.966, 0.982, rim));
        float outerHaze = smoothstep(0.72, 0.9, rim) * (1.0 - smoothstep(0.958, 0.994, rim));
        float hold = mix(0.78, 1.0, closeStage);
        float boost = 1.0 + debugBoost * 0.12;

        float whiteNeedle = needleMask * (0.2 + day * 0.58 + twilight * 0.08);
        float blueHaze = outerHaze * (0.045 + day * 0.055 + night * 0.018);
        float oxygenGreen = nearEdge * night * 0.13;
        float amberTwilight = limb * twilight * 0.08;
        float darkBlueBase = limb * (0.018 + night * 0.016);

        vec3 color =
          vec3(0.94, 0.99, 1.0) * whiteNeedle +
          vec3(0.12, 0.45, 0.95) * blueHaze +
          vec3(0.26, 0.9, 0.64) * oxygenGreen +
          vec3(1.0, 0.5, 0.18) * amberTwilight +
          vec3(0.02, 0.1, 0.28) * darkBlueBase;
        float alpha = whiteNeedle + blueHaze + oxygenGreen + amberTwilight + darkBlueBase;
        alpha *= intensity * hold * boost;

        if (alpha < 0.0012) {
          discard;
        }

        gl_FragColor = vec4(min(color * intensity * hold * boost, vec3(0.96)), clamp(alpha, 0.0, 0.22));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false
  });
}

export function LandingLimbScatteringLook({
  composition,
  quality,
  sceneLightDirection,
  emphasis = false
}: LandingLimbScatteringLookProps) {
  const material = useMemo(() => createLimbScatteringLookMaterial(composition), [composition]);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame(() => {
    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);

    if (sceneLightDirection) {
      material.uniforms.lightDir.value.copy(sceneLightDirection).normalize();
    } else {
      material.uniforms.lightDir.value.set(...composition.light.fixedSunDir).normalize();
    }
    material.uniforms.closeStage.value = closeStage;
    material.uniforms.intensity.value = composition.atmosphere.enabled ? composition.atmosphere.intensity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
  });

  if (!composition.atmosphere.enabled) {
    return null;
  }

  return (
    <mesh material={material} renderOrder={14}>
      <sphereGeometry
        args={[
          composition.earth.radius * LIMB_LOOK_RADIUS,
          quality.tier === "high" ? Math.max(112, quality.segments) : quality.tier === "medium" ? 72 : 44,
          quality.tier === "high" ? 58 : quality.tier === "medium" ? 38 : 26
        ]}
      />
    </mesh>
  );
}
