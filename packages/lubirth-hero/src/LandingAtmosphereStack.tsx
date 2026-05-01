"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  BackSide,
  CustomBlending,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

type AtmosphereLayerKind = "soft-contour" | "inner-white" | "karman" | "blue-thickness" | "outer-halo";

interface AtmosphereLayerSpec {
  kind: AtmosphereLayerKind;
  radius: number;
  renderOrder: number;
}

interface LandingAtmosphereStackProps {
  composition: LandingComposition;
  quality: QualityProfile;
  sceneLightDirection?: Vector3;
  emphasis?: boolean;
}

interface AtmosphereLayerProps extends LandingAtmosphereStackProps {
  spec: AtmosphereLayerSpec;
}

declare global {
  interface Window {
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
  }
}

const HIGH_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "soft-contour", radius: 1.006, renderOrder: 12 },
  { kind: "inner-white", radius: 1.0026, renderOrder: 13 },
  { kind: "karman", radius: 1.011, renderOrder: 14 },
  { kind: "blue-thickness", radius: 1.02, renderOrder: 15 },
  { kind: "outer-halo", radius: 1.034, renderOrder: 16 }
];

const MEDIUM_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "soft-contour", radius: 1.0055, renderOrder: 12 },
  { kind: "inner-white", radius: 1.0026, renderOrder: 13 },
  { kind: "karman", radius: 1.011, renderOrder: 14 },
  { kind: "blue-thickness", radius: 1.018, renderOrder: 15 }
];

const LOW_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "soft-contour", radius: 1.005, renderOrder: 12 },
  { kind: "inner-white", radius: 1.0026, renderOrder: 13 },
  { kind: "blue-thickness", radius: 1.016, renderOrder: 15 }
];

const lightDirection = new Vector3();

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

function layerKindToUniform(kind: AtmosphereLayerKind) {
  if (kind === "soft-contour") {
    return 4;
  }
  if (kind === "inner-white") {
    return 0;
  }
  if (kind === "karman") {
    return 1;
  }
  if (kind === "blue-thickness") {
    return 2;
  }

  return 3;
}

