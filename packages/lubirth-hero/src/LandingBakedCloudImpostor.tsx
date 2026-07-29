"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  LinearFilter,
  MathUtils,
  Matrix4,
  NoColorSpace,
  Group,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3
} from "three";
import { getRuntimeOpeningProgress, type QualityProfile } from "@miralith/visual-core";
import { geodeticToTextureVector } from "./constants";
import { validateBakedCloudImpostorManifest } from "./bakedCloudManifest";
import type {
  LandingBakedCloudSpikeConfig,
  LandingComposition
} from "./types";
import { createLandingGpuTimer, type LandingGpuTimer, type LandingGpuTimerSnapshot } from "./landingGpuTimer";
import type { LandingPlanetLightingFrame } from "./landingPlanetLighting";

type BakedCloudTierId = "desktop" | "mobile";
type ResourceState = "idle" | "invalid" | "loading" | "ready" | "released";

interface BakedCloudAsset {
  byteLength: number;
  file: string;
  height: number;
  sha256: string;
  width: number;
}

interface BakedCloudManifestView {
  assets: {
    colorOpacity: BakedCloudAsset;
    depthOptical: BakedCloudAsset;
    normalAoScatter: BakedCloudAsset;
  };
  id: string;
  viewDirection: [number, number, number];
}

interface BakedCloudManifestTier {
  id: BakedCloudTierId;
  maxGpuResidencyBytes: number;
  maxTransferBytes: number;
  views: BakedCloudManifestView[];
}

interface BakedCloudManifest {
  tiers: BakedCloudManifestTier[];
}

interface LoadedBakedCloudView {
  colorOpacity: Texture;
  depthOptical: Texture;
  id: string;
  normalAoScatter: Texture;
  viewDirection: Vector3;
}

interface LoadedBakedCloudTier {
  decodedGpuResidencyBytes: number;
  id: BakedCloudTierId;
  maxGpuResidencyBytes: number;
  maxTransferBytes: number;
  transferBytes: number;
  views: LoadedBakedCloudView[];
}

interface SelectedBakedCloudView {
  view: LoadedBakedCloudView;
  weight: number;
}

interface LandingBakedCloudImpostorProps {
  composition: LandingComposition;
  farOpticalWeightRef: MutableRefObject<number>;
  lightingFrame: LandingPlanetLightingFrame;
  quality: QualityProfile;
  spike: LandingBakedCloudSpikeConfig;
}

declare global {
  interface Window {
    __MiraLithLuBirthBakedCloud?: {
      anchor: {
        latitudeDeg: number;
        longitudeDeg: number;
      };
      anchorLocalPosition: [number, number, number];
      candidateVisible: boolean;
      decodedGpuResidencyBytes: number;
      farOpticalWeight: number;
      gpuTimer: LandingGpuTimerSnapshot;
      locationReady: boolean;
      maxGpuResidencyBytes: number;
      maxTransferBytes: number;
      nearOpticalWeight: number;
      openingTimeline: "mapOpeningProgress";
      progress: number;
      resourceGeneration: number;
      resourceState: ResourceState;
      selectedViewIds: string[];
      sharedCloudOffset: number;
      tier: BakedCloudTierId | null;
      transferBytes: number;
    };
  }
}

const ASSET_ROOT = "/assets/lubirth/cloud-impostor/";
const FORWARD = new Vector3(0, 0, 1);
const WORLD_UP = new Vector3(0, 1, 0);

function resolveTierId(width: number, height: number): BakedCloudTierId {
  const touchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints;
  return touchPoints > 0 || Math.min(width, height) < 720 ? "mobile" : "desktop";
}

function normalizeViewDirection(direction: [number, number, number]) {
  return new Vector3(direction[0], direction[1], direction[2]).normalize();
}

function loadTexture(
  loader: TextureLoader,
  asset: BakedCloudAsset,
  colorSpace: typeof SRGBColorSpace | typeof NoColorSpace,
  createdTextures: Texture[]
) {
  return loader.loadAsync(ASSET_ROOT + asset.file).then((texture) => {
    texture.colorSpace = colorSpace;
    texture.generateMipmaps = false;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    createdTextures.push(texture);
    return texture;
  });
}

