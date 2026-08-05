"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CoScrollAnchorResidue } from "./CoScrollAnchorResidue";
import type {
  CoScrollAnchorAsset,
  CoScrollAnchorResidueConfig,
  CoScrollFallbackReason,
  CoScrollRotationSignalRef
} from "./types";

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
  active?: boolean;
  viewport?: "desktop" | "mobile";
  residue?: CoScrollAnchorResidueConfig;
  rotationSignalRef?: CoScrollRotationSignalRef;
  renderOrder?: number;
  listenToScrollInput?: boolean;
  onReady?: () => void;
  onFallback?: (reason: CoScrollFallbackReason) => void;
}

interface PreparedAnchorGeometry {
  geometry: {
    inner: THREE.Object3D;
    outer: THREE.Object3D;
  };
  scale: number;
  fallback: boolean;
}

const SOURCE_JADE_MATERIAL = {
  innerColor: 0x2d6d8b,
  innerEmissive: 0x0f2b38,
  innerMetalness: 1,
  innerRoughness: 1,
  innerTransmission: 0,
  innerOpacity: 1,
  innerEmissiveIntensity: 12,
  innerEnvMapIntensity: 2,
  outerColor: 0xffffff,
  outerMetalness: 0,
  outerRoughness: 0.82,
  outerTransmission: 1,
  outerIor: 1.52,
  outerReflectivity: 0.3,
  outerThickness: 0.24,
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

const preparedAnchorGeometryCache = new Map<string, Promise<PreparedAnchorGeometry>>();
const environmentTextureCache = new WeakMap<THREE.WebGLRenderer, Promise<THREE.Texture | null>>();
let rawEnvironmentTexturePromise: Promise<THREE.DataTexture | null> | null = null;
let normalTexturePromise: Promise<THREE.Texture | null> | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Local-review timing only. The blue open ring is a distinct, readable beat before it warms
// into the ArtBreeze target ring; production wiring remains intentionally absent.
const REVIEW_PARTICLEIZATION_HOLD_SECONDS = 0.45;
const REVIEW_PARTICLEIZATION_STAGES = [
  // Opaque rotating glyph → blue particles.
  { duration: 1.8, from: 0, to: 0.56 },
  // Blue particles → complete blue open ring.
  { duration: 0.8, from: 0.56, to: 0.848 },
  // Complete blue ring remains visibly blue before any warmth is allowed.
  { duration: 0.9, from: 0.848, to: 0.888 },
  // A short colour crossover: this is the last web-owned frame before the video cut.
  { duration: 0.32, from: 0.888, to: 0.954 },
  // Exact n=355 proxy-start phase alignment; n=359 remains the geometry measurement fixture.
  // The review sample cuts to ArtBreeze immediately after this.
  { duration: 0.08, from: 0.954, to: 1 }
] as const;

function resolveReviewParticleization(elapsedSeconds: number) {
  let remaining = Math.max(0, elapsedSeconds - REVIEW_PARTICLEIZATION_HOLD_SECONDS);
  for (const stage of REVIEW_PARTICLEIZATION_STAGES) {
    if (remaining <= stage.duration) {
      return stage.from + (stage.to - stage.from) * (remaining / stage.duration);
    }
    remaining -= stage.duration;
  }
  return 1;
}

interface ParticleCutoutUniforms {
  uParticleization: { value: number };
}

const PARTICLE_CUTOUT_FRAGMENT_PARS = `
float particleCutoutHash(vec3 value) {
  value = fract(value * 0.1031);
  value += dot(value, value.yzx + 33.33);
  return fract((value.x + value.y) * value.z);
}
`;

const PARTICLE_CUTOUT_FRAGMENT = `
  float particleCutoutEdge = pow(
    1.0 - abs(dot(normalize(normal), normalize(vViewPosition))),
    1.25
  );
  float particleCutoutNoise = particleCutoutHash(floor(vParticleObjectPosition * 10.0));
  float particleCutoutThreshold = mix(0.88, 0.14, particleCutoutEdge);
  particleCutoutThreshold += (particleCutoutNoise - 0.5) * 0.25;
  particleCutoutThreshold = clamp(particleCutoutThreshold, 0.035, 0.975);
  if (uParticleization > particleCutoutThreshold || uParticleization > 0.995) discard;
`;

function applyOpaqueParticleCutout(
  material: THREE.MeshPhysicalMaterial,
  uniforms: ParticleCutoutUniforms
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uParticleization = uniforms.uParticleization;
    shader.vertexShader = shader.vertexShader
      .replace(
        "varying vec3 vViewPosition;",
        "varying vec3 vViewPosition;\nvarying vec3 vParticleObjectPosition;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvParticleObjectPosition = transformed;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "varying vec3 vViewPosition;",
        `varying vec3 vViewPosition;
uniform float uParticleization;
varying vec3 vParticleObjectPosition;
${PARTICLE_CUTOUT_FRAGMENT_PARS}`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
${PARTICLE_CUTOUT_FRAGMENT}`
      );
  };
  material.customProgramCacheKey = () => "miralith-coscroll-opaque-particle-cutout-v1";
  material.needsUpdate = true;
}

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

function findFirstBufferGeometry(root: THREE.Object3D): THREE.BufferGeometry | null {
  let sourceGeometry: THREE.BufferGeometry | null = null;
  root.traverse((child) => {
    if (!sourceGeometry && child instanceof THREE.Mesh && child.geometry instanceof THREE.BufferGeometry) {
      sourceGeometry = child.geometry;
    }
  });
  return sourceGeometry as THREE.BufferGeometry | null;
}

function createSourceOffsetGeometry(sourceGeometry: THREE.BufferGeometry) {
  let workingGeometry = mergeVertices(sourceGeometry.clone());
  workingGeometry = workingGeometry.toNonIndexed();
  workingGeometry = new TessellateModifier(0.15).modify(workingGeometry);
  workingGeometry.computeVertexNormals();
  workingGeometry = toCreasedNormals(workingGeometry, THREE.MathUtils.degToRad(30));
  workingGeometry = mergeVertices(workingGeometry);
  workingGeometry.computeVertexNormals();

  const positionAttribute = workingGeometry.getAttribute("position");
  const normalAttribute = workingGeometry.getAttribute("normal");
  const newPositions = new Float32Array(positionAttribute.count * 3);

  for (let index = 0; index < positionAttribute.count; index += 1) {
    newPositions[index * 3] = positionAttribute.getX(index) + normalAttribute.getX(index) * SOURCE_JADE_MATERIAL.outerOffset;
    newPositions[index * 3 + 1] = positionAttribute.getY(index) + normalAttribute.getY(index) * SOURCE_JADE_MATERIAL.outerOffset;
    newPositions[index * 3 + 2] = positionAttribute.getZ(index) + normalAttribute.getZ(index) * SOURCE_JADE_MATERIAL.outerOffset;
  }

  workingGeometry.setAttribute("position", new THREE.BufferAttribute(newPositions, 3));
  workingGeometry.computeVertexNormals();
  return workingGeometry;
}

function createSourcePreparedAnchorGeometry(root: THREE.Object3D): PreparedAnchorGeometry {
  const sourceGeometry = findFirstBufferGeometry(root);
  if (!sourceGeometry) {
    return normalizeObject(createFallbackAnchorGeometry(), true);
  }

  const innerGeometry = mergeVertices(sourceGeometry.clone());
  innerGeometry.computeVertexNormals();
  const outerGeometry = createSourceOffsetGeometry(innerGeometry);
  const inner = new THREE.Group();
  const outer = new THREE.Group();
  inner.add(new THREE.Mesh(innerGeometry));
  outer.add(new THREE.Mesh(outerGeometry));

  return {
    geometry: { inner, outer },
    scale: 1,
    fallback: false
  };
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
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);

  return {
    geometry: { inner, outer },
    scale: 2.15 / maxDimension,
    fallback
  };
}

function loadRawEnvironmentTexture() {
  if (!rawEnvironmentTexturePromise) {
    rawEnvironmentTexturePromise = new HDRLoader()
      .loadAsync("/assets/coscroll/textures/qwantani_moon_noon_puresky_1k.hdr")
      .then((texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        return texture;
      })
      .catch(() => null);
  }
  return rawEnvironmentTexturePromise;
}

function loadEnvironmentTexture(gl: THREE.WebGLRenderer) {
  const cached = environmentTextureCache.get(gl);
  if (cached) {
    return cached;
  }

  const promise = loadRawEnvironmentTexture()
    .then((texture) => {
      if (!texture) {
        return null;
      }
      const pmremGenerator = new THREE.PMREMGenerator(gl);
      pmremGenerator.compileEquirectangularShader();
      const envTexture = pmremGenerator.fromEquirectangular(texture).texture;
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
    return new OBJLoader().loadAsync(modelSrc);
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  return loader.loadAsync(modelSrc).then((gltf) => gltf.scene);
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
  if (sourceMode && !fallback) {
    return createSourcePreparedAnchorGeometry(object);
  }
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
      outer: prepared.geometry.outer.clone(true)
    },
    scale: prepared.scale,
    fallback: prepared.fallback
  };
}

export function preloadCoScrollAnchorGeometry(modelSrc: string, sourceMode = false) {
  return loadPreparedAnchorGeometry(modelSrc, sourceMode).then(() => undefined).catch(() => undefined);
}

export function preloadCoScrollMaterialTextures() {
  return Promise.all([loadRawEnvironmentTexture(), loadNormalTexture()]).then(([environment, normal]) => ({
    environment: environment !== null,
    normal: normal !== null
  }));
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
  active = true,
  viewport = "desktop",
  residue,
  rotationSignalRef,
  renderOrder = 2000,
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
  const preparedKey = `${modelSrc}|${sourceMaterial ? "source" : "default"}`;
  const [preparedState, setPreparedState] = useState<{
    key: string;
    value: PreparedAnchorGeometry;
  } | null>(null);
  const prepared = preparedState?.key === preparedKey ? preparedState.value : null;
  const [environmentMap, setEnvironmentMap] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const [materialAssetsState, setMaterialAssetsState] = useState<"pending" | "ready" | "failed">(
    sourceMaterial ? "pending" : "ready"
  );
  const readyReportedRef = useRef(false);
  const preset = sourceMaterial ? SOURCE_JADE_MATERIAL : jadeMaterialPresets[materialPreset];
  const configuredParticleization = clamp(residue?.particleization ?? 0, 0, 1);
  const reviewAutoParticleization = Boolean(residue?.reviewAutoParticleization);
  const particleizationRef = useRef(configuredParticleization);
  const particleizationElapsedRef = useRef(0);
  const particleCutoutUniforms = useMemo<ParticleCutoutUniforms>(
    () => ({ uParticleization: { value: configuredParticleization } }),
    []
  );
  const particleCutoutEnabled = sourceMaterial && residue !== undefined;

  useEffect(() => {
    particleizationRef.current = reviewAutoParticleization ? 0 : configuredParticleization;
    particleizationElapsedRef.current = 0;
    particleCutoutUniforms.uParticleization.value = particleizationRef.current;
  }, [configuredParticleization, modelSrc, particleCutoutUniforms, reviewAutoParticleization]);

  useEffect(() => {
    let cancelled = false;
    readyReportedRef.current = false;

    loadPreparedAnchorGeometry(modelSrc, sourceMaterial).then((nextPrepared) => {
      if (cancelled) {
        return;
      }

      setPreparedState({ key: preparedKey, value: nextPrepared });
      if (nextPrepared.fallback) {
        onFallback?.("asset-failed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [modelSrc, onFallback, preparedKey, sourceMaterial]);

  useEffect(() => {
    if (!sourceMaterial) {
      return;
    }

    let cancelled = false;
    const previousEnvironment = scene.environment;
    const previousEnvironmentIntensity = scene.environmentIntensity;
    Promise.all([loadEnvironmentTexture(gl), loadNormalTexture()]).then(([environment, normal]) => {
      if (cancelled) {
        return;
      }
      setEnvironmentMap(environment);
      setNormalMap(normal);
      if (environment) {
        scene.environment = environment;
        scene.environmentIntensity = 1;
      }
      if (environment && normal) {
        setMaterialAssetsState("ready");
      } else {
        setMaterialAssetsState("failed");
        onFallback?.("asset-failed");
      }
    });

    return () => {
      cancelled = true;
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousEnvironmentIntensity;
    };
  }, [gl, onFallback, scene, sourceMaterial]);

  useEffect(() => {
    if (!prepared || materialAssetsState === "pending" || readyReportedRef.current) {
      return;
    }
    if (prepared.fallback || materialAssetsState === "failed") {
      return;
    }
    readyReportedRef.current = true;
    onReady?.();
  }, [materialAssetsState, onReady, prepared]);

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
    const material = new THREE.MeshPhysicalMaterial({
      color: preset.innerColor,
      metalness: preset.innerMetalness,
      roughness: preset.innerRoughness,
      transmission: preset.innerTransmission,
      emissive: new THREE.Color(preset.innerEmissive),
      emissiveIntensity: preset.innerEmissiveIntensity,
      envMapIntensity: preset.innerEnvMapIntensity,
      transparent: sourceMaterial ? false : preset.innerOpacity < 1,
      opacity: sourceMaterial ? 1 : preset.innerOpacity,
      depthWrite: true,
      clearcoat: 0,
      clearcoatRoughness: 1,
      toneMapped: true
    });
    if (environmentMap) {
      material.envMap = environmentMap;
    }
    if (normalMap) {
      material.normalMap = normalMap;
      material.normalScale = new THREE.Vector2(preset.normalScale, preset.normalScale);
      normalMap.repeat.set(preset.normalRepeat, preset.normalRepeat);
    }
    if (particleCutoutEnabled) {
      applyOpaqueParticleCutout(material, particleCutoutUniforms);
    }

    return material;
  }, [environmentMap, normalMap, particleCutoutEnabled, particleCutoutUniforms, preset, sourceMaterial]);

  const outerMaterial = useMemo(() => {
    const opacity = preset.outerOpacity ?? 1;
    const material = new THREE.MeshPhysicalMaterial({
      color: preset.outerColor,
      metalness: preset.outerMetalness,
      roughness: preset.outerRoughness,
      transmission: preset.outerTransmission,
      ior: preset.outerIor,
      reflectivity: preset.outerReflectivity,
      thickness: preset.outerThickness,
      clearcoat: preset.outerClearcoat,
      clearcoatRoughness: preset.outerClearcoatRoughness,
      envMapIntensity: preset.outerEnvMapIntensity,
      transparent: sourceMaterial ? false : opacity < 1,
      opacity: sourceMaterial ? 1 : opacity,
      depthWrite: sourceMaterial || opacity >= 1,
      toneMapped: true
    });
    if (environmentMap) {
      material.envMap = environmentMap;
    }
    if (normalMap) {
      material.normalMap = normalMap;
      material.normalScale = new THREE.Vector2(preset.normalScale, preset.normalScale);
      normalMap.repeat.set(preset.normalRepeat, preset.normalRepeat);
    }
    if (particleCutoutEnabled) {
      applyOpaqueParticleCutout(material, particleCutoutUniforms);
    }

    return material;
  }, [environmentMap, normalMap, particleCutoutEnabled, particleCutoutUniforms, preset, sourceMaterial]);

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
  useLayoutEffect(() => {
    if (!clonedGeometry) {
      return;
    }

    applyMaterial(clonedGeometry.geometry.inner, clonedGeometry.fallback ? fallbackMaterial : innerMaterial, renderOrder);
    applyMaterial(clonedGeometry.geometry.outer, clonedGeometry.fallback ? fallbackMaterial : outerMaterial, renderOrder + 1);
  }, [clonedGeometry, fallbackMaterial, innerMaterial, outerMaterial, renderOrder]);

  useEffect(() => {
    return () => {
      innerMaterial.dispose();
      outerMaterial.dispose();
      fallbackMaterial.dispose();
    };
  }, [fallbackMaterial, innerMaterial, outerMaterial]);

  useFrame((_state, delta) => {
    if (reviewAutoParticleization && !paused && !reducedMotion) {
      particleizationElapsedRef.current += delta;
      particleizationRef.current = resolveReviewParticleization(particleizationElapsedRef.current);
    } else if (!reviewAutoParticleization) {
      particleizationRef.current += (configuredParticleization - particleizationRef.current) * Math.min(1, delta * 12);
    }
    // Hold the GLB's true yaw through the whole visible dissolution. The latter part of the
    // bridge is reserved for its already-blue particles regrouping into the target open ring.
    const cutoutProgress = clamp(particleizationRef.current / 0.56, 0, 1);
    particleCutoutUniforms.uParticleization.value = cutoutProgress;

    if (!anchorGroup.current) {
      if (rotationSignalRef) {
        rotationSignalRef.current.speed = 0;
      }
      return;
    }

    if (deterministicPose && (paused || reducedMotion)) {
      anchorGroup.current.rotation.y = rotationRef.current;
      anchorGroup.current.rotation.x = -0.08;
      anchorGroup.current.rotation.z = 0.04;
      if (rotationSignalRef) {
        rotationSignalRef.current.angle = rotationRef.current;
        rotationSignalRef.current.speed = 0;
      }
      return;
    }

    const baseDirection = Math.sign(baseSpeed) || 1;
    const propVelocity = reducedMotion || paused
      ? 0
      : sourceMaterial
        ? baseDirection * Math.abs(scrollVelocity * velocityMultiplier)
        : scrollVelocity * velocityMultiplier;
    const manualInputDisabled = reducedMotion || paused || !listenToScrollInput;
    const manualVelocity = manualInputDisabled ? 0 : smoothedManualVelocityRef.current * velocityMultiplier;
    const particleMomentum = sourceMaterial && residue
      ? baseDirection * particleizationRef.current * 1.36
      : 0;
    targetSpeedRef.current = clamp(
      reducedMotion || paused ? 0 : baseSpeed + propVelocity + manualVelocity + particleMomentum,
      -maxAngularVelocity,
      maxAngularVelocity
    );
    currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * Math.min(1, delta * 8);

    const rotationDelta = clamp(currentSpeedRef.current * delta, -maxRotationPerFrame, maxRotationPerFrame);
    rotationRef.current += rotationDelta;
    smoothedManualVelocityRef.current *= 0.94;

    anchorGroup.current.rotation.y = rotationRef.current;
    anchorGroup.current.rotation.x = Math.sin(rotationRef.current * 0.45) * 0.045;
    anchorGroup.current.rotation.z = Math.sin(rotationRef.current * 0.25) * 0.018;
    if (rotationSignalRef) {
      rotationSignalRef.current.angle = rotationRef.current;
      rotationSignalRef.current.speed = currentSpeedRef.current;
    }
  }, -1);

  if (!clonedGeometry) {
    return null;
  }

  return (
    <group position={position} scale={scale} renderOrder={renderOrder}>
      {sourceMaterial && residue ? (
        <CoScrollAnchorResidue
          source={clonedGeometry.geometry.inner}
          sourceScale={clonedGeometry.scale}
          anchorGroup={anchorGroup}
          active={active}
          paused={paused}
          reducedMotion={reducedMotion}
          viewport={viewport}
          config={residue}
          particleizationRef={particleizationRef}
          renderOrder={renderOrder - 2}
        />
      ) : null}
      <group ref={anchorGroup}>
        <primitive object={clonedGeometry.geometry.inner} scale={clonedGeometry.scale} renderOrder={renderOrder} />
        <primitive object={clonedGeometry.geometry.outer} scale={clonedGeometry.scale} renderOrder={renderOrder + 1} />
      </group>
    </group>
  );
}
