"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CoScrollAnchorAsset, CoScrollFallbackReason } from "./types";

interface CoScrollJadeAnchorProps {
  modelSrc: string;
  materialPreset?: CoScrollAnchorAsset["materialPreset"];
  position?: [number, number, number];
  scale?: number;
  scrollVelocity?: number;
  reducedMotion?: boolean;
  paused?: boolean;
  baseSpeed?: number;
  velocityMultiplier?: number;
  maxAngularVelocity?: number;
  maxRotationPerFrame?: number;
  deterministicPose?: boolean;
  sourceMaterial?: boolean;
  renderOrder?: number;
  causticsActive?: boolean;
  causticsOpacity?: number;
  listenToScrollInput?: boolean;
  onReady?: () => void;
  onFallback?: (reason: CoScrollFallbackReason) => void;
}

interface PreparedAnchorGeometry {
  geometry: {
    inner: THREE.Object3D;
    outer: THREE.Object3D;
    normal: THREE.Object3D;
  };
  scale: number;
  fallback: boolean;
}

const SOURCE_JADE_MATERIAL = {
  innerColor: 0xd99552,
  innerEmissive: 0x8b401e,
  innerMetalness: 0.85,
  innerRoughness: 1,
  innerTransmission: 0,
  innerOpacity: 1,
  innerEmissiveIntensity: 11.4,
  innerEnvMapIntensity: 2,
  outerColor: 0xffe8c2,
  outerMetalness: 0,
  outerRoughness: 0.82,
  outerTransmission: 0.92,
  outerIor: 1.52,
  outerReflectivity: 0.3,
  outerThickness: 0.28,
  outerAttenuationColor: 0xf1aa64,
  outerAttenuationDistance: 0.62,
  outerEmissive: 0x7a3c1d,
  outerEmissiveIntensity: 0.16,
  outerClearcoat: 0,
  outerClearcoatRoughness: 1,
  outerEnvMapIntensity: 5,
  outerOpacity: 1,
  normalScale: 0.3,
  normalRepeat: 3,
  outerOffset: 0.001
};

const jadeMaterialPresets = {
  "jade-dark": {
    ...SOURCE_JADE_MATERIAL,
    innerColor: 0xbf8548,
    innerEmissive: 0x6f3218,
    innerEmissiveIntensity: 1.4,
    outerTransmission: 0.36,
    outerOpacity: 0.72
  },
  "jade-gold": {
    ...SOURCE_JADE_MATERIAL,
    innerColor: 0xd99552,
    innerEmissive: 0x8b401e,
    innerEmissiveIntensity: 2.2,
    outerTransmission: 0.58,
    outerOpacity: 0.84
  },
  "jade-blue": {
    ...SOURCE_JADE_MATERIAL,
    outerOpacity: 1
  }
} satisfies Record<CoScrollAnchorAsset["materialPreset"], typeof SOURCE_JADE_MATERIAL & { outerOpacity?: number }>;

const SOURCE_AMBER_VISUAL_TUNING = {
  innerColor: 0xf0c39a,
  innerEmissive: 0x6f2c18,
  innerMetalness: 0.04,
  innerRoughness: 0.78,
  innerOpacity: 0.72,
  innerEmissiveIntensity: 0.34,
  innerEnvMapIntensity: 0.64,
  outerColor: 0xffe0bd,
  outerMetalness: 0,
  outerRoughness: 0.5,
  outerTransmission: 0.94,
  outerThickness: 0.96,
  outerAttenuationColor: 0xd3844f,
  outerAttenuationDistance: 0.16,
  outerOpacity: 0.3,
  outerEmissive: 0xd8793f,
  outerEmissiveIntensity: 0.03,
  outerEnvMapIntensity: 3.2,
  normalScale: 0.08,
  volumeColor: 0xc47a4d,
  volumeThinColor: 0xffddb0,
  volumeOpacity: 0.12
};