function measureTierTransferBytes(tier: BakedCloudManifestTier) {
  return tier.views.reduce((total, view) => (
    total +
    view.assets.colorOpacity.byteLength +
    view.assets.depthOptical.byteLength +
    view.assets.normalAoScatter.byteLength
  ), 0);
}

function measureTierDecodedGpuResidencyBytes(tier: BakedCloudManifestTier) {
  return tier.views.reduce((total, view) => {
    const { colorOpacity, depthOptical, normalAoScatter } = view.assets;
    return total +
      colorOpacity.width * colorOpacity.height * 4 +
      depthOptical.width * depthOptical.height * 4 +
      normalAoScatter.width * normalAoScatter.height * 4;
  }, 0);
}

function disposeTierTextures(tier: LoadedBakedCloudTier) {
  for (const view of tier.views) {
    view.colorOpacity.dispose();
    view.depthOptical.dispose();
    view.normalAoScatter.dispose();
  }
}

function selectViews(
  views: LoadedBakedCloudView[],
  cameraDirection: Vector3
): SelectedBakedCloudView[] {
  const ranked = views
    .map((view) => ({ score: Math.max(-1, view.viewDirection.dot(cameraDirection)), view }))
    .sort((left, right) => right.score - left.score);
  const first = ranked[0];
  if (!first) {
    return [];
  }
  const second = ranked[1];
  if (!second) {
    return [{ view: first.view, weight: 1 }];
  }
  const secondWeight = MathUtils.clamp(0.5 - (first.score - second.score) * 2.5, 0, 0.5);
  return [
    { view: first.view, weight: 1 - secondWeight },
    ...(secondWeight > 0.01 ? [{ view: second.view, weight: secondWeight }] : [])
  ];
}

function createBakedCloudMaterial(view: LoadedBakedCloudView) {
  return new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    name: "MiraLithBakedCloudImpostor",
    premultipliedAlpha: true,
    toneMapped: true,
    transparent: true,
    uniforms: {
      colorOpacityMap: { value: view.colorOpacity },
      depthOpticalMap: { value: view.depthOptical },
      lightDirection: { value: new Vector3(0, 1, 0) },
      normalAoScatterMap: { value: view.normalAoScatter },
      opacity: { value: 0 },
      viewDirection: { value: new Vector3(0, 0, 1) }
    },
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform sampler2D colorOpacityMap;",
      "uniform sampler2D depthOpticalMap;",
      "uniform sampler2D normalAoScatterMap;",
      "uniform vec3 lightDirection;",
      "uniform vec3 viewDirection;",
      "uniform float opacity;",
      "varying vec2 vUv;",
      "void main() {",
      "  vec2 parallaxUv = clamp(vUv + (viewDirection.xy * 0.014), vec2(0.002), vec2(0.998));",
      "  vec4 depthOptical = texture2D(depthOpticalMap, parallaxUv);",
      "  vec4 colorOpacity = texture2D(colorOpacityMap, parallaxUv);",
      "  vec4 normalAoScatter = texture2D(normalAoScatterMap, parallaxUv);",
      "  float tau = max(depthOptical.g * 3.15, -log(max(1.0 - colorOpacity.a, 0.0002)));",
      "  float alpha = 1.0 - exp(-tau * opacity * 1.18);",
      "  float softSurfaceIntersection = smoothstep(0.014, 0.14, depthOptical.r) * smoothstep(0.02, 0.16, depthOptical.a);",
      "  alpha *= softSurfaceIntersection;",
      "  if (alpha <= 0.002) discard;",
      "  vec3 bentNormal = normalize(vec3(normalAoScatter.r * 2.0 - 1.0, normalAoScatter.g * 2.0 - 1.0, 0.72));",
      "  float sun = clamp(dot(bentNormal, normalize(lightDirection)) * 0.5 + 0.5, 0.0, 1.0);",
      "  float occlusion = normalAoScatter.b;",
      "  float scatter = normalAoScatter.a;",
      "  float volumeDepth = mix(0.58, 1.18, depthOptical.g);",
      "  vec3 linearCloud = pow(max(colorOpacity.rgb, vec3(0.0)), vec3(1.72));",
      "  linearCloud *= mix(0.68, 1.44, sun) * mix(0.84, 1.16, scatter) * mix(1.08, 0.62, occlusion) * volumeDepth;",
      "  linearCloud += vec3(0.038, 0.052, 0.072) * scatter * tau;",
      "  gl_FragColor = vec4(linearCloud * alpha, alpha);",
      "  #include <tonemapping_fragment>",
      "  #include <colorspace_fragment>",
      "}"
    ].join("\n")
  });
}

