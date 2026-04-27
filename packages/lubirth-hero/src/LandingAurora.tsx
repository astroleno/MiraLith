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
  width: number;
  baseY: number;
  baseZ: number;
  lift: number;
  height: number;
  driftX: number;
  phase: number;
  opacity: number;
}

const colorA = new Color();
const colorB = new Color();

const RIBBONS: RibbonPreset[] = [
  {
    width: 1.78,
    baseY: 0.56,
    baseZ: 0.52,
    lift: 0.16,
    height: 0.16,
    driftX: 0.05,
    phase: 0.12,
    opacity: 1
  },
  {
    width: 1.36,
    baseY: 0.63,
    baseZ: 0.45,
    lift: 0.1,
    height: 0.12,
    driftX: 0.035,
    phase: 1.36,
    opacity: 0.72
  },
  {
    width: 0.98,
    baseY: 0.7,
    baseZ: 0.38,
    lift: 0.06,
    height: 0.09,
    driftX: 0.025,
    phase: 2.18,
    opacity: 0.54
  }
];

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
}

function createRibbonGeometry(preset: RibbonPreset, arcSegments: number, heightSegments: number) {
  const vertexCount = (arcSegments + 1) * (heightSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const verticalEase = smoothstep(0, 1, v);

    for (let x = 0; x <= arcSegments; x += 1) {
      const u = x / arcSegments;
      const arc = Math.sin((u - 0.5) * Math.PI);
      const crest = Math.sin(u * Math.PI);
      const ripple = Math.sin(u * Math.PI * 5 + preset.phase) * 0.008;
      const xPos = arc * preset.driftX + Math.sin(u * Math.PI * 2 + preset.phase) * 0.018 * verticalEase;
      const yPos = preset.baseY + crest * preset.lift + ripple + verticalEase * preset.height;
      const zPos =
        preset.baseZ +
        (u - 0.5) * preset.width +
        Math.sin(u * Math.PI * 2 + preset.phase) * 0.035 * verticalEase;
      const position = new Vector3(xPos, yPos, zPos);
      const normal = position.clone().normalize();
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
        float horizonGate = 1.0 - smoothstep(0.16, 0.56, facing);
        float frontGate = smoothstep(-0.22, -0.02, facing);
        float ndl = dot(normal, normalize(lightDirection));
        float nightGate = 1.0 - smoothstep(0.02, 0.38, ndl);
        float twilightGate = 1.0 - smoothstep(0.0, 0.36, abs(ndl));
        float lightGate = 0.62 + max(nightGate, twilightGate * 0.52) * 0.38;
        float verticalFade =
          smoothstep(0.0, 0.06, vUv.y) *
          (1.0 - smoothstep(0.9, 1.0, vUv.y));
        float horizontalFade =
          smoothstep(0.0, 0.08, vUv.x) *
          (1.0 - smoothstep(0.92, 1.0, vUv.x));

        vec2 noiseUv = vec2(
          vUv.x * noiseScale * 2.8 + layerSeed * 3.7,
          vUv.y * 3.4 - time * noiseSpeed * 0.7
        );
        float sheet = triNoise2d(noiseUv, noiseSpeed);
        float strand = 1.0 - smoothstep(
          0.035,
          0.18,
          abs(fract((vUv.x + sheet * 0.11 + layerSeed * 0.07) * 26.0) - 0.5)
        );
        float curtain = (0.16 + smoothstep(0.015, 0.32, sheet) * 0.84) * (0.58 + strand * 0.42);
        float lowerGlow = 1.0 - smoothstep(0.52, 1.0, vUv.y);
        float alpha =
          intensity *
          opacityScale *
          reveal *
          (0.48 + horizonGate * 0.52) *
          (0.68 + frontGate * 0.32) *
          lightGate *
          verticalFade *
          horizontalFade *
          curtain *
          (0.54 + lowerGlow * 0.46);

        if (alpha < 0.0012) {
          discard;
        }

        vec3 auroraColor = mix(colorA, colorB, smoothstep(0.15, 0.92, vUv.y));
        auroraColor = mix(auroraColor, vec3(0.58, 0.84, 1.0), strand * 0.18);
        auroraColor *= 0.74 + sheet * 1.2 + strand * 0.22;
        gl_FragColor = vec4(auroraColor, clamp(alpha, 0.0, 0.22));
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
    () => RIBBONS.map((ribbon) =>
      createRibbonGeometry(
        ribbon,
        Math.max(48, Math.min(112, quality.segments + 16)),
        quality.tier === "high" ? 9 : 6
      )
    ),
    [quality.segments, quality.tier]
  );
  const ribbons = useMemo(() => {
    return geometries.map((geometry, index) => {
      const mesh = new Mesh(
        geometry,
        createAuroraMaterial(composition, RIBBONS[index].opacity, RIBBONS[index].phase)
      );
      mesh.renderOrder = 18 + index;
      return mesh;
    });
  }, [composition, geometries]);

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

    if (paused || reducedMotion) {
      return;
    }

    aurora.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.12) * 0.006;
  });

  if (!enabled) {
    return null;
  }

  return (
    <group ref={aurora} position={[0.48, 0.42, -0.34]} rotation={[0.02, -0.1, -0.06]}>
      {ribbons.map((ribbon, index) => (
        <primitive key={index} object={ribbon} />
      ))}
    </group>
  );
}