const preparedAnchorGeometryCache = new Map<string, Promise<PreparedAnchorGeometry>>();
const environmentTextureCache = new WeakMap<THREE.WebGLRenderer, Promise<THREE.Texture | null>>();
let normalTexturePromise: Promise<THREE.Texture | null> | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createFallbackAnchorGeometry() {
  const group = new THREE.Group();
  const geometry = new THREE.IcosahedronGeometry(0.82, 3);
  const mesh = new THREE.Mesh(geometry);
  mesh.name = "coscroll-fallback-anchor";
  group.add(mesh);

  return group;
}

function applyMaterial(root: THREE.Object3D, material: THREE.Material, renderOrder: number) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material;
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = false;
      child.renderOrder = renderOrder;
    }
  });
}

function createSmoothedGeometry(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BufferGeometry) {
      const geometry = mergeVertices(child.geometry.clone(), 1e-4);
      geometry.computeVertexNormals();
      child.geometry = geometry;
    }
  });

  return root;
}

function createOffsetGeometry(root: THREE.Object3D, outerOffset = SOURCE_JADE_MATERIAL.outerOffset) {
  const clone = root.clone(true);
  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.BufferGeometry)) {
      return;
    }

    const geometry = mergeVertices(child.geometry.clone(), 1e-4);
    geometry.computeVertexNormals();
    const positionAttribute = geometry.getAttribute("position");
    const normalAttribute = geometry.getAttribute("normal");

    for (let index = 0; index < positionAttribute.count; index += 1) {
      positionAttribute.setXYZ(
        index,
        positionAttribute.getX(index) + normalAttribute.getX(index) * outerOffset,
        positionAttribute.getY(index) + normalAttribute.getY(index) * outerOffset,
        positionAttribute.getZ(index) + normalAttribute.getZ(index) * outerOffset
      );
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    child.geometry = geometry;
  });

  return clone;
}

function normalizeObject(scene: THREE.Object3D, fallback = false): PreparedAnchorGeometry {
  const inner = createSmoothedGeometry(scene.clone(true));
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  inner.position.sub(center);

  const outer = createOffsetGeometry(inner, SOURCE_JADE_MATERIAL.outerOffset);
  const normal = inner.clone(true);
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

  return {
    geometry: { inner, outer, normal },
    scale: 2.15 / maxDimension,
    fallback
  };
}

function loadEnvironmentTexture(gl: THREE.WebGLRenderer) {
  const cached = environmentTextureCache.get(gl);
  if (cached) {
    return cached;
  }

  const promise = new RGBELoader()
    .loadAsync("/assets/coscroll/textures/qwantani_moon_noon_puresky_1k.hdr")
    .then((texture) => {
      const pmremGenerator = new THREE.PMREMGenerator(gl);
      pmremGenerator.compileEquirectangularShader();
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const envTexture = pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      pmremGenerator.dispose();
      return envTexture;
    })
    .catch(() => null);

  environmentTextureCache.set(gl, promise);
  return promise;
}

function loadNormalTexture() {
  if (!normalTexturePromise) {
    normalTexturePromise = new THREE.TextureLoader()
      .loadAsync("/assets/coscroll/textures/normal.jpg")
      .then((texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
      })
      .catch(() => null);
  }

  return normalTexturePromise;
}

