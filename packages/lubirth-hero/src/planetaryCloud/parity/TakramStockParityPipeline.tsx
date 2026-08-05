"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import {
  AerialPerspective,
  Atmosphere,
  type AtmosphereApi
} from "@takram/three-atmosphere/r3f";
import type { AerialPerspectiveEffect } from "@takram/three-atmosphere";
import { Clouds } from "@takram/three-clouds/r3f";
import { CloudLayers, type CloudsEffect } from "@takram/three-clouds";
import type { ExpandNestedProps } from "@takram/three-geospatial/r3f";
import { useEffect, useRef, useState } from "react";
import { mapOpeningProgress } from "@miralith/visual-core";
import {
  Euler,
  Group,
  Matrix4,
  NoToneMapping,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  TextureLoader,
  Vector3
} from "three";
import { DEFAULT_LUBIRTH_SUN_DIRECTION } from "../../constants";
import { buildLuBirthWorldToEcef } from "../planetaryCloudMath";
import {
  TAKRAM_PARITY_BOTTOM_RADIUS_M,
  TAKRAM_PARITY_CONTROL,
  TAKRAM_PARITY_DEFAULTS,
  TAKRAM_PARITY_ELLIPSOID,
  TAKRAM_PARITY_RENDERER_FINGERPRINT,
  type TakramParityDiagnostic,
  type TakramParityInput,
  type TakramParityTelemetry,
  type TakramParityView
} from "./TakramParityContract";
import { useTakramParityRuntimeAssets } from "./TakramParityAssetLoader";
import { useTakramParityAtmospherePrecompute } from "./TakramParityAtmospherePrecompute";

const EARTH_DAY_SRC = "/assets/lubirth/textures/earth-day-nasa-lite-4k.webp";
const CONTROL_CAMERA_ALTITUDE_M =
  TAKRAM_PARITY_CONTROL.altitudeMeters;
const CONTROL_SCENE_RADIUS_M = TAKRAM_PARITY_BOTTOM_RADIUS_M;
const DEG_TO_RAD = Math.PI / 180;
const TEMPORAL_CONVERGENCE_FRAME_COUNT = 32;

const scratchCameraPosition = new Vector3();
const scratchCameraTarget = new Vector3();
const scratchControlDirection = new Vector3();
const scratchEarthEuler = new Euler();
const scratchEarthMatrix = new Matrix4();
const scratchEarthQuaternion = new Quaternion();
const scratchSunDirectionEcef = new Vector3();
const scratchSunDirectionWorld = new Vector3();

type TakramCloudsRef = CloudsEffect &
  ExpandNestedProps<CloudsEffect, "clouds"> &
  ExpandNestedProps<CloudsEffect, "shadow">;

declare global {
  interface Window {
    __MiraLithTakramParity?: TakramParityTelemetry;
  }
}

export interface TakramStockParityPipelineProps {
  diagnostic?: TakramParityDiagnostic;
  input: TakramParityInput;
  onTelemetry?: (telemetry: TakramParityTelemetry) => void;
  progress: number;
  view: TakramParityView;
}

function clampOpeningProgress(value: number) {
  return Math.max(0, Math.min(0.18, Number.isFinite(value) ? value : 0));
}

