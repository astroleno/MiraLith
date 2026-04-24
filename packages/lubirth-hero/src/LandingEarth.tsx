"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, MathUtils, Mesh, MeshStandardMaterial } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";
import { createEarthTexture } from "./textures";

interface LandingEarthProps {
  composition: LandingComposition;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
}

export function LandingEarth({ composition, quality, reducedMotion, paused }: LandingEarthProps) {
  const earth = useRef<Mesh>(null);
  const earthTexture = useMemo(() => createEarthTexture(quality.tier === "high" ? 1024 : 512), [quality.tier]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        map: earthTexture,
        roughness: 0.84,
        metalness: 0.08,
        emissive: new Color("#07131d"),
        emissiveIntensity: 0.22
      }),
    [earthTexture]
  );

  useFrame((_state, delta) => {
    if (!earth.current || paused || !composition.motion.autoRotate) {
      return;
    }

    const rotationSpeed = reducedMotion ? 0.004 : MathUtils.degToRad(composition.earth.rotationSpeedDegPerSec);
    earth.current.rotation.y += rotationSpeed * delta;
    earth.current.rotation.x = -0.12;
  });

  return (
    <mesh ref={earth} material={material}>
      <sphereGeometry args={[composition.earth.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
