"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  BackSide,
  CustomBlending,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAirglowProps {
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

const AIRGLOW_RADIUS = 1.021;
const lightDirection = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createAirglowMaterial(composition: LandingComposition) {
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
        float limb = 1.0 - max(dot(n, v), 0.0);
        float sun = dot(n, l);
        float day = smoothstep(-0.24, 0.32, sun);
        float night = 1.0 - smoothstep(-0.16, 0.22, sun);
        float twilight = 1.0 - smoothstep(0.0, 0.38, abs(sun));
        float boost = 1.0 + debugBoost * 0.32;
        float farHold = mix(0.76, 1.0, closeStage);

        float oxygenBand =
          night *
          smoothstep(0.7, 0.88, limb) *
          (1.0 - smoothstep(0.925, 0.985, limb));
        float amberBand =
          twilight *
          smoothstep(0.58, 0.82, limb) *
          (1.0 - smoothstep(0.91, 0.988, limb));
        float cyanHaze =
          smoothstep(0.5, 0.8, limb) *
          (1.0 - smoothstep(0.92, 0.995, limb)) *
          (0.18 + day * 0.18 + night * 0.14);

        vec3 color =
          vec3(0.34, 0.78, 0.58) * oxygenBand * 0.22 +
          vec3(1.0, 0.48, 0.18) * amberBand * 0.1 +
          vec3(0.08, 0.42, 0.72) * cyanHaze * 0.12;
        float alpha =
          oxygenBand * 0.032 +
          amberBand * 0.024 +
          cyanHaze * 0.014;
        alpha *= intensity * farHold * boost;

        if (alpha < 0.0012) {
          discard;
        }

        gl_FragColor = vec4(min(color * intensity * farHold * boost, vec3(0.72)), clamp(alpha, 0.0, 0.12));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    side: BackSide,
    depthTest: true,
    depthWrite: false
  });
}

export function LandingAirglow({
  composition,
  quality,
  sceneLightDirection,
  emphasis = false
}: LandingAirglowProps) {
  const material = useMemo(() => createAirglowMaterial(composition), [composition]);

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
          composition.earth.radius * AIRGLOW_RADIUS,
          quality.tier === "high" ? Math.max(72, quality.segments) : quality.tier === "medium" ? 56 : 36,
          quality.tier === "high" ? 40 : quality.tier === "medium" ? 30 : 22
        ]}
      />
    </mesh>
  );
}
