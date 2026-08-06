import { expect, test } from "@playwright/test";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

interface PlanetaryCloudMathModule {
  buildLuBirthWorldToEcef(
    earthMatrixWorld: Matrix4,
    compositionRadius: number
  ): {
    valid: boolean;
    worldToEcef: Matrix4 | null;
    reason?: "invalid-composition-radius" | "non-uniform-scale" | "negative-determinant" | "singular-scale";
  };
  raySphereIntervalGeneral(
    originEcef: Vector3,
    directionEcefPerWorldUnit: Vector3,
    radiusEcef: number
  ): { near: number; far: number } | null;
  resolveCloudShellWorldSegment(
    outerInterval: { near: number; far: number } | null,
    innerInterval: { near: number; far: number } | null
  ): { enter: number; exit: number } | null;
  resolveForwardCloudShellLightDistance(
    originEcef: Vector3,
    directionEcefPerWorldUnit: Vector3,
    cloudBaseRadiusEcef: number,
    outerRadiusEcef: number
  ): number;
  transformWorldRayToEcefParameterization(
    originWorld: Vector3,
    directionWorld: Vector3,
    worldToEcef: Matrix4
  ): { originEcef: Vector3; directionEcefPerWorldUnit: Vector3 };
  resolveSceneWorldDistance(
    rayOriginWorld: Vector3,
    rayDirectionWorld: Vector3,
    scenePositionWorld: Vector3 | null
  ): number;
}

interface CloudShellMicrobenchContractModule {
  CLOUD_SHELL_MICROBENCH_CASES: Record<string, {
    primarySteps: number;
    lightSteps: number;
    groundSteps: number;
  }>;
  beginCloudShellMicrobenchWarmupAfterReadyFrame(input: {
    frameId: number;
    measurement: {
      coordinatePass: boolean;
      gammaColorPass: boolean;
      hdrColorPass: boolean;
      measure: boolean;
      pageVisible: boolean;
      timerSupported: boolean;
      visualGateConfirmed: boolean;
      weatherReady: boolean;
    };
    window: {
      measurementReadyFrame: number | null;
      samplingStartFrame: number | null;
      warmupStartFrame: number | null;
    };
  }): {
    measurementReadyFrame: number | null;
    samplingStartFrame: number | null;
    warmupStartFrame: number | null;
  };
  resetCloudShellMicrobenchMeasurementWindow(): {
    measurementReadyFrame: number | null;
    samplingStartFrame: number | null;
    warmupStartFrame: number | null;
  };
  shouldMeasureCloudShellMicrobenchFrame(input: {
    frameId: number;
    measurement: {
      coordinatePass: boolean;
      gammaColorPass: boolean;
      hdrColorPass: boolean;
      measure: boolean;
      pageVisible: boolean;
      timerSupported: boolean;
      visualGateConfirmed: boolean;
      weatherReady: boolean;
    };
    validGpuSampleCount: number;
    window: {
      measurementReadyFrame: number | null;
      samplingStartFrame: number | null;
      warmupStartFrame: number | null;
    };
  }): boolean;
  resolveCloudShellMicrobenchCheckpoint(input: {
    coordinatePass: boolean;
    hdrColorPass: boolean;
    microVisualPass: boolean;
    timerSupported: boolean;
    visualPassingCaseP95Ms: Array<{ caseId: string; p95Ms: number }>;
  }): "EARLY_KILL" | "EARLY_REPRESENTATION_FAIL" | "MICROBENCH_OVER_BUDGET" | "MICROBENCH_VIABLE";
}

interface CloudShellMicrobenchShaderModule {
  createCloudShellRaymarchFragmentShader(input: {
    primarySteps: number;
    lightSteps: number;
  }): string;
}

interface CloudShellMicrobenchProfilerInstance {
  begin(
    frameId: number,
    stage: "densityAndLightRaymarch" | "resolve" | "cloudComposite"
  ): boolean;
  dispose(): void;
  end(): void;
  poll(): Array<{
    frameId: number;
    densityAndLightRaymarchMs: number;
    resolveMs: number;
    cloudCompositeMs: number;
    disjoint: boolean;
  }>;
  resetMeasurementWindow(): boolean;
  supported: boolean;
}

