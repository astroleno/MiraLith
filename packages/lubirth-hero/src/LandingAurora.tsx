"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAuroraProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection: Vector3;
  visibilityBoost?: number;
  moonColumnAvoidance?: number;
  moonColumnCenter?: number;
  lowProfile?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

interface AuroraCurtainLayer {
  lonCenterDeg: number;
  lonSpanDeg: number;
  latCenterDeg: number;
  latWaveDeg: number;
  baseRadius: number;
  height: number;
  heroHeight: number;
  phase: number;
  opacity: number;
  foldScale: number;
  rootWidth: number;
  topFeatherStart: number;
  rootGlow: number;
  topMist: number;
}

const DEG_TO_RAD = Math.PI / 180;
const colorA = new Color();
const colorB = new Color();
const localNormal = new Vector3();
const eastTangent = new Vector3();
const northTangent = new Vector3();
const position = new Vector3();

const CURTAINS: AuroraCurtainLayer[] = [
  { lonCenterDeg: -118, lonSpanDeg: 56, latCenterDeg: 56, latWaveDeg: 5.2, baseRadius: 1.016, height: 0.17, heroHeight: 0.1, phase: 0.72, opacity: 0.5, foldScale: 5.4, rootWidth: 0.14, topFeatherStart: 0.62, rootGlow: 1.28, topMist: 0.7 },
  { lonCenterDeg: -78, lonSpanDeg: 52, latCenterDeg: 60.5, latWaveDeg: 2.8, baseRadius: 1.019, height: 0.105, heroHeight: 0.078, phase: 2.68, opacity: 0.34, foldScale: 8.9, rootWidth: 0.1, topFeatherStart: 0.52, rootGlow: 1.42, topMist: 0.52 },
  { lonCenterDeg: -148, lonSpanDeg: 34, latCenterDeg: 53.4, latWaveDeg: 4.6, baseRadius: 1.013, height: 0.2, heroHeight: 0.116, phase: 4.15, opacity: 0.22, foldScale: 4.7, rootWidth: 0.18, topFeatherStart: 0.7, rootGlow: 1.18, topMist: 0.82 }
];

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function resolveCurtainLayer(layer: AuroraCurtainLayer, lowProfile: boolean): AuroraCurtainLayer {
  if (!lowProfile) {
    return layer;
  }

  return {
    ...layer,
    height: layer.heroHeight,
    rootWidth: layer.rootWidth * 0.68,
    topFeatherStart: Math.min(layer.topFeatherStart, 0.48),
    rootGlow: layer.rootGlow * 1.16,
    topMist: layer.topMist * 0.58
  };
}

function setSphericalDirection(target: Vector3, lon: number, lat: number) {
  const cosLat = Math.cos(lat);
  target.set(
    Math.cos(lon) * cosLat,
    Math.sin(lat),
    Math.sin(lon) * cosLat
  ).normalize();
}

function setSphericalTangents(east: Vector3, north: Vector3, lon: number, lat: number) {
  east.set(-Math.sin(lon), 0, Math.cos(lon)).normalize();
  north.set(
    -Math.cos(lon) * Math.sin(lat),
    Math.cos(lat),
    -Math.sin(lon) * Math.sin(lat)
  ).normalize();
}

