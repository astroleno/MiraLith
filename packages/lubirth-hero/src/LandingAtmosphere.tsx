"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  OneFactor,
  Quaternion,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAtmosphereProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
}

const parentQuaternion = new Quaternion();
const cameraLocalQuaternion = new Quaternion();
const lightDirection = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createHorizonRibbonGeometry(radius: number, width: number, arcSegments: number, radialSegments: number) {
  const vertexCount = (arcSegments + 1) * (radialSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const startAngle = Math.PI * 0.012;
  const endAngle = Math.PI * 0.988;

  for (let y = 0; y <= radialSegments; y += 1) {
    const v = y / radialSegments;
    const r = radius + width * v;

    for (let x = 0; x <= arcSegments; x += 1) {
      const u = x / arcSegments;
      const angle = startAngle + (endAngle - startAngle) * u;
      const index = y * (arcSegments + 1) + x;

      positions[index * 3] = Math.cos(angle) * r;
      positions[index * 3 + 1] = Math.sin(angle) * r;
      positions[index * 3 + 2] = 0;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }
  }

  for (let y = 0; y < radialSegments; y += 1) {
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
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createHorizonRibbonMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      closeStage: { value: 1 },
      intensity: { value: composition.atmosphere.intensity },
      lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
      white: { value: new Color(0.9, 0.98, 1.0) },
      blue: { value: new Color(0.2, 0.56, 0.94) },
      mist: { value: new Color(0.025, 0.14, 0.42) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vArcNormal;

      void main() {
        vUv = uv;
        vArcNormal = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float closeStage;
      uniform float intensity;
      uniform vec3 lightDir;
      uniform vec3 white;
      uniform vec3 blue;
      uniform vec3 mist;

      varying vec2 vUv;
      varying vec3 vArcNormal;

      void main() {
        float u = vUv.x;
        float r = vUv.y;
        float arc = pow(max(sin(u * 3.14159265359), 0.0), 0.48);
        arc *= smoothstep(0.0, 0.045, u) * (1.0 - smoothstep(0.955, 1.0, u));

        float close = 0.68 + 0.32 * smoothstep(0.0, 0.94, closeStage);
        float sun = dot(normalize(vArcNormal), normalize(lightDir));
        float daySide = 0.72 + 0.28 * smoothstep(-0.34, 0.28, sun);

        float whiteNeedle = 1.0 - smoothstep(0.0, 0.024, r);
        whiteNeedle *= 1.0 - smoothstep(0.034, 0.052, r);

        float blueBand =
          smoothstep(0.018, 0.058, r) *
          (1.0 - smoothstep(0.13, 0.22, r));

        float outerMist =
          smoothstep(0.12, 0.28, r) *
          (1.0 - smoothstep(0.74, 1.0, r));
        outerMist *= 0.74 + 0.26 * sin(u * 18.8495559 + closeStage * 0.7);

        vec3 color =
          white * whiteNeedle * 1.04 +
          blue * blueBand * 0.62 +
          mist * outerMist * 0.5;
        float alpha =
          whiteNeedle * 0.25 +
          blueBand * 0.095 +
          outerMist * 0.026;
        alpha *= arc * close * daySide * intensity;

        if (alpha < 0.002) {
          discard;
        }

        gl_FragColor = vec4(min(color * close * daySide * intensity, vec3(0.96)), clamp(alpha, 0.0, 0.32));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false
  });
}

export function LandingAtmosphere({ composition, quality, sceneLightDirection }: LandingAtmosphereProps) {
  const ribbon = useRef<Group>(null);
  const { camera } = useThree();
  const material = useMemo(() => createHorizonRibbonMaterial(composition), [composition]);
  const geometry = useMemo(
    () => createHorizonRibbonGeometry(
      composition.earth.radius * 1.001,
      composition.earth.radius * 0.064,
      quality.tier === "low" ? 128 : 176,
      quality.tier === "low" ? 10 : 14
    ),
    [composition.earth.radius, quality.tier]
  );

  useFrame(() => {
    if (!ribbon.current) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    const parent = ribbon.current.parent;
    if (parent) {
      parent.getWorldQuaternion(parentQuaternion);
      cameraLocalQuaternion.copy(parentQuaternion).invert().multiply(camera.quaternion);
      ribbon.current.quaternion.copy(cameraLocalQuaternion);
    } else {
      ribbon.current.quaternion.copy(camera.quaternion);
    }

    if (sceneLightDirection) {
      material.uniforms.lightDir.value.copy(sceneLightDirection).normalize();
    } else {
      material.uniforms.lightDir.value.set(...composition.light.fixedSunDir).normalize();
    }
    material.uniforms.closeStage.value = closeStage;
    material.uniforms.intensity.value = composition.atmosphere.enabled ? composition.atmosphere.intensity : 0;
  });

  if (!composition.atmosphere.enabled) {
    return null;
  }

  return (
    <group ref={ribbon} renderOrder={14}>
      <mesh geometry={geometry} material={material} renderOrder={14} />
    </group>
  );
}
