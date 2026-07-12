"use client";

import { useEffect, useMemo } from "react";
import {
  AddEquation,
  BackSide,
  Color,
  CustomBlending,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { useFrame } from "@react-three/fiber";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAtmosphereProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
}

const lightDirection = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createAtmosphereMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      closeStage: { value: 1 },
      intensity: { value: composition.atmosphere.intensity },
      debugBoost: { value: 0 },
      lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
      white: { value: new Color(0.92, 0.98, 1.0) },
      blue: { value: new Color(0.17, 0.54, 0.96) },
      mist: { value: new Color(0.025, 0.16, 0.46) },
      sunset: { value: new Color(1.0, 0.48, 0.16) }
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
      uniform vec3 white;
      uniform vec3 blue;
      uniform vec3 mist;
      uniform vec3 sunset;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 l = normalize(lightDir);
        float limb = 1.0 - max(dot(n, v), 0.0);
        float sun = dot(n, l);
        float day = smoothstep(-0.28, 0.34, sun);
        float twilight = 1.0 - smoothstep(0.02, 0.42, abs(sun));
        float farHold = mix(0.64, 0.96, closeStage);
        float boost = 1.0 + debugBoost * 0.18;

        float whiteNeedle =
          smoothstep(0.91, 0.968, limb) *
          (1.0 - smoothstep(0.986, 0.998, limb));
        whiteNeedle *= 0.68 + day * 0.48;

        float blueBand =
          smoothstep(0.72, 0.86, limb) *
          (1.0 - smoothstep(0.932, 0.985, limb));
        blueBand *= 0.38 + day * 0.62;

        float outerMist =
          smoothstep(0.66, 0.8, limb) *
          (1.0 - smoothstep(0.88, 0.968, limb));
        outerMist *= 0.12 + closeStage * 0.08;

        float sunsetEdge =
          twilight *
          smoothstep(0.5, 0.88, limb) *
          (1.0 - smoothstep(0.98, 1.0, limb));

        vec3 finalColor =
          white * whiteNeedle * 0.76 +
          blue * blueBand * 0.44 +
          mist * outerMist * 0.08 +
          sunset * sunsetEdge * 0.035;

        float alpha =
          whiteNeedle * 0.082 +
          blueBand * 0.034 +
          outerMist * 0.003 +
          sunsetEdge * 0.008;
        alpha *= intensity * farHold * boost;

        if (alpha < 0.0015) {
          discard;
        }

        gl_FragColor = vec4(min(finalColor * intensity * farHold * boost, vec3(0.98)), clamp(alpha, 0.0, 0.28));
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

export function LandingAtmosphere({
  composition,
  quality,
  sceneLightDirection,
  emphasis = false
}: LandingAtmosphereProps) {
  const material = useMemo(() => createAtmosphereMaterial(composition), [composition]);
  const radius = composition.earth.radius * (1 + composition.atmosphere.thickness * 0.42);

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
          radius,
          quality.tier === "high" ? Math.max(72, quality.segments) : quality.tier === "medium" ? 56 : 36,
          quality.tier === "high" ? 40 : quality.tier === "medium" ? 30 : 22
        ]}
      />
    </mesh>
  );
}
