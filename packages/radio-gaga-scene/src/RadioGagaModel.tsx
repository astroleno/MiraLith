"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  FrontSide,
  Group,
  LinearFilter,
  Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SRGBColorSpace
} from "three";
import { mapRadioGagaFinalOutput } from "./radioGagaFinalOutput";
import type { RadioGagaFrame, RadioGagaFrameRef, RadioGagaSceneMotionRef } from "./types";

const RADIO_POSITION: [number, number, number] = [0.18, -0.32, 0];
const RADIO_SCALE = 3.14;
const RADIO_START_PITCH = -Math.PI / 6;
const ESP32_START_POSITION: [number, number, number] = [-0.46, -0.1, 0.06];
const ESP32_CORE_POSITION: [number, number, number] = [0, -0.08, 0.06];
const ESP32_ROTATION_START_Y = -2.04;
const ESP32_ROTATION_FINAL_Y = -Math.PI / 2;
const ESP32_SCALE = 1.58;
const ESP32_SCREEN_PATCH_WIDTH = 0.58;
const ESP32_SCREEN_PATCH_HEIGHT = 0.19;
const ESP32_SCREEN_PATCH_POSITION: [number, number, number] = [0.244, -0.19, 0];
const ESP32_SCREEN_PATCH_ROTATION: [number, number, number] = [0, Math.PI / 2, 0];
const SCREEN_SUBTITLE_CANVAS_WIDTH = 1024;
const SCREEN_SUBTITLE_CANVAS_HEIGHT = 320;

interface AnimatedMaterial {
  depthWrite: boolean;
  material: Material;
  opacity: number;
  transparent: boolean;
}

interface CloneSceneOptions {
  forceOpaque?: boolean;
  frontSide?: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

const wrapCanvasText = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) => {
  const hangingPunctuation = new Set(["，", "。", "、", "；", "：", "！", "？", ",", ".", ";", ":", "!", "?"]);
  const glyphs = Array.from(text);
  const lines: string[] = [];
  let currentLine = "";

  glyphs.forEach((glyph) => {
    const nextLine = `${currentLine}${glyph}`;
    if (currentLine && context.measureText(nextLine).width > maxWidth) {
      if (hangingPunctuation.has(glyph)) {
        currentLine = nextLine;
        return;
      }
      lines.push(currentLine);
      currentLine = glyph.trimStart();
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 2);
};

const drawScreenSubtitle = (
  canvas: HTMLCanvasElement,
  text: string,
  isComplete: boolean
) => {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!text) {
    return;
  }

  const centerX = canvas.width / 2;
  const lineHeight = 86;
  const maxTextWidth = canvas.width - 180;

  context.save();
  context.fillStyle = "rgba(24, 24, 22, 0.9)";
  context.font = "700 64px 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lines = wrapCanvasText(context, text, maxTextWidth);
  const firstLineY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    context.fillText(line, centerX, firstLineY + index * lineHeight);
  });

  if (!isComplete) {
    const lastLine = lines[lines.length - 1] ?? "";
    const lastLineWidth = context.measureText(lastLine).width;
    const cursorX = Math.min(centerX + lastLineWidth / 2 + 18, canvas.width - 34);
    const cursorY = firstLineY + Math.max(0, lines.length - 1) * lineHeight - 31;

    context.fillStyle = "rgba(30, 30, 28, 0.58)";
    context.fillRect(cursorX, cursorY, 6, 64);
  }

  context.restore();
};

interface RadioGagaModelProps {
  frame: RadioGagaFrame;
  frameRef?: RadioGagaFrameRef;
  motionRef?: RadioGagaSceneMotionRef;
  onReady?: () => void;
}

