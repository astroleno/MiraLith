import {
  analyzeTakramV3StageReadback,
  buildTakramV3CloudMask,
  resolveTakramV3CloudMaskComponents,
  type TakramV3SampleCountStatistics
} from "./TakramV3MorphologyMetrics";

export interface TakramStructuralAudit {
  readonly valid: boolean;
  readonly reasons: readonly string[];
}

export interface TakramPrimaryMarchReadbackInput {
  readonly width: number;
  readonly height: number;
  readonly channels: 4;
  readonly precision: "half-float";
  readonly source: "native-cloud-current-render-target-primary-march-v1";
  readonly origin: "bottom-left";
  readonly encoding: "rgba16f-loop-entry-cap-hit-direct";
  readonly maxIterationCount: 500;
  readonly values: ArrayLike<number>;
}

export interface TakramNativeSampleCountReadbackInput {
  readonly width: number;
  readonly height: number;
  readonly channels: 4;
  readonly precision: "half-float" | "unorm8";
  readonly source: "native-cloud-current-render-target-v1";
  readonly origin: "bottom-left";
  readonly encoding: "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask";
  readonly maxIterationCount: 500;
  readonly values: ArrayLike<number>;
}

export interface TakramPrimaryMarchMetrics {
  readonly enteredPrimaryMarchPixelCount: number;
  readonly capReachedPixelCount: number;
  readonly noHitCapReachedPixelCount: number;
  readonly hitPixelCount: number;
  readonly primaryCapSaturationFraction: number;
  readonly noHitPrimaryCapSaturationFraction: number;
  readonly loopIterationCount: TakramV3SampleCountStatistics;
}

export interface TakramOrbitalCloudMaskMetrics {
  readonly cloudPixelCount: number;
  readonly cloudPixelFraction: number;
  readonly connectedComponentCount: number;
  readonly largestConnectedAreaFraction: number;
  readonly singlePixelFragmentFraction: number;
  readonly smallFragmentFraction: number;
}

export interface TakramOrbitalSamplingProgressMetrics {
  readonly evidenceValid: boolean;
  readonly setupInvalidReasons: readonly string[];
  readonly nativeHitPixelFraction: number;
  readonly preTemporalSignalPixelFraction: number;
  readonly smallFragmentFraction: number;
  readonly signalRetention: number;
  readonly signalLumaRetention: number;
  readonly pairedChange: number;
  readonly repeatNoiseFloor: number;
  readonly enteredPrimaryMarchPixelCount: number;
  readonly primaryCapSaturationFraction: number;
  readonly noHitPrimaryCapSaturationFraction: number;
}

interface RgbaByteBuffer {
  readonly width: number;
  readonly height: number;
  readonly channels: 4;
  readonly origin: "top-left";
  readonly values: Uint8Array | Uint8ClampedArray;
}

interface RgbaLosslessBuffer {
  readonly width: number;
  readonly height: number;
  readonly channels: 4;
  readonly origin: "bottom-left";
  readonly precision: "float32" | "half-float";
  readonly values: ArrayLike<number>;
}

export interface TakramOrbitalSamplingProgressInput {
  readonly cloudRaw: RgbaByteBuffer;
  readonly cloudRawOff: RgbaByteBuffer;
  readonly pairedChange: number;
  readonly repeatNoiseFloor: number;
  readonly primaryMarch: TakramPrimaryMarchReadbackInput;
  readonly sampleCount: TakramNativeSampleCountReadbackInput;
  readonly preTemporal: RgbaLosslessBuffer;
  readonly resolvedHistory: RgbaLosslessBuffer;
}

function quantile(sorted: readonly number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const position = Math.max(0, Math.min(1, percentile)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower]! * (1 - fraction) + sorted[upper]! * fraction;
}

function summarize(values: number[]): TakramV3SampleCountStatistics {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0] ?? 0,
    mean: sorted.length > 0
      ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length
      : 0,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    max: sorted.at(-1) ?? 0
  };
}

function validatePackedMetadata(input: Readonly<{
  width: number;
  height: number;
  channels: number;
  values: ArrayLike<number>;
}>): string[] {
  const reasons: string[] = [];
  if (!Number.isInteger(input.width) || input.width <= 0) {
    reasons.push("invalid-width");
  }
  if (!Number.isInteger(input.height) || input.height <= 0) {
    reasons.push("invalid-height");
  }
  if (input.channels !== 4) reasons.push("invalid-channel-count");
  if (input.values.length !== input.width * input.height * input.channels) {
    reasons.push("invalid-packed-length");
  }
  return reasons;
}

function isBinary(value: number): boolean {
  return value === 0 || value === 1;
}

