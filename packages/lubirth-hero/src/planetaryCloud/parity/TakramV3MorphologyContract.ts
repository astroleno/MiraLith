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
  | "horizontal-orbit-shape-16-detail-4"
  | "horizontal-orbit-shape-32-detail-4";

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

/**
 * Task 2 candidates are committed from the Task 1 scale-audit run. They are
 * intentionally generated from one physical projection (near-orbit) and are
 * then replayed unchanged across every review view. The candidate matrix may
 * reject them for other views; that is evidence for the horizontal-scale
 * checkpoint, not a reason to silently retune each screenshot.
 */
export const TAKRAM_V3_MORPHOLOGY_HORIZONTAL_CANDIDATES = Object.freeze({
  "horizontal-orbit-shape-16-detail-4": Object.freeze({
    id: "horizontal-orbit-shape-16-detail-4" as const,
    coverage: 0.55,
    shapeRepeat: 0.000015279118222807067,
    shapeDetailRepeat: 0.00006111647289122827,
    sourceViews: ["near-orbit"] as const,
    targetShapePixels: 16,
    targetDetailPixels: 4
  }),
  "horizontal-orbit-shape-32-detail-4": Object.freeze({
    id: "horizontal-orbit-shape-32-detail-4" as const,
    coverage: 0.55,
    shapeRepeat: 0.000007639559111403533,
    shapeDetailRepeat: 0.00006111647289122827,
    sourceViews: ["near-orbit"] as const,
    targetShapePixels: 32,
    targetDetailPixels: 4
  })
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
  horizontalPixelsPerMeter: number;
}

export interface TakramV3MorphologyGeneratedCandidate {
  view: TakramV3MorphologyViewId;
  targetShapePixels: number;
  targetDetailPixels: number;
  shapeWavelengthMeters: number;
  detailWavelengthMeters: number;
  shapeRepeat: number;
  shapeDetailRepeat: number;
  physicalRangePass: boolean;
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
    if (!Number.isFinite(input.horizontalPixelsPerMeter) || input.horizontalPixelsPerMeter <= 0) {
      return [];
    }
    return TAKRAM_V3_MORPHOLOGY_TARGET_SHAPE_PIXELS.flatMap((targetShapePixels) =>
      TAKRAM_V3_MORPHOLOGY_TARGET_DETAIL_PIXELS.map((targetDetailPixels) => {
        const shapeWavelengthMeters = targetShapePixels / input.horizontalPixelsPerMeter;
        const detailWavelengthMeters = targetDetailPixels / input.horizontalPixelsPerMeter;
        return {
          view: input.view,
          targetShapePixels,
          targetDetailPixels,
          shapeWavelengthMeters,
          detailWavelengthMeters,
          shapeRepeat: input.horizontalPixelsPerMeter / targetShapePixels,
          shapeDetailRepeat: input.horizontalPixelsPerMeter / targetDetailPixels,
          physicalRangePass: withinRange(shapeWavelengthMeters / 1_000, range.shapeWavelengthKm) &&
            withinRange(detailWavelengthMeters / 1_000, range.detailWavelengthKm)
        };
      })
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
