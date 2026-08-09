export interface TakramV3MorphologyImageMetrics {
  cloudPixelFraction: number;
  connectedComponentCount: number;
  largestConnectedAreaFraction: number;
  singlePixelFragmentFraction: number;
  smallFragmentFraction: number;
  edgeDensity: number;
  clearAirLeakage: number;
  firstFrameConvergedLumaDelta: number;
  internalLumaStdDev: number;
  multiScaleLumaVariation: number;
  gradientEnergy: number;
  localPeakDensity: number;
}

export interface TakramV3MorphologyImageMetricInput {
  width: number;
  height: number;
  cloudRaw: Uint8Array | Uint8ClampedArray;
  cloudRawOff: Uint8Array | Uint8ClampedArray;
  cloudOff: Uint8Array | Uint8ClampedArray;
  firstFrame: Uint8Array | Uint8ClampedArray;
  convergedFull: Uint8Array | Uint8ClampedArray;
  differenceThreshold?: number;
}

export interface TakramV3MaskedFrameDifference {
  normalizedMae: number;
  maxDifference: number;
  p50Difference: number;
  p95Difference: number;
  changedPixelFraction: number;
}

export interface TakramV3SampleCountStatistics {
  min: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

export interface TakramV3OpeningStageIsolationMetrics {
  cloudPixelCount: number;
  cloudPixelFraction: number;
  rawCloudSignal: TakramV3MaskedFrameDifference;
  finalCloudSignal: TakramV3MaskedFrameDifference;
  bsmDifference: TakramV3MaskedFrameDifference;
  finalToRawMeanSignalRatio: number;
  fragmentation: {
    connectedComponentCount: number;
    largestConnectedAreaFraction: number;
    singlePixelFragmentFraction: number;
    smallFragmentFraction: number;
    edgeDensity: number;
  };
}

export interface TakramV3OpeningStageIsolationInput {
  width: number;
  height: number;
  cloudRaw: Uint8Array | Uint8ClampedArray;
  cloudRawOff: Uint8Array | Uint8ClampedArray;
  full: Uint8Array | Uint8ClampedArray;
  aerialFinal: Uint8Array | Uint8ClampedArray;
  bsmOff: Uint8Array | Uint8ClampedArray;
  differenceThreshold?: number;
}

export interface TakramV3NativeSampleCountReadback {
  width: number;
  height: number;
  precision: "half-float" | "unorm8";
  source: "native-cloud-current-render-target-v1";
  encoding: "linear-rgb-primary-over-500-shape-over-5-detail-over-5";
  /** Packed normalized RGB values read directly from CloudsPass.currentRenderTarget. */
  values: ArrayLike<number>;
}

export interface TakramV3NativeSampleCountMetrics {
  source: TakramV3NativeSampleCountReadback["source"];
  encoding: TakramV3NativeSampleCountReadback["encoding"];
  precision: TakramV3NativeSampleCountReadback["precision"];
  nativeWidth: number;
  nativeHeight: number;
  maskMapping: "full-resolution-cloud-mask-cell-coverage-v1";
  minimumMaskCoverage: number;
  maskedNativePixelCount: number;
  invariantViolationCount: number;
  invariantViolationFraction: number;
  invariantPass: boolean;
  primary: TakramV3SampleCountStatistics;
  shape: TakramV3SampleCountStatistics;
  detail: TakramV3SampleCountStatistics;
}

export const TAKRAM_V3_MORPHOLOGY_METRIC_THRESHOLDS = Object.freeze({
  minimumCloudPixelFraction: 0.002,
  minimumLargestConnectedAreaFraction: 0.25,
  maximumSinglePixelFragmentFraction: 0.02,
  maximumSmallFragmentFraction: 0.08,
  maximumEdgeDensity: 0.65,
  maximumClearAirLeakage: 0.05,
  maximumFirstFrameConvergedLumaDelta: 0.08
});

const DEFAULT_DIFFERENCE_THRESHOLD = 8 / 255;
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

function pixelDifference(
  left: Uint8Array | Uint8ClampedArray,
  right: Uint8Array | Uint8ClampedArray,
  pixelIndex: number
) {
  const offset = pixelIndex * 4;
  return Math.max(
    Math.abs(left[offset]! - right[offset]!),
    Math.abs(left[offset + 1]! - right[offset + 1]!),
    Math.abs(left[offset + 2]! - right[offset + 2]!)
  ) / 255;
}

function quantile(sortedValues: readonly number[], percentile: number) {
  if (sortedValues.length === 0) return 0;
  const position = Math.max(0, Math.min(1, percentile)) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const mix = position - lowerIndex;
  return sortedValues[lowerIndex]! * (1 - mix) + sortedValues[upperIndex]! * mix;
}

function validateRgbaFrames(
  width: number,
  height: number,
  frames: readonly (Uint8Array | Uint8ClampedArray)[]
) {
  const expectedLength = width * height * 4;
  if (!Number.isInteger(width) || width <= 0 ||
    !Number.isInteger(height) || height <= 0 ||
    frames.some((pixels) => pixels.length !== expectedLength)) {
    throw new Error("Morphology metric frames must be equally sized RGBA images.");
  }
}

function resolveMaskedFrameDifference(input: {
  mask: Uint8Array;
  left: Uint8Array | Uint8ClampedArray;
  right: Uint8Array | Uint8ClampedArray;
  differenceThreshold: number;
}): TakramV3MaskedFrameDifference {
  const differences: number[] = [];
  let sum = 0;
  let maxDifference = 0;
  let changedPixelCount = 0;
  for (let index = 0; index < input.mask.length; index += 1) {
    if (input.mask[index] === 0) continue;
    const difference = pixelDifference(input.left, input.right, index);
    differences.push(difference);
    sum += difference;
    maxDifference = Math.max(maxDifference, difference);
    if (difference > input.differenceThreshold) changedPixelCount += 1;
  }
  differences.sort((left, right) => left - right);
  const count = differences.length;
  return {
    normalizedMae: count > 0 ? sum / count : 0,
    maxDifference,
    p50Difference: quantile(differences, 0.5),
    p95Difference: quantile(differences, 0.95),
    changedPixelFraction: count > 0 ? changedPixelCount / count : 0
  };
}

export function analyzeTakramV3MaskedFrameDifference(input: {
  width: number;
  height: number;
  mask: Uint8Array;
  left: Uint8Array | Uint8ClampedArray;
  right: Uint8Array | Uint8ClampedArray;
  differenceThreshold?: number;
}) {
  validateRgbaFrames(input.width, input.height, [input.left, input.right]);
  if (input.mask.length !== input.width * input.height) {
    throw new Error("Cloud mask dimensions must match the compared RGBA frames.");
  }
  return resolveMaskedFrameDifference({
    mask: input.mask,
    left: input.left,
    right: input.right,
    differenceThreshold: input.differenceThreshold ?? DEFAULT_DIFFERENCE_THRESHOLD
  });
}

function resolveSampleCountStatistics(values: number[]): TakramV3SampleCountStatistics {
  values.sort((left, right) => left - right);
  return {
    min: values[0] ?? 0,
    mean: values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    max: values.at(-1) ?? 0
  };
}

export function analyzeTakramV3NativeSampleCountReadback(input: {
  cloudMask: Uint8Array;
  cloudMaskWidth: number;
  cloudMaskHeight: number;
  readback: TakramV3NativeSampleCountReadback;
  minimumMaskCoverage?: number;
}): TakramV3NativeSampleCountMetrics {
  if (!Number.isInteger(input.cloudMaskWidth) || input.cloudMaskWidth <= 0 ||
    !Number.isInteger(input.cloudMaskHeight) || input.cloudMaskHeight <= 0 ||
    input.cloudMask.length !== input.cloudMaskWidth * input.cloudMaskHeight) {
    throw new Error("Cloud mask dimensions must match its pixel buffer.");
  }
  const { readback } = input;
  if (!Number.isInteger(readback.width) || readback.width <= 0 ||
    !Number.isInteger(readback.height) || readback.height <= 0 ||
    readback.values.length !== readback.width * readback.height * 3) {
    throw new Error("Native sample-count readback must be packed normalized RGB.");
  }
  const minimumMaskCoverage = input.minimumMaskCoverage ?? 0.25;
  if (!(minimumMaskCoverage > 0 && minimumMaskCoverage <= 1)) {
    throw new Error("Native sample-count mask coverage must be in (0, 1].");
  }

  const counts = {
    primary: [] as number[],
    shape: [] as number[],
    detail: [] as number[]
  };
  let invariantViolationCount = 0;
  for (let nativeY = 0; nativeY < readback.height; nativeY += 1) {
    const maskY0 = Math.floor(nativeY * input.cloudMaskHeight / readback.height);
    const maskY1 = Math.max(maskY0 + 1,
      Math.floor((nativeY + 1) * input.cloudMaskHeight / readback.height));
    for (let nativeX = 0; nativeX < readback.width; nativeX += 1) {
      const maskX0 = Math.floor(nativeX * input.cloudMaskWidth / readback.width);
      const maskX1 = Math.max(maskX0 + 1,
        Math.floor((nativeX + 1) * input.cloudMaskWidth / readback.width));
      let maskedPixelCount = 0;
      let cellPixelCount = 0;
      for (let maskY = maskY0; maskY < Math.min(maskY1, input.cloudMaskHeight); maskY += 1) {
        for (let maskX = maskX0; maskX < Math.min(maskX1, input.cloudMaskWidth); maskX += 1) {
          cellPixelCount += 1;
          maskedPixelCount += input.cloudMask[maskY * input.cloudMaskWidth + maskX] === 1 ? 1 : 0;
        }
      }
      if (cellPixelCount === 0 || maskedPixelCount / cellPixelCount < minimumMaskCoverage) {
        continue;
      }
      const offset = (nativeY * readback.width + nativeX) * 3;
      const primary = Math.max(0, Math.round(Number(readback.values[offset] ?? 0) * 500));
      const shape = Math.max(0, Math.round(Number(readback.values[offset + 1] ?? 0) * 5));
      const detail = Math.max(0, Math.round(Number(readback.values[offset + 2] ?? 0) * 5));
      if (!Number.isFinite(primary) || !Number.isFinite(shape) || !Number.isFinite(detail) ||
        primary < shape || shape < detail) {
        invariantViolationCount += 1;
      }
      counts.primary.push(primary);
      counts.shape.push(shape);
      counts.detail.push(detail);
    }
  }
  const maskedNativePixelCount = counts.primary.length;
  return {
    source: readback.source,
    encoding: readback.encoding,
    precision: readback.precision,
    nativeWidth: readback.width,
    nativeHeight: readback.height,
    maskMapping: "full-resolution-cloud-mask-cell-coverage-v1",
    minimumMaskCoverage,
    maskedNativePixelCount,
    invariantViolationCount,
    invariantViolationFraction: maskedNativePixelCount > 0
      ? invariantViolationCount / maskedNativePixelCount
      : 0,
    invariantPass: maskedNativePixelCount > 0 && invariantViolationCount === 0,
    primary: resolveSampleCountStatistics(counts.primary),
    shape: resolveSampleCountStatistics(counts.shape),
    detail: resolveSampleCountStatistics(counts.detail)
  };
}

export function analyzeTakramV3OpeningStageIsolation(
  input: TakramV3OpeningStageIsolationInput
): { cloudMask: Uint8Array; metrics: TakramV3OpeningStageIsolationMetrics } {
  validateRgbaFrames(input.width, input.height, [
    input.cloudRaw,
    input.cloudRawOff,
    input.full,
    input.aerialFinal,
    input.bsmOff
  ]);
  const pixelCount = input.width * input.height;
  const threshold = input.differenceThreshold ?? DEFAULT_DIFFERENCE_THRESHOLD;
  const cloudMask = new Uint8Array(pixelCount);
  let cloudPixelCount = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (pixelDifference(input.cloudRaw, input.cloudRawOff, index) > threshold) {
      cloudMask[index] = 1;
      cloudPixelCount += 1;
    }
  }
  const rawCloudSignal = resolveMaskedFrameDifference({
    mask: cloudMask,
    left: input.cloudRaw,
    right: input.cloudRawOff,
    differenceThreshold: threshold
  });
  const finalCloudSignal = resolveMaskedFrameDifference({
    mask: cloudMask,
    left: input.full,
    right: input.aerialFinal,
    differenceThreshold: threshold
  });
  const bsmDifference = resolveMaskedFrameDifference({
    mask: cloudMask,
    left: input.full,
    right: input.bsmOff,
    differenceThreshold: threshold
  });
  const componentSizes = resolveComponentSizes(cloudMask, input.width, input.height);
  const largestComponent = componentSizes.length > 0 ? Math.max(...componentSizes) : 0;
  const singlePixelCount = componentSizes.filter((size) => size === 1).length;
  const smallFragmentPixelCount = componentSizes
    .filter((size) => size <= 3)
    .reduce((sum, size) => sum + size, 0);
  let edgePixelCount = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (cloudMask[index] === 0) continue;
    if (neighbors4(index, input.width, input.height).some((neighbor) =>
      cloudMask[neighbor] === 0
    ) || neighbors4(index, input.width, input.height).length < 4) {
      edgePixelCount += 1;
    }
  }
  const safeCloudPixelCount = Math.max(cloudPixelCount, 1);
  return {
    cloudMask,
    metrics: {
      cloudPixelCount,
      cloudPixelFraction: cloudPixelCount / pixelCount,
      rawCloudSignal,
      finalCloudSignal,
      bsmDifference,
      finalToRawMeanSignalRatio: rawCloudSignal.normalizedMae > 0
        ? finalCloudSignal.normalizedMae / rawCloudSignal.normalizedMae
        : 0,
      fragmentation: {
        connectedComponentCount: componentSizes.length,
        largestConnectedAreaFraction: largestComponent / safeCloudPixelCount,
        singlePixelFragmentFraction: singlePixelCount / safeCloudPixelCount,
        smallFragmentFraction: smallFragmentPixelCount / safeCloudPixelCount,
        edgeDensity: edgePixelCount / safeCloudPixelCount
      }
    }
  };
}

