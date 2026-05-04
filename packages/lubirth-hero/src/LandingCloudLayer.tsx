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
import { getRuntimeOpeningProgress, OPENING_FIELD_AUTO_ROTATE_START, type QualityProfile } from "@miralith/visual-core";
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
  { radius: 1.0048, opacity: 0.36, offset: 0, parallax: 0.00045, shadow: 0.18, baseDepth: 0.42, topCap: 0.28, rimFocus: 0.04, edgeBreak: 0.66 },
  { radius: 1.0102, opacity: 0.08, offset: 0.014, parallax: 0.0012, shadow: 0.08, baseDepth: 0.22, topCap: 0.46, rimFocus: 0.44, edgeBreak: 0.84, highOnly: true }
];
const CLOUD_TEXTURE_ART_OFFSET_X = 0.045;
const CLOUD_TEXTURE_ART_OFFSET_Y = 0.018;
const CLOUD_SCROLL_SPEED = 0.022;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createCloudMaterial(composition: LandingComposition, layer: CloudShellLayer, cloudTexture: Texture) {
  return new ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudTexture },
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
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldTangentA;
      varying vec3 vWorldTangentB;
      varying float vFresnel;

      float cloudRaw(vec2 uv) {
        vec2 wrappedUv = vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
        vec3 cloudRgb = texture2D(cloudMap, wrappedUv).rgb;
        float raw = dot(cloudRgb, vec3(0.2126, 0.7152, 0.0722));
        return pow(clamp(raw, 0.0, 1.0), 0.68);
      }

      float cloudMask(vec2 uv) {
        float raw = cloudRaw(uv);
        float wisps = smoothstep(0.14, 0.5, raw);
        float core = smoothstep(0.34, 0.72, raw);
        float brightCore = smoothstep(0.56, 0.86, raw);
        float brokenEdge = wisps * (1.0 - smoothstep(0.68, 0.96, raw));
        return clamp(wisps * 0.08 + core * 0.72 + brightCore * 0.54 + brokenEdge * 0.06, 0.0, 1.0);
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
        rawSharp = mix(rawSharp, broadWeather, 0.36 + closeStage * 0.18);
        float weatherMass = smoothstep(0.18, 0.42, broadWeather);
        float weatherCore = smoothstep(0.34, 0.62, broadWeather);
        float massGate = smoothstep(0.12, 0.42, rawMass);
        float photoWisps = smoothstep(0.18, 0.46, rawSharp) * (1.0 - smoothstep(0.64, 0.9, rawSharp)) * mix(0.18, 1.0, massGate);
        float photoCore = smoothstep(0.34, 0.66, rawSharp) * mix(0.18, 1.0, massGate);
        float photoBright = smoothstep(0.58, 0.86, rawSharp) * mix(0.12, 1.0, weatherMass);
        float bottom = cloudMask(baseUv + wind - parallax * 0.42);
        float massBody = weatherMass * 0.38 + weatherCore * 0.14 + photoCore * 0.44 + photoBright * 0.12;
        float mid = max(cloudMask(midUv) * 0.62, massBody);
        float top = cloudMask(baseUv + wind + parallax * 0.38);
        float shadowMask = cloudMask(baseUv + wind + sunOffset * (1.8 + limb * 0.9));
        float rawDensity = clamp(rawBottom * 0.08 + rawSharp * 0.5 + rawMass * 0.32 + rawTop * 0.1, 0.0, 1.0);
        float textureBody = clamp(rawSharp * 0.56 + rawMidBlur * 0.26 + rawMassNear * 0.18, 0.0, 1.0);
        float textureMod = mix(0.62, 1.02, smoothstep(0.18, 0.76, textureBody));
        float density = clamp(bottom * 0.08 + mid * 0.82 + top * 0.1, 0.0, 1.0);
        float opaqueCore = max(smoothstep(0.34, 0.64, rawSharp) * massGate, weatherCore * 0.48);
        float baseMass = max(bottom * (0.94 + baseDepth * 0.22) - top * 0.44, 0.0) * limbVolume * baseDepth;
        float topCap = max(top - mid * 0.5, 0.0) * smoothstep(0.42, 0.9, rim) * topCapStrength;
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
        float light = mix(0.16, 0.88, day) * (1.0 - selfShadow) + twilight * 0.14 + limb * day * 0.08;

        vec3 cloudShadow = mix(vec3(0.16, 0.21, 0.29), vec3(0.44, 0.5, 0.58), max(mid, weatherMass * 0.72));
        vec3 cloudLit = mix(vec3(0.56, 0.64, 0.72), vec3(0.75, 0.78, 0.78), smoothstep(0.12, 0.74, max(rawTop, rawSharp * 0.66)));
        vec3 cloudBase = mix(cloudShadow, cloudLit, clamp(day * (0.36 + weatherCore * 0.08) + top * 0.14 + photoBright * 0.08, 0.0, 1.0));
        cloudBase += vec3(0.048, 0.054, 0.06) * clamp((rawSharp - rawMidBlur) * (0.22 + closeStage * 0.12) * weatherMass, 0.0, 0.07) * day;
        cloudBase *= mix(0.82, 1.0, smoothstep(0.22, 0.82, textureBody));
        vec3 warmEdge = vec3(1.0, 0.62, 0.28) * twilight * (0.06 + thickness * 0.06);
        vec3 blueNight = vec3(0.035, 0.11, 0.25) * night * (0.12 + thickness * 0.2);
        vec3 finalColor =
          cloudBase * lightColor * light * (0.72 + thickness * 0.5 + debugBoost * 0.2) +
          warmEdge +
          blueNight;
        finalColor += vec3(0.56, 0.66, 0.78) * limbVolume * density * thickness * (0.05 + day * 0.08);
        finalColor += vec3(0.72, 0.8, 0.88) * topCap * day * (0.1 + debugBoost * 0.08);
        finalColor = mix(finalColor, finalColor * vec3(0.66, 0.74, 0.86), clamp(baseMass * (0.78 - debugBoost * 0.18), 0.0, 0.58));
        finalColor *= mix(0.78, 1.0, debugBoost);

        float edgeTrim = 1.0 - smoothstep(0.86, 0.98, rim);
        float extremeGrazing = smoothstep(0.82, 0.99, rim);
        float edgeNoise =
          noise2(baseUv * vec2(72.0, 31.0) + vec2(shellOffset * 41.0, shellOffset * 17.0)) * 0.62 +
          noise2(baseUv * vec2(151.0, 67.0) + vec2(shellOffset * 19.0, shellOffset * 53.0)) * 0.38;
        float edgeBreakup = smoothstep(0.34, 0.72, edgeNoise + density * 0.16 - extremeGrazing * 0.1);
        float brokenEdge = mix(1.0, mix(0.18, 1.0, edgeBreakup), extremeGrazing * edgeBreakStrength * (1.0 - debugBoost * 0.18));
        float alpha = (
          photoWisps * 0.1 +
          weatherMass * 0.32 +
          weatherCore * 0.2 +
          density * 0.38 +
          thickness * 0.38 +
          opaqueCore * 0.82 +
          limbVolume * density * 0.1
        ) *
          textureMod *
          opacity *
          shellOpacity *
          (shellFade + closeStage * 0.28) *
          brokenEdge *
          mix(0.58, 1.0, edgeTrim) *
          mix(0.98, 1.34, closeStage) *
          mix(1.0, 1.82, debugBoost);

        if (alpha < 0.003) {
          discard;
        }

        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, mix(0.38, 0.76, debugBoost)));
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
  const cloudOffset = useRef(0);
  const { texture: cloudTexture, failed: cloudTextureFailed } = useLandingTexture(assets.earthClouds?.src, {
    colorSpace: assets.earthClouds?.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping
  });
  const activeCloudShells = useMemo(
    () => CLOUD_SHELLS.filter((layer) => !layer.highOnly || (emphasis && quality.tier === "high")),
    [emphasis, quality.tier]
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

  useFrame((_state, delta) => {
    if (!cloudGroup.current || !enabled || !cloudTexture) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    if (!paused && !reducedMotion && progress >= OPENING_FIELD_AUTO_ROTATE_START) {
      cloudOffset.current = (cloudOffset.current + delta * CLOUD_SCROLL_SPEED) % 1;
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
      cloudMaterial.uniforms.cloudOffset.value = cloudOffset.current;
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
