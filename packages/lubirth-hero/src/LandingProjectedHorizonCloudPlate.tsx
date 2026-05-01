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
import type { LandingComposition, LandingProjectedEarthFrame } from "./types";

interface LandingProjectedHorizonCloudPlateProps {
  composition: LandingComposition;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  emphasis?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthProjectedCloudPlateActive?: boolean;
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

function createCloudStripTexture() {
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

function createCloudPlateMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      cloudStripMap: { value: null },
      screenSize: { value: new Vector2(1, 1) },
      earthCenter: { value: new Vector2(0, 0) },
      earthRadius: { value: 1 },
      sunDirection: { value: new Vector2(0, 1) },
      time: { value: 0 },
      progress: { value: 0 },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      debugBoost: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 screenSize;
      uniform sampler2D cloudStripMap;
      uniform vec2 earthCenter;
      uniform float earthRadius;
      uniform vec2 sunDirection;
      uniform float time;
      uniform float progress;
      uniform float opacity;
      uniform float debugBoost;

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

      void main() {
        vec2 p = gl_FragCoord.xy;
        vec2 fromCenter = p - earthCenter;
        float distanceToCenter = length(fromCenter);
        vec2 edgeNormal = distanceToCenter > 0.001 ? fromCenter / distanceToCenter : vec2(0.0, 1.0);
        float signedEdge = earthRadius - distanceToCenter;
        float upperArc = smoothstep(0.05, 0.38, edgeNormal.y);
        float sideWindow = smoothstep(-0.96, -0.56, edgeNormal.x) * (1.0 - smoothstep(0.58, 0.98, edgeNormal.x));
        float insideClip = smoothstep(-12.0, 8.0, signedEdge);
        float outsideFeather = 1.0 - smoothstep(28.0, 54.0, -signedEdge);
        float sunDot = dot(edgeNormal, normalize(sunDirection));
        float day = smoothstep(-0.24, 0.36, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.34, abs(sunDot));
        float closeStage = 1.0 - smoothstep(0.12, 0.78, progress);
        float band = smoothstep(-10.0, 12.0, signedEdge) * (1.0 - smoothstep(86.0, 142.0, signedEdge));
        float horizonCore = smoothstep(-2.0, 22.0, signedEdge) * (1.0 - smoothstep(56.0, 112.0, signedEdge));
        float cloudDepth01 = clamp((signedEdge + 10.0) / 132.0, 0.0, 1.0);

        float angle = atan(edgeNormal.y, edgeNormal.x);
        float arc = angle / 3.14159265;
        vec2 cloudUv = vec2(arc * 7.2 + time * 0.004, signedEdge * 0.018 - time * 0.0015);
        vec4 strip = texture2D(cloudStripMap, vec2(fract(arc * 3.8 + time * 0.002), cloudDepth01));
        float broad = fbm(cloudUv + vec2(1.7, 0.2));
        float detail = fbm(cloudUv * vec2(3.4, 2.2) + vec2(4.0, 8.0));
        float streak = fbm(vec2(arc * 22.0 - time * 0.006, signedEdge * 0.045));
        float voids = fbm(cloudUv * vec2(1.9, 1.15) + vec2(8.4, 2.2));
        float stripCoverage = strip.r;
        float stripHeight = strip.g;
        float stripShadow = strip.b;
        float stripTop = strip.a;
        float silhouette = smoothstep(
          0.36,
          0.82,
          stripCoverage * 0.5 + broad * 0.28 + detail * 0.18 + horizonCore * 0.16 - voids * 0.2
        );
        float brokenEdge = mix(0.08, 1.0, smoothstep(0.28, 0.84, stripCoverage + detail * 0.32 + streak * 0.22 - voids * 0.28));
        float coverage = silhouette * mix(0.45, 1.0, horizonCore) * brokenEdge;
        float topHighlight = exp(-pow((cloudDepth01 - 0.14) * 4.8, 2.0)) * (0.56 + stripTop * 0.54) * day;
        float midBody = smoothstep(0.1, 0.42, cloudDepth01) * (1.0 - smoothstep(0.62, 0.9, cloudDepth01));
        float underside = smoothstep(0.44, 0.96, cloudDepth01) * (0.54 + stripShadow * 0.6);
        float topCap = smoothstep(0.48, 0.9, stripTop * 0.72 + stripHeight * 0.4 + detail * 0.12 + horizonCore * 0.18);
        float baseShadow = underside * smoothstep(0.42, 0.9, stripShadow + broad * 0.26 + streak * 0.18);

        vec3 topCol = vec3(1.05, 1.03, 0.96);
        vec3 bodyCol = vec3(0.62, 0.72, 0.82);
        vec3 bottomCol = vec3(0.13, 0.2, 0.32);
        vec3 color =
          topCol * topHighlight * (0.48 + day * 0.52) +
          bodyCol * midBody * (0.6 + day * 0.32) +
          bottomCol * underside;
        color = mix(color, color * vec3(0.32, 0.42, 0.58), clamp(baseShadow * 0.72, 0.0, 0.86));
        color += vec3(0.9, 0.97, 1.0) * topCap * horizonCore * (0.08 + day * 0.14);
        color += vec3(0.95, 0.55, 0.24) * twilight * topHighlight * 0.08;
        color = mix(color, vec3(0.06, 0.12, 0.22), smoothstep(0.74, 1.0, cloudDepth01) * 0.22);

        float alpha = coverage * band * upperArc * sideWindow * insideClip * outsideFeather;
        float materialAlpha = topHighlight * 0.24 + midBody * 0.42 + underside * 0.16;
        float centerSuppression = 1.0 - smoothstep(92.0, 154.0, signedEdge);
        alpha *= mix(0.68, 1.0, horizonCore) * centerSuppression;
        alpha *= materialAlpha * opacity * (0.82 + closeStage * 0.12 + debugBoost * 0.14);
        alpha = clamp(alpha, 0.0, mix(0.28, 0.48, debugBoost));

        if (alpha < 0.002) {
          discard;
        }

        gl_FragColor = vec4(color, alpha);
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

export function LandingProjectedHorizonCloudPlate({
  composition,
  quality,
  projection,
  emphasis = false,
  reducedMotion,
  paused
}: LandingProjectedHorizonCloudPlateProps) {
  const overlay = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(() => createCloudPlateMaterial(composition), [composition]);
  const cloudStripTexture = useMemo(() => createCloudStripTexture(), []);
  const enabled =
    composition.earth.useClouds &&
    composition.earth.cloudOpacity > 0 &&
    quality.tier !== "fallback" &&
    quality.tier !== "low";

  useEffect(() => {
    return () => {
      material.dispose();
      cloudStripTexture.dispose();
    };
  }, [cloudStripTexture, material]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthProjectedCloudPlateActive = enabled;
    return () => {
      window.__MiraLithLuBirthProjectedCloudPlateActive = false;
    };
  }, [enabled]);

  useFrame((state) => {
    if (!overlay.current || !enabled || !("fov" in camera)) {
      return;
    }

    fitOverlayToCamera(overlay.current, camera, size.width / Math.max(size.height, 1));
    material.uniforms.cloudStripMap.value = cloudStripTexture;
    material.uniforms.screenSize.value.set(size.width, size.height);
    material.uniforms.earthCenter.value.copy(projection.current.center);
    material.uniforms.earthRadius.value = projection.current.radius;
    material.uniforms.sunDirection.value.copy(projection.current.sunDirection);
    material.uniforms.progress.value = projection.current.progress;
    material.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
    material.uniforms.time.value = paused || reducedMotion ? 0 : state.clock.elapsedTime;
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={overlay} material={material} renderOrder={18} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
