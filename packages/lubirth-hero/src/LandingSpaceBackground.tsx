"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ClampToEdgeWrapping,
  Group,
  MathUtils,
  PointsMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader
} from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { TextureRef } from "./types";

interface LandingSpaceBackgroundProps {
  quality: QualityProfile;
  spaceBackground?: TextureRef;
  emphasis?: boolean;
  counterRotation?: MutableRefObject<{ yawRad: number }>;
}

function random(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function LandingSpaceBackground({
  quality,
  spaceBackground,
  emphasis = false,
  counterRotation
}: LandingSpaceBackgroundProps) {
  const fixedSky = useRef<Group>(null);
  const { camera } = useThree();
  const [backgroundTexture, setBackgroundTexture] = useState<Texture | null>(null);
  const [backgroundFailed, setBackgroundFailed] = useState(false);

  useEffect(() => {
    setBackgroundTexture(null);
    setBackgroundFailed(false);

    if (!spaceBackground?.src || quality.tier !== "high") {
      return undefined;
    }

    let disposed = false;
    let loadedTexture: Texture | null = null;
    let timeoutHandle: number | null = null;
    const loader = new TextureLoader();

    const load = () => {
      if (disposed) {
        return;
      }

      loader.load(
        spaceBackground.src,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }

          texture.colorSpace = spaceBackground.colorSpace === "srgb" ? SRGBColorSpace : texture.colorSpace;
          texture.wrapS = RepeatWrapping;
          texture.wrapT = ClampToEdgeWrapping;
          texture.center.set(0.5, 0.5);
          texture.repeat.set(1, 1);
          texture.needsUpdate = true;
          loadedTexture = texture;
          setBackgroundTexture(texture);
        },
        undefined,
        () => {
          if (!disposed) {
            setBackgroundFailed(true);
          }
        }
      );
    };

    timeoutHandle = window.setTimeout(load, 180);

    return () => {
      disposed = true;
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
      loadedTexture?.dispose();
    };
  }, [quality.tier, spaceBackground?.colorSpace, spaceBackground?.src]);

  const starGeometry = useMemo(() => {
    const count = Math.round(quality.stars * (emphasis ? 0.78 : 0.36));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const u = random(index + 1);
      const v = random(index + 37);
      const theta = u * Math.PI * 2;
      const y = v * 1.55 - 0.24;
      const radius = 36 + random(index + 91) * 10;
      const band = Math.sqrt(Math.max(0.08, 1 - y * y));
      const i3 = index * 3;

      positions[i3] = Math.cos(theta) * band * radius;
      positions[i3 + 1] = y * radius;
      positions[i3 + 2] = Math.sin(theta) * band * radius;

      const cool = 0.68 + random(index + 143) * 0.22;
      const brightness = random(index + 251) > 0.94 ? 0.82 : 0.34 + random(index + 271) * 0.28;
      colors[i3] = brightness * cool;
      colors[i3 + 1] = brightness * (0.9 + cool * 0.12);
      colors[i3 + 2] = brightness * 1.12;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    return geometry;
  }, [emphasis, quality.stars, quality.tier]);

  const starMaterial = useMemo(() => {
    return new PointsMaterial({
      size: quality.tier === "high" ? 0.045 : 0.04,
      sizeAttenuation: true,
      vertexColors: true,
      color: new Color("#d8e8ff"),
      transparent: true,
      opacity: backgroundTexture ? 0.08 : 0.46,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
  }, [backgroundTexture, quality.tier]);

  const skyMaterial = useMemo(() => {
    return new ShaderMaterial({
      vertexShader: `
        varying vec3 vDir;

        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;

        void main() {
          float upperBlue = smoothstep(-0.22, 0.72, vDir.y);
          float galacticHaze = exp(-pow((vDir.y - 0.18) * 3.4, 2.0)) * 0.42;
          vec3 base = mix(vec3(0.0, 0.003, 0.009), vec3(0.006, 0.018, 0.04), upperBlue);
          base += vec3(0.01, 0.022, 0.044) * galacticHaze;
          gl_FragColor = vec4(base, 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
      depthTest: false
    });
  }, []);

  const textureMaterial = useMemo(() => {
    if (!backgroundTexture || backgroundFailed) {
      return null;
    }

    return new ShaderMaterial({
      uniforms: {
        map: { value: backgroundTexture },
        exposure: { value: emphasis ? 1.55 : 0.72 },
        hazeLift: { value: emphasis ? 0.18 : 0.034 },
        starStrength: { value: emphasis ? 0.08 : 0.006 },
        starDamp: { value: emphasis ? 0.24 : 0.9 },
        textureStrength: { value: emphasis ? 0.16 : 0.026 },
        colorCeiling: { value: emphasis ? 0.2 : 0.052 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vDir;

        void main() {
          vUv = uv;
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float exposure;
        uniform float hazeLift;
        uniform float starStrength;
        uniform float starDamp;
        uniform float textureStrength;
        uniform float colorCeiling;

        varying vec2 vUv;
        varying vec3 vDir;

        void main() {
          vec2 skyUv = vec2(vUv.x, clamp(vUv.y, 0.0, 1.0));
          vec3 tex = texture2D(map, skyUv).rgb;
          float luma = max(max(tex.r, tex.g), tex.b);
          float haze = smoothstep(0.018, 0.22, luma);
          float star = smoothstep(0.36, 0.9, luma);
          vec3 deepSky = mix(vec3(0.0, 0.0035, 0.009), vec3(0.008, 0.018, 0.034), smoothstep(-0.3, 0.75, vDir.y));
          vec3 lifted = pow(max(tex, vec3(0.0)), vec3(0.62)) * exposure * (1.0 - star * starDamp);
          vec3 coolHaze = lifted * (textureStrength + haze * hazeLift);
          vec3 pinStars = vec3(0.76, 0.86, 1.0) * star * starStrength;

          gl_FragColor = vec4(min(deepSky + coolHaze + pinStars, vec3(colorCeiling)), 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
      depthTest: false
    });
  }, [backgroundFailed, backgroundTexture, emphasis]);

  const useTextureBackdrop = Boolean(textureMaterial && !backgroundFailed);
  const showPointStars = quality.stars > 0 && !backgroundTexture;

  useFrame(() => {
    if (!fixedSky.current) {
      return;
    }

    fixedSky.current.position.copy(camera.position);
    fixedSky.current.quaternion.copy(camera.quaternion);
    if (counterRotation) {
      fixedSky.current.rotateY(counterRotation.current.yawRad);
    }
  }, -1);

  return (
    <group ref={fixedSky}>
      <mesh
        material={useTextureBackdrop ? textureMaterial ?? skyMaterial : skyMaterial}
        renderOrder={-60}
        rotation={[0, MathUtils.degToRad(-61), 0]}
      >
        <sphereGeometry args={[46, 32, 18]} />
      </mesh>
      {showPointStars ? <points geometry={starGeometry} material={starMaterial} renderOrder={-50} /> : null}
    </group>
  );
}
