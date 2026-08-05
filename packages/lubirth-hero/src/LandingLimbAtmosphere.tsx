"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  FrontSide,
  MathUtils,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector3
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE,
  LANDING_LIMB_LITE_SUPPORT_RADIUS_SCALE,
  LANDING_RELIEF_LITE_CLOUD_TOP_SCALE
} from "./landingEarthLiteV2Policy";
import {
  PLANET_LIGHTING_GLSL,
  type LandingPlanetLightingFrame
} from "./landingPlanetLighting";
import {
  createLandingGpuTimer,
  type LandingGpuTimerSnapshot
} from "./landingGpuTimer";
import type { LandingComposition } from "./types";

interface LandingLimbAtmosphereProps {
  composition: LandingComposition;
  emphasis?: boolean;
  lightingFrame: LandingPlanetLightingFrame;
  quality: QualityProfile;
}

interface LandingLimbAtmosphereTelemetry {
  active: true;
  atmosphereRadiusScale: number;
  cloudClearanceScale: number;
  gpuTimer: LandingGpuTimerSnapshot;
  loopIterations: 0;
  screenLightDirection: [number, number];
  sunDirection: [number, number, number];
  supportRadiusScale: number;
  textureReads: 0;
}

interface LandingLimbAtmosphereTestOverride {
  intensityScale?: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthLimbAtmosphere?: LandingLimbAtmosphereTelemetry;
    __MiraLithLuBirthLimbAtmosphereOverride?: LandingLimbAtmosphereTestOverride;
  }
}

const cameraWorld = new Vector3();
const cameraLocal = new Vector3();
const cameraRightWorld = new Vector3();
const cameraUpWorld = new Vector3();
const localLight = new Vector3();
const cameraWorldQuaternion = new Quaternion();
const inverseWorldQuaternion = new Quaternion();

function resolveGeometrySegments(quality: QualityProfile) {
  if (quality.tier === "high") {
    return { height: 80, width: 144 };
  }
  if (quality.tier === "medium") {
    return { height: 64, width: 112 };
  }
  return { height: 44, width: 80 };
}

function createLimbAtmosphereMaterial(
  composition: LandingComposition,
  atmosphereRadius: number
) {
  return new ShaderMaterial({
    name: "MiraLithLimbAtmosphere",
    uniforms: {
      atmosphereRadius: { value: atmosphereRadius },
      cameraLocal: { value: new Vector3(0, 0, 4) },
      debugBoost: { value: 0 },
      earthRadius: { value: composition.earth.radius },
      intensity: { value: composition.atmosphere.intensity },
      lightDir: { value: new Vector3(...composition.light.fixedSunDir).normalize() },
      terminatorSoftness: { value: composition.earth.terminatorSoftness }
    },
    vertexShader: `
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float atmosphereRadius;
      uniform vec3 cameraLocal;
      uniform float debugBoost;
      uniform float earthRadius;
      uniform float intensity;
      uniform vec3 lightDir;
      uniform float terminatorSoftness;

      varying vec3 vLocalPosition;

      ${PLANET_LIGHTING_GLSL}

      bool raySphere(vec3 origin, vec3 direction, float radius, out float nearT, out float farT) {
        float b = dot(origin, direction);
        float c = dot(origin, origin) - radius * radius;
        float h = b * b - c;
        if (h < 0.0) {
          return false;
        }
        float root = sqrt(max(h, 0.0));
        nearT = -b - root;
        farT = -b + root;
        return farT > 0.0;
      }

      void main() {
        vec3 rayOrigin = cameraLocal;
        vec3 rayDirection = normalize(vLocalPosition - cameraLocal);
        float atmosphereNear;
        float atmosphereFar;
        if (!raySphere(rayOrigin, rayDirection, atmosphereRadius, atmosphereNear, atmosphereFar)) {
          gl_FragColor = vec4(0.0);
          return;
        }

        float closestT = max(-dot(rayOrigin, rayDirection), 0.0);
        vec3 closestPoint = rayOrigin + rayDirection * closestT;
        float closestRadius = length(closestPoint);
        float atmosphereThickness = max(atmosphereRadius - earthRadius, 0.0001);
        float heightAboveSurface = closestRadius - earthRadius;
        float height01 = clamp(heightAboveSurface / atmosphereThickness, 0.0, 1.0);
        float outsideWidth = max(fwidth(heightAboveSurface) * 1.35, atmosphereThickness * 0.0025);
        float outsideLimb = smoothstep(-outsideWidth, outsideWidth, heightAboveSurface);
        float atmosphereEdge = 1.0 - smoothstep(0.94, 1.0, height01);

        float earthNear;
        float earthFar;
        float pathEnd = atmosphereFar;
        if (raySphere(rayOrigin, rayDirection, earthRadius, earthNear, earthFar)) {
          pathEnd = min(pathEnd, max(earthNear, 0.0));
        }
        float pathLength = max(pathEnd - max(atmosphereNear, 0.0), 0.0);
        float normalizedPath = clamp(pathLength / (atmosphereThickness * 7.5), 0.0, 1.0);

        vec3 tangentNormal = normalize(closestPoint);
        float normalSunDot = dot(tangentNormal, normalize(lightDir));
        PlanetLightMasks lightMasks = resolvePlanetLightMasks(
          normalSunDot,
          terminatorSoftness
        );
        float dayVisibility = lightMasks.dayMask;
        float twilightVisibility = lightMasks.twilightMask;
        float deepNightVisibility = lightMasks.deepNightMask;

        float innerLobe = exp(-height01 * 24.0) * normalizedPath;
        float outerLobe = exp(-height01 * 4.25) * pow(normalizedPath, 0.42);
        float forward = pow(max(dot(-rayDirection, normalize(lightDir)), 0.0), 5.0);
        vec3 innerColor = mix(
          vec3(0.2, 0.5, 0.9),
          vec3(0.78, 0.93, 1.0),
          0.4 + forward * 0.3
        );
        vec3 outerColor = vec3(0.15, 0.3, 0.52);
        vec3 warmColor = vec3(1.0, 0.3, 0.045);
        vec3 airglowColor = vec3(0.13, 0.3, 0.48);

        vec3 color = innerColor * innerLobe * dayVisibility *
          (0.72 + forward * 0.2);
        color += outerColor * outerLobe * dayVisibility * 0.46;
        color += warmColor * twilightVisibility *
          (innerLobe * 0.78 + outerLobe * 0.25);
        color += airglowColor * deepNightVisibility *
          (innerLobe * 0.00012 + outerLobe * 0.00006);
        color *= outsideLimb * atmosphereEdge *
          intensity * (1.0 + debugBoost * 0.18);
        float blendAlpha = clamp(
          0.03 + dayVisibility * 0.35 + twilightVisibility * 0.25,
          0.03,
          0.42
        );
        gl_FragColor = vec4(max(color, vec3(0.0)), blendAlpha);
      }
    `,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: FrontSide,
    transparent: true
  });
}

