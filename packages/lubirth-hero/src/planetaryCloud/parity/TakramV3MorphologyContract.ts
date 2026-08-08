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

export type TakramV3MorphologyCandidateId = "baseline";

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
}

/** The current V3 opening preset, frozen before any scale candidate work. */
export const TAKRAM_V3_MORPHOLOGY_BASELINE: TakramV3MorphologyCandidate =
  Object.freeze({
    id: "baseline",
    coverage: 0.55,
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006
  });

export const TAKRAM_V3_MORPHOLOGY_CANDIDATES: Readonly<Record<
  TakramV3MorphologyCandidateId,
  TakramV3MorphologyCandidate
>> = Object.freeze({
  baseline: TAKRAM_V3_MORPHOLOGY_BASELINE
});

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