const cloneSceneWithMaterials = (scene: Object3D, options: CloneSceneOptions = {}) => {
  const materials: AnimatedMaterial[] = [];
  const clone = scene.clone(true);

  clone.traverse((child) => {
    if (child instanceof Mesh) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => {
            const cloneMaterial = material.clone();
            if (options.frontSide) {
              cloneMaterial.side = FrontSide;
            }
            if (options.forceOpaque) {
              cloneMaterial.transparent = false;
              cloneMaterial.opacity = 1;
              cloneMaterial.depthWrite = true;
            }
            materials.push({
              depthWrite: cloneMaterial.depthWrite,
              material: cloneMaterial,
              opacity: cloneMaterial.opacity,
              transparent: cloneMaterial.transparent
            });
            return cloneMaterial;
          })
        : (() => {
            const cloneMaterial = child.material.clone();
            if (options.frontSide) {
              cloneMaterial.side = FrontSide;
            }
            if (options.forceOpaque) {
              cloneMaterial.transparent = false;
              cloneMaterial.opacity = 1;
              cloneMaterial.depthWrite = true;
            }
            materials.push({
              depthWrite: cloneMaterial.depthWrite,
              material: cloneMaterial,
              opacity: cloneMaterial.opacity,
              transparent: cloneMaterial.transparent
            });
            return cloneMaterial;
          })();
    }
  });

  return { materials, scene: clone };
};

