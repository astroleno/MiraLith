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
  Camera,
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
  TAKRAM_PARITY_V3_LADDER_SPHERICAL_UV,
  TAKRAM_PARITY_V3_OPENING_PRESET,
  buildTakramParityRendererFingerprint,
  hashTakramParityRendererFingerprint,
  isTakramParityAltitudeLadderDiagnostic,
  type TakramParityDiagnostic,
  type TakramParityInput,
  type TakramParityAltitudeLadderTelemetry,
  type TakramParityTelemetry,
  type TakramParityView
} from "./TakramParityContract";
import {
  resolveTakramV3MorphologyCandidate,
  resolveTakramV3MorphologyView,
  type TakramV3MorphologyCandidateId,
  type TakramV3MorphologyViewId
} from "./TakramV3MorphologyContract";
import { auditMorphologyScale } from "./TakramV3MorphologyScaleAudit";
import {
  installTakramAltitudeLadderInstrumentation,
  setTakramAltitudeLadderShaderMode,
  TAKRAM_ALTITUDE_LADDER_SHADER_MODES,
  type TakramAltitudeLadderMaterial
} from "./TakramAltitudeLadderInstrumentation";
import {
  readTakramAltitudeLadderDefaultFramebuffer,
  readTakramAltitudeLadderRenderTarget,
  resolveTakramAltitudeLadderShellInterval,
  summarizeTakramAltitudeLadderDensity,
  summarizeTakramAltitudeLadderFrameDifference,
  summarizeTakramAltitudeLadderRadiance,
  type TakramAltitudeLadderReadback
} from "./TakramAltitudeLadderReadback";
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
const OFFICIAL_SHAPE_REPEAT = 0.0003;
const OFFICIAL_SHAPE_DETAIL_REPEAT = 0.006;

const scratchCameraPosition = new Vector3();
const scratchCameraTarget = new Vector3();
const scratchLadderTarget = new Vector3();
const scratchControlDirection = new Vector3();
const scratchEarthEuler = new Euler();
const scratchEarthMatrix = new Matrix4();
const scratchEarthQuaternion = new Quaternion();
const scratchSunDirectionEcef = new Vector3();
const scratchSunDirectionWorld = new Vector3();
const scratchCameraEcef = new Vector3();
const scratchLadderRadial = new Vector3();
const scratchMorphologyRadial = new Vector3();
const scratchMorphologyEast = new Vector3();
const scratchMorphologyNorth = new Vector3();
const scratchMorphologyTarget = new Vector3();
const scratchViewProjection = new Matrix4();
const scratchEcefToWorld = new Matrix4();

type TakramCloudsRef = CloudsEffect &
  ExpandNestedProps<CloudsEffect, "clouds"> &
  ExpandNestedProps<CloudsEffect, "shadow">;

type TakramAltitudeLadderCapture = {
  phase: "normal" | "cloud-off" | "radiance" | "density" | "weather" | "complete";
  cloudOnFinalReadback: TakramAltitudeLadderReadback | null;
  telemetry: TakramParityAltitudeLadderTelemetry;
};

function createEmptyAltitudeLadderTelemetry(
  requestedAltitudeMeters: number
): TakramParityAltitudeLadderTelemetry {
  return {
    completed: false,
    cameraHeightMeters: null,
    requestedAltitudeMeters,
    sphericalUv: TAKRAM_PARITY_V3_LADDER_SPHERICAL_UV,
    centerRayShellIntervalMeters: null,
    shellIntervalLengthMeters: null,
    validPrimarySampleCount: null,
    maxDensity: null,
    averageDensity: null,
    weatherMaxDensity: null,
    weatherAverageDensity: null,
    accumulatedOpticalDepth: null,
    peakAccumulatedOpticalDepth: null,
    centerAccumulatedOpticalDepth: null,
    transmittance: null,
    minimumTransmittance: null,
    centerTransmittance: null,
    preTemporalInScatteredRadiance: null,
    preTemporalInScatteredRadiancePeak: null,
    preTemporalInScatteredRadianceCenter: null,
    postTemporalInScatteredRadiance: null,
    postTemporalInScatteredRadiancePeak: null,
    postTemporalInScatteredRadianceCenter: null,
    aerialPerspectiveResult: null,
    aerialPerspectiveResultPeak: null,
    aerialPerspectiveResultCenter: null,
    finalCloudSignal: null,
    finalCloudSignalPeak: null,
    finalCloudSignalCenter: null,
    readback: null
  };
}

