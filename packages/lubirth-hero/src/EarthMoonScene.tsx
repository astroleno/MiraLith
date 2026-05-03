"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { type Camera, Color, DirectionalLight, Euler, MathUtils, Group, Vector2, Vector3 } from "three";
import {
  OPENING_FIELD_AUTO_ROTATE_START,
  getRuntimeOpeningProgress,
  mapOpeningProgress
} from "@miralith/visual-core";
import {
  DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION,
  DEFAULT_LUBIRTH_LOCATION,
  DEFAULT_LUBIRTH_LOCATION_TARGET,
  geodeticToTextureVector
} from "./constants";
import { LandingAirglow } from "./LandingAirglow";
import { LandingAtmosphere } from "./LandingAtmosphere";
import { LandingAtmosphereStack } from "./LandingAtmosphereStack";
import { LandingAurora } from "./LandingAurora";
import { LandingAuroraOval } from "./LandingAuroraOval";
import { LandingCloudDeck } from "./LandingCloudDeck";
import { LandingCloudDeckV2 } from "./LandingCloudDeckV2";
import { LandingCloudLayer } from "./LandingCloudLayer";
import { LandingEarth } from "./LandingEarth";
import { LandingHorizonAuroraRibbon } from "./LandingHorizonAuroraRibbon";
import { LandingLimbAirglowV2 } from "./LandingLimbAirglowV2";
import { LandingMoon } from "./LandingMoon";
import { LandingPostBloom } from "./LandingPostBloom";
import { LandingProjectedHorizonComposite } from "./LandingProjectedHorizonComposite";
import { LandingProjectedLimbScattering } from "./LandingProjectedLimbScattering";
import { LandingSpaceBackground } from "./LandingSpaceBackground";
import type {
  EarthMoonSceneProps,
  LandingProjectedEarthFrame,
  LandingRenderProfile,
  LuBirthProjectionFrame
} from "./types";

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
const mianyangSurfacePosition = new Vector3();
const mianyangWorldPosition = new Vector3();
const mianyangProjectedPosition = new Vector3();
const projectionEarthCenter = new Vector3();
const projectionCameraRight = new Vector3();
const projectionCameraUp = new Vector3();
const projectionCameraPosition = new Vector3();
const projectionViewDirection = new Vector3();
const projectionTangentCenter = new Vector3();
const projectionTangentRight = new Vector3();
const projectionTangentUp = new Vector3();
const projectionWorldPosition = new Vector3();
const projectionScreenPosition = new Vector3();
const projectionMoonEdgePosition = new Vector3();
const projectedEarthScreenCenter = new Vector2();
const projectedEarthScreenRight = new Vector2();
const projectedEarthScreenUp = new Vector2();
const PROJECTED_LIMB_POINT_COUNT = 56;

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

function formatProjectionNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

function projectToBottomLeftScreen(point: Vector3, camera: Camera, width: number, height: number, out: Vector2) {
  projectionScreenPosition.copy(point).project(camera);
  out.set(
    (projectionScreenPosition.x * 0.5 + 0.5) * width,
    (projectionScreenPosition.y * 0.5 + 0.5) * height
  );
  return out;
}

function normalizeLongitudeDelta(value: number) {
  let result = value;
  while (result > 180) result -= 360;
  while (result < -180) result += 360;
  return result;
}

function createProjectedLimbPoints() {
  return Array.from({ length: PROJECTED_LIMB_POINT_COUNT }, () => new Vector2(-9999, -9999));
}

