import { Matrix4, Vector3, Vector4 } from "three";
import type { TakramV3MorphologyViewId } from "./TakramV3MorphologyContract";

export type TakramV3MorphologyScaleAxis = "east" | "north" | "up";
export type TakramV3MorphologyPixelStatus =
  | "target"
  | "subpixel-risk"
  | "fragment-risk"
  | "flat-risk"
  | "unavailable";

export interface TakramV3MorphologyScaleLayerInput {
  channel: "r" | "g" | "b" | "a";
  altitude: number;
  height: number;
}

export interface TakramV3MorphologyScaleAuditInput {
  view: TakramV3MorphologyViewId;
  viewProjectionMatrix: readonly number[];
  ecefToWorldMatrix: readonly number[];
  originEcefMeters: readonly [number, number, number];
  targetSphericalUv?: readonly [number, number];
  viewport: { width: number; height: number };
  shapeRepeat: number;
  shapeDetailRepeat: number;
  layers: readonly TakramV3MorphologyScaleLayerInput[];
  eastEcef?: readonly [number, number, number];
  northEcef?: readonly [number, number, number];
  upEcef?: readonly [number, number, number];
  segmentMeters?: number;
}

export interface TakramV3MorphologyScaleLayerResult extends TakramV3MorphologyScaleLayerInput {
  topAltitude: number;
  projectedThicknessPixels: number;
  status: TakramV3MorphologyPixelStatus;
}

export interface TakramV3MorphologyScaleAudit {
  shapeWavelengthMeters: number;
  detailWavelengthMeters: number;
  pixelsPerMeter: Record<TakramV3MorphologyScaleAxis, number>;
  horizontalPixelsPerMeter: number;
  shapeProjectedPixelsByAxis: Record<"east" | "north", number>;
  detailProjectedPixelsByAxis: Record<"east" | "north", number>;
  horizontalProjectionJacobian: {
    east: readonly [number, number];
    north: readonly [number, number];
    singularValues: {
      major: number;
      minor: number;
      conditionNumber: number;
    };
  };
  shapeProjectedPixels: number;
  detailProjectedPixels: number;
  shapeStatus: TakramV3MorphologyPixelStatus;
  detailStatus: TakramV3MorphologyPixelStatus;
  layers: readonly TakramV3MorphologyScaleLayerResult[];
  originScreenPixels: readonly [number, number] | null;
  targetSphericalUv: readonly [number, number] | null;
  segmentMeters: number;
}

const DEFAULT_SEGMENT_METERS = 1_000;
const EPSILON = 1e-9;

export function wavelengthMetersFromRepeat(repeatPerMeter: number) {
  if (!Number.isFinite(repeatPerMeter) || repeatPerMeter <= 0) {
    return Number.NaN;
  }
  return 1 / repeatPerMeter;
}

function normalizeAxis(axis: readonly [number, number, number]) {
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (!Number.isFinite(length) || length <= EPSILON) {
    return [0, 0, 0] as const;
  }
  return [axis[0] / length, axis[1] / length, axis[2] / length] as const;
}

function resolveAxes(input: TakramV3MorphologyScaleAuditInput) {
  return {
    east: normalizeAxis(input.eastEcef ?? [1, 0, 0]),
    north: normalizeAxis(input.northEcef ?? [0, 1, 0]),
    up: normalizeAxis(input.upEcef ?? [0, 0, 1])
  } satisfies Record<TakramV3MorphologyScaleAxis, readonly [number, number, number]>;
}

function projectEcefPoint(
  ecef: readonly [number, number, number],
  ecefToWorld: Matrix4,
  viewProjection: Matrix4,
  viewport: { width: number; height: number }
) {
  const world = new Vector3(ecef[0], ecef[1], ecef[2]).applyMatrix4(ecefToWorld);
  const clip = new Vector4(world.x, world.y, world.z, 1).applyMatrix4(viewProjection);
  if (!Number.isFinite(clip.w) || Math.abs(clip.w) <= EPSILON) {
    return null;
  }
  const ndcX = clip.x / clip.w;
  const ndcY = clip.y / clip.w;
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) {
    return null;
  }
  return [
    (ndcX * 0.5 + 0.5) * viewport.width,
    (1 - (ndcY * 0.5 + 0.5)) * viewport.height
  ] as const;
}

function projectedPixelDeltaPerMeter(
  origin: readonly [number, number, number],
  axis: readonly [number, number, number],
  segmentMeters: number,
  ecefToWorld: Matrix4,
  viewProjection: Matrix4,
  viewport: { width: number; height: number }
) {
  const start = projectEcefPoint(origin, ecefToWorld, viewProjection, viewport);
  const end = projectEcefPoint([
    origin[0] + axis[0] * segmentMeters,
    origin[1] + axis[1] * segmentMeters,
    origin[2] + axis[2] * segmentMeters
  ], ecefToWorld, viewProjection, viewport);
  if (!start || !end || !Number.isFinite(segmentMeters) || segmentMeters <= 0) {
    return [Number.NaN, Number.NaN] as const;
  }
  return [
    (end[0] - start[0]) / segmentMeters,
    (end[1] - start[1]) / segmentMeters
  ] as const;
}

