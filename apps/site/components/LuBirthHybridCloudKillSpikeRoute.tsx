"use client";

import { useEffect, useRef, useState } from "react";
import {
  isPointInsideHybridEllipse,
  measureHybridEllipseUnionCoverage,
  type HybridEllipse2D
} from "./lubirthHybridCloudMetrics";
import {
  resolveLocalVolumeSamplingBudget,
  resolveBeerLambertTransmittance,
  encodeOctahedralNormal,
  selectLocalVolumeActiveTiles,
  resolveSourcePatchLocalUv,
  resolveSourceNativeOpticalMass,
  resolveSourceNativeVerticalProfile,
  resolveV3SourceCoverage,
  resolveV3SourceFootprintMask
} from "./lubirthHybridLocalVolumeMath";

type KillSpikeCamera = "near" | "mid-oblique" | "oblique" | "sweep";
type KillSpikeTier = "desktop" | "mobile";
type DepthBinMode = 1 | 2;
type HybridRendererMode = "ellipsoid" | "local-volume";

interface TruthLevel {
  width: number;
  height: number;
  rgbaOffset: number;
  rgbaLength: number;
  minMaxOffset: number;
  minMaxLength: number;
}

interface TruthHeader {
  magic: "MLHC";
  version: 1;
  layoutId: "v3-r-depth-g-height-b-morphology-a-concavity";
  orientation: "equirect-u-repeat-v-clamp-north-up";
  width: number;
  height: number;
  levelCount: number;
  sourceSha256: string;
  generatorVersion: string;
  byteLength: number;
  levels: TruthLevel[];
  sourceResolution?: [number, number];
  sourceUvBounds?: [number, number, number, number];
}

type CloudLobeRole = "base" | "tower" | "detail";

interface CloudLobeShape {
  center: [number, number, number];
  east: [number, number, number];
  normal: [number, number, number];
  north: [number, number, number];
  radiusEast: number;
  radiusNorth: number;
  radiusUp: number;
  sourceUv: [number, number];
  height: number;
  density: number;
  morphology: number;
  concavity: number;
}

interface CloudLobe extends CloudLobeShape {
  fieldTile?: [number, number, number, number];
  id: number;
  isCarrier: boolean;
  parentId: number | null;
  role: CloudLobeRole;
}

interface SourcePatchSummary {
  footprintCoverageRatio: number;
  heightP05: number;
  heightP95: number;
  meanCoverage: number;
}

type CloudLobeCandidate = CloudLobeShape & {
  candidateId: number;
  localU: number;
  localV: number;
  score: number;
};

interface KillSpikeTelemetry {
  active: boolean;
  camera: KillSpikeCamera;
  capability: "webgl2" | "fallback";
  coverageMeanEstimate: number;
  coverageAreaTemporalP95Estimate: number;
  coverageSpatialP95Estimate: number;
  coverageTemporalP95Estimate: number;
  frameP95Ms: number;
  accumulationProbe: {
    additiveDraw: boolean;
    colorBufferFloat: boolean;
    floatBlend: boolean;
    framebufferComplete: boolean;
    multipleRenderTargets: boolean;
    readbackMode: "float" | "rgba8-copy" | "none";
    rgba16fTexture: boolean;
    verified: boolean;
    verdict: "pass" | "fail";
  };
  accumulationSize: [number, number];
  accumulationTargetCount: number;
  depthBinBoundary: number;
  depthBinMode: DepthBinMode;
  depthBinRolePriorMassEstimate: {
    far: number;
    near: number;
  };
  depthBinSegmentation: "view-ray-clipped" | "view-ray-overlap-partition";
  depthBinSubmittedLobeCount: {
    far: number;
    near: number;
  };
  compositeScissor: [number, number, number, number];
  candidateHash: string;
  candidateHashSchema: "fnv1a-instance-buffer-v3";
  candidateSetCount: number;
  candidateSeedRange: [number, number];
  coordinateSpace: "earth-local-v3";
  densityProfileVersion: "source-native-patch-height-field-v4";
  cameraMatrixSignature: string;
  cameraFrameId: string;
  earthOccludedCenterCount: number;
  frustumCulledCount: number;
  gpuP50Ms: number | null;
  gpuP95Ms: number | null;
  // Query-only audit trail. Keep the bounded, raw timer window alongside its
  // percentiles so a performance gate cannot hide a rare frame behind one
  // opaque aggregate number.
  gpuTimingSamplesMs: number[];
  gpuFieldResolution: [number, number];
  gpuFieldSource: string;
  gpuRenderer: string;
  gpuPhaseSampleCount: number;
  gpuPhaseP95Ms: {
    accumulation: number | null;
    clear: number | null;
    composite: number | null;
  };
  // Keep each phase's bounded raw window alongside the total window. A p95
  // without its sample distribution made it impossible to tell whether a
  // regression came from the typed-float clear, volume accumulation, or the
  // final composite pass.
  gpuPhaseTimingSamplesMs: {
    accumulation: number[];
    clear: number[];
    composite: number[];
  };
  gpuSampleCount: number;
  gpuDisjointResetCount: number;
  gpuPhaseSampleInterval: number;
  gpuTotalSampleInterval: number;
  gpuTimingScope: "rgba16f-depth-layer-accumulation-composite";
  gpuTimerSupported: boolean;
  gpuWarmupFrames: number;
  gpuWindowSize: number;
  layoutId: string;
  lobeCount: number;
  localVolumeFieldResolution: [number, number, number] | null;
  localVolumeFieldVersion: "v9-source-native-patch-oct-normal-directional-light-rgba8" | null;
  localVolumeTileCount: number;
  localVolumeTileProjectedBounds: Array<[number, number, number, number]>;
  localVolumeTileSignals: Array<{
    fieldTile: [number, number, number, number];
    meanDensity: number;
    peakDensity: number;
  }>;
  localVolumeAccumulationDrawCount: number;
  localVolumeSourceMaskTextureLookupCountPerPixel: number;
  localVolumeSunTextureLookupCountPerPixel: number;
  localVolumeTotalTextureLookupCountPerPixel: number;
  localVolumeViewSamples: number;
  localVolumeViewTextureLookupCountPerPixel: number;
  lobeHierarchy: Array<{
    id: number;
    isCarrier: boolean;
    parentId: number | null;
    role: CloudLobeRole;
  }>;
  hierarchyMetrics: {
    baseCarrierContainmentRatio: number;
    baseCarrierFootprintUnionCoverageRatio: number;
    baseCount: number;
    baseComponentCount: number;
    detailMeanElevation: number;
    maxBaseNearestNeighborDistance: number;
    maxBaseNormalizedNearestSeparation: number;
    maxNormalizedTangentAttachment: number;
    towerMeanElevation: number;
  };
  hierarchyHash: string;
  hierarchyVersion: "base-tower-detail-v4";
  hierarchyMembershipChurnRatio: number;
  hierarchyMembershipChurnTemporalP95: number;
  hierarchySubmittedLobeCount: number;
  hierarchySubmittedMembershipHash: string;
  hierarchySubmittedRoleCounts: Record<CloudLobeRole, number>;
  baseCarrierCount: number;
  generatorVersion: string;
  lobeRoleCounts: Record<CloudLobeRole, number>;
  orphanChildCount: number;
  parentedLobeCount: number;
  offset: [number, number];
  orientation: TruthHeader["orientation"];
  membershipChurnRatio: number;
  membershipChurnTemporalP95: number;
  occludedCount: number;
  opticalMassEstimate: number;
  physicalSize: [number, number];
  resolvedSize: [number, number];
  scissorEnabled: boolean;
  sourceSha256: string;
  rendererMode: HybridRendererMode;
  sourcePatchFootprintCoverageRatio: number;
  sourcePatchHeightP05: number;
  sourcePatchHeightP95: number;
  sourcePatchMeanCoverage: number;
  sourceUvBounds: [number, number, number, number];
  submittedLobeCount: number;
  submittedMembershipHash: string;
  submittedRoleCounts: Record<CloudLobeRole, number>;
  sunDirection: [number, number, number];
  sweepProgress: number;
  tier: KillSpikeTier;
  topologyDistanceSpace: "earth-local-tangent-normalized-radius";
  visibleCount: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthHybridKillSpike?: KillSpikeTelemetry;
  }
}

const TRUTH_SRC = "/assets/lubirth/textures/earth-cloud-field-nasa-lite-v3-phase12-patch-truth.bin";
const CLOUD_FIELD_GPU_SRC = "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png";
const CLOUD_FIELD_GPU_RESOLUTION: [number, number] = [2048, 1024];
const EARTH_DAY_SRC = "/assets/lubirth/textures/earth-day-nasa-lite-4k.webp";
const CLOUD_FIELD_OFFSET_X = 0.045;
const CLOUD_FIELD_OFFSET_Y = 0.018;
const FIXED_PATCH_UV = {
  u0: 370 / 512,
  u1: 405 / 512,
  v0: 105 / 256,
  v1: 138 / 256
} as const;
const CLOUD_BASE_RADIUS = 1.004;
const CLOUD_HEIGHT_RADIUS = 0.022;
const EARTH_RADIUS = 1.0;
const TAU = Math.PI * 2;
// The carrier is inflated by sqrt(2) so its ellipse contains the rectangular
// source patch. Local-volume tile coordinates stay in source-local [-1, 1]
// and are converted through this factor only when projected in world space.
const LOCAL_VOLUME_FIELD_HALF_EXTENT = 1 / Math.SQRT2;
// Allow pipeline creation, texture residency, and the browser compositor to
// settle before accepting timer-query samples. This is a steady-state GPU
// gate, not a startup-time metric.
const GPU_TIMING_WARMUP_FRAMES = 240;
const GPU_TIMING_WINDOW = 120;
const GPU_TIMING_MIN_REPORT_SAMPLES = 30;
// Phase instrumentation must be statistically useful as well as non-nested.
// Eight steady-state frames separates phase samples from the four-frame total
// cadence while yielding a 30-sample distribution inside the same acceptance
// run. The total and phase queries remain mutually exclusive per frame.
const GPU_PHASE_SAMPLE_INTERVAL = 8;
const GPU_PHASE_MIN_REPORT_SAMPLES = 30;
// A 120-sample p95 window must be collectible inside the acceptance test's
// 60-second budget even when headed System Chrome is cadence-limited to about
// 30fps. Sampling every fourth steady-state frame still spaces observations
// across the animation, while avoiding a test-only timeout before the gate can
// actually inspect the complete window.
const GPU_TOTAL_SAMPLE_INTERVAL = 4;
// Four subdivisions make the Earth-local source-tile edges share the same
// spherical vertices across neighbouring tiles. It is still a small fixed
// proxy mesh (96 vertices per instance), not a dense cloud surface.
const LOCAL_VOLUME_TILE_SUBDIVISIONS = 4;
// A local tile may use a smaller source-domain proxy than its selector cell.
// The threshold stays well below a visibly contributing Beer–Lambert column;
// the two-texel expansion retains the low-density shoulder so this is a
// conservative fill-rate optimisation, not a binary cloud cut-out.
// Match the fragment's conservative V3 source-footprint guard closely enough
// that an expanded proxy retains all contributing columns while not allocating
// a large rectangle for sub-visible haze that will be discarded before the
// four 3D volume reads.
const LOCAL_VOLUME_TILE_FOOTPRINT_DENSITY_FLOOR = 0.04;
const LOCAL_VOLUME_TILE_FOOTPRINT_MARGIN_TEXELS = 2;

function loadTexture(gl: WebGL2RenderingContext, src: string, isCancelled?: () => boolean) {
  return new Promise<WebGLTexture>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const texture = gl.createTexture();
      if (!texture) {
        reject(new Error(`Unable to create texture for ${src}.`));
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (isCancelled?.()) {
        gl.deleteTexture(texture);
        reject(new Error(`Texture load cancelled for ${src}.`));
        return;
      }
      resolve(texture);
    };
    image.onerror = () => reject(new Error(`Unable to load texture ${src}.`));
    image.src = src;
  });
}

function readParam(name: string) {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get(name);
}

function resolveCamera(): KillSpikeCamera {
  const camera = readParam("camera");
  return camera === "mid-oblique" || camera === "oblique" || camera === "sweep"
    ? camera
    : "near";
}

function resolveDepthBinMode(): DepthBinMode {
  return readParam("bins") === "1" ? 1 : 2;
}

function resolveRendererMode(): HybridRendererMode {
  // Keep the older analytic path as an explicit control. The route defaults to
  // the shallow local-volume candidate so the evidence URL cannot accidentally
  // keep showing the already-rejected one-lobe-per-proxy renderer.
  return readParam("renderer") === "ellipsoid" ? "ellipsoid" : "local-volume";
}

function resolveTier(width: number, height: number): KillSpikeTier {
  const param = readParam("tier");
  if (param === "mobile" || param === "desktop") {
    return param;
  }
  return Math.min(width, height) < 520 ? "mobile" : "desktop";
}

function resolveDebugMode() {
  return readParam("debug") ?? "";
}

function parseTruth(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  const header = JSON.parse(
    new TextDecoder().decode(bytes.subarray(4, 4 + headerLength))
  ) as TruthHeader;
  const payloadOffset = 4 + headerLength;
  if (
    header.magic !== "MLHC" ||
    header.version !== 1 ||
    header.layoutId !== "v3-r-depth-g-height-b-morphology-a-concavity" ||
    header.orientation !== "equirect-u-repeat-v-clamp-north-up" ||
    header.byteLength !== bytes.byteLength
  ) {
    throw new Error("Invalid hybrid cloud truth header.");
  }
  return { bytes, header, payloadOffset };
}

function resolveTruthSourceUvBounds(truth: ReturnType<typeof parseTruth>) {
  const bounds = truth.header.sourceUvBounds ?? [
    FIXED_PATCH_UV.u0,
    FIXED_PATCH_UV.v0,
    FIXED_PATCH_UV.u1,
    FIXED_PATCH_UV.v1
  ];
  const [u0, v0, u1, v1] = bounds;
  if (u1 <= u0 || v1 <= v0) {
    throw new Error("The local V3 truth patch has invalid source UV bounds.");
  }
  return { u0, u1, v0, v1 };
}

/**
 * The local-volume proxy deliberately covers the complete frozen V3 patch,
 * while the compact base hierarchy only supplies tower/ceiling support. Its
 * ellipse-union ratio therefore cannot stand in for real V3 cloud coverage.
 * Record the source-backed footprint and height span directly from the
 * immutable truth patch so a sparse selector cannot make the patch look like
 * either a full carrier or a synthetic empty volume.
 */
function summarizeSourcePatch(truth: ReturnType<typeof parseTruth>): SourcePatchSummary {
  const level = truth.header.levels[0];
  const supportedHeights: number[] = [];
  let footprintSamples = 0;
  let coverageTotal = 0;
  const sampleCount = level.width * level.height;
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const [depth, height] = sampleTruthLevel(truth, x, y);
      const coverage = resolveV3SourceCoverage(depth);
      coverageTotal += coverage;
      if (resolveV3SourceFootprintMask(coverage) > 0.5) {
        footprintSamples += 1;
        supportedHeights.push(height);
      }
    }
  }
  return {
    footprintCoverageRatio: footprintSamples / Math.max(sampleCount, 1),
    heightP05: percentile(supportedHeights, 0.05),
    heightP95: percentile(supportedHeights, 0.95),
    meanCoverage: coverageTotal / Math.max(sampleCount, 1)
  };
}

function seededNoise(value: number) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function fract(value: number) {
  return value - Math.floor(value);
}

