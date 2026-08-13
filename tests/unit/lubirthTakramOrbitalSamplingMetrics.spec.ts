import { expect, test } from "@playwright/test";

const modulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics";

const primaryMetadata = {
  channels: 4 as const,
  encoding: "rgba16f-loop-entry-cap-hit-direct" as const,
  height: 1,
  maxIterationCount: 500 as const,
  origin: "bottom-left" as const,
  precision: "half-float" as const,
  source: "native-cloud-current-render-target-primary-march-v1" as const,
  width: 3
};
const sampleMetadata = {
  channels: 4 as const,
  encoding: "linear-rgba-primary-over-500-shape-over-5-detail-over-5-hit-mask" as const,
  height: 1,
  maxIterationCount: 500 as const,
  origin: "bottom-left" as const,
  precision: "half-float" as const,
  source: "native-cloud-current-render-target-v1" as const,
  width: 3
};

test("audits direct primary-march structural invariants and cap metrics", async () => {
  const {
    analyzeTakramPrimaryMarchReadback,
    auditTakramPrimaryMarchReadback
  } = await import(modulePath);
  const allZero = { ...primaryMetadata, values: new Float32Array(12) };
  expect(auditTakramPrimaryMarchReadback(allZero)).toEqual({
    valid: true,
    reasons: []
  });
  expect(analyzeTakramPrimaryMarchReadback(allZero)).toMatchObject({
    enteredPrimaryMarchPixelCount: 0,
    primaryCapSaturationFraction: 0,
    noHitPrimaryCapSaturationFraction: 0,
    capReachedPixelCount: 0,
    noHitCapReachedPixelCount: 0,
    hitPixelCount: 0
  });

  const metrics = analyzeTakramPrimaryMarchReadback({
    ...primaryMetadata,
    values: new Float32Array([
      500, 1, 1, 0,
      12, 1, 0, 1,
      0, 0, 0, 0
    ])
  });
  expect(metrics).toMatchObject({
    enteredPrimaryMarchPixelCount: 2,
    capReachedPixelCount: 1,
    noHitCapReachedPixelCount: 1,
    hitPixelCount: 1,
    primaryCapSaturationFraction: 0.5,
    noHitPrimaryCapSaturationFraction: 0.5,
    loopIterationCount: { min: 12, max: 500, mean: 256 }
  });

  const invalidValues = [
    [1.5, 1, 0, 0],
    [1, 0.5, 0, 0],
    [0, 0, 1, 0],
    [0, 1, 0, 0],
    [499, 1, 1, 0],
    [1, 0, 0, 1],
    [Number.NaN, 0, 0, 0]
  ];
  for (const values of invalidValues) {
    expect(auditTakramPrimaryMarchReadback({
      ...primaryMetadata,
      width: 1,
      values
    }).valid).toBe(false);
  }
});

test("audits sample counts without clamping invalid decoded values", async () => {
  const { auditTakramSampleCountReadback } = await import(modulePath);
  expect(auditTakramSampleCountReadback({
    ...sampleMetadata,
    values: new Float32Array([
      12 / 500, 2 / 5, 1 / 5, 1,
      0, 0, 0, 0,
      1, 1, 1, 1
    ])
  })).toEqual({ valid: true, reasons: [] });

  const invalid = [
    [-0.001, 0, 0, 0],
    [1.001, 0, 0, 0],
    [1 / 500, 2 / 5, 0, 1],
    [2 / 500, 1 / 5, 2 / 5, 1],
    [0, 0, 0, 1],
    [0, 0, 0, Number.NaN]
  ];
  for (const values of invalid) {
    expect(auditTakramSampleCountReadback({
      ...sampleMetadata,
      width: 1,
      values
    }).valid).toBe(false);
  }
});

test("builds RGB-only strict-byte cloud masks and four-neighbour fragments", async () => {
  const {
    analyzeTakramOrbitalCloudMask,
    buildTakramOrbitalCloudMask
  } = await import(modulePath);
  const width = 4;
  const height = 2;
  const off = new Uint8Array(width * height * 4);
  const raw = off.slice();
  const set = (index: number, red: number, alpha = 0) => {
    raw[index * 4] = red;
    raw[index * 4 + 3] = alpha;
  };
  set(0, 8, 255);
  set(1, 9);
  set(2, 9);
  set(5, 9);
  set(7, 0, 255);
  const mask = buildTakramOrbitalCloudMask({
    width,
    height,
    cloudRaw: raw,
    cloudRawOff: off
  });
  expect(Array.from(mask)).toEqual([0, 1, 1, 0, 0, 1, 0, 0]);
  expect(analyzeTakramOrbitalCloudMask({ mask, width, height })).toEqual({
    cloudPixelCount: 3,
    cloudPixelFraction: 3 / 8,
    connectedComponentCount: 1,
    largestConnectedAreaFraction: 1,
    singlePixelFragmentFraction: 0,
    smallFragmentFraction: 1
  });
});