function fetchAnchorGeometry(modelSrc: string, sourceMode: boolean) {
  void sourceMode;
  if (modelSrc.endsWith(".obj")) {
    return new OBJLoader().loadAsync(modelSrc).then((object) => createSmoothedGeometry(object));
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  return loader.loadAsync(modelSrc).then((gltf) => createSmoothedGeometry(gltf.scene));
}

async function loadAnchorGeometry(modelSrc: string, sourceMode: boolean) {
  try {
    return await fetchAnchorGeometry(modelSrc, sourceMode);
  } catch {
    return createFallbackAnchorGeometry();
  }
}

async function prepareAnchorGeometry(modelSrc: string, sourceMode: boolean): Promise<PreparedAnchorGeometry> {
  const object = await loadAnchorGeometry(modelSrc, sourceMode);
  const fallback = object.children.some((child) => child.name === "coscroll-fallback-anchor");
  return normalizeObject(object, fallback);
}

function loadPreparedAnchorGeometry(modelSrc: string, sourceMode: boolean) {
  const key = `${modelSrc}|${sourceMode ? "source" : "default"}`;
  const cached = preparedAnchorGeometryCache.get(key);
  if (cached) {
    return cached;
  }

  const prepared = prepareAnchorGeometry(modelSrc, sourceMode);
  preparedAnchorGeometryCache.set(key, prepared);

  return prepared;
}

function clonePreparedAnchorGeometry(prepared: PreparedAnchorGeometry) {
  return {
    geometry: {
      inner: prepared.geometry.inner.clone(true),
      outer: prepared.geometry.outer.clone(true),
      normal: prepared.geometry.normal.clone(true)
    },
    scale: prepared.scale,
    fallback: prepared.fallback
  };
}

export function preloadCoScrollAnchorGeometry(modelSrc: string, sourceMode = false) {
  loadPreparedAnchorGeometry(modelSrc, sourceMode).catch(() => undefined);
}

const causticComputeFragmentShader = `
varying vec2 vUv;

uniform sampler2D uNormalMap;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float softNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv * 2.0 - 1.0;
  vec3 normalTexture = texture2D(uNormalMap, uv).rgb;
  float casterMask = smoothstep(0.08, 0.28, length(normalTexture));
  vec3 normal = normalTexture * 2.0 - 1.0;
  vec3 lightDir = normalize(vec3(0.36 + sin(uTime * 0.31) * 0.12, 0.62, 0.7));
  vec3 bent = refract(lightDir, normal, 1.0 / 1.25);
  float filament = sin((centered.x + bent.x * 0.42) * 18.0 + (centered.y + bent.y * 0.32) * 7.0 + uTime * 0.72);
  float strand = pow(1.0 - abs(filament), 7.0);
  float grain = softNoise(centered * 3.2 + bent.xy * 1.6 + uTime * 0.08);
  float envelope = 1.0 - smoothstep(0.18, 1.16, length(centered * vec2(0.78, 0.92)));
  float alpha = smoothstep(0.2, 0.78, strand + grain * 0.14) * envelope * casterMask * uOpacity;
  gl_FragColor = vec4(uColor * (0.8 + strand * 0.34), alpha);
}
`;

const jadeBodyVertexShader = `
varying vec3 vNormal;
varying vec3 vObjectPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
  vObjectPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const jadeBodyFragmentShader = `
varying vec3 vNormal;
varying vec3 vObjectPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

uniform vec3 uBaseColor;
uniform vec3 uCoreColor;
uniform vec3 uRimColor;
uniform vec3 uSpecColor;
uniform float uOpacity;
uniform float uTime;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.17, 0.41, 0.73));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
      mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
      mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(p);
    p = p * 1.91 + vec3(0.23, -0.17, 0.11);
    amplitude *= 0.52;
  }

  return value;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(-vViewPosition);
  vec3 lightDir = normalize(vec3(-0.46, 0.72, 0.52));
  vec3 halfDir = normalize(lightDir + viewDir);
  float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
  float ndl = clamp(dot(normal, lightDir), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 2.15);
  float thickness = pow(ndv, 1.45);
  float pore = fbm(vObjectPosition * 1.55 + vec3(uTime * 0.012, -uTime * 0.01, uTime * 0.008));
  float vein = smoothstep(0.58, 0.9, fbm(vWorldPosition * 2.6 + vec3(-uTime * 0.006, uTime * 0.008, 0.19)));
  float thinEdge = rim * (0.82 + pore * 0.12);
  float swallowed = smoothstep(0.18, 0.92, thickness) * (0.68 + pore * 0.08);
  float lambert = 0.86 + ndl * 0.16;
  float wetSpec = pow(clamp(dot(normal, halfDir), 0.0, 1.0), 48.0) * (0.34 + rim * 0.48);
  vec3 core = mix(uBaseColor, uCoreColor, clamp(swallowed * 0.1 + vein * 0.035, 0.0, 0.18));
  vec3 color = core * lambert;
  color = mix(color, uRimColor, clamp(thinEdge * 0.5 + vein * 0.025, 0.0, 0.56));
  color += uSpecColor * wetSpec * 0.64;
  color *= 1.04 + pore * 0.035;

  gl_FragColor = vec4(color, 1.0);
}
`;

const volumeGlowVertexShader = `
varying vec3 vNormal;
varying vec3 vObjectPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
  vObjectPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const volumeGlowFragmentShader = `
varying vec3 vNormal;
varying vec3 vObjectPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

uniform vec3 uBodyColor;
uniform vec3 uThinColor;
uniform float uOpacity;
uniform float uTime;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.37, 0.73));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
      mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
      mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(p);
    p = p * 1.82 + vec3(0.17, -0.11, 0.23);
    amplitude *= 0.52;
  }

  return value;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(-vViewPosition);
  float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
  float rim = pow(1.0 - facing, 2.65);
  float bodyThickness = pow(facing, 2.05);
  float pore = fbm(vObjectPosition * 2.65 + vec3(uTime * 0.028, -uTime * 0.021, uTime * 0.015));
  float grain = fbm(vObjectPosition * 7.4 + vec3(-uTime * 0.018, uTime * 0.014, 0.31));
  float vein = smoothstep(0.5, 0.88, fbm(vWorldPosition * 3.6 + vec3(-uTime * 0.014, uTime * 0.019, 0.13)));
  float lowerWarmth = smoothstep(0.62, -0.7, vObjectPosition.y);
  float swallowedCore = smoothstep(0.28, 0.95, bodyThickness) * (0.55 + pore * 0.3);
  float thinBleed = rim * (0.4 + pore * 0.22);
  float occludedCenter = 1.0 - smoothstep(0.72, 0.98, facing);
  float amberReservoir = clamp(swallowedCore * 0.34 + thinBleed * 0.44 + vein * 0.1 + lowerWarmth * 0.14, 0.0, 1.0);
  float alpha = clamp(amberReservoir * uOpacity * occludedCenter, 0.0, 0.26);
  vec3 color = mix(uBodyColor, uThinColor, clamp(thinBleed * 0.82 + vein * 0.26, 0.0, 1.0));
  color *= 0.68 + swallowedCore * 0.24 + lowerWarmth * 0.18 + grain * 0.08;

  gl_FragColor = vec4(color, alpha);
}
`;