interface CloudShellMicrobenchProfilerModule {
  CloudShellMicrobenchProfiler: new (
    gl: WebGL2RenderingContext
  ) => CloudShellMicrobenchProfilerInstance;
  summarizeCloudShellGpuFrames(frames: Array<{
    frameId: number;
    densityAndLightRaymarchMs: number;
    resolveMs: number;
    cloudCompositeMs: number;
    disjoint: boolean;
  }>): {
    invalidFrameCount: number;
    p50Ms?: number;
    p95Ms?: number;
    sampleCount: number;
    stages: {
      cloudComposite: { p50Ms?: number; p95Ms?: number };
      densityAndLightRaymarch: { p50Ms?: number; p95Ms?: number };
      resolve: { p50Ms?: number; p95Ms?: number };
    };
  };
}

const mathModulePath = "../../packages/lubirth-hero/src/planetaryCloud/planetaryCloudMath";
const contractModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchContract";
const shaderModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchShader";
const profilerModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/microbench/CloudShellMicrobenchProfiler";

async function loadPlanetaryCloudMath(): Promise<PlanetaryCloudMathModule | null> {
  try {
    return await import(mathModulePath) as PlanetaryCloudMathModule;
  } catch {
    return null;
  }
}

async function loadCloudShellMicrobenchContract(): Promise<CloudShellMicrobenchContractModule | null> {
  try {
    return await import(contractModulePath) as CloudShellMicrobenchContractModule;
  } catch {
    return null;
  }
}

async function loadCloudShellMicrobenchShader(): Promise<CloudShellMicrobenchShaderModule | null> {
  try {
    return await import(shaderModulePath) as CloudShellMicrobenchShaderModule;
  } catch {
    return null;
  }
}

async function loadCloudShellMicrobenchProfiler(): Promise<CloudShellMicrobenchProfilerModule | null> {
  try {
    return await import(profilerModulePath) as CloudShellMicrobenchProfilerModule;
  } catch {
    return null;
  }
}

function createDisjointTimerQueryMock(disjointResults: boolean[]) {
  const extension = {
    GPU_DISJOINT_EXT: 0x8fbb,
    TIME_ELAPSED_EXT: 0x88bf
  };
  let disjointReadCount = 0;
  let nextQueryId = 1;
  let queryResultReadCount = 0;
  const gl = {
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    beginQuery: () => undefined,
    createQuery: () => ({ id: nextQueryId++ }),
    deleteQuery: () => undefined,
    endQuery: () => undefined,
    getExtension: (name: string) => name === "EXT_disjoint_timer_query_webgl2" ? extension : null,
    getParameter: (parameter: number) => {
      expect(parameter).toBe(extension.GPU_DISJOINT_EXT);
      disjointReadCount += 1;
      return disjointResults.shift() ?? false;
    },
    getQueryParameter: (_query: unknown, parameter: number) => {
      if (parameter === 0x8867) {
        return true;
      }
      expect(parameter).toBe(0x8866);
      queryResultReadCount += 1;
      return 1_000_000;
    }
  };

  return {
    disjointReadCount: () => disjointReadCount,
    gl: gl as unknown as WebGL2RenderingContext,
    queryResultReadCount: () => queryResultReadCount
  };
}

function enqueueMockCloudShellFrame(
  profiler: CloudShellMicrobenchProfilerInstance,
  frameId: number
) {
  for (const stage of ["densityAndLightRaymarch", "resolve", "cloudComposite"] as const) {
    expect(profiler.begin(frameId, stage)).toBe(true);
    profiler.end();
  }
}

function expectVector3CloseTo(received: Vector3, expected: Vector3, precision = 5) {
  expect(received.x).toBeCloseTo(expected.x, precision);
  expect(received.y).toBeCloseTo(expected.y, precision);
  expect(received.z).toBeCloseTo(expected.z, precision);
}

function intersectWorldSphere(
  origin: Vector3,
  direction: Vector3,
  center: Vector3,
  radius: number
) {
  const relativeOrigin = origin.clone().sub(center);
  const halfB = relativeOrigin.dot(direction);
  const c = relativeOrigin.lengthSq() - radius * radius;
  const discriminant = halfB * halfB - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  return { near: -halfB - root, far: -halfB + root };
}

test("raySphereIntervalGeneral preserves world-distance t for a non-unit ECEF ray", async () => {
  const math = await loadPlanetaryCloudMath();

  expect(math).not.toBeNull();
  const interval = math!.raySphereIntervalGeneral(
    new Vector3(0, 0, -6),
    new Vector3(0, 0, 2),
    4
  );

  expect(interval).toEqual({ near: 1, far: 5 });
});

