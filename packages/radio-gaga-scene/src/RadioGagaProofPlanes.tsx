"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Mesh, MeshBasicMaterial, SRGBColorSpace, type Texture } from "three";
import type { RadioGagaFrame, RadioGagaFrameRef } from "./types";

export const RADIO_GAGA_PROOF_ASPECT = 2.15;
export const RADIO_GAGA_PROOF_WIDTH = 2.72;
export const RADIO_GAGA_PROOF_HEIGHT = RADIO_GAGA_PROOF_WIDTH / RADIO_GAGA_PROOF_ASPECT;
export const RADIO_GAGA_PROOF_POSITION = [-0.16, 0.16, 0.2] as const;

interface RadioGagaProofPlanesProps {
  active: boolean;
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  textures: readonly [Texture, Texture];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function RadioGagaProofPlanes({ active, frame, frameRef, textures }: RadioGagaProofPlanesProps) {
  const firstRef = useRef<Mesh>(null);
  const secondRef = useRef<Mesh>(null);
  const materials = useMemo(
    () =>
      textures.map((texture) => {
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        return new MeshBasicMaterial({
          depthTest: true,
          depthWrite: false,
          map: texture,
          opacity: 0,
          toneMapped: false,
          transparent: true
        });
      }) as [MeshBasicMaterial, MeshBasicMaterial],
    [textures]
  );

  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  useFrame(() => {
    if (!active) {
      materials[0].opacity = 0;
      materials[1].opacity = 0;
      if (firstRef.current) firstRef.current.visible = false;
      if (secondRef.current) secondRef.current.visible = false;
      return;
    }

    const nextFrame = frameRef?.current ?? frame;
    const proofSwitch = smooth(range(nextFrame.progress, 0.43, 0.54));
    const proofOpacity =
      nextFrame.particleOpacity *
      smooth(range(nextFrame.progress, 0.3, 0.36)) *
      (1 - smooth(range(nextFrame.progress, 0.62, 0.7))) *
      0.92;
    const firstOpacity = proofOpacity * (1 - proofSwitch);
    const secondOpacity = proofOpacity * proofSwitch;

    materials[0].opacity = firstOpacity;
    materials[1].opacity = secondOpacity;
    if (firstRef.current) firstRef.current.visible = firstOpacity > 0.01;
    if (secondRef.current) secondRef.current.visible = secondOpacity > 0.01;
  });

  return (
    <>
      <mesh
        ref={firstRef}
        material={materials[0]}
        position={[RADIO_GAGA_PROOF_POSITION[0], RADIO_GAGA_PROOF_POSITION[1], RADIO_GAGA_PROOF_POSITION[2] - 0.018]}
        renderOrder={3}
        visible={false}
      >
        <planeGeometry args={[RADIO_GAGA_PROOF_WIDTH, RADIO_GAGA_PROOF_HEIGHT]} />
      </mesh>
      <mesh
        ref={secondRef}
        material={materials[1]}
        position={[RADIO_GAGA_PROOF_POSITION[0], RADIO_GAGA_PROOF_POSITION[1], RADIO_GAGA_PROOF_POSITION[2] - 0.018]}
        renderOrder={3}
        visible={false}
      >
        <planeGeometry args={[RADIO_GAGA_PROOF_WIDTH, RADIO_GAGA_PROOF_HEIGHT]} />
      </mesh>
    </>
  );
}
