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
import { CloudLayer as TakramCloudLayer, Clouds } from "@takram/three-clouds/r3f";
import type { CloudsEffect } from "@takram/three-clouds";
import type { ExpandNestedProps } from "@takram/three-geospatial/r3f";
import { useCallback, useEffect, useRef, useState } from "react";
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
  TAKRAM_PARITY_STOCK_ASSETS,
  buildTakramParityRendererFingerprint,
  hashTakramParityRendererFingerprint,
  type TakramParityDiagnostic,
  type TakramParityInput,
  type TakramParityTelemetry,
  type TakramParityView
} from "./TakramParityContract";
import {
  useTakramParityRuntimeAssets,
  type TakramParityRuntimeAssets
} from "./TakramParityAssetLoader";
import { useTakramParityAtmospherePrecompute } from "./TakramParityAtmospherePrecompute";
import { resolveTakramParityAdapter } from "./TakramParityV3Adapter";
import { TAKRAM_PARITY_V3_LAYERS } from "./TakramParityV3Layers";

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
    haze: clouds?.haze === true,
    lightShafts: clouds?.lightShafts === true,
    qualityPreset: TAKRAM_PARITY_DEFAULTS.qualityPreset,
    resolutionScale: clouds?.resolutionScale ?? 0,
    shapeDetail: clouds?.shapeDetail === true,
    temporalUpscale: clouds?.temporalUpscale === true,
    turbulence: clouds?.turbulence === true
  };
}

function resolveAdapterTelemetry(
  clouds: CloudsEffect | null,
  assets: TakramParityRuntimeAssets | null,
  input: TakramParityInput
): TakramParityTelemetry["adapter"] {
  const adapter = resolveTakramParityAdapter(input);
  return {
    cloudLayers: clouds === null
      ? []
      : Array.from(clouds.cloudLayers, (layer) => ({
        altitude: layer.altitude,
        channel: layer.channel,
        coverageFilterWidth: layer.coverageFilterWidth,
        densityScale: layer.densityScale,
        height: layer.height,
        shadow: layer.shadow,
        shapeAmount: layer.shapeAmount,
        shapeDetailAmount: layer.shapeDetailAmount,
        weatherExponent: layer.weatherExponent
      })),
    disableDefaultLayers: adapter.disableDefaultLayers,
    globalWeatherMapping: clouds?.globalWeatherMapping ?? adapter.globalWeatherMapping,
    localWeatherHash: assets?.localWeatherSha256 ?? null,
    localWeatherOffset: clouds === null
      ? null
      : [clouds.localWeatherOffset.x, clouds.localWeatherOffset.y],
    localWeatherRepeat: clouds === null
      ? null
      : [clouds.localWeatherRepeat.x, clouds.localWeatherRepeat.y],
    localWeatherSource: assets?.localWeatherSource ?? null
  };
}

const TAKRAM_PARITY_SHARED_ASSET_HASHES = Object.freeze({
  shape: TAKRAM_PARITY_STOCK_ASSETS.find((asset) => asset.id === "shape")!.sha256,
  shapeDetail: TAKRAM_PARITY_STOCK_ASSETS.find((asset) => asset.id === "shapeDetail")!.sha256,
  stbn: TAKRAM_PARITY_STOCK_ASSETS.find((asset) => asset.id === "stbn")!.sha256,
  turbulence: TAKRAM_PARITY_STOCK_ASSETS.find((asset) => asset.id === "turbulence")!.sha256
});

