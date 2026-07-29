"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, MathUtils, Mesh, ShaderMaterial, SRGBColorSpace, Vector3 } from "three";
import { type QualityProfile } from "@miralith/visual-core";
import type { EarthMoonHeroMode, LandingComposition, LandingResolvedAssets } from "./types";
import { createMoonTexture } from "./textures";
import { useLandingTexture } from "./useLandingTexture";

interface LandingMoonProps {
  mode: EarthMoonHeroMode;
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
  sceneLightDirection: Vector3;
  position: Vector3;
  targetScale: Vector3;
  nasaLiteOptics?: boolean;
  onTextureReady?: () => void;
}

const lightDirection = new Vector3();
const birthPhaseLightDirection = new Vector3();
const scaledTarget = new Vector3();
const fixedFullMoonLight = new Vector3(0, 0, 1).normalize();

function getBirthPhaseWeight(mode: LandingComposition["moon"]["lightingMode"]) {
  if (mode === "birthPhase") {
    return 1;
  }

  if (mode === "sceneLit") {
    return 0;
  }

  return 0.72;
}

function setBirthPhaseLightDirection(target: Vector3, phaseAngleRad: number) {
  return target.set(Math.sin(phaseAngleRad), 0, Math.cos(phaseAngleRad)).normalize();
}