function LocationDebugMarker({ radius, direction }: { radius: number; direction: Vector3 }) {
  const position = useMemo(
    () => direction.clone().multiplyScalar(radius * 1.014),
    [direction, radius]
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

function resolveRenderProfile(
  renderProfile: LandingRenderProfile | undefined,
  visualDebugLayer: EarthMoonSceneProps["visualDebugLayer"]
): LandingRenderProfile {
  if (renderProfile) {
    return renderProfile;
  }

  if (visualDebugLayer === "stars") {
    return "debug-stars";
  }
  if (visualDebugLayer === "clouds") {
    return "debug-clouds";
  }
  if (visualDebugLayer === "atmosphere") {
    return "debug-atmosphere";
  }
  if (visualDebugLayer === "aurora") {
    return "debug-aurora";
  }

  return "clean";
}

export function EarthMoonScene({
  mode,
  composition,
  assets,
  quality,
  debugMianyang,
  visualDebugLayer = "all",
  renderProfile,
  auroraProfile = "hero",
  reducedMotion,
  paused,
  onSceneReady,
  onProjectionFrame,
  onVisualReadyEnough,
  onMoonTextureReady,
  useCloudDeckV2 = true,
  useAirglowV2 = true,
  useAuroraOval = false,
  useHorizonAuroraRibbon = true,
  showAuroraInAll = false
}: EarthMoonSceneProps) {
  const earthGroup = useRef<Group>(null);
  const projectedEarthFrame = useRef<LandingProjectedEarthFrame>({
    center: new Vector2(0, 0),
    sunDirection: new Vector2(0, 1),
    radius: 1,
    progress: 0,
    horizonPoints: createProjectedLimbPoints(),
    horizonPointCount: 0
  });
  const directionalLightRef = useRef<DirectionalLight>(null);
  const autoEarthYawDeg = useRef(0);
  const skyCounterRotation = useRef({ yawRad: 0 });
  const lastProjectionSignature = useRef("");
  const { camera, size } = useThree();
  const sceneLightDirection = useMemo(() => fieldSunDirection.clone(), []);
  const activeRenderProfile = resolveRenderProfile(renderProfile, visualDebugLayer);
  const isNasaProfile = activeRenderProfile === "nasa";
  const isCleanProfile = activeRenderProfile === "clean";
  const debugStars = activeRenderProfile === "debug-stars";
  const debugClouds = activeRenderProfile === "debug-clouds";
  const debugAtmosphere = activeRenderProfile === "debug-atmosphere";
  const debugAurora = activeRenderProfile === "debug-aurora";

  const showEarth = !debugStars;
  const showMoon = isNasaProfile || isCleanProfile;
  const showClouds = isNasaProfile || debugClouds;
  const showAtmosphere = isNasaProfile || debugAtmosphere;
  const showAurora = debugAurora || (isNasaProfile && quality.aurora);
  const showProjectedHorizonComposite = false;
  const showProjectedLimbScattering = showAtmosphere && quality.tier !== "fallback";
  const showVolumetricClouds =
    showClouds &&
    quality.tier !== "low" &&
    quality.tier !== "fallback";
  const showLegacyAtmosphere = false;
  const showLegacyAurora = showAurora;
  const showSurfaceTextureClouds =
    showClouds &&
    quality.tier !== "low" &&
    quality.tier !== "fallback";
  const useHeroAuroraProfile = auroraProfile === "hero";
  const auroraVisibilityBoost = debugAurora
    ? (auroraProfile === "debug" ? 2.6 : 2.2)
    : 0.9;

  const lightColor = useMemo(
    () => new Color(composition.light.color[0], composition.light.color[1], composition.light.color[2]),
    [composition.light.color]
  );
  const activeLocationDirection = useMemo(
    () => new Vector3(...geodeticToTextureVector(
      composition.location.latitudeDeg,
      composition.location.longitudeDeg
    )),
    [composition.location.latitudeDeg, composition.location.longitudeDeg]
  );
  const locationYawOffsetDeg = normalizeLongitudeDelta(
    DEFAULT_LUBIRTH_LOCATION.longitudeDeg - composition.location.longitudeDeg
  );
  const locationPitchOffsetDeg = MathUtils.clamp(
    DEFAULT_LUBIRTH_LOCATION.latitudeDeg - composition.location.latitudeDeg,
    -62,
    62
  );

  useEffect(() => {
    onSceneReady?.();
  }, [onSceneReady]);

  useFrame((_state, delta) => {
    const progress = getRuntimeOpeningProgress(mode === "window" || mode === "expanded" ? 1 : 0);
    const frame = mapOpeningProgress(mode === "expanded" ? 1 : progress);
    const finalFrame = mapOpeningProgress(1);
    if (isNasaProfile && mode === "field") {
      const orbitalGrazing = 1 - easeInOut(MathUtils.clamp(progress / 0.72, 0, 1));
      frame.cameraElevation += MathUtils.degToRad(4.6 * orbitalGrazing);
      frame.cameraLookAtY += 1.18 * orbitalGrazing;
      frame.earthScale *= 1 + 0.13 * orbitalGrazing;
      frame.earthY -= 0.18 * orbitalGrazing;
    }
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

      if (composition.location.source !== "birthplace" && mode !== "expanded") {
        const locationFocusWeight = 1 - easeInOut(MathUtils.clamp(progress / 0.72, 0, 1));
        earthYawDeg += locationYawOffsetDeg * locationFocusWeight;
        earthPitchDeg += locationPitchOffsetDeg * locationFocusWeight * 0.82;
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
      skyCounterRotation.current.yawRad = -MathUtils.degToRad(earthYawDeg);

      if (debugMianyang && typeof window !== "undefined") {
        mianyangSurfacePosition
          .copy(activeLocationDirection)
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

    if (earthGroup.current) {
      camera.updateMatrixWorld();
      earthGroup.current.updateMatrixWorld();
      earthGroup.current.getWorldPosition(projectionEarthCenter);
      projectionCameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      projectionCameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

      const earthRadius = composition.earth.radius * earthGroup.current.scale.x;
      const centerScreen = projectToBottomLeftScreen(
        projectionEarthCenter,
        camera,
        size.width,
        size.height,
        projectedEarthScreenCenter
      );
      projectedEarthFrame.current.center.copy(centerScreen);
      const rightScreen = projectToBottomLeftScreen(
        projectionWorldPosition.copy(projectionEarthCenter).addScaledVector(projectionCameraRight, earthRadius),
        camera,
        size.width,
        size.height,
        projectedEarthScreenRight
      );
      const upScreen = projectToBottomLeftScreen(
        projectionWorldPosition.copy(projectionEarthCenter).addScaledVector(projectionCameraUp, earthRadius),
        camera,
        size.width,
        size.height,
        projectedEarthScreenUp
      );
      projectedEarthFrame.current.radius = Math.max(
        centerScreen.distanceTo(rightScreen),
        centerScreen.distanceTo(upScreen),
        1
      );
      projectedEarthFrame.current.horizonPointCount = 0;
      camera.getWorldPosition(projectionCameraPosition);
      projectionViewDirection.copy(projectionEarthCenter).sub(projectionCameraPosition);
      const earthDistance = projectionViewDirection.length();
      if (earthDistance > earthRadius + 0.001) {
        const tangentOffset = (earthRadius * earthRadius) / earthDistance;
        const tangentRadius = earthRadius * Math.sqrt(Math.max(0, 1 - ((earthRadius * earthRadius) / (earthDistance * earthDistance))));
        projectionViewDirection.normalize();
        projectionTangentCenter.copy(projectionEarthCenter).addScaledVector(projectionViewDirection, -tangentOffset);
        projectionTangentRight
          .copy(projectionCameraRight)
          .addScaledVector(projectionViewDirection, -projectionCameraRight.dot(projectionViewDirection));
        if (projectionTangentRight.lengthSq() < 0.001) {
          projectionTangentRight.copy(projectionCameraRight);
        }
        projectionTangentRight.normalize();
        projectionTangentUp.copy(projectionTangentRight).cross(projectionViewDirection);
        if (projectionTangentUp.lengthSq() < 0.001) {
          projectionTangentUp.copy(projectionCameraUp);
        }
        projectionTangentUp.normalize();
        for (let index = 0; index < PROJECTED_LIMB_POINT_COUNT; index += 1) {
          const unit = index / (PROJECTED_LIMB_POINT_COUNT - 1);
          const angle = MathUtils.degToRad(172 - unit * 144);
          projectToBottomLeftScreen(
            projectionWorldPosition
              .copy(projectionTangentCenter)
              .addScaledVector(projectionTangentRight, Math.cos(angle) * tangentRadius)
              .addScaledVector(projectionTangentUp, Math.sin(angle) * tangentRadius),
            camera,
            size.width,
            size.height,
            projectedEarthFrame.current.horizonPoints[index]
          );
        }
        projectedEarthFrame.current.horizonPointCount = PROJECTED_LIMB_POINT_COUNT;
      }
      projectedEarthFrame.current.progress = progress;
      projectedEarthFrame.current.sunDirection.set(
        sceneLightDirection.dot(projectionCameraRight),
        sceneLightDirection.dot(projectionCameraUp)
      );
      if (projectedEarthFrame.current.sunDirection.lengthSq() < 0.001) {
        projectedEarthFrame.current.sunDirection.set(0, 1);
      } else {
        projectedEarthFrame.current.sunDirection.normalize();
      }
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

    if (onProjectionFrame && mode === "field" && progress <= 0.03 && earthGroup.current) {
      earthGroup.current.updateMatrixWorld();
      earthGroup.current.getWorldPosition(projectionEarthCenter);
      projectionCameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      projectionCameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      camera.getWorldPosition(projectionCameraPosition);
      projectionViewDirection.copy(projectionEarthCenter).sub(projectionCameraPosition);

      const earthRadius = composition.earth.radius * earthGroup.current.scale.x;
      const earthDistance = projectionViewDirection.length();
      const tangentOffset = earthDistance > earthRadius
        ? (earthRadius * earthRadius) / earthDistance
        : 0;
      const tangentRadius = earthDistance > earthRadius
        ? earthRadius * Math.sqrt(Math.max(0, 1 - ((earthRadius * earthRadius) / (earthDistance * earthDistance))))
        : earthRadius;
      if (earthDistance > 0.001) {
        projectionViewDirection.normalize();
      }
      projectionTangentCenter.copy(projectionEarthCenter).addScaledVector(projectionViewDirection, -tangentOffset);
      projectionTangentRight
        .copy(projectionCameraRight)
        .addScaledVector(projectionViewDirection, -projectionCameraRight.dot(projectionViewDirection));
      if (projectionTangentRight.lengthSq() < 0.001) {
        projectionTangentRight.copy(projectionCameraRight);
      }
      projectionTangentRight.normalize();
      projectionTangentUp.copy(projectionTangentRight).cross(projectionViewDirection);
      if (projectionTangentUp.lengthSq() < 0.001) {
        projectionTangentUp.copy(projectionCameraUp);
      }
      projectionTangentUp.normalize();
      const projectToScreen = (point: Vector3) => {
        projectionScreenPosition.copy(point).project(camera);
        return {
          x: formatProjectionNumber((projectionScreenPosition.x * 0.5 + 0.5) * size.width),
          y: formatProjectionNumber((-projectionScreenPosition.y * 0.5 + 0.5) * size.height)
        };
      };
      const projectHorizonPoint = (angleDeg: number) => {
        const angle = MathUtils.degToRad(angleDeg);
        projectionWorldPosition
          .copy(projectionTangentCenter)
          .addScaledVector(projectionTangentRight, Math.cos(angle) * tangentRadius)
          .addScaledVector(projectionTangentUp, Math.sin(angle) * tangentRadius);
        return projectToScreen(projectionWorldPosition);
      };

      const horizonPoints = Array.from({ length: 141 }, (_, index) => projectHorizonPoint(160 - index));
      const earthHorizonPath = horizonPoints
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
      const moonCenter = projectToScreen(moonTargetPosition);
      projectionMoonEdgePosition
        .copy(moonTargetPosition)
        .addScaledVector(projectionCameraRight, composition.moon.radius * moonTargetScale.x);
      const moonEdge = projectToScreen(projectionMoonEdgePosition);
      const moonRadius = formatProjectionNumber(
        Math.max(18, Math.hypot(moonEdge.x - moonCenter.x, moonEdge.y - moonCenter.y))
      );
      const projectionFrame: LuBirthProjectionFrame = {
        width: Math.round(size.width),
        height: Math.round(size.height),
        earthHorizonPath,
        moon: {
          x: moonCenter.x,
          y: moonCenter.y,
          radius: moonRadius
        }
      };
      const projectionSignature = [
        projectionFrame.width,
        projectionFrame.height,
        projectionFrame.earthHorizonPath,
        projectionFrame.moon.x,
        projectionFrame.moon.y,
        projectionFrame.moon.radius
      ].join(":");

      if (projectionSignature !== lastProjectionSignature.current) {
        lastProjectionSignature.current = projectionSignature;
        onProjectionFrame(projectionFrame);
      }
    }
  }, -2);

  return (
    <>
      <color attach="background" args={["#000307"]} />
      <fog attach="fog" args={["#000307", 16, 48]} />
      <LandingSpaceBackground
        quality={quality}
        spaceBackground={assets.spaceBackground}
        emphasis={debugStars}
        counterRotation={skyCounterRotation}
      />
      {showEarth || showMoon ? <ambientLight intensity={composition.light.ambientIntensity} color="#d9e2e4" /> : null}
      {showEarth || showMoon ? (
        <directionalLight
          ref={directionalLightRef}
          position={sceneLightDirection}
          intensity={composition.light.intensity}
          color={lightColor}
        />
      ) : null}

      <group ref={earthGroup}>
        {showEarth ? (
          <LandingEarth
            composition={composition}
            assets={assets}
            quality={quality}
            showTextureClouds={showSurfaceTextureClouds}
            reducedMotion={reducedMotion}
            paused={paused}
            sceneLightDirection={sceneLightDirection}
            onDayTextureReady={onVisualReadyEnough}
          />
        ) : null}
        {showVolumetricClouds ? (
          assets.earthCloudDeck ? (
            useCloudDeckV2 ? (
              <LandingCloudDeckV2
                composition={composition}
                assets={assets}
                quality={quality}
                sceneLightDirection={sceneLightDirection}
                emphasis={debugClouds}
                reducedMotion={reducedMotion}
                paused={paused}
              />
            ) : (
              <LandingCloudDeck
                composition={composition}
                assets={assets}
                quality={quality}
                sceneLightDirection={sceneLightDirection}
                emphasis={debugClouds}
                reducedMotion={reducedMotion}
                paused={paused}
              />
            )
          ) : (
            <LandingCloudLayer
              composition={composition}
              assets={assets}
              quality={quality}
              sceneLightDirection={sceneLightDirection}
              emphasis={debugClouds}
              reducedMotion={reducedMotion}
              paused={paused}
            />
          )
        ) : null}
        {showLegacyAurora ? (
          useHorizonAuroraRibbon ? (
            <LandingHorizonAuroraRibbon
              composition={composition}
              quality={quality}
              sceneLightDirection={sceneLightDirection}
              visibilityBoost={auroraVisibilityBoost}
              moonColumnAvoidance={0}
              debugProfile={debugAurora || auroraProfile === "debug"}
              reducedMotion={reducedMotion}
              paused={paused}
            />
          ) : useAuroraOval ? (
            <LandingAuroraOval
              composition={composition}
              quality={quality}
              sceneLightDirection={sceneLightDirection}
              visibilityBoost={auroraVisibilityBoost}
              moonColumnAvoidance={0}
              lowProfile={useHeroAuroraProfile}
              reducedMotion={reducedMotion}
              paused={paused}
            />
          ) : (
            <LandingAurora
              composition={composition}
              quality={quality}
              sceneLightDirection={sceneLightDirection}
              visibilityBoost={auroraVisibilityBoost}
              moonColumnAvoidance={0}
              lowProfile={useHeroAuroraProfile}
              reducedMotion={reducedMotion}
              paused={paused}
            />
          )
        ) : null}
        {showLegacyAtmosphere ? (
          useAirglowV2 ? (
            <LandingLimbAirglowV2
              composition={composition}
              quality={quality}
              sceneLightDirection={sceneLightDirection}
              emphasis={debugAtmosphere}
            />
          ) : (
            <LandingAirglow
              composition={composition}
              quality={quality}
              sceneLightDirection={sceneLightDirection}
              emphasis={debugAtmosphere}
            />
          )
        ) : null}
        {showLegacyAtmosphere ? (
          <LandingAtmosphere
            composition={composition}
            quality={quality}
            sceneLightDirection={sceneLightDirection}
            emphasis={debugAtmosphere}
          />
        ) : null}
        {showAtmosphere ? (
          <LandingAtmosphereStack
            composition={composition}
            quality={quality}
            sceneLightDirection={sceneLightDirection}
            emphasis={debugAtmosphere}
          />
        ) : null}
        {debugMianyang && showEarth ? (
          <LocationDebugMarker radius={composition.earth.radius} direction={activeLocationDirection} />
        ) : null}
      </group>

      {showProjectedHorizonComposite ? (
        <LandingProjectedHorizonComposite
          composition={composition}
          assets={assets}
          quality={quality}
          projection={projectedEarthFrame}
          layer={visualDebugLayer}
          auroraProfile={auroraProfile}
          showAuroraInAll={showAuroraInAll}
          reducedMotion={reducedMotion}
          paused={paused}
        />
      ) : null}

      {showProjectedLimbScattering ? (
        <LandingProjectedLimbScattering
          composition={composition}
          quality={quality}
          projection={projectedEarthFrame}
          emphasis={debugAtmosphere}
        />
      ) : null}

      {showMoon ? (
        <LandingMoon
          mode={mode}
          composition={composition}
          assets={assets}
          quality={quality}
          reducedMotion={reducedMotion}
          paused={paused}
          sceneLightDirection={sceneLightDirection}
          position={moonTargetPosition}
          targetScale={moonTargetScale}
          onTextureReady={onMoonTextureReady}
        />
      ) : null}

      {showAtmosphere ? <LandingPostBloom quality={quality} emphasis={debugAtmosphere} /> : null}
    </>
  );
}
