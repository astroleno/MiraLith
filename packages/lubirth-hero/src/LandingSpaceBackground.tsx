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
    const textureBacked = Boolean(backgroundTexture);
    const count = Math.round(quality.stars * (emphasis ? 0.58 : textureBacked ? 0.22 : 0.34));
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
      const rareBright = random(index + 251) > 0.975;
      const brightness = rareBright ? 0.74 : 0.22 + random(index + 271) * 0.26;
      colors[i3] = brightness * cool;
      colors[i3 + 1] = brightness * (0.9 + cool * 0.12);
      colors[i3 + 2] = brightness * 1.12;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    return geometry;
  }, [backgroundTexture, emphasis, quality.stars]);

  const starMaterial = useMemo(() => {
    return new PointsMaterial({
      size: backgroundTexture
        ? quality.tier === "high" ? 0.018 : 0.015
        : quality.tier === "high" ? 0.026 : 0.022,
      sizeAttenuation: true,
      vertexColors: true,
      color: new Color("#d8e8ff"),
      transparent: true,
      opacity: backgroundTexture ? 0.085 : 0.3,
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
          float upperBlue = smoothstep(-0.18, 0.76, vDir.y);
          float galacticHaze = exp(-pow((vDir.y - 0.12) * 3.1, 2.0)) * 0.42;
          vec3 base = mix(vec3(0.0, 0.0012, 0.004), vec3(0.003, 0.007, 0.014), upperBlue);
          base += vec3(0.0045, 0.0055, 0.0072) * galacticHaze;
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
        exposure: { value: emphasis ? 1.18 : 1.0 },
        hazeLift: { value: emphasis ? 0.1 : 0.025 },
        starStrength: { value: emphasis ? 0.026 : 0.018 },
        starDamp: { value: emphasis ? 0.62 : 0.92 },
        textureStrength: { value: emphasis ? 0.06 : 0.006 },
        colorCeiling: { value: emphasis ? 0.14 : 0.088 }
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

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += noise(p) * a;
            p = p * 2.07 + vec2(13.7, 4.3);
            a *= 0.52;
          }
          return v;
        }

        void main() {
          vec2 skyUv = vec2(vUv.x, clamp(vUv.y, 0.0, 1.0));
          vec3 tex = texture2D(map, skyUv).rgb;
          float luma = max(max(tex.r, tex.g), tex.b);
          float textureHazeSource = min(luma, 0.18);
          float highLuma = max(0.0, luma - textureHazeSource * 0.72);
          float haze = smoothstep(0.04, 0.18, textureHazeSource);
          float star = smoothstep(0.16, 0.52, highLuma) * smoothstep(0.64, 0.98, luma);
          vec3 deepSky = mix(vec3(0.0, 0.00045, 0.0017), vec3(0.001, 0.0022, 0.0044), smoothstep(-0.3, 0.78, vDir.y));
          float longitude = atan(vDir.z, vDir.x);
          float wovenAxis =
            vDir.y -
            0.045 +
            sin(longitude * 1.7 + 0.8) * 0.038 +
            sin(longitude * 4.4 - 1.6) * 0.018;
          float broadBand = exp(-pow(wovenAxis * 4.1, 2.0));
          float narrowCore = exp(-pow(wovenAxis * 9.2, 2.0));
          float dustNoise = fbm(vec2(longitude * 1.25 + 2.0, vDir.y * 4.2 - 0.6));
          float dust = broadBand * smoothstep(0.24, 0.82, dustNoise);
          float darkLane = exp(-pow((wovenAxis + 0.032) * 8.0, 2.0)) * smoothstep(0.34, 0.82, fbm(vec2(longitude * 2.2 - 1.0, vDir.y * 7.0 + 1.8)));
          vec3 coolHaze = vec3(0.008, 0.012, 0.018) * haze * hazeLift * textureStrength * exposure;
          vec3 milkyDust =
            vec3(0.0018, 0.0024, 0.0042) * broadBand * (0.18 + dust * 0.42) +
            vec3(0.006, 0.008, 0.014) * narrowCore * dust * 0.38;
          milkyDust *= mix(1.0, 0.38, darkLane * 0.62);
          vec2 starP = skyUv * vec2(1480.0, 740.0);
          vec2 starCell = floor(starP);
          vec2 starLocal = fract(starP) - 0.5;
          float starSeed = hash(starCell);
          float proceduralStar = step(0.9888, starSeed) * smoothstep(0.12, 0.0, length(starLocal));
          vec2 brightStarP = skyUv * vec2(620.0, 310.0);
          vec2 brightStarCell = floor(brightStarP);
          vec2 brightStarLocal = fract(brightStarP) - 0.5;
          float brightSeed = hash(brightStarCell + vec2(17.0, 23.0));
          float brightStar = step(0.9958, brightSeed) * smoothstep(0.16, 0.0, length(brightStarLocal));
          vec3 pinStars = vec3(0.72, 0.82, 1.0) * (
            star * starStrength * 0.72 +
            proceduralStar * 0.052 +
            brightStar * 0.13
          );

          gl_FragColor = vec4(min(deepSky + coolHaze + milkyDust + pinStars, vec3(colorCeiling)), 1.0);
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
