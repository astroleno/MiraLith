/**
 * Query-only review contract for the V3 scale/morphology spike.
 *
 * These values describe the camera and fixed geography used by the evidence
 * route. They are deliberately independent from the product opening camera;
 * the opening-orbit entry is the one exception and must reuse the existing
 * `mapOpeningProgress` matrix mirror in the parity pipeline.
 */

export type TakramV3MorphologyViewId =
  | "near-oblique"
  | "aerial-oblique"
  | "near-orbit"
  | "opening-orbit";

export type TakramV3MorphologyCandidateId =
  | "baseline"
  | "horizontal-near-oblique-shape-32-detail-4"
  | "horizontal-near-oblique-shape-32-detail-6"
  | "horizontal-near-oblique-shape-32-detail-8"
  | "horizontal-near-oblique-shape-48-detail-4"
  | "horizontal-near-oblique-shape-48-detail-6"
  | "horizontal-near-oblique-shape-48-detail-8"
  | "horizontal-aerial-oblique-shape-48-detail-6"
  | "horizontal-aerial-oblique-shape-48-detail-8"
  | "horizontal-near-orbit-shape-48-detail-6"
  | "horizontal-near-orbit-shape-48-detail-8";

export const TAKRAM_V3_MORPHOLOGY_SPHERICAL_UV = Object.freeze([
  0.076494140625,
  0.73053515625
] as const);

export interface TakramV3MorphologyView {
  id: TakramV3MorphologyViewId;
  cameraAltitudeMeters: number;
  targetDistanceMeters: number;
  targetAltitudeMeters: number;
  usesOpeningFrame: boolean;
  sphericalUv: readonly [number, number];
}

export const TAKRAM_V3_MORPHOLOGY_VIEWS: readonly TakramV3MorphologyView[] =
  Object.freeze([
    Object.freeze({
      id: "near-oblique" as const,
      cameraAltitudeMeters: 2_500,
      targetDistanceMeters: 80_000,
      targetAltitudeMeters: 8_000,
      usesOpeningFrame: false,
      sphericalUv: TAKRAM_V3_MORPHOLOGY_SPHERICAL_UV
    }),
    Object.freeze({
      id: "aerial-oblique" as const,
      cameraAltitudeMeters: 50_000,
      targetDistanceMeters: 180_000,
      targetAltitudeMeters: 10_000,
      usesOpeningFrame: false,
      sphericalUv: TAKRAM_V3_MORPHOLOGY_SPHERICAL_UV
    }),
    Object.freeze({
      id: "near-orbit" as const,
      cameraAltitudeMeters: 200_000,
      targetDistanceMeters: 600_000,
      targetAltitudeMeters: 12_000,
      usesOpeningFrame: false,
      sphericalUv: TAKRAM_V3_MORPHOLOGY_SPHERICAL_UV
    }),
    Object.freeze({
      id: "opening-orbit" as const,
      cameraAltitudeMeters: 3_578_429,
      targetDistanceMeters: 0,
      targetAltitudeMeters: 0,
      usesOpeningFrame: true,
      sphericalUv: TAKRAM_V3_MORPHOLOGY_SPHERICAL_UV
    })
  ]);

export interface TakramV3MorphologyCandidate {
  id: TakramV3MorphologyCandidateId;
  coverage: number;
  shapeRepeat: number;
  shapeDetailRepeat: number;
  sourceViews?: readonly TakramV3MorphologyViewId[];
  targetShapePixels?: number;
  targetDetailPixels?: number;
}

/** The current V3 opening preset, frozen before any scale candidate work. */
export const TAKRAM_V3_MORPHOLOGY_BASELINE: TakramV3MorphologyCandidate =
  Object.freeze({
    id: "baseline",
    coverage: 0.55,
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006
  });

export const TAKRAM_V3_MORPHOLOGY_CALIBRATED_PIXELS_PER_METER = Object.freeze({
  "near-oblique": 0.010238030809047992,
  "aerial-oblique": 0.004512678951320542,
  "near-orbit": 0.0013233492506820326,
  "opening-orbit": 0.00009675185062176135
});

function calibratedCandidate(
  id: Exclude<TakramV3MorphologyCandidateId, "baseline">,
  sourceView: TakramV3MorphologyViewId,
  targetShapePixels: number,
  targetDetailPixels: number
): TakramV3MorphologyCandidate {
  const pixelsPerMeter = TAKRAM_V3_MORPHOLOGY_CALIBRATED_PIXELS_PER_METER[sourceView];
  return Object.freeze({
    id,
    coverage: 0.55,
    shapeRepeat: pixelsPerMeter / targetShapePixels,
    shapeDetailRepeat: pixelsPerMeter / targetDetailPixels,
    sourceViews: [sourceView],
    targetShapePixels,
    targetDetailPixels
  });
}

