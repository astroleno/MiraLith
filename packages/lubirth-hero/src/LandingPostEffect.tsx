"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  Sprite,
  SpriteMaterial,
  UnsignedByteType,
  Vector2
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import type { LandingComposition, LandingPostEffectMode } from "./types";

interface LandingPostEffectProps {
  composition: LandingComposition;
  quality: QualityProfile;
  emphasis?: boolean;
  mode?: LandingPostEffectMode;
}

declare global {
  interface Window {
    __MiraLithLuBirthPostEffectActive?: boolean;
    __MiraLithLuBirthPostEffectMode?: LandingPostEffectMode;
    __MiraLithLuBirthAnalyticHaloConfig?: {
      diameterScale: number;
      opacityMax: number;
      opacityMin: number;
      textureSize: number;
    };
  }
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

const ANALYTIC_HALO_DIAMETER_SCALE = 2.16;
const ANALYTIC_HALO_OPACITY_MIN = 0.045;
const ANALYTIC_HALO_OPACITY_MAX = 0.055;

export function createLiteBloomTextureData() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = ((x + 0.5) / size - 0.5) * 2;
      const dy = ((y + 0.5) / size - 0.5) * 2;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const inner = smoothstep(0.72, 0.84, radius);
      const outer = 1 - smoothstep(0.84, 0.985, radius);
      const boundaryPixel = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const alpha = boundaryPixel ? 0 : inner * outer;
      const offset = (y * size + x) * 4;
      pixels[offset] = 132;
      pixels[offset + 1] = 194;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return { pixels, size };
}

