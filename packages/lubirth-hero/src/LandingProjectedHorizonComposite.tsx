"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AddEquation,
  ClampToEdgeWrapping,
  CustomBlending,
  DataTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  OneMinusSrcAlphaFactor,
  RGBAFormat,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
  type PerspectiveCamera
} from "three";
import { type QualityProfile } from "@miralith/visual-core";
import type {
  LandingComposition,
  LandingProjectedEarthFrame,
  LandingResolvedAssets,
  LandingVisualDebugLayer
} from "./types";
import { useLandingTexture } from "./useLandingTexture";

interface LandingProjectedHorizonCompositeProps {
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  layer?: LandingVisualDebugLayer;
  auroraProfile?: "hero" | "debug";
  showAuroraInAll?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthProjectedHorizonCompositeActive?: boolean;
    __MiraLithLuBirthProjectedHorizonCompositeLayer?: string;
    __MiraLithLuBirthProjectedHorizonCompositeTexture?: string;
  }
}

const forward = new Vector3();

function hash2(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

function fbmNoise(x: number, y: number) {
  let value = 0;
  let amplitude = 0.52;
  let frequency = 1;

  for (let i = 0; i < 5; i += 1) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude;
    frequency *= 2.05;
    amplitude *= 0.5;
  }

  return Math.min(1, Math.max(0, value));
}

