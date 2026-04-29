"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Group, Object3D, Vector3 } from "three";
import type { RadioGagaFrame, RadioGagaFrameRef } from "./types";

const lines = [
  { y: -0.18, width: 0.78, phase: 0 },
  { y: -0.08, width: 0.92, phase: 0.7 },
  { y: 0.02, width: 1.06, phase: 1.3 },
  { y: 0.12, width: 0.84, phase: 1.9 },
  { y: 0.22, width: 0.66, phase: 2.6 }
];

interface RadioGagaVoiceLinesProps {
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  reducedMotion?: boolean;
}

interface LineMaterialLike {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

function setLineOpacity(line: Object3D | null | undefined, opacity: number) {
  const material = (line as unknown as { material?: LineMaterialLike } | undefined)?.material;

  if (!material) {
    return;
  }

  material.opacity = opacity;
  material.transparent = opacity < 0.999;
  material.depthWrite = false;
}

export function RadioGagaVoiceLines({ frame, frameRef, reducedMotion = false }: RadioGagaVoiceLinesProps) {
  const groupRef = useRef<Group>(null);
  const lineRefs = useRef<Array<Object3D | null>>([]);
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

  const updateVoiceLines = useCallback((nextFrame: RadioGagaFrame, elapsedTime = 0) => {
    if (!groupRef.current) {
      return;
    }
    const bob = reducedMotion ? 0 : Math.sin(elapsedTime * 1.2) * 0.012;

    groupRef.current.visible = nextFrame.voiceLinesOpacity > 0.01;
    groupRef.current.position.set(0.36, -0.14 + bob, 0.72);
    lineRefs.current.forEach((line, index) => {
      setLineOpacity(line, nextFrame.voiceLinesOpacity * (1 - index * 0.08));
    });
  }, [reducedMotion]);

  useLayoutEffect(() => {
    updateVoiceLines(frame);
  }, [frame, updateVoiceLines]);

  useFrame(({ clock }) => {
    updateVoiceLines(frameRef?.current ?? frame, clock.elapsedTime);
  });

  return (
    <group ref={groupRef} position={[0.36, -0.14, 0.72]} visible={frame.voiceLinesOpacity > 0.01}>
      {points.map((linePoints, index) => (
        <Line
          key={index}
          ref={(line) => {
            lineRefs.current[index] = line;
          }}
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
