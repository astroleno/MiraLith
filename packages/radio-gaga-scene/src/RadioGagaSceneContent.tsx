"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, DirectionalLight, Vector3 } from "three";
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
  active,
  reducedMotion,
  onReady
}: RadioGagaSceneProps) {
  const frame = mapRadioGagaProgress(progress);
  const readyRef = useRef(false);
  const keyLight = useRef<DirectionalLight>(null);
  const previousSceneEnvironment = useRef<SceneEnvironment | null>(null);
  const { camera, scene } = useThree();
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

  useFrame(() => {
    if (!active) {
      return;
    }
    camera.position.set(0, 0.25, frame.cameraZ);
    camera.lookAt(cameraTarget);
    if (keyLight.current) {
      keyLight.current.intensity = 0.45 + frame.backgroundWarmth * 0.65;
    }
  }, -1);

  if (!active) {
    return null;
  }

  return (
    <>
      <ambientLight color="#f1e4c8" intensity={0.38} />
      <directionalLight ref={keyLight} color="#d9b06a" position={[2.4, 2.2, 3.4]} intensity={0.8} />
      <RadioGagaModel frame={frame} onReady={handleModelReady} />
      <RadioGagaCore frame={frame} reducedMotion={reducedMotion} />
      <RadioGagaVoiceLines frame={frame} reducedMotion={reducedMotion} />
    </>
  );
}
