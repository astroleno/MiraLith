"use client";

import { useMemo } from "react";

interface Stratum {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  color: string;
}

export function CoScrollMineralField({ intensity = 1 }: { intensity?: number }) {
  const strata = useMemo<Stratum[]>(
    () =>
      Array.from({ length: 26 }, (_, index) => {
        const band = index - 13;
        const phase = index * 1.618;

        return {
          x: Math.sin(phase) * 3.8,
          y: band * 0.28 + Math.cos(phase * 0.7) * 0.08,
          z: -4.2 - (index % 5) * 0.08,
          width: 7.5 + (index % 4) * 1.4,
          height: 0.015 + (index % 3) * 0.006,
          rotation: -0.18 + Math.sin(phase * 0.42) * 0.08,
          opacity: (0.08 + (index % 5) * 0.018) * intensity,
          color: index % 4 === 0 ? "#c7b06b" : index % 3 === 0 ? "#18231f" : "#070707"
        };
      }),
    [intensity]
  );

  return (
    <group renderOrder={-20}>
      <mesh position={[0, 0, -4.8]} rotation={[0, 0, 0]}>
        <planeGeometry args={[18, 10]} />
        <meshBasicMaterial color="#010205" toneMapped={false} />
      </mesh>
      {strata.map((stratum, index) => (
        <mesh
          key={`${stratum.color}-${index}`}
          position={[stratum.x, stratum.y, stratum.z]}
          rotation={[0, 0, stratum.rotation]}
          renderOrder={-10 + index}
        >
          <planeGeometry args={[stratum.width, stratum.height]} />
          <meshBasicMaterial
            color={stratum.color}
            transparent
            opacity={stratum.opacity}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
