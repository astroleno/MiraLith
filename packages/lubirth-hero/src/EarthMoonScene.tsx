"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, DirectionalLight, Euler, MathUtils, Group, Vector3 } from "three";
import {
  OPENING_FIELD_AUTO_ROTATE_START,
  getRuntimeOpeningProgress,
  mapOpeningProgress
} from "@miralith/visual-core";
import {
  DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION,
  DEFAULT_LUBIRTH_LOCATION_TARGET,
  DEFAULT_LUBIRTH_LOCATION_VECTOR
} from "./constants";
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
const mianyangLocalDirection = new Vector3(...DEFAULT_LUBIRTH_LOCATION_VECTOR);
const mianyangSurfacePosition = new Vector3();
const mianyangWorldPosition = new Vector3();
const mianyangProjectedPosition = new Vector3();

declare global {
  interface Window {
    __MiraLithMianyangProjection?: {
      progress: number;
      x: number;
      y: number;
      targetX: number;
      targetY: number;
      withinTolerance: boolean;
    };
  }
}

function MianyangDebugMarker({ radius }: { radius: number }) {
  const position = useMemo(
    () => mianyangLocalDirection.clone().multiplyScalar(radius * 1.014),
    [radius]
  );

  return (
    <group position={position} renderOrder={80}>
      <mesh renderOrder={81}>
        <sphereGeometry args={[radius * 0.008, 16, 16]} />
        <meshBasicMaterial color="#ff4545" depthTest={false} depthWrite={false} />
      </mesh>
      <mesh renderOrder={82}>
        <sphereGeometry args={[radius * 0.014, 16, 16]} />
        <meshBasicMaterial color="#ff4545" transparent opacity={0.22} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function EarthMoonScene({ mode, composition, assets, quality, debugMianyang, reducedMotion, paused, onSceneReady }: EarthMoonSceneProps) {
  const earthGroup = useRef<Group>(null);
  const directionalLightRef = useRef<DirectionalLight>(null);
  const autoEarthYawDeg = useRef(0);
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
      }

      const autoRotateProgress = mode === "expanded"
        ? 1
        : easeInOut(MathUtils.clamp((progress - OPENING_FIELD_AUTO_ROTATE_START) / (1 - OPENING_FIELD_AUTO_ROTATE_START), 0, 1));
      const canAutoRotate =
        autoRotateProgress > 0 &&
        !paused &&
        !reducedMotion &&
        composition.motion.autoRotate &&
        composition.earth.rotationSpeedDegPerSec > 0;
      if (canAutoRotate) {
        autoEarthYawDeg.current += composition.earth.rotationSpeedDegPerSec * delta * autoRotateProgress;
        earthYawDeg += autoEarthYawDeg.current;
      } else if (progress < OPENING_FIELD_AUTO_ROTATE_START) {
        autoEarthYawDeg.current = 0;
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

      if (debugMianyang && typeof window !== "undefined") {
        mianyangSurfacePosition
          .copy(mianyangLocalDirection)
          .multiplyScalar(composition.earth.radius);
        earthGroup.current.updateMatrixWorld();
        mianyangWorldPosition
          .copy(mianyangSurfacePosition)
          .applyMatrix4(earthGroup.current.matrixWorld);
        mianyangProjectedPosition.copy(mianyangWorldPosition).project(camera);

        const x = (mianyangProjectedPosition.x * 0.5 + 0.5) * size.width;
        const y = (-mianyangProjectedPosition.y * 0.5 + 0.5) * size.height;
        window.__MiraLithMianyangProjection = {
          progress,
          x,
          y,
          targetX: DEFAULT_LUBIRTH_LOCATION_TARGET.x,
          targetY: DEFAULT_LUBIRTH_LOCATION_TARGET.y,
          withinTolerance:
            Math.abs(x - DEFAULT_LUBIRTH_LOCATION_TARGET.x) <= DEFAULT_LUBIRTH_LOCATION_TARGET.toleranceX &&
            Math.abs(y - DEFAULT_LUBIRTH_LOCATION_TARGET.y) <= DEFAULT_LUBIRTH_LOCATION_TARGET.toleranceY
        };
      }
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
    const fieldSunProgress = mode === "expanded" ? 1 : easeInOut(MathUtils.clamp((progress - 0.18) / 0.74, 0, 1));
    sceneLightDirection.copy(finalSunDirection).lerp(fieldSunDirection, fieldSunProgress).normalize();
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
        <LandingAurora
          composition={composition}
          quality={quality}
          sceneLightDirection={sceneLightDirection}
          reducedMotion={reducedMotion}
          paused={paused}
        />
        {debugMianyang ? <MianyangDebugMarker radius={composition.earth.radius} /> : null}
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
