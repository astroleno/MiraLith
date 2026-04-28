"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Mesh, MeshPhysicalMaterial } from "three";
import type { RadioGagaFrame } from "./types";

const RADIO_POSITION: [number, number, number] = [0, -0.2, 0];
const RADIO_SCALE = 3.4;
const ESP32_POSITION: [number, number, number] = [0, -0.08, 0.04];
const ESP32_ROTATION: [number, number, number] = [0, -0.18, 0];
const ESP32_SCALE = 0.92;

interface RadioGagaModelProps {
  frame: RadioGagaFrame;
}

export function RadioGagaModel({ frame }: RadioGagaModelProps) {
  const radio = useGLTF("/model/radio_gaga.glb");
  const esp32 = useGLTF("/model/xiaozhi_esp32.glb");
  const ghostMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: "#d9b06a",
        transparent: true,
        opacity: 0,
        roughness: 0.42,
        metalness: 0,
        transmission: 0.2,
        depthWrite: false
      }),
    []
  );
  ghostMaterial.opacity = frame.radioGhostOpacity;

  const solidRadioScene = useMemo(() => {
    const clone = radio.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = Array.isArray(child.material)
          ? child.material.map((material) => material.clone())
          : child.material.clone();
      }
    });
    return clone;
  }, [radio.scene]);
  const ghostRadioScene = useMemo(() => {
    const clone = radio.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = ghostMaterial;
      }
    });
    return clone;
  }, [ghostMaterial, radio.scene]);
  const esp32Scene = useMemo(() => esp32.scene.clone(true), [esp32.scene]);
  solidRadioScene.traverse((child) => {
    if (child instanceof Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.transparent = frame.radioOpacity < 0.999;
        material.opacity = frame.radioOpacity;
        material.depthWrite = frame.radioOpacity > 0.98;
      });
    }
  });

  return (
    <group
      position={RADIO_POSITION}
      scale={frame.radioScale * RADIO_SCALE}
      rotation={[0, frame.radioRotationY, 0]}
    >
      <group visible={frame.radioOpacity > 0.01}>
        <primitive object={solidRadioScene} />
      </group>
      <group visible={frame.radioGhostOpacity > 0.01}>
        <primitive object={ghostRadioScene} />
      </group>
      <group
        position={ESP32_POSITION}
        rotation={ESP32_ROTATION}
        scale={ESP32_SCALE}
        visible={frame.esp32Opacity > 0.01}
      >
        <primitive object={esp32Scene} />
      </group>
    </group>
  );
}
