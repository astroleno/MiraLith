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
  reducedMotion?: boolean;
  paused?: boolean;
}

interface RibbonPreset {
  lonCenterDeg: number;
  lonSpanDeg: number;
  latOffsetDeg: number;
  latWaveDeg: number;
  lonWaveDeg: number;
  radialHeight: number;
  phase: number;
  opacity: number;
}

const colorA = new Color();
const colorB = new Color();
const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

const RIBBONS: RibbonPreset[] = [
  {
    lonCenterDeg: 82,
    lonSpanDeg: 132,
    latOffsetDeg: -0.6,
    latWaveDeg: 1.8,
    lonWaveDeg: 7.4,
    radialHeight: 0.044,
    phase: 0.12,
    opacity: 1
  },
  {
    lonCenterDeg: 122,
    lonSpanDeg: 96,
    latOffsetDeg: 2.2,
    latWaveDeg: 1.2,
    lonWaveDeg: 6.2,
    radialHeight: 0.034,
    phase: 1.36,
    opacity: 0.48
  },
  {
    lonCenterDeg: 42,
    lonSpanDeg: 74,
    latOffsetDeg: -3.1,
    latWaveDeg: 1.0,
    lonWaveDeg: 5.4,
    radialHeight: 0.026,
    phase: 2.18,
    opacity: 0.32
  }
];

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
}

function sphericalDirection(latitudeDeg: number, longitudeDeg: number) {
  const phi = ((longitudeDeg + 180) / 360) * TWO_PI;
  const theta = (90 - latitudeDeg) * DEG_TO_RAD;

  return new Vector3(
    -Math.cos(phi) * Math.sin(theta),
    Math.cos(theta),
    Math.sin(phi) * Math.sin(theta)
  );
}

