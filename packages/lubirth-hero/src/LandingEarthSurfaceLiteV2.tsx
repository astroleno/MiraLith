"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  RepeatWrapping,
  ShaderMaterial,
  Texture,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import {
  HOME_CLOUD_FIELD_OFFSET_X,
  HOME_CLOUD_FIELD_OFFSET_Y
} from "./homeCloudField";
import {
  PLANET_LIGHTING_GLSL,
  type LandingPlanetLightingFrame
} from "./landingPlanetLighting";
import type {
  LandingComposition,
  LandingResolvedAssets
} from "./types";
import { createEarthTexture } from "./textures";
import { useLandingTexture } from "./useLandingTexture";

interface LandingEarthSurfaceLiteV2Props {
  assets: LandingResolvedAssets;
  composition: LandingComposition;
  lightingFrame: LandingPlanetLightingFrame;
  onDayTextureReady?: () => void;
  quality: QualityProfile;
}

interface EarthSurfaceLiteV2Telemetry {
  active: true;
  cloudOffset: number;
  cloudShadowActive: boolean;
  dayTextureSource: string;
  internalLimbActive: false;
  lightsOnlyTextureSource: string;
  sunDirection: [number, number, number];
}

interface EarthSurfaceLiteV2TestOverride {
  cityLightScale?: number;
  cloudShadowScale?: number;
  reverseSun?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthEarthSurfaceLiteV2?: EarthSurfaceLiteV2Telemetry;
    __MiraLithLuBirthEarthSurfaceLiteV2Override?: EarthSurfaceLiteV2TestOverride;
  }
}

const fallbackLightDirection = new Vector3();
const RELIEF_CLOUD_PNG_FALLBACK =
  "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png";

function resolveGeometrySegments(quality: QualityProfile) {
  if (quality.tier === "high") {
    return { height: 112, width: 192 };
  }
  if (quality.tier === "medium") {
    return { height: 96, width: 160 };
  }
  return { height: 64, width: 112 };
}

function configureColorTexture(texture: Texture) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = Math.max(texture.anisotropy, 4);
  texture.needsUpdate = true;
}

