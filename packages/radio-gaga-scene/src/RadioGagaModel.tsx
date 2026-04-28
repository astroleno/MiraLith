"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { Material, Mesh, MeshPhysicalMaterial, Object3D } from "three";
import type { RadioGagaFrame } from "./types";

const RADIO_POSITION: [number, number, number] = [0, -0.2, 0];
const RADIO_SCALE = 3.4;
const ESP32_POSITION: [number, number, number] = [0, -0.08, 0.04];
const ESP32_ROTATION: [number, number, number] = [0, -0.18, 0];
const ESP32_SCALE = 0.92;

interface RadioGagaModelProps {
  frame: RadioGagaFrame;
  onReady?: () => void;
}

const cloneSceneWithMaterials = (scene: Object3D) => {
  const materials: Material[] = [];
  const clone = scene.clone(true);

  clone.traverse((child) => {
    if (child instanceof Mesh) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => {
            const cloneMaterial = material.clone();
            materials.push(cloneMaterial);
            return cloneMaterial;
          })
        : (() => {
            const cloneMaterial = child.material.clone();
            materials.push(cloneMaterial);
            return cloneMaterial;
          })();
    }
  });

  return { materials, scene: clone };
};

const applyOpacity = (materials: Material[], opacity: number) => {
  materials.forEach((material) => {
    material.transparent = opacity < 0.999;
    material.opacity = opacity;
    material.depthWrite = opacity > 0.98;
    material.needsUpdate = true;
  });
};

export function RadioGagaModel({ frame, onReady }: RadioGagaModelProps) {
  const radio = useGLTF("/model/radio_gaga.glb");
  const esp32Gltf = useGLTF("/model/xiaozhi_esp32.glb");
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
  const solidRadio = useMemo(() => cloneSceneWithMaterials(radio.scene), [radio.scene]);
  const ghostRadioScene = useMemo(() => {
    const clone = radio.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = ghostMaterial;
      }
    });
    return clone;
  }, [ghostMaterial, radio.scene]);
  const esp32Model = useMemo(() => cloneSceneWithMaterials(esp32Gltf.scene), [esp32Gltf.scene]);

  useLayoutEffect(() => {
    applyOpacity(solidRadio.materials, frame.radioOpacity);
    applyOpacity(esp32Model.materials, frame.esp32Opacity);
    ghostMaterial.opacity = frame.radioGhostOpacity;
    ghostMaterial.needsUpdate = true;
  }, [
    esp32Model.materials,
    frame.esp32Opacity,
    frame.radioGhostOpacity,
    frame.radioOpacity,
    ghostMaterial,
    solidRadio.materials
  ]);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(
    () => () => {
      solidRadio.materials.forEach((material) => material.dispose());
      esp32Model.materials.forEach((material) => material.dispose());
      ghostMaterial.dispose();
    },
    [esp32Model.materials, ghostMaterial, solidRadio.materials]
  );

  return (
    <group
      position={RADIO_POSITION}
      scale={frame.radioScale * RADIO_SCALE}
      rotation={[0, frame.radioRotationY, 0]}
    >
      <group visible={frame.radioOpacity > 0.01}>
        <primitive object={solidRadio.scene} />
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
        <primitive object={esp32Model.scene} />
      </group>
    </group>
  );
}
