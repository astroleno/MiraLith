"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector3
} from "three";
import { type QualityProfile } from "@miralith/visual-core";
import { DEFAULT_LUBIRTH_ASSETS } from "./assetManifest";
import { LandingEarthLite } from "./LandingEarthLite";
import type {
  LandingComposition,
  LandingResolvedAssets,
  LandingRuntimeProfile,
  LandingVisualPolicy
} from "./types";
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
  referenceVolumetricSurfaceClouds?: boolean;
  runtimeProfile?: LandingRuntimeProfile;
  visualPolicy?: LandingVisualPolicy;
}

const lightDirection = new Vector3();
const SURFACE_CLOUD_OPACITY_MULTIPLIER = 0.22;
const SURFACE_CLOUD_SHADOW_MULTIPLIER = 0.62;
const SURFACE_CLOUD_TEXTURE_ART_OFFSET_X = 0.045;
const SURFACE_CLOUD_TEXTURE_ART_OFFSET_Y = 0.018;
const SURFACE_CLOUD_SCROLL_SPEED = 0.022;
const CLOUD_SHADOW_ATLAS_DESKTOP_HIGH = { width: 1024, height: 512 };
const CLOUD_SHADOW_ATLAS_DESKTOP_MEDIUM = { width: 512, height: 256 };
const CLOUD_SHADOW_ATLAS_MOBILE_HIGH = { width: 256, height: 128 };

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function resolveEarthSegments(
  composition: LandingComposition,
  quality: QualityProfile,
  runtimeProfile: LandingRuntimeProfile
) {
  if (runtimeProfile === "home-lite") {
    return Math.max(96, Math.min(160, composition.earth.segments));
  }

  if (quality.tier === "high") {
    return Math.max(composition.earth.segments, quality.segments, 512);
  }

  if (quality.tier === "medium") {
    return Math.max(256, quality.segments);
  }

  return quality.segments;
}

function isMobileLikeViewport() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 560;
}

function resolveCloudShadowAtlasSize(quality: QualityProfile) {
  if (quality.tier === "low" || quality.tier === "fallback") {
    return null;
  }

  if (isMobileLikeViewport()) {
    return quality.tier === "high" ? CLOUD_SHADOW_ATLAS_MOBILE_HIGH : null;
  }

  return quality.tier === "high" ? CLOUD_SHADOW_ATLAS_DESKTOP_HIGH : CLOUD_SHADOW_ATLAS_DESKTOP_MEDIUM;
}

function drawableImageSize(image: unknown) {
  if (!image || typeof image !== "object") {
    return null;
  }

  const maybeSized = image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const width = maybeSized.naturalWidth ?? maybeSized.width ?? 0;
  const height = maybeSized.naturalHeight ?? maybeSized.height ?? 0;

  return width > 0 && height > 0 ? { height, width } : null;
}

function createCloudShadowAtlasTexture(cloudMap: Texture, width: number, height: number) {
  if (typeof document === "undefined") {
    return null;
  }

  const image = cloudMap.image as CanvasImageSource | undefined;
  const imageSize = drawableImageSize(image);
  if (!image || !imageSize) {
    return null;
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) {
    return null;
  }

  sourceContext.drawImage(image, 0, 0, width, height);
  const source = sourceContext.getImageData(0, 0, width, height);
  const densities = new Float32Array(width * height);

  for (let index = 0; index < densities.length; index += 1) {
    const pixel = index * 4;
    const luminance = (
      source.data[pixel] * 0.2126 +
      source.data[pixel + 1] * 0.7152 +
      source.data[pixel + 2] * 0.0722
    ) / 255;
    densities[index] = Math.pow(Math.min(1, Math.max(0, luminance)), 0.55);
  }

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = width;
  shadowCanvas.height = height;
  const shadowContext = shadowCanvas.getContext("2d");
  if (!shadowContext) {
    return null;
  }

  const shadow = shadowContext.createImageData(width, height);
  const sample = (x: number, y: number) => {
    const wrappedX = ((Math.round(x) % width) + width) % width;
    const clampedY = Math.min(height - 1, Math.max(0, Math.round(y)));
    return densities[clampedY * width + wrappedX] ?? 0;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const center = densities[index] ?? 0;
      const radius1 = Math.max(1, Math.round(width / 420));
      const radius2 = Math.max(radius1 + 1, Math.round(width / 180));
      const radius3 = Math.max(radius2 + 1, Math.round(width / 82));
      const cross =
        sample(x + radius1, y) +
        sample(x - radius1, y) +
        sample(x, y + radius1) +
        sample(x, y - radius1);
      const diagonal =
        sample(x + radius2, y + radius2 * 0.62) +
        sample(x - radius2, y + radius2 * 0.62) +
        sample(x + radius2, y - radius2 * 0.62) +
        sample(x - radius2, y - radius2 * 0.62);
      const wide =
        sample(x + radius3, y) +
        sample(x - radius3, y) +
        sample(x, y + radius3 * 0.62) +
        sample(x, y - radius3 * 0.62);
      const broad = (center * 3.8 + cross * 0.9 + diagonal * 0.62 + wide * 0.36) / 11.52;
      const gradient = Math.abs(sample(x + radius1, y) - sample(x - radius1, y)) +
        Math.abs(sample(x, y + radius1) - sample(x, y - radius1));
      const projectedCaster = smoothstep(0.18, 0.68, Math.max(center, broad * 1.08));
      const selfOcclusion = smoothstep(0.24, 0.84, broad) * smoothstep(0.08, 0.72, center);
      const edgeHighlight = Math.min(1, Math.max(0, (center - broad) * 2.4 + gradient * 0.62));
      const mass = Math.pow(Math.min(1, Math.max(0, center)), 0.52);
      const pixel = index * 4;
      shadow.data[pixel] = Math.round(projectedCaster * 255);
      shadow.data[pixel + 1] = Math.round(selfOcclusion * 255);
      shadow.data[pixel + 2] = Math.round(edgeHighlight * 255);
      shadow.data[pixel + 3] = Math.round(mass * 255);
    }
  }

  shadowContext.putImageData(shadow, 0, 0);
  const texture = new CanvasTexture(shadowCanvas);
  texture.name = `LuBirth cloud shadow atlas ${width}x${height}`;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}

