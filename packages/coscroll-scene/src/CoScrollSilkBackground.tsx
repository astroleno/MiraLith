"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IUniform } from "three";

interface SilkUniforms {
  uColor: IUniform<THREE.Color>;
  uNoiseIntensity: IUniform<number>;
  uOpacity: IUniform<number>;
  uRotation: IUniform<number>;
  uScale: IUniform<number>;
  uSpeed: IUniform<number>;
  uTime: IUniform<number>;
  [uniform: string]: IUniform;
}

function hexToNormalizedRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255
  ];
}

const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.999, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;
uniform float uOpacity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  gl_FragColor = vec4(col.rgb, uOpacity);
}
`;

export interface CoScrollSilkBackgroundProps {
  active?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  opacity?: number;
  isolateFromTransmission?: boolean;
  onReady?: () => void;
}

export function CoScrollSilkBackground({
  active = true,
  paused = false,
  reducedMotion = false,
  speed = 4.9,
  scale = 1,
  color = "#1f2e38",
  noiseIntensity = 1.3,
  rotation = 2.42,
  opacity = 1,
  isolateFromTransmission = false,
  onReady
}: CoScrollSilkBackgroundProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const readyRef = useRef(false);
  const uniforms = useMemo<SilkUniforms>(
    () => ({
      uColor: { value: new THREE.Color().setRGB(...hexToNormalizedRgb(color)) },
      uNoiseIntensity: { value: noiseIntensity },
      uOpacity: { value: opacity },
      uRotation: { value: rotation },
      uScale: { value: scale },
      uSpeed: { value: speed },
      uTime: { value: 0 }
    }),
    []
  );

  useEffect(() => {
    uniforms.uColor.value.setRGB(...hexToNormalizedRgb(color));
    uniforms.uNoiseIntensity.value = noiseIntensity;
    uniforms.uOpacity.value = opacity;
    uniforms.uRotation.value = rotation;
    uniforms.uScale.value = scale;
    uniforms.uSpeed.value = speed;
  }, [color, noiseIntensity, opacity, rotation, scale, speed, uniforms]);

  useFrame((_state, delta) => {
    if (!active) {
      return;
    }

    const material = meshRef.current?.material as THREE.ShaderMaterial | undefined;
    if (!material) {
      return;
    }

    if (!readyRef.current) {
      readyRef.current = true;
      onReady?.();
    }
    if (paused || reducedMotion) {
      return;
    }

    material.uniforms.uTime.value += 0.1 * delta;
  });

  return (
    <mesh
      ref={meshRef}
      renderOrder={-100}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={isolateFromTransmission || opacity < 1}
        depthTest={isolateFromTransmission}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