function createEarthSurfaceLiteV2Material({
  cloudFieldTexture,
  composition,
  dayTexture,
  hasCloudField,
  hasLightsOnly,
  lightsOnlyTexture
}: {
  cloudFieldTexture: Texture;
  composition: LandingComposition;
  dayTexture: Texture;
  hasCloudField: boolean;
  hasLightsOnly: boolean;
  lightsOnlyTexture: Texture;
}) {
  return new ShaderMaterial({
    name: "MiraLithEarthSurfaceLiteV2",
    uniforms: {
      ambientIntensity: { value: composition.light.ambientIntensity },
      cloudFieldMap: { value: cloudFieldTexture },
      cloudOffset: { value: 0 },
      cloudShadowStrength: {
        value: hasCloudField && composition.earth.useClouds
          ? composition.earth.cloudOpacity * 0.19
          : 0
      },
      cityLightScale: { value: 1 },
      dayMap: { value: dayTexture },
      hasCloudField: { value: hasCloudField ? 1 : 0 },
      hasLightsOnlyMap: { value: hasLightsOnly ? 1 : 0 },
      lightColor: { value: new Color(...composition.light.color) },
      lightDir: {
        value: fallbackLightDirection
          .set(...composition.light.fixedSunDir)
          .normalize()
          .clone()
      },
      lightsOnlyMap: { value: lightsOnlyTexture },
      nightIntensity: { value: composition.earth.nightIntensity },
      openingExposure: { value: 1 },
      specularStrength: { value: composition.earth.specularStrength },
      sunIntensity: { value: composition.light.intensity },
      terminatorSoftness: { value: composition.earth.terminatorSoftness }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying vec3 vWorldEast;
      varying vec3 vWorldNormal;
      varying vec3 vWorldNorth;

      ${PLANET_LIGHTING_GLSL}

      void main() {
        vUv = uv;
        vec3 localNormal = normalize(position);
        vec3 localEast;
        vec3 localNorth;
        planetTangentFrame(localNormal, localEast, localNorth);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        mat3 worldRotation = mat3(modelMatrix);
        vWorldNormal = normalize(worldRotation * normal);
        vWorldEast = normalize(worldRotation * localEast);
        vWorldNorth = normalize(worldRotation * localNorth);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudFieldMap;
      uniform sampler2D dayMap;
      uniform sampler2D lightsOnlyMap;
      uniform float ambientIntensity;
      uniform float cloudOffset;
      uniform float cloudShadowStrength;
      uniform float cityLightScale;
      uniform float hasCloudField;
      uniform float hasLightsOnlyMap;
      uniform vec3 lightColor;
      uniform vec3 lightDir;
      uniform float nightIntensity;
      uniform float openingExposure;
      uniform float specularStrength;
      uniform float sunIntensity;
      uniform float terminatorSoftness;

      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying vec3 vWorldEast;
      varying vec3 vWorldNormal;
      varying vec3 vWorldNorth;

      ${PLANET_LIGHTING_GLSL}

      void main() {
        vec3 normalDirection = normalize(vWorldNormal);
        vec3 viewDirection = normalize(vViewDirection);
        vec3 sunDirection = normalize(lightDir);
        float normalSunDot = dot(normalDirection, sunDirection);
        float directLight = max(normalSunDot, 0.0);
        PlanetLightMasks lightMasks = resolvePlanetLightMasks(
          normalSunDot,
          terminatorSoftness
        );

        vec3 dayColor = texture2D(dayMap, vUv).rgb;
        vec3 lightsOnly = texture2D(lightsOnlyMap, vUv).rgb * hasLightsOnlyMap;
        float dayLuma = dot(dayColor, vec3(0.2126, 0.7152, 0.0722));
        float oceanMask = smoothstep(
          0.018,
          0.17,
          dayColor.b - max(dayColor.r, dayColor.g) * 0.72
        );

        float diffuse = 0.055 + ambientIntensity * 0.82 + directLight * sunIntensity * 0.39;
        vec3 daySurface = dayColor * lightColor * diffuse * lightMasks.dayMask;

        float earthshineStrength = 0.105 + (1.0 - lightMasks.deepNightMask) * 0.02;
        vec3 earthshine = dayColor * vec3(0.18, 0.25, 0.38) *
          earthshineStrength * lightMasks.nightMask * (0.58 + dayLuma * 0.42);
        float cityNightGate = lightMasks.deepNightMask * lightMasks.deepNightMask;
        vec3 cityNetwork = pow(max(lightsOnly, vec3(0.0)), vec3(0.72));
        vec3 cityCore = pow(max(lightsOnly, vec3(0.0)), vec3(1.35)) * 0.85;
        vec3 cityLights = (cityNetwork * 1.75 + cityCore) * nightIntensity * 1.55 *
          cityNightGate * cityLightScale;
        vec3 color = daySurface + earthshine + cityLights;

        vec3 halfVector = normalize(sunDirection + viewDirection);
        float oceanSpecular = pow(max(dot(normalDirection, halfVector), 0.0), 82.0) *
          oceanMask * directLight * specularStrength * lightMasks.dayMask * 0.66;
        color += lightColor * oceanSpecular;

        vec2 sunTangent = vec2(
          dot(sunDirection, normalize(vWorldEast)),
          dot(sunDirection, normalize(vWorldNorth))
        );
        float tangentLength = max(length(sunTangent), 0.001);
        float lowSunPath = clamp(tangentLength / max(abs(normalSunDot), 0.16), 0.0, 4.0);
        float cloudLatitudeScale = max(cos((vUv.y + ${HOME_CLOUD_FIELD_OFFSET_Y.toFixed(3)} - 0.5) * ${Math.PI.toFixed(8)}), 0.18);
        vec2 shadowDirection = normalize(vec2(
          sunTangent.x / max(2.0 * cloudLatitudeScale, 0.36),
          sunTangent.y
        ));
        vec2 cloudUv = vec2(
          vUv.x + ${HOME_CLOUD_FIELD_OFFSET_X.toFixed(3)} + cloudOffset,
          clamp(vUv.y + ${HOME_CLOUD_FIELD_OFFSET_Y.toFixed(3)}, 0.001, 0.999)
        );
        float baseShadowTravel = mix(0.0011, 0.0072, lowSunPath / 4.0);
        vec2 predictorUv = vec2(
          cloudUv.x + shadowDirection.x * baseShadowTravel,
          clamp(cloudUv.y + shadowDirection.y * baseShadowTravel, 0.001, 0.999)
        );
        vec4 predictorCloudField = texture2D(cloudFieldMap, predictorUv);
        float predictorCloudTop = smoothstep(0.025, 0.95, predictorCloudField.g) * hasCloudField;
        float predictorCoverage = smoothstep(0.08, 0.76, predictorCloudField.r) * hasCloudField;
        float predictorConcavity = smoothstep(0.04, 0.92, predictorCloudField.a);
        float predictorShadow = predictorCoverage * predictorCloudTop *
          mix(0.72, 1.18, predictorConcavity);
        float shadowTravel = baseShadowTravel * mix(0.35, 1.0, predictorCloudTop);
        vec2 shadowUv = vec2(
          cloudUv.x + shadowDirection.x * shadowTravel,
          clamp(cloudUv.y + shadowDirection.y * shadowTravel, 0.001, 0.999)
        );
        vec4 shadowField = texture2D(
          cloudFieldMap,
          shadowUv,
          mix(0.35, 1.75, lowSunPath / 4.0)
        );
        float shadowCoverage = smoothstep(0.08, 0.76, shadowField.r) * hasCloudField;
        float shadowTop = smoothstep(0.025, 0.95, shadowField.g);
        float shadowConcavity = smoothstep(0.04, 0.92, shadowField.a);
        float correctedShadow = shadowCoverage * shadowTop *
          mix(0.72, 1.18, shadowConcavity);
        float cloudShadow = max(predictorShadow * 0.72, correctedShadow) * cloudShadowStrength *
          lightMasks.dayMask * smoothstep(0.01, 0.32, directLight);
        color *= 1.0 - clamp(cloudShadow, 0.0, 0.2);

        vec3 twilightColor = mix(
          vec3(0.18, 0.055, 0.018),
          vec3(0.34, 0.12, 0.035),
          smoothstep(-0.08, 0.08, normalSunDot)
        );
        color += twilightColor * lightMasks.twilightMask *
          (1.0 - oceanMask * 0.35) * (0.024 + dayLuma * 0.018);

        color *= openingExposure;
        color = color / (1.0 + max(color - vec3(0.76), vec3(0.0)) * 0.78);
        gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
      }
    `
  });
}

export function LandingEarthSurfaceLiteV2({
  assets,
  composition,
  lightingFrame,
  onDayTextureReady,
  quality
}: LandingEarthSurfaceLiteV2Props) {
  const earth = useRef<Mesh>(null);
  const { gl } = useThree();
  const visualTestOverridesEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("visualTest") === "pixels";
  }, []);
  const proceduralDayTexture = useMemo(
    () => createEarthTexture(quality.tier === "low" ? 384 : 512),
    [quality.tier]
  );
  const { texture: dayTexture } = useLandingTexture(assets.earthDay.src, {
    anisotropy: 4,
    colorSpace: assets.earthDay.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const lightsAsset = assets.earthLightsOnly;
  const { texture: lightsOnlyTexture } = useLandingTexture(lightsAsset?.src, {
    anisotropy: 4,
    colorSpace: lightsAsset?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const cloudFieldAsset = assets.earthCloudField;
  const { texture: cloudFieldTexture } = useLandingTexture(
    composition.earth.useClouds ? cloudFieldAsset?.src : undefined,
    {
      anisotropy: 4,
      colorSpace: cloudFieldAsset?.colorSpace ?? "linear",
      fallbackSrc:
        cloudFieldAsset?.format === "ktx2" ? RELIEF_CLOUD_PNG_FALLBACK : undefined,
      renderer: gl,
      wrapS: RepeatWrapping,
      wrapT: ClampToEdgeWrapping
    }
  );
  const activeDayTexture = dayTexture ?? proceduralDayTexture;
  const activeLightsTexture = lightsOnlyTexture ?? activeDayTexture;
  const activeCloudFieldTexture = cloudFieldTexture ?? activeDayTexture;
  const geometrySegments = resolveGeometrySegments(quality);

  const material = useMemo(() => {
    configureColorTexture(activeDayTexture);
    configureColorTexture(activeLightsTexture);
    return createEarthSurfaceLiteV2Material({
      cloudFieldTexture: activeCloudFieldTexture,
      composition,
      dayTexture: activeDayTexture,
      hasCloudField: Boolean(cloudFieldTexture),
      hasLightsOnly: Boolean(lightsOnlyTexture),
      lightsOnlyTexture: activeLightsTexture
    });
  }, [
    activeCloudFieldTexture,
    activeDayTexture,
    activeLightsTexture,
    cloudFieldTexture,
    composition,
    lightsOnlyTexture
  ]);

  useEffect(() => {
    if (dayTexture) {
      onDayTextureReady?.();
    }
  }, [dayTexture, onDayTextureReady]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => proceduralDayTexture.dispose(), [proceduralDayTexture]);
  useEffect(() => () => {
    window.__MiraLithLuBirthEarthSurfaceLiteV2 = undefined;
  }, []);

  useFrame(() => {
    if (!earth.current) {
      return;
    }

    const earthMaterial = earth.current.material as ShaderMaterial;
    const visualTestOverride = visualTestOverridesEnabled
      ? window.__MiraLithLuBirthEarthSurfaceLiteV2Override
      : undefined;
    const activeLight = visualTestOverride?.reverseSun
      ? fallbackLightDirection.copy(lightingFrame.sunDirection).multiplyScalar(-1)
      : lightingFrame.sunDirection;
    earthMaterial.uniforms.lightDir.value.copy(activeLight).normalize();
    earthMaterial.uniforms.cityLightScale.value = MathUtils.clamp(
      visualTestOverride?.cityLightScale ?? 1,
      0,
      1
    );
    earthMaterial.uniforms.cloudOffset.value = lightingFrame.cloudOffsetRef.current;
    earthMaterial.uniforms.hasCloudField.value = cloudFieldTexture ? 1 : 0;
    const cloudShadowScale = MathUtils.clamp(
      visualTestOverride?.cloudShadowScale ?? 1,
      0,
      1
    );
    earthMaterial.uniforms.cloudShadowStrength.value = cloudFieldTexture
      ? composition.earth.cloudOpacity * 0.19 * cloudShadowScale
      : 0;
    earthMaterial.uniforms.openingExposure.value = MathUtils.lerp(
      0.97,
      1.025,
      1 - MathUtils.smoothstep(getRuntimeOpeningProgress(0), 0.16, 0.82)
    );
    earth.current.rotation.set(0, MathUtils.degToRad(composition.earth.yawDeg), 0);

    window.__MiraLithLuBirthEarthSurfaceLiteV2 = {
      active: true,
      cloudOffset: lightingFrame.cloudOffsetRef.current,
      cloudShadowActive: Boolean(cloudFieldTexture),
      dayTextureSource: assets.earthDay.src,
      internalLimbActive: false,
      lightsOnlyTextureSource: lightsAsset?.src ?? "fallback",
      sunDirection: [activeLight.x, activeLight.y, activeLight.z]
    };
  });

  return (
    <mesh ref={earth} material={material}>
      <sphereGeometry
        args={[
          composition.earth.radius,
          geometrySegments.width,
          geometrySegments.height
        ]}
      />
    </mesh>
  );
}
