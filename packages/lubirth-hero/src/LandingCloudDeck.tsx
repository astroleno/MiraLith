"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  Color,
  CustomBlending,
  FrontSide,
  Mesh,
  OneMinusSrcAlphaFactor,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingResolvedAssets } from "./types";
import { useLandingTexture } from "./useLandingTexture";

interface LandingCloudDeckProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthCloudDeckActive?: boolean;
    __MiraLithLuBirthCloudDeckTexture?: string;
  }
}

const lightDirection = new Vector3();
const color = new Color();
const CLOUD_DECK_RADIUS = 1.014;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createCloudDeckMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      cloudDeckMap: { value: null },
      time: { value: 0 },
      closeStage: { value: 1 },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      debugBoost: { value: 0 },
      qualityMix: { value: 1 },
      lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
      lightColor: {
        value: color.setRGB(
          composition.light.color[0],
          composition.light.color[1],
          composition.light.color[2]
        ).clone()
      }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vFresnel;

      void main() {
        vUv = uv;
        vLocalNormal = normalize(position);
        vec3 localUp = abs(vLocalNormal.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 localTangentA = normalize(cross(localUp, vLocalNormal));
        vec3 localTangentB = normalize(cross(vLocalNormal, localTangentA));
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldTangentA = normalize(mat3(modelMatrix) * localTangentA);
        vWorldTangentB = normalize(mat3(modelMatrix) * localTangentB);
        vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
        vFresnel = 1.0 - max(dot(normalize(vWorldNormal), viewDirection), 0.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudDeckMap;
      uniform float time;
      uniform float closeStage;
      uniform float opacity;
      uniform float debugBoost;
      uniform float qualityMix;
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vFresnel;

      const float PI = 3.14159265359;

      vec2 sphereUv(vec3 normal) {
        float u = atan(normal.z, normal.x) / (PI * 2.0) + 0.5;
        float v = asin(clamp(normal.y, -1.0, 1.0)) / PI + 0.5;
        return vec2(fract(u), clamp(v, 0.001, 0.999));
      }

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

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 localN = normalize(vLocalNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sunDirection = normalize(lightDir);
        float ndl = dot(n, sunDirection);
        float day = smoothstep(-0.16, 0.34, ndl);
        float night = 1.0 - smoothstep(-0.22, 0.2, ndl);
        float twilight = 1.0 - smoothstep(0.02, 0.42, abs(ndl));
        float rim = clamp(vFresnel, 0.0, 1.0);
        float limb = smoothstep(0.3, 0.78, rim) * (1.0 - smoothstep(0.94, 1.0, rim));
        float limbVolume = smoothstep(0.46, 0.86, rim) * (1.0 - smoothstep(0.965, 1.0, rim));
        float centerFade = 1.0 - smoothstep(0.9, 0.99, rim);

        vec2 baseUv = sphereUv(localN);
        vec2 viewShear = vec2(dot(viewDirection, vWorldTangentA), dot(viewDirection, vWorldTangentB));
        vec2 wind = vec2(time * 0.0021, time * 0.00042);
        vec2 uv = baseUv + wind + viewShear * (0.0024 + limbVolume * 0.0068);
        vec4 deck = texture2D(cloudDeckMap, uv);
        vec4 deckLower = texture2D(cloudDeckMap, uv - viewShear * (0.0052 + limb * 0.0072));
        vec4 deckUpper = texture2D(cloudDeckMap, uv + viewShear * (0.0064 + limb * 0.0096));

        float coverage = clamp(deck.r * 0.72 + deckLower.r * 0.16 + deckUpper.r * 0.12, 0.0, 1.0);
        float thickness = clamp(deck.g * 0.72 + deckLower.g * 0.22 + deckUpper.g * 0.12, 0.0, 1.0);
        float ao = clamp(deck.b * 0.74 + deckLower.b * 0.28, 0.0, 1.0);
        float highCap = clamp(deck.a * 0.62 + deckUpper.a * 0.42, 0.0, 1.0);

        float sideMass = thickness * limbVolume * (0.84 + coverage * 0.24);
        float underside = clamp(ao * (0.34 + sideMass * 0.94) + max(deckLower.r - deckUpper.r, 0.0) * limbVolume * 0.86, 0.0, 1.0);
        float topLight = highCap * day * (0.5 + limb * 0.84 + debugBoost * 0.22);
        float lowerShadow = underside * (0.48 + night * 0.2 + limbVolume * 0.34);
        float light = mix(0.2, 1.02, day) * (1.0 - lowerShadow) + twilight * 0.12 + limb * day * 0.08;

        vec3 cloudBase = mix(vec3(0.07, 0.1, 0.16), vec3(0.66, 0.72, 0.78), clamp(day * 0.72 + coverage * 0.16, 0.0, 1.0));
        vec3 cloudTop = mix(vec3(0.78, 0.84, 0.9), vec3(1.0, 0.985, 0.92), highCap);
        vec3 finalColor = mix(cloudBase, cloudTop, clamp(highCap * 0.46 + day * 0.22, 0.0, 1.0));
        finalColor *= lightColor * light * (0.86 + sideMass * 0.48);
        finalColor = mix(finalColor, finalColor * vec3(0.34, 0.46, 0.66), clamp(underside * 0.86, 0.0, 0.84));
        finalColor += vec3(0.9, 0.95, 1.0) * topLight * 0.28;
        finalColor += vec3(0.2, 0.36, 0.58) * sideMass * (0.18 + day * 0.1);
        finalColor += vec3(0.03, 0.1, 0.24) * night * thickness * (0.12 + limbVolume * 0.16);
        finalColor += vec3(0.9, 0.48, 0.22) * twilight * highCap * 0.045;

        float edgeNoise =
          noise2(baseUv * vec2(72.0, 31.0) + vec2(8.3, 2.1)) * 0.58 +
          noise2(baseUv * vec2(151.0, 67.0) + vec2(1.2, 9.7)) * 0.42;
        float extremeGrazing = smoothstep(0.78, 0.988, rim);
        float brokenSilhouette = smoothstep(
          0.3,
          0.76,
          edgeNoise + coverage * 0.32 + thickness * 0.18 + highCap * 0.12 - extremeGrazing * 0.18
        );
        float edgeBreak = mix(1.0, mix(0.16, 1.0, brokenSilhouette), extremeGrazing * (0.82 - debugBoost * 0.24));
        float density = clamp(coverage * 0.5 + thickness * 0.34 + highCap * 0.16, 0.0, 1.0);
        float alpha = density *
          opacity *
          (0.26 + closeStage * 0.28 + limbVolume * 0.44 + debugBoost * 0.18) *
          centerFade *
          edgeBreak *
          mix(0.76, 1.0, qualityMix);
        alpha += sideMass * opacity * (0.065 + debugBoost * 0.045) * edgeBreak;
        alpha = clamp(alpha * mix(0.95, 1.32, closeStage), 0.0, mix(0.28, 0.44, debugBoost));

        if (alpha < 0.003) {
          discard;
        }

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    side: FrontSide,
    depthTest: true,
    depthWrite: false
  });
}

export function LandingCloudDeck({
  composition,
  assets,
  quality,
  sceneLightDirection,
  emphasis = false,
  reducedMotion,
  paused
}: LandingCloudDeckProps) {
  const cloud = useRef<Mesh>(null);
  const [cloudDeckArmed, setCloudDeckArmed] = useState(false);
  const cloudDeckAsset = assets.earthCloudDeck;
  const shouldLoadCloudDeck =
    composition.earth.useClouds &&
    composition.earth.cloudOpacity > 0 &&
    quality.tier !== "fallback" &&
    quality.tier !== "low" &&
    (cloudDeckArmed || emphasis);
  const { texture: cloudDeckTexture, failed: cloudDeckTextureFailed } = useLandingTexture(
    shouldLoadCloudDeck ? cloudDeckAsset?.src : undefined,
    {
      colorSpace: cloudDeckAsset?.colorSpace,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      anisotropy: quality.tier === "high" ? 16 : 8
    }
  );
  const material = useMemo(() => createCloudDeckMaterial(composition), [composition]);
  const enabled =
    shouldLoadCloudDeck &&
    Boolean(cloudDeckTexture) &&
    !cloudDeckTextureFailed;

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthCloudDeckActive = enabled;
    window.__MiraLithLuBirthCloudDeckTexture = enabled ? cloudDeckAsset?.src : undefined;

    return () => {
      window.__MiraLithLuBirthCloudDeckActive = false;
      window.__MiraLithLuBirthCloudDeckTexture = undefined;
    };
  }, [cloudDeckAsset?.src, enabled]);

  useFrame((state) => {
    const progress = getRuntimeOpeningProgress(0);
    if (!cloudDeckArmed && progress > 0.08) {
      setCloudDeckArmed(true);
    }

    if (!cloud.current || !enabled || !cloudDeckTexture) {
      return;
    }

    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    if (sceneLightDirection) {
      lightDirection.copy(sceneLightDirection).normalize();
    } else {
      lightDirection.set(...composition.light.fixedSunDir).normalize();
    }

    if (!paused && !reducedMotion) {
      cloud.current.rotation.y = elapsed * 0.022;
      cloud.current.rotation.x = Math.sin(elapsed * 0.032) * 0.006;
      cloud.current.rotation.z = Math.sin(elapsed * 0.027) * 0.005;
    }

    material.uniforms.cloudDeckMap.value = cloudDeckTexture;
    material.uniforms.time.value = elapsed;
    material.uniforms.closeStage.value = closeStage;
    material.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
    material.uniforms.qualityMix.value = quality.tier === "high" ? 1 : 0.62;
    material.uniforms.lightDir.value.copy(lightDirection);
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={cloud} material={material} renderOrder={3}>
      <sphereGeometry
        args={[
          composition.earth.radius * CLOUD_DECK_RADIUS,
          quality.tier === "high" ? Math.max(72, quality.segments) : 56,
          quality.tier === "high" ? 42 : 30
        ]}
      />
    </mesh>
  );
}