function resolveDiagnosticState(diagnostic: TakramParityDiagnostic) {
  return {
    aerialPerspectiveComposite: !["cloud-raw", "density-debug", "uv-debug", "sample-count-debug"].includes(diagnostic),
    beerShadowOcclusion: diagnostic !== "bsm-off",
    cloudRawOutput: ["cloud-raw", "density-debug", "uv-debug", "sample-count-debug"].includes(diagnostic),
    densityDebug: diagnostic === "density-debug",
    uvDebug: diagnostic === "uv-debug",
    sceneDepthClamp: diagnostic !== "depth-off",
    sampleCountDebug: diagnostic === "sample-count-debug",
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
  const adapter = resolveTakramParityAdapter(input);
  const assetsState = useTakramParityRuntimeAssets(gl.domElement, input);
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
  const setCloudsRef = useCallback((clouds: TakramCloudsRef | null) => {
    cloudsRef.current = clouds;
    if (clouds === null) {
      return;
    }
    clouds.localWeatherRepeat.set(...adapter.localWeatherRepeat);
    clouds.localWeatherOffset.set(...adapter.localWeatherOffset);
    clouds.localWeatherVelocity.set(0, 0);
  }, [adapter]);

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
    const cloudRawDiagnostic = ["cloud-raw", "density-debug", "uv-debug", "sample-count-debug"].includes(diagnostic);
    clouds.skipRendering = !cloudRawDiagnostic;
    aerialPerspective.blendMode.blendFunction = cloudRawDiagnostic
      ? BlendFunction.SKIP
      : BlendFunction.NORMAL;
    if (diagnostic === "sample-count-debug") {
      clouds.cloudsPass.currentMaterial.defines.DEBUG_SHOW_SAMPLE_COUNT = "1";
      clouds.cloudsPass.currentMaterial.needsUpdate = true;
    }
    if (diagnostic === "uv-debug") {
      clouds.cloudsPass.currentMaterial.defines.DEBUG_SHOW_UV = "1";
      clouds.cloudsPass.currentMaterial.needsUpdate = true;
    }
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
      if (diagnostic === "sample-count-debug") {
        delete clouds.cloudsPass.currentMaterial.defines.DEBUG_SHOW_SAMPLE_COUNT;
        clouds.cloudsPass.currentMaterial.needsUpdate = true;
      }
      if (diagnostic === "uv-debug") {
        delete clouds.cloudsPass.currentMaterial.defines.DEBUG_SHOW_UV;
        clouds.cloudsPass.currentMaterial.needsUpdate = true;
      }
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
    const sceneDepthScaleContract = coordinateMode === "upstream-ecef"
      ? 1
      : bridge?.valid && bridge.worldToEcefDistanceScale !== null
        ? bridge.worldToEcefDistanceScale
        : 1;
    const sceneDepthScale = diagnostic === "depth-off" ? 0 : sceneDepthScaleContract;
    if (clouds) {
      // Takram reconstructs scene depth from the native world-space depth
      // buffer, while its cloud ray is parameterized in ECEF metres. Keep the
      // contract explicit for both the identity control and the LuBirth bridge
      // instead of allowing a non-unit matrix scale to silently clip clouds.
      clouds.cloudsPass.currentMaterial.uniforms.sceneDepthScale.value = sceneDepthScale;
    }
    const nativePipelineReady = assetsState.ready && atmosphereState.ready &&
      bridgeReadyRef.current && clouds !== null && aerialPerspective !== null &&
      appliedDiagnosticRef.current === diagnostic;
    const nativeFrameEpoch = [
      assetsState.assetGeneration,
      atmosphereState.atmosphereGeneration,
      coordinateMode,
      diagnostic,
      input,
      assetsState.assets?.localWeatherSha256 ?? "pending"
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
    const rendererFingerprint = clouds && aerialPerspective
      ? buildTakramParityRendererFingerprint({
        clouds,
        aerialPerspective,
        sharedAssets: TAKRAM_PARITY_SHARED_ASSET_HASHES
      })
      : null;
    const telemetry: TakramParityTelemetry = {
      active: nativePipelineReady &&
        (diagnostic === "history-reset-first" || temporalConverged),
      adapter: resolveAdapterTelemetry(clouds, assetsState.assets, input),
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
      rendererFingerprint,
      rendererFingerprintHash: rendererFingerprint
        ? hashTakramParityRendererFingerprint(rendererFingerprint)
        : null,
      sceneDepthScale,
      sceneDepthContract: "world-depth-to-ecef-v1",
      stockCoverage: view === "control" ? TAKRAM_PARITY_CONTROL.coverage : null,
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
      adapter: telemetry.adapter,
      native: telemetry.native,
      rendererFingerprintHash: telemetry.rendererFingerprintHash,
      sceneDepthScale: telemetry.sceneDepthScale,
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

  const runtimeAssets = assetsState.assets;
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
      {bridgeReady && runtimeAssets !== null && atmosphereTextures !== null ? (
        <Atmosphere
          ref={atmosphereRef}
          correctAltitude={false}
          ellipsoid={TAKRAM_PARITY_ELLIPSOID}
          ground
          textures={atmosphereTextures}
        >
          <EffectComposer enableNormalPass>
            <Clouds
              ref={setCloudsRef}
              {...(view === "control" ? { coverage: TAKRAM_PARITY_CONTROL.coverage } : {})}
              disableDefaultLayers={adapter.disableDefaultLayers}
              globalWeatherMapping={input === "v3"}
              localWeatherTexture={runtimeAssets.localWeather}
              qualityPreset={TAKRAM_PARITY_DEFAULTS.qualityPreset}
              shapeDetailTexture={runtimeAssets.shapeDetail}
              shapeTexture={runtimeAssets.shape}
              stbnTexture={runtimeAssets.stbn}
              turbulenceTexture={runtimeAssets.turbulence}
            >
              {input === "v3" ? TAKRAM_PARITY_V3_LAYERS.map((layer, index) => (
                <TakramCloudLayer
                  key={layer.channel}
                  index={index}
                  {...layer}
                />
              )) : null}
            </Clouds>
            <AerialPerspective
              ref={aerialPerspectiveRef}
              sky
              skyLight
              stbnTexture={runtimeAssets.stbn}
              sunLight
            />
          </EffectComposer>
        </Atmosphere>
      ) : null}
    </>
  );
}
