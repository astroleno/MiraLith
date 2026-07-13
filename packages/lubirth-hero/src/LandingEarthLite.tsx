"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  Color,
  ClampToEdgeWrapping,
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
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import {
  HOME_CLOUD_FIELD_OFFSET_X,
  HOME_CLOUD_FIELD_OFFSET_Y,
  HOME_CLOUD_FIELD_SCROLL_SPEED
} from "./homeCloudField";
import { EMPTY_CLOSE_ATMOSPHERE_TUNING } from "./landingAtmosphereTuning";
import type {
  LandingCloseAtmosphereTuning,
  LandingComposition,
  LandingResolvedAssets,
  LandingVisualPolicy
} from "./types";
import { createEarthTexture } from "./textures";
import { useLandingTexture } from "./useLandingTexture";

interface LandingEarthLiteProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  visualPolicy: LandingVisualPolicy;
  reducedMotion?: boolean;
  paused?: boolean;
  cloudOffsetRef?: MutableRefObject<number>;
  sceneLightDirection?: Vector3;
  onDayTextureReady?: () => void;
  closeAtmosphereTuning?: LandingCloseAtmosphereTuning;
}

const fallbackLightDirection = new Vector3();

export const LITE_EARTH_LIGHTING_MODEL = {
  cityGateNightEdge: -0.18,
  cityGateDayEdge: 0.08,
  closeExposureMin: 0.96,
  closeExposureMax: 1.04,
  deepNightOuterMultiplier: 2.2,
  deepNightInnerMultiplier: 0.65,
  terminatorBandInnerMultiplier: 0.18,
  terminatorBandOuterMultiplier: 1.25,
  terminatorTintStrength: 0.05
} as const;

function smoothstepNumber(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-6)));
  return t * t * (3 - 2 * t);
}

export function resolveLiteEarthLightingWeights(ndl: number, terminatorSoftness: number) {
  const edge = Math.max(terminatorSoftness, 0.001);
  const dayWeight = smoothstepNumber(-edge, edge, ndl);
  const nightWeight = 1 - dayWeight;
  const deepNightWeight = 1 - smoothstepNumber(
    -edge * LITE_EARTH_LIGHTING_MODEL.deepNightOuterMultiplier,
    -edge * LITE_EARTH_LIGHTING_MODEL.deepNightInnerMultiplier,
    ndl
  );
  const cityGate = (
    1 - smoothstepNumber(
      LITE_EARTH_LIGHTING_MODEL.cityGateNightEdge,
      LITE_EARTH_LIGHTING_MODEL.cityGateDayEdge,
      ndl
    )
  ) * nightWeight;
  const terminatorBand = 1 - smoothstepNumber(
    edge * LITE_EARTH_LIGHTING_MODEL.terminatorBandInnerMultiplier,
    edge * LITE_EARTH_LIGHTING_MODEL.terminatorBandOuterMultiplier,
    Math.abs(ndl)
  );

  return { cityGate, dayWeight, deepNightWeight, nightWeight, terminatorBand };
}

declare global {
  interface Window {
    __MiraLithLuBirthGroundCloudFieldTextureUuid?: string;
    __MiraLithLuBirthGroundCloudOffset?: number;
    __MiraLithLuBirthGroundCloudShadowActive?: boolean;
  }
}

function resolveLiteEarthSegments(composition: LandingComposition, quality: QualityProfile) {
  if (quality.tier === "low" || quality.tier === "fallback") {
    return Math.max(64, Math.min(72, composition.earth.segments));
  }

  return Math.max(80, Math.min(96, composition.earth.segments));
}