function createRibbonGeometry(
  preset: RibbonPreset,
  latitudeBandDeg: [number, number],
  arcSegments: number,
  heightSegments: number
) {
  const vertexCount = (arcSegments + 1) * (heightSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const bandCenter = (latitudeBandDeg[0] + latitudeBandDeg[1]) * 0.5;
  const bandMin = Math.min(latitudeBandDeg[0], latitudeBandDeg[1]);
  const bandMax = Math.max(latitudeBandDeg[0], latitudeBandDeg[1]);

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const verticalEase = smoothstep(0, 1, v);

    for (let x = 0; x <= arcSegments; x += 1) {
      const u = x / arcSegments;
      const wave = Math.sin(u * Math.PI * 2 + preset.phase);
      const fineWave = Math.sin(u * Math.PI * 7.0 + preset.phase * 1.7) * 0.45;
      const latitude = Math.min(
        bandMax,
        Math.max(bandMin, bandCenter + preset.latOffsetDeg + (wave + fineWave) * preset.latWaveDeg)
      );
      const longitude =
        preset.lonCenterDeg +
        (u - 0.5) * preset.lonSpanDeg +
        Math.sin(u * Math.PI * 3 + preset.phase) * preset.lonWaveDeg * (0.35 + verticalEase * 0.65);
      const normal = sphericalDirection(latitude, longitude);
      const radius = 1.04 + verticalEase * preset.radialHeight;
      const position = normal.clone().multiplyScalar(radius);
      const index = y * (arcSegments + 1) + x;

      positions[index * 3] = position.x;
      positions[index * 3 + 1] = position.y;
      positions[index * 3 + 2] = position.z;
      normals[index * 3] = normal.x;
      normals[index * 3 + 1] = normal.y;
      normals[index * 3 + 2] = normal.z;
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

function createAuroraMaterial(composition: LandingComposition, opacityScale: number, layerSeed: number) {
  colorA.setRGB(...composition.aurora.colorA);
  colorB.setRGB(...composition.aurora.colorB);

  return new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      reveal: { value: 1 },
      intensity: { value: composition.aurora.intensity },
      opacityScale: { value: opacityScale },
      layerSeed: { value: layerSeed },
      noiseScale: { value: composition.aurora.noiseScale },
      noiseSpeed: { value: composition.aurora.noiseSpeed },
      colorA: { value: colorA.clone() },
      colorB: { value: colorB.clone() },
      lightDirection: { value: new Vector3(0, 1, 0) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float reveal;
      uniform float intensity;
      uniform float opacityScale;
      uniform float layerSeed;
      uniform float noiseScale;
      uniform float noiseSpeed;
      uniform vec3 colorA;
      uniform vec3 colorB;
      uniform vec3 lightDirection;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      mat2 mm2(in float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, s, -s, c);
      }

      float tri(in float x) {
        return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
      }

      vec2 tri2(in vec2 p) {
        return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x)));
      }

      float triNoise2d(in vec2 p, float spd) {
        float z = 1.8;
        float z2 = 2.5;
        float rz = 0.0;
        p *= mm2(p.x * 0.06);
        vec2 bp = p;

        for (float i = 0.0; i < 5.0; i += 1.0) {
          vec2 dg = tri2(bp * 1.85) * 0.75;
          dg *= mm2(time * spd + layerSeed * 0.17);
          p -= dg / z2;
          bp *= 1.3;
          z2 *= 0.45;
          z *= 0.42;
          p *= 1.21 + (rz - 1.0) * 0.02;
          rz += tri(p.x + tri(p.y)) * z;
          p *= -mm2(0.3);
        }

        return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = dot(normal, viewDirection);
        float limbGate = 1.0 - smoothstep(0.015, 0.38, abs(facing));
        float ndl = dot(normal, normalize(lightDirection));
        float nightGate = 1.0 - smoothstep(-0.08, 0.34, ndl);
        float twilightGate = 1.0 - smoothstep(0.0, 0.52, abs(ndl));
        float lightGate = 0.52 + max(nightGate, twilightGate * 0.72) * 0.48;
        float verticalFade =
          smoothstep(0.0, 0.08, vUv.y) *
          (1.0 - smoothstep(0.72, 1.0, vUv.y));
        float horizontalFade =
          smoothstep(0.0, 0.16, vUv.x) *
          (1.0 - smoothstep(0.84, 1.0, vUv.x));

        vec2 noiseUv = vec2(
          vUv.x * noiseScale * 4.2 + layerSeed * 3.7,
          vUv.y * 4.8 - time * noiseSpeed * 0.7
        );
        float sheet = triNoise2d(noiseUv, noiseSpeed);
        float strandCell = abs(fract((vUv.x + sheet * 0.08 + layerSeed * 0.07) * 46.0) - 0.5);
        float strand = pow(1.0 - smoothstep(0.016, 0.16, strandCell), 1.45);
        float breakNoise = triNoise2d(vec2(vUv.x * 5.2 + layerSeed * 1.6, 0.42 + layerSeed), 0.0);
        float patchWindow =
          smoothstep(0.0, 0.22, sin((vUv.x + layerSeed * 0.03) * 19.0) * 0.5 + 0.5) *
          smoothstep(0.02, 0.18, breakNoise + strand * 0.16);
        float lowerGlow = (1.0 - smoothstep(0.08, 0.38, vUv.y)) * 0.18;
        float veil = verticalFade * smoothstep(0.025, 0.32, sheet) * (0.18 + strand * 0.52);
        float alpha =
          intensity *
          opacityScale *
          reveal *
          limbGate *
          lightGate *
          horizontalFade *
          patchWindow *
          (lowerGlow + veil * 1.65);

        if (alpha < 0.0012) {
          discard;
        }

        vec3 auroraColor = mix(colorA, colorB, smoothstep(0.15, 0.92, vUv.y));
        auroraColor = mix(auroraColor, vec3(0.5, 0.9, 0.96), strand * 0.12);
        auroraColor *= 0.95 + sheet * 1.05 + strand * 0.34 + lowerGlow * 0.35;
        gl_FragColor = vec4(auroraColor, clamp(alpha, 0.0, 0.18));
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingAurora({ composition, quality, sceneLightDirection, reducedMotion, paused }: LandingAuroraProps) {
  const aurora = useRef<Group>(null);
  const activeRibbonCount = Math.min(RIBBONS.length, Math.max(0, composition.aurora.sampleCount));
  const enabled = quality.aurora && composition.aurora.enabled && composition.aurora.intensity > 0 && activeRibbonCount > 0;
  const geometries = useMemo(
    () => {
      if (!enabled) {
        return [];
      }

      return RIBBONS.slice(0, activeRibbonCount).map((ribbon) =>
        createRibbonGeometry(
          ribbon,
          composition.aurora.latitudeBandDeg,
          Math.max(48, Math.min(112, quality.segments + 16)),
          quality.tier === "high" ? 11 : 7
        )
      );
    },
    [activeRibbonCount, composition.aurora.latitudeBandDeg, enabled, quality.segments, quality.tier]
  );
  const ribbons = useMemo(() => {
    if (!enabled) {
      return [];
    }

    return geometries.map((geometry, index) => {
      const mesh = new Mesh(
        geometry,
        createAuroraMaterial(composition, RIBBONS[index].opacity, RIBBONS[index].phase)
      );
      mesh.renderOrder = 18 + index;
      return mesh;
    });
  }, [composition, enabled, geometries]);

  useFrame((state) => {
    if (!aurora.current) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const reveal = 1 - smoothstep(0.18, 0.55, progress);
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    aurora.current.children.forEach((child, index) => {
      const material = (child as Mesh).material as ShaderMaterial;
      material.uniforms.time.value = elapsed;
      material.uniforms.reveal.value = reveal;
      material.uniforms.intensity.value = composition.aurora.intensity;
      material.uniforms.noiseScale.value = composition.aurora.noiseScale;
      material.uniforms.noiseSpeed.value = composition.aurora.noiseSpeed;
      material.uniforms.lightDirection.value.copy(sceneLightDirection);
      material.visible = enabled && index < activeRibbonCount;
    });

  });

  if (!enabled) {
    return null;
  }

  return (
    <group ref={aurora}>
      {ribbons.map((ribbon, index) => (
        <primitive key={index} object={ribbon} />
      ))}
    </group>
  );
}
