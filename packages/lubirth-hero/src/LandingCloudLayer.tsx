"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  Color,
  CustomBlending,
  FrontSide,
  Group,
  MathUtils,
  Mesh,
  OneMinusSrcAlphaFactor,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  Texture,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingResolvedAssets } from "./types";
import { useLandingTexture } from "./useLandingTexture";

interface LandingCloudLayerProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
  referenceLook?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
  cloudDeckEnabled?: boolean;
}

interface CloudShellLayer {
  radius: number;
  opacity: number;
  offset: number;
  parallax: number;
  shadow: number;
  baseDepth: number;
  topCap: number;
  rimFocus: number;
  edgeBreak: number;
  highOnly?: boolean;
}

const lightDirection = new Vector3();
const color = new Color();
const CLOUD_SHELLS: CloudShellLayer[] = [
  { radius: 1.0064, opacity: 0.56, offset: 0, parallax: 0.00028, shadow: 0.13, baseDepth: 0.36, topCap: 0.14, rimFocus: 0.04, edgeBreak: 0.34 },
  { radius: 1.0108, opacity: 0.1, offset: 0.014, parallax: 0.00064, shadow: 0.06, baseDepth: 0.18, topCap: 0.26, rimFocus: 0.28, edgeBreak: 0.42, highOnly: true },
  { radius: 1.0146, opacity: 0.035, offset: 0.031, parallax: 0.00082, shadow: 0.025, baseDepth: 0.1, topCap: 0.18, rimFocus: 0.46, edgeBreak: 0.5, highOnly: true }
];
const CLOUD_TEXTURE_ART_OFFSET_X = 0.045;
const CLOUD_TEXTURE_ART_OFFSET_Y = 0.018;
const CLOUD_SCROLL_SPEED = 0.022;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createCloudMaterial(
  composition: LandingComposition,
  layer: CloudShellLayer,
  cloudTexture: Texture,
  cloudDeckTexture?: Texture
) {
  return new ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudTexture },
      cloudDeckMap: { value: cloudDeckTexture ?? cloudTexture },
      hasCloudDeckMap: { value: cloudDeckTexture ? 1 : 0 },
      cloudOffset: { value: 0 },
      closeStage: { value: 1 },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      shellOpacity: { value: layer.opacity },
      shellOffset: { value: layer.offset },
      parallaxScale: { value: layer.parallax },
      shadowStrength: { value: layer.shadow },
      baseDepth: { value: layer.baseDepth },
      topCapStrength: { value: layer.topCap },
      rimFocus: { value: layer.rimFocus },
      edgeBreakStrength: { value: layer.edgeBreak },
      debugBoost: { value: 0 },
      referenceLookStrength: { value: 0 },
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
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vFresnel;

      void main() {
        vUv = uv;
        vec3 localNormal = normalize(position);
        vec3 localUp = abs(localNormal.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 localTangentA = normalize(cross(localUp, localNormal));
        vec3 localTangentB = normalize(cross(localNormal, localTangentA));
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
      uniform sampler2D cloudMap;
      uniform sampler2D cloudDeckMap;
      uniform float hasCloudDeckMap;
      uniform float cloudOffset;
      uniform float closeStage;
      uniform float opacity;
      uniform float shellOpacity;
      uniform float shellOffset;
      uniform float parallaxScale;
      uniform float shadowStrength;
      uniform float baseDepth;
      uniform float topCapStrength;
      uniform float rimFocus;
      uniform float edgeBreakStrength;
      uniform float debugBoost;
      uniform float referenceLookStrength;
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vFresnel;

      float cloudPhase(float g, float mu) {
        float gg = g * g;
        return (1.0 - gg) / max(pow(1.0 + gg - 2.0 * g * mu, 1.5), 0.001);
      }

      float cloudRaw(vec2 uv) {
        vec2 wrappedUv = vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
        vec3 cloudRgb = texture2D(cloudMap, wrappedUv).rgb;
        float raw = dot(cloudRgb, vec3(0.2126, 0.7152, 0.0722));
        return pow(clamp(raw, 0.0, 1.0), 0.78);
      }

      float cloudMask(vec2 uv) {
        float raw = cloudRaw(uv);
        float wisps = smoothstep(0.012, 0.72, raw);
        float core = smoothstep(0.2, 0.9, raw);
        float brightCore = smoothstep(0.52, 1.0, raw);
        float softEdge = wisps * (1.0 - smoothstep(0.58, 1.0, raw));
        return clamp(wisps * 0.24 + core * 0.42 + brightCore * 0.18 + softEdge * 0.16, 0.0, 1.0);
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
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sunDirection = normalize(lightDir);
        float ndl = dot(n, sunDirection);
        float day = smoothstep(-0.18, 0.34, ndl);
        float night = 1.0 - smoothstep(-0.18, 0.2, ndl);
        float sunlitCloud = smoothstep(-0.02, 0.36, ndl);
        float nightCloud = 1.0 - smoothstep(-0.1, 0.18, ndl);
        float twilight = 1.0 - smoothstep(0.02, 0.42, abs(ndl));
        float rim = clamp(vFresnel, 0.0, 1.0);
        float limb = smoothstep(0.24, 0.78, rim) * (1.0 - smoothstep(0.9, 0.985, rim));
        float limbVolume = smoothstep(0.46, 0.88, rim) * (1.0 - smoothstep(0.972, 1.0, rim));
        float centerFade = 1.0 - smoothstep(0.86, 0.98, rim);
        float rimBand = smoothstep(0.52, 0.82, rim) * (1.0 - smoothstep(0.955, 1.0, rim));
        float shellFade =
          (0.22 + closeStage * 0.16 + debugBoost * 0.12) * centerFade +
          limb * (0.18 + closeStage * 0.24 + debugBoost * 0.18) +
          limbVolume * (0.08 + closeStage * 0.1 + debugBoost * 0.08);
        shellFade *= mix(1.0, 0.44 + rimBand * 0.92, rimFocus);

        vec2 baseUv = vec2(fract(vUv.x), clamp(vUv.y, 0.001, 0.999));
        vec2 wind = vec2(
          ${CLOUD_TEXTURE_ART_OFFSET_X.toFixed(3)} + shellOffset + cloudOffset,
          ${CLOUD_TEXTURE_ART_OFFSET_Y.toFixed(3)} + shellOffset * 0.37 + cloudOffset * 0.18
        );
        vec2 viewShear = vec2(dot(viewDirection, vWorldTangentA), dot(viewDirection, vWorldTangentB));
        vec2 sunShear = vec2(dot(sunDirection, vWorldTangentA), dot(sunDirection, vWorldTangentB));
        vec2 parallax = viewShear * parallaxScale * (0.18 + limb * 0.34);
        vec2 sunOffset = sunShear * 0.012;
        vec2 midUv = baseUv + wind + parallax * 0.03;
        vec2 detailStep = vec2(mix(0.00032, 0.00012, closeStage), mix(0.00016, 0.00008, closeStage));
        vec2 deckUv = vec2(
          fract(baseUv.x + wind.x),
          clamp(baseUv.y + wind.y, 0.001, 0.999)
        );
        vec4 deck = texture2D(cloudDeckMap, deckUv);
        float deckCoverage = clamp(deck.r, 0.0, 1.0) * hasCloudDeckMap;
        float deckThickness = pow(clamp(deck.g, 0.0, 1.0), 1.35) * hasCloudDeckMap;
        float deckAo = pow(clamp(deck.b, 0.0, 1.0), 1.25) * hasCloudDeckMap;
        float deckHighCap = pow(clamp(deck.a, 0.0, 1.0), 1.45) * hasCloudDeckMap;
        float deckWeatherMass = smoothstep(0.14, 0.78, deckCoverage + deckThickness * 0.22);
        float deckWeatherCore = smoothstep(0.32, 0.86, deckThickness) * smoothstep(0.14, 0.76, deckCoverage);

        float rawBottom = cloudRaw(baseUv + wind - parallax * 0.42);
        float rawMid = cloudRaw(midUv);
        float rawTop = cloudRaw(baseUv + wind + parallax * 0.38);
        float rawMidBlur = (
          cloudRaw(midUv + detailStep) +
          cloudRaw(midUv - detailStep) +
          cloudRaw(midUv + detailStep.yx) +
          cloudRaw(midUv - detailStep.yx)
        ) * 0.25;
        vec2 massStepA = vec2(0.0068, 0.0034);
        vec2 massStepB = vec2(0.018, 0.0086);
        float rawMassNear = (
          rawMid * 0.32 +
          (cloudRaw(midUv + massStepA) + cloudRaw(midUv - massStepA)) * 0.17 +
          (cloudRaw(midUv + massStepA.yx) + cloudRaw(midUv - massStepA.yx)) * 0.17
        );
        float rawMassWide = (
          rawMid * 0.22 +
          (cloudRaw(midUv + massStepB) + cloudRaw(midUv - massStepB)) * 0.14 +
          (cloudRaw(midUv + massStepB.yx) + cloudRaw(midUv - massStepB.yx)) * 0.14 +
          rawMassNear * 0.36
        );
        float rawMass = max(rawMassNear, rawMassWide * 0.92);
        float broadWeather = clamp(rawMassWide * 0.82 + rawMassNear * 0.18, 0.0, 1.0);
        float rawSharp = clamp(rawMid + (rawMid - rawMidBlur) * (0.2 + closeStage * 0.14), 0.0, 1.0);
        rawSharp = mix(rawSharp, rawMidBlur, 0.2 + (1.0 - closeStage) * 0.16);
        rawSharp = mix(rawSharp, broadWeather, 0.46 + closeStage * 0.08);
        float weatherMass = smoothstep(0.08, 0.58, broadWeather);
        float weatherCore = smoothstep(0.3, 0.78, broadWeather);
        float visibleCloudGate = smoothstep(
          0.055,
          0.54,
          max(rawMassNear * 0.62 + rawSharp * 0.38, rawMidBlur)
        );
        float deckInfluence = hasCloudDeckMap * visibleCloudGate;
        vec2 deckNormalStep = mix(vec2(0.00115, 0.00058), vec2(0.00062, 0.00031), referenceLookStrength);
        float deckThicknessX = pow(
          clamp(texture2D(cloudDeckMap, vec2(fract(deckUv.x + deckNormalStep.x), deckUv.y)).g, 0.0, 1.0),
          1.35
        ) * hasCloudDeckMap;
        float deckThicknessY = pow(
          clamp(texture2D(cloudDeckMap, vec2(deckUv.x, clamp(deckUv.y + deckNormalStep.y, 0.001, 0.999))).g, 0.0, 1.0),
          1.35
        ) * hasCloudDeckMap;
        vec3 cloudHeightNormal = normalize(vec3(
          (deckThickness - deckThicknessX) * 5.4,
          (deckThickness - deckThicknessY) * 5.4,
          1.0
        ));
        vec2 fineNormalStep = vec2(
          mix(0.00042, 0.00016, closeStage),
          mix(0.00021, 0.00008, closeStage)
        );
        float rawFineX = cloudRaw(vec2(fract(midUv.x + fineNormalStep.x), clamp(midUv.y, 0.001, 0.999)));
        float rawFineY = cloudRaw(vec2(fract(midUv.x), clamp(midUv.y + fineNormalStep.y, 0.001, 0.999)));
        float normalReliefMask = referenceLookStrength *
          visibleCloudGate *
          smoothstep(0.14, 0.72, max(rawSharp, deckCoverage + deckThickness * 0.32));
        vec3 fineHeightNormal = normalize(vec3(
          (rawSharp - rawFineX) * (1.45 + closeStage * 1.1),
          (rawSharp - rawFineY) * (1.45 + closeStage * 0.84),
          1.0
        ));
        cloudHeightNormal = normalize(vec3(
          cloudHeightNormal.xy * (1.0 + normalReliefMask * 0.52) +
            fineHeightNormal.xy * normalReliefMask * (1.25 + closeStage * 0.55),
          1.0
        ));
        vec3 sunTangent = normalize(vec3(
          dot(sunDirection, vWorldTangentA),
          dot(sunDirection, vWorldTangentB),
          max(ndl, 0.0) + 0.18
        ));
        float cloudTopLight = mix(1.0, clamp(dot(cloudHeightNormal, sunTangent), 0.0, 1.0), deckInfluence);
        float cloudNormalHighlight = smoothstep(0.54, 0.94, cloudTopLight) * normalReliefMask;
        float cloudSlopeShadow =
          smoothstep(0.18, 0.86, 1.0 - cloudTopLight) *
          max(deckThickness * deckInfluence, normalReliefMask * 0.46);
        float volumeJitter = noise2(gl_FragCoord.xy * 0.37 + baseUv * vec2(173.0, 89.0) + shellOffset * 31.0);
        float volumeColumn = 0.0;
        float volumeStep = mix(0.0022, 0.0011, closeStage) * (0.58 + limb * 0.42);
        for (int volumeStepIndex = 0; volumeStepIndex < 3; volumeStepIndex += 1) {
          float stepIndex = float(volumeStepIndex);
          float stepWeight = stepIndex + 0.58 + volumeJitter * 0.38;
          vec2 volumeUv = vec2(
            fract(midUv.x + sunShear.x * volumeStep * stepWeight),
            clamp(midUv.y + sunShear.y * volumeStep * stepWeight * 0.62, 0.001, 0.999)
          );
          vec4 volumeDeck = texture2D(cloudDeckMap, volumeUv);
          float volumeRaw = cloudRaw(volumeUv);
          float volumeDensity =
            smoothstep(0.16, 0.72, volumeRaw) * 0.48 +
            smoothstep(0.18, 0.78, volumeDeck.g) * hasCloudDeckMap * 0.52;
          volumeColumn += volumeDensity * (0.44 + stepIndex * 0.16);
        }
        float volumeMass = referenceLookStrength *
          visibleCloudGate *
          smoothstep(0.14, 0.82, max(max(rawSharp, deckThickness), volumeColumn * 0.36));
        float volumeTransmittance = exp(-volumeColumn * volumeMass * (0.92 + (1.0 - sunlitCloud) * 0.46));
        float volumeSelfShadow = (1.0 - volumeTransmittance) * volumeMass;
        float volumeForwardScatter =
          cloudPhase(0.32, clamp(dot(viewDirection, sunDirection), -1.0, 1.0)) *
          volumeMass *
          volumeTransmittance *
          sunlitCloud *
          0.28;
        weatherMass = max(weatherMass, deckWeatherMass * 0.18 * deckInfluence);
        weatherCore = max(weatherCore, deckWeatherCore * 0.26 * deckInfluence);
        float closeDeckCloud = closeStage *
          hasCloudDeckMap *
          smoothstep(0.26, 0.84, deckCoverage + deckThickness * 0.3) *
          smoothstep(0.12, 0.68, deckThickness) *
          (0.45 + visibleCloudGate * 0.55);
        weatherMass = max(weatherMass, deckWeatherMass * closeDeckCloud * 0.16);
        weatherCore = max(weatherCore, deckWeatherCore * closeDeckCloud * 0.14);
        float massGate = smoothstep(0.12, 0.42, rawMass);
        float photoWisps = smoothstep(0.08, 0.52, rawSharp) * (1.0 - smoothstep(0.7, 0.96, rawSharp)) * mix(0.22, 1.0, massGate);
        float photoCore = smoothstep(0.24, 0.74, rawSharp) * mix(0.2, 1.0, massGate);
        float photoBright = smoothstep(0.52, 0.9, rawSharp) * mix(0.1, 0.86, weatherMass);
        float bottom = cloudMask(baseUv + wind - parallax * 0.42);
        float naturalCoverage = clamp(rawMidBlur * 0.38 + rawMassNear * 0.34 + rawMassWide * 0.22 + rawSharp * 0.06, 0.0, 1.0);
        float massBody = weatherMass * 0.32 + weatherCore * 0.1 + photoCore * 0.34 + photoBright * 0.08 + naturalCoverage * 0.16;
        float mid = max(cloudMask(midUv) * 0.38 + naturalCoverage * 0.24, massBody);
        float top = cloudMask(baseUv + wind + parallax * 0.38) * 0.78 + naturalCoverage * 0.16;
        float shadowMask = cloudMask(baseUv + wind + sunOffset * (1.8 + limb * 0.9));
        float rawDensity = clamp(rawBottom * 0.08 + rawSharp * 0.5 + rawMass * 0.32 + rawTop * 0.1, 0.0, 1.0);
        float textureBody = clamp(rawSharp * 0.36 + rawMidBlur * 0.36 + rawMassNear * 0.18 + rawMassWide * 0.1, 0.0, 1.0);
        float textureMod = mix(0.62, 1.02, smoothstep(0.18, 0.76, textureBody));
        float density = clamp(bottom * 0.08 + mid * 0.82 + top * 0.1, 0.0, 1.0);
        float opaqueCore = max(smoothstep(0.34, 0.64, rawSharp) * massGate, weatherCore * 0.48);
        float baseMass = max(bottom * (0.94 + baseDepth * 0.22) - top * 0.44, 0.0) * limbVolume * baseDepth;
        float topCap = max(top - mid * 0.5, 0.0) * smoothstep(0.42, 0.9, rim) * topCapStrength;
        topCap += deckHighCap *
          sunlitCloud *
          topCapStrength *
          (0.055 + cloudTopLight * 0.085) *
          smoothstep(0.28, 0.82, deckCoverage) *
          deckInfluence;
        float layerSeparation = abs(top - bottom);
        float forwardStack = max(top - mid, 0.0);
        float backStack = max(mid - bottom, 0.0);
        float thickness = clamp(
          layerSeparation * 0.9 +
          forwardStack * 0.58 +
          backStack * 0.46 +
          weatherMass * 0.22 +
          weatherCore * 0.26 +
          photoCore * 0.32 +
          photoBright * 0.18 +
          limbVolume * mid * (0.5 + rimFocus * 0.22) +
          baseMass * 0.38,
          0.0,
          1.0
        );
        float selfShadow = clamp(
          shadowMask * shadowStrength * (0.74 + density * 0.42 + limbVolume * 0.28) + baseMass * 0.42,
          0.0,
          0.62
        );
        selfShadow = clamp(
          selfShadow +
          deckAo * 0.12 * deckInfluence +
          deckThickness * deckWeatherCore * 0.045 * deckInfluence,
          0.0,
          0.64
        );
        selfShadow = clamp(
          selfShadow + cloudSlopeShadow * 0.14,
          0.0,
          0.64
        );
        selfShadow = clamp(
          selfShadow +
          referenceLookStrength * (
            deckAo * 0.12 * deckInfluence +
            cloudSlopeShadow * 0.22 +
            normalReliefMask * (1.0 - cloudTopLight) * 0.08 +
            volumeSelfShadow * 0.24 +
            weatherCore * 0.045
          ),
          0.0,
          0.66
        );
        float light = mix(0.08, 1.08, sunlitCloud) * (1.0 - selfShadow) + twilight * 0.06 + limb * sunlitCloud * 0.1;

        vec3 cloudShadow = mix(vec3(0.24, 0.30, 0.40), vec3(0.48, 0.54, 0.64), max(mid, weatherMass * 0.72));
        vec3 cloudLit = mix(
          vec3(0.54, 0.62, 0.70),
          vec3(0.78, 0.82, 0.82),
          smoothstep(0.08, 0.82, max(rawTop, rawSharp * 0.58 + rawMidBlur * 0.22))
        );
        vec3 cloudBase = mix(cloudShadow, cloudLit, clamp(sunlitCloud * (0.42 + weatherCore * 0.08) + top * 0.14 + photoBright * 0.08, 0.0, 1.0));
        cloudBase += vec3(0.036, 0.042, 0.048) * clamp((rawSharp - rawMidBlur) * (0.12 + closeStage * 0.06) * weatherMass, 0.0, 0.04) * sunlitCloud;
        cloudBase *= mix(0.82, 1.0, smoothstep(0.22, 0.82, textureBody));
        vec3 warmEdge = vec3(1.0, 0.62, 0.28) * twilight * (0.06 + thickness * 0.06);
        vec3 blueNight = vec3(0.018, 0.055, 0.13) * nightCloud * (0.07 + thickness * 0.12);
        vec3 finalColor =
          cloudBase * lightColor * light * (0.72 + thickness * 0.5 + debugBoost * 0.2) +
          warmEdge +
          blueNight;
        float cloudUnderside = clamp(
          weatherMass * 0.36 +
          weatherCore * 0.28 +
          selfShadow * 0.42 +
          deckAo * 0.26 * deckInfluence +
          deckThickness * deckWeatherCore * 0.12 * deckInfluence +
          limbVolume * 0.18,
          0.0,
          1.0
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.62, 0.70, 0.82),
          cloudUnderside * mix(0.16, 0.28, closeStage) * mix(1.0, 0.52, sunlitCloud)
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.58, 0.66, 0.80),
          referenceLookStrength * cloudUnderside * 0.24
        );
        float thickCloudRelief = clamp(
          weatherCore * 0.42 +
          opaqueCore * 0.32 +
          selfShadow * 0.36 +
          deckThickness * deckWeatherCore * 0.18 * deckInfluence +
          deckAo * 0.1 * deckInfluence,
          0.0,
          1.0
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.72, 0.78, 0.88),
          thickCloudRelief * mix(0.16, 0.08, sunlitCloud)
        );
        finalColor += vec3(0.58, 0.66, 0.74) *
          cloudTopLight *
          deckHighCap *
          sunlitCloud *
          deckInfluence *
          (0.028 + closeStage * 0.022);
        finalColor += vec3(0.86, 0.92, 0.96) *
          referenceLookStrength *
          deckHighCap *
          sunlitCloud *
          deckInfluence *
          (0.03 + closeStage * 0.024);
        finalColor += vec3(0.72, 0.84, 0.98) *
          cloudNormalHighlight *
          sunlitCloud *
          (0.045 + closeStage * 0.04);
        finalColor += vec3(0.68, 0.82, 1.0) *
          volumeForwardScatter *
          (0.08 + closeStage * 0.08);
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.68, 0.76, 0.88),
          cloudSlopeShadow * (0.12 + referenceLookStrength * 0.055) + volumeSelfShadow * 0.04
        );
        float closeCloudReadability = max(
          closeStage * visibleCloudGate *
            smoothstep(0.18, 0.58, max(max(rawSharp, rawMassNear), weatherMass)),
          closeDeckCloud * 0.82
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(1.12, 1.13, 1.11) + vec3(0.055, 0.06, 0.064) * sunlitCloud,
          closeCloudReadability * 0.09
        );
        float daylightCloudLift =
          sunlitCloud *
          smoothstep(0.24, 0.82, max(max(weatherMass, weatherCore), closeCloudReadability)) *
          (0.04 + closeCloudReadability * 0.1 + topCap * 0.08);
        finalColor += vec3(0.84, 0.88, 0.86) * daylightCloudLift;
        finalColor = mix(
          finalColor,
          vec3(0.76, 0.82, 0.82),
          closeCloudReadability * sunlitCloud * 0.08
        );
        float nightCloudDim = nightCloud * (1.0 - twilight * 0.48) * (0.48 + closeStage * 0.12);
        finalColor *= mix(1.0, 0.48, nightCloudDim);
        finalColor += vec3(0.56, 0.66, 0.78) * limbVolume * density * thickness * (0.04 + sunlitCloud * 0.08);
        finalColor += vec3(0.72, 0.8, 0.88) * topCap * sunlitCloud * (0.1 + debugBoost * 0.08);
        finalColor = mix(finalColor, finalColor * vec3(0.66, 0.74, 0.86), clamp(baseMass * (0.78 - debugBoost * 0.18), 0.0, 0.58));
        finalColor *= mix(0.88 + closeStage * 0.04, 1.0, debugBoost);

        float edgeTrim = 1.0 - smoothstep(0.86, 0.98, rim);
        float extremeGrazing = smoothstep(0.82, 0.99, rim);
        float edgeNoise =
          noise2(baseUv * vec2(72.0, 31.0) + vec2(shellOffset * 41.0, shellOffset * 17.0)) * 0.62 +
          noise2(baseUv * vec2(151.0, 67.0) + vec2(shellOffset * 19.0, shellOffset * 53.0)) * 0.38;
        float edgeBreakup = smoothstep(0.0, 1.0, edgeNoise + density * 0.12 - extremeGrazing * 0.035);
        float brokenEdge = mix(1.0, mix(0.78, 1.0, edgeBreakup), extremeGrazing * edgeBreakStrength * 0.62 * (1.0 - debugBoost * 0.18));
        float softDensityFeather = smoothstep(-0.04, 0.46, rawDensity + rawMidBlur * 0.18 + weatherMass * 0.16 + closeDeckCloud * 0.08);
        float cloudLayerSeparation = clamp(
          shellOffset * 9.0 +
          deckThickness * deckInfluence * 0.24 +
          selfShadow * 0.16 +
          limbVolume * 0.1,
          0.0,
          1.0
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.72, 0.8, 0.9),
          cloudLayerSeparation * (0.055 + closeStage * 0.075) * (1.0 - sunlitCloud * 0.3)
        );
        finalColor += vec3(0.46, 0.52, 0.58) * cloudTopLight * cloudLayerSeparation * sunlitCloud * 0.028;
        float alpha = (
          photoWisps * 0.06 +
          weatherMass * 0.32 +
          weatherCore * 0.14 +
          density * 0.22 +
          thickness * 0.16 +
          opaqueCore * 0.22 +
          closeCloudReadability * 0.22 +
          closeDeckCloud * 0.22 +
          limbVolume * density * 0.08
        ) *
          softDensityFeather *
          textureMod *
          opacity *
          shellOpacity *
          (shellFade + closeStage * 0.3) *
          brokenEdge *
          mix(0.58, 1.0, edgeTrim) *
          mix(0.94, 1.16, closeStage) *
          mix(1.0, 0.58, nightCloud * (1.0 - twilight * 0.42)) *
          mix(1.0, 1.82, debugBoost);
        alpha *= mix(
          1.0,
          1.32,
          referenceLookStrength * smoothstep(0.18, 0.72, max(weatherMass, thickness))
        );

        if (alpha < 0.00008) {
          discard;
        }

        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, mix(0.38, 0.72, debugBoost)));
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

