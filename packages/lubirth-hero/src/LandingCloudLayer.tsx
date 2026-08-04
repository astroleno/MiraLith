"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  ClampToEdgeWrapping,
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
import {
  HOME_CLOUD_FIELD_OFFSET_X,
  HOME_CLOUD_FIELD_OFFSET_Y,
  HOME_CLOUD_FIELD_SCROLL_SPEED,
  HOME_CLOUD_SHELL_RADIUS
} from "./homeCloudField";
import {
  resolveCloudVolumeV3Profile,
  type CloudVolumeV3Profile
} from "./landingCloudVolumeV3Policy";
import type {
  LandingCloseAtmosphereTuning,
  LandingCloudMode,
  LandingCloudVolumeModel,
  LandingComposition,
  LandingResolvedAssets
} from "./types";
import { useLandingTexture } from "./useLandingTexture";

export { resolveCloudVolumeV3Profile, type CloudVolumeV3Profile };

interface LandingCloudLayerProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
  referenceLook?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
  cloudOffsetRef?: MutableRefObject<number>;
  cloudDeckEnabled?: boolean;
  cloudMode?: LandingCloudMode;
  cloudVolumeModel?: LandingCloudVolumeModel;
  closeAtmosphereTuning?: LandingCloseAtmosphereTuning;
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
  limbFadeStart: number;
  limbFadeEnd: number;
  highOnly?: boolean;
}

const lightDirection = new Vector3();
const color = new Color();
const STANDARD_CLOUD_SHELLS: readonly CloudShellLayer[] = [
  { radius: 1.0064, opacity: 0.5, offset: 0, parallax: 0.00028, shadow: 0.11, baseDepth: 0.34, topCap: 0.14, rimFocus: 0.04, edgeBreak: 0.34, limbFadeStart: 0.72, limbFadeEnd: 0.91 },
  { radius: 1.0108, opacity: 0.08, offset: 0.014, parallax: 0.00064, shadow: 0.05, baseDepth: 0.16, topCap: 0.24, rimFocus: 0.28, edgeBreak: 0.42, limbFadeStart: 0.66, limbFadeEnd: 0.86, highOnly: true },
  { radius: 1.0146, opacity: 0.025, offset: 0.031, parallax: 0.00082, shadow: 0.02, baseDepth: 0.09, topCap: 0.16, rimFocus: 0.46, edgeBreak: 0.5, limbFadeStart: 0.54, limbFadeEnd: 0.76, highOnly: true }
];
const REFERENCE_CLOUD_SHELLS: readonly CloudShellLayer[] = [
  { ...STANDARD_CLOUD_SHELLS[0], opacity: 0.78, shadow: 0.16, baseDepth: 0.4, topCap: 0.18 },
  { ...STANDARD_CLOUD_SHELLS[1], opacity: 0.22, shadow: 0.08, baseDepth: 0.22, topCap: 0.32 },
  { ...STANDARD_CLOUD_SHELLS[2], opacity: 0.09, shadow: 0.035, baseDepth: 0.12, topCap: 0.24 }
];
const CLOUD_TEXTURE_ART_OFFSET_X = 0.045;
const CLOUD_TEXTURE_ART_OFFSET_Y = 0.018;
const CLOUD_SCROLL_SPEED = 0.022;
const HOME_LITE_CLOUD_HEIGHT_SCALE = 0.0045;
const HOME_LITE_CLOUD_RELIEF_UV_SCALE = 0.0022;
const HOME_LITE_CLOUD_SHELL: CloudShellLayer = {
  radius: HOME_CLOUD_SHELL_RADIUS,
  opacity: 0.66,
  offset: 0,
  parallax: 0,
  shadow: 0.18,
  baseDepth: 0.22,
  topCap: 0.12,
  rimFocus: 0.12,
  edgeBreak: 0,
  limbFadeStart: 0.82,
  limbFadeEnd: 0.99
};

