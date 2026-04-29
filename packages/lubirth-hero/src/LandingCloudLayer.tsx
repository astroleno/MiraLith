"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AddEquation,
  Color,
  CustomBlending,
  FrontSide,
  Group,
  Mesh,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingCloudLayerProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

interface CloudShellLayer {
  radius: number;
  opacity: number;
  offset: number;
  coverage: number;
  shadow: number;
}

const lightDirection = new Vector3();
const color = new Color();
const CLOUD_SHELLS: CloudShellLayer[] = [
  { radius: 1.016, opacity: 0.48, offset: 0, coverage: 0.67, shadow: 0.7 },
  { radius: 1.052, opacity: 0.3, offset: 2.4, coverage: 0.61, shadow: 0.88 }
];

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function createCloudMaterial(composition: LandingComposition, quality: QualityProfile, layer: CloudShellLayer) {
  const lowCost = quality.tier === "low";

  return new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      closeStage: { value: 1 },
      opacity: { value: composition.earth.useClouds ? composition.earth.cloudOpacity : 0 },
      shellOpacity: { value: layer.opacity },
      shellOffset: { value: layer.offset },
      coverageBias: { value: layer.coverage },
      shadowStrength: { value: layer.shadow },
      debugBoost: { value: 0 },
      lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
      lightColor: {
        value: color.setRGB(
          composition.light.color[0],
          composition.light.color[1],
          composition.light.color[2]
        ).clone()
      }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying float vFresnel;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vLocalNormal = normalize(position);
        vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
        vFresnel = 1.0 - max(dot(normalize(vWorldNormal), viewDirection), 0.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      #define CLOUD_STEPS ${lowCost ? 3 : 4}

      uniform float time;
      uniform float closeStage;
      uniform float opacity;
      uniform float shellOpacity;
      uniform float shellOffset;
      uniform float coverageBias;
      uniform float shadowStrength;
      uniform float debugBoost;
      uniform vec3 lightDir;
      uniform vec3 lightColor;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalNormal;
      varying float vFresnel;

      float hash(float n) {
        return fract(sin(n) * 753.5453123);
      }

      float noiseIq(vec3 x) {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        float n = p.x + p.y * 157.0 + 113.0 * p.z;
        return mix(
          mix(
            mix(hash(n + 0.0), hash(n + 1.0), f.x),
            mix(hash(n + 157.0), hash(n + 158.0), f.x),
            f.y
          ),
          mix(
            mix(hash(n + 113.0), hash(n + 114.0), f.x),
            mix(hash(n + 270.0), hash(n + 271.0), f.x),
            f.y
          ),
          f.z
        );
      }

      float fbmClouds(vec3 pos) {
        vec3 p = pos;
        float amp = 0.5;
        float sum = 0.0;
        for (int i = 0; i < 5; i++) {
          sum += abs(noiseIq(p) * 2.0 - 1.0) * amp;
          p *= 2.6434;
          amp *= 0.5;
        }
        return sum;
      }

      float densityFunc(vec3 pos, float height) {
        float base = fbmClouds(pos * 2.032);
        float broad = fbmClouds(pos * 0.62 + vec3(4.2, 0.0, 1.7));
        float broken = fbmClouds(pos * 4.4 + vec3(0.0, 6.4, 2.2));
        float erode = fbmClouds(pos * 7.2 + vec3(1.2, 0.8, 5.1));
        float cloudField = base * 0.82 + broad * 0.28 - broken * 0.13 - erode * 0.05;
        float coverage = mix(coverageBias + 0.02, coverageBias - 0.08, closeStage) - debugBoost * 0.18;
        float coverageMask = smoothstep(coverage, coverage + 0.034, cloudField);
        float clumpMask = smoothstep(0.2, 0.58, broad);
        float verticalBand =
          smoothstep(0.08, 0.24, height) *
          (1.0 - smoothstep(0.72, 0.98, height));
        float cloudTop = smoothstep(0.32, 0.72, height) * (1.0 - smoothstep(0.82, 1.0, height));
        float billow = clamp(base * 0.72 + broad * 0.36 + broken * 0.08, 0.0, 1.35);
        float brokenEdge = 1.0 - smoothstep(0.58, 0.86, erode);
        return coverageMask *
          clumpMask *
          brokenEdge *
          verticalBand *
          (billow * 0.84 + cloudTop * 0.3) *
          (0.64 + closeStage * 0.58 + debugBoost * 0.68);
      }

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 localN = normalize(vLocalNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sunDirection = normalize(lightDir);
        float ndl = dot(n, sunDirection);
        float day = smoothstep(-0.14, 0.34, ndl);
        float twilight = 1.0 - smoothstep(0.0, 0.46, abs(ndl));
        float rim = clamp(vFresnel, 0.0, 1.0);
        float horizon = smoothstep(0.18, 0.68, rim) * (1.0 - smoothstep(0.94, 1.0, rim));
        float centerFade = 1.0 - smoothstep(0.88, 0.985, rim);
        float shellFade =
          (0.34 + closeStage * 0.22 + debugBoost * 0.16) * centerFade +
          horizon * (0.12 + closeStage * 0.26 + debugBoost * 0.22);
        vec3 wind = vec3(time * 0.006, time * 0.002, -time * 0.012) + vec3(shellOffset, shellOffset * 0.37, -shellOffset * 0.21);
        vec3 tangentA = normalize(cross(vec3(0.0, 1.0, 0.0), localN) + vec3(0.001, 0.0, 0.0));
        vec3 tangentB = normalize(cross(localN, tangentA));
        vec3 rayShear = tangentA * dot(viewDirection, tangentA) + tangentB * dot(viewDirection, tangentB);
        vec3 cloudPos = localN * 2.38 + wind;
        float transmittance = 1.0;
        float alpha = 0.0;
        vec3 accum = vec3(0.0);

        for (int i = 0; i < CLOUD_STEPS; i++) {
          float fi = (float(i) + 0.5) / float(CLOUD_STEPS);
          vec3 samplePos = cloudPos + rayShear * fi * 0.62 + localN * fi * 0.24;
          float density = densityFunc(samplePos, fi);
          float shadowDensity = densityFunc(samplePos + sunDirection * 0.52 - localN * 0.1, fi);
          float topLight = smoothstep(0.24, 0.82, fi);
          float light = mix(0.18, 1.12, day) * (1.0 - shadowDensity * shadowStrength) + day * topLight * 0.24;
          float beer = exp(-density * 1.46);
          float stepAlpha = (1.0 - beer) * transmittance;
          vec3 cloudBase = mix(
            vec3(0.2, 0.28, 0.38),
            vec3(0.9, 0.93, 0.92),
            clamp(topLight * 0.72 + density * 0.52, 0.0, 1.0)
          );
          vec3 warm = vec3(1.0, 0.62, 0.32) * twilight * 0.06;
          vec3 blueShadow = vec3(0.06, 0.13, 0.24) * (1.0 - day) * (0.46 + shadowDensity * 0.46);
          accum += (cloudBase * lightColor * light + warm + blueShadow) * density * stepAlpha;
          alpha += stepAlpha * (0.12 + density * 0.58) * (0.74 + topLight * 0.34);
          transmittance *= beer;
        }

        alpha *= opacity * shellOpacity * shellFade * mix(0.82, 1.02, closeStage) * mix(1.35, 3.8, debugBoost);
        if (alpha < 0.003) {
          discard;
        }

        vec3 finalColor = accum * (1.28 + horizon * 0.22 + debugBoost * 0.54);
        gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, mix(0.42, 0.64, debugBoost)));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    side: FrontSide,
    depthTest: true,
    depthWrite: false
  });
}