export function LandingCloudLayer({
  composition,
  assets,
  quality,
  sceneLightDirection,
  emphasis = false,
  referenceLook = false,
  reducedMotion,
  paused,
  cloudDeckEnabled = true
}: LandingCloudLayerProps) {
  const cloud = useRef<Mesh>(null);
  const cloudGroup = useRef<Group>(null);
  const cloudOffset = useRef(0);
  const { texture: cloudTexture, failed: cloudTextureFailed } = useLandingTexture(assets.earthClouds?.src, {
    colorSpace: assets.earthClouds?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const { texture: cloudDeckTexture } = useLandingTexture(
    cloudDeckEnabled && quality.tier !== "low" && quality.tier !== "fallback" ? assets.earthCloudDeck?.src : undefined,
    {
      colorSpace: assets.earthCloudDeck?.colorSpace ?? "linear",
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping
    }
  );
  const activeCloudShells = useMemo(
    () => CLOUD_SHELLS.filter((layer) => !layer.highOnly || quality.tier === "high" || quality.tier === "medium" || emphasis),
    [emphasis, quality.tier]
  );
  const materials = useMemo(
    () => cloudTexture ? activeCloudShells.map((layer) => createCloudMaterial(composition, layer, cloudTexture, cloudDeckTexture ?? undefined)) : [],
    [activeCloudShells, cloudDeckTexture, cloudTexture, composition]
  );
  const enabled =
    composition.earth.useClouds &&
    composition.earth.cloudOpacity > 0 &&
    quality.tier !== "fallback" &&
    Boolean(cloudTexture) &&
    !cloudTextureFailed;

  useEffect(() => {
    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [materials]);

  useFrame((_state, delta) => {
    if (!cloudGroup.current || !enabled || !cloudTexture) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    if (!paused && !reducedMotion) {
      const nearStaticCloudDrift = 0.04 + (1 - closeStage) * 0.96;
      cloudOffset.current = (cloudOffset.current + delta * CLOUD_SCROLL_SPEED * nearStaticCloudDrift) % 1;
    }
    if (sceneLightDirection) {
      lightDirection.copy(sceneLightDirection).normalize();
    } else {
      lightDirection.set(...composition.light.fixedSunDir).normalize();
    }

    cloudGroup.current.rotation.set(0, 0, 0);

    cloudGroup.current.children.forEach((child, index) => {
      const cloudMaterial = (child as Mesh).material as ShaderMaterial;
      child.rotation.y = MathUtils.degToRad(composition.earth.yawDeg);
      child.rotation.x = 0;
      child.rotation.z = 0;
      cloudMaterial.uniforms.cloudMap.value = cloudTexture;
      cloudMaterial.uniforms.cloudDeckMap.value = cloudDeckTexture ?? cloudTexture;
      cloudMaterial.uniforms.hasCloudDeckMap.value = cloudDeckTexture ? 1 : 0;
      cloudMaterial.uniforms.cloudOffset.value = cloudOffset.current;
      cloudMaterial.uniforms.closeStage.value = closeStage;
      cloudMaterial.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
      cloudMaterial.uniforms.debugBoost.value = emphasis ? 1 : 0;
      cloudMaterial.uniforms.referenceLookStrength.value = referenceLook ? 1 : 0;
      cloudMaterial.uniforms.lightDir.value.copy(lightDirection);
    });
  });

  if (!enabled) {
    return null;
  }

  return (
    <group ref={cloudGroup}>
      {activeCloudShells.map((layer, index) => (
        <mesh key={index} ref={index === 0 ? cloud : undefined} material={materials[index]} renderOrder={3 + index}>
          <sphereGeometry
            args={[
              composition.earth.radius * layer.radius,
              quality.tier === "high" ? Math.max(288, quality.segments * 4) : quality.tier === "medium" ? Math.max(160, quality.segments * 3) : 48,
              quality.tier === "high" ? 180 : quality.tier === "medium" ? 96 : 32
            ]}
          />
        </mesh>
      ))}
    </group>
  );
}
