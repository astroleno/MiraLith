"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  Mesh,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector2,
  Vector3,
  type PerspectiveCamera
} from "three";
import { type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingProjectedEarthFrame } from "./types";

interface LandingProjectedHorizonCloudPlateProps {
  composition: LandingComposition;
  quality: QualityProfile;
  projection: RefObject<LandingProjectedEarthFrame>;
  emphasis?: boolean;
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

function createCloudPlateMaterial(composition: LandingComposition) {
  return new ShaderMaterial({
    uniforms: {
      screenSize: { value: new Vector2(1, 1) },
      earthCenter: { value: new Vector2(0, 0) },
      earthRadius: { value: 1 },
      sunDirection: { value: new Vector2(0, 1) },
      time: { value: 0 },
      progress: { value: 0 },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      debugBoost: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 screenSize;
      uniform vec2 earthCenter;
      uniform float earthRadius;
      uniform vec2 sunDirection;
      uniform float time;
      uniform float progress;
      uniform float opacity;
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
        for (int i = 0; i < 5; i += 1) {
          value += noise2(p) * amplitude;
          p = p * 2.04 + vec2(7.3, 3.1);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 p = gl_FragCoord.xy;
        vec2 fromCenter = p - earthCenter;
        float distanceToCenter = length(fromCenter);
        vec2 edgeNormal = distanceToCenter > 0.001 ? fromCenter / distanceToCenter : vec2(0.0, 1.0);
        float signedEdge = earthRadius - distanceToCenter;
        float upperArc = smoothstep(0.05, 0.38, edgeNormal.y);
        float sideWindow = smoothstep(-0.96, -0.56, edgeNormal.x) * (1.0 - smoothstep(0.58, 0.98, edgeNormal.x));
        float insideClip = smoothstep(-12.0, 8.0, signedEdge);
        float outsideFeather = 1.0 - smoothstep(28.0, 54.0, -signedEdge);
        float band = smoothstep(-16.0, 16.0, signedEdge) * (1.0 - smoothstep(138.0, 206.0, signedEdge));
        float horizonCore = smoothstep(-4.0, 30.0, signedEdge) * (1.0 - smoothstep(78.0, 148.0, signedEdge));
        float undersideBand = smoothstep(46.0, 96.0, signedEdge) * (1.0 - smoothstep(128.0, 190.0, signedEdge));

        float angle = atan(edgeNormal.y, edgeNormal.x);
        float arc = angle / 3.14159265;
        vec2 cloudUv = vec2(arc * 7.2 + time * 0.004, signedEdge * 0.018 - time * 0.0015);
        float broad = fbm(cloudUv + vec2(1.7, 0.2));
        float detail = fbm(cloudUv * vec2(3.4, 2.2) + vec2(4.0, 8.0));
        float streak = fbm(vec2(arc * 22.0 - time * 0.006, signedEdge * 0.045));
        float voids = fbm(cloudUv * vec2(1.9, 1.15) + vec2(8.4, 2.2));
        float silhouette = smoothstep(0.34, 0.8, broad * 0.52 + detail * 0.28 + streak * 0.16 + horizonCore * 0.18 - voids * 0.12);
        float brokenEdge = mix(0.12, 1.0, smoothstep(0.24, 0.82, detail + streak * 0.34 - voids * 0.18));
        float coverage = silhouette * mix(0.45, 1.0, horizonCore) * brokenEdge;
        float topCap = smoothstep(0.58, 0.92, detail + broad * 0.34 + horizonCore * 0.26);
        float baseShadow = undersideBand * smoothstep(0.42, 0.9, broad + streak * 0.36);

        float sunDot = dot(edgeNormal, normalize(sunDirection));
        float day = smoothstep(-0.24, 0.36, sunDot);
        float twilight = 1.0 - smoothstep(0.0, 0.34, abs(sunDot));
        float closeStage = 1.0 - smoothstep(0.12, 0.78, progress);

        vec3 base = mix(vec3(0.05, 0.075, 0.12), vec3(0.55, 0.64, 0.74), day * 0.74 + topCap * 0.18);
        vec3 cap = mix(vec3(0.64, 0.72, 0.82), vec3(0.96, 0.98, 0.94), topCap * 0.86 + day * 0.16);
        vec3 color = mix(base, cap, topCap * 0.62 + horizonCore * 0.18);
        color = mix(color, color * vec3(0.28, 0.38, 0.54), clamp(baseShadow * 0.72, 0.0, 0.86));
        color += vec3(0.88, 0.95, 1.0) * topCap * horizonCore * (0.16 + day * 0.2);
        color += vec3(0.96, 0.46, 0.2) * twilight * topCap * 0.035;

        float alpha = coverage * band * upperArc * sideWindow * insideClip * outsideFeather;
        float centerSuppression = 1.0 - smoothstep(126.0, 218.0, signedEdge);
        alpha *= mix(0.68, 1.0, horizonCore) * centerSuppression;
        alpha *= opacity * (0.52 + closeStage * 0.16 + debugBoost * 0.16);
        alpha = clamp(alpha, 0.0, mix(0.34, 0.54, debugBoost));

        if (alpha < 0.002) {
          discard;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide
  });
}

export function LandingProjectedHorizonCloudPlate({
  composition,
  quality,
  projection,
  emphasis = false,
  reducedMotion,
  paused
}: LandingProjectedHorizonCloudPlateProps) {
  const overlay = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(() => createCloudPlateMaterial(composition), [composition]);
  const enabled =
    composition.earth.useClouds &&
    composition.earth.cloudOpacity > 0 &&
    quality.tier !== "fallback" &&
    quality.tier !== "low";

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    if (!overlay.current || !enabled || !("fov" in camera)) {
      return;
    }

    fitOverlayToCamera(overlay.current, camera, size.width / Math.max(size.height, 1));
    material.uniforms.screenSize.value.set(size.width, size.height);
    material.uniforms.earthCenter.value.copy(projection.current.center);
    material.uniforms.earthRadius.value = projection.current.radius;
    material.uniforms.sunDirection.value.copy(projection.current.sunDirection);
    material.uniforms.progress.value = projection.current.progress;
    material.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
    material.uniforms.time.value = paused || reducedMotion ? 0 : state.clock.elapsedTime;
  });

  if (!enabled) {
    return null;
  }

  return (
    <mesh ref={overlay} material={material} renderOrder={18} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