function createLiteBloomTexture() {
  const { pixels, size } = createLiteBloomTextureData();
  const texture = new DataTexture(pixels, size, size, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const SHARPEN_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2(1, 1) },
    strength: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float strength;
    varying vec2 vUv;

    void main() {
      vec2 texel = 1.0 / max(resolution, vec2(1.0));
      vec4 center = texture2D(tDiffuse, vUv);
      vec3 neighbors =
        texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb +
        texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb +
        texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb;
      vec3 sharpened = center.rgb * (1.0 + strength * 4.0) - neighbors * strength;
      gl_FragColor = vec4(max(sharpened, vec3(0.0)), center.a);
    }
  `
};

function LandingAnalyticHalo({
  composition,
  quality
}: Pick<LandingPostEffectProps, "composition" | "quality">) {
  const enabled = quality.tier !== "fallback";
  const sprite = useRef<Sprite>(null);
  const bloomTexture = useMemo(() => createLiteBloomTexture(), []);

  useEffect(() => () => bloomTexture.dispose(), [bloomTexture]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthPostEffectActive = enabled;
    window.__MiraLithLuBirthPostEffectMode = enabled ? "analytic-halo" : "off";
    window.__MiraLithLuBirthAnalyticHaloConfig = enabled
      ? {
          diameterScale: ANALYTIC_HALO_DIAMETER_SCALE,
          opacityMax: ANALYTIC_HALO_OPACITY_MAX,
          opacityMin: ANALYTIC_HALO_OPACITY_MIN,
          textureSize: 64
        }
      : undefined;
    return () => {
      window.__MiraLithLuBirthPostEffectActive = false;
      window.__MiraLithLuBirthPostEffectMode = "off";
      window.__MiraLithLuBirthAnalyticHaloConfig = undefined;
    };
  }, [enabled]);

  useFrame(() => {
    if (!sprite.current) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const fieldStage = smoothstep(0.16, 0.82, progress);
    (sprite.current.material as SpriteMaterial).opacity = enabled
      ? ANALYTIC_HALO_OPACITY_MIN + fieldStage * (ANALYTIC_HALO_OPACITY_MAX - ANALYTIC_HALO_OPACITY_MIN)
      : 0;
  });

  if (!enabled) {
    return null;
  }

  const diameter = composition.earth.radius * ANALYTIC_HALO_DIAMETER_SCALE;
  return (
    <sprite ref={sprite} scale={[diameter, diameter, 1]} renderOrder={18}>
      <spriteMaterial
        map={bloomTexture}
        color="#8ac7ff"
        opacity={ANALYTIC_HALO_OPACITY_MIN}
        transparent
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

function LandingFullBloom({
  quality,
  emphasis = false,
  mode = "full-bloom"
}: LandingPostEffectProps) {
  const { gl, scene, camera, size } = useThree();
  const enabled = mode === "full-bloom" && quality.tier !== "fallback";
  const resolutionScale = 1;
  const { composer, bloomPass, renderPass, sharpenPass, outputPass } = useMemo(() => {
    const nextComposer = new EffectComposer(gl);
    const nextRenderPass = new RenderPass(scene, camera);
    const nextBloomPass = new UnrealBloomPass(
      new Vector2(size.width * resolutionScale, size.height * resolutionScale),
      emphasis ? 0.12 : 0.072,
      emphasis ? 0.48 : 0.38,
      emphasis ? 0.9 : 0.925
    );
    const nextSharpenPass = new ShaderPass(SHARPEN_SHADER);
    const nextOutputPass = new OutputPass();
    nextSharpenPass.enabled = true;
    nextComposer.addPass(nextRenderPass);
    nextComposer.addPass(nextBloomPass);
    nextComposer.addPass(nextSharpenPass);
    nextComposer.addPass(nextOutputPass);

    return {
      composer: nextComposer,
      bloomPass: nextBloomPass,
      outputPass: nextOutputPass,
      renderPass: nextRenderPass,
      sharpenPass: nextSharpenPass
    };
  }, [camera, emphasis, gl, mode, resolutionScale, scene, size.height, size.width]);

  useEffect(() => {
    return () => {
      bloomPass.dispose();
      sharpenPass.dispose();
      outputPass.dispose();
      composer.dispose();
    };
  }, [bloomPass, composer, outputPass, sharpenPass]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    composer.setPixelRatio(pixelRatio);
    composer.setSize(size.width, size.height);
    const bloomWidth = size.width * pixelRatio * resolutionScale;
    const bloomHeight = size.height * pixelRatio * resolutionScale;
    bloomPass.setSize(bloomWidth, bloomHeight);
    bloomPass.resolution.set(bloomWidth, bloomHeight);
    sharpenPass.uniforms.resolution.value.set(size.width * pixelRatio, size.height * pixelRatio);
  }, [bloomPass, composer, gl, resolutionScale, sharpenPass, size.height, size.width]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthPostEffectActive = enabled;
    window.__MiraLithLuBirthPostEffectMode = enabled ? "full-bloom" : "off";
    return () => {
      window.__MiraLithLuBirthPostEffectActive = false;
      window.__MiraLithLuBirthPostEffectMode = "off";
    };
  }, [enabled]);

  useFrame((_state, delta) => {
    if (!enabled) {
      return;
    }

    const progress = getRuntimeOpeningProgress(0);
    const fieldStage = smoothstep(0.16, 0.82, progress);
    const closeStage = 1 - smoothstep(0.18, 0.86, progress);
    const emphasisLift = emphasis ? 1 : 0;
    bloomPass.strength = (
      0.11 +
      fieldStage * 0.038 +
      emphasisLift * (0.022 + fieldStage * 0.014)
    );
    bloomPass.radius = 0.58 + fieldStage * 0.075 + emphasisLift * 0.032;
    bloomPass.threshold = 0.888 - fieldStage * 0.012 - emphasisLift * 0.016;
    sharpenPass.uniforms.strength.value =
      quality.tier === "high"
        ? 0.006 + closeStage * 0.018 + emphasisLift * 0.006
        : 0.006 + closeStage * 0.014;
    renderPass.scene = scene;
    renderPass.camera = camera;
    composer.render(delta);
  }, 1);

  return null;
}

export function LandingPostEffect(props: LandingPostEffectProps) {
  if (props.mode === "analytic-halo") {
    return <LandingAnalyticHalo composition={props.composition} quality={props.quality} />;
  }

  return <LandingFullBloom {...props} />;
}
