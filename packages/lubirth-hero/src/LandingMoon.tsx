"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, MathUtils, Mesh, ShaderMaterial, SRGBColorSpace, Vector3 } from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
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

export function LandingMoon({ mode, composition, assets, quality, sceneLightDirection, position, targetScale }: LandingMoonProps) {
  const moon = useRef<Mesh>(null);
  const { camera } = useThree();
  const proceduralMoonTexture = useMemo(
    () => createMoonTexture(quality.tier === "high" ? 512 : 256),
    [quality.tier]
  );
  const [shouldLoadMoonTexture, setShouldLoadMoonTexture] = useState(
    () => mode !== "field" || getRuntimeOpeningProgress(0) > 0.34
  );
  const { texture: loadedMoonTexture } = useLandingTexture(
    shouldLoadMoonTexture ? assets.moonColor.src : undefined,
    { colorSpace: assets.moonColor.colorSpace }
  );
  const moonTexture = loadedMoonTexture ?? proceduralMoonTexture;

  useEffect(() => {
    if (shouldLoadMoonTexture || mode !== "field") {
      return undefined;
    }

    const timeout = window.setTimeout(() => setShouldLoadMoonTexture(true), 3200);
    return () => window.clearTimeout(timeout);
  }, [mode, shouldLoadMoonTexture]);

  const material = useMemo(
    () => {
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
          birthPhaseWeight: { value: getBirthPhaseWeight(composition.moon.lightingMode) }
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

          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPosition;

          void main() {
            vec3 sampled = texture2D(moonMap, vUv).rgb;
            float luma = dot(sampled, vec3(0.299, 0.587, 0.114));
            vec3 base = pow(mix(vec3(luma), sampled, 0.48), vec3(0.66));
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

            vec3 moonLight = mix(lightColor, vec3(0.74, 0.8, 0.95), 0.72);
            float exposure = sunIntensity * mix(0.32, 0.44, fullness);
            vec3 lit = base * moonLight * exposure * (0.26 + directLight * 0.78 + grazingLight * 0.16)
              * limbLight * terrainContrast;
            vec3 night = base * vec3(0.18, 0.22, 0.32) * (0.12 + nightLift * 0.7);
            float earthshine = pow(viewerFacing, 1.8) * (1.0 - daySide) * (0.022 + nightLift * 0.12);
            vec3 color = mix(night, lit, daySide);
            color += base * vec3(0.32, 0.42, 0.62) * earthshine;
            color += vec3(0.08, 0.12, 0.18) * pow(1.0 - viewerFacing, 2.4) * visibleDisk * (0.1 + daySide * 0.14);
            color *= mix(0.98, 1.08, birthPhaseWeight * fullness);
            color *= 0.36 + visibleDisk * 0.64;
            color = mix(color, color * vec3(0.94, 0.99, 1.06), 0.2);
            color *= 1.0 + fullness * 0.05;
            color = color / (1.0 + max(color - vec3(0.82), vec3(0.0)) * 0.62);
            color = min(color, vec3(0.92));
            gl_FragColor = vec4(color, 1.0);
          }
        `,
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
      moonTexture
    ]
  );

  useFrame(() => {
    if (!moon.current) {
      return;
    }

    const progress = getRuntimeOpeningProgress(mode === "field" ? 0 : 1);
    if (!shouldLoadMoonTexture && progress > 0.34) {
      setShouldLoadMoonTexture(true);
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

  if (!composition.moon.visible) {
    return null;
  }

  return (
    <mesh ref={moon} material={material} renderOrder={2}>
      <sphereGeometry args={[composition.moon.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
