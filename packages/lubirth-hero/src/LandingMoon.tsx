"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, MathUtils, Mesh, ShaderMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3 } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { EarthMoonHeroMode, LandingComposition, LandingResolvedAssets } from "./types";
import { createMoonTexture } from "./textures";

interface LandingMoonProps {
  mode: EarthMoonHeroMode;
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
  position: Vector3;
  targetScale: Vector3;
}

const lightDirection = new Vector3();
const scaledTarget = new Vector3();
const fixedFullMoonLight = new Vector3(0, 0, 1).normalize();

export function LandingMoon({ composition, assets, quality, position, targetScale }: LandingMoonProps) {
  const moon = useRef<Mesh>(null);
  const { camera } = useThree();
  const proceduralMoonTexture = useMemo(
    () => createMoonTexture(quality.tier === "high" ? 512 : 256),
    [quality.tier]
  );
  const [loadedMoonTexture, setLoadedMoonTexture] = useState<Texture | null>(null);
  const moonTexture = loadedMoonTexture ?? proceduralMoonTexture;

  useEffect(() => {
    let active = true;
    const loader = new TextureLoader();
    loader.load(
      assets.moonColor.src,
      (texture) => {
        if (!active) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        setLoadedMoonTexture(texture);
      },
      undefined,
      () => setLoadedMoonTexture(null)
    );

    return () => {
      active = false;
    };
  }, [assets.moonColor.src]);

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
          phaseAngle: { value: composition.moon.fixedPhase?.phaseAngleRad ?? 0.24 }
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

          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPosition;

          void main() {
            vec3 sampled = texture2D(moonMap, vUv).rgb;
            float luma = dot(sampled, vec3(0.299, 0.587, 0.114));
            vec3 base = pow(mix(vec3(luma), sampled, 0.48), vec3(0.64));
            vec3 n = normalize(vNormal);
            float fullness = 0.5 + 0.5 * cos(phaseAngle);
            float visibleDisk = smoothstep(-0.015, 0.075, max(n.z, 0.0));
            float limbLight = 0.86 + 0.18 * pow(max(n.z, 0.0), 0.34);
            float sliverWidth = mix(0.16, 0.08, fullness);
            float leftSliver = (1.0 - smoothstep(-1.0, -1.0 + sliverWidth, n.x))
              * smoothstep(0.0, 0.22, max(n.z, 0.0));
            float phaseDim = 1.0 - leftSliver * mix(0.18, 0.08, fullness);
            float rightFill = smoothstep(-0.15, 0.9, n.x) * smoothstep(0.0, 0.16, max(n.z, 0.0));
            float surge = 1.08 + 0.12 * fullness;

            vec3 moonLight = mix(lightColor, vec3(0.82, 0.88, 1.0), 0.5);
            vec3 lit = base * moonLight * sunIntensity * limbLight * phaseDim * surge * (0.45 + rightFill * 0.055);
            vec3 edgeFloor = base * (0.24 + nightLift * 0.24);
            vec3 color = mix(edgeFloor, lit, visibleDisk);
            color = mix(color, color * vec3(0.92, 0.98, 1.08), 0.28);
            color *= 1.0 + fullness * 0.08;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        depthTest: false,
        depthWrite: false
      });
    },
    [composition.light.color, composition.light.intensity, composition.moon.nightLift, moonTexture]
  );

  useFrame(() => {
    if (!moon.current) {
      return;
    }

    scaledTarget.copy(targetScale);
    moon.current.position.copy(position);
    moon.current.scale.copy(scaledTarget);
    moon.current.quaternion.copy(camera.quaternion);
    moon.current.rotateY(MathUtils.degToRad(composition.moon.yawDeg));
    const moonMaterial = moon.current.material as ShaderMaterial;
    const phase = composition.moon.fixedPhase;
    lightDirection.copy(fixedFullMoonLight);
    moonMaterial.uniforms.lightDir.value.copy(lightDirection);
    moonMaterial.uniforms.sunIntensity.value = composition.light.intensity;
    moonMaterial.uniforms.nightLift.value = composition.moon.nightLift;
    moonMaterial.uniforms.phaseAngle.value = phase?.phaseAngleRad ?? 0.253;
  });

  if (!composition.moon.visible) {
    return null;
  }

  return (
    <mesh ref={moon} material={material} renderOrder={20}>
      <sphereGeometry args={[composition.moon.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
