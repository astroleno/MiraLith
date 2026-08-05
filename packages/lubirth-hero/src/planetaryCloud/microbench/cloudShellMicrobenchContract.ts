export const CLOUD_SHELL_BASE_ALTITUDE_M = 8_000;
export const CLOUD_SHELL_THICKNESS_M = 52_000;
export const CLOUD_SHELL_MICROBENCH_WIDTH = 1_440;
export const CLOUD_SHELL_MICROBENCH_HEIGHT = 960;
export const CLOUD_SHELL_MICROBENCH_DPR = 1;
export const CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE = 0.5;
export const CLOUD_SHELL_MICROBENCH_WARMUP_FRAMES = 120;
export const CLOUD_SHELL_MICROBENCH_VALID_GPU_SAMPLES = 120;

export const CLOUD_SHELL_MICROBENCH_CASES = Object.freeze({
  "24/6": Object.freeze({ primarySteps: 24, lightSteps: 6, groundSteps: 0 }),
  "32/2": Object.freeze({ primarySteps: 32, lightSteps: 2, groundSteps: 0 }),
  "48/6": Object.freeze({ primarySteps: 48, lightSteps: 6, groundSteps: 0 })
});

export type CloudShellMicrobenchCaseId = keyof typeof CLOUD_SHELL_MICROBENCH_CASES;
export type CloudShellMicrobenchDecision =
  | "EARLY_KILL"
  | "EARLY_REPRESENTATION_FAIL"
  | "MICROBENCH_OVER_BUDGET"
  | "MICROBENCH_VIABLE";

export interface CloudShellMicrobenchCheckpointInput {
  coordinatePass: boolean;
  hdrColorPass: boolean;
  microVisualPass: boolean;
  timerSupported: boolean;
  visualPassingCaseP95Ms: Array<{
    caseId: CloudShellMicrobenchCaseId | string;
    p95Ms: number;
  }>;
}

export function resolveCloudShellMicrobenchCheckpoint({
  coordinatePass,
  hdrColorPass,
  microVisualPass,
  timerSupported,
  visualPassingCaseP95Ms
}: CloudShellMicrobenchCheckpointInput): CloudShellMicrobenchDecision {
  if (!coordinatePass || !hdrColorPass || !timerSupported) {
    return "EARLY_KILL";
  }

  if (!microVisualPass) {
    return "EARLY_REPRESENTATION_FAIL";
  }

  if (visualPassingCaseP95Ms.length === 0 ||
    visualPassingCaseP95Ms.some(({ p95Ms }) => !Number.isFinite(p95Ms))) {
    return "EARLY_KILL";
  }

  if (Math.min(...visualPassingCaseP95Ms.map(({ p95Ms }) => p95Ms)) > 4) {
    return "MICROBENCH_OVER_BUDGET";
  }

  return "MICROBENCH_VIABLE";
}