export function auditTakramPrimaryMarchReadback(
  input: TakramPrimaryMarchReadbackInput
): TakramStructuralAudit {
  const reasons = validatePackedMetadata(input);
  if (input.precision !== "half-float") reasons.push("invalid-precision");
  if (input.source !== "native-cloud-current-render-target-primary-march-v1") {
    reasons.push("invalid-source");
  }
  if (input.origin !== "bottom-left") reasons.push("invalid-origin");
  if (input.encoding !== "rgba16f-loop-entry-cap-hit-direct") {
    reasons.push("invalid-encoding");
  }
  if (input.maxIterationCount !== 500) reasons.push("invalid-iteration-cap");
  const pixelCount = Math.min(
    Math.max(0, input.width * input.height),
    Math.floor(input.values.length / 4)
  );
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const loop = Number(input.values[offset]);
    const entered = Number(input.values[offset + 1]);
    const cap = Number(input.values[offset + 2]);
    const hit = Number(input.values[offset + 3]);
    if (![loop, entered, cap, hit].every(Number.isFinite)) {
      reasons.push(`pixel-${pixel}:non-finite`);
      continue;
    }
    if (!Number.isInteger(loop) || loop < 0 || loop > input.maxIterationCount) {
      reasons.push(`pixel-${pixel}:invalid-loop-count`);
    }
    if (![entered, cap, hit].every(isBinary)) {
      reasons.push(`pixel-${pixel}:non-binary-flags`);
      continue;
    }
    if (entered === 0 && (loop !== 0 || cap !== 0 || hit !== 0)) {
      reasons.push(`pixel-${pixel}:non-entry-state`);
    }
    if (entered === 1 && loop < 1) reasons.push(`pixel-${pixel}:empty-entry`);
    if (cap === 1 && (entered !== 1 || loop !== input.maxIterationCount)) {
      reasons.push(`pixel-${pixel}:invalid-cap-state`);
    }
    if (hit === 1 && entered !== 1) reasons.push(`pixel-${pixel}:invalid-hit-state`);
  }
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function analyzeTakramPrimaryMarchReadback(
  input: TakramPrimaryMarchReadbackInput
): TakramPrimaryMarchMetrics {
  const audit = auditTakramPrimaryMarchReadback(input);
  if (!audit.valid) {
    throw new Error(`Invalid primary-march readback: ${audit.reasons.join(",")}`);
  }
  const enteredLoops: number[] = [];
  let capReachedPixelCount = 0;
  let noHitCapReachedPixelCount = 0;
  let hitPixelCount = 0;
  for (let offset = 0; offset < input.values.length; offset += 4) {
    const loop = Number(input.values[offset]);
    const entered = Number(input.values[offset + 1]) >= 0.5;
    const cap = Number(input.values[offset + 2]) >= 0.5;
    const hit = Number(input.values[offset + 3]) >= 0.5;
    if (!entered) continue;
    enteredLoops.push(loop);
    if (cap) capReachedPixelCount += 1;
    if (cap && !hit) noHitCapReachedPixelCount += 1;
    if (hit) hitPixelCount += 1;
  }
  const enteredPrimaryMarchPixelCount = enteredLoops.length;
  return Object.freeze({
    enteredPrimaryMarchPixelCount,
    capReachedPixelCount,
    noHitCapReachedPixelCount,
    hitPixelCount,
    primaryCapSaturationFraction: enteredPrimaryMarchPixelCount > 0
      ? capReachedPixelCount / enteredPrimaryMarchPixelCount
      : 0,
    noHitPrimaryCapSaturationFraction: enteredPrimaryMarchPixelCount > 0
      ? noHitCapReachedPixelCount / enteredPrimaryMarchPixelCount
      : 0,
    loopIterationCount: Object.freeze(summarize(enteredLoops))
  });
}

export function auditTakramSampleCountReadback(
  input: TakramNativeSampleCountReadbackInput
): TakramStructuralAudit {
  const reasons = validatePackedMetadata(input);
  if (input.source !== "native-cloud-current-render-target-v1") {
    reasons.push("invalid-source");
  }
  if (input.origin !== "bottom-left") reasons.push("invalid-origin");
  if (input.encoding !==
    "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask") {
    reasons.push("invalid-encoding");
  }
  if (input.maxIterationCount !== 500) reasons.push("invalid-iteration-cap");
  const pixelCount = Math.min(
    Math.max(0, input.width * input.height),
    Math.floor(input.values.length / 4)
  );
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const encodedPrimary = Number(input.values[offset]);
    const encodedShape = Number(input.values[offset + 1]);
    const encodedDetail = Number(input.values[offset + 2]);
    const hit = Number(input.values[offset + 3]);
    if (![encodedPrimary, encodedShape, encodedDetail, hit].every(Number.isFinite)) {
      reasons.push(`pixel-${pixel}:non-finite`);
      continue;
    }
    const decodedPrimary = encodedPrimary * 500;
    const decodedShape = encodedShape * 5;
    const decodedDetail = encodedDetail * 5;
    if (decodedPrimary < 0 || decodedPrimary > 500 ||
      decodedShape < 0 || decodedShape > 5 ||
      decodedDetail < 0 || decodedDetail > 5) {
      reasons.push(`pixel-${pixel}:decoded-out-of-range`);
      continue;
    }
    if (!isBinary(hit)) reasons.push(`pixel-${pixel}:invalid-hit-mask`);
    const primary = Math.round(decodedPrimary);
    const shape = Math.round(decodedShape);
    const detail = Math.round(decodedDetail);
    if (primary < shape || shape < detail) {
      reasons.push(`pixel-${pixel}:sample-count-order`);
    }
    if (hit >= 0.5 && primary <= 0) {
      reasons.push(`pixel-${pixel}:hit-without-primary-sample`);
    }
  }
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function buildTakramOrbitalCloudMask(input: Readonly<{
  width: number;
  height: number;
  cloudRaw: Uint8Array | Uint8ClampedArray;
  cloudRawOff: Uint8Array | Uint8ClampedArray;
}>): Uint8Array {
  return buildTakramV3CloudMask({
    ...input,
    differenceThreshold: 8 / 255
  });
}

