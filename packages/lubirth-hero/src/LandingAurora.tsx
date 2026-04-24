"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Mesh, MeshBasicMaterial } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAuroraProps {
  composition: LandingComposition;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
}

export function LandingAurora({ composition, quality, reducedMotion, paused }: LandingAuroraProps) {
  const auroraNorth = useRef<Mesh>(null);
  const auroraSouth = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#76a99b",
        transparent: true,
        opacity: quality.aurora && composition.aurora.enabled ? composition.aurora.intensity : 0,
        blending: AdditiveBlending,
        depthWrite: false
      }),
    [composition.aurora.enabled, composition.aurora.intensity, quality.aurora]
  );
  const southMaterial = useMemo(() => material.clone(), [material]);

  useFrame((state, delta) => {
    if (!auroraNorth.current || !auroraSouth.current || paused || reducedMotion) {
      return;
    }

    auroraNorth.current.rotation.z += delta * composition.aurora.noiseSpeed;
    auroraSouth.current.rotation.z -= delta * composition.aurora.noiseSpeed * 0.8;
    const pulse = 0.65 + Math.sin(state.clock.elapsedTime * 0.8) * 0.18;
    auroraNorth.current.scale.setScalar(pulse);
    auroraSouth.current.scale.setScalar(0.78 + pulse * 0.22);
  });

  return (
    <>
      <mesh ref={auroraNorth} position={[0.08, composition.earth.radius * 0.62, 0.1]} rotation={[1.28, 0.1, 0.2]}>
        <torusGeometry args={[composition.earth.radius * 0.54, 0.012, 10, 120]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh ref={auroraSouth} position={[-0.08, -composition.earth.radius * 0.6, -0.05]} rotation={[1.82, -0.2, -0.1]}>
        <torusGeometry args={[composition.earth.radius * 0.48, 0.01, 10, 120]} />
        <primitive object={southMaterial} attach="material" />
      </mesh>
    </>
  );
}