test("forward cloud-shell light distance reaches the real radial, oblique, and tangent exits", async () => {
  const math = await loadPlanetaryCloudMath();

  expect(typeof math?.resolveForwardCloudShellLightDistance).toBe("function");
  const origin = new Vector3(11, 0, 0);
  const radialOut = math!.resolveForwardCloudShellLightDistance(
    origin,
    new Vector3(1, 0, 0),
    10,
    20
  );
  const obliqueIntoCloudBase = math!.resolveForwardCloudShellLightDistance(
    origin,
    new Vector3(-1, 1, 0).normalize(),
    10,
    20
  );
  const tangent = math!.resolveForwardCloudShellLightDistance(
    origin,
    new Vector3(0, 1, 0),
    10,
    20
  );

  expect(radialOut).toBeCloseTo(9, 6);
  expect(obliqueIntoCloudBase).toBeCloseTo(11 / Math.sqrt(2) - Math.sqrt(79 / 2), 6);
  expect(tangent).toBeCloseTo(Math.sqrt(279), 6);
});

test("cloud-shell segment advances its entry after exiting the inner sphere", async () => {
  const math = await loadPlanetaryCloudMath();

  expect(typeof math?.resolveCloudShellWorldSegment).toBe("function");
  expect(math!.resolveCloudShellWorldSegment(
    { near: -8, far: 12 },
    { near: -4, far: 3 }
  )).toEqual({ enter: 3, exit: 12 });
});

test("buildLuBirthWorldToEcef holds a translated, rotated, uniformly scaled Earth at the ECEF radius", async () => {
  const math = await loadPlanetaryCloudMath();

  expect(typeof math?.buildLuBirthWorldToEcef).toBe("function");
  const compositionRadius = 2.4;
  const earthMatrixWorld = new Matrix4().compose(
    new Vector3(2.5, -1.25, 0.75),
    new Quaternion().setFromEuler(new Euler(-18 * Math.PI / 180, 37 * Math.PI / 180, 0, "YXZ")),
    new Vector3(1.75, 1.75, 1.75)
  );
  const bridge = math!.buildLuBirthWorldToEcef(earthMatrixWorld, compositionRadius);

  expect(bridge.valid).toBe(true);
  expect(bridge.worldToEcef).not.toBeNull();
  expect(bridge.worldToEcefScale).toBeCloseTo(6_360_000 / compositionRadius, 8);
  expect(bridge.worldToEcefDistanceScale).toBeCloseTo(
    6_360_000 / (compositionRadius * 1.75),
    8
  );

  const worldToEcef = bridge.worldToEcef!;
  const origin = new Vector3(0, 0, 0).applyMatrix4(earthMatrixWorld).applyMatrix4(worldToEcef);
  const east = new Vector3(compositionRadius, 0, 0)
    .applyMatrix4(earthMatrixWorld)
    .applyMatrix4(worldToEcef);
  const north = new Vector3(0, compositionRadius, 0)
    .applyMatrix4(earthMatrixWorld)
    .applyMatrix4(worldToEcef);
  const forward = new Vector3(0, 0, compositionRadius)
    .applyMatrix4(earthMatrixWorld)
    .applyMatrix4(worldToEcef);

  expect(origin.length()).toBeCloseTo(0, 5);
  expectVector3CloseTo(east, new Vector3(6_360_000, 0, 0));
  expectVector3CloseTo(north, new Vector3(0, 0, 6_360_000));
  expectVector3CloseTo(forward, new Vector3(0, -6_360_000, 0));
});

test("world-to-ECEF ray parameterization keeps the non-unit linear direction and scene distance", async () => {
  const math = await loadPlanetaryCloudMath();

  expect(typeof math?.transformWorldRayToEcefParameterization).toBe("function");
  const ray = math!.transformWorldRayToEcefParameterization(
    new Vector3(1, 2, 3),
    new Vector3(0, 0, -1),
    new Matrix4().makeScale(5, 5, 5)
  );

  expectVector3CloseTo(ray.originEcef, new Vector3(5, 10, 15));
  expectVector3CloseTo(ray.directionEcefPerWorldUnit, new Vector3(0, 0, -5));
  expect(ray.directionEcefPerWorldUnit.length()).toBe(5);
  expect(math!.resolveSceneWorldDistance(
    new Vector3(1, 2, 3),
    new Vector3(0, 0, -1),
    new Vector3(1, 2, -4)
  )).toBe(7);
  expect(math!.resolveSceneWorldDistance(
    new Vector3(1, 2, 3),
    new Vector3(0, 0, -1),
    null
  )).toBe(Infinity);
});

