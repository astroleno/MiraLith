"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, DirectionalLight, MathUtils, Quaternion, Vector3 } from "three";
import type { Scene } from "three";
import { RadioGagaParticleTransition } from "./RadioGagaParticleTransition";
import { mapRadioGagaProgress } from "./radioGagaTimeline";
import { RadioGagaModel } from "./RadioGagaModel";
import type { RadioGagaSceneProps } from "./types";

const cameraTarget = new Vector3(0, -0.08, 0);
declare global {
  interface Window {
    __MiraLithRadioSceneEnvironmentActive?: boolean;
  }
}

interface SceneEnvironment extends Pick<Scene, "background" | "fog"> {
  cameraPosition: Vector3;
  cameraQuaternion: Quaternion;
  cameraUp: Vector3;
}

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
  const keyLight = useRef<DirectionalLight>(null);
  const openingFill = useRef<DirectionalLight>(null);
  const rimLight = useRef<DirectionalLight>(null);
  const frontSoftbox = useRef<DirectionalLight>(null);
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
      fog: scene.fog,
      cameraPosition: camera.position.clone(),
      cameraQuaternion: camera.quaternion.clone(),
      cameraUp: camera.up.clone()
    };
    scene.background = backgroundColor;
    scene.fog = null;
    if (typeof window !== "undefined") {
      window.__MiraLithRadioSceneEnvironmentActive = true;
    }

    return () => {
      if (!previousSceneEnvironment.current) {
        return;
      }
      scene.background = previousSceneEnvironment.current.background;
      scene.fog = previousSceneEnvironment.current.fog;
      camera.position.copy(previousSceneEnvironment.current.cameraPosition);
      camera.quaternion.copy(previousSceneEnvironment.current.cameraQuaternion);
      camera.up.copy(previousSceneEnvironment.current.cameraUp);
      camera.updateMatrixWorld();
      previousSceneEnvironment.current = null;
      if (typeof window !== "undefined") {
        window.__MiraLithRadioSceneEnvironmentActive = false;
      }
    };
  }, [active, backgroundColor, camera, scene]);

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
    const esp32SolidPresence = MathUtils.smoothstep(nextFrame.progress, 0.805, 0.85);
    const esp32LightPresence = Math.max(nextFrame.esp32Opacity, esp32SolidPresence, nextFrame.esp32SolidMotionProgress);
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
    if (keyLight.current) {
      keyLight.current.intensity = 1.08 + nextFrame.backgroundWarmth * 0.42;
    }
    if (openingFill.current) {
      openingFill.current.intensity =
        0.46 * (1 - nextFrame.signatureMomentProgress * 0.24) + nextFrame.finalLineOpacity * 0.18;
    }
    if (rimLight.current) {
      rimLight.current.intensity = 0.22 + nextFrame.signatureMomentProgress * 0.08 + nextFrame.finalLineOpacity * 0.08;
    }
    if (frontSoftbox.current) {
      frontSoftbox.current.intensity = 0.42 + esp32LightPresence * 0.24 + nextFrame.finalLineOpacity * 0.18;
    }
  }, -1);

  if (!active) {
    return null;
  }

  return (
    <group visible={active} userData={{ sceneId: "radio-gaga", active }}>
      <ambientLight color="#f3f3ef" intensity={0.68} />
      <directionalLight ref={keyLight} color="#fffaf0" position={[2.4, 2.6, 3.8]} intensity={1.08} />
      <directionalLight ref={openingFill} color="#e7eefc" position={[-2.6, 1.7, 3.2]} intensity={0.46} />
      <directionalLight ref={rimLight} color="#f5d8c8" position={[-3.2, 1.6, -1.8]} intensity={0.22} />
      <directionalLight ref={frontSoftbox} color="#ffffff" position={[0.2, 1.4, 4.6]} intensity={0.42} />
      <RadioGagaModel frame={frame} frameRef={frameRef} motionRef={motionRef} onReady={handleModelReady} />
      <RadioGagaParticleTransition
        frame={frame}
        frameRef={frameRef}
        motionRef={motionRef}
        quality={quality}
        reducedMotion={reducedMotion}
        active={active}
      />
    </group>
  );
}
