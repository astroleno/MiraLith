import { expect, test } from "@playwright/test";

const metricsModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyMetrics";

function createFrame(width: number, height: number) {
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

function setPixel(
  pixels: Uint8Array,
  width: number,
  x: number,
  y: number,
  value: number
) {
  const offset = (y * width + x) * 4;
  pixels[offset] = value;
  pixels[offset + 1] = value;
  pixels[offset + 2] = value;
}

test("measures connected cloud mass, fragments, leakage and temporal delta", async () => {
  const metrics = await import(metricsModulePath) as {
    analyzeTakramV3MorphologyImageMetrics(input: {
      width: number;
      height: number;
      cloudRaw: Uint8Array;
      cloudRawOff: Uint8Array;
      cloudOff: Uint8Array;
      firstFrame: Uint8Array;
      convergedFull: Uint8Array;
      differenceThreshold?: number;
    }): {
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
    };
  };
  const width = 8;
  const height = 6;
  const cloudOff = createFrame(width, height);
  const cloudRaw = createFrame(width, height);
  const cloudRawOff = createFrame(width, height);
  const firstFrame = createFrame(width, height);
  const convergedFull = createFrame(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(cloudOff, width, x, y, 64);
      setPixel(firstFrame, width, x, y, 64);
      setPixel(convergedFull, width, x, y, 64);
    }
  }
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      setPixel(cloudRaw, width, x, y, 255);
      setPixel(firstFrame, width, x, y, 200);
      setPixel(convergedFull, width, x, y, 255);
    }
  }
  setPixel(cloudRaw, width, 7, 5, 255);
  setPixel(firstFrame, width, 7, 5, 200);
  setPixel(convergedFull, width, 7, 5, 255);

  const result = metrics.analyzeTakramV3MorphologyImageMetrics({
    width,
    height,
    cloudRaw,
    cloudRawOff,
    cloudOff,
    firstFrame,
    convergedFull
  });
  expect(result.cloudPixelFraction).toBeCloseTo(10 / 48, 12);
  expect(result.connectedComponentCount).toBe(2);
  expect(result.largestConnectedAreaFraction).toBeCloseTo(0.9, 12);
  expect(result.singlePixelFragmentFraction).toBeCloseTo(0.1, 12);
  expect(result.smallFragmentFraction).toBeCloseTo(0.1, 12);
  expect(result.edgeDensity).toBeCloseTo(0.9, 12);
  expect(result.clearAirLeakage).toBe(0);
  expect(result.firstFrameConvergedLumaDelta).toBeCloseTo(55 / 255, 12);
  expect(result.internalLumaStdDev).toBeGreaterThanOrEqual(0);
});

test("classifies morphology metrics with explicit non-flat and stability floors", async () => {
  const metrics = await import(metricsModulePath) as {
    classifyTakramV3MorphologyImageMetrics(input: {
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
    }): { pass: boolean; failed: readonly string[] };
  };
  expect(metrics.classifyTakramV3MorphologyImageMetrics({
    cloudPixelFraction: 0.2,
    connectedComponentCount: 4,
    largestConnectedAreaFraction: 0.7,
    singlePixelFragmentFraction: 0.005,
    smallFragmentFraction: 0.02,
    edgeDensity: 0.2,
    clearAirLeakage: 0.01,
    firstFrameConvergedLumaDelta: 0.02,
    internalLumaStdDev: 0.1,
    multiScaleLumaVariation: 0.08,
    gradientEnergy: 0.06,
    localPeakDensity: 0.03
  })).toEqual({ pass: true, failed: [] });

  expect(metrics.classifyTakramV3MorphologyImageMetrics({
    cloudPixelFraction: 0.2,
    connectedComponentCount: 12,
    largestConnectedAreaFraction: 0.2,
    singlePixelFragmentFraction: 0.005,
    smallFragmentFraction: 0.02,
    edgeDensity: 0.2,
    clearAirLeakage: 0.01,
    firstFrameConvergedLumaDelta: 0.02,
    internalLumaStdDev: 0.1,
    multiScaleLumaVariation: 0.08,
    gradientEnergy: 0.06,
    localPeakDensity: 0.03
  })).toEqual({
    pass: false,
    failed: ["minimum-connected-mass"]
  });

  expect(metrics.classifyTakramV3MorphologyImageMetrics({
    cloudPixelFraction: 0.2,
    connectedComponentCount: 20,
    largestConnectedAreaFraction: 0.99,
    singlePixelFragmentFraction: 0.1,
    smallFragmentFraction: 0.2,
    edgeDensity: 0.9,
    clearAirLeakage: 0.2,
    firstFrameConvergedLumaDelta: 0.2,
    internalLumaStdDev: 0,
    multiScaleLumaVariation: 0,
    gradientEnergy: 0,
    localPeakDensity: 0
  })).toEqual({
    pass: false,
    failed: [
      "single-pixel-fragments",
      "small-fragments",
      "edge-density",
      "clear-air-leakage",
      "temporal-luma-delta"
    ]
  });
});

