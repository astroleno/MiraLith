"use client";

import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef } from "react";
import { Group, MeshBasicMaterial, PointLight } from "three";
import type { RadioGagaFrame, RadioGagaFrameRef, RadioGagaSceneMotionRef } from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

interface RadioGagaCoreProps {
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  motionRef?: RadioGagaSceneMotionRef;
  reducedMotion?: boolean;
}

export function RadioGagaCore({ frame, frameRef, motionRef, reducedMotion = false }: RadioGagaCoreProps) {
  const rootGroup = useRef<Group>(null);
  const coreGroup = useRef<Group>(null);
  const boardGroup = useRef<Group>(null);
  const coreLight = useRef<PointLight>(null);
  const coreMaterial = useRef<MeshBasicMaterial>(null);
  const boardMaterial = useRef<MeshBasicMaterial>(null);
  const chipMaterial = useRef<MeshBasicMaterial>(null);
  const traceMaterials = useRef<MeshBasicMaterial[]>([]);
  const scale = reducedMotion ? 1 : 0.96 + frame.signatureMomentProgress * 0.08;

  const updateCore = useCallback((nextFrame: RadioGagaFrame) => {
    const nextScale = reducedMotion ? 1 : 0.96 + nextFrame.signatureMomentProgress * 0.08;

    if (rootGroup.current) {
      const motion = motionRef?.current;

      rootGroup.current.scale.setScalar(nextFrame.radioScale * 3.4);
      rootGroup.current.rotation.set(
        motion?.rotationX ?? 0,
        nextFrame.radioRotationY + (motion?.rotationY ?? 0),
        0
      );
    }
    if (coreGroup.current) {
      coreGroup.current.visible = nextFrame.esp32Opacity > 0.01;
      coreGroup.current.position.set(0.06, -0.08 + nextFrame.signatureMomentProgress * 0.1, 0.2);
      coreGroup.current.scale.setScalar(0.86 * nextScale);
    }
    if (boardGroup.current) {
      boardGroup.current.rotation.z = reducedMotion ? 0 : Math.sin(nextFrame.signatureMomentProgress * Math.PI) * 0.025;
    }
    if (coreLight.current) {
      coreLight.current.intensity = nextFrame.coreLightIntensity * 1.35;
    }
    if (coreMaterial.current) {
      coreMaterial.current.opacity = nextFrame.esp32Opacity * 0.78;
    }
    if (boardMaterial.current) {
      boardMaterial.current.opacity = nextFrame.esp32Opacity * 0.42;
    }
    if (chipMaterial.current) {
      chipMaterial.current.opacity = nextFrame.esp32Opacity * 0.66;
    }

    traceMaterials.current.forEach((material, index) => {
      const traceProgress = smooth(clamp01((nextFrame.signatureMomentProgress - index * 0.08) / 0.36));
      material.opacity = nextFrame.esp32Opacity * traceProgress * 0.58;
    });
  }, [motionRef, reducedMotion]);

  useLayoutEffect(() => {
    updateCore(frame);
  }, [frame, updateCore]);

  useFrame(() => {
    updateCore(frameRef?.current ?? frame);
  });

  return (
    <group ref={rootGroup} position={[0.18, -0.32, 0]} scale={frame.radioScale * 3.4} rotation={[0, frame.radioRotationY, 0]}>
      <group ref={coreGroup} position={[0.06, -0.08, 0.2]} rotation={[0, 1.34, 0]} scale={0.86 * scale} visible={frame.esp32Opacity > 0.01}>
        <pointLight ref={coreLight} color="#d9b06a" intensity={frame.coreLightIntensity * 1.35} distance={3.2} />
        <group ref={boardGroup} position={[0, 0, -0.01]}>
          <mesh>
            <boxGeometry args={[0.5, 0.34, 0.018]} />
            <meshBasicMaterial ref={boardMaterial} color="#6f8063" transparent opacity={frame.esp32Opacity * 0.42} />
          </mesh>
          <mesh position={[0.06, 0.01, 0.014]}>
            <boxGeometry args={[0.16, 0.12, 0.018]} />
            <meshBasicMaterial ref={chipMaterial} color="#161d15" transparent opacity={frame.esp32Opacity * 0.66} />
          </mesh>
        </group>
        <mesh>
          <sphereGeometry args={[0.07, 24, 24]} />
          <meshBasicMaterial ref={coreMaterial} color="#d0ad66" transparent opacity={frame.esp32Opacity * 0.78} />
        </mesh>
        {[-0.12, 0, 0.12].map((offset, index) => (
          <mesh key={offset} position={[offset, -0.1, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.32, 0.006, 0.006]} />
            <meshBasicMaterial
              ref={(material) => {
                if (material) {
                  traceMaterials.current[index] = material;
                }
              }}
              color="#aab38a"
              transparent
              opacity={frame.esp32Opacity * smooth(clamp01((frame.signatureMomentProgress - index * 0.08) / 0.36)) * 0.58}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