export function LandingMoon({
  mode,
  composition,
  assets,
  quality,
  sceneLightDirection,
  position,
  targetScale,
  nasaLiteOptics = false,
  onTextureReady
}: LandingMoonProps) {
  const moon = useRef<Mesh>(null);
  const { camera } = useThree();
  const proceduralMoonTexture = useMemo(
    () => createMoonTexture(quality.tier === "high" ? 512 : 256),
    [quality.tier]
  );
  const { texture: loadedMoonTexture, failed: moonTextureFailed } = useLandingTexture(
    assets.moonColor.src,
    { colorSpace: assets.moonColor.colorSpace }
  );
  const moonTexture = loadedMoonTexture ?? (mode === "field" && !moonTextureFailed ? null : proceduralMoonTexture);

  useEffect(() => {
    if (loadedMoonTexture) {
      onTextureReady?.();
    }
  }, [loadedMoonTexture, onTextureReady]);

  const material = useMemo(
    () => {
      if (!moonTexture) {
        return null;
      }

      moonTexture.colorSpace = SRGBColorSpace;

      return new ShaderMaterial({
        uniforms: {
          moonMap: { value: moonTexture },
          lightDir: { value: fixedFullMoonLight.clone() },
          lightColor: {
            value: new Color(
              composition.light.color[0],
              composition.light.color[1],
              composition.light.color[2]
            )
          },
          sunIntensity: { value: composition.light.intensity },
          nightLift: { value: composition.moon.nightLift },
          terminatorSoftness: { value: composition.earth.terminatorSoftness * 0.55 },
          phaseAngle: { value: composition.moon.fixedPhase?.phaseAngleRad ?? 0.24 },
          birthLightDir: {
            value: setBirthPhaseLightDirection(
              birthPhaseLightDirection,
              composition.moon.fixedPhase?.phaseAngleRad ?? 0.24
            ).clone()
          },
          birthPhaseWeight: { value: getBirthPhaseWeight(composition.moon.lightingMode) },
          nasaLiteOptics: { value: nasaLiteOptics ? 1 : 0 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPosition;

          void main() {
            vUv = uv;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = mvPosition.xyz;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D moonMap;
          uniform vec3 lightDir;
          uniform vec3 lightColor;
          uniform float sunIntensity;
          uniform float nightLift;
          uniform float terminatorSoftness;
          uniform float phaseAngle;
          uniform vec3 birthLightDir;
          uniform float birthPhaseWeight;
          uniform float nasaLiteOptics;

          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPosition;

          void main() {
            vec3 sampled = texture2D(moonMap, vUv).rgb;
            float luma = dot(sampled, vec3(0.299, 0.587, 0.114));
            vec3 base = pow(mix(vec3(luma), sampled, 0.36), vec3(0.78));
            vec3 n = normalize(vNormal);
            vec3 sceneLight = normalize(lightDir);
            vec3 birthLight = normalize(birthLightDir);
            float fullness = 0.5 + 0.5 * cos(phaseAngle);
            float viewerFacing = max(n.z, 0.0);
            float visibleDisk = smoothstep(-0.015, 0.075, viewerFacing);
            float sceneNdl = dot(n, sceneLight);
            float birthNdl = dot(n, birthLight);
            float ndl = mix(sceneNdl, birthNdl, birthPhaseWeight);
            float transition = max(terminatorSoftness, 0.035);
            float daySide = smoothstep(-transition * 1.12, transition * 0.85, ndl);
            float directLight = pow(max(ndl, 0.0), 0.74);
            float grazingLight = pow(
              clamp((ndl + transition * 1.3) / max(transition * 2.6, 0.001), 0.0, 1.0),
              1.25
            ) * (1.0 - smoothstep(transition * 0.45, transition * 2.8, abs(ndl)));
            float limbLight = 0.72 + 0.28 * pow(viewerFacing, 0.45);
            float terrainContrast = 0.82 + luma * 0.22;

            float waxing = smoothstep(-0.08, 0.08, phaseAngle);
            float crescent = 1.0 - smoothstep(0.18, 0.58, fullness);
            float lowPhase = 1.0 - smoothstep(0.25, 0.7, fullness);
            float gibbousWarmth = smoothstep(0.48, 0.96, fullness);
            vec3 coolPhaseTint = vec3(0.76, 0.86, 1.08);
            vec3 neutralPhaseTint = vec3(0.94, 0.96, 1.0);
            vec3 warmPhaseTint = vec3(1.08, 1.0, 0.88);
            vec3 phaseTint = mix(neutralPhaseTint, coolPhaseTint, crescent * (0.58 + (1.0 - waxing) * 0.24));
            phaseTint = mix(phaseTint, warmPhaseTint, gibbousWarmth * (0.66 + waxing * 0.12));

            float coolMoonMix = clamp(0.5 - gibbousWarmth * 0.18 + crescent * 0.08, 0.26, 0.58);
            vec3 moonLight = mix(lightColor * vec3(1.04, 1.0, 0.9), vec3(0.78, 0.84, 0.98), coolMoonMix) * phaseTint;
            float exposure = sunIntensity * mix(0.31, 0.48, fullness);
            vec3 lit = base * moonLight * exposure * (0.26 + directLight * 0.78 + grazingLight * 0.16)
              * limbLight * terrainContrast;
            float nasaLiteLowPhase = nasaLiteOptics * lowPhase;
            float crescentDirectBoost = 1.0 + nasaLiteLowPhase * 3.2;
            lit *= crescentDirectBoost;
            vec3 night = base * vec3(0.28, 0.34, 0.48)
              * (0.32 + nightLift * 1.2 + lowPhase * 0.12 + nasaLiteLowPhase * 0.16);
            float earthshine = pow(viewerFacing, 1.8) * (1.0 - daySide)
              * (0.085 + nightLift * 0.24 + lowPhase * 0.09 + nasaLiteLowPhase * 0.11);
            vec3 color = mix(night, lit, daySide);
            color += base * vec3(0.32, 0.42, 0.62) * earthshine;
            color += vec3(0.08, 0.12, 0.18) * pow(1.0 - viewerFacing, 2.4) * visibleDisk * (0.1 + daySide * 0.14);
            color *= mix(0.9, 1.02, birthPhaseWeight * fullness);
            color *= 0.36 + visibleDisk * 0.64;
            color = mix(color, color * vec3(0.97, 1.0, 1.04), crescent * 0.18);
            color *= 0.92 + fullness * 0.08;
            color = color / (1.0 + max(color - vec3(0.72), vec3(0.0)) * 0.56);
            color = min(color, vec3(0.86));
            float diskAlpha = visibleDisk * mix(0.82 + nasaLiteLowPhase * 0.05, 0.96, fullness);
            diskAlpha *= mix(0.9, 1.0, daySide);
            gl_FragColor = vec4(color, diskAlpha);
          }
        `,
        transparent: true,
        depthTest: true,
        depthWrite: false
      });
    },
    [
      composition.earth.terminatorSoftness,
      composition.light.color,
      composition.light.intensity,
      composition.moon.fixedPhase,
      composition.moon.lightingMode,
      composition.moon.nightLift,
      moonTexture,
      nasaLiteOptics
    ]
  );

  useFrame(() => {
    if (!moon.current || !material) {
      return;
    }

    scaledTarget.copy(targetScale);
    moon.current.position.copy(position);
    moon.current.scale.copy(scaledTarget);
    moon.current.quaternion.copy(camera.quaternion);
    moon.current.rotateY(MathUtils.degToRad(composition.moon.yawDeg));
    const moonMaterial = moon.current.material as ShaderMaterial;
    const phase = composition.moon.fixedPhase;
    lightDirection.copy(sceneLightDirection).transformDirection(camera.matrixWorldInverse).normalize();
    setBirthPhaseLightDirection(
      birthPhaseLightDirection,
      phase?.phaseAngleRad ?? 0.253
    );
    moonMaterial.uniforms.lightDir.value.copy(lightDirection);
    moonMaterial.uniforms.birthLightDir.value.copy(birthPhaseLightDirection);
    moonMaterial.uniforms.birthPhaseWeight.value = getBirthPhaseWeight(composition.moon.lightingMode);
    moonMaterial.uniforms.sunIntensity.value = composition.light.intensity;
    moonMaterial.uniforms.nightLift.value = composition.moon.nightLift;
    moonMaterial.uniforms.phaseAngle.value = phase?.phaseAngleRad ?? 0.253;
  });

  if (!composition.moon.visible || !material) {
    return null;
  }

  return (
    <mesh ref={moon} material={material} renderOrder={2}>
      <sphereGeometry args={[composition.moon.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
