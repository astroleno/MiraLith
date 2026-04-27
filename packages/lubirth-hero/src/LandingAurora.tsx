"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAuroraProps {
  composition: LandingComposition;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
}

function createArcGeometry(width: number, y: number, z: number, lift: number) {
  const points: Vector3[] = [];

  for (let i = 0; i <= 96; i += 1) {
    const t = i / 96;
    const x = Math.sin((t - 0.5) * Math.PI) * 0.035;
    const zPos = z + (t - 0.5) * width;
    const wave = Math.sin(t * Math.PI) * lift + Math.sin(t * Math.PI * 5) * 0.008;
    points.push(new Vector3(x, y + wave, zPos));
  }

  return new BufferGeometry().setFromPoints(points);
}

export function LandingAurora({ composition, quality, reducedMotion, paused }: LandingAuroraProps) {
  const aurora = useRef<Group>(null);
  const opacity = quality.aurora && composition.aurora.enabled ? composition.aurora.intensity : 0;
  const geometries = useMemo(
    () => [
      createArcGeometry(1.55, 0.54, 0.53, 0.16),
      createArcGeometry(1.28, 0.61, 0.48, 0.11),
      createArcGeometry(0.92, 0.69, 0.42, 0.07)
    ],
    []
  );
  const lines = useMemo(() => {
    const materials = [
      new LineBasicMaterial({
        color: "#7fd6a9",
        transparent: true,
        opacity: opacity * 1.65,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false
      }),
      new LineBasicMaterial({
        color: "#9fbf7a",
        transparent: true,
        opacity: opacity * 1.05,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false
      }),
      new LineBasicMaterial({
        color: "#82bfff",
        transparent: true,
        opacity: opacity * 0.76,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false
      })
    ];

    return geometries.map((geometry, index) => {
      const line = new Line(geometry, materials[index]);
      line.renderOrder = 19 + index;
      return line;
    });
  }, [geometries, opacity]);

  useFrame((state) => {
    if (!aurora.current) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const reveal = 1 - Math.min(1, Math.max(0, (progress - 0.18) / 0.37));
    const easedReveal = reveal * reveal * (3 - 2 * reveal);
    const opacityMultipliers = [1.65, 1.05, 0.76];
    aurora.current.children.forEach((child, index) => {
      const material = (child as Line).material as LineBasicMaterial;
      material.opacity = opacity * opacityMultipliers[index] * easedReveal;
    });

    if (paused || reducedMotion) {
      return;
    }

    aurora.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.22) * 0.018;
    aurora.current.position.x = Math.sin(state.clock.elapsedTime * 0.18) * 0.015;
    aurora.current.position.y = Math.sin(state.clock.elapsedTime * 0.26) * 0.01;
  });

  return (
    <group ref={aurora} position={[0.5, 0.38, -0.3]} rotation={[0.02, -0.1, -0.06]}>
      <primitive object={lines[0]} />
      <primitive object={lines[1]} />
      <primitive object={lines[2]} />
    </group>
  );
}