export function analyzeTakramOrbitalCloudMask(input: Readonly<{
  mask: Uint8Array;
  width: number;
  height: number;
}>): TakramOrbitalCloudMaskMetrics {
  const componentSizes = resolveTakramV3CloudMaskComponents(
    input.mask,
    input.width,
    input.height
  );
  const cloudPixelCount = componentSizes.reduce((sum, size) => sum + size, 0);
  const safeCount = Math.max(cloudPixelCount, 1);
  const largest = componentSizes.length > 0 ? Math.max(...componentSizes) : 0;
  const single = componentSizes.filter((size) => size === 1).length;
  const small = componentSizes
    .filter((size) => size <= 3)
    .reduce((sum, size) => sum + size, 0);
  return Object.freeze({
    cloudPixelCount,
    cloudPixelFraction: cloudPixelCount / (input.width * input.height),
    connectedComponentCount: componentSizes.length,
    largestConnectedAreaFraction: largest / safeCount,
    singlePixelFragmentFraction: single / safeCount,
    smallFragmentFraction: small / safeCount
  });
}

function validateLosslessPair(
  preTemporal: RgbaLosslessBuffer,
  resolvedHistory: RgbaLosslessBuffer
): string[] {
  const reasons: string[] = [];
  for (const [name, buffer] of [
    ["pre-temporal", preTemporal],
    ["resolved-history", resolvedHistory]
  ] as const) {
    if (!Number.isInteger(buffer.width) || buffer.width <= 0 ||
      !Number.isInteger(buffer.height) || buffer.height <= 0 ||
      buffer.channels !== 4 ||
      buffer.values.length !== buffer.width * buffer.height * 4) {
      reasons.push(`${name}:invalid-shape`);
      continue;
    }
    for (let index = 0; index < buffer.values.length; index += 1) {
      if (!Number.isFinite(Number(buffer.values[index]))) {
        reasons.push(`${name}:non-finite`);
        break;
      }
    }
  }
  if (preTemporal.channels !== resolvedHistory.channels ||
    preTemporal.precision !== resolvedHistory.precision ||
    preTemporal.origin !== resolvedHistory.origin) {
    reasons.push("lossless-stage-mismatch");
  }
  return reasons;
}

