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
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAuroraOvalProps {
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

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const colorA = new Color();
const colorB = new Color();
const localNormal = new Vector3();
const position = new Vector3();
const eastTangent = new Vector3();
const northTangent = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function setSphericalDirection(target: Vector3, lon: number, lat: number) {
  const cosLat = Math.cos(lat);
  target.set(Math.cos(lon) * cosLat, Math.sin(lat), Math.sin(lon) * cosLat).normalize();
}

function setSphericalTangents(east: Vector3, north: Vector3, lon: number, lat: number) {
  east.set(-Math.sin(lon), 0, Math.cos(lon)).normalize();
  north.set(
    -Math.cos(lon) * Math.sin(lat),
    Math.cos(lat),
    -Math.sin(lon) * Math.sin(lat)
  ).normalize();
}

function createAuroraOvalGeometry(composition: LandingComposition, lowProfile: boolean, lonSegments: number, heightSegments: number) {
  const vertexCount = (lonSegments + 1) * (heightSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const [minLatDeg, maxLatDeg] = composition.aurora.latitudeBandDeg;
  const centerLatDeg = (minLatDeg + maxLatDeg) * 0.5 - 3.2;
  const radius = composition.earth.radius;
  const maxHeight = radius * (lowProfile ? 0.088 : 0.145);
  const baseRadius = radius * 1.014;

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const vertical = smoothstep(0, 1, v);

    for (let x = 0; x <= lonSegments; x += 1) {
      const u = x / lonSegments;
      const lon = u * Math.PI * 2;
      const ovalWave =
        Math.sin(lon * 2.0 + 0.7) * 2.4 +
        Math.sin(lon * 5.0 - 1.6) * 0.95 +
        Math.sin(lon * 9.0 + 0.2) * 0.32;
      const heightWave =
        0.78 +
        Math.max(0, Math.sin(lon * 3.0 + 1.2)) * 0.22 +
        Math.sin(lon * 7.0 - 0.4) * 0.06;
      const lat = (centerLatDeg + ovalWave + Math.sin(lon * 4.0) * vertical * 0.5) * DEG_TO_RAD;
      const height = maxHeight * vertical * heightWave * (0.9 + Math.sin(u * Math.PI * 2.0 + 0.5) * 0.04);
      const index = y * (lonSegments + 1) + x;

      setSphericalDirection(localNormal, lon, lat);
      setSphericalTangents(eastTangent, northTangent, lon, lat);
      position
        .copy(localNormal)
        .multiplyScalar(baseRadius + height)
        .addScaledVector(eastTangent, Math.sin(lon * 12.0 + vertical * 2.0) * radius * 0.0025 * vertical)
        .addScaledVector(northTangent, Math.sin(lon * 6.0 - vertical * 1.4) * radius * 0.0035 * vertical);

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
    for (let x = 0; x < lonSegments; x += 1) {
      const a = y * (lonSegments + 1) + x;
      const b = a + 1;
      const c = a + lonSegments + 1;
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

function createAuroraOvalMaterial(composition: LandingComposition, lowProfile: boolean) {
  colorA.setRGB(...composition.aurora.colorA);
  colorB.setRGB(...composition.aurora.colorB);
  const [minLatDeg, maxLatDeg] = composition.aurora.latitudeBandDeg;
  const centerLatDeg = (minLatDeg + maxLatDeg) * 0.5 - 3.2;
  const halfWidthDeg = Math.max(5.8, (maxLatDeg - minLatDeg) * 0.46);

  return new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      fieldLift: { value: 0 },
      intensity: { value: composition.aurora.intensity },
      colorA: { value: colorA.clone() },
      colorB: { value: colorB.clone() },
      lightDirection: { value: new Vector3(0, 1, 0) },
      moonColumnAvoidance: { value: 0 },
      moonColumnCenter: { value: 0.5 },
      screenSize: { value: new Vector2(1, 1) },
      latCenterDeg: { value: centerLatDeg },
      latHalfWidthDeg: { value: halfWidthDeg },
      heightScale: { value: lowProfile ? 0.76 : 1.0 }
    },
    vertexShader: `
      uniform float fieldLift;
      uniform float heightScale;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying vec3 vPlanetCenterW;

      void main() {
        vUv = uv;
        vec3 liftedPosition = position + normal * uv.y * fieldLift * heightScale;
        vec4 worldPosition = modelMatrix * vec4(liftedPosition, 1.0);
        vec4 centerWorld = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vLocalNormal = normalize(normal);
        vPlanetCenterW = centerWorld.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
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
      uniform float latCenterDeg;
      uniform float latHalfWidthDeg;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
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

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i += 1) {
          value += noise2(p) * amplitude;
          p = p * 2.04 + vec2(7.13, 3.71);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 planetNormal = normalize(vWorldPosition - vPlanetCenterW);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = dot(planetNormal, viewDirection);
        float rim = 1.0 - clamp(facing, 0.0, 1.0);
        float frontGate = smoothstep(-0.48, 0.24, facing);
        float rimMask = frontGate * smoothstep(0.2, 0.78, rim) * (1.0 - smoothstep(0.99, 1.0, rim));

        vec3 sunDirection = normalize(lightDirection);
        float sunSide = dot(normalize(vWorldNormal), sunDirection);
        float nightMask = 0.16 + 0.84 * (1.0 - smoothstep(-0.08, 0.26, sunSide));

        float latDeg = abs(asin(clamp(vLocalNormal.y, -1.0, 1.0)) * ${RAD_TO_DEG.toFixed(8)});
        float latMask = 1.0 - smoothstep(latHalfWidthDeg, latHalfWidthDeg + 5.4, abs(latDeg - latCenterDeg));
        latMask *= smoothstep(0.18, 0.82, latMask);

        float vertical = vUv.y;
        float lon = vUv.x;
        float root = 1.0 - smoothstep(0.012, 0.18, vertical);
        float topFade = 1.0 - smoothstep(0.52, 0.98, vertical);
        float body = smoothstep(0.05, 0.22, vertical) * topFade;
        float drift = fbm(vec2(lon * 6.0 + time * 0.018, vertical * 2.3)) * 0.075;
        float broad = fbm(vec2(lon * 4.0 + drift + time * 0.018, vertical * 1.7 + 1.7));
        float folds = sin((lon + drift) * 84.0 + fbm(vec2(lon * 16.0, vertical * 5.0 + time * 0.026)) * 3.6);
        float fine = sin((lon - drift * 0.4) * 177.0 + vertical * 6.0 + time * 0.035);
        float strands = pow(clamp(0.52 + folds * 0.34 + fine * 0.11, 0.0, 1.0), 3.2);
        float breakup = smoothstep(0.22, 0.82, fbm(vec2(lon * 38.0 + time * 0.012, vertical * 7.0 + 4.4)));
        float rootBand = root * (0.52 + broad * 0.42);
        float strandColumns = smoothstep(0.34, 0.86, strands * (0.58 + breakup * 0.72) + broad * 0.12);
        float curtain = body * (0.035 + strandColumns * 1.34 + strands * 0.24) * (0.44 + breakup * 0.56);
        float upperMist = smoothstep(0.32, 0.86, vertical) * topFade * fbm(vec2(lon * 11.0 - time * 0.01, vertical * 3.4)) * 0.07;

        float density = latMask * rimMask * nightMask * (rootBand * 0.36 + curtain * 1.42 + upperMist * 0.65);
        float screenX = gl_FragCoord.x / max(screenSize.x, 1.0);
        float moonColumn = 1.0 - smoothstep(0.055, 0.19, abs(screenX - moonColumnCenter));
        density *= mix(1.0, 0.5, moonColumn * moonColumnAvoidance);
        float alpha = density * intensity * 2.25;

        if (alpha < 0.0013) {
          discard;
        }

        vec3 auroraColor = mix(colorA, colorB, smoothstep(0.1, 0.76, vertical));
        auroraColor = mix(auroraColor, vec3(0.58, 0.92, 0.74), rootBand * 0.2 + strands * 0.08);
        auroraColor = mix(auroraColor, vec3(0.34, 0.47, 0.44), smoothstep(0.58, 0.98, vertical) * 0.36);
        vec3 highRed = vec3(0.28, 0.045, 0.035) * smoothstep(0.68, 0.98, vertical) * curtain * 0.025;
        vec3 finalColor = auroraColor * density * (3.1 + strands * 0.58 + rootBand * 0.9) + highRed;

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

export function LandingAuroraOval({
  composition,
  quality,
  sceneLightDirection,
  visibilityBoost = 1,
  moonColumnAvoidance = 0,
  moonColumnCenter = 0.5,
  lowProfile = false,
  reducedMotion,
  paused
}: LandingAuroraOvalProps) {
  const aurora = useRef<Group>(null);
  const { size } = useThree();
  const enabled =
    quality.tier !== "fallback" &&
    quality.aurora &&
    !reducedMotion &&
    composition.aurora.enabled &&
    composition.aurora.intensity > 0 &&
    composition.aurora.sampleCount > 0;
  const oval = useMemo(() => {
    if (!enabled) {
      return null;
    }

    const geometry = createAuroraOvalGeometry(
      composition,
      lowProfile,
      quality.tier === "high" ? 168 : 112,
      quality.tier === "high" ? 20 : 14
    );
    const material = createAuroraOvalMaterial(composition, lowProfile);
    return { geometry, material };
  }, [composition, enabled, lowProfile, quality.tier]);

  useEffect(() => {
    return () => {
      oval?.geometry.dispose();
      oval?.material.dispose();
    };
  }, [oval]);

  useFrame((state) => {
    if (!aurora.current || !oval) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const nearFade = 1 - smoothstep(0.2, 0.62, progress);
    const farFloor = lowProfile ? 0.12 : 0.16;
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    const intensity = composition.aurora.intensity * visibilityBoost * Math.max(farFloor, nearFade);

    oval.material.uniforms.time.value = elapsed;
    oval.material.uniforms.fieldLift.value = smoothstep(0.62, 1, progress) * composition.earth.radius * 0.018;
    oval.material.uniforms.intensity.value = intensity;
    oval.material.uniforms.lightDirection.value.copy(sceneLightDirection).normalize();
    oval.material.uniforms.moonColumnAvoidance.value = moonColumnAvoidance;
    oval.material.uniforms.moonColumnCenter.value = moonColumnCenter;
    oval.material.uniforms.screenSize.value.set(size.width, size.height);
    oval.material.visible = enabled;
  });

  if (!enabled || !oval) {
    return null;
  }

  return (
    <group ref={aurora}>
      <mesh geometry={oval.geometry} material={oval.material} renderOrder={12} />
    </group>
  );
}
