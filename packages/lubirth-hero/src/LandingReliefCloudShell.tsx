"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  MathUtils,
  Mesh,
  ShaderMaterial,
  Texture,
  Vector3
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  LANDING_RELIEF_LITE_SUN_STEPS,
  resolveLandingReliefLiteBudget
} from "./landingEarthLiteV2Policy";
import type { LandingPlanetLightingFrame } from "./landingPlanetLighting";
import {
  createLandingReliefCloudMaterial,
  type LandingReliefCloudFieldDecoder,
  resolveLandingReliefCloudGeometrySegments
} from "./LandingReliefCloud";
import type { LandingComposition } from "./types";

const cloudCameraWorld = new Vector3();
const cloudCameraLocal = new Vector3();

export interface LandingOpeningGlobeCloudShellPolicy {
  bottomScale: number;
  cloudIlluminationFloor: number;
  debugBoost: number;
  topScale: number;
  opacity: number;
  reliefLightingScale: number;
  viewSteps: 2 | 3;
  sunSteps: 1;
  fieldDecoder: "packed-video-field";
  textureColorSpace: "none";
}

export function resolveOpeningGlobeCloudShellPolicy(
  mobile: boolean
): LandingOpeningGlobeCloudShellPolicy {
  const budget = resolveLandingReliefLiteBudget(mobile);
  return {
    bottomScale: 1.0005,
    // Keep the presentation shell inside the limb atmosphere, while using
    // enough radial depth for the opening field to read as a cloud body
    // rather than a texture painted on the surface.
    topScale: 1.0115,
    opacity: 0.84,
    debugBoost: 1,
    cloudIlluminationFloor: 0.46,
    reliefLightingScale: 1.24,
    viewSteps: budget.viewSteps,
    sunSteps: LANDING_RELIEF_LITE_SUN_STEPS,
    fieldDecoder: "packed-video-field",
    textureColorSpace: "none"
  };
}

export interface LandingReliefCloudShellPolicy {
  bottomScale: number;
  topScale: number;
  viewSteps: 2 | 3;
}

export interface LandingReliefCloudShellRuntime {
  cloudIlluminationFloor?: number;
  cloudOffset?: number;
  debugBoost?: number;
  densityIntegrationScale?: number;
  opacity?: number;
  reliefLightingScale?: number;
  reverseSun?: boolean;
  reverseSunField?: boolean;
  sunSampleScale?: number;
}

export interface LandingReliefCloudShellFrame {
  cloudBottom: number;
  cloudTop: number;
  material: ShaderMaterial;
  mesh: Mesh;
  mobile: boolean;
  texture: Texture;
}

interface LandingReliefCloudShellProps {
  composition: LandingComposition;
  fieldDecoder?: LandingReliefCloudFieldDecoder;
  fieldTexture: Texture;
  fieldUvOffset?: readonly [number, number];
  lightingFrame: LandingPlanetLightingFrame;
  mobile: boolean;
  onAfterRender?: Mesh["onAfterRender"];
  onBeforeRender?: Mesh["onBeforeRender"];
  onFrame?: (frame: LandingReliefCloudShellFrame) => void;
  policy: LandingReliefCloudShellPolicy;
  quality: QualityProfile;
  renderOrder?: number;
  runtime?: LandingReliefCloudShellRuntime;
}

export function LandingReliefCloudShell({
  composition,
  fieldDecoder = "rgba-field",
  fieldTexture,
  fieldUvOffset = [0, 0],
  lightingFrame,
  mobile,
  onAfterRender,
  onBeforeRender,
  onFrame,
  policy,
  quality,
  renderOrder = 3,
  runtime
}: LandingReliefCloudShellProps) {
  const cloud = useRef<Mesh>(null);
  const { camera } = useThree();
  const fieldUvOffsetX = fieldUvOffset[0];
  const fieldUvOffsetY = fieldUvOffset[1];
  const cloudBottom = composition.earth.radius * policy.bottomScale;
  const cloudTop = composition.earth.radius * policy.topScale;
  const geometrySegments = resolveLandingReliefCloudGeometrySegments(quality, mobile);
  const material = useMemo(
    () => createLandingReliefCloudMaterial({
      composition,
      cloudBottom,
      cloudTop,
      fieldDecoder,
      fieldUvOffset: [fieldUvOffsetX, fieldUvOffsetY],
      texture: fieldTexture,
      viewSteps: policy.viewSteps
    }),
    [
      cloudBottom,
      cloudTop,
      composition,
      fieldDecoder,
      fieldTexture,
      fieldUvOffsetX,
      fieldUvOffsetY,
      policy.viewSteps
    ]
  );
  const enabled = composition.earth.useClouds && quality.tier !== "fallback";

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (!cloud.current) return;
    const cloudMaterial = cloud.current.material as ShaderMaterial;
    cloud.current.rotation.set(0, MathUtils.degToRad(composition.earth.yawDeg), 0);
    cloud.current.updateWorldMatrix(true, false);
    camera.getWorldPosition(cloudCameraWorld);
    cloudCameraLocal.copy(cloudCameraWorld);
    cloud.current.worldToLocal(cloudCameraLocal);
    cloudMaterial.uniforms.cameraLocal.value.copy(cloudCameraLocal);
    cloudMaterial.uniforms.cloudIlluminationFloor.value = MathUtils.clamp(
      runtime?.cloudIlluminationFloor ?? 0.32,
      0.2,
      0.68
    );
    cloudMaterial.uniforms.cloudOffset.value = MathUtils.euclideanModulo(runtime?.cloudOffset ?? 0, 1);
    cloudMaterial.uniforms.debugBoost.value = MathUtils.clamp(runtime?.debugBoost ?? 0, 0, 1);
    cloudMaterial.uniforms.densityIntegrationScale.value = MathUtils.clamp(
      runtime?.densityIntegrationScale ?? 1,
      0,
      1
    );
    cloudMaterial.uniforms.lightDir.value.copy(lightingFrame.sunDirection).normalize();
    cloudMaterial.uniforms.opacity.value = MathUtils.clamp(
      runtime?.opacity ?? composition.earth.cloudOpacity,
      0,
      1
    );
    cloudMaterial.uniforms.reliefLightingScale.value = MathUtils.clamp(
      runtime?.reliefLightingScale ?? 1,
      0,
      1.5
    );
    cloudMaterial.uniforms.reverseSun.value = runtime?.reverseSun ? 1 : 0;
    cloudMaterial.uniforms.reverseSunField.value = runtime?.reverseSunField ? 1 : 0;
    cloudMaterial.uniforms.sunSampleScale.value = MathUtils.clamp(
      runtime?.sunSampleScale ?? 1,
      0,
      1
    );
    onFrame?.({
      cloudBottom,
      cloudTop,
      material: cloudMaterial,
      mesh: cloud.current,
      mobile,
      texture: fieldTexture
    });
  });

  if (!enabled) return null;

  return (
    <mesh
      ref={cloud}
      material={material}
      renderOrder={renderOrder}
      onBeforeRender={onBeforeRender}
      onAfterRender={onAfterRender}
    >
      <sphereGeometry
        args={[
          composition.earth.radius,
          geometrySegments.width,
          geometrySegments.height
        ]}
      />
    </mesh>
  );
}