function luma(pixels: Uint8Array | Uint8ClampedArray, pixelIndex: number) {
  const offset = pixelIndex * 4;
  return (
    pixels[offset]! * LUMA_R
    + pixels[offset + 1]! * LUMA_G
    + pixels[offset + 2]! * LUMA_B
  ) / 255;
}

function neighbors4(index: number, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  const neighbors: number[] = [];
  if (x > 0) neighbors.push(index - 1);
  if (x + 1 < width) neighbors.push(index + 1);
  if (y > 0) neighbors.push(index - width);
  if (y + 1 < height) neighbors.push(index + width);
  return neighbors;
}

function resolveComponentSizes(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const componentSizes: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start] === 1) continue;
    let size = 0;
    const stack = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const index = stack.pop()!;
      size += 1;
      for (const neighbor of neighbors4(index, width, height)) {
        if (mask[neighbor] === 1 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
    componentSizes.push(size);
  }
  return componentSizes;
}

function dilateMask(mask: Uint8Array, width: number, height: number) {
  const dilated = mask.slice();
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    for (const neighbor of neighbors4(index, width, height)) {
      dilated[neighbor] = 1;
    }
  }
  return dilated;
}

function neighbors8(index: number, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  const neighbors: number[] = [];
  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      if (xOffset === 0 && yOffset === 0) continue;
      const neighborX = x + xOffset;
      const neighborY = y + yOffset;
      if (neighborX >= 0 && neighborX < width && neighborY >= 0 && neighborY < height) {
        neighbors.push(neighborY * width + neighborX);
      }
    }
  }
  return neighbors;
}

