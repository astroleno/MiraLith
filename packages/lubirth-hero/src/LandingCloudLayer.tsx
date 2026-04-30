"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  Color,
  CustomBlending,
  FrontSide,
  Group,
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
  reducedMotion?: boolean;
  paused?: boolean;
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
  { radius: 1.012, opacity: 0.35, offset: 0, parallax: 0.0052, shadow: 0.48, baseDepth: 1.08, topCap: 0.34, rimFocus: 0.15, edgeBreak: 0.82 },
  { radius: 1.038, opacity: 0.18, offset: 0.018, parallax: 0.0084, shadow: 0.22, baseDepth: 0.58, topCap: 1.16, rimFocus: 0.72, edgeBreak: 1.18, highOnly: true },
  { radius: 1.046, opacity: 0.21, offset: 0.031, parallax: 0.0072, shadow: 0.12, baseDepth: 0.28, topCap: 0.74, rimFocus: 0.36, edgeBreak: 1 }
];

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createCloudMaterial(composition: LandingComposition, layer: CloudShellLayer, cloudTexture: Texture) {
  return new ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudTexture },
      time: { value: 0 },
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
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vFresnel;

      void main() {
        vUv = uv;
        vLocalNormal = normalize(position);
        vec3 localUp = abs(vLocalNormal.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 localTangentA = normalize(cross(localUp, vLocalNormal));
        vec3 localTangentB = normalize(cross(vLocalNormal, localTangentA));
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
      uniform float time;
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
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vFresnel;

      const float PI = 3.14159265359;

      vec2 sphereUv(vec3 normal) {
        float u = atan(normal.z, normal.x) / (PI * 2.0) + 0.5;
        float v = asin(clamp(normal.y, -1.0, 1.0)) / PI + 0.5;
        return vec2(fract(u), clamp(v, 0.001, 0.999));
      }

      float cloudMask(vec2 uv) {
        vec2 wrappedUv = vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
        float raw = texture2D(cloudMap, wrappedUv).r;
        float wisps = smoothstep(0.14, 0.52, raw);
        float core = smoothstep(0.34, 0.78, raw);
        return clamp(wisps * 0.68 + core * 0.44, 0.0, 1.0);
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
        float ndl = dot(n, sunDirection);
        float day = smoothstep(-0.18, 0.34, ndl);
        float night = 1.0 - smoothstep(-0.18, 0.2, ndl);
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

        vec2 baseUv = sphereUv(localN);
        vec2 wind = vec2(
          shellOffset + time * (0.0024 + shellOffset * 0.006),
          shellOffset * 0.37 + time * 0.0008
        );
        vec2 viewShear = vec2(dot(viewDirection, vWorldTangentA), dot(viewDirection, vWorldTangentB));
        vec2 sunShear = vec2(dot(sunDirection, vWorldTangentA), dot(sunDirection, vWorldTangentB));
        vec2 parallax = viewShear * parallaxScale * (0.32 + limb * 0.58);
        vec2 sunOffset = sunShear * 0.012;

        float bottom = cloudMask(baseUv + wind - parallax * 0.72);
        float mid = cloudMask(baseUv + wind + parallax * 0.16);
        float top = cloudMask(baseUv + wind + parallax * 0.92);
        float shadowMask = cloudMask(baseUv + wind + sunOffset * (1.25 + limb * 0.85));
        float density = clamp(bottom * 0.3 + mid * 0.46 + top * 0.3, 0.0, 1.0);
        float baseMass = max(bottom * (0.94 + baseDepth * 0.22) - top * 0.44, 0.0) * limbVolume * baseDepth;
        float topCap = max(top - mid * 0.5, 0.0) * smoothstep(0.42, 0.9, rim) * topCapStrength;
        float layerSeparation = abs(top - bottom);
        float forwardStack = max(top - mid, 0.0);
        float backStack = max(mid - bottom, 0.0);
        float thickness = clamp(
          layerSeparation * 0.9 +
          forwardStack * 0.58 +
          backStack * 0.46 +
          limbVolume * mid * (0.5 + rimFocus * 0.22) +
          baseMass * 0.38,
          0.0,
          1.0
        );
        float selfShadow = clamp(
          shadowMask * shadowStrength * (0.76 + density * 0.64 + limbVolume * 0.42) + baseMass * 0.58,
          0.0,
          0.82
        );
        float light = mix(0.18, 1.02, day) * (1.0 - selfShadow) + twilight * 0.16 + limb * day * 0.1;

        vec3 cloudShadow = mix(vec3(0.04, 0.075, 0.14), vec3(0.28, 0.36, 0.46), mid);
        vec3 cloudLit = mix(vec3(0.68, 0.74, 0.8), vec3(1.0, 0.985, 0.92), smoothstep(0.18, 0.82, top));
        vec3 cloudBase = mix(cloudShadow, cloudLit, clamp(day * 0.76 + top * 0.3, 0.0, 1.0));
        vec3 warmEdge = vec3(1.0, 0.62, 0.28) * twilight * (0.06 + thickness * 0.06);
        vec3 blueNight = vec3(0.035, 0.11, 0.25) * night * (0.12 + thickness * 0.2);
        vec3 finalColor =
          cloudBase * lightColor * light * (0.78 + thickness * 0.6 + debugBoost * 0.2) +
          warmEdge +
          blueNight;
        finalColor += vec3(0.56, 0.66, 0.78) * limbVolume * density * thickness * (0.05 + day * 0.08);
        finalColor += vec3(0.86, 0.92, 0.98) * topCap * day * (0.22 + debugBoost * 0.08);
        finalColor = mix(
          finalColor,
          finalColor * vec3(0.48, 0.58, 0.72),
          clamp(baseMass * (1.02 - debugBoost * 0.2), 0.0, 0.7)
        );

        float edgeTrim = 1.0 - smoothstep(0.86, 0.98, rim);
        float extremeGrazing = smoothstep(0.82, 0.99, rim);
        float edgeNoise =
          noise2(baseUv * vec2(72.0, 31.0) + vec2(shellOffset * 41.0, shellOffset * 17.0)) * 0.62 +
          noise2(baseUv * vec2(151.0, 67.0) + vec2(shellOffset * 19.0, shellOffset * 53.0)) * 0.38;
        float edgeBreakup = smoothstep(0.34, 0.72, edgeNoise + density * 0.16 - extremeGrazing * 0.1);
        float brokenEdge = mix(1.0, mix(0.18, 1.0, edgeBreakup), extremeGrazing * edgeBreakStrength * (1.0 - debugBoost * 0.18));
        float alpha = (density * 0.36 + thickness * 0.52 + limbVolume * density * 0.18) *
          opacity *
          shellOpacity *
          shellFade *
          brokenEdge *
          mix(0.58, 1.0, edgeTrim) *
          mix(0.82, 1.08, closeStage) *
          mix(1.0, 1.82, debugBoost);

        if (alpha < 0.003) {
          discard;
        }

        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, mix(0.28, 0.52, debugBoost)));
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
  reducedMotion,
  paused
}: LandingCloudLayerProps) {
  const cloud = useRef<Mesh>(null);
  const cloudGroup = useRef<Group>(null);
  const { texture: cloudTexture, failed: cloudTextureFailed } = useLandingTexture(assets.earthClouds?.src, {
    colorSpace: assets.earthClouds?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const activeCloudShells = useMemo(
    () => CLOUD_SHELLS.filter((layer) => quality.tier === "high" || !layer.highOnly),
    [quality.tier]
  );
  const materials = useMemo(
    () => cloudTexture ? activeCloudShells.map((layer) => createCloudMaterial(composition, layer, cloudTexture)) : [],
    [activeCloudShells, cloudTexture, composition]
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

  useFrame((state) => {
    if (!cloudGroup.current || !enabled || !cloudTexture) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    if (sceneLightDirection) {
      lightDirection.copy(sceneLightDirection).normalize();
    } else {
      lightDirection.set(...composition.light.fixedSunDir).normalize();
    }

    if (!paused && !reducedMotion) {
      cloudGroup.current.rotation.y = elapsed * 0.026;
      cloudGroup.current.rotation.x = Math.sin(elapsed * 0.04) * 0.008;
      cloudGroup.current.rotation.z = Math.sin(elapsed * 0.031) * 0.007;
    }

    cloudGroup.current.children.forEach((child, index) => {
      const cloudMaterial = (child as Mesh).material as ShaderMaterial;
      child.rotation.y = elapsed * (0.012 + index * 0.007) + index * 0.24;
      child.rotation.x = Math.sin(elapsed * (0.026 + index * 0.006) + index) * 0.012;
      cloudMaterial.uniforms.cloudMap.value = cloudTexture;
      cloudMaterial.uniforms.time.value = elapsed;
      cloudMaterial.uniforms.closeStage.value = closeStage;
      cloudMaterial.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
      cloudMaterial.uniforms.debugBoost.value = emphasis ? 1 : 0;
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
              quality.tier === "high" ? Math.max(72, quality.segments) : quality.tier === "medium" ? 56 : 36,
              quality.tier === "high" ? 40 : quality.tier === "medium" ? 30 : 22
            ]}
          />
        </mesh>
      ))}
    </group>
  );
}
