"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  MathUtils,
  Mesh,
  OneFactor,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import {
  LANDING_LIMB_LITE_DIFFUSE_RADIUS_SCALE,
  LANDING_LIMB_LITE_DIFFUSE_SUPPORT_RADIUS_SCALE
} from "./landingEarthLiteV2Policy";
import {
  type LandingPlanetLightingFrame
} from "./landingPlanetLighting";
import {
  createLandingGpuTimer,
  type LandingGpuTimerSnapshot
} from "./landingGpuTimer";
import type { LandingComposition } from "./types";

interface LandingLimbDiffuseGlowProps {
  composition: LandingComposition;
  emphasis?: boolean;
  lightingFrame: LandingPlanetLightingFrame;
  quality: QualityProfile;
}

interface LandingLimbDiffuseGlowTelemetry {
  active: true;
  additiveMode: "one-one";
  diffuseRadiusScale: number;
  geometry: "analytic-composite-limb-strip";
  gpuTimer: LandingGpuTimerSnapshot;
  includesInternalLimb: true;
  innerLimbRadiusScale: number;
  supportRadiusScale: number;
  textureReads: 0;
  sunDirection: [number, number, number];
}

interface LandingLimbDiffuseGlowTestOverride {
  intensityScale?: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthLimbDiffuseGlow?: LandingLimbDiffuseGlowTelemetry;
    __MiraLithLuBirthLimbDiffuseGlowOverride?: LandingLimbDiffuseGlowTestOverride;
  }
}

const cameraForwardWorld = new Vector3();
const cameraRightWorld = new Vector3();
const cameraUpWorld = new Vector3();
const cameraWorldQuaternion = new Quaternion();
const inverseParentWorldQuaternion = new Quaternion();
const localBillboardQuaternion = new Quaternion();
const parentWorldQuaternion = new Quaternion();
const stripLightDirection = new Vector2(1, 0);
const INNER_LIMB_RADIUS_SCALE = 0.955;
const OUTER_LIMB_BLEND_RADIUS_SCALE = 1.003;

function createDiffuseGlowMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    name: "MiraLithLimbDiffuseGlow",
    uniforms: {
      diffuseRadiusScale: { value: LANDING_LIMB_LITE_DIFFUSE_RADIUS_SCALE },
      earthRadius: { value: composition.earth.radius },
      intensity: { value: composition.atmosphere.intensity },
      stripLightDir: { value: new Vector2(1, 0) },
      sunForward: { value: 0 },
      supportRadiusScale: { value: LANDING_LIMB_LITE_DIFFUSE_SUPPORT_RADIUS_SCALE }
    },
    vertexShader: `
      uniform float earthRadius;
      varying vec2 vLocalDisc;

      void main() {
        vLocalDisc = position.xy / max(earthRadius, 0.0001);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float diffuseRadiusScale;
      uniform float earthRadius;
      uniform float intensity;
      uniform vec2 stripLightDir;
      uniform float sunForward;
      uniform float supportRadiusScale;
      varying vec2 vLocalDisc;

      void main() {
        float radial = length(vLocalDisc);
        if (radial < ${INNER_LIMB_RADIUS_SCALE.toFixed(3)} || radial > supportRadiusScale) {
          discard;
        }

        float innerBand = clamp((radial - ${INNER_LIMB_RADIUS_SCALE.toFixed(3)}) /
          ${(OUTER_LIMB_BLEND_RADIUS_SCALE - INNER_LIMB_RADIUS_SCALE).toFixed(3)}, 0.0, 1.0);
        float heightAboveSurface = max(radial - 1.0, 0.0);
        float supportThickness = max(supportRadiusScale - 1.0, 0.0001);
        float diffuseThickness = max(diffuseRadiusScale - 1.0, supportThickness * 0.72);
        float height01 = clamp(heightAboveSurface / supportThickness, 0.0, 1.0);
        float diffuse01 = clamp(heightAboveSurface / diffuseThickness, 0.0, 1.0);
        float innerFeather = max(fwidth(radial) * 2.4, 0.0015);
        float outsideLimb = smoothstep(0.003, 0.003 + innerFeather, heightAboveSurface);
        float outerFalloff = 1.0 - smoothstep(0.9, 1.0, height01);
        float insideDisc = 1.0 - smoothstep(0.999, ${OUTER_LIMB_BLEND_RADIUS_SCALE.toFixed(3)}, radial);
        if (outerFalloff <= 0.001 && insideDisc <= 0.001) {
          discard;
        }

        vec2 radialNormal = vLocalDisc / max(radial, 0.0001);
        vec2 sunPlane = normalize(stripLightDir);
        float normalSunDot = dot(radialNormal, sunPlane);
        if (normalSunDot < -0.05) {
          discard;
        }
        float dayVisibility = smoothstep(-0.04, 0.42, normalSunDot);
        float forward = pow(clamp(sunForward * 0.5 + 0.5, 0.0, 1.0), 1.6);
        float blueCore = smoothstep(0.06, 0.55, innerBand) *
          (1.0 - smoothstep(0.76, 1.0, innerBand)) * insideDisc;
        float whiteNeedle = smoothstep(0.78, 0.94, innerBand) *
          (1.0 - smoothstep(0.965, 1.0, innerBand)) * insideDisc;
        float diffuseLobe = outsideLimb * outerFalloff *
          mix(exp(-diffuse01 * 1.9), pow(1.0 - height01, 1.5), 0.24);

        vec3 blueColor = mix(vec3(0.035, 0.14, 0.33), vec3(0.12, 0.42, 0.8), forward);
        vec3 diffuseColor = mix(vec3(0.03, 0.12, 0.28), vec3(0.1, 0.36, 0.68), forward);
        vec3 color =
          blueColor * blueCore * dayVisibility * (0.018 + dayVisibility * 0.13) +
          vec3(0.66, 0.88, 1.0) * whiteNeedle * dayVisibility * (0.025 + dayVisibility * 0.18) +
          diffuseColor * diffuseLobe * dayVisibility * (0.19 + forward * 0.045);
        color *= intensity;

        gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
      }
    `,
    blendEquation: AddEquation,
    blendDst: OneFactor,
    blendSrc: OneFactor,
    blending: CustomBlending,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    transparent: true
  });
}