function createLiteEarthMaterial({
  composition,
  dayTexture,
  nightTexture,
  cloudFieldTexture,
  visualPolicy,
  closeAtmosphereTuning
}: {
  composition: LandingComposition;
  dayTexture: Texture;
  nightTexture: Texture;
  cloudFieldTexture: Texture;
  visualPolicy: LandingVisualPolicy;
  closeAtmosphereTuning: LandingCloseAtmosphereTuning;
}) {
  const lightColor = new Color(...composition.light.color);

  return new ShaderMaterial({
    uniforms: {
      dayMap: { value: dayTexture },
      nightMap: { value: nightTexture },
      cloudFieldMap: { value: cloudFieldTexture },
      hasCloudField: { value: visualPolicy.cloudMode === "surface" || visualPolicy.groundShadow ? 1 : 0 },
      surfaceCloudStrength: {
        value: visualPolicy.cloudMode === "surface" && composition.earth.useClouds
          ? composition.earth.cloudOpacity * 0.32
          : 0
      },
      groundShadowStrength: {
        value: visualPolicy.groundShadow && composition.earth.useClouds
          ? composition.earth.cloudOpacity * 0.2
          : 0
      },
      cloudOffset: { value: 0 },
      closeStage: { value: 1 },
      lightDir: {
        value: fallbackLightDirection.set(...composition.light.fixedSunDir).normalize().clone()
      },
      lightColor: { value: lightColor },
      sunIntensity: { value: composition.light.intensity },
      ambientIntensity: { value: composition.light.ambientIntensity },
      terminatorSoftness: { value: composition.earth.terminatorSoftness },
      nightIntensity: { value: composition.earth.nightIntensity },
      nightSurfaceLift: { value: composition.earth.nightSurfaceLift },
      specularStrength: { value: composition.earth.specularStrength },
      rimStrength: { value: composition.earth.rimStrength },
      rimWidth: { value: composition.earth.rimWidth },
      edgeLightColor: { value: new Color(...composition.earth.edgeLightColor) },
      edgeGlowStrength: { value: closeAtmosphereTuning.edgeGlowStrength },
      verticalGradientStrength: { value: closeAtmosphereTuning.verticalGradientStrength },
      depthShadowStrength: { value: closeAtmosphereTuning.depthShadowStrength },
      groundProjectionStrength: { value: closeAtmosphereTuning.groundProjectionStrength },
      cloudVolumeShadowStrength: { value: closeAtmosphereTuning.cloudVolumeShadowStrength }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;
      varying vec3 vWorldEast;
      varying vec3 vWorldNorth;

      void main() {
        vUv = uv;
        vec3 localNormal = normalize(position);
        float longitude = uv.x * 6.28318530718;
        vec3 localEast = vec3(sin(longitude), 0.0, cos(longitude));
        vec3 localNorth = normalize(cross(localNormal, localEast));
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
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D cloudFieldMap;
      uniform float hasCloudField;
      uniform float surfaceCloudStrength;
      uniform float groundShadowStrength;
      uniform float cloudOffset;
      uniform float closeStage;
      uniform vec3 lightDir;
      uniform vec3 lightColor;
      uniform float sunIntensity;
      uniform float ambientIntensity;
      uniform float terminatorSoftness;
      uniform float nightIntensity;
      uniform float nightSurfaceLift;
      uniform float specularStrength;
      uniform float rimStrength;
      uniform float rimWidth;
      uniform vec3 edgeLightColor;
      uniform float edgeGlowStrength;
      uniform float verticalGradientStrength;
      uniform float depthShadowStrength;
      uniform float groundProjectionStrength;
      uniform float cloudVolumeShadowStrength;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;
      varying vec3 vWorldEast;
      varying vec3 vWorldNorth;

      void main() {
        vec3 normalDirection = normalize(vWorldNormal);
        vec3 viewDirection = normalize(vViewDirection);
        vec3 sunDirection = normalize(lightDir);
        float ndl = dot(normalDirection, sunDirection);
        float terminatorEdge = max(terminatorSoftness, 0.001);
        float dayWeight = smoothstep(-terminatorEdge, terminatorEdge, ndl);
        float directLight = max(ndl, 0.0);
        float nightWeight = 1.0 - dayWeight;
        float deepNightWeight = 1.0 - smoothstep(
          -terminatorEdge * ${LITE_EARTH_LIGHTING_MODEL.deepNightOuterMultiplier.toFixed(2)},
          -terminatorEdge * ${LITE_EARTH_LIGHTING_MODEL.deepNightInnerMultiplier.toFixed(2)},
          ndl
        );
        float cityGate = (
          1.0 - smoothstep(
            ${LITE_EARTH_LIGHTING_MODEL.cityGateNightEdge.toFixed(2)},
            ${LITE_EARTH_LIGHTING_MODEL.cityGateDayEdge.toFixed(2)},
            ndl
          )
        ) * nightWeight;
        float terminatorBand = 1.0 - smoothstep(
          terminatorEdge * ${LITE_EARTH_LIGHTING_MODEL.terminatorBandInnerMultiplier.toFixed(2)},
          terminatorEdge * ${LITE_EARTH_LIGHTING_MODEL.terminatorBandOuterMultiplier.toFixed(2)},
          abs(ndl)
        );

        vec3 dayColor = texture2D(dayMap, vUv).rgb;
        vec3 nightColor = texture2D(nightMap, vUv).rgb;
        float dayLuma = dot(dayColor, vec3(0.299, 0.587, 0.114));
        float oceanMask = smoothstep(0.015, 0.16, dayColor.b - max(dayColor.r, dayColor.g) * 0.72);

        vec3 daySurface = dayColor * lightColor * (
          0.075 + ambientIntensity * 1.6 + directLight * sunIntensity * 0.39
        ) * dayWeight;
        vec3 coolNightTint = vec3(0.26, 0.36, 0.56);
        float nightAlbedoStrength = 0.08 + nightSurfaceLift * 0.92;
        vec3 nightAlbedo = dayColor * coolNightTint * nightAlbedoStrength * deepNightWeight;
        vec3 cityLight = nightColor * nightIntensity * cityGate;
        vec3 color = daySurface + nightAlbedo + cityLight;

        vec3 halfVector = normalize(sunDirection + viewDirection);
        float oceanSpecular = pow(max(dot(normalDirection, halfVector), 0.0), 74.0) *
          oceanMask * directLight * specularStrength * 0.62;
        color += lightColor * oceanSpecular;

        vec2 sunTangent = vec2(
          dot(sunDirection, normalize(vWorldEast)),
          dot(sunDirection, normalize(vWorldNorth))
        );
        float sunTangentLength = max(length(sunTangent), 0.001);
        sunTangent /= sunTangentLength;
        vec2 baseCloudUv = vec2(
          fract(vUv.x + ${HOME_CLOUD_FIELD_OFFSET_X.toFixed(3)} + cloudOffset),
          clamp(vUv.y + ${HOME_CLOUD_FIELD_OFFSET_Y.toFixed(3)}, 0.001, 0.999)
        );
        float useGroundShadowSample = step(0.0001, groundShadowStrength);
        vec2 cloudSampleUv = vec2(
          fract(baseCloudUv.x - sunTangent.x * 0.0024 * useGroundShadowSample),
          clamp(baseCloudUv.y - sunTangent.y * 0.0012 * useGroundShadowSample, 0.001, 0.999)
        );
        vec4 cloudField = texture2D(cloudFieldMap, cloudSampleUv);
        float cloudCoverage = smoothstep(0.055, 0.9, cloudField.r) * hasCloudField;
        float cloudThickness = cloudField.a * hasCloudField;
        float lowSun = 1.0 - smoothstep(0.12, 0.72, directLight);
        float groundShadow = cloudCoverage * groundShadowStrength * dayWeight *
          (0.42 + cloudThickness * 0.34 + lowSun * 0.24);
        groundShadow *= 1.0 + cloudVolumeShadowStrength * 0.36;
        color *= 1.0 - clamp(groundShadow, 0.0, 0.18);

        float surfaceCloudAlpha = cloudCoverage * surfaceCloudStrength * dayWeight *
          (0.48 + cloudThickness * 0.42);
        vec3 surfaceCloudColor = mix(
          vec3(0.52, 0.6, 0.7),
          vec3(0.94, 0.97, 1.0),
          directLight
        );
        color = mix(color, surfaceCloudColor * (0.42 + directLight * 0.62), surfaceCloudAlpha);

        color += vec3(0.22, 0.105, 0.04) * terminatorBand *
          (1.0 - oceanMask * 0.3) * ${LITE_EARTH_LIGHTING_MODEL.terminatorTintStrength.toFixed(3)};

        float facing = max(dot(normalDirection, viewDirection), 0.0);
        float fresnel = pow(1.0 - facing, max(rimWidth, 1.0));
        float rimDayGate = smoothstep(-0.34, 0.32, ndl);
        color += edgeLightColor * fresnel * rimStrength * (0.012 + rimDayGate * 0.032);

        float contactLine = 1.0 - smoothstep(0.052, 0.118, facing);
        float verticalPosition = normalDirection.y * 0.5 + 0.5;
        float verticalGradient = mix(
          1.0,
          mix(0.78, 1.18, verticalPosition),
          verticalGradientStrength
        );
        float contactDayGate = smoothstep(-0.34, 0.26, ndl);
        float contactDepth = mix(
          1.0,
          0.58 + contactDayGate * 0.42,
          depthShadowStrength
        );
        vec3 contactColor = mix(
          vec3(0.42, 0.68, 1.0),
          vec3(0.94, 0.985, 1.0),
          0.34 + contactDayGate * 0.58
        );
        float contactStrength = (
          0.065 +
          edgeGlowStrength * 0.06 +
          groundProjectionStrength * 0.025
        ) *
          verticalGradient *
          contactDepth;
        color += contactColor * contactLine * contactStrength;

        color = max(color, dayColor * nightWeight * 0.018);
        color *= mix(
          ${LITE_EARTH_LIGHTING_MODEL.closeExposureMin.toFixed(2)},
          ${LITE_EARTH_LIGHTING_MODEL.closeExposureMax.toFixed(2)},
          closeStage
        );
        color = color / (1.0 + max(color - vec3(0.72), vec3(0.0)) * 0.72);
        float colorLuma = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(vec3(colorLuma), color, 0.97 + dayLuma * 0.02);
        gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
      }
    `
  });
}

export function LandingEarthLite({
  composition,
  assets,
  quality,
  visualPolicy,
  reducedMotion,
  paused,
  cloudOffsetRef,
  sceneLightDirection,
  onDayTextureReady,
  closeAtmosphereTuning = EMPTY_CLOSE_ATMOSPHERE_TUNING
}: LandingEarthLiteProps) {
  const earth = useRef<Mesh>(null);
  const localCloudOffset = useRef(0);
  const activeCloudOffset = cloudOffsetRef ?? localCloudOffset;
  const proceduralDayTexture = useMemo(
    () => createEarthTexture(quality.tier === "low" ? 384 : 512),
    [quality.tier]
  );
  const { texture: dayTexture } = useLandingTexture(assets.earthDay.src, {
    colorSpace: assets.earthDay.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    anisotropy: 4
  });
  const { texture: nightTexture } = useLandingTexture(assets.earthNight?.src, {
    colorSpace: assets.earthNight?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    anisotropy: 4
  });
  const shouldLoadCloudField =
    composition.earth.useClouds &&
    (visualPolicy.cloudMode === "surface" || visualPolicy.groundShadow);
  const { texture: cloudFieldTexture } = useLandingTexture(
    shouldLoadCloudField ? assets.earthCloudField?.src : undefined,
    {
      colorSpace: assets.earthCloudField?.colorSpace ?? "linear",
      wrapS: RepeatWrapping,
      wrapT: ClampToEdgeWrapping,
      anisotropy: 4
    }
  );
  const activeDayTexture = dayTexture ?? proceduralDayTexture;
  const activeNightTexture = nightTexture ?? activeDayTexture;
  const activeCloudFieldTexture = cloudFieldTexture ?? activeDayTexture;

  const material = useMemo(() => {
    activeDayTexture.colorSpace = SRGBColorSpace;
    activeNightTexture.colorSpace = SRGBColorSpace;
    for (const texture of [activeDayTexture, activeNightTexture]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.magFilter = LinearFilter;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.anisotropy = Math.max(texture.anisotropy, 4);
      texture.needsUpdate = true;
    }

    return createLiteEarthMaterial({
      composition,
      dayTexture: activeDayTexture,
      nightTexture: activeNightTexture,
      cloudFieldTexture: activeCloudFieldTexture,
      visualPolicy,
      closeAtmosphereTuning
    });
  }, [
    activeCloudFieldTexture,
    activeDayTexture,
    activeNightTexture,
    closeAtmosphereTuning,
    composition,
    visualPolicy
  ]);

  useEffect(() => {
    if (dayTexture) {
      onDayTextureReady?.();
    }
  }, [dayTexture, onDayTextureReady]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => proceduralDayTexture.dispose(), [proceduralDayTexture]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthGroundCloudShadowActive =
      Boolean(cloudFieldTexture) && visualPolicy.groundShadow;
    window.__MiraLithLuBirthGroundCloudFieldTextureUuid = cloudFieldTexture?.uuid;
    return () => {
      window.__MiraLithLuBirthGroundCloudShadowActive = false;
      window.__MiraLithLuBirthGroundCloudFieldTextureUuid = undefined;
      window.__MiraLithLuBirthGroundCloudOffset = undefined;
    };
  }, [cloudFieldTexture, visualPolicy.groundShadow]);

  useFrame((_state, delta) => {
    if (!earth.current) {
      return;
    }

    if (!cloudOffsetRef && !paused && !reducedMotion) {
      localCloudOffset.current =
        (localCloudOffset.current + delta * HOME_CLOUD_FIELD_SCROLL_SPEED) % 1;
    }

    const earthMaterial = earth.current.material as ShaderMaterial;
    const activeLightDirection = sceneLightDirection ?? fallbackLightDirection.set(...composition.light.fixedSunDir);
    earthMaterial.uniforms.lightDir.value.copy(activeLightDirection).normalize();
    earthMaterial.uniforms.cloudOffset.value = activeCloudOffset.current;
    window.__MiraLithLuBirthGroundCloudOffset = activeCloudOffset.current;
    earthMaterial.uniforms.closeStage.value = 1 - MathUtils.smoothstep(
      getRuntimeOpeningProgress(0),
      0.18,
      0.86
    );
    earthMaterial.uniforms.hasCloudField.value = cloudFieldTexture ? 1 : 0;
    earthMaterial.uniforms.surfaceCloudStrength.value =
      cloudFieldTexture && visualPolicy.cloudMode === "surface"
        ? composition.earth.cloudOpacity * 0.32
        : 0;
    earthMaterial.uniforms.groundShadowStrength.value =
      cloudFieldTexture && visualPolicy.groundShadow
        ? composition.earth.cloudOpacity * 0.2
        : 0;
    earth.current.rotation.set(0, MathUtils.degToRad(composition.earth.yawDeg), 0);
  });

  return (
    <mesh ref={earth} material={material}>
      <sphereGeometry
        args={[
          composition.earth.radius,
          resolveLiteEarthSegments(composition, quality),
          resolveLiteEarthSegments(composition, quality)
        ]}
      />
    </mesh>
  );
}