function normalize3(vector: [number, number, number]): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function subtract3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(vector: [number, number, number], scale: number): [number, number, number] {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lengthSquared3(vector: [number, number, number]) {
  return dot3(vector, vector);
}

function uvToEarthDirection(fieldU: number, fieldV: number): [number, number, number] {
  const surfaceU = fract(fieldU - CLOUD_FIELD_OFFSET_X);
  const surfaceV = Math.min(Math.max(fieldV - CLOUD_FIELD_OFFSET_Y, 0.001), 0.999);
  const longitude = (surfaceU - 0.5) * TAU;
  const latitude = (0.5 - surfaceV) * Math.PI;
  const cosLatitude = Math.cos(latitude);
  return normalize3([
    cosLatitude * Math.cos(longitude),
    Math.sin(latitude),
    cosLatitude * Math.sin(longitude)
  ]);
}

function resolvePatchFrame() {
  const centerU = (FIXED_PATCH_UV.u0 + FIXED_PATCH_UV.u1) * 0.5;
  const centerV = (FIXED_PATCH_UV.v0 + FIXED_PATCH_UV.v1) * 0.5;
  const normal = uvToEarthDirection(centerU, centerV);
  const pole: [number, number, number] = Math.abs(normal[1]) > 0.96 ? [0, 0, 1] : [0, 1, 0];
  const east = normalize3(cross3(pole, normal));
  const north = normalize3(cross3(normal, east));
  return { east, normal, north };
}

function resolveSpikeSunDirection() {
  const patchFrame = resolvePatchFrame();
  return normalize3(add3(
    // A moderately elevated key light separates the white top from the
    // blue-grey cloud side without turning the low-sun rim into a second
    // silhouette. Topology and shading share this fixed Phase -1.1 fixture.
    add3(scale3(patchFrame.normal, 0.64), scale3(patchFrame.east, 0.6)),
    scale3(patchFrame.north, 0.32)
  ));
}

function makeInstanceBufferHash(instanceData: Float32Array) {
  let hash = 2166136261;
  const bytes = new Uint8Array(instanceData.buffer);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeLobeMembershipHash(lobes: CloudLobe[]) {
  let hash = 2166136261;
  for (const lobe of lobes) {
    hash ^= lobe.id & 0xff;
    hash = Math.imul(hash, 16777619);
    hash ^= (lobe.id >>> 8) & 0xff;
    hash = Math.imul(hash, 16777619);
    hash ^= (lobe.id >>> 16) & 0xff;
    hash = Math.imul(hash, 16777619);
    hash ^= (lobe.id >>> 24) & 0xff;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeHierarchyHash(lobes: CloudLobe[]) {
  let hash = 2166136261;
  const roleCode: Record<CloudLobeRole, number> = {
    base: 0,
    tower: 1,
    detail: 2
  };
  for (const lobe of lobes) {
    const values = [
      lobe.id,
      lobe.parentId ?? -1,
      roleCode[lobe.role],
      lobe.isCarrier ? 1 : 0
    ];
    for (const value of values) {
      for (let shift = 0; shift < 32; shift += 8) {
        hash ^= (value >>> shift) & 0xff;
        hash = Math.imul(hash, 16777619);
      }
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function countLobeRoles(lobes: CloudLobe[]): Record<CloudLobeRole, number> {
  const counts: Record<CloudLobeRole, number> = {
    base: 0,
    tower: 0,
    detail: 0
  };
  for (const lobe of lobes) {
    counts[lobe.role] += 1;
  }
  return counts;
}

function estimateOpticalMass(lobes: CloudLobe[]) {
  return lobes.reduce((sum, lobe) => (
    sum + 4 / 3 * Math.PI *
      lobe.radiusEast * lobe.radiusNorth * lobe.radiusUp * lobe.density
  ), 0);
}

function summarizeHierarchy(lobes: CloudLobe[]) {
  const byId = new Map(lobes.map((lobe) => [lobe.id, lobe]));
  // The carrier is an aggregate optical envelope, not a V3 base sample.  It
  // must never participate in the V3 base graph: otherwise its deliberately
  // broad support can hide a split base selection by connecting every node.
  const bases = lobes.filter((lobe) => lobe.role === "base" && !lobe.isCarrier);
  const carrier = lobes.find((lobe) => lobe.isCarrier) ?? null;
  const baseAdjacency = new Map<number, number[]>();
  let maxBaseNearestNeighborDistance = 0;
  let maxBaseNormalizedNearestSeparation = 0;
  for (const base of bases) {
    const neighbours = bases
      .filter((candidate) => candidate.id !== base.id)
      .map((candidate) => {
        const footprint = measureBaseFootprintSeparation(base, candidate);
        return {
          distance: footprint.distance,
          id: candidate.id,
          normalizedSeparation: footprint.normalizedSeparation
        };
      });
    const nearestDistance = neighbours.length > 0
      ? Math.min(...neighbours.map((neighbour) => neighbour.distance))
      : 0;
    const nearestNormalizedSeparation = neighbours.length > 0
      ? Math.min(...neighbours.map((neighbour) => neighbour.normalizedSeparation))
      : 0;
    maxBaseNearestNeighborDistance = Math.max(
      maxBaseNearestNeighborDistance,
      nearestDistance
    );
    maxBaseNormalizedNearestSeparation = Math.max(
      maxBaseNormalizedNearestSeparation,
      nearestNormalizedSeparation
    );
    baseAdjacency.set(
      base.id,
      neighbours
        .filter((neighbour) => neighbour.normalizedSeparation <= 1.05)
        .map((neighbour) => neighbour.id)
    );
  }
  const visitedBaseIds = new Set<number>();
  let baseComponentCount = 0;
  for (const base of bases) {
    if (visitedBaseIds.has(base.id)) {
      continue;
    }
    baseComponentCount += 1;
    const pending = [base.id];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (visitedBaseIds.has(id)) {
        continue;
      }
      visitedBaseIds.add(id);
      pending.push(...(baseAdjacency.get(id) ?? []));
    }
  }
  let maxNormalizedTangentAttachment = 0;
  let towerElevation = 0;
  let towerCount = 0;
  let detailElevation = 0;
  let detailCount = 0;
  for (const lobe of lobes) {
    if (lobe.parentId == null) {
      continue;
    }
    const parent = byId.get(lobe.parentId);
    if (!parent) {
      continue;
    }
    const delta = subtract3(lobe.center, parent.center);
    const elevation = Math.max(dot3(delta, parent.normal), 0);
    const tangent = subtract3(delta, scale3(parent.normal, dot3(delta, parent.normal)));
    const normalizedAttachment = Math.hypot(
      dot3(tangent, parent.east) / Math.max(parent.radiusEast, 0.0001),
      dot3(tangent, parent.north) / Math.max(parent.radiusNorth, 0.0001)
    );
    maxNormalizedTangentAttachment = Math.max(
      maxNormalizedTangentAttachment,
      normalizedAttachment
    );
    if (lobe.role === "tower") {
      towerElevation += elevation;
      towerCount += 1;
    } else if (lobe.role === "detail") {
      detailElevation += elevation;
      detailCount += 1;
    }
  }
  let baseCarrierContainmentRatio = 0;
  let baseCarrierFootprintUnionCoverageRatio = 0;
  if (carrier && bases.length > 0) {
    const carrierEllipse: HybridEllipse2D = {
      center: [0, 0],
      radiusEast: carrier.radiusEast,
      radiusNorth: carrier.radiusNorth
    };
    const baseEllipses = bases.map((base): HybridEllipse2D => {
      const delta = subtract3(base.center, carrier.center);
      const { tangentA } = resolveLobeTangentAxes(base);
      return {
        center: [dot3(delta, carrier.east), dot3(delta, carrier.north)],
        radiusEast: base.radiusEast,
        radiusNorth: base.radiusNorth,
        rotationRadians: Math.atan2(
          dot3(tangentA, carrier.north),
          dot3(tangentA, carrier.east)
        )
      };
    });
    let containedBaseCount = 0;
    for (const [index, base] of bases.entries()) {
      const baseEllipse = baseEllipses[index];
      const delta = subtract3(base.center, carrier.center);
      // Use the carrier's actual normalized ellipse rather than its support
      // function. A support radius is only a directional boundary value and
      // would incorrectly accept diagonal centers in an anisotropic carrier.
      // The source field is a spherical shell. Comparing the base to the
      // carrier along the carrier's tangent-plane normal counts the sphere's
      // geometric sagitta at the patch corners as an artificial downward
      // displacement. Compare radial shell coordinates instead: this is the
      // same vertical axis used by the local-volume texture and its shader.
      const verticalDistance = Math.abs(
        Math.sqrt(lengthSquared3(base.center)) -
        Math.sqrt(lengthSquared3(carrier.center))
      );
      if (isPointInsideHybridEllipse(baseEllipse.center, carrierEllipse, 0.0001) &&
        verticalDistance <= carrier.radiusUp + 0.0001) {
        containedBaseCount += 1;
      }
    }
    baseCarrierContainmentRatio = containedBaseCount / bases.length;
    baseCarrierFootprintUnionCoverageRatio = measureHybridEllipseUnionCoverage(
      carrierEllipse,
      baseEllipses
    );
  }
  return {
    baseCarrierContainmentRatio,
    baseCarrierFootprintUnionCoverageRatio,
    baseCount: bases.length,
    baseComponentCount,
    detailMeanElevation: detailElevation / Math.max(detailCount, 1),
    maxBaseNearestNeighborDistance,
    maxBaseNormalizedNearestSeparation,
    maxNormalizedTangentAttachment,
    towerMeanElevation: towerElevation / Math.max(towerCount, 1)
  };
}

function calculateMembershipChurn(previousIds: Set<number> | null, lobes: CloudLobe[]) {
  if (!previousIds) {
    return 0;
  }
  const currentIds = new Set(lobes.map((lobe) => lobe.id));
  let symmetricDifference = 0;
  for (const id of previousIds) {
    if (!currentIds.has(id)) {
      symmetricDifference += 1;
    }
  }
  for (const id of currentIds) {
    if (!previousIds.has(id)) {
      symmetricDifference += 1;
    }
  }
  const unionSize = new Set([...previousIds, ...currentIds]).size;
  return symmetricDifference / Math.max(unionSize, 1);
}

function earthLocalTangentDistance(
  origin: Pick<CloudLobeShape, "center" | "east" | "normal" | "north">,
  point: Pick<CloudLobeShape, "center">
) {
  const centerDelta = subtract3(point.center, origin.center);
  const tangentDelta = subtract3(
    centerDelta,
    scale3(origin.normal, dot3(centerDelta, origin.normal))
  );
  return Math.hypot(
    dot3(tangentDelta, origin.east),
    dot3(tangentDelta, origin.north)
  );
}

function resolveLobeTangentAxes(lobe: CloudLobe) {
  const phase = lobe.morphology * 5.7 + dot3(lobe.center, [11.3, 17.1, 7.9]);
  const angle = phase + lobe.concavity * Math.PI;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return {
    tangentA: add3(scale3(lobe.east, ca), scale3(lobe.north, sa)),
    tangentB: subtract3(scale3(lobe.north, ca), scale3(lobe.east, sa))
  };
}

function measureBaseFootprintSeparation(origin: CloudLobe, point: CloudLobe) {
  const sharedNormal = normalize3(add3(origin.normal, point.normal));
  const centerDelta = subtract3(point.center, origin.center);
  const tangentDelta = subtract3(
    centerDelta,
    scale3(sharedNormal, dot3(centerDelta, sharedNormal))
  );
  const distance = Math.sqrt(lengthSquared3(tangentDelta));
  if (distance <= 0.000001) {
    return { distance: 0, normalizedSeparation: 0 };
  }
  const direction = scale3(tangentDelta, 1 / distance);
  const supportRadius = (lobe: CloudLobe) => {
    const { tangentA, tangentB } = resolveLobeTangentAxes(lobe);
    return Math.hypot(
      dot3(direction, tangentA) * lobe.radiusEast,
      dot3(direction, tangentB) * lobe.radiusNorth
    );
  };
  const combinedSupport = supportRadius(origin) + supportRadius(point);
  return {
    distance,
    normalizedSeparation: distance / Math.max(combinedSupport, 0.0001)
  };
}

function multiplyMat4(a: number[], b: number[]) {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function createLookAt(eye: [number, number, number], target: [number, number, number]) {
  const forward = normalize3(subtract3(target, eye));
  const right = normalize3(cross3(forward, [0, 1, 0]));
  const up = cross3(right, forward);
  return [
    right[0], up[0], -forward[0], 0,
    right[1], up[1], -forward[1], 0,
    right[2], up[2], -forward[2], 0,
    -dot3(right, eye), -dot3(up, eye), dot3(forward, eye), 1
  ];
}

function createPerspective(fovRadians: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovRadians / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ];
}

function resolveCameraFrame(camera: KillSpikeCamera, aspect: number, sweepProgress = 0) {
  const patch = resolvePatchFrame();
  const nearTarget = add3(scale3(patch.normal, 0.985), scale3(patch.north, -0.05));
  const nearEye = add3(scale3(patch.normal, 1.48), scale3(patch.north, 0.02));
  const obliqueTarget = add3(
    add3(scale3(patch.normal, 1.01), scale3(patch.east, 0.005)),
    scale3(patch.north, 0.0)
  );
  const obliqueEye = add3(
    add3(scale3(patch.normal, 1.25), scale3(patch.east, 0.06)),
    scale3(patch.north, 0.52)
  );
  const rawMix = camera === "sweep"
    ? Math.min(Math.max(sweepProgress, 0), 1)
    : camera === "oblique"
      ? 1
      : camera === "mid-oblique"
        ? 0.5
      : 0;
  const cameraMix = rawMix * rawMix * (3 - 2 * rawMix);
  const mixVector = (
    a: [number, number, number],
    b: [number, number, number]
  ): [number, number, number] => [
    a[0] + (b[0] - a[0]) * cameraMix,
    a[1] + (b[1] - a[1]) * cameraMix,
    a[2] + (b[2] - a[2]) * cameraMix
  ];
  const target = mixVector(nearTarget, obliqueTarget);
  const eye = mixVector(nearEye, obliqueEye);
  // The oblique frame keeps enough top surface to inspect the same mass while
  // the carrier's physical depth exposes its side and underside.
  // Mid-oblique is an inspection frame, not an extra production camera. A
  // tighter lens keeps the 35-55 degree viewpoint focused on the fixed V3
  // patch so tower parallax and internal attenuation are judged at 1x rather
  // than disappearing into a full-Earth composition.
  const fovDegrees = camera === "mid-oblique"
    ? 34
    : 50 + (40 - 50) * cameraMix;
  const fov = fovDegrees * Math.PI / 180;
  return {
    eye,
    id: camera === "sweep"
      ? "sweep-earth-local-near-oblique"
      : `${camera}-earth-local-fov${Math.round(fovDegrees)}`,
    viewProjection: multiplyMat4(
      createPerspective(fov, aspect, 0.05, 8),
      createLookAt(eye, target)
    )
  };
}

function projectPoint(matrix: Float32Array | number[], point: [number, number, number]) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (clipW <= 0.0001) {
    return null;
  }
  return [clipX / clipW, clipY / clipW] as [number, number];
}

interface LobeVisibilityEstimate {
  coverage: number;
  earthOccludedCenterCount: number;
  frustumCulledCount: number;
  projectedCount: number;
  spatialP95: number;
}

interface ProjectedProxyBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

function resolveLocalVolumeTileShellCorners(lobe: CloudLobe) {
  const fieldTile = lobe.fieldTile;
  if (!fieldTile) {
    return null;
  }
  const sourceRadius = Math.sqrt(lengthSquared3(lobe.center)) + lobe.radiusUp;
  const corners: [number, number, number][] = [];
  for (const localY of [fieldTile[1], fieldTile[3]]) {
    for (const localX of [fieldTile[0], fieldTile[2]]) {
      const fieldU = FIXED_PATCH_UV.u0 +
        (localX * 0.5 + 0.5) * (FIXED_PATCH_UV.u1 - FIXED_PATCH_UV.u0);
      const fieldV = FIXED_PATCH_UV.v0 +
        (localY * 0.5 + 0.5) * (FIXED_PATCH_UV.v1 - FIXED_PATCH_UV.v0);
      corners.push(scale3(uvToEarthDirection(fieldU, fieldV), sourceRadius));
    }
  }
  return corners;
}

function createProxyCorners(subdivisions: number) {
  const corners: number[] = [];
  for (let y = 0; y < subdivisions; y += 1) {
    const y0 = y / subdivisions * 2 - 1;
    const y1 = (y + 1) / subdivisions * 2 - 1;
    for (let x = 0; x < subdivisions; x += 1) {
      const x0 = x / subdivisions * 2 - 1;
      const x1 = (x + 1) / subdivisions * 2 - 1;
      corners.push(
        x0, y0,
        x1, y0,
        x0, y1,
        x0, y1,
        x1, y0,
        x1, y1
      );
    }
  }
  return new Float32Array(corners);
}

function makeProxyAxes(lobe: CloudLobe, eye: [number, number, number]) {
  const fieldTile = lobe.fieldTile ?? [-1, -1, 1, 1];
  // A local-volume tile is already reconstructed at the real spherical
  // position of its source interval. Do not apply the source interval a
  // second time here: that would slide it back across the carrier tangent
  // plane and make an oblique camera sample a different V3 column.
  const isEarthLocalFieldTile = lobe.fieldTile != null;
  const tileCenterX = isEarthLocalFieldTile
    ? 0
    : (fieldTile[0] + fieldTile[2]) * 0.5;
  const tileCenterY = isEarthLocalFieldTile
    ? 0
    : (fieldTile[1] + fieldTile[3]) * 0.5;
  const tileRadiusEast = isEarthLocalFieldTile
    ? lobe.radiusEast
    : lobe.radiusEast * Math.max((fieldTile[2] - fieldTile[0]) * 0.5, 0.0001);
  const tileRadiusNorth = isEarthLocalFieldTile
    ? lobe.radiusNorth
    : lobe.radiusNorth * Math.max((fieldTile[3] - fieldTile[1]) * 0.5, 0.0001);
  const center = isEarthLocalFieldTile
    ? lobe.center
    : add3(
      add3(lobe.center, scale3(lobe.east, tileCenterX * lobe.radiusEast)),
      scale3(lobe.north, tileCenterY * lobe.radiusNorth)
    );
  const normal = normalize3(lobe.center);
  if (isEarthLocalFieldTile) {
    // A source tile is a patch of the real spherical cloud shell, not a
    // billboard. Put its proxy on the outer shell and retain its Earth-local
    // tangent axes. This keeps its projected trapezoid tied to the same V3
    // coordinates that the fragment ray samples, especially at oblique views.
    const shellCenter = add3(center, scale3(normal, lobe.radiusUp));
    return {
      center: shellCenter,
      extentRight: tileRadiusEast * 1.02,
      extentUp: tileRadiusNorth * 1.02,
      proxyRight: lobe.east,
      proxyUp: lobe.north,
      toCamera: normalize3(subtract3(eye, shellCenter))
    };
  }
  const { tangentA, tangentB } = resolveLobeTangentAxes(lobe);
  const toCamera = normalize3(subtract3(eye, center));
  const worldUp: [number, number, number] = Math.abs(toCamera[1]) > 0.96 ? [0, 0, 1] : [0, 1, 0];
  const proxyRight = normalize3(cross3(worldUp, toCamera));
  const proxyUp = normalize3(cross3(toCamera, proxyRight));
  const rotatedExtentRight = Math.hypot(
    dot3(tangentA, proxyRight) * tileRadiusEast,
    dot3(tangentB, proxyRight) * tileRadiusNorth,
    dot3(normal, proxyRight) * lobe.radiusUp
  );
  const rotatedExtentUp = Math.hypot(
    dot3(tangentA, proxyUp) * tileRadiusEast,
    dot3(tangentB, proxyUp) * tileRadiusNorth,
    dot3(normal, proxyUp) * lobe.radiusUp
  );
  // Keep CPU bounds in lockstep with the vertex shader's source-patch box. A
  // local-volume tile never evaluates the artist-rotated analytic ellipsoid,
  // so including that wider control bound would pay pure fill cost for empty
  // pixels and make the V3 patch look like a single screen-space card.
  const fieldExtentRight =
    Math.abs(dot3(lobe.east, proxyRight)) * tileRadiusEast +
    Math.abs(dot3(lobe.north, proxyRight)) * tileRadiusNorth +
    Math.abs(dot3(normal, proxyRight)) * lobe.radiusUp;
  const fieldExtentUp =
    Math.abs(dot3(lobe.east, proxyUp)) * tileRadiusEast +
    Math.abs(dot3(lobe.north, proxyUp)) * tileRadiusNorth +
    Math.abs(dot3(normal, proxyUp)) * lobe.radiusUp;
  // The local-volume shell itself is static. Do not add a cosmetic carrier
  // "breathe" displacement here: it is not part of the ray/sphere geometry,
  // forces a larger scissor, and reads as screen-space drift in the sweep.
  // A narrow support margin remains for the curved shell's projected bounds.
  const extentRight = (isEarthLocalFieldTile
    ? fieldExtentRight
    : Math.max(rotatedExtentRight, fieldExtentRight)) * 1.015;
  const extentUp = (isEarthLocalFieldTile
    ? fieldExtentUp
    : Math.max(rotatedExtentUp, fieldExtentUp)) * 1.015;
  return { center, extentRight, extentUp, proxyRight, proxyUp, toCamera };
}

function estimateProjectedProxyBounds(
  lobe: CloudLobe,
  eye: [number, number, number],
  viewProjection: Float32Array | number[],
  width: number,
  height: number
): ProjectedProxyBounds | null {
  const localVolumeCorners = resolveLocalVolumeTileShellCorners(lobe);
  const { center, extentRight, extentUp, proxyRight, proxyUp } = makeProxyAxes(lobe, eye);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let projected = 0;
  const corners = localVolumeCorners ?? [
    add3(add3(center, scale3(proxyRight, -extentRight)), scale3(proxyUp, -extentUp)),
    add3(add3(center, scale3(proxyRight, extentRight)), scale3(proxyUp, -extentUp)),
    add3(add3(center, scale3(proxyRight, -extentRight)), scale3(proxyUp, extentUp)),
    add3(add3(center, scale3(proxyRight, extentRight)), scale3(proxyUp, extentUp))
  ];
  for (const corner of corners) {
    const point = projectPoint(viewProjection, corner);
    if (!point) {
      continue;
    }
    projected += 1;
    const x = (point[0] * 0.5 + 0.5) * width;
    const y = (point[1] * 0.5 + 0.5) * height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (projected === 0) {
    return null;
  }
  return { maxX, maxY, minX, minY };
}

function estimateProjectedVisibility(
  allLobes: CloudLobe[],
  submittedLobes: CloudLobe[],
  eye: [number, number, number],
  viewProjection: Float32Array,
  width: number,
  height: number
): LobeVisibilityEstimate {
  const pixels = Math.max(width * height, 1);
  const gridWidth = 96;
  const gridHeight = 54;
  const overdrawGrid = new Uint16Array(gridWidth * gridHeight);
  let coverage = 0;
  let earthOccludedCenterCount = 0;
  let frustumCulledCount = allLobes.length - submittedLobes.length;
  let projectedCount = 0;
  for (const lobe of allLobes) {
    earthOccludedCenterCount += isEarthOccluded(eye, lobe.center) ? 1 : 0;
  }
  for (const lobe of submittedLobes) {
    const proxyBounds = estimateProjectedProxyBounds(lobe, eye, viewProjection, width, height);
    if (!proxyBounds) {
      frustumCulledCount += 1;
      continue;
    }
    const minX = Math.max(0, Math.floor(proxyBounds.minX));
    const maxX = Math.min(width, Math.ceil(proxyBounds.maxX));
    const minY = Math.max(0, Math.floor(proxyBounds.minY));
    const maxY = Math.min(height, Math.ceil(proxyBounds.maxY));
    if (maxX <= 0 || maxY <= 0 || minX >= width || minY >= height) {
      frustumCulledCount += 1;
      continue;
    }
    coverage += Math.max(maxX - minX, 0) * Math.max(maxY - minY, 0) / pixels;
    const gx0 = Math.max(0, Math.floor(minX / width * gridWidth));
    const gx1 = Math.min(gridWidth, Math.ceil(maxX / width * gridWidth));
    const gy0 = Math.max(0, Math.floor(minY / height * gridHeight));
    const gy1 = Math.min(gridHeight, Math.ceil(maxY / height * gridHeight));
    for (let gy = gy0; gy < gy1; gy += 1) {
      for (let gx = gx0; gx < gx1; gx += 1) {
        overdrawGrid[gy * gridWidth + gx] += 1;
      }
    }
    projectedCount += 1;
  }
  const sortedOverdraw = Array.from(overdrawGrid).sort((a, b) => a - b);
  return {
    coverage,
    earthOccludedCenterCount,
    frustumCulledCount,
    projectedCount,
    spatialP95: sortedOverdraw[Math.floor((sortedOverdraw.length - 1) * 0.95)] ?? 0
  };
}

function isEarthOccluded(eye: [number, number, number], point: [number, number, number]) {
  const ray = subtract3(point, eye);
  const rayLengthSquared = lengthSquared3(ray);
  if (rayLengthSquared <= 0) {
    return false;
  }
  const closestT = Math.min(Math.max(-dot3(eye, ray) / rayLengthSquared, 0), 1);
  if (closestT <= 0 || closestT >= 1) {
    return false;
  }
  const closest = add3(eye, scale3(ray, closestT));
  return lengthSquared3(closest) < EARTH_RADIUS * EARTH_RADIUS;
}

function isConservativelySubmittable(
  lobe: CloudLobe,
  eye: [number, number, number],
  viewProjection: Float32Array
) {
  const center = projectPoint(viewProjection, lobe.center);
  if (!center) {
    return false;
  }
  const boundRadius = Math.max(lobe.radiusEast, lobe.radiusNorth, lobe.radiusUp) * 1.9;
  const eastPoint = projectPoint(viewProjection, add3(lobe.center, scale3(lobe.east, boundRadius)));
  const northPoint = projectPoint(viewProjection, add3(lobe.center, scale3(lobe.north, boundRadius)));
  const normalPoint = projectPoint(viewProjection, add3(lobe.center, scale3(lobe.normal, boundRadius)));
  const projectedRadius = Math.max(
    eastPoint ? Math.hypot(eastPoint[0] - center[0], eastPoint[1] - center[1]) : 0.08,
    northPoint ? Math.hypot(northPoint[0] - center[0], northPoint[1] - center[1]) : 0.08,
    normalPoint ? Math.hypot(normalPoint[0] - center[0], normalPoint[1] - center[1]) : 0.08,
    0.04
  );
  if (
    center[0] < -1 - projectedRadius ||
    center[0] > 1 + projectedRadius ||
    center[1] < -1 - projectedRadius ||
    center[1] > 1 + projectedRadius
  ) {
    return false;
  }

  const ray = subtract3(lobe.center, eye);
  const rayLengthSquared = lengthSquared3(ray);
  if (rayLengthSquared <= 0) {
    return true;
  }
  const closestT = Math.min(Math.max(-dot3(eye, ray) / rayLengthSquared, 0), 1);
  if (closestT <= 0 || closestT >= 1) {
    return true;
  }
  const closest = add3(eye, scale3(ray, closestT));
  const closestDistance = Math.sqrt(lengthSquared3(closest));
  return closestDistance > EARTH_RADIUS - boundRadius * 1.35;
}

function estimateCompositeScissor(
  lobes: CloudLobe[],
  eye: [number, number, number],
  viewProjection: Float32Array,
  width: number,
  height: number
): [number, number, number, number] {
  if (lobes.length === 0) {
    return [0, 0, width, height];
  }
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const lobe of lobes) {
    const proxyBounds = estimateProjectedProxyBounds(lobe, eye, viewProjection, width, height);
    if (!proxyBounds) {
      continue;
    }
    minX = Math.min(minX, proxyBounds.minX);
    minY = Math.min(minY, proxyBounds.minY);
    maxX = Math.max(maxX, proxyBounds.maxX);
    maxY = Math.max(maxY, proxyBounds.maxY);
  }
  // Keep an explicit raster/filter guard so the half-resolution composite
  // remains conservative under oblique motion.
  const padding = 12;
  const x = Math.max(0, Math.floor(minX - padding));
  const y = Math.max(0, Math.floor(minY - padding));
  const right = Math.min(width, Math.ceil(maxX + padding));
  const top = Math.min(height, Math.ceil(maxY + padding));
  return [x, y, Math.max(1, right - x), Math.max(1, top - y)];
}

function estimateLocalVolumeCompositeScissor(
  field: LocalVolumeField,
  carrier: CloudLobe,
  viewProjection: Float32Array,
  width: number,
  height: number
): [number, number, number, number] | null {
  if (field.supportCells.length === 0) {
    return null;
  }
  const shellRadius = Math.sqrt(lengthSquared3(carrier.center));
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let projected = 0;
  for (const cell of field.supportCells) {
    for (const localY of [cell.localBounds[1], cell.localBounds[3]]) {
      for (const localX of [cell.localBounds[0], cell.localBounds[2]]) {
        const sourceU = FIXED_PATCH_UV.u0 +
          (localX * 0.5 + 0.5) * (FIXED_PATCH_UV.u1 - FIXED_PATCH_UV.u0);
        const sourceV = FIXED_PATCH_UV.v0 +
          (localY * 0.5 + 0.5) * (FIXED_PATCH_UV.v1 - FIXED_PATCH_UV.v0);
        const direction = uvToEarthDirection(sourceU, sourceV);
        for (const localZ of [cell.localZMin, cell.localZMax]) {
          const point = projectPoint(
            viewProjection,
            scale3(direction, shellRadius + localZ * carrier.radiusUp)
          );
          if (!point) {
            continue;
          }
          projected += 1;
          const x = (point[0] * 0.5 + 0.5) * width;
          const y = (point[1] * 0.5 + 0.5) * height;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
  }
  if (projected === 0) {
    return null;
  }
  // The volume's source-domain threshold is lower than the visible tau
  // cutoff and each macro cell includes a one-voxel in-plane / vertical
  // margin. Keep one further target-space guard for bilinear field sampling
  // and half-resolution reconstruction.
  const padding = 16;
  const left = Math.max(0, Math.floor(minX - padding));
  const bottom = Math.max(0, Math.floor(minY - padding));
  const right = Math.min(width, Math.ceil(maxX + padding));
  const top = Math.min(height, Math.ceil(maxY + padding));
  return [left, bottom, Math.max(1, right - left), Math.max(1, top - bottom)];
}

function scaleScissorToTarget(
  scissor: [number, number, number, number],
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): [number, number, number, number] {
  const scaleX = targetWidth / Math.max(sourceWidth, 1);
  const scaleY = targetHeight / Math.max(sourceHeight, 1);
  const left = Math.max(0, Math.floor(scissor[0] * scaleX));
  const bottom = Math.max(0, Math.floor(scissor[1] * scaleY));
  const right = Math.min(targetWidth, Math.ceil((scissor[0] + scissor[2]) * scaleX));
  const top = Math.min(targetHeight, Math.ceil((scissor[1] + scissor[3]) * scaleY));
  return [
    left,
    bottom,
    Math.max(1, right - left),
    Math.max(1, top - bottom)
  ];
}

function writeInstanceData(lobes: CloudLobe[], instanceData: Float32Array) {
  const roleCode: Record<CloudLobeRole, number> = {
    base: 0,
    tower: 1,
    detail: 2
  };
  instanceData.fill(0);
  lobes.forEach((lobe, index) => {
    const offset = index * 24;
    instanceData[offset] = lobe.center[0];
    instanceData[offset + 1] = lobe.center[1];
    instanceData[offset + 2] = lobe.center[2];
    instanceData[offset + 3] = lobe.radiusEast;
    instanceData[offset + 4] = lobe.east[0];
    instanceData[offset + 5] = lobe.east[1];
    instanceData[offset + 6] = lobe.east[2];
    instanceData[offset + 7] = lobe.radiusNorth;
    instanceData[offset + 8] = lobe.north[0];
    instanceData[offset + 9] = lobe.north[1];
    instanceData[offset + 10] = lobe.north[2];
    instanceData[offset + 11] = lobe.radiusUp;
    instanceData[offset + 12] = lobe.density;
    instanceData[offset + 13] = lobe.height;
    instanceData[offset + 14] = lobe.morphology;
    instanceData[offset + 15] = lobe.concavity;
    instanceData[offset + 16] = roleCode[lobe.role];
    instanceData[offset + 17] = lobe.parentId ?? -1;
    instanceData[offset + 18] = lobe.id;
    instanceData[offset + 19] = lobe.isCarrier ? 1 : 0;
    const fieldTile = lobe.fieldTile ?? [-1, -1, 1, 1];
    instanceData[offset + 20] = fieldTile[0];
    instanceData[offset + 21] = fieldTile[1];
    instanceData[offset + 22] = fieldTile[2];
    instanceData[offset + 23] = fieldTile[3];
  });
}

function createInstanceData(lobes: CloudLobe[]) {
  const instanceData = new Float32Array(lobes.length * 24);
  writeInstanceData(lobes, instanceData);
  return instanceData;
}

function sampleTruthLevel(
  truth: ReturnType<typeof parseTruth>,
  x: number,
  y: number
): [number, number, number, number] {
  const level = truth.header.levels[0];
  const isLocalPatch = Boolean(truth.header.sourceUvBounds);
  const x0 = isLocalPatch
    ? Math.min(Math.max(Math.floor(x), 0), level.width - 1)
    : Math.floor(x);
  const y0 = Math.min(Math.max(Math.floor(y), 0), level.height - 1);
  const x1 = isLocalPatch
    ? Math.min(x0 + 1, level.width - 1)
    : (x0 + 1) % level.width;
  const y1 = Math.min(y0 + 1, level.height - 1);
  const tx = x - Math.floor(x);
  const ty = y - Math.floor(y);
  const read = (xx: number, yy: number) => {
    const wrappedX = ((xx % level.width) + level.width) % level.width;
    const index = truth.payloadOffset + level.rgbaOffset + (yy * level.width + wrappedX) * 4;
    return [
      truth.bytes[index] / 255,
      truth.bytes[index + 1] / 255,
      truth.bytes[index + 2] / 255,
      truth.bytes[index + 3] / 255
    ] as const;
  };
  const a = read(x0, y0);
  const b = read(x1, y0);
  const c = read(x0, y1);
  const d = read(x1, y1);
  return [0, 1, 2, 3].map((channel) => (
    a[channel] * (1 - tx) * (1 - ty) +
    b[channel] * tx * (1 - ty) +
    c[channel] * (1 - tx) * ty +
    d[channel] * tx * ty
  )) as [number, number, number, number];
}

function buildLobes(
  truth: ReturnType<typeof parseTruth>,
  tier: KillSpikeTier
) {
  const topologySunDirection = resolveSpikeSunDirection();
  const level = truth.header.levels[0];
  const sourceUvBounds = resolveTruthSourceUvBounds(truth);
  // The local-density experiment is a radial cloud shell, not a tall tangent
  // box.  Keeping its inner boundary just above the Earth lets the V3 vertical
  // profile expose a genuine cloud base, while the outer boundary leaves room
  // for a readable top and sunward side at the inspection cameras.
  // The old 0.052R desktop shell could only read as a tinted surface at the
  // required mid-oblique inspection frame. This remains a deliberately
  // shallow query-only cloud layer, but gives V3 height/tower columns enough
  // physical interval to expose a top, side, and blue-grey base.
  const localVolumeHalfHeight = tier === "mobile" ? 0.033 : 0.045;
  const candidateBudget = tier === "mobile" ? 320 : 1000;
  const candidates: CloudLobeCandidate[] = [];
  const densityCutoff = tier === "mobile" ? 0.16 : 0.12;
  const patchWidth = level.width;
  const patchHeight = level.height;
  const attempts = candidateBudget * (tier === "mobile" ? 22 : 18);
  for (let index = 0; index < attempts; index += 1) {
    const u01 = fract(index * 0.61803398875 + seededNoise(index * 13.17) * 0.19);
    const v01 = fract(index * 0.75487766625 + seededNoise(index * 7.91 + 3.4) * 0.17);
    const x = u01 * Math.max(patchWidth - 1, 1);
    const y = v01 * Math.max(patchHeight - 1, 1);
    const [depth, height, morphology, concavity] = sampleTruthLevel(truth, x, y);
    if (depth < densityCutoff) {
      continue;
    }
    const acceptance = Math.min(Math.max((depth - densityCutoff) / Math.max(0.001, 0.86 - densityCutoff), 0), 1);
    if (seededNoise(index * 29.31 + 5.7) > 0.22 + acceptance * 0.86) {
      continue;
    }
    const noise = seededNoise(index * 31.31 + depth * 131.0);
    const jitterEast = (seededNoise(index * 71.17 + y * 0.37) - 0.5) * 0.038;
    const jitterNorth = (seededNoise(index * 19.13 + x * 0.41) - 0.5) * 0.032;
    const fieldU = sourceUvBounds.u0 + (x + 0.5) / level.width *
      (sourceUvBounds.u1 - sourceUvBounds.u0);
    const fieldV = sourceUvBounds.v0 + (y + 0.5) / level.height *
      (sourceUvBounds.v1 - sourceUvBounds.v0);
    const normal = uvToEarthDirection(fieldU, fieldV);
    const pole: [number, number, number] = Math.abs(normal[1]) > 0.96 ? [0, 0, 1] : [0, 1, 0];
    const east = normalize3(cross3(pole, normal));
    const north = normalize3(cross3(normal, east));
    const radius = CLOUD_BASE_RADIUS + height * CLOUD_HEIGHT_RADIUS * 0.48;
    const baseCenter = [normal[0] * radius, normal[1] * radius, normal[2] * radius] as [
      number,
      number,
      number
    ];
    const center = add3(add3(baseCenter, scale3(east, jitterEast)), scale3(north, jitterNorth));
    candidates.push({
      candidateId: index,
      center,
      concavity,
      density: depth,
      east,
      height,
      morphology,
      normal,
      north,
      radiusEast: 0.0048 + depth * 0.0072 + morphology * 0.0062,
      radiusNorth: 0.0048 + height * 0.012 + concavity * 0.005,
      radiusUp: 0.011 + height * 0.034 + morphology * 0.005,
      localU: u01,
      localV: v01,
      score: depth * 0.62 + height * 0.22 + morphology * 0.12 + noise * 0.04,
      sourceUv: [fieldU, fieldV]
    });
  }
  const byMass = [...candidates].sort((a, b) => b.score - a.score);
  const byTower = [...candidates].sort((a, b) => (
    (b.height * 0.58 + b.morphology * 0.28 + b.density * 0.14) -
    (a.height * 0.58 + a.morphology * 0.28 + a.density * 0.14)
  ));
  const byEdge = [...candidates].sort((a, b) => (
    (b.morphology * 0.5 + b.concavity * 0.32 + b.score * 0.18) -
    (a.morphology * 0.5 + a.concavity * 0.32 + a.score * 0.18)
  ));
  const selected: CloudLobe[] = [];
  const usedCandidateIds = new Set<number>();
  const roleCode: Record<CloudLobeRole, number> = {
    base: 0,
    tower: 1,
    detail: 2
  };
  const makeLobe = (
    candidate: CloudLobeCandidate,
    role: CloudLobeRole,
    parent: CloudLobe | null
  ): CloudLobe => {
    const isBase = role === "base";
    const isTower = role === "tower";
    const elevation = isTower
      ? 0.006 + candidate.height * 0.014
      : role === "detail"
        ? 0.002 + candidate.height * 0.004
        : 0;
    const normal = parent?.normal ?? candidate.normal;
    const east = parent?.east ?? candidate.east;
    const north = parent?.north ?? candidate.north;
    const parentDelta = parent ? subtract3(candidate.center, parent.center) : [0, 0, 0] as [
      number,
      number,
      number
    ];
    const rawTangentDelta = parent
      ? subtract3(parentDelta, scale3(normal, dot3(parentDelta, normal)))
      : parentDelta;
    const attachmentScale = isTower ? 0.16 : role === "detail" ? 0.78 : 0;
    const scaledTangentDelta = scale3(rawTangentDelta, attachmentScale);
    const normalizedAttachment = parent
      ? Math.hypot(
          dot3(scaledTangentDelta, east) / Math.max(parent.radiusEast, 0.0001),
          dot3(scaledTangentDelta, north) / Math.max(parent.radiusNorth, 0.0001)
        )
      : 0;
    const attachmentLimit = isTower ? 0.72 : role === "detail" ? 0.95 : 0;
    let tangentDelta = normalizedAttachment > attachmentLimit
      ? scale3(scaledTangentDelta, attachmentLimit / normalizedAttachment)
      : scaledTangentDelta;
    if (isTower && parent) {
      // A tower is an attached cloud-top lobe, not a nearby random sphere.
      // Keep a small V3-local offset, then bias it toward the parent's
      // sunward shoulder. Its vertical elevation, rather than side drift,
      // is what may crest above the low-density carrier.
      const sunTangent = normalize3(subtract3(
        topologySunDirection,
        scale3(normal, dot3(topologySunDirection, normal))
      ));
      const sunwardAnchor = scale3(
        sunTangent,
        Math.min(parent.radiusEast, parent.radiusNorth) * 0.12
      );
      const anchoredDelta = add3(scale3(tangentDelta, 0.42), sunwardAnchor);
      const anchoredDistance = Math.hypot(
        dot3(anchoredDelta, east) / Math.max(parent.radiusEast, 0.0001),
        dot3(anchoredDelta, north) / Math.max(parent.radiusNorth, 0.0001)
      );
      tangentDelta = anchoredDistance > attachmentLimit
        ? scale3(anchoredDelta, attachmentLimit / anchoredDistance)
        : anchoredDelta;
    }
    const center = parent
      ? add3(
          add3(parent.center, tangentDelta),
          scale3(normal, elevation)
        )
      : candidate.center;
    // The carrier is now glue rather than the dominant optical mass. Bases
    // carry the V3 weather body and towers retain enough density to create
    // a real near layer in the Phase -1.1 two-bin A/B.
    const densityScale = isBase ? 0.96 : isTower ? 0.88 : 0.54;
    const baseRadiusEast = (tier === "mobile" ? 0.032 : 0.026) *
      (0.88 + candidate.density * 0.22 + candidate.morphology * 0.12);
    const baseRadiusNorth = (tier === "mobile" ? 0.025 : 0.02) *
      (0.9 + candidate.height * 0.2 + candidate.concavity * 0.1);
    const baseRadiusUp = (tier === "mobile" ? 0.0062 : 0.0054) *
      (0.9 + candidate.height * 0.32 + candidate.morphology * 0.08);
    const towerRadiusEast = (tier === "mobile" ? 0.021 : 0.017) *
      (0.9 + candidate.density * 0.16 + candidate.morphology * 0.16);
    const towerRadiusNorth = (tier === "mobile" ? 0.016 : 0.013) *
      (0.9 + candidate.height * 0.2 + candidate.concavity * 0.12);
    const towerRadiusUp = (tier === "mobile" ? 0.017 : 0.014) *
      (0.92 + candidate.height * 0.5 + candidate.morphology * 0.12);
    const detailRadiusEast = (tier === "mobile" ? 0.01 : 0.0085) *
      (0.82 + candidate.morphology * 0.28);
    const detailRadiusNorth = (tier === "mobile" ? 0.0075 : 0.0065) *
      (0.84 + candidate.concavity * 0.22);
    const detailRadiusUp = (tier === "mobile" ? 0.0065 : 0.0058) *
      (0.82 + candidate.height * 0.34);
    return {
      center,
      concavity: candidate.concavity,
      density: Math.min(1, candidate.density * densityScale),
      east,
      height: candidate.height,
      id: candidate.candidateId * 4 + roleCode[role],
      isCarrier: false,
      morphology: candidate.morphology,
      normal,
      north,
      parentId: parent?.id ?? null,
      radiusEast: isBase ? baseRadiusEast : isTower ? towerRadiusEast : detailRadiusEast,
      radiusNorth: isBase ? baseRadiusNorth : isTower ? towerRadiusNorth : detailRadiusNorth,
      radiusUp: isBase ? baseRadiusUp : isTower ? towerRadiusUp : detailRadiusUp,
      role,
      sourceUv: candidate.sourceUv
    };
  };
  const isSpacedFrom = (
    candidate: CloudLobeCandidate,
    lobes: CloudLobe[],
    minimumDistance: number
  ) => lobes.every((lobe) => (
    earthLocalTangentDistance(lobe, candidate) >= minimumDistance
  ));
  // A broad field-derived carrier owns the low-frequency mass. Keeping the
  // child hierarchy deliberately sparse prevents its analytic ellipsoids from
  // reading as a necklace at the silhouette while materially reducing the
  // overlapping proxy work that the Phase -1 p95 gate measures.
  const baseTarget = tier === "mobile" ? 7 : 14;
  const systemTarget = 1;
  const systemSeedSpacing = tier === "mobile" ? 0.1 : 0.085;
  const baseSpacing = tier === "mobile" ? 0.022 : 0.016;
  const baseConnectionRadius = tier === "mobile" ? 0.052 : 0.038;
  const bases: CloudLobe[] = [];
  const systems: CloudLobe[][] = [];
  for (const candidate of byMass) {
    if (systems.length >= systemTarget) {
      break;
    }
    if (!isSpacedFrom(candidate, bases, systemSeedSpacing)) {
      continue;
    }
    const lobe = makeLobe(candidate, "base", null);
    bases.push(lobe);
    systems.push([lobe]);
    selected.push(lobe);
    usedCandidateIds.add(candidate.candidateId);
  }
  let systemCursor = 0;
  while (bases.length < baseTarget && systems.length > 0) {
    let acceptedInPass = false;
    for (let pass = 0; pass < systems.length && bases.length < baseTarget; pass += 1) {
      const system = systems[(systemCursor + pass) % systems.length];
      const candidate = byMass
        .filter((entry) => {
          if (
            usedCandidateIds.has(entry.candidateId) ||
            !isSpacedFrom(entry, bases, baseSpacing)
          ) {
            return false;
          }
          return system.some((member) => (
            earthLocalTangentDistance(member, entry) <= baseConnectionRadius
          ));
        })
        .sort((a, b) => {
          const score = (entry: CloudLobeCandidate) => {
            const nearest = Math.min(...system.map((member) => (
              earthLocalTangentDistance(member, entry)
            )));
            const connection = 1 - Math.min(
              Math.abs(nearest / baseConnectionRadius - 0.58),
              1
            );
            return entry.score * 0.76 + connection * 0.24;
          };
          return score(b) - score(a);
        })[0];
      if (!candidate) {
        continue;
      }
      const lobe = makeLobe(candidate, "base", null);
      bases.push(lobe);
      system.push(lobe);
      selected.push(lobe);
      usedCandidateIds.add(candidate.candidateId);
      acceptedInPass = true;
    }
    systemCursor = (systemCursor + 1) % systems.length;
    if (!acceptedInPass) {
      break;
    }
  }

  // The parented lobes describe local towers and breakup, but they are not a
  // complete low-frequency cloud body by themselves. Derive one broad carrier
  // from the real selected V3 base footprint. Its dimensions, density, and
  // material fields are all footprint aggregates; it is not an independent
  // procedural cloud layer.
  const baseCarrier = (() => {
    if (bases.length === 0) {
      return null;
    }
    const baseFootprintWeight = (lobe: CloudLobe) => (
      Math.PI * lobe.radiusEast * lobe.radiusNorth
    );
    const average = (read: (lobe: CloudLobe) => number) => {
      const weightTotal = bases.reduce(
        (total, lobe) => total + baseFootprintWeight(lobe),
        0
      );
      return bases.reduce(
        (total, lobe) => total + read(lobe) * baseFootprintWeight(lobe),
        0
      ) / Math.max(weightTotal, 0.000001);
    };
    const patchFrame = resolvePatchFrame();
    const normal = patchFrame.normal;
    const east = patchFrame.east;
    const north = patchFrame.north;
    const sourceRadius = CLOUD_BASE_RADIUS + localVolumeHalfHeight;
    const center = scale3(normal, sourceRadius);
    const patchWidthRadians = (sourceUvBounds.u1 - sourceUvBounds.u0) * TAU;
    const patchHeightRadians = (sourceUvBounds.v1 - sourceUvBounds.v0) * Math.PI;
    // The carrier's horizontal footprint is the locked real V3 patch, not
    // merely the small selected-base envelope. The local field therefore
    // samples every recorded source column instead of collapsing that patch
    // to a smooth carrier-center subset before volume integration.
    // The source field is angularly rectangular, whereas the carrier
    // telemetry/parent contract is elliptical. Inflate the carrier by sqrt(2)
    // so a real V3 base near a patch corner is contained by the actual ellipse;
    // the render proxy below compensates with a matching field tile scale, so
    // this topology correction does not enlarge the raster footprint.
    const sourcePatchRadiusEast = Math.max(
      Math.sin(patchWidthRadians * 0.5) * sourceRadius * 1.03 * Math.SQRT2,
      0.045
    );
    const sourcePatchRadiusNorth = Math.max(
      Math.sin(patchHeightRadians * 0.5) * sourceRadius * 1.03 * Math.SQRT2,
      0.045
    );
    let radiusEast = 0;
    let radiusNorth = 0;
    for (const lobe of bases) {
      const delta = subtract3(lobe.center, center);
      const { tangentA, tangentB } = resolveLobeTangentAxes(lobe);
      radiusEast = Math.max(
        radiusEast,
        Math.abs(dot3(delta, east)) + Math.hypot(
          dot3(tangentA, east) * lobe.radiusEast,
          dot3(tangentB, east) * lobe.radiusNorth
        )
      );
      radiusNorth = Math.max(
        radiusNorth,
        Math.abs(dot3(delta, north)) + Math.hypot(
          dot3(tangentA, north) * lobe.radiusEast,
          dot3(tangentB, north) * lobe.radiusNorth
        )
      );
    }
    return {
      center,
      concavity: average((lobe) => lobe.concavity),
      // Preserve the V3-derived base mass in the low-frequency optical body
      // instead of substituting a fixed artistic density.
      density: average((lobe) => lobe.density),
      east,
      height: average((lobe) => lobe.height),
      id: -1,
      isCarrier: true,
      morphology: average((lobe) => lobe.morphology),
      normal,
      north,
      parentId: null,
      // This is an aggregate envelope around actual V3 base supports. The
      // support extrema already include the selected base radii and jitter;
      // expand them slightly instead of shrinking them. A previous 0.98
      // factor made the topology's containment metric reject V3 bases that
      // the source-domain proxy was explicitly meant to contain.
      radiusEast: Math.max(sourcePatchRadiusEast, radiusEast * 1.02, 0.045),
      radiusNorth: Math.max(sourcePatchRadiusNorth, radiusNorth * 1.02, 0.045),
      // The source-native field occupies a spherical shell centred on this
      // radius.  Do not enlarge it to contain the analytic child ellipsoids:
      // their hierarchy only shapes V3-supported occupancy, whereas this
      // shell owns the physically readable base → top interval.
      radiusUp: localVolumeHalfHeight,
      role: "base" as const,
      sourceUv: [
        (sourceUvBounds.u0 + sourceUvBounds.u1) * 0.5,
        (sourceUvBounds.v0 + sourceUvBounds.v1) * 0.5
      ] as [number, number]
    } satisfies CloudLobe;
  })();
  if (baseCarrier) {
    selected.unshift(baseCarrier);
  }

  const towerTarget = tier === "mobile" ? 2 : 4;
  const towerSpacing = tier === "mobile" ? 0.025 : 0.019;
  const towerParentRadius = tier === "mobile" ? 0.052 : 0.044;
  const towers: CloudLobe[] = [];
  for (const parent of bases) {
    if (towers.length >= towerTarget) {
      break;
    }
    const candidate = byTower
      .filter((entry) => (
        !usedCandidateIds.has(entry.candidateId) &&
        earthLocalTangentDistance(parent, entry) <= towerParentRadius &&
        isSpacedFrom(entry, towers, towerSpacing)
      ))
      .sort((a, b) => {
        const score = (entry: CloudLobeCandidate) => {
          const attachment = earthLocalTangentDistance(parent, entry) / towerParentRadius;
          return entry.height * 0.5 + entry.morphology * 0.3 + entry.density * 0.2 -
            Math.abs(attachment - 0.34) * 0.12;
        };
        return score(b) - score(a);
      })[0];
    if (!candidate) {
      continue;
    }
    const lobe = makeLobe(candidate, "tower", parent);
    towers.push(lobe);
    selected.push(lobe);
    usedCandidateIds.add(candidate.candidateId);
  }

  const detailTarget = tier === "mobile" ? 3 : 5;
  const detailSpacing = tier === "mobile" ? 0.014 : 0.011;
  const detailParentRadius = tier === "mobile" ? 0.05 : 0.042;
  const details: CloudLobe[] = [];
  for (const parent of bases) {
    if (details.length >= detailTarget) {
      break;
    }
    const candidate = byEdge
      .filter((entry) => (
        !usedCandidateIds.has(entry.candidateId) &&
        earthLocalTangentDistance(parent, entry) <= detailParentRadius &&
        isSpacedFrom(entry, details, detailSpacing)
      ))
      .sort((a, b) => {
        const score = (entry: CloudLobeCandidate) => {
          const attachment = earthLocalTangentDistance(parent, entry) / detailParentRadius;
          return entry.morphology * 0.46 + entry.concavity * 0.3 + entry.score * 0.24 -
            Math.abs(attachment - 0.68) * 0.16;
        };
        return score(b) - score(a);
      })[0];
    if (!candidate) {
      continue;
    }
    const lobe = makeLobe(candidate, "detail", parent);
    details.push(lobe);
    selected.push(lobe);
    usedCandidateIds.add(candidate.candidateId);
  }
  if (baseCarrier) {
    // The carrier has no independent optical authority, but its proxy domain
    // must contain the real parented V3 towers. Previously it was frozen from
    // base supports before towers existed, so the local-volume experiment
    // clipped precisely the cloud-top height it was meant to evaluate.
    for (const child of [...towers, ...details]) {
      const delta = subtract3(child.center, baseCarrier.center);
      const { tangentA, tangentB } = resolveLobeTangentAxes(child);
      baseCarrier.radiusEast = Math.max(
        baseCarrier.radiusEast,
        Math.abs(dot3(delta, baseCarrier.east)) + Math.hypot(
          dot3(tangentA, baseCarrier.east) * child.radiusEast,
          dot3(tangentB, baseCarrier.east) * child.radiusNorth,
          dot3(child.normal, baseCarrier.east) * child.radiusUp
        )
      );
      baseCarrier.radiusNorth = Math.max(
        baseCarrier.radiusNorth,
        Math.abs(dot3(delta, baseCarrier.north)) + Math.hypot(
          dot3(tangentA, baseCarrier.north) * child.radiusEast,
          dot3(tangentB, baseCarrier.north) * child.radiusNorth,
          dot3(child.normal, baseCarrier.north) * child.radiusUp
        )
      );
    }
  }
  return selected;
}

interface LocalVolumeField {
  data: Uint8Array;
  resolution: [number, number, number];
  // Conservative, source-native macro cells used only to bound the typed-FBO
  // clear/composite region. They do not change density evaluation or tile
  // ownership in the fragment shader.
  supportCells: Array<{
    localBounds: [number, number, number, number];
    localZMax: number;
    localZMin: number;
  }>;
  version: "v9-source-native-patch-oct-normal-directional-light-rgba8";
}

interface LocalVolumeTile extends CloudLobe {
  fieldTile: [number, number, number, number];
  meanDensity: number;
  peakDensity: number;
}

/**
 * Partition the real source patch into non-overlapping Earth-local tiles.
 * The fragment shader owns a source-local tile interval, so neighbouring
 * proxy rectangles never double optical depth even when their conservative
 * view-facing bounds overlap. Empty source cells are not submitted at all:
 * this removes the full-screen carrier fill cost without reintroducing the
 * old hierarchy-driven ellipsoid islands.
 */
function buildLocalVolumeTiles(
  carrier: CloudLobe,
  field: LocalVolumeField,
  tier: KillSpikeTier
): LocalVolumeTile[] {
  // Tighter source-native tiles reduce the projected proxy overlap at an
  // oblique camera. The expensive ray/field loop still runs once for the
  // owning source interval, while empty or neighbouring tile fragments exit
  // before any 3D field lookup.
  const columns = tier === "mobile" ? 3 : 4;
  const rows = tier === "mobile" ? 2 : 3;
  const [width, height, depth] = field.resolution;
  const signals = Array.from({ length: columns * rows }, () => ({
    meanDensity: 0,
    peakDensity: 0
  }));
  const sourceFootprintBounds = Array.from({ length: columns * rows }, () => ({
    maxX: -1,
    maxY: -1,
    minX: width,
    minY: height
  }));
  const samplesPerTile = new Array<number>(signals.length).fill(0);
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      const tileY = Math.min(Math.floor(y * rows / height), rows - 1);
      for (let x = 0; x < width; x += 1) {
        const tileX = Math.min(Math.floor(x * columns / width), columns - 1);
        const tileIndex = tileY * columns + tileX;
        const density = (field.data[(z * width * height + y * width + x) * 4 + 3] ?? 0) / 255;
        const signal = signals[tileIndex];
        signal.meanDensity += density;
        signal.peakDensity = Math.max(signal.peakDensity, density);
        if (density >= LOCAL_VOLUME_TILE_FOOTPRINT_DENSITY_FLOOR) {
          const footprint = sourceFootprintBounds[tileIndex];
          footprint.minX = Math.min(footprint.minX, x);
          footprint.maxX = Math.max(footprint.maxX, x);
          footprint.minY = Math.min(footprint.minY, y);
          footprint.maxY = Math.max(footprint.maxY, y);
        }
        samplesPerTile[tileIndex] += 1;
      }
    }
  }
  for (let index = 0; index < signals.length; index += 1) {
    signals[index].meanDensity /= Math.max(samplesPerTile[index], 1);
  }
  const activeTileIndexes = selectLocalVolumeActiveTiles(signals);
  const selectedIndexes = activeTileIndexes.length > 0
    ? activeTileIndexes
    : signals.map((_, index) => index);
  return selectedIndexes.map((tileIndex) => {
    const x = tileIndex % columns;
    const y = Math.floor(tileIndex / columns);
    const cellMinX = Math.floor(x * width / columns);
    const cellMaxX = Math.floor((x + 1) * width / columns);
    const cellMinY = Math.floor(y * height / rows);
    const cellMaxY = Math.floor((y + 1) * height / rows);
    const footprint = sourceFootprintBounds[tileIndex];
    // The source occupancy is measured over depth, but the GPU owns columns.
    // Restricting a proxy to this expanded in-plane support avoids rasterising
    // a full selector cell whose fragment shader immediately discards clear
    // V3 columns. Bounds never cross their original cell, preserving exact
    // one-owner tile semantics at shared edges.
    const footprintMinX = footprint.maxX >= footprint.minX
      ? Math.max(cellMinX, footprint.minX - LOCAL_VOLUME_TILE_FOOTPRINT_MARGIN_TEXELS)
      : cellMinX;
    const footprintMaxX = footprint.maxX >= footprint.minX
      ? Math.min(cellMaxX, footprint.maxX + LOCAL_VOLUME_TILE_FOOTPRINT_MARGIN_TEXELS + 1)
      : cellMaxX;
    const footprintMinY = footprint.maxY >= footprint.minY
      ? Math.max(cellMinY, footprint.minY - LOCAL_VOLUME_TILE_FOOTPRINT_MARGIN_TEXELS)
      : cellMinY;
    const footprintMaxY = footprint.maxY >= footprint.minY
      ? Math.min(cellMaxY, footprint.maxY + LOCAL_VOLUME_TILE_FOOTPRINT_MARGIN_TEXELS + 1)
      : cellMaxY;
    const fieldTile: [number, number, number, number] = [
      footprintMinX / width * 2 - 1,
      footprintMinY / height * 2 - 1,
      footprintMaxX / width * 2 - 1,
      footprintMaxY / height * 2 - 1
    ];
    const sourceUv = (localX: number, localY: number): [number, number] => [
      FIXED_PATCH_UV.u0 + (localX * 0.5 + 0.5) * (FIXED_PATCH_UV.u1 - FIXED_PATCH_UV.u0),
      FIXED_PATCH_UV.v0 + (localY * 0.5 + 0.5) * (FIXED_PATCH_UV.v1 - FIXED_PATCH_UV.v0)
    ];
    const centerUv = sourceUv(
      (fieldTile[0] + fieldTile[2]) * 0.5,
      (fieldTile[1] + fieldTile[3]) * 0.5
    );
    const normal = uvToEarthDirection(centerUv[0], centerUv[1]);
    const pole: [number, number, number] = Math.abs(normal[1]) > 0.96
      ? [0, 0, 1]
      : [0, 1, 0];
    const east = normalize3(cross3(pole, normal));
    const north = normalize3(cross3(normal, east));
    const sourceRadius = Math.sqrt(lengthSquared3(carrier.center));
    const center = scale3(normal, sourceRadius);
    let radiusEast = 0;
    let radiusNorth = 0;
    for (const localY of [fieldTile[1], fieldTile[3]]) {
      for (const localX of [fieldTile[0], fieldTile[2]]) {
        const cornerUv = sourceUv(localX, localY);
        const corner = scale3(uvToEarthDirection(cornerUv[0], cornerUv[1]), sourceRadius);
        const delta = subtract3(corner, center);
        radiusEast = Math.max(radiusEast, Math.abs(dot3(delta, east)));
        radiusNorth = Math.max(radiusNorth, Math.abs(dot3(delta, north)));
      }
    }
    return {
      ...carrier,
      center,
      east,
      fieldTile,
      id: -1_000 - tileIndex,
      normal,
      north,
      meanDensity: signals[tileIndex].meanDensity,
      peakDensity: signals[tileIndex].peakDensity,
      radiusEast: Math.max(radiusEast * 1.02, 0.004),
      radiusNorth: Math.max(radiusNorth * 1.02, 0.004),
      sourceUv: centerUv
    };
  });
}

function intersectCpuSphere(
  origin: [number, number, number],
  direction: [number, number, number],
  radius: number
) {
  const b = dot3(origin, direction);
  const c = lengthSquared3(origin) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant <= 0) {
    return null;
  }
  const root = Math.sqrt(discriminant);
  return [-b - root, -b + root] as const;
}

/**
 * Resolve the one shared Phase -1.2 depth split from the actual visible
 * source-shell interval. The old carrier-center distance was only an
 * approximation: at the mid-oblique camera it can fall outside much of the
 * source patch's ray interval, which leaves one MRT layer effectively empty
 * even though both layers are allocated. Sampling the density-weighted tile
 * centers gives one stable world-distance boundary while staying faithful to
 * the documented shared-boundary contract (it is not a per-pixel split).
 */
function resolveLocalVolumeDepthBoundary(
  carrier: CloudLobe,
  tiles: readonly LocalVolumeTile[],
  eye: [number, number, number]
) {
  const fallback = Math.sqrt(lengthSquared3(subtract3(carrier.center, eye)));
  const shellCenterRadius = Math.sqrt(lengthSquared3(carrier.center));
  const outerRadius = shellCenterRadius + carrier.radiusUp;
  const innerRadius = Math.max(EARTH_RADIUS + 0.0005, shellCenterRadius - carrier.radiusUp);
  const samples: Array<{ distance: number; weight: number }> = [];
  for (const tile of tiles) {
    const shellMidpoint = scale3(tile.normal, (outerRadius + innerRadius) * 0.5);
    const direction = normalize3(subtract3(shellMidpoint, eye));
    const outer = intersectCpuSphere(eye, direction, outerRadius);
    if (!outer) {
      continue;
    }
    const fieldEnter = Math.max(outer[0], 0);
    let fieldExit = outer[1];
    const inner = intersectCpuSphere(eye, direction, innerRadius);
    if (inner) {
      const firstInnerHit = inner[0] > fieldEnter + 0.0001 ? inner[0] : inner[1];
      if (firstInnerHit > fieldEnter + 0.0001) {
        fieldExit = Math.min(fieldExit, firstInnerHit);
      }
    }
    if (fieldExit <= fieldEnter + 0.0001) {
      continue;
    }
    samples.push({
      distance: (fieldEnter + fieldExit) * 0.5,
      // A weak source bridge still has a vote, but dense V3 cells determine
      // the optical center of the fixed patch rather than empty shell area.
      weight: Math.max(tile.meanDensity + tile.peakDensity * 0.08, 0.0001)
    });
  }
  if (samples.length === 0) {
    return fallback;
  }
  samples.sort((a, b) => a.distance - b.distance);
  const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  let accumulatedWeight = 0;
  for (const sample of samples) {
    accumulatedWeight += sample.weight;
    if (accumulatedWeight >= totalWeight * 0.5) {
      return sample.distance;
    }
  }
  return samples[samples.length - 1]?.distance ?? fallback;
}

function buildLocalVolumeField(
  truth: ReturnType<typeof parseTruth>,
  lobes: CloudLobe[],
  carrier: CloudLobe,
  tier: KillSpikeTier
): LocalVolumeField {
  // This is intentionally a transient, CPU-built representation of the
  // locked V3 hierarchy—not a second asset or procedural noise field. The
  // small grid lets the experiment test front-to-back density composition
  // without graduating to a general-purpose cloud raymarch.
  // This is still a compact, transient CPU field—not a shipping texture. It
  // needs enough in-plane V3 fidelity to distinguish real weather valleys
  // from the aggregate carrier boundary, while retaining a small fixed depth
  // for the 4+1 / 3+1 rejection budget.
  const resolution: [number, number, number] = tier === "mobile"
    ? [96, 72, 20]
    : [160, 120, 32];
  const [width, height, depth] = resolution;
  const truthLevel = truth.header.levels[0];
  const sourcePatchBounds = resolveTruthSourceUvBounds(truth);
  const densityValues = new Float32Array(width * height * depth);
  const hierarchy = lobes.filter((lobe) => !lobe.isCarrier);
  let index = 0;
  for (let z = 0; z < depth; z += 1) {
    const localZ = ((z + 0.5) / depth) * 2 - 1;
    for (let y = 0; y < height; y += 1) {
      const localY = ((y + 0.5) / height) * 2 - 1;
      for (let x = 0; x < width; x += 1) {
        const localX = ((x + 0.5) / width) * 2 - 1;
        // The local X/Y domain is the exact locked V3 patch. Do not recover
        // UVs from the conservative carrier's world normal here: its smaller
        // support envelope used to sample only a smooth center subset and
        // erase the real V3 broken edge / valley structure before rendering.
        const [fieldU, fieldV] = resolveSourcePatchLocalUv(
          localX,
          localY,
          sourcePatchBounds
        );
        // The transient field is Earth-local in the literal sense: each V3
        // source column follows the same spherical UV convention as the day
        // texture. A tangent-plane box visibly slid broad patches across the
        // globe and made a shallow volume read as a painted rectangular card.
        const worldPoint = scale3(
          uvToEarthDirection(fieldU, fieldV),
          Math.sqrt(lengthSquared3(carrier.center)) + localZ * carrier.radiusUp
        );
        const [sourceDepth, sourceHeight, sourceMorphology, sourceConcavity] = sampleTruthLevel(
          truth,
          (fieldU - sourcePatchBounds.u0) /
            (sourcePatchBounds.u1 - sourcePatchBounds.u0) * truthLevel.width - 0.5,
          (fieldV - sourcePatchBounds.v0) /
            (sourcePatchBounds.v1 - sourcePatchBounds.v0) * truthLevel.height - 0.5
        );
        // The truth field's broad low values are useful for a soft base, but
        // they cannot be allowed to turn the aggregate domain into a filled
        // carrier ellipse. Promote only the V3 cloud-bearing range; hierarchy
        // footprint then decides where that source mass is eligible.
        // R is an optical-depth field, not a binary cloud mask. Keep the
        // fixed patch's broad weather signal, but reserve dense occupation for
        // actual V3 cores so the aggregate carrier can never become a filled
        // analytic oval.
        // The locked V3 patch is a diagnostic crop, not a hard atmospheric
        // wall.  Preserve every interior source value, but feather the final
        // few texels of the crop so a cloud that continues beyond this
        // query-only experiment cannot acquire a rectangular silhouette just
        // because its evidence window ends there.
        const sourcePatchEdgeDistance = 1 - Math.max(Math.abs(localX), Math.abs(localY));
        const sourcePatchBoundaryFeather = Math.min(Math.max(
          sourcePatchEdgeDistance / 0.13,
          0
        ), 1);
        const sourceCoverage = resolveV3SourceCoverage(sourceDepth) * sourcePatchBoundaryFeather;
        const sourceFootprintMask = resolveV3SourceFootprintMask(sourceCoverage);
        let baseFootprint = 0;
        let towerFootprint = 0;
        let towerMass = 0;
        for (const lobe of hierarchy) {
          const { tangentA, tangentB } = resolveLobeTangentAxes(lobe);
          const delta = subtract3(worldPoint, lobe.center);
          const qx = dot3(delta, tangentA) / Math.max(lobe.radiusEast, 0.0001);
          const qy = dot3(delta, tangentB) / Math.max(lobe.radiusNorth, 0.0001);
          const qz = dot3(delta, lobe.normal) / Math.max(lobe.radiusUp, 0.0001);
          const radiusSquared = qx * qx + qy * qy + qz * qz;
          if (lobe.role === "base" && radiusSquared < 1.82) {
            // A base is an Earth-local validity footprint, not a separate
            // layer of unrelated density. A broad, smooth support lets real
            // V3 source mass join between selected samples without reviving a
            // carrier-sized analytic oval.
            baseFootprint += Math.max(1 - radiusSquared / 1.82, 0);
          }
          if (lobe.role === "tower" && radiusSquared < 1.36) {
            // Towers may make a deliberately bounded cloud-top/sun-side
            // breakout. Their support is still derived from parented V3
            // candidates and remains inside the one conservative proxy.
            towerFootprint += Math.max(1 - radiusSquared / 1.36, 0);
          }
          if (radiusSquared >= 1) {
            continue;
          }
          const quarticDensity = (1 - radiusSquared) ** 2;
          const lobeMass = quarticDensity * lobe.density;
          if (lobe.role === "tower") {
            towerMass += lobeMass;
          }
        }
        // The broad V3 coverage establishes a weather body, but tower mass
        // is allowed to raise its own local ceiling. This is deliberately
        // bounded: a tower can break the illuminated cloud top without
        // turning the conservative carrier envelope into a second shell.
        // Towers shape the ceiling first. Their direct opacity is absent so
        // the selected hierarchy cannot recreate a ring of opaque bulbs.
        const footprintMask = Math.min(Math.max((baseFootprint - 0.16) / 0.52, 0), 1);
        const towerMask = Math.min(Math.max((towerFootprint - 0.10) / 0.46, 0), 1);
        const detailMask = Math.max(footprintMask, towerMask * 0.78);
        // Towers only change the source-backed ceiling. They cannot add a
        // second ellipsoid-shaped density body on top of V3, which was the
        // source of the visible foam beads in the previous local field.
        // The source-native vertical profile converts V3 G/B into actual
        // local occupancy. Parent towers can only extend the ceiling of a
        // V3-supported column; they never add an independent ellipsoid mass.
        const towerSupport = Math.min(Math.max(
          towerMass * (1.2 + sourceCoverage * 0.8),
          0
        ), 1);
        const { profile: sourceVerticalProfile } = resolveSourceNativeVerticalProfile({
          localZ,
          sourceFootprintMask,
          sourceHeight,
          sourceMorphology,
          towerSupport
        });
        // Lower V3 coverage should remain porous. Keeping it continuous but
        // slightly convex avoids re-inflating the entire carrier-shaped patch
        // into a uniformly opaque slab.
        // B/A are not brightness multipliers. They describe V3 breakup and
        // concavity, so use them as height-dependent erosion before optical
        // depth is accumulated. This keeps broad weather mass continuous
        // while preserving real interior valleys for side and underside light.
        const erosion = Math.min(Math.max(
          (sourceMorphology * 0.72 + sourceConcavity * 0.28 - 0.22) / 0.52,
          0
        ), 1);
        const erosionWeight = (1 - erosion * (
          0.58 - Math.min(Math.max((localZ + 0.7) / 1.35, 0), 1) * 0.36
        )) * (1 - detailMask * sourceConcavity * 0.08);
        // The real V3 density defines the lateral cloud silhouette. Previous
        // versions multiplied it by a sparse selected-base footprint, so a
        // continuous weather body was chopped into a handful of ellipsoid
        // islands before the ray marcher could ever establish depth. The
        // hierarchy remains authoritative for local height/tower/detail mass,
        // but it is no longer allowed to erase source-backed V3 cloud pixels.
        const hierarchyFootprint = Math.max(footprintMask, towerMask * 0.82);
        // The aggregate carrier is source-backed glue only. Hierarchy support
        // is allowed to refine V3's ceiling and breakup, never to add direct
        // base/tower opacity where V3 reports clear air.
        const carrierRadiusSquared = localX * localX + localY * localY + localZ * localZ;
        const { opticalMass } = resolveSourceNativeOpticalMass({
          carrierDensity: carrier.density,
          carrierRadiusSquared,
          erosionWeight,
          hierarchyFootprint,
          sourceConcavity,
          sourceCoverage,
          sourceFootprintMask,
          sourceMorphology,
          sourceVerticalProfile
        });
        // Preserve the hierarchy's low-density valleys, but lift the useful
        // V3 base/tower range above the R8 quantization floor. This affects
        // optical density only; it does not recolor or inflate the carrier.
        const normalizedMass = 1 - Math.exp(-opticalMass * 2.05);
        densityValues[index] = Math.min(Math.max(normalizedMass, 0), 1);
        index += 1;
      }
    }
  }
  const voxelIndex = (x: number, y: number, z: number) => (
    z * width * height + y * width + x
  );
  const readRawDensity = (x: number, y: number, z: number) => densityValues[voxelIndex(
    Math.min(Math.max(x, 0), width - 1),
    Math.min(Math.max(y, 0), height - 1),
    Math.min(Math.max(z, 0), depth - 1)
  )] ?? 0;
  // A single narrow reconstruction pass removes voxel-boundary rings from a
  // sparse hierarchy while retaining actual V3 mass valleys. This happens
  // once on the CPU field, not as a second runtime field/sample.
  const reconstructedDensity = new Float32Array(densityValues.length);
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        // Keep enough interpolation to avoid voxel rings, but preserve the
        // vertical and in-plane V3 valleys that separate a cloud body from a
        // flat fog card.
        reconstructedDensity[voxelIndex(x, y, z)] =
          readRawDensity(x, y, z) * 0.60 +
          (readRawDensity(x - 1, y, z) + readRawDensity(x + 1, y, z) +
            readRawDensity(x, y - 1, z) + readRawDensity(x, y + 1, z)) * 0.065 +
          (readRawDensity(x, y, z - 1) + readRawDensity(x, y, z + 1)) * 0.07;
      }
    }
  }
  const readDensity = (x: number, y: number, z: number) => reconstructedDensity[voxelIndex(
    Math.min(Math.max(x, 0), width - 1),
    Math.min(Math.max(y, 0), height - 1),
    Math.min(Math.max(z, 0), depth - 1)
  )] ?? 0;
  const sampleReconstructedDensity = (localX: number, localY: number, localZ: number) => {
    const mapAxis = (local: number, size: number) => (
      Math.min(Math.max((local * 0.5 + 0.5) * (size - 1), 0), size - 1)
    );
    const gridX = mapAxis(localX, width);
    const gridY = mapAxis(localY, height);
    const gridZ = mapAxis(localZ, depth);
    const x0 = Math.floor(gridX);
    const y0 = Math.floor(gridY);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    const z1 = Math.min(z0 + 1, depth - 1);
    const tx = gridX - x0;
    const ty = gridY - y0;
    const tz = gridZ - z0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c00 = lerp(readDensity(x0, y0, z0), readDensity(x1, y0, z0), tx);
    const c10 = lerp(readDensity(x0, y1, z0), readDensity(x1, y1, z0), tx);
    const c01 = lerp(readDensity(x0, y0, z1), readDensity(x1, y0, z1), tx);
    const c11 = lerp(readDensity(x0, y1, z1), readDensity(x1, y1, z1), tx);
    return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
  };
  // B stores the V3 field's preintegrated *sunward* transmittance. The view
  // pass now reads a true, voxel-specific self-shadow rather than applying a
  // single midpoint darkness scalar to every ray sample. This is computed
  // once while constructing the query-only CPU truth field, so it adds no
  // fragment texture lookup or secondary cloud shell.
  const sourcePatchHalfExtent = 1 / Math.SQRT2;
  const sunDirection = resolveSpikeSunDirection();
  const localSunDirection: [number, number, number] = [
    dot3(sunDirection, carrier.east) /
      Math.max(carrier.radiusEast * sourcePatchHalfExtent, 0.0001),
    dot3(sunDirection, carrier.north) /
      Math.max(carrier.radiusNorth * sourcePatchHalfExtent, 0.0001),
    dot3(sunDirection, carrier.normal) / Math.max(carrier.radiusUp, 0.0001)
  ];
  const directionalSunTransmittance = new Float32Array(reconstructedDensity.length);
  const sunwardExitDistance = (localX: number, localY: number, localZ: number) => {
    let exitDistance = Number.POSITIVE_INFINITY;
    const considerAxis = (coordinate: number, direction: number) => {
      if (direction > 0.000001) {
        exitDistance = Math.min(exitDistance, (1 - coordinate) / direction);
      } else if (direction < -0.000001) {
        exitDistance = Math.min(exitDistance, (-1 - coordinate) / direction);
      }
    };
    considerAxis(localX, localSunDirection[0]);
    considerAxis(localY, localSunDirection[1]);
    considerAxis(localZ, localSunDirection[2]);
    return Number.isFinite(exitDistance) ? Math.max(exitDistance, 0) : 0;
  };
  const sunIntegrationSteps = 12;
  const sunOpticalExtinction = 34;
  for (let z = 0; z < depth; z += 1) {
    const localZ = ((z + 0.5) / depth) * 2 - 1;
    for (let y = 0; y < height; y += 1) {
      const localY = ((y + 0.5) / height) * 2 - 1;
      for (let x = 0; x < width; x += 1) {
        const localX = ((x + 0.5) / width) * 2 - 1;
        const exitDistance = sunwardExitDistance(localX, localY, localZ);
        const stepDistance = exitDistance / sunIntegrationSteps;
        let opticalDepth = 0;
        for (let step = 0; step < sunIntegrationSteps; step += 1) {
          const sampleDistance = (step + 0.5) * stepDistance;
          opticalDepth += sampleReconstructedDensity(
            localX + localSunDirection[0] * sampleDistance,
            localY + localSunDirection[1] * sampleDistance,
            localZ + localSunDirection[2] * sampleDistance
          ) * stepDistance * sunOpticalExtinction;
        }
        directionalSunTransmittance[voxelIndex(x, y, z)] =
          resolveBeerLambertTransmittance(opticalDepth);
      }
    }
  }
  const data = new Uint8Array(densityValues.length * 4);
  const fieldExtentEast = Math.max(carrier.radiusEast * sourcePatchHalfExtent, 0.0001);
  const fieldExtentNorth = Math.max(carrier.radiusNorth * sourcePatchHalfExtent, 0.0001);
  const fieldExtentUp = Math.max(carrier.radiusUp, 0.0001);
  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = voxelIndex(x, y, z);
        // The previous field packed only the lateral XY gradient. That made
        // the final shader infer Z from a weak heuristic, so an oblique
        // cloud was almost entirely classified as a side plane. Encode the
        // actual 3D density-gradient normal in RG instead. Central
        // differences use the real Earth-local extents, not voxel aspect
        // ratios, so top, side, and underside all retain their geometry.
        const gradientX = (readDensity(x + 1, y, z) - readDensity(x - 1, y, z)) *
          (width - 1) / (4 * fieldExtentEast);
        const gradientY = (readDensity(x, y + 1, z) - readDensity(x, y - 1, z)) *
          (height - 1) / (4 * fieldExtentNorth);
        const gradientZ = (readDensity(x, y, z + 1) - readDensity(x, y, z - 1)) *
          (depth - 1) / (4 * fieldExtentUp);
        const encodedNormal = encodeOctahedralNormal([
          -gradientX,
          -gradientY,
          -gradientZ
        ]);
        const targetIndex = sourceIndex * 4;
        data[targetIndex] = encodedNormal[0];
        data[targetIndex + 1] = encodedNormal[1];
        data[targetIndex + 2] = Math.round(directionalSunTransmittance[sourceIndex] * 255);
        data[targetIndex + 3] = Math.round(reconstructedDensity[sourceIndex] * 255);
      }
    }
  }
  // Build a coarse, conservative support map from the same reconstructed V3
  // density that is uploaded to the runtime field. The screen-space union of
  // these cells bounds clears and the final two-bin composite; it does not
  // alter the local ray integration or hide an arbitrary screen-space region.
  const supportColumns = 20;
  const supportRows = 15;
  const supportCells: LocalVolumeField["supportCells"] = [];
  for (let cellY = 0; cellY < supportRows; cellY += 1) {
    const y0 = Math.floor(cellY * height / supportRows);
    const y1 = Math.floor((cellY + 1) * height / supportRows);
    for (let cellX = 0; cellX < supportColumns; cellX += 1) {
      const x0 = Math.floor(cellX * width / supportColumns);
      const x1 = Math.floor((cellX + 1) * width / supportColumns);
      let zMin = depth;
      let zMax = -1;
      for (let z = 0; z < depth; z += 1) {
        for (let y = y0; y < y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            if (readDensity(x, y, z) >= LOCAL_VOLUME_TILE_FOOTPRINT_DENSITY_FLOOR) {
              zMin = Math.min(zMin, z);
              zMax = Math.max(zMax, z);
            }
          }
        }
      }
      if (zMax < zMin) {
        continue;
      }
      const margin = 1;
      const local = (value: number, size: number) => value / size * 2 - 1;
      supportCells.push({
        localBounds: [
          local(Math.max(0, x0 - margin), width),
          local(Math.max(0, y0 - margin), height),
          local(Math.min(width, x1 + margin), width),
          local(Math.min(height, y1 + margin), height)
        ],
        localZMax: local(Math.min(depth, zMax + margin + 1), depth),
        localZMin: local(Math.max(0, zMin - margin), depth)
      });
    }
  }
  return {
    data,
    resolution,
    supportCells,
    version: "v9-source-native-patch-oct-normal-directional-light-rgba8"
  };
}