test("bridge intervals match the direct world-sphere oracle for identity, enlarged, and reduced Earth transforms", async () => {
  const math = await loadPlanetaryCloudMath();
  expect(math).not.toBeNull();

  const cases = [
    {
      name: "identity",
      matrix: new Matrix4().identity(),
      uniformScale: 1
    },
    {
      name: "enlarged",
      matrix: new Matrix4().compose(
        new Vector3(2.5, -1.25, 0.75),
        new Quaternion().setFromEuler(new Euler(-18 * Math.PI / 180, 37 * Math.PI / 180, 0, "YXZ")),
        new Vector3(1.75, 1.75, 1.75)
      ),
      uniformScale: 1.75
    },
    {
      name: "reduced",
      matrix: new Matrix4().compose(
        new Vector3(-3, 0.4, 2),
        new Quaternion().setFromAxisAngle(new Vector3(0.38, 0.77, 0.51).normalize(), 0.55),
        new Vector3(0.6, 0.6, 0.6)
      ),
      uniformScale: 0.6
    }
  ];

  for (const testCase of cases) {
    const bridge = math!.buildLuBirthWorldToEcef(testCase.matrix, 1);
    expect(bridge.valid, testCase.name).toBe(true);
    const center = new Vector3().setFromMatrixPosition(testCase.matrix);
    const origin = center.clone().add(new Vector3(3.2, 2.1, 9.4));
    const direction = center.clone().sub(origin).normalize();
    const ray = math!.transformWorldRayToEcefParameterization(origin, direction, bridge.worldToEcef!);
    const ecefInterval = math!.raySphereIntervalGeneral(ray.originEcef, ray.directionEcefPerWorldUnit, 6_420_000);
    const worldInterval = intersectWorldSphere(
      origin,
      direction,
      center,
      testCase.uniformScale * (6_420_000 / 6_360_000)
    );

    expect(ecefInterval, testCase.name).not.toBeNull();
    expect(worldInterval, testCase.name).not.toBeNull();
    expect(ecefInterval!.near, testCase.name).toBeCloseTo(worldInterval!.near, 6);
    expect(ecefInterval!.far, testCase.name).toBeCloseTo(worldInterval!.far, 6);
  }
});

test("translated and rotated occluder retains its known world-depth clamp parameter", async () => {
  const math = await loadPlanetaryCloudMath();
  expect(math).not.toBeNull();

  const earth = new Matrix4().compose(
    new Vector3(1.2, 0.3, -2.8),
    new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 61 * Math.PI / 180),
    new Vector3(1.4, 1.4, 1.4)
  );
  const camera = new Vector3(-5.1, 3.4, 10.2);
  const rayDirection = new Vector3().setFromMatrixPosition(earth).sub(camera).normalize();
  const knownWorldDistance = 5.25;
  const occluderPoint = camera.clone().addScaledVector(rayDirection, knownWorldDistance);

  expect(math!.resolveSceneWorldDistance(camera, rayDirection, occluderPoint)).toBeCloseTo(
    knownWorldDistance,
    6
  );
});

test("buildLuBirthWorldToEcef rejects non-uniform, negative, and singular Earth transforms deterministically", async () => {
  const math = await loadPlanetaryCloudMath();

  expect(typeof math?.buildLuBirthWorldToEcef).toBe("function");
  const nonUniform = math!.buildLuBirthWorldToEcef(
    new Matrix4().makeScale(1, 1.01, 1),
    1
  );
  const negative = math!.buildLuBirthWorldToEcef(
    new Matrix4().makeScale(-1, -1, -1),
    1
  );
  const singular = math!.buildLuBirthWorldToEcef(
    new Matrix4().makeScale(1, 0, 1),
    1
  );

  expect(nonUniform).toMatchObject({
    valid: false,
    worldToEcef: null,
    worldToEcefScale: null,
    worldToEcefDistanceScale: null,
    reason: "non-uniform-scale"
  });
  expect(negative).toMatchObject({
    valid: false,
    worldToEcef: null,
    worldToEcefScale: null,
    worldToEcefDistanceScale: null,
    reason: "negative-determinant"
  });
  expect(singular).toMatchObject({
    valid: false,
    worldToEcef: null,
    worldToEcefScale: null,
    worldToEcefDistanceScale: null,
    reason: "singular-scale"
  });
});

