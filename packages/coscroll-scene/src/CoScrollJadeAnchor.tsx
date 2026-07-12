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
import type { CoScrollAnchorAsset, CoScrollFallbackReason, CoScrollRotationSignalRef } from "./types";

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

function loadEnvironmentTexture(gl: THREE.WebGLRenderer) {
  const cached = environmentTextureCache.get(gl);
  if (cached) {
    return cached;
  }

  const promise = new HDRLoader()
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
  loadPreparedAnchorGeometry(modelSrc, sourceMode).catch(() => undefined);
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
    const previousEnvironmentIntensity = scene.environmentIntensity;
    loadEnvironmentTexture(gl).then((texture) => {
      if (!cancelled) {
        setEnvironmentMap(texture);
        scene.environment = texture;
        scene.environmentIntensity = 1;
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
      scene.environmentIntensity = previousEnvironmentIntensity;
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
    const material = new THREE.MeshPhysicalMaterial({
      color: preset.innerColor,
      metalness: preset.innerMetalness,
      roughness: preset.innerRoughness,
      transmission: preset.innerTransmission,
      emissive: new THREE.Color(preset.innerEmissive),
      emissiveIntensity: preset.innerEmissiveIntensity,
      envMapIntensity: preset.innerEnvMapIntensity,
      transparent: preset.innerOpacity < 1,
      opacity: preset.innerOpacity,
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

    return material;
  }, [environmentMap, normalMap, preset]);

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
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
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

    return material;
  }, [environmentMap, normalMap, preset]);

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
    targetSpeedRef.current = clamp(reducedMotion || paused ? 0 : baseSpeed + propVelocity + manualVelocity, -maxAngularVelocity, maxAngularVelocity);
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
    <group ref={anchorGroup} position={position} scale={scale} renderOrder={renderOrder}>
      <primitive object={clonedGeometry.geometry.inner} scale={clonedGeometry.scale} renderOrder={renderOrder} />
      <primitive object={clonedGeometry.geometry.outer} scale={clonedGeometry.scale} renderOrder={renderOrder + 1} />
    </group>
  );
}
