"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IUniform } from "three";
import { coScrollSourceCausticFragmentShader } from "./shaders/coScrollSourceCausticShader";
import { stepSourceCausticMotion } from "./sourceCausticMotion";
import type { CoScrollRotationSignalRef } from "./types";

interface CausticUniforms {
  uAnchorCenter: IUniform<THREE.Vector2>;
  uAnchorFacing: IUniform<number>;
  uAnchorFieldScale: IUniform<THREE.Vector2>;
  uAnchorRotation: IUniform<number>;
  uAnchorSpeed: IUniform<number>;
  uAnchorPresence: IUniform<number>;
  uAspect: IUniform<number>;
  uChromaOffset: IUniform<number>;
  uColorA: IUniform<THREE.Color>;
  uColorB: IUniform<THREE.Color>;
  uFieldRotation: IUniform<number>;
  uIntensity: IUniform<number>;
  uIsMobile: IUniform<number>;
  uLyricCenters: IUniform<THREE.Vector4>;
  uLensStrength: IUniform<number>;
  uMotionEnergy: IUniform<number>;
  uPulseStrength: IUniform<number>;
  uScrollVelocity: IUniform<number>;
  uSourceMatch: IUniform<number>;
  uTime: IUniform<number>;
  uWarpAmount: IUniform<number>;
  [uniform: string]: IUniform;
}

export interface CoScrollCausticLightFieldProps {
  active?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
  sourceMatch?: boolean;
  layout?: "desktop" | "mobile";
  opacity?: number;
  anchorPresence?: number;
  anchorPosition?: [number, number, number];
  anchorScale?: number;
  scrollVelocity?: number;
  rotationSignalRef?: CoScrollRotationSignalRef;
  lyricCenters?: [number, number, number, number];
  colorA?: string;
  colorB?: string;
  positionZ?: number;
  renderOrder?: number;
}

