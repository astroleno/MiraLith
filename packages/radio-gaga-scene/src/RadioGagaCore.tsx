"use client";

import type { RadioGagaFrame } from "./types";

interface RadioGagaCoreProps {
  frame: RadioGagaFrame;
  reducedMotion?: boolean;
}

export function RadioGagaCore({ frame, reducedMotion = false }: RadioGagaCoreProps) {
  const scale = reducedMotion ? 1 : 0.96 + frame.signatureMomentProgress * 0.08;

  return (
    <group position={[0, -0.2, 0]} scale={frame.radioScale * 3.4} rotation={[0, frame.radioRotationY, 0]}>
      <group position={[0, -0.08, 0.04]} rotation={[0, -0.18, 0]} scale={0.92 * scale} visible={frame.esp32Opacity > 0.01}>
        <pointLight color="#d9b06a" intensity={frame.coreLightIntensity * 1.35} distance={3.2} />
        <mesh>
          <sphereGeometry args={[0.055, 24, 24]} />
          <meshBasicMaterial color="#d9b06a" transparent opacity={frame.esp32Opacity * 0.72} />
        </mesh>
        {[-0.12, 0, 0.12].map((offset) => (
          <mesh key={offset} position={[offset, -0.1, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.26, 0.006, 0.006]} />
            <meshBasicMaterial color="#9caf88" transparent opacity={frame.esp32Opacity * 0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