declare global {
  interface Window {
    __MiraLithTakramParity?: TakramParityTelemetry;
  }
}

export interface TakramStockParityPipelineProps {
  altitudeMeters?: number;
  diagnostic?: TakramParityDiagnostic;
  input: TakramParityInput;
  morphologyCandidate?: TakramV3MorphologyCandidateId;
  morphologyView?: TakramV3MorphologyViewId;
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
  progress: number,
  ladderAltitudeMeters?: number
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

  if (ladderAltitudeMeters !== undefined) {
    earthGroup.updateMatrixWorld(true);
    const bridge = buildLuBirthWorldToEcef(earthGroup.matrixWorld, 1);
    if (bridge.valid && bridge.worldToEcef && Number.isFinite(ladderAltitudeMeters)) {
      const worldToEcef = bridge.worldToEcef;
      const ecefToWorld = worldToEcef.clone().invert();
      const [sphericalU, sphericalV] = TAKRAM_PARITY_V3_LADDER_SPHERICAL_UV;
      const phi = (sphericalU - 0.5) * Math.PI * 2;
      const theta = (sphericalV - 0.5) * Math.PI;
      const radial = scratchLadderRadial.set(
        Math.cos(theta) * Math.cos(phi),
        Math.cos(theta) * Math.sin(phi),
        Math.sin(theta)
      );
      // Aim every rung at the same near-side radial cloud column. At 2.5 km
      // this points outward into the cloud base; above the shell it points
      // inward through that same geographic column. Looking at the Earth
      // centre would make the low-altitude rung terminate in opaque ground
      // before it ever produces a cloud signal.
      const targetWorld = scratchLadderTarget
        .copy(radial)
        .multiplyScalar(TAKRAM_PARITY_BOTTOM_RADIUS_M + 20_000)
        .applyMatrix4(ecefToWorld);
      scratchCameraPosition
        .copy(radial)
        .multiplyScalar(TAKRAM_PARITY_BOTTOM_RADIUS_M + ladderAltitudeMeters)
        .applyMatrix4(ecefToWorld);
      camera.position.copy(scratchCameraPosition);
      camera.lookAt(targetWorld);
      camera.updateMatrixWorld(true);
    }
  }

  scratchSunDirectionWorld.set(...DEFAULT_LUBIRTH_SUN_DIRECTION)
    .applyQuaternion(scratchEarthQuaternion)
    .normalize();
}