test("cloud-shell microbenchmark freezes the three approved step cases and early-cost gate", async () => {
  const contract = await loadCloudShellMicrobenchContract();

  expect(contract).not.toBeNull();
  expect(contract!.CLOUD_SHELL_MICROBENCH_CASES).toEqual({
    "24/6": { primarySteps: 24, lightSteps: 6, groundSteps: 0 },
    "32/2": { primarySteps: 32, lightSteps: 2, groundSteps: 0 },
    "48/6": { primarySteps: 48, lightSteps: 6, groundSteps: 0 }
  });
  expect(contract!.resolveCloudShellMicrobenchCheckpoint({
    coordinatePass: true,
    hdrColorPass: true,
    microVisualPass: true,
    timerSupported: true,
    visualPassingCaseP95Ms: [
      { caseId: "24/6", p95Ms: 4.3 },
      { caseId: "32/2", p95Ms: 3.8 }
    ]
  })).toBe("MICROBENCH_VIABLE");
  expect(contract!.resolveCloudShellMicrobenchCheckpoint({
    coordinatePass: true,
    hdrColorPass: true,
    microVisualPass: false,
    timerSupported: true,
    visualPassingCaseP95Ms: []
  })).toBe("EARLY_REPRESENTATION_FAIL");
});

test("cloud-shell measurement starts only after the ready frame and fills 120 valid samples", async () => {
  const contract = await loadCloudShellMicrobenchContract();
  const profiler = await loadCloudShellMicrobenchProfiler();

  expect(typeof contract?.beginCloudShellMicrobenchWarmupAfterReadyFrame).toBe("function");
  expect(typeof contract?.shouldMeasureCloudShellMicrobenchFrame).toBe("function");
  const measurement = {
    coordinatePass: true,
    gammaColorPass: true,
    hdrColorPass: true,
    measure: true,
    pageVisible: true,
    timerSupported: true,
    visualGateConfirmed: true,
    weatherReady: false
  };
  const emptyWindow = {
    measurementReadyFrame: null,
    samplingStartFrame: null,
    warmupStartFrame: null
  };
  expect(contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 120,
    measurement,
    window: emptyWindow
  })).toEqual(emptyWindow);

  const readyWindow = contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 193,
    measurement: { ...measurement, weatherReady: true },
    window: emptyWindow
  });
  expect(readyWindow).toEqual({
    measurementReadyFrame: 193,
    warmupStartFrame: 194,
    samplingStartFrame: 314
  });
  expect(contract!.shouldMeasureCloudShellMicrobenchFrame({
    frameId: 313,
    measurement: { ...measurement, weatherReady: true },
    validGpuSampleCount: 0,
    window: readyWindow
  })).toBe(false);

  const oneHundredNineteenValidPlusOneDisjoint = [
    ...Array.from({ length: 119 }, (_, index) => ({
      frameId: index + 1,
      densityAndLightRaymarchMs: 1,
      resolveMs: 1,
      cloudCompositeMs: 1,
      disjoint: false
    })),
    {
      frameId: 120,
      densityAndLightRaymarchMs: Number.NaN,
      resolveMs: Number.NaN,
      cloudCompositeMs: Number.NaN,
      disjoint: true
    }
  ];
  const summary = profiler!.summarizeCloudShellGpuFrames(oneHundredNineteenValidPlusOneDisjoint);
  expect(summary).toMatchObject({ sampleCount: 119, invalidFrameCount: 1 });
  expect(contract!.shouldMeasureCloudShellMicrobenchFrame({
    frameId: 314,
    measurement: { ...measurement, weatherReady: true },
    validGpuSampleCount: summary.sampleCount,
    window: readyWindow
  })).toBe(true);
  expect(contract!.shouldMeasureCloudShellMicrobenchFrame({
    frameId: 314,
    measurement: { ...measurement, weatherReady: true },
    validGpuSampleCount: 120,
    window: readyWindow
  })).toBe(false);
});