function resolveInternalStructureMetrics(
  cloudMask: Uint8Array,
  signal: Float32Array,
  width: number,
  height: number,
  cloudPixelCount: number
) {
  if (cloudPixelCount === 0) {
    return {
      internalLumaStdDev: 0,
      multiScaleLumaVariation: 0,
      gradientEnergy: 0,
      localPeakDensity: 0
    };
  }
  let sum = 0;
  let sumSquares = 0;
  let variation = 0;
  let variationSamples = 0;
  let gradient = 0;
  let gradientSamples = 0;
  let localPeaks = 0;
  for (let index = 0; index < cloudMask.length; index += 1) {
    if (cloudMask[index] === 0) continue;
    const value = signal[index]!;
    sum += value;
    sumSquares += value * value;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const radius of [1, 4] as const) {
      const samples = [
        [x - radius, y],
        [x + radius, y],
        [x, y - radius],
        [x, y + radius]
      ].filter(([sampleX, sampleY]) =>
        sampleX! >= 0 && sampleX! < width && sampleY! >= 0 && sampleY! < height
      ).map(([sampleX, sampleY]) => sampleY! * width + sampleX!)
        .filter((sampleIndex) => cloudMask[sampleIndex] === 1);
      if (samples.length > 0) {
        const localMean = samples.reduce((total, sampleIndex) =>
          total + signal[sampleIndex]!, 0
        ) / samples.length;
        variation += Math.abs(value - localMean);
        variationSamples += 1;
      }
    }
    const gradientNeighbors = [
      x + 1 < width ? index + 1 : -1,
      y + 1 < height ? index + width : -1
    ].filter((neighbor) => neighbor >= 0 && cloudMask[neighbor] === 1);
    for (const neighbor of gradientNeighbors) {
      gradient += Math.abs(value - signal[neighbor]!);
      gradientSamples += 1;
    }
    const peakNeighbors = neighbors8(index, width, height)
      .filter((neighbor) => cloudMask[neighbor] === 1);
    if (peakNeighbors.length >= 3 && peakNeighbors.every((neighbor) =>
      value - signal[neighbor]! > 2 / 255
    )) {
      localPeaks += 1;
    }
  }
  const mean = sum / cloudPixelCount;
  return {
    internalLumaStdDev: Math.sqrt(Math.max(0, sumSquares / cloudPixelCount - mean * mean)),
    multiScaleLumaVariation: variation / Math.max(variationSamples, 1),
    gradientEnergy: gradient / Math.max(gradientSamples, 1),
    localPeakDensity: localPeaks / cloudPixelCount
  };
}

