"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Camera, Color, DirectionalLight, Euler, Group, MathUtils, Vector2, Vector3 } from "three";
import {
  getRuntimeOpeningProgress,
  mapOpeningProgress,
  useQualityTier,
  useReducedMotionPreference
} from "@miralith/visual-core";
import {
  DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION,
  LandingEarth,
  LandingHorizonAuroraRibbon,
  LandingHorizonCloudBelt,
  LandingLimbScatteringLook,
  LandingProjectedAuroraCurtain,
  LandingProjectedHorizonCloudPlate,
  LandingProjectedLimbScattering,
  LandingSpaceBackground,
  resolveLandingAssets,
  resolveLandingPreset
} from "@miralith/lubirth-hero";
import type { LandingQuality, QualityProfile } from "@miralith/visual-core";
import type { LandingProjectedEarthFrame } from "@miralith/lubirth-hero";

export type LuBirthLookdevPass = "clouds" | "limb" | "aurora" | "projection";
type LuBirthProjectionLookdevLayer = "all" | "clouds" | "limb" | "aurora";

declare global {
  interface Window {
    __MiraLithLuBirthLookdevPass?: LuBirthLookdevPass;
    __MiraLithLuBirthLookdevProjectionLayer?: LuBirthProjectionLookdevLayer;
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthAuroraEnabled?: boolean;
  }
}

interface LuBirthLookdevSceneSlotProps {
  pass: LuBirthLookdevPass;
  quality?: LandingQuality;
  paused?: boolean;
}

interface LookdevSceneProps {
  pass: LuBirthLookdevPass;
  quality: QualityProfile;
  reducedMotion: boolean;
  paused?: boolean;
}

const cameraTarget = new Vector3();
const nextCameraPosition = new Vector3();
const earthTargetPosition = new Vector3();
const earthTargetScale = new Vector3();
const fieldSunDirection = new Vector3(...DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION).normalize();
const finalSunDirection = new Vector3();
const earthLightEuler = new Euler(0, 0, 0, "YXZ");
const sceneLightDirection = new Vector3();
const projectionWorldCenter = new Vector3();
const projectionWorldRight = new Vector3();
const projectionWorldUp = new Vector3();
const projectionWorldPoint = new Vector3();
const projectionCenterScreen = new Vector2();
const projectionRightScreen = new Vector2();
const projectionUpScreen = new Vector2();

function readQualityOverride(): LandingQuality | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const quality = new URLSearchParams(window.location.search).get("quality");
  return quality === "high" || quality === "medium" || quality === "low" || quality === "auto" ? quality : undefined;
}

function readProjectionLayer(): LuBirthProjectionLookdevLayer {
  if (typeof window === "undefined") {
    return "all";
  }

  const params = new URLSearchParams(window.location.search);
  const layer = params.get("layer") ?? params.get("mode") ?? params.get("debug");
  if (layer === "clouds" || layer === "limb" || layer === "aurora") {
    return layer;
  }

  if (layer === "atmosphere") {
    return "limb";
  }

  return "all";
}

function projectToScreen(point: Vector3, camera: Camera, size: { width: number; height: number }, out: Vector2) {
  projectionWorldPoint.copy(point).project(camera);
  out.set(
    (projectionWorldPoint.x * 0.5 + 0.5) * size.width,
    (projectionWorldPoint.y * 0.5 + 0.5) * size.height
  );
  return out;
}

