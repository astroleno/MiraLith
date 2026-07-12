"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, MathUtils, Vector3 } from "three";
import type { Scene } from "three";
import { RadioGagaModelComposite } from "./RadioGagaModelComposite";
import { RadioGagaParticleTransition } from "./RadioGagaParticleTransition";
import { mapRadioGagaProgress } from "./radioGagaTimeline";
import type { RadioGagaSceneProps } from "./types";

const cameraTarget = new Vector3(0, -0.08, 0);
type SceneEnvironment = Pick<Scene, "background" | "fog">;

export function RadioGagaSceneContent({
  progress,
  progressRef,
  active,
  quality,
  reducedMotion,
  onReady
}: RadioGagaSceneProps) {
  const frame = mapRadioGagaProgress(progressRef?.current ?? progress);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const motionRef = useRef({ rotationX: 0, rotationY: 0 });
  const pointerRef = useRef({ x: 0, y: 0 });
  const readyRef = useRef(false);
  const previousSceneEnvironment = useRef<SceneEnvironment | null>(null);
  const { camera, scene, size } = useThree();
  const backgroundColor = useMemo(() => new Color("#050404"), []);

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

  useEffect(() => {
    if (!active) {
      return;
    }

    const updatePointer = (event: PointerEvent) => {
      pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => window.removeEventListener("pointermove", updatePointer);
  }, [active]);

  useFrame(({ clock }) => {
    if (!active) {
      return;
    }
    const nextFrame = mapRadioGagaProgress(progressRef?.current ?? progress);
    const isMobile = size.width < 720;
    const isShortLandscape = size.height < 520 && size.width > size.height;
    const mobilePullback = isMobile
      ? 1.2 + nextFrame.signatureMomentProgress * 0.64 + nextFrame.finalLineOpacity * 0.36
      : 0;
    const shortLandscapePullback = isShortLandscape ? 0.6 + nextFrame.signatureMomentProgress * 0.22 : 0;
    const careStillness = 1 - nextFrame.signatureMomentProgress * 0.75;
    const finalStillness = 1 - nextFrame.finalLineOpacity * 0.92;
    const motionStrength = reducedMotion || isMobile
      ? 0
      : Math.max(0, careStillness * finalStillness);
    const targetRotationY =
      Math.sin(clock.elapsedTime * 0.55) * 0.016 * motionStrength + pointerRef.current.x * 0.22 * motionStrength;
    const targetRotationX = -pointerRef.current.y * 0.075 * motionStrength;

    frameRef.current = nextFrame;
    motionRef.current.rotationY = MathUtils.lerp(motionRef.current.rotationY, targetRotationY, 0.12);
    motionRef.current.rotationX = MathUtils.lerp(motionRef.current.rotationX, targetRotationX, 0.12);
    camera.position.set(
      isMobile ? -0.08 * nextFrame.finalLineOpacity : 0,
      isMobile ? 0.18 : 0.25,
      nextFrame.cameraZ + mobilePullback + shortLandscapePullback
    );
    camera.lookAt(cameraTarget);
  }, -3);

  if (!active) {
    return null;
  }

  return (
    <>
      <RadioGagaModelComposite
        frame={frame}
        frameRef={frameRef}
        motionRef={motionRef}
        reducedMotion={reducedMotion}
        onReady={handleModelReady}
      />
      <RadioGagaParticleTransition
        frame={frame}
        frameRef={frameRef}
        motionRef={motionRef}
        quality={quality}
        reducedMotion={reducedMotion}
        active={active}
      />
    </>
  );
}
