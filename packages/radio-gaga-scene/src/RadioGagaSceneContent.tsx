"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, DirectionalLight, MathUtils, Vector3 } from "three";
import type { Scene } from "three";
import { mapRadioGagaProgress } from "./radioGagaTimeline";
import { RadioGagaCore } from "./RadioGagaCore";
import { RadioGagaModel } from "./RadioGagaModel";
import { RadioGagaVoiceLines } from "./RadioGagaVoiceLines";
import type { RadioGagaSceneProps } from "./types";

const cameraTarget = new Vector3(0, -0.08, 0);
type SceneEnvironment = Pick<Scene, "background" | "fog">;

export function RadioGagaSceneContent({
  progress,
  progressRef,
  active,
  reducedMotion,
  onReady
}: RadioGagaSceneProps) {
  const frame = mapRadioGagaProgress(progressRef?.current ?? progress);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const motionRef = useRef({ rotationX: 0, rotationY: 0 });
  const readyRef = useRef(false);
  const keyLight = useRef<DirectionalLight>(null);
  const openingFill = useRef<DirectionalLight>(null);
  const previousSceneEnvironment = useRef<SceneEnvironment | null>(null);
  const { camera, scene, size } = useThree();
  const backgroundColor = useMemo(() => new Color("#050302"), []);

  const handleModelReady = useCallback(() => {
    if (readyRef.current) {
      return;
    }
    readyRef.current = true;
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    if (!active) {
      return;
    }
    previousSceneEnvironment.current = {
      background: scene.background,
      fog: scene.fog
    };
    scene.background = backgroundColor;
    scene.fog = null;

    return () => {
      if (!previousSceneEnvironment.current) {
        return;
      }
      scene.background = previousSceneEnvironment.current.background;
      scene.fog = previousSceneEnvironment.current.fog;
      previousSceneEnvironment.current = null;
    };
  }, [active, backgroundColor, scene]);

  useFrame(({ clock, pointer }) => {
    if (!active) {
      return;
    }
    const nextFrame = mapRadioGagaProgress(progressRef?.current ?? progress);
    const isMobile = size.width < 720;
    const isShortLandscape = size.height < 520 && size.width > size.height;
    const mobilePullback = isMobile
      ? 1.2 + nextFrame.signatureMomentProgress * 0.64 + nextFrame.finalLineOpacity * 0.36
      : 0;
    const motionStrength = reducedMotion || isMobile
      ? 0
      : (0.35 + (1 - nextFrame.signatureMomentProgress) * 0.65) * (1 - nextFrame.finalLineOpacity * 0.2);
    const targetRotationY =
      Math.sin(clock.elapsedTime * 0.55) * 0.018 * motionStrength + pointer.x * 0.045 * motionStrength;
    const targetRotationX = -pointer.y * 0.018 * motionStrength;

    frameRef.current = nextFrame;
    motionRef.current.rotationY = MathUtils.lerp(motionRef.current.rotationY, targetRotationY, 0.08);
    motionRef.current.rotationX = MathUtils.lerp(motionRef.current.rotationX, targetRotationX, 0.08);
    camera.position.set(
      isMobile ? -0.08 * nextFrame.finalLineOpacity : 0,
      isMobile ? 0.18 : 0.25,
      nextFrame.cameraZ + mobilePullback + (isShortLandscape ? 0.5 : 0)
    );
    camera.lookAt(cameraTarget);
    if (keyLight.current) {
      keyLight.current.intensity = 0.45 + nextFrame.backgroundWarmth * 0.65;
    }
    if (openingFill.current) {
      openingFill.current.intensity = 0.14 * (1 - nextFrame.signatureMomentProgress);
    }
  }, -1);

  if (!active) {
    return null;
  }

  return (
    <>
      <ambientLight color="#f1e4c8" intensity={0.38} />
      <directionalLight ref={keyLight} color="#d9b06a" position={[2.4, 2.2, 3.4]} intensity={0.8} />
      <directionalLight ref={openingFill} color="#f3c884" position={[-2.2, 1.3, 2.8]} intensity={0.14} />
      <RadioGagaModel frame={frame} frameRef={frameRef} motionRef={motionRef} onReady={handleModelReady} />
      <RadioGagaCore frame={frame} frameRef={frameRef} motionRef={motionRef} reducedMotion={reducedMotion} />
      <RadioGagaVoiceLines frame={frame} frameRef={frameRef} reducedMotion={reducedMotion} />
    </>
  );
}
