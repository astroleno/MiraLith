"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AddEquation,
  AdditiveBlending,
  BackSide,
  Color,
  CustomBlending,
  FrontSide,
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
          float edge = pow(clamp(vFresnel, 0.0, 1.0), 8.4) * smoothstep(0.82, 0.99, vFresnel);
          float daylight = 0.28 + 0.72 * smoothstep(0.0, 0.34, ndl);
          float glow = edge * daylight * intensity;
          if (glow < 0.006) {
            discard;
          }
          vec3 finalColor = mix(vec3(0.02, 0.18, 0.58), color, 0.84) * glow * 1.34;
          gl_FragColor = vec4(finalColor, clamp(glow * 0.36, 0.0, 0.5));
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
        sunset: { value: new Color(1.0, 0.44, 0.16) },
        intensity: { value: 0 },
        closeStage: { value: 1 },
        earthRadius: { value: composition.earth.radius }
      },
      vertexShader: `
        uniform float earthRadius;
        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        varying vec3 vPlanetCenterW;
        varying float vWorldRadius;
        varying float vFresnel;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vec4 centerWorld = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec3 radiusAxis = (modelMatrix * vec4(earthRadius, 0.0, 0.0, 0.0)).xyz;
          vWorldPos = worldPosition.xyz;
          vPlanetCenterW = centerWorld.xyz;
          vWorldRadius = max(length(radiusAxis), 1e-5);
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
        uniform vec3 sunset;
        uniform float intensity;
        uniform float closeStage;

        varying vec3 vNormalW;
        varying vec3 vWorldPos;
        varying vec3 vPlanetCenterW;
        varying float vWorldRadius;
        varying float vFresnel;

        const float PI = 3.14159265359;
        const float FAR_HIT = 10000.0;
        const int PRIMARY_STEPS = 8;
        const int LIGHT_STEPS = 2;

        vec2 rayVsSphere(vec3 origin, vec3 direction, float radius) {
          float b = dot(origin, direction);
          float c = dot(origin, origin) - radius * radius;
          float d = b * b - c;
          if (d < 0.0) {
            return vec2(FAR_HIT, -FAR_HIT);
          }

          float root = sqrt(d);
          return vec2(-b - root, -b + root);
        }

        float phaseRay(float cos2Theta) {
          return (3.0 / (16.0 * PI)) * (1.0 + cos2Theta);
        }

        float phaseMie(float g, float cosTheta, float cos2Theta) {
          float g2 = g * g;
          float denom = 1.0 + g2 - 2.0 * g * cosTheta;
          denom *= sqrt(max(denom, 1e-5));
          return (3.0 / (8.0 * PI)) * ((1.0 - g2) * (1.0 + cos2Theta)) / max((2.0 + g2) * denom, 1e-5);
        }

        float densityAt(vec3 position, float planetRadius, float scaleHeight) {
          float height = max(length(position) - planetRadius, 0.0);
          return exp(-height / max(scaleHeight, 1e-5));
        }

        float opticDepth(vec3 origin, vec3 direction, float atmosphereRadius, float planetRadius, float scaleHeight) {
          vec2 hit = rayVsSphere(origin, direction, atmosphereRadius);
          float rayLength = max(hit.y, 0.0);
          float stepLength = rayLength / float(LIGHT_STEPS);
          vec3 samplePoint = origin + direction * (stepLength * 0.5);
          float sum = 0.0;

          for (int i = 0; i < LIGHT_STEPS; i++) {
            float belowSurface = 1.0 - smoothstep(planetRadius * 0.998, planetRadius * 1.002, length(samplePoint));
            sum += mix(densityAt(samplePoint, planetRadius, scaleHeight), 18.0, belowSurface);
            samplePoint += direction * stepLength;
          }

          return sum * stepLength;
        }

        vec3 closeScatter(vec3 origin, vec3 direction, vec2 interval, vec3 sunDirection, float planetRadius, float atmosphereRadius) {
          float rayScaleHeight = planetRadius * mix(0.026, 0.014, closeStage);
          float mieScaleHeight = planetRadius * mix(0.012, 0.006, closeStage);
          vec3 rayBeta = vec3(0.045, 0.13, 0.36);
          vec3 mieBeta = vec3(0.082);
          float stepLength = max(interval.y - interval.x, 0.0) / float(PRIMARY_STEPS);
          vec3 samplePoint = origin + direction * (interval.x + stepLength * 0.5);
          vec3 raySum = vec3(0.0);
          vec3 mieSum = vec3(0.0);
          float rayDepth = 0.0;
          float mieDepth = 0.0;

          for (int i = 0; i < PRIMARY_STEPS; i++) {
            float rayDensity = densityAt(samplePoint, planetRadius, rayScaleHeight) * stepLength;
            float mieDensity = densityAt(samplePoint, planetRadius, mieScaleHeight) * stepLength;
            rayDepth += rayDensity;
            mieDepth += mieDensity;

            float rayLight = opticDepth(samplePoint, sunDirection, atmosphereRadius, planetRadius, rayScaleHeight);
            float mieLight = opticDepth(samplePoint, sunDirection, atmosphereRadius, planetRadius, mieScaleHeight);
            vec3 attenuation = exp(-(rayDepth + rayLight) * rayBeta - (mieDepth + mieLight) * mieBeta * 1.22);
            raySum += rayDensity * attenuation;
            mieSum += mieDensity * attenuation;
            samplePoint += direction * stepLength;
          }

          float cosTheta = dot(direction, -sunDirection);
          float cos2Theta = cosTheta * cosTheta;
          return raySum * rayBeta * phaseRay(cos2Theta) + mieSum * mieBeta * phaseMie(-0.78, cosTheta, cos2Theta);
        }

        void main() {
          vec3 n = normalize(vNormalW);
          vec3 sunDirection = normalize(lightDir);
          float ndl = dot(n, sunDirection);
          float rim = clamp(vFresnel, 0.0, 1.0);
          float closeNarrow = smoothstep(0.25, 1.0, closeStage);
          vec3 origin = cameraPosition - vPlanetCenterW;
          vec3 direction = normalize(vWorldPos - cameraPosition);
          float planetRadius = vWorldRadius;
          float impact = length(cross(origin, direction)) / planetRadius;
          float heightOverSurface = impact - 1.0;
          float whiteHeight = smoothstep(-0.003, 0.00025, heightOverSurface)
            * (1.0 - smoothstep(mix(0.006, 0.0018, closeNarrow), mix(0.01, 0.0036, closeNarrow), heightOverSurface));
          float blueHeight = smoothstep(mix(0.0008, 0.0015, closeNarrow), mix(0.006, 0.0032, closeNarrow), heightOverSurface)
            * (1.0 - smoothstep(mix(0.014, 0.0048, closeNarrow), mix(0.021, 0.0084, closeNarrow), heightOverSurface));
          float heightFade = 1.0 - smoothstep(mix(0.016, 0.0056, closeNarrow), mix(0.026, 0.0094, closeNarrow), heightOverSurface);
          float whiteLine = smoothstep(mix(0.84, 0.92, closeNarrow), mix(0.955, 0.98, closeNarrow), rim) * whiteHeight;
          float blueLine = smoothstep(mix(0.68, 0.78, closeNarrow), mix(0.88, 0.94, closeNarrow), rim) * blueHeight;
          float outerAirglow = smoothstep(mix(0.0015, 0.0012, closeNarrow), mix(0.009, 0.004, closeNarrow), heightOverSurface)
            * (1.0 - smoothstep(mix(0.02, 0.007, closeNarrow), mix(0.034, 0.014, closeNarrow), heightOverSurface))
            * smoothstep(mix(0.74, 0.84, closeNarrow), mix(0.92, 0.975, closeNarrow), rim);
          float horizonGate = smoothstep(mix(0.68, 0.78, closeNarrow), mix(0.88, 0.94, closeNarrow), rim) * heightFade;
          float farFade = 1.0 - smoothstep(0.996, 1.0, rim);
          float atmosphereRadius = planetRadius * mix(1.038, 1.018, closeStage);
          vec2 atmosphereHit = rayVsSphere(origin, direction, atmosphereRadius);
          vec2 groundHit = rayVsSphere(origin, direction, planetRadius * 1.002);
          atmosphereHit.x = max(atmosphereHit.x, 0.0);
          if (groundHit.x > 0.0) {
            atmosphereHit.y = min(atmosphereHit.y, groundHit.x);
          }

          vec3 scatter = vec3(0.0);
          if (atmosphereHit.x <= atmosphereHit.y) {
            scatter = closeScatter(origin, direction, atmosphereHit, sunDirection, planetRadius, atmosphereRadius);
          }

          float day = 0.18 + 0.82 * smoothstep(-0.12, 0.36, ndl);
          float twilight = 1.0 - smoothstep(0.0, 0.42, abs(ndl));
          float scatterLuma = dot(scatter, vec3(0.2126, 0.7152, 0.0722));
          vec3 scatterColor = scatter * vec3(0.62, 0.88, 1.35) * 4.8 * horizonGate;
          vec3 color =
            scatterColor +
            white * whiteLine * mix(0.74, 1.34, closeStage) +
            blue * blueLine * mix(0.16, 0.34, closeStage) +
            mix(blue, vec3(0.78, 0.94, 1.0), 0.28) * outerAirglow * mix(0.12, 0.5, closeStage) +
            sunset * twilight * whiteLine * 0.09;
          float alpha = intensity * day * farFade * horizonGate * (
            whiteLine * mix(0.11, 0.2, closeStage) +
            blueLine * mix(0.036, 0.068, closeStage) +
            outerAirglow * mix(0.016, 0.075, closeStage) +
            scatterLuma * mix(0.18, 0.36, closeStage)
          );

          if (alpha < 0.003) {
            discard;
          }
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.48));
        }
      `,
      transparent: true,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: SrcAlphaFactor,
      blendDst: OneFactor,
      side: FrontSide,
      depthWrite: false,
      depthTest: true
    });
  }, [composition.earth.radius, composition.light.fixedSunDir]);

  useFrame(() => {
    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    if (sceneLightDirection) {
      frameLightDirection.copy(sceneLightDirection).normalize();
    } else {
      frameLightDirection.set(...composition.light.fixedSunDir).normalize();
    }
    mainMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    nearMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    karmanLineMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    mainMaterial.uniforms.intensity.value = baseMainIntensity * (0.1 + closeStage * 0.18);
    nearMaterial.uniforms.intensity.value = baseNearIntensity * (0.075 + closeStage * 0.2);
    outerHaloMaterial.uniforms.lightDir.value.copy(frameLightDirection);
    outerHaloMaterial.uniforms.intensity.value = baseMainIntensity * (0.018 + closeStage * 0.14);
    karmanLineMaterial.uniforms.intensity.value = baseMainIntensity * (0.14 + closeStage * 0.76);
    karmanLineMaterial.uniforms.closeStage.value = closeStage;

    const karmanStage = closeStage * closeStage * (3 - 2 * closeStage);
    const targetOpacities = composition.atmosphere.karmanGlow
      ? [0.082 * karmanStage, 0.055 * karmanStage, 0.026 * karmanStage]
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
            composition.earth.radius * 1.012,
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
            composition.earth.radius * 1.026,
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
          opacity={composition.atmosphere.karmanGlow ? 0.02 : 0}
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
          opacity={composition.atmosphere.karmanGlow ? 0.014 : 0}
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
