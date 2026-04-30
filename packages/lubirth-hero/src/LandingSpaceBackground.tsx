"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
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
}

function random(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function LandingSpaceBackground({ quality, spaceBackground }: LandingSpaceBackgroundProps) {
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
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
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
          texture.repeat.set(2, 1);
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

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(load, { timeout: 2500 });
    } else {
      timeoutHandle = window.setTimeout(load, 2500);
    }

    return () => {
      disposed = true;
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
      loadedTexture?.dispose();
    };
  }, [quality.tier, spaceBackground?.colorSpace, spaceBackground?.src]);

  const starGeometry = useMemo(() => {
    const count = quality.stars;
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
      const brightness = random(index + 251) > 0.9 ? 1.22 : 0.6 + random(index + 271) * 0.42;
      colors[i3] = brightness * cool;
      colors[i3 + 1] = brightness * (0.9 + cool * 0.12);
      colors[i3 + 2] = brightness * 1.12;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    return geometry;
  }, [quality.stars, quality.tier]);

  const starMaterial = useMemo(() => {
    return new PointsMaterial({
      size: quality.tier === "high" ? 0.07 : 0.064,
      sizeAttenuation: true,
      vertexColors: true,
      color: new Color("#d8e8ff"),
      transparent: true,
      opacity: backgroundTexture ? 0.64 : 0.98,
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
          float galacticHaze = exp(-pow((vDir.y - 0.18) * 3.2, 2.0)) * 0.68;
          vec3 base = mix(vec3(0.0, 0.004, 0.01), vec3(0.008, 0.026, 0.056), upperBlue);
          base += vec3(0.012, 0.028, 0.052) * galacticHaze;
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
        exposure: { value: quality.tier === "high" ? 1.78 : 1.58 },
        hazeLift: { value: quality.tier === "high" ? 0.26 : 0.22 }
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

        varying vec2 vUv;
        varying vec3 vDir;

        void main() {
          vec2 skyUv = vec2(vUv.x, clamp(vUv.y, 0.0, 1.0));
          vec3 tex = texture2D(map, skyUv).rgb;
          float luma = max(max(tex.r, tex.g), tex.b);
          float haze = smoothstep(0.035, 0.32, luma);
          float star = smoothstep(0.5, 0.96, luma);
          vec3 deepSky = mix(vec3(0.0, 0.003, 0.008), vec3(0.006, 0.015, 0.03), smoothstep(-0.3, 0.75, vDir.y));
          vec3 lifted = pow(max(tex, vec3(0.0)), vec3(0.78)) * exposure;
          vec3 coolHaze = lifted * (0.38 + haze * hazeLift);
          vec3 pinStars = vec3(0.72, 0.84, 1.0) * star * 0.36;

          gl_FragColor = vec4(min(deepSky + coolHaze + pinStars, vec3(0.42)), 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
      depthTest: false
    });
  }, [backgroundFailed, backgroundTexture, quality.tier]);

  const useTextureBackdrop = Boolean(textureMaterial && !backgroundFailed);
  const showPointStars = quality.stars > 0;

  useFrame(() => {
    if (!fixedSky.current) {
      return;
    }

    fixedSky.current.position.copy(camera.position);
    fixedSky.current.quaternion.copy(camera.quaternion);
  }, -10);

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