export function resolveLandingCloudShells(
  qualityTier: QualityProfile["tier"],
  referenceLook: boolean,
  cloudVolumeModel: LandingCloudVolumeModel = "legacy"
): readonly CloudShellLayer[] {
  if (qualityTier === "low" || qualityTier === "fallback") {
    return [];
  }

  const shells = referenceLook ? REFERENCE_CLOUD_SHELLS : STANDARD_CLOUD_SHELLS;
  if (referenceLook && qualityTier === "high" && cloudVolumeModel === "v3") {
    return shells.slice(0, 1);
  }

  if (referenceLook && qualityTier !== "high") {
    return shells.slice(0, 1);
  }

  return shells.filter((layer) => !layer.highOnly || qualityTier === "high" || qualityTier === "medium");
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function readLiteCloudReliefLightingStrength() {
  if (typeof window === "undefined") {
    return 1;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("visualTest") === "pixels" && params.get("cloudReliefLighting") === "off" ? 0 : 1;
}

function readLiteCloudDiagnosticMode() {
  if (typeof window === "undefined") {
    return 0;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("visualTest") === "pixels" && params.get("cloudDiagnostic") === "mask" ? 1 : 0;
}

declare global {
  interface Window {
    __MiraLithLuBirthCloudShellCount?: number;
    __MiraLithLuBirthCloudFieldTexture?: string;
    __MiraLithLuBirthCloudShellOffset?: number;
    __MiraLithLuBirthCloudShellTextureUuid?: string;
    __MiraLithLuBirthCloudHeightScale?: number;
    __MiraLithLuBirthCloudReliefSamples?: number;
    __MiraLithLuBirthCloudReliefLightingStrength?: number;
    __MiraLithLuBirthCloudDiagnosticMode?: number;
  }
}

function createLiteCloudMaterial(
  composition: LandingComposition,
  cloudFieldTexture: Texture,
  reliefLightingStrength: number,
  diagnosticMode: number
) {
  return new ShaderMaterial({
    uniforms: {
      cloudFieldMap: { value: cloudFieldTexture },
      cloudOffset: { value: 0 },
      heightScale: { value: composition.earth.radius * HOME_LITE_CLOUD_HEIGHT_SCALE },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      debugBoost: { value: 0 },
      reliefLightingStrength: { value: reliefLightingStrength },
      diagnosticMode: { value: diagnosticMode },
      lightDir: {
        value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone()
      },
      lightColor: {
        value: color.setRGB(
          composition.light.color[0],
          composition.light.color[1],
          composition.light.color[2]
        ).clone()
      }
    },
    vertexShader: `
      uniform sampler2D cloudFieldMap;
      uniform float cloudOffset;
      uniform float heightScale;
      uniform vec3 lightDir;

      varying vec2 vUv;
      varying vec3 vTangentLight;
      varying vec3 vTangentView;
      varying vec2 vSunOffset;
      varying float vViewFacing;
      varying float vDaylight;

      void main() {
        vUv = uv;
        vec3 localNormal = normalize(position);
        vec2 cloudUv = vec2(
          fract(uv.x + ${HOME_CLOUD_FIELD_OFFSET_X.toFixed(3)} + cloudOffset),
          clamp(uv.y + ${HOME_CLOUD_FIELD_OFFSET_Y.toFixed(3)}, 0.001, 0.999)
        );
        vec4 vertexCloudField = texture2D(cloudFieldMap, cloudUv);
        float vertexCoverage = smoothstep(0.12, 0.82, vertexCloudField.r);
        float vertexHeight = vertexCoverage * vertexCloudField.a;
        vec3 displacedPosition = position + localNormal * heightScale * vertexHeight;
        float longitude = uv.x * 6.28318530718;
        vec3 localEast = vec3(sin(longitude), 0.0, cos(longitude));
        vec3 localNorth = normalize(cross(localNormal, localEast));
        vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
        mat3 worldRotation = mat3(modelMatrix);
        vec3 worldNormal = normalize(worldRotation * localNormal);
        vec3 worldEast = normalize(worldRotation * localEast);
        vec3 worldNorth = normalize(worldRotation * localNorth);
        vec3 sunDirection = normalize(lightDir);
        vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
        vTangentLight = vec3(
          dot(sunDirection, worldEast),
          dot(sunDirection, worldNorth),
          dot(sunDirection, worldNormal)
        );
        vTangentView = vec3(
          dot(viewDirection, worldEast),
          dot(viewDirection, worldNorth),
          dot(viewDirection, worldNormal)
        );
        vSunOffset = vTangentLight.xy / max(vTangentLight.z, 0.08);
        float sunOffsetLength = length(vSunOffset);
        if (sunOffsetLength > 4.5) {
          vSunOffset *= 4.5 / sunOffsetLength;
        }
        vDaylight = smoothstep(-0.12, 0.3, vTangentLight.z);
        vViewFacing = max(vTangentView.z, 0.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudFieldMap;
      uniform float cloudOffset;
      uniform float opacity;
      uniform float debugBoost;
      uniform float reliefLightingStrength;
      uniform float diagnosticMode;
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec2 vUv;
      varying vec3 vTangentLight;
      varying vec3 vTangentView;
      varying vec2 vSunOffset;
      varying float vViewFacing;
      varying float vDaylight;

      void main() {
        vec2 cloudUv = vec2(
          fract(vUv.x + ${HOME_CLOUD_FIELD_OFFSET_X.toFixed(3)} + cloudOffset),
          clamp(vUv.y + ${HOME_CLOUD_FIELD_OFFSET_Y.toFixed(3)}, 0.001, 0.999)
        );
        vec4 baseCloudField = texture2D(cloudFieldMap, cloudUv);
        float grazingView = 1.0 - clamp(vViewFacing, 0.0, 1.0);
        vec2 reliefDirection = vTangentView.xy / max(vTangentView.z, 0.42);
        float reliefPerspective = mix(
          0.42,
          1.0,
          smoothstep(0.04, 0.88, grazingView)
        );
        float reliefDepth = (0.28 + baseCloudField.a * 0.72) * reliefPerspective;
        vec2 reliefUv = vec2(
          fract(cloudUv.x - reliefDirection.x * ${HOME_LITE_CLOUD_RELIEF_UV_SCALE.toFixed(4)} * reliefDepth),
          clamp(
            cloudUv.y - reliefDirection.y * ${(HOME_LITE_CLOUD_RELIEF_UV_SCALE * 0.5).toFixed(4)} * reliefDepth,
            0.001,
            0.999
          )
        );
        vec4 reliefField = texture2D(cloudFieldMap, reliefUv);
        float reliefHeight = smoothstep(
          0.1,
          0.82,
          max(baseCloudField.a, reliefField.a)
        );
        float parallaxWeight = mix(
          0.76,
          0.98,
          smoothstep(0.08, 0.92, grazingView)
        ) * mix(0.92, 1.0, reliefHeight);
        vec4 cloudField = mix(baseCloudField, reliefField, parallaxWeight);
        if (cloudField.r < 0.12) {
          discard;
        }
        float coverage = clamp((cloudField.r - 0.12) * 1.14, 0.0, 1.0);
        float thickness = cloudField.a;

        if (diagnosticMode > 0.5) {
          float coreMask = smoothstep(0.34, 0.62, coverage) *
            smoothstep(0.2, 0.54, thickness);
          gl_FragColor = coreMask > 0.34
            ? vec4(1.0, 0.0, 1.0, 1.0)
            : vec4(0.0, 1.0, 1.0, 1.0);
          return;
        }

        vec2 tangentNormal = cloudField.gb * 2.0 - 1.0;
        float tangentLengthSquared = min(dot(tangentNormal, tangentNormal), 0.96);
        float normalZ = sqrt(max(1.0 - tangentLengthSquared, 0.04));
        float sunPathLength = length(vSunOffset);
        vec2 sunUvDirection = vSunOffset / max(sunPathLength, 0.001);
        float sunPathFactor = smoothstep(0.15, 4.5, sunPathLength);
        float occlusionDistance = mix(0.0012, 0.0068, sunPathFactor) *
          (0.48 + thickness * 0.92);
        vec2 occlusionUv = vec2(
          fract(reliefUv.x - sunUvDirection.x * occlusionDistance),
          clamp(reliefUv.y - sunUvDirection.y * occlusionDistance * 0.5, 0.001, 0.999)
        );
        vec4 occlusionField = texture2D(cloudFieldMap, occlusionUv);

        float geometricLight = clamp(vTangentLight.z, 0.0, 1.0);
        float shapedLight = max(dot(vec3(tangentNormal, normalZ), vTangentLight), 0.0);
        float sunVisibility = smoothstep(-0.02, 0.42, vTangentLight.z);
        float visibleShapedLight = shapedLight * mix(0.16, 1.0, sunVisibility);
        float currentOpticalHeight = cloudField.r * cloudField.a;
        float occluderOpticalHeight = occlusionField.r * occlusionField.a;
        float sunClearance = mix(0.008, 0.1, geometricLight);
        float castShadow = smoothstep(
          0.0,
          0.22,
          occluderOpticalHeight - currentOpticalHeight - sunClearance
        ) * sunVisibility;
        float opticalShadow = occluderOpticalHeight *
          mix(0.12, 0.34, sunPathFactor) * sunVisibility;
        float selfOcclusion = clamp(
          opticalShadow + castShadow * 0.42 * reliefLightingStrength,
          0.0,
          0.58
        );

        vec3 shadowColor = vec3(0.3, 0.36, 0.46);
        vec3 daylightColor = vec3(0.86, 0.9, 0.96);
        float lightShape = clamp(sunVisibility * 0.48 + visibleShapedLight * 0.52, 0.0, 1.0);
        vec3 cloudColor = mix(shadowColor, daylightColor, lightShape);
        cloudColor *= lightColor * (0.44 + geometricLight * 0.18 + visibleShapedLight * 0.26);
        cloudColor *= 1.0 - selfOcclusion;
        cloudColor *= mix(0.18, 1.0, sunVisibility);
        cloudColor += vec3(0.012, 0.024, 0.045) * (1.0 - sunVisibility) * thickness;

        float cloudCoreMask = smoothstep(0.26, 0.7, coverage) *
          smoothstep(0.2, 0.68, thickness);
        float normalRelief = clamp(visibleShapedLight - geometricLight, -0.46, 0.46);
        float reliefSunlight = sunVisibility;
        float reliefTopLight = max(normalRelief, 0.0) *
          cloudCoreMask * reliefSunlight * reliefLightingStrength;
        float reliefSideShade = max(-normalRelief, 0.0) *
          cloudCoreMask * (0.42 + reliefSunlight * 0.58) * reliefLightingStrength;
        cloudColor *= 1.0 + reliefTopLight * 1.05;
        cloudColor *= 1.0 - reliefSideShade * 0.85;
        cloudColor += daylightColor * reliefTopLight * thickness * 0.12;
        float densityShade = smoothstep(0.42, 0.9, thickness) *
          (1.0 - visibleShapedLight) * cloudCoreMask;
        cloudColor *= 1.0 - densityShade * 0.16 * reliefLightingStrength;

        float rim = 1.0 - clamp(vViewFacing, 0.0, 1.0);
        float thickCloudCore = smoothstep(0.34, 0.78, thickness) *
          smoothstep(0.26, 0.76, coverage);
        float limbFadeStart = mix(
          ${HOME_LITE_CLOUD_SHELL.limbFadeStart.toFixed(2)},
          0.86,
          thickCloudCore
        );
        float limbFadeEnd = mix(0.96, 0.985, thickCloudCore);
        float limbFade = 1.0 - smoothstep(limbFadeStart, limbFadeEnd, rim);
        float cloudInterior = smoothstep(0.18, 0.62, coverage) *
          smoothstep(0.12, 0.54, thickness);
        float alpha = coverage * opacity * (0.28 + thickness * 0.48) * limbFade;
        alpha *= mix(0.62, 1.0, cloudInterior);
        alpha *= 0.12 + sunVisibility * 0.88;
        float rimMask = smoothstep(0.7, 0.96, rim);
        float rimIllumination = smoothstep(0.03, 0.34, max(geometricLight, visibleShapedLight));
        alpha *= 1.0 - rimMask * (1.0 - rimIllumination) * 0.86;
        alpha *= 1.0 - rimMask * 0.3;
        cloudColor *= mix(0.82, 1.0, cloudInterior) * (1.0 - rimMask * 0.12);
        alpha *= 1.0 + debugBoost * 0.28;

        if (alpha < 0.002) {
          discard;
        }

        gl_FragColor = vec4(clamp(cloudColor, vec3(0.0), vec3(1.0)), clamp(alpha, 0.0, 0.68));
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
      limbFadeStart: { value: layer.limbFadeStart },
      limbFadeEnd: { value: layer.limbFadeEnd },
      debugBoost: { value: 0 },
      referenceLookStrength: { value: 0 },
      cloudVolumeShadowStrength: { value: 0 },
      cloudVolumeV3Strength: { value: 0 },
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
      uniform float limbFadeStart;
      uniform float limbFadeEnd;
      uniform float debugBoost;
      uniform float referenceLookStrength;
      uniform float cloudVolumeShadowStrength;
      uniform float cloudVolumeV3Strength;
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
        float shellLimbFade = 1.0 - smoothstep(limbFadeStart, limbFadeEnd, rim);
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
        float referenceParallaxAttenuation = mix(1.0, 0.06, referenceLookStrength);
        vec2 parallax =
          viewShear *
          parallaxScale *
          referenceParallaxAttenuation *
          (0.18 + limb * 0.34);
        vec2 sunOffset = sunShear * mix(0.012, 0.0016, referenceLookStrength);
        vec2 midUv = baseUv + wind + parallax * 0.03;
        vec2 detailStep = vec2(mix(0.00042, 0.00022, closeStage), mix(0.00021, 0.00012, closeStage));
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
        float rawSharp = clamp(rawMid + (rawMid - rawMidBlur) * (0.08 + closeStage * 0.06), 0.0, 1.0);
        rawSharp = mix(rawSharp, rawMidBlur, 0.16 + (1.0 - closeStage) * 0.08);
        rawSharp = mix(rawSharp, broadWeather, 0.18 + closeStage * 0.04);
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
          smoothstep(0.14, 0.72, max(rawSharp, deckCoverage + deckThickness * 0.32)) *
          1.08;
        vec3 fineHeightNormal = normalize(vec3(
          (rawSharp - rawFineX) * (0.85 + closeStage * 0.5),
          (rawSharp - rawFineY) * (0.85 + closeStage * 0.4),
          1.0
        ));
        cloudHeightNormal = normalize(vec3(
          cloudHeightNormal.xy * (1.0 + normalReliefMask * 0.52) +
            fineHeightNormal.xy * normalReliefMask * (0.72 + closeStage * 0.28),
          1.0
        ));
        vec3 sunTangent = normalize(vec3(
          dot(sunDirection, vWorldTangentA),
          dot(sunDirection, vWorldTangentB),
          max(ndl, 0.0) + 0.18
        ));
        float cloudTopLight = mix(1.0, clamp(dot(cloudHeightNormal, sunTangent), 0.0, 1.0), deckInfluence);
        float cloudNormalHighlight = smoothstep(0.62, 0.98, cloudTopLight) * normalReliefMask * 0.86;
        float cloudSlopeShadow =
          smoothstep(0.18, 0.86, 1.0 - cloudTopLight) *
          max(deckThickness * deckInfluence, normalReliefMask * 0.3);
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
        float v3Enabled = step(0.5, cloudVolumeV3Strength) * referenceLookStrength;
        float v3SunColumn = 0.0;
        if (v3Enabled > 0.0) {
          float v3Step = mix(0.0038, 0.0019, closeStage) * (0.72 + limb * 0.34);
          for (int v3StepIndex = 0; v3StepIndex < 5; v3StepIndex += 1) {
            float v3T = (float(v3StepIndex) + 0.5 + volumeJitter * 0.22) / 5.0;
            vec2 v3Uv = vec2(
              fract(midUv.x + sunShear.x * v3Step * v3T * 5.0),
              clamp(midUv.y + sunShear.y * v3Step * v3T * 3.1, 0.001, 0.999)
            );
            vec4 v3Deck = texture2D(cloudDeckMap, v3Uv);
            float v3Raw = cloudRaw(v3Uv);
            float v3Density =
              smoothstep(0.07, 0.62, v3Raw) * 0.46 +
              smoothstep(0.09, 0.66, v3Deck.g) * hasCloudDeckMap * 0.58;
            v3SunColumn += v3Density * mix(0.62, 1.18, v3T);
          }
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
        float referenceCloudSea =
          referenceLookStrength *
          visibleCloudGate *
          smoothstep(
            0.20,
            0.62,
            rawMassWide * 0.52 +
              rawMidBlur * 0.34 +
              deckCoverage * deckInfluence * 0.34 +
              deckThickness * deckInfluence * 0.20 +
              rawSharp * 0.14
          );
        float referenceGyreNoise =
          noise2(baseUv * vec2(8.0, 4.6) + vec2(shellOffset * 13.0, shellOffset * 5.0)) * 0.58 +
          noise2(baseUv * vec2(17.0, 9.0) + vec2(shellOffset * 29.0, shellOffset * 11.0)) * 0.42;
        float referenceDarkGyre =
          referenceCloudSea *
          smoothstep(0.46, 0.84, referenceGyreNoise) *
          smoothstep(0.12, 0.72, weatherMass + rawMassNear * 0.28);
        float referenceSoftShadow =
          referenceCloudSea *
          smoothstep(0.36, 0.78, 1.0 - cloudTopLight) *
          (0.34 + referenceGyreNoise * 0.42);
        float referenceSoftDeck =
          referenceLookStrength *
          visibleCloudGate *
          smoothstep(0.10, 0.48, rawMassWide + rawMidBlur * 0.46 + deckCoverage * deckInfluence * 0.18);
        float referenceMistLayer =
          referenceLookStrength *
          visibleCloudGate *
          smoothstep(0.06, 0.42, rawMassWide * 0.72 + rawMidBlur * 0.38 + deckCoverage * deckInfluence * 0.16);
        float naturalCoverage = clamp(
          rawMidBlur * 0.18 +
            rawMassNear * 0.26 +
            rawMassWide * 0.1 +
            rawSharp * 0.38 +
            deckCoverage * deckInfluence * 0.08 +
            referenceCloudSea * 0.24,
          0.0,
          1.0
        );
        float massBody = weatherMass * 0.32 + weatherCore * 0.1 + photoCore * 0.34 + photoBright * 0.08 + naturalCoverage * 0.16 + referenceCloudSea * 0.22;
        float mid = max(cloudMask(midUv) * 0.38 + naturalCoverage * 0.24, massBody);
        float top = cloudMask(baseUv + wind + parallax * 0.38) * 0.78 + naturalCoverage * 0.16;
        float shadowMask = cloudMask(baseUv + wind + sunOffset * (1.8 + limb * 0.9));
        float referenceSingleLayerMask = cloudMask(midUv);
        bottom = mix(bottom, referenceSingleLayerMask, referenceLookStrength * 0.92);
        mid = mix(mid, max(mid, referenceSingleLayerMask * 0.88), referenceLookStrength * 0.74);
        top = mix(top, referenceSingleLayerMask * (0.86 + cloudTopLight * 0.14), referenceLookStrength * 0.86);
        shadowMask = mix(shadowMask, cloudMask(baseUv + wind + sunOffset * (0.72 + limb * 0.2)), referenceLookStrength * 0.76);
        float rawDensity = clamp(rawBottom * 0.08 + rawSharp * 0.5 + rawMass * 0.32 + rawTop * 0.1, 0.0, 1.0);
        float textureBody = clamp(rawSharp * 0.52 + rawMidBlur * 0.24 + rawMassNear * 0.16 + rawMassWide * 0.08, 0.0, 1.0);
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
        float v3BodyCoverage = smoothstep(
          0.28,
          0.74,
          max(max(weatherMass, weatherCore), rawSharp * 0.68 + deckThickness * 0.42)
        );
        float v3VolumeMass = v3Enabled * visibleCloudGate * v3BodyCoverage;
        float v3SunTransmittance = exp(-v3SunColumn * (1.14 + thickness * 1.78 + deckThickness * 0.86));
        float v3TopLight = smoothstep(
          0.18,
          0.68,
          cloudTopLight * (0.22 + v3SunTransmittance * 0.78) + deckHighCap * 0.24
        ) * sunlitCloud;
        float v3SideLight = smoothstep(
          0.06,
          0.78,
          (1.0 - cloudTopLight) * 0.78 + v3SunTransmittance * 0.24 + rim * 0.18
        ) * (1.0 - v3TopLight * 0.58);
        float v3Underside = v3VolumeMass * clamp(
          (1.0 - v3SunTransmittance) * 1.12 +
          deckAo * 0.58 +
          cloudSlopeShadow * 0.48 +
          weatherCore * 0.24,
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
            deckAo * 0.22 * deckInfluence +
            cloudSlopeShadow * 0.32 +
            normalReliefMask * (1.0 - cloudTopLight) * 0.12 +
            volumeSelfShadow * 0.78 +
            v3Underside * 0.5 +
            weatherCore * 0.18 +
            referenceDarkGyre * 0.18 +
            referenceSoftShadow * 0.16
          ),
          0.0,
          0.78
        );
        float light = mix(0.08, 1.08, sunlitCloud) * (1.0 - selfShadow) + twilight * 0.06 + limb * sunlitCloud * 0.1;

        vec3 cloudShadow = mix(vec3(0.24, 0.30, 0.40), vec3(0.48, 0.54, 0.64), max(mid, weatherMass * 0.72));
        vec3 cloudLit = mix(
          vec3(0.54, 0.62, 0.70),
          vec3(0.84, 0.88, 0.86),
          smoothstep(0.10, 0.84, max(rawTop, rawSharp * 0.58 + rawMidBlur * 0.22))
        );
        vec3 cloudBase = mix(cloudShadow, cloudLit, clamp(sunlitCloud * (0.42 + weatherCore * 0.08) + top * 0.14 + photoBright * 0.08, 0.0, 1.0));
        cloudBase += vec3(0.036, 0.042, 0.048) * clamp((rawSharp - rawMidBlur) * (0.06 + closeStage * 0.03) * weatherMass, 0.0, 0.024) * sunlitCloud;
        cloudBase *= mix(0.82, 1.0, smoothstep(0.22, 0.82, textureBody));
        vec3 warmEdge = vec3(1.0, 0.62, 0.28) * twilight * (0.06 + thickness * 0.06);
        warmEdge = mix(
          warmEdge,
          vec3(0.42, 0.56, 0.48) * twilight * (0.032 + thickness * 0.044),
          referenceLookStrength
        );
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
          (0.052 + closeStage * 0.04);
        finalColor += vec3(0.72, 0.84, 0.98) *
          cloudNormalHighlight *
          sunlitCloud *
          (0.022 + closeStage * 0.018);
        finalColor += vec3(0.68, 0.82, 1.0) *
          volumeForwardScatter *
          (0.08 + closeStage * 0.08);
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.68, 0.76, 0.88),
          cloudSlopeShadow * (0.12 + referenceLookStrength * 0.055) + volumeSelfShadow * 0.04
        );
        float referenceSunlitTop =
          referenceLookStrength *
          sunlitCloud *
          visibleCloudGate *
          smoothstep(0.42, 0.92, max(deckHighCap, cloudTopLight * max(weatherMass, rawSharp)));
        finalColor = mix(
          finalColor,
          vec3(0.90, 0.94, 0.92),
          referenceSunlitTop * mix(0.07, 0.16, 1.0 - referenceLookStrength)
        );
        finalColor += vec3(0.90, 0.94, 0.92) *
          referenceLookStrength *
          topCap *
          sunlitCloud *
          (0.018 + closeStage * 0.012);
        float referenceForegroundSoft =
          referenceLookStrength *
          (1.0 - smoothstep(0.42, 0.76, rim)) *
          referenceSoftDeck *
          (0.46 + sunlitCloud * 0.54);
        finalColor = mix(
          finalColor,
          vec3(0.58, 0.67, 0.70) * (0.76 + sunlitCloud * 0.12),
          referenceCloudSea * (0.12 + closeStage * 0.052)
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.34, 0.44, 0.58),
          (referenceDarkGyre + referenceSoftShadow * 0.9) * (0.24 + (1.0 - sunlitCloud) * 0.14)
        );
        finalColor = mix(
          finalColor,
          vec3(0.62, 0.70, 0.72),
          referenceForegroundSoft * 0.14
        );
        finalColor = mix(
          finalColor,
          vec3(0.54, 0.64, 0.68),
          referenceMistLayer * (0.12 + closeStage * 0.07) * (0.65 + sunlitCloud * 0.25)
        );
        float referenceHorizonGlowLift =
          referenceLookStrength *
          smoothstep(0.62, 0.94, rim) *
          (1.0 - smoothstep(0.992, 1.0, rim)) *
          max(referenceCloudSea, referenceMistLayer * 0.72) *
          mix(0.58, 1.0, sunlitCloud);
        finalColor += vec3(0.18, 0.30, 0.34) * referenceHorizonGlowLift * (0.08 + closeStage * 0.036);
        finalColor += vec3(0.10, 0.17, 0.14) * referenceHorizonGlowLift * (0.032 + closeStage * 0.018);
        float referenceHighFibers =
          referenceLookStrength *
          sunlitCloud *
          smoothstep(0.10, 0.52, rawSharp) *
          (1.0 - smoothstep(0.68, 0.96, rawSharp)) *
          smoothstep(0.35, 0.88, rim) *
          smoothstep(
            0.48,
            0.86,
            noise2(baseUv * vec2(240.0, 48.0) + vec2(shellOffset * 19.0, shellOffset * 7.0))
          );
        float referenceLimbCompression =
          referenceLookStrength *
          smoothstep(0.70, 0.96, rim) *
          (1.0 - smoothstep(0.988, 1.0, rim)) *
          smoothstep(0.18, 0.72, max(rawSharp, deckCoverage * 0.72 + deckThickness * 0.28)) *
          mix(0.46, 1.0, sunlitCloud);
        finalColor += vec3(0.78, 0.88, 1.0) * referenceHighFibers * (0.018 + closeStage * 0.014);
        finalColor = mix(finalColor, vec3(0.74, 0.84, 0.88), referenceLimbCompression * 0.12);
        float referenceThicknessShadow = referenceLookStrength * clamp(
          cloudSlopeShadow * 0.42 +
          volumeSelfShadow * 0.28 +
          weatherCore * 0.12 +
          deckAo * deckInfluence * 0.18,
          0.0,
          0.72
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.48, 0.58, 0.74),
          referenceThicknessShadow * mix(0.54, 0.34, sunlitCloud)
        );
        float closeCloudReadability = max(
          closeStage * visibleCloudGate *
            smoothstep(0.18, 0.58, max(max(rawSharp, rawMassNear), weatherMass)),
          closeDeckCloud * 0.68
        );
        finalColor = mix(
          finalColor,
          finalColor * vec3(1.12, 1.13, 1.11) + vec3(0.055, 0.06, 0.064) * sunlitCloud,
          closeCloudReadability * 0.045
        );
        float daylightCloudLift =
          sunlitCloud *
          smoothstep(0.24, 0.82, max(max(weatherMass, weatherCore), closeCloudReadability)) *
          (0.065 + closeCloudReadability * 0.14 + topCap * 0.11);
        daylightCloudLift *= mix(1.0, 0.70, referenceLookStrength);
        finalColor += vec3(0.84, 0.88, 0.86) * daylightCloudLift;
        finalColor = mix(
          finalColor,
          vec3(0.76, 0.82, 0.82),
          closeCloudReadability * sunlitCloud * 0.052
        );
        float nightCloudDim = nightCloud * (1.0 - twilight * 0.48) * (0.42 + closeStage * 0.1);
        finalColor *= mix(1.0, 0.62, nightCloudDim);
        finalColor += vec3(0.56, 0.66, 0.78) * limbVolume * density * thickness * (0.04 + sunlitCloud * 0.08);
        finalColor += vec3(0.30, 0.42, 0.46) *
          referenceLookStrength *
          limbVolume *
          max(referenceCloudSea, referenceMistLayer) *
          (0.026 + sunlitCloud * 0.045);
        finalColor += vec3(0.62, 0.70, 0.76) * topCap * sunlitCloud * (0.074 + debugBoost * 0.06);
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
        float referenceDensityFeather = smoothstep(
          0.055,
          0.48,
          rawSharp * 0.74 + rawMassNear * 0.12 + deckCoverage * deckInfluence * 0.06 + referenceCloudSea * 0.22 + referenceMistLayer * 0.18
        );
        softDensityFeather = mix(softDensityFeather, referenceDensityFeather, referenceLookStrength * 0.78);
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
        vec3 v3UndersideColor = vec3(0.14, 0.20, 0.30);
        vec3 v3SideColor = vec3(0.40, 0.50, 0.62);
        vec3 v3TopColor = vec3(0.98, 0.99, 0.97);
        vec3 v3VolumeColor = mix(v3UndersideColor, v3SideColor, v3SideLight);
        v3VolumeColor = mix(v3VolumeColor, v3TopColor, v3TopLight);
        float v3ColorWeight = v3VolumeMass *
          smoothstep(0.08, 0.64, density + thickness * 0.42) *
          (0.54 + closeStage * 0.26);
        finalColor = mix(finalColor, v3VolumeColor * lightColor, v3ColorWeight);
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.56, 0.66, 0.82),
          v3Underside * (0.44 + closeStage * 0.2)
        );
        finalColor += v3TopColor * v3TopLight * v3VolumeMass * (0.18 + closeStage * 0.14);
        float alpha = (
          photoWisps * 0.06 +
          weatherMass * 0.32 +
          weatherCore * 0.14 +
          density * 0.22 +
          thickness * 0.16 +
          opaqueCore * 0.22 +
          closeCloudReadability * 0.12 +
          closeDeckCloud * 0.16 +
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
          1.38,
          referenceLookStrength * smoothstep(0.18, 0.72, max(weatherMass, thickness))
        );
        float referenceAlphaStructure = mix(
          0.72,
          1.5,
          smoothstep(0.16, 0.7, max(rawSharp, deckCoverage * 0.7 + deckThickness * 0.3))
        );
        alpha *= mix(1.0, referenceAlphaStructure, referenceLookStrength * 0.82);
        float referenceCloudPresence =
          referenceLookStrength *
          visibleCloudGate *
          smoothstep(0.1, 0.58, max(rawSharp, deckCoverage * 0.64 + deckThickness * 0.24));
        alpha *= mix(1.0, 1.28, referenceCloudPresence);
        alpha += referenceCloudPresence * opacity * (0.03 + closeStage * 0.012);
        alpha += referenceLookStrength * topCap * sunlitCloud * opacity * (0.012 + closeStage * 0.006);
        alpha += referenceLimbCompression * opacity * (0.018 + sunlitCloud * 0.026);
        alpha += referenceHighFibers * opacity * (0.006 + closeStage * 0.004);
        alpha += referenceCloudSea * opacity * (0.042 + sunlitCloud * 0.026 + closeStage * 0.018);
        alpha += referenceForegroundSoft * opacity * 0.022;
        alpha += referenceMistLayer * opacity * (0.042 + closeStage * 0.024);
        alpha += referenceHorizonGlowLift * opacity * 0.018;
        float nightLimbFade = 1.0 - smoothstep(0.54, 0.9, rim) * nightCloud * 0.9;
        alpha *= shellLimbFade * nightLimbFade;
        float closeCloudDepth = clamp(cloudVolumeShadowStrength, 0.0, 2.0) *
          closeStage * (0.06 + thickness * 0.16);
        finalColor *= 1.0 - clamp(closeCloudDepth, 0.0, 0.32);

        if (alpha < 0.00008) {
          discard;
        }

        float alphaCeiling = mix(0.34, 0.66, debugBoost);
        alphaCeiling = mix(alphaCeiling, max(alphaCeiling, 0.72), referenceLookStrength * (1.0 - debugBoost * 0.35));
        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, alphaCeiling));
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
  cloudOffsetRef,
  cloudDeckEnabled = true,
  cloudMode = "lookdev",
  cloudVolumeModel = "v3",
  closeAtmosphereTuning
}: LandingCloudLayerProps) {
  const cloud = useRef<Mesh>(null);
  const cloudGroup = useRef<Group>(null);
  const cloudOffset = useRef(0);
  const reliefLightingStrength = useMemo(readLiteCloudReliefLightingStrength, []);
  const diagnosticMode = useMemo(readLiteCloudDiagnosticMode, []);
  const cloudVolumeProfile = useMemo(
    () => resolveCloudVolumeV3Profile({
      qualityTier: quality.tier,
      referenceLook,
      requestedModel: cloudVolumeModel
    }),
    [cloudVolumeModel, quality.tier, referenceLook]
  );
  const { texture: cloudFieldTexture, failed: cloudFieldTextureFailed } = useLandingTexture(
    cloudMode === "shell-lite" ? assets.earthCloudField?.src : undefined,
    {
      colorSpace: assets.earthCloudField?.colorSpace ?? "linear",
      wrapS: RepeatWrapping,
      wrapT: ClampToEdgeWrapping,
      anisotropy: 4
    }
  );
  const { texture: cloudTexture, failed: cloudTextureFailed } = useLandingTexture(
    cloudMode === "lookdev" ? assets.earthClouds?.src : undefined,
    {
    colorSpace: assets.earthClouds?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
    }
  );
  const { texture: cloudDeckTexture } = useLandingTexture(
    cloudMode === "lookdev" && cloudDeckEnabled && quality.tier !== "low" && quality.tier !== "fallback"
      ? assets.earthCloudDeck?.src
      : undefined,
    {
      colorSpace: assets.earthCloudDeck?.colorSpace ?? "linear",
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping
    }
  );
  const activeCloudShells = useMemo(() => {
    if (cloudMode === "shell-lite") {
      return [HOME_LITE_CLOUD_SHELL];
    }
    if (cloudMode !== "lookdev") {
      return [];
    }

    const shells = resolveLandingCloudShells(
      quality.tier,
      referenceLook,
      cloudVolumeProfile.model
    );
    if (!emphasis || shells.length === 3 || cloudVolumeProfile.model === "v3") {
      return shells;
    }

    return (referenceLook ? REFERENCE_CLOUD_SHELLS : STANDARD_CLOUD_SHELLS).slice(0, 3);
  }, [cloudMode, cloudVolumeProfile.model, emphasis, quality.tier, referenceLook]);
  const materials = useMemo(
    () => {
      if (cloudMode === "shell-lite") {
        return cloudFieldTexture
          ? [createLiteCloudMaterial(composition, cloudFieldTexture, reliefLightingStrength, diagnosticMode)]
          : [];
      }

      return cloudTexture
        ? activeCloudShells.map((layer) => createCloudMaterial(composition, layer, cloudTexture, cloudDeckTexture ?? undefined))
        : [];
    },
    [
      activeCloudShells,
      cloudDeckTexture,
      cloudFieldTexture,
      cloudMode,
      cloudTexture,
      composition,
      diagnosticMode,
      reliefLightingStrength
    ]
  );
  const activeTexture = cloudMode === "shell-lite" ? cloudFieldTexture : cloudTexture;
  const activeTextureFailed = cloudMode === "shell-lite" ? cloudFieldTextureFailed : cloudTextureFailed;
  const enabled =
    composition.earth.useClouds &&
    composition.earth.cloudOpacity > 0 &&
    quality.tier !== "fallback" &&
    cloudMode !== "surface" &&
    Boolean(activeTexture) &&
    !activeTextureFailed;

  useEffect(() => {
    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [materials]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthCloudShellCount = enabled ? activeCloudShells.length : 0;
    window.__MiraLithLuBirthCloudFieldTexture =
      enabled && cloudMode === "shell-lite" ? assets.earthCloudField?.src : undefined;
    window.__MiraLithLuBirthCloudShellTextureUuid =
      enabled && cloudMode === "shell-lite" ? cloudFieldTexture?.uuid : undefined;
    window.__MiraLithLuBirthCloudHeightScale =
      enabled && cloudMode === "shell-lite" ? HOME_LITE_CLOUD_HEIGHT_SCALE : undefined;
    window.__MiraLithLuBirthCloudReliefSamples =
      enabled && cloudMode === "shell-lite" ? 1 : undefined;
    window.__MiraLithLuBirthCloudReliefLightingStrength =
      enabled && cloudMode === "shell-lite" ? reliefLightingStrength : undefined;
    window.__MiraLithLuBirthCloudDiagnosticMode =
      enabled && cloudMode === "shell-lite" ? diagnosticMode : undefined;

    return () => {
      window.__MiraLithLuBirthCloudShellCount = 0;
      window.__MiraLithLuBirthCloudFieldTexture = undefined;
      window.__MiraLithLuBirthCloudShellOffset = undefined;
      window.__MiraLithLuBirthCloudShellTextureUuid = undefined;
      window.__MiraLithLuBirthCloudHeightScale = undefined;
      window.__MiraLithLuBirthCloudReliefSamples = undefined;
      window.__MiraLithLuBirthCloudReliefLightingStrength = undefined;
      window.__MiraLithLuBirthCloudDiagnosticMode = undefined;
    };
  }, [
    activeCloudShells.length,
    assets.earthCloudField?.src,
    cloudFieldTexture?.uuid,
    cloudMode,
    diagnosticMode,
    enabled,
    reliefLightingStrength
  ]);

  useFrame((_state, delta) => {
    if (!cloudGroup.current || !enabled || !activeTexture) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    if (!paused && !reducedMotion && !(cloudMode === "shell-lite" && cloudOffsetRef)) {
      const driftSpeed = cloudMode === "shell-lite"
        ? HOME_CLOUD_FIELD_SCROLL_SPEED
        : CLOUD_SCROLL_SPEED * (0.04 + (1 - closeStage) * 0.96);
      cloudOffset.current = (cloudOffset.current + delta * driftSpeed) % 1;
    }
    const activeCloudOffset =
      cloudMode === "shell-lite" && cloudOffsetRef ? cloudOffsetRef.current : cloudOffset.current;
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
      cloudMaterial.uniforms.cloudOffset.value = activeCloudOffset;
      cloudMaterial.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
      cloudMaterial.uniforms.debugBoost.value = emphasis ? 1 : 0;
      cloudMaterial.uniforms.lightDir.value.copy(lightDirection);
      if (cloudMode === "shell-lite") {
        cloudMaterial.uniforms.cloudFieldMap.value = activeTexture;
        cloudMaterial.uniforms.reliefLightingStrength.value = reliefLightingStrength;
        cloudMaterial.uniforms.diagnosticMode.value = diagnosticMode;
        return;
      }

      cloudMaterial.uniforms.cloudMap.value = activeTexture;
      cloudMaterial.uniforms.cloudDeckMap.value = cloudDeckTexture ?? activeTexture;
      cloudMaterial.uniforms.hasCloudDeckMap.value = cloudDeckTexture ? 1 : 0;
      cloudMaterial.uniforms.closeStage.value = closeStage;
      cloudMaterial.uniforms.referenceLookStrength.value = referenceLook ? 1 : 0;
      cloudMaterial.uniforms.cloudVolumeShadowStrength.value =
        closeAtmosphereTuning?.cloudVolumeShadowStrength ?? 0;
      cloudMaterial.uniforms.cloudVolumeV3Strength.value =
        cloudVolumeProfile.model === "v3" ? 1 : 0;
    });
    window.__MiraLithLuBirthCloudShellOffset = activeCloudOffset;
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
              cloudMode === "shell-lite"
                ? quality.tier === "high" ? 144 : quality.tier === "medium" ? 128 : 80
                : quality.tier === "high" ? Math.max(288, quality.segments * 4) : quality.tier === "medium" ? Math.max(160, quality.segments * 3) : 48,
              cloudMode === "shell-lite"
                ? quality.tier === "high" ? 84 : quality.tier === "medium" ? 72 : 48
                : quality.tier === "high" ? 180 : quality.tier === "medium" ? 96 : 32
            ]}
          />
        </mesh>
      ))}
    </group>
  );
}