function resolveSingularValues(
  east: readonly [number, number],
  north: readonly [number, number]
) {
  const eastSquared = east[0] ** 2 + east[1] ** 2;
  const northSquared = north[0] ** 2 + north[1] ** 2;
  const crossTerm = east[0] * north[0] + east[1] * north[1];
  const trace = eastSquared + northSquared;
  const discriminant = Math.sqrt(
    Math.max(0, (eastSquared - northSquared) ** 2 + 4 * crossTerm ** 2)
  );
  const major = Math.sqrt(Math.max(0, (trace + discriminant) / 2));
  const minor = Math.sqrt(Math.max(0, (trace - discriminant) / 2));
  return {
    major,
    minor,
    conditionNumber: minor > EPSILON ? major / minor : Number.POSITIVE_INFINITY
  };
}

export function classifyProjectedPixels(
  pixels: number,
  axis: "shape" | "detail" | "thickness",
  view: TakramV3MorphologyViewId = "near-oblique"
): TakramV3MorphologyPixelStatus {
  if (!Number.isFinite(pixels) || pixels <= 0) return "unavailable";
  if (axis === "shape") {
    if (pixels < 8) return "fragment-risk";
    if (pixels > 96) return "flat-risk";
    if (pixels >= 16 && pixels <= 48) return "target";
    return pixels < 16 ? "fragment-risk" : "flat-risk";
  }
  if (axis === "detail") {
    if (pixels < 2) return "subpixel-risk";
    if (pixels >= 3 && pixels <= 10) return "target";
    return pixels < 3 ? "subpixel-risk" : "flat-risk";
  }
  const minimumThicknessPixels = view === "opening-orbit"
    ? 2
    : view === "near-orbit"
      ? 4
      : 12;
  return pixels >= minimumThicknessPixels ? "target" : "fragment-risk";
}

export function auditMorphologyScale(
  input: TakramV3MorphologyScaleAuditInput
): TakramV3MorphologyScaleAudit {
  const viewProjection = new Matrix4().fromArray([...input.viewProjectionMatrix]);
  const ecefToWorld = new Matrix4().fromArray([...input.ecefToWorldMatrix]);
  const segmentMeters = input.segmentMeters ?? DEFAULT_SEGMENT_METERS;
  const axes = resolveAxes(input);
  const projectedDeltas = {
    east: projectedPixelDeltaPerMeter(
      input.originEcefMeters,
      axes.east,
      segmentMeters,
      ecefToWorld,
      viewProjection,
      input.viewport
    ),
    north: projectedPixelDeltaPerMeter(
      input.originEcefMeters,
      axes.north,
      segmentMeters,
      ecefToWorld,
      viewProjection,
      input.viewport
    ),
    up: projectedPixelDeltaPerMeter(
      input.originEcefMeters,
      axes.up,
      segmentMeters,
      ecefToWorld,
      viewProjection,
      input.viewport
    )
  };
  const pixelsPerMeter = {
    east: Math.hypot(...projectedDeltas.east),
    north: Math.hypot(...projectedDeltas.north),
    up: Math.hypot(...projectedDeltas.up)
  };
  const horizontalProjectionJacobian = {
    east: projectedDeltas.east,
    north: projectedDeltas.north,
    singularValues: resolveSingularValues(projectedDeltas.east, projectedDeltas.north)
  };
  const horizontalPixelsPerMeter = Math.sqrt(
    (pixelsPerMeter.east ** 2 + pixelsPerMeter.north ** 2) / 2
  );
  const shapeWavelengthMeters = wavelengthMetersFromRepeat(input.shapeRepeat);
  const detailWavelengthMeters = wavelengthMetersFromRepeat(input.shapeDetailRepeat);
  const shapeProjectedPixels = shapeWavelengthMeters * horizontalPixelsPerMeter;
  const detailProjectedPixels = detailWavelengthMeters * horizontalPixelsPerMeter;
  const shapeProjectedPixelsByAxis = {
    east: shapeWavelengthMeters * pixelsPerMeter.east,
    north: shapeWavelengthMeters * pixelsPerMeter.north
  };
  const detailProjectedPixelsByAxis = {
    east: detailWavelengthMeters * pixelsPerMeter.east,
    north: detailWavelengthMeters * pixelsPerMeter.north
  };
  const layers = input.layers.map((layer) => {
    const projectedThicknessPixels = layer.height * pixelsPerMeter.up;
    return {
      ...layer,
      topAltitude: layer.altitude + layer.height,
      projectedThicknessPixels,
      status: classifyProjectedPixels(projectedThicknessPixels, "thickness", input.view)
    };
  });
  const originScreen = projectEcefPoint(
    input.originEcefMeters,
    ecefToWorld,
    viewProjection,
    input.viewport
  );
  return {
    shapeWavelengthMeters,
    detailWavelengthMeters,
    pixelsPerMeter,
    horizontalPixelsPerMeter,
    shapeProjectedPixelsByAxis,
    detailProjectedPixelsByAxis,
    horizontalProjectionJacobian,
    shapeProjectedPixels,
    detailProjectedPixels,
    shapeStatus: classifyProjectedPixels(shapeProjectedPixels, "shape"),
    detailStatus: classifyProjectedPixels(detailProjectedPixels, "detail"),
    layers,
    originScreenPixels: originScreen,
    targetSphericalUv: input.targetSphericalUv ?? null,
    segmentMeters
  };
}