const DEFAULT_CAUSTIC_SPEED = 0.22;
const SOURCE_MATCH_MODEL_SCALE_REFERENCE = 2.8 * 1.2 * 1.1;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const legacyFragmentShader = `
varying vec2 vUv;

uniform float uAnchorPresence;
uniform float uAnchorRotation;
uniform float uAnchorSpeed;
uniform float uAspect;
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uIntensity;
uniform float uIsMobile;
uniform vec4  uLyricCenters;
uniform float uScrollVelocity;
uniform float uSourceMatch;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 perlinGradient(vec2 p) {
  float angle = hash(p) * 6.28318530718;
  return vec2(cos(angle), sin(angle));
}

float perlinNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float n00 = dot(perlinGradient(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
  float n10 = dot(perlinGradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float n01 = dot(perlinGradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float n11 = dot(perlinGradient(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 0.5 + 0.5;
}

float perlinFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * perlinNoise(p);
    p = mat2(1.62, -1.18, 1.18, 1.62) * p + vec2(0.17, -0.11);
    amplitude *= 0.52;
  }

  return value;
}

float fbm(vec2 p) {
  return perlinFbm(p);
}

vec2 rotateUv(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c) * uv;
}

float verticalReadingChannel(vec2 centered, float center, float width) {
  float column = 1.0 - smoothstep(width, width * 2.2, abs(centered.x - center));
  float verticalReach = smoothstep(1.02, 0.56, abs(centered.y));
  return column * verticalReach;
}

float ovalMask(vec2 p, vec2 center, vec2 scale, float inner, float outer) {
  return 1.0 - smoothstep(inner, outer, length((p - center) * scale));
}

float causticBand(float phase, float sharpness) {
  return pow(1.0 - abs(sin(phase)), sharpness);
}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  vec2 centerOffset = vec2(0.0, mix(-0.055, -0.015, uIsMobile));
  vec2 radialUv = vec2((centered.x - centerOffset.x) * uAspect * 0.78, centered.y - centerOffset.y);
  float radius = length(radialUv);

  float coreMask = 1.0 - smoothstep(0.22, mix(0.62, 0.54, uIsMobile), radius);
  float shoulderMask = 1.0 - smoothstep(0.36, mix(0.84, 0.72, uIsMobile), radius);
  float sourceAirMask = 1.0 - smoothstep(0.42, mix(1.6, 1.24, uIsMobile), radius);
  float wideAir = 1.0 - smoothstep(0.36, mix(1.88, 1.42, uIsMobile), length(vec2(centered.x * uAspect * 0.42, centered.y * 0.68)));
  float topAir = smoothstep(-0.82, mix(0.74, 0.88, uIsMobile), centered.y) * (1.0 - smoothstep(0.18, mix(1.92, 1.3, uIsMobile), abs(centered.x * uAspect)));
  float sideAir = smoothstep(0.12, mix(0.74, 0.5, uIsMobile), abs(centered.x)) * (1.0 - smoothstep(0.66, 1.16, abs(centered.y)));
  float defaultMask = clamp(coreMask * 0.86 + shoulderMask * 0.18, 0.0, 1.0);
  float sourceMask = clamp(coreMask * 0.26 + shoulderMask * 0.32 + sourceAirMask * 0.48 + wideAir * 0.7 + topAir * 0.48 + sideAir * 0.36, 0.0, 1.0);
  float mask = mix(defaultMask, sourceMask, uSourceMatch);
  mask *= smoothstep(1.08, 0.64, abs(centered.y));

  float readingChannel = 0.0;
  readingChannel = max(readingChannel, verticalReadingChannel(centered, uLyricCenters.x, 0.034));
  readingChannel = max(readingChannel, verticalReadingChannel(centered, uLyricCenters.y, 0.034));
  readingChannel = max(readingChannel, verticalReadingChannel(centered, uLyricCenters.z, 0.038));
  readingChannel = max(readingChannel, verticalReadingChannel(centered, uLyricCenters.w, 0.034));
  float readingSuppression = mix(1.0, mix(1.0, 0.58, readingChannel), uSourceMatch);

  float velocity = clamp(uScrollVelocity * mix(0.22, 0.46, uSourceMatch), -0.42, 0.42);
  float anchorPhase = uAnchorRotation * uSourceMatch;
  float rotationEnergy = clamp(abs(uAnchorSpeed), 0.0, 2.2) * uSourceMatch;
  float time = uTime + velocity * mix(0.45, 0.44, uSourceMatch) + rotationEnergy * 0.035;
  vec2 aspectUv = vec2(centered.x * uAspect, centered.y);
  vec2 field = aspectUv * mix(1.06, 0.46, uSourceMatch);
  field = rotateUv(field, mix(-0.56, -0.14, uSourceMatch) + velocity * 0.18 + anchorPhase * 0.24);
  field += vec2(time * mix(0.16, 0.11, uSourceMatch), -time * mix(0.11, 0.085, uSourceMatch));

  float lowNoise = fbm(field * mix(1.1, 0.56, uSourceMatch) + vec2(time * mix(0.045, 0.11, uSourceMatch), -time * mix(0.026, 0.064, uSourceMatch)));
  float tideNoise = fbm(field * mix(1.8, 0.84, uSourceMatch) + vec2(-time * mix(0.03, 0.086, uSourceMatch), time * mix(0.041, 0.1, uSourceMatch)));
  vec2 warped = field + vec2(lowNoise - 0.5, tideNoise - 0.5) * mix(0.22, 0.58, uSourceMatch);
  vec2 eddy = vec2(
    fbm(field * 0.42 + vec2(time * mix(0.026, 0.078, uSourceMatch), -time * mix(0.018, 0.058, uSourceMatch))) - 0.5,
    fbm(field * 0.48 + vec2(-time * mix(0.019, 0.062, uSourceMatch), time * mix(0.023, 0.071, uSourceMatch))) - 0.5
  );
  warped += eddy * mix(0.0, 1.08, uSourceMatch);
  warped += vec2(
    sin(field.y * 1.7 + time * mix(0.19, 0.42, uSourceMatch)),
    cos(field.x * 1.45 - time * mix(0.16, 0.37, uSourceMatch))
  ) * mix(0.035, 0.085, uSourceMatch);

  vec2 poolDriftA = vec2(sin(time * 0.37), cos(time * 0.29)) * 0.1 * uSourceMatch;
  vec2 poolDriftB = vec2(cos(time * 0.31), -sin(time * 0.41)) * 0.085 * uSourceMatch;
  float poolA = ovalMask(aspectUv, vec2(-0.18, -0.05) + poolDriftA, vec2(0.94, 1.26), 0.08, mix(0.82, 0.7, uIsMobile));
  float poolB = ovalMask(aspectUv, vec2(0.24, 0.12) + poolDriftB, vec2(1.16, 0.92), 0.12, mix(0.78, 0.64, uIsMobile));
  float poolC = ovalMask(aspectUv, vec2(0.04, -0.34) - poolDriftA * 0.72, vec2(0.74, 1.5), 0.06, mix(0.72, 0.58, uIsMobile));
  float poolD = ovalMask(aspectUv, vec2(-0.58, 0.28) + poolDriftB * 0.84, vec2(1.38, 1.05), 0.08, mix(0.66, 0.5, uIsMobile));
  float poolE = ovalMask(aspectUv, vec2(0.56, -0.26) - poolDriftB * 0.76, vec2(1.24, 1.2), 0.08, mix(0.58, 0.46, uIsMobile));
  float poolF = ovalMask(aspectUv, vec2(0.04, 0.56) + poolDriftA * 0.58, vec2(0.9, 1.42), 0.05, mix(0.58, 0.44, uIsMobile));
  float localPools = clamp(poolA * 0.56 + poolB * 0.48 + poolC * 0.38 + poolD * 0.28 + poolE * 0.24 + poolF * 0.3, 0.0, 1.0);
  float tideGate = smoothstep(0.24, 0.82, lowNoise * 0.58 + tideNoise * 0.42);
  float waterEnvelope = clamp(wideAir * 0.58 + topAir * 0.74 + sideAir * 0.62 + sourceAirMask * 0.26, 0.0, 1.0);
  float defaultWaterGate = mix(0.72, 1.0, localPools) * mix(1.0, tideGate, 0.72 * uSourceMatch);
  float sourceWaterGate = clamp(localPools * (0.66 + tideGate * 0.34) + waterEnvelope * tideGate * 0.14, 0.0, 1.0);
  float sourceCoverageFloor = clamp(waterEnvelope * (0.18 + localPools * 0.22), 0.0, 0.42) * uSourceMatch;
  float waterGate = mix(defaultWaterGate, max(sourceWaterGate, sourceCoverageFloor), uSourceMatch);

  float curvedX = warped.x + sin(warped.y * 1.55 + lowNoise * 3.2 + time * mix(0.08, 0.23, uSourceMatch)) * mix(0.04, 0.34, uSourceMatch);
  float curvedY = warped.y + cos(warped.x * 1.35 - tideNoise * 2.8 - time * mix(0.07, 0.19, uSourceMatch)) * mix(0.04, 0.28, uSourceMatch);
  float phaseA = curvedX * mix(14.6, 4.5, uSourceMatch) + curvedY * mix(4.4, 1.25, uSourceMatch) + lowNoise * mix(4.8, 3.4, uSourceMatch) + time * mix(0.72, 0.52, uSourceMatch);
  float phaseB = curvedX * mix(-7.2, -2.65, uSourceMatch) + curvedY * mix(12.4, 3.85, uSourceMatch) + tideNoise * mix(3.8, 2.9, uSourceMatch) - time * mix(0.54, 0.44, uSourceMatch);
  float phaseC = curvedX * mix(8.8, 3.25, uSourceMatch) + curvedY * mix(-8.6, -2.35, uSourceMatch) + (lowNoise - tideNoise) * mix(3.4, 2.5, uSourceMatch) + time * mix(0.36, 0.33, uSourceMatch);
  float bandA = causticBand(phaseA, mix(6.4, 6.6, uSourceMatch));
  float bandB = causticBand(phaseB, mix(7.2, 7.2, uSourceMatch));
  float bandC = causticBand(phaseC, mix(6.0, 6.2, uSourceMatch));
  float threads = bandA * mix(0.42, 0.48, uSourceMatch) + bandB * mix(0.36, 0.4, uSourceMatch) + bandC * mix(0.24, 0.28, uSourceMatch);
  float caustic = smoothstep(mix(0.32, 0.28, uSourceMatch), mix(0.78, 0.7, uSourceMatch), threads);
  float knots = pow(clamp(bandA * bandB + bandB * bandC * 0.46, 0.0, 1.0), mix(2.8, 2.2, uSourceMatch));
  float slowGather = smoothstep(0.46, 0.9, fbm(warped * mix(1.45, 0.92, uSourceMatch) + vec2(time * mix(0.04, 0.11, uSourceMatch), -time * mix(0.032, 0.09, uSourceMatch))));
  caustic = (caustic * mix(0.78, 0.68, uSourceMatch) + knots * mix(0.28, 0.16, uSourceMatch) + slowGather * localPools * mix(0.12, 0.2, uSourceMatch)) * waterGate;

  vec2 detailField = rotateUv(warped * mix(1.95, 1.24, uSourceMatch), 0.72);
  float detailPhase = detailField.x * mix(9.6, 4.8, uSourceMatch) + detailField.y * mix(-5.8, -2.6, uSourceMatch) + lowNoise * 2.4 - time * mix(0.34, 0.32, uSourceMatch);
  float filamentGate = smoothstep(0.5, 0.9, fbm(detailField * 1.45 + vec2(-time * mix(0.048, 0.12, uSourceMatch), time * mix(0.033, 0.1, uSourceMatch))));
  float filament = causticBand(detailPhase, mix(9.8, 8.4, uSourceMatch)) * filamentGate * localPools * mix(0.16, 0.34, uSourceMatch);

  vec2 hairField = rotateUv(warped * mix(3.2, 2.15, uSourceMatch) + eddy * 0.42, -0.46);
  float hairNoise = fbm(hairField * 0.72 + vec2(time * mix(0.032, 0.09, uSourceMatch), -time * mix(0.026, 0.075, uSourceMatch)));
  float hairBreak = smoothstep(0.36, 0.84, fbm(hairField * 1.55 + vec2(-time * mix(0.052, 0.14, uSourceMatch), time * mix(0.036, 0.11, uSourceMatch))));
  float hairA = causticBand(hairField.x * 9.8 + hairField.y * 2.4 + hairNoise * 4.9 + time * mix(0.18, 0.42, uSourceMatch), 16.0);
  float hairB = causticBand(hairField.x * -6.6 + hairField.y * 8.4 - hairNoise * 4.2 - time * mix(0.14, 0.36, uSourceMatch), 17.5);
  float hairCross = pow(clamp(hairA * hairB, 0.0, 1.0), 0.72);
  float upperFineLift = smoothstep(-0.2, 0.74, centered.y) * poolF;
  float refractiveHair = (hairA * 0.46 + hairB * 0.36 + hairCross * 0.62) * hairBreak * clamp(localPools + waterEnvelope * 0.38 + upperFineLift * 0.68, 0.0, 1.0) * uSourceMatch;

  vec2 sheetField = rotateUv(warped * 1.72 + vec2(lowNoise * 0.32, -tideNoise * 0.26), 0.28);
  float sheetGate = smoothstep(0.38, 0.84, fbm(sheetField * 0.82 + vec2(time * mix(0.018, 0.075, uSourceMatch), -time * mix(0.022, 0.08, uSourceMatch))));
  float sheetA = causticBand(sheetField.x * 5.8 + sheetField.y * 3.2 + lowNoise * 3.6 + time * mix(0.1, 0.28, uSourceMatch), 12.0);
  float sheetB = causticBand(sheetField.x * -4.2 + sheetField.y * 5.6 - tideNoise * 3.1 - time * mix(0.08, 0.24, uSourceMatch), 13.0);
  float waterSheet = (sheetA * 0.2 + sheetB * 0.17 + pow(clamp(sheetA * sheetB, 0.0, 1.0), 0.68) * 0.3) * sheetGate * waterEnvelope * uSourceMatch;

  vec2 roamingField = rotateUv(aspectUv * 0.72 + eddy * 0.46, -0.22);
  float roamingBreak = 0.3 + smoothstep(0.34, 0.82, fbm(roamingField * 0.88 + vec2(time * 0.12, -time * 0.095))) * 0.7;
  float roamingA = causticBand(roamingField.x * 5.4 + roamingField.y * 2.2 + lowNoise * 3.1 + time * 0.84, 10.5);
  float roamingB = causticBand(roamingField.x * -3.8 + roamingField.y * 5.1 - tideNoise * 2.7 - time * 0.71, 11.5);
  float roamingCaustic = (roamingA * 0.48 + roamingB * 0.4 + pow(clamp(roamingA * roamingB, 0.0, 1.0), 0.72) * 0.52) * roamingBreak * waterEnvelope * uSourceMatch;

  vec2 sourceFlowA = rotateUv(aspectUv * 0.72, -0.28 + anchorPhase * 0.18) + vec2(time * 0.2, -time * 0.14);
  vec2 sourceFlowB = rotateUv(aspectUv * 0.66, 0.46 - anchorPhase * 0.14) + vec2(-time * 0.16, time * 0.19);
  float sourceFlowWarpA = fbm(sourceFlowA * 0.76 + vec2(-time * 0.06, time * 0.045));
  float sourceFlowWarpB = fbm(sourceFlowB * 0.82 + vec2(time * 0.052, -time * 0.064));
  float sourceFlowBandA = causticBand(sourceFlowA.x * 5.8 + sourceFlowA.y * 2.4 + sourceFlowWarpA * 3.6, 9.2);
  float sourceFlowBandB = causticBand(sourceFlowB.x * -4.6 + sourceFlowB.y * 5.4 - sourceFlowWarpB * 3.2, 10.2);
  float sourceFlowCross = pow(clamp(sourceFlowBandA * sourceFlowBandB, 0.0, 1.0), 0.68);
  float sourceFlowCaustic = (sourceFlowBandA * 0.54 + sourceFlowBandB * 0.46 + sourceFlowCross * 0.58) * waterEnvelope * uSourceMatch;

  float ambientEnvelope = waterEnvelope;
  float lowerSideFog = (1.0 - smoothstep(-0.76, -0.18, centered.y)) * smoothstep(0.18, 0.56, abs(centered.x));
  float broadAirDamp = mix(1.0, 0.8, lowerSideFog * uIsMobile * uSourceMatch);
  float pathLift = clamp(coreMask * 0.2 + shoulderMask * 0.12 + readingChannel * 0.08, 0.0, 0.22) * uSourceMatch;
  float milkGlow = (1.0 - smoothstep(0.0, mix(0.48, 0.68, uSourceMatch), radius)) * (mix(0.1, 0.12, uSourceMatch) + lowNoise * mix(0.06, 0.06, uSourceMatch));
  float humidAir = smoothstep(0.16, 0.86, tideNoise) * ambientEnvelope * mix(0.024, 0.09, uSourceMatch);
  float airGlow = (ambientEnvelope * (0.045 + tideNoise * 0.058 + slowGather * 0.038 + caustic * 0.04) * broadAirDamp + humidAir * 0.52 + pathLift * 0.54) * uSourceMatch;
  float readingFlow = perlinFbm(vec2(centered.x * 2.1 + time * 0.09, centered.y * 1.35 - time * 0.07));
  float readingAura = readingChannel * (0.025 + readingFlow * 0.055) * uSourceMatch;
  float alpha = ((caustic * mix(0.82, 0.58, uSourceMatch) + filament * mix(0.3, 0.34, uSourceMatch) + refractiveHair * 0.52 + waterSheet * 0.24 + roamingCaustic * 0.38 + sourceFlowCaustic * 0.58 + milkGlow * mix(0.92, 0.36, uSourceMatch) + airGlow) * readingSuppression + readingAura) * mask * uIntensity * uAnchorPresence;
  float colorSignal = caustic + filament * 0.72 + refractiveHair * 1.36 + waterSheet * 0.82 + roamingCaustic * 0.86 + sourceFlowCaustic * 1.08 + milkGlow * 0.42 + slowGather * localPools * 0.22 + airGlow * 0.82 + readingAura * 1.6;
  vec3 color = mix(uColorA, uColorB, smoothstep(0.1, mix(0.72, 0.92, uSourceMatch), colorSignal));
  color *= 0.76 + caustic * mix(0.36, 0.26, uSourceMatch) + filament * 0.18;

  gl_FragColor = vec4(color, alpha);
}
`;

