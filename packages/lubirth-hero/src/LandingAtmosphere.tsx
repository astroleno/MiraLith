"use client";

import { useMemo } from "react";
import { AdditiveBlending, BackSide, MeshBasicMaterial } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAtmosphereProps {
  composition: LandingComposition;
  quality: QualityProfile;
}

export function LandingAtmosphere({ composition, quality }: LandingAtmosphereProps) {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#9fc8d2",
        transparent: true,
        opacity: composition.atmosphere.enabled
          ? quality.tier === "low"
            ? 0.08
            : composition.atmosphere.intensity
          : 0,
        blending: AdditiveBlending,
        side: BackSide,
        depthWrite: false
      }),
    [composition.atmosphere.enabled, composition.atmosphere.intensity, quality.tier]
  );

  return (
    <>
      <mesh material={material} scale={1.055}>
        <sphereGeometry args={[composition.earth.radius, quality.segments, quality.segments]} />
      </mesh>
      <mesh rotation={[Math.PI / 2.12, 0.18, -0.5]}>
        <torusGeometry args={[composition.earth.radius * 1.04, 0.006, 8, 160]} />
        <meshBasicMaterial
          color="#c4a35f"
          transparent
          opacity={composition.atmosphere.karmanGlow ? composition.atmosphere.nearStrength : 0}
          blending={AdditiveBlending}
        />
      </mesh>
    </>
  );
}
