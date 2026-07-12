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
        float upperArc = smoothstep(0.05, 0.38, edgeNormal.y);
        float sideWindow = smoothstep(-0.96, -0.56, edgeNormal.x) * (1.0 - smoothstep(0.58, 0.98, edgeNormal.x));
        float insideClip = smoothstep(-10.0, 8.0, signedInside);
        float outsideFeather = 1.0 - smoothstep(24.0, 48.0, -signedInside);
        float day = smoothstep(-0.24, 0.36, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.34, abs(sunDot));
        float closeStage = 1.0 - smoothstep(0.12, 0.78, progress);
        float debugBoost = mode == 1 ? 1.0 : 0.0;

        float band = smoothstep(-8.0, 10.0, signedInside) * (1.0 - smoothstep(68.0, 116.0, signedInside));
        float horizonCore = smoothstep(-1.0, 18.0, signedInside) * (1.0 - smoothstep(42.0, 88.0, signedInside));
        float cloudDepth01 = clamp((signedInside + 8.0) / 116.0, 0.0, 1.0);
        float arc = angle / 3.14159265;
        vec2 cloudUv = vec2(arc * 7.2 + time * 0.004, signedInside * 0.018 - time * 0.0015);
        vec4 strip = texture2D(cloudStripMap, vec2(fract(arc * 3.8 + time * 0.002), cloudDepth01));
        float broad = fbm(cloudUv + vec2(1.7, 0.2));
        float detail = fbm(cloudUv * vec2(3.4, 2.2) + vec2(4.0, 8.0));
        float streak = fbm(vec2(arc * 22.0 - time * 0.006, signedInside * 0.045));
        float voids = fbm(cloudUv * vec2(1.9, 1.15) + vec2(8.4, 2.2));

        float stripCoverage = strip.r;
        float stripHeight = strip.g;
        float stripShadow = strip.b;
        float stripTop = strip.a;
        float silhouette = smoothstep(
          0.24,
          0.7,
          stripCoverage * 0.58 + broad * 0.24 + detail * 0.18 + horizonCore * 0.16 - voids * 0.16
        );
        float brokenEdge = mix(0.08, 1.0, smoothstep(0.28, 0.84, stripCoverage + detail * 0.32 + streak * 0.22 - voids * 0.28));
        float coverage = silhouette * mix(0.45, 1.0, horizonCore) * brokenEdge;
        float topHighlight = exp(-pow((cloudDepth01 - 0.14) * 4.8, 2.0)) * (0.42 + stripTop * 0.42) * day;
        float midBody = smoothstep(0.1, 0.42, cloudDepth01) * (1.0 - smoothstep(0.62, 0.9, cloudDepth01));
        float underside = smoothstep(0.44, 0.96, cloudDepth01) * (0.54 + stripShadow * 0.6);
        float topCap = smoothstep(0.48, 0.9, stripTop * 0.72 + stripHeight * 0.4 + detail * 0.12 + horizonCore * 0.18);
        float baseShadow = underside * smoothstep(0.42, 0.9, stripShadow + broad * 0.26 + streak * 0.18);

        vec3 topCol = vec3(0.92, 0.96, 0.98);
        vec3 bodyCol = vec3(0.48, 0.58, 0.68);
        vec3 bottomCol = vec3(0.08, 0.13, 0.22);
        vec3 color =
          topCol * topHighlight * (0.48 + day * 0.52) +
          bodyCol * midBody * (0.6 + day * 0.32) +
          bottomCol * underside;
        color += topCol * topHighlight * 0.22;
        color *= mix(vec3(1.0), vec3(0.42, 0.55, 0.72), clamp(underside * 0.65, 0.0, 0.86));
        color = mix(color, color * vec3(0.32, 0.42, 0.58), clamp(baseShadow * 0.72, 0.0, 0.86));
        color += vec3(0.9, 0.97, 1.0) * topCap * horizonCore * (0.08 + day * 0.14);
        color += vec3(0.95, 0.55, 0.24) * twilight * topHighlight * 0.08;
        color = mix(color, vec3(0.06, 0.12, 0.22), smoothstep(0.74, 1.0, cloudDepth01) * 0.22);

        float alpha = coverage * band * upperArc * sideWindow * insideClip * outsideFeather;
        float materialAlpha = topHighlight * 0.3 + midBody * 0.48 + underside * 0.22;
        float centerSuppression = 1.0 - smoothstep(68.0, 124.0, signedInside);
        alpha *= mix(0.68, 1.0, horizonCore) * centerSuppression;
        alpha *= materialAlpha * cloudOpacity * (0.82 + closeStage * 0.12 + debugBoost * 0.14);
        alpha = clamp(alpha, 0.0, mix(0.24, 0.4, debugBoost));

        return CloudResult(color, alpha, topHighlight, midBody, underside);
      }

      LimbResult evalLimb(vec2 edgeNormal, float signedOutside, float sunDot, float cloudAlpha, float angle) {
        float debugBoost = mode == 2 ? 1.0 : 0.0;
        float upperArc = smoothstep(0.02, 0.34, edgeNormal.y);
        float sideWindow = smoothstep(-0.98, -0.62, edgeNormal.x) * (1.0 - smoothstep(0.62, 0.98, edgeNormal.x));
        float day = smoothstep(-0.2, 0.34, sunDot);
        float night = 1.0 - smoothstep(-0.18, 0.18, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.28, abs(sunDot));
        float closeStage = 1.0 - smoothstep(0.12, 0.78, progress);
        float arc = angle / 3.14159265;
        float airglowBreakup = smoothstep(0.46, 0.84, fbm(vec2(arc * 11.0 + 4.2, 7.0)));

        float whiteNeedle = (1.0 - smoothstep(0.0, mix(1.5, 2.3, debugBoost), abs(signedOutside + 0.35))) *
          (0.2 + day * 0.62);
        float insideBlue = smoothstep(-4.5, -1.0, signedOutside) *
          (1.0 - smoothstep(0.0, 3.6, signedOutside)) *
          (0.045 + day * 0.07);
        float blueThickness = smoothstep(0.0, mix(3.6, 7.6, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(12.0, 26.0, debugBoost), mix(28.0, 64.0, debugBoost), signedOutside)) *
          (0.052 + day * 0.075);
        float oxygenGreen = smoothstep(1.0, mix(5.6, 8.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(10.0, 18.0, debugBoost), mix(24.0, 42.0, debugBoost), signedOutside)) *
          night *
          mix(0.025 * airglowBreakup, 0.13, debugBoost);
        float amberTwilight = smoothstep(1.0, mix(6.0, 9.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(10.0, 18.0, debugBoost), mix(24.0, 38.0, debugBoost), signedOutside)) *
          twilight *
          mix(0.036, 0.11, debugBoost);
        float outerCyan = smoothstep(12.0, mix(26.0, 42.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(48.0, 80.0, debugBoost), mix(86.0, 138.0, debugBoost), signedOutside)) *
          mix(0.0028, 0.014, debugBoost);

        float cloudCut = cloudAlpha * mix(0.72, 0.38, debugBoost);
        whiteNeedle *= 1.0 - cloudCut;
        insideBlue *= 1.0 - cloudCut * 0.72;
        blueThickness *= 1.0 - cloudCut * 0.58;
        oxygenGreen *= 1.0 - cloudAlpha * 0.34;
        amberTwilight *= 1.0 - cloudAlpha * 0.28;

        vec3 color =
          vec3(0.95, 0.985, 1.0) * whiteNeedle +
          vec3(0.13, 0.4, 0.86) * (insideBlue + blueThickness) +
          vec3(0.12, 0.52, 0.36) * oxygenGreen +
          vec3(0.86, 0.38, 0.14) * amberTwilight +
          vec3(0.07, 0.34, 0.56) * outerCyan;

        float alpha = whiteNeedle + insideBlue + blueThickness + oxygenGreen + amberTwilight + outerCyan;
        float arcMask = upperArc * sideWindow;
        float gain = atmosphereIntensity * (0.56 + closeStage * 0.08) * (1.0 + debugBoost * 0.24);
        return LimbResult(color * arcMask * gain, clamp(alpha * arcMask * gain, 0.0, mix(0.16, 0.28, debugBoost)), whiteNeedle * arcMask);
      }

      AuroraResult evalAurora(vec2 edgeNormal, float signedOutside, float sunDot, float cloudAlpha, float limbWhiteAlpha, float angle) {
        float debugGain = auroraDebug;
        float upperArc = smoothstep(0.08, 0.36, edgeNormal.y);
        float sideWindow = smoothstep(-0.82, -0.46, edgeNormal.x) * (1.0 - smoothstep(0.18, 0.56, edgeNormal.x));
        float night = 1.0 - smoothstep(-0.28, 0.1, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.3, abs(sunDot));
        float arcWindow = mix(max(night, twilight * 0.28), 1.0, debugGain * 0.6);
        float rootMask = (1.0 - smoothstep(0.0, 3.0, abs(signedOutside - 1.0))) * mix(0.12, 0.22, debugGain);
        float outside = smoothstep(3.0, 15.0, signedOutside);
        float topFade = 1.0 - smoothstep(mix(58.0, 118.0, debugGain), mix(124.0, 220.0, debugGain), signedOutside);
        float body = outside * topFade;

        float arc = angle / 3.14159265;
        float height = max(signedOutside, 0.0);
        vec2 curtainUv = vec2(arc * 16.0 + time * 0.006, height * 0.028 - time * 0.012);
        float folds = sin(arc * 88.0 + fbm(vec2(arc * 19.0, height * 0.035 + time * 0.018)) * 3.8) * 0.5 + 0.5;
        float fineFolds = sin(arc * 184.0 + height * 0.026 + fbm(vec2(arc * 42.0, 1.7)) * 4.2 + time * 0.016) * 0.5 + 0.5;
        float columnNoise = fbm(curtainUv + vec2(3.2, 1.1));
        float columnHeight = smoothstep(0.24, 0.82, fbm(vec2(arc * 21.0 - time * 0.006, 2.0)));
        float verticalLimit = 1.0 - smoothstep(54.0 + columnHeight * 92.0, 124.0 + columnHeight * 128.0, height);
        float rootLift = smoothstep(3.0, 24.0, height);
        float strandCore =
          pow(folds, mix(8.0, 9.5, debugGain)) * 0.72 +
          pow(fineFolds, 14.0) * 0.42 +
          columnNoise * 0.04;
        float strands = smoothstep(0.08, 0.38, strandCore);
        float breakup = smoothstep(0.42, 0.82, fbm(vec2(arc * 45.0 - time * 0.01, height * 0.04)));
        float curtain = body * rootLift * strands * breakup * verticalLimit * mix(0.64, 1.0, debugGain);
        float closeStage = 1.0 - smoothstep(0.16, 0.74, progress);
        float density = (rootMask * 0.16 + curtain * 1.18) * upperArc * sideWindow * arcWindow;
        float gain = auroraIntensity * auroraVisible * (0.38 + closeStage * 0.14 + debugGain * 1.12);
        float alpha = density * gain;
        alpha *= 1.0 - cloudAlpha * mix(0.55, 0.38, debugGain);
        alpha *= 1.0 - limbWhiteAlpha * 0.35;

        vec3 rootGreen = mix(vec3(0.06, 0.44, 0.26), vec3(0.1, 0.62, 0.32), debugGain);
        vec3 grayGreen = vec3(0.07, 0.22, 0.2);
        vec3 redUpper = vec3(0.22, 0.05, 0.08);
        float topMix = smoothstep(58.0, 180.0, height);
        vec3 color = mix(rootGreen, grayGreen, smoothstep(24.0, 92.0, height));
        color = mix(color, redUpper, topMix * 0.36);
        color *= density * (1.12 + curtain * 0.76 + debugGain * 0.52);

        return AuroraResult(min(color, mix(vec3(0.08, 0.32, 0.28), vec3(0.14, 0.62, 0.48), debugGain)), clamp(alpha, 0.0, mix(0.08, 0.24, debugGain)));
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
