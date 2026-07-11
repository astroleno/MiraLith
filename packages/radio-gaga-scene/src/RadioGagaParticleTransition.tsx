"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { Mesh, type BufferAttribute, type Object3D, type Texture, Vector3 } from "three";
import { RadioGagaParticleField } from "./RadioGagaParticleField";
import { resolveRadioGagaParticleBudget } from "./radioGagaParticleBudget";
import { createRadioGagaParticleTargets } from "./radioGagaParticleTargets";
import { RadioGagaProofPlanes } from "./RadioGagaProofPlanes";
import type {
  RadioGagaFrame,
  RadioGagaFrameRef,
  RadioGagaQualityProfile,
  RadioGagaSceneMotionRef
} from "./types";

interface RadioGagaParticleTransitionProps {
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  motionRef?: RadioGagaSceneMotionRef;
  quality: RadioGagaQualityProfile;
  reducedMotion?: boolean;
  active: boolean;
}

function collectSurfacePositions(scene: Object3D) {
  const positions: number[] = [];
  const point = new Vector3();

  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    const positionAttribute = child.geometry.getAttribute("position") as BufferAttribute | undefined;
    if (!positionAttribute) {
      return;
    }

    const indexAttribute = child.geometry.index;
    const count = indexAttribute?.count ?? positionAttribute.count;
    for (let index = 0; index < count; index += 1) {
      const pointIndex = indexAttribute ? indexAttribute.getX(index) : index;
      point.fromBufferAttribute(positionAttribute, pointIndex).applyMatrix4(child.matrixWorld);
      positions.push(point.x, point.y, point.z);
    }
  });

  return new Float32Array(positions);
}

function readTexturePixels(texture: Texture) {
  if (typeof document === "undefined") {
    return new Uint8ClampedArray();
  }

  const image = texture.image as
    | (CanvasImageSource & {
        height?: number;
        naturalHeight?: number;
        naturalWidth?: number;
        videoHeight?: number;
        videoWidth?: number;
        width?: number;
      })
    | undefined;
  const width = Number(image?.width ?? image?.naturalWidth ?? image?.videoWidth ?? 0);
  const height = Number(image?.height ?? image?.naturalHeight ?? image?.videoHeight ?? 0);
  if (!image || width <= 0 || height <= 0) {
    return new Uint8ClampedArray();
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return new Uint8ClampedArray();
  }

  try {
    context.drawImage(image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  } catch {
    return new Uint8ClampedArray();
  }
}

export function RadioGagaParticleTransition({
  frame,
  frameRef,
  motionRef,
  quality,
  reducedMotion = false,
  active
}: RadioGagaParticleTransitionProps) {
  const radio = useGLTF("/model/radio_gaga.glb");
  const esp32 = useGLTF("/model/xiaozhi_esp32.glb");
  const textures = useTexture(["/img/website1.PNG", "/img/website2.png"]) as [Texture, Texture];
  const budget = useMemo(
    () => resolveRadioGagaParticleBudget(quality.tier, reducedMotion),
    [quality.tier, reducedMotion]
  );
  const radioSurface = useMemo(() => collectSurfacePositions(radio.scene), [radio.scene]);
  const esp32Surface = useMemo(() => collectSurfacePositions(esp32.scene), [esp32.scene]);
  const proofOnePixels = useMemo(() => readTexturePixels(textures[0]), [textures]);
  const proofTwoPixels = useMemo(() => readTexturePixels(textures[1]), [textures]);
  const targets = useMemo(
    () =>
      createRadioGagaParticleTargets({
        count: budget.count,
        seed: 20_260_711,
        radioSurface,
        esp32Surface,
        proofOnePixels,
        proofTwoPixels
      }),
    [budget.count, esp32Surface, proofOnePixels, proofTwoPixels, radioSurface]
  );

  if (!active || budget.count === 0) {
    return null;
  }

  return (
    <>
      <RadioGagaProofPlanes active={active} frame={frame} frameRef={frameRef} textures={textures} />
      <RadioGagaParticleField
        active={active}
        frame={frame}
        frameRef={frameRef}
        motionRef={motionRef}
        pointSize={budget.pointSize}
        quality={quality}
        reducedMotion={reducedMotion}
        targets={targets}
      />
    </>
  );
}
