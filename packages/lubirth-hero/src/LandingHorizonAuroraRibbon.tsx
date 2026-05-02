"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingHorizonAuroraRibbonProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection: Vector3;
  visibilityBoost?: number;
  moonColumnAvoidance?: number;
  moonColumnCenter?: number;
  debugProfile?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthHorizonAuroraRibbonActive?: boolean;
  }
}

const colorA = new Color();
const colorB = new Color();
const cameraWorldQuaternion = new Quaternion();
const parentWorldQuaternion = new Quaternion();
const inverseParentWorldQuaternion = new Quaternion();
const localLightDirection = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createRibbonGeometry(composition: LandingComposition, debugProfile: boolean) {
  const arcSegments = debugProfile ? 124 : 96;
  const heightSegments = debugProfile ? 18 : 14;
  const vertexCount = (arcSegments + 1) * (heightSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const radius = composition.earth.radius;
  const ribbonWidth = radius * 1.36;
  const baseY = radius * 0.892;
  const baseZ = radius * -0.025;
  const maxHeight = radius * (debugProfile ? 0.092 : 0.06);

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const vertical = smoothstep(0, 1, v);

    for (let x = 0; x <= arcSegments; x += 1) {
      const u = x / arcSegments;
      const side = (u - 0.5) * 2.0;
      const horizonCurve = (1.0 - side * side) * radius * 0.056;
      const scallop =
        Math.sin(u * Math.PI * 6.0 + 0.5) * radius * 0.004 +
        Math.sin(u * Math.PI * 13.0) * radius * 0.002;
      const localX = side * ribbonWidth * 0.5;
      const localY =
        baseY +
        horizonCurve +
        scallop +
        vertical * maxHeight * (0.7 + Math.sin(u * Math.PI * 4.0) * 0.09);
      const localZ = baseZ - vertical * radius * 0.012;
      const index = y * (arcSegments + 1) + x;

      positions[index * 3] = localX;
      positions[index * 3 + 1] = localY;
      positions[index * 3 + 2] = localZ;
      normals[index * 3] = 0;
      normals[index * 3 + 1] = 0;
      normals[index * 3 + 2] = -1;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }
  }

  for (let y = 0; y < heightSegments; y += 1) {
    for (let x = 0; x < arcSegments; x += 1) {
      const a = y * (arcSegments + 1) + x;
      const b = a + 1;
      const c = a + arcSegments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createRibbonMaterial(composition: LandingComposition, debugProfile: boolean) {
  colorA.setRGB(...composition.aurora.colorA);
  colorB.setRGB(...composition.aurora.colorB);

  return new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      intensity: { value: composition.aurora.intensity },
      colorA: { value: colorA.clone() },
      colorB: { value: colorB.clone() },
      lightDirection: { value: new Vector3(0, 1, 0) },
      moonColumnAvoidance: { value: 0 },
      moonColumnCenter: { value: 0.5 },
      screenSize: { value: new Vector2(1, 1) },
      debugGain: { value: debugProfile ? 1 : 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPosition;

      void main() {
        vUv = uv;
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float intensity;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 lightDirection;
      uniform float moonColumnAvoidance;
      uniform float moonColumnCenter;
      uniform vec2 screenSize;
      uniform float debugGain;

      varying vec2 vUv;
      varying vec3 vLocalPosition;
      const vec3 rootGreen = vec3(0.18, 0.92, 0.42);
      const vec3 hazeGreen = vec3(0.18, 0.58, 0.46);
      const vec3 nitrogenRed = vec3(0.48, 0.13, 0.22);

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
        for (int i = 0; i < 4; i += 1) {
          value += noise2(p) * amplitude;
          p = p * 2.03 + vec2(5.7, 2.9);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        float vertical = vUv.y;
        float arc = vUv.x;
        float sideFeather = smoothstep(0.018, 0.1, arc) * (1.0 - smoothstep(0.9, 0.982, arc));
        float bottomFeather = smoothstep(0.018, 0.095, vertical);
        float rootLine = 1.0 - smoothstep(0.01, 0.068, vertical);
        float rootBreakup = smoothstep(0.14, 0.72, fbm(vec2(arc * 34.0 + time * 0.01, 0.7)));
        float root = rootLine * mix(0.72, 1.0, rootBreakup);

        float body = smoothstep(0.035, 0.16, vertical) * (1.0 - smoothstep(0.46, 0.92, vertical));
        float topMist = smoothstep(0.3, 0.72, vertical) * (1.0 - smoothstep(0.68, 1.0, vertical));
        float drift = fbm(vec2(arc * 5.0 + time * 0.012, vertical * 2.0)) * 0.055;
        float fold = sin((arc + drift) * 94.0 + fbm(vec2(arc * 20.0, vertical * 5.4 + time * 0.018)) * 3.6);
        float fine = sin((arc - drift) * 213.0 + vertical * 9.0 + time * 0.02);
        float strands = smoothstep(0.42, 0.88, 0.52 + fold * 0.25 + fine * 0.09);
        float columnHeight = smoothstep(0.2, 0.84, fbm(vec2(arc * 18.0 - time * 0.008, 2.4)));
        float verticalFalloff = 1.0 - smoothstep(0.34 + columnHeight * 0.32, 0.96, vertical);
        float curtainBreakup = smoothstep(0.18, 0.78, fbm(vec2(arc * 40.0 - time * 0.009, vertical * 6.0 + 2.0)));
        float curtain = body * strands * curtainBreakup * verticalFalloff;
        float density = sideFeather * bottomFeather * (root * 0.82 + curtain * 0.92 + topMist * curtainBreakup * 0.1);
        vec3 horizonNormal = normalize(vLocalPosition);
        float lightSide = dot(normalize(lightDirection), horizonNormal);
        float nightGate = 1.0 - smoothstep(-0.08, 0.26, lightSide);
        float twilightGate = 1.0 - smoothstep(0.1, 0.38, abs(lightSide));
        float horizonGate = max(nightGate, twilightGate * 0.65);
        density *= mix(mix(0.25, 1.0, horizonGate), 1.0, debugGain);

        float screenX = gl_FragCoord.x / max(screenSize.x, 1.0);
        float moonColumn = 1.0 - smoothstep(0.055, 0.19, abs(screenX - moonColumnCenter));
        density *= mix(1.0, 0.55, moonColumn * moonColumnAvoidance);
        float gain = mix(0.46, 1.02, debugGain);
        float alpha = density * intensity * gain * 1.18;

        if (alpha < 0.0012) {
          discard;
        }

        vec3 auroraColor = mix(rootGreen, hazeGreen, smoothstep(0.08, 0.62, vertical));
        auroraColor = mix(auroraColor, nitrogenRed, topMist * 0.55);
        auroraColor = mix(auroraColor, colorB, curtain * 0.16);
        auroraColor = mix(auroraColor, vec3(0.28, 0.4, 0.34), smoothstep(0.54, 0.98, vertical) * 0.26);
        vec3 finalColor = auroraColor * density * gain * (1.62 + root * 1.18 + curtain * 0.36);

        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, mix(0.105, 0.18, debugGain)));
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingHorizonAuroraRibbon({
  composition,
  quality,
  sceneLightDirection,
  visibilityBoost = 1,
  moonColumnAvoidance = 0,
  moonColumnCenter = 0.5,
  debugProfile = false,
  reducedMotion,
  paused
}: LandingHorizonAuroraRibbonProps) {
  const aurora = useRef<Group>(null);
  const { size } = useThree();
  const enabled =
    quality.tier !== "fallback" &&
    quality.aurora &&
    !reducedMotion &&
    composition.aurora.enabled &&
    composition.aurora.intensity > 0 &&
    composition.aurora.sampleCount > 0;
  const ribbon = useMemo(() => {
    if (!enabled) {
      return null;
    }

    return {
      geometry: createRibbonGeometry(composition, debugProfile),
      material: createRibbonMaterial(composition, debugProfile)
    };
  }, [composition, debugProfile, enabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__MiraLithLuBirthHorizonAuroraRibbonActive = enabled;
    }

    return () => {
      if (typeof window !== "undefined") {
        window.__MiraLithLuBirthHorizonAuroraRibbonActive = false;
      }
      ribbon?.geometry.dispose();
      ribbon?.material.dispose();
    };
  }, [enabled, ribbon]);

  useFrame((state) => {
    if (!aurora.current || !ribbon) {
      return;
    }

    state.camera.getWorldQuaternion(cameraWorldQuaternion);
    if (aurora.current.parent) {
      aurora.current.parent.getWorldQuaternion(parentWorldQuaternion);
      inverseParentWorldQuaternion.copy(parentWorldQuaternion).invert();
      aurora.current.quaternion.copy(parentWorldQuaternion.invert().multiply(cameraWorldQuaternion));
    } else {
      aurora.current.quaternion.copy(cameraWorldQuaternion);
      inverseParentWorldQuaternion.identity();
    }

    const progress = getRuntimeOpeningProgress(0);
    const nearFade = 1 - smoothstep(0.12, 0.52, progress);
    const farFloor = debugProfile ? 0.14 : 0.045;
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    const intensity = composition.aurora.intensity * visibilityBoost * Math.max(farFloor, nearFade);
    localLightDirection.copy(sceneLightDirection).applyQuaternion(inverseParentWorldQuaternion).normalize();

    ribbon.material.uniforms.time.value = elapsed;
    ribbon.material.uniforms.intensity.value = intensity;
    ribbon.material.uniforms.lightDirection.value.copy(localLightDirection);
    ribbon.material.uniforms.moonColumnAvoidance.value = moonColumnAvoidance;
    ribbon.material.uniforms.moonColumnCenter.value = moonColumnCenter;
    ribbon.material.uniforms.screenSize.value.set(size.width, size.height);
    ribbon.material.visible = enabled;
  });

  if (!enabled || !ribbon) {
    return null;
  }

  return (
    <group ref={aurora}>
      <mesh geometry={ribbon.geometry} material={ribbon.material} renderOrder={12} />
    </group>
  );
}