/** Physical-range candidates from every corrected near-view scale audit. */
export const TAKRAM_V3_MORPHOLOGY_HORIZONTAL_CANDIDATES = Object.freeze({
  "horizontal-near-oblique-shape-32-detail-4": calibratedCandidate(
    "horizontal-near-oblique-shape-32-detail-4", "near-oblique", 32, 4
  ),
  "horizontal-near-oblique-shape-32-detail-6": calibratedCandidate(
    "horizontal-near-oblique-shape-32-detail-6", "near-oblique", 32, 6
  ),
  "horizontal-near-oblique-shape-32-detail-8": calibratedCandidate(
    "horizontal-near-oblique-shape-32-detail-8", "near-oblique", 32, 8
  ),
  "horizontal-near-oblique-shape-48-detail-4": calibratedCandidate(
    "horizontal-near-oblique-shape-48-detail-4", "near-oblique", 48, 4
  ),
  "horizontal-near-oblique-shape-48-detail-6": calibratedCandidate(
    "horizontal-near-oblique-shape-48-detail-6", "near-oblique", 48, 6
  ),
  "horizontal-near-oblique-shape-48-detail-8": calibratedCandidate(
    "horizontal-near-oblique-shape-48-detail-8", "near-oblique", 48, 8
  ),
  "horizontal-aerial-oblique-shape-48-detail-6": calibratedCandidate(
    "horizontal-aerial-oblique-shape-48-detail-6", "aerial-oblique", 48, 6
  ),
  "horizontal-aerial-oblique-shape-48-detail-8": calibratedCandidate(
    "horizontal-aerial-oblique-shape-48-detail-8", "aerial-oblique", 48, 8
  ),
  "horizontal-near-orbit-shape-48-detail-6": calibratedCandidate(
    "horizontal-near-orbit-shape-48-detail-6", "near-orbit", 48, 6
  ),
  "horizontal-near-orbit-shape-48-detail-8": calibratedCandidate(
    "horizontal-near-orbit-shape-48-detail-8", "near-orbit", 48, 8
  )
});

export const TAKRAM_V3_MORPHOLOGY_CANDIDATES: Readonly<Record<
  TakramV3MorphologyCandidateId,
  TakramV3MorphologyCandidate
>> = Object.freeze({
  baseline: TAKRAM_V3_MORPHOLOGY_BASELINE,
  ...TAKRAM_V3_MORPHOLOGY_HORIZONTAL_CANDIDATES
});

export const TAKRAM_V3_MORPHOLOGY_TARGET_SHAPE_PIXELS = Object.freeze([16, 32, 48] as const);
export const TAKRAM_V3_MORPHOLOGY_TARGET_DETAIL_PIXELS = Object.freeze([4, 6, 8] as const);

export interface TakramV3MorphologyPhysicalRange {
  shapeWavelengthKm: readonly [number, number];
  detailWavelengthKm: readonly [number, number];
}

export const TAKRAM_V3_MORPHOLOGY_PHYSICAL_RANGES: Readonly<
  Record<TakramV3MorphologyViewId, TakramV3MorphologyPhysicalRange>
> = Object.freeze({
  "near-oblique": { shapeWavelengthKm: [2, 20], detailWavelengthKm: [0.25, 2] },
  "aerial-oblique": { shapeWavelengthKm: [10, 80], detailWavelengthKm: [1, 8] },
  "near-orbit": { shapeWavelengthKm: [30, 160], detailWavelengthKm: [4, 20] },
  "opening-orbit": { shapeWavelengthKm: [80, 320], detailWavelengthKm: [8, 40] }
});

export interface TakramV3MorphologyProjectionScaleInput {
  view: TakramV3MorphologyViewId;
  pixelsPerMeter: Readonly<{ east: number; north: number }>;
}

export interface TakramV3MorphologyReviewFrame {
  cameraEcefMeters: readonly [number, number, number];
  cameraRadialEcef: readonly [number, number, number];
  targetEcefMeters: readonly [number, number, number];
  targetRadialEcef: readonly [number, number, number];
  eastEcef: readonly [number, number, number];
  northEcef: readonly [number, number, number];
  upEcef: readonly [number, number, number];
}

export interface TakramV3MorphologyRepeatInterval {
  feasible: boolean;
  minimum: number;
  maximum: number;
}

export type TakramV3HorizontalMorphologyCheckpointId =
  | "MORPHOLOGY_SCALE_EVIDENCE_INVALID"
  | "HORIZONTAL_MORPHOLOGY_SCALE_FAIL"
  | "HORIZONTAL_MORPHOLOGY_CANDIDATE_FAIL"
  | "HORIZONTAL_MORPHOLOGY_VISUAL_REVIEW_REQUIRED";

