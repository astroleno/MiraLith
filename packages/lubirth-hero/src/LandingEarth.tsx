"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
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
}

const lightDirection = new Vector3();
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

export function LandingEarth({
  composition,
  assets,
  quality,
  showTextureClouds = true,
  reducedMotion,
  paused,
  sceneLightDirection
}: LandingEarthProps) {
  const earth = useRef<Mesh>(null);
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
  const { texture: cloudTexture } = useLandingTexture(assets.earthClouds?.src, {
    colorSpace: assets.earthClouds?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const activeDayTexture = dayTexture ?? proceduralDayTexture;
  const activeNightTexture = nightTexture ?? activeDayTexture;
  const activeCloudTexture = cloudTexture ?? activeDayTexture;

  const material = useMemo(
    () => {
      activeDayTexture.colorSpace = SRGBColorSpace;
      activeDayTexture.wrapS = RepeatWrapping;
      activeNightTexture.colorSpace = SRGBColorSpace;
      activeNightTexture.wrapS = RepeatWrapping;
      activeCloudTexture.colorSpace = SRGBColorSpace;
      activeCloudTexture.wrapS = RepeatWrapping;
      activeCloudTexture.wrapT = RepeatWrapping;

      return new ShaderMaterial({
        uniforms: {
          dayMap: { value: activeDayTexture },
          nightMap: { value: activeNightTexture },
          cloudMap: { value: activeCloudTexture },
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
          cloudOpacity: {
            value: composition.earth.useClouds && showTextureClouds ? composition.earth.cloudOpacity * 0.54 : 0
          },
          cloudOffset: { value: 0 },
          rimStrength: { value: composition.earth.rimStrength },
          rimWidth: { value: composition.earth.rimWidth },
          closeStage: { value: 1 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vViewW;

          void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vViewW = normalize(cameraPosition - worldPosition.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D dayMap;
          uniform sampler2D nightMap;
          uniform sampler2D cloudMap;
          uniform vec3 lightDir;
          uniform vec3 lightColor;
          uniform float sunIntensity;
          uniform float ambient;
          uniform float edge;
          uniform float nightBoost;
          uniform float cloudOpacity;
          uniform float cloudOffset;
          uniform float rimStrength;
          uniform float rimWidth;
          uniform float closeStage;

          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vViewW;

          float grain(vec2 uv) {
            return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
          }

          void main() {
            vec3 n = normalize(vNormalW);
            vec3 l = normalize(lightDir);
            vec3 v = normalize(vViewW);
            float ndl = dot(n, l);
            float fresnel = 1.0 - max(dot(n, v), 0.0);
            float closeTransition = clamp(edge * 0.32, 0.04, 0.058);
            float fieldTransition = clamp(edge * 1.16, 0.13, 0.18);
            float transitionWidth = mix(fieldTransition, closeTransition, closeStage);
            float dayW = smoothstep(-transitionWidth * 1.12, transitionWidth * 1.18, ndl);
            float nightW = 1.0 - dayW;
            float deepNightW = 1.0 - smoothstep(-transitionWidth * 2.7, -transitionWidth * 0.86, ndl);

            vec3 dayTex = pow(texture2D(dayMap, vUv).rgb, vec3(1.06));
            vec3 nightTex = pow(texture2D(nightMap, vUv).rgb, vec3(0.9));
            vec2 cloudUv = vec2(fract(vUv.x + cloudOffset), fract(vUv.y + cloudOffset * 0.18));
            float cloudRaw = texture2D(cloudMap, cloudUv).r;
            float cloudRelief = (cloudRaw - texture2D(cloudMap, cloudUv + vec2(0.0064, -0.0042)).r) * 1.38;
            float cloudMask = smoothstep(0.13, 0.54, cloudRaw) * cloudOpacity;
            float cloudCore = smoothstep(0.28, 0.7, cloudRaw) * cloudOpacity;
            float cloudAltitude = pow(fresnel, 2.35) * cloudMask * (0.38 + closeStage * 0.78);
            float cloudShadow = smoothstep(0.17, 0.62, texture2D(cloudMap, cloudUv + vec2(-0.008, 0.0052)).r)
              * cloudOpacity * (0.32 + dayW * 0.52);
            vec3 cloudCol = mix(vec3(0.38, 0.45, 0.52), vec3(0.98, 0.97, 0.9), cloudRaw);
            cloudCol += vec3(0.58, 0.64, 0.7) * max(cloudRelief, 0.0);
            cloudCol += vec3(0.2, 0.3, 0.48) * cloudAltitude;
            cloudCol -= vec3(0.25, 0.29, 0.36) * max(-cloudRelief, 0.0);
            vec3 shadowedDay = dayTex * (1.0 - cloudShadow * 1.02);
            float cloudLitEdge = smoothstep(0.44, 0.86, cloudRaw) * smoothstep(-0.1, 0.3, ndl);
            vec3 cloudWarmEdge = vec3(1.0, 0.82, 0.54) * cloudLitEdge * (0.2 + cloudAltitude * 0.3);
            vec3 daySurface = mix(
              shadowedDay,
              max(shadowedDay, cloudCol + cloudWarmEdge),
              clamp(cloudMask * (1.14 + cloudCore * 0.24), 0.0, 1.0)
            );
            float dayLight = pow(max(ndl, 0.0), 0.82);
            float grazingSun = pow(
              clamp((ndl + transitionWidth * 1.45) / max(transitionWidth * 2.7, 0.001), 0.0, 1.0),
              1.32
            ) * (1.0 - smoothstep(transitionWidth * 0.55, transitionWidth * 2.4, abs(ndl)));
            vec3 dayCol = daySurface * lightColor * (ambient * 0.5 + (dayLight + grazingSun * 0.22) * sunIntensity) * dayW * 0.55;
            vec2 glowStep = vec2(0.0024, 0.0012);
            vec3 nightGlowTex = (
              texture2D(nightMap, vUv).rgb +
              texture2D(nightMap, vUv + glowStep).rgb +
              texture2D(nightMap, vUv - glowStep).rgb +
              texture2D(nightMap, vUv + glowStep.yx).rgb +
              texture2D(nightMap, vUv - glowStep.yx).rgb
            ) * 0.2;
            nightGlowTex = pow(nightGlowTex, vec3(0.92));
            vec3 cityCore = nightTex * vec3(1.0, 0.76, 0.42) * nightBoost * pow(nightW, 1.18) * 2.65;
            vec3 cityHalo = nightGlowTex * vec3(0.95, 0.48, 0.18) * nightBoost * pow(nightW, 0.62) * 0.95;
            vec3 cityCol = cityCore + cityHalo;
            vec3 moonlitLand = daySurface * vec3(0.1, 0.18, 0.32) * deepNightW * 0.24;
            vec3 moonlitClouds = cloudCol * max(cloudMask, cloudCore) * deepNightW * vec3(0.18, 0.27, 0.44) * 1.35;

            float terminator = 1.0 - smoothstep(0.0, transitionWidth * 0.78, abs(ndl));
            float blueTwilight =
              smoothstep(-transitionWidth * 1.15, -transitionWidth * 0.18, ndl) *
              (1.0 - smoothstep(transitionWidth * 0.02, transitionWidth * 0.85, ndl));
            float warmEdge =
              smoothstep(-transitionWidth * 0.42, -transitionWidth * 0.04, ndl) *
              (1.0 - smoothstep(0.0, transitionWidth * 0.38, ndl));
            vec3 terminatorCol =
              vec3(0.035, 0.11, 0.24) * blueTwilight * 0.08 +
              vec3(0.98, 0.48, 0.14) * warmEdge * 0.026;
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
              mix(0.82, 0.42, closeStage);

            float innerRim = pow(fresnel, max(rimWidth * 1.5, 0.8));
            float outerRim = pow(fresnel, max(rimWidth * 0.8, 0.3));
            float rimEffect = (innerRim * 0.7 + outerRim * 0.3) * rimStrength;
            float dayNightRim = 0.28 + 0.72 * max(ndl, 0.0);
            rimEffect *= dayNightRim;
            vec3 rimCol = mix(vec3(0.04, 0.18, 0.46), vec3(0.18, 0.5, 0.86), innerRim) * rimEffect * 0.34;
            float horizonNeedle = pow(fresnel, 13.5) * (0.28 + 0.72 * dayW) * closeStage;
            vec3 needleCol = vec3(0.92, 0.97, 1.0) * horizonNeedle * 0.14;

            vec3 color = dayCol + cityCol + moonlitLand + moonlitClouds + twilightFill + terminatorCol + rimCol + needleCol;
            color = color / (1.0 + max(color - vec3(0.78), vec3(0.0)) * 0.82);
            color = pow(max(color, vec3(0.0)), vec3(1.08));
            color *= 0.96 + (grain(gl_FragCoord.xy) - 0.5) * 0.026;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
    },
    [
      composition.earth.nightIntensity,
      composition.earth.cloudOpacity,
      composition.earth.rimStrength,
      composition.earth.rimWidth,
      composition.earth.terminatorSoftness,
      composition.earth.useClouds,
      showTextureClouds,
      composition.light.ambientIntensity,
      composition.light.color,
      composition.light.fixedSunDir,
      composition.light.intensity,
      activeDayTexture,
      activeCloudTexture,
      activeNightTexture
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
    earthMaterial.uniforms.cloudOpacity.value =
      composition.earth.useClouds && showTextureClouds ? composition.earth.cloudOpacity * 0.54 : 0;
    const progress = typeof window === "undefined" ? 1 : Math.min(1, Math.max(0, window.__MiraLithOpeningProgress ?? 0));
    if (!shouldLoadNightTexture && progress > 0.28) {
      setShouldLoadNightTexture(true);
    }
    earthMaterial.uniforms.closeStage.value = 1 - smoothstep(0.18, 0.86, progress);
    if (!paused && !reducedMotion && progress >= OPENING_FIELD_AUTO_ROTATE_START) {
      earthMaterial.uniforms.cloudOffset.value = (earthMaterial.uniforms.cloudOffset.value + delta * 0.0045) % 1;
    }
    earthMaterial.uniforms.rimStrength.value = composition.earth.rimStrength;
    earthMaterial.uniforms.rimWidth.value = composition.earth.rimWidth;

    earth.current.rotation.x = 0;
    earth.current.rotation.y = MathUtils.degToRad(composition.earth.yawDeg);
  });

  return (
    <mesh ref={earth} material={material}>
      <sphereGeometry args={[composition.earth.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
