"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAuroraProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection: Vector3;
  visibilityBoost?: number;
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
  phase: number;
  opacity: number;
  foldScale: number;
}

const DEG_TO_RAD = Math.PI / 180;
const colorA = new Color();
const colorB = new Color();
const localNormal = new Vector3();
const eastTangent = new Vector3();
const northTangent = new Vector3();
const position = new Vector3();

const MAIN_CURTAIN: AuroraCurtainLayer = {
  lonCenterDeg: -118,
  lonSpanDeg: 72,
  latCenterDeg: 58,
  latWaveDeg: 4.8,
  baseRadius: 1.016,
  height: 0.126,
  phase: 0.72,
  opacity: 0.72,
  foldScale: 5.2
};

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

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
      const highFold = Math.sin(u * Math.PI * 15.0 + layer.phase * 1.7);
      const lon =
        centerLon +
        (u - 0.5) * lonSpan +
        Math.sin(u * Math.PI * 4.0 + layer.phase) * 0.028 * vertical;
      const lat =
        baseLat +
        Math.sin(u * Math.PI * 2.0 + layer.phase) * latWave +
        Math.sin(u * Math.PI * 7.0 + layer.phase) * latWave * 0.16 * (1 - vertical);
      const height = layer.height * vertical * (0.84 + Math.max(fold, 0) * 0.18 + highFold * 0.035);
      const radius = layer.baseRadius + height;
      const index = y * (arcSegments + 1) + x;

      setSphericalDirection(localNormal, lon, lat);
      setSphericalTangents(eastTangent, northTangent, lon, lat);
      position
        .copy(localNormal)
        .multiplyScalar(radius)
        .addScaledVector(eastTangent, fold * 0.012 * vertical)
        .addScaledVector(northTangent, highFold * 0.004 * vertical);

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

function createAuroraMaterial(composition: LandingComposition, layer: AuroraCurtainLayer, lowCost: boolean) {
  colorA.setRGB(...composition.aurora.colorA);
  colorB.setRGB(...composition.aurora.colorB);

  return new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      reveal: { value: 1 },
      fieldLift: { value: 0 },
      intensity: { value: composition.aurora.intensity },
      opacityScale: { value: layer.opacity * (lowCost ? 0.92 : 1.0) },
      layerSeed: { value: layer.phase },
      foldScale: { value: layer.foldScale },
      colorA: { value: colorA.clone() },
      colorB: { value: colorB.clone() },
      lightDirection: { value: new Vector3(0, 1, 0) }
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
      uniform float reveal;
      uniform float intensity;
      uniform float opacityScale;
      uniform float layerSeed;
      uniform float foldScale;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 lightDirection;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vPlanetCenterW;

      void main() {
        float arc = vUv.x;
        float vertical = vUv.y;
        vec3 planetNormal = normalize(vWorldPosition - vPlanetCenterW);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = dot(planetNormal, viewDirection);
        float frontGate = smoothstep(-0.18, 0.02, facing);
        float limbGate = frontGate * (1.0 - smoothstep(0.62, 0.92, facing));

        vec3 sunDirection = normalize(lightDirection);
        float night = 1.0 - smoothstep(-0.08, 0.34, dot(normalize(vWorldNormal), sunDirection));
        float lightGate = 0.68 + night * 0.32;

        float sideFeather = smoothstep(0.0, 0.08, arc) * (1.0 - smoothstep(0.92, 1.0, arc));
        float root = 1.0 - smoothstep(0.02, 0.18, vertical);
        float topFade = 1.0 - smoothstep(0.48, 0.88, vertical);
        float sheetBand = smoothstep(0.08, 0.22, vertical) * topFade;

        float drift = sin(vertical * 4.4 + layerSeed * 2.0) * 0.025;
        float broad = 0.5 + 0.5 * sin((arc + drift) * 6.28318530718 * 2.0 + time * 0.08 + layerSeed);
        float fold = 0.5 + 0.5 * sin((arc + drift * 0.45) * 6.28318530718 * foldScale + sin(vertical * 4.0 + time * 0.06) * 0.36 + layerSeed);
        float strand = pow(fold, 3.35);
        float breakUp = 0.62 + 0.38 * broad;
        float rootBand = root * (0.58 + broad * 0.28);
        float curtain = sheetBand * (0.16 + strand * 0.54 + pow(broad, 2.0) * 0.2) * breakUp;
        float density = sideFeather * limbGate * lightGate * (rootBand * 0.38 + curtain * 0.54);
        float alpha = density * intensity * opacityScale * reveal;

        if (alpha < 0.0015) {
          discard;
        }

        vec3 auroraColor = mix(colorA, colorB, smoothstep(0.1, 0.78, vertical));
        auroraColor = mix(auroraColor, vec3(0.58, 0.98, 0.78), rootBand * 0.28 + strand * 0.08);
        vec3 highRed = vec3(0.55, 0.13, 0.08) * smoothstep(0.48, 0.9, vertical) * curtain * 0.12;
        vec3 finalColor = auroraColor * density * (2.1 + strand * 0.52 + rootBand * 0.38) + highRed;

        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 0.22));
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
  reducedMotion,
  paused
}: LandingAuroraProps) {
  const aurora = useRef<Group>(null);
  const enabled =
    quality.tier !== "fallback" &&
    quality.aurora &&
    composition.aurora.enabled &&
    composition.aurora.intensity > 0 &&
    composition.aurora.sampleCount > 0;
  const lowCostAurora = quality.tier === "low";
  const curtain = useMemo(() => {
    if (!enabled) {
      return null;
    }

    const geometry = createCurtainGeometry(
      MAIN_CURTAIN,
      quality.tier === "high" ? 80 : lowCostAurora ? 48 : 64,
      quality.tier === "high" ? 18 : lowCostAurora ? 10 : 14
    );
    const material = createAuroraMaterial(composition, MAIN_CURTAIN, lowCostAurora);
    return { geometry, material };
  }, [composition, enabled, lowCostAurora, quality.tier]);

  useFrame((state) => {
    if (!aurora.current || !curtain) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const reveal = 0.72 + 0.28 * (1 - smoothstep(0.28, 0.9, progress));
    const fieldBoost = 1 + smoothstep(0.62, 1, progress) * 4;
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    aurora.current.children.forEach((child) => {
      const material = (child as Mesh).material as ShaderMaterial;
      material.uniforms.time.value = elapsed;
      material.uniforms.reveal.value = reveal;
      material.uniforms.fieldLift.value = smoothstep(0.62, 1, progress) * composition.earth.radius * 0.18;
      material.uniforms.intensity.value = composition.aurora.intensity * visibilityBoost * fieldBoost;
      material.uniforms.lightDirection.value.copy(sceneLightDirection);
      material.visible = enabled;
    });
  });

  if (!enabled || !curtain) {
    return null;
  }

  return (
    <group ref={aurora}>
      <mesh geometry={curtain.geometry} material={curtain.material} renderOrder={12} />
    </group>
  );
}
