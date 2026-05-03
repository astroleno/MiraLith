"use client";

import { useEffect, useMemo, useRef } from "react";
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

interface LandingHorizonCloudBeltProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

const HORIZON_CLOUD_RADIUS = 1.0115;
const lightDirection = new Vector3();
const lightColor = new Color();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createHorizonCloudMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      cloudDeckMap: { value: null },
      time: { value: 0 },
      closeStage: { value: 1 },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      debugBoost: { value: 0 },
      lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
      lightColor: {
        value: lightColor.setRGB(
          composition.light.color[0],
          composition.light.color[1],
          composition.light.color[2]
        ).clone()
      }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;

      void main() {
        vLocalNormal = normalize(position);
        vec3 localUp = abs(vLocalNormal.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 tangentA = normalize(cross(localUp, vLocalNormal));
        vec3 tangentB = normalize(cross(vLocalNormal, tangentA));
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldTangentA = normalize(mat3(modelMatrix) * tangentA);
        vWorldTangentB = normalize(mat3(modelMatrix) * tangentB);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudDeckMap;
      uniform float time;
      uniform float closeStage;
      uniform float opacity;
      uniform float debugBoost;
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;

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

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i += 1) {
          value += noise2(p) * amplitude;
          p = p * 2.04 + vec2(7.1, 3.8);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 localN = normalize(vLocalNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sunDirection = normalize(lightDir);
        float viewDot = max(dot(n, viewDirection), 0.001);
        float rim = 1.0 - clamp(viewDot, 0.0, 1.0);
        float pathLength = clamp(1.0 / (0.2 + viewDot * 1.8), 0.42, 4.2);
        float pathMask = smoothstep(0.82, 2.85, pathLength);
        float horizonMask = smoothstep(0.74, 0.94, rim) * (1.0 - smoothstep(0.989, 1.0, rim));

        vec2 baseUv = sphereUv(localN);
        vec2 viewShear = vec2(dot(viewDirection, vWorldTangentA), dot(viewDirection, vWorldTangentB));
        vec2 wind = vec2(time * 0.0016, time * 0.00032);
        vec2 shearStep = viewShear * (0.004 + pathMask * 0.016);
        vec2 uv = baseUv + wind;

        vec4 a = texture2D(cloudDeckMap, uv - shearStep * 2.0);
        vec4 b = texture2D(cloudDeckMap, uv - shearStep);
        vec4 c = texture2D(cloudDeckMap, uv);
        vec4 d = texture2D(cloudDeckMap, uv + shearStep);
        vec4 e = texture2D(cloudDeckMap, uv + shearStep * 2.0);
        vec4 deck = a * 0.12 + b * 0.2 + c * 0.36 + d * 0.2 + e * 0.12;

        float mapCoverage = clamp(deck.r * 0.78 + deck.g * 0.18 + deck.a * 0.2, 0.0, 1.0);
        float mapThickness = clamp(deck.g * 0.72 + (a.g + e.g) * 0.16, 0.0, 1.0);
        float mapAo = clamp(deck.b * 0.82 + max(a.b, e.b) * 0.18, 0.0, 1.0);
        float highCap = clamp(deck.a * 0.8 + max(d.a, e.a) * 0.18, 0.0, 1.0);

        float synthetic =
          fbm(baseUv * vec2(18.0, 9.0) + wind * 16.0) * 0.5 +
          fbm(baseUv * vec2(52.0, 19.0) + vec2(3.7, 1.2)) * 0.32 +
          fbm(baseUv * vec2(118.0, 43.0) - wind * 9.0) * 0.18;
        float brokenEdge =
          synthetic * 0.42 +
          fbm(baseUv * vec2(42.0, 17.0) + vec2(time * 0.002, 1.7)) * 0.32 +
          fbm(baseUv * vec2(118.0, 43.0) - wind * 9.0) * 0.26;
        float cloudPresence = smoothstep(0.3, 0.68, mapCoverage + mapThickness * 0.42 + highCap * 0.18);
        float beltCore = smoothstep(0.36, 0.72, mapCoverage + mapThickness * 0.35 + brokenEdge * 0.18);
        float edgeGap = smoothstep(0.24, 0.62, brokenEdge + mapCoverage * 0.35 + mapThickness * 0.24);
        float coverage = clamp(mapCoverage * (0.72 + beltCore * 0.28), 0.0, 1.0) * cloudPresence;
        float thickness = clamp(mapThickness * (0.78 + beltCore * 0.24), 0.0, 1.0) * cloudPresence;
        float sideMass = thickness * pathMask * edgeGap * (0.42 + coverage * 0.32);

        float ndl = dot(n, sunDirection);
        float day = smoothstep(-0.2, 0.38, ndl);
        float twilight = 1.0 - smoothstep(0.02, 0.42, abs(ndl));
        float underside = clamp(mapAo * 0.42 + sideMass * 0.62 + max(a.r - e.r, 0.0) * pathMask * 0.38, 0.0, 1.0);
        float topLight = (highCap * 0.54 + beltCore * 0.1) * day * (0.54 + pathMask * 0.42) * edgeGap;

        vec3 cloudBase = mix(vec3(0.04, 0.065, 0.105), vec3(0.54, 0.62, 0.7), clamp(day * 0.72 + coverage * 0.16, 0.0, 1.0));
        vec3 cloudTop = mix(vec3(0.62, 0.7, 0.78), vec3(0.88, 0.9, 0.86), clamp(highCap * 0.62 + beltCore * 0.18, 0.0, 1.0));
        vec3 finalColor = mix(cloudBase, cloudTop, clamp(highCap * 0.48 + coverage * 0.22, 0.0, 1.0));
        finalColor *= lightColor * (0.24 + day * 0.92 + twilight * 0.08);
        finalColor = mix(finalColor, finalColor * vec3(0.28, 0.38, 0.54), clamp(underside * 0.78, 0.0, 0.86));
        finalColor += vec3(0.86, 0.93, 1.0) * topLight * 0.24;
        finalColor += vec3(0.08, 0.18, 0.36) * sideMass * 0.22;
        finalColor += vec3(0.95, 0.48, 0.22) * twilight * highCap * 0.035;

        float limbAlpha = horizonMask * coverage * edgeGap * opacity * (0.046 + closeStage * 0.072 + debugBoost * 0.11);
        float volumeAlpha = horizonMask * sideMass * opacity * (0.034 + closeStage * 0.052 + debugBoost * 0.07);
        float alpha = limbAlpha + volumeAlpha;
        alpha *= smoothstep(0.18, 0.72, coverage + thickness * 0.38) * cloudPresence;
        alpha *= mix(0.64, 1.0, pathMask);
        alpha = clamp(alpha, 0.0, mix(0.16, 0.46, debugBoost));

        if (alpha < 0.0025) {
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

export function LandingHorizonCloudBelt({
  composition,
  assets,
  quality,
  sceneLightDirection,
  emphasis = false,
  reducedMotion,
  paused
}: LandingHorizonCloudBeltProps) {
  const cloud = useRef<Mesh>(null);
  const cloudDeckAsset = assets.earthCloudDeck;
  const shouldLoadCloudDeck =
    composition.earth.useClouds &&
    composition.earth.cloudOpacity > 0 &&
    quality.tier !== "fallback" &&
    quality.tier !== "low";
  const { texture: cloudDeckTexture, failed: cloudDeckTextureFailed } = useLandingTexture(
    shouldLoadCloudDeck ? cloudDeckAsset?.src : undefined,
    {
      colorSpace: cloudDeckAsset?.colorSpace,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      anisotropy: quality.tier === "high" ? 16 : 8
    }
  );
  const material = useMemo(() => createHorizonCloudMaterial(composition), [composition]);
  const enabled = shouldLoadCloudDeck && Boolean(cloudDeckTexture) && !cloudDeckTextureFailed;

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    if (!cloud.current || !enabled || !cloudDeckTexture) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    const activeLightDirection = sceneLightDirection ?? lightDirection.set(...composition.light.fixedSunDir).normalize();

    if (!paused && !reducedMotion) {
      cloud.current.rotation.y = elapsed * 0.013;
      cloud.current.rotation.x = Math.sin(elapsed * 0.018) * 0.003;
    }

    material.uniforms.cloudDeckMap.value = cloudDeckTexture;
    material.uniforms.time.value = elapsed;
    material.uniforms.closeStage.value = closeStage;
    material.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
    material.uniforms.lightDir.value.copy(activeLightDirection).normalize();
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={cloud} material={material} renderOrder={4}>
      <sphereGeometry
        args={[
          composition.earth.radius * HORIZON_CLOUD_RADIUS,
          quality.tier === "high" ? Math.max(112, quality.segments) : 72,
          quality.tier === "high" ? 58 : 38
        ]}
      />
    </mesh>
  );
}
