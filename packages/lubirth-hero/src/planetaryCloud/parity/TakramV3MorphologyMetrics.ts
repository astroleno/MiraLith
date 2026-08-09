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
    failed.push("largest-connected-area");
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