export function LandingLimbDiffuseGlow({
  composition,
  emphasis = false,
  lightingFrame,
  quality
}: LandingLimbDiffuseGlowProps) {
  const glow = useRef<Mesh>(null);
  const { camera, gl } = useThree();
  const visualTestOverridesEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("visualTest") === "pixels";
  }, []);
  const earthRadius = composition.earth.radius;
  const innerStripRadius = earthRadius * INNER_LIMB_RADIUS_SCALE;
  const supportRadius = earthRadius * LANDING_LIMB_LITE_DIFFUSE_SUPPORT_RADIUS_SCALE;
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
  const material = useMemo(
    () => createDiffuseGlowMaterial(composition),
    [composition]
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => gpuTimer.dispose(), [gpuTimer]);
  useEffect(() => () => {
    window.__MiraLithLuBirthLimbDiffuseGlow = undefined;
  }, []);

  useFrame(() => {
    if (!glow.current) {
      return;
    }

    camera.getWorldQuaternion(cameraWorldQuaternion);
    if (glow.current.parent) {
      glow.current.parent.getWorldQuaternion(parentWorldQuaternion);
      inverseParentWorldQuaternion.copy(parentWorldQuaternion).invert();
      localBillboardQuaternion.copy(inverseParentWorldQuaternion).multiply(cameraWorldQuaternion);
      glow.current.quaternion.copy(localBillboardQuaternion);
    } else {
      glow.current.quaternion.copy(cameraWorldQuaternion);
    }
    cameraForwardWorld.set(0, 0, -1).applyQuaternion(cameraWorldQuaternion).normalize();
    cameraRightWorld.set(1, 0, 0).applyQuaternion(cameraWorldQuaternion).normalize();
    cameraUpWorld.set(0, 1, 0).applyQuaternion(cameraWorldQuaternion).normalize();
    stripLightDirection.set(
      lightingFrame.sunDirection.dot(cameraRightWorld),
      lightingFrame.sunDirection.dot(cameraUpWorld)
    );
    if (stripLightDirection.lengthSq() < 0.001) {
      stripLightDirection.set(1, 0);
    } else {
      stripLightDirection.normalize();
    }
    material.uniforms.stripLightDir.value.copy(stripLightDirection);
    material.uniforms.sunForward.value = lightingFrame.sunDirection.dot(cameraForwardWorld);
    const visualTestOverride = visualTestOverridesEnabled
      ? window.__MiraLithLuBirthLimbDiffuseGlowOverride
      : undefined;
    material.uniforms.intensity.value = composition.atmosphere.intensity *
      (emphasis ? 1.18 : 1) *
      MathUtils.clamp(visualTestOverride?.intensityScale ?? 1, 0, 1);

    window.__MiraLithLuBirthLimbDiffuseGlow = {
      active: true,
      additiveMode: "one-one",
      diffuseRadiusScale: LANDING_LIMB_LITE_DIFFUSE_RADIUS_SCALE,
      geometry: "analytic-composite-limb-strip",
      gpuTimer: gpuTimer.poll(),
      includesInternalLimb: true,
      innerLimbRadiusScale: INNER_LIMB_RADIUS_SCALE,
      supportRadiusScale: LANDING_LIMB_LITE_DIFFUSE_SUPPORT_RADIUS_SCALE,
      sunDirection: [
        lightingFrame.sunDirection.x,
        lightingFrame.sunDirection.y,
        lightingFrame.sunDirection.z
      ],
      textureReads: 0
    };
  });

  if (quality.tier === "fallback") {
    return null;
  }

  return (
    <mesh
      ref={glow}
      material={material}
      renderOrder={19}
      onBeforeRender={gpuTimerEnabled ? gpuTimer.begin : undefined}
      onAfterRender={gpuTimerEnabled ? gpuTimer.end : undefined}
    >
      <ringGeometry args={[innerStripRadius, supportRadius, 128, 1]} />
    </mesh>
  );
}