test("cloud-shell profiler invalidates every pending frame in one disjoint polling epoch", async () => {
  const profilerModule = await loadCloudShellMicrobenchProfiler();

  expect(typeof profilerModule?.CloudShellMicrobenchProfiler).toBe("function");
  const timerQuery = createDisjointTimerQueryMock([false, true, false]);
  const profiler = new profilerModule!.CloudShellMicrobenchProfiler(timerQuery.gl);
  expect(profiler.resetMeasurementWindow()).toBe(true);

  enqueueMockCloudShellFrame(profiler, 314);
  enqueueMockCloudShellFrame(profiler, 315);
  const invalidated = profiler.poll();
  expect(invalidated).toEqual([
    {
      frameId: 314,
      densityAndLightRaymarchMs: Number.NaN,
      resolveMs: Number.NaN,
      cloudCompositeMs: Number.NaN,
      disjoint: true
    },
    {
      frameId: 315,
      densityAndLightRaymarchMs: Number.NaN,
      resolveMs: Number.NaN,
      cloudCompositeMs: Number.NaN,
      disjoint: true
    }
  ]);
  expect(timerQuery.queryResultReadCount()).toBe(0);
  expect(timerQuery.disjointReadCount()).toBe(2);
  expect(profilerModule!.summarizeCloudShellGpuFrames(invalidated)).toMatchObject({
    invalidFrameCount: 2,
    sampleCount: 0
  });

  enqueueMockCloudShellFrame(profiler, 316);
  const recovered = profiler.poll();
  expect(recovered).toEqual([
    {
      frameId: 316,
      densityAndLightRaymarchMs: 1,
      resolveMs: 1,
      cloudCompositeMs: 1,
      disjoint: false
    }
  ]);
  expect(timerQuery.disjointReadCount()).toBe(3);
  expect(profilerModule!.summarizeCloudShellGpuFrames([...invalidated, ...recovered])).toMatchObject({
    invalidFrameCount: 2,
    sampleCount: 1
  });
  profiler.dispose();
});

test("cloud-shell measurement window restarts after a resize reset and readiness loss", async () => {
  const contract = await loadCloudShellMicrobenchContract();

  expect(typeof contract?.resetCloudShellMicrobenchMeasurementWindow).toBe("function");
  const readyMeasurement = {
    coordinatePass: true,
    gammaColorPass: true,
    hdrColorPass: true,
    measure: true,
    pageVisible: true,
    timerSupported: true,
    visualGateConfirmed: true,
    weatherReady: true
  };
  const emptyWindow = contract!.resetCloudShellMicrobenchMeasurementWindow();
  const firstWindow = contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 193,
    measurement: readyMeasurement,
    window: emptyWindow
  });
  expect(firstWindow).toEqual({
    measurementReadyFrame: 193,
    warmupStartFrame: 194,
    samplingStartFrame: 314
  });

  const resizeResetWindow = contract!.resetCloudShellMicrobenchMeasurementWindow();
  expect(resizeResetWindow).toEqual(emptyWindow);
  const resizedWindow = contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 501,
    measurement: readyMeasurement,
    window: resizeResetWindow
  });
  expect(resizedWindow).toEqual({
    measurementReadyFrame: 501,
    warmupStartFrame: 502,
    samplingStartFrame: 622
  });

  expect(contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 502,
    measurement: { ...readyMeasurement, weatherReady: false },
    window: resizedWindow
  })).toEqual(emptyWindow);
});

test("cloud-shell measurement discards a hidden window and restarts only after visibility returns", async () => {
  const contract = await loadCloudShellMicrobenchContract();

  const visibleMeasurement = {
    coordinatePass: true,
    gammaColorPass: true,
    hdrColorPass: true,
    measure: true,
    pageVisible: true,
    timerSupported: true,
    visualGateConfirmed: true,
    weatherReady: true
  };
  const emptyWindow = contract!.resetCloudShellMicrobenchMeasurementWindow();
  const activeWindow = contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 193,
    measurement: visibleMeasurement,
    window: emptyWindow
  });
  expect(contract!.shouldMeasureCloudShellMicrobenchFrame({
    frameId: 314,
    measurement: { ...visibleMeasurement, pageVisible: false },
    validGpuSampleCount: 17,
    window: activeWindow
  })).toBe(false);
  expect(contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 314,
    measurement: { ...visibleMeasurement, pageVisible: false },
    window: activeWindow
  })).toEqual(emptyWindow);

  expect(contract!.beginCloudShellMicrobenchWarmupAfterReadyFrame({
    frameId: 501,
    measurement: visibleMeasurement,
    window: emptyWindow
  })).toEqual({
    measurementReadyFrame: 501,
    warmupStartFrame: 502,
    samplingStartFrame: 622
  });
});