function updateMorphologyNearFrame(
  earthGroup: Group,
  camera: PerspectiveCamera,
  morphologyView: TakramV3MorphologyViewId
) {
  const reviewView = resolveTakramV3MorphologyView(morphologyView);
  if (!reviewView || reviewView.usesOpeningFrame) {
    return false;
  }

  // The near/aerial review cameras use the same normalized LuBirth bridge as
  // the opening path, but place the camera in a local tangent frame around the
  // fixed V3 geography. No production camera or scene transform is touched.
  earthGroup.position.set(0, 0, 0);
  earthGroup.quaternion.identity();
  earthGroup.scale.setScalar(1);

  const [sphericalU, sphericalV] = reviewView.sphericalUv;
  const phi = (sphericalU - 0.5) * Math.PI * 2;
  const theta = (sphericalV - 0.5) * Math.PI;
  scratchMorphologyRadial.set(
    Math.cos(theta) * Math.cos(phi),
    Math.cos(theta) * Math.sin(phi),
    Math.sin(theta)
  ).normalize();
  scratchMorphologyEast.set(-Math.sin(phi), Math.cos(phi), 0).normalize();

  const radius = TAKRAM_PARITY_BOTTOM_RADIUS_M;
  scratchCameraPosition
    .copy(scratchMorphologyRadial)
    .multiplyScalar(1 + reviewView.cameraAltitudeMeters / radius);
  scratchMorphologyTarget
    .copy(scratchMorphologyRadial)
    .multiplyScalar(1 + reviewView.targetAltitudeMeters / radius)
    .addScaledVector(scratchMorphologyEast, reviewView.targetDistanceMeters / radius);

  camera.fov = 45;
  camera.near = 0.00001;
  camera.far = 20;
  camera.up.copy(scratchMorphologyRadial);
  camera.position.copy(scratchCameraPosition);
  camera.lookAt(scratchMorphologyTarget);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  scratchSunDirectionWorld.set(...DEFAULT_LUBIRTH_SUN_DIRECTION).normalize();
  return true;
}

function resolveMorphologyScaleAudit(
  camera: PerspectiveCamera,
  bridge: ReturnType<typeof buildLuBirthWorldToEcef> | null,
  clouds: TakramCloudsRef | null,
  morphologyView: TakramV3MorphologyViewId,
  viewport: { width: number; height: number }
) {
  const reviewView = resolveTakramV3MorphologyView(morphologyView);
  if (!reviewView || !bridge || !bridge.valid || !bridge.worldToEcef || !clouds) {
    return null;
  }
  const [sphericalU, sphericalV] = reviewView.sphericalUv;
  const phi = (sphericalU - 0.5) * Math.PI * 2;
  const theta = (sphericalV - 0.5) * Math.PI;
  const radial = scratchMorphologyRadial.set(
    Math.cos(theta) * Math.cos(phi),
    Math.cos(theta) * Math.sin(phi),
    Math.sin(theta)
  ).normalize();
  const east = scratchMorphologyEast.set(-Math.sin(phi), Math.cos(phi), 0).normalize();
  const north = scratchMorphologyNorth.crossVectors(radial, east).normalize();
  const origin = radial.clone().multiplyScalar(
    TAKRAM_PARITY_BOTTOM_RADIUS_M + reviewView.targetAltitudeMeters
  );
  scratchViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  scratchEcefToWorld.copy(bridge.worldToEcef).invert();
  return auditMorphologyScale({
    viewProjectionMatrix: scratchViewProjection.toArray(),
    ecefToWorldMatrix: scratchEcefToWorld.toArray(),
    originEcefMeters: [origin.x, origin.y, origin.z],
    eastEcef: [east.x, east.y, east.z],
    northEcef: [north.x, north.y, north.z],
    upEcef: [radial.x, radial.y, radial.z],
    viewport,
    shapeRepeat: clouds.shapeRepeat.x,
    shapeDetailRepeat: clouds.shapeDetailRepeat.x,
    layers: TAKRAM_PARITY_V3_LAYERS.map((layer) => ({
      channel: layer.channel,
      altitude: layer.altitude,
      height: layer.height
    }))
  });
}

