"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AddEquation,
  AdditiveBlending,
  BackSide,
  Color,
  CustomBlending,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAtmosphereProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
}

const lightDirection = new Vector3();
const frameLightDirection = new Vector3();
const MAIN_CONTRAST = 0.48;
const MAIN_SOFTNESS = 1.0;
const NEAR_THICKNESS_FACTOR = 0.3;
const NEAR_CONTRAST = 0.4;
const NEAR_SOFTNESS = 1.0;
const SOFT_BOUNDARY_DELTA = 0.008;
const PERCEPTUAL_FLOOR = 0.004;
const SCALE_HEIGHT = 0.025;
const ATMOSPHERE_OFFSET = 0.001;
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

export function LandingAtmosphere({ composition, quality, sceneLightDirection }: LandingAtmosphereProps) {
  const baseMainIntensity = composition.atmosphere.enabled
    ? quality.tier === "low"
      ? composition.atmosphere.intensity * 0.62
      : composition.atmosphere.intensity
    : 0;
  const baseNearIntensity = composition.atmosphere.enabled && composition.atmosphere.nearShell
    ? (quality.tier === "low" ? composition.atmosphere.intensity * 0.48 : composition.atmosphere.intensity)
    : 0;
  const karmanMats = useRef<Array<{ opacity: number } | null>>([]);
  const outerHaloMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
        color: {
          value: new Color(
            composition.atmosphere.color[0],
            composition.atmosphere.color[1],
            composition.atmosphere.color[2]
          )
        },
        intensity: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewW;
        varying float vFresnel;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewW = normalize(cameraPosition - worldPosition.xyz);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vec3 viewDirection = normalize(-mvPosition.xyz);
          vec3 viewNormal = normalize(normalMatrix * normal);
          vFresnel = 1.0 - max(dot(viewNormal, viewDirection), 0.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 lightDir;
        uniform vec3 color;
        uniform float intensity;

        varying vec3 vNormalW;
        varying vec3 vViewW;
        varying float vFresnel;

        void main() {
          vec3 n = normalize(vNormalW);
          float ndl = max(dot(n, normalize(lightDir)), 0.0);
          float edge = pow(clamp(vFresnel, 0.0, 1.0), 6.8) * smoothstep(0.7, 0.98, vFresnel);
          float daylight = 0.28 + 0.72 * smoothstep(0.0, 0.34, ndl);
          float glow = edge * daylight * intensity;
          if (glow < 0.006) {
            discard;
          }
          vec3 finalColor = mix(vec3(0.04, 0.22, 0.62), color, 0.78) * glow * 1.18;
          gl_FragColor = vec4(finalColor, clamp(glow * 0.3, 0.0, 0.55));
        }
      `,
      transparent: true,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: SrcAlphaFactor,
      blendDst: OneFactor,
      side: BackSide,
      depthWrite: false,
      depthTest: true
    });
  }, [
    composition.atmosphere.color,
    composition.light.fixedSunDir
  ]);

  const mainMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
        color: {
          value: new Color(
            composition.atmosphere.color[0],
            composition.atmosphere.color[1],
            composition.atmosphere.color[2]
          )
        },
        intensity: { value: baseMainIntensity * 0.22 },
        fresnelPower: { value: composition.atmosphere.fresnelPower },
        mainContrast: { value: MAIN_CONTRAST },
        mainSoftness: { value: MAIN_SOFTNESS },
        earthRadius: { value: composition.earth.radius },
        thickness: { value: composition.atmosphere.thickness },
        softBoundaryDelta: { value: SOFT_BOUNDARY_DELTA },
        perceptualFloor: { value: PERCEPTUAL_FLOOR },
        scaleHeight: { value: SCALE_HEIGHT },
        offset: { value: ATMOSPHERE_OFFSET }
      },
      vertexShader: `
        uniform float earthRadius;
        uniform float thickness;
        uniform float offset;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        varying vec3 vViewW;
        varying float vFresnel;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewW = normalize(cameraPosition - worldPosition.xyz);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vec3 viewDirection = normalize(-mvPosition.xyz);
          vec3 viewNormal = normalize(normalMatrix * normal);
          vFresnel = pow(1.0 - max(dot(viewNormal, viewDirection), 0.0), 2.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 lightDir;
        uniform vec3 color;
        uniform float intensity;
        uniform float fresnelPower;
        uniform float mainContrast;
        uniform float mainSoftness;
        uniform float earthRadius;
        uniform float thickness;
        uniform float softBoundaryDelta;
        uniform float perceptualFloor;
        uniform float scaleHeight;
        uniform float offset;

        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        varying vec3 vViewW;
        varying float vFresnel;

        void main() {
          vec3 n = normalize(vNormalW);
          float ndl = max(dot(n, normalize(lightDir)), 0.0);
          float day = smoothstep(0.0, 0.3, ndl);
          float dayNightFactor = mix(1.0 - mainContrast, 1.0, day);
          float baseIntensity = intensity * dayNightFactor;
          float edgeEffect = pow(vFresnel, max(1.0, fresnelPower * 1.6));

          float outerRadius = earthRadius * (1.0 + thickness);
          float innerRadius = earthRadius * (1.0 - offset);
          vec3 oc = cameraPosition;
          vec3 rd = normalize(vWorldPos - cameraPosition);
          float b = length(cross(oc, rd));
          float tO = sqrt(max(outerRadius * outerRadius - b * b, 0.0));
          float tI = sqrt(max(innerRadius * innerRadius - b * b, 0.0));
          float pathLen = max(tO - tI, 0.0);
          float pathMax = max(sqrt(max(outerRadius * outerRadius - innerRadius * innerRadius, 0.0)), 1e-5);
          float optical = clamp(pathLen / pathMax, 0.0, 1.0);
          float softness = clamp(mainSoftness / 3.0, 0.0, 1.0);
          float heightEffect = pow(optical, mix(1.2, 0.35, softness));

          float wOpt = smoothstep(0.02, 0.06, optical);
          float wNight = mix(wOpt, 1.0, day);

          float softBoundary = 1.0;
          if (softBoundaryDelta > 0.0) {
            float edge0 = outerRadius * (1.0 - softBoundaryDelta);
            softBoundary = 1.0 - smoothstep(edge0, outerRadius, b);
          }

          float finalIntensity = baseIntensity * edgeEffect * heightEffect * wNight * softBoundary;

          if (scaleHeight > 0.0) {
            float hRad = max(scaleHeight * earthRadius, 1e-5);
            float hClose = max(b - innerRadius, 0.0);
            float scaleWeight = exp(-hClose / hRad);
            float edgeWeight = smoothstep(0.0, hRad * 2.0, outerRadius - b);
            finalIntensity *= scaleWeight * edgeWeight;
          }

          if (perceptualFloor > 0.0) {
            float floorWeight = smoothstep(perceptualFloor, perceptualFloor * 2.0, finalIntensity);
            finalIntensity *= floorWeight;
          }

          if (finalIntensity < 0.012) {
            discard;
          }

          vec3 finalColor = color * finalIntensity * 2.4;
          float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          finalColor *= 1.0 + (noise - 0.5) * 0.004;
          gl_FragColor = vec4(finalColor, clamp(finalIntensity * 0.95, 0.0, 1.0));
        }
      `,
      transparent: true,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: SrcAlphaFactor,
      blendDst: OneFactor,
      side: BackSide,
      depthWrite: false
    });
  }, [
    composition.atmosphere.color,
    composition.atmosphere.enabled,
    composition.atmosphere.fresnelPower,
    baseMainIntensity,
    composition.atmosphere.thickness,
    composition.earth.radius,
    composition.light.fixedSunDir,
  ]);

  const nearMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
        color: {
          value: new Color(
            composition.atmosphere.color[0],
            composition.atmosphere.color[1],
            composition.atmosphere.color[2]
          )
        },
        intensity: { value: baseNearIntensity * 0.28 },
        nearStrength: { value: composition.atmosphere.nearStrength },
        nearFactor: { value: NEAR_THICKNESS_FACTOR },
        fresnelPower: { value: composition.atmosphere.fresnelPower },
        nearContrast: { value: NEAR_CONTRAST },
        nearSoftness: { value: NEAR_SOFTNESS },
        earthRadius: { value: composition.earth.radius },
        thickness: { value: composition.atmosphere.thickness },
        softBoundaryDelta: { value: SOFT_BOUNDARY_DELTA },
        perceptualFloor: { value: PERCEPTUAL_FLOOR },
        scaleHeight: { value: SCALE_HEIGHT },
        offset: { value: ATMOSPHERE_OFFSET }
      },
      vertexShader: `
        uniform float earthRadius;
        uniform float thickness;
        uniform float nearFactor;
        uniform float offset;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        varying vec3 vViewW;
        varying float vFresnel;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewW = normalize(cameraPosition - worldPosition.xyz);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vec3 viewDirection = normalize(-mvPosition.xyz);
          vec3 viewNormal = normalize(normalMatrix * normal);
          vFresnel = pow(1.0 - max(dot(viewNormal, viewDirection), 0.0), 2.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 lightDir;
        uniform vec3 color;
        uniform float intensity;
        uniform float nearStrength;
        uniform float nearFactor;
        uniform float fresnelPower;
        uniform float nearContrast;
        uniform float nearSoftness;
        uniform float earthRadius;
        uniform float thickness;
        uniform float softBoundaryDelta;
        uniform float perceptualFloor;
        uniform float scaleHeight;
        uniform float offset;

        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        varying vec3 vViewW;
        varying float vFresnel;

        void main() {
          vec3 n = normalize(vNormalW);
          float ndl = max(dot(n, normalize(lightDir)), 0.0);
          float day = smoothstep(0.0, 0.3, ndl);
          float dayNightFactor = mix(1.0 - nearContrast, 1.0, day);

          float outerRadius = earthRadius * (1.0 + thickness * nearFactor);
          float innerRadius = earthRadius * (1.0 - offset);
          vec3 oc = cameraPosition;
          vec3 rd = normalize(vWorldPos - cameraPosition);
          float b = length(cross(oc, rd));
          float tO = sqrt(max(outerRadius * outerRadius - b * b, 0.0));
          float tI = sqrt(max(innerRadius * innerRadius - b * b, 0.0));
          float pathLen = max(tO - tI, 0.0);
          float pathMax = max(sqrt(max(outerRadius * outerRadius - innerRadius * innerRadius, 0.0)), 1e-5);
          float optical = clamp(pathLen / pathMax, 0.0, 1.0);
          float softness = clamp(nearSoftness / 3.0, 0.0, 1.0);
          float heightEffect = pow(optical, mix(1.2, 0.35, softness));
          float edgeEffect = pow(vFresnel, max(1.0, fresnelPower * 1.45));

          float wOpt = smoothstep(0.02, 0.06, optical);
          float wNight = mix(wOpt, 1.0, day);

          float softBoundary = 1.0;
          if (softBoundaryDelta > 0.0) {
            float edge0 = outerRadius * (1.0 - softBoundaryDelta);
            softBoundary = 1.0 - smoothstep(edge0, outerRadius, b);
          }

          float finalIntensity = intensity * nearStrength * heightEffect * dayNightFactor * edgeEffect * wNight * softBoundary;

          if (scaleHeight > 0.0) {
            float hRad = max(scaleHeight * earthRadius, 1e-5);
            float hClose = max(b - innerRadius, 0.0);
            float scaleWeight = exp(-hClose / hRad);
            float edgeWeight = smoothstep(0.0, hRad * 2.0, outerRadius - b);
            finalIntensity *= scaleWeight * edgeWeight;
          }

          if (perceptualFloor > 0.0) {
            float floorWeight = smoothstep(perceptualFloor, perceptualFloor * 2.0, finalIntensity);
            finalIntensity *= floorWeight;
          }

          if (finalIntensity < 0.012) {
            discard;
          }

          vec3 finalColor = color * finalIntensity * 3.0;
          float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          finalColor *= 1.0 + (noise - 0.5) * 0.004;
          gl_FragColor = vec4(finalColor, clamp(finalIntensity * 0.9, 0.0, 1.0));
        }
      `,
      transparent: true,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: SrcAlphaFactor,
      blendDst: OneFactor,
      side: BackSide,
      depthWrite: false
    });
  }, [
    composition.atmosphere.color,
    composition.atmosphere.enabled,
    composition.atmosphere.fresnelPower,
    composition.atmosphere.nearShell,
    composition.atmosphere.nearStrength,
    composition.atmosphere.thickness,
    composition.earth.radius,
    composition.light.fixedSunDir,
    baseNearIntensity
  ]);
  const karmanLineMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
        blue: { value: new Color(0.36, 0.78, 1.0) },
        white: { value: new Color(0.9, 0.98, 1.0) },
        intensity: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying float vFresnel;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vec3 viewDirection = normalize(-mvPosition.xyz);
          vec3 viewNormal = normalize(normalMatrix * normal);
          vFresnel = 1.0 - max(dot(viewNormal, viewDirection), 0.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 lightDir;
        uniform vec3 blue;
        uniform vec3 white;
        uniform float intensity;

        varying vec3 vNormalW;
        varying float vFresnel;

        void main() {
          vec3 n = normalize(vNormalW);
          float ndl = dot(n, normalize(lightDir));
          float rim = clamp(vFresnel, 0.0, 1.0);
          float whiteLine = smoothstep(0.91, 0.965, rim) * (1.0 - smoothstep(0.969, 0.992, rim));
          float blueLine = smoothstep(0.84, 0.955, rim) * (1.0 - smoothstep(0.975, 1.0, rim));
          float day = 0.32 + 0.68 * smoothstep(-0.08, 0.34, ndl);
          float twilight = 1.0 - smoothstep(0.0, 0.34, abs(ndl));
          vec3 color = white * whiteLine * 1.5 + blue * blueLine * 0.42 + vec3(1.0, 0.36, 0.14) * twilight * whiteLine * 0.16;
          float alpha = (whiteLine * 0.32 + blueLine * 0.13) * day * intensity;
          if (alpha < 0.004) {
            discard;
          }
          gl_FragColor = vec4(color * alpha * 2.15, clamp(alpha, 0.0, 0.46));
        }
      `,
      transparent: true,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: SrcAlphaFactor,
      blendDst: OneFactor,
      side: BackSide,
      depthWrite: false,
      depthTest: true
    });
  }, [composition.light.fixedSunDir]);

  useFrame(() => {
    const progress = getRuntimeOpeningProgress(0);
    if (sceneLightDirection) {
      frameLightDirection.copy(sceneLightDirection).normalize();
    } else {
      frameLightDirection.set(...composition.light.fixedSunDir).normalize();
    }
    const stage = smoothstep(0.26, 0.86, progress);
    mainMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    nearMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    karmanLineMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    mainMaterial.uniforms.intensity.value = baseMainIntensity * stage;
    nearMaterial.uniforms.intensity.value = baseNearIntensity * smoothstep(0.2, 0.78, progress);
    outerHaloMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    outerHaloMaterial.uniforms.intensity.value = baseMainIntensity * smoothstep(0.18, 0.92, progress) * 0.22;
    karmanLineMaterial.uniforms.intensity.value = baseMainIntensity * (0.16 + smoothstep(0.18, 0.86, progress) * 0.62);

    const karmanStage = 0.26 + smoothstep(0.18, 0.9, progress) * 0.74;
    const targetOpacities = composition.atmosphere.karmanGlow
      ? [0.055 * karmanStage, 0.04 * karmanStage, 0.025 * karmanStage]
      : [0, 0, 0];
    karmanMats.current.forEach((material, index) => {
      if (material) {
        material.opacity = targetOpacities[index] ?? 0;
      }
    });
  });

  return (
    <>
      <mesh material={outerHaloMaterial} renderOrder={4}>
        <sphereGeometry
          args={[
            composition.earth.radius * 1.026,
            quality.segments,
            quality.segments
          ]}
        />
      </mesh>
      <mesh material={mainMaterial} renderOrder={5}>
        <sphereGeometry
          args={[
            composition.earth.radius * (1 + composition.atmosphere.thickness),
            quality.segments,
            quality.segments
          ]}
        />
      </mesh>
      <mesh material={nearMaterial} renderOrder={6}>
        <sphereGeometry
          args={[
            composition.earth.radius * (1 + composition.atmosphere.thickness * NEAR_THICKNESS_FACTOR),
            quality.segments,
            quality.segments
          ]}
        />
      </mesh>
      <mesh material={karmanLineMaterial} renderOrder={7}>
        <sphereGeometry
          args={[
            composition.earth.radius * 1.018,
            quality.segments,
            quality.segments
          ]}
        />
      </mesh>
      <mesh renderOrder={18} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[composition.earth.radius * 1.038, 0.0045, 8, 224]} />
        <meshBasicMaterial
          ref={(material) => {
            karmanMats.current[0] = material;
          }}
          color="#c7b06b"
          transparent
          opacity={composition.atmosphere.karmanGlow ? 0.014 : 0}
          blending={AdditiveBlending}
          depthTest
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={17} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[composition.earth.radius * 1.022, 0.008, 8, 224]} />
        <meshBasicMaterial
          ref={(material) => {
            karmanMats.current[1] = material;
          }}
          color="#72c9ff"
          transparent
          opacity={composition.atmosphere.karmanGlow ? 0.01 : 0}
          blending={AdditiveBlending}
          depthTest
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={16} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[composition.earth.radius * 0.99, 0.012, 8, 192]} />
        <meshBasicMaterial
          ref={(material) => {
            karmanMats.current[2] = material;
          }}
          color="#9fdcff"
          transparent
          opacity={composition.atmosphere.karmanGlow ? 0.006 : 0}
          blending={AdditiveBlending}
          depthTest
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
