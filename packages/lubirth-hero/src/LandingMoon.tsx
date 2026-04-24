"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { EarthMoonHeroMode, LandingComposition } from "./types";
import { createMoonTexture } from "./textures";

interface LandingMoonProps {
  mode: EarthMoonHeroMode;
  composition: LandingComposition;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
  position: Vector3;
}

const targetScale = new Vector3();

export function LandingMoon({ mode, composition, quality, reducedMotion, paused, position }: LandingMoonProps) {
  const moon = useRef<Mesh>(null);
  const moonTexture = useMemo(() => createMoonTexture(quality.tier === "high" ? 512 : 256), [quality.tier]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        map: moonTexture,
        roughness: 0.92,
        metalness: 0,
        emissive: new Color("#2c2a24"),
        emissiveIntensity: 0.16
      }),
    [moonTexture]
  );

  useFrame((_state, delta) => {
    if (!moon.current) {
      return;
    }

    moon.current.position.lerp(position, 0.08);
    const scale = mode === "expanded" ? 1.12 : 1;
    moon.current.scale.lerp(targetScale.set(scale, scale, scale), 0.08);

    if (!paused && !reducedMotion) {
      moon.current.rotation.y += delta * 0.018;
    }
  });

  if (!composition.moon.visible) {
    return null;
  }

  return (
    <mesh ref={moon} material={material}>
      <sphereGeometry args={[composition.moon.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