test("cloud-shell shader keeps the general ray parameter and world-depth clamp contract", async () => {
  const shader = await loadCloudShellMicrobenchShader();

  expect(typeof shader?.createCloudShellRaymarchFragmentShader).toBe("function");
  const source = shader!.createCloudShellRaymarchFragmentShader({ primarySteps: 24, lightSteps: 6 });

  expect(source).toContain("#define PRIMARY_STEPS 24");
  expect(source).toContain("#define LIGHT_STEPS 6");
  expect(source).toContain("float a = dot(directionEcefPerWorldUnit, directionEcefPerWorldUnit)");
  expect(source).toContain("vec3 reconstructWorldPosition");
  expect(source).toContain("float tSceneWorld =");
  expect(source).toContain("min(tCloudExitWorld, tSceneWorld)");
  expect(source).toContain("uniform bool showSceneDepthClamp");
  expect(source).toContain("float visibleFraction");
  expect(source).toContain("float sourceCoverage = weather.r");
  expect(source).toContain("float cloudTop = mix(0.30, 0.82, weather.g)");
  expect(source).toContain("float shapedCloudTop = mix(0.24, cloudTop, baseShape)");
  expect(source).toContain("float morphologyGain = mix(0.75, 1.25, weather.b)");
  expect(source).toContain("float concavityGain = mix(1.0, 0.72, weather.a)");
  expect(source).toContain("float forwardCloudShellLightDistance");
  expect(source).toContain("float baseShape3d");
  expect(source).toContain("float remapCoverageToBaseShape");
  expect(source).toContain("float coverageThreshold = mix(0.92, 0.58, clamp(weatherCoverage, 0.0, 1.0))");
  expect(source).toContain("float henyeyGreensteinPhase");
  expect(source).toContain("const float SKY_FILL");
  expect(source).toContain("float cloudBaseRadiusEcef = shellBaseRadiusEcef");
  expect(source).toContain("float lightDistanceMeters = forwardCloudShellLightDistance(positionEcef)");
  expect(source).toContain("float singleScatter = (1.0 - sampleTransmittance) * CLOUD_ALBEDO");
  expect(source).not.toContain("float stepLengthMeters = shellThicknessEcef / float(LIGHT_STEPS)");
  expect(source).toContain("vec3 directionEcefPerWorldUnit = mat3(worldToEcef) * rayDirectionWorld");
  expect(source).toContain("vec3 rayDirectionEcef = normalize(directionEcefPerWorldUnit)");
  expect(source).toContain(
    "float phase = henyeyGreensteinPhase(dot(rayDirectionEcef, sunDirectionEcef), PHASE_G)"
  );
  expect(source).not.toContain(
    "float phase = henyeyGreensteinPhase(dot(-rayDirectionEcef, sunDirectionEcef), PHASE_G)"
  );
  const cameraToSample = new Vector3(0, 0, 1);
  expect(cameraToSample.dot(new Vector3(0, 0, 1))).toBe(1);
  expect(cameraToSample.dot(new Vector3(0, 0, -1))).toBe(-1);
});

test("cloud-shell GPU summary counts every non-overlapping stage and rejects disjoint frames", async () => {
  const profiler = await loadCloudShellMicrobenchProfiler();

  expect(typeof profiler?.summarizeCloudShellGpuFrames).toBe("function");
  const summary = profiler!.summarizeCloudShellGpuFrames([
    { frameId: 1, densityAndLightRaymarchMs: 1, resolveMs: 0.5, cloudCompositeMs: 0.5, disjoint: false },
    { frameId: 2, densityAndLightRaymarchMs: 2, resolveMs: 0.5, cloudCompositeMs: 0.5, disjoint: false },
    { frameId: 3, densityAndLightRaymarchMs: 50, resolveMs: 50, cloudCompositeMs: 50, disjoint: true }
  ]);

  expect(summary).toMatchObject({
    sampleCount: 2,
    invalidFrameCount: 1,
    p50Ms: 2,
    p95Ms: 3,
    stages: {
      densityAndLightRaymarch: { p50Ms: 1, p95Ms: 2 },
      resolve: { p50Ms: 0.5, p95Ms: 0.5 },
      cloudComposite: { p50Ms: 0.5, p95Ms: 0.5 }
    }
  });
});