const NEAR_MORPHOLOGY_VIEWS = Object.freeze([
  "near-oblique",
  "aerial-oblique",
  "near-orbit"
] as const);

function vectorLength(vector: readonly [number, number, number]) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalizeVector(
  vector: readonly [number, number, number]
): readonly [number, number, number] {
  const length = vectorLength(vector);
  return length > 0 && Number.isFinite(length)
    ? [vector[0] / length, vector[1] / length, vector[2] / length]
    : [0, 0, 0];
}

function scaleVector(
  vector: readonly [number, number, number],
  scalar: number
): readonly [number, number, number] {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function crossVector(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): readonly [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

/** Resolve one review camera and its observed target in a shared ECEF metre frame. */
export function resolveTakramV3MorphologyReviewFrame(
  view: TakramV3MorphologyView,
  planetRadiusMeters: number
): TakramV3MorphologyReviewFrame {
  const [sphericalU, sphericalV] = view.sphericalUv;
  const phi = (sphericalU - 0.5) * Math.PI * 2;
  const theta = (sphericalV - 0.5) * Math.PI;
  const targetRadialEcef = normalizeVector([
    Math.cos(theta) * Math.cos(phi),
    Math.cos(theta) * Math.sin(phi),
    Math.sin(theta)
  ]);
  const targetEastEcef = normalizeVector([-Math.sin(phi), Math.cos(phi), 0]);
  const centralAngle = view.targetDistanceMeters / planetRadiusMeters;
  const cosAngle = Math.cos(centralAngle);
  const sinAngle = Math.sin(centralAngle);
  const cameraRadialEcef = normalizeVector([
    targetRadialEcef[0] * cosAngle - targetEastEcef[0] * sinAngle,
    targetRadialEcef[1] * cosAngle - targetEastEcef[1] * sinAngle,
    targetRadialEcef[2] * cosAngle - targetEastEcef[2] * sinAngle
  ]);
  const eastEcef = targetEastEcef;
  const northEcef = normalizeVector(crossVector(targetRadialEcef, eastEcef));
  return {
    cameraEcefMeters: scaleVector(
      cameraRadialEcef,
      planetRadiusMeters + view.cameraAltitudeMeters
    ),
    cameraRadialEcef,
    targetEcefMeters: scaleVector(
      targetRadialEcef,
      planetRadiusMeters + view.targetAltitudeMeters
    ),
    targetRadialEcef,
    eastEcef,
    northEcef,
    upEcef: targetRadialEcef
  };
}

export function resolveTakramV3MorphologyCommonRepeatInterval(
  inputs: readonly TakramV3MorphologyProjectionScaleInput[],
  kind: "shape" | "detail"
): TakramV3MorphologyRepeatInterval {
  const targetPixels = kind === "shape" ? [16, 48] as const : [3, 10] as const;
  const directionalScales = inputs.flatMap((input) => [
    input.pixelsPerMeter.east,
    input.pixelsPerMeter.north
  ]);
  if (inputs.length === 0 || directionalScales.some((pixelsPerMeter) =>
    !Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0
  )) {
    return { feasible: false, minimum: Number.NaN, maximum: Number.NaN };
  }
  const minimum = Math.max(...directionalScales.map((pixelsPerMeter) =>
    pixelsPerMeter / targetPixels[1]
  ));
  const maximum = Math.min(...directionalScales.map((pixelsPerMeter) =>
    pixelsPerMeter / targetPixels[0]
  ));
  return { feasible: minimum <= maximum, minimum, maximum };
}

export function resolveTakramV3HorizontalMorphologyCheckpoint(input: {
  audits: ReadonlyArray<TakramV3MorphologyProjectionScaleInput & {
    originScreenPixels: readonly [number, number] | null;
    viewport: { width: number; height: number };
  }>;
  metricCandidateCount: number;
  passingMetricCandidateCount: number;
}): { id: TakramV3HorizontalMorphologyCheckpointId; task3Unlocked: boolean } {
  const nearAudits = NEAR_MORPHOLOGY_VIEWS.map((view) =>
    input.audits.find((audit) => audit.view === view)
  );
  const evidenceValid = nearAudits.every((audit) => {
    if (!audit || !audit.originScreenPixels) return false;
    const [x, y] = audit.originScreenPixels;
    return Number.isFinite(audit.pixelsPerMeter.east)
      && audit.pixelsPerMeter.east > 0
      && Number.isFinite(audit.pixelsPerMeter.north)
      && audit.pixelsPerMeter.north > 0
      && x >= 0 && x <= audit.viewport.width
      && y >= 0 && y <= audit.viewport.height;
  });
  if (!evidenceValid) {
    return { id: "MORPHOLOGY_SCALE_EVIDENCE_INVALID", task3Unlocked: false };
  }
  const projectionInputs = nearAudits as TakramV3MorphologyProjectionScaleInput[];
  const shape = resolveTakramV3MorphologyCommonRepeatInterval(projectionInputs, "shape");
  const detail = resolveTakramV3MorphologyCommonRepeatInterval(projectionInputs, "detail");
  if (!shape.feasible || !detail.feasible) {
    return { id: "HORIZONTAL_MORPHOLOGY_SCALE_FAIL", task3Unlocked: false };
  }
  if (input.metricCandidateCount <= 0 || input.passingMetricCandidateCount <= 0) {
    return { id: "HORIZONTAL_MORPHOLOGY_CANDIDATE_FAIL", task3Unlocked: false };
  }
  return { id: "HORIZONTAL_MORPHOLOGY_VISUAL_REVIEW_REQUIRED", task3Unlocked: false };
}

export interface TakramV3MorphologyGeneratedCandidate {
  view: TakramV3MorphologyViewId;
  targetShapePixels: number;
  targetDetailPixels: number;
  projectedShapePixelsByAxis: Readonly<{ east: number; north: number }>;
  projectedDetailPixelsByAxis: Readonly<{ east: number; north: number }>;
  shapeWavelengthMeters: number;
  detailWavelengthMeters: number;
  shapeRepeat: number;
  shapeDetailRepeat: number;
  physicalRangePass: boolean;
  axisRangePass: boolean;
}

function withinRange(valueKm: number, range: readonly [number, number]) {
  return valueKm >= range[0] && valueKm <= range[1];
}

/** Generate the Task 2 matrix directly from measured screen scale. */
export function buildTakramV3MorphologyCandidates(
  inputs: readonly TakramV3MorphologyProjectionScaleInput[]
): readonly TakramV3MorphologyGeneratedCandidate[] {
  return inputs.flatMap((input) => {
    const range = TAKRAM_V3_MORPHOLOGY_PHYSICAL_RANGES[input.view];
    const { east, north } = input.pixelsPerMeter;
    if (![east, north].every((pixelsPerMeter) =>
      Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0
    )) {
      return [];
    }
    const referencePixelsPerMeter = Math.sqrt(east * north);
    return TAKRAM_V3_MORPHOLOGY_TARGET_SHAPE_PIXELS.flatMap((targetShapePixels) =>
      TAKRAM_V3_MORPHOLOGY_TARGET_DETAIL_PIXELS.map((targetDetailPixels) => {
        const shapeWavelengthMeters = targetShapePixels / referencePixelsPerMeter;
        const detailWavelengthMeters = targetDetailPixels / referencePixelsPerMeter;
        const projectedShapePixelsByAxis = {
          east: shapeWavelengthMeters * east,
          north: shapeWavelengthMeters * north
        };
        const projectedDetailPixelsByAxis = {
          east: detailWavelengthMeters * east,
          north: detailWavelengthMeters * north
        };
        const axisRangePass = Object.values(projectedShapePixelsByAxis).every((pixels) =>
          pixels >= 16 && pixels <= 48
        ) && Object.values(projectedDetailPixelsByAxis).every((pixels) =>
          pixels >= 3 && pixels <= 10
        );
        return {
          view: input.view,
          targetShapePixels,
          targetDetailPixels,
          projectedShapePixelsByAxis,
          projectedDetailPixelsByAxis,
          shapeWavelengthMeters,
          detailWavelengthMeters,
          shapeRepeat: referencePixelsPerMeter / targetShapePixels,
          shapeDetailRepeat: referencePixelsPerMeter / targetDetailPixels,
          physicalRangePass: withinRange(shapeWavelengthMeters / 1_000, range.shapeWavelengthKm) &&
            withinRange(detailWavelengthMeters / 1_000, range.detailWavelengthKm),
          axisRangePass
        };
      }).filter((candidate) => candidate.axisRangePass)
    );
  });
}

export function resolveTakramV3MorphologyView(
  value: string | null | undefined
): TakramV3MorphologyView | null {
  return TAKRAM_V3_MORPHOLOGY_VIEWS.find((view) => view.id === value) ?? null;
}

export function resolveTakramV3MorphologyCandidate(
  value: string | null | undefined
): TakramV3MorphologyCandidate | null {
  return value && value in TAKRAM_V3_MORPHOLOGY_CANDIDATES
    ? TAKRAM_V3_MORPHOLOGY_CANDIDATES[value as TakramV3MorphologyCandidateId]
    : null;
}