function createLocalVolumeTexture(
  gl: WebGL2RenderingContext,
  field: LocalVolumeField
) {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Unable to create the local V3 hierarchy volume texture.");
  }
  const [width, height, depth] = field.resolution;
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.RGBA8,
    width,
    height,
    depth,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    field.data
  );
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.bindTexture(gl.TEXTURE_3D, null);
  if (gl.getError() !== gl.NO_ERROR) {
    gl.deleteTexture(texture);
    throw new Error("Unable to upload the local V3 hierarchy volume texture.");
  }
  return texture;
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed.");
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, `#version 300 es
    precision highp float;

    in vec2 aCorner;
    in vec4 iCenterRadius;
    in vec4 iEastRadius;
    in vec4 iNorthRadius;
    in vec4 iMaterial;
    in vec4 iTopology;
    in vec4 iFieldTile;

    uniform mat4 uViewProjection;
    uniform vec3 uCameraPosition;
    uniform float uLocalVolumeMode;

    out vec2 vCorner;
    out vec3 vCenter;
    out vec3 vFieldCenter;
    out vec3 vEast;
    out vec3 vFieldEast;
    out vec3 vFieldNorth;
    out float vHeight;
    out float vDensity;
    out float vMorphology;
    out float vConcavity;
    out vec3 vNorth;
    out vec3 vNormal;
    out vec3 vProxyPosition;
    out vec3 vRadii;
    out vec2 vSourceLocal;
    flat out vec4 vFieldTile;
    flat out float vRole;
    flat out float vCarrier;

    void main() {
      vec3 center = iCenterRadius.xyz;
      vec3 normal = normalize(center);
      vec3 east = normalize(iEastRadius.xyz);
      vec3 north = normalize(iNorthRadius.xyz);
      // Local-volume tile instances are already actual Earth-local spherical
      // patches. iFieldTile remains a source-domain ownership interval for
      // the fragment shader only; applying it here would move/scale the tile
      // a second time and break the world-to-V3 mapping at oblique views.
      bool localVolumeTile = uLocalVolumeMode > 0.5;
      vec2 tileCenter = localVolumeTile
        ? vec2(0.0)
        : (iFieldTile.xy + iFieldTile.zw) * 0.5;
      vec2 tileHalfExtent = localVolumeTile
        ? vec2(1.0)
        : max((iFieldTile.zw - iFieldTile.xy) * 0.5, vec2(0.0001));
      vec3 fieldCenter = center +
        east * tileCenter.x * iCenterRadius.w +
        north * tileCenter.y * iEastRadius.w;
      float tileRadiusEast = iCenterRadius.w * tileHalfExtent.x;
      float tileRadiusNorth = iEastRadius.w * tileHalfExtent.y;
      float phase = iMaterial.z * 5.7 + dot(center, vec3(11.3, 17.1, 7.9));
      float angle = phase + iMaterial.w * 3.14159;
      float ca = cos(angle);
      float sa = sin(angle);
      vec3 tangentA = east * ca + north * sa;
      vec3 tangentB = north * ca - east * sa;
      vec3 toCamera = normalize(uCameraPosition - fieldCenter);
      vec3 worldUp = abs(toCamera.y) > 0.96 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
      vec3 proxyRight = normalize(cross(worldUp, toCamera));
      vec3 proxyUp = normalize(cross(toCamera, proxyRight));
      float rotatedExtentRight = length(vec3(
        dot(tangentA, proxyRight) * tileRadiusEast,
        dot(tangentB, proxyRight) * tileRadiusNorth,
        dot(normal, proxyRight) * iNorthRadius.w
      ));
      float rotatedExtentUp = length(vec3(
        dot(tangentA, proxyUp) * tileRadiusEast,
        dot(tangentB, proxyUp) * tileRadiusNorth,
        dot(normal, proxyUp) * iNorthRadius.w
      ));
      // local-volume samples the unrotated carrier field. It deliberately
      // does not evaluate the artist-rotated analytic control below, so its
      // proxy must cover the source field frame—not the wider analytic shape.
      // The local V3 source field occupies a tangent-space patch box rather
      // than the analytic carrier ellipsoid. Use the box support function so
      // its real broken-edge source mass cannot be clipped back into a round
      // proxy silhouette at oblique views.
      float fieldExtentRight =
        abs(dot(east, proxyRight)) * tileRadiusEast +
        abs(dot(north, proxyRight)) * tileRadiusNorth +
        abs(dot(normal, proxyRight)) * iNorthRadius.w;
      float fieldExtentUp =
        abs(dot(east, proxyUp)) * tileRadiusEast +
        abs(dot(north, proxyUp)) * tileRadiusNorth +
        abs(dot(normal, proxyUp)) * iNorthRadius.w;
      float extentRight = (localVolumeTile
        ? fieldExtentRight
        : max(rotatedExtentRight, fieldExtentRight)) * 1.015;
      float extentUp = (localVolumeTile
        ? fieldExtentUp
        : max(rotatedExtentUp, fieldExtentUp)) * 1.015;
      vec2 sourceLocal = mix(
        iFieldTile.xy,
        iFieldTile.zw,
        aCorner * 0.5 + 0.5
      );
      float sourceU = ${FIXED_PATCH_UV.u0.toFixed(8)} +
        (sourceLocal.x * 0.5 + 0.5) *
          ${(FIXED_PATCH_UV.u1 - FIXED_PATCH_UV.u0).toFixed(8)};
      float sourceV = ${FIXED_PATCH_UV.v0.toFixed(8)} +
        (sourceLocal.y * 0.5 + 0.5) *
          ${(FIXED_PATCH_UV.v1 - FIXED_PATCH_UV.v0).toFixed(8)};
      float sourceLongitude = (sourceU - 0.5 - ${CLOUD_FIELD_OFFSET_X.toFixed(8)}) *
        6.28318530718;
      float sourceLatitude = (0.5 + ${CLOUD_FIELD_OFFSET_Y.toFixed(8)} - sourceV) *
        3.14159265359;
      vec3 sourceShellNormal = vec3(
        cos(sourceLatitude) * cos(sourceLongitude),
        sin(sourceLatitude),
        cos(sourceLatitude) * sin(sourceLongitude)
      );
      vec3 position = localVolumeTile
        // Build the proxy from the exact V3 source-tile corners on the outer
        // spherical shell. Adjacent tiles now share their edge vertices, so
        // the field cannot open tangent-plane seams during an oblique sweep.
        ? sourceShellNormal * (length(center) + iNorthRadius.w)
        : fieldCenter +
          proxyRight * aCorner.x * max(extentRight, 0.004) +
          proxyUp * aCorner.y * max(extentUp, 0.004);
      gl_Position = uViewProjection * vec4(position, 1.0);
      vCorner = aCorner;
      vCenter = fieldCenter;
      vFieldCenter = center;
      vEast = tangentA;
      // The proxy can rotate for conservative projected bounds, but the
      // transient V3 field is built in the carrier's original Earth-local
      // east/north basis. Keep that sampling frame explicit so morphology
      // never rotates the truth field relative to its tower hierarchy.
      vFieldEast = east;
      vFieldNorth = north;
      vNorth = tangentB;
      vNormal = normal;
      vDensity = iMaterial.x;
      vHeight = iMaterial.y;
      vMorphology = iMaterial.z;
      vConcavity = iMaterial.w;
      vProxyPosition = position;
      vRadii = vec3(iCenterRadius.w, iEastRadius.w, iNorthRadius.w);
      vSourceLocal = sourceLocal;
      vFieldTile = iFieldTile;
      vRole = iTopology.x;
      vCarrier = iTopology.w;
    }
  `);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;

    in vec2 vCorner;
    in vec3 vCenter;
    in vec3 vFieldCenter;
    in vec3 vEast;
    in vec3 vFieldEast;
    in vec3 vFieldNorth;
    in float vHeight;
    in float vDensity;
    in float vMorphology;
    in float vConcavity;
    in vec3 vNorth;
    in vec3 vNormal;
    in vec3 vProxyPosition;
    in vec3 vRadii;
    in vec2 vSourceLocal;
    flat in vec4 vFieldTile;
    flat in float vRole;
    flat in float vCarrier;

    uniform vec3 uCameraPosition;
    uniform vec3 uCarrierCenter;
    uniform vec3 uCarrierEast;
    uniform vec3 uCarrierNorth;
    uniform vec2 uCarrierRadii;
    uniform sampler2D uCloudField;
    uniform highp sampler3D uLocalVolumeField;
    uniform float uBinLayer;
    uniform float uDepthBoundary;
    uniform float uDepthBinMode;
    uniform float uDebugMode;
    uniform float uLocalVolumeMode;
    uniform float uLocalVolumeViewSamples;
    uniform vec3 uSunDirection;

    layout(location = 0) out vec4 outFarColor;
    layout(location = 1) out vec4 outNearColor;
    #define outColor outFarColor

    bool intersectEarth(vec3 origin, vec3 direction, out float tHit) {
      float b = dot(origin, direction);
      float c = dot(origin, origin) - ${(EARTH_RADIUS * EARTH_RADIUS).toFixed(4)};
      float h = b * b - c;
      if (h < 0.0) {
        return false;
      }
      h = sqrt(h);
      float t0 = -b - h;
      float t1 = -b + h;
      tHit = t0 > 0.0001 ? t0 : t1;
      return tHit > 0.0001;
    }

    bool intersectEllipsoid(vec3 origin, vec3 direction, out float t0, out float t1) {
      vec3 rel = origin - vCenter;
      vec3 ro = vec3(dot(rel, vEast), dot(rel, vNorth), dot(rel, vNormal)) / vRadii;
      vec3 rd = vec3(dot(direction, vEast), dot(direction, vNorth), dot(direction, vNormal)) / vRadii;
      float a = dot(rd, rd);
      float b = dot(ro, rd);
      float c = dot(ro, ro) - 1.0;
      float h = b * b - a * c;
      if (h <= 0.0 || a <= 0.000001) {
        return false;
      }
      h = sqrt(h);
      t0 = (-b - h) / a;
      t1 = (-b + h) / a;
      return t1 > 0.0001;
    }

    bool intersectSphere(
      vec3 origin,
      vec3 direction,
      float radius,
      out float t0,
      out float t1
    ) {
      float b = dot(origin, direction);
      float c = dot(origin, origin) - radius * radius;
      float h = b * b - c;
      if (h <= 0.0) {
        return false;
      }
      h = sqrt(h);
      t0 = -b - h;
      t1 = -b + h;
      return t1 > 0.0001;
    }

    vec3 worldPointToLocalVolume(vec3 worldPoint) {
      vec3 pointNormal = normalize(worldPoint);
      float fieldU = fract(
        0.5 + atan(pointNormal.z, pointNormal.x) / 6.28318530718 +
          ${CLOUD_FIELD_OFFSET_X.toFixed(8)}
      );
      float fieldV = clamp(
        0.5 - asin(clamp(pointNormal.y, -1.0, 1.0)) / 3.14159265359 +
          ${CLOUD_FIELD_OFFSET_Y.toFixed(8)},
        0.001,
        0.999
      );
      float localX = (fieldU - ${FIXED_PATCH_UV.u0.toFixed(8)}) /
        ${(FIXED_PATCH_UV.u1 - FIXED_PATCH_UV.u0).toFixed(8)} * 2.0 - 1.0;
      float localY = (fieldV - ${FIXED_PATCH_UV.v0.toFixed(8)}) /
        ${(FIXED_PATCH_UV.v1 - FIXED_PATCH_UV.v0).toFixed(8)} * 2.0 - 1.0;
      float localZ = (length(worldPoint) - length(vFieldCenter)) /
        max(vRadii.z, 0.0001);
      return vec3(localX, localY, localZ);
    }

    bool isInsideLocalVolume(vec3 localPoint) {
      return all(greaterThan(localPoint, vec3(-0.999))) &&
        all(lessThan(localPoint, vec3(0.999)));
    }

    bool isInsideLocalVolumeTile(vec2 localPoint) {
      // Tile maxima are exclusive. Adjacent source tiles can meet at a
      // boundary, but never both claim the same V3 column and double tau.
      return all(greaterThanEqual(localPoint, vFieldTile.xy)) &&
        all(lessThan(localPoint, vFieldTile.zw));
    }

    // The local V3 volume follows a spherical Earth shell. Its X/Y values are
    // reconstructed from the same equirectangular direction used by the day
    // map and V3 truth, so a broad source patch cannot drift as a tangent card
    // across the Earth while the camera changes.
    bool intersectLocalVolumeField(vec3 origin, vec3 direction, out float t0, out float t1) {
      float centerRadius = length(vFieldCenter);
      float outerRadius = centerRadius + vRadii.z;
      float innerRadius = max(${(EARTH_RADIUS + 0.0005).toFixed(6)}, centerRadius - vRadii.z);
      float outerEnter;
      float outerExit;
      if (!intersectSphere(origin, direction, outerRadius, outerEnter, outerExit)) {
        return false;
      }
      t0 = max(outerEnter, 0.0);
      t1 = outerExit;
      float innerEnter;
      float innerExit;
      if (intersectSphere(origin, direction, innerRadius, innerEnter, innerExit)) {
        float firstInnerHit = innerEnter > t0 + 0.0001 ? innerEnter : innerExit;
        if (firstInnerHit > t0 + 0.0001) {
          t1 = min(t1, firstInnerHit);
        }
      }
      return t1 > t0 + 0.0001;
    }

    // Integrates rho(q) = (1 - |p + d * q|^2)^2 exactly over [t0, t1].
    // p and d are in unit-ellipsoid coordinates while q remains world
    // distance, so this works for every rotated anisotropic lobe without an
    // extra texture sample or a shadow-map approximation.
    float quarticDensityPrimitive(float a, float b, float c, float t) {
      float t2 = t * t;
      float t3 = t2 * t;
      float t4 = t3 * t;
      float t5 = t4 * t;
      return c * c * t - 2.0 * b * c * t2 +
        (4.0 * b * b - 2.0 * a * c) * t3 / 3.0 +
        a * b * t4 + a * a * t5 / 5.0;
    }

    float quarticDensityIntegral(vec3 p, vec3 d, float t0, float t1) {
      float a = dot(d, d);
      float b = dot(p, d);
      float c = 1.0 - dot(p, p);
      return max(
        quarticDensityPrimitive(a, b, c, t1) -
          quarticDensityPrimitive(a, b, c, t0),
        0.0
      );
    }

    float sunwardExit(vec3 p, vec3 d) {
      float a = dot(d, d);
      float b = dot(p, d);
      float c = dot(p, p) - 1.0;
      float h = b * b - a * c;
      if (a <= 0.000001 || h <= 0.0) {
        return 0.0;
      }
      return max((-b + sqrt(h)) / a, 0.0);
    }

    vec3 decodeOctahedralNormal(vec2 encoded) {
      vec2 folded = encoded * 2.0 - 1.0;
      vec3 normal = vec3(
        folded.x,
        folded.y,
        1.0 - abs(folded.x) - abs(folded.y)
      );
      if (normal.z < 0.0) {
        normal.xy = (1.0 - abs(normal.yx)) * sign(normal.xy);
      }
      return normalize(normal);
    }

    void main() {
      outFarColor = vec4(0.0);
      outNearColor = vec4(0.0);
      vec3 rayDirection = normalize(vProxyPosition - uCameraPosition);
      float earthClosestT = max(-dot(uCameraPosition, rayDirection), 0.0);
      vec3 earthClosest = uCameraPosition + rayDirection * earthClosestT;
      float earthProjectedDistance = length(earthClosest);
      if (earthProjectedDistance > 1.038) {
        discard;
      }
      float limbFade = 1.0 - smoothstep(1.03, 1.038, earthProjectedDistance);
      if (uDebugMode > 1.5 && uDebugMode < 2.5) {
        outColor = vec4(0.05, 0.36, 1.0, 1.0);
        return;
      }
      float cloudEnter;
      float cloudExit;
      if (uLocalVolumeMode > 0.5) {
        if (!intersectLocalVolumeField(uCameraPosition, rayDirection, cloudEnter, cloudExit)) {
          discard;
        }
      } else if (!intersectEllipsoid(uCameraPosition, rayDirection, cloudEnter, cloudExit)) {
        discard;
      }
      cloudEnter = max(cloudEnter, 0.0);
      float earthHit;
      if (intersectEarth(uCameraPosition, rayDirection, earthHit)) {
        cloudExit = min(cloudExit, earthHit);
      }
      float fullCloudEnter = cloudEnter;
      float fullCloudExit = cloudExit;
      // The analytic control keeps disjoint segments. The local-density path
      // below instead applies a smooth partition of unity per sample: bins
      // remain far-to-near optical layers, but their reconstruction colours
      // cannot meet on a hard camera-depth seam.
      if (uDepthBinMode > 1.5 && uLocalVolumeMode < 0.5) {
        if (uBinLayer < 0.5) {
          cloudEnter = max(cloudEnter, uDepthBoundary);
        } else {
          cloudExit = min(cloudExit, uDepthBoundary);
        }
      }
      if (cloudExit <= cloudEnter + 0.0002) {
        discard;
      }
      // Keep the role view isolated from the physical plane diagnostics below.
      // Plane and vertical views must run through the same density/normal path
      // as the final composite; otherwise they would merely visualize the
      // topology role and falsely certify top/side/underside ordering.
      if (uDebugMode > 2.5 && uDebugMode < 3.5) {
        vec3 roleColor = vRole < 0.5
          ? vec3(0.12, 0.42, 1.0)
          : vRole < 1.5
            ? vec3(1.0, 0.35, 0.08)
            : vec3(0.12, 1.0, 0.54);
        outColor = vec4(roleColor * 0.72, 0.72);
        return;
      }
      if (uDebugMode > 0.5 && uDebugMode < 1.5) {
        outColor = vec4(1.0, 0.16, 0.04, 0.72);
        return;
      }
      // Phase -1.2: one V3-derived field, one shared sun lookup, and a true
      // near-to-far Beer–Lambert accumulation. The two depth targets are MRT
      // outputs from the same 4/3 view samples: no bin receives a second full
      // shader draw and the partition retains total optical depth.
      if (uLocalVolumeMode > 0.5) {
        if (vCarrier < 0.5) {
          discard;
        }
        // cloudEnter/cloudExit above already contain the local shell entry,
        // camera clamp, and Earth-depth clip. Reusing that interval avoids a
        // second identical pair of ray/sphere intersections for every local
        // fragment before its source-field samples begin.
        float fieldEnter = cloudEnter;
        float fieldExit = cloudExit;
        if (fieldExit <= fieldEnter + 0.0002) {
          discard;
        }
        // Transport each view sample between the *real* V3 coordinates at the
        // clipped shell entry and exit. Locking every sample to a midpoint
        // column turns an oblique ray back into a 2.5D card, while the prior
        // Jacobian form rebuilt a spherical normal four times per fragment and
        // pushed the 4+1 path over budget. This shallow source patch is safely
        // approximated by endpoint interpolation: it preserves the visible
        // across-patch parallax with the same four view + one sun texture reads
        // and materially lower ALU cost.
        vec3 fieldExitPoint = uCameraPosition + rayDirection * fieldExit;
        // The local-volume proxy is generated directly from the source patch
        // on the outer cloud shell. Its interpolated source coordinate is the
        // exact entry parameterization for this shallow patch, so do not pay a
        // second atan/asin spherical inverse just to recover what the vertex
        // stage already knows. Only the depth-dependent exit needs the exact
        // Earth-local inverse mapping below.
        vec3 fieldEntryLocal = vec3(vSourceLocal, 1.0);
        vec3 fieldExitLocal = worldPointToLocalVolume(fieldExitPoint);
        // Assign the complete view ray to the tile containing its outer-shell
        // entry point. At an oblique camera the ray can travel across multiple
        // source columns as it descends; partitioning *each* sample by tile
        // drops those inner samples because the neighbouring outer proxy does
        // not cover this pixel. Entry ownership keeps tile edges watertight
        // while still letting every sample read its true V3 coordinate.
        if (!isInsideLocalVolumeTile(fieldEntryLocal.xy)) {
          discard;
        }
        // Keep clear V3 columns out of the expensive 3D field march. This is
        // deliberately only a conservative source-footprint guard:
        // level 0 and a threshold just below the V3 coverage floor preserve
        // nearby weather mass at an oblique entry while avoiding four 3D
        // samples for known clear air. It is the one 2D source lookup in the
        // 4+1 / 3+1 budget.
        vec2 sourceFieldUv = mix(
          vec2(${FIXED_PATCH_UV.u0.toFixed(8)}, ${FIXED_PATCH_UV.v0.toFixed(8)}),
          vec2(${FIXED_PATCH_UV.u1.toFixed(8)}, ${FIXED_PATCH_UV.v1.toFixed(8)}),
          fieldEntryLocal.xy * 0.5 + 0.5
        );
        float sourceFootprint = textureLod(uCloudField, sourceFieldUv, 0.0).r;
        if (sourceFootprint < 0.049) {
          discard;
        }
        vec3 fieldColumnNormal = vNormal;
        vec3 fieldColumnEast = vFieldEast;
        vec3 fieldColumnNorth = vFieldNorth;
        float segmentLength = fieldExit - fieldEnter;
        float sampleStepLength = segmentLength / max(uLocalVolumeViewSamples, 1.0);
        float binFeather = max(segmentLength * 0.12, 0.0015);
        float viewJitter = fract(sin(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) * 52.9829189) - 0.5;
        vec3 sunDirection = normalize(uSunDirection);
        float farTau = 0.0;
        float nearTau = 0.0;
        float farTransmittance = 1.0;
        float nearTransmittance = 1.0;
        vec3 farPremultipliedRadiance = vec3(0.0);
        vec3 nearPremultipliedRadiance = vec3(0.0);
        // Accumulate radiance when each source-field sample is fetched. The
        // prior two-pass array staging kept all four samples live across the
        // lighting loop, creating avoidable register pressure on the exact
        // local-volume path bounded by the 4+1 / 3+1 texture budget.
        for (int sampleIndex = 0; sampleIndex < 4; sampleIndex += 1) {
          if (float(sampleIndex) >= uLocalVolumeViewSamples) {
            continue;
          }
          float samplePosition = clamp(
            (float(sampleIndex) + 0.5 + viewJitter * 0.04) / uLocalVolumeViewSamples,
            0.015,
            0.985
          );
          float sampleT = fieldEnter + samplePosition * segmentLength;
          vec3 sampleLocal = mix(fieldEntryLocal, fieldExitLocal, samplePosition);
          // Do not clamp a neighbouring V3 column onto this source patch's
          // boundary. A real outside sample is transparent; its source-edge
          // feather keeps the transition soft without manufacturing a stripe.
          if (any(greaterThanEqual(abs(sampleLocal), vec3(0.999)))) {
            continue;
          }
          vec3 sampleUv = sampleLocal * 0.5 + 0.5;
          vec4 localVolumeSample = texture(uLocalVolumeField, sampleUv);
          float density = localVolumeSample.a;
          if (density <= 0.002) {
            continue;
          }
          // The deeper shell exposes actual tower parallax. Rebalance optical
          // depth by physical step length so that change does not turn the
          // same V3 column into an opaque white slab.
          float sampleTau = density * sampleStepLength * 19.0 * limbFade;
          if (sampleTau <= 0.000001) {
            continue;
          }
          float nearBinWeight = uDepthBinMode > 1.5
            ? 1.0 - smoothstep(
              uDepthBoundary - binFeather,
              uDepthBoundary + binFeather,
              sampleT
            )
            : 0.0;
          float farBinWeight = 1.0 - nearBinWeight;
          float farSampleTau = sampleTau * farBinWeight;
          float nearSampleTau = sampleTau * nearBinWeight;
          float farSampleAlpha = 1.0 - exp(-farSampleTau);
          float nearSampleAlpha = 1.0 - exp(-nearSampleTau);
          // RG is an octahedral encoding of the true 3D source-density
          // gradient. It replaces the former lateral-only normal plus weak
          // artificial Z slope, preserving a physical top/side/underside
          // orientation without consuming another volume sample.
          vec3 densityNormalLocal = decodeOctahedralNormal(localVolumeSample.rg);
          vec3 densityNormal = normalize(
            fieldColumnEast * densityNormalLocal.x +
            fieldColumnNorth * densityNormalLocal.y +
            fieldColumnNormal * densityNormalLocal.z
          );
          if (dot(densityNormal, -rayDirection) < 0.0) {
            densityNormal *= -1.0;
          }
          float vertical = clamp(sampleLocal.z * 0.5 + 0.5, 0.0, 1.0);
          // B is a source-native sunward Beer–Lambert transmittance baked
          // from this exact V3 local field. It gives every view sample its own
          // directional path length without promoting this Phase -1.2 spike
          // into a second runtime shadow march or exceeding 4/3 view reads.
          float sunTransmittance = clamp(localVolumeSample.b, 0.025, 1.0);
          float ndl = clamp(dot(densityNormal, sunDirection), 0.0, 1.0);
          // V3 columns have independent ceilings, so a true cloud top can
          // occur below the global field's uppermost Z slices. Pair the
          // source-local elevation profile with the encoded 3D density
          // normal: a sun-facing top boundary is lit as a top even when its
          // column is lower than a neighbouring tower. The same rule makes a
          // real lower boundary retain a blue-grey underside instead of
          // being mistaken for a flat middle slice.
          float topElevation = smoothstep(0.56, 0.9, vertical) *
            (0.32 + ndl * 0.68);
          float undersideElevation = 1.0 - smoothstep(0.16, 0.54, vertical);
          float side = 1.0 - smoothstep(0.42, 0.9, abs(sampleLocal.z));
          float verticalFacing = dot(densityNormal, vNormal);
          float topFacing = smoothstep(0.34, 0.88, verticalFacing);
          float undersideFacing = smoothstep(0.02, 0.52, -verticalFacing);
          float sideFacing = 1.0 - smoothstep(0.52, 0.94, abs(verticalFacing));
          float topPlane = max(
            topElevation,
            topFacing * (0.28 + ndl * sunTransmittance * 0.72)
          );
          float underside = max(undersideElevation, undersideFacing);
          vec3 finalRadiance;
          if (uDebugMode > 4.5) {
            finalRadiance = vec3(verticalFacing * 0.5 + 0.5);
          } else if (uDebugMode > 3.5) {
            finalRadiance = topFacing > max(sideFacing, undersideFacing)
              ? vec3(1.0, 0.24, 0.08)
              : undersideFacing > sideFacing
                ? vec3(0.08, 0.34, 1.0)
                : vec3(0.12, 0.9, 0.42);
          } else {
            vec3 undersideColor = vec3(0.13, 0.20, 0.29);
            vec3 sideColor = mix(
              vec3(0.19, 0.29, 0.41),
              vec3(0.50, 0.60, 0.70),
              0.30 + ndl * sunTransmittance * 0.62
            );
            vec3 topColor = vec3(0.95, 0.98, 0.97) *
              (0.78 + ndl * sunTransmittance * 0.58);
            finalRadiance = mix(sideColor, topColor, topPlane);
            finalRadiance = mix(finalRadiance, undersideColor, underside * 0.74 + side * underside * 0.18);
            float forward = pow(max(dot(rayDirection, sunDirection), 0.0), 5.0);
            finalRadiance += vec3(0.28, 0.38, 0.5) * forward *
              smoothstep(0.5, 0.92, density) * 0.14;
          }
          farPremultipliedRadiance += farTransmittance * farSampleAlpha * finalRadiance;
          nearPremultipliedRadiance += nearTransmittance * nearSampleAlpha * finalRadiance;
          farTransmittance *= exp(-farSampleTau);
          nearTransmittance *= exp(-nearSampleTau);
          farTau += farSampleTau;
          nearTau += nearSampleTau;
        }
        if (farTau + nearTau <= 0.000001) {
          discard;
        }
        outFarColor = vec4(farPremultipliedRadiance, farTau);
        outNearColor = vec4(nearPremultipliedRadiance, nearTau);
        return;
      }
      // The analytic control has its own ellipsoid midpoint/normal model.
      // Keeping this below the local-volume return is important: local V3
      // tiles never consume these values, so evaluating them before the
      // branch made every source-field fragment pay for an unused second
      // geometry reconstruction.
      float midT = (cloudEnter + cloudExit) * 0.5;
      vec3 midPoint = uCameraPosition + rayDirection * midT;
      float surfaceT = cloudEnter + min((cloudExit - cloudEnter) * 0.025, 0.00025);
      vec3 surfacePoint = uCameraPosition + rayDirection * surfaceT;
      vec3 ellipsoidRayDirection = vec3(
        dot(rayDirection, vEast) / vRadii.x,
        dot(rayDirection, vNorth) / vRadii.y,
        dot(rayDirection, vNormal) / vRadii.z
      );
      vec3 local = vec3(
        dot(midPoint - vCenter, vEast) / vRadii.x,
        dot(midPoint - vCenter, vNorth) / vRadii.y,
        dot(midPoint - vCenter, vNormal) / vRadii.z
      );
      vec3 surfaceLocal = vec3(
        dot(surfacePoint - vCenter, vEast) / vRadii.x,
        dot(surfacePoint - vCenter, vNorth) / vRadii.y,
        dot(surfacePoint - vCenter, vNormal) / vRadii.z
      );
      vec3 ellipsoidSurfaceNormal = normalize(
        vEast * surfaceLocal.x / max(vRadii.x, 0.0001) +
        vNorth * surfaceLocal.y / max(vRadii.y, 0.0001) +
        vNormal * surfaceLocal.z / max(vRadii.z, 0.0001)
      );
      if (dot(ellipsoidSurfaceNormal, -rayDirection) < 0.0) {
        ellipsoidSurfaceNormal *= -1.0;
      }
      // Both the aggregate carrier and its child lobes resolve the same V3
      // Earth-local field.  The carrier deliberately samples a lower mip so
      // it supplies continuous weather mass, while children retain the
      // higher-frequency breakup below.  This keeps the outer cloud shape
      // source-derived instead of turning the carrier into a procedural oval.
      vec3 fieldDirection = normalize(midPoint);
      float fieldLongitude = atan(fieldDirection.z, fieldDirection.x);
      float fieldLatitude = asin(clamp(fieldDirection.y, -1.0, 1.0));
      vec2 fieldUv = vec2(
        0.5 + fieldLongitude / 6.28318530718 + ${CLOUD_FIELD_OFFSET_X.toFixed(6)},
        clamp(
          0.5 - fieldLatitude / 3.14159265359 + ${CLOUD_FIELD_OFFSET_Y.toFixed(6)},
          0.001,
          0.999
        )
      );
      vec4 packedField = textureLod(uCloudField, fieldUv, vCarrier > 0.5 ? 1.6 : 0.35);
      float fieldOpticalBase = clamp((packedField.r - 0.055) / 0.82, 0.0, 1.0);
      float fieldOptical = sqrt(fieldOpticalBase) * mix(
        0.92,
        1.08,
        fieldOpticalBase
      );
      float fieldMask = smoothstep(0.055, 0.16, packedField.r);
      float effectiveHeight = mix(vHeight, packedField.g, 0.7);
      float effectiveMorphology = mix(vMorphology, packedField.b, 0.62);
      float effectiveConcavity = mix(vConcavity, packedField.a, 0.58);
      float fieldStructure =
        mix(0.72, 1.12, effectiveMorphology) *
        mix(1.03, 0.84, effectiveConcavity);
      // The carrier is derived from the real V3 candidate hierarchy on the
      // CPU, so it already carries V3 density, height, morphology, and
      // concavity.  Evaluate that broad low-frequency body before converting
      // every covered pixel back to equirectangular UVs.  That avoids an
      // atan/asin + texture fetch on the largest proxy while keeping all
      // children tied to the exact V3 field below.
      if (vCarrier > 0.5) {
        float carrierLocalRadius2 = dot(local, local);
        float carrierSegment = cloudExit - cloudEnter;
        float carrierQuarticIntegral = quarticDensityIntegral(
          local,
          ellipsoidRayDirection,
          -carrierSegment * 0.5,
          carrierSegment * 0.5
        );
        // The carrier must provide one continuous cloud body, but a perfect
        // circle would read as an analytic test balloon rather than a weather
        // system. Keep the silhouette low-frequency and connected (three
        // broad lobes plus a weak secondary roll), then let the V3-backed
        // children supply the local tower/detail relief inside it.
        float carrierAngle = atan(local.y, local.x);
        float carrierLobeRadius = 1.0 +
          sin(carrierAngle * 3.0 + vMorphology * 5.3) * 0.11 +
          sin(carrierAngle * 5.0 - vConcavity * 4.1) * 0.045;
        float carrierSilhouette = 1.0 - smoothstep(
          carrierLobeRadius,
          carrierLobeRadius + 0.36,
          length(local.xy)
        );
        float carrierOptical = smoothstep(0.06, 0.2, mix(vDensity, fieldOptical, 0.72));
        float carrierStructure =
          mix(0.8, 1.04, effectiveMorphology) *
          mix(1.02, 0.9, effectiveConcavity);
        // Optical mass must have a vertical occupation profile as well as a
        // radial one. A uniform ellipsoid remains a soft extrusion even when
        // its near and far segments are correctly composited. The profile is
        // deliberately broad for the glue carrier: it gives the body a
        // readable blue-grey lower volume without owning the tower silhouette.
        float carrierTopLimit = mix(0.44, 0.8, effectiveHeight);
        float carrierVerticalCore = smoothstep(-0.92, -0.28, local.z) *
          (1.0 - smoothstep(carrierTopLimit, 0.99, local.z));
        float carrierVerticalDensity = mix(0.42, 1.0, carrierVerticalCore);
        // Leave enough transmittance for the parented V3 lobes to form a
        // visible top / side / underside hierarchy instead of hiding them
        // behind one opaque proxy.
        // A glue carrier receives strictly less optical mass than its real V3
        // base descendants. It removes seams but cannot erase tower parallax.
        // The carrier is glue: it resolves broad source mass in the back bin,
        // but its front segment deliberately remains translucent so it cannot
        // turn a physically split result back into one smooth foreground cap.
        float carrierBinWeight = uDepthBinMode > 1.5
          ? (uBinLayer < 0.5 ? 0.68 : 0.16)
          : 0.54;
        float carrierTau = carrierQuarticIntegral * mix(vDensity, fieldOptical, 0.68) *
          mix(220.0, 320.0, vHeight) * 0.014 * carrierBinWeight * carrierOptical *
          carrierStructure * carrierVerticalDensity * limbFade *
          carrierSilhouette * fieldMask;
        if (carrierTau <= 0.000001) {
          discard;
        }
        vec3 carrierNormal = ellipsoidSurfaceNormal;
        vec3 carrierSunDirection = normalize(uSunDirection);
        float carrierNdl = clamp(dot(carrierNormal, carrierSunDirection), 0.0, 1.0);
        vec3 carrierSunLocalDirection = vec3(
          dot(carrierSunDirection, vEast) / vRadii.x,
          dot(carrierSunDirection, vNorth) / vRadii.y,
          dot(carrierSunDirection, vNormal) / vRadii.z
        );
        float carrierSunTau = quarticDensityIntegral(
          local,
          carrierSunLocalDirection,
          0.0,
          sunwardExit(local, carrierSunLocalDirection)
        ) * mix(vDensity, fieldOptical, 0.68) * 135.0;
        float carrierSunTransmittance = exp(-carrierSunTau);
        float carrierVerticalFacing = dot(carrierNormal, vNormal);
        float carrierTopFace = smoothstep(0.34, 0.88, carrierVerticalFacing);
        float carrierUndersideFace = smoothstep(0.02, 0.52, -carrierVerticalFacing);
        float carrierSideFace = 1.0 - smoothstep(
          0.52,
          0.94,
          abs(carrierVerticalFacing)
        );
        if (uDebugMode > 4.5) {
          float facing = carrierVerticalFacing * 0.5 + 0.5;
          outColor = vec4(vec3(facing) * carrierTau, carrierTau);
          return;
        }
        if (uDebugMode > 3.5) {
          vec3 planeColor = carrierTopFace > max(carrierSideFace, carrierUndersideFace)
            ? vec3(1.0, 0.24, 0.08)
            : carrierUndersideFace > carrierSideFace
              ? vec3(0.08, 0.34, 1.0)
              : vec3(0.12, 0.9, 0.42);
          outColor = vec4(planeColor * carrierTau, carrierTau);
          return;
        }
        // Its scattering is deliberately quieter than a real V3 child. The
        // carrier may bridge a gap but may not read as the cloud's bright top
        // surface; that visual job belongs to base/tower segments.
        vec3 carrierTop = vec3(0.28, 0.35, 0.42) *
          (0.4 + carrierNdl * carrierSunTransmittance * 0.28);
        vec3 carrierSide = vec3(0.09, 0.15, 0.22) *
          (0.54 + carrierNdl * carrierSunTransmittance * 0.18);
        vec3 carrierUnderside = vec3(0.045, 0.08, 0.13);
        float carrierTopPlane = clamp(
          carrierTopFace * 0.8 + smoothstep(0.2, 0.65, vHeight) * 0.2,
          0.0,
          1.0
        );
        float carrierUndersidePlane = clamp(
          carrierUndersideFace * 0.9 + (1.0 - vHeight) * 0.1,
          0.0,
          1.0
        );
        vec3 carrierColor = mix(carrierSide, carrierTop, carrierTopPlane);
        carrierColor = mix(carrierColor, carrierUnderside, carrierUndersidePlane);
        float carrierRim = pow(
          1.0 - abs(dot(rayDirection, carrierNormal)),
          3.0
        );
        carrierColor += vec3(0.34, 0.48, 0.66) * carrierRim * carrierNdl * 0.035;
        outColor = vec4(carrierColor * carrierTau, carrierTau);
        return;
      }
      // Keep meso-scale V3 structure in the children. The carrier stays low
      // frequency; this sample resolves the cloud-top breakup inside it.
      float isBase = 1.0 - step(0.5, vRole);
      float isTower = step(0.5, vRole) * (1.0 - step(1.5, vRole));
      float isDetail = step(1.5, vRole);
      float localR2 = dot(local, local);
      vec2 edgeDirection = local.xy / max(length(local.xy), 0.0001);
      float edgeCross = edgeDirection.x * edgeDirection.y;
      float edgeQuadrupole =
        edgeDirection.x * edgeDirection.x -
        edgeDirection.y * edgeDirection.y;
      float edgeSeed = fract(vMorphology * 3.71 + vConcavity * 5.13) * 2.0 - 1.0;
      float roleBoundary;
      float roleEdgeFeather;
      float roleOpticalScale;
      float roleTopWeight;
      float roleConcavity;
      float roleSilver;
      float cellularBreakup;
      if (vRole < 0.5) {
        // The base role carries one continuous optical mass.  It must not be
        // trimmed into a repeated row of isolated ellipsoid discs before the
        // analytic density has a chance to overlap with its neighbours.
        roleBoundary = 0.96 +
          edgeCross * 0.045 +
          edgeQuadrupole * 0.03 +
          edgeSeed * 0.02;
        roleEdgeFeather = 0.32;
        roleOpticalScale = 0.86;
        roleTopWeight = 0.75;
        roleConcavity = 0.55;
        roleSilver = 0.28;
        float baseWave = sin(
          dot(local.xy, vec2(2.15, -1.55)) +
          effectiveMorphology * 2.1 +
          effectiveConcavity * 1.4
        );
        cellularBreakup = mix(0.93, 1.035, smoothstep(-0.86, 0.86, baseWave));
      } else if (vRole < 1.5) {
        roleBoundary = 0.82 +
          edgeCross * 0.18 +
          edgeQuadrupole * 0.11 +
          edgeSeed * 0.07;
        roleEdgeFeather = 0.16;
        roleOpticalScale = 0.68;
        roleTopWeight = 0.86;
        roleConcavity = 1.0;
        roleSilver = 1.0;
        float towerWave = sin(
          dot(local.xy, vec2(6.3, -4.4)) +
          effectiveMorphology * 5.2 +
          effectiveConcavity * 3.4
        );
        cellularBreakup = mix(0.5, 1.06, smoothstep(-0.68, 0.84, towerWave));
      } else {
        roleBoundary = 0.88 +
          edgeCross * 0.09 +
          edgeQuadrupole * 0.055 +
          edgeSeed * 0.035;
        roleEdgeFeather = 0.075;
        roleOpticalScale = 0.16;
        roleTopWeight = 0.42;
        roleConcavity = 0.78;
        roleSilver = 0.7;
        float detailWave = sin(
          dot(local.xy, vec2(13.7, -9.2)) +
          effectiveMorphology * 8.3 +
          effectiveConcavity * 5.1
        );
        cellularBreakup = mix(0.64, 1.08, smoothstep(-0.55, 0.82, detailWave)) *
          mix(0.9, 1.05, effectiveMorphology);
      }
      float silhouetteMask = 1.0 - smoothstep(
        roleBoundary,
        roleBoundary + roleEdgeFeather,
        length(local.xy)
      );
      float childBreakupMask = smoothstep(
        0.54,
        0.92,
        cellularBreakup + effectiveMorphology * 0.16
      );
      silhouetteMask *= mix(
        1.0,
        childBreakupMask,
        clamp(isTower + isDetail, 0.0, 1.0)
      );
      float erosion = smoothstep(
        0.05,
        0.92,
        vDensity * 0.68 + fieldOptical * 0.34 + effectiveMorphology * 0.38 +
          local.z * 0.16 - localR2 * 0.28
      );
      float shellHeight = clamp(
        (length(midPoint) - ${CLOUD_BASE_RADIUS.toFixed(6)}) /
          ${(CLOUD_HEIGHT_RADIUS * 0.72).toFixed(6)},
        0.0,
        1.0
      );
      float top = smoothstep(
        max(0.06, effectiveHeight * 0.34),
        max(0.2, effectiveHeight * 0.92),
        shellHeight
      );
      float bottom = 1.0 - smoothstep(
        0.035,
        max(0.16, effectiveHeight * 0.48),
        shellHeight
      );
      vec3 sunDir = normalize(uSunDirection);
      vec3 cloudSurfaceNormal = ellipsoidSurfaceNormal;
      vec3 sunLocalDirection = vec3(
        dot(sunDir, vEast) / vRadii.x,
        dot(sunDir, vNorth) / vRadii.y,
        dot(sunDir, vNormal) / vRadii.z
      );
      float sunSelfTau = quarticDensityIntegral(
        local,
        sunLocalDirection,
        0.0,
        sunwardExit(local, sunLocalDirection)
      ) * vDensity * mix(96.0, 148.0, effectiveHeight);
      // This is the only extinction term in the direct-light path. The
      // normal remains a phase/plane cue, not a second fake shadow.
      float sunTransmittance = exp(-sunSelfTau);
      float sunOpening = smoothstep(0.32, 0.9, dot(cloudSurfaceNormal, sunDir)) *
        (0.08 + effectiveMorphology * 0.12);
      float ndl = clamp(dot(cloudSurfaceNormal, sunDir), 0.0, 1.0);
      float verticalFacing = dot(cloudSurfaceNormal, vNormal);
      // Treat the outer third of a convex lobe as a participating cloud side
      // rather than allowing its almost-horizontal front cap to remain a flat
      // white decal. The actual analytic normal still decides the ordering;
      // these broader transitions model volumetric scatter across the rim.
      float topFace = smoothstep(0.34, 0.88, verticalFacing);
      float undersideFace = smoothstep(0.02, 0.52, -verticalFacing);
      float sideFace = 1.0 - smoothstep(0.52, 0.94, abs(verticalFacing));
      float segment = cloudExit - cloudEnter;
      float localRayA = dot(ellipsoidRayDirection, ellipsoidRayDirection);
      float localRayB = dot(local, ellipsoidRayDirection);
      float coreRadius = max(1.0 - localR2, 0.0);
      float segment2 = segment * segment;
      float segment3 = segment2 * segment;
      float segment5 = segment3 * segment2;
      float quadraticIntegral = max(
        coreRadius * segment - localRayA * segment3 / 12.0,
        0.0
      );
      float quarticIntegral =
        coreRadius * coreRadius * segment +
        (4.0 * localRayB * localRayB - 2.0 * coreRadius * localRayA) * segment3 / 12.0 +
        localRayA * localRayA * segment5 / 80.0;
      float shapeIntegral =
        quadraticIntegral * isBase +
        max(quarticIntegral, 0.0) * (isTower + isDetail);
      vec3 carrierDelta = midPoint - uCarrierCenter;
      float carrierRadius = length(vec2(
        dot(carrierDelta, uCarrierEast) / max(uCarrierRadii.x, 0.0001),
        dot(carrierDelta, uCarrierNorth) / max(uCarrierRadii.y, 0.0001)
      ));
      float carrierContainment = 1.0 - smoothstep(0.72, 1.04, carrierRadius);
      float roleErosion = mix(
        mix(0.88, 1.0, erosion),
        mix(0.7, 0.98, erosion),
        isDetail
      );
      float tau = shapeIntegral * vDensity * mix(280.0, 520.0, effectiveHeight) *
        roleErosion * cellularBreakup * roleOpticalScale * silhouetteMask *
        fieldMask * fieldOptical * fieldStructure * limbFade;
      // The child density has the same closed-form radial integral as the
      // carrier, plus a midpoint vertical occupation profile. This separates
      // top, side, and underside optical mass without a second field sample
      // or a second cloud shell. The low non-zero floor prevents a black cut
      // edge on the underside while the high cloud top remains finite.
      float childTopLimit = mix(0.4, 0.84, effectiveHeight);
      float childVerticalCore = smoothstep(-0.94, -0.3, local.z) *
        (1.0 - smoothstep(childTopLimit, 0.99, local.z));
      float childVerticalDensity = mix(0.3, 1.0, childVerticalCore);
      tau *= childVerticalDensity;
      // The view split remains geometric: each ellipsoid segment is clipped
      // at the shared depth boundary. Role only biases which valid segment
      // carries most of a layer's visual mass. Broad bases therefore hold the
      // weather body in the far target, while parented towers/details retain
      // enough near optical mass to create a readable front interruption.
      float roleBinWeight = 1.0;
      if (uDepthBinMode > 1.5) {
        bool farLayer = uBinLayer < 0.5;
        if (isBase > 0.5) {
          roleBinWeight = farLayer ? 1.0 : 0.34;
        } else if (isTower > 0.5) {
          roleBinWeight = farLayer ? 0.3 : 1.0;
        } else {
          roleBinWeight = farLayer ? 0.44 : 0.82;
        }
      }
      tau *= roleBinWeight;
      // The shared carrier owns the silhouette. Child lobes may add local
      // height and breakup inside it, but cannot protrude as a necklace of
      // individually readable ellipsoids along the cloud's lower edge.
      float baseContainment = pow(carrierContainment, 1.55);
      float childContainment = pow(carrierContainment, 2.35);
      // Towers can crest above the continuous glue only on their upper,
      // sun-facing side. Their lower edge remains contained, preventing the
      // old detached-bead silhouette while making a real parallax cue.
      float towerEscape = smoothstep(0.12, 0.78, verticalFacing) *
        smoothstep(-0.05, 0.72, dot(cloudSurfaceNormal, sunDir));
      float nestedContainment = mix(
        baseContainment,
        childContainment,
        clamp(isTower + isDetail, 0.0, 1.0)
      );
      nestedContainment = mix(
        nestedContainment,
        mix(childContainment, 1.0, towerEscape * 0.76),
        isTower
      );
      tau *= nestedContainment;
      if (uDebugMode > 4.5) {
        float facing = verticalFacing * 0.5 + 0.5;
        outColor = vec4(vec3(facing) * tau, tau);
        return;
      }
      if (uDebugMode > 3.5) {
        // True surface-plane diagnostic: no lighting heuristic feeds this
        // output.  It uses the same analytic normal and optical mass as the
        // final composite so evidence can verify top/side/underside coverage.
        vec3 planeColor = topFace > max(sideFace, undersideFace)
          ? vec3(1.0, 0.24, 0.08)
          : undersideFace > sideFace
            ? vec3(0.08, 0.34, 1.0)
            : vec3(0.12, 0.9, 0.42);
        outColor = vec4(planeColor * tau, tau);
        return;
      }
      vec3 underside = mix(
        vec3(0.18, 0.25, 0.32),
        vec3(0.36, 0.43, 0.49),
        bottom * 0.72 + 0.18
      );
      vec3 sideColor = mix(
        vec3(0.16, 0.23, 0.31),
        vec3(0.42, 0.49, 0.56),
        ndl * sunTransmittance * 0.66 + sunOpening * 0.2
      );
      float directLight = 0.32 + ndl * sunTransmittance * 0.86;
      vec3 litTop = vec3(0.82, 0.86, 0.87) *
        min(directLight + sunOpening * 0.24, 1.05);
      float fieldTop = smoothstep(0.2, 0.58, effectiveHeight) * (0.32 + ndl * 0.3);
      float topLighting = clamp(
        max(
          topFace * (0.28 + ndl * sunTransmittance * 0.92) * roleTopWeight,
          max(top, fieldTop) * topFace * (0.38 + sunTransmittance * 0.62) * roleTopWeight
        ),
        0.0,
        1.0
      );
      vec3 color = mix(sideColor, litTop, topLighting);
      color = mix(color, underside, undersideFace * (0.68 + effectiveConcavity * 0.18));
      // Local height is the volume plane used for density, not a rim tint.
      // It lets the lower, longer optical paths remain blue-grey even when a
      // front-facing ellipsoid normal would otherwise read as a flat white
      // cap. The direct sun path remains governed only by sunTransmittance.
      float lowerVolume = 1.0 - smoothstep(-0.12, 0.46, local.z);
      color = mix(color, underside, lowerVolume * (0.24 + roleConcavity * 0.18));
      // Preserve a legible middle plane in the actual composite.  A low sun
      // must not leave every visible lobe equally white; side-facing density
      // has a separate blue-grey response before the underside takes over.
      color = mix(color, sideColor, sideFace * (0.72 + roleConcavity * 0.12));
      color *= 1.0 - effectiveConcavity * bottom * 0.28 * roleConcavity;
      float silverBase = clamp(
        1.0 - abs(dot(rayDirection, cloudSurfaceNormal)),
        0.0,
        1.0
      );
      float silver = silverBase * silverBase * silverBase *
        smoothstep(0.3, 1.0, ndl + effectiveMorphology * 0.28);
      float forwardBase = clamp(dot(rayDirection, sunDir), 0.0, 1.0);
      float forwardSquared = forwardBase * forwardBase;
      float forwardScatter = forwardSquared * forwardSquared * forwardSquared;
      color += vec3(0.58, 0.72, 0.84) * silver *
        (0.16 + forwardScatter * 0.44) * roleSilver;
      outColor = vec4(color * tau, tau);
    }
  `);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed.");
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

function createEarthProgram(gl: WebGL2RenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, `#version 300 es
    precision highp float;

    in vec3 aPosition;

    uniform mat4 uViewProjection;
    uniform vec3 uCameraPosition;

    out vec3 vNormal;
    out float vFacing;
    out vec2 vUv;

    void main() {
      vNormal = normalize(aPosition);
      vFacing = dot(vNormal, normalize(uCameraPosition));
      float longitude = atan(vNormal.z, vNormal.x);
      float latitude = asin(clamp(vNormal.y, -1.0, 1.0));
      vUv = vec2(fract(longitude / ${(TAU).toFixed(8)} + 0.5), 0.5 - latitude / 3.14159265);
      gl_Position = uViewProjection * vec4(aPosition, 1.0);
    }
  `);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;

    in vec3 vNormal;
    in float vFacing;
    in vec2 vUv;

    uniform sampler2D uDayTexture;
    uniform vec3 uSunDirection;

    out vec4 outColor;

    void main() {
      if (vFacing < -0.02) {
        discard;
      }
      float limb = pow(1.0 - clamp(vFacing, 0.0, 1.0), 2.2);
      float ndl = max(dot(normalize(vNormal), normalize(uSunDirection)), 0.0);
      float daylight = 0.26 + ndl * 0.74;
      vec3 day = texture(uDayTexture, vUv).rgb;
      vec3 color = day * vec3(0.56, 0.64, 0.7) * daylight + vec3(0.006, 0.014, 0.022);
      color = mix(color, vec3(0.025, 0.1, 0.16), limb * 0.56);
      color += vec3(0.045, 0.2, 0.36) * limb * 0.32;
      outColor = vec4(color, 1.0);
    }
  `);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create Earth program.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Earth program link failed.");
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

