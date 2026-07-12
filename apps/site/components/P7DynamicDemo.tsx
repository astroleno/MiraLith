"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2
} from "three";

const P7_IMAGE_SRC = "/img/P7_1.png";
const P7_IMAGE_SIZE = new Vector2(2560, 1440);

const paintingVertexShader = /* glsl */ `
  uniform float uIntro;
  uniform float uMotion;
  uniform float uTime;

  varying vec2 vUv;

  float foregroundDepth(vec2 uv) {
    float lowGround = smoothstep(0.42, 0.08, uv.y);
    float statue = exp(-19.0 * pow(uv.x - 0.5, 2.0) - 28.0 * pow(uv.y - 0.30, 2.0));
    float dome = smoothstep(0.42, 0.92, uv.y) * 0.22;
    return clamp(lowGround * 0.92 + statue * 0.72 + dome, 0.0, 1.0);
  }

  void main() {
    vUv = uv;

    float depth = foregroundDepth(uv);
    float breathe = sin(uTime * 0.42 + uv.x * 4.6 + uv.y * 2.0) * 0.012 * uMotion;
    vec3 transformed = position;
    transformed.x += (uv.x - 0.5) * depth * 0.028 * uIntro * uMotion;
    transformed.y += breathe * smoothstep(0.25, 0.95, uv.y);
    transformed.z += depth * 0.16 * uIntro;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const paintingFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uImageResolution;
  uniform float uIntro;
  uniform float uMotion;
  uniform vec2 uPointer;
  uniform vec2 uResolution;
  uniform float uTime;

  varying vec2 vUv;

  vec2 coverUv(vec2 uv, vec2 screen, vec2 image) {
    float screenAspect = screen.x / max(screen.y, 1.0);
    float imageAspect = image.x / image.y;
    vec2 scale = screenAspect < imageAspect
      ? vec2(screenAspect / imageAspect, 1.0)
      : vec2(1.0, imageAspect / screenAspect);
    return (uv - 0.5) * scale + 0.5;
  }

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotate = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = rotate * p * 2.02 + 13.7;
      amplitude *= 0.5;
    }
    return value;
  }

  float pseudoDepth(vec2 uv) {
    float lowGround = smoothstep(0.42, 0.08, uv.y);
    float statue = exp(-20.0 * pow(uv.x - 0.5, 2.0) - 30.0 * pow(uv.y - 0.30, 2.0));
    float starWell = exp(-10.0 * pow(uv.x - 0.53, 2.0) - 14.0 * pow(uv.y - 0.58, 2.0));
    float dome = smoothstep(0.44, 0.90, uv.y);
    return clamp(lowGround * 0.95 + statue * 0.78 + starWell * 0.20 + dome * 0.12, 0.0, 1.0);
  }

  vec3 grade(vec3 color, vec2 uv) {
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float bright = smoothstep(0.52, 1.0, max(max(color.r, color.g), color.b));
    float center = smoothstep(0.92, 0.26, distance(uv, vec2(0.52, 0.54)));
    vec3 warmGlow = vec3(1.0, 0.58, 0.18) * bright * 0.22;
    vec3 coldGlow = vec3(0.10, 0.62, 1.0) * smoothstep(0.35, 0.82, color.b) * 0.12;
    color += (warmGlow + coldGlow) * center;
    color = mix(color, color * color * 1.28, 0.16);
    color += vec3(0.018, 0.012, 0.006) * smoothstep(0.4, 1.0, luma);
    return color;
  }

  void main() {
    vec2 screenUv = vUv;
    vec2 uv = coverUv(screenUv, uResolution, uImageResolution);
    vec2 pointer = (uPointer - 0.5) * vec2(1.0, -1.0);

    float depth = pseudoDepth(screenUv);
    float domeMask = smoothstep(0.38, 0.78, screenUv.y);
    float lowerMask = smoothstep(0.44, 0.08, screenUv.y);
    float centerPull = smoothstep(0.95, 0.18, distance(screenUv, vec2(0.52, 0.52)));

    vec2 cameraDrift = vec2(
      sin(uTime * 0.12) * 0.014 - uIntro * 0.015,
      cos(uTime * 0.10) * 0.010 + uIntro * 0.012
    ) * depth * uMotion;
    vec2 pointerDrift = pointer * depth * 0.032 * uMotion;
    float flowA = fbm(uv * vec2(4.4, 3.0) + vec2(uTime * 0.035, -uTime * 0.018));
    float flowB = fbm(uv * vec2(8.0, 5.2) + vec2(-uTime * 0.025, uTime * 0.028));
    vec2 paintFlow = vec2(flowA - 0.5, flowB - 0.5) * domeMask * centerPull * 0.026 * uMotion;
    vec2 foregroundDrag = vec2(-0.018, 0.011) * lowerMask * uIntro * uMotion;

    vec2 displacedUv = uv + cameraDrift + pointerDrift + paintFlow + foregroundDrag;
    displacedUv = clamp(displacedUv, vec2(0.001), vec2(0.999));

    vec2 aberration = (displacedUv - 0.5) * 0.0045 * domeMask * uMotion;
    float red = texture2D(uMap, clamp(displacedUv + aberration, vec2(0.001), vec2(0.999))).r;
    float green = texture2D(uMap, displacedUv).g;
    float blue = texture2D(uMap, clamp(displacedUv - aberration, vec2(0.001), vec2(0.999))).b;
    vec3 color = vec3(red, green, blue);

    float grain = hash(screenUv * uResolution + floor(uTime * 18.0)) - 0.5;
    float vignette = smoothstep(0.96, 0.24, distance(screenUv, vec2(0.5)));
    float starLift = smoothstep(0.78, 1.0, max(max(color.r, color.g), color.b)) * centerPull;

    color = grade(color, screenUv);
    color += vec3(0.55, 0.72, 1.0) * starLift * 0.22;
    color += grain * 0.022;
    color *= mix(0.48, 1.08, vignette);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", handleChange);

    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

function PaintingPlane({ reducedMotion }: { reducedMotion: boolean }) {
  const loadedTexture = useLoader(TextureLoader, P7_IMAGE_SRC);
  const materialRef = useRef<ShaderMaterial>(null);
  const pointerTarget = useRef(new Vector2(0.5, 0.5));
  const { size, viewport } = useThree();

  const texture = useMemo(() => {
    const nextTexture = loadedTexture.clone();
    nextTexture.colorSpace = SRGBColorSpace;
    nextTexture.minFilter = LinearFilter;
    nextTexture.magFilter = LinearFilter;
    nextTexture.wrapS = ClampToEdgeWrapping;
    nextTexture.wrapT = ClampToEdgeWrapping;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [loadedTexture]);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      pointerTarget.current.set(
        event.clientX / Math.max(window.innerWidth, 1),
        event.clientY / Math.max(window.innerHeight, 1)
      );
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uImageResolution: { value: P7_IMAGE_SIZE.clone() },
          uIntro: { value: 0 },
          uMap: { value: texture },
          uMotion: { value: reducedMotion ? 0.16 : 1 },
          uPointer: { value: new Vector2(0.5, 0.5) },
          uResolution: { value: new Vector2(size.width, size.height) },
          uTime: { value: 0 }
        },
        vertexShader: paintingVertexShader,
        fragmentShader: paintingFragmentShader
      }),
    [reducedMotion, size.height, size.width, texture]
  );

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame(({ clock }, delta) => {
    const activeMaterial = materialRef.current;
    if (!activeMaterial) {
      return;
    }

    const pointerUniform = activeMaterial.uniforms.uPointer.value as Vector2;
    pointerUniform.lerp(pointerTarget.current, 1 - Math.pow(0.001, delta));
    activeMaterial.uniforms.uResolution.value.set(size.width, size.height);
    activeMaterial.uniforms.uTime.value = clock.elapsedTime;
    activeMaterial.uniforms.uIntro.value = reducedMotion ? 1 : Math.min(clock.elapsedTime / 4.2, 1);
    activeMaterial.uniforms.uMotion.value = reducedMotion ? 0.16 : 1;
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 220, 124]} />
      <primitive ref={materialRef} object={material} attach="material" />
    </mesh>
  );
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 127.1) * 43758.5453123;
  return value - Math.floor(value);
}

function ParticleField({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<Points>(null);
  const materialRef = useRef<PointsMaterial>(null);
  const { viewport } = useThree();
  const particleCount = reducedMotion ? 320 : 860;

  const geometry = useMemo(() => {
    const nextGeometry = new BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const color = new Color();

    for (let index = 0; index < particleCount; index++) {
      const xRand = seededRandom(index + 1);
      const yRand = seededRandom(index + 101);
      const zRand = seededRandom(index + 201);
      const centerBias = Math.pow(seededRandom(index + 301), 1.9);
      const x = (xRand - 0.5) * (7.8 - centerBias * 2.4);
      const y = -2.6 + yRand * 5.1 + centerBias * 0.62;
      const z = -0.2 + zRand * 0.6;

      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;

      if (seededRandom(index + 401) > 0.72) {
        color.setRGB(1.0, 0.74 + seededRandom(index + 501) * 0.2, 0.36);
      } else {
        color.setRGB(0.62 + seededRandom(index + 601) * 0.38, 0.76, 1.0);
      }

      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    nextGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    nextGeometry.setAttribute("color", new BufferAttribute(colors, 3));
    return nextGeometry;
  }, [particleCount]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (pointsRef.current) {
      pointsRef.current.rotation.z = Math.sin(elapsed * 0.055) * 0.018;
      pointsRef.current.position.x = Math.sin(elapsed * 0.09) * 0.055;
      pointsRef.current.position.y = Math.cos(elapsed * 0.075) * 0.045;
    }

    if (materialRef.current) {
      materialRef.current.opacity = reducedMotion ? 0.36 : 0.52 + Math.sin(elapsed * 0.7) * 0.08;
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      position={[0, -0.15, 0.18]}
      scale={[viewport.width / 8.2, viewport.height / 5.2, 1]}
      renderOrder={4}
    >
      <pointsMaterial
        ref={materialRef}
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        opacity={0.52}
        size={0.022}
        sizeAttenuation
        transparent
        vertexColors
      />
    </points>
  );
}

function P7Scene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <>
      <color attach="background" args={["#010103"]} />
      <PaintingPlane reducedMotion={reducedMotion} />
      <ParticleField reducedMotion={reducedMotion} />
    </>
  );
}

function P7StaticFallback() {
  return <Image className="p7-dynamic__fallback-image" src={P7_IMAGE_SRC} alt="" fill priority sizes="100vw" />;
}

export function P7DynamicDemo() {
  const preserveDrawingBuffer =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("visualTest") === "pixels";

  return (
    <main className="p7-dynamic" aria-label="P7 cinematic WebGL study">
      <P7StaticFallback />
      <div className="p7-dynamic__canvas">
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer }}
          orthographic
          camera={{ position: [0, 0, 10], zoom: 100, near: -100, far: 100 }}
        >
          <Suspense fallback={null}>
            <P7Scene />
          </Suspense>
        </Canvas>
      </div>
    </main>
  );
}
