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

interface LandingLimbAirglowV2Props {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthAirglowActive?: boolean;
  }
}

const AIRGLOW_V2_RADIUS = 1.023;
const lightDirection = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createLimbAirglowV2Material(composition: LandingComposition) {
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
        float day = smoothstep(-0.28, 0.34, sun);
        float night = 1.0 - smoothstep(-0.12, 0.24, sun);
        float twilight = 1.0 - smoothstep(0.0, 0.34, abs(sun));
        float limbMask = smoothstep(0.58, 0.81, rim) * (1.0 - smoothstep(0.985, 1.0, rim));
        float outerMask = smoothstep(0.76, 0.93, rim) * (1.0 - smoothstep(0.992, 1.0, rim));
        float thinMask = smoothstep(0.85, 0.948, rim) * (1.0 - smoothstep(0.971, 0.996, rim));
        float closeHold = mix(0.72, 1.0, closeStage);
        float boost = 1.0 + debugBoost * 0.22;

        float oxygenBand = night * thinMask * 0.135;
        float amberBand = twilight * limbMask * 0.096;
        float blueOuter = outerMask * (0.058 + day * 0.032 + night * 0.025);
        float lowCyan = limbMask * (0.03 + night * 0.02);

        vec3 color =
          vec3(0.32, 0.9, 0.64) * oxygenBand +
          vec3(1.0, 0.52, 0.2) * amberBand +
          vec3(0.12, 0.45, 0.9) * blueOuter +
          vec3(0.06, 0.52, 0.72) * lowCyan;
        float alpha = oxygenBand + amberBand + blueOuter + lowCyan;
        alpha *= intensity * closeHold * boost;

        if (alpha < 0.001) {
          discard;
        }

        gl_FragColor = vec4(min(color * intensity * closeHold * boost, vec3(0.9)), clamp(alpha, 0.0, 0.24));
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

export function LandingLimbAirglowV2({
  composition,
  quality,
  sceneLightDirection,
  emphasis = false
}: LandingLimbAirglowV2Props) {
  const material = useMemo(() => createLimbAirglowV2Material(composition), [composition]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__MiraLithLuBirthAirglowActive = composition.atmosphere.enabled;
    }

    return () => {
      material.dispose();
      if (typeof window !== "undefined") {
        window.__MiraLithLuBirthAirglowActive = false;
      }
    };
  }, [composition.atmosphere.enabled, material]);

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
    <mesh material={material} renderOrder={13}>
      <sphereGeometry
        args={[
          composition.earth.radius * AIRGLOW_V2_RADIUS,
          quality.tier === "high" ? Math.max(96, quality.segments) : quality.tier === "medium" ? 64 : 40,
          quality.tier === "high" ? 54 : quality.tier === "medium" ? 36 : 24
        ]}
      />
    </mesh>
  );
}