export function CoScrollCausticLightField({
  active = true,
  paused = false,
  reducedMotion = false,
  sourceMatch = false,
  layout = "desktop",
  opacity = 0.18,
  anchorPresence = 1,
  anchorPosition = [0, 0, 0],
  anchorScale = SOURCE_MATCH_MODEL_SCALE_REFERENCE,
  scrollVelocity = 0,
  rotationSignalRef,
  lyricCenters = [-0.43, -0.18, 0.08, 0.35],
  colorA,
  colorB,
  positionZ = -5.12,
  renderOrder = -80
}: CoScrollCausticLightFieldProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const sourceMotionEnergyRef = useRef(0);
  const anchorProjectionPoint = useMemo(() => new THREE.Vector3(), []);
  const { camera, viewport } = useThree();
  const uniforms = useMemo<CausticUniforms>(
    () => ({
      uAnchorCenter: { value: new THREE.Vector2(0, 0) },
      uAnchorFacing: { value: Math.sin(rotationSignalRef?.current.angle ?? 0) },
      uAnchorFieldScale: { value: new THREE.Vector2(0.27, 0.42) },
      uAnchorRotation: { value: rotationSignalRef?.current.angle ?? 0 },
      uAnchorSpeed: { value: rotationSignalRef?.current.speed ?? 0 },
      uAnchorPresence: { value: anchorPresence },
      uAspect: { value: Math.max(0.1, viewport.width / Math.max(viewport.height, 0.1)) },
      uChromaOffset: { value: 0.00045 },
      uColorA: { value: new THREE.Color(colorA ?? (sourceMatch ? "#2d6d8b" : "#386f70")) },
      uColorB: { value: new THREE.Color(colorB ?? (sourceMatch ? "#cbd5f5" : "#e5fff7")) },
      uFieldRotation: { value: (rotationSignalRef?.current.angle ?? 0) * 0.42 },
      uIntensity: { value: opacity },
      uIsMobile: { value: layout === "mobile" ? 1 : 0 },
      uLyricCenters: { value: new THREE.Vector4(...lyricCenters) },
      uLensStrength: { value: 0.32 },
      uMotionEnergy: { value: 0 },
      uPulseStrength: { value: 0.12 },
      uScrollVelocity: { value: scrollVelocity },
      uSourceMatch: { value: sourceMatch ? 1 : 0 },
      uTime: { value: 0 },
      uWarpAmount: { value: 0.3 }
    }),
    []
  );

  useEffect(() => {
    const liveUniforms = materialRef.current?.uniforms ?? uniforms;
    liveUniforms.uAnchorPresence.value = anchorPresence;
    liveUniforms.uAspect.value = Math.max(0.1, viewport.width / Math.max(viewport.height, 0.1));
    const normalizedAnchorScale = Math.max(
      0.2,
      anchorScale / SOURCE_MATCH_MODEL_SCALE_REFERENCE
    );
    liveUniforms.uAnchorFieldScale.value.set(
      (layout === "mobile" ? 0.31 : 0.27) * normalizedAnchorScale,
      (layout === "mobile" ? 0.36 : 0.42) * normalizedAnchorScale
    );
    liveUniforms.uColorA.value.set(colorA ?? (sourceMatch ? "#2d6d8b" : "#386f70"));
    liveUniforms.uColorB.value.set(colorB ?? (sourceMatch ? "#cbd5f5" : "#e5fff7"));
    liveUniforms.uIntensity.value = opacity;
    liveUniforms.uIsMobile.value = layout === "mobile" ? 1 : 0;
    liveUniforms.uLyricCenters.value.set(...lyricCenters);
    liveUniforms.uScrollVelocity.value = scrollVelocity;
    liveUniforms.uSourceMatch.value = sourceMatch ? 1 : 0;
  }, [anchorPresence, anchorScale, colorA, colorB, layout, lyricCenters, opacity, scrollVelocity, sourceMatch, uniforms, viewport.height, viewport.width]);

  useFrame((_state, delta) => {
    const liveUniforms = materialRef.current?.uniforms;
    if (!liveUniforms) {
      return;
    }

    if (sourceMatch) {
      anchorProjectionPoint.set(...anchorPosition).project(camera);
      liveUniforms.uAnchorCenter.value.set(
        anchorProjectionPoint.x * liveUniforms.uAspect.value,
        anchorProjectionPoint.y
      );
      const motion = stepSourceCausticMotion({
        angle: rotationSignalRef?.current.angle ?? 0,
        speed: rotationSignalRef?.current.speed ?? 0,
        previousEnergy: sourceMotionEnergyRef.current,
        delta: active && !paused && !reducedMotion ? delta : 0
      });

      sourceMotionEnergyRef.current = motion.energy;
      liveUniforms.uAnchorFacing.value = motion.anchorFacing;
      liveUniforms.uFieldRotation.value = motion.fieldRotation;
      liveUniforms.uLensStrength.value = motion.lensStrength;
      liveUniforms.uMotionEnergy.value = motion.energy;
      liveUniforms.uWarpAmount.value = motion.warpAmount;
      liveUniforms.uPulseStrength.value = motion.pulseStrength;
      liveUniforms.uChromaOffset.value = motion.chromaOffset;
      if (active && !paused && !reducedMotion) {
        liveUniforms.uTime.value += delta * motion.timeScale;
      }
      return;
    }

    if (!active || paused || reducedMotion) {
      return;
    }

    liveUniforms.uTime.value += delta * DEFAULT_CAUSTIC_SPEED;
  });

  return (
    <mesh
      position={[0, 0, positionZ]}
      scale={[viewport.width * 1.42, viewport.height * 1.42, 1]}
      renderOrder={renderOrder}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        key={sourceMatch ? "source-organic-caustic" : "legacy-caustic"}
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={
          sourceMatch
            ? coScrollSourceCausticFragmentShader
            : legacyFragmentShader
        }
        transparent={!sourceMatch}
        depthTest
        depthWrite={false}
        blending={sourceMatch ? THREE.NormalBlending : THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
