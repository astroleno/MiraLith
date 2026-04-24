"use client";

import { Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, Group, Vector3 } from "three";
import {
  getRuntimeOpeningProgress,
  mapOpeningProgress
} from "@miralith/visual-core";
import { LandingAtmosphere } from "./LandingAtmosphere";
import { LandingAurora } from "./LandingAurora";
import { LandingEarth } from "./LandingEarth";
import { LandingMoon } from "./LandingMoon";
import type { EarthMoonSceneProps } from "./types";

const cameraTarget = new Vector3(0, 0.04, 0);
const nextCameraPosition = new Vector3();
const earthTargetPosition = new Vector3();
const earthTargetScale = new Vector3();
const moonTargetPosition = new Vector3();

export function EarthMoonScene({ mode, composition, quality, reducedMotion, paused, onSceneReady }: EarthMoonSceneProps) {
  const earthGroup = useRef<Group>(null);
  const { camera, viewport } = useThree();

  const lightColor = useMemo(
    () => new Color(composition.light.color[0], composition.light.color[1], composition.light.color[2]),
    [composition.light.color]
  );

  useEffect(() => {
    onSceneReady?.();
  }, [onSceneReady]);

  useFrame((state, delta) => {
    const progress = getRuntimeOpeningProgress(mode === "window" || mode === "expanded" ? 1 : 0);
    const frame = mapOpeningProgress(mode === "expanded" ? 1 : progress);
    const narrowViewport = viewport.width < 6;
    const compactViewport = viewport.width >= 6 && viewport.width < 9;
    const viewportShift = narrowViewport ? 0.82 : compactViewport ? 0.32 : 0;
    const viewportScale = narrowViewport ? 0.72 : compactViewport ? 0.86 : 1;

    nextCameraPosition.set(
      Math.sin(frame.cameraAzimuth) * frame.cameraDistance,
      frame.cameraElevation * frame.cameraDistance,
      Math.cos(frame.cameraAzimuth) * frame.cameraDistance
    );
    camera.position.lerp(nextCameraPosition, reducedMotion ? 0.18 : 0.075);
    camera.lookAt(cameraTarget);

    if (earthGroup.current) {
      const expandedBoost = mode === "expanded" ? 0.22 : 0;
      const earthScale = (frame.earthScale + expandedBoost) * viewportScale;
      earthTargetPosition.set(frame.earthX + viewportShift, -0.1, 0);
      earthGroup.current.position.lerp(earthTargetPosition, 0.08);
      earthGroup.current.scale.lerp(earthTargetScale.set(earthScale, earthScale, earthScale), 0.08);
    }

    const moonX = narrowViewport ? composition.moon.screenX - 0.4 : composition.moon.screenX + viewportShift * 0.18;
    const moonY = compactViewport ? composition.moon.screenY - 0.08 : composition.moon.screenY;
    moonTargetPosition.set(moonX, moonY, -0.2);
  });

  return (
    <>
      <color attach="background" args={["#080a10"]} />
      <ambientLight intensity={composition.light.ambientIntensity} color="#d9e2e4" />
      <directionalLight
        position={composition.light.fixedSunDir}
        intensity={composition.light.intensity}
        color={lightColor}
      />
      <pointLight position={[-3.2, -1.2, 2.4]} intensity={0.55} color="#76a99b" />

      {quality.stars > 0 ? (
        <Stars radius={42} depth={26} count={quality.stars} factor={2.4} saturation={0} fade speed={0.18} />
      ) : null}

      <group ref={earthGroup}>
        <LandingEarth composition={composition} quality={quality} reducedMotion={reducedMotion} paused={paused} />
        <LandingAtmosphere composition={composition} quality={quality} />
        <LandingAurora composition={composition} quality={quality} reducedMotion={reducedMotion} paused={paused} />
      </group>

      <LandingMoon
        mode={mode}
        composition={composition}
        quality={quality}
        reducedMotion={reducedMotion}
        paused={paused}
        position={moonTargetPosition}
      />
    </>
  );
}