function createAtmosphereStackMaterial(composition: LandingComposition, spec: AtmosphereLayerSpec) {
  return new ShaderMaterial({
    uniforms: {
      kind: { value: layerKindToUniform(spec.kind) },
      closeStage: { value: 1 },
      intensity: { value: composition.atmosphere.intensity },
      debugBoost: { value: 0 },
      lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
      innerWhiteStrength: { value: composition.atmosphere.innerWhiteStrength },
      blueThicknessStrength: { value: composition.atmosphere.blueThicknessStrength },
      karmanStrength: { value: composition.atmosphere.karmanStrength },
      outerHaloStrength: { value: composition.atmosphere.outerHaloStrength }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform int kind;
      uniform float closeStage;
      uniform float intensity;
      uniform float debugBoost;
      uniform vec3 lightDir;
      uniform float innerWhiteStrength;
      uniform float blueThicknessStrength;
      uniform float karmanStrength;
      uniform float outerHaloStrength;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 l = normalize(lightDir);
        float rim = 1.0 - max(dot(n, v), 0.0);
        float sun = dot(n, l);
        float daySide = smoothstep(-0.25, 0.45, sun);
        float nightSide = 1.0 - smoothstep(-0.10, 0.28, sun);
        float twilight = 1.0 - smoothstep(0.02, 0.42, abs(sun));
        float closeHold = mix(0.72, 1.0, closeStage);
        float boost = 1.0 + debugBoost * 0.28;

        float innerWhite =
          smoothstep(0.925, 0.972, rim) *
          (1.0 - smoothstep(0.986, 0.998, rim));

        float blueThickness =
          smoothstep(0.70, 0.895, rim) *
          (1.0 - smoothstep(0.968, 1.0, rim));

        float karmanBand =
          smoothstep(0.82, 0.925, rim) *
          (1.0 - smoothstep(0.945, 0.984, rim));

        float outerHalo =
          smoothstep(0.58, 0.81, rim) *
          (1.0 - smoothstep(0.915, 1.0, rim));

        float softContour =
          smoothstep(0.72, 0.88, rim) *
          (1.0 - smoothstep(0.94, 0.998, rim));

        vec3 whiteLineColor = vec3(0.92, 0.98, 1.0);
        vec3 rayleighBlue = vec3(0.16, 0.48, 0.95);
        vec3 deepBlue = vec3(0.02, 0.12, 0.38);
        vec3 oxygenGreen = vec3(0.20, 0.85, 0.58);
        vec3 amberGlow = vec3(1.0, 0.48, 0.16);

        vec3 color = vec3(0.0);
        float alpha = 0.0;

        if (kind == 4) {
          color = mix(deepBlue, rayleighBlue, 0.32 + daySide * 0.36) * softContour * 0.12;
          alpha = softContour * 0.018 * (0.42 + blueThicknessStrength * 0.58);
        } else if (kind == 0) {
          color = whiteLineColor * innerWhite * (0.72 + daySide * 0.64);
          alpha = innerWhite * 0.13 * innerWhiteStrength;
        } else if (kind == 1) {
          color =
            oxygenGreen * karmanBand * nightSide * 0.09 +
            amberGlow * karmanBand * twilight * 0.075;
          alpha = karmanBand * 0.022 * karmanStrength;
        } else if (kind == 2) {
          color = rayleighBlue * blueThickness * (0.18 + daySide * 0.78);
          alpha = blueThickness * 0.045 * blueThicknessStrength;
        } else {
          color = deepBlue * outerHalo * 0.08;
          alpha = outerHalo * 0.009 * outerHaloStrength;
        }

        alpha *= intensity * closeHold * boost;
        color *= intensity * closeHold * boost;

        if (alpha < 0.001) {
          discard;
        }

        gl_FragColor = vec4(min(color, vec3(0.98)), clamp(alpha, 0.0, 0.24));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    side: BackSide,
    depthTest: true,
    depthWrite: false
  });
}

function AtmosphereLayer({
  composition,
  quality,
  sceneLightDirection,
  emphasis = false,
  spec
}: AtmosphereLayerProps) {
  const material = useMemo(() => createAtmosphereStackMaterial(composition, spec), [composition, spec]);
  const radius = composition.earth.radius * spec.radius;
  const widthSegments = quality.tier === "high"
    ? Math.max(96, quality.segments)
    : quality.tier === "medium"
      ? 64
      : 40;
  const heightSegments = quality.tier === "high" ? 56 : quality.tier === "medium" ? 36 : 24;

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame(() => {
    const progress = getRuntimeOpeningProgress(0);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);

    if (sceneLightDirection) {
      material.uniforms.lightDir.value.copy(sceneLightDirection).normalize();
    } else {
      material.uniforms.lightDir.value.set(...composition.light.fixedSunDir).normalize();
    }

    material.uniforms.closeStage.value = closeStage;
    material.uniforms.intensity.value = composition.atmosphere.enabled ? composition.atmosphere.intensity : 0;
    material.uniforms.debugBoost.value = emphasis ? 1 : 0;
    material.uniforms.innerWhiteStrength.value = composition.atmosphere.innerWhiteStrength;
    material.uniforms.blueThicknessStrength.value = composition.atmosphere.blueThicknessStrength;
    material.uniforms.karmanStrength.value = composition.atmosphere.karmanStrength;
    material.uniforms.outerHaloStrength.value = composition.atmosphere.outerHaloStrength;
  });

  return (
    <mesh material={material} renderOrder={spec.renderOrder}>
      <sphereGeometry args={[radius, widthSegments, heightSegments]} />
    </mesh>
  );
}

export function LandingAtmosphereStack({
  composition,
  quality,
  sceneLightDirection,
  emphasis = false
}: LandingAtmosphereStackProps) {
  const enabled = quality.tier !== "fallback" && composition.atmosphere.enabled;
  const layers =
    quality.tier === "high"
      ? HIGH_LAYERS
      : quality.tier === "medium"
        ? MEDIUM_LAYERS
        : LOW_LAYERS;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__MiraLithLuBirthAtmosphereStackActive = enabled;
    }

    return () => {
      if (typeof window !== "undefined") {
        window.__MiraLithLuBirthAtmosphereStackActive = false;
      }
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      {layers.map((spec) => (
        <AtmosphereLayer
          key={spec.kind}
          composition={composition}
          quality={quality}
          sceneLightDirection={sceneLightDirection}
          emphasis={emphasis}
          spec={spec}
        />
      ))}
    </>
  );
}