test("keeps connected-area diagnostic while measuring internal billow structure", async () => {
  const metrics = await import(metricsModulePath);
  const width = 16;
  const height = 16;
  const off = createFrame(width, height);
  const uniform = createFrame(width, height);
  const textured = createFrame(width, height);
  for (let y = 2; y < 14; y += 1) {
    for (let x = 2; x < 14; x += 1) {
      setPixel(uniform, width, x, y, 180);
      setPixel(textured, width, x, y, (x + y) % 4 === 0 ? 240 : 120);
    }
  }
  const analyze = (cloudRaw: Uint8Array) => metrics.analyzeTakramV3MorphologyImageMetrics({
    width,
    height,
    cloudRaw,
    cloudRawOff: off,
    cloudOff: off,
    firstFrame: cloudRaw,
    convergedFull: cloudRaw
  });
  const uniformMetrics = analyze(uniform);
  const texturedMetrics = analyze(textured);
  expect(uniformMetrics.largestConnectedAreaFraction).toBe(1);
  expect(texturedMetrics.largestConnectedAreaFraction).toBe(1);
  expect(texturedMetrics.internalLumaStdDev).toBeGreaterThan(uniformMetrics.internalLumaStdDev);
  expect(texturedMetrics.multiScaleLumaVariation)
    .toBeGreaterThan(uniformMetrics.multiScaleLumaVariation);
  expect(texturedMetrics.gradientEnergy).toBeGreaterThan(uniformMetrics.gradientEnergy);
  expect(texturedMetrics.localPeakDensity).toBeGreaterThan(uniformMetrics.localPeakDensity);
  expect(metrics.classifyTakramV3MorphologyImageMetrics(texturedMetrics).failed)
    .not.toContain("largest-connected-area");
});

test("isolates opening stages inside the cloud-only mask", async () => {
  const metrics = await import(metricsModulePath);
  const width = 6;
  const height = 4;
  const cloudRawOff = createFrame(width, height);
  const cloudRaw = createFrame(width, height);
  const aerialFinal = createFrame(width, height);
  const full = createFrame(width, height);
  const bsmOff = createFrame(width, height);
  for (const frame of [cloudRawOff, cloudRaw, aerialFinal, full, bsmOff]) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(frame, width, x, y, 32);
      }
    }
  }
  const cloudPixels = [{ x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }];
  for (const pixel of cloudPixels) {
    setPixel(cloudRaw, width, pixel.x, 2, 200);
    setPixel(full, width, pixel.x, 2, 140);
    setPixel(bsmOff, width, pixel.x, 2, 170);
  }

  const result = metrics.analyzeTakramV3OpeningStageIsolation({
    width,
    height,
    cloudRaw,
    cloudRawOff,
    full,
    aerialFinal,
    bsmOff
  });
  expect(Array.from(result.cloudMask).reduce((sum, value) => sum + value, 0)).toBe(4);
  expect(result.metrics.cloudPixelFraction).toBeCloseTo(4 / 24, 12);
  expect(result.metrics.rawCloudSignal.changedPixelFraction).toBe(1);
  expect(result.metrics.finalCloudSignal.changedPixelFraction).toBe(1);
  expect(result.metrics.bsmDifference.changedPixelFraction).toBe(1);
  expect(result.metrics.fragmentation.connectedComponentCount).toBe(1);
  expect(result.metrics.fragmentation.smallFragmentFraction).toBe(0);
  const outsideOnlyDifference = full.slice();
  setPixel(outsideOnlyDifference, width, 0, 0, 255);
  expect(metrics.analyzeTakramV3MaskedFrameDifference({
    width,
    height,
    mask: result.cloudMask,
    left: full,
    right: outsideOnlyDifference
  })).toMatchObject({
    changedPixelFraction: 0,
    normalizedMae: 0
  });
});

test("decodes native cloud-target sample counts only where the full-resolution cloud mask is present", async () => {
  const metrics = await import(metricsModulePath);
  const cloudMask = new Uint8Array([
    1, 1, 0, 0,
    1, 1, 0, 0
  ]);
  const readbackValues = new Float32Array([
    20 / 500, 2 / 5, 1 / 5,
    10 / 500, 1 / 5, 1 / 5
  ]);

  const result = metrics.analyzeTakramV3NativeSampleCountReadback({
    cloudMask,
    cloudMaskWidth: 4,
    cloudMaskHeight: 2,
    readback: {
      width: 2,
      height: 1,
      precision: "half-float",
      source: "native-cloud-current-render-target-v1",
      encoding: "linear-rgb-primary-over-500-shape-over-5-detail-over-5",
      values: readbackValues
    }
  });

  expect(result).toMatchObject({
    maskMapping: "full-resolution-cloud-mask-cell-coverage-v1",
    minimumMaskCoverage: 0.25,
    maskedNativePixelCount: 1,
    invariantViolationCount: 0,
    invariantPass: true,
    primary: { min: 20, mean: 20, p50: 20, p95: 20, max: 20 },
    shape: { min: 2, mean: 2, p50: 2, p95: 2, max: 2 },
    detail: { min: 1, mean: 1, p50: 1, p95: 1, max: 1 }
  });
});