function updateControlFrame(
  earthGroup: Group,
  camera: PerspectiveCamera
) {
  // The upstream control intentionally uses ECEF meters for both the opaque
  // depth scene and Clouds. Takram's stock shader compares scene depth with
  // meter-space cloud intervals, so a normalized LuBirth sphere is only valid
  // in the opening bridge path, not in this upstream rendering control.
  earthGroup.position.set(0, 0, 0);
  earthGroup.quaternion.identity();
  earthGroup.scale.setScalar(1);

  scratchCameraPosition.set(0, 0, CONTROL_SCENE_RADIUS_M + CONTROL_CAMERA_ALTITUDE_M);
  scratchControlDirection.set(
    0,
    Math.cos(TAKRAM_PARITY_CONTROL.pitchDegrees * DEG_TO_RAD),
    Math.sin(TAKRAM_PARITY_CONTROL.pitchDegrees * DEG_TO_RAD)
  );
  scratchCameraTarget.copy(scratchCameraPosition).add(scratchControlDirection);
  camera.fov = TAKRAM_PARITY_CONTROL.fovDegrees;
  camera.near = 100;
  camera.far = 1_000_000;
  camera.up.set(0, 0, 1);
  camera.position.copy(scratchCameraPosition);
  camera.lookAt(scratchCameraTarget);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const azimuth = TAKRAM_PARITY_CONTROL.sunAzimuthDegrees * DEG_TO_RAD;
  const elevation = TAKRAM_PARITY_CONTROL.sunElevationDegrees * DEG_TO_RAD;
  scratchSunDirectionWorld.set(
    Math.sin(azimuth) * Math.cos(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
    Math.sin(elevation)
  ).normalize();
}

function updateOpeningFrame(
  earthGroup: Group,
  camera: PerspectiveCamera,
  progress: number
) {
  // This mirrors the isolated Task -1R opening frame exactly: the same
  // mapOpeningProgress output, Euler order, camera target and FOV. It remains
  // intentionally separate from EarthMoonScene and all production renderers.
  const openingFrame = mapOpeningProgress(clampOpeningProgress(progress));
  earthGroup.position.set(openingFrame.earthX, openingFrame.earthY, 0);
  scratchEarthEuler.set(
    openingFrame.earthPitchDeg * DEG_TO_RAD,
    openingFrame.earthYawDeg * DEG_TO_RAD,
    0,
    "YXZ"
  );
  scratchEarthQuaternion.setFromEuler(scratchEarthEuler);
  earthGroup.quaternion.copy(scratchEarthQuaternion);
  earthGroup.scale.setScalar(openingFrame.earthScale);

  scratchCameraPosition.set(
    Math.sin(openingFrame.cameraAzimuth) * openingFrame.cameraDistance,
    Math.sin(openingFrame.cameraElevation) * openingFrame.cameraDistance,
    Math.cos(openingFrame.cameraAzimuth) * openingFrame.cameraDistance
  );
  scratchCameraTarget.set(0, openingFrame.cameraLookAtY, 0);
  camera.fov = 45;
  camera.near = 0.01;
  camera.far = 100;
  camera.up.set(0, 1, 0);
  camera.position.copy(scratchCameraPosition);
  camera.lookAt(scratchCameraTarget);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  scratchSunDirectionWorld.set(...DEFAULT_LUBIRTH_SUN_DIRECTION)
    .applyQuaternion(scratchEarthQuaternion)
    .normalize();
}

function nativeFeatures(clouds: CloudsEffect | null, aerialPerspective: AerialPerspectiveEffect | null) {
  return {
    aerialPerspective: aerialPerspective !== null,
    beerShadowMaps: (clouds?.shadowMaps.cascadeCount ?? 0) > 0,
    defaultCloudLayers: clouds !== null && clouds.cloudLayers.length === CloudLayers.DEFAULT.length,
    haze: clouds?.haze === true,
    lightShafts: clouds?.lightShafts === true,
    qualityPreset: TAKRAM_PARITY_DEFAULTS.qualityPreset,
    resolutionScale: clouds?.resolutionScale ?? 0,
    shapeDetail: clouds?.shapeDetail === true,
    temporalUpscale: clouds?.temporalUpscale === true,
    turbulence: clouds?.turbulence === true
  };
}

function resolveDiagnosticState(diagnostic: TakramParityDiagnostic) {
  return {
    aerialPerspectiveComposite: diagnostic !== "cloud-raw",
    beerShadowOcclusion: diagnostic !== "bsm-off",
    cloudRawOutput: diagnostic === "cloud-raw",
    historyResetFirstFrame: diagnostic === "history-reset-first"
  };
}

/**
 * A strictly native stock pipeline: the only cloud renderer is Takram's
 * Clouds -> AerialPerspective pair. It deliberately contains no custom
 * raymarch, BSM, resolve/history or cloud-composite substitute.
 */
export function TakramStockParityPipeline({
  diagnostic = "full",
  input,
  onTelemetry,
  progress,
  view
}: TakramStockParityPipelineProps) {
  const { gl, camera } = useThree();
  const earthTexture = useLoader(TextureLoader, EARTH_DAY_SRC);
  const assetsState = useTakramParityRuntimeAssets(gl.domElement);
  const atmosphereState = useTakramParityAtmospherePrecompute(gl, gl.domElement);
  const atmosphereRef = useRef<AtmosphereApi>(null);
  const cloudsRef = useRef<TakramCloudsRef>(null);
  const aerialPerspectiveRef = useRef<AerialPerspectiveEffect>(null);
  const earthGroupRef = useRef<Group>(null);
  const onTelemetryRef = useRef(onTelemetry);
  const publishedTelemetryRef = useRef("");
  const bridgeReadyRef = useRef(false);
  const transformFallbackRef = useRef<TakramParityTelemetry["transformFallback"]>(null);
  const historyDiagnosticRef = useRef<TakramParityDiagnostic | null>(null);
  const appliedDiagnosticRef = useRef<TakramParityDiagnostic | null>(null);
  const nativeFrameCountRef = useRef(0);
  const nativeFrameEpochRef = useRef("");
  const [bridgeReady, setBridgeReady] = useState(false);
  onTelemetryRef.current = onTelemetry;

  useEffect(() => {
    earthTexture.colorSpace = SRGBColorSpace;
    earthTexture.needsUpdate = true;
  }, [earthTexture]);

  useEffect(() => {
    const previous = {
      outputColorSpace: gl.outputColorSpace,
      toneMapping: gl.toneMapping,
      toneMappingExposure: gl.toneMappingExposure
    };
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = 1;
    gl.outputColorSpace = SRGBColorSpace;
    return () => {
      gl.outputColorSpace = previous.outputColorSpace;
      gl.toneMapping = previous.toneMapping;
      gl.toneMappingExposure = previous.toneMappingExposure;
    };
  }, [gl]);

  // These probes are capture-only control diagnostics. The normal stock and
  // opening paths always return to the immutable high-quality fingerprint.
  useEffect(() => {
    appliedDiagnosticRef.current = null;
    if (!bridgeReady || !assetsState.ready || !atmosphereState.ready) {
      return undefined;
    }

    const clouds = cloudsRef.current;
    const aerialPerspective = aerialPerspectiveRef.current;
    if (!clouds || !aerialPerspective) {
      return undefined;
    }

    // `cascadeCount = 0` makes the native effect allocate a zero-depth target,
    // which is not a supported Takram BSM-off mode. Keep the frozen stock BSM
    // path intact and make every cloud layer non-shadowing instead: the native
    // shadow pass then emits unit transmittance while cloud rendering remains
    // fully visible. This isolates BSM occlusion without replacing the effect.
    const shadowLayerFlags = Array.from(
      clouds.cloudLayers,
      (layer) => layer.shadow
    );
    if (diagnostic === "bsm-off") {
      clouds.cloudLayers.forEach((layer) => {
        layer.shadow = false;
      });
    }
    clouds.skipRendering = diagnostic !== "cloud-raw";
    aerialPerspective.blendMode.blendFunction = diagnostic === "cloud-raw"
      ? BlendFunction.SKIP
      : BlendFunction.NORMAL;
    appliedDiagnosticRef.current = diagnostic;

    if (diagnostic === "history-reset-first" && historyDiagnosticRef.current !== diagnostic) {
      historyDiagnosticRef.current = diagnostic;
      // Toggle synchronously so the native pass reallocates its history, then
      // returns to the frozen stock temporal mode before the next render. The
      // next output is therefore the first frame of a genuine history reset.
      clouds.temporalUpscale = false;
      clouds.temporalUpscale = true;
    }
    historyDiagnosticRef.current = diagnostic;

    return () => {
      appliedDiagnosticRef.current = null;
      clouds.cloudLayers.forEach((layer, index) => {
        layer.shadow = shadowLayerFlags[index] ?? false;
      });
      clouds.skipRendering = true;
      clouds.temporalUpscale = true;
      aerialPerspective.blendMode.blendFunction = BlendFunction.NORMAL;
    };
  }, [assetsState.ready, atmosphereState.ready, bridgeReady, diagnostic]);

  // Camera and planet transforms must settle before the -1 native bridge
  // update, so Clouds observes the matching world/ECEF state in its own frame.
  useFrame(() => {
    const earthGroup = earthGroupRef.current;
    if (!earthGroup || !(camera instanceof PerspectiveCamera)) {
      return;
    }

    if (view === "control") {
      updateControlFrame(earthGroup, camera);
    } else {
      updateOpeningFrame(earthGroup, camera, progress);
    }
    earthGroup.updateMatrixWorld(true);

  }, -2);

  useFrame(() => {
    const earthGroup = earthGroupRef.current;
    if (!earthGroup || !(camera instanceof PerspectiveCamera)) {
      return;
    }

    scratchEarthMatrix.copy(earthGroup.matrixWorld);
    const coordinateMode = view === "control" ? "upstream-ecef" : "lubirth-bridge";
    const bridge = view === "opening"
      ? buildLuBirthWorldToEcef(scratchEarthMatrix, 1)
      : null;
    const transformFallback = bridge === null
      ? null
      : bridge.valid
        ? null
        : bridge.reason ?? "invalid-composition-radius";
    const nextBridgeReady = transformFallback === null;
    if (transformFallbackRef.current !== transformFallback ||
      bridgeReadyRef.current !== nextBridgeReady) {
      transformFallbackRef.current = transformFallback;
      bridgeReadyRef.current = nextBridgeReady;
      setBridgeReady(nextBridgeReady);
    }

    let ecefSunDirection: [number, number, number] | null = null;
    const atmosphere = atmosphereRef.current;
    if (atmosphere) {
      if (coordinateMode === "upstream-ecef") {
        atmosphere.worldToECEFMatrix.identity();
        scratchSunDirectionEcef.copy(scratchSunDirectionWorld);
        atmosphere.sunDirection.copy(scratchSunDirectionEcef);
        ecefSunDirection = [
          scratchSunDirectionEcef.x,
          scratchSunDirectionEcef.y,
          scratchSunDirectionEcef.z
        ];
      } else if (bridge?.valid && bridge.worldToEcef) {
        atmosphere.worldToECEFMatrix.copy(bridge.worldToEcef);
        scratchSunDirectionEcef.copy(scratchSunDirectionWorld)
          .transformDirection(bridge.worldToEcef)
          .normalize();
        atmosphere.sunDirection.copy(scratchSunDirectionEcef);
        ecefSunDirection = [
          scratchSunDirectionEcef.x,
          scratchSunDirectionEcef.y,
          scratchSunDirectionEcef.z
        ];
      }
    }

    const clouds = cloudsRef.current;
    const aerialPerspective = aerialPerspectiveRef.current;
    const nativePipelineReady = assetsState.ready && atmosphereState.ready &&
      bridgeReadyRef.current && clouds !== null && aerialPerspective !== null &&
      appliedDiagnosticRef.current === diagnostic;
    const nativeFrameEpoch = [
      assetsState.assetGeneration,
      atmosphereState.atmosphereGeneration,
      coordinateMode,
      diagnostic
    ].join(":");
    if (nativeFrameEpochRef.current !== nativeFrameEpoch) {
      nativeFrameEpochRef.current = nativeFrameEpoch;
      nativeFrameCountRef.current = 0;
    }
    if (nativePipelineReady) {
      nativeFrameCountRef.current += 1;
    }
    const nativeFrameCount = nativeFrameCountRef.current;
    const temporalConverged = diagnostic !== "history-reset-first" &&
      nativeFrameCount >= TEMPORAL_CONVERGENCE_FRAME_COUNT;
    const resolvedNative = nativeFeatures(clouds, aerialPerspective);
    const telemetry: TakramParityTelemetry = {
      active: nativePipelineReady &&
        (diagnostic === "history-reset-first" || temporalConverged),
      assetGeneration: assetsState.assetGeneration,
      assetsReady: assetsState.ready,
      atmosphereGeneration: atmosphereState.atmosphereGeneration,
      atmosphereReady: atmosphereState.ready,
      cameraMatrixWorld: camera.matrixWorld.toArray(),
      cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
      coordinateMode,
      control: view === "control" ? TAKRAM_PARITY_CONTROL : null,
      diagnostic,
      diagnosticApplied: appliedDiagnosticRef.current === diagnostic,
      diagnosticState: resolveDiagnosticState(diagnostic),
      earthMatrixWorld: scratchEarthMatrix.toArray(),
      ecefSunDirection,
      input,
      native: resolvedNative,
      nativeFrameCount,
      progress: clampOpeningProgress(progress),
      rendererFingerprint: TAKRAM_PARITY_RENDERER_FINGERPRINT,
      stockCoverage: view === "control" ? TAKRAM_PARITY_CONTROL.coverage : null,
      stockWeatherRepeat: clouds === null
        ? null
        : [clouds.localWeatherRepeat.x, clouds.localWeatherRepeat.y],
      temporalConverged,
      transformFallback,
      view
    };
    const signature = JSON.stringify({
      active: telemetry.active,
      assetGeneration: telemetry.assetGeneration,
      assetsReady: telemetry.assetsReady,
      atmosphereGeneration: telemetry.atmosphereGeneration,
      atmosphereReady: telemetry.atmosphereReady,
      coordinateMode: telemetry.coordinateMode,
      control: telemetry.control,
      diagnostic: telemetry.diagnostic,
      diagnosticApplied: telemetry.diagnosticApplied,
      diagnosticState: telemetry.diagnosticState,
      native: telemetry.native,
      nativeFrameCount: Math.min(
        telemetry.nativeFrameCount,
        TEMPORAL_CONVERGENCE_FRAME_COUNT
      ),
      temporalConverged: telemetry.temporalConverged,
      transformFallback: telemetry.transformFallback
    });
    if (publishedTelemetryRef.current !== signature) {
      publishedTelemetryRef.current = signature;
      if (typeof window !== "undefined") {
        window.__MiraLithTakramParity = telemetry;
      }
      onTelemetryRef.current?.(telemetry);
    }
  }, -1);

  const stockAssets = input === "stock" ? assetsState.assets : null;
  const atmosphereTextures = atmosphereState.ready ? atmosphereState.textures : null;

  return (
    <>
      <color attach="background" args={["#02070d"]} />
      <group ref={earthGroupRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[view === "control" ? CONTROL_SCENE_RADIUS_M : 1, 192, 128]} />
          <meshBasicMaterial
            color="#ffffff"
            map={earthTexture}
          />
        </mesh>
      </group>
      {bridgeReady && stockAssets !== null && atmosphereTextures !== null ? (
        <Atmosphere
          ref={atmosphereRef}
          correctAltitude={false}
          ellipsoid={TAKRAM_PARITY_ELLIPSOID}
          ground
          textures={atmosphereTextures}
        >
          <EffectComposer enableNormalPass>
            <Clouds
              ref={cloudsRef}
              {...(view === "control" ? { coverage: TAKRAM_PARITY_CONTROL.coverage } : {})}
              localWeatherTexture={stockAssets.localWeather}
              qualityPreset={TAKRAM_PARITY_DEFAULTS.qualityPreset}
              shapeDetailTexture={stockAssets.shapeDetail}
              shapeTexture={stockAssets.shape}
              stbnTexture={stockAssets.stbn}
              turbulenceTexture={stockAssets.turbulence}
            />
            <AerialPerspective
              ref={aerialPerspectiveRef}
              sky
              skyLight
              stbnTexture={stockAssets.stbn}
              sunLight
            />
          </EffectComposer>
        </Atmosphere>
      ) : null}
    </>
  );
}