function createCompositeProgram(gl: WebGL2RenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, `#version 300 es
    precision highp float;

    const vec2 POSITIONS[3] = vec2[3](
      vec2(-1.0, -1.0),
      vec2(3.0, -1.0),
      vec2(-1.0, 3.0)
    );

    out vec2 vUv;

    void main() {
      vec2 position = POSITIONS[gl_VertexID];
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;

    uniform sampler2D uFarAccumulation;
    uniform sampler2D uNearAccumulation;
    uniform float uDepthBinMode;
    uniform float uLocalVolumeMode;
    uniform float uCompositeDebugMode;
    in vec2 vUv;
    out vec4 outColor;

    void main() {
      vec4 farAccumulated = texture(uFarAccumulation, vUv);
      vec4 nearAccumulated = uDepthBinMode > 1.5
        ? texture(uNearAccumulation, vUv)
        : vec4(0.0);
      float farTau = max(farAccumulated.a, 0.0);
      float nearTau = max(nearAccumulated.a, 0.0);
      float farAlpha = 1.0 - exp(-farTau);
      float nearAlpha = 1.0 - exp(-nearTau);
      // Analytic control output follows the historical RGB=sum(L*tau) form.
      // Local-volume output is already front-to-back premultiplied radiance;
      // do not divide it by tau or the correct Beer–Lambert attenuation would
      // be turned back into a centroid average during composite.
      vec3 farPremul = uLocalVolumeMode > 0.5
        ? max(farAccumulated.rgb, vec3(0.0))
        : (farTau > 0.00001
          ? max(farAccumulated.rgb / farTau, vec3(0.0)) * farAlpha
          : vec3(0.0));
      vec3 nearPremul = uLocalVolumeMode > 0.5
        ? max(nearAccumulated.rgb, vec3(0.0))
        : (nearTau > 0.00001
          ? max(nearAccumulated.rgb / nearTau, vec3(0.0)) * nearAlpha
          : vec3(0.0));
      // Near is closer to the camera (smaller t), therefore it is resolved
      // over the farther layer exactly once.
      vec3 premul = nearPremul + (1.0 - nearAlpha) * farPremul;
      float alpha = 1.0 - (1.0 - nearAlpha) * (1.0 - farAlpha);
      if (uCompositeDebugMode > 4.5) {
        vec3 nearRadiance = nearAlpha > 0.00001
          ? nearPremul / nearAlpha
          : vec3(0.0);
        outColor = vec4(nearRadiance, 1.0);
        return;
      }
      if (uCompositeDebugMode > 3.5) {
        outColor = vec4(vec3(nearAlpha), 1.0);
        return;
      }
      if (uCompositeDebugMode > 2.5) {
        vec3 farRadiance = farAlpha > 0.00001
          ? farPremul / farAlpha
          : vec3(0.0);
        outColor = vec4(farRadiance, 1.0);
        return;
      }
      if (uCompositeDebugMode > 1.5) {
        vec3 compositeRadiance = alpha > 0.00001 ? premul / alpha : vec3(0.0);
        outColor = vec4(compositeRadiance, 1.0);
        return;
      }
      if (uCompositeDebugMode > 0.5) {
        outColor = vec4(vec3(alpha), 1.0);
        return;
      }
      outColor = vec4(premul, alpha);
    }
  `);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create composite program.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Composite program link failed.");
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

