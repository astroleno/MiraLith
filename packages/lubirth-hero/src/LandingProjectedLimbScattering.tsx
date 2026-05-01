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

        float whiteNeedle = (1.0 - smoothstep(0.0, 2.4, abs(signedOutside + 0.8))) * (0.28 + day * 0.62);
        float insideBlue = smoothstep(-9.0, -2.0, signedOutside) * (1.0 - smoothstep(1.0, 7.0, signedOutside)) * (0.08 + day * 0.12);
        float blueThickness = smoothstep(0.0, 10.0, signedOutside) * (1.0 - smoothstep(34.0, 78.0, signedOutside)) * (0.09 + day * 0.12);
        float oxygenGreen = smoothstep(-2.0, 8.0, signedOutside) * (1.0 - smoothstep(18.0, 44.0, signedOutside)) * night * 0.22;
        float amberTwilight = smoothstep(-3.0, 8.0, signedOutside) * (1.0 - smoothstep(18.0, 36.0, signedOutside)) * twilight * 0.18;
        float outerCyan = smoothstep(18.0, 42.0, signedOutside) * (1.0 - smoothstep(84.0, 140.0, signedOutside)) * (0.018 + day * 0.018 + night * 0.014);

        vec3 color =
          vec3(0.95, 0.985, 1.0) * whiteNeedle +
          vec3(0.16, 0.5, 1.0) * (insideBlue + blueThickness) +
          vec3(0.22, 0.88, 0.52) * oxygenGreen +
          vec3(1.0, 0.48, 0.16) * amberTwilight +
          vec3(0.12, 0.58, 0.78) * outerCyan;

        float alpha = whiteNeedle + insideBlue + blueThickness + oxygenGreen + amberTwilight + outerCyan;
        float arcMask = upperArc * sideWindow;
        float gain = intensity * (0.84 + closeStage * 0.16) * (1.0 + debugBoost * 0.08);
        alpha *= arcMask * gain;
        color *= arcMask * gain;

        if (alpha < 0.001) {
          discard;
        }

        gl_FragColor = vec4(min(color, vec3(0.98)), clamp(alpha, 0.0, 0.32));
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
