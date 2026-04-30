"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Group, Material, Mesh, MeshPhysicalMaterial, Object3D } from "three";
import type { RadioGagaFrame, RadioGagaFrameRef, RadioGagaSceneMotionRef } from "./types";

const RADIO_POSITION: [number, number, number] = [0.18, -0.32, 0];
const RADIO_SCALE = 3.4;
const ESP32_POSITION: [number, number, number] = [0, -0.08, 0.04];
const ESP32_ROTATION: [number, number, number] = [0, 1.34, 0];
const ESP32_SCALE = 0.92;

interface RadioGagaModelProps {
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  motionRef?: RadioGagaSceneMotionRef;
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
    const transparent = opacity < 0.999;
    const depthWrite = opacity > 0.98;
    const needsMaterialUpdate = material.transparent !== transparent || material.depthWrite !== depthWrite;

    material.transparent = transparent;
    material.opacity = opacity;
    material.depthWrite = depthWrite;

    if (needsMaterialUpdate) {
      material.needsUpdate = true;
    }
  });
};

export function RadioGagaModel({ frame, frameRef, motionRef, onReady }: RadioGagaModelProps) {
  const radio = useGLTF("/model/radio_gaga.glb");
  const esp32Gltf = useGLTF("/model/xiaozhi_esp32.glb");
  const radioGroup = useRef<Group>(null);
  const solidGroup = useRef<Group>(null);
  const ghostGroup = useRef<Group>(null);
  const esp32Group = useRef<Group>(null);
  const ghostMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: "#d9b06a",
        transparent: true,
        opacity: 0,
        roughness: 0.58,
        metalness: 0,
        transmission: 0.12,
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

  const updateModel = useCallback((nextFrame: RadioGagaFrame) => {
    applyOpacity(solidRadio.materials, nextFrame.radioOpacity);
    applyOpacity(esp32Model.materials, nextFrame.esp32Opacity);
    ghostMaterial.opacity = nextFrame.radioGhostOpacity;

    if (radioGroup.current) {
      const motion = motionRef?.current;

      radioGroup.current.scale.setScalar(nextFrame.radioScale * RADIO_SCALE);
      radioGroup.current.rotation.set(
        motion?.rotationX ?? 0,
        nextFrame.radioRotationY + (motion?.rotationY ?? 0),
        0
      );
    }
    if (solidGroup.current) {
      solidGroup.current.visible = nextFrame.radioOpacity > 0.01;
    }
    if (ghostGroup.current) {
      ghostGroup.current.visible = nextFrame.radioGhostOpacity > 0.01;
    }
    if (esp32Group.current) {
      const esp32Lift = nextFrame.signatureMomentProgress * 0.1;

      esp32Group.current.visible = nextFrame.esp32Opacity > 0.01;
      esp32Group.current.position.set(ESP32_POSITION[0] + 0.04, ESP32_POSITION[1] + esp32Lift, ESP32_POSITION[2] + 0.08);
      esp32Group.current.scale.setScalar(ESP32_SCALE * (0.86 + nextFrame.signatureMomentProgress * 0.16));
    }
  }, [
    esp32Model.materials,
    ghostMaterial,
    motionRef,
    solidRadio.materials
  ]);

  useLayoutEffect(() => {
    updateModel(frame);
  }, [frame, updateModel]);

  useFrame(() => {
    updateModel(frameRef?.current ?? frame);
  });

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
      ref={radioGroup}
      position={RADIO_POSITION}
      scale={frame.radioScale * RADIO_SCALE}
      rotation={[0, frame.radioRotationY, 0]}
    >
      <group ref={solidGroup} visible={frame.radioOpacity > 0.01}>
        <primitive object={solidRadio.scene} />
      </group>
      <group ref={ghostGroup} visible={frame.radioGhostOpacity > 0.01}>
        <primitive object={ghostRadioScene} />
      </group>
      <group
        ref={esp32Group}
        position={[ESP32_POSITION[0] + 0.04, ESP32_POSITION[1], ESP32_POSITION[2] + 0.08]}
        rotation={ESP32_ROTATION}
        scale={ESP32_SCALE}
        visible={frame.esp32Opacity > 0.01}
      >
        <primitive object={esp32Model.scene} />
      </group>
    </group>
  );
}
