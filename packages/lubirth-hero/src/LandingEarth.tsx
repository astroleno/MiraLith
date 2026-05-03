"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector3
} from "three";
import { OPENING_FIELD_AUTO_ROTATE_START, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingResolvedAssets } from "./types";
import { createEarthTexture } from "./textures";
import { useLandingTexture } from "./useLandingTexture";

interface LandingEarthProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  showTextureClouds?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
  sceneLightDirection?: Vector3;
  onDayTextureReady?: () => void;
  cloudDeckEnabled?: boolean;
}

const lightDirection = new Vector3();
const SURFACE_CLOUD_OPACITY_MULTIPLIER = 0.22;
const SURFACE_CLOUD_SHADOW_MULTIPLIER = 0.62;
const SURFACE_CLOUD_SCROLL_SPEED = 0.022;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function resolveEarthSegments(composition: LandingComposition, quality: QualityProfile) {
  if (quality.tier === "high") {
    return Math.max(composition.earth.segments, quality.segments);
  }

  if (quality.tier === "medium") {
    return Math.max(96, quality.segments);
  }

  return quality.segments;
}

export function LandingEarth({
  composition,
  assets,
  quality,
  showTextureClouds = true,
  reducedMotion,
  paused,
  sceneLightDirection,
  onDayTextureReady,
  cloudDeckEnabled = true
}: LandingEarthProps) {
  const earth = useRef<Mesh>(null);
  const earthSegments = resolveEarthSegments(composition, quality);
  const proceduralDayTexture = useMemo(
    () => createEarthTexture(quality.tier === "high" ? 1024 : 512),
    [quality.tier]
  );
  const [shouldLoadNightTexture, setShouldLoadNightTexture] = useState(
    () => typeof window !== "undefined" && (window.__MiraLithOpeningProgress ?? 0) > 0.28
  );
  const { texture: dayTexture } = useLandingTexture(assets.earthDay.src, {
    colorSpace: assets.earthDay.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const { texture: nightTexture } = useLandingTexture(shouldLoadNightTexture ? assets.earthNight?.src : undefined, {
    colorSpace: assets.earthNight?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const shouldUseTextureClouds = composition.earth.useClouds && showTextureClouds;
  const { texture: cloudTexture } = useLandingTexture(shouldUseTextureClouds ? assets.earthClouds?.src : undefined, {
    colorSpace: assets.earthClouds?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const shouldUseCloudDeckTexture =
    cloudDeckEnabled &&
    shouldUseTextureClouds &&
    quality.tier !== "low" &&
    quality.tier !== "fallback";
  const { texture: cloudDeckTexture } = useLandingTexture(
    shouldUseCloudDeckTexture ? assets.earthCloudDeck?.src : undefined,
    {
      colorSpace: assets.earthCloudDeck?.colorSpace ?? "linear",
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping
    }
  );
  const { texture: normalTexture } = useLandingTexture(quality.tier === "high" ? assets.earthNormal?.src : undefined, {
    colorSpace: assets.earthNormal?.colorSpace ?? "linear",
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const { texture: displacementTexture } = useLandingTexture(
    quality.tier === "high" ? assets.earthDisplacement?.src : undefined,
    {
      colorSpace: assets.earthDisplacement?.colorSpace ?? "linear",
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping
    }
  );
  const activeDayTexture = dayTexture ?? proceduralDayTexture;
  const activeNightTexture = nightTexture ?? activeDayTexture;
  const activeCloudTexture = cloudTexture ?? activeDayTexture;
  const activeCloudDeckTexture = cloudDeckTexture ?? activeCloudTexture;
  const activeNormalTexture = normalTexture ?? activeDayTexture;
  const activeDisplacementTexture = displacementTexture ?? activeDayTexture;

  useEffect(() => {
    if (dayTexture) {
      onDayTextureReady?.();
    }
  }, [dayTexture, onDayTextureReady]);

  const material = useMemo(
    () => {
      activeDayTexture.colorSpace = SRGBColorSpace;
      activeDayTexture.wrapS = RepeatWrapping;
      activeNightTexture.colorSpace = SRGBColorSpace;
      activeNightTexture.wrapS = RepeatWrapping;
      activeCloudTexture.colorSpace = SRGBColorSpace;
      activeCloudTexture.wrapS = RepeatWrapping;
      activeCloudTexture.wrapT = RepeatWrapping;
      activeCloudDeckTexture.wrapS = RepeatWrapping;
      activeCloudDeckTexture.wrapT = RepeatWrapping;
      activeNormalTexture.wrapS = RepeatWrapping;
      activeNormalTexture.wrapT = RepeatWrapping;
      activeDisplacementTexture.wrapS = RepeatWrapping;
      activeDisplacementTexture.wrapT = RepeatWrapping;

      return new ShaderMaterial({
        uniforms: {
          dayMap: { value: activeDayTexture },
          nightMap: { value: activeNightTexture },
          cloudMap: { value: activeCloudTexture },
          cloudDeckMap: { value: activeCloudDeckTexture },
          normalMap: { value: activeNormalTexture },
          displacementMap: { value: activeDisplacementTexture },
          hasCloudDeckMap: { value: cloudDeckTexture ? 1 : 0 },
          hasNormalMap: { value: normalTexture ? 1 : 0 },
          hasDisplacementMap: { value: displacementTexture ? 1 : 0 },
          normalMapStrength: { value: 0.28 },
          displacementStrength: { value: 2.8 },
          lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
          lightColor: {
            value: new Color(
              composition.light.color[0],
              composition.light.color[1],
              composition.light.color[2]
            )
          },
          sunIntensity: { value: composition.light.intensity },
          ambient: { value: composition.light.ambientIntensity },
          edge: { value: composition.earth.terminatorSoftness },
          nightBoost: { value: composition.earth.nightIntensity },
          specularStrength: { value: composition.earth.specularStrength },
          cloudOpacity: {
            value: shouldUseTextureClouds
              ? composition.earth.cloudOpacity * SURFACE_CLOUD_OPACITY_MULTIPLIER
              : 0
          },
          cloudShadowOpacity: {
            value: shouldUseTextureClouds
              ? composition.earth.cloudOpacity * SURFACE_CLOUD_SHADOW_MULTIPLIER
              : 0
          },
          cloudOffset: { value: 0 },
          rimStrength: { value: composition.earth.rimStrength },
          rimWidth: { value: composition.earth.rimWidth },
          edgeLightStrength: { value: composition.earth.edgeLightStrength },
          edgeLightWidth: { value: composition.earth.edgeLightWidth },
          edgeLightColor: {
            value: new Color(
              composition.earth.edgeLightColor[0],
              composition.earth.edgeLightColor[1],
              composition.earth.edgeLightColor[2]
            )
          },
          edgeNeedleStrength: { value: composition.earth.edgeNeedleStrength },
          edgeShadowSoftness: { value: composition.earth.edgeShadowSoftness },
          closeStage: { value: 1 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vViewW;
          varying vec3 vWorldTangentA;
          varying vec3 vWorldTangentB;

          void main() {
            vUv = uv;
            vec3 localNormal = normalize(position);
            vec3 localUp = abs(localNormal.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
            vec3 tangentA = normalize(cross(localUp, localNormal));
            vec3 tangentB = normalize(cross(localNormal, tangentA));
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vViewW = normalize(cameraPosition - worldPosition.xyz);
            vWorldTangentA = normalize(mat3(modelMatrix) * tangentA);
            vWorldTangentB = normalize(mat3(modelMatrix) * tangentB);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D dayMap;
          uniform sampler2D nightMap;
          uniform sampler2D cloudMap;
          uniform sampler2D cloudDeckMap;
          uniform sampler2D normalMap;
          uniform sampler2D displacementMap;
          uniform float hasCloudDeckMap;
          uniform float hasNormalMap;
          uniform float hasDisplacementMap;
          uniform float normalMapStrength;
          uniform float displacementStrength;
          uniform vec3 lightDir;
          uniform vec3 lightColor;
          uniform float sunIntensity;
          uniform float ambient;
          uniform float edge;
          uniform float nightBoost;
          uniform float specularStrength;
          uniform float cloudOpacity;
          uniform float cloudShadowOpacity;
          uniform float cloudOffset;
          uniform float rimStrength;
          uniform float rimWidth;
          uniform float edgeLightStrength;
          uniform float edgeLightWidth;
          uniform vec3 edgeLightColor;
          uniform float edgeNeedleStrength;
          uniform float edgeShadowSoftness;
          uniform float closeStage;

          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vViewW;
          varying vec3 vWorldTangentA;
          varying vec3 vWorldTangentB;

          float grain(vec2 uv) {
            return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
          }

          float noise2(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = grain(i);
            float b = grain(i + vec2(1.0, 0.0));
            float c = grain(i + vec2(0.0, 1.0));
            float d = grain(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          float fbmTerrain(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 4; i += 1) {
              value += noise2(p) * amplitude;
              p = p * 2.03 + vec2(7.1, 3.7);
              amplitude *= 0.5;
            }
            return value;
          }

          float sampleCloud(vec2 uv) {
            vec3 cloudRgb = texture2D(cloudMap, vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999))).rgb;
            return dot(cloudRgb, vec3(0.2126, 0.7152, 0.0722));
          }

          void main() {
            vec3 n = normalize(vNormalW);
            vec3 tangentA = normalize(vWorldTangentA);
            vec3 tangentB = normalize(vWorldTangentB);
            vec3 l = normalize(lightDir);
            vec3 v = normalize(vViewW);
            float reliefStage = smoothstep(0.18, 1.0, closeStage);
            float terrainHeight = 0.5;
            float terrainRelief = 0.0;

            if (hasNormalMap > 0.5) {
              vec3 normalTex = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
              normalTex.xy *= normalMapStrength * (0.36 + reliefStage * 0.82);
              normalTex.z = max(normalTex.z, 0.18);
              vec3 mappedNormal = normalize(tangentA * normalTex.x + tangentB * normalTex.y + n * normalTex.z);
              n = normalize(mix(n, mappedNormal, 0.16 + reliefStage * 0.38));
            }

            if (hasDisplacementMap > 0.5) {
              vec2 heightStep = vec2(0.00062, 0.00031);
              terrainHeight = texture2D(displacementMap, vUv).r;
              float heightX = texture2D(displacementMap, vUv + vec2(heightStep.x, 0.0)).r;
              float heightY = texture2D(displacementMap, vUv + vec2(0.0, heightStep.y)).r;
              vec3 heightNormal = normalize(
                n -
                tangentA * (heightX - terrainHeight) * displacementStrength * reliefStage -
                tangentB * (heightY - terrainHeight) * displacementStrength * reliefStage
              );
              n = normalize(mix(n, heightNormal, 0.12 + reliefStage * 0.44));
              terrainRelief = (terrainHeight - 0.5) * reliefStage;
            }

            float ndl = dot(n, l);
            float fresnel = 1.0 - max(dot(n, v), 0.0);
            float closeTransition = clamp(edge * 0.68, 0.07, 0.11);
            float fieldTransition = clamp(edge * 2.05, 0.24, 0.34);
            float transitionWidth = mix(fieldTransition, closeTransition, closeStage);
            float midTransitionStage = 1.0 - abs(closeStage * 2.0 - 1.0);
            transitionWidth *= 1.0 + midTransitionStage * 0.48;
            float dayW = smoothstep(-transitionWidth * 1.12, transitionWidth * 1.18, ndl);
            float nightW = 1.0 - dayW;
            float deepNightW = 1.0 - smoothstep(-transitionWidth * 2.7, -transitionWidth * 0.86, ndl);

            vec3 rawDayTex = texture2D(dayMap, vUv).rgb;
            vec2 detailStep = vec2(0.00062, 0.00031);
            vec3 dayBlur = (
              texture2D(dayMap, vUv + detailStep).rgb +
              texture2D(dayMap, vUv - detailStep).rgb +
              texture2D(dayMap, vUv + detailStep.yx).rgb +
              texture2D(dayMap, vUv - detailStep.yx).rgb
            ) * 0.25;
            vec2 microStep = vec2(0.00018, 0.000095);
            vec3 dayMicroBlur = (
              texture2D(dayMap, vUv + microStep).rgb +
              texture2D(dayMap, vUv - microStep).rgb +
              texture2D(dayMap, vUv + microStep.yx).rgb +
              texture2D(dayMap, vUv - microStep.yx).rgb
            ) * 0.25;
            float surfaceDetail = dot(rawDayTex - dayBlur, vec3(0.299, 0.587, 0.114));
            float microGrain =
              grain(vUv * vec2(4096.0, 2048.0)) * 0.58 +
              grain(vUv * vec2(8192.0, 4096.0) + vec2(17.0)) * 0.42;
            float orthoTextureDetail =
              grain(vUv * vec2(12288.0, 6144.0) + vec2(5.7, 2.1)) * 0.5 +
              grain(vUv * vec2(24576.0, 12288.0) + vec2(13.2, 8.4)) * 0.5;
            vec3 dayTex =
              rawDayTex +
              (rawDayTex - dayBlur) * (0.46 + closeStage * 0.16) +
              (rawDayTex - dayMicroBlur) * (0.18 + closeStage * 0.3) +
              surfaceDetail * 0.086;
            float dayTexLuma = dot(dayTex, vec3(0.299, 0.587, 0.114));
            dayTex += (microGrain - 0.5) * (0.012 + closeStage * 0.038) * (0.42 + dayTexLuma);
            dayTex += (orthoTextureDetail - 0.5) * closeStage * 0.036 * smoothstep(0.2, 0.76, dayTexLuma);
            dayTex = mix(vec3(dayTexLuma), dayTex, 0.95);
            dayTex = pow(clamp(dayTex, vec3(0.0), vec3(1.18)), vec3(mix(0.98, 1.08, closeStage)));
            float closeDayHighlight = smoothstep(0.38, 0.82, dayTexLuma) * closeStage;
            dayTex *= mix(1.0, 0.68, closeDayHighlight);
            vec3 nightTex = pow(texture2D(nightMap, vUv).rgb, vec3(0.9));
            vec2 cloudUv = vec2(fract(vUv.x + cloudOffset), fract(vUv.y + cloudOffset * 0.18));
            vec2 deckUv = cloudUv;
            float closeExposureDiscipline = mix(1.0, 0.68, closeStage);
            float closeCloudDiscipline = mix(1.0, 0.92, closeStage);
            float cloudRaw = sampleCloud(cloudUv);
            vec4 cloudDeck = texture2D(cloudDeckMap, deckUv);
            float deckCoverage = clamp(cloudDeck.r, 0.0, 1.0);
            float deckThickness = clamp(cloudDeck.g, 0.0, 1.0);
            float deckAo = clamp(cloudDeck.b, 0.0, 1.0);
            float deckHighCap = clamp(cloudDeck.a, 0.0, 1.0);
            vec2 cloudDetailStep = vec2(0.0015, 0.00078);
            float cloudBlur = (
              sampleCloud(cloudUv + cloudDetailStep) +
              sampleCloud(cloudUv - cloudDetailStep) +
              sampleCloud(cloudUv + cloudDetailStep.yx) +
              sampleCloud(cloudUv - cloudDetailStep.yx)
            ) * 0.25;
            float cloudSharp = clamp(
              cloudRaw + (cloudRaw - cloudBlur) * (0.38 + closeStage * 0.42),
              0.0,
              1.0
            );
            float deckWeather = smoothstep(0.26, 0.74, deckCoverage + deckThickness * 0.48 + deckHighCap * 0.18);
            float deckDenseWeather = smoothstep(0.58, 0.9, deckCoverage * 0.64 + deckThickness * 0.78 + deckHighCap * 0.22);
            float unifiedCloudSharp = mix(
              cloudSharp,
              clamp(max(cloudSharp, deckCoverage * 0.36 + deckThickness * 0.22 + deckHighCap * 0.12), 0.0, 1.0),
              hasCloudDeckMap * 0.24
            );
            float cloudRelief = (cloudSharp - sampleCloud(cloudUv + vec2(0.0064, -0.0042))) * 1.54;
            float cloudMicro =
              grain(cloudUv * vec2(8192.0, 4096.0) + vec2(1.3, 4.7)) * 0.58 +
              grain(cloudUv * vec2(16384.0, 8192.0) + vec2(11.2, 0.8)) * 0.42;
            float cloudEdgeBreak = mix(0.84, 1.16, cloudMicro);
            float closeWeatherFlow = fbmTerrain(cloudUv * vec2(30.0, 13.0) + vec2(cloudOffset * 9.0, cloudOffset * 2.4));
            float closeFilament = smoothstep(0.58, 0.86, closeWeatherFlow + (cloudMicro - 0.5) * 0.2) *
              closeStage *
              smoothstep(-0.18, 0.58, ndl);
            float closeSurfaceCloudLimiter = mix(1.0, 0.82, closeStage);
            float cloudDetailGate = smoothstep(0.22, 0.62, cloudSharp + closeFilament * 0.14 + (cloudMicro - 0.5) * 0.18);
            float visibleCloudCore = smoothstep(0.32, 0.64, cloudSharp * mix(0.92, 1.12, cloudMicro));
            float visibleCloudFringe = smoothstep(0.14, 0.46, cloudSharp * cloudEdgeBreak);
            float cloudThicknessBoost = mix(0.92, 1.28, deckDenseWeather * hasCloudDeckMap);
            float cloudBodySource = visibleCloudCore * cloudThicknessBoost;
            float cloudVeilSource =
              visibleCloudFringe * 0.18 +
              deckWeather * cloudDetailGate * visibleCloudFringe * hasCloudDeckMap * 0.04 +
              closeFilament * 0.08;
            float cloudMask = (cloudBodySource * 1.32 + cloudVeilSource) * cloudOpacity * closeSurfaceCloudLimiter;
            float cloudCore = (
              cloudBodySource * 1.18 +
              visibleCloudCore * deckDenseWeather * hasCloudDeckMap * 0.34 +
              closeFilament * 0.08
            ) * cloudOpacity * mix(1.0, 0.96, closeStage);
            float cloudAltitude = pow(fresnel, 2.35) * cloudMask * (0.28 + closeStage * 0.46);
            vec2 lightTangentUv = vec2(dot(l, normalize(vWorldTangentA)), dot(l, normalize(vWorldTangentB)));
            float lightTangentLen = max(length(lightTangentUv), 0.001);
            lightTangentUv /= lightTangentLen;
            float lowSunShadow = 1.0 - smoothstep(0.22, 0.78, max(ndl, 0.0));
            float cloudCoreUnit = clamp(cloudCore / max(cloudOpacity, 0.001), 0.0, 1.0);
            float shadowDistance = mix(0.65, 1.25, cloudCoreUnit);
            float shadowOffset = (0.0016 + lowSunShadow * 0.0042 + closeStage * 0.0012) * (0.45 + lightTangentLen * 0.55);
            vec2 shadowUv = vec2(
              fract(cloudUv.x - lightTangentUv.x * shadowOffset * shadowDistance),
              fract(cloudUv.y - lightTangentUv.y * shadowOffset * shadowDistance * 0.62)
            );
            vec2 deckShadowUv = vec2(
              fract(deckUv.x - lightTangentUv.x * shadowOffset * shadowDistance * 1.18),
              fract(deckUv.y - lightTangentUv.y * shadowOffset * shadowDistance * 0.72)
            );
            float shadowRaw = sampleCloud(shadowUv);
            vec4 shadowDeck = texture2D(cloudDeckMap, deckShadowUv);
            float deckCaster = smoothstep(0.32, 0.74, shadowDeck.r * 0.42 + shadowDeck.g * 0.82 + shadowDeck.a * 0.2);
            float shadowSoft =
              shadowRaw * 0.56 +
              sampleCloud(shadowUv + lightTangentUv * 0.0025) * 0.24 +
              sampleCloud(shadowUv - lightTangentUv * 0.004) * 0.2;
            shadowSoft = mix(shadowSoft, max(shadowSoft * 0.54, deckCaster), hasCloudDeckMap * 0.82);
            float hardCloudShadow = smoothstep(0.34, 0.72, shadowSoft * mix(0.92, 1.08, cloudMicro))
              * cloudShadowOpacity
              * dayW
              * (0.72 + lowSunShadow * 0.9)
              * max(smoothstep(0.42, 0.82, cloudSharp), deckCaster * hasCloudDeckMap);
            float softCloudShadow = smoothstep(0.18, 0.58, shadowSoft)
              * cloudShadowOpacity
              * 0.42
              * dayW
              * (0.72 + lowSunShadow * 0.28);
            float thickShadowCaster =
              max(smoothstep(0.48, 0.82, cloudCoreUnit), deckCaster * hasCloudDeckMap) *
              max(smoothstep(0.4, 0.78, unifiedCloudSharp), deckCaster * hasCloudDeckMap) *
              smoothstep(0.18, 0.72, max(cloudRaw, deckCoverage * hasCloudDeckMap));
            thickShadowCaster = max(thickShadowCaster, deckCaster * smoothstep(0.24, 0.72, shadowDeck.g) * hasCloudDeckMap);
            hardCloudShadow *= thickShadowCaster;
            softCloudShadow *= mix(0.36, 1.0, thickShadowCaster);
            float cloudShadow = min(hardCloudShadow + softCloudShadow, 0.52);
            float cloudPresentation = clamp(max(max(cloudSharp, visibleCloudCore), closeFilament * 0.82), 0.0, 1.0);
            vec3 cloudCol = mix(vec3(0.62, 0.68, 0.74), vec3(1.0, 0.985, 0.94), pow(cloudPresentation, 0.72));
            cloudCol += vec3(0.58, 0.64, 0.7) * max(cloudRelief, 0.0);
            cloudCol += vec3(0.44, 0.52, 0.62) * deckHighCap * deckWeather * hasCloudDeckMap * (0.08 + dayW * 0.12);
            float cloudSelfShadow = clamp(
              deckAo * deckDenseWeather * hasCloudDeckMap * (0.58 + closeStage * 0.34) +
              lowSunShadow * cloudBodySource * 0.22,
              0.0,
              0.84
            );
            cloudCol *= mix(vec3(1.0), vec3(0.38, 0.48, 0.66), cloudSelfShadow);
            cloudCol += vec3(0.2, 0.3, 0.48) * cloudAltitude;
            cloudCol -= vec3(0.25, 0.29, 0.36) * max(-cloudRelief, 0.0);
            cloudCol *= closeCloudDiscipline;
            vec3 shadowTint = mix(vec3(1.0), vec3(0.54, 0.62, 0.78), clamp(cloudShadow * 1.18, 0.0, 0.5));
            vec3 shadowedDay = dayTex * shadowTint;
            float cloudLitEdge = smoothstep(0.44, 0.86, unifiedCloudSharp) * smoothstep(-0.1, 0.3, ndl);
            vec3 cloudWarmEdge = vec3(1.0, 0.82, 0.54) * cloudLitEdge * (0.12 + cloudAltitude * 0.18) * mix(1.0, 0.54, closeStage);
            float dryLandSignal = smoothstep(0.06, 0.26, max(dayTex.r, dayTex.g) - dayTex.b) *
              smoothstep(0.42, 0.82, dayTexLuma);
            float cloudCoverageMix = clamp(
              max(
                cloudMask * (2.1 + cloudCore * 1.15 + deckDenseWeather * cloudDetailGate * hasCloudDeckMap * 0.5),
                visibleCloudCore * closeStage * 0.985
              ),
              0.0,
              0.995
            );
            float surfaceCloudBlend = 0.0;
            vec3 daySurface = shadowedDay;
            float visibleCloudShadow = cloudShadow * (1.0 - smoothstep(0.24, 0.86, cloudCoverageMix) * 0.45);
            float directShadowCaster = max(deckCaster * hasCloudDeckMap, smoothstep(0.46, 0.78, shadowSoft));
            float directVisibleShadow =
              directShadowCaster *
              dayW *
              (0.32 + lowSunShadow * 0.42 + closeStage * 0.18) *
              (1.0 - smoothstep(0.18, 0.72, visibleCloudCore) * 0.62);
            visibleCloudShadow = max(visibleCloudShadow, directVisibleShadow);
            daySurface = mix(
              daySurface,
              daySurface * vec3(0.52, 0.62, 0.8),
              clamp(visibleCloudShadow * 0.68, 0.0, 0.44)
            );
            float daySurfaceLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            vec3 landFineDetail = (rawDayTex - dayMicroBlur) * (0.16 + closeStage * 0.34);
            float exposedSurface = 1.0 - clamp(surfaceCloudBlend * 1.12, 0.0, 1.0);
            daySurface = mix(vec3(daySurfaceLuma), daySurface, 0.94);
            daySurface += landFineDetail * exposedSurface * (0.34 + dryLandSignal * 0.42);
            daySurface += (microGrain - 0.5) * closeStage * 0.02 * (0.28 + daySurfaceLuma);
            daySurface += (orthoTextureDetail - 0.5) * closeStage * 0.026 * exposedSurface * (0.36 + dryLandSignal * 0.58);
            float landMacro = fbmTerrain(vUv * vec2(32.0, 16.0) + vec2(1.7, 4.2));
            float landMeso = fbmTerrain(vUv * vec2(128.0, 64.0) + vec2(3.2, 1.7));
            float landMicro = fbmTerrain(vUv * vec2(512.0, 256.0) + vec2(11.3, 8.1));
            float dryCloseDetail = exposedSurface * closeStage * dryLandSignal * dayW;
            daySurface += (landMacro - 0.5) * dryCloseDetail * 0.035;
            daySurface += (landMeso - 0.5) * dryCloseDetail * 0.045;
            daySurface += (landMicro - 0.5) * dryCloseDetail * 0.018;
            daySurface += terrainRelief * dryCloseDetail * vec3(0.055, 0.06, 0.068);
            daySurfaceLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            daySurface *= mix(1.0, 0.78, dryLandSignal * closeStage);
            daySurface *= mix(1.0, 0.48, smoothstep(0.38, 0.8, daySurfaceLuma) * closeStage);
            daySurface *= mix(vec3(1.0), vec3(0.9, 0.92, 0.98), dryLandSignal * closeStage * 0.42);
            float desertOceanSignal = dayTex.b - max(dayTex.r, dayTex.g) * 0.52;
            float desertOceanMask = smoothstep(0.035, 0.18, desertOceanSignal) *
              (1.0 - clamp(max(cloudMask, cloudCore) * 0.9, 0.0, 0.92));
            float desertSignal =
              smoothstep(0.08, 0.32, max(dayTex.r, dayTex.g) - dayTex.b) *
              smoothstep(0.45, 0.78, dayTexLuma) *
              (1.0 - desertOceanMask) *
              exposedSurface;
            daySurface *= mix(vec3(1.0), vec3(0.64, 0.68, 0.76), desertSignal * closeStage * 0.68);
            float compressedDesertLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            daySurface = mix(daySurface, vec3(compressedDesertLuma), desertSignal * closeStage * 0.26);
            daySurfaceLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            float closeBrightSurface = smoothstep(0.26, 0.62, daySurfaceLuma) * closeStage * exposedSurface * dayW;
            float closeHorizonSurface = smoothstep(0.34, 0.88, fresnel) * closeStage * dayW;
            daySurface *= mix(vec3(1.0), vec3(0.68, 0.72, 0.8), closeBrightSurface * 0.46);
            daySurface *= mix(vec3(1.0), vec3(0.72, 0.78, 0.86), closeHorizonSurface * 0.34);
            float closeBrightLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            daySurface = mix(daySurface, vec3(closeBrightLuma), closeBrightSurface * 0.18);
            daySurface *= mix(
              vec3(1.0),
              vec3(0.58, 0.68, 0.84),
              clamp(visibleCloudShadow * 0.34, 0.0, 0.34)
            );
            float dayLight = pow(max(ndl, 0.0), 0.82);
            float grazingSun = pow(
              clamp((ndl + transitionWidth * 1.45) / max(transitionWidth * 2.7, 0.001), 0.0, 1.0),
              1.32
            ) * (1.0 - smoothstep(transitionWidth * 0.55, transitionWidth * 2.4, abs(ndl)));
            vec3 dayCol = daySurface * lightColor * (ambient * 1.34 + (dayLight + grazingSun * 0.25) * sunIntensity) * dayW * 0.78 * closeExposureDiscipline;
            dayCol *= mix(1.0, 0.72, closeHorizonSurface);
            vec3 halfDir = normalize(l + v);
            float oceanSignal = dayTex.b - max(dayTex.r, dayTex.g) * 0.52;
            float oceanMask = smoothstep(0.035, 0.18, oceanSignal) * (1.0 - clamp(max(cloudMask, cloudCore) * 0.9, 0.0, 0.92));
            float oceanGlint = pow(max(dot(n, halfDir), 0.0), 78.0) * oceanMask * dayW * specularStrength * (0.46 + closeStage * 0.38);
            vec3 oceanSpecular = vec3(0.74, 0.86, 1.0) * oceanGlint;
            vec2 glowStep = vec2(0.0024, 0.0012);
            vec3 nightGlowTex = (
              texture2D(nightMap, vUv).rgb +
              texture2D(nightMap, vUv + glowStep).rgb +
              texture2D(nightMap, vUv - glowStep).rgb +
              texture2D(nightMap, vUv + glowStep.yx).rgb +
              texture2D(nightMap, vUv - glowStep.yx).rgb
            ) * 0.2;
            nightGlowTex = pow(nightGlowTex, vec3(0.92));
            float cityLuma = max(max(nightTex.r, nightTex.g), nightTex.b);
            float citySparkle = smoothstep(0.08, 0.62, cityLuma) * smoothstep(0.34, 0.98, grain(vUv * vec2(16384.0, 8192.0)));
            float cityFineSparkle =
              smoothstep(0.04, 0.32, cityLuma) *
              smoothstep(0.7, 0.995, grain(vUv * vec2(32768.0, 16384.0) + vec2(6.0)));
            vec3 cityCore = nightTex * vec3(1.0, 0.76, 0.42) * nightBoost * pow(nightW, 1.34) * (2.72 + citySparkle * 1.2 + cityFineSparkle * 1.85);
            vec3 cityHalo = nightGlowTex * vec3(0.95, 0.48, 0.18) * nightBoost * pow(nightW, 0.8) * 0.52;
            cityCore += vec3(1.0, 0.82, 0.52) * cityFineSparkle * nightBoost * pow(nightW, 1.42) * 0.045;
            vec3 cityCol = cityCore + cityHalo;
            vec3 moonlitLand = daySurface * vec3(0.1, 0.18, 0.32) * deepNightW * 0.24;
            vec3 moonlitClouds = cloudCol * max(cloudMask, cloudCore) * deepNightW * vec3(0.18, 0.27, 0.44) * 1.35;
            float surfaceFillStrength = (0.04 + ambient * 3.4) * (0.38 + dayW * 0.62) * mix(1.0, 0.62, closeStage);
            vec3 surfaceFill = daySurface * vec3(0.14, 0.18, 0.24) * surfaceFillStrength * (1.0 - deepNightW * 0.45);
            surfaceFill *= mix(1.0, 0.58, closeHorizonSurface);

            float terminator = 1.0 - smoothstep(0.0, transitionWidth * 0.78, abs(ndl));
            float blueTwilight =
              smoothstep(-transitionWidth * 1.15, -transitionWidth * 0.18, ndl) *
              (1.0 - smoothstep(transitionWidth * 0.02, transitionWidth * 0.85, ndl));
            float warmEdge =
              smoothstep(-transitionWidth * 0.42, -transitionWidth * 0.04, ndl) *
              (1.0 - smoothstep(0.0, transitionWidth * 0.38, ndl));
            vec3 terminatorCol =
              vec3(0.035, 0.11, 0.24) * blueTwilight * 0.018 +
              vec3(0.98, 0.48, 0.14) * warmEdge * 0.0015;
            float grazingLight = pow(
              1.0 - smoothstep(transitionWidth * 0.08, transitionWidth * 2.15, abs(ndl)),
              1.35
            );
            float cloudBreak = 0.42 + max(cloudMask, cloudCore) * 0.58;
            vec3 twilightFill =
              (
                daySurface * vec3(0.08, 0.095, 0.13) +
                cloudCol * max(cloudMask, cloudCore) * vec3(0.16, 0.16, 0.17)
              ) *
              grazingLight *
              cloudBreak *
              mix(0.64, 0.32, closeStage) *
              (1.0 - midTransitionStage * 0.38);

            float legacyInnerRim = pow(fresnel, max(rimWidth * 1.5, 0.8));
            float legacyOuterRim = pow(fresnel, max(rimWidth * 0.8, 0.3));
            float legacyRim = (legacyInnerRim * 0.7 + legacyOuterRim * 0.3) * rimStrength;
            legacyRim *= 0.24 + 0.76 * max(ndl, 0.0);

            float sunRim = smoothstep(-edgeShadowSoftness, 0.58, ndl);
            float edgeRim = pow(fresnel, max(edgeLightWidth * 0.64, 2.6)) * sunRim;
            float innerNeedle = pow(fresnel, 34.0) * sunRim;
            float surfaceNeedle = pow(fresnel, 42.0) * (0.22 + 0.78 * dayW) * closeStage;
            float needleCut = 1.0 - smoothstep(0.986, 1.0, fresnel);
            float surfaceScatter =
              smoothstep(0.62, 0.93, fresnel) *
              (1.0 - smoothstep(0.992, 1.0, fresnel)) *
              sunRim *
              (0.34 + dayW * 0.66);
            float cloudSurface = smoothstep(0.38, 0.78, unifiedCloudSharp);
            float terrainSignal = max(dayTex.r, dayTex.g) - dayTex.b;
            float landAbsorption = smoothstep(0.06, 0.32, terrainSignal) * (1.0 - oceanMask);
            float surfaceRimResponse = clamp(
              0.42 + oceanMask * 1.72 + cloudSurface * 0.58 - landAbsorption * 0.32,
              0.3,
              2.18
            );
            float needleSurfaceResponse = clamp(
              0.3 + oceanMask * 2.18 + cloudSurface * 0.78 - landAbsorption * 0.24,
              0.2,
              2.55
            );
            vec3 rimCol =
              mix(vec3(0.035, 0.14, 0.34), vec3(0.16, 0.44, 0.82), legacyInnerRim) *
              legacyRim *
              0.26;
            vec3 edgeLight =
              edgeLightColor * edgeRim * edgeLightStrength * surfaceRimResponse * 0.34 +
              vec3(0.84, 0.94, 1.0) * innerNeedle * edgeNeedleStrength * (0.36 + oceanMask * 0.82 + cloudSurface * 0.34) * 0.12 +
              vec3(0.86, 0.96, 1.0) * surfaceNeedle * needleCut * edgeNeedleStrength * needleSurfaceResponse * 0.16;
            float surfaceAirVeil =
              smoothstep(0.42, 0.9, fresnel) *
              (1.0 - smoothstep(0.992, 1.0, fresnel)) *
              (0.22 + dayW * 0.78);
            vec3 lowerAtmosphere =
              mix(vec3(0.045, 0.16, 0.34), vec3(0.48, 0.68, 0.86), 0.36 + oceanMask * 0.34 + cloudSurface * 0.18) *
              surfaceAirVeil *
              (0.048 + closeStage * 0.048) *
              mix(1.0, 0.74, closeHorizonSurface);
            vec3 tangentSurfaceScatter =
              mix(vec3(0.06, 0.18, 0.34), vec3(0.44, 0.66, 0.82), 0.28 + oceanMask * 0.22 + cloudSurface * 0.18) *
              surfaceScatter *
              (0.062 + closeStage * 0.058) *
              (0.72 + surfaceRimResponse * 0.28) *
              mix(1.0, 0.68, closeHorizonSurface);

            float closeOnlyStage = smoothstep(0.74, 1.0, closeStage);
            vec3 color = dayCol + surfaceFill + oceanSpecular + cityCol + moonlitLand + moonlitClouds + twilightFill + terminatorCol + rimCol + edgeLight + lowerAtmosphere + tangentSurfaceScatter;
            vec3 highlightKnee = vec3(mix(0.84, 0.22, closeStage));
            float highlightDiscipline = mix(0.7, 4.0, closeStage);
            color = color / (1.0 + max(color - highlightKnee, vec3(0.0)) * highlightDiscipline);
            color *= mix(1.0, 0.62, closeOnlyStage);
            color = pow(max(color, vec3(0.0)), vec3(1.0));
            color *= 0.96 + (grain(gl_FragCoord.xy) - 0.5) * 0.026;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
    },
    [
      composition.earth.nightIntensity,
      composition.earth.specularStrength,
      composition.earth.cloudOpacity,
      composition.earth.rimStrength,
      composition.earth.rimWidth,
      composition.earth.edgeLightStrength,
      composition.earth.edgeLightWidth,
      composition.earth.edgeLightColor,
      composition.earth.edgeNeedleStrength,
      composition.earth.edgeShadowSoftness,
      composition.earth.terminatorSoftness,
      shouldUseTextureClouds,
      composition.light.ambientIntensity,
      composition.light.color,
      composition.light.fixedSunDir,
      composition.light.intensity,
      activeDayTexture,
      activeCloudDeckTexture,
      activeCloudTexture,
      activeDisplacementTexture,
      activeNormalTexture,
      activeNightTexture,
      cloudDeckTexture,
      displacementTexture,
      normalTexture
    ]
  );

  useFrame((_state, delta) => {
    if (!earth.current) {
      return;
    }

    if (sceneLightDirection) {
      lightDirection.copy(sceneLightDirection).normalize();
    } else {
      lightDirection.set(...composition.light.fixedSunDir).normalize();
    }
    const earthMaterial = earth.current.material as ShaderMaterial;
    earthMaterial.uniforms.lightDir.value.copy(lightDirection);
    earthMaterial.uniforms.sunIntensity.value = composition.light.intensity;
    earthMaterial.uniforms.ambient.value = composition.light.ambientIntensity;
    earthMaterial.uniforms.edge.value = composition.earth.terminatorSoftness;
    earthMaterial.uniforms.nightBoost.value = composition.earth.nightIntensity;
    earthMaterial.uniforms.specularStrength.value = composition.earth.specularStrength;
    earthMaterial.uniforms.cloudOpacity.value =
      shouldUseTextureClouds
        ? composition.earth.cloudOpacity * SURFACE_CLOUD_OPACITY_MULTIPLIER
        : 0;
    earthMaterial.uniforms.cloudShadowOpacity.value =
      shouldUseTextureClouds
        ? composition.earth.cloudOpacity * SURFACE_CLOUD_SHADOW_MULTIPLIER
        : 0;
    const progress = typeof window === "undefined" ? 1 : Math.min(1, Math.max(0, window.__MiraLithOpeningProgress ?? 0));
    if (!shouldLoadNightTexture && progress > 0.28) {
      setShouldLoadNightTexture(true);
    }
    earthMaterial.uniforms.closeStage.value = 1 - smoothstep(0.18, 0.86, progress);
    if (!paused && !reducedMotion && progress >= OPENING_FIELD_AUTO_ROTATE_START) {
      earthMaterial.uniforms.cloudOffset.value =
        (earthMaterial.uniforms.cloudOffset.value + delta * SURFACE_CLOUD_SCROLL_SPEED) % 1;
    }
    earthMaterial.uniforms.rimStrength.value = composition.earth.rimStrength;
    earthMaterial.uniforms.rimWidth.value = composition.earth.rimWidth;
    earthMaterial.uniforms.edgeLightStrength.value = composition.earth.edgeLightStrength;
    earthMaterial.uniforms.edgeLightWidth.value = composition.earth.edgeLightWidth;
    earthMaterial.uniforms.edgeLightColor.value.set(
      composition.earth.edgeLightColor[0],
      composition.earth.edgeLightColor[1],
      composition.earth.edgeLightColor[2]
    );
    earthMaterial.uniforms.edgeNeedleStrength.value = composition.earth.edgeNeedleStrength;
    earthMaterial.uniforms.edgeShadowSoftness.value = composition.earth.edgeShadowSoftness;

    earth.current.rotation.x = 0;
    earth.current.rotation.y = MathUtils.degToRad(composition.earth.yawDeg);
  });

  return (
    <mesh ref={earth} material={material}>
      <sphereGeometry args={[composition.earth.radius, earthSegments, earthSegments]} />
    </mesh>
  );
}