function LookdevScene({ pass, quality, reducedMotion, paused = false }: LookdevSceneProps) {
  const earthGroup = useRef<Group>(null);
  const auroraGroup = useRef<Group>(null);
  const directionalLightRef = useRef<DirectionalLight>(null);
  const getThree = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const projectionLayer = useMemo(() => (pass === "projection" ? readProjectionLayer() : "all"), [pass]);
  const projectionRef = useRef<LandingProjectedEarthFrame>({
    center: new Vector2(0, 0),
    sunDirection: new Vector2(0, 1),
    radius: 1,
    progress: 0,
    horizonPoints: Array.from({ length: 56 }, () => new Vector2(-9999, -9999)),
    horizonPointCount: 0
  });
  const composition = useMemo(
    () => resolveLandingPreset(
      "field",
      pass === "aurora" || pass === "projection" ? { aurora: { intensity: 1.08 } } : undefined
    ),
    [pass]
  );
  const assets = useMemo(() => resolveLandingAssets(), []);
  const lightColor = useMemo(
    () => new Color(composition.light.color[0], composition.light.color[1], composition.light.color[2]),
    [composition.light.color]
  );

  useFrame(() => {
    const progress = getRuntimeOpeningProgress(0);
    const frame = mapOpeningProgress(progress);
    const fov = composition.camera.fov;
    const activeCamera = getThree().camera;

    nextCameraPosition.set(
      Math.sin(frame.cameraAzimuth) * frame.cameraDistance,
      Math.sin(frame.cameraElevation) * frame.cameraDistance,
      Math.cos(frame.cameraAzimuth) * frame.cameraDistance
    );
    activeCamera.position.copy(nextCameraPosition);
    if ("fov" in activeCamera) {
      activeCamera.fov = fov;
      activeCamera.updateProjectionMatrix();
    }
    cameraTarget.set(0, frame.cameraLookAtY, 0);
    activeCamera.lookAt(cameraTarget);

    earthGroup.current?.position.copy(earthTargetPosition.set(frame.earthX, frame.earthY, 0));
    earthGroup.current?.scale.copy(earthTargetScale.set(frame.earthScale, frame.earthScale, frame.earthScale));
    earthGroup.current?.rotation.set(
      MathUtils.degToRad(frame.earthPitchDeg),
      MathUtils.degToRad(frame.earthYawDeg),
      0,
      "YXZ"
    );
    auroraGroup.current?.position.copy(earthTargetPosition);
    auroraGroup.current?.scale.copy(earthTargetScale);
    auroraGroup.current?.rotation.set(0, 0, 0);

    finalSunDirection
      .set(...composition.light.fixedSunDir)
      .normalize()
      .applyEuler(earthLightEuler.set(
        -MathUtils.degToRad(frame.earthPitchDeg),
        -MathUtils.degToRad(frame.earthYawDeg),
        0,
        "YXZ"
      ));
    sceneLightDirection.copy(finalSunDirection).lerp(fieldSunDirection, 0.85).normalize();
    directionalLightRef.current?.position.copy(sceneLightDirection);

    if (earthGroup.current) {
      activeCamera.updateMatrixWorld();
      earthGroup.current.updateMatrixWorld();
      earthGroup.current.getWorldPosition(projectionWorldCenter);
      projectionWorldRight.set(1, 0, 0).applyQuaternion(activeCamera.quaternion).normalize();
      projectionWorldUp.set(0, 1, 0).applyQuaternion(activeCamera.quaternion).normalize();

      const earthRadius = composition.earth.radius * earthGroup.current.scale.x;
      const centerScreen = projectToScreen(projectionWorldCenter, activeCamera, size, projectionCenterScreen);
      projectionRef.current.center.copy(centerScreen);

      const rightScreen = projectToScreen(
        projectionWorldPoint.copy(projectionWorldCenter).addScaledVector(projectionWorldRight, earthRadius),
        activeCamera,
        size,
        projectionRightScreen
      );
      const radiusX = rightScreen.distanceTo(centerScreen);
      const upScreen = projectToScreen(
        projectionWorldPoint.copy(projectionWorldCenter).addScaledVector(projectionWorldUp, earthRadius),
        activeCamera,
        size,
        projectionUpScreen
      );
      const radiusY = upScreen.distanceTo(centerScreen);
      projectionRef.current.radius = Math.max(radiusX, radiusY, 1);
      projectionRef.current.progress = progress;
      projectionRef.current.sunDirection.set(
        sceneLightDirection.dot(projectionWorldRight),
        sceneLightDirection.dot(projectionWorldUp)
      );
      if (projectionRef.current.sunDirection.lengthSq() < 0.001) {
        projectionRef.current.sunDirection.set(0, 1);
      } else {
        projectionRef.current.sunDirection.normalize();
      }
    }
  }, -2);

  const showProjectedClouds = pass === "projection" && (projectionLayer === "all" || projectionLayer === "clouds");
  const showProjectedLimb =
    pass === "projection" &&
    (projectionLayer === "all" || projectionLayer === "limb" || projectionLayer === "aurora");
  const showProjectedAurora = pass === "projection" && projectionLayer === "aurora";

  return (
    <>
      <color attach="background" args={["#000307"]} />
      <fog attach="fog" args={["#000307", 16, 48]} />
      <LandingSpaceBackground quality={quality} spaceBackground={assets.spaceBackground} />
      <ambientLight intensity={composition.light.ambientIntensity} color="#d9e2e4" />
      <directionalLight
        ref={directionalLightRef}
        position={fieldSunDirection}
        intensity={composition.light.intensity}
        color={lightColor}
      />

      <group ref={earthGroup}>
        <LandingEarth
          composition={composition}
          assets={assets}
          quality={quality}
          showTextureClouds={pass === "clouds" || pass === "projection"}
          reducedMotion={reducedMotion}
          paused={paused}
          sceneLightDirection={sceneLightDirection}
        />
        {pass === "clouds" ? (
          <LandingHorizonCloudBelt
            composition={composition}
            assets={assets}
            quality={quality}
            sceneLightDirection={sceneLightDirection}
            emphasis
            reducedMotion={reducedMotion}
            paused={paused}
          />
        ) : null}
        {pass === "limb" ? (
          <LandingLimbScatteringLook
            composition={composition}
            quality={quality}
            sceneLightDirection={sceneLightDirection}
            emphasis
          />
        ) : null}
        {pass === "aurora" ? (
          <LandingLimbScatteringLook
            composition={composition}
            quality={quality}
            sceneLightDirection={sceneLightDirection}
          />
        ) : null}
      </group>
      {showProjectedClouds ? (
        <LandingProjectedHorizonCloudPlate
          composition={composition}
          assets={assets}
          quality={quality}
          projection={projectionRef}
          emphasis={projectionLayer === "clouds"}
          reducedMotion={reducedMotion}
          paused={paused}
        />
      ) : null}
      {showProjectedLimb ? (
        <LandingProjectedLimbScattering
          composition={composition}
          quality={quality}
          projection={projectionRef}
          emphasis={projectionLayer === "limb"}
        />
      ) : null}
      {showProjectedAurora ? (
        <LandingProjectedAuroraCurtain
          composition={composition}
          quality={quality}
          projection={projectionRef}
          debugProfile
          visibilityBoost={3.8}
          reducedMotion={reducedMotion}
          paused={paused}
        />
      ) : null}
      {pass === "aurora" ? (
        <group ref={auroraGroup}>
          <LandingHorizonAuroraRibbon
            composition={composition}
            quality={quality}
            sceneLightDirection={sceneLightDirection}
            visibilityBoost={4.4}
            debugProfile
            reducedMotion={reducedMotion}
            paused={paused}
          />
        </group>
      ) : null}
    </>
  );
}

export function LuBirthLookdevSceneSlot({
  pass,
  quality = "auto",
  paused = false
}: LuBirthLookdevSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityOverride = readQualityOverride();
  const qualityProfile = useQualityTier(qualityOverride ?? quality, reducedMotion);

  useEffect(() => {
    window.__MiraLithLuBirthLookdevPass = pass;
    window.__MiraLithLuBirthLookdevProjectionLayer = pass === "projection" ? readProjectionLayer() : undefined;
    window.__MiraLithLuBirthQualityTier = qualityProfile.tier;
    window.__MiraLithLuBirthAuroraEnabled =
      (pass === "aurora" || (pass === "projection" && readProjectionLayer() === "aurora")) && qualityProfile.aurora;
  }, [pass, qualityProfile.aurora, qualityProfile.tier]);

  if (qualityProfile.tier === "fallback") {
    return null;
  }

  return (
    <LookdevScene
      pass={pass}
      quality={qualityProfile}
      reducedMotion={reducedMotion}
      paused={paused}
    />
  );
}