export function analyzeTakramV3MorphologyImageMetrics(
  input: TakramV3MorphologyImageMetricInput
): TakramV3MorphologyImageMetrics {
  const pixelCount = input.width * input.height;
  const expectedLength = pixelCount * 4;
  if (!Number.isInteger(input.width) || input.width <= 0 ||
    !Number.isInteger(input.height) || input.height <= 0 ||
    [input.cloudRaw, input.cloudRawOff, input.cloudOff, input.firstFrame, input.convergedFull]
      .some((pixels) => pixels.length !== expectedLength)) {
    throw new Error("Morphology metric frames must be equally sized RGBA images.");
  }
  const threshold = input.differenceThreshold ?? DEFAULT_DIFFERENCE_THRESHOLD;
  const cloudMask = new Uint8Array(pixelCount);
  const fullMask = new Uint8Array(pixelCount);
  const cloudSignal = new Float32Array(pixelCount);
  let cloudPixelCount = 0;
  let fullPixelCount = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (pixelDifference(input.cloudRaw, input.cloudRawOff, index) > threshold) {
      cloudMask[index] = 1;
      cloudPixelCount += 1;
      cloudSignal[index] = Math.abs(
        luma(input.cloudRaw, index) - luma(input.cloudRawOff, index)
      );
    }
    if (pixelDifference(input.convergedFull, input.cloudOff, index) > threshold) {
      fullMask[index] = 1;
      fullPixelCount += 1;
    }
  }
  const componentSizes = resolveComponentSizes(cloudMask, input.width, input.height);
  const largestComponent = componentSizes.length > 0 ? Math.max(...componentSizes) : 0;
  const singlePixelCount = componentSizes.filter((size) => size === 1).length;
  const smallFragmentPixelCount = componentSizes
    .filter((size) => size <= 3)
    .reduce((sum, size) => sum + size, 0);
  let edgePixelCount = 0;
  let temporalLumaDelta = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (cloudMask[index] === 0) continue;
    if (neighbors4(index, input.width, input.height).some((neighbor) =>
      cloudMask[neighbor] === 0
    ) || neighbors4(index, input.width, input.height).length < 4) {
      edgePixelCount += 1;
    }
    temporalLumaDelta += Math.abs(
      luma(input.firstFrame, index) - luma(input.convergedFull, index)
    );
  }
  const dilatedCloudMask = dilateMask(cloudMask, input.width, input.height);
  let leakedFullPixelCount = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (fullMask[index] === 1 && dilatedCloudMask[index] === 0) {
      leakedFullPixelCount += 1;
    }
  }
  const safeCloudPixelCount = Math.max(cloudPixelCount, 1);
  const internalStructure = resolveInternalStructureMetrics(
    cloudMask,
    cloudSignal,
    input.width,
    input.height,
    cloudPixelCount
  );
  return {
    cloudPixelFraction: cloudPixelCount / pixelCount,
    connectedComponentCount: componentSizes.length,
    largestConnectedAreaFraction: largestComponent / safeCloudPixelCount,
    singlePixelFragmentFraction: singlePixelCount / safeCloudPixelCount,
    smallFragmentFraction: smallFragmentPixelCount / safeCloudPixelCount,
    edgeDensity: edgePixelCount / safeCloudPixelCount,
    clearAirLeakage: leakedFullPixelCount / Math.max(fullPixelCount, 1),
    firstFrameConvergedLumaDelta: temporalLumaDelta / safeCloudPixelCount,
    ...internalStructure
  };
}