function createCurtainGeometry(layer: AuroraCurtainLayer, arcSegments: number, heightSegments: number) {
  const vertexCount = (arcSegments + 1) * (heightSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const centerLon = layer.lonCenterDeg * DEG_TO_RAD;
  const lonSpan = layer.lonSpanDeg * DEG_TO_RAD;
  const baseLat = layer.latCenterDeg * DEG_TO_RAD;
  const latWave = layer.latWaveDeg * DEG_TO_RAD;

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const vertical = smoothstep(0, 1, v);

    for (let x = 0; x <= arcSegments; x += 1) {
      const u = x / arcSegments;
      const fold = Math.sin(u * Math.PI * layer.foldScale + layer.phase);
      const highFold = Math.sin(u * Math.PI * 15 + layer.phase * 1.7);
      const lon =
        centerLon +
        (u - 0.5) * lonSpan +
        Math.sin(u * Math.PI * 4 + layer.phase) * 0.022 * vertical;
      const lat =
        baseLat +
        Math.sin(u * Math.PI * 2 + layer.phase) * latWave +
        Math.sin(u * Math.PI * 7 + layer.phase) * latWave * 0.16 * (1 - vertical);
      const height = layer.height * vertical * (0.84 + Math.max(fold, 0) * 0.18 + highFold * 0.035);
      const heightSpread = 0.92 + Math.sin(u * Math.PI * 3.0 + layer.phase * 0.7) * 0.08;
      const shapedHeight = height * heightSpread;
      const radius = layer.baseRadius + shapedHeight;
      const index = y * (arcSegments + 1) + x;

      setSphericalDirection(localNormal, lon, lat);
      setSphericalTangents(eastTangent, northTangent, lon, lat);
      position
        .copy(localNormal)
        .multiplyScalar(radius)
        .addScaledVector(eastTangent, fold * 0.01 * vertical)
        .addScaledVector(northTangent, highFold * 0.0035 * vertical);

      positions[index * 3] = position.x;
      positions[index * 3 + 1] = position.y;
      positions[index * 3 + 2] = position.z;
      normals[index * 3] = localNormal.x;
      normals[index * 3 + 1] = localNormal.y;
      normals[index * 3 + 2] = localNormal.z;
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

function createAuroraMaterial(composition: LandingComposition, layer: AuroraCurtainLayer) {
  colorA.setRGB(...composition.aurora.colorA);
  colorB.setRGB(...composition.aurora.colorB);

  return new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      fieldLift: { value: 0 },
      intensity: { value: composition.aurora.intensity },
      opacityScale: { value: layer.opacity },
      layerSeed: { value: layer.phase },
      foldScale: { value: layer.foldScale },
      rootWidth: { value: layer.rootWidth },
      topFeatherStart: { value: layer.topFeatherStart },
      rootGlow: { value: layer.rootGlow },
      topMistScale: { value: layer.topMist },
      colorA: { value: colorA.clone() },
      colorB: { value: colorB.clone() },
      lightDirection: { value: new Vector3(0, 1, 0) },
      moonColumnAvoidance: { value: 0 },
      moonColumnCenter: { value: 0.5 },
      screenSize: { value: new Vector2(1, 1) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vPlanetCenterW;
      uniform float fieldLift;

      void main() {
        vUv = uv;
        vec3 liftedPosition = position + normal * uv.y * fieldLift;
        vec4 worldPosition = modelMatrix * vec4(liftedPosition, 1.0);
        vec4 centerWorld = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vPlanetCenterW = centerWorld.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float intensity;
      uniform float opacityScale;
      uniform float layerSeed;
      uniform float foldScale;
      uniform float rootWidth;
      uniform float topFeatherStart;
      uniform float rootGlow;
      uniform float topMistScale;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 lightDirection;
      uniform float moonColumnAvoidance;
      uniform float moonColumnCenter;
      uniform vec2 screenSize;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vPlanetCenterW;

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

      float tri(float value) {
        return abs(fract(value) - 0.5) * 2.0;
      }

      float triNoise(vec2 p) {
        float n = tri(noise2(p) + p.x * 0.12);
        n += tri(noise2(p * 2.03 + layerSeed) + p.y * 0.18) * 0.5;
        n += tri(noise2(p * 4.07 - layerSeed) + p.x * 0.05) * 0.25;
        return clamp(n / 1.75, 0.0, 1.0);
      }

      void main() {
        float arc = vUv.x;
        float vertical = vUv.y;
        vec3 planetNormal = normalize(vWorldPosition - vPlanetCenterW);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = dot(planetNormal, viewDirection);
        float frontGate = smoothstep(-0.42, 0.06, facing);
        float limbGate = frontGate * (1.0 - smoothstep(0.74, 0.98, facing));

        vec3 sunDirection = normalize(lightDirection);
        float sunSide = dot(normalize(vWorldNormal), sunDirection);
        float nightGate = 0.32 + 0.68 * (1.0 - smoothstep(-0.04, 0.4, sunSide));

        float sideFeather = smoothstep(0.0, 0.09, arc) * (1.0 - smoothstep(0.91, 1.0, arc));
        float root = 1.0 - smoothstep(0.012, rootWidth, vertical);
        float topFade = 1.0 - smoothstep(topFeatherStart, 0.99, vertical);
        float topMist = smoothstep(0.36, 0.84, vertical) * topFade * topMistScale;
        float sheetBand = smoothstep(0.06, 0.22, vertical) * topFade;

        float drift = sin(vertical * 4.4 + layerSeed * 2.0) * 0.025;
        float broad = 0.5 + 0.5 * sin((arc + drift) * 6.28318530718 * 1.8 + time * 0.05 + layerSeed);
        float folded = 0.5 + 0.5 * sin((arc + drift * 0.45) * 6.28318530718 * foldScale + sin(vertical * 4.0 + time * 0.035) * 0.34 + layerSeed);
        float strands = pow(folded, 3.6);
        float breakup = triNoise(vec2(arc * foldScale * 1.4 + time * 0.014, vertical * 5.2 + layerSeed));
        float strandGate = smoothstep(0.18, 0.74, breakup);
        float rootBand = root * (0.5 + broad * 0.22) * rootGlow;
        float curtain = sheetBand * (0.1 + strands * 0.84 + pow(broad, 2.0) * 0.18) * (0.36 + strandGate * 0.64);
        float density = sideFeather * limbGate * nightGate * (rootBand * 0.3 + curtain * 0.84 + topMist * breakup * 0.08);
        float screenX = gl_FragCoord.x / max(screenSize.x, 1.0);
        float moonColumn = 1.0 - smoothstep(0.055, 0.19, abs(screenX - moonColumnCenter));
        density *= mix(1.0, 0.46, moonColumn * moonColumnAvoidance);
        float alpha = density * intensity * opacityScale * 1.62;

        if (alpha < 0.0015) {
          discard;
        }

        vec3 auroraColor = mix(colorA, colorB, smoothstep(0.1, 0.78, vertical));
        auroraColor = mix(auroraColor, vec3(0.5, 0.86, 0.72), rootBand * 0.2 + strands * 0.08);
        auroraColor = mix(auroraColor, vec3(0.34, 0.46, 0.42), smoothstep(0.58, 0.98, vertical) * 0.3);
        vec3 highRed = vec3(0.42, 0.1, 0.07) * smoothstep(0.5, 0.92, vertical) * curtain * 0.07;
        vec3 finalColor = auroraColor * density * (2.88 + strands * 0.56 + rootBand * 0.82) + highRed;

        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.34));
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingAurora({
  composition,
  quality,
  sceneLightDirection,
  visibilityBoost = 1,
  moonColumnAvoidance = 0,
  moonColumnCenter = 0.5,
  lowProfile = false,
  reducedMotion,
  paused
}: LandingAuroraProps) {
  const aurora = useRef<Group>(null);
  const { size } = useThree();
  const enabled =
    quality.tier !== "fallback" &&
    quality.aurora &&
    !reducedMotion &&
    composition.aurora.enabled &&
    composition.aurora.intensity > 0 &&
    composition.aurora.sampleCount > 0;
  const curtains = useMemo(() => {
    if (!enabled) {
      return [];
    }

    const activeLayers = quality.tier === "high" ? CURTAINS : CURTAINS.slice(0, 2);
    return activeLayers.map((layer) => {
      const resolvedLayer = resolveCurtainLayer(layer, lowProfile);

      return {
        geometry: createCurtainGeometry(
          resolvedLayer,
          quality.tier === "high" ? 76 : 56,
          quality.tier === "high" ? 16 : 12
        ),
        material: createAuroraMaterial(composition, resolvedLayer)
      };
    });
  }, [composition, enabled, lowProfile, quality.tier]);

  useEffect(() => {
    return () => {
      curtains.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
    };
  }, [curtains]);

  useFrame((state) => {
    if (!aurora.current || curtains.length === 0) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const nearFade = 1 - smoothstep(0.2, 0.62, progress);
    const farFloor = 0.06;
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    const intensity = composition.aurora.intensity * visibilityBoost * Math.max(farFloor, nearFade);

    aurora.current.children.forEach((child) => {
      const material = (child as Mesh).material as ShaderMaterial;
      material.uniforms.time.value = elapsed;
      material.uniforms.fieldLift.value = smoothstep(0.62, 1, progress) * composition.earth.radius * 0.018;
      material.uniforms.intensity.value = intensity;
      material.uniforms.lightDirection.value.copy(sceneLightDirection);
      material.uniforms.moonColumnAvoidance.value = moonColumnAvoidance;
      material.uniforms.moonColumnCenter.value = moonColumnCenter;
      material.uniforms.screenSize.value.set(size.width, size.height);
      material.visible = enabled;
    });
  });

  if (!enabled || curtains.length === 0) {
    return null;
  }

  return (
    <group ref={aurora}>
      {curtains.map(({ geometry, material }, index) => (
        <mesh key={index} geometry={geometry} material={material} renderOrder={12 + index} />
      ))}
    </group>
  );
}
