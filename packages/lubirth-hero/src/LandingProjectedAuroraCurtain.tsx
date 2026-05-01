"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  type PerspectiveCamera
} from "three";
import { type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingProjectedEarthFrame } from "./types";

interface LandingProjectedAuroraCurtainProps {
  composition: LandingComposition;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  debugProfile?: boolean;
  visibilityBoost?: number;
  reducedMotion?: boolean;
  paused?: boolean;
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

function createAuroraCurtainMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      earthCenter: { value: new Vector2(0, 0) },
      earthRadius: { value: 1 },
      sunDirection: { value: new Vector2(0, 1) },
      time: { value: 0 },
      progress: { value: 0 },
      intensity: { value: composition.aurora.intensity },
      debugGain: { value: 0 }
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
      uniform float time;
      uniform float progress;
      uniform float intensity;
      uniform float debugGain;

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
          p = p * 2.02 + vec2(5.8, 2.4);
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
        float upperArc = smoothstep(0.08, 0.36, edgeNormal.y);
        float sideWindow = smoothstep(-0.94, -0.48, edgeNormal.x) * (1.0 - smoothstep(0.5, 0.96, edgeNormal.x));
        float sunDot = dot(edgeNormal, normalize(sunDirection));
        float night = 1.0 - smoothstep(-0.28, 0.1, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.3, abs(sunDot));
        float arcWindow = mix(max(night, twilight * 0.32), 1.0, debugGain * 0.62);

        float rootMask = (1.0 - smoothstep(0.0, 7.0, abs(signedOutside - 2.0))) * 0.95;
        float outside = smoothstep(-3.0, 8.0, signedOutside);
        float topFade = 1.0 - smoothstep(mix(64.0, 126.0, debugGain), mix(132.0, 236.0, debugGain), signedOutside);
        float body = outside * topFade * smoothstep(-22.0, -4.0, signedOutside);

        float angle = atan(edgeNormal.y, edgeNormal.x) / 3.14159265;
        float height = max(signedOutside, 0.0);
        vec2 curtainUv = vec2(angle * 16.0 + time * 0.006, height * 0.028 - time * 0.012);
        float folds =
          sin(angle * 92.0 + fbm(vec2(angle * 19.0, height * 0.035 + time * 0.018)) * 4.0) * 0.32 +
          sin(angle * 181.0 + height * 0.052 + time * 0.016) * 0.1;
        float columnNoise = fbm(curtainUv + vec2(3.2, 1.1));
        float columnHeight = smoothstep(0.24, 0.82, fbm(vec2(angle * 21.0 - time * 0.006, 2.0)));
        float verticalLimit = 1.0 - smoothstep(54.0 + columnHeight * 92.0, 124.0 + columnHeight * 128.0, height);
        float strands = smoothstep(0.52, 0.9, 0.52 + folds + columnNoise * 0.2);
        float breakup = smoothstep(0.24, 0.82, fbm(vec2(angle * 45.0 - time * 0.01, height * 0.04)));
        float curtain = body * strands * breakup * verticalLimit * mix(0.62, 1.0, debugGain);

        float closeStage = 1.0 - smoothstep(0.16, 0.74, progress);
        float density = (rootMask * 0.72 + curtain * 0.86) * upperArc * sideWindow * arcWindow;
        float gain = intensity * (0.42 + closeStage * 0.22 + debugGain * 1.34);
        float alpha = density * gain;

        vec3 rootGreen = vec3(0.18, 0.92, 0.42);
        vec3 grayGreen = vec3(0.18, 0.5, 0.42);
        vec3 redUpper = vec3(0.48, 0.11, 0.2);
        float topMix = smoothstep(58.0, 180.0, height);
        vec3 color = mix(rootGreen, grayGreen, smoothstep(24.0, 92.0, height));
        color = mix(color, redUpper, topMix * 0.48);
        color *= density * (1.65 + rootMask * 1.25 + curtain * 0.52 + debugGain * 0.68);
        color = min(color, vec3(0.2, 0.86, 0.68));

        if (alpha < 0.0012) {
          discard;
        }

        gl_FragColor = vec4(color, clamp(alpha, 0.0, mix(0.14, 0.34, debugGain)));
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingProjectedAuroraCurtain({
  composition,
  quality,
  projection,
  debugProfile = false,
  visibilityBoost = 1,
  reducedMotion,
  paused
}: LandingProjectedAuroraCurtainProps) {
  const overlay = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(() => createAuroraCurtainMaterial(composition), [composition]);
  const enabled =
    quality.tier !== "fallback" &&
    quality.aurora &&
    !reducedMotion &&
    composition.aurora.enabled &&
    composition.aurora.intensity > 0 &&
    composition.aurora.sampleCount > 0;

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    if (!overlay.current || !enabled || !("fov" in camera)) {
      return;
    }

    fitOverlayToCamera(overlay.current, camera, size.width / Math.max(size.height, 1));
    material.uniforms.earthCenter.value.copy(projection.current.center);
    material.uniforms.earthRadius.value = projection.current.radius;
    material.uniforms.sunDirection.value.copy(projection.current.sunDirection);
    material.uniforms.progress.value = projection.current.progress;
    material.uniforms.intensity.value = composition.aurora.intensity * visibilityBoost;
    material.uniforms.debugGain.value = debugProfile ? 1 : 0;
    material.uniforms.time.value = paused || reducedMotion ? 0 : state.clock.elapsedTime;
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={overlay} material={material} renderOrder={22} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