export function classifyTakramV3MorphologyImageMetrics(
  metrics: TakramV3MorphologyImageMetrics
): { pass: boolean; failed: readonly string[] } {
  const thresholds = TAKRAM_V3_MORPHOLOGY_METRIC_THRESHOLDS;
  const failed: string[] = [];
  if (metrics.cloudPixelFraction < thresholds.minimumCloudPixelFraction) {
    failed.push("cloud-pixel-fraction");
  }
  if (metrics.largestConnectedAreaFraction < thresholds.minimumLargestConnectedAreaFraction) {
    failed.push("minimum-connected-mass");
  }
  if (metrics.singlePixelFragmentFraction > thresholds.maximumSinglePixelFragmentFraction) {
    failed.push("single-pixel-fragments");
  }
  if (metrics.smallFragmentFraction > thresholds.maximumSmallFragmentFraction) {
    failed.push("small-fragments");
  }
  if (metrics.edgeDensity > thresholds.maximumEdgeDensity) {
    failed.push("edge-density");
  }
  if (metrics.clearAirLeakage > thresholds.maximumClearAirLeakage) {
    failed.push("clear-air-leakage");
  }
  if (metrics.firstFrameConvergedLumaDelta >
    thresholds.maximumFirstFrameConvergedLumaDelta) {
    failed.push("temporal-luma-delta");
  }
  return { pass: failed.length === 0, failed };
}
