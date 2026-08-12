export const TAKRAM_ORBITAL_STEP_SCALE_MODES = Object.freeze([
  "control",
  "treatment"
] as const);

export const TAKRAM_ORBITAL_STEP_SCALE_VALUES = Object.freeze({
  control: 1.01,
  treatment: 1.0001
} as const);

export const TAKRAM_ORBITAL_SAMPLING_PROGRESS = Object.freeze([
  0,
  0.06,
  0.12,
  0.18
] as const);

export type TakramOrbitalStepScaleMode =
  (typeof TAKRAM_ORBITAL_STEP_SCALE_MODES)[number];

export type TakramOrbitalSamplingOutcome =
  | "ORBITAL_SAMPLING_CAUSALITY_CONFIRMED"
  | "ORBITAL_SAMPLING_CAUSALITY_PARTIAL_DOWNSTREAM_BLOCKED"
  | "ORBITAL_SAMPLING_CAUSALITY_NOT_SUPPORTED"
  | "ORBITAL_SAMPLING_SETUP_BLOCKED";

export interface TakramOrbitalSamplingFrameDecision {
  readonly downstreamSignalObservable: boolean;
  readonly nativeSamplingIncreased: boolean;
  readonly preTemporalSignalRecovered: boolean;
  readonly progress: number;
  readonly repeatNoiseExceeded: boolean;
  readonly structuredRawSignalRecovered: boolean;
}

export function parseTakramOrbitalStepScaleMode(
  value: string | null
): TakramOrbitalStepScaleMode | null {
  return value !== null && TAKRAM_ORBITAL_STEP_SCALE_MODES.includes(
    value as TakramOrbitalStepScaleMode
  )
    ? value as TakramOrbitalStepScaleMode
    : null;
}

export function resolveTakramOrbitalStepScale(
  mode: TakramOrbitalStepScaleMode
) {
  return TAKRAM_ORBITAL_STEP_SCALE_VALUES[mode];
}

export function resolveTakramOrbitalInitialStepMeters(input: {
  minStepSize: number;
  perspectiveStepScale: number;
  rayNearMeters: number;
}) {
  return input.minStepSize +
    (input.perspectiveStepScale - 1) * input.rayNearMeters;
}

export function resolveTakramOrbitalSamplingOutcome(input: {
  readonly frames: readonly TakramOrbitalSamplingFrameDecision[];
  readonly setupPass: boolean;
}): TakramOrbitalSamplingOutcome {
  if (!input.setupPass) return "ORBITAL_SAMPLING_SETUP_BLOCKED";
  const progressSet = new Set(input.frames.map(({ progress }) => progress));
  const completeProgress = input.frames.length ===
    TAKRAM_ORBITAL_SAMPLING_PROGRESS.length &&
    progressSet.size === TAKRAM_ORBITAL_SAMPLING_PROGRESS.length &&
    TAKRAM_ORBITAL_SAMPLING_PROGRESS.every((progress) =>
      progressSet.has(progress)
    );
  const upstreamRecovered = completeProgress && input.frames.every((frame) =>
    frame.repeatNoiseExceeded &&
    frame.nativeSamplingIncreased &&
    frame.preTemporalSignalRecovered &&
    frame.structuredRawSignalRecovered
  );
  if (!upstreamRecovered) {
    return "ORBITAL_SAMPLING_CAUSALITY_NOT_SUPPORTED";
  }
  return input.frames.every(({ downstreamSignalObservable }) =>
    downstreamSignalObservable
  )
    ? "ORBITAL_SAMPLING_CAUSALITY_CONFIRMED"
    : "ORBITAL_SAMPLING_CAUSALITY_PARTIAL_DOWNSTREAM_BLOCKED";
}