function createFallbackCloudStripTexture() {
  const width = 1024;
  const height = 192;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    const topRim = Math.exp(-Math.pow((v - 0.13) * 5.2, 2));
    const body = Math.min(1, Math.max(0, (v - 0.08) / 0.34)) *
      (1 - Math.min(1, Math.max(0, (v - 0.62) / 0.34)));
    const bottom = Math.min(1, Math.max(0, (v - 0.48) / 0.42));

    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const theta = u * Math.PI * 2;
      const circleX = Math.cos(theta);
      const circleY = Math.sin(theta);
      const broad = fbmNoise(circleX * 2.4 + v * 0.2 + 4.1, circleY * 2.4 + v * 3.4 + 1.7);
      const billows = fbmNoise(circleX * 5.2 + v * 0.65 + 8.3, circleY * 5.2 + v * 9.5 + 2.2);
      const fine = fbmNoise(circleX * 11.5 + v * 1.4 + 1.9, circleY * 11.5 + v * 21.0 + 7.7);
      const voids = fbmNoise(circleX * 3.6 + v * 0.45 + 13.0, circleY * 3.6 + v * 6.0 + 2.5);
      const shelf = Math.max(0, 1 - Math.abs(v - 0.32) / 0.48);
      const coverage = Math.min(1, Math.max(0, broad * 0.58 + billows * 0.32 + fine * 0.18 + shelf * 0.16 - voids * 0.26));
      const heightValue = Math.min(1, Math.max(0, topRim * 0.55 + body * 0.32 + billows * 0.26));
      const shadow = Math.min(1, Math.max(0, bottom * 0.68 + (1 - billows) * 0.22 + voids * 0.18));
      const top = Math.min(1, Math.max(0, topRim * 0.8 + fine * 0.22 + billows * 0.18));
      const offset = (y * width + x) * 4;

      data[offset] = Math.round(coverage * 255);
      data[offset + 1] = Math.round(heightValue * 255);
      data[offset + 2] = Math.round(shadow * 255);
      data[offset + 3] = Math.round(top * 255);
    }
  }

  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function fitOverlayToCamera(mesh: Mesh, camera: PerspectiveCamera, aspect: number) {
  const distance = 1;
  const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
  const width = height * aspect;

  forward.set(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(distance);
  mesh.position.copy(camera.position).add(forward);
  mesh.quaternion.copy(camera.quaternion);
  mesh.scale.set(width, height, 1);
}

function modeForLayer(layer: LandingVisualDebugLayer) {
  if (layer === "clouds") {
    return 1;
  }
  if (layer === "atmosphere") {
    return 2;
  }
  if (layer === "aurora") {
    return 3;
  }
  return 0;
}

function createCompositeMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      cloudStripMap: { value: null },
      earthCenter: { value: new Vector2(0, 0) },
      earthRadius: { value: 1 },
      sunDirection: { value: new Vector2(0, 1) },
      time: { value: 0 },
      progress: { value: 0 },
      cloudOpacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      atmosphereIntensity: { value: composition.atmosphere.enabled ? composition.atmosphere.intensity : 0 },
      auroraIntensity: { value: composition.aurora.enabled ? composition.aurora.intensity : 0 },
      mode: { value: 0 },
      auroraDebug: { value: 0 },
      auroraVisible: { value: 0 }
    },
    vertexShader: `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D cloudStripMap;
      uniform vec2 earthCenter;
      uniform float earthRadius;
      uniform vec2 sunDirection;
      uniform float time;
      uniform float progress;
      uniform float cloudOpacity;
      uniform float atmosphereIntensity;
      uniform float auroraIntensity;
      uniform int mode;
      uniform float auroraDebug;
      uniform float auroraVisible;

      struct CloudResult {
        vec3 color;
        float alpha;
        float top;
        float body;
        float shadow;
      };

      struct LimbResult {
        vec3 color;
        float alpha;
        float whiteAlpha;
      };

      struct AuroraResult {
        vec3 color;
        float alpha;
      };

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

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i += 1) {
          value += noise2(p) * amplitude;
          p = p * 2.04 + vec2(7.3, 3.1);
          amplitude *= 0.5;
        }
        return value;
      }

      void compositePremul(inout vec3 color, inout float alpha, vec3 sourceColor, float sourceAlpha) {
        sourceAlpha = clamp(sourceAlpha, 0.0, 1.0);
        color += sourceColor * sourceAlpha * (1.0 - alpha);
        alpha += sourceAlpha * (1.0 - alpha);
      }

      CloudResult evalCloud(vec2 edgeNormal, float signedInside, float sunDot, float angle) {
        float debugBoost = mode == 1 ? 1.0 : 0.0;
        float upperArc = smoothstep(0.03, 0.34, edgeNormal.y);
        float sideWindow = smoothstep(-0.98, -0.58, edgeNormal.x) * (1.0 - smoothstep(0.6, 1.0, edgeNormal.x));
        float day = smoothstep(-0.32, 0.34, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.32, abs(sunDot));
        float closeStage = 1.0 - smoothstep(0.12, 0.74, progress);

        float band = smoothstep(-5.0, 8.0, signedInside) * (1.0 - smoothstep(72.0, 118.0, signedInside));
        float horizonCore = smoothstep(-1.0, 18.0, signedInside) * (1.0 - smoothstep(38.0, 82.0, signedInside));
        float cloudDepth01 = clamp((signedInside + 5.0) / 112.0, 0.0, 1.0);
        float arc = angle / 3.14159265;
        vec2 baseUv = vec2(fract(arc * 3.55 + time * 0.0012), cloudDepth01);

        vec4 strip0 = texture2D(cloudStripMap, baseUv);
        vec4 strip1 = texture2D(cloudStripMap, vec2(fract(baseUv.x + 0.006), clamp(baseUv.y + 0.018, 0.0, 1.0)));
        vec4 strip2 = texture2D(cloudStripMap, vec2(fract(baseUv.x - 0.008), clamp(baseUv.y - 0.022, 0.0, 1.0)));
        vec4 strip3 = texture2D(cloudStripMap, vec2(fract(baseUv.x + 0.017), clamp(baseUv.y + 0.055, 0.0, 1.0)));
        vec4 strip4 = texture2D(cloudStripMap, vec2(fract(baseUv.x - 0.019), clamp(baseUv.y + 0.09, 0.0, 1.0)));
        vec4 strip = strip0 * 0.42 + strip1 * 0.2 + strip2 * 0.18 + strip3 * 0.12 + strip4 * 0.08;

        float microBreak = fbm(vec2(arc * 24.0 - time * 0.002, cloudDepth01 * 5.6 + 3.1));
        float voids = fbm(vec2(arc * 11.0 + 8.0, cloudDepth01 * 3.4 - time * 0.001));
        float coverage = smoothstep(0.1, 0.58, strip.r * 0.86 + strip.g * 0.16 + microBreak * 0.06 - voids * 0.07);
        coverage *= mix(0.62, 1.0, horizonCore);
        coverage *= smoothstep(0.06, 0.24, strip.r + strip.g * 0.18);

        float cloudHeight = clamp(strip.g * 0.8 + strip.a * 0.22, 0.0, 1.0);
        float shadowMap = clamp(strip.b * 0.92 + voids * 0.12, 0.0, 1.0);
        float topMap = clamp(strip.a * 0.86 + cloudHeight * 0.18, 0.0, 1.0);
        float topRim = exp(-pow((cloudDepth01 - 0.13) * 5.8, 2.0)) * (0.48 + topMap * 0.62);
        float body = smoothstep(0.08, 0.34, cloudDepth01) * (1.0 - smoothstep(0.58, 0.9, cloudDepth01));
        float underside = smoothstep(0.36, 0.95, cloudDepth01) * (0.56 + shadowMap * 0.62);
        float farHaze = smoothstep(0.56, 1.0, cloudDepth01);

        vec3 topCol = vec3(0.94, 0.965, 0.965);
        vec3 bodyCol = vec3(0.43, 0.53, 0.63);
        vec3 bottomCol = vec3(0.055, 0.095, 0.17);
        vec3 atmosphericBlue = vec3(0.12, 0.25, 0.42);
        vec3 color =
          topCol * topRim * (0.52 + day * 0.56) +
          bodyCol * body * (0.68 + day * 0.3) +
          bottomCol * underside;
        color = mix(color, color * vec3(0.38, 0.52, 0.72), clamp(underside * 0.74, 0.0, 0.92));
        color = mix(color, atmosphericBlue, farHaze * 0.22);
        color += vec3(0.94, 0.58, 0.3) * twilight * topRim * 0.055;
        color *= mix(0.72, 1.08, coverage);

        float materialAlpha = topRim * 0.32 + body * 0.56 + underside * 0.28;
        float centerSuppression = 1.0 - smoothstep(78.0, 132.0, signedInside);
        float alpha = coverage * band * upperArc * sideWindow * materialAlpha * centerSuppression;
        alpha *= cloudOpacity * (0.92 + closeStage * 0.08 + debugBoost * 0.32);
        alpha = clamp(alpha, 0.0, mix(0.24, 0.42, debugBoost));

        return CloudResult(color, alpha, topRim, body, underside);
      }

      LimbResult evalLimb(vec2 edgeNormal, float signedOutside, float sunDot, float cloudAlpha, float angle) {
        float debugBoost = mode == 2 ? 1.0 : 0.0;
        float upperArc = smoothstep(0.02, 0.32, edgeNormal.y);
        float sideWindow = smoothstep(-0.98, -0.62, edgeNormal.x) * (1.0 - smoothstep(0.62, 0.98, edgeNormal.x));
        float day = smoothstep(-0.24, 0.34, sunDot);
        float night = 1.0 - smoothstep(-0.16, 0.16, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.22, abs(sunDot));
        float closeStage = 1.0 - smoothstep(0.12, 0.76, progress);
        float arc = angle / 3.14159265;
        float airglowBreakup = smoothstep(0.48, 0.9, fbm(vec2(arc * 13.0 + 4.2, 5.0)));

        float whiteNeedle = (1.0 - smoothstep(0.0, mix(1.25, 1.9, debugBoost), abs(signedOutside + 0.2))) *
          (0.18 + day * 0.58);
        float insideBlue = smoothstep(-3.2, -0.8, signedOutside) *
          (1.0 - smoothstep(0.0, 2.4, signedOutside)) *
          (0.028 + day * 0.052);
        float blueThickness = smoothstep(0.0, mix(2.8, 5.8, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(8.0, 18.0, debugBoost), mix(21.0, 48.0, debugBoost), signedOutside)) *
          (0.034 + day * 0.058);
        float oxygenGreen = smoothstep(1.0, mix(4.0, 7.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(8.0, 15.0, debugBoost), mix(20.0, 36.0, debugBoost), signedOutside)) *
          night *
          airglowBreakup *
          mix(0.012, 0.08, debugBoost);
        float amberTwilight = smoothstep(0.8, mix(4.2, 7.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(7.0, 14.0, debugBoost), mix(18.0, 32.0, debugBoost), signedOutside)) *
          twilight *
          mix(0.018, 0.07, debugBoost);
        float outerCyan = smoothstep(10.0, mix(18.0, 34.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(38.0, 62.0, debugBoost), mix(72.0, 116.0, debugBoost), signedOutside)) *
          mix(0.0012, 0.009, debugBoost);

        float cloudCut = cloudAlpha * mix(0.82, 0.46, debugBoost);
        whiteNeedle *= 1.0 - cloudCut;
        insideBlue *= 1.0 - cloudCut * 0.76;
        blueThickness *= 1.0 - cloudCut * 0.66;
        oxygenGreen *= 1.0 - cloudAlpha * 0.42;
        amberTwilight *= 1.0 - cloudAlpha * 0.34;

        vec3 color =
          vec3(0.96, 0.988, 1.0) * whiteNeedle +
          vec3(0.1, 0.3, 0.68) * (insideBlue + blueThickness) +
          vec3(0.08, 0.32, 0.26) * oxygenGreen +
          vec3(0.7, 0.28, 0.12) * amberTwilight +
          vec3(0.04, 0.22, 0.36) * outerCyan;

        float alpha = whiteNeedle + insideBlue + blueThickness + oxygenGreen + amberTwilight + outerCyan;
        float arcMask = upperArc * sideWindow;
        float gain = atmosphereIntensity * (0.5 + closeStage * 0.05) * (1.0 + debugBoost * 0.18);
        return LimbResult(color * arcMask * gain, clamp(alpha * arcMask * gain, 0.0, mix(0.105, 0.22, debugBoost)), whiteNeedle * arcMask);
      }

      AuroraResult evalAurora(vec2 edgeNormal, float signedOutside, float sunDot, float cloudAlpha, float limbWhiteAlpha, float angle) {
        float debugGain = auroraDebug;
        float upperArc = smoothstep(0.1, 0.36, edgeNormal.y);
        float sideWindow = smoothstep(-0.78, -0.48, edgeNormal.x) * (1.0 - smoothstep(0.08, 0.44, edgeNormal.x));
        float night = 1.0 - smoothstep(-0.26, 0.08, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.28, abs(sunDot));
        float arcWindow = mix(max(night, twilight * 0.18), 1.0, debugGain * 0.56);
        float height = max(signedOutside, 0.0);
        float outside = smoothstep(2.0, 12.0, signedOutside);
        float rootMask = (1.0 - smoothstep(0.0, 2.2, abs(signedOutside - 1.1))) * mix(0.055, 0.2, debugGain);
        float vertical01 = clamp((height - 2.0) / mix(112.0, 178.0, debugGain), 0.0, 1.0);
        float topFade = 1.0 - smoothstep(mix(0.46, 0.62, debugGain), 1.0, vertical01);

        float arc = angle / 3.14159265;
        float columnEnvelope = smoothstep(0.42, 0.86, fbm(vec2(arc * 18.0 - time * 0.004, 2.0)));
        float folds = sin(arc * 128.0 + fbm(vec2(arc * 22.0, height * 0.018 + time * 0.012)) * 2.4) * 0.5 + 0.5;
        float fineFolds = sin(arc * 236.0 + height * 0.032 + fbm(vec2(arc * 58.0, 1.2)) * 3.0 + time * 0.012) * 0.5 + 0.5;
        float strandCore = pow(folds, mix(12.0, 14.0, debugGain)) * 0.68 + pow(fineFolds, 24.0) * 0.54;
        float strands = smoothstep(0.12, 0.5, strandCore) * columnEnvelope;
        float verticalVeil = exp(-vertical01 * mix(2.55, 1.72, debugGain)) * topFade * smoothstep(0.01, 0.16, vertical01);
        float curtain = outside * strands * verticalVeil;
        float closeStage = 1.0 - smoothstep(0.16, 0.74, progress);
        float density = (rootMask + curtain * mix(0.92, 1.5, debugGain)) * upperArc * sideWindow * arcWindow;
        float gain = auroraIntensity * auroraVisible * (0.22 + closeStage * 0.1 + debugGain * 1.12);
        float alpha = density * gain;
        alpha *= 1.0 - cloudAlpha * mix(0.64, 0.44, debugGain);
        alpha *= 1.0 - limbWhiteAlpha * 0.42;

        vec3 rootGreen = mix(vec3(0.045, 0.28, 0.18), vec3(0.075, 0.48, 0.26), debugGain);
        vec3 grayGreen = vec3(0.055, 0.18, 0.17);
        vec3 redUpper = vec3(0.14, 0.035, 0.055);
        vec3 color = mix(rootGreen, grayGreen, smoothstep(0.12, 0.56, vertical01));
        color = mix(color, redUpper, smoothstep(0.48, 0.94, vertical01) * 0.26);
        color *= density * (0.82 + curtain * 0.72 + debugGain * 0.46);

        return AuroraResult(min(color, mix(vec3(0.05, 0.18, 0.16), vec3(0.1, 0.45, 0.34), debugGain)), clamp(alpha, 0.0, mix(0.035, 0.23, debugGain)));
      }

      void main() {
        vec2 p = gl_FragCoord.xy;
        vec2 fromCenter = p - earthCenter;
        float distanceToCenter = length(fromCenter);
        vec2 edgeNormal = distanceToCenter > 0.001 ? fromCenter / distanceToCenter : vec2(0.0, 1.0);
        float signedOutside = distanceToCenter - earthRadius;
        float signedInside = earthRadius - distanceToCenter;
        float angle = atan(edgeNormal.y, edgeNormal.x);
        float sunDot = dot(edgeNormal, normalize(sunDirection));

        CloudResult cloud = evalCloud(edgeNormal, signedInside, sunDot, angle);
        LimbResult limb = evalLimb(edgeNormal, signedOutside, sunDot, cloud.alpha, angle);
        AuroraResult aurora = evalAurora(edgeNormal, signedOutside, sunDot, cloud.alpha, limb.whiteAlpha, angle);

        vec3 premulColor = vec3(0.0);
        float alpha = 0.0;

        if (mode == 1) {
          compositePremul(premulColor, alpha, cloud.color, cloud.alpha);
        } else if (mode == 2) {
          compositePremul(premulColor, alpha, limb.color, limb.alpha);
        } else if (mode == 3) {
          compositePremul(premulColor, alpha, aurora.color, aurora.alpha);
        } else {
          compositePremul(premulColor, alpha, aurora.color, aurora.alpha);
          compositePremul(premulColor, alpha, limb.color, limb.alpha);
          compositePremul(premulColor, alpha, cloud.color, cloud.alpha);
        }

        if (alpha < 0.001) {
          discard;
        }

        gl_FragColor = vec4(premulColor / max(alpha, 0.0001), alpha);
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingProjectedHorizonComposite({
  composition,
  assets,
  quality,
  projection,
  layer = "all",
  auroraProfile = "hero",
  showAuroraInAll = false,
  reducedMotion,
  paused
}: LandingProjectedHorizonCompositeProps) {
  const overlay = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(() => createCompositeMaterial(composition), [composition]);
  const fallbackCloudStripTexture = useMemo(() => createFallbackCloudStripTexture(), []);
  const cloudStripAsset = assets.earthHorizonCloudStrip;
  const mode = modeForLayer(layer);
  const cloudsEnabled =
    composition.earth.useClouds &&
    composition.earth.cloudOpacity > 0 &&
    quality.tier !== "low" &&
    quality.tier !== "fallback" &&
    (layer === "all" || layer === "clouds" || layer === "atmosphere" || layer === "aurora");
  const limbEnabled =
    composition.atmosphere.enabled &&
    composition.atmosphere.intensity > 0 &&
    quality.tier !== "fallback" &&
    (layer === "all" || layer === "atmosphere" || layer === "aurora");
  const auroraEnabled =
    quality.aurora &&
    !reducedMotion &&
    composition.aurora.enabled &&
    composition.aurora.intensity > 0 &&
    composition.aurora.sampleCount > 0 &&
    (layer === "aurora" || (showAuroraInAll && layer === "all"));
  const enabled =
    quality.tier !== "fallback" &&
    ((mode === 1 && cloudsEnabled) ||
      (mode === 2 && limbEnabled) ||
      (mode === 3 && auroraEnabled) ||
      (mode === 0 && (cloudsEnabled || limbEnabled || auroraEnabled)));
  const { texture: cloudStripTexture, failed: cloudStripTextureFailed } = useLandingTexture(
    cloudsEnabled || limbEnabled || auroraEnabled ? cloudStripAsset?.src : undefined,
    {
      colorSpace: cloudStripAsset?.colorSpace,
      wrapS: RepeatWrapping,
      wrapT: ClampToEdgeWrapping,
      anisotropy: quality.tier === "high" ? 16 : 8
    }
  );
  const activeCloudStripTexture = cloudStripTexture && !cloudStripTextureFailed
    ? cloudStripTexture
    : fallbackCloudStripTexture;

  useEffect(() => {
    return () => {
      material.dispose();
      fallbackCloudStripTexture.dispose();
    };
  }, [fallbackCloudStripTexture, material]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthProjectedHorizonCompositeActive = enabled;
    window.__MiraLithLuBirthProjectedHorizonCompositeLayer = layer;
    window.__MiraLithLuBirthProjectedHorizonCompositeTexture =
      enabled && cloudStripTexture && !cloudStripTextureFailed ? cloudStripAsset?.src : "procedural-fallback";
    return () => {
      window.__MiraLithLuBirthProjectedHorizonCompositeActive = false;
      window.__MiraLithLuBirthProjectedHorizonCompositeLayer = undefined;
      window.__MiraLithLuBirthProjectedHorizonCompositeTexture = undefined;
    };
  }, [cloudStripAsset?.src, cloudStripTexture, cloudStripTextureFailed, enabled, layer]);

  useFrame((state) => {
    if (!overlay.current || !enabled || !("fov" in camera)) {
      return;
    }

    fitOverlayToCamera(overlay.current, camera, size.width / Math.max(size.height, 1));
    material.uniforms.cloudStripMap.value = activeCloudStripTexture;
    material.uniforms.earthCenter.value.copy(projection.current.center);
    material.uniforms.earthRadius.value = projection.current.radius;
    material.uniforms.sunDirection.value.copy(projection.current.sunDirection);
    material.uniforms.progress.value = projection.current.progress;
    material.uniforms.cloudOpacity.value = cloudsEnabled ? composition.earth.cloudOpacity : 0;
    material.uniforms.atmosphereIntensity.value = limbEnabled ? composition.atmosphere.intensity : 0;
    material.uniforms.auroraIntensity.value = auroraEnabled ? composition.aurora.intensity : 0;
    material.uniforms.mode.value = mode;
    material.uniforms.auroraDebug.value = auroraProfile === "debug" ? 1 : 0;
    material.uniforms.auroraVisible.value = auroraEnabled
      ? (layer === "aurora" ? 3.0 : 0.32)
      : 0;
    material.uniforms.time.value = paused || reducedMotion ? 0 : state.clock.elapsedTime;
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={overlay} material={material} renderOrder={20} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
