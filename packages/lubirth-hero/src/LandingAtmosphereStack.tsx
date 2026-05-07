"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AddEquation,
  CustomBlending,
  DoubleSide,
  OneFactor,
  RepeatWrapping,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingResolvedAssets } from "./types";
import { useLandingTexture } from "./useLandingTexture";

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
  assets: LandingResolvedAssets;
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
  { kind: "surface-glow", radius: 1.048, renderOrder: 11 }
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
      shellAltitude: { value: Math.max(0, spec.radius - 1) },
      surfaceMap: { value: null },
      hasSurfaceMap: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vUv = uv;
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
      uniform sampler2D surfaceMap;
      uniform float hasSurfaceMap;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 l = normalize(lightDir);
        float viewFacing = abs(dot(n, v));

        float rim = 1.0 - clamp(viewFacing, 0.0, 1.0);
        float innerShellGate = smoothstep(0.68, 0.94, rim) * (1.0 - smoothstep(0.996, 1.0, rim));
        float outerShellGate = smoothstep(0.46, 0.86, rim) * (1.0 - smoothstep(0.998, 1.0, rim));
        float surfaceGlowGate = smoothstep(0.42, 0.9, rim) * (1.0 - smoothstep(0.992, 1.0, rim));
        float tangentGate = smoothstep(0.88, 0.986, rim);
        float sun = dot(n, l);
        float daySide = smoothstep(-0.25, 0.45, sun);
        float nightSide = 1.0 - smoothstep(-0.10, 0.28, sun);
        float twilight = 1.0 - smoothstep(0.02, 0.42, abs(sun));
        float closeHold = mix(0.66, 0.58, closeStage);
        float boost = 1.0 + debugBoost * 0.04;
        float productionMode = 1.0 - step(0.5, debugBoost);
        float altitudeFade = 1.0 - smoothstep(0.0012, 0.0085, shellAltitude);
        vec3 surfaceSample = texture2D(surfaceMap, vec2(fract(vUv.x), clamp(vUv.y, 0.001, 0.999))).rgb;
        float surfaceLuma = dot(surfaceSample, vec3(0.2126, 0.7152, 0.0722));
        float oceanSignal = surfaceSample.b - max(surfaceSample.r, surfaceSample.g) * 0.55;
        float oceanReflectance = smoothstep(0.035, 0.2, oceanSignal);
        float brightReflectance = smoothstep(0.32, 0.82, surfaceLuma);
        float warmLandReflectance =
          smoothstep(0.05, 0.24, max(surfaceSample.r, surfaceSample.g) - surfaceSample.b) *
          smoothstep(0.36, 0.78, surfaceLuma);
        float terrainReflectance = clamp(
          0.72 +
          brightReflectance * 0.34 +
          oceanReflectance * 0.36 +
          warmLandReflectance * 0.12,
          0.58,
          1.42
        );
        terrainReflectance = mix(1.0, terrainReflectance, hasSurfaceMap);
        float sunlitReflectance = terrainReflectance * (0.44 + daySide * 0.58 + twilight * 0.2);
        float oceanGlancingReflectance = oceanReflectance * smoothstep(-0.06, 0.52, sun) * smoothstep(0.72, 0.98, rim);
        float landGlancingReflectance = brightReflectance * smoothstep(0.08, 0.7, sun) * 0.46;
        float shellReflectance = clamp(
          0.62 + sunlitReflectance * 0.34 + oceanGlancingReflectance * 0.5 + landGlancingReflectance * 0.18,
          0.48,
          1.48
        );

        float innerWhite =
          smoothstep(0.9, 0.98, rim) *
          (1.0 - smoothstep(0.996, 1.0, rim));

        float blueThickness =
          smoothstep(0.62, 0.9, rim) *
          (1.0 - smoothstep(0.996, 1.0, rim));

        float karmanMist =
          smoothstep(0.60, 0.78, rim) *
          (1.0 - smoothstep(0.955, 0.998, rim));

        float karmanCore =
          smoothstep(0.84, 0.928, rim) *
          (1.0 - smoothstep(0.986, 1.0, rim));

        float karmanBand = max(karmanMist * 0.58, karmanCore);

        float outerHalo =
          smoothstep(0.48, 0.86, rim) *
          (1.0 - smoothstep(0.99, 1.0, rim));

        float softContour =
          smoothstep(0.74, 0.91, rim) *
          (1.0 - smoothstep(0.992, 1.0, rim));

        vec3 whiteLineColor = vec3(1.16, 1.34, 1.62);
        vec3 rayleighBlue = vec3(0.18, 0.46, 0.86);
        vec3 deepBlue = vec3(0.018, 0.068, 0.18);
        vec3 oxygenGreen = vec3(0.20, 0.85, 0.58);
        vec3 amberGlow = vec3(1.0, 0.48, 0.16);

        vec3 color = vec3(0.0);
        float alpha = 0.0;

        if (kind == 4) {
          color = mix(deepBlue, rayleighBlue, 0.56 + daySide * 0.36) * softContour * 0.72;
          alpha = softContour * 0.07 * (0.42 + blueThicknessStrength * 0.58);
        } else if (kind == 5) {
          float projectedRadial = sqrt(max(0.0, 1.0 - viewFacing * viewFacing));
          float earthProjectedRadius = 1.0 / max(1.0001, 1.0 + shellAltitude);
          float radialSpan = max(0.004, 1.0 - earthProjectedRadius);
          float heightFromGround = (projectedRadial - earthProjectedRadius) / radialSpan;
          float groundSideGate = smoothstep(-0.02, 0.018, heightFromGround);
          float outwardHeight = max(heightFromGround, 0.0);
          float contactWeight = 1.0 - smoothstep(0.012, 0.078, shellAltitude);
          float airColumnWeight = exp(-shellAltitude * 14.0);
          float reflectiveContact = clamp(
            0.72 +
            oceanReflectance * 0.48 +
            brightReflectance * 0.28 +
            warmLandReflectance * 0.16,
            0.62,
            1.48
          );
          float contactNeedle = exp(-outwardHeight * 15.5) * groundSideGate;
          float innerRadialGlow = exp(-outwardHeight * 4.7) * groundSideGate;
          float lowerAirColumn = exp(-outwardHeight * 2.35) * groundSideGate;
          float outerRadialGlow =
            exp(-outwardHeight * 2.0) *
            groundSideGate;
          float broadAirBloom =
            exp(-outwardHeight * 2.65) *
            groundSideGate;
          vec3 groundBlue = mix(deepBlue, rayleighBlue, 0.34 + daySide * 0.38 + twilight * 0.12);
          vec3 contactWhite = mix(whiteLineColor, vec3(1.34, 1.54, 1.86), oceanReflectance * 0.34);
          vec3 warmScatter = vec3(1.0, 0.66, 0.36) * warmLandReflectance * twilight * 0.16;
          float contactGain = 0.44 + contactWeight * 0.24 + airColumnWeight * 0.34;
          float shelfGain = 0.42 + contactWeight * 0.14 + airColumnWeight * 0.34;
          color =
            groundBlue * innerRadialGlow * contactGain * 1.42 * shellReflectance +
            rayleighBlue * outerRadialGlow * (0.38 + contactWeight * 0.2) * (0.46 + daySide * 0.54) * shellReflectance +
            mix(deepBlue, rayleighBlue, 0.34 + daySide * 0.24) * broadAirBloom * (0.62 + airColumnWeight * 0.36) * shellReflectance +
            contactWhite * contactNeedle * (0.042 + contactWeight * 0.044) * (0.34 + daySide * 0.66) * shellReflectance * reflectiveContact +
            (mix(deepBlue, rayleighBlue, 0.42 + daySide * 0.24) + warmScatter) * lowerAirColumn * shelfGain * 1.34 * shellReflectance;
          alpha =
            innerRadialGlow *
            (0.074 + contactWeight * 0.048 + airColumnWeight * 0.042) *
            (0.64 + daySide * 0.32 + twilight * 0.2);
          alpha += outerRadialGlow * (0.092 + contactWeight * 0.046) * (0.42 + daySide * 0.5);
          alpha += broadAirBloom * (0.28 + airColumnWeight * 0.1) * (0.3 + daySide * 0.38);
          alpha += contactNeedle * (0.011 + contactWeight * 0.012) * (0.38 + daySide * 0.52) * reflectiveContact;
          alpha += lowerAirColumn * (0.038 + airColumnWeight * 0.03) * (0.38 + daySide * 0.46);
          alpha *= mix(0.44, 1.0, altitudeFade) * shellReflectance;
        } else if (kind == 0) {
          color = whiteLineColor * innerWhite * (0.54 + daySide * 0.86) * shellReflectance;
          alpha = innerWhite * 0.032 * innerWhiteStrength * mix(0.76, 1.08, shellReflectance - 0.48);
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
          color = rayleighBlue * blueThickness * (0.22 + daySide * 0.68) * shellReflectance;
          alpha = blueThickness * 0.04 * blueThicknessStrength * mix(0.76, 1.1, shellReflectance - 0.48);
        } else {
          float highAirFade = 1.0 - smoothstep(0.026, 0.07, shellAltitude);
          float wideAir = smoothstep(0.36, 0.78, rim) * (1.0 - smoothstep(0.94, 1.0, rim));
          color =
            mix(deepBlue, rayleighBlue, 0.24 + daySide * 0.2) * outerHalo * 0.82 * shellReflectance +
            mix(deepBlue, rayleighBlue, 0.16 + daySide * 0.16) * wideAir * 0.42 * shellReflectance * highAirFade;
          alpha =
            outerHalo * 0.08 * max(outerHaloStrength, 0.3) * mix(0.76, 1.08, shellReflectance - 0.48) +
            wideAir * 0.036 * max(outerHaloStrength, 0.3) * highAirFade * (0.52 + daySide * 0.38);
        }

        float activeGate = kind == 5
          ? surfaceGlowGate
          : (kind == 2 || kind == 3 ? outerShellGate : tangentGate);
        float productionAttenuation = mix(1.0, 0.94, productionMode);
        alpha *= intensity * closeHold * boost * activeGate * productionAttenuation;
        color *= intensity * closeHold * boost * activeGate * productionAttenuation;

        if (alpha < 0.00025) {
          discard;
        }

        float alphaCeiling = kind == 5 ? 0.5 : 0.26;
        gl_FragColor = vec4(min(color, vec3(1.46)), clamp(alpha, 0.0, alphaCeiling));
      }
    `,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcAlphaFactor,
    blendDst: OneFactor,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false
  });
}

function AtmosphereLayer({
  composition,
  assets,
  quality,
  sceneLightDirection,
  emphasis = false,
  spec
}: AtmosphereLayerProps) {
  const material = useMemo(() => createAtmosphereStackMaterial(composition, spec), [composition, spec]);
  const { texture: surfaceTexture } = useLandingTexture(assets.earthDay.src, {
    colorSpace: assets.earthDay.colorSpace,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    anisotropy: quality.tier === "high" ? 16 : 8
  });
  const radius = composition.earth.radius * spec.radius;
  const widthSegments = quality.tier === "high"
    ? Math.max(composition.earth.segments, quality.segments, 512)
    : quality.tier === "medium"
      ? Math.max(224, quality.segments)
      : 40;
  const heightSegments = quality.tier === "high" ? 256 : quality.tier === "medium" ? 128 : 36;

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
    material.uniforms.surfaceMap.value = surfaceTexture;
    material.uniforms.hasSurfaceMap.value = surfaceTexture ? 1 : 0;
  });

  return (
    <mesh material={material} renderOrder={spec.renderOrder}>
      <sphereGeometry args={[radius, widthSegments, heightSegments]} />
    </mesh>
  );
}

export function LandingAtmosphereStack({
  composition,
  assets,
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
          assets={assets}
          quality={quality}
          sceneLightDirection={sceneLightDirection}
          emphasis={emphasis}
          spec={spec}
        />
      ))}
    </>
  );
}