export function LandingCloudLayer({
  composition,
  quality,
  sceneLightDirection,
  emphasis = false,
  reducedMotion,
  paused
}: LandingCloudLayerProps) {
  const cloud = useRef<Mesh>(null);
  const cloudGroup = useRef<Group>(null);
  const materials = useMemo(
    () => CLOUD_SHELLS.map((layer) => createCloudMaterial(composition, quality, layer)),
    [composition, quality]
  );
  const enabled = composition.earth.useClouds && composition.earth.cloudOpacity > 0 && quality.tier !== "fallback";

  useFrame((state) => {
    if (!cloudGroup.current || !enabled) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    const elapsed = paused || reducedMotion ? 0 : state.clock.elapsedTime;
    if (sceneLightDirection) {
      lightDirection.copy(sceneLightDirection).normalize();
    } else {
      lightDirection.set(...composition.light.fixedSunDir).normalize();
    }

    if (!paused && !reducedMotion) {
      cloudGroup.current.rotation.y = elapsed * 0.034;
      cloudGroup.current.rotation.x = Math.sin(elapsed * 0.06) * 0.012;
      cloudGroup.current.rotation.z = Math.sin(elapsed * 0.043) * 0.01;
    }

    cloudGroup.current.children.forEach((child, index) => {
      const cloudMaterial = (child as Mesh).material as ShaderMaterial;
      child.rotation.y = elapsed * (0.018 + index * 0.009) + index * 0.36;
      child.rotation.x = Math.sin(elapsed * (0.032 + index * 0.008) + index) * 0.018;
      cloudMaterial.uniforms.time.value = elapsed;
      cloudMaterial.uniforms.closeStage.value = closeStage;
      cloudMaterial.uniforms.opacity.value = composition.earth.useClouds ? composition.earth.cloudOpacity : 0;
      cloudMaterial.uniforms.debugBoost.value = emphasis ? 1 : 0.38;
      cloudMaterial.uniforms.lightDir.value.copy(lightDirection);
    });
  });

  if (!enabled) {
    return null;
  }

  return (
    <group ref={cloudGroup}>
      {CLOUD_SHELLS.map((layer, index) => (
        <mesh key={index} ref={index === 0 ? cloud : undefined} material={materials[index]} renderOrder={3 + index}>
          <sphereGeometry
            args={[
              composition.earth.radius * layer.radius,
              quality.tier === "high" ? Math.max(72, quality.segments) : quality.tier === "medium" ? 64 : 44,
              quality.tier === "high" ? 40 : quality.tier === "medium" ? 36 : 28
            ]}
          />
        </mesh>
      ))}
    </group>
  );
}