function CoScrollModelCaustics({
  active,
  anchorGroup,
  geometry,
  geometryScale,
  opacity,
  renderOrder
}: {
  active: boolean;
  anchorGroup: RefObject<THREE.Group | null>;
  geometry: PreparedAnchorGeometry["geometry"];
  geometryScale: number;
  opacity: number;
  renderOrder: number;
}) {
  const { camera, gl, viewport } = useThree();
  const normalRenderTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(384, 384, {
        depthBuffer: false,
        stencilBuffer: false
      }),
    []
  );
  const normalScene = useMemo(() => new THREE.Scene(), []);
  const normalMaterial = useMemo(() => new THREE.MeshNormalMaterial({ depthTest: true, depthWrite: true }), []);
  const normalMesh = useMemo(() => geometry.normal.clone(true), [geometry]);
  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uNormalMap: { value: normalRenderTarget.texture },
          uColor: { value: new THREE.Color("#ffdca3") },
          uOpacity: { value: opacity },
          uTime: { value: 0 }
        },
        vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
        fragmentShader: causticComputeFragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    [normalRenderTarget, opacity]
  );

  useLayoutEffect(() => {
    applyMaterial(normalMesh, normalMaterial, 1);
    normalScene.add(normalMesh);

    return () => {
      normalScene.remove(normalMesh);
    };
  }, [normalMaterial, normalMesh, normalScene]);

  useEffect(() => {
    shaderMaterial.uniforms.uOpacity.value = opacity;
  }, [opacity, shaderMaterial]);

  useEffect(() => {
    return () => {
      normalRenderTarget.dispose();
      normalMaterial.dispose();
      shaderMaterial.dispose();
    };
  }, [normalMaterial, normalRenderTarget, shaderMaterial]);

  useFrame((state, delta) => {
    if (!active || opacity <= 0 || !anchorGroup.current) {
      return;
    }

    normalMesh.position.copy(anchorGroup.current.position);
    normalMesh.rotation.copy(anchorGroup.current.rotation);
    normalMesh.scale.copy(anchorGroup.current.scale).multiplyScalar(geometryScale);
    normalMesh.updateMatrixWorld(true);
    shaderMaterial.uniforms.uTime.value += delta;

    const previousTarget = gl.getRenderTarget();
    const previousAutoClear = gl.autoClear;
    gl.autoClear = true;
    gl.setRenderTarget(normalRenderTarget);
    gl.clear();
    gl.render(normalScene, camera);
    gl.setRenderTarget(previousTarget);
    gl.autoClear = previousAutoClear;
  });

  return (
    <mesh position={[0, 0, -4.92]} scale={[viewport.width * 1.22, viewport.height * 1.22, 1]} renderOrder={renderOrder} frustumCulled={false}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

export function CoScrollJadeAnchor({
  modelSrc,
  materialPreset = "jade-dark",
  position = [0, 0, 0],
  scale = 1,
  scrollVelocity = 0,
  reducedMotion = false,
  paused = false,
  baseSpeed = 0.18,
  velocityMultiplier = 1.2,
  maxAngularVelocity = 2.2,
  maxRotationPerFrame = 0.09,
  deterministicPose = false,
  sourceMaterial = false,
  renderOrder = 2000,
  causticsActive = false,
  causticsOpacity = 0,
  listenToScrollInput = true,
  onReady,
  onFallback
}: CoScrollJadeAnchorProps) {
  const anchorGroup = useRef<THREE.Group>(null);
  const rotationRef = useRef(deterministicPose ? -0.62 : 0);
  const targetSpeedRef = useRef(baseSpeed);
  const currentSpeedRef = useRef(baseSpeed);
  const smoothedManualVelocityRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const { gl, scene } = useThree();
  const [prepared, setPrepared] = useState<PreparedAnchorGeometry | null>(null);
  const [environmentMap, setEnvironmentMap] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const preset = sourceMaterial ? SOURCE_JADE_MATERIAL : jadeMaterialPresets[materialPreset];

  useEffect(() => {
    let cancelled = false;

    loadPreparedAnchorGeometry(modelSrc, sourceMaterial).then((nextPrepared) => {
      if (cancelled) {
        return;
      }

      setPrepared(nextPrepared);
      if (nextPrepared.fallback) {
        onFallback?.("asset-failed");
      }
      onReady?.();
    });

    return () => {
      cancelled = true;
    };
  }, [modelSrc, onFallback, onReady, sourceMaterial]);

  useEffect(() => {
    if (!sourceMaterial) {
      return;
    }

    let cancelled = false;
    const previousEnvironment = scene.environment;
    loadEnvironmentTexture(gl).then((texture) => {
      if (!cancelled) {
        setEnvironmentMap(texture);
        scene.environment = texture;
      }
    });
    loadNormalTexture().then((texture) => {
      if (!cancelled) {
        setNormalMap(texture);
      }
    });

    return () => {
      cancelled = true;
      scene.environment = previousEnvironment;
    };
  }, [gl, scene, sourceMaterial]);

  useEffect(() => {
    const manualInputDisabled = reducedMotion || paused || !listenToScrollInput;
    if (manualInputDisabled || typeof window === "undefined") {
      return;
    }

    const canvas = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : 1;
      const nextVelocity = clamp(event.deltaY * unit * 0.001, -0.7, 0.7);
      smoothedManualVelocityRef.current += (nextVelocity - smoothedManualVelocityRef.current) * 0.18;
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        lastTouchYRef.current = event.touches[0].clientY;
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 0) {
        return;
      }

      const y = event.touches[0].clientY;
      const deltaY = lastTouchYRef.current - y;
      lastTouchYRef.current = y;
      const nextVelocity = clamp(deltaY * 0.018, -0.7, 0.7);
      smoothedManualVelocityRef.current += (nextVelocity - smoothedManualVelocityRef.current) * 0.22;
      event.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [gl, listenToScrollInput, paused, reducedMotion]);

  const clonedGeometry = useMemo(() => (prepared ? clonePreparedAnchorGeometry(prepared) : null), [prepared]);

  const innerMaterial = useMemo(() => {
    if (sourceMaterial) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uBaseColor: { value: new THREE.Color(SOURCE_AMBER_VISUAL_TUNING.innerColor) },
          uCoreColor: { value: new THREE.Color("#bd774b") },
          uOpacity: { value: SOURCE_AMBER_VISUAL_TUNING.innerOpacity },
          uRimColor: { value: new THREE.Color("#fff1d7") },
          uSpecColor: { value: new THREE.Color("#fff8e5") },
          uTime: { value: 0 }
        },
        vertexShader: jadeBodyVertexShader,
        fragmentShader: jadeBodyFragmentShader,
        transparent: false,
        depthTest: true,
        depthWrite: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: true
      });
    }

    const material = new THREE.MeshPhysicalMaterial({
      color: preset.innerColor,
      metalness: preset.innerMetalness,
      roughness: preset.innerRoughness,
      transmission: preset.innerTransmission,
      emissive: new THREE.Color(preset.innerEmissive),
      emissiveIntensity: 0.42,
      envMapIntensity: preset.innerEnvMapIntensity,
      transparent: preset.innerOpacity < 1,
      opacity: preset.innerOpacity,
      depthWrite: true,
      clearcoat: 0,
      clearcoatRoughness: 1,
      toneMapped: true
    });
    material.side = THREE.DoubleSide;

    if (environmentMap) {
      material.envMap = environmentMap;
    }
    if (normalMap) {
      material.normalMap = normalMap;
      material.normalScale = new THREE.Vector2(preset.normalScale, preset.normalScale);
      normalMap.repeat.set(preset.normalRepeat, preset.normalRepeat);
    }

    return material;
  }, [environmentMap, normalMap, preset, sourceMaterial]);

  const outerMaterial = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerColor : preset.outerColor,
      metalness: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerMetalness : preset.outerMetalness,
      roughness: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerRoughness : preset.outerRoughness,
      transmission: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerTransmission : preset.outerTransmission,
      ior: preset.outerIor,
      reflectivity: preset.outerReflectivity,
      thickness: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerThickness : preset.outerThickness,
      attenuationColor: new THREE.Color(sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerAttenuationColor : preset.outerAttenuationColor),
      attenuationDistance: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerAttenuationDistance : preset.outerAttenuationDistance,
      emissive: new THREE.Color(sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerEmissive : preset.outerEmissive),
      emissiveIntensity: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerEmissiveIntensity : preset.outerEmissiveIntensity,
      clearcoat: preset.outerClearcoat,
      clearcoatRoughness: preset.outerClearcoatRoughness,
      envMapIntensity: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerEnvMapIntensity : preset.outerEnvMapIntensity,
      transparent: sourceMaterial,
      opacity: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.outerOpacity : preset.outerOpacity ?? 1,
      depthWrite: !sourceMaterial,
      toneMapped: true
    });
    material.side = THREE.DoubleSide;

    if (environmentMap) {
      material.envMap = environmentMap;
    }
    if (normalMap) {
      material.normalMap = normalMap;
      const normalScale = sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.normalScale : preset.normalScale;
      material.normalScale = new THREE.Vector2(normalScale, normalScale);
      normalMap.repeat.set(preset.normalRepeat, preset.normalRepeat);
    }

    return material;
  }, [environmentMap, normalMap, preset, sourceMaterial]);

  const fallbackMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffc885,
        emissive: 0x8b401e,
        emissiveIntensity: 0.4,
        roughness: 0.74,
        metalness: 0.18,
        depthWrite: true
      }),
    []
  );
  const volumeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uBodyColor: { value: new THREE.Color(SOURCE_AMBER_VISUAL_TUNING.volumeColor) },
          uOpacity: { value: sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.volumeOpacity : 0 },
          uThinColor: { value: new THREE.Color(SOURCE_AMBER_VISUAL_TUNING.volumeThinColor) },
          uTime: { value: 0 }
        },
        vertexShader: volumeGlowVertexShader,
        fragmentShader: volumeGlowFragmentShader,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: true
      }),
    [sourceMaterial]
  );

  useLayoutEffect(() => {
    if (!clonedGeometry) {
      return;
    }

    applyMaterial(clonedGeometry.geometry.inner, clonedGeometry.fallback ? fallbackMaterial : innerMaterial, renderOrder);
    applyMaterial(clonedGeometry.geometry.outer, clonedGeometry.fallback ? fallbackMaterial : outerMaterial, renderOrder + 1);
    if (sourceMaterial && !clonedGeometry.fallback) {
      applyMaterial(clonedGeometry.geometry.normal, volumeMaterial, renderOrder + 2);
    }
  }, [clonedGeometry, fallbackMaterial, innerMaterial, outerMaterial, renderOrder, sourceMaterial, volumeMaterial]);

  useEffect(() => {
    volumeMaterial.uniforms.uOpacity.value = sourceMaterial ? SOURCE_AMBER_VISUAL_TUNING.volumeOpacity : 0;
  }, [sourceMaterial, volumeMaterial]);

  useEffect(() => {
    return () => {
      innerMaterial.dispose();
      outerMaterial.dispose();
      fallbackMaterial.dispose();
      volumeMaterial.dispose();
    };
  }, [fallbackMaterial, innerMaterial, outerMaterial, volumeMaterial]);

  useFrame((_state, delta) => {
    if (sourceMaterial) {
      volumeMaterial.uniforms.uTime.value += delta * (paused || reducedMotion ? 0.18 : 1);
      if (innerMaterial instanceof THREE.ShaderMaterial) {
        innerMaterial.uniforms.uTime.value += delta * (paused || reducedMotion ? 0.12 : 1);
      }
    }

    if (!anchorGroup.current) {
      return;
    }

    if (deterministicPose && (paused || reducedMotion)) {
      anchorGroup.current.rotation.y = rotationRef.current;
      anchorGroup.current.rotation.x = -0.08;
      anchorGroup.current.rotation.z = 0.04;
      return;
    }

    const propVelocity = reducedMotion || paused ? 0 : scrollVelocity * velocityMultiplier;
    const manualInputDisabled = reducedMotion || paused || !listenToScrollInput;
    const manualVelocity = manualInputDisabled ? 0 : smoothedManualVelocityRef.current * velocityMultiplier;
    targetSpeedRef.current = clamp(reducedMotion || paused ? 0 : baseSpeed + propVelocity + manualVelocity, -maxAngularVelocity, maxAngularVelocity);
    currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * Math.min(1, delta * 8);

    const rotationDelta = clamp(currentSpeedRef.current * delta, -maxRotationPerFrame, maxRotationPerFrame);
    rotationRef.current += rotationDelta;
    smoothedManualVelocityRef.current *= 0.94;

    anchorGroup.current.rotation.y = rotationRef.current;
    anchorGroup.current.rotation.x = Math.sin(rotationRef.current * 0.45) * 0.045;
    anchorGroup.current.rotation.z = Math.sin(rotationRef.current * 0.25) * 0.018;
  });

  if (!clonedGeometry) {
    return null;
  }

  const modelCausticsOpacity = sourceMaterial ? clamp(causticsOpacity * 0.34, 0, 0.055) : clamp(causticsOpacity, 0, 0.18);

  return (
    <>
      <group ref={anchorGroup} position={position} scale={scale} renderOrder={renderOrder}>
        <primitive object={clonedGeometry.geometry.inner} scale={clonedGeometry.scale} renderOrder={renderOrder} />
        <primitive object={clonedGeometry.geometry.outer} scale={clonedGeometry.scale} renderOrder={renderOrder + 1} />
        {sourceMaterial && !clonedGeometry.fallback ? (
          <primitive object={clonedGeometry.geometry.normal} scale={clonedGeometry.scale * 1.004} renderOrder={renderOrder + 2} />
        ) : null}
      </group>
      {causticsActive && modelCausticsOpacity > 0 ? (
        <CoScrollModelCaustics
          active={causticsActive}
          anchorGroup={anchorGroup}
          geometry={clonedGeometry.geometry}
          geometryScale={clonedGeometry.scale}
          opacity={modelCausticsOpacity}
          renderOrder={renderOrder - 20}
        />
      ) : null}
    </>
  );
}
