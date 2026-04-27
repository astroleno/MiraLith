"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, DirectionalLight, Euler, MathUtils, Group, Vector3 } from "three";
import {
  getRuntimeOpeningProgress,
  mapOpeningProgress
} from "@miralith/visual-core";
import { DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION } from "./constants";
import { LandingAtmosphere } from "./LandingAtmosphere";
import { LandingAurora } from "./LandingAurora";
import { LandingEarth } from "./LandingEarth";
import { LandingMoon } from "./LandingMoon";
import { LandingSpaceBackground } from "./LandingSpaceBackground";
import type { EarthMoonSceneProps } from "./types";

const cameraTarget = new Vector3(0, 0, 0);
const nextCameraPosition = new Vector3();
const earthTargetPosition = new Vector3();
const earthTargetScale = new Vector3();
const moonLocalPosition = new Vector3();
const moonTargetPosition = new Vector3();
const moonTargetScale = new Vector3();
const fieldSunDirection = new Vector3(...DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION).normalize();
const finalSunDirection = new Vector3();
const earthLightEuler = new Euler(0, 0, 0, "YXZ");
const easeInOut = (value: number) => value * value * (3 - 2 * value);

export function EarthMoonScene({ mode, composition, assets, quality, reducedMotion, paused, onSceneReady }: EarthMoonSceneProps) {
  const earthGroup = useRef<Group>(null);
  const directionalLightRef = useRef<DirectionalLight>(null);
  const autoEarthYawDeg = useRef(0);
  const scrollYawOriginDeg = useRef<number | null>(null);
  const { camera, size } = useThree();
  const sceneLightDirection = useMemo(() => fieldSunDirection.clone(), []);

  const lightColor = useMemo(
    () => new Color(composition.light.color[0], composition.light.color[1], composition.light.color[2]),
    [composition.light.color]
  );

  useEffect(() => {
    onSceneReady?.();
  }, [onSceneReady]);

  useFrame((_state, delta) => {
    const progress = getRuntimeOpeningProgress(mode === "window" || mode === "expanded" ? 1 : 0);
    const frame = mapOpeningProgress(mode === "expanded" ? 1 : progress);
    const finalFrame = mapOpeningProgress(1);
    const fov = composition.camera.fov;

    nextCameraPosition.set(
      Math.sin(frame.cameraAzimuth) * frame.cameraDistance,
      Math.sin(frame.cameraElevation) * frame.cameraDistance,
      Math.cos(frame.cameraAzimuth) * frame.cameraDistance
    );
    camera.position.copy(nextCameraPosition);
    if ("fov" in camera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    cameraTarget.set(0, frame.cameraLookAtY, 0);
    camera.lookAt(cameraTarget);

    let earthPitchDeg = frame.earthPitchDeg;
    let earthYawDeg = frame.earthYawDeg;
    if (earthGroup.current) {
      if (mode === "expanded") {
        earthPitchDeg = finalFrame.earthPitchDeg;
        earthYawDeg = finalFrame.earthYawDeg;
      } else if (progress <= 0.001) {
        scrollYawOriginDeg.current = null;
        if (!paused && !reducedMotion && composition.motion.autoRotate && composition.earth.rotationSpeedDegPerSec > 0) {
          autoEarthYawDeg.current += composition.earth.rotationSpeedDegPerSec * delta;
        }
        earthYawDeg = frame.earthYawDeg + autoEarthYawDeg.current;
      } else {
        scrollYawOriginDeg.current ??= mapOpeningProgress(0).earthYawDeg + autoEarthYawDeg.current;
        earthYawDeg = MathUtils.lerp(
          scrollYawOriginDeg.current,
          finalFrame.earthYawDeg,
          easeInOut(progress)
        );
      }

      earthTargetPosition.set(frame.earthX, frame.earthY, 0);
      earthTargetScale.set(frame.earthScale, frame.earthScale, frame.earthScale);
      earthGroup.current.position.copy(earthTargetPosition);
      earthGroup.current.scale.copy(earthTargetScale);
      earthGroup.current.rotation.set(
        MathUtils.degToRad(earthPitchDeg),
        MathUtils.degToRad(earthYawDeg),
        0,
        "YXZ"
      );
    }

    finalSunDirection
      .set(...composition.light.fixedSunDir)
      .normalize()
      .applyEuler(earthLightEuler.set(
        -MathUtils.degToRad(earthPitchDeg),
        -MathUtils.degToRad(earthYawDeg),
        0,
        "YXZ"
      ));
    const sunProgress = mode === "expanded" ? 1 : easeInOut(MathUtils.clamp((progress - 0.08) / 0.72, 0, 1));
    sceneLightDirection.copy(fieldSunDirection).lerp(finalSunDirection, sunProgress).normalize();
    if (directionalLightRef.current) {
      directionalLightRef.current.position.copy(sceneLightDirection);
    }

    const anchorDistance = composition.moon.anchorDistance;
    const viewHeight = 2 * anchorDistance * Math.tan((fov * Math.PI) / 360);
    const viewWidth = viewHeight * (size.width / Math.max(size.height, 1));
    moonLocalPosition.set(
      (frame.moonX - 0.5) * viewWidth,
      (frame.moonY - 0.5) * viewHeight,
      -anchorDistance
    );
    camera.updateMatrixWorld();
    moonTargetPosition.copy(moonLocalPosition).applyQuaternion(camera.quaternion).add(camera.position);
    moonTargetScale.set(frame.moonScale, frame.moonScale, frame.moonScale);
  }, -2);

  return (
    <>
      <color attach="background" args={["#000307"]} />
      <fog attach="fog" args={["#000307", 16, 48]} />
      <LandingSpaceBackground quality={quality} />
      <ambientLight intensity={composition.light.ambientIntensity} color="#d9e2e4" />
      <directionalLight
        ref={directionalLightRef}
        position={sceneLightDirection}
        intensity={composition.light.intensity}
        color={lightColor}
      />

      <group ref={earthGroup}>
        <LandingEarth
          composition={composition}
          assets={assets}
          quality={quality}
          reducedMotion={reducedMotion}
          paused={paused}
          sceneLightDirection={sceneLightDirection}
        />
        <LandingAtmosphere composition={composition} quality={quality} sceneLightDirection={sceneLightDirection} />
        <LandingAurora composition={composition} quality={quality} reducedMotion={reducedMotion} paused={paused} />
      </group>

      <LandingMoon
        mode={mode}
        composition={composition}
        assets={assets}
        quality={quality}
        reducedMotion={reducedMotion}
        paused={paused}
        position={moonTargetPosition}
        targetScale={moonTargetScale}
      />
    </>
  );
}
