"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  Color,
  CustomBlending,
  FrontSide,
  Group,
  OneMinusSrcAlphaFactor,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingResolvedAssets } from "./types";
import { useLandingTexture } from "./useLandingTexture";

interface LandingCloudDeckV2Props {
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

const CLOUD_DECK_V2_LOWER_RADIUS = 1.0048;
const CLOUD_DECK_V2_UPPER_RADIUS = 1.0084;
const lightDirection = new Vector3();
const lightColor = new Color();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function shouldArmCloudDeckImmediately() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.has("progress") || params.get("visualTest") === "pixels";
}

function createCloudDeckV2Material(composition: LandingComposition, shellLayer: number) {
  return new ShaderMaterial({
    uniforms: {
      cloudDeckMap: { value: null },
      time: { value: 0 },
      closeStage: { value: 1 },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      debugBoost: { value: 0 },
      qualityMix: { value: 1 },
      shellLayer: { value: shellLayer },
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
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vRim;

      void main() {
        vUv = uv;
        vLocalNormal = normalize(position);
        vec3 localUp = abs(vLocalNormal.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 tangentA = normalize(cross(localUp, vLocalNormal));
        vec3 tangentB = normalize(cross(vLocalNormal, tangentA));
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldTangentA = normalize(mat3(modelMatrix) * tangentA);
        vWorldTangentB = normalize(mat3(modelMatrix) * tangentB);
        vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
        vRim = 1.0 - max(dot(normalize(vWorldNormal), viewDirection), 0.0);
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
      uniform float shellLayer;
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vRim;

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
        float viewDot = max(dot(n, viewDirection), 0.001);
        float rim = clamp(vRim, 0.0, 1.0);
        float pathLength = clamp(1.0 / (0.24 + viewDot * 1.9), 0.42, 3.7);
        float pathVolume = smoothstep(0.72, 2.45, pathLength);
        float limb = smoothstep(0.48, 0.92, rim);
        float extremeRim = smoothstep(0.86, 0.996, rim);
        float ndl = dot(n, sunDirection);
        float day = smoothstep(-0.18, 0.36, ndl);
        float night = 1.0 - smoothstep(-0.24, 0.16, ndl);
        float twilight = 1.0 - smoothstep(0.02, 0.44, abs(ndl));

        vec2 baseUv = sphereUv(localN);
        vec2 viewShear = vec2(dot(viewDirection, vWorldTangentA), dot(viewDirection, vWorldTangentB));
        vec2 wind = vec2(time * 0.0054, time * 0.0011);
        vec2 shearStep = viewShear * (0.0026 + pathVolume * 0.0108 + closeStage * 0.0014);
        vec2 uv = baseUv + wind + viewShear * 0.0018;

        vec4 tap0 = texture2D(cloudDeckMap, uv - shearStep * 3.0);
        vec4 tap1 = texture2D(cloudDeckMap, uv - shearStep * 2.0);
        vec4 tap2 = texture2D(cloudDeckMap, uv - shearStep);
        vec4 tap3 = texture2D(cloudDeckMap, uv);
        vec4 tap4 = texture2D(cloudDeckMap, uv + shearStep);
        vec4 tap5 = texture2D(cloudDeckMap, uv + shearStep * 2.0);
        vec4 tap6 = texture2D(cloudDeckMap, uv + shearStep * 3.0);

        vec4 deck = (tap0 * 0.07 + tap1 * 0.11 + tap2 * 0.16 + tap3 * 0.22 + tap4 * 0.16 + tap5 * 0.11 + tap6 * 0.07) / 0.9;
        float coverage = clamp(deck.r, 0.0, 1.0);
        float thickness = clamp(deck.g * 0.86 + (tap1.g + tap5.g) * 0.08, 0.0, 1.0);
        float ao = clamp(deck.b * 0.82 + (tap0.b + tap1.b) * 0.12, 0.0, 1.0);
        float highCap = clamp(deck.a * 0.74 + (tap4.a + tap5.a + tap6.a) * 0.1, 0.0, 1.0);
        float shearDepth = clamp(max(tap0.g + tap1.g - tap5.g - tap6.g, 0.0) * 0.5 + abs(tap2.r - tap4.r) * 0.45, 0.0, 1.0);
        float synoptic = smoothstep(0.2, 0.78, deck.r * 0.48 + thickness * 0.42 + highCap * 0.24);
        float frontBand = smoothstep(0.16, 0.46, abs(tap0.r - tap6.r) + abs(tap1.g - tap5.g) * 0.74);
        float normalStep = mix(0.0014, 0.0022, pathVolume);
        float hC = texture2D(cloudDeckMap, uv).g;
        float hX = texture2D(cloudDeckMap, uv + vec2(normalStep, 0.0)).g;
        float hY = texture2D(cloudDeckMap, uv + vec2(0.0, normalStep)).g;
        vec3 cloudNormal = normalize(vec3((hC - hX) * 5.5, (hC - hY) * 5.5, 1.0));
        vec3 tangentSun = normalize(vec3(
          dot(sunDirection, normalize(vWorldTangentA)),
          dot(sunDirection, normalize(vWorldTangentB)),
          max(ndl, 0.0) + 0.08
        ));
        float cloudTopNdl = clamp(dot(cloudNormal, tangentSun), 0.0, 1.0);
        float microBreakup =
          noise2(baseUv * vec2(617.0, 293.0) + vec2(time * 0.003, 3.1)) * 0.62 +
          noise2(baseUv * vec2(1249.0, 571.0) + vec2(9.3, time * 0.002)) * 0.38;
        float fineFilament =
          noise2(baseUv * vec2(2387.0, 1091.0) + vec2(time * 0.004, 14.2)) * 0.54 +
          noise2(baseUv * vec2(4813.0, 2207.0) + vec2(3.6, time * 0.003)) * 0.46;
        coverage = clamp(coverage * mix(0.86, 1.1, microBreakup) * mix(0.92, 1.08, fineFilament), 0.0, 1.0);
        float baseCoverage = coverage;
        float baseThickness = thickness;
        float baseAo = ao;
        float baseHighCap = highCap;
        float closeWeatherLimiter = 1.0 - smoothstep(0.52, 1.0, closeStage) * 0.82;
        coverage = clamp(
          mix(baseCoverage, max(baseCoverage, synoptic * (0.4 + frontBand * 0.22)), closeWeatherLimiter) *
          mix(0.96, 1.08, fineFilament),
          0.0,
          1.0
        );
        thickness = clamp(
          mix(baseThickness, max(baseThickness, synoptic * (0.5 + frontBand * 0.24)), closeWeatherLimiter) *
          mix(0.94, 1.08, microBreakup),
          0.0,
          1.0
        );
        ao = clamp(
          mix(baseAo, max(baseAo, synoptic * (1.0 - baseHighCap * 0.42) * (0.46 + pathVolume * 0.16)), closeWeatherLimiter),
          0.0,
          1.0
        );
        highCap = clamp(
          mix(baseHighCap, max(baseHighCap, synoptic * frontBand * 0.34), closeWeatherLimiter) *
          mix(0.9, 1.12, microBreakup) *
          mix(0.94, 1.08, fineFilament),
          0.0,
          1.0
        );

        float edgeNoise =
          noise2(baseUv * vec2(84.0, 37.0) + vec2(7.2, 2.8)) * 0.5 +
          noise2(baseUv * vec2(173.0, 79.0) + vec2(1.9, 10.4)) * 0.32 +
          noise2(baseUv * vec2(311.0, 131.0) + vec2(5.1, 1.3)) * 0.18;
        float brokenSilhouette = smoothstep(
          0.26,
          0.74,
          edgeNoise + coverage * 0.34 + thickness * 0.22 + highCap * 0.16 - extremeRim * 0.12
        );
        float edgeBreak = mix(1.0, mix(0.2, 1.0, brokenSilhouette), extremeRim * (0.72 - debugBoost * 0.18));

        float sideMass = thickness * pathVolume * (0.5 + coverage * 0.36 + shearDepth * 0.32 + synoptic * 0.16);
        float lowerShadow = clamp(
          ao * (0.34 + sideMass * 1.22) +
          shearDepth * pathVolume * 0.66 +
          (1.0 - cloudTopNdl) * highCap * day * 0.22,
          0.0,
          1.0
        );
        float directionalTop = mix(0.28, 1.0, cloudTopNdl);
        float topLight = highCap * day * directionalTop * (0.32 + limb * 0.72 + pathVolume * 0.22 + frontBand * 0.12);
        float aerialLift = smoothstep(0.18, 0.68, coverage + highCap * 0.28);

        vec3 cloudBase = mix(vec3(0.045, 0.07, 0.12), vec3(0.58, 0.66, 0.75), clamp(day * 0.68 + aerialLift * 0.24, 0.0, 1.0));
        vec3 cloudTop = mix(vec3(0.56, 0.66, 0.76), vec3(0.9, 0.91, 0.86), clamp(highCap * 0.8 + day * 0.12, 0.0, 1.0));
        vec3 finalColor = mix(cloudBase, cloudTop, clamp(highCap * 0.55 + coverage * 0.12 + day * 0.16, 0.0, 1.0));
        finalColor *= lightColor * (0.2 + day * 0.92 + twilight * 0.09);
        finalColor = mix(finalColor, finalColor * vec3(0.28, 0.39, 0.58), clamp(lowerShadow * (0.62 + pathVolume * 0.32 + synoptic * 0.12), 0.0, 0.9));
        finalColor += vec3(0.82, 0.9, 0.96) * topLight * 0.22;
        finalColor += vec3(0.08, 0.22, 0.46) * sideMass * (0.16 + day * 0.16 + night * 0.12);
        finalColor += vec3(0.95, 0.48, 0.2) * twilight * highCap * 0.04;
        float closeOnlyStage = smoothstep(0.74, 1.0, closeStage);
        finalColor *= (0.94 + microBreakup * 0.07 + fineFilament * 0.035) * mix(1.0, 0.8, closeStage) * mix(1.0, 0.86, closeOnlyStage);

        float productionSoftness = mix(0.7, 1.0, debugBoost);
        float centerAlphaScale = mix(0.034 + closeStage * 0.018, 0.018 + debugBoost * 0.016, closeOnlyStage);
        float centerAlpha = coverage * opacity * centerAlphaScale * (0.58 + highCap * 0.42) * productionSoftness;
        float existingCloud = smoothstep(0.28, 0.72, baseCoverage);
        float denseCloud = smoothstep(0.46, 0.86, baseThickness) * existingCloud;
        float denseCloudTop = smoothstep(0.34, 0.74, baseHighCap) * denseCloud;
        float synopticFlow = noise2(baseUv * vec2(18.0, 7.0) + wind * 10.0);
        float cirrusFlow =
          noise2(baseUv * vec2(74.0, 18.0) + vec2(synopticFlow * 2.8, time * 0.002)) * 0.58 +
          noise2(baseUv * vec2(156.0, 31.0) + vec2(4.2, synopticFlow * 3.4)) * 0.42;
        float clearWeatherSlot = 1.0 - smoothstep(0.62, 0.92, baseCoverage + baseThickness * 0.42);
        float closeCirrus = smoothstep(0.6, 0.84, cirrusFlow + fineFilament * 0.12) *
          clearWeatherSlot *
          closeOnlyStage *
          smoothstep(-0.12, 0.52, ndl);
        centerAlpha += denseCloud * opacity * (0.028 + closeStage * 0.052) * (0.62 + denseCloudTop * 0.38) * productionSoftness;
        centerAlpha += closeCirrus * opacity * 0.038 * productionSoftness;
        float closeDenseWeather = denseCloud * closeOnlyStage * smoothstep(-0.12, 0.46, ndl);
        finalColor += vec3(0.72, 0.82, 0.92) * denseCloudTop * day * (0.055 + closeDenseWeather * 0.08);
        finalColor = mix(finalColor, max(finalColor, vec3(0.44, 0.52, 0.62)), closeDenseWeather * 0.12);
        finalColor = mix(finalColor, max(finalColor, vec3(0.42, 0.49, 0.58)), closeCirrus * 0.18);
        float limbAlpha = (coverage * 0.46 + thickness * 0.36 + highCap * 0.18) *
          opacity *
          (0.112 + closeStage * 0.085 + debugBoost * 0.18) *
          pathVolume *
          edgeBreak *
          mix(0.74, 1.0, qualityMix);
        float massAlpha = sideMass * opacity * (0.08 + closeStage * 0.045 + debugBoost * 0.08) * edgeBreak;
        float closeDenseAlpha = closeDenseWeather * opacity * (0.052 + denseCloudTop * 0.074) * productionSoftness;
        float alpha = centerAlpha + limbAlpha + massAlpha;
        alpha *= (0.8 + closeStage * 0.16) * mix(0.9, 1.08, microBreakup) * mix(0.94, 1.06, fineFilament) * mix(1.0, 0.72, closeOnlyStage);
        alpha += closeDenseAlpha * mix(0.92, 1.1, microBreakup);
        vec3 lowerLayerColor = mix(finalColor * vec3(0.34, 0.46, 0.64), finalColor * vec3(0.62, 0.72, 0.84), clamp(day * 0.48 + coverage * 0.2, 0.0, 1.0));
        lowerLayerColor = mix(lowerLayerColor, lowerLayerColor * vec3(0.32, 0.46, 0.68), clamp(lowerShadow * (0.58 + sideMass * 0.28), 0.0, 0.82));
        vec3 upperLayerColor = finalColor + vec3(0.72, 0.82, 0.92) * (topLight * 0.12 + denseCloudTop * day * 0.045);
        finalColor = mix(lowerLayerColor, upperLayerColor, shellLayer);
        float lowerAlpha = alpha * (0.38 + sideMass * 0.52 + closeDenseWeather * 0.18);
        float upperAlpha = alpha * (0.58 + highCap * 0.24 + closeDenseWeather * 0.34);
        alpha = mix(lowerAlpha, upperAlpha, shellLayer);
        alpha = clamp(alpha, 0.0, mix(0.24, 0.68, debugBoost));

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

export function LandingCloudDeckV2({
  composition,
  assets,
  quality,
  sceneLightDirection,
  emphasis = false,
  reducedMotion,
  paused
}: LandingCloudDeckV2Props) {
  const cloudGroup = useRef<Group>(null);
  const [cloudDeckArmed, setCloudDeckArmed] = useState(() => !emphasis || shouldArmCloudDeckImmediately());
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
  const materials = useMemo(
    () => ({
      lower: createCloudDeckV2Material(composition, 0),
      upper: createCloudDeckV2Material(composition, 1)
    }),
    [composition]
  );
  const enabled = shouldLoadCloudDeck && Boolean(cloudDeckTexture) && !cloudDeckTextureFailed;

  useEffect(() => {
    return () => {
      materials.lower.dispose();
      materials.upper.dispose();
    };
  }, [materials]);

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

    if (!cloudGroup.current || !enabled || !cloudDeckTexture) {
      return;
    }

    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    const activeLightDirection = sceneLightDirection ?? lightDirection.set(...composition.light.fixedSunDir).normalize();

    if (!paused && !reducedMotion) {
      cloudGroup.current.rotation.y = elapsed * 0.028;
      cloudGroup.current.rotation.x = Math.sin(elapsed * 0.03) * 0.005;
      cloudGroup.current.rotation.z = Math.sin(elapsed * 0.026) * 0.005;
    }

    [materials.lower, materials.upper].forEach((material) => {
      material.uniforms.cloudDeckMap.value = cloudDeckTexture;
      material.uniforms.time.value = elapsed;
      material.uniforms.closeStage.value = closeStage;
      material.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
      material.uniforms.debugBoost.value = emphasis ? 1 : 0;
      material.uniforms.qualityMix.value = quality.tier === "high" ? 1 : 0.68;
      material.uniforms.lightDir.value.copy(activeLightDirection).normalize();
    });
  });

  if (!enabled) {
    return null;
  }

  return (
    <group ref={cloudGroup}>
      <mesh material={materials.lower} renderOrder={3}>
        <sphereGeometry
          args={[
            composition.earth.radius * CLOUD_DECK_V2_LOWER_RADIUS,
            quality.tier === "high" ? Math.max(composition.earth.segments, quality.segments, 256) : 64,
            quality.tier === "high" ? 128 : 36
          ]}
        />
      </mesh>
      <mesh material={materials.upper} renderOrder={4}>
        <sphereGeometry
          args={[
            composition.earth.radius * CLOUD_DECK_V2_UPPER_RADIUS,
            quality.tier === "high" ? Math.max(composition.earth.segments, quality.segments, 256) : 64,
            quality.tier === "high" ? 128 : 36
          ]}
        />
      </mesh>
    </group>
  );
}