const applyOpacity = (materials: AnimatedMaterial[], opacity: number) => {
  materials.forEach(({ depthWrite, material, opacity: baseOpacity, transparent: baseTransparent }) => {
    const nextOpacity = baseOpacity * opacity;
    const transparent = opacity < 0.999;
    const nextTransparent = baseTransparent || transparent;
    const nextDepthWrite = depthWrite && !nextTransparent;
    const needsMaterialUpdate = material.transparent !== nextTransparent || material.depthWrite !== nextDepthWrite;

    material.transparent = nextTransparent;
    material.opacity = nextOpacity;
    material.depthWrite = nextDepthWrite;

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
  const esp32Group = useRef<Group>(null);
  const finalSubtitleKey = useRef("");
  const finalSubtitleCanvas = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = SCREEN_SUBTITLE_CANVAS_WIDTH;
    canvas.height = SCREEN_SUBTITLE_CANVAS_HEIGHT;
    return canvas;
  }, []);
  const finalSubtitleTexture = useMemo(() => {
    if (!finalSubtitleCanvas) {
      return null;
    }

    const texture = new CanvasTexture(finalSubtitleCanvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [finalSubtitleCanvas]);
  const finalSubtitleMaterial = useMemo(() => {
    if (!finalSubtitleTexture) {
      return null;
    }

    return new MeshBasicMaterial({
      depthTest: true,
      depthWrite: false,
      map: finalSubtitleTexture,
      opacity: 0,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: FrontSide,
      toneMapped: false,
      transparent: true
    });
  }, [finalSubtitleTexture]);
  const solidRadio = useMemo(
    () => cloneSceneWithMaterials(radio.scene, { forceOpaque: true, frontSide: true }),
    [radio.scene]
  );
  const esp32Model = useMemo(() => cloneSceneWithMaterials(esp32Gltf.scene), [esp32Gltf.scene]);

  const updateModel = useCallback((nextFrame: RadioGagaFrame) => {
    const finalVisualOpacity = smooth(range(nextFrame.progress, 0.925, 0.955));
    const esp32SolidPresence = smooth(range(nextFrame.progress, 0.86, 0.925));
    const esp32Presence = Math.max(esp32SolidPresence, finalVisualOpacity);
    const radioVisible = nextFrame.radioOpacity > 0.01;

    applyOpacity(solidRadio.materials, nextFrame.radioOpacity);
    applyOpacity(esp32Model.materials, esp32Presence);

    if (finalSubtitleCanvas && finalSubtitleTexture && finalSubtitleMaterial) {
      const outputState = mapRadioGagaFinalOutput(nextFrame.progress);
      const subtitleKey = `${outputState.activeIndex}:${outputState.displayText}:${outputState.isComplete}`;

      if (finalSubtitleKey.current !== subtitleKey) {
        drawScreenSubtitle(finalSubtitleCanvas, outputState.displayText, outputState.isComplete);
        finalSubtitleTexture.needsUpdate = true;
        finalSubtitleKey.current = subtitleKey;
      }

      finalSubtitleMaterial.opacity = finalVisualOpacity * outputState.subtitleOpacity;
    }

    if (radioGroup.current) {
      const motion = motionRef?.current;
      const radioFrontProgress = smooth(range(nextFrame.progress, 0.045, 0.18));
      const radioParallaxStrength = radioFrontProgress * (1 - smooth(range(nextFrame.progress, 0.17, 0.225)));
      const radioParallaxY = (motion?.rotationY ?? 0) * radioParallaxStrength;
      const parallaxX = radioParallaxY * 0.38;
      const radioPitch = lerp(RADIO_START_PITCH, 0, radioFrontProgress);

      radioGroup.current.position.set(
        RADIO_POSITION[0] + parallaxX,
        RADIO_POSITION[1],
        RADIO_POSITION[2]
      );
      radioGroup.current.scale.setScalar(nextFrame.radioScale * RADIO_SCALE);
      radioGroup.current.rotation.set(
        radioPitch,
        nextFrame.radioRotationY + radioParallaxY,
        0
      );
    }
    if (solidGroup.current) {
      solidGroup.current.visible = radioVisible;
    }
    if (esp32Group.current) {
      const esp32SolidMotion = nextFrame.esp32SolidMotionProgress;
      const esp32Lift = esp32SolidMotion * 0.09;
      const esp32Scale = ESP32_SCALE * (0.92 + esp32SolidMotion * 0.1);
      const esp32CenterProgress = esp32SolidMotion;
      const esp32FrontLock = esp32SolidMotion;
      const esp32ParallaxStrength =
        smooth(range(nextFrame.progress, 0.84, 0.92)) * (1 - esp32FrontLock) * (1 - nextFrame.finalLineOpacity);
      const esp32ParallaxX =
        MathUtils.clamp((motionRef?.current.rotationX ?? 0) * 2.2, -0.16, 0.16) * esp32ParallaxStrength;
      const esp32RotationY =
        ESP32_ROTATION_START_Y + (ESP32_ROTATION_FINAL_Y - ESP32_ROTATION_START_Y) * esp32SolidMotion;

      esp32Group.current.visible = esp32Presence > 0.01;
      esp32Group.current.position.set(
        lerp(ESP32_START_POSITION[0], ESP32_CORE_POSITION[0], esp32CenterProgress),
        lerp(ESP32_START_POSITION[1], ESP32_CORE_POSITION[1], esp32CenterProgress) + esp32Lift - esp32ParallaxX * 0.22,
        lerp(ESP32_START_POSITION[2], ESP32_CORE_POSITION[2], esp32CenterProgress)
      );
      esp32Group.current.rotation.set(esp32ParallaxX, esp32RotationY, 0);
      esp32Group.current.scale.setScalar(esp32Scale);
    }
  }, [
    esp32Model.materials,
    finalSubtitleCanvas,
    finalSubtitleMaterial,
    finalSubtitleTexture,
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
      solidRadio.materials.forEach(({ material }) => material.dispose());
      esp32Model.materials.forEach(({ material }) => material.dispose());
      finalSubtitleMaterial?.dispose();
      finalSubtitleTexture?.dispose();
    },
    [
      esp32Model.materials,
      finalSubtitleMaterial,
      finalSubtitleTexture,
      solidRadio.materials
    ]
  );

  return (
    <>
      <group
        ref={radioGroup}
        position={RADIO_POSITION}
        scale={frame.radioScale * RADIO_SCALE}
        rotation={[RADIO_START_PITCH, frame.radioRotationY, 0]}
      >
        <group ref={solidGroup} visible={frame.radioOpacity > 0.01}>
          <primitive object={solidRadio.scene} />
        </group>
      </group>
      <group
        ref={esp32Group}
        position={ESP32_START_POSITION}
        rotation={[0, ESP32_ROTATION_START_Y, 0]}
        scale={ESP32_SCALE}
        visible={frame.esp32SolidMotionProgress > 0.01 || frame.finalLineOpacity > 0.01}
      >
        <primitive object={esp32Model.scene} />
        {finalSubtitleMaterial ? (
          <mesh
            material={finalSubtitleMaterial}
            position={[ESP32_SCREEN_PATCH_POSITION[0] + 0.003, ESP32_SCREEN_PATCH_POSITION[1], ESP32_SCREEN_PATCH_POSITION[2]]}
            renderOrder={7}
            rotation={ESP32_SCREEN_PATCH_ROTATION}
          >
            <planeGeometry args={[ESP32_SCREEN_PATCH_WIDTH, ESP32_SCREEN_PATCH_HEIGHT]} />
          </mesh>
        ) : null}
      </group>
    </>
  );
}