interface AccumulationTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface LocalVolumeAccumulationTarget {
  farTexture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  height: number;
  nearTexture: WebGLTexture;
  width: number;
}

function createAccumulationTarget(gl: WebGL2RenderingContext, width: number, height: number): AccumulationTarget {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) {
      gl.deleteTexture(texture);
    }
    if (framebuffer) {
      gl.deleteFramebuffer(framebuffer);
    }
    throw new Error("Unable to create RGBA16F accumulation target.");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    throw new Error("RGBA16F accumulation framebuffer is incomplete.");
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { framebuffer, height, texture, width };
}

function disposeAccumulationTarget(gl: WebGL2RenderingContext, target: AccumulationTarget | null) {
  if (!target) {
    return;
  }
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

function createLocalVolumeAccumulationTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): LocalVolumeAccumulationTarget {
  const framebuffer = gl.createFramebuffer();
  const farTexture = gl.createTexture();
  const nearTexture = gl.createTexture();
  if (!framebuffer || !farTexture || !nearTexture) {
    if (framebuffer) {
      gl.deleteFramebuffer(framebuffer);
    }
    if (farTexture) {
      gl.deleteTexture(farTexture);
    }
    if (nearTexture) {
      gl.deleteTexture(nearTexture);
    }
    throw new Error("Unable to create local-volume MRT accumulation target.");
  }
  const configureTexture = (texture: WebGLTexture) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      width,
      height,
      0,
      gl.RGBA,
      gl.HALF_FLOAT,
      null
    );
  };
  configureTexture(farTexture);
  configureTexture(nearTexture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    farTexture,
    0
  );
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT1,
    gl.TEXTURE_2D,
    nearTexture,
    0
  );
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  if (!complete) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(farTexture);
    gl.deleteTexture(nearTexture);
    throw new Error("Local-volume RGBA16F MRT accumulation framebuffer is incomplete.");
  }
  return { farTexture, framebuffer, height, nearTexture, width };
}