test("applies every Stage 1 threshold at the exact boundary", async () => {
  const { resolveTakramOrbitalSamplingProgressDecision } = await import(
    modulePath
  );
  const baseline = {
    evidenceValid: true,
    setupInvalidReasons: [] as string[],
    nativeHitPixelFraction: 0.2,
    preTemporalSignalPixelFraction: 0.2,
    smallFragmentFraction: 0.1,
    signalRetention: 0.9,
    signalLumaRetention: 1.2,
    pairedChange: 0.0100001,
    repeatNoiseFloor: 0.01,
    enteredPrimaryMarchPixelCount: 1,
    primaryCapSaturationFraction: 0.01,
    noHitPrimaryCapSaturationFraction: 0.01
  };
  expect(resolveTakramOrbitalSamplingProgressDecision(baseline)).toEqual({
    evidenceValid: true,
    samplingHealthy: true,
    setupInvalidReasons: [],
    samplingFailureReasons: []
  });

  const failures = [
    ["nativeHitPixelFraction", 0.1999],
    ["preTemporalSignalPixelFraction", 0.1999],
    ["smallFragmentFraction", 0.1001],
    ["signalRetention", 0.8999],
    ["signalRetention", 1.1001],
    ["signalLumaRetention", 0.7999],
    ["signalLumaRetention", 1.2001],
    ["pairedChange", 0.01],
    ["enteredPrimaryMarchPixelCount", 0],
    ["primaryCapSaturationFraction", 0.0101]
  ] as const;
  for (const [field, value] of failures) {
    expect(resolveTakramOrbitalSamplingProgressDecision({
      ...baseline,
      [field]: value
    }).samplingHealthy).toBe(false);
  }
  expect(resolveTakramOrbitalSamplingProgressDecision({
    ...baseline,
    noHitPrimaryCapSaturationFraction: 1
  }).samplingHealthy).toBe(true);
});

test("derives progress metrics from raw buffers and direct primary cap state", async () => {
  const { analyzeTakramOrbitalSamplingProgress } = await import(modulePath);
  const raw = new Uint8Array(40);
  const off = new Uint8Array(40);
  for (let pixel = 0; pixel < 3; pixel += 1) raw[pixel * 4] = 9;
  const result = analyzeTakramOrbitalSamplingProgress({
    cloudRaw: { channels: 4, height: 1, origin: "top-left", values: raw, width: 10 },
    cloudRawOff: { channels: 4, height: 1, origin: "top-left", values: off, width: 10 },
    pairedChange: 0.02,
    repeatNoiseFloor: 0.01,
    primaryMarch: {
      ...primaryMetadata,
      values: new Float32Array([
        500, 1, 1, 0,
        20, 1, 0, 1,
        10, 1, 0, 1
      ])
    },
    sampleCount: {
      ...sampleMetadata,
      values: new Float32Array([
        10 / 500, 1 / 5, 0, 1,
        8 / 500, 1 / 5, 0, 1,
        0, 0, 0, 0
      ])
    },
    preTemporal: {
      channels: 4,
      height: 1,
      origin: "bottom-left",
      precision: "float32",
      values: new Float32Array([
        0.2, 0.2, 0.2, 0.5,
        0.4, 0.4, 0.4, 0.5,
        0, 0, 0, 0
      ]),
      width: 3
    },
    resolvedHistory: {
      channels: 4,
      height: 1,
      origin: "bottom-left",
      precision: "float32",
      values: new Float32Array([
        0.2, 0.2, 0.2, 0.5,
        0.4, 0.4, 0.4, 0.5,
        0, 0, 0, 0
      ]),
      width: 3
    }
  });
  expect(result).toMatchObject({
    evidenceValid: true,
    nativeHitPixelFraction: 2 / 3,
    preTemporalSignalPixelFraction: 2 / 3,
    signalRetention: 1,
    signalLumaRetention: 1,
    enteredPrimaryMarchPixelCount: 3,
    primaryCapSaturationFraction: 1 / 3,
    noHitPrimaryCapSaturationFraction: 1 / 3
  });
});
