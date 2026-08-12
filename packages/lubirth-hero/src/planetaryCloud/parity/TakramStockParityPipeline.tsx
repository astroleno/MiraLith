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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapOpeningProgress } from "@miralith/visual-core";
import {
  Euler,
  Camera,
  FramebufferTexture,
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
  resolveTakramCloudScaleAtmosphereDomain,
  resolveTakramCloudScaleContract,
  resolveTakramStockWeatherControl,
  type TakramCloudCoverageMode,
  type TakramCloudScale,
  type TakramStockWeatherControlMode
} from "./TakramCloudScaleContract";
import {
  applyTakramCloudScaleRuntime,
  diffTakramCloudScaleRuntime,
  readTakramCloudScaleRuntime
} from "./TakramCloudScaleRuntime";
import {
  TAKRAM_PARITY_BOTTOM_RADIUS_M,
  TAKRAM_PARITY_CONTROL,
  TAKRAM_PARITY_DEFAULTS,
  TAKRAM_PARITY_ELLIPSOID,
  TAKRAM_PARITY_STOCK_ASSETS,
  TAKRAM_PARITY_V3_LADDER_SPHERICAL_UV,
  TAKRAM_PARITY_V3_OPENING_PRESET,
  buildTakramParityHistoryEpoch,
  buildTakramParityRendererFingerprint,
  hashTakramParityCameraEarthTransform,
  hashTakramParityHistoryEpoch,
  hashTakramParityRendererFingerprint,
  isTakramParityAltitudeLadderDiagnostic,
  shouldCaptureTakramHistoryFirstFrame,
  shouldCaptureTakramMatchedTemporalFrame,
  resolveTakramParityTemporalFrameMetadata,
  type TakramParityDiagnostic,
  type TakramParityHistoryFirstFrameCapture,
  type TakramParityMatchedTemporalFrameCapture,
  type TakramMipDiagnosticCapture,
  type TakramMipDiagnosticEncodedFrameCapture,
  type TakramParityInput,
  type TakramParityAltitudeLadderTelemetry,
  type TakramParitySampleCountReadback,
  type TakramParityStageReadbackCapture,
  type TakramParityTelemetry,
  type TakramParityView
} from "./TakramParityContract";
import {
  resolveTakramV3MorphologyReviewFrame,
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
import {
  resolveTakramParityAdapter,
  TAKRAM_PARITY_V3_ADAPTER
} from "./TakramParityV3Adapter";
import { TAKRAM_PARITY_V3_LAYERS } from "./TakramParityV3Layers";
import { installTakramSampleCountInstrumentation } from "./TakramSampleCountInstrumentation";
import { encodeTakramStageReadbackValues } from "./TakramStageReadbackEncoding";
import {
  TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE,
  TAKRAM_MIP_DIAGNOSTIC_TARGET_FRAMES,
  type TakramMipDiagnosticScale
} from "./TakramMipDiagnostic";
import {
  installTakramMipDiagnosticInstrumentation,
  readTakramMipDiagnosticShaderIdentity,
  type TakramMipDiagnosticMaterial
} from "./TakramMipDiagnosticInstrumentation";
import {
  captureTakramMipDiagnosticFrame,
  type TakramMipDiagnosticPass
} from "./TakramMipDiagnosticReadback";
import {
  resolveTakramOrbitalLookdevContract,
  type TakramOrbitalLookdevInput
} from "./TakramOrbitalLookdevContract";
import {
  applyTakramOrbitalLookdevRuntime,
  diffTakramOrbitalLookdevRuntime,
  readTakramOrbitalLookdevRuntime,
  type TakramOrbitalAllocationGenerations
} from "./TakramOrbitalLookdevRuntime";
import {
  buildTakramLookdevBaseKey,
  buildTakramLookdevMountKey,
  buildTakramRuntimeEvidenceEpoch,
  didTakramLookdevRemountAllAllocations,
  initializeTakramLookdevMountState,
  isTakramLookdevHistoryEpochReady,
  resolveTakramLookdevDriftRecovery,
  type TakramLookdevDriftAttemptLedger,
  type TakramLookdevSetupState
} from "./TakramOrbitalLookdevIdentity";
import {
  createTakramOrbitalWebGl2TimerProfiler,
  createUnsupportedTakramOrbitalGpuProfile,
  type TakramOrbitalGpuProfileSnapshot,
  type TakramOrbitalWebGl2TimerProfiler
} from "./TakramOrbitalGpuProfiler";

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
    __MiraLithTakramHistoryFirstFrame?: TakramParityHistoryFirstFrameCapture;
    __MiraLithTakramMatchedTemporalFrame?: TakramParityMatchedTemporalFrameCapture;
    __MiraLithTakramStageReadback?: TakramParityStageReadbackCapture;
    __MiraLithTakramMipDiagnostic?: TakramMipDiagnosticCapture;
    __MiraLithTakramGpuProfile?: TakramOrbitalGpuProfileSnapshot;
    __MiraLithStartTakramGpuProfile?: (input: Readonly<{
      candidateId: string;
      committedWinnerId: string;
      lookdevMountKey: string;
      runtimeEvidenceEpoch: string;
    }>) => Readonly<{
      accepted: boolean;
      reason: string | null;
    }>;
  }
}

export interface TakramStockParityPipelineProps {
  altitudeMeters?: number;
  cloudCoverageMode?: TakramCloudCoverageMode;
  cloudScale?: TakramCloudScale;
  stockWeatherMode?: TakramStockWeatherControlMode;
  diagnostic?: TakramParityDiagnostic;
  input: TakramParityInput;
  morphologyCandidate?: TakramV3MorphologyCandidateId;
  morphologyView?: TakramV3MorphologyViewId;
  orbitalLookdev?: TakramOrbitalLookdevInput;
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
  earthGroup.updateMatrixWorld(true);

  const radius = TAKRAM_PARITY_BOTTOM_RADIUS_M;
  const reviewFrame = resolveTakramV3MorphologyReviewFrame(reviewView, radius);
  const bridge = buildLuBirthWorldToEcef(earthGroup.matrixWorld, 1);
  if (!bridge.valid || !bridge.worldToEcef) {
    return false;
  }
  const ecefToWorld = bridge.worldToEcef.clone().invert();
  scratchCameraPosition.set(...reviewFrame.cameraEcefMeters).applyMatrix4(ecefToWorld);
  scratchMorphologyTarget.set(...reviewFrame.targetEcefMeters).applyMatrix4(ecefToWorld);

