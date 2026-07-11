"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
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
import type { QualityProfile } from "@miralith/visual-core";
import {
  HOME_CLOUD_FIELD_OFFSET_X,
  HOME_CLOUD_FIELD_OFFSET_Y,
  HOME_CLOUD_FIELD_SCROLL_SPEED
} from "./homeCloudField";
import type {
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
  sceneLightDirection?: Vector3;
  onDayTextureReady?: () => void;
}

const fallbackLightDirection = new Vector3();

function resolveLiteEarthSegments(composition: LandingComposition, quality: QualityProfile) {
  if (quality.tier === "low" || quality.tier === "fallback") {
    return Math.max(72, Math.min(96, composition.earth.segments));
  }

  return Math.max(96, Math.min(144, composition.earth.segments));
}

function createLiteEarthMaterial({
  composition,
  dayTexture,
  nightTexture,
  cloudFieldTexture,
  visualPolicy
}: {
  composition: LandingComposition;
  dayTexture: Texture;
  nightTexture: Texture;
  cloudFieldTexture: Texture;
  visualPolicy: LandingVisualPolicy;
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
      edgeLightColor: { value: new Color(...composition.earth.edgeLightColor) }
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
        vec3 localReference = abs(localNormal.y) > 0.98
          ? vec3(1.0, 0.0, 0.0)
          : vec3(0.0, 1.0, 0.0);
        vec3 localEast = normalize(cross(localReference, localNormal));
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
        float dayWeight = smoothstep(-terminatorSoftness, terminatorSoftness, ndl);
        float directLight = max(ndl, 0.0);
        float nightWeight = 1.0 - dayWeight;

        vec3 dayColor = texture2D(dayMap, vUv).rgb;
        vec3 nightColor = texture2D(nightMap, vUv).rgb;
        float dayLuma = dot(dayColor, vec3(0.299, 0.587, 0.114));
        float oceanMask = smoothstep(0.015, 0.16, dayColor.b - max(dayColor.r, dayColor.g) * 0.72);

        vec3 litSurface = dayColor * lightColor * (
          0.075 + ambientIntensity * 1.6 + directLight * sunIntensity * 0.39
        );
        vec3 readableNight = dayColor * (
          0.025 + nightSurfaceLift * 0.34 + smoothstep(-0.52, 0.04, ndl) * 0.03
        );
        vec3 cityLight = nightColor * nightIntensity * (0.5 + nightWeight * 1.55);
        vec3 color = mix(readableNight + cityLight, litSurface, dayWeight);

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
        color *= 1.0 - clamp(groundShadow, 0.0, 0.18);

        float surfaceCloudAlpha = cloudCoverage * surfaceCloudStrength * dayWeight *
          (0.48 + cloudThickness * 0.42);
        vec3 surfaceCloudColor = mix(
          vec3(0.52, 0.6, 0.7),
          vec3(0.94, 0.97, 1.0),
          directLight
        );
        color = mix(color, surfaceCloudColor * (0.42 + directLight * 0.62), surfaceCloudAlpha);

        float twilight = 1.0 - smoothstep(0.02, 0.38, abs(ndl));
        color += vec3(0.19, 0.11, 0.075) * twilight * (1.0 - oceanMask * 0.3) * 0.09;

        float facing = max(dot(normalDirection, viewDirection), 0.0);
        float fresnel = pow(1.0 - facing, max(rimWidth, 1.0));
        float rimDayGate = smoothstep(-0.34, 0.32, ndl);
        color += edgeLightColor * fresnel * rimStrength * (0.012 + rimDayGate * 0.032);

        color = max(color, dayColor * nightWeight * 0.018);
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
  sceneLightDirection,
  onDayTextureReady
}: LandingEarthLiteProps) {
  const earth = useRef<Mesh>(null);
  const cloudOffset = useRef(0);
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
      wrapT: RepeatWrapping,
      anisotropy: 4
    }
  );
  const activeDayTexture = dayTexture ?? proceduralDayTexture;
  const activeNightTexture = nightTexture ?? activeDayTexture;
  const activeCloudFieldTexture = cloudFieldTexture ?? activeDayTexture;

  const material = useMemo(() => {
    activeDayTexture.colorSpace = SRGBColorSpace;
    activeNightTexture.colorSpace = SRGBColorSpace;
    for (const texture of [activeDayTexture, activeNightTexture, activeCloudFieldTexture]) {
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
      visualPolicy
    });
  }, [activeCloudFieldTexture, activeDayTexture, activeNightTexture, composition, visualPolicy]);

  useEffect(() => {
    if (dayTexture) {
      onDayTextureReady?.();
    }
  }, [dayTexture, onDayTextureReady]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => proceduralDayTexture.dispose(), [proceduralDayTexture]);

  useFrame((_state, delta) => {
    if (!earth.current) {
      return;
    }

    if (!paused && !reducedMotion) {
      cloudOffset.current = (cloudOffset.current + delta * HOME_CLOUD_FIELD_SCROLL_SPEED) % 1;
    }

    const earthMaterial = earth.current.material as ShaderMaterial;
    const activeLightDirection = sceneLightDirection ?? fallbackLightDirection.set(...composition.light.fixedSunDir);
    earthMaterial.uniforms.lightDir.value.copy(activeLightDirection).normalize();
    earthMaterial.uniforms.cloudOffset.value = cloudOffset.current;
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
