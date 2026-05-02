"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";

interface LandingPostBloomProps {
  quality: QualityProfile;
  emphasis?: boolean;
}

declare global {
  interface Window {
    __MiraLithLuBirthPostBloomActive?: boolean;
  }
}

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 1e-5)));
  return t * t * (3 - 2 * t);
};

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

export function LandingPostBloom({ quality, emphasis = false }: LandingPostBloomProps) {
  const { gl, scene, camera, size } = useThree();
  const enabled = quality.tier !== "fallback";
  const { composer, bloomPass, renderPass, sharpenPass } = useMemo(() => {
    const nextComposer = new EffectComposer(gl);
    const nextRenderPass = new RenderPass(scene, camera);
    const nextBloomPass = new UnrealBloomPass(
      new Vector2(size.width, size.height),
      emphasis ? 0.12 : 0.072,
      emphasis ? 0.48 : 0.38,
      emphasis ? 0.9 : 0.925
    );
    const nextSharpenPass = new ShaderPass(SHARPEN_SHADER);
    nextComposer.addPass(nextRenderPass);
    nextComposer.addPass(nextBloomPass);
    nextComposer.addPass(nextSharpenPass);
    nextComposer.addPass(new OutputPass());

    return {
      composer: nextComposer,
      bloomPass: nextBloomPass,
      renderPass: nextRenderPass,
      sharpenPass: nextSharpenPass
    };
  }, [camera, emphasis, gl, scene, size.height, size.width]);

  useEffect(() => {
    return () => composer.dispose();
  }, [composer]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    composer.setPixelRatio(pixelRatio);
    composer.setSize(size.width, size.height);
    bloomPass.resolution.set(size.width * pixelRatio, size.height * pixelRatio);
    sharpenPass.uniforms.resolution.value.set(size.width * pixelRatio, size.height * pixelRatio);
  }, [bloomPass, composer, gl, sharpenPass, size.height, size.width]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.__MiraLithLuBirthPostBloomActive = enabled;
    return () => {
      window.__MiraLithLuBirthPostBloomActive = false;
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
      0.072 +
      fieldStage * 0.032 +
      emphasisLift * (0.022 + fieldStage * 0.014)
    );
    bloomPass.radius = 0.38 + fieldStage * 0.055 + emphasisLift * 0.03;
    bloomPass.threshold = 0.925 - fieldStage * 0.018 - emphasisLift * 0.018;
    sharpenPass.uniforms.strength.value =
      quality.tier === "high"
        ? 0.016 + closeStage * 0.062 + emphasisLift * 0.01
        : 0.012 + closeStage * 0.04;
    renderPass.scene = scene;
    renderPass.camera = camera;
    composer.render(delta);
  }, 1);

  return null;
}