function disposeLocalVolumeAccumulationTarget(
  gl: WebGL2RenderingContext,
  target: LocalVolumeAccumulationTarget | null
) {
  if (!target) {
    return;
  }
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.farTexture);
  gl.deleteTexture(target.nearTexture);
}

function createEarthSphereMesh(segments = 96, rings = 48) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const latitude = (v - 0.5) * Math.PI;
    const cosLatitude = Math.cos(latitude);
    const sinLatitude = Math.sin(latitude);
    for (let x = 0; x <= segments; x += 1) {
      const u = x / segments;
      const longitude = (u - 0.5) * TAU;
      vertices.push(
        EARTH_RADIUS * cosLatitude * Math.cos(longitude),
        EARTH_RADIUS * sinLatitude,
        EARTH_RADIUS * cosLatitude * Math.sin(longitude)
      );
    }
  }
  for (let y = 0; y < rings; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const row = segments + 1;
      const a = y * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return {
    indices: new Uint16Array(indices),
    vertices: new Float32Array(vertices)
  };
}

function probeRgba16fAdditive(gl: WebGL2RenderingContext) {
  const colorBufferFloat = Boolean(gl.getExtension("EXT_color_buffer_float"));
  const floatBlend = Boolean(gl.getExtension("EXT_float_blend"));
  const texture = gl.createTexture();
  const nearTexture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const addVertex = createShader(gl, gl.VERTEX_SHADER, `#version 300 es
    precision highp float;
    const vec2 POSITIONS[3] = vec2[3](
      vec2(-1.0, -1.0),
      vec2(3.0, -1.0),
      vec2(-1.0, 3.0)
    );
    void main() {
      gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
    }
  `);
  const addFragment = createShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    uniform vec4 uValue;
    layout(location = 0) out vec4 outFar;
    layout(location = 1) out vec4 outNear;
    void main() {
      outFar = uValue;
      outNear = uValue;
    }
  `);
  const addProgram = gl.createProgram();
  if (!addProgram) {
    throw new Error("Unable to create RGBA16F additive probe program.");
  }
  gl.attachShader(addProgram, addVertex);
  gl.attachShader(addProgram, addFragment);
  gl.linkProgram(addProgram);
  gl.deleteShader(addVertex);
  gl.deleteShader(addFragment);
  if (!gl.getProgramParameter(addProgram, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(addProgram) ?? "RGBA16F additive probe link failed.";
    gl.deleteProgram(addProgram);
    throw new Error(info);
  }

  const copyVertex = createShader(gl, gl.VERTEX_SHADER, `#version 300 es
    precision highp float;
    const vec2 POSITIONS[3] = vec2[3](
      vec2(-1.0, -1.0),
      vec2(3.0, -1.0),
      vec2(-1.0, 3.0)
    );
    out vec2 vUv;
    void main() {
      vec2 position = POSITIONS[gl_VertexID];
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `);
  const copyFragment = createShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    uniform sampler2D uProbe;
    in vec2 vUv;
    out vec4 outColor;
    void main() {
      outColor = texture(uProbe, clamp(vUv, vec2(0.25), vec2(0.75)));
    }
  `);
  const copyProgram = gl.createProgram();
  if (!copyProgram) {
    gl.deleteProgram(addProgram);
    throw new Error("Unable to create RGBA16F copy probe program.");
  }
  gl.attachShader(copyProgram, copyVertex);
  gl.attachShader(copyProgram, copyFragment);
  gl.linkProgram(copyProgram);
  gl.deleteShader(copyVertex);
  gl.deleteShader(copyFragment);
  if (!gl.getProgramParameter(copyProgram, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(copyProgram) ?? "RGBA16F copy probe link failed.";
    gl.deleteProgram(addProgram);
    gl.deleteProgram(copyProgram);
    throw new Error(info);
  }

  const rgba8Texture = gl.createTexture();
  const rgba8Framebuffer = gl.createFramebuffer();
  let rgba16fTexture = false;
  let framebufferComplete = false;
  let additiveDraw = false;
  let multipleRenderTargets = false;
  let verified = false;
  let readbackMode: "float" | "rgba8-copy" | "none" = "none";
  const expected = [0.25, 0.5, 0.75, 1.0];
  const approx = (actual: number, target: number, tolerance: number) => Math.abs(actual - target) <= tolerance;
  try {
    if (texture && nearTexture && framebuffer) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
      rgba16fTexture = gl.getError() === gl.NO_ERROR;
      gl.bindTexture(gl.TEXTURE_2D, nearTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null);
      rgba16fTexture = rgba16fTexture && gl.getError() === gl.NO_ERROR;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, nearTexture, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      framebufferComplete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    if (
      colorBufferFloat && floatBlend && rgba16fTexture && framebufferComplete &&
      texture && nearTexture && framebuffer
    ) {
      gl.viewport(0, 0, 4, 4);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.colorMask(true, true, true, true);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(addProgram);
      gl.uniform4f(gl.getUniformLocation(addProgram, "uValue"), 0.125, 0.25, 0.375, 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      additiveDraw = gl.getError() === gl.NO_ERROR;
      gl.disable(gl.BLEND);
      if (additiveDraw) {
        const floatPixels = new Float32Array(4);
        const nearFloatPixels = new Float32Array(4);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, floatPixels);
        const farReadback = gl.getError() === gl.NO_ERROR && expected.every((value, index) => (
          approx(floatPixels[index] ?? -1, value, 0.015)
        ));
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, nearFloatPixels);
        const nearReadback = gl.getError() === gl.NO_ERROR && expected.every((value, index) => (
          approx(nearFloatPixels[index] ?? -1, value, 0.015)
        ));
        multipleRenderTargets = farReadback && nearReadback;
        if (multipleRenderTargets) {
          verified = true;
          readbackMode = "float";
        } else {
          while (gl.getError() !== gl.NO_ERROR) {
            // Drain errors before the RGBA8 copy fallback.
          }
          if (rgba8Texture && rgba8Framebuffer) {
            gl.bindTexture(gl.TEXTURE_2D, rgba8Texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, rgba8Framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rgba8Texture, 0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
              gl.viewport(0, 0, 4, 4);
              gl.disable(gl.BLEND);
              gl.useProgram(copyProgram);
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, texture);
              gl.uniform1i(gl.getUniformLocation(copyProgram, "uProbe"), 0);
              gl.drawArrays(gl.TRIANGLES, 0, 3);
              const bytePixels = new Uint8Array(4);
              gl.readBuffer(gl.COLOR_ATTACHMENT0);
              gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytePixels);
              verified = gl.getError() === gl.NO_ERROR && [64, 128, 191, 255].every((value, index) => (
                Math.abs((bytePixels[index] ?? -999) - value) <= 5
              ));
              readbackMode = verified ? "rgba8-copy" : "none";
            }
          }
        }
      }
    }
  } finally {
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (rgba8Framebuffer) {
      gl.deleteFramebuffer(rgba8Framebuffer);
    }
    if (rgba8Texture) {
      gl.deleteTexture(rgba8Texture);
    }
    gl.deleteProgram(addProgram);
    gl.deleteProgram(copyProgram);
    if (framebuffer) {
      gl.deleteFramebuffer(framebuffer);
    }
    if (texture) {
      gl.deleteTexture(texture);
    }
    if (nearTexture) {
      gl.deleteTexture(nearTexture);
    }
  }
  const verdict: "pass" | "fail" = colorBufferFloat && floatBlend && framebufferComplete &&
    rgba16fTexture && additiveDraw && multipleRenderTargets && verified
    ? "pass"
    : "fail";
  return {
    additiveDraw,
    colorBufferFloat,
    floatBlend,
    framebufferComplete,
    multipleRenderTargets,
    readbackMode,
    rgba16fTexture,
    verified,
    verdict
  };
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