function resolveCameraHeightMeters(
  camera: Camera,
  worldToEcef: Matrix4 | null | undefined
) {
  if (!worldToEcef) return null;
  const cameraEcef = scratchCameraEcef
    .setFromMatrixPosition(camera.matrixWorld)
    .applyMatrix4(worldToEcef);
  const height = cameraEcef.length() - TAKRAM_PARITY_BOTTOM_RADIUS_M;
  return Number.isFinite(height) ? height : null;
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
    altitudeLadder: isTakramParityAltitudeLadderDiagnostic(diagnostic),
    cloudOff: diagnostic === "altitude-ladder-cloud-off",
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
  altitudeMeters,
  diagnostic = "full",
  input,
  morphologyCandidate,
  morphologyView,
  onTelemetry,
  progress,
  view
}: TakramStockParityPipelineProps) {
  const { gl, camera } = useThree();
  const earthTexture = useLoader(TextureLoader, EARTH_DAY_SRC);
  const adapter = resolveTakramParityAdapter(input);
  const resolvedMorphologyCandidate = input === "v3" && morphologyView
    ? resolveTakramV3MorphologyCandidate(morphologyCandidate ?? "baseline")
    : null;
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
  const ladderCaptureRef = useRef<TakramAltitudeLadderCapture>({
    phase: "normal",
    cloudOnFinalReadback: null,
    telemetry: createEmptyAltitudeLadderTelemetry(altitudeMeters ?? 2_500)
  });
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
    const useV3OpeningPreset = input === "v3" && view === "opening";
    const shapeRepeat = resolvedMorphologyCandidate?.shapeRepeat ??
      TAKRAM_PARITY_V3_OPENING_PRESET.shapeRepeat;
    const shapeDetailRepeat = resolvedMorphologyCandidate?.shapeDetailRepeat ??
      TAKRAM_PARITY_V3_OPENING_PRESET.shapeDetailRepeat;
    clouds.shapeRepeat.setScalar(
      useV3OpeningPreset && input === "v3"
        ? shapeRepeat
        : OFFICIAL_SHAPE_REPEAT
    );
    clouds.shapeDetailRepeat.setScalar(
      useV3OpeningPreset && input === "v3"
        ? shapeDetailRepeat
        : OFFICIAL_SHAPE_DETAIL_REPEAT
    );
    if (isTakramParityAltitudeLadderDiagnostic(diagnostic)) {
      installTakramAltitudeLadderInstrumentation(
        clouds.cloudsPass.currentMaterial as unknown as TakramAltitudeLadderMaterial
      );
      setTakramAltitudeLadderShaderMode(
        clouds.cloudsPass.currentMaterial as unknown as TakramAltitudeLadderMaterial,
        TAKRAM_ALTITUDE_LADDER_SHADER_MODES.normal
      );
    }
  }, [adapter, altitudeMeters, diagnostic, input, morphologyCandidate, morphologyView, resolvedMorphologyCandidate, view]);

  useEffect(() => {
    ladderCaptureRef.current = {
      phase: "normal",
      cloudOnFinalReadback: null,
      telemetry: createEmptyAltitudeLadderTelemetry(altitudeMeters ?? 2_500)
    };
  }, [altitudeMeters, diagnostic]);

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
    // The native Clouds pass must remain enabled for the normal full frame and
    // every cloud-side diagnostic. `aerial-final` and the explicit
    // altitude-ladder cloud-off probe are the only intentional cloud-disabled
    // modes; the previous inverse assignment silently skipped the renderer
    // for every full opening frame.
    clouds.skipRendering = diagnostic === "aerial-final" ||
      diagnostic === "altitude-ladder-cloud-off";
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
      if (isTakramParityAltitudeLadderDiagnostic(diagnostic)) {
        try {
          setTakramAltitudeLadderShaderMode(
            clouds.cloudsPass.currentMaterial as unknown as TakramAltitudeLadderMaterial,
            TAKRAM_ALTITUDE_LADDER_SHADER_MODES.normal
          );
        } catch {
          // The material may already have been disposed during route unmount.
        }
      }
      clouds.cloudLayers.forEach((layer, index) => {
        layer.shadow = shadowLayerFlags[index] ?? false;
      });
      clouds.skipRendering = false;
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

  // `skipRendering` only disables the CloudsEffect composite; the native
  // cloud buffer is still exposed to AerialPerspective through the atmosphere
  // transient overlay. Keep the explicit cloud-off diagnostic honest by
  // clearing both owners immediately before the composer renders.
  useFrame(() => {
    if (diagnostic !== "altitude-ladder-cloud-off" && diagnostic !== "aerial-final") {
      return;
    }
    const clouds = cloudsRef.current;
    const aerialPerspective = aerialPerspectiveRef.current;
    if (clouds) clouds.skipRendering = true;
    if (aerialPerspective) aerialPerspective.overlay = null;
  }, 1);

  // Camera and planet transforms must settle before the -1 native bridge
  // update, so Clouds observes the matching world/ECEF state in its own frame.
  useFrame(() => {
    const earthGroup = earthGroupRef.current;
    if (!earthGroup || !(camera instanceof PerspectiveCamera)) {
      return;
    }

    if (view === "control") {
      updateControlFrame(earthGroup, camera);
    } else if (morphologyView && updateMorphologyNearFrame(earthGroup, camera, morphologyView)) {
      // Query-only morphology cameras intentionally bypass the opening
      // progress transform. `opening-orbit` returns false above and therefore
      // continues through the exact opening mirror below.
    } else {
      updateOpeningFrame(earthGroup, camera, progress, isTakramParityAltitudeLadderDiagnostic(diagnostic)
        ? altitudeMeters
        : undefined);
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
    const cameraHeightMetersValue = clouds
      ? Number((clouds.cloudsPass.currentMaterial.uniforms as Record<string, { value?: unknown }>).cameraHeight?.value)
      : Number.NaN;
    const cameraHeightMeters = resolveCameraHeightMeters(camera, bridge?.worldToEcef) ??
      (Number.isFinite(cameraHeightMetersValue) ? cameraHeightMetersValue : null);
    const rendererFingerprint = clouds && aerialPerspective
      ? buildTakramParityRendererFingerprint({
        clouds,
        aerialPerspective,
        sharedAssets: TAKRAM_PARITY_SHARED_ASSET_HASHES
      })
      : null;
    const morphologyScaleAudit = morphologyView
      ? resolveMorphologyScaleAudit(
        camera,
        bridge,
        clouds,
        morphologyView,
        { width: gl.domElement.width, height: gl.domElement.height }
      )
      : null;
    const telemetry: TakramParityTelemetry = {
      active: nativePipelineReady &&
        (diagnostic === "history-reset-first" ||
          (temporalConverged && (!isTakramParityAltitudeLadderDiagnostic(diagnostic) ||
            ladderCaptureRef.current.phase === "complete"))),
      adapter: resolveAdapterTelemetry(clouds, assetsState.assets, input),
      assetGeneration: assetsState.assetGeneration,
      assetsReady: assetsState.ready,
      atmosphereGeneration: atmosphereState.atmosphereGeneration,
      atmosphereReady: atmosphereState.ready,
      cameraHeightMeters,
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
      presentationPreset: input === "v3" && view === "opening"
        ? "v3-opening-coarse"
        : "official-stock",
      coverage: clouds?.coverage ?? null,
      sceneDepthScale,
      sceneDepthContract: "world-depth-to-ecef-v1",
      shapeRepeat: clouds?.shapeRepeat?.x ?? null,
      shapeDetailRepeat: clouds?.shapeDetailRepeat?.x ?? null,
      temporalConverged,
      transformFallback,
      view,
      morphologyCandidate: resolvedMorphologyCandidate?.id ?? null,
      morphologyView: morphologyView ?? null,
      morphologyScaleAudit,
      altitudeLadder: isTakramParityAltitudeLadderDiagnostic(diagnostic)
        ? ladderCaptureRef.current.telemetry
        : null
    };
    const signature = JSON.stringify({
      active: telemetry.active,
      assetGeneration: telemetry.assetGeneration,
      assetsReady: telemetry.assetsReady,
      atmosphereGeneration: telemetry.atmosphereGeneration,
      atmosphereReady: telemetry.atmosphereReady,
      cameraHeightMeters: telemetry.cameraHeightMeters,
      coordinateMode: telemetry.coordinateMode,
      control: telemetry.control,
      diagnostic: telemetry.diagnostic,
      diagnosticApplied: telemetry.diagnosticApplied,
      diagnosticState: telemetry.diagnosticState,
      adapter: telemetry.adapter,
      native: telemetry.native,
      rendererFingerprintHash: telemetry.rendererFingerprintHash,
      presentationPreset: telemetry.presentationPreset,
      coverage: telemetry.coverage,
      sceneDepthScale: telemetry.sceneDepthScale,
      shapeRepeat: telemetry.shapeRepeat,
      shapeDetailRepeat: telemetry.shapeDetailRepeat,
      altitudeLadder: telemetry.altitudeLadder,
      nativeFrameCount: Math.min(
        telemetry.nativeFrameCount,
        TEMPORAL_CONVERGENCE_FRAME_COUNT
      ),
      temporalConverged: telemetry.temporalConverged,
      transformFallback: telemetry.transformFallback,
      morphologyCandidate: telemetry.morphologyCandidate,
      morphologyView: telemetry.morphologyView,
      morphologyScaleAudit: telemetry.morphologyScaleAudit
    });
    if (publishedTelemetryRef.current !== signature) {
      publishedTelemetryRef.current = signature;
      if (typeof window !== "undefined") {
        window.__MiraLithTakramParity = telemetry;
      }
      onTelemetryRef.current?.(telemetry);
    }
  }, -1);

  // Read the native cloud targets only for the altitude ladder. The first
  // converged frame preserves the normal renderer outputs; following frames
  // switch the same native pass to capture-only raw-radiance, density and
  // weather encodings.
  // No production frame consumes these values.
  useFrame(() => {
    if (!isTakramParityAltitudeLadderDiagnostic(diagnostic) ||
      ladderCaptureRef.current.phase === "complete" ||
      nativeFrameCountRef.current < TEMPORAL_CONVERGENCE_FRAME_COUNT) {
      return;
    }

    const clouds = cloudsRef.current;
    if (!clouds) return;

    const material = clouds.cloudsPass.currentMaterial as unknown as TakramAltitudeLadderMaterial;
    const pass = clouds.cloudsPass as unknown as {
      currentRenderTarget?: Parameters<typeof readTakramAltitudeLadderRenderTarget>[1];
      historyRenderTarget?: Parameters<typeof readTakramAltitudeLadderRenderTarget>[1];
    };

    if (ladderCaptureRef.current.phase === "normal") {
      const preTemporalTarget = pass.currentRenderTarget
        ? readTakramAltitudeLadderRenderTarget(gl, pass.currentRenderTarget)
        : null;
      const postTemporalTarget = pass.historyRenderTarget
        ? readTakramAltitudeLadderRenderTarget(gl, pass.historyRenderTarget)
        : null;
      const aerialTarget = readTakramAltitudeLadderDefaultFramebuffer(gl);
      const postTemporal = postTemporalTarget
        ? summarizeTakramAltitudeLadderRadiance(postTemporalTarget)
        : null;
      const aerial = aerialTarget
        ? summarizeTakramAltitudeLadderRadiance(aerialTarget)
        : null;
      const uniforms = clouds.cloudsPass.currentMaterial.uniforms as Record<string, { value?: unknown }>;
      const minHeight = Number(uniforms.minHeight?.value ?? 0);
      const maxHeight = Number(uniforms.maxHeight?.value ?? 0);
      const cameraHeight = resolveCameraHeightMeters(
        camera,
        buildLuBirthWorldToEcef(scratchEarthMatrix, 1).worldToEcef
      ) ?? Number(uniforms.cameraHeight?.value ?? Number.NaN);
      const centerRayShellIntervalMeters = bridgeReadyRef.current
        ? resolveTakramAltitudeLadderShellInterval(
          camera,
          buildLuBirthWorldToEcef(scratchEarthMatrix, 1).worldToEcef,
          minHeight,
          maxHeight
        )
        : null;
      ladderCaptureRef.current = {
        phase: "cloud-off",
        cloudOnFinalReadback: aerialTarget,
        telemetry: {
          ...ladderCaptureRef.current.telemetry,
          cameraHeightMeters: Number.isFinite(cameraHeight) ? cameraHeight : null,
          centerRayShellIntervalMeters,
          postTemporalInScatteredRadiance: postTemporal?.averageLuma ?? null,
          postTemporalInScatteredRadiancePeak: postTemporal?.peakLuma ?? null,
          postTemporalInScatteredRadianceCenter: postTemporal?.centerLuma ?? null,
          aerialPerspectiveResult: aerial?.averageLuma ?? null,
          aerialPerspectiveResultPeak: aerial?.peakLuma ?? null,
          aerialPerspectiveResultCenter: aerial?.centerLuma ?? null,
          readback: {
            cloudTargetWidth: preTemporalTarget?.width ?? postTemporalTarget?.width ?? 0,
            cloudTargetHeight: preTemporalTarget?.height ?? postTemporalTarget?.height ?? 0,
            precision: preTemporalTarget?.precision ?? postTemporalTarget?.precision ?? "unorm8",
            source: "gpu-readback-v1"
          }
        }
      };
      // Capture a same-frame baseline on the next render. Disabling both the
      // native Clouds composite and AerialPerspective overlay is important:
      // the latter otherwise re-applies the cloud output even when the former
      // is skipped.
      clouds.skipRendering = true;
      if (aerialPerspectiveRef.current) {
        aerialPerspectiveRef.current.overlay = null;
      }
      return;
    }

    if (ladderCaptureRef.current.phase === "cloud-off") {
      const cloudOffFinalReadback = readTakramAltitudeLadderDefaultFramebuffer(gl);
      const finalDifference = ladderCaptureRef.current.cloudOnFinalReadback &&
        cloudOffFinalReadback
        ? summarizeTakramAltitudeLadderFrameDifference(
          ladderCaptureRef.current.cloudOnFinalReadback,
          cloudOffFinalReadback
        )
        : null;
      clouds.skipRendering = false;
      if (aerialPerspectiveRef.current) {
        aerialPerspectiveRef.current.overlay = clouds.atmosphereOverlay;
      }
      ladderCaptureRef.current = {
        phase: "radiance",
        cloudOnFinalReadback: null,
        telemetry: {
          ...ladderCaptureRef.current.telemetry,
          finalCloudSignal: finalDifference?.averageLuma ?? null,
          finalCloudSignalPeak: finalDifference?.peakLuma ?? null,
          finalCloudSignalCenter: finalDifference?.centerLuma ?? null
        }
      };
      setTakramAltitudeLadderShaderMode(
        material,
        TAKRAM_ALTITUDE_LADDER_SHADER_MODES.radiance
      );
      return;
    }

    if (ladderCaptureRef.current.phase === "radiance") {
      const radianceTarget = pass.currentRenderTarget
        ? readTakramAltitudeLadderRenderTarget(gl, pass.currentRenderTarget)
        : null;
      const radiance = radianceTarget
        ? summarizeTakramAltitudeLadderRadiance(radianceTarget)
        : null;
      ladderCaptureRef.current = {
        phase: "density",
        cloudOnFinalReadback: null,
        telemetry: {
          ...ladderCaptureRef.current.telemetry,
          accumulatedOpticalDepth: radiance?.accumulatedOpticalDepth ?? null,
          peakAccumulatedOpticalDepth: radiance?.peakAccumulatedOpticalDepth ?? null,
          centerAccumulatedOpticalDepth: radiance?.centerAccumulatedOpticalDepth ?? null,
          transmittance: radiance?.averageTransmittance ?? null,
          minimumTransmittance: radiance?.minimumTransmittance ?? null,
          centerTransmittance: radiance?.centerTransmittance ?? null,
          preTemporalInScatteredRadiance: radiance?.averageLuma ?? null,
          preTemporalInScatteredRadiancePeak: radiance?.peakLuma ?? null,
          preTemporalInScatteredRadianceCenter: radiance?.centerLuma ?? null,
          readback: {
            cloudTargetWidth: radianceTarget?.width ?? ladderCaptureRef.current.telemetry.readback?.cloudTargetWidth ?? 0,
            cloudTargetHeight: radianceTarget?.height ?? ladderCaptureRef.current.telemetry.readback?.cloudTargetHeight ?? 0,
            precision: radianceTarget?.precision ?? ladderCaptureRef.current.telemetry.readback?.precision ?? "unorm8",
            source: "gpu-readback-v1"
          }
        }
      };
      setTakramAltitudeLadderShaderMode(
        material,
        TAKRAM_ALTITUDE_LADDER_SHADER_MODES.density
      );
      return;
    }

    if (ladderCaptureRef.current.phase === "density") {
      const densityTarget = pass.currentRenderTarget
        ? readTakramAltitudeLadderRenderTarget(gl, pass.currentRenderTarget)
        : null;
      const density = densityTarget
        ? summarizeTakramAltitudeLadderDensity(densityTarget)
        : null;
      ladderCaptureRef.current = {
        phase: "weather",
        cloudOnFinalReadback: null,
        telemetry: {
          ...ladderCaptureRef.current.telemetry,
          shellIntervalLengthMeters: density?.shellIntervalLengthMeters ?? null,
          validPrimarySampleCount: density?.validPrimarySampleCount ?? null,
          maxDensity: density?.maxDensity ?? null,
          averageDensity: density?.averageDensity ?? null,
          readback: {
            cloudTargetWidth: densityTarget?.width ?? ladderCaptureRef.current.telemetry.readback?.cloudTargetWidth ?? 0,
            cloudTargetHeight: densityTarget?.height ?? ladderCaptureRef.current.telemetry.readback?.cloudTargetHeight ?? 0,
            precision: densityTarget?.precision ?? ladderCaptureRef.current.telemetry.readback?.precision ?? "unorm8",
            source: "gpu-readback-v1"
          }
        }
      };
      setTakramAltitudeLadderShaderMode(
        material,
        TAKRAM_ALTITUDE_LADDER_SHADER_MODES.weather
      );
      return;
    }

    const weatherTarget = pass.currentRenderTarget
      ? readTakramAltitudeLadderRenderTarget(gl, pass.currentRenderTarget)
      : null;
    const weather = weatherTarget
      ? summarizeTakramAltitudeLadderDensity(weatherTarget)
      : null;
    ladderCaptureRef.current = {
      phase: "complete",
      cloudOnFinalReadback: null,
      telemetry: {
        ...ladderCaptureRef.current.telemetry,
        completed: true,
        weatherMaxDensity: weather?.maxDensity ?? null,
        weatherAverageDensity: weather?.averageDensity ?? null,
        readback: {
          cloudTargetWidth: weatherTarget?.width ?? ladderCaptureRef.current.telemetry.readback?.cloudTargetWidth ?? 0,
          cloudTargetHeight: weatherTarget?.height ?? ladderCaptureRef.current.telemetry.readback?.cloudTargetHeight ?? 0,
          precision: weatherTarget?.precision ?? ladderCaptureRef.current.telemetry.readback?.precision ?? "unorm8",
          source: "gpu-readback-v1"
        }
      }
    };
    setTakramAltitudeLadderShaderMode(
      material,
      TAKRAM_ALTITUDE_LADDER_SHADER_MODES.normal
    );
  }, 2);

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
              {...(view === "control"
                ? { coverage: TAKRAM_PARITY_CONTROL.coverage }
                : input === "v3"
                  ? { coverage: TAKRAM_PARITY_V3_OPENING_PRESET.coverage }
                  : {})}
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
