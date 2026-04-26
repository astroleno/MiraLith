"use client";

import { useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  PointsMaterial,
  ShaderMaterial
} from "three";
import type { QualityProfile } from "@miralith/visual-core";

interface LandingSpaceBackgroundProps {
  quality: QualityProfile;
}

function random(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function LandingSpaceBackground({ quality }: LandingSpaceBackgroundProps) {
  const starGeometry = useMemo(() => {
    const count = Math.max(quality.stars, quality.tier === "high" ? 720 : 360);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const u = random(index + 1);
      const v = random(index + 37);
      const theta = u * Math.PI * 2;
      const y = v * 1.55 - 0.24;
      const radius = 36 + random(index + 91) * 10;
      const band = Math.sqrt(Math.max(0.08, 1 - y * y));
      const i3 = index * 3;

      positions[i3] = Math.cos(theta) * band * radius;
      positions[i3 + 1] = y * radius;
      positions[i3 + 2] = Math.sin(theta) * band * radius;

      const cool = 0.72 + random(index + 143) * 0.28;
      const brightness = random(index + 251) > 0.94 ? 1 : 0.42 + random(index + 271) * 0.32;
      colors[i3] = brightness * cool;
      colors[i3 + 1] = brightness * (0.86 + cool * 0.1);
      colors[i3 + 2] = brightness;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    return geometry;
  }, [quality.stars, quality.tier]);

  const starMaterial = useMemo(() => {
    return new PointsMaterial({
      size: quality.tier === "high" ? 0.032 : 0.04,
      sizeAttenuation: true,
      vertexColors: true,
      color: new Color("#d8e8ff"),
      transparent: true,
      opacity: 0.46,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
  }, [quality.tier]);

  const skyMaterial = useMemo(() => {
    return new ShaderMaterial({
      vertexShader: `
        varying vec3 vDir;

        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;

        void main() {
          float upperBlue = smoothstep(-0.22, 0.72, vDir.y);
          float galacticHaze = exp(-pow((vDir.y - 0.18) * 3.2, 2.0)) * 0.42;
          vec3 base = mix(vec3(0.0, 0.002, 0.006), vec3(0.004, 0.018, 0.04), upperBlue);
          base += vec3(0.005, 0.014, 0.026) * galacticHaze;
          gl_FragColor = vec4(base, 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
      depthTest: false
    });
  }, []);

  return (
    <>
      <mesh material={skyMaterial} renderOrder={-60}>
        <sphereGeometry args={[46, 32, 18]} />
      </mesh>
      <points geometry={starGeometry} material={starMaterial} renderOrder={-50} />
    </>
  );
}
