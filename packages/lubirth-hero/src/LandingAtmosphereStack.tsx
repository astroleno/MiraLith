"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  CustomBlending,
  FrontSide,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

type AtmosphereLayerKind =
  | "soft-contour"
  | "surface-glow"
  | "inner-white"
  | "karman"
  | "blue-thickness"
  | "outer-halo";

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
  { kind: "outer-halo", radius: 1.0068, renderOrder: 12 },
  { kind: "inner-white", radius: 1.002, renderOrder: 13 },
  { kind: "blue-thickness", radius: 1.0038, renderOrder: 16 }
];

const MEDIUM_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "outer-halo", radius: 1.0062, renderOrder: 12 },
  { kind: "inner-white", radius: 1.002, renderOrder: 13 },
  { kind: "blue-thickness", radius: 1.0035, renderOrder: 15 }
];

const LOW_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "outer-halo", radius: 1.0058, renderOrder: 12 },
  { kind: "inner-white", radius: 1.0018, renderOrder: 13 },
  { kind: "blue-thickness", radius: 1.0032, renderOrder: 15 }
];

const PRODUCTION_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "surface-glow", radius: 1.0018, renderOrder: 11 },
  { kind: "surface-glow", radius: 1.0072, renderOrder: 12 },
  { kind: "outer-halo", radius: 1.0118, renderOrder: 13 }
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
  if (kind === "surface-glow") {
    return 5;
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
      outerHaloStrength: { value: composition.atmosphere.outerHaloStrength },
      shellAltitude: { value: Math.max(0, spec.radius - 1) }
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
      uniform float shellAltitude;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 l = normalize(lightDir);
        float viewFacing = dot(n, v);
        if (viewFacing <= 0.0) {
          discard;
        }

        float rim = 1.0 - clamp(viewFacing, 0.0, 1.0);
        float tangentGate = smoothstep(0.895, 0.974, rim);
        float sun = dot(n, l);
        float daySide = smoothstep(-0.25, 0.45, sun);
        float nightSide = 1.0 - smoothstep(-0.10, 0.28, sun);
        float twilight = 1.0 - smoothstep(0.02, 0.42, abs(sun));
        float closeHold = mix(0.66, 0.58, closeStage);
        float boost = 1.0 + debugBoost * 0.04;
        float productionMode = 1.0 - step(0.5, debugBoost);
        float altitudeFade = 1.0 - smoothstep(0.0012, 0.0085, shellAltitude);

        float innerWhite =
          smoothstep(0.94, 0.986, rim) *
          (1.0 - smoothstep(0.997, 1.0, rim));

        float blueThickness =
          smoothstep(0.82, 0.945, rim) *
          (1.0 - smoothstep(0.992, 1.0, rim));

        float karmanMist =
          smoothstep(0.60, 0.78, rim) *
          (1.0 - smoothstep(0.955, 0.998, rim));

        float karmanCore =
          smoothstep(0.84, 0.928, rim) *
          (1.0 - smoothstep(0.986, 1.0, rim));

        float karmanBand = max(karmanMist * 0.58, karmanCore);

        float outerHalo =
          smoothstep(0.78, 0.93, rim) *
          (1.0 - smoothstep(0.988, 1.0, rim));

        float softContour =
          smoothstep(0.74, 0.91, rim) *
          (1.0 - smoothstep(0.992, 1.0, rim));

        vec3 whiteLineColor = vec3(1.16, 1.34, 1.62);
        vec3 rayleighBlue = vec3(0.16, 0.54, 1.08);
        vec3 deepBlue = vec3(0.012, 0.09, 0.34);
        vec3 oxygenGreen = vec3(0.20, 0.85, 0.58);
        vec3 amberGlow = vec3(1.0, 0.48, 0.16);

        vec3 color = vec3(0.0);
        float alpha = 0.0;

        if (kind == 4) {
          color = mix(deepBlue, rayleighBlue, 0.56 + daySide * 0.36) * softContour * 0.72;
          alpha = softContour * 0.07 * (0.42 + blueThicknessStrength * 0.58);
        } else if (kind == 5) {
          float contactWeight = 1.0 - smoothstep(0.0015, 0.0048, shellAltitude);
          float airColumnWeight = exp(-shellAltitude * 210.0);
          float surfaceContact =
            smoothstep(0.58, 0.9, rim) *
            (1.0 - smoothstep(0.988, 1.0, rim));
          float groundGlow =
            smoothstep(0.22, 0.76, rim) *
            (1.0 - smoothstep(0.972, 1.0, rim));
          float nearSurfaceShelf =
            smoothstep(0.36, 0.86, rim) *
            (1.0 - smoothstep(0.994, 1.0, rim));
          vec3 groundBlue = mix(deepBlue, rayleighBlue, 0.34 + daySide * 0.38 + twilight * 0.12);
          float contactGain = 0.62 + contactWeight * 0.74 + airColumnWeight * 0.26;
          float shelfGain = 0.2 + contactWeight * 0.36 + airColumnWeight * 0.3;
          color =
            groundBlue * groundGlow * contactGain +
            rayleighBlue * surfaceContact * (0.08 + contactWeight * 0.24) * (0.45 + daySide * 0.55) +
            mix(deepBlue, rayleighBlue, 0.38 + daySide * 0.22) * nearSurfaceShelf * shelfGain;
          alpha =
            groundGlow *
            (0.052 + contactWeight * 0.096 + airColumnWeight * 0.034) *
            (0.64 + daySide * 0.32 + twilight * 0.2);
          alpha += surfaceContact * (0.018 + contactWeight * 0.044) * (0.48 + daySide * 0.52);
          alpha += nearSurfaceShelf * (0.012 + airColumnWeight * 0.018) * (0.42 + daySide * 0.42);
          alpha *= mix(0.44, 1.0, altitudeFade);
        } else if (kind == 0) {
          color = whiteLineColor * innerWhite * (0.98 + daySide * 0.96);
          alpha = innerWhite * 0.16 * innerWhiteStrength;
        } else if (kind == 1) {
          vec3 karmanCoreColor =
            oxygenGreen * (0.34 + nightSide * 0.74) +
            amberGlow * (0.18 + twilight * 0.48) +
            rayleighBlue * daySide * 0.26;
          color =
            karmanCoreColor * karmanCore * 1.28 +
            mix(deepBlue, rayleighBlue, 0.42 + twilight * 0.18) * karmanMist * 0.54;
          alpha = (karmanMist * 0.064 + karmanCore * 0.19) * max(karmanStrength, 0.54);
        } else if (kind == 2) {
          color = rayleighBlue * blueThickness * (0.24 + daySide * 0.72);
          alpha = blueThickness * 0.022 * blueThicknessStrength;
        } else {
          color = mix(deepBlue, rayleighBlue, 0.62 + daySide * 0.2) * outerHalo * 0.42;
          alpha = outerHalo * 0.014 * max(outerHaloStrength, 0.3);
        }

        float activeGate = kind == 5
          ? mix(tangentGate, 1.0, productionMode * 0.34)
          : tangentGate;
        alpha *= intensity * closeHold * boost * activeGate;
        color *= intensity * closeHold * boost * activeGate;

        if (alpha < 0.001) {
          discard;
        }

        gl_FragColor = vec4(min(color, vec3(1.46)), clamp(alpha, 0.0, 0.22));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    side: FrontSide,
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
    ? Math.max(composition.earth.segments, quality.segments, 192)
    : quality.tier === "medium"
      ? Math.max(96, quality.segments)
      : 40;
  const heightSegments = quality.tier === "high" ? 144 : quality.tier === "medium" ? 72 : 36;

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
    material.uniforms.shellAltitude.value = Math.max(0, spec.radius - 1);
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
  const layers = !emphasis
    ? PRODUCTION_LAYERS
    : quality.tier === "high"
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
          key={`${spec.kind}-${spec.radius}-${spec.renderOrder}`}
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
