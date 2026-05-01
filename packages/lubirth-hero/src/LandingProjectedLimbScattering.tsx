"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  Mesh,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
  type PerspectiveCamera
} from "three";
import { type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingProjectedEarthFrame } from "./types";

interface LandingProjectedLimbScatteringProps {
  composition: LandingComposition;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  emphasis?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthProjectedLimbScatteringActive?: boolean;
  }
}

const forward = new Vector3();

function fitOverlayToCamera(mesh: Mesh, camera: PerspectiveCamera, aspect: number) {
  const distance = 1;
  const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
  const width = height * aspect;

  forward.set(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(distance);
  mesh.position.copy(camera.position).add(forward);
  mesh.quaternion.copy(camera.quaternion);
  mesh.scale.set(width, height, 1);
}

function createLimbScatteringMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      earthCenter: { value: new Vector2(0, 0) },
      earthRadius: { value: 1 },
      sunDirection: { value: new Vector2(0, 1) },
      progress: { value: 0 },
      intensity: { value: composition.atmosphere.intensity },
      debugBoost: { value: 0 }
    },
    vertexShader: `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 earthCenter;
      uniform float earthRadius;
      uniform vec2 sunDirection;
      uniform float progress;
      uniform float intensity;
      uniform float debugBoost;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i += 1) {
          value += noise2(p) * amplitude;
          p = p * 2.04 + vec2(4.3, 7.1);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 p = gl_FragCoord.xy;
        vec2 fromCenter = p - earthCenter;
        float distanceToCenter = length(fromCenter);
        vec2 edgeNormal = distanceToCenter > 0.001 ? fromCenter / distanceToCenter : vec2(0.0, 1.0);
        float signedOutside = distanceToCenter - earthRadius;
        float upperArc = smoothstep(0.02, 0.34, edgeNormal.y);
        float sideWindow = smoothstep(-0.98, -0.62, edgeNormal.x) * (1.0 - smoothstep(0.62, 0.98, edgeNormal.x));

        float sunDot = dot(edgeNormal, normalize(sunDirection));
        float day = smoothstep(-0.2, 0.34, sunDot);
        float night = 1.0 - smoothstep(-0.18, 0.18, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.28, abs(sunDot));
        float closeStage = 1.0 - smoothstep(0.12, 0.78, progress);

        float angle = atan(edgeNormal.y, edgeNormal.x) / 3.14159265;
        float cloudOcclusion = smoothstep(0.58, 0.86, fbm(vec2(angle * 18.0 + 1.4, 2.0))) *
          smoothstep(-6.0, 8.0, signedOutside) *
          (1.0 - smoothstep(18.0, 44.0, signedOutside)) *
          0.34;

        float whiteNeedle = (1.0 - smoothstep(0.0, mix(1.6, 2.4, debugBoost), abs(signedOutside + 0.4))) *
          (0.22 + day * 0.62);
        float insideBlue = smoothstep(-5.0, -1.0, signedOutside) *
          (1.0 - smoothstep(0.0, 4.0, signedOutside)) *
          (0.05 + day * 0.08);
        float blueThickness = smoothstep(0.0, mix(4.0, 8.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(14.0, 28.0, debugBoost), mix(32.0, 68.0, debugBoost), signedOutside)) *
          (0.055 + day * 0.08);
        float oxygenGreen = smoothstep(1.0, mix(6.0, 8.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(12.0, 18.0, debugBoost), mix(28.0, 44.0, debugBoost), signedOutside)) *
          night *
          mix(0.055, 0.16, debugBoost);
        float amberTwilight = smoothstep(1.0, mix(7.0, 9.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(12.0, 18.0, debugBoost), mix(26.0, 38.0, debugBoost), signedOutside)) *
          twilight *
          mix(0.065, 0.13, debugBoost);
        float outerCyan = smoothstep(12.0, mix(28.0, 42.0, debugBoost), signedOutside) *
          (1.0 - smoothstep(mix(54.0, 80.0, debugBoost), mix(96.0, 138.0, debugBoost), signedOutside)) *
          mix(0.006, 0.018, debugBoost);
        whiteNeedle *= 1.0 - cloudOcclusion;
        insideBlue *= 1.0 - cloudOcclusion * 0.72;
        blueThickness *= 1.0 - cloudOcclusion * 0.58;

        vec3 color =
          vec3(0.95, 0.985, 1.0) * whiteNeedle +
          vec3(0.14, 0.44, 0.92) * (insideBlue + blueThickness) +
          vec3(0.16, 0.66, 0.43) * oxygenGreen +
          vec3(0.92, 0.42, 0.14) * amberTwilight +
          vec3(0.1, 0.48, 0.72) * outerCyan;

        float alpha = whiteNeedle + insideBlue + blueThickness + oxygenGreen + amberTwilight + outerCyan;
        float arcMask = upperArc * sideWindow;
        float gain = intensity * (0.58 + closeStage * 0.1) * (1.0 + debugBoost * 0.22);
        alpha *= arcMask * gain;
        color *= arcMask * gain;

        if (alpha < 0.001) {
          discard;
        }

        gl_FragColor = vec4(min(color, vec3(0.94)), clamp(alpha, 0.0, mix(0.18, 0.3, debugBoost)));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingProjectedLimbScattering({
  composition,
  quality,
  projection,
  emphasis = false
}: LandingProjectedLimbScatteringProps) {
  const overlay = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(() => createLimbScatteringMaterial(composition), [composition]);
  const enabled =
    composition.atmosphere.enabled &&
    composition.atmosphere.intensity > 0 &&
    quality.tier !== "fallback";

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthProjectedLimbScatteringActive = enabled;
    return () => {
      window.__MiraLithLuBirthProjectedLimbScatteringActive = false;
    };
  }, [enabled]);

  useFrame(() => {
    if (!overlay.current || !enabled || !("fov" in camera)) {
      return;
    }

    fitOverlayToCamera(overlay.current, camera, size.width / Math.max(size.height, 1));
    material.uniforms.earthCenter.value.copy(projection.current.center);
    material.uniforms.earthRadius.value = projection.current.radius;
    material.uniforms.sunDirection.value.copy(projection.current.sunDirection);
    material.uniforms.progress.value = projection.current.progress;
    material.uniforms.intensity.value = composition.atmosphere.enabled ? composition.atmosphere.intensity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={overlay} material={material} renderOrder={20} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