export function LuBirthHybridCloudKillSpikeRoute() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("loading");
  const [telemetry, setTelemetry] = useState<KillSpikeTelemetry | null>(null);
  const [camera, setCamera] = useState<KillSpikeCamera>("near");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setCamera(resolveCamera());
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const cleanupCallbacks: Array<() => void> = [];
    const frameTimes: number[] = [];
    const coverageSamples: number[] = [];
    const membershipChurnSamples: number[] = [];
    const hierarchyMembershipChurnSamples: number[] = [];
    const spatialP95Samples: number[] = [];

    async function run() {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const response = await fetch(TRUTH_SRC);
      const truth = parseTruth(await response.arrayBuffer());
      const truthSourceUvBounds = resolveTruthSourceUvBounds(truth);
      const sourcePatchSummary = summarizeSourcePatch(truth);
      if (cancelled) {
        return;
      }
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: true,
        powerPreference: "high-performance",
        premultipliedAlpha: true
      });
      if (!gl) {
        const fallbackTelemetry: KillSpikeTelemetry = {
          active: false,
          camera,
          capability: "fallback",
          coverageMeanEstimate: 0,
          coverageAreaTemporalP95Estimate: 0,
          coverageSpatialP95Estimate: 0,
          coverageTemporalP95Estimate: 0,
          frameP95Ms: 0,
          accumulationProbe: {
            additiveDraw: false,
            colorBufferFloat: false,
            floatBlend: false,
            framebufferComplete: false,
            multipleRenderTargets: false,
            readbackMode: "none",
            rgba16fTexture: false,
            verified: false,
            verdict: "fail"
          },
          accumulationSize: [0, 0],
          accumulationTargetCount: 0,
          depthBinBoundary: 0,
          depthBinMode: resolveDepthBinMode(),
          depthBinRolePriorMassEstimate: { far: 0, near: 0 },
          depthBinSegmentation: "view-ray-clipped",
          depthBinSubmittedLobeCount: { far: 0, near: 0 },
          compositeScissor: [0, 0, 0, 0],
          candidateHash: "",
          candidateHashSchema: "fnv1a-instance-buffer-v3",
          candidateSetCount: 0,
          candidateSeedRange: [0, 0],
          cameraMatrixSignature: "",
          cameraFrameId: `${camera}-fallback`,
          coordinateSpace: "earth-local-v3",
          densityProfileVersion: "source-native-patch-height-field-v4",
          earthOccludedCenterCount: 0,
          frustumCulledCount: 0,
          gpuP50Ms: null,
          gpuP95Ms: null,
          gpuTimingSamplesMs: [],
          gpuFieldResolution: CLOUD_FIELD_GPU_RESOLUTION,
          gpuFieldSource: CLOUD_FIELD_GPU_SRC,
          gpuRenderer: "webgl2-unavailable",
          gpuPhaseSampleCount: 0,
          gpuPhaseP95Ms: {
            accumulation: null,
            clear: null,
            composite: null
          },
          gpuPhaseTimingSamplesMs: {
            accumulation: [],
            clear: [],
            composite: []
          },
          gpuSampleCount: 0,
          gpuDisjointResetCount: 0,
          gpuPhaseSampleInterval: GPU_PHASE_SAMPLE_INTERVAL,
          gpuTotalSampleInterval: GPU_TOTAL_SAMPLE_INTERVAL,
          gpuTimingScope: "rgba16f-depth-layer-accumulation-composite",
          gpuTimerSupported: false,
          gpuWarmupFrames: GPU_TIMING_WARMUP_FRAMES,
          gpuWindowSize: GPU_TIMING_WINDOW,
          generatorVersion: truth.header.generatorVersion,
          hierarchyHash: "",
          hierarchyMetrics: {
            baseCarrierContainmentRatio: 0,
            baseCarrierFootprintUnionCoverageRatio: 0,
            baseCount: 0,
            baseComponentCount: 0,
            detailMeanElevation: 0,
            maxBaseNearestNeighborDistance: 0,
            maxBaseNormalizedNearestSeparation: 0,
            maxNormalizedTangentAttachment: 0,
            towerMeanElevation: 0
          },
          hierarchyVersion: "base-tower-detail-v4",
          hierarchyMembershipChurnRatio: 0,
          hierarchyMembershipChurnTemporalP95: 0,
          hierarchySubmittedLobeCount: 0,
          hierarchySubmittedMembershipHash: "",
          hierarchySubmittedRoleCounts: { base: 0, detail: 0, tower: 0 },
          baseCarrierCount: 0,
          layoutId: truth.header.layoutId,
          lobeCount: 0,
          localVolumeFieldResolution: null,
          localVolumeFieldVersion: null,
          localVolumeTileCount: 0,
          localVolumeTileProjectedBounds: [],
          localVolumeTileSignals: [],
          localVolumeAccumulationDrawCount: 0,
          localVolumeSourceMaskTextureLookupCountPerPixel: 0,
          localVolumeSunTextureLookupCountPerPixel: 0,
          localVolumeTotalTextureLookupCountPerPixel: 0,
          localVolumeViewSamples: 0,
          localVolumeViewTextureLookupCountPerPixel: 0,
          lobeHierarchy: [],
          lobeRoleCounts: { base: 0, detail: 0, tower: 0 },
          membershipChurnRatio: 0,
          membershipChurnTemporalP95: 0,
          offset: [CLOUD_FIELD_OFFSET_X, CLOUD_FIELD_OFFSET_Y],
          orientation: truth.header.orientation,
          occludedCount: 0,
          opticalMassEstimate: 0,
          orphanChildCount: 0,
          parentedLobeCount: 0,
          physicalSize: [window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio],
          resolvedSize: [0, 0],
          scissorEnabled: false,
          sourceSha256: truth.header.sourceSha256,
          rendererMode: resolveRendererMode(),
          sourcePatchFootprintCoverageRatio: sourcePatchSummary.footprintCoverageRatio,
          sourcePatchHeightP05: sourcePatchSummary.heightP05,
          sourcePatchHeightP95: sourcePatchSummary.heightP95,
          sourcePatchMeanCoverage: sourcePatchSummary.meanCoverage,
          sourceUvBounds: [
            truthSourceUvBounds.u0,
            truthSourceUvBounds.v0,
            truthSourceUvBounds.u1,
            truthSourceUvBounds.v1
          ],
          submittedLobeCount: 0,
          submittedMembershipHash: "",
          submittedRoleCounts: { base: 0, detail: 0, tower: 0 },
          sunDirection: [0, 1, 0],
          sweepProgress: 0,
          tier: resolveTier(window.innerWidth, window.innerHeight),
          topologyDistanceSpace: "earth-local-tangent-normalized-radius",
          visibleCount: 0
        };
        window.__MiraLithLuBirthHybridKillSpike = fallbackTelemetry;
        setTelemetry(fallbackTelemetry);
        setStatus("fallback: no webgl2");
        return;
      }
      const debugRendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const gpuRenderer = String(gl.getParameter(
        debugRendererInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER
      ));
      const scissorEnabled = readParam("scissor") !== "off";

      let currentCanvasWidth = 0;
      let currentCanvasHeight = 0;
      const resize = () => {
        const tier = resolveTier(window.innerWidth, window.innerHeight);
        const cap = tier === "mobile"
          ? { height: 270, width: 480 }
          : { height: 640, width: 960 };
        const physicalWidth = Math.max(1, Math.floor(window.innerWidth * window.devicePixelRatio));
        const physicalHeight = Math.max(1, Math.floor(window.innerHeight * window.devicePixelRatio));
        const renderScale = 0.5;
        const nextWidth = Math.min(Math.ceil(physicalWidth * renderScale), cap.width);
        const nextHeight = Math.min(Math.ceil(physicalHeight * renderScale), cap.height);
        if (nextWidth !== currentCanvasWidth || nextHeight !== currentCanvasHeight) {
          currentCanvasWidth = nextWidth;
          currentCanvasHeight = nextHeight;
          canvas.width = nextWidth;
          canvas.height = nextHeight;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        canvas.style.width = "100vw";
        canvas.style.height = "100vh";
        return { physicalHeight, physicalWidth, tier };
      };

      let { physicalHeight, physicalWidth, tier } = resize();
      if (cancelled) {
        return;
      }
      const earthDayTexture = await loadTexture(gl, EARTH_DAY_SRC, () => cancelled);
      cleanupCallbacks.push(() => gl.deleteTexture(earthDayTexture));
      if (cancelled) {
        gl.deleteTexture(earthDayTexture);
        return;
      }
      const cloudTruthTexture = await loadTexture(gl, CLOUD_FIELD_GPU_SRC, () => cancelled);
      cleanupCallbacks.push(() => gl.deleteTexture(cloudTruthTexture));
      if (cancelled) {
        gl.deleteTexture(cloudTruthTexture);
        return;
      }
      const lobes = buildLobes(truth, tier);
      const baseCarrier = lobes.find((lobe) => lobe.isCarrier);
      if (!baseCarrier) {
        throw new Error("Hybrid hierarchy did not produce its base optical carrier.");
      }
      const sunDirection = resolveSpikeSunDirection();
      const rendererMode = resolveRendererMode();
      const localVolumeField = rendererMode === "local-volume"
        ? buildLocalVolumeField(truth, lobes, baseCarrier, tier)
        : null;
      const localVolumeTiles = rendererMode === "local-volume" && localVolumeField
        ? buildLocalVolumeTiles(baseCarrier, localVolumeField, tier)
        : [];
      const localVolumeTexture = localVolumeField
        ? createLocalVolumeTexture(gl, localVolumeField)
        : null;
      if (localVolumeTexture) {
        cleanupCallbacks.push(() => gl.deleteTexture(localVolumeTexture));
      }
      const candidateInstanceData = createInstanceData(lobes);
      const candidateHash = makeInstanceBufferHash(candidateInstanceData);
      const hierarchyHash = makeHierarchyHash(lobes);
      const hierarchyMetrics = summarizeHierarchy(lobes);
      const lobeRoleCounts = countLobeRoles(lobes);
      const lobeIds = new Set(lobes.map((lobe) => lobe.id));
      const parentedLobeCount = lobes.filter((lobe) => lobe.parentId != null).length;
      const orphanChildCount = lobes.filter((lobe) => (
        lobe.parentId != null && !lobeIds.has(lobe.parentId)
      )).length;
      const program = createProgram(gl);
      cleanupCallbacks.push(() => gl.deleteProgram(program));
      const earthProgram = createEarthProgram(gl);
      cleanupCallbacks.push(() => gl.deleteProgram(earthProgram));
      const depthBinMode = resolveDepthBinMode();
      const accumulationProbe = probeRgba16fAdditive(gl);
      if (
        rendererMode === "local-volume" && depthBinMode === 2 &&
        (!accumulationProbe.multipleRenderTargets || accumulationProbe.verdict !== "pass")
      ) {
        throw new Error("The local-volume two-bin experiment requires verified RGBA16F MRT blending.");
      }
      const compositeProgram = createCompositeProgram(gl);
      cleanupCallbacks.push(() => gl.deleteProgram(compositeProgram));
      let farAccumulationTarget: AccumulationTarget | null = null;
      let nearAccumulationTarget: AccumulationTarget | null = null;
      let localVolumeAccumulationTarget: LocalVolumeAccumulationTarget | null = null;
      cleanupCallbacks.push(() => {
        disposeAccumulationTarget(gl, farAccumulationTarget);
        disposeAccumulationTarget(gl, nearAccumulationTarget);
        disposeLocalVolumeAccumulationTarget(gl, localVolumeAccumulationTarget);
        farAccumulationTarget = null;
        nearAccumulationTarget = null;
        localVolumeAccumulationTarget = null;
      });
      const earthMesh = createEarthSphereMesh();
      const earthVao = gl.createVertexArray();
      gl.bindVertexArray(earthVao);
      cleanupCallbacks.push(() => {
        if (earthVao) {
          gl.deleteVertexArray(earthVao);
        }
      });
      const earthVertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, earthVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, earthMesh.vertices, gl.STATIC_DRAW);
      cleanupCallbacks.push(() => {
        if (earthVertexBuffer) {
          gl.deleteBuffer(earthVertexBuffer);
        }
      });
      const earthPositionLocation = gl.getAttribLocation(earthProgram, "aPosition");
      gl.enableVertexAttribArray(earthPositionLocation);
      gl.vertexAttribPointer(earthPositionLocation, 3, gl.FLOAT, false, 0, 0);
      const earthIndexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, earthIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, earthMesh.indices, gl.STATIC_DRAW);
      cleanupCallbacks.push(() => {
        if (earthIndexBuffer) {
          gl.deleteBuffer(earthIndexBuffer);
        }
      });
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      cleanupCallbacks.push(() => {
        if (vao) {
          gl.deleteVertexArray(vao);
        }
      });
      const corners = createProxyCorners(LOCAL_VOLUME_TILE_SUBDIVISIONS);
      const cornerVertexCount = corners.length / 2;
      const cornerBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
      cleanupCallbacks.push(() => {
        if (cornerBuffer) {
          gl.deleteBuffer(cornerBuffer);
        }
      });
      const cornerLocation = gl.getAttribLocation(program, "aCorner");
      gl.enableVertexAttribArray(cornerLocation);
      gl.vertexAttribPointer(cornerLocation, 2, gl.FLOAT, false, 0, 0);

      const instanceCapacity = Math.max(lobes.length, localVolumeTiles.length);
      const instanceData = new Float32Array(instanceCapacity * 24);
      const instanceBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instanceData.byteLength, gl.DYNAMIC_DRAW);
      cleanupCallbacks.push(() => {
        if (instanceBuffer) {
          gl.deleteBuffer(instanceBuffer);
        }
      });
      const centerLocation = gl.getAttribLocation(program, "iCenterRadius");
      gl.enableVertexAttribArray(centerLocation);
      gl.vertexAttribPointer(centerLocation, 4, gl.FLOAT, false, 96, 0);
      gl.vertexAttribDivisor(centerLocation, 1);
      const eastLocation = gl.getAttribLocation(program, "iEastRadius");
      gl.enableVertexAttribArray(eastLocation);
      gl.vertexAttribPointer(eastLocation, 4, gl.FLOAT, false, 96, 16);
      gl.vertexAttribDivisor(eastLocation, 1);
      const northLocation = gl.getAttribLocation(program, "iNorthRadius");
      gl.enableVertexAttribArray(northLocation);
      gl.vertexAttribPointer(northLocation, 4, gl.FLOAT, false, 96, 32);
      gl.vertexAttribDivisor(northLocation, 1);
      const materialLocation = gl.getAttribLocation(program, "iMaterial");
      gl.enableVertexAttribArray(materialLocation);
      gl.vertexAttribPointer(materialLocation, 4, gl.FLOAT, false, 96, 48);
      gl.vertexAttribDivisor(materialLocation, 1);
      const topologyLocation = gl.getAttribLocation(program, "iTopology");
      gl.enableVertexAttribArray(topologyLocation);
      gl.vertexAttribPointer(topologyLocation, 4, gl.FLOAT, false, 96, 64);
      gl.vertexAttribDivisor(topologyLocation, 1);
      const fieldTileLocation = gl.getAttribLocation(program, "iFieldTile");
      gl.enableVertexAttribArray(fieldTileLocation);
      gl.vertexAttribPointer(fieldTileLocation, 4, gl.FLOAT, false, 96, 80);
      gl.vertexAttribDivisor(fieldTileLocation, 1);

      const carrierCenterLocation = gl.getUniformLocation(program, "uCarrierCenter");
      const carrierEastLocation = gl.getUniformLocation(program, "uCarrierEast");
      const carrierNorthLocation = gl.getUniformLocation(program, "uCarrierNorth");
      const carrierRadiiLocation = gl.getUniformLocation(program, "uCarrierRadii");
      const cloudFieldLocation = gl.getUniformLocation(program, "uCloudField");
      const localVolumeFieldLocation = gl.getUniformLocation(program, "uLocalVolumeField");
      const debugModeLocation = gl.getUniformLocation(program, "uDebugMode");
      const binLayerLocation = gl.getUniformLocation(program, "uBinLayer");
      const depthBoundaryLocation = gl.getUniformLocation(program, "uDepthBoundary");
      const depthBinModeLocation = gl.getUniformLocation(program, "uDepthBinMode");
      const localVolumeModeLocation = gl.getUniformLocation(program, "uLocalVolumeMode");
      const localVolumeViewSamplesLocation = gl.getUniformLocation(program, "uLocalVolumeViewSamples");
      const sunDirectionLocation = gl.getUniformLocation(program, "uSunDirection");
      const viewProjectionLocation = gl.getUniformLocation(program, "uViewProjection");
      const cameraPositionLocation = gl.getUniformLocation(program, "uCameraPosition");
      const earthViewProjectionLocation = gl.getUniformLocation(earthProgram, "uViewProjection");
      const earthCameraPositionLocation = gl.getUniformLocation(earthProgram, "uCameraPosition");
      const earthDayTextureLocation = gl.getUniformLocation(earthProgram, "uDayTexture");
      const earthSunDirectionLocation = gl.getUniformLocation(earthProgram, "uSunDirection");
      const compositeFarAccumulationLocation = gl.getUniformLocation(
        compositeProgram,
        "uFarAccumulation"
      );
      const compositeNearAccumulationLocation = gl.getUniformLocation(
        compositeProgram,
        "uNearAccumulation"
      );
      const compositeDepthBinModeLocation = gl.getUniformLocation(compositeProgram, "uDepthBinMode");
      const compositeLocalVolumeModeLocation = gl.getUniformLocation(
        compositeProgram,
        "uLocalVolumeMode"
      );
      const compositeDebugModeLocation = gl.getUniformLocation(compositeProgram, "uCompositeDebugMode");
      const timerExt = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      const gpuSamples: number[] = [];
      const gpuClearSamples: number[] = [];
      const gpuAccumulationSamples: number[] = [];
      const gpuCompositeSamples: number[] = [];
      type GpuPhase = "accumulation" | "clear" | "composite";
      type GpuQueryScope = GpuPhase | "total";
      type PendingGpuQuery = { frame: number; phase: GpuPhase; query: WebGLQuery };
      type PendingGpuScopeQuery = Omit<PendingGpuQuery, "phase"> & { phase: GpuQueryScope };
      const pendingQueries: PendingGpuScopeQuery[] = [];
      let gpuWarmupUntilFrame = GPU_TIMING_WARMUP_FRAMES;
      let gpuDisjointResetCount = 0;
      const pushWindowedSample = (samples: number[], value: number) => {
        samples.push(value);
        if (samples.length > GPU_TIMING_WINDOW) {
          samples.shift();
        }
      };
      const resetGpuTimingWindow = (frame: number) => {
        gpuDisjointResetCount += 1;
        for (const pending of pendingQueries.splice(0)) {
          gl.deleteQuery(pending.query);
        }
        gpuSamples.splice(0);
        gpuClearSamples.splice(0);
        gpuAccumulationSamples.splice(0);
        gpuCompositeSamples.splice(0);
        gpuWarmupUntilFrame = frame + GPU_TIMING_WARMUP_FRAMES;
      };
      const measureGpuPhase = (
        phase: GpuPhase,
        frame: number,
        enabled: boolean,
        drawPhase: () => void
      ) => {
        if (!timerExt || frame <= gpuWarmupUntilFrame || !enabled) {
          drawPhase();
          return;
        }
        const query = gl.createQuery();
        if (!query) {
          drawPhase();
          return;
        }
        gl.beginQuery(timerExt.TIME_ELAPSED_EXT, query);
        drawPhase();
        gl.endQuery(timerExt.TIME_ELAPSED_EXT);
        pendingQueries.push({ frame, phase, query });
      };
      cleanupCallbacks.push(() => {
        for (const pending of pendingQueries.splice(0)) {
          gl.deleteQuery(pending.query);
        }
      });

      gl.useProgram(program);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      setStatus("running");
      let lastTelemetryUpdate = 0;
      let frameIndex = 0;
      let previousHierarchySubmittedIds: Set<number> | null = null;
      let previousRendererSubmittedIds: Set<number> | null = null;
      let submittedSignature = "";
      let sweepStartTime: number | null = null;
      const viewProjectionArray = new Float32Array(16);
      const transparentAccumulation = new Float32Array([0, 0, 0, 0]);
      const farInstanceData = new Float32Array(instanceCapacity * 24);
      const nearInstanceData = new Float32Array(instanceCapacity * 24);

      const draw = (now: number) => {
        if (cancelled) {
          return;
        }
        frameIndex += 1;
        const start = performance.now();
        ({ physicalHeight, physicalWidth, tier } = resize());
        const localVolumeSamplingBudget = rendererMode === "local-volume"
          ? resolveLocalVolumeSamplingBudget(tier, depthBinMode)
          : {
            accumulationDrawCount: 0,
            sunTextureLookupsPerPixel: 0,
            viewTextureLookupsPerPixel: 0
          };
        const accumulationWidth = canvas.width;
        const accumulationHeight = canvas.height;
        const useLocalVolumeMrt = rendererMode === "local-volume";
        let activeFarAccumulationTarget: AccumulationTarget;
        let activeNearAccumulationTarget: AccumulationTarget | null;
        let activeLocalVolumeAccumulationTarget: LocalVolumeAccumulationTarget | null = null;
        if (useLocalVolumeMrt) {
          if (
            !localVolumeAccumulationTarget ||
            localVolumeAccumulationTarget.width !== accumulationWidth ||
            localVolumeAccumulationTarget.height !== accumulationHeight
          ) {
            disposeLocalVolumeAccumulationTarget(gl, localVolumeAccumulationTarget);
            localVolumeAccumulationTarget = createLocalVolumeAccumulationTarget(
              gl,
              accumulationWidth,
              accumulationHeight
            );
          }
          activeLocalVolumeAccumulationTarget = localVolumeAccumulationTarget;
          activeFarAccumulationTarget = {
            framebuffer: activeLocalVolumeAccumulationTarget.framebuffer,
            height: activeLocalVolumeAccumulationTarget.height,
            texture: activeLocalVolumeAccumulationTarget.farTexture,
            width: activeLocalVolumeAccumulationTarget.width
          };
          activeNearAccumulationTarget = {
            framebuffer: activeLocalVolumeAccumulationTarget.framebuffer,
            height: activeLocalVolumeAccumulationTarget.height,
            texture: activeLocalVolumeAccumulationTarget.nearTexture,
            width: activeLocalVolumeAccumulationTarget.width
          };
        } else {
          if (!farAccumulationTarget || farAccumulationTarget.width !== accumulationWidth ||
            farAccumulationTarget.height !== accumulationHeight) {
            disposeAccumulationTarget(gl, farAccumulationTarget);
            farAccumulationTarget = createAccumulationTarget(gl, accumulationWidth, accumulationHeight);
          }
          if (depthBinMode === 2 && (!nearAccumulationTarget ||
            nearAccumulationTarget.width !== accumulationWidth ||
            nearAccumulationTarget.height !== accumulationHeight)) {
            disposeAccumulationTarget(gl, nearAccumulationTarget);
            nearAccumulationTarget = createAccumulationTarget(gl, accumulationWidth, accumulationHeight);
          }
          if (depthBinMode === 1 && nearAccumulationTarget) {
            disposeAccumulationTarget(gl, nearAccumulationTarget);
            nearAccumulationTarget = null;
          }
          if (!farAccumulationTarget || (depthBinMode === 2 && !nearAccumulationTarget)) {
            setStatus("error");
            return;
          }
          activeFarAccumulationTarget = farAccumulationTarget;
          activeNearAccumulationTarget = nearAccumulationTarget;
        }
        if (sweepStartTime == null) {
          sweepStartTime = now;
        }
        const sweepProgress = camera === "sweep"
          ? 0.5 - Math.cos((now - sweepStartTime) / 8000 * TAU) * 0.5
          : camera === "oblique"
            ? 1
            : 0;
        const cameraFrame = resolveCameraFrame(
          camera,
          canvas.width / Math.max(canvas.height, 1),
          sweepProgress
        );
        const depthBoundary = rendererMode === "local-volume"
          ? resolveLocalVolumeDepthBoundary(baseCarrier, localVolumeTiles, cameraFrame.eye)
          : Math.sqrt(lengthSquared3(subtract3(baseCarrier.center, cameraFrame.eye)));
        viewProjectionArray.set(cameraFrame.viewProjection);
        const submittedLobes = lobes.filter((lobe) => (
          isConservativelySubmittable(lobe, cameraFrame.eye, viewProjectionArray)
        ));
        const farRolePriorLobes = submittedLobes.filter((lobe) => (
          lobe.isCarrier || lobe.role === "base"
        ));
        const nearRolePriorLobes = submittedLobes.filter((lobe) => (
          !lobe.isCarrier && (lobe.role === "tower" || lobe.role === "detail")
        ));
        // A role is a shape prior, not a depth classification.  Submit a lobe
        // to every target whose ray-depth interval its conservative enclosing
        // sphere can reach; the fragment shader then clips the exact analytic
        // ellipsoid segment at uDepthBoundary.  This preserves front/back
        // information without turning a two-target pass into two full draws.
        const depthBinRadius = (lobe: CloudLobe) => (
          Math.max(lobe.radiusEast, lobe.radiusNorth, lobe.radiusUp) * 1.08
        );
        const canReachFarDepthBin = (lobe: CloudLobe) => (
          Math.sqrt(lengthSquared3(subtract3(lobe.center, cameraFrame.eye))) +
            depthBinRadius(lobe) >= depthBoundary
        );
        const canReachNearDepthBin = (lobe: CloudLobe) => (
          Math.sqrt(lengthSquared3(subtract3(lobe.center, cameraFrame.eye))) -
            depthBinRadius(lobe) <= depthBoundary
        );
        const analyticFarDepthBinLobes = depthBinMode === 2
          ? submittedLobes.filter(canReachFarDepthBin)
          : submittedLobes;
        const analyticNearDepthBinLobes = depthBinMode === 2
          ? submittedLobes.filter(canReachNearDepthBin)
          : [];
        // The local-volume candidate keeps one field and one MRT draw, but
        // submits only source-bearing V3 patch tiles. This removes empty
        // carrier pixels from the 4+1 path without turning hierarchy children
        // back into independent ellipsoid sheets.
        const submittedLocalVolumeTiles = submittedLobes.some((lobe) => lobe.id === baseCarrier.id)
          ? localVolumeTiles.filter((tile) => (
            isConservativelySubmittable(tile, cameraFrame.eye, viewProjectionArray)
          ))
          : [];
        const farDepthBinLobes = rendererMode === "local-volume"
          ? submittedLocalVolumeTiles
          : analyticFarDepthBinLobes;
        const nearDepthBinLobes = rendererMode === "local-volume"
          ? (depthBinMode === 2 ? submittedLocalVolumeTiles : [])
          : analyticNearDepthBinLobes;
        // Keep the hierarchy culling record separate from the render record.
        // Local-volume intentionally turns many hierarchy members into one
        // source-bearing field proxy; reporting hierarchy candidates as
        // submitted GPU work made coverage and visibility telemetry describe a
        // renderer that did not exist.
        const rendererSubmittedLobes = rendererMode === "local-volume"
          ? submittedLocalVolumeTiles
          : submittedLobes;
        const visibilityEstimate = estimateProjectedVisibility(
          lobes,
          rendererSubmittedLobes,
          cameraFrame.eye,
          viewProjectionArray,
          canvas.width,
          canvas.height
        );
        coverageSamples.push(visibilityEstimate.coverage);
        if (coverageSamples.length > 180) {
          coverageSamples.shift();
        }
        spatialP95Samples.push(visibilityEstimate.spatialP95);
        if (spatialP95Samples.length > 180) {
          spatialP95Samples.shift();
        }
        const visibleCount = visibilityEstimate.projectedCount;
        const occludedCount = visibilityEstimate.earthOccludedCenterCount;
        const hierarchyMembershipChurnRatio = calculateMembershipChurn(
          previousHierarchySubmittedIds,
          submittedLobes
        );
        previousHierarchySubmittedIds = new Set(submittedLobes.map((lobe) => lobe.id));
        hierarchyMembershipChurnSamples.push(hierarchyMembershipChurnRatio);
        if (hierarchyMembershipChurnSamples.length > 180) {
          hierarchyMembershipChurnSamples.shift();
        }
        const membershipChurnRatio = calculateMembershipChurn(
          previousRendererSubmittedIds,
          rendererSubmittedLobes
        );
        previousRendererSubmittedIds = new Set(rendererSubmittedLobes.map((lobe) => lobe.id));
        membershipChurnSamples.push(membershipChurnRatio);
        if (membershipChurnSamples.length > 180) {
          membershipChurnSamples.shift();
        }
        const hierarchySubmittedMembershipHash = makeLobeMembershipHash(submittedLobes);
        const submittedMembershipHash = makeLobeMembershipHash(rendererSubmittedLobes);
        const opticalMassEstimate = estimateOpticalMass(submittedLobes);
        const farRolePriorMassEstimate = estimateOpticalMass(farRolePriorLobes);
        const nearRolePriorMassEstimate = estimateOpticalMass(nearRolePriorLobes);
        const hierarchySubmittedRoleCounts = countLobeRoles(submittedLobes);
        const submittedRoleCounts = countLobeRoles(rendererSubmittedLobes);
        const projectedCompositeScissor = rendererMode === "local-volume" && localVolumeField
          ? estimateLocalVolumeCompositeScissor(
            localVolumeField,
            baseCarrier,
            viewProjectionArray,
            canvas.width,
            canvas.height
          ) ?? estimateCompositeScissor(
            submittedLocalVolumeTiles,
            cameraFrame.eye,
            viewProjectionArray,
            canvas.width,
            canvas.height
          )
          : estimateCompositeScissor(
            submittedLobes,
            cameraFrame.eye,
            viewProjectionArray,
            canvas.width,
            canvas.height
          );
        // Proxy bounds are measured in the full drawing buffer, while the
        // RGBA16F accumulation target is contractually half resolution. Passing
        // full-size coordinates directly to gl.scissor silently expanded the
        // region to the entire target and erased the intended fill-rate saving.
        const compositeScissor = scaleScissorToTarget(
          projectedCompositeScissor,
          canvas.width,
          canvas.height,
          activeFarAccumulationTarget.width,
          activeFarAccumulationTarget.height
        );
        const localVolumeTileProjectedBounds = rendererMode === "local-volume"
          ? submittedLocalVolumeTiles.flatMap((tile) => {
            const bounds = estimateProjectedProxyBounds(
              tile,
              cameraFrame.eye,
              viewProjectionArray,
              canvas.width,
              canvas.height
            );
            return bounds
              ? [[bounds.minX, bounds.minY, bounds.maxX, bounds.maxY] as [number, number, number, number]]
              : [];
          })
          : [];
        const nextSubmittedSignature = `${cameraFrame.id}:${canvas.width}x${canvas.height}:` +
          `${rendererSubmittedLobes.length}:${submittedMembershipHash}`;
        if (nextSubmittedSignature !== submittedSignature) {
          submittedSignature = nextSubmittedSignature;
          instanceData.set(createInstanceData(rendererSubmittedLobes));
          gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            instanceData.subarray(0, rendererSubmittedLobes.length * 24)
          );
        }
        gl.clearColor(0, 0, 0, 0);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.useProgram(earthProgram);
        gl.uniformMatrix4fv(earthViewProjectionLocation, false, viewProjectionArray);
        gl.uniform3f(earthCameraPositionLocation, cameraFrame.eye[0], cameraFrame.eye[1], cameraFrame.eye[2]);
        gl.uniform3f(
          earthSunDirectionLocation,
          sunDirection[0],
          sunDirection[1],
          sunDirection[2]
        );
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, earthDayTexture);
        gl.uniform1i(earthDayTextureLocation, 0);
        gl.bindVertexArray(earthVao);
        gl.drawElements(gl.TRIANGLES, earthMesh.indices.length, gl.UNSIGNED_SHORT, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, activeFarAccumulationTarget.framebuffer);
        if (useLocalVolumeMrt) {
          gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        } else {
          gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        }
        gl.viewport(0, 0, activeFarAccumulationTarget.width, activeFarAccumulationTarget.height);
        gl.clearColor(0, 0, 0, 0);
        gl.colorMask(true, true, true, true);
        if (scissorEnabled) {
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(
            compositeScissor[0],
            compositeScissor[1],
            compositeScissor[2],
            compositeScissor[3]
          );
        } else {
          gl.disable(gl.SCISSOR_TEST);
        }
        const sampleGpuPhases = Boolean(
          timerExt &&
          frameIndex > gpuWarmupUntilFrame &&
          Math.min(
            gpuClearSamples.length,
            gpuAccumulationSamples.length,
            gpuCompositeSamples.length
          ) < GPU_PHASE_MIN_REPORT_SAMPLES &&
          frameIndex % GPU_PHASE_SAMPLE_INTERVAL === 0
        );
        let totalGpuQuery: WebGLQuery | null = null;
        if (
          timerExt &&
          frameIndex > gpuWarmupUntilFrame &&
          !sampleGpuPhases &&
          frameIndex % GPU_TOTAL_SAMPLE_INTERVAL === 0
        ) {
          totalGpuQuery = gl.createQuery();
          if (totalGpuQuery) {
            gl.beginQuery(timerExt.TIME_ELAPSED_EXT, totalGpuQuery);
          }
        }
        measureGpuPhase("clear", frameIndex, sampleGpuPhases, () => {
          // clearBufferfv stays on the typed floating-point attachment path;
          // on tile renderers it avoids the generic clear conversion used by
          // clear(COLOR_BUFFER_BIT) for an RGBA16F accumulation target.
          gl.clearBufferfv(gl.COLOR, 0, transparentAccumulation);
          if (useLocalVolumeMrt && activeLocalVolumeAccumulationTarget) {
            gl.clearBufferfv(gl.COLOR, 1, transparentAccumulation);
          } else if (depthBinMode === 2 && activeNearAccumulationTarget) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, activeNearAccumulationTarget.framebuffer);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            gl.viewport(0, 0, activeNearAccumulationTarget.width, activeNearAccumulationTarget.height);
            if (scissorEnabled) {
              gl.enable(gl.SCISSOR_TEST);
              gl.scissor(
                compositeScissor[0],
                compositeScissor[1],
                compositeScissor[2],
                compositeScissor[3]
              );
            }
            gl.clearBufferfv(gl.COLOR, 0, transparentAccumulation);
            gl.bindFramebuffer(gl.FRAMEBUFFER, activeFarAccumulationTarget.framebuffer);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            gl.viewport(0, 0, activeFarAccumulationTarget.width, activeFarAccumulationTarget.height);
          }
        });
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.useProgram(program);
        gl.uniform3f(
          carrierCenterLocation,
          baseCarrier.center[0],
          baseCarrier.center[1],
          baseCarrier.center[2]
        );
        gl.uniform3f(
          carrierEastLocation,
          baseCarrier.east[0],
          baseCarrier.east[1],
          baseCarrier.east[2]
        );
        gl.uniform3f(
          carrierNorthLocation,
          baseCarrier.north[0],
          baseCarrier.north[1],
          baseCarrier.north[2]
        );
        gl.uniform2f(
          carrierRadiiLocation,
          baseCarrier.radiusEast,
          baseCarrier.radiusNorth
        );
        const debugMode = resolveDebugMode();
        const compositeDebugMode = debugMode === "planes"
          ? 3
          : debugMode === "near-radiance"
            ? 5
            : debugMode === "near-tau"
              ? 4
              : debugMode === "far-radiance"
                ? 3
                : debugMode === "radiance-only"
                  ? 2
                  : debugMode === "tau-only"
                    ? 1
                    : 0;
        gl.uniform1f(
          debugModeLocation,
          debugMode === "roles"
            ? 3
            : debugMode === "planes"
              ? 4
              : debugMode === "vertical"
                ? 5
              : debugMode === "proxy"
              ? 2
              : debugMode === "cloud-hit"
                ? 1
                : 0
        );
        gl.uniform3f(
          sunDirectionLocation,
          sunDirection[0],
          sunDirection[1],
          sunDirection[2]
        );
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, cloudTruthTexture);
        gl.uniform1i(cloudFieldLocation, 2);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_3D, localVolumeTexture);
        gl.uniform1i(localVolumeFieldLocation, 4);
        gl.uniformMatrix4fv(viewProjectionLocation, false, viewProjectionArray);
        gl.uniform3f(cameraPositionLocation, cameraFrame.eye[0], cameraFrame.eye[1], cameraFrame.eye[2]);
        gl.uniform1f(depthBinModeLocation, depthBinMode);
        gl.uniform1f(depthBoundaryLocation, depthBoundary);
        gl.uniform1f(localVolumeModeLocation, rendererMode === "local-volume" ? 1 : 0);
        gl.uniform1f(
          localVolumeViewSamplesLocation,
          localVolumeSamplingBudget.viewTextureLookupsPerPixel
        );
        gl.bindVertexArray(vao);
        measureGpuPhase("accumulation", frameIndex, sampleGpuPhases, () => {
          if (useLocalVolumeMrt) {
            // One sparse source-patch tile draw, one fragment invocation per
            // active field region, two RGBA16F MRT outputs. The shader
            // partitions every sampled tau into its physical far/near layer,
            // preserving the fixed 4+1 / 3+1 texture-read budget.
            writeInstanceData(submittedLocalVolumeTiles, farInstanceData);
            gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
                farInstanceData.subarray(0, submittedLocalVolumeTiles.length * 24)
            );
            gl.uniform1f(binLayerLocation, 0);
            gl.drawArraysInstanced(
              gl.TRIANGLES,
              0,
              cornerVertexCount,
              submittedLocalVolumeTiles.length
            );
          } else {
            // The analytic A/B control remains intentionally unchanged: a
            // segment can be clipped into both independent target draws.
            writeInstanceData(farDepthBinLobes, farInstanceData);
            gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
              gl.bufferSubData(
                gl.ARRAY_BUFFER,
                0,
                farInstanceData.subarray(0, farDepthBinLobes.length * 24)
            );
            gl.uniform1f(binLayerLocation, 0);
            gl.drawArraysInstanced(
              gl.TRIANGLES,
              0,
              cornerVertexCount,
              farDepthBinLobes.length
            );
            if (depthBinMode === 2 && activeNearAccumulationTarget) {
              gl.bindFramebuffer(gl.FRAMEBUFFER, activeNearAccumulationTarget.framebuffer);
              gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
              gl.viewport(0, 0, activeNearAccumulationTarget.width, activeNearAccumulationTarget.height);
              if (scissorEnabled) {
                gl.enable(gl.SCISSOR_TEST);
                gl.scissor(
                  compositeScissor[0],
                  compositeScissor[1],
                  compositeScissor[2],
                  compositeScissor[3]
                );
              }
              writeInstanceData(nearDepthBinLobes, nearInstanceData);
              gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
              gl.bufferSubData(
                gl.ARRAY_BUFFER,
                0,
                nearInstanceData.subarray(0, nearDepthBinLobes.length * 24)
              );
              gl.uniform1f(binLayerLocation, 1);
              gl.drawArraysInstanced(
                gl.TRIANGLES,
                0,
                cornerVertexCount,
                nearDepthBinLobes.length
              );
            }
          }
        });
        gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (compositeDebugMode > 0) {
          gl.disable(gl.BLEND);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        } else {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.useProgram(compositeProgram);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, activeFarAccumulationTarget.texture);
        gl.uniform1i(compositeFarAccumulationLocation, 1);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(
          gl.TEXTURE_2D,
          depthBinMode === 2 && activeNearAccumulationTarget
            ? activeNearAccumulationTarget.texture
            : activeFarAccumulationTarget.texture
        );
        gl.uniform1i(compositeNearAccumulationLocation, 3);
        gl.uniform1f(compositeDepthBinModeLocation, depthBinMode);
        gl.uniform1f(
          compositeLocalVolumeModeLocation,
          rendererMode === "local-volume" ? 1 : 0
        );
        gl.uniform1f(compositeDebugModeLocation, compositeDebugMode);
        gl.bindVertexArray(null);
        if (compositeDebugMode > 0 || !scissorEnabled) {
          gl.disable(gl.SCISSOR_TEST);
        } else {
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(
            compositeScissor[0],
            compositeScissor[1],
            compositeScissor[2],
            compositeScissor[3]
          );
        }
        measureGpuPhase("composite", frameIndex, sampleGpuPhases, () => {
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        });
        if (timerExt && totalGpuQuery) {
          gl.endQuery(timerExt.TIME_ELAPSED_EXT);
          pendingQueries.push({ frame: frameIndex, phase: "total", query: totalGpuQuery });
        }
        gl.disable(gl.SCISSOR_TEST);
        if (timerExt) {
          if (gl.getParameter(timerExt.GPU_DISJOINT_EXT)) {
            resetGpuTimingWindow(frameIndex);
          }
          for (let index = pendingQueries.length - 1; index >= 0; index -= 1) {
            const pending = pendingQueries[index];
            if (gl.getQueryParameter(pending.query, gl.QUERY_RESULT_AVAILABLE)) {
              const elapsedMs = gl.getQueryParameter(pending.query, gl.QUERY_RESULT) / 1_000_000;
              if (pending.phase === "total") {
                pushWindowedSample(gpuSamples, elapsedMs);
              } else if (pending.phase === "clear") {
                pushWindowedSample(gpuClearSamples, elapsedMs);
              } else if (pending.phase === "accumulation") {
                pushWindowedSample(gpuAccumulationSamples, elapsedMs);
              } else {
                pushWindowedSample(gpuCompositeSamples, elapsedMs);
              }
              gl.deleteQuery(pending.query);
              pendingQueries.splice(index, 1);
            }
          }
        }
        frameTimes.push(performance.now() - start);
        if (frameTimes.length > GPU_TIMING_WINDOW) {
          frameTimes.shift();
        }
        const reportGpuTiming = gpuSamples.length >= GPU_TIMING_MIN_REPORT_SAMPLES;
        const nextTelemetry: KillSpikeTelemetry = {
          active: true,
          accumulationSize: [activeFarAccumulationTarget.width, activeFarAccumulationTarget.height],
          accumulationTargetCount: depthBinMode,
          camera,
          capability: "webgl2",
          compositeScissor,
          depthBinBoundary: depthBoundary,
          depthBinMode,
          depthBinRolePriorMassEstimate: {
            far: farRolePriorMassEstimate,
            near: nearRolePriorMassEstimate
          },
          depthBinSegmentation: rendererMode === "local-volume"
            ? "view-ray-overlap-partition"
            : "view-ray-clipped",
          depthBinSubmittedLobeCount: {
            far: farDepthBinLobes.length,
            near: nearDepthBinLobes.length
          },
          coverageMeanEstimate: coverageSamples.reduce((sum, value) => sum + value, 0) /
            Math.max(coverageSamples.length, 1),
          coverageAreaTemporalP95Estimate: percentile(coverageSamples, 0.95),
          coverageSpatialP95Estimate: visibilityEstimate.spatialP95,
          coverageTemporalP95Estimate: percentile(spatialP95Samples, 0.95),
          frameP95Ms: percentile(frameTimes, 0.95),
          accumulationProbe,
          candidateHash,
          candidateHashSchema: "fnv1a-instance-buffer-v3",
          candidateSetCount: lobes.length,
          candidateSeedRange: [
            0,
            (tier === "mobile" ? 320 * 22 : 1000 * 18) - 1
          ],
          cameraMatrixSignature: makeInstanceBufferHash(viewProjectionArray),
          cameraFrameId: cameraFrame.id,
          coordinateSpace: "earth-local-v3",
          densityProfileVersion: "source-native-patch-height-field-v4",
          earthOccludedCenterCount: visibilityEstimate.earthOccludedCenterCount,
          frustumCulledCount: visibilityEstimate.frustumCulledCount,
          gpuP50Ms: reportGpuTiming ? percentile(gpuSamples, 0.5) : null,
          gpuP95Ms: reportGpuTiming ? percentile(gpuSamples, 0.95) : null,
          gpuTimingSamplesMs: [...gpuSamples],
          gpuFieldResolution: CLOUD_FIELD_GPU_RESOLUTION,
          gpuFieldSource: CLOUD_FIELD_GPU_SRC,
          gpuRenderer,
          gpuPhaseSampleCount: Math.min(
            gpuClearSamples.length,
            gpuAccumulationSamples.length,
            gpuCompositeSamples.length
          ),
          gpuPhaseP95Ms: {
            accumulation: gpuAccumulationSamples.length >= GPU_PHASE_MIN_REPORT_SAMPLES
              ? percentile(gpuAccumulationSamples, 0.95)
              : null,
            clear: gpuClearSamples.length >= GPU_PHASE_MIN_REPORT_SAMPLES
              ? percentile(gpuClearSamples, 0.95)
              : null,
            composite: gpuCompositeSamples.length >= GPU_PHASE_MIN_REPORT_SAMPLES
              ? percentile(gpuCompositeSamples, 0.95)
              : null
          },
          gpuPhaseTimingSamplesMs: {
            accumulation: [...gpuAccumulationSamples],
            clear: [...gpuClearSamples],
            composite: [...gpuCompositeSamples]
          },
          gpuSampleCount: gpuSamples.length,
          gpuDisjointResetCount,
          gpuPhaseSampleInterval: GPU_PHASE_SAMPLE_INTERVAL,
          gpuTotalSampleInterval: GPU_TOTAL_SAMPLE_INTERVAL,
          gpuTimingScope: "rgba16f-depth-layer-accumulation-composite",
          gpuTimerSupported: Boolean(timerExt),
          gpuWarmupFrames: GPU_TIMING_WARMUP_FRAMES,
          gpuWindowSize: GPU_TIMING_WINDOW,
          generatorVersion: truth.header.generatorVersion,
          hierarchyHash,
          hierarchyMetrics,
          hierarchyVersion: "base-tower-detail-v4",
          hierarchyMembershipChurnRatio,
          hierarchyMembershipChurnTemporalP95: percentile(
            hierarchyMembershipChurnSamples,
            0.95
          ),
          hierarchySubmittedLobeCount: submittedLobes.length,
          hierarchySubmittedMembershipHash,
          hierarchySubmittedRoleCounts,
          baseCarrierCount: lobes.filter((lobe) => lobe.isCarrier).length,
          layoutId: truth.header.layoutId,
          lobeCount: lobes.length,
          localVolumeFieldResolution: localVolumeField?.resolution ?? null,
          localVolumeFieldVersion: localVolumeField?.version ?? null,
          localVolumeTileCount: localVolumeTiles.length,
          localVolumeTileProjectedBounds,
          localVolumeTileSignals: localVolumeTiles.map((tile) => ({
            fieldTile: tile.fieldTile,
            meanDensity: tile.meanDensity,
            peakDensity: tile.peakDensity
          })),
          localVolumeAccumulationDrawCount: localVolumeSamplingBudget.accumulationDrawCount,
          localVolumeSourceMaskTextureLookupCountPerPixel:
            rendererMode === "local-volume" ? 1 : 0,
          localVolumeSunTextureLookupCountPerPixel:
            localVolumeSamplingBudget.sunTextureLookupsPerPixel,
          localVolumeTotalTextureLookupCountPerPixel:
            localVolumeSamplingBudget.viewTextureLookupsPerPixel +
            localVolumeSamplingBudget.sunTextureLookupsPerPixel +
            (rendererMode === "local-volume" ? 1 : 0),
          localVolumeViewSamples: localVolumeSamplingBudget.viewTextureLookupsPerPixel,
          localVolumeViewTextureLookupCountPerPixel:
            localVolumeSamplingBudget.viewTextureLookupsPerPixel,
          lobeHierarchy: lobes.map(({ id, isCarrier, parentId, role }) => ({
            id,
            isCarrier,
            parentId,
            role
          })),
          lobeRoleCounts,
          membershipChurnRatio,
          membershipChurnTemporalP95: percentile(membershipChurnSamples, 0.95),
          offset: [CLOUD_FIELD_OFFSET_X, CLOUD_FIELD_OFFSET_Y],
          orientation: truth.header.orientation,
          occludedCount,
          opticalMassEstimate,
          orphanChildCount,
          parentedLobeCount,
          physicalSize: [physicalWidth, physicalHeight],
          resolvedSize: [canvas.width, canvas.height],
          scissorEnabled,
          sourceSha256: truth.header.sourceSha256,
          rendererMode,
          sourcePatchFootprintCoverageRatio: sourcePatchSummary.footprintCoverageRatio,
          sourcePatchHeightP05: sourcePatchSummary.heightP05,
          sourcePatchHeightP95: sourcePatchSummary.heightP95,
          sourcePatchMeanCoverage: sourcePatchSummary.meanCoverage,
          sourceUvBounds: [
            truthSourceUvBounds.u0,
            truthSourceUvBounds.v0,
            truthSourceUvBounds.u1,
            truthSourceUvBounds.v1
          ],
          submittedLobeCount: rendererSubmittedLobes.length,
          submittedMembershipHash,
          submittedRoleCounts,
          sunDirection,
          sweepProgress,
          tier,
          topologyDistanceSpace: "earth-local-tangent-normalized-radius",
          visibleCount
        };
        window.__MiraLithLuBirthHybridKillSpike = nextTelemetry;
        // The HUD is not part of the measured WebGL pipeline. Updating a React
        // overlay twice per second can enqueue its own browser composite work
        // alongside timer-query frames, so keep it deliberately low-rate while
        // publishing the full per-frame telemetry contract on window.
        if (now - lastTelemetryUpdate > 2_000) {
          lastTelemetryUpdate = now;
          setTelemetry(nextTelemetry);
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    }

    run().catch((error) => {
      console.error(error);
      setStatus("error");
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      for (const cleanup of cleanupCallbacks.splice(0).reverse()) {
        cleanup();
      }
      window.__MiraLithLuBirthHybridKillSpike = undefined;
    };
  }, [camera]);

  return (
    <main className="lubirth-hybrid-kill-spike">
      <style>{`
        .lubirth-hybrid-kill-spike {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 130%, rgba(21, 88, 145, 0.4), transparent 58%),
            #000205;
          color: rgba(240, 247, 255, 0.86);
        }
        .lubirth-hybrid-kill-spike canvas {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          image-rendering: auto;
        }
        .lubirth-hybrid-kill-spike__hud {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 4;
          display: grid;
          gap: 4px;
          min-width: 280px;
          border: 1px solid rgba(168, 213, 255, 0.2);
          border-radius: 16px;
          padding: 12px 14px;
          background: rgba(0, 8, 14, 0.64);
          color: rgba(225, 240, 255, 0.78);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          backdrop-filter: blur(12px);
        }
        @media (max-width: 700px), (max-height: 500px) {
          .lubirth-hybrid-kill-spike__hud {
            right: 8px;
            bottom: 8px;
            gap: 2px;
            width: min(270px, 42vw);
            min-width: 0;
            border-radius: 10px;
            padding: 7px 9px;
            background: rgba(0, 8, 14, 0.54);
            font-size: 8px;
            letter-spacing: 0.055em;
          }
          .lubirth-hybrid-kill-spike__hud-detail {
            display: none;
          }
        }
      `}</style>
      <canvas ref={canvasRef} aria-label="LuBirth hybrid cloud kill spike" />
      <aside className="lubirth-hybrid-kill-spike__hud">
        <span>Phase -1 Hybrid Cloud Kill Spike</span>
        <span>Status: {status}</span>
        <span>Camera: {telemetry?.camera ?? camera}</span>
        {telemetry?.camera === "sweep" ? (
          <span>
            Sweep / churn p95: {telemetry.sweepProgress.toFixed(2)} /{" "}
            {telemetry.membershipChurnTemporalP95.toFixed(3)}
          </span>
        ) : null}
        <span>Lobes: {telemetry?.lobeCount ?? "—"}</span>
        <span className="lubirth-hybrid-kill-spike__hud-detail">
          Submitted: {telemetry?.submittedLobeCount ?? "—"}
        </span>
        <span className="lubirth-hybrid-kill-spike__hud-detail">
          Visible: {telemetry?.visibleCount ?? "—"}
        </span>
        <span>
          Roles: {telemetry
            ? `${telemetry.lobeRoleCounts.base}/${telemetry.lobeRoleCounts.tower}/${telemetry.lobeRoleCounts.detail}`
            : "—"}
        </span>
        <span>Cloud path: {telemetry?.rendererMode ?? "—"}</span>
        <span className="lubirth-hybrid-kill-spike__hud-detail">
          Local field: {telemetry?.localVolumeFieldResolution?.join("×") ?? "analytic control"} / {telemetry
            ? `${telemetry.localVolumeViewTextureLookupCountPerPixel} view + ${telemetry.localVolumeSunTextureLookupCountPerPixel} sun + ${telemetry.localVolumeSourceMaskTextureLookupCountPerPixel} mask`
            : "—"}
        </span>
        <span className="lubirth-hybrid-kill-spike__hud-detail">
          Space: {telemetry?.coordinateSpace ?? "earth-local-v3"}
        </span>
        <span>Coverage spatial/temporal p95: {telemetry
          ? `${telemetry.coverageSpatialP95Estimate.toFixed(2)}/${telemetry.coverageTemporalP95Estimate.toFixed(2)}`
          : "—"}
        </span>
        <span className="lubirth-hybrid-kill-spike__hud-detail">
          RGBA16F: {telemetry?.accumulationProbe.verdict ?? "—"}
        </span>
        <span>Frame p95: {telemetry ? `${telemetry.frameP95Ms.toFixed(2)}ms` : "—"}</span>
        <span>
          GPU p50/p95: {telemetry?.gpuP95Ms == null
            ? "pending/unsupported"
            : `${telemetry.gpuP50Ms?.toFixed(2) ?? "—"}/${telemetry.gpuP95Ms.toFixed(2)}ms`}
        </span>
        <span className="lubirth-hybrid-kill-spike__hud-detail">
          GPU samples total/phase: {telemetry?.gpuSampleCount ?? "—"}/
          {telemetry?.gpuPhaseSampleCount ?? "—"} /{" "}
          {telemetry
            ? [
                telemetry.gpuPhaseP95Ms.clear,
                telemetry.gpuPhaseP95Ms.accumulation,
                telemetry.gpuPhaseP95Ms.composite
              ].map((value) => value == null ? "—" : value.toFixed(2)).join("/")
            : "—"}
        </span>
        <span className="lubirth-hybrid-kill-spike__hud-detail">
          Renderer: {telemetry?.gpuRenderer ?? "—"}
        </span>
      </aside>
    </main>
  );
}
