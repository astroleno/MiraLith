"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, Vector3 } from "three";
import type { RadioGagaFrame } from "./types";

const lines = [
  { y: -0.18, width: 0.78, phase: 0 },
  { y: -0.08, width: 0.92, phase: 0.7 },
  { y: 0.02, width: 1.06, phase: 1.3 },
  { y: 0.12, width: 0.84, phase: 1.9 },
  { y: 0.22, width: 0.66, phase: 2.6 }
];

interface RadioGagaVoiceLinesProps {
  frame: RadioGagaFrame;
  reducedMotion?: boolean;
}

export function RadioGagaVoiceLines({ frame, reducedMotion = false }: RadioGagaVoiceLinesProps) {
  const groupRef = useRef<Group>(null);
  const points = useMemo(
    () =>
      lines.map((line) => [
        new Vector3(-line.width / 2, line.y, 0),
        new Vector3(-line.width / 4, line.y + 0.025, 0),
        new Vector3(0, line.y - 0.02, 0),
        new Vector3(line.width / 4, line.y + 0.018, 0),
        new Vector3(line.width / 2, line.y, 0)
      ]),
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) {
      return;
    }
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 1.2) * 0.012;
  });

  return (
    <group ref={groupRef} position={[0.18, -0.02, 0.72]} visible={frame.voiceLinesOpacity > 0.01}>
      {points.map((linePoints, index) => (
        <Line
          key={index}
          points={linePoints}
          color="#f1e4c8"
          transparent
          opacity={frame.voiceLinesOpacity * (1 - index * 0.08)}
          lineWidth={1}
          depthWrite={false}
        />
      ))}
    </group>
  );
}