export function LandingLimbAtmosphere({
  composition,
  emphasis = false,
  lightingFrame,
  quality
}: LandingLimbAtmosphereProps) {
  const atmosphere = useRef<Mesh>(null);
  const { camera, gl } = useThree();
  const visualTestOverridesEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("visualTest") === "pixels";
  }, []);
  const gpuTimerEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("visualTest") === "performance" ||
      params.get("reliefLiteGpuTimer") === "on" ||
      params.get("reliefLiteValidation") === "on";
  }, []);
  const gpuTimer = useMemo(
    () => createLandingGpuTimer(gl.getContext(), gpuTimerEnabled),
    [gl, gpuTimerEnabled]
  );
  const atmosphereRadius =
    composition.earth.radius * LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE;
  const supportRadius =
    composition.earth.radius * LANDING_LIMB_LITE_SUPPORT_RADIUS_SCALE;
  const geometrySegments = resolveGeometrySegments(quality);
  const material = useMemo(
    () => createLimbAtmosphereMaterial(composition, atmosphereRadius),
    [atmosphereRadius, composition]
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => gpuTimer.dispose(), [gpuTimer]);
  useEffect(() => () => {
    window.__MiraLithLuBirthLimbAtmosphere = undefined;
  }, []);

  useFrame(() => {
    if (!atmosphere.current) {
      return;
    }

    atmosphere.current.updateWorldMatrix(true, false);
    camera.getWorldPosition(cameraWorld);
    camera.getWorldQuaternion(cameraWorldQuaternion);
    cameraRightWorld.set(1, 0, 0).applyQuaternion(cameraWorldQuaternion).normalize();
    cameraUpWorld.set(0, 1, 0).applyQuaternion(cameraWorldQuaternion).normalize();
    cameraLocal.copy(cameraWorld);
    atmosphere.current.worldToLocal(cameraLocal);
    atmosphere.current.getWorldQuaternion(inverseWorldQuaternion).invert();
    localLight
      .copy(lightingFrame.sunDirection)
      .normalize()
      .applyQuaternion(inverseWorldQuaternion)
      .normalize();

    material.uniforms.cameraLocal.value.copy(cameraLocal);
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
    const visualTestOverride = visualTestOverridesEnabled
      ? window.__MiraLithLuBirthLimbAtmosphereOverride
      : undefined;
    material.uniforms.intensity.value = composition.atmosphere.enabled
      ? composition.atmosphere.intensity * MathUtils.clamp(
        visualTestOverride?.intensityScale ?? 1,
        0,
        1
      )
      : 0;
    material.uniforms.lightDir.value.copy(localLight);

    const screenLightX = lightingFrame.sunDirection.dot(cameraRightWorld);
    const screenLightY = lightingFrame.sunDirection.dot(cameraUpWorld);
    const screenLength = Math.max(Math.hypot(screenLightX, screenLightY), 0.001);
    window.__MiraLithLuBirthLimbAtmosphere = {
      active: true,
      atmosphereRadiusScale: LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE,
      cloudClearanceScale:
        LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE - LANDING_RELIEF_LITE_CLOUD_TOP_SCALE,
      gpuTimer: gpuTimer.poll(),
      loopIterations: 0,
      screenLightDirection: [screenLightX / screenLength, -screenLightY / screenLength],
      sunDirection: [
        lightingFrame.sunDirection.x,
        lightingFrame.sunDirection.y,
        lightingFrame.sunDirection.z
      ],
      supportRadiusScale: LANDING_LIMB_LITE_SUPPORT_RADIUS_SCALE,
      textureReads: 0
    };
  });

  if (!composition.atmosphere.enabled || quality.tier === "fallback") {
    return null;
  }

  return (
    <mesh
      ref={atmosphere}
      material={material}
      renderOrder={14}
      onBeforeRender={gpuTimerEnabled ? gpuTimer.begin : undefined}
      onAfterRender={gpuTimerEnabled ? gpuTimer.end : undefined}
    >
      <sphereGeometry
        args={[
          supportRadius,
          geometrySegments.width,
          geometrySegments.height
        ]}
      />
    </mesh>
  );
}
