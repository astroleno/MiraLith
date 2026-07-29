"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  FrontSide,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector3
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  LANDING_NASA_LITE_ATMOSPHERE_OPTICAL_THICKNESS_SCALE,
  LANDING_NASA_LITE_ATMOSPHERE_RADIUS_SCALE,
  isLandingNasaLiteMobileViewport,
  resolveLandingNasaLiteBudget,
  type LandingNasaLiteBudget
} from "./landingNasaLitePolicy";
import { createLandingGpuTimer, type LandingGpuTimerSnapshot } from "./landingGpuTimer";
import type { LandingComposition, LandingProjectedEarthFrame } from "./types";

interface LandingDirectionalAtmosphereProps {
  composition: LandingComposition;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
}

interface DirectionalAtmosphereTelemetry {
  active: boolean;
  atmosphereRadiusScale: number;
  band: LandingNasaLiteBudget["band"];
  geometryHeightSegments: number;
  geometryWidthSegments: number;
  gpuTimer: LandingGpuTimerSnapshot;
  mobile: boolean;
  opticalThicknessScale: number;
  projectedRadiusRatio: number;
  screenLightDirection: [number, number];
  supportRadiusScale: number;
  viewSteps: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthDirectionalAtmosphere?: DirectionalAtmosphereTelemetry;
  }
}

const cameraWorld = new Vector3();
const cameraLocal = new Vector3();
const cameraRightWorld = new Vector3();
const cameraUpWorld = new Vector3();
const localLight = new Vector3();
const fallbackLight = new Vector3();
const testLightWorld = new Vector3();
const cameraWorldQuaternion = new Quaternion();
const worldQuaternion = new Quaternion();
const ATMOSPHERE_SUPPORT_RADIUS_SCALE = 1.02;

function resolveAtmosphereGeometrySegments(quality: QualityProfile) {
  if (quality.tier === "high") {
    return { height: 72, width: 128 };
  }
  if (quality.tier === "medium") {
    return { height: 56, width: 96 };
  }
  return { height: 36, width: 64 };
}