  camera.fov = 45;
  camera.near = 0.00001;
  camera.far = 20;
  camera.up.set(...reviewFrame.cameraRadialEcef).transformDirection(ecefToWorld);
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
  const reviewFrame = resolveTakramV3MorphologyReviewFrame(
    reviewView,
    TAKRAM_PARITY_BOTTOM_RADIUS_M
  );
  scratchViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  scratchEcefToWorld.copy(bridge.worldToEcef).invert();
  return auditMorphologyScale({
    view: morphologyView,
    viewProjectionMatrix: scratchViewProjection.toArray(),
    ecefToWorldMatrix: scratchEcefToWorld.toArray(),
    originEcefMeters: reviewFrame.targetEcefMeters,
    targetSphericalUv: reviewView.sphericalUv,
    eastEcef: reviewFrame.eastEcef,
    northEcef: reviewFrame.northEcef,
    upEcef: reviewFrame.upEcef,
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

function readAtmosphereRadii(aerialPerspective: AerialPerspectiveEffect) {
  const uniforms = aerialPerspective.uniforms as unknown as Map<
    string,
    { value?: unknown }
  >;
  const bottomRadius = Number(uniforms.get("bottomRadius")?.value);
  const atmosphere = uniforms.get("ATMOSPHERE")?.value as {
    bottom_radius?: number;
    top_radius?: number;
  } | undefined;
  const bottomLengthUnit = Number(atmosphere?.bottom_radius);
  const topLengthUnit = Number(atmosphere?.top_radius);
  const lengthUnitToMeters = Number.isFinite(bottomRadius) &&
    Number.isFinite(bottomLengthUnit) && bottomLengthUnit > 0
    ? bottomRadius / bottomLengthUnit
    : 1_000;
  const topRadius = Number.isFinite(topLengthUnit)
    ? topLengthUnit * lengthUnitToMeters
    : bottomRadius + 60_000;
  return {
    bottomRadius: Number.isFinite(bottomRadius)
      ? bottomRadius
      : TAKRAM_PARITY_BOTTOM_RADIUS_M,
    topRadius: Number.isFinite(topRadius)
      ? topRadius
      : TAKRAM_PARITY_BOTTOM_RADIUS_M + 60_000
  };
}

function resolveAdapterTelemetry(
  clouds: CloudsEffect | null,
  assets: TakramParityRuntimeAssets | null,
  input: TakramParityInput,
  disableDefaultLayers: boolean
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
    disableDefaultLayers,
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
    cloudOff: ["altitude-ladder-cloud-off", "aerial-final", "cloud-raw-off"].includes(diagnostic),
    aerialPerspectiveComposite: !["cloud-raw", "cloud-raw-off", "density-debug", "uv-debug", "sample-count-debug"].includes(diagnostic),
    beerShadowOcclusion: diagnostic !== "bsm-off",
    cloudRawOutput: ["cloud-raw", "cloud-raw-off", "density-debug", "uv-debug", "sample-count-debug"].includes(diagnostic),
    densityDebug: diagnostic === "density-debug",
    uvDebug: diagnostic === "uv-debug",
    sceneDepthClamp: diagnostic !== "depth-off",
    sampleCountDebug: diagnostic === "sample-count-debug",
    stageReadback: diagnostic === "stage-readback",
    historyResetFirstFrame: diagnostic === "history-reset-first",
    mipDiagnostic: diagnostic === "mip-diagnostic"
  };
}

/**
 * A strictly native stock pipeline: the only cloud renderer is Takram's
 * Clouds -> AerialPerspective pair. It deliberately contains no custom
 * raymarch, BSM, resolve/history or cloud-composite substitute.
 */
export function TakramStockParityPipeline({
  altitudeMeters,
  cloudCoverageMode,
  cloudScale,
  diagnostic = "full",
  input,
  morphologyCandidate,
  morphologyView,
  orbitalLookdev,
  onTelemetry,
  progress,
  stockWeatherMode,
  view
}: TakramStockParityPipelineProps) {
  const { gl, camera } = useThree();
  const earthTexture = useLoader(TextureLoader, EARTH_DAY_SRC);
  const adapter = resolveTakramParityAdapter(input);
  const orbitalLookdevContract = useMemo(
    () => orbitalLookdev === undefined
      ? null
      : resolveTakramOrbitalLookdevContract(orbitalLookdev),
    [
      orbitalLookdev?.coverage,
      orbitalLookdev?.opticalDepthScale,
      orbitalLookdev?.preset,
      orbitalLookdev?.verticalScale
    ]
  );
  const orbitalAdapterExpectation = useMemo(
    () => orbitalLookdevContract === null
      ? null
      : {
          localWeatherRepeat: input === "v3"
            ? adapter.localWeatherRepeat
            : orbitalLookdevContract.localWeatherRepeat
        },
    [adapter.localWeatherRepeat, input, orbitalLookdevContract]
  );
  const cloudScaleContract = useMemo(
    () => cloudScale !== undefined && cloudCoverageMode !== undefined
      ? resolveTakramCloudScaleContract({ coverageMode: cloudCoverageMode, scale: cloudScale })
      : null,
    [cloudCoverageMode, cloudScale]
  );
  const stockWeatherControl = useMemo(
    () => input === "stock" && cloudScale !== undefined
      ? resolveTakramStockWeatherControl({
          mode: stockWeatherMode ?? "unscaled",
          scale: cloudScale
        })
      : null,
    [cloudScale, input, stockWeatherMode]
  );
  const resolvedMorphologyCandidate = input === "v3" && morphologyView
    ? resolveTakramV3MorphologyCandidate(morphologyCandidate ?? "baseline")
    : null;
  const assetsState = useTakramParityRuntimeAssets(gl.domElement, input);
  const atmosphereState = useTakramParityAtmospherePrecompute(gl, gl.domElement);
  const [contextGeneration, setContextGeneration] = useState(0);
  const [visibilityGeneration, setVisibilityGeneration] = useState(0);
  const [viewportState, setViewportState] = useState(() => ({
    dpr: gl.getPixelRatio(),
    generation: 0,
    height: gl.domElement.height,
    width: gl.domElement.width
  }));
  const [lookdevMountState, setLookdevMountState] = useState<{
    lookdevBaseKey: string | null;
    resetNonce: number;
  }>({ lookdevBaseKey: null, resetNonce: 0 });
  const atmosphereRef = useRef<AtmosphereApi>(null);
  const cloudsRef = useRef<TakramCloudsRef>(null);
  const aerialPerspectiveRef = useRef<AerialPerspectiveEffect>(null);
  const earthGroupRef = useRef<Group>(null);
  const onTelemetryRef = useRef(onTelemetry);
  const publishedTelemetryRef = useRef("");
  const bridgeReadyRef = useRef(false);
  const transformFallbackRef = useRef<TakramParityTelemetry["transformFallback"]>(null);
  const historyEpochRef = useRef("");
  const historyFirstFrameCaptureRef = useRef<TakramParityHistoryFirstFrameCapture | null>(null);
  const matchedTemporalFrameCaptureRef = useRef<TakramParityMatchedTemporalFrameCapture | null>(null);
  const sampleCountReadbackRef = useRef<TakramParitySampleCountReadback | null>(null);
  const stageReadbackRef = useRef<TakramParityStageReadbackCapture | null>(null);
  const mipDiagnosticCaptureRef = useRef<TakramMipDiagnosticCapture | null>(null);
  const appliedDiagnosticRef = useRef<TakramParityDiagnostic | null>(null);
  const nativeFrameCountRef = useRef(0);
  const driftAttemptLedgerRef = useRef<TakramLookdevDriftAttemptLedger>({});
  const driftAttemptLedgerOutcomeRef = useRef<"none" | "remount" | "blocked">("none");
  const driftSignatureRef = useRef<string | null>(null);
  const lastAllocationsRef = useRef<TakramOrbitalAllocationGenerations | null>(null);
  const lookdevSetupStateRef = useRef<TakramLookdevSetupState | null>(null);
  const mountAllocationsChangedRef = useRef(false);
  const observedLookdevMountKeyRef = useRef<string | null>(null);
  const pendingRecoveryMountKeyRef = useRef<string | null>(null);
  const runtimeEvidenceEpochRef = useRef<string | null>(null);
  const gpuProfilerRef = useRef<TakramOrbitalWebGl2TimerProfiler | null>(null);
  const gpuCopyBaselineTextureRef = useRef<FramebufferTexture | null>(null);
  const gpuQueryActiveRef = useRef(false);
  const ladderCaptureRef = useRef<TakramAltitudeLadderCapture>({
    phase: "normal",
    cloudOnFinalReadback: null,
    telemetry: createEmptyAltitudeLadderTelemetry(altitudeMeters ?? 2_500)
  });
  const [bridgeReady, setBridgeReady] = useState(false);
  const orbitalAdapterManifestId = input === "v3"
    ? `v3:${TAKRAM_PARITY_V3_ADAPTER.localWeatherSha256}`
    : `stock:${TAKRAM_PARITY_STOCK_ASSETS.find(
        (asset) => asset.id === "localWeather"
      )!.sha256}`;
  const lookdevBaseKey = useMemo(
    () => orbitalLookdevContract === null
      ? null
      : buildTakramLookdevBaseKey({
          adapterManifestId: orbitalAdapterManifestId,
          assetGeneration: assetsState.assetGeneration,
          atmosphereGeneration: atmosphereState.atmosphereGeneration,
          contextGeneration,
          diagnostic,
          normalizedQuery: {
            diagnostic,
            input,
            opticalDepthScale: orbitalLookdevContract.opticalDepthScale,
            orbitalCoverage: orbitalLookdevContract.coverage,
            orbitalPreset: orbitalLookdevContract.preset,
            progress: clampOpeningProgress(progress),
            verticalScale: orbitalLookdevContract.verticalScale,
            view
          },
          progress: clampOpeningProgress(progress),
          resolvedContract: orbitalLookdevContract,
          view,
          viewport: {
            dpr: viewportState.dpr,
            height: viewportState.height,
            width: viewportState.width
          },
          viewportGeneration: viewportState.generation,
          visibilityGeneration
        }),
    [
      assetsState.assetGeneration,
      atmosphereState.atmosphereGeneration,
      contextGeneration,
      diagnostic,
      input,
      orbitalAdapterManifestId,
      orbitalLookdevContract,
      progress,
      view,
      viewportState,
      visibilityGeneration
    ]
  );
  const resetNonce = lookdevBaseKey !== null &&
    lookdevMountState.lookdevBaseKey === lookdevBaseKey
    ? lookdevMountState.resetNonce
    : 0;
  const lookdevMountKey = lookdevBaseKey === null
    ? null
    : buildTakramLookdevMountKey(lookdevBaseKey, resetNonce);
  onTelemetryRef.current = onTelemetry;

  useEffect(() => {
    const canvas = gl.domElement;
    let previousVisibility = document.visibilityState;
    const onContextRestored = () => {
      setContextGeneration((current) => current + 1);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === previousVisibility) return;
      previousVisibility = document.visibilityState;
      setVisibilityGeneration((current) => current + 1);
    };
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [gl]);

  useEffect(() => {
    setLookdevMountState((current) => {
      if (lookdevBaseKey === null) {
        return current.lookdevBaseKey === null && current.resetNonce === 0
          ? current
          : { lookdevBaseKey: null, resetNonce: 0 };
      }
      const next = initializeTakramLookdevMountState({
        previousBaseKey: current.lookdevBaseKey,
        nextBaseKey: lookdevBaseKey,
        resetNonce: current.resetNonce
      });
      return next.lookdevBaseKey === current.lookdevBaseKey &&
        next.resetNonce === current.resetNonce
        ? current
        : next;
    });
    pendingRecoveryMountKeyRef.current = null;
    driftAttemptLedgerOutcomeRef.current = "none";
    driftSignatureRef.current = null;
    lookdevSetupStateRef.current = null;
    runtimeEvidenceEpochRef.current = null;
  }, [lookdevBaseKey]);

  useEffect(() => {
    if (typeof window === "undefined" || orbitalLookdevContract === null ||
      lookdevMountKey === null) {
      return undefined;
    }
    const startProfiler: NonNullable<Window["__MiraLithStartTakramGpuProfile"]> =
      (request) => {
        if (request.candidateId !== request.committedWinnerId) {
          return {
            accepted: false,
            reason: "candidate-is-not-committed-stock-winner"
          };
        }
        if (request.lookdevMountKey !== lookdevMountKey ||
          request.runtimeEvidenceEpoch !== runtimeEvidenceEpochRef.current) {
          return { accepted: false, reason: "runtime-evidence-epoch-mismatch" };
        }
        gpuProfilerRef.current?.dispose();
        gpuCopyBaselineTextureRef.current?.dispose();
        gpuQueryActiveRef.current = false;
        const context = gl.getContext();
        if (!(context instanceof WebGL2RenderingContext)) {
          const unsupported = createUnsupportedTakramOrbitalGpuProfile({
            invalidReason: "webgl2-context-unavailable",
            timestampBits: 0
          });
          window.__MiraLithTakramGpuProfile = unsupported;
          return { accepted: true, reason: null };
        }
        const profiler = createTakramOrbitalWebGl2TimerProfiler(context);
        gpuProfilerRef.current = profiler;
        gpuCopyBaselineTextureRef.current = new FramebufferTexture(
          gl.domElement.width,
          gl.domElement.height
        );
        window.__MiraLithTakramGpuProfile = profiler.snapshot();
        return { accepted: true, reason: null };
      };
    window.__MiraLithStartTakramGpuProfile = startProfiler;
    return () => {
      if (window.__MiraLithStartTakramGpuProfile === startProfiler) {
        delete window.__MiraLithStartTakramGpuProfile;
      }
      delete window.__MiraLithTakramGpuProfile;
      gpuProfilerRef.current?.dispose();
      gpuProfilerRef.current = null;
      gpuCopyBaselineTextureRef.current?.dispose();
      gpuCopyBaselineTextureRef.current = null;
      gpuQueryActiveRef.current = false;
    };
  }, [gl, lookdevMountKey, orbitalLookdevContract]);

  useFrame(() => {
    const width = gl.domElement.width;
    const height = gl.domElement.height;
    const dpr = gl.getPixelRatio();
    setViewportState((current) => current.width === width &&
      current.height === height && current.dpr === dpr
      ? current
      : {
          dpr,
          generation: current.generation + 1,
          height,
          width
        });
  }, -3);

  // The total-only timer is deliberately non-nesting. It opens immediately
  // before the native EffectComposer priority and closes after all native
  // submissions; the profiler then emits a separate empty-query baseline.
  useFrame(() => {
    gpuQueryActiveRef.current = gpuProfilerRef.current?.beginFrame() ?? false;
  }, 0);

  useFrame(() => {
    const profiler = gpuProfilerRef.current;
    if (profiler === null) return;
    if (gpuQueryActiveRef.current) {
      profiler.endFrame(() => {
        const texture = gpuCopyBaselineTextureRef.current;
        if (texture !== null) gl.copyFramebufferToTexture(texture);
      });
      gpuQueryActiveRef.current = false;
    }
    if (typeof window !== "undefined") {
      window.__MiraLithTakramGpuProfile = profiler.poll();
    }
  }, 3);

  const setCloudsRef = useCallback((clouds: TakramCloudsRef | null) => {
    cloudsRef.current = clouds;
    if (clouds === null) {
      return;
    }
    clouds.localWeatherRepeat.set(...(
      orbitalAdapterExpectation?.localWeatherRepeat ??
      stockWeatherControl?.repeat ?? adapter.localWeatherRepeat
    ));
    clouds.localWeatherOffset.set(...adapter.localWeatherOffset);
    clouds.localWeatherVelocity.set(0, 0);
    const useV3OpeningPreset = orbitalLookdevContract === null &&
      input === "v3" && view === "opening";
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
    if (cloudScaleContract !== null) {
      applyTakramCloudScaleRuntime(clouds, cloudScaleContract);
    }
    if (orbitalLookdevContract !== null && orbitalAdapterExpectation !== null) {
      applyTakramOrbitalLookdevRuntime(
        clouds,
        orbitalLookdevContract,
        orbitalAdapterExpectation
      );
    }
    if (isTakramParityAltitudeLadderDiagnostic(diagnostic)) {
      installTakramAltitudeLadderInstrumentation(
        clouds.cloudsPass.currentMaterial as unknown as TakramAltitudeLadderMaterial
      );
      setTakramAltitudeLadderShaderMode(
        clouds.cloudsPass.currentMaterial as unknown as TakramAltitudeLadderMaterial,
        TAKRAM_ALTITUDE_LADDER_SHADER_MODES.normal
      );
    }
  }, [adapter, altitudeMeters, cloudScaleContract, diagnostic, input, morphologyCandidate, morphologyView, orbitalAdapterExpectation, orbitalLookdevContract, resolvedMorphologyCandidate, stockWeatherControl, view]);

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
    let restoreSampleCountInstrumentation: (() => void) | null = null;
    let restoreMipDiagnosticInstrumentation: (() => void) | null = null;
    if (diagnostic === "bsm-off") {
      clouds.cloudLayers.forEach((layer) => {
        layer.shadow = false;
      });
    }
    const cloudRawDiagnostic = ["cloud-raw", "cloud-raw-off", "density-debug", "uv-debug", "sample-count-debug"].includes(diagnostic);
    // The native Clouds pass must remain enabled for the normal full frame and
    // every cloud-side diagnostic. `aerial-final` and the explicit
    // altitude-ladder cloud-off probe are the only intentional cloud-disabled
    // modes; the previous inverse assignment silently skipped the renderer
    // for every full opening frame.
    clouds.skipRendering = diagnostic === "aerial-final" ||
      diagnostic === "cloud-raw-off" ||
      diagnostic === "altitude-ladder-cloud-off";
    aerialPerspective.blendMode.blendFunction = cloudRawDiagnostic
      ? BlendFunction.SKIP
      : BlendFunction.NORMAL;
    if (diagnostic === "sample-count-debug") {
      restoreSampleCountInstrumentation = installTakramSampleCountInstrumentation(
        clouds.cloudsPass.currentMaterial
      );
      clouds.cloudsPass.currentMaterial.defines.DEBUG_SHOW_SAMPLE_COUNT = "1";
      clouds.cloudsPass.currentMaterial.needsUpdate = true;
    }
    if (diagnostic === "mip-diagnostic") {
      restoreMipDiagnosticInstrumentation = installTakramMipDiagnosticInstrumentation(
        clouds.cloudsPass.currentMaterial as unknown as TakramMipDiagnosticMaterial
      );
    }
    if (diagnostic === "uv-debug") {
      clouds.cloudsPass.currentMaterial.defines.DEBUG_SHOW_UV = "1";
      clouds.cloudsPass.currentMaterial.needsUpdate = true;
    }
    appliedDiagnosticRef.current = diagnostic;

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
        restoreSampleCountInstrumentation?.();
        clouds.cloudsPass.currentMaterial.needsUpdate = true;
      }
      if (diagnostic === "uv-debug") {
        delete clouds.cloudsPass.currentMaterial.defines.DEBUG_SHOW_UV;
        clouds.cloudsPass.currentMaterial.needsUpdate = true;
      }
      restoreMipDiagnosticInstrumentation?.();
    };
  }, [assetsState.ready, atmosphereState.ready, bridgeReady, cloudScaleContract, diagnostic, lookdevMountKey, orbitalLookdevContract]);

  // `skipRendering` only disables the CloudsEffect composite; the native
  // cloud buffer is still exposed to AerialPerspective through the atmosphere
  // transient overlay. Keep the explicit cloud-off diagnostic honest by
  // clearing both owners immediately before the composer renders.
  useFrame(() => {
    if (diagnostic !== "altitude-ladder-cloud-off" && diagnostic !== "aerial-final" &&
      diagnostic !== "cloud-raw-off") {
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
    const cloudScaleReadback = clouds !== null && cloudScaleContract !== null
      ? readTakramCloudScaleRuntime(clouds, cloudScaleContract)
      : null;
    const cloudScaleDrift = cloudScaleReadback !== null && cloudScaleContract !== null
      ? diffTakramCloudScaleRuntime(cloudScaleContract, cloudScaleReadback)
      : [];
    const blockingCloudScaleDrift = cloudScaleDrift.filter((entry) =>
      diagnostic !== "bsm-off" || !/^layers\.\d+\.shadow$/.test(entry.path)
    );
    const atmosphereRadii = aerialPerspective !== null
      ? readAtmosphereRadii(aerialPerspective)
      : null;
    const cloudScaleAtmosphereDomain = cloudScaleContract !== null && atmosphereRadii !== null
      ? resolveTakramCloudScaleAtmosphereDomain({
          contract: cloudScaleContract,
          ...atmosphereRadii
        })
      : null;
    const cloudScaleRuntimeReady = cloudScaleContract === null ||
      (cloudScaleReadback !== null && blockingCloudScaleDrift.length === 0 &&
        cloudScaleAtmosphereDomain !== null);
    const orbitalLookdevReadback = clouds !== null &&
      orbitalLookdevContract !== null
      ? readTakramOrbitalLookdevRuntime(clouds, orbitalLookdevContract)
      : null;
    const orbitalLookdevDrift = orbitalLookdevReadback !== null &&
      orbitalLookdevContract !== null && orbitalAdapterExpectation !== null
      ? diffTakramOrbitalLookdevRuntime(
          orbitalLookdevContract,
          orbitalLookdevReadback,
          orbitalAdapterExpectation
        )
      : [];
    const blockingOrbitalLookdevDrift = orbitalLookdevDrift.filter((entry) =>
      diagnostic !== "bsm-off" || !/^layers\.\d+\.shadow$/.test(entry.path)
    );
    let orbitalHistoryEpochReady = orbitalLookdevContract === null;
    if (orbitalLookdevReadback !== null && lookdevMountKey !== null) {
      if (observedLookdevMountKeyRef.current !== lookdevMountKey) {
        mountAllocationsChangedRef.current =
          didTakramLookdevRemountAllAllocations(
            lastAllocationsRef.current,
            orbitalLookdevReadback.allocations
          );
        observedLookdevMountKeyRef.current = lookdevMountKey;
        nativeFrameCountRef.current = 0;
        runtimeEvidenceEpochRef.current = null;
      }
      lastAllocationsRef.current = orbitalLookdevReadback.allocations;
      const cloudsPass = clouds?.cloudsPass as unknown as {
        currentMaterial?: { uniforms?: Record<string, { value?: unknown }> };
        resolveMaterial?: { uniforms?: Record<string, { value?: unknown }> };
      };
      const shadowPass = clouds?.shadowPass as unknown as {
        currentMaterial?: { uniforms?: Record<string, { value?: unknown }> };
      };
      orbitalHistoryEpochReady = isTakramLookdevHistoryEpochReady({
        allocationsChanged: mountAllocationsChangedRef.current,
        cloudsFrame: Number(
          cloudsPass.currentMaterial?.uniforms?.frame?.value ?? Number.NaN
        ),
        resolveFrame: Number(
          cloudsPass.resolveMaterial?.uniforms?.frame?.value ?? Number.NaN
        ),
        shadowFrame: Number(
          shadowPass.currentMaterial?.uniforms?.frame?.value ?? Number.NaN
        )
      });
    }
    const runtimePrerequisitesReady = assetsState.ready && atmosphereState.ready &&
      bridgeReadyRef.current && clouds !== null && aerialPerspective !== null &&
      appliedDiagnosticRef.current === diagnostic && cloudScaleRuntimeReady;
    let orbitalRuntimeReady = orbitalLookdevContract === null;
    if (orbitalLookdevContract !== null && orbitalLookdevReadback !== null &&
      lookdevBaseKey !== null && lookdevMountKey !== null &&
      runtimePrerequisitesReady) {
      if (pendingRecoveryMountKeyRef.current !== null &&
        pendingRecoveryMountKeyRef.current !== lookdevMountKey) {
        lookdevSetupStateRef.current = "ORBITAL_LOOKDEV_RECOVERY_REMOUNT";
      } else {
        if (pendingRecoveryMountKeyRef.current === lookdevMountKey) {
          pendingRecoveryMountKeyRef.current = null;
        }
        const recovery = resolveTakramLookdevDriftRecovery({
          attemptedLedger: driftAttemptLedgerRef.current,
          drift: blockingOrbitalLookdevDrift,
          lookdevBaseKey,
          resetNonce
        });
        driftAttemptLedgerRef.current = recovery.attemptedLedger;
        driftSignatureRef.current = recovery.driftSignature;
        lookdevSetupStateRef.current = recovery.setupState;
        if (recovery.action === "remount") {
          driftAttemptLedgerOutcomeRef.current = "remount";
          const nextMountKey = buildTakramLookdevMountKey(
            lookdevBaseKey,
            recovery.nextResetNonce
          );
          pendingRecoveryMountKeyRef.current = nextMountKey;
          setLookdevMountState((current) =>
            current.lookdevBaseKey === lookdevBaseKey
              ? { ...current, resetNonce: recovery.nextResetNonce }
              : current
          );
        } else if (recovery.action === "block") {
          driftAttemptLedgerOutcomeRef.current = "blocked";
        }
      }
      orbitalRuntimeReady = orbitalHistoryEpochReady &&
        lookdevSetupStateRef.current === "ORBITAL_LOOKDEV_RUNTIME_READY";
    }
    const rendererFingerprint = clouds && aerialPerspective
      ? buildTakramParityRendererFingerprint({
        clouds,
        aerialPerspective,
        ...(cloudScaleReadback === null
          ? {}
          : { cloudScaleRuntime: cloudScaleReadback }),
        ...(orbitalLookdevReadback === null
          ? {}
          : { orbitalLookdevRuntime: orbitalLookdevReadback }),
        sharedAssets: TAKRAM_PARITY_SHARED_ASSET_HASHES
      })
      : null;
    const rendererFingerprintHash = rendererFingerprint
      ? hashTakramParityRendererFingerprint(rendererFingerprint)
      : null;
    const normalizedProgress = clampOpeningProgress(progress);
    const resolvedAdapterTelemetry = resolveAdapterTelemetry(
      clouds,
      assetsState.assets,
      input,
      cloudScaleContract !== null || orbitalLookdevContract !== null ||
        adapter.disableDefaultLayers
    );
    const nativePipelineReady = runtimePrerequisitesReady && orbitalRuntimeReady;
    if (nativePipelineReady && orbitalLookdevReadback !== null &&
      rendererFingerprint !== null && lookdevMountKey !== null) {
      runtimeEvidenceEpochRef.current = buildTakramRuntimeEvidenceEpoch({
        adapterRuntime: resolvedAdapterTelemetry,
        allocations: orbitalLookdevReadback.allocations,
        cameraMatrixWorld: camera.matrixWorld.toArray(),
        cameraProjectionMatrix: camera.projectionMatrix.toArray(),
        earthMatrixWorld: scratchEarthMatrix.toArray(),
        lookdevMountKey,
        rendererFingerprint
      });
    } else if (orbitalLookdevContract !== null) {
      runtimeEvidenceEpochRef.current = null;
    }
    const cameraEarthTransformHash = hashTakramParityCameraEarthTransform({
      cameraMatrixWorld: camera.matrixWorld.toArray(),
      cameraProjectionMatrix: camera.projectionMatrix.toArray(),
      earthMatrixWorld: scratchEarthMatrix.toArray()
    });
    const historyEpoch = buildTakramParityHistoryEpoch({
      assetGeneration: assetsState.assetGeneration,
      atmosphereGeneration: atmosphereState.atmosphereGeneration,
      cameraEarthTransformHash,
      cloudCoverage: cloudScaleContract?.coverage ?? null,
      cloudCoverageMode: cloudScaleContract?.coverageMode ?? null,
      cloudScale: cloudScaleContract?.scale ?? null,
      coordinateMode,
      diagnostic,
      input,
      localWeatherHash: assetsState.assets?.localWeatherSha256 ?? null,
      mipDistancePatchActive: cloudScaleReadback === null
        ? false
        : cloudScaleReadback.mipDistancePatch.active,
      mipDistanceRuntimeIdentity: cloudScaleReadback === null
        ? null
        : JSON.stringify(cloudScaleReadback.mipDistancePatch),
      morphologyCandidate: resolvedMorphologyCandidate?.id ?? null,
      morphologyView: morphologyView ?? null,
      progress: normalizedProgress,
      rendererConfigurationHash: orbitalLookdevContract === null
        ? rendererFingerprintHash
        : JSON.stringify([rendererFingerprintHash, lookdevMountKey]),
      stockWeatherMode: stockWeatherControl?.mode ?? null,
      view
    });
    if (historyEpochRef.current !== historyEpoch) {
      historyEpochRef.current = historyEpoch;
      nativeFrameCountRef.current = 0;
      historyFirstFrameCaptureRef.current = null;
      matchedTemporalFrameCaptureRef.current = null;
      sampleCountReadbackRef.current = null;
      stageReadbackRef.current = null;
      mipDiagnosticCaptureRef.current = null;
      if (typeof window !== "undefined") {
        delete window.__MiraLithTakramHistoryFirstFrame;
        delete window.__MiraLithTakramMatchedTemporalFrame;
        delete window.__MiraLithTakramStageReadback;
        delete window.__MiraLithTakramMipDiagnostic;
      }
      if (clouds && orbitalLookdevContract === null) {
        // The upstream effect owns the STBN/Bayer frame counter. Reset it with
        // every immutable history epoch so separate diagnostic routes capture
        // the same temporal phase instead of inheriting asset-load timing.
        (clouds as unknown as { frame: number }).frame = 0;
        clouds.temporalUpscale = false;
        clouds.temporalUpscale = true;
      }
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
    const morphologyScaleAudit = morphologyView
      ? resolveMorphologyScaleAudit(
        camera,
        bridge,
        clouds,
        morphologyView,
        { width: gl.domElement.width, height: gl.domElement.height }
      )
      : null;
    const sampleCountReadbackReady = diagnostic !== "sample-count-debug" ||
      sampleCountReadbackRef.current !== null;
    const matchedTemporalFrameReady = diagnostic === "history-reset-first" ||
      matchedTemporalFrameCaptureRef.current !== null;
    const stageReadbackReady = diagnostic !== "stage-readback" ||
      stageReadbackRef.current !== null;
    const mipDiagnosticReady = diagnostic !== "mip-diagnostic" ||
      mipDiagnosticCaptureRef.current?.completed === true;
    const telemetry: TakramParityTelemetry = {
      active: nativePipelineReady && sampleCountReadbackReady && matchedTemporalFrameReady &&
        stageReadbackReady && mipDiagnosticReady &&
        ((diagnostic === "history-reset-first" &&
          historyFirstFrameCaptureRef.current !== null) ||
          (temporalConverged && (!isTakramParityAltitudeLadderDiagnostic(diagnostic) ||
            ladderCaptureRef.current.phase === "complete"))),
      adapter: resolvedAdapterTelemetry,
      assetGeneration: assetsState.assetGeneration,
      assetsReady: assetsState.ready,
      atmosphereGeneration: atmosphereState.atmosphereGeneration,
      atmosphereReady: atmosphereState.ready,
      cameraHeightMeters,
      cameraMatrixWorld: camera.matrixWorld.toArray(),
      cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
      cloudScale: cloudScaleContract !== null && cloudScaleReadback !== null &&
        cloudScaleAtmosphereDomain !== null
        ? {
            atmosphereDomain: cloudScaleAtmosphereDomain,
            drift: cloudScaleDrift,
            readback: cloudScaleReadback,
            requested: cloudScaleContract,
            stockWeatherControl
          }
        : null,
      driftAttemptLedgerOutcome: driftAttemptLedgerOutcomeRef.current,
      driftSignature: driftSignatureRef.current,
      coordinateMode,
      control: view === "control" ? TAKRAM_PARITY_CONTROL : null,
      diagnostic,
      diagnosticApplied: appliedDiagnosticRef.current === diagnostic,
      diagnosticState: resolveDiagnosticState(diagnostic),
      earthMatrixWorld: scratchEarthMatrix.toArray(),
      ecefSunDirection,
      input,
      lookdevBaseKey,
      lookdevMountKey,
      lookdevSetupState: lookdevSetupStateRef.current,
      native: resolvedNative,
      nativeFrameCount,
      orbitalLookdev: orbitalLookdevContract !== null &&
        orbitalLookdevReadback !== null
        ? {
            drift: orbitalLookdevDrift,
            readback: orbitalLookdevReadback,
            requested: orbitalLookdevContract
          }
        : null,
      historyEpochHash: hashTakramParityHistoryEpoch(historyEpoch),
      historyFirstFrameCapture: historyFirstFrameCaptureRef.current === null
        ? null
        : {
            height: historyFirstFrameCaptureRef.current.height,
            nativeFrameCount: historyFirstFrameCaptureRef.current.nativeFrameCount,
            width: historyFirstFrameCaptureRef.current.width
          },
      matchedTemporalFrameCapture: matchedTemporalFrameCaptureRef.current === null
        ? null
        : {
            height: matchedTemporalFrameCaptureRef.current.height,
            nativeFrameCount: matchedTemporalFrameCaptureRef.current.nativeFrameCount,
            width: matchedTemporalFrameCaptureRef.current.width,
            cloudsFrame: matchedTemporalFrameCaptureRef.current.cloudsFrame,
            resolveFrame: matchedTemporalFrameCaptureRef.current.resolveFrame,
            shadowFrame: matchedTemporalFrameCaptureRef.current.shadowFrame,
            temporalJitterIndex: matchedTemporalFrameCaptureRef.current.temporalJitterIndex,
            stbnSliceIndex: matchedTemporalFrameCaptureRef.current.stbnSliceIndex,
            historyEpochHash: matchedTemporalFrameCaptureRef.current.historyEpochHash,
            frameLockPass: matchedTemporalFrameCaptureRef.current.frameLockPass
          },
      mipDiagnostic: mipDiagnosticCaptureRef.current === null
        ? null
        : {
            completed: mipDiagnosticCaptureRef.current.completed,
            scale: mipDiagnosticCaptureRef.current.scale,
            targetNativeFrames: mipDiagnosticCaptureRef.current.targetNativeFrames,
            runtimeFragmentShaderFnv1a64:
              mipDiagnosticCaptureRef.current.runtimeFragmentShaderFnv1a64,
            frames: mipDiagnosticCaptureRef.current.frames.map(({ dataBase64: _dataBase64, ...frame }) => frame)
          },
      stageReadback: stageReadbackRef.current === null
        ? null
        : {
            nativeFrameCount: stageReadbackRef.current.nativeFrameCount,
            temporalFrame: stageReadbackRef.current.temporalFrame,
            aerialPerspectiveInputSource:
              stageReadbackRef.current.aerialPerspectiveInputSource,
            preTemporal: {
              width: stageReadbackRef.current.preTemporal.width,
              height: stageReadbackRef.current.preTemporal.height,
              precision: stageReadbackRef.current.preTemporal.precision,
              source: stageReadbackRef.current.preTemporal.source,
              origin: stageReadbackRef.current.preTemporal.origin,
              encoding: stageReadbackRef.current.preTemporal.encoding,
              scalar: stageReadbackRef.current.preTemporal.scalar,
              byteLength: stageReadbackRef.current.preTemporal.byteLength
            },
            resolvedHistory: {
              width: stageReadbackRef.current.resolvedHistory.width,
              height: stageReadbackRef.current.resolvedHistory.height,
              precision: stageReadbackRef.current.resolvedHistory.precision,
              source: stageReadbackRef.current.resolvedHistory.source,
              origin: stageReadbackRef.current.resolvedHistory.origin,
              encoding: stageReadbackRef.current.resolvedHistory.encoding,
              scalar: stageReadbackRef.current.resolvedHistory.scalar,
              byteLength: stageReadbackRef.current.resolvedHistory.byteLength
            },
            finalOutput: {
              width: stageReadbackRef.current.finalOutput.width,
              height: stageReadbackRef.current.finalOutput.height,
              precision: stageReadbackRef.current.finalOutput.precision,
              source: stageReadbackRef.current.finalOutput.source,
              origin: stageReadbackRef.current.finalOutput.origin,
              encoding: stageReadbackRef.current.finalOutput.encoding,
              scalar: stageReadbackRef.current.finalOutput.scalar,
              byteLength: stageReadbackRef.current.finalOutput.byteLength
            }
          },
      progress: clampOpeningProgress(progress),
      resetNonce,
      rendererFingerprint,
      rendererFingerprintHash,
      runtimeEvidenceEpoch: runtimeEvidenceEpochRef.current,
      presentationPreset: orbitalLookdevContract !== null
        ? "orbital-parameter-lookdev"
        : cloudScaleContract !== null
        ? "cloud-scale-similarity"
        : input === "v3" && view === "opening"
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
      sampleCountReadback: sampleCountReadbackRef.current,
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
      cloudScale: telemetry.cloudScale,
      orbitalLookdev: telemetry.orbitalLookdev,
      lookdevBaseKey: telemetry.lookdevBaseKey,
      lookdevMountKey: telemetry.lookdevMountKey,
      lookdevSetupState: telemetry.lookdevSetupState,
      resetNonce: telemetry.resetNonce,
      runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch,
      driftAttemptLedgerOutcome: telemetry.driftAttemptLedgerOutcome,
      driftSignature: telemetry.driftSignature,
      coordinateMode: telemetry.coordinateMode,
      control: telemetry.control,
      diagnostic: telemetry.diagnostic,
      diagnosticApplied: telemetry.diagnosticApplied,
      diagnosticState: telemetry.diagnosticState,
      adapter: telemetry.adapter,
      native: telemetry.native,
      historyEpochHash: telemetry.historyEpochHash,
      rendererFingerprintHash: telemetry.rendererFingerprintHash,
      presentationPreset: telemetry.presentationPreset,
      coverage: telemetry.coverage,
      sceneDepthScale: telemetry.sceneDepthScale,
      shapeRepeat: telemetry.shapeRepeat,
      shapeDetailRepeat: telemetry.shapeDetailRepeat,
      altitudeLadder: telemetry.altitudeLadder,
      nativeFrameCount: Math.min(
        telemetry.nativeFrameCount,
        diagnostic === "mip-diagnostic"
          ? TAKRAM_MIP_DIAGNOSTIC_TARGET_FRAMES[2]
          : TEMPORAL_CONVERGENCE_FRAME_COUNT
      ),
      historyFirstFrameCapture: telemetry.historyFirstFrameCapture,
      matchedTemporalFrameCapture: telemetry.matchedTemporalFrameCapture,
      mipDiagnostic: telemetry.mipDiagnostic,
      stageReadback: telemetry.stageReadback,
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

  // Capture every diagnostic at the exact same native history frame. The
  // effect frame is reset with the epoch above, so frame 32 also has a stable
  // Bayer jitter index and STBN slice across independent page loads.
  useFrame(() => {
    if (diagnostic === "history-reset-first" ||
      !shouldCaptureTakramMatchedTemporalFrame({
        nativeFrameCount: nativeFrameCountRef.current,
        targetNativeFrameCount: TEMPORAL_CONVERGENCE_FRAME_COUNT,
        alreadyCaptured: matchedTemporalFrameCaptureRef.current !== null
      })) {
      return;
    }
    const clouds = cloudsRef.current;
    if (!clouds) return;
    const cloudsPass = clouds.cloudsPass as unknown as {
      currentMaterial: { uniforms: Record<string, { value?: unknown }> };
      resolveMaterial: { uniforms: Record<string, { value?: unknown }> };
    };
    const shadowPass = clouds.shadowPass as unknown as {
      currentMaterial: { uniforms: Record<string, { value?: unknown }> };
    };
    const cloudsFrame = Number(cloudsPass.currentMaterial.uniforms.frame?.value ?? Number.NaN);
    const resolveFrame = Number(cloudsPass.resolveMaterial.uniforms.frame?.value ?? Number.NaN);
    const shadowFrame = Number(shadowPass.currentMaterial.uniforms.frame?.value ?? Number.NaN);
    const stbnDepth = Number((clouds.stbnTexture?.image as { depth?: number } | undefined)?.depth ?? 1);
    const metadata = resolveTakramParityTemporalFrameMetadata({
      cloudsFrame,
      resolveFrame,
      shadowFrame,
      stbnDepth,
      historyEpoch: historyEpochRef.current
    });
    const capture: TakramParityMatchedTemporalFrameCapture = {
      dataUrl: gl.domElement.toDataURL("image/png"),
      height: gl.domElement.height,
      nativeFrameCount: TEMPORAL_CONVERGENCE_FRAME_COUNT,
      width: gl.domElement.width,
      ...metadata
    };
    matchedTemporalFrameCaptureRef.current = capture;
    if (typeof window !== "undefined") {
      window.__MiraLithTakramMatchedTemporalFrame = capture;
    }
  }, 2);

  // Conditional Task M is a read-only counterfactual probe. At three frozen
  // native frames, replay only the already-prepared current cloud pass and
  // read its existing MRT attachments. Resolve/history, shader mip behavior,
  // and every production renderer parameter remain untouched.
  useFrame(() => {
    if (diagnostic !== "mip-diagnostic") return;
    const targetNativeFrame = TAKRAM_MIP_DIAGNOSTIC_TARGET_FRAMES.find(
      (frame) => frame === nativeFrameCountRef.current
    );
    if (targetNativeFrame === undefined ||
      mipDiagnosticCaptureRef.current?.frames.some(
        (frame) => frame.nativeFrame === targetNativeFrame
      )) {
      return;
    }
    const clouds = cloudsRef.current;
    if (!clouds) return;
    const cloudsPass = clouds.cloudsPass as unknown as TakramMipDiagnosticPass & {
      resolveMaterial: { uniforms: Record<string, { value?: unknown }> };
    };
    const shadowPass = clouds.shadowPass as unknown as {
      currentMaterial: { uniforms: Record<string, { value?: unknown }> };
    };
    const cloudsFrame = Number(cloudsPass.currentMaterial.uniforms.frame?.value ?? Number.NaN);
    const resolveFrame = Number(cloudsPass.resolveMaterial.uniforms.frame?.value ?? Number.NaN);
    const shadowFrame = Number(shadowPass.currentMaterial.uniforms.frame?.value ?? Number.NaN);
    const stbnDepth = Number((clouds.stbnTexture?.image as { depth?: number } | undefined)?.depth ?? 1);
    const temporalFrame = {
      nativeFrameCount: targetNativeFrame,
      ...resolveTakramParityTemporalFrameMetadata({
        cloudsFrame,
        resolveFrame,
        shadowFrame,
        stbnDepth,
        historyEpoch: historyEpochRef.current
      })
    };
    if (!temporalFrame.frameLockPass || cloudsFrame !== targetNativeFrame) {
      throw new Error(
        `Takram mip diagnostic frame lock failed at native frame ${targetNativeFrame}.`
      );
    }
    const scale = (cloudScale ?? 1) as TakramMipDiagnosticScale;
    const readback = captureTakramMipDiagnosticFrame({
      renderer: gl,
      pass: cloudsPass,
      scale
    });
    const encoded = encodeTakramStageReadbackValues(readback.records, "half-float");
    const encodedFrame: TakramMipDiagnosticEncodedFrameCapture = {
      nativeFrame: targetNativeFrame,
      width: readback.width,
      height: readback.height,
      recordCount: readback.recordCount,
      lastSampleOrdinal: readback.lastSampleOrdinal,
      recordStride: TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE,
      scalar: "float32-le",
      byteLength: encoded.byteLength,
      dataBase64: encoded.dataBase64,
      temporalFrame
    };
    const previous = mipDiagnosticCaptureRef.current;
    const frames = [...(previous?.frames ?? []), encodedFrame]
      .sort((left, right) => left.nativeFrame - right.nativeFrame);
    const capture: TakramMipDiagnosticCapture = {
      completed: frames.length === TAKRAM_MIP_DIAGNOSTIC_TARGET_FRAMES.length,
      scale,
      targetNativeFrames: TAKRAM_MIP_DIAGNOSTIC_TARGET_FRAMES,
      runtimeFragmentShaderFnv1a64: previous?.runtimeFragmentShaderFnv1a64 ??
        readTakramMipDiagnosticShaderIdentity(cloudsPass.currentMaterial),
      frames
    };
    mipDiagnosticCaptureRef.current = capture;
    if (typeof window !== "undefined") {
      window.__MiraLithTakramMipDiagnostic = capture;
    }
  }, 2);

  // Read each native stage from the same exact frame as the immutable PNG.
  // This route is capture-only and intentionally publishes the large buffers
  // on a separate window field rather than through the React telemetry state.
  useFrame(() => {
    if (diagnostic !== "stage-readback" ||
      stageReadbackRef.current !== null ||
      nativeFrameCountRef.current !== TEMPORAL_CONVERGENCE_FRAME_COUNT) {
      return;
    }
    const clouds = cloudsRef.current;
    const temporalFrame = matchedTemporalFrameCaptureRef.current;
    if (!clouds || !temporalFrame) return;
    const pass = clouds.cloudsPass as unknown as {
      currentRenderTarget?: Parameters<typeof readTakramAltitudeLadderRenderTarget>[1];
      historyRenderTarget?: Parameters<typeof readTakramAltitudeLadderRenderTarget>[1];
    };
    const preTemporal = pass.currentRenderTarget
      ? readTakramAltitudeLadderRenderTarget(gl, pass.currentRenderTarget)
      : null;
    const resolvedHistory = pass.historyRenderTarget
      ? readTakramAltitudeLadderRenderTarget(gl, pass.historyRenderTarget)
      : null;
    const finalOutput = readTakramAltitudeLadderDefaultFramebuffer(gl);
    if (!preTemporal || !resolvedHistory || !finalOutput) return;
    const temporalMetadata = {
      nativeFrameCount: temporalFrame.nativeFrameCount,
      cloudsFrame: temporalFrame.cloudsFrame,
      resolveFrame: temporalFrame.resolveFrame,
      shadowFrame: temporalFrame.shadowFrame,
      temporalJitterIndex: temporalFrame.temporalJitterIndex,
      stbnSliceIndex: temporalFrame.stbnSliceIndex,
      historyEpochHash: temporalFrame.historyEpochHash,
      frameLockPass: temporalFrame.frameLockPass
    };
    const capture: TakramParityStageReadbackCapture = {
      nativeFrameCount: TEMPORAL_CONVERGENCE_FRAME_COUNT,
      temporalFrame: temporalMetadata,
      aerialPerspectiveInputSource: "native-cloud-resolved-history-render-target",
      preTemporal: {
        width: preTemporal.width,
        height: preTemporal.height,
        precision: preTemporal.precision,
        source: "native-cloud-current-render-target",
        origin: "bottom-left",
        encoding: "linear-rgba",
        ...encodeTakramStageReadbackValues(preTemporal.values, preTemporal.precision)
      },
      resolvedHistory: {
        width: resolvedHistory.width,
        height: resolvedHistory.height,
        precision: resolvedHistory.precision,
        source: "native-cloud-resolved-history-render-target",
        origin: "bottom-left",
        encoding: "linear-rgba",
        ...encodeTakramStageReadbackValues(resolvedHistory.values, resolvedHistory.precision)
      },
      finalOutput: {
        width: finalOutput.width,
        height: finalOutput.height,
        precision: finalOutput.precision,
        source: "default-framebuffer-after-aerial-perspective",
        origin: "bottom-left",
        encoding: "srgb-output-rgba",
        ...encodeTakramStageReadbackValues(finalOutput.values, finalOutput.precision)
      }
    };
    stageReadbackRef.current = capture;
    if (typeof window !== "undefined") {
      window.__MiraLithTakramStageReadback = capture;
    }
  }, 2);

  // Preserve the exact post-composer output of native frame 1. Browser-side
  // screenshots happen on a later task and therefore cannot prove first-frame
  // temporal state without this immutable capture.
  useFrame(() => {
    const alreadyCaptured = historyFirstFrameCaptureRef.current !== null;
    if (!shouldCaptureTakramHistoryFirstFrame({
      diagnostic,
      nativeFrameCount: nativeFrameCountRef.current,
      alreadyCaptured
    })) {
      return;
    }
    const capture: TakramParityHistoryFirstFrameCapture = {
      dataUrl: gl.domElement.toDataURL("image/png"),
      height: gl.domElement.height,
      nativeFrameCount: 1,
      width: gl.domElement.width
    };
    historyFirstFrameCaptureRef.current = capture;
    if (typeof window !== "undefined") {
      window.__MiraLithTakramHistoryFirstFrame = capture;
    }
  }, 2);

  // Screenshot colors pass through temporal resolve, scene composition and
  // output transfer, so they cannot be decoded back into exact sample counts.
  // Capture the native pre-temporal half-float target after the composer has
  // rendered and publish packed linear RGB once per immutable history epoch.
  useFrame(() => {
    if (diagnostic !== "sample-count-debug" ||
      sampleCountReadbackRef.current !== null ||
      nativeFrameCountRef.current < TEMPORAL_CONVERGENCE_FRAME_COUNT) {
      return;
    }
    const clouds = cloudsRef.current;
    if (!clouds) return;
    const pass = clouds.cloudsPass as unknown as {
      currentRenderTarget?: Parameters<typeof readTakramAltitudeLadderRenderTarget>[1];
    };
    const readback = pass.currentRenderTarget
      ? readTakramAltitudeLadderRenderTarget(gl, pass.currentRenderTarget)
      : null;
    if (!readback) return;
    const values = new Array<number>(readback.width * readback.height * 4);
    for (let pixel = 0; pixel < readback.width * readback.height; pixel += 1) {
      const sourceOffset = pixel * 4;
      const targetOffset = pixel * 4;
      values[targetOffset] = readback.values[sourceOffset] ?? 0;
      values[targetOffset + 1] = readback.values[sourceOffset + 1] ?? 0;
      values[targetOffset + 2] = readback.values[sourceOffset + 2] ?? 0;
      values[targetOffset + 3] = readback.values[sourceOffset + 3] ?? 0;
    }
    sampleCountReadbackRef.current = {
      width: readback.width,
      height: readback.height,
      precision: readback.precision,
      source: "native-cloud-current-render-target-v1",
      origin: "bottom-left",
      encoding: "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask",
      values
    };
  }, 2);

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
          <EffectComposer
            key={lookdevMountKey ?? "legacy-parity-composer"}
            enableNormalPass
          >
            <Clouds
              ref={setCloudsRef}
              {...(orbitalLookdevContract !== null
                ? { coverage: orbitalLookdevContract.coverage }
                : cloudScaleContract !== null
                ? { coverage: cloudScaleContract.coverage }
                : view === "control"
                ? { coverage: TAKRAM_PARITY_CONTROL.coverage }
                : input === "v3"
                  ? { coverage: TAKRAM_PARITY_V3_OPENING_PRESET.coverage }
                  : {})}
              disableDefaultLayers={orbitalLookdevContract !== null ||
                cloudScaleContract !== null || adapter.disableDefaultLayers}
              globalWeatherMapping={adapter.globalWeatherMapping}
              localWeatherTexture={runtimeAssets.localWeather}
              qualityPreset={TAKRAM_PARITY_DEFAULTS.qualityPreset}
              shapeDetailTexture={runtimeAssets.shapeDetail}
              shapeTexture={runtimeAssets.shape}
              stbnTexture={runtimeAssets.stbn}
              turbulenceTexture={runtimeAssets.turbulence}
            >
              {(orbitalLookdevContract?.layers ?? cloudScaleContract?.layers ??
                (input === "v3" ? TAKRAM_PARITY_V3_LAYERS : [])).map((layer, index) => (
                <TakramCloudLayer
                  key={layer.channel}
                  index={index}
                  {...layer}
                />
              ))}
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
