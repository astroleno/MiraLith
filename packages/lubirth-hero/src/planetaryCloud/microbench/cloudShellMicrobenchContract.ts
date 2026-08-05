export const CLOUD_SHELL_BASE_ALTITUDE_M = 8_000;
export const CLOUD_SHELL_THICKNESS_M = 52_000;
export const CLOUD_SHELL_MICROBENCH_WIDTH = 1_440;
export const CLOUD_SHELL_MICROBENCH_HEIGHT = 960;
export const CLOUD_SHELL_MICROBENCH_DPR = 1;
export const CLOUD_SHELL_MICROBENCH_RESOLUTION_SCALE = 0.5;
export const CLOUD_SHELL_MICROBENCH_WARMUP_FRAMES = 120;
export const CLOUD_SHELL_MICROBENCH_VALID_GPU_SAMPLES = 120;

export type CloudShellMicrobenchMeasurementState =
  | "awaiting-visual-review"
  | "awaiting-readiness"
  | "warming"
  | "sampling"
  | "complete"
  | "timer-unavailable";

export interface CloudShellMicrobenchMeasurementConditions {
  coordinatePass: boolean;
  gammaColorPass: boolean;
  hdrColorPass: boolean;
  measure: boolean;
  timerSupported: boolean;
  visualGateConfirmed: boolean;
  weatherReady: boolean;
}

export interface CloudShellMicrobenchMeasurementWindow {
  measurementReadyFrame: number | null;
  samplingStartFrame: number | null;
  warmupStartFrame: number | null;
}

function isCloudShellMicrobenchMeasurementReady({
  coordinatePass,
  gammaColorPass,
  hdrColorPass,
  measure,
  timerSupported,
  visualGateConfirmed,
  weatherReady
}: CloudShellMicrobenchMeasurementConditions) {
  return measure && visualGateConfirmed && timerSupported && weatherReady &&
    coordinatePass && hdrColorPass && gammaColorPass;
}

export function beginCloudShellMicrobenchWarmupAfterReadyFrame({
  frameId,
  measurement,
  window
}: {
  frameId: number;
  measurement: CloudShellMicrobenchMeasurementConditions;
  window: CloudShellMicrobenchMeasurementWindow;
}): CloudShellMicrobenchMeasurementWindow {
  if (!isCloudShellMicrobenchMeasurementReady(measurement)) {
    return {
      measurementReadyFrame: null,
      warmupStartFrame: null,
      samplingStartFrame: null
    };
  }

  if (window.measurementReadyFrame !== null && window.warmupStartFrame !== null &&
    window.samplingStartFrame !== null) {
    return window;
  }

  const warmupStartFrame = frameId + 1;
  return {
    measurementReadyFrame: frameId,
    warmupStartFrame,
    samplingStartFrame: warmupStartFrame + CLOUD_SHELL_MICROBENCH_WARMUP_FRAMES
  };
}

export function shouldMeasureCloudShellMicrobenchFrame({
  frameId,
  measurement,
  validGpuSampleCount,
  window
}: {
  frameId: number;
  measurement: CloudShellMicrobenchMeasurementConditions;
  validGpuSampleCount: number;
  window: CloudShellMicrobenchMeasurementWindow;
}) {
  return isCloudShellMicrobenchMeasurementReady(measurement) &&
    window.samplingStartFrame !== null &&
    frameId >= window.samplingStartFrame &&
    validGpuSampleCount < CLOUD_SHELL_MICROBENCH_VALID_GPU_SAMPLES;
}

export function resolveCloudShellMicrobenchMeasurementState({
  frameId,
  measurement,
  validGpuSampleCount,
  window
}: {
  frameId: number;
  measurement: CloudShellMicrobenchMeasurementConditions;
  validGpuSampleCount: number;
  window: CloudShellMicrobenchMeasurementWindow;
}): CloudShellMicrobenchMeasurementState {
  if (!measurement.visualGateConfirmed || !measurement.measure) {
    return "awaiting-visual-review";
  }
  if (!measurement.timerSupported) {
    return "timer-unavailable";
  }
  if (!measurement.weatherReady || !measurement.coordinatePass ||
    !measurement.hdrColorPass || !measurement.gammaColorPass ||
    window.measurementReadyFrame === null || window.samplingStartFrame === null) {
    return "awaiting-readiness";
  }
  if (validGpuSampleCount >= CLOUD_SHELL_MICROBENCH_VALID_GPU_SAMPLES) {
    return "complete";
  }
  return frameId < window.samplingStartFrame ? "warming" : "sampling";
}

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