function createDirectionalAtmosphereMaterial(
  composition: LandingComposition,
  atmosphereRadius: number,
  atmosphereOpticalThickness: number
) {
  return new ShaderMaterial({
    name: "MiraLithNasaLiteDirectionalAtmosphere",
    uniforms: {
      atmosphereRadius: { value: atmosphereRadius },
      atmosphereOpticalThickness: { value: atmosphereOpticalThickness },
      cameraLocal: { value: new Vector3(0, 0, 4) },
      debugBoost: { value: 0 },
      earthRadius: { value: composition.earth.radius },
      intensity: { value: composition.atmosphere.intensity },
      lightDir: { value: new Vector3(...composition.light.fixedSunDir).normalize() },
      viewSteps: { value: 4 }
    },
    vertexShader: `
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 cameraLocal;
      uniform vec3 lightDir;
      uniform float earthRadius;
      uniform float atmosphereRadius;
      uniform float atmosphereOpticalThickness;
      uniform float intensity;
      uniform float viewSteps;
      uniform float debugBoost;

      varying vec3 vLocalPosition;

      const float PI = 3.14159265359;

      float clamp01(float value) {
        return clamp(value, 0.0, 1.0);
      }

      bool raySphere(vec3 origin, vec3 direction, float radius, out float t0, out float t1) {
        float b = dot(origin, direction);
        float c = dot(origin, origin) - radius * radius;
        float h = b * b - c;
        if (h < 0.0) {
          return false;
        }
        h = sqrt(h);
        t0 = -b - h;
        t1 = -b + h;
        return t1 > 0.0;
      }

      float rayleighPhase(float mu) {
        return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
      }

      float miePhase(float mu) {
        float g = 0.72;
        float gg = g * g;
        return ((3.0 * (1.0 - gg)) / (2.0 * (2.0 + gg))) *
          ((1.0 + mu * mu) / pow(max(1.0 + gg - 2.0 * g * mu, 0.0001), 1.5));
      }

      vec2 densityAt(vec3 point) {
        float height01 = max(
          (length(point) - earthRadius) / max(atmosphereOpticalThickness, 0.001),
          0.0
        );
        return vec2(exp(-height01 / 0.3), exp(-height01 / 0.105));
      }

      void main() {
        vec3 rayOrigin = cameraLocal;
        vec3 rayDirection = normalize(vLocalPosition - cameraLocal);
        float atmosphereB = dot(rayOrigin, rayDirection);
        float atmosphereC = dot(rayOrigin, rayOrigin) -
          atmosphereRadius * atmosphereRadius;
        float atmosphereH = atmosphereB * atmosphereB - atmosphereC;
        float atmosphereEdgeWidth = max(fwidth(atmosphereH) * 1.65, 0.00001);
        if (atmosphereH < -atmosphereEdgeWidth) {
          gl_FragColor = vec4(0.0);
          return;
        }
        float atmosphereEdge = smoothstep(
          -atmosphereEdgeWidth,
          atmosphereEdgeWidth,
          atmosphereH
        );
        float atmosphereRoot = sqrt(max(atmosphereH, 0.0));
        float atmosphereNear = -atmosphereB - atmosphereRoot;
        float atmosphereFar = -atmosphereB + atmosphereRoot;

        float groundNear;
        float groundFar;
        if (raySphere(rayOrigin, rayDirection, earthRadius, groundNear, groundFar)) {
          atmosphereFar = min(atmosphereFar, max(groundNear, 0.0));
        }

        float marchStart = max(atmosphereNear, 0.0);
        float marchEnd = atmosphereFar;
        if (marchEnd <= marchStart) {
          gl_FragColor = vec4(0.0);
          return;
        }

        float segmentLength = marchEnd - marchStart;
        float stepSize = segmentLength / max(viewSteps, 1.0);
        float mu = dot(-rayDirection, lightDir);
        float rayleigh = rayleighPhase(mu);
        float mie = min(miePhase(mu), 6.0);
        vec3 accumulated = vec3(0.0);
        vec2 opticalDepth = vec2(0.0);

        for (int index = 0; index < 4; index += 1) {
          if (float(index) < viewSteps) {
            vec3 samplePoint = rayOrigin + rayDirection * (marchStart + stepSize * (float(index) + 0.5));
            vec3 normal = normalize(samplePoint);
            float sun = dot(normal, lightDir);
            float day = smoothstep(-0.2, 0.32, sun);
            float twilight = smoothstep(-0.34, 0.02, sun) * (1.0 - smoothstep(0.08, 0.4, sun));
            vec2 density = densityAt(samplePoint) * stepSize;
            opticalDepth += density;
            vec3 extinction = exp(
              -vec3(3.8, 7.4, 15.8) * opticalDepth.x
              -vec3(1.1, 1.25, 1.45) * opticalDepth.y
            );
            vec3 rayleighColor = vec3(0.16, 0.46, 1.0) * rayleigh * density.x * 7.8;
            vec3 mieColor = vec3(0.9, 0.94, 1.0) * mie * density.y * 0.34;
            vec3 sunsetColor = vec3(1.0, 0.34, 0.08) * twilight * density.y * 1.2;
            accumulated += (rayleighColor + mieColor + sunsetColor) * extinction * (0.08 + day * 0.92);
          }
        }

        vec3 shellNormal = normalize(
          rayOrigin + rayDirection * max(atmosphereNear, 0.0)
        );
        float limb = 1.0 - clamp01(dot(shellNormal, -rayDirection));
        float limbGate = smoothstep(0.46, 0.83, limb);
        float sunShell = dot(shellNormal, lightDir);
        float directionalDayArc = smoothstep(-0.18, 0.28, sunShell);
        float twilightArc = smoothstep(-0.28, 0.02, sunShell) *
          (1.0 - smoothstep(0.12, 0.42, sunShell));
        float directionalVisibility = 0.045 + directionalDayArc * 0.955 + twilightArc * 0.16;
        accumulated += vec3(0.16, 0.48, 1.0) * directionalDayArc * pow(limb, 2.45) * 0.105;
        accumulated += vec3(0.98, 0.42, 0.12) * twilightArc * pow(limb, 2.9) * 0.027;
        accumulated *= atmosphereEdge * limbGate * directionalVisibility *
          intensity * (1.0 + debugBoost * 0.18) * 2.15;
        float alpha = clamp(length(accumulated) * 1.75, 0.0, 0.46);
        float edgeWidth = max(fwidth(alpha) * 1.2, 0.001);
        float softVisibility = smoothstep(0.001 - edgeWidth, 0.001 + edgeWidth, alpha);
        accumulated *= softVisibility;
        alpha *= softVisibility;
        gl_FragColor = vec4(max(accumulated / max(alpha, 0.001), vec3(0.0)), alpha);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    side: FrontSide,
    depthTest: true,
    depthWrite: false
  });
}

export function LandingDirectionalAtmosphere({
  composition,
  quality,
  projection,
  sceneLightDirection,
  emphasis = false
}: LandingDirectionalAtmosphereProps) {
  const atmosphere = useRef<Mesh>(null);
  const budget = useRef<LandingNasaLiteBudget>({
    atmosphereSteps: 4,
    band: "near",
    cloudLightSamples: 1,
    cloudViewSteps: 4,
    mobile: false,
    projectedRadiusRatio: 1
  });
  const { camera, gl, size } = useThree();
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
    return params.get("visualTest") === "performance" || params.get("nasaLiteGpuTimer") === "on";
  }, []);
  const gpuTimer = useMemo(
    () => createLandingGpuTimer(gl.getContext(), gpuTimerEnabled),
    [gl, gpuTimerEnabled]
  );
  const atmosphereRadius =
    composition.earth.radius * LANDING_NASA_LITE_ATMOSPHERE_RADIUS_SCALE;
  const atmosphereSupportRadius =
    composition.earth.radius * ATMOSPHERE_SUPPORT_RADIUS_SCALE;
  const atmosphereOpticalThickness =
    composition.earth.radius * LANDING_NASA_LITE_ATMOSPHERE_OPTICAL_THICKNESS_SCALE;
  const geometrySegments = resolveAtmosphereGeometrySegments(quality);
  const material = useMemo(
    () => createDirectionalAtmosphereMaterial(
      composition,
      atmosphereRadius,
      atmosphereOpticalThickness
    ),
    [atmosphereOpticalThickness, atmosphereRadius, composition]
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => gpuTimer.dispose(), [gpuTimer]);
  useEffect(() => () => {
    window.__MiraLithLuBirthDirectionalAtmosphere = undefined;
  }, []);

  useFrame(() => {
    if (!atmosphere.current) {
      return;
    }

    const touchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints;
    const mobile = isLandingNasaLiteMobileViewport(size.width, size.height, touchPoints);
    const radiusRatio = projection.current.radius / Math.max(1, Math.min(size.width, size.height));
    const nextBudget = resolveLandingNasaLiteBudget({
      mobile,
      previousBand: budget.current.band,
      projectedRadiusRatio: radiusRatio,
      qualityTier: quality.tier
    });
    const visualOverride = visualTestOverridesEnabled
      ? window.__MiraLithLuBirthNasaLiteBudgetOverride
      : undefined;
    if (visualTestOverridesEnabled) {
      nextBudget.atmosphereSteps = visualOverride?.atmosphereSteps ?? nextBudget.atmosphereSteps;
    }
    budget.current = nextBudget;
    const atmosphereMaterial = atmosphere.current.material as ShaderMaterial;

    atmosphere.current.updateWorldMatrix(true, false);
    camera.getWorldPosition(cameraWorld);
    camera.getWorldQuaternion(cameraWorldQuaternion);
    cameraRightWorld.set(1, 0, 0).applyQuaternion(cameraWorldQuaternion).normalize();
    cameraUpWorld.set(0, 1, 0).applyQuaternion(cameraWorldQuaternion).normalize();
    cameraLocal.copy(cameraWorld);
    atmosphere.current.worldToLocal(cameraLocal);
    const activeLight = visualOverride?.atmosphereLightScreenSide
      ? testLightWorld.copy(cameraRightWorld).multiplyScalar(visualOverride.atmosphereLightScreenSide)
      : sceneLightDirection ?? fallbackLight.set(...composition.light.fixedSunDir);
    const screenLightX = activeLight.dot(cameraRightWorld);
    const screenLightY = activeLight.dot(cameraUpWorld);
    const screenLightLength = Math.max(Math.hypot(screenLightX, screenLightY), 0.001);
    atmosphere.current.getWorldQuaternion(worldQuaternion).invert();
    localLight.copy(activeLight).normalize().applyQuaternion(worldQuaternion).normalize();

    atmosphereMaterial.uniforms.cameraLocal.value.copy(cameraLocal);
    atmosphereMaterial.uniforms.debugBoost.value = emphasis ? 1 : 0;
    atmosphereMaterial.uniforms.intensity.value = composition.atmosphere.enabled
      ? composition.atmosphere.intensity
      : 0;
    atmosphereMaterial.uniforms.lightDir.value.copy(localLight);
    atmosphereMaterial.uniforms.viewSteps.value = nextBudget.atmosphereSteps;

    window.__MiraLithLuBirthDirectionalAtmosphere = {
      active: true,
      atmosphereRadiusScale: LANDING_NASA_LITE_ATMOSPHERE_RADIUS_SCALE,
      band: nextBudget.band,
      geometryHeightSegments: geometrySegments.height,
      geometryWidthSegments: geometrySegments.width,
      gpuTimer: gpuTimer.poll(),
      mobile: nextBudget.mobile,
      opticalThicknessScale: LANDING_NASA_LITE_ATMOSPHERE_OPTICAL_THICKNESS_SCALE,
      projectedRadiusRatio: nextBudget.projectedRadiusRatio,
      screenLightDirection: [
        screenLightX / screenLightLength,
        -screenLightY / screenLightLength
      ],
      supportRadiusScale: ATMOSPHERE_SUPPORT_RADIUS_SCALE,
      viewSteps: nextBudget.atmosphereSteps
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
      onBeforeRender={gpuTimer.begin}
      onAfterRender={gpuTimer.end}
    >
      <sphereGeometry
        args={[
          atmosphereSupportRadius,
          geometrySegments.width,
          geometrySegments.height
        ]}
      />
    </mesh>
  );
}