function LandingEarthLookdev({
  composition,
  assets,
  quality,
  showTextureClouds = true,
  reducedMotion,
  paused,
  sceneLightDirection,
  onDayTextureReady,
  cloudDeckEnabled = true,
  referenceVolumetricSurfaceClouds = false,
  runtimeProfile = "full"
}: LandingEarthProps) {
  const earth = useRef<Mesh>(null);
  const earthSegments = resolveEarthSegments(composition, quality, runtimeProfile);
  const isHomeLite = runtimeProfile === "home-lite";
  const proceduralDayTexture = useMemo(
    () => createEarthTexture(quality.tier === "high" ? 1024 : 512),
    [quality.tier]
  );
  const { texture: dayTexture } = useLandingTexture(assets.earthDay.src, {
    colorSpace: assets.earthDay.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const baseNightAsset = DEFAULT_LUBIRTH_ASSETS.earthNight!;
  const detailNightAsset = assets.earthNight?.src !== baseNightAsset.src ? assets.earthNight : undefined;
  const { texture: baseNightTexture } = useLandingTexture(baseNightAsset.src, {
    colorSpace: baseNightAsset.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const { texture: detailNightTexture } = useLandingTexture(detailNightAsset?.src, {
    colorSpace: detailNightAsset?.colorSpace,
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
  const shouldUseSpecularTexture =
    !isHomeLite && quality.tier !== "low" && quality.tier !== "fallback";
  const { texture: specularTexture } = useLandingTexture(
    shouldUseSpecularTexture ? assets.earthSpecular?.src : undefined,
    {
      colorSpace: assets.earthSpecular?.colorSpace ?? "linear",
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
  const activeNightTexture = detailNightTexture ?? baseNightTexture ?? activeDayTexture;
  const activeCloudTexture = cloudTexture ?? activeDayTexture;
  const activeCloudDeckTexture = cloudDeckTexture ?? activeCloudTexture;
  const activeSpecularTexture = specularTexture ?? activeDayTexture;
  const activeNormalTexture = normalTexture ?? activeDayTexture;
  const activeDisplacementTexture = displacementTexture ?? activeDayTexture;
  const cloudShadowAtlasSize = useMemo(
    () => isHomeLite ? null : resolveCloudShadowAtlasSize(quality),
    [isHomeLite, quality]
  );
  const [cloudShadowAtlasTexture, setCloudShadowAtlasTexture] = useState<Texture | null>(null);

  useEffect(() => {
    if (dayTexture) {
      onDayTextureReady?.();
    }
  }, [dayTexture, onDayTextureReady]);

  useEffect(() => {
    if (!cloudTexture || !shouldUseTextureClouds || !cloudShadowAtlasSize) {
      setCloudShadowAtlasTexture((previous) => {
        previous?.dispose();
        return null;
      });
      return undefined;
    }

    const nextTexture = createCloudShadowAtlasTexture(
      cloudTexture,
      cloudShadowAtlasSize.width,
      cloudShadowAtlasSize.height
    );

    setCloudShadowAtlasTexture((previous) => {
      previous?.dispose();
      return nextTexture;
    });

    return () => {
      nextTexture?.dispose();
    };
  }, [cloudShadowAtlasSize, cloudTexture, shouldUseTextureClouds]);

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
      activeSpecularTexture.wrapS = RepeatWrapping;
      activeSpecularTexture.wrapT = RepeatWrapping;
      activeNormalTexture.wrapS = RepeatWrapping;
      activeNormalTexture.wrapT = RepeatWrapping;
      activeDisplacementTexture.wrapS = RepeatWrapping;
      activeDisplacementTexture.wrapT = RepeatWrapping;
      [
        activeDayTexture,
        activeNightTexture,
        activeCloudTexture,
        activeCloudDeckTexture,
        activeSpecularTexture,
        activeNormalTexture,
        activeDisplacementTexture
      ].forEach((texture) => {
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearMipmapLinearFilter;
        const targetAnisotropy = isHomeLite ? 4 : quality.tier === "high" ? 16 : 10;
        texture.anisotropy = Math.max(texture.anisotropy, targetAnisotropy);
        texture.needsUpdate = true;
      });

      return new ShaderMaterial({
        uniforms: {
          dayMap: { value: activeDayTexture },
          nightMap: { value: activeNightTexture },
          cloudMap: { value: activeCloudTexture },
          cloudDeckMap: { value: activeCloudDeckTexture },
          cloudShadowAtlasMap: { value: cloudShadowAtlasTexture ?? activeCloudTexture },
          specularMap: { value: activeSpecularTexture },
          normalMap: { value: activeNormalTexture },
          displacementMap: { value: activeDisplacementTexture },
          hasCloudDeckMap: { value: cloudDeckTexture ? 1 : 0 },
          hasCloudShadowAtlas: { value: cloudShadowAtlasTexture ? 1 : 0 },
          hasSpecularMap: { value: specularTexture ? 1 : 0 },
          hasNormalMap: { value: normalTexture ? 1 : 0 },
          hasDisplacementMap: { value: displacementTexture ? 1 : 0 },
          normalMapStrength: { value: 0.14 },
          displacementStrength: { value: 0.9 },
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
          nightSurfaceLift: { value: composition.earth.nightSurfaceLift },
          specularStrength: { value: composition.earth.specularStrength },
          cloudOpacity: {
            value: shouldUseTextureClouds
              ? composition.earth.cloudOpacity * SURFACE_CLOUD_OPACITY_MULTIPLIER
              : 0
          },
          cloudShadowOpacity: {
            value: shouldUseTextureClouds && !isHomeLite
              ? composition.earth.cloudOpacity *
                SURFACE_CLOUD_SHADOW_MULTIPLIER *
                (referenceVolumetricSurfaceClouds ? 1.42 : 1)
              : 0
          },
          referenceVolumetricSurfaceClouds: { value: referenceVolumetricSurfaceClouds ? 1 : 0 },
          homeLiteStrength: { value: isHomeLite ? 1 : 0 },
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
          uniform sampler2D cloudShadowAtlasMap;
          uniform sampler2D specularMap;
          uniform sampler2D normalMap;
          uniform sampler2D displacementMap;
          uniform float hasCloudDeckMap;
          uniform float hasCloudShadowAtlas;
          uniform float hasSpecularMap;
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
          uniform float nightSurfaceLift;
          uniform float specularStrength;
          uniform float cloudOpacity;
          uniform float cloudShadowOpacity;
          uniform float referenceVolumetricSurfaceClouds;
          uniform float homeLiteStrength;
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
            float raw = dot(cloudRgb, vec3(0.2126, 0.7152, 0.0722));
            return pow(clamp(raw, 0.0, 1.0), 0.55);
          }

          vec4 sampleCloudShadowAtlas(vec2 uv) {
            return texture2D(cloudShadowAtlasMap, vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999)));
          }

          void main() {
            vec3 n = normalize(vNormalW);
            vec3 tangentA = normalize(vWorldTangentA);
            vec3 tangentB = normalize(vWorldTangentB);
            vec3 l = normalize(lightDir);
            vec3 v = normalize(vViewW);
            float lowCostReferenceCloudLook = step(0.5, referenceVolumetricSurfaceClouds);
            float referenceCloudLook = 0.0;
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

            vec3 truthDayTexRaw = texture2D(dayMap, vUv).rgb;
            if (lowCostReferenceCloudLook > 0.5) {
              truthDayTexRaw = mix(
                truthDayTexRaw,
                pow(max(truthDayTexRaw, vec3(0.0)), vec3(1.08)),
                0.14
              );
            }
            float truthDayLuma = dot(truthDayTexRaw, vec3(0.299, 0.587, 0.114));
            vec3 truthDayTex = mix(vec3(truthDayLuma), truthDayTexRaw, 0.82);
            float dryAlbedoSignal =
              smoothstep(0.06, 0.24, max(truthDayTex.r, truthDayTex.g) - truthDayTex.b) *
              smoothstep(0.38, 0.78, truthDayLuma);
            vec3 dryNeutral = truthDayTex * vec3(1.02, 0.96, 0.86);
            truthDayTex = mix(truthDayTex, dryNeutral, dryAlbedoSignal * 0.14);
            float vegetationSignal =
              smoothstep(0.025, 0.14, truthDayTex.g - max(truthDayTex.r, truthDayTex.b) * 0.86) *
              smoothstep(0.18, 0.62, truthDayLuma);
            vec3 vegetationNeutral = truthDayTex * vec3(0.92, 1.04, 0.9);
            truthDayTex = mix(truthDayTex, vegetationNeutral, vegetationSignal * 0.08);
            float truthOceanAlbedoSignal = truthDayTex.b - max(truthDayTex.r, truthDayTex.g) * 0.52;
            float truthOceanBlueChannelMask =
              smoothstep(0.18, 0.54, truthDayTexRaw.b) *
              smoothstep(0.01, 0.16, truthDayTexRaw.b - max(truthDayTexRaw.r, truthDayTexRaw.g) * 0.72) *
              (1.0 - smoothstep(0.72, 0.94, truthDayLuma));
            float truthOceanAlbedoMask = max(smoothstep(0.04, 0.18, truthOceanAlbedoSignal), truthOceanBlueChannelMask);
            truthDayTex = mix(
              truthDayTex,
              truthDayTex * vec3(0.64, 0.76, 0.88),
              truthOceanAlbedoMask * 0.3
            );
            if (lowCostReferenceCloudLook > 0.5) {
              float referenceBrightSurface = smoothstep(0.30, 0.74, truthDayLuma);
              float referenceCloudBakeMask = smoothstep(0.52, 0.86, truthDayLuma) *
                (1.0 - truthOceanAlbedoMask * 0.45);
              vec3 referenceNeutralDay = vec3(dot(truthDayTex, vec3(0.299, 0.587, 0.114))) *
                vec3(0.72, 0.82, 0.96);
              truthDayTex = mix(truthDayTex, referenceNeutralDay, referenceBrightSurface * 0.18);
              truthDayTex = mix(
                truthDayTex,
                truthDayTex * vec3(0.68, 0.78, 0.92),
                referenceCloudBakeMask * 0.1
              );
              truthDayTex = mix(
                truthDayTex,
                truthDayTex * vec3(0.78, 0.84, 0.92),
                dryAlbedoSignal * 0.08
              );
              truthDayTex = truthDayTex / (1.0 + max(truthDayTex - vec3(0.58), vec3(0.0)) * 0.42);
            }
            vec3 truthNightTex = pow(texture2D(nightMap, vUv).rgb, vec3(0.96));
            float truthDayLight = max(ndl, 0.0);
            float truthSurfaceGate = smoothstep(-transitionWidth * 2.4, transitionWidth * 1.35, ndl);
            float truthAmbient = 0.035 + ambient * mix(0.72, 0.54, closeStage);
            truthAmbient *= mix(1.0, 0.88, lowCostReferenceCloudLook);
            vec3 truthLightColor = mix(lightColor, vec3(0.92, 0.96, 1.0), 0.12 + closeStage * 0.06);
            float truthReferenceSunExposure = mix(1.0, 0.78, lowCostReferenceCloudLook);
            vec3 truthLitDay = truthDayTex * truthLightColor *
              (truthAmbient * truthSurfaceGate + truthDayLight * sunIntensity * mix(0.62, 0.56, closeStage) * truthReferenceSunExposure * dayW);
            vec2 truthEarlyCloudBaseUv = vec2(
              fract(vUv.x + cloudOffset + ${SURFACE_CLOUD_TEXTURE_ART_OFFSET_X.toFixed(3)}),
              clamp(vUv.y + ${SURFACE_CLOUD_TEXTURE_ART_OFFSET_Y.toFixed(3)} + cloudOffset * 0.18, 0.001, 0.999)
            );
            vec2 truthEarlySunShear = vec2(dot(l, tangentA), dot(l, tangentB));
            vec2 truthEarlyShadowUv = truthEarlyCloudBaseUv +
              truthEarlySunShear * mix(0.0035, 0.0055, lowCostReferenceCloudLook);
            vec4 truthEarlyShadowAtlas = sampleCloudShadowAtlas(truthEarlyShadowUv);
            float truthEarlyProjectedCloudShadow =
              truthEarlyShadowAtlas.r *
              hasCloudShadowAtlas *
              cloudShadowOpacity *
              dayW *
              smoothstep(-0.12, 0.42, ndl);
            float truthEarlyCloudSelfAo =
              truthEarlyShadowAtlas.g *
              hasCloudShadowAtlas *
              cloudOpacity *
              smoothstep(-0.08, 0.52, ndl);
            float truthEarlyReferenceShadowGate = 1.0 - lowCostReferenceCloudLook;
            truthLitDay *= 1.0 - truthEarlyProjectedCloudShadow * mix(0.22, 0.26, lowCostReferenceCloudLook) * truthEarlyReferenceShadowGate;
            truthLitDay = mix(
              truthLitDay,
              truthLitDay * vec3(0.66, 0.74, 0.86),
              truthEarlyCloudSelfAo * mix(0.08, 0.14, lowCostReferenceCloudLook) * truthEarlyReferenceShadowGate
            );
            float truthTwilight = (1.0 - smoothstep(transitionWidth * 0.10, transitionWidth * 1.55, abs(ndl)));
            vec3 truthTwilightFill = truthDayTex * vec3(0.055, 0.075, 0.105) *
              truthTwilight * (1.0 - dayW) * 0.52;
            vec3 truthNightFill = truthDayTex * vec3(0.04, 0.06, 0.09) *
              deepNightW * (0.34 + ambient * 1.55);
            vec3 truthPresentationAlbedo = pow(max(truthDayTexRaw, vec3(0.0)), vec3(0.72));
            vec3 truthPresentationNightFill =
              (truthPresentationAlbedo * vec3(0.2, 0.27, 0.38) + vec3(0.008, 0.012, 0.022) * closeStage) *
              nightSurfaceLift *
              deepNightW *
              (0.58 + closeStage * 0.42);
            vec3 truthGrazingFill = truthDayTex * vec3(0.065, 0.082, 0.11) *
              max(truthSurfaceGate - dayW, 0.0) * mix(0.78, 1.08, closeStage);
            float truthCityLuma = max(max(truthNightTex.r, truthNightTex.g), truthNightTex.b);
            float truthCityGate = smoothstep(0.06, 0.5, truthCityLuma);
            vec3 truthNightBlur = (
              texture2D(nightMap, vec2(fract(vUv.x + 0.0018), clamp(vUv.y + 0.0009, 0.001, 0.999))).rgb +
              texture2D(nightMap, vec2(fract(vUv.x - 0.0018), clamp(vUv.y - 0.0009, 0.001, 0.999))).rgb +
              texture2D(nightMap, vec2(fract(vUv.x - 0.0011), clamp(vUv.y + 0.0014, 0.001, 0.999))).rgb +
              texture2D(nightMap, vec2(fract(vUv.x + 0.0011), clamp(vUv.y - 0.0014, 0.001, 0.999))).rgb
            ) * 0.25;
            truthNightBlur = pow(max(truthNightBlur, vec3(0.0)), vec3(0.96));
            vec3 truthCityCore = pow(truthNightTex, vec3(1.12)) * vec3(1.0, 0.74, 0.48) * nightBoost *
              pow(nightW, 1.78) * (0.58 + truthCityGate * 0.28);
            vec3 truthCityHalo = truthNightBlur * vec3(0.95, 0.48, 0.20) * nightBoost *
              pow(nightW, 1.05) * 0.18;
            vec3 truthCity = truthCityCore + truthCityHalo;
            vec3 truthHalfDir = normalize(l + v);
            float truthOceanSignal = truthDayTex.b - max(truthDayTex.r, truthDayTex.g) * 0.55;
            float truthOceanBlueMask =
              smoothstep(0.16, 0.52, truthDayTexRaw.b) *
              smoothstep(0.0, 0.15, truthDayTexRaw.b - max(truthDayTexRaw.r, truthDayTexRaw.g) * 0.7) *
              (1.0 - smoothstep(0.74, 0.96, truthDayLuma));
            float truthHeuristicOceanMask = max(smoothstep(0.04, 0.2, truthOceanSignal), truthOceanBlueMask);
            float truthSpecularMapRaw = texture2D(specularMap, vUv).r;
            float truthSpecularIceGuard =
              1.0 - smoothstep(0.82, 0.98, truthDayLuma) * (1.0 - truthOceanBlueMask * 0.65);
            float truthSpecularWaterMask =
              smoothstep(0.34, 0.72, truthSpecularMapRaw) * truthSpecularIceGuard;
            float truthOceanMask = mix(
              truthHeuristicOceanMask,
              max(truthHeuristicOceanMask * 0.22, truthSpecularWaterMask),
              hasSpecularMap
            );
            float truthOceanNoCloud = 1.0 - clamp(
              truthEarlyProjectedCloudShadow * 0.24 + truthEarlyCloudSelfAo * 0.18,
              0.0,
              0.54
            );
            float truthGlintFacing = max(dot(n, truthHalfDir), 0.0);
            float truthGlintLowSun = 1.0 - smoothstep(0.26, 0.82, max(ndl, 0.0));
            float truthOceanGlint = pow(truthGlintFacing, 72.0) *
              truthOceanMask * truthOceanNoCloud * dayW * specularStrength * mix(0.30, 0.58, closeStage);
            float truthOceanSoftGlint = pow(truthGlintFacing, 32.0) *
              truthOceanMask *
              truthOceanNoCloud *
              dayW *
              specularStrength *
              0.08;
            float truthOceanWideGlint = pow(truthGlintFacing, 16.0) *
              truthOceanMask *
              truthOceanNoCloud *
              dayW *
              specularStrength *
              (0.11 + closeStage * 0.24) *
              (0.42 + truthGlintLowSun * 0.72);
            float truthOceanGoldGlint = pow(truthGlintFacing, 8.0) *
              truthOceanMask *
              truthOceanNoCloud *
              dayW *
              specularStrength *
              truthGlintLowSun *
              0.075;
            float truthOceanGrazingSheen =
              truthOceanMask *
              truthOceanNoCloud *
              dayW *
              smoothstep(0.28, 0.86, fresnel) *
              specularStrength *
              (0.02 + closeStage * 0.052) *
              (0.55 + truthGlintLowSun * 0.48);
            vec3 truthSpecular =
              vec3(0.58, 0.72, 0.92) * truthOceanGlint +
              vec3(0.45, 0.58, 0.72) * truthOceanSoftGlint +
              vec3(0.84, 0.94, 1.0) * truthOceanWideGlint +
              vec3(1.0, 0.72, 0.38) * truthOceanGoldGlint +
              vec3(0.62, 0.84, 1.0) * truthOceanGrazingSheen +
              vec3(1.0, 0.78, 0.48) * truthOceanGrazingSheen * truthGlintLowSun * 0.16;
            float truthSunRim = smoothstep(-edgeShadowSoftness, 0.42, ndl);
            float truthRimBreakup = mix(
              1.0,
              0.64 + 0.36 * smoothstep(0.18, 0.58, truthDayLuma),
              referenceCloudLook
            );
            float truthBlueRim = pow(fresnel, 5.8) *
              truthSunRim *
              edgeLightStrength *
              mix(0.003 + dayW * 0.008, 0.0008 + dayW * 0.0018, referenceCloudLook) *
              truthRimBreakup;
            float truthWhiteNeedle = pow(fresnel, 76.0) *
              truthSunRim *
              edgeNeedleStrength *
              mix(0.003, 0.00012, referenceCloudLook) *
              truthRimBreakup;
            vec3 truthRim = edgeLightColor * truthBlueRim + mix(vec3(0.58, 0.78, 1.0), vec3(0.30, 0.58, 1.0), referenceCloudLook) * truthWhiteNeedle;
            vec3 truthColor = truthLitDay + truthTwilightFill + truthNightFill + truthPresentationNightFill + truthGrazingFill + truthCity + truthSpecular + truthRim;
            float truthSurfaceReflectance = clamp(
              0.72 +
              truthOceanMask * 0.34 +
              dryAlbedoSignal * 0.12 +
              truthDayLuma * 0.18,
              0.62,
              1.32
            );
            float truthSurfaceAirShelf =
              pow(smoothstep(0.34, 0.92, fresnel), 1.45) *
              (1.0 - smoothstep(0.992, 1.0, fresnel)) *
              truthSunRim;
            float truthSurfaceAirBridge =
              pow(smoothstep(0.62, 0.985, fresnel), 1.55) *
              (1.0 - smoothstep(0.998, 1.0, fresnel)) *
              truthSunRim;
            float truthSurfaceInteriorLift =
              pow(smoothstep(0.06, 0.74, fresnel), 1.08) *
              (1.0 - smoothstep(0.95, 1.0, fresnel)) *
              truthSunRim *
              smoothstep(-0.14, 0.68, ndl);
            float truthSurfaceAirFeather =
              pow(smoothstep(0.10, 0.82, fresnel), 1.55) *
              (1.0 - smoothstep(0.97, 1.0, fresnel)) *
              truthSunRim;
            vec3 truthAirBlue = mix(
              vec3(0.018, 0.068, 0.18),
              edgeLightColor,
              0.58 + dayW * 0.22
            );
            vec3 truthContactBlue = mix(
              edgeLightColor,
              vec3(0.42, 0.68, 1.0),
              0.20 + truthOceanMask * 0.12
            );
            truthColor += (
              truthColor * vec3(0.18, 0.20, 0.22) +
              truthDayTex * truthLightColor * (0.035 + dayW * 0.035)
            ) *
              truthSurfaceInteriorLift *
              truthSurfaceReflectance *
              mix(0.52, 0.86, closeStage);
            truthColor += (
              truthColor * vec3(0.075, 0.088, 0.105) +
              truthAirBlue * (0.008 + dayW * 0.014)
            ) *
              truthSurfaceAirFeather *
              truthSurfaceReflectance *
              mix(0.3, 0.48, closeStage);
            truthColor = mix(
              truthColor,
              truthColor * vec3(1.03, 1.07, 1.13) + truthAirBlue * (0.016 + dayW * 0.026),
              truthSurfaceAirShelf * mix(0.018, 0.026, closeStage) * truthSurfaceReflectance * truthRimBreakup
            );
            float truthSurfaceGlowLift =
              pow(smoothstep(0.36, 0.93, fresnel), 1.65) *
              (1.0 - smoothstep(0.992, 1.0, fresnel)) *
              truthSunRim;
            truthColor += (
              truthColor * vec3(0.09, 0.105, 0.125) +
              truthAirBlue * (0.01 + dayW * 0.018)
            ) *
              truthSurfaceGlowLift *
              truthSurfaceReflectance *
              mix(0.035, 0.07, closeStage) *
              truthRimBreakup;
            truthColor += truthContactBlue *
              truthSurfaceAirBridge *
              (0.0012 + dayW * 0.003) *
              edgeLightStrength *
              truthSurfaceReflectance *
              truthRimBreakup;
            float truthHorizonHaze = pow(fresnel, 2.1) * smoothstep(-0.16, 0.52, ndl);
            vec3 truthHazeColor =
              mix(
                truthColor * vec3(0.96, 1.0, 1.05) + truthAirBlue * (0.01 + dayW * 0.018),
                truthColor * vec3(0.28, 0.42, 0.66) + truthAirBlue * (0.09 + dayW * 0.08),
                referenceCloudLook
              );
            truthColor = mix(
              truthColor,
              truthHazeColor,
              truthHorizonHaze * mix(mix(0.05, 0.12, referenceCloudLook), mix(0.09, 0.18, referenceCloudLook), closeStage)
            );
            vec3 truthDayBlurTiny = (
              texture2D(dayMap, vUv + vec2(0.00045, 0.00022)).rgb +
              texture2D(dayMap, vUv - vec2(0.00045, 0.00022)).rgb
            ) * 0.5;
            vec3 truthDayMicroBlur = (
              texture2D(dayMap, vUv + vec2(0.00022, -0.00011)).rgb +
              texture2D(dayMap, vUv - vec2(0.00022, -0.00011)).rgb
            ) * 0.5;
            float truthCloseDetailGate = dayW * (0.42 + closeStage * 0.58) * (1.0 - truthHorizonHaze * 0.82);
            truthColor += (truthDayTexRaw - truthDayBlurTiny) * truthCloseDetailGate * 0.052;
            truthColor += (truthDayTexRaw - truthDayMicroBlur) * truthCloseDetailGate * 0.032;
            float truthOceanFresnelDark = pow(fresnel, 2.0) *
              truthOceanAlbedoMask *
              smoothstep(-0.12, 0.5, ndl);
            truthColor *= mix(
              vec3(1.0),
              vec3(0.68, 0.78, 0.90),
              truthOceanFresnelDark * 0.20
            );
            vec2 truthCloudUv = vec2(
              fract(vUv.x + cloudOffset + ${SURFACE_CLOUD_TEXTURE_ART_OFFSET_X.toFixed(3)}),
              fract(vUv.y + cloudOffset * 0.18 + ${SURFACE_CLOUD_TEXTURE_ART_OFFSET_Y.toFixed(3)})
            );
            float truthCloudRaw = sampleCloud(truthCloudUv);
            float truthCloudCaster = smoothstep(0.42, 0.76, truthCloudRaw);
            vec2 truthLightTangentUv = vec2(dot(l, tangentA), dot(l, tangentB));
            float truthLightTangentLen = max(length(truthLightTangentUv), 0.001);
            truthLightTangentUv /= truthLightTangentLen;
            float truthCloudShadowEnable = step(0.001, cloudShadowOpacity);
            float truthLowSunShadow = 1.0 - smoothstep(0.28, 0.78, max(ndl, 0.0));

            if (lowCostReferenceCloudLook > 0.5) {
              float refHorizonFade = smoothstep(0.58, 1.0, fresnel);
              float refCloudLight = pow(max(0.9 * ndl + 0.1, 0.0), 0.5);
              vec2 refLightStep = truthLightTangentUv * (0.003 + truthLowSunShadow * 0.005);
              vec2 refSoftStep = vec2(0.0018, 0.00092);
              float refCloudSoftRaw = (
                truthCloudRaw +
                sampleCloud(vec2(fract(truthCloudUv.x + refSoftStep.x), clamp(truthCloudUv.y + refSoftStep.y, 0.001, 0.999))) +
                sampleCloud(vec2(fract(truthCloudUv.x - refSoftStep.x), clamp(truthCloudUv.y - refSoftStep.y, 0.001, 0.999))) +
                sampleCloud(vec2(fract(truthCloudUv.x + refSoftStep.y), clamp(truthCloudUv.y - refSoftStep.x, 0.001, 0.999))) +
                sampleCloud(vec2(fract(truthCloudUv.x - refSoftStep.y), clamp(truthCloudUv.y + refSoftStep.x, 0.001, 0.999)))
              ) * 0.2;
              float refCloudCompositeRaw = mix(truthCloudRaw, refCloudSoftRaw, 0.42);
              vec2 refSeaUv = vec2(
                fract(truthCloudUv.x * 0.54 + 0.17),
                fract(truthCloudUv.y * 0.68 + 0.09)
              );
              float refCloudSeaRaw = (
                sampleCloud(refSeaUv) * 0.46 +
                sampleCloud(vec2(fract(refSeaUv.x + 0.034), fract(refSeaUv.y + 0.016))) * 0.22 +
                sampleCloud(vec2(fract(refSeaUv.x - 0.028), fract(refSeaUv.y - 0.021))) * 0.20 +
                refCloudSoftRaw * 0.12
              );
              float refCloudSea = smoothstep(0.22, 0.64, refCloudSeaRaw + refCloudSoftRaw * 0.24);
              float refCloudSeaBreakup = smoothstep(
                0.18,
                0.86,
                sampleCloud(vec2(fract(refSeaUv.x * 1.7 + 0.31), fract(refSeaUv.y * 1.45 + 0.27))) * 0.58 +
                  sampleCloud(vec2(fract(refSeaUv.x * 2.4 - 0.19), fract(refSeaUv.y * 2.1 + 0.08))) * 0.42
              );
              refCloudSea *= mix(0.54, 1.0, refCloudSeaBreakup);
              refCloudCompositeRaw = max(refCloudCompositeRaw, refCloudSea * 0.82);
              float refCloudTowardLight = sampleCloud(vec2(
                fract(truthCloudUv.x + refLightStep.x),
                fract(truthCloudUv.y + refLightStep.y * 0.62)
              ));
              float refCloudBehind = sampleCloud(vec2(
                fract(truthCloudUv.x - refLightStep.x * 0.62),
                fract(truthCloudUv.y - refLightStep.y * 0.62 * 0.62)
              ));
              float refCloudRelief = (refCloudCompositeRaw - refCloudTowardLight) * 0.55;
              float refCloudColumn = clamp(refCloudCompositeRaw * 0.48 + refCloudTowardLight * 0.34 + refCloudBehind * 0.18, 0.0, 1.0);
              float refVolumeColumn = 0.0;
              float refVolumeEdge = 0.0;
              for (int refVolumeStepIndex = 0; refVolumeStepIndex < 3; refVolumeStepIndex += 1) {
                float refVolumeStep = float(refVolumeStepIndex);
                float refVolumeT = refVolumeStep + 0.46;
                vec2 refVolumeUv = vec2(
                  fract(truthCloudUv.x + refLightStep.x * refVolumeT * 0.72),
                  fract(truthCloudUv.y + refLightStep.y * refVolumeT * 0.46)
                );
                float refVolumeSample = sampleCloud(refVolumeUv);
                refVolumeColumn += smoothstep(0.26, 0.82, refVolumeSample) * (0.46 + refVolumeStep * 0.14);
                refVolumeEdge = max(refVolumeEdge, max(refVolumeSample - refCloudCompositeRaw, 0.0));
              }
              float refVolumeMass = smoothstep(0.16, 0.78, max(refCloudCompositeRaw, refCloudColumn));
              float refVolumeTransmittance = exp(-refVolumeColumn * refVolumeMass * (0.74 + truthLowSunShadow * 0.38));
              float refVolumeSelfShadow = (1.0 - refVolumeTransmittance) * refVolumeMass;
              float refVolumeForward = pow(max(dot(v, l), 0.0), 2.4) *
                refVolumeMass *
                refVolumeTransmittance *
                dayW *
                (0.075 + truthLowSunShadow * 0.045);
              float refCloudSelfShadow = clamp(
                smoothstep(0.44, 0.8, refCloudTowardLight) * truthLowSunShadow * 0.26 +
                max(refCloudTowardLight - refCloudCompositeRaw, 0.0) * 0.74 +
                smoothstep(0.54, 0.9, refCloudColumn) * 0.18 +
                refVolumeSelfShadow * 0.24 +
                refCloudSea * truthLowSunShadow * 0.06,
                0.0,
                0.62
              );
              float refCloudAlpha =
                pow(clamp(refCloudCompositeRaw, 0.0, 1.0), 0.74) *
                cloudOpacity *
                0.22 *
                smoothstep(-0.16, 0.52, ndl) *
                smoothstep(0.09, 0.38, refCloudCompositeRaw);
              refCloudAlpha *= mix(1.0, 0.16, refHorizonFade);
              refCloudAlpha = clamp(refCloudAlpha, 0.0, 0.18);
              refCloudAlpha *= mix(0.58, 0.74, refCloudSea);

              vec3 refCloudLit = mix(
                vec3(0.52, 0.64, 0.76),
                vec3(0.76, 0.84, 0.84),
                refCloudLight
              );
              refCloudLit *= mix(0.86, 1.0, clamp(refCloudRelief * 0.85 + 0.68, 0.0, 1.0));
              vec3 refCloudShadow = refCloudLit * mix(
                vec3(0.48, 0.56, 0.68),
                vec3(0.60, 0.68, 0.78),
                refCloudLight
              );
              vec3 refCloudColor = mix(refCloudLit, refCloudShadow, refCloudSelfShadow);
              refCloudColor += vec3(0.78, 0.88, 1.0) *
                max(refCloudRelief, 0.0) *
                smoothstep(0.18, 0.82, refCloudCompositeRaw) *
                0.06;
              refCloudColor += vec3(0.66, 0.82, 1.0) *
                (refVolumeForward + refVolumeEdge * 0.08) *
                smoothstep(0.18, 0.82, refCloudCompositeRaw);
              refCloudColor = mix(
                refCloudColor,
                vec3(0.70, 0.78, 0.78) * (0.82 + refCloudLight * 0.18),
                refCloudSea * 0.34
              );
              refCloudColor = mix(
                refCloudColor,
                truthAirBlue * (0.34 + dayW * 0.28) + refCloudColor * vec3(0.34, 0.5, 0.78),
                refHorizonFade * 0.84
              );

              float refLandLift = smoothstep(0.18, 0.68, truthDayLuma) *
                (1.0 - truthOceanAlbedoMask * 0.52) *
                (1.0 - refHorizonFade * 0.28);
              truthColor = mix(
                truthColor,
                truthColor * vec3(1.10, 1.08, 1.04) + vec3(0.018, 0.020, 0.018),
                refLandLift * dayW * mix(0.12, 0.18, 1.0 - refCloudSea)
              );

              float refContactShadow =
                smoothstep(0.28, 0.66, refCloudCompositeRaw) *
                dayW *
                truthCloudShadowEnable *
                cloudShadowOpacity *
                0.16 *
                (1.0 - truthOceanAlbedoMask * 0.55);

              float refCastReach =
                mix(0.00004, 0.00014, truthLowSunShadow) *
                (1.0 - smoothstep(0.50, 0.88, fresnel));
              vec2 refCastUv = vec2(
                fract(truthCloudUv.x - truthLightTangentUv.x * refCastReach),
                clamp(truthCloudUv.y - truthLightTangentUv.y * refCastReach, 0.001, 0.999)
              );
              float refCastCloudSoft = (
                sampleCloud(refCastUv) * 0.58 +
                sampleCloud(vec2(fract(refCastUv.x + 0.00036), clamp(refCastUv.y + 0.00018, 0.001, 0.999))) * 0.18 +
                sampleCloud(vec2(fract(refCastUv.x - 0.00036), clamp(refCastUv.y - 0.00018, 0.001, 0.999))) * 0.18 +
                sampleCloud(vec2(fract(refCastUv.x + 0.00062), clamp(refCastUv.y - 0.00032, 0.001, 0.999))) * 0.06
              );
              float refCastShadow = smoothstep(0.38, 0.72, refCastCloudSoft) *
                dayW *
                truthCloudShadowEnable *
                cloudShadowOpacity *
                0.13 *
                (1.0 - smoothstep(0.62, 0.94, fresnel)) *
                (1.0 - truthOceanAlbedoMask * 0.45);
              float refGroundShadow = refContactShadow + refCastShadow;

              float refSurfaceLuma = dot(truthColor, vec3(0.299, 0.587, 0.114));
              float brightLandShadowReadability =
                smoothstep(0.24, 0.72, refSurfaceLuma) *
                (1.0 - truthOceanAlbedoMask * 0.35);
              refGroundShadow *= mix(0.82, 1.04, brightLandShadowReadability);
              float refOverWhite = smoothstep(0.28, 0.66, refSurfaceLuma);
              truthColor = mix(
                truthColor,
                truthColor * vec3(0.74, 0.84, 0.96),
                refOverWhite * (0.16 + refHorizonFade * 0.2)
              );
              truthColor *= mix(vec3(1.0), mix(vec3(0.68, 0.76, 0.88), vec3(0.58, 0.66, 0.78), truthLowSunShadow), refGroundShadow);
              truthColor -= truthDayTex * refGroundShadow * 0.018;
              float refCloudMist =
                dayW *
                smoothstep(-0.24, 0.62, ndl) *
                (1.0 - smoothstep(0.94, 1.0, fresnel)) *
                (0.10 + refCloudSea * 0.18 + smoothstep(0.20, 0.62, refCloudSeaRaw) * 0.10);
              truthColor = mix(
                truthColor,
                mix(truthColor, vec3(0.56, 0.66, 0.70), 0.68),
                refCloudMist * 0.76
              );
              float refCloudSeaAlpha =
                refCloudSea *
                dayW *
                smoothstep(-0.18, 0.58, ndl) *
                mix(0.30, 0.14, refHorizonFade);
              float refBroadDeckAlpha =
                dayW *
                smoothstep(-0.16, 0.62, ndl) *
                (1.0 - smoothstep(0.74, 0.98, fresnel)) *
                (0.18 + refCloudSea * 0.16 + smoothstep(0.30, 0.72, refCloudSeaRaw) * 0.075);
              vec3 refBroadCloudColor = mix(refCloudColor * vec3(0.70, 0.78, 0.82), vec3(0.44, 0.54, 0.58), 0.62);
              truthColor = mix(
                truthColor,
                refBroadCloudColor,
                clamp(max(max(refCloudAlpha, refCloudSeaAlpha), refBroadDeckAlpha), 0.0, 0.26)
              );

              float refAirPath =
                smoothstep(0.46, 0.98, fresnel) *
                smoothstep(-0.18, 0.62, ndl);
              float refAirCore = pow(refAirPath, 1.25) * (1.0 - smoothstep(0.992, 1.0, fresnel));
              float refCompressedLuma = dot(truthColor, vec3(0.299, 0.587, 0.114));
              vec3 refAirColor = mix(vec3(0.10, 0.17, 0.28), vec3(0.42, 0.60, 0.78), dayW);
              truthColor = mix(
                truthColor,
                mix(vec3(refCompressedLuma) * vec3(0.66, 0.76, 0.90), refAirColor, 0.46),
                refAirCore * 0.46
              );
              float refCloudAirglow =
                refCloudSea *
                smoothstep(0.48, 0.95, fresnel) *
                (1.0 - smoothstep(0.992, 1.0, fresnel)) *
                smoothstep(-0.20, 0.62, ndl);
              truthColor += vec3(0.026, 0.052, 0.052) * refCloudAirglow * dayW;
              truthColor += vec3(0.018, 0.034, 0.024) * refCloudAirglow * (0.45 + dayW * 0.55);
              float refVisibleAirglowShelf =
                smoothstep(0.43, 0.93, fresnel) *
                (1.0 - smoothstep(0.997, 1.0, fresnel)) *
                smoothstep(-0.24, 0.68, ndl);
              float refThinKarmanBand =
                smoothstep(0.70, 0.985, fresnel) *
                (1.0 - smoothstep(0.999, 1.0, fresnel)) *
                smoothstep(-0.30, 0.76, ndl);
              truthColor += vec3(0.034, 0.078, 0.104) *
                refVisibleAirglowShelf *
                (0.30 + dayW * 0.28 + refCloudSea * 0.20);
              truthColor += vec3(0.024, 0.030, 0.016) *
                refVisibleAirglowShelf *
                (0.12 + refCloudMist * 0.22);
              truthColor += vec3(0.020, 0.086, 0.200) *
                refThinKarmanBand *
                (0.24 + dayW * 0.28);
              truthColor = mix(
                truthColor,
                truthColor * vec3(1.10, 1.13, 1.12) + vec3(0.026, 0.036, 0.032),
                refCloudAirglow * (0.08 + dayW * 0.07)
              );
              truthColor = mix(
                truthColor,
                truthColor * vec3(0.66, 0.76, 0.90),
                refAirPath * 0.18
              );

              float refFinalLuma = dot(truthColor, vec3(0.299, 0.587, 0.114));
              float refColorDiscipline = clamp(0.018 + dayW * 0.012 + refOverWhite * 0.02, 0.0, 0.06);
              truthColor = mix(
                truthColor,
                vec3(refFinalLuma) * vec3(0.82, 0.9, 1.0),
                refColorDiscipline
              );
              vec3 refKnee = vec3(0.62);
              truthColor = truthColor / (1.0 + max(truthColor - refKnee, vec3(0.0)) * 0.82);
              truthColor *= 0.91;
              gl_FragColor = vec4(max(truthColor, vec3(0.0)), 1.0);
              return;
            }

            float truthShadowReach = mix(
              0.0035 + truthLowSunShadow * 0.006,
              0.0045 + truthLowSunShadow * 0.008,
              referenceCloudLook
            ) * (0.50 + closeStage * 0.22);
            vec2 truthShadowUvNear = vec2(
              fract(truthCloudUv.x - truthLightTangentUv.x * truthShadowReach * 0.52),
              fract(truthCloudUv.y - truthLightTangentUv.y * truthShadowReach * 0.52 * 0.62)
            );
            vec2 truthShadowUvMid = vec2(
              fract(truthCloudUv.x - truthLightTangentUv.x * truthShadowReach),
              fract(truthCloudUv.y - truthLightTangentUv.y * truthShadowReach * 0.62)
            );
            vec2 truthShadowUvFar = vec2(
              fract(truthCloudUv.x - truthLightTangentUv.x * truthShadowReach * 1.72),
              fract(truthCloudUv.y - truthLightTangentUv.y * truthShadowReach * 1.72 * 0.62)
            );
            float truthShadowColumn = 0.0;
            float truthShadowEdge = 0.0;
            if (hasCloudShadowAtlas > 0.5) {
              vec4 truthProjectedAtlasNear = sampleCloudShadowAtlas(truthShadowUvNear);
              vec4 truthProjectedAtlasMid = sampleCloudShadowAtlas(truthShadowUvMid);
              vec4 truthProjectedAtlasFar = sampleCloudShadowAtlas(truthShadowUvFar);
              truthShadowColumn =
                truthProjectedAtlasNear.r * 0.22 +
                truthProjectedAtlasMid.r * 0.54 +
                truthProjectedAtlasFar.r * 0.24;
              truthShadowEdge = max(
                max(truthProjectedAtlasNear.b, truthProjectedAtlasMid.b),
                max(truthProjectedAtlasFar.b, abs(truthProjectedAtlasNear.r - truthProjectedAtlasFar.r) * 0.72)
              );
            } else {
              float truthShadowNear = sampleCloud(truthShadowUvNear);
              float truthShadowMid = sampleCloud(truthShadowUvMid);
              float truthShadowFar = sampleCloud(truthShadowUvFar);
              truthShadowColumn = truthShadowNear * 0.5 + truthShadowMid * 0.34 + truthShadowFar * 0.16;
              truthShadowEdge = abs(truthShadowNear - truthShadowFar);
            }
            float truthProjectedGroundShadow = smoothstep(mix(0.12, 0.08, referenceCloudLook), mix(0.48, 0.38, referenceCloudLook), truthShadowColumn) *
              dayW *
              truthCloudShadowEnable *
              cloudShadowOpacity *
              mix(mix(0.72, 0.98, referenceCloudLook), mix(1.62, 2.28, referenceCloudLook), truthLowSunShadow);
            truthProjectedGroundShadow *= mix(1.0, mix(1.42, 1.84, referenceCloudLook), smoothstep(0.03, 0.28, truthShadowEdge));
            truthProjectedGroundShadow *= 1.0 - smoothstep(0.84, 1.0, fresnel) * mix(0.58, 0.76, referenceCloudLook);
            vec2 truthCastShadowUv = vec2(
              fract(truthCloudUv.x - truthLightTangentUv.x * (0.048 + truthLowSunShadow * 0.072) * (0.9 + closeStage * 0.52)),
              fract(truthCloudUv.y - truthLightTangentUv.y * (0.048 + truthLowSunShadow * 0.072) * (0.9 + closeStage * 0.52) * 0.62)
            );
            float truthCastShadowSource = sampleCloud(truthCastShadowUv);
            float truthReadableCastShadow =
              smoothstep(0.36, 0.76, truthCastShadowSource) *
              (1.0 - smoothstep(0.28, 0.7, truthCloudRaw) * 0.52) *
              smoothstep(0.06, 0.78, dayW) *
              (1.0 - smoothstep(0.72, 1.0, fresnel) * 0.78) *
              cloudShadowOpacity *
              referenceCloudLook;
            truthProjectedGroundShadow = max(truthProjectedGroundShadow, truthReadableCastShadow * 0.74);

            vec3 truthCloudTex = texture2D(cloudMap, truthCloudUv).rgb;
            vec4 truthCloudAtlas = sampleCloudShadowAtlas(truthCloudUv);
            float truthCloudLight = pow(max(0.9 * ndl + 0.1, 0.0), 0.5);
            truthCloudLight = max(truthCloudLight, homeLiteStrength * deepNightW * 0.22);
            float truthCloudMass = pow(clamp(dot(truthCloudTex, vec3(1.0)) / 3.0, 0.0, 1.0), 0.52);
            float truthCloudAlpha = truthCloudMass * pow(truthCloudLight, 0.35);
            float truthCloudDayGate = smoothstep(-0.16, 0.52, ndl);
            float truthCloudPresentationGate = max(
              truthCloudDayGate,
              deepNightW * (0.28 + closeStage * 0.16)
            );
            truthCloudAlpha *= cloudOpacity * mix(truthCloudDayGate, truthCloudPresentationGate, homeLiteStrength);
            truthCloudAlpha *= smoothstep(0.04, 0.32, truthCloudRaw);
            float truthLimbBlueTakeover =
              smoothstep(mix(0.68, 0.42, referenceCloudLook), 1.0, fresnel) *
              smoothstep(-0.18, 0.68, ndl);
            float truthCloudLimbAlpha = mix(0.34, 0.035, referenceCloudLook);
            truthCloudAlpha *= mix(1.0, truthCloudLimbAlpha, truthLimbBlueTakeover);
            truthCloudAlpha *= mix(1.0, 2.1, referenceCloudLook * (1.0 - truthLimbBlueTakeover));
            truthCloudAlpha = clamp(truthCloudAlpha, 0.0, mix(0.88, 0.92, referenceCloudLook));

            float truthCloudNear = sampleCloud(vec2(
              fract(truthCloudUv.x + truthLightTangentUv.x * 0.0038),
              fract(truthCloudUv.y + truthLightTangentUv.y * 0.0038 * 0.62)
            ));
            float truthCloudFar = sampleCloud(vec2(
              fract(truthCloudUv.x + truthLightTangentUv.x * 0.011),
              fract(truthCloudUv.y + truthLightTangentUv.y * 0.011 * 0.62)
            ));
            float truthCloudVeryFar = sampleCloud(vec2(
              fract(truthCloudUv.x + truthLightTangentUv.x * 0.022),
              fract(truthCloudUv.y + truthLightTangentUv.y * 0.022 * 0.62)
            ));
            float truthCloudBehind = sampleCloud(vec2(
              fract(truthCloudUv.x - truthLightTangentUv.x * 0.006),
              fract(truthCloudUv.y - truthLightTangentUv.y * 0.006 * 0.62)
            ));
            float truthCloudRelief = truthCloudRaw - truthCloudNear;
            float truthCloudLongRelief = truthCloudRaw - truthCloudFar;
            vec2 truthCloudHeightStep = vec2(0.0018, 0.00095);
            float truthCloudHeightDx =
              sampleCloud(vec2(fract(truthCloudUv.x + truthCloudHeightStep.x), truthCloudUv.y)) -
              sampleCloud(vec2(fract(truthCloudUv.x - truthCloudHeightStep.x), truthCloudUv.y));
            float truthCloudHeightDy =
              sampleCloud(vec2(truthCloudUv.x, fract(truthCloudUv.y + truthCloudHeightStep.y))) -
              sampleCloud(vec2(truthCloudUv.x, fract(truthCloudUv.y - truthCloudHeightStep.y)));
            vec3 truthCloudHeightNormal = normalize(
              n -
              tangentA * truthCloudHeightDx * 8.5 * referenceCloudLook -
              tangentB * truthCloudHeightDy * 8.5 * referenceCloudLook
            );
            float truthCloudBumpLight = smoothstep(-0.18, 0.72, dot(truthCloudHeightNormal, l));
            float truthCloudColumnOcclusion = smoothstep(
              0.38,
              0.86,
              truthCloudNear * 0.44 + truthCloudFar * 0.36 + truthCloudVeryFar * 0.2
            );
            truthCloudColumnOcclusion = hasCloudShadowAtlas > 0.5
              ? max(truthCloudColumnOcclusion, truthCloudAtlas.g)
              : truthCloudColumnOcclusion;
            float truthCloudForwardBlock = smoothstep(0.05, 0.38, truthCloudFar - truthCloudRaw);
            float truthCloudEdgeHighlight = max(truthCloudRaw - truthCloudBehind, 0.0);
            truthCloudEdgeHighlight = hasCloudShadowAtlas > 0.5
              ? max(truthCloudEdgeHighlight, truthCloudAtlas.b)
              : truthCloudEdgeHighlight;
            float truthCloudSelfShadow = clamp(
              truthLowSunShadow * truthCloudCaster * mix(0.52, 0.84, referenceCloudLook) +
              truthCloudForwardBlock * truthLowSunShadow * mix(0.72, 1.08, referenceCloudLook) +
              truthCloudColumnOcclusion * smoothstep(0.18, 0.72, truthCloudMass) * (mix(0.34, 0.58, referenceCloudLook) + truthLowSunShadow * mix(0.56, 0.82, referenceCloudLook)) +
              max(-truthCloudRelief, 0.0) * mix(3.25, 5.2, referenceCloudLook) +
              max(-truthCloudLongRelief, 0.0) * mix(1.9, 3.35, referenceCloudLook) +
              smoothstep(0.42, 0.86, truthCloudMass) * truthLowSunShadow * mix(0.0, 0.34, referenceCloudLook) +
              truthProjectedGroundShadow * mix(0.28, 0.54, referenceCloudLook),
              0.0,
              mix(0.94, 0.98, referenceCloudLook)
            );
            truthCloudSelfShadow *= mix(1.0, 0.18, homeLiteStrength);
            vec3 truthCloudTopColor = mix(
              vec3(0.54, 0.62, 0.76),
              vec3(1.0, 0.975, 0.92),
              truthCloudLight
            );
            truthCloudTopColor *= mix(0.58, 1.3, truthCloudMass);
            truthCloudTopColor *= mix(0.62, 1.18, clamp(truthCloudRelief * 3.0 + 0.58, 0.0, 1.0));
            truthCloudTopColor *= mix(0.62, 1.14, mix(1.0, truthCloudBumpLight, referenceCloudLook));
            vec3 truthCloudShadowTint = mix(
              mix(vec3(0.2, 0.31, 0.54), vec3(0.08, 0.18, 0.38), referenceCloudLook),
              mix(vec3(0.5, 0.58, 0.7), vec3(0.32, 0.42, 0.62), referenceCloudLook),
              truthCloudLight
            );
            truthCloudShadowTint = mix(truthCloudShadowTint, vec3(0.76, 0.81, 0.88), homeLiteStrength);
            vec3 truthCloudColor = mix(
              truthCloudTopColor,
              truthCloudTopColor * truthCloudShadowTint,
              truthCloudSelfShadow
            );
            float truthCloudDepthShade = clamp(
              (
                truthCloudColumnOcclusion * 0.7 +
                truthCloudForwardBlock * 0.68 +
                (1.0 - truthCloudBumpLight) * smoothstep(0.2, 0.82, truthCloudMass) * 0.74 +
                truthLowSunShadow * truthCloudCaster * 0.38 +
                smoothstep(0.52, 0.92, truthCloudMass) * 0.36
              ) * referenceCloudLook,
              0.0,
              0.92
            );
            truthCloudColor = mix(
              truthCloudColor,
              truthCloudColor * vec3(0.3, 0.42, 0.68),
              truthCloudDepthShade
            );
            truthCloudColor *= mix(
              1.0,
              0.7,
              truthCloudForwardBlock * smoothstep(0.2, 0.78, truthCloudMass) * (0.35 + truthLowSunShadow * 0.65)
            );
            truthCloudColor += vec3(0.92, 0.97, 1.0) *
              (truthCloudEdgeHighlight * 0.24 + max(truthCloudRelief, 0.0) * 0.24) *
              smoothstep(0.16, 0.82, truthCloudMass);
            truthCloudColor = mix(
              truthCloudColor,
              truthAirBlue * (0.44 + dayW * 0.38) + truthCloudColor * vec3(0.18, 0.34, 0.68),
              max(truthHorizonHaze * mix(0.26, 0.54, referenceCloudLook), truthLimbBlueTakeover * mix(0.52, 0.94, referenceCloudLook))
            );
            float truthVisibleGroundShadow = clamp(
              truthProjectedGroundShadow *
              (1.0 - smoothstep(0.16, 0.52, truthCloudRaw) * mix(0.74, 0.12, referenceCloudLook)) *
              (1.0 - truthCloudAlpha * mix(0.18, 0.02, referenceCloudLook)),
              0.0,
              mix(0.62, 0.72, referenceCloudLook)
            );
            vec3 truthGroundShadowTint = mix(
              vec3(0.48, 0.6, 0.78),
              vec3(0.18, 0.3, 0.52),
              truthLowSunShadow
            );
            truthColor *= mix(vec3(1.0), truthGroundShadowTint, truthVisibleGroundShadow * mix(1.0, 0.92, referenceCloudLook));
            truthColor -= truthDayTex * truthVisibleGroundShadow * (mix(0.06, 0.085, referenceCloudLook) + truthLowSunShadow * mix(0.09, 0.12, referenceCloudLook));
            truthColor = mix(
              truthColor,
              truthColor * vec3(0.48, 0.7, 1.16) + truthAirBlue * (0.055 + dayW * 0.07),
              truthLimbBlueTakeover * 0.04
            );
            truthColor = mix(truthColor, truthCloudColor, truthCloudAlpha);

            float truthFinalLuma = dot(truthColor, vec3(0.299, 0.587, 0.114));
            float nasaFilmDesat = mix(0.035, 0.08, closeStage) * smoothstep(-0.42, 0.9, ndl);
            float truthColorDiscipline = clamp(
              nasaFilmDesat +
              dayW * mix(0.02, 0.055, closeStage) +
              dryAlbedoSignal * closeStage * 0.04 +
              vegetationSignal * closeStage * 0.02 +
              truthOceanAlbedoMask * 0.03,
              0.0,
              0.18
            );
            truthColor = mix(
              truthColor,
              vec3(truthFinalLuma) * vec3(0.88, 0.9, 0.92),
              truthColorDiscipline
            );
            truthColor *= mix(1.0, 1.02, closeStage);
            vec3 truthKnee = vec3(mix(0.84, 0.64, closeStage));
            truthColor = truthColor / (1.0 + max(truthColor - truthKnee, vec3(0.0)) * mix(0.78, 1.26, closeStage));
            gl_FragColor = vec4(max(truthColor, vec3(0.0)), 1.0);
            return;

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
              (rawDayTex - dayBlur) * (0.08 + closeStage * 0.02) +
              (rawDayTex - dayMicroBlur) * (0.015 + closeStage * 0.035) +
              surfaceDetail * 0.008;
            float dayTexLuma = dot(dayTex, vec3(0.299, 0.587, 0.114));
            dayTex += (microGrain - 0.5) * (0.002 + closeStage * 0.006) * (0.42 + dayTexLuma);
            dayTex += (orthoTextureDetail - 0.5) * closeStage * 0.004 * smoothstep(0.2, 0.76, dayTexLuma);
            float farTextureSoftness = 1.0 - closeStage;
            dayTex = mix(dayTex, dayBlur, farTextureSoftness * 0.16);
            dayTex = mix(vec3(dayTexLuma), dayTex, 0.985);
            dayTex = clamp(dayTex, vec3(0.0), vec3(1.08));
            float closeDayHighlight = smoothstep(0.38, 0.82, dayTexLuma) * closeStage;
            dayTex *= mix(1.0, 0.9, closeDayHighlight);
            vec3 nightTex = pow(texture2D(nightMap, vUv).rgb, vec3(0.9));
            vec2 cloudUv = vec2(
              fract(vUv.x + cloudOffset + ${SURFACE_CLOUD_TEXTURE_ART_OFFSET_X.toFixed(3)}),
              fract(vUv.y + cloudOffset * 0.18 + ${SURFACE_CLOUD_TEXTURE_ART_OFFSET_Y.toFixed(3)})
            );
            vec2 deckUv = cloudUv;
            float closeExposureDiscipline = mix(1.0, 0.96, closeStage);
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
              cloudRaw + (cloudRaw - cloudBlur) * (0.08 + closeStage * 0.08),
              0.0,
              1.0
            );
            cloudSharp = mix(cloudSharp, cloudBlur, 0.16 + farTextureSoftness * 0.18);
            float deckWeather = smoothstep(0.26, 0.74, deckCoverage + deckThickness * 0.48 + deckHighCap * 0.18);
            float deckDenseWeather = smoothstep(0.58, 0.9, deckCoverage * 0.64 + deckThickness * 0.78 + deckHighCap * 0.22);
            float unifiedCloudSharp = mix(
              cloudSharp,
              clamp(max(cloudSharp, deckCoverage * 0.36 + deckThickness * 0.22 + deckHighCap * 0.12), 0.0, 1.0),
              hasCloudDeckMap * 0.24
            );
            float cloudRelief = (cloudSharp - sampleCloud(cloudUv + vec2(0.0064, -0.0042))) * 0.42;
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
            float visibleCloudCore = smoothstep(0.34, 0.66, cloudSharp * mix(0.92, 1.08, cloudMicro)) *
              smoothstep(0.14, 0.34, cloudBlur);
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
            vec2 cloudNormalStep = vec2(0.00072, 0.00036);
            float cloudFineX = sampleCloud(vec2(fract(cloudUv.x + cloudNormalStep.x), cloudUv.y));
            float cloudFineY = sampleCloud(vec2(cloudUv.x, fract(cloudUv.y + cloudNormalStep.y)));
            vec2 deckNormalStep = vec2(0.00062, 0.00031);
            float deckThicknessX = clamp(
              texture2D(cloudDeckMap, vec2(fract(deckUv.x + deckNormalStep.x), deckUv.y)).g,
              0.0,
              1.0
            );
            float deckThicknessY = clamp(
              texture2D(cloudDeckMap, vec2(deckUv.x, fract(deckUv.y + deckNormalStep.y))).g,
              0.0,
              1.0
            );
            float cloudNormalGate = lowCostReferenceCloudLook *
              smoothstep(0.1, 0.72, max(max(cloudSharp, deckCoverage), deckThickness));
            vec3 cloudSurfaceNormal = normalize(vec3(
              (deckThickness - deckThicknessX) * hasCloudDeckMap * 4.2 + (cloudSharp - cloudFineX) * 0.8,
              (deckThickness - deckThicknessY) * hasCloudDeckMap * 3.8 + (cloudSharp - cloudFineY) * 0.68,
              1.0
            ));
            vec3 cloudLightNormal = normalize(vec3(lightTangentUv.x, lightTangentUv.y, max(ndl, 0.0) + 0.2));
            float cloudNormalLight = clamp(dot(cloudSurfaceNormal, cloudLightNormal), 0.0, 1.0);
            float cloudNormalShadow = smoothstep(0.14, 0.82, 1.0 - cloudNormalLight) *
              cloudNormalGate *
              (0.18 + lowSunShadow * 0.16);
            float cloudNormalHighlight = smoothstep(0.54, 0.95, cloudNormalLight) *
              cloudNormalGate *
              dayW;
            float cloudCoreUnit = clamp(cloudCore / max(cloudOpacity, 0.001), 0.0, 1.0);
            float shadowDistance = mix(0.045, 0.09, cloudCoreUnit);
            float shadowOffset = (
              0.0002 +
              lowSunShadow * mix(0.00018, 0.00025, lowCostReferenceCloudLook) +
              closeStage * 0.00008
            ) * (0.45 + lightTangentLen * 0.55);
            vec2 shadowUv = vec2(
              fract(cloudUv.x - lightTangentUv.x * shadowOffset * shadowDistance),
              fract(cloudUv.y - lightTangentUv.y * shadowOffset * shadowDistance * 0.62)
            );
            vec2 deckShadowUv = vec2(
              fract(deckUv.x - lightTangentUv.x * shadowOffset * shadowDistance * 1.02),
              fract(deckUv.y - lightTangentUv.y * shadowOffset * shadowDistance * 0.64)
            );
            float shadowRaw = sampleCloud(shadowUv);
            vec4 shadowDeck = texture2D(cloudDeckMap, deckShadowUv);
            float visibleCaster = smoothstep(0.18, 0.58, shadowRaw);
            float deckCaster = smoothstep(0.32, 0.74, shadowDeck.r * 0.42 + shadowDeck.g * 0.82 + shadowDeck.a * 0.2) * visibleCaster;
            float shadowSoft =
              shadowRaw * 0.56 +
              sampleCloud(shadowUv + lightTangentUv * 0.0011) * 0.24 +
              sampleCloud(shadowUv - lightTangentUv * 0.0017) * 0.2;
            shadowSoft = mix(shadowSoft, max(shadowSoft * 0.54, deckCaster), hasCloudDeckMap * 0.82);
            vec2 broadShadowUv = vec2(
              fract(cloudUv.x - lightTangentUv.x * shadowOffset * (shadowDistance * 0.72 + lowSunShadow * 0.08)),
              fract(cloudUv.y - lightTangentUv.y * shadowOffset * (shadowDistance * 0.56 + lowSunShadow * 0.055))
            );
            vec4 broadShadowDeck = texture2D(cloudDeckMap, broadShadowUv);
            float broadShadowRaw =
              sampleCloud(broadShadowUv) * 0.45 +
              sampleCloud(broadShadowUv + lightTangentUv * 0.0032) * 0.32 +
              sampleCloud(broadShadowUv - lightTangentUv * 0.0048) * 0.23;
            float broadDirectionalShadow =
              smoothstep(0.22, 0.68, broadShadowRaw * 0.42 + broadShadowDeck.g * hasCloudDeckMap * 0.58) *
              cloudShadowOpacity *
              dayW *
              lowCostReferenceCloudLook *
              (0.03 + lowSunShadow * 0.07) *
              (1.0 - smoothstep(0.28, 0.84, visibleCloudCore) * 0.46);
            float hardCloudShadow = smoothstep(0.34, 0.72, shadowSoft * mix(0.92, 1.08, cloudMicro))
              * cloudShadowOpacity
              * dayW
              * (0.36 + lowSunShadow * 0.38)
              * max(smoothstep(0.42, 0.82, cloudSharp), deckCaster * hasCloudDeckMap);
            float softCloudShadow = smoothstep(0.18, 0.58, shadowSoft)
              * cloudShadowOpacity
              * 0.22
              * dayW
              * (0.54 + lowSunShadow * 0.14);
            softCloudShadow += broadDirectionalShadow * 0.35;
            float thickShadowCaster =
              max(smoothstep(0.48, 0.82, cloudCoreUnit), deckCaster * hasCloudDeckMap) *
              max(smoothstep(0.4, 0.78, unifiedCloudSharp), deckCaster * hasCloudDeckMap) *
              smoothstep(0.18, 0.72, max(cloudRaw, deckCoverage * hasCloudDeckMap));
            thickShadowCaster = max(thickShadowCaster, deckCaster * smoothstep(0.24, 0.72, shadowDeck.g) * hasCloudDeckMap);
            hardCloudShadow *= thickShadowCaster;
            softCloudShadow *= mix(0.36, 1.0, thickShadowCaster);
            float cloudShadow = min(hardCloudShadow + softCloudShadow, 0.16);
            float cloudPresentation = clamp(max(max(cloudSharp, visibleCloudCore), closeFilament * 0.82), 0.0, 1.0);
            vec3 cloudCol = mix(vec3(0.62, 0.68, 0.74), vec3(1.0, 0.985, 0.94), pow(cloudPresentation, 0.72));
            cloudCol += vec3(0.58, 0.64, 0.7) * max(cloudRelief, 0.0);
            cloudCol += vec3(0.44, 0.52, 0.62) * deckHighCap * deckWeather * hasCloudDeckMap * (0.08 + dayW * 0.12);
            cloudCol += vec3(0.62, 0.76, 0.96) * cloudNormalHighlight * (0.08 + closeStage * 0.08);
            float cloudSelfShadow = clamp(
              deckAo * deckDenseWeather * hasCloudDeckMap * (0.58 + closeStage * 0.34) +
              lowSunShadow * cloudBodySource * 0.22 +
              cloudNormalShadow * 0.72,
              0.0,
              0.84
            );
            cloudCol *= mix(vec3(1.0), vec3(0.56, 0.63, 0.74), cloudSelfShadow);
            cloudCol += vec3(0.2, 0.3, 0.48) * cloudAltitude;
            cloudCol -= vec3(0.12, 0.14, 0.18) * max(-cloudRelief, 0.0);
            cloudCol = mix(cloudCol, cloudCol * vec3(0.62, 0.72, 0.88), cloudNormalShadow * 0.18);
            cloudCol *= closeCloudDiscipline;
            vec3 shadowTint = mix(vec3(1.0), vec3(0.62, 0.69, 0.82), clamp(cloudShadow * 1.08, 0.0, 0.42));
            vec3 shadowedDay = dayTex * shadowTint;
            float cloudLitEdge = smoothstep(0.44, 0.86, unifiedCloudSharp) * smoothstep(-0.1, 0.3, ndl);
            vec3 cloudWarmEdge = vec3(1.0, 0.82, 0.54) * cloudLitEdge * (0.12 + cloudAltitude * 0.18) * mix(1.0, 0.54, closeStage);
            float dryLandSignal = smoothstep(0.06, 0.26, max(dayTex.r, dayTex.g) - dayTex.b) *
              smoothstep(0.42, 0.82, dayTexLuma);
            float yellowTerrainSignal =
              smoothstep(0.06, 0.22, dayTex.r + dayTex.g - dayTex.b * 2.0) *
              smoothstep(0.34, 0.82, dayTexLuma) *
              closeStage;
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
              (0.18 + lowSunShadow * 0.22 + closeStage * 0.08) *
              (1.0 - smoothstep(0.18, 0.72, visibleCloudCore) * 0.62);
            visibleCloudShadow = max(visibleCloudShadow, directVisibleShadow);
            visibleCloudShadow = max(visibleCloudShadow, broadDirectionalShadow * 0.24);
            daySurface = mix(
              daySurface,
              daySurface * vec3(0.64, 0.72, 0.86),
              clamp(visibleCloudShadow * mix(0.30, 0.38, lowCostReferenceCloudLook), 0.0, 0.18)
            );
            float daySurfaceLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            vec3 landFineDetail = (rawDayTex - dayMicroBlur) * (0.05 + closeStage * 0.1);
            float exposedSurface = 1.0 - clamp(surfaceCloudBlend * 1.12, 0.0, 1.0);
            daySurface = mix(vec3(daySurfaceLuma), daySurface, 0.985);
            daySurface += landFineDetail * exposedSurface * (0.14 + dryLandSignal * 0.18);
            daySurface += (microGrain - 0.5) * closeStage * 0.005 * (0.28 + daySurfaceLuma);
            daySurface += (orthoTextureDetail - 0.5) * closeStage * 0.006 * exposedSurface * (0.36 + dryLandSignal * 0.58);
            float landMacro = fbmTerrain(vUv * vec2(32.0, 16.0) + vec2(1.7, 4.2));
            float landMeso = fbmTerrain(vUv * vec2(128.0, 64.0) + vec2(3.2, 1.7));
            float landMicro = fbmTerrain(vUv * vec2(512.0, 256.0) + vec2(11.3, 8.1));
            float dryCloseDetail = exposedSurface * closeStage * dryLandSignal * dayW;
            daySurface += (landMacro - 0.5) * dryCloseDetail * 0.012;
            daySurface += (landMeso - 0.5) * dryCloseDetail * 0.012;
            daySurface += (landMicro - 0.5) * dryCloseDetail * 0.004;
            daySurface += terrainRelief * dryCloseDetail * vec3(0.02, 0.022, 0.026);
            daySurfaceLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            daySurface *= mix(1.0, 0.9, dryLandSignal * closeStage);
            daySurface *= mix(1.0, 0.82, smoothstep(0.44, 0.84, daySurfaceLuma) * closeStage);
            daySurface *= mix(vec3(1.0), vec3(0.98, 0.97, 0.94), dryLandSignal * closeStage * 0.14);
            float desertOceanSignal = dayTex.b - max(dayTex.r, dayTex.g) * 0.52;
            float desertOceanMask = smoothstep(0.035, 0.18, desertOceanSignal) *
              (1.0 - clamp(max(cloudMask, cloudCore) * 0.9, 0.0, 0.92));
            float desertSignal =
              smoothstep(0.08, 0.32, max(dayTex.r, dayTex.g) - dayTex.b) *
              smoothstep(0.45, 0.78, dayTexLuma) *
              (1.0 - desertOceanMask) *
              exposedSurface;
            daySurface *= mix(vec3(1.0), vec3(0.72, 0.76, 0.84), max(desertSignal, yellowTerrainSignal) * closeStage * 0.44);
            float compressedDesertLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            daySurface = mix(daySurface, vec3(compressedDesertLuma), desertSignal * closeStage * 0.035);
            daySurfaceLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            float closeBrightSurface = smoothstep(0.26, 0.62, daySurfaceLuma) * closeStage * exposedSurface * dayW;
            float closeHorizonSurface = smoothstep(0.34, 0.88, fresnel) * closeStage * dayW;
            daySurface *= mix(vec3(1.0), vec3(0.76, 0.8, 0.88), closeBrightSurface * 0.24);
            daySurface *= mix(vec3(1.0), vec3(0.84, 0.88, 0.94), closeHorizonSurface * 0.18);
            float closeBrightLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            daySurface = mix(daySurface, vec3(closeBrightLuma), closeBrightSurface * 0.08);
            daySurface *= mix(
              vec3(1.0),
              vec3(0.66, 0.74, 0.86),
              clamp(visibleCloudShadow * 0.24, 0.0, 0.24)
            );
            vec3 photoSurface = rawDayTex + (rawDayTex - dayBlur) * 0.028;
            float photoSurfaceLuma = dot(photoSurface, vec3(0.299, 0.587, 0.114));
            photoSurface = mix(vec3(photoSurfaceLuma), photoSurface, mix(0.9, 0.62, yellowTerrainSignal));
            photoSurface *= mix(1.0, 0.72, smoothstep(0.5, 0.82, photoSurfaceLuma) * closeStage);
            photoSurface *= shadowTint;
            photoSurface *= mix(
              vec3(1.0),
              vec3(0.72, 0.8, 0.92),
              clamp(visibleCloudShadow * 0.22, 0.0, 0.22)
            );
            photoSurface *= mix(vec3(1.0), vec3(0.7, 0.76, 0.86), max(desertSignal * closeStage, yellowTerrainSignal) * 0.34);
            daySurface = mix(daySurface, photoSurface, closeStage * 0.64);
            float finalSurfaceLuma = dot(daySurface, vec3(0.299, 0.587, 0.114));
            float finalYellowCast =
              smoothstep(0.0, 0.18, daySurface.r + daySurface.g - daySurface.b * 2.0) *
              smoothstep(0.22, 0.74, finalSurfaceLuma) *
              closeStage;
            daySurface = mix(
              daySurface,
              vec3(finalSurfaceLuma) * vec3(0.82, 0.86, 0.95),
              finalYellowCast * 0.46
            );
            float dayLight = pow(max(ndl, 0.0), 0.82);
            float grazingSun = pow(
              clamp((ndl + transitionWidth * 1.45) / max(transitionWidth * 2.7, 0.001), 0.0, 1.0),
              1.32
            ) * (1.0 - smoothstep(transitionWidth * 0.55, transitionWidth * 2.4, abs(ndl)));
            vec3 dayCol = daySurface * lightColor * (ambient * 1.34 + (dayLight + grazingSun * 0.25) * sunIntensity) * dayW * 0.94 * closeExposureDiscipline;
            dayCol *= mix(1.0, 0.86, closeHorizonSurface);
            vec3 halfDir = normalize(l + v);
            float oceanSignal = dayTex.b - max(dayTex.r, dayTex.g) * 0.52;
            float oceanCloudVisibility = 1.0 - clamp(
              max(cloudMask, cloudCore) * 0.5 + visibleCloudShadow * 0.18,
              0.0,
              0.78
            );
            float oceanBlueMask =
              smoothstep(0.16, 0.54, rawDayTex.b) *
              smoothstep(0.0, 0.15, rawDayTex.b - max(rawDayTex.r, rawDayTex.g) * 0.7) *
              (1.0 - smoothstep(0.74, 0.96, dayTexLuma));
            float heuristicOceanMask = max(smoothstep(0.035, 0.18, oceanSignal), oceanBlueMask);
            float specularMapRaw = texture2D(specularMap, vUv).r;
            float specularIceGuard =
              1.0 - smoothstep(0.82, 0.98, dayTexLuma) * (1.0 - oceanBlueMask * 0.65);
            float specularWaterMask = smoothstep(0.34, 0.72, specularMapRaw) * specularIceGuard;
            float oceanMask = mix(
              heuristicOceanMask,
              max(heuristicOceanMask * 0.22, specularWaterMask),
              hasSpecularMap
            ) * oceanCloudVisibility;
            float oceanFacing = max(dot(n, halfDir), 0.0);
            float oceanGlint = pow(oceanFacing, 58.0) * oceanMask * dayW * specularStrength * (0.62 + closeStage * 0.58);
            float oceanWideGlint = pow(oceanFacing, 18.0) *
              oceanMask *
              dayW *
              specularStrength *
              (0.12 + closeStage * 0.25) *
              (0.45 + lowSunShadow * 0.72);
            float oceanGoldGlint = pow(oceanFacing, 9.0) *
              oceanMask *
              dayW *
              specularStrength *
              lowSunShadow *
              0.075;
            float oceanGrazingSheen =
              oceanMask *
              dayW *
              smoothstep(0.30, 0.88, fresnel) *
              specularStrength *
              (0.018 + closeStage * 0.048) *
              (0.58 + lowSunShadow * 0.5);
            vec3 oceanSpecular =
              vec3(0.74, 0.86, 1.0) * oceanGlint +
              vec3(0.84, 0.94, 1.0) * oceanWideGlint +
              vec3(1.0, 0.72, 0.38) * oceanGoldGlint +
              vec3(0.62, 0.84, 1.0) * oceanGrazingSheen +
              vec3(1.0, 0.78, 0.48) * oceanGrazingSheen * lowSunShadow * 0.16;
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
            float nightSurfaceCloudGuard = 1.0 - clamp(max(cloudMask, cloudCore) * 0.36, 0.0, 0.32);
            vec3 nightSurfaceAlbedo = mix(rawDayTex, daySurface, 0.28);
            vec3 nightSurfaceReadability =
              (nightSurfaceAlbedo * vec3(0.2, 0.26, 0.36) + vec3(0.008, 0.012, 0.022) * closeStage) *
              nightSurfaceLift *
              deepNightW *
              (0.58 + closeStage * 0.42) *
              nightSurfaceCloudGuard;
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
            vec3 color = dayCol + surfaceFill + nightSurfaceReadability + oceanSpecular + cityCol + moonlitLand + moonlitClouds + twilightFill + terminatorCol + rimCol + edgeLight + lowerAtmosphere + tangentSurfaceScatter;
            vec3 highlightKnee = vec3(mix(0.84, 0.28, closeStage));
            float highlightDiscipline = mix(0.7, 3.1, closeStage);
            color = color / (1.0 + max(color - highlightKnee, vec3(0.0)) * highlightDiscipline);
            color *= mix(1.0, 0.92, closeOnlyStage);
            color = pow(max(color, vec3(0.0)), vec3(1.0));
            color *= 0.96 + (grain(gl_FragCoord.xy) - 0.5) * 0.026;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
    },
    [
      composition.earth.nightIntensity,
      composition.earth.nightSurfaceLift,
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
      quality.tier,
      isHomeLite,
      activeDayTexture,
      activeCloudDeckTexture,
      activeCloudTexture,
      activeSpecularTexture,
      cloudShadowAtlasTexture,
      activeDisplacementTexture,
      activeNormalTexture,
      activeNightTexture,
      cloudDeckTexture,
      displacementTexture,
      normalTexture,
      specularTexture,
      referenceVolumetricSurfaceClouds
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
    earthMaterial.uniforms.nightSurfaceLift.value = composition.earth.nightSurfaceLift;
    earthMaterial.uniforms.specularStrength.value = composition.earth.specularStrength;
    earthMaterial.uniforms.cloudOpacity.value =
      shouldUseTextureClouds
        ? composition.earth.cloudOpacity * SURFACE_CLOUD_OPACITY_MULTIPLIER
        : 0;
    earthMaterial.uniforms.cloudShadowOpacity.value =
      shouldUseTextureClouds && !isHomeLite
        ? composition.earth.cloudOpacity *
          SURFACE_CLOUD_SHADOW_MULTIPLIER *
          (referenceVolumetricSurfaceClouds ? 1.42 : 1)
        : 0;
    earthMaterial.uniforms.referenceVolumetricSurfaceClouds.value = referenceVolumetricSurfaceClouds ? 1 : 0;
    earthMaterial.uniforms.cloudShadowAtlasMap.value = cloudShadowAtlasTexture ?? activeCloudTexture;
    earthMaterial.uniforms.hasCloudShadowAtlas.value = cloudShadowAtlasTexture ? 1 : 0;
    earthMaterial.uniforms.specularMap.value = activeSpecularTexture;
    earthMaterial.uniforms.hasSpecularMap.value = specularTexture ? 1 : 0;
    const progress = typeof window === "undefined" ? 1 : Math.min(1, Math.max(0, window.__MiraLithOpeningProgress ?? 0));
    earthMaterial.uniforms.closeStage.value = 1 - smoothstep(0.18, 0.86, progress);
    if (!paused && !reducedMotion) {
      const nearStaticCloudDrift = 0.04 + (1 - earthMaterial.uniforms.closeStage.value) * 0.96;
      earthMaterial.uniforms.cloudOffset.value =
        (earthMaterial.uniforms.cloudOffset.value + delta * SURFACE_CLOUD_SCROLL_SPEED * nearStaticCloudDrift) % 1;
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

export function LandingEarth(props: LandingEarthProps) {
  if (props.visualPolicy && props.visualPolicy.cloudMode !== "lookdev") {
    return (
      <LandingEarthLite
        composition={props.composition}
        assets={props.assets}
        quality={props.quality}
        visualPolicy={props.visualPolicy}
        reducedMotion={props.reducedMotion}
        paused={props.paused}
        sceneLightDirection={props.sceneLightDirection}
        onDayTextureReady={props.onDayTextureReady}
      />
    );
  }

  return <LandingEarthLookdev {...props} />;
}