export function analyzeTakramOrbitalSamplingProgress(
  input: TakramOrbitalSamplingProgressInput
): TakramOrbitalSamplingProgressMetrics {
  const primaryAudit = auditTakramPrimaryMarchReadback(input.primaryMarch);
  const sampleAudit = auditTakramSampleCountReadback(input.sampleCount);
  const setupInvalidReasons = [
    ...primaryAudit.reasons.map((reason) => `primary-march:${reason}`),
    ...sampleAudit.reasons.map((reason) => `sample-count:${reason}`),
    ...validateLosslessPair(input.preTemporal, input.resolvedHistory)
  ];
  if (input.primaryMarch.width !== input.sampleCount.width ||
    input.primaryMarch.height !== input.sampleCount.height) {
    setupInvalidReasons.push("native-readback-dimension-mismatch");
  }
  if (input.cloudRaw.width !== input.cloudRawOff.width ||
    input.cloudRaw.height !== input.cloudRawOff.height ||
    input.cloudRaw.values.length !== input.cloudRawOff.values.length) {
    setupInvalidReasons.push("cloud-raw-dimension-mismatch");
  }
  const evidenceValid = setupInvalidReasons.length === 0;
  if (!evidenceValid) {
    return Object.freeze({
      evidenceValid,
      setupInvalidReasons: Object.freeze(setupInvalidReasons),
      nativeHitPixelFraction: 0,
      preTemporalSignalPixelFraction: 0,
      smallFragmentFraction: 0,
      signalRetention: Number.NaN,
      signalLumaRetention: Number.NaN,
      pairedChange: input.pairedChange,
      repeatNoiseFloor: input.repeatNoiseFloor,
      enteredPrimaryMarchPixelCount: 0,
      primaryCapSaturationFraction: 0,
      noHitPrimaryCapSaturationFraction: 0
    });
  }

  const primaryMetrics = analyzeTakramPrimaryMarchReadback(input.primaryMarch);
  let nativeHitPixelCount = 0;
  for (let offset = 3; offset < input.sampleCount.values.length; offset += 4) {
    if (Number(input.sampleCount.values[offset]) >= 0.5) {
      nativeHitPixelCount += 1;
    }
  }
  const preTemporal = analyzeTakramV3StageReadback(input.preTemporal);
  const resolvedHistory = analyzeTakramV3StageReadback(input.resolvedHistory);
  const cloudMask = buildTakramOrbitalCloudMask({
    width: input.cloudRaw.width,
    height: input.cloudRaw.height,
    cloudRaw: input.cloudRaw.values,
    cloudRawOff: input.cloudRawOff.values
  });
  const fragmentation = analyzeTakramOrbitalCloudMask({
    mask: cloudMask,
    width: input.cloudRaw.width,
    height: input.cloudRaw.height
  });
  return Object.freeze({
    evidenceValid,
    setupInvalidReasons: Object.freeze(setupInvalidReasons),
    nativeHitPixelFraction: nativeHitPixelCount /
      (input.sampleCount.width * input.sampleCount.height),
    preTemporalSignalPixelFraction: preTemporal.signalPixelFraction,
    smallFragmentFraction: fragmentation.smallFragmentFraction,
    signalRetention: preTemporal.signalPixelFraction > 0
      ? resolvedHistory.signalPixelFraction / preTemporal.signalPixelFraction
      : Number.NaN,
    signalLumaRetention: preTemporal.signalMeanLuma > 0
      ? resolvedHistory.signalMeanLuma / preTemporal.signalMeanLuma
      : Number.NaN,
    pairedChange: input.pairedChange,
    repeatNoiseFloor: input.repeatNoiseFloor,
    enteredPrimaryMarchPixelCount: primaryMetrics.enteredPrimaryMarchPixelCount,
    primaryCapSaturationFraction: primaryMetrics.primaryCapSaturationFraction,
    noHitPrimaryCapSaturationFraction:
      primaryMetrics.noHitPrimaryCapSaturationFraction
  });
}

export function resolveTakramOrbitalSamplingProgressDecision(
  input: TakramOrbitalSamplingProgressMetrics
): Readonly<{
  evidenceValid: boolean;
  samplingHealthy: boolean;
  setupInvalidReasons: readonly string[];
  samplingFailureReasons: readonly string[];
}> {
  if (!input.evidenceValid || input.setupInvalidReasons.length > 0) {
    return Object.freeze({
      evidenceValid: false,
      samplingHealthy: false,
      setupInvalidReasons: Object.freeze([...input.setupInvalidReasons]),
      samplingFailureReasons: Object.freeze([])
    });
  }
  const failures: string[] = [];
  if (input.nativeHitPixelFraction < 0.2) failures.push("native-hit-fraction");
  if (input.preTemporalSignalPixelFraction < 0.2) {
    failures.push("pre-temporal-signal-fraction");
  }
  if (input.smallFragmentFraction > 0.1) failures.push("small-fragments");
  if (input.signalRetention < 0.9 || input.signalRetention > 1.1) {
    failures.push("signal-retention");
  }
  if (input.signalLumaRetention < 0.8 || input.signalLumaRetention > 1.2) {
    failures.push("signal-luma-retention");
  }
  if (!(input.pairedChange > input.repeatNoiseFloor)) {
    failures.push("paired-change-repeat-floor");
  }
  if (input.enteredPrimaryMarchPixelCount <= 0) {
    failures.push("primary-march-entry");
  }
  if (input.primaryCapSaturationFraction > 0.01) {
    failures.push("primary-cap-saturation");
  }
  const finiteFields = [
    input.nativeHitPixelFraction,
    input.preTemporalSignalPixelFraction,
    input.smallFragmentFraction,
    input.signalRetention,
    input.signalLumaRetention,
    input.pairedChange,
    input.repeatNoiseFloor,
    input.primaryCapSaturationFraction,
    input.noHitPrimaryCapSaturationFraction
  ];
  if (!finiteFields.every(Number.isFinite)) failures.push("non-finite-metric");
  return Object.freeze({
    evidenceValid: true,
    samplingHealthy: failures.length === 0,
    setupInvalidReasons: Object.freeze([]),
    samplingFailureReasons: Object.freeze(failures)
  });
}