function BakedCloudPlane({
  farOpticalWeightRef,
  gpuTimer,
  gpuTimerEnabled,
  lightingFrame,
  planeSize,
  selectionWeight,
  visibleOpacityRef,
  view
}: {
  farOpticalWeightRef: MutableRefObject<number>;
  gpuTimer: LandingGpuTimer;
  gpuTimerEnabled: boolean;
  lightingFrame: LandingPlanetLightingFrame;
  planeSize: [number, number];
  selectionWeight: number;
  visibleOpacityRef: MutableRefObject<number>;
  view: LoadedBakedCloudView;
}) {
  const material = useMemo(() => createBakedCloudMaterial(view), [view]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    material.uniforms.opacity.value =
      selectionWeight *
      visibleOpacityRef.current *
      (1 - farOpticalWeightRef.current);
    material.uniforms.lightDirection.value.copy(lightingFrame.sunDirection).normalize();
  });

  return (
    <mesh
      material={material}
      onAfterRender={gpuTimerEnabled ? gpuTimer.end : undefined}
      onBeforeRender={gpuTimerEnabled ? gpuTimer.begin : undefined}
      renderOrder={7}
    >
      <planeGeometry args={[planeSize[0], planeSize[1], 1, 1]} />
    </mesh>
  );
}

export function LandingBakedCloudImpostor({
  composition,
  farOpticalWeightRef,
  lightingFrame,
  quality,
  spike
}: LandingBakedCloudImpostorProps) {
  const { camera, gl, size } = useThree();
  const tierId = useMemo(
    () => resolveTierId(size.width, size.height),
    [size.height, size.width]
  );
  const gpuTimerEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("bakedCloudValidation") === "on";
  }, []);
  const gpuTimer = useMemo(
    () => createLandingGpuTimer(gl.getContext(), gpuTimerEnabled),
    [gl, gpuTimerEnabled]
  );
  const [resourceState, setResourceState] = useState<ResourceState>("idle");
  const [loadedTier, setLoadedTier] = useState<LoadedBakedCloudTier | null>(null);
  const [selectedViews, setSelectedViews] = useState<SelectedBakedCloudView[]>([]);
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const resourceStateRef = useRef<ResourceState>("idle");
  const releaseDeadline = useRef<number | null>(null);
  const resourceGeneration = useRef(0);
  const anchor = useRef<Group>(null);
  const billboard = useRef<Group>(null);
  const anchorInitialized = useRef(false);
  const visibleOpacityRef = useRef(0);
  const selectionSignature = useRef("");
  const cameraWorld = useMemo(() => new Vector3(), []);
  const cameraAnchorLocal = useMemo(() => new Vector3(), []);
  const anchorNormal = useMemo(
    () => new Vector3(...geodeticToTextureVector(
      composition.location.latitudeDeg,
      composition.location.longitudeDeg
    )).normalize(),
    [composition.location.latitudeDeg, composition.location.longitudeDeg]
  );
  const anchorTargetPosition = useMemo(() => new Vector3(), []);
  const anchorEast = useMemo(() => new Vector3(), []);
  const anchorNorth = useMemo(() => new Vector3(), []);
  const anchorBasis = useMemo(() => new Matrix4(), []);
  const anchorTargetQuaternion = useMemo(() => new Quaternion(), []);
  const billboardTargetQuaternion = useMemo(() => new Quaternion(), []);
  const planeSize = useMemo<[number, number]>(
    () => [composition.earth.radius * 0.72, composition.earth.radius * 0.52],
    [composition.earth.radius]
  );

  useEffect(() => {
    if (!spike.enabled || quality.tier === "fallback") {
      setLoadedTier(null);
      setSelectedViews([]);
      setResourceState("idle");
      return undefined;
    }

    let cancelled = false;
    const createdTextures: Texture[] = [];
    const loader = new TextureLoader();
    setResourceState("loading");

    const load = async () => {
      try {
        const response = await fetch(ASSET_ROOT + "manifest.json");
        const rawManifest = await response.json() as unknown;
        const validation = validateBakedCloudImpostorManifest(rawManifest);
        if (!response.ok || !validation.valid) {
          throw new Error("Invalid baked cloud manifest.");
        }
        const manifest = rawManifest as BakedCloudManifest;
        const tier = manifest.tiers.find((candidate) => candidate.id === tierId);
        if (!tier) {
          throw new Error("Missing baked cloud tier.");
        }

        const views = await Promise.all(tier.views.map(async (view) => ({
          colorOpacity: await loadTexture(loader, view.assets.colorOpacity, SRGBColorSpace, createdTextures),
          depthOptical: await loadTexture(loader, view.assets.depthOptical, NoColorSpace, createdTextures),
          id: view.id,
          normalAoScatter: await loadTexture(loader, view.assets.normalAoScatter, NoColorSpace, createdTextures),
          viewDirection: normalizeViewDirection(view.viewDirection)
        })));
        if (cancelled) {
          return;
        }

        const nextTier = {
          decodedGpuResidencyBytes: measureTierDecodedGpuResidencyBytes(tier),
          id: tier.id,
          maxGpuResidencyBytes: tier.maxGpuResidencyBytes,
          maxTransferBytes: tier.maxTransferBytes,
          transferBytes: measureTierTransferBytes(tier),
          views
        };
        resourceGeneration.current += 1;
        setLoadedTier(nextTier);
        setSelectedViews(views[0] ? [{ view: views[0], weight: 1 }] : []);
        setResourceState("ready");
      } catch {
        if (!cancelled) {
          setLoadedTier(null);
          setSelectedViews([]);
          setResourceState("invalid");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      createdTextures.forEach((texture) => texture.dispose());
    };
  }, [quality.tier, reloadEpoch, spike.enabled, tierId]);

  useEffect(() => () => gpuTimer.dispose(), [gpuTimer]);

  useEffect(() => {
    resourceStateRef.current = resourceState;
  }, [resourceState]);

  useEffect(() => () => {
    if (typeof window !== "undefined") {
      window.__MiraLithLuBirthBakedCloud = undefined;
    }
  }, []);

  useFrame((state, delta) => {
    const progress = getRuntimeOpeningProgress(0);
    const farOpticalWeight = farOpticalWeightRef.current;
    const nearOpticalWeight = 1 - farOpticalWeight;
    const sharedCloudOffset = lightingFrame.cloudOffsetRef.current;
    const radius = composition.earth.radius;
    const anchorVisible = spike.enabled && spike.locationReady && resourceState === "ready";

    const canReleaseNearTier =
      resourceStateRef.current === "ready" &&
      loadedTier !== null &&
      farOpticalWeight >= 0.999 &&
      progress >= 0.96;
    if (canReleaseNearTier) {
      if (releaseDeadline.current === null) {
        // Give a stable far-only frame window before disposing; a quick
        // reverse through the handoff must keep the resident tier intact.
        releaseDeadline.current = state.clock.elapsedTime + 1.5;
      } else if (state.clock.elapsedTime >= releaseDeadline.current && loadedTier) {
        disposeTierTextures(loadedTier);
        releaseDeadline.current = null;
        resourceStateRef.current = "released";
        selectionSignature.current = "";
        setLoadedTier(null);
        setSelectedViews([]);
        setResourceState("released");
      }
    } else if (resourceStateRef.current === "released" && progress < 0.86) {
      resourceStateRef.current = "loading";
      releaseDeadline.current = null;
      setResourceState("loading");
      setReloadEpoch((value) => value + 1);
    } else if (resourceStateRef.current === "ready") {
      releaseDeadline.current = null;
    }

    anchorEast.crossVectors(WORLD_UP, anchorNormal);
    if (anchorEast.lengthSq() < 1e-5) {
      anchorEast.set(1, 0, 0);
    } else {
      anchorEast.normalize();
    }
    anchorNorth.crossVectors(anchorNormal, anchorEast).normalize();
    anchorTargetPosition
      .copy(anchorNormal)
      .multiplyScalar(radius * 1.035)
      .addScaledVector(anchorEast, Math.sin(sharedCloudOffset * Math.PI * 2) * radius * 0.018)
      .addScaledVector(anchorNorth, Math.cos(sharedCloudOffset * Math.PI * 2) * radius * 0.008);
    anchorBasis.makeBasis(anchorEast, anchorNorth, anchorNormal);
    anchorTargetQuaternion.setFromRotationMatrix(anchorBasis);

    if (anchor.current) {
      if (!anchorInitialized.current && spike.locationReady) {
        anchor.current.position.copy(anchorTargetPosition);
        anchor.current.quaternion.copy(anchorTargetQuaternion);
        anchorInitialized.current = true;
        visibleOpacityRef.current = 1;
      } else if (spike.locationReady) {
        const smoothing = 1 - Math.exp(-delta * 5.5);
        anchor.current.position.lerp(anchorTargetPosition, smoothing);
        anchor.current.quaternion.slerp(anchorTargetQuaternion, smoothing);
        visibleOpacityRef.current = MathUtils.damp(visibleOpacityRef.current, 1, 6, delta);
      } else {
        visibleOpacityRef.current = MathUtils.damp(visibleOpacityRef.current, 0, 10, delta);
      }

      anchor.current.updateMatrixWorld();
      camera.getWorldPosition(cameraWorld);
      cameraAnchorLocal.copy(cameraWorld);
      anchor.current.worldToLocal(cameraAnchorLocal);
      if (cameraAnchorLocal.lengthSq() > 1e-6) {
        cameraAnchorLocal.normalize();
        billboardTargetQuaternion.setFromUnitVectors(FORWARD, cameraAnchorLocal);
        billboard.current?.quaternion.copy(billboardTargetQuaternion);

        if (loadedTier && resourceStateRef.current === "ready") {
          const nextSelection = selectViews(loadedTier.views, cameraAnchorLocal);
          const nextSignature = nextSelection
            .map((selection) => selection.view.id + ":" + selection.weight.toFixed(2))
            .join("|");
          if (nextSignature !== selectionSignature.current) {
            selectionSignature.current = nextSignature;
            setSelectedViews(nextSelection);
          }
        }
      }
    }

    const anchorLocalPosition: [number, number, number] = anchor.current
      ? [anchor.current.position.x, anchor.current.position.y, anchor.current.position.z]
      : [0, 0, 0];

    const telemetryTier = resourceState === "ready" ? loadedTier : null;
    if (typeof window !== "undefined") {
      window.__MiraLithLuBirthBakedCloud = {
        anchor: {
          latitudeDeg: composition.location.latitudeDeg,
          longitudeDeg: composition.location.longitudeDeg
        },
        anchorLocalPosition,
        candidateVisible: anchorVisible && visibleOpacityRef.current > 0.01 && nearOpticalWeight > 0.01,
        decodedGpuResidencyBytes: telemetryTier?.decodedGpuResidencyBytes ?? 0,
        farOpticalWeight,
        gpuTimer: gpuTimer.poll(),
        locationReady: spike.locationReady,
        maxGpuResidencyBytes: telemetryTier?.maxGpuResidencyBytes ?? 0,
        maxTransferBytes: telemetryTier?.maxTransferBytes ?? 0,
        nearOpticalWeight,
        openingTimeline: "mapOpeningProgress",
        progress,
        resourceGeneration: resourceGeneration.current,
        resourceState,
        selectedViewIds: resourceState === "ready" ? selectedViews.map((selection) => selection.view.id) : [],
        sharedCloudOffset,
        tier: telemetryTier?.id ?? null,
        transferBytes: telemetryTier?.transferBytes ?? 0
      };
    }
  });

  if (!spike.enabled || quality.tier === "fallback") {
    return null;
  }

  return (
    <group ref={anchor}>
      <group ref={billboard}>
        {resourceState === "ready" ? selectedViews.map((selection) => (
          <BakedCloudPlane
            key={selection.view.id}
            farOpticalWeightRef={farOpticalWeightRef}
            gpuTimer={gpuTimer}
            gpuTimerEnabled={gpuTimerEnabled}
            lightingFrame={lightingFrame}
            planeSize={planeSize}
            selectionWeight={selection.weight}
            visibleOpacityRef={visibleOpacityRef}
            view={selection.view}
          />
        )) : null}
      </group>
    </group>
  );
}
