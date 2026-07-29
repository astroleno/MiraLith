import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import cloudAssetBudgets from "../../packages/lubirth-hero/src/landingCloudAssetBudgets.json";
import {
  isPointInsideHybridEllipse,
  measureHybridEllipseUnionCoverage
} from "../../apps/site/components/lubirthHybridCloudMetrics";

interface TruthLevel {
  width: number;
  height: number;
  rgbaOffset: number;
  rgbaLength: number;
  minMaxOffset: number;
  minMaxLength: number;
}

interface TruthHeader {
  magic: "MLHC";
  version: 1;
  layoutId: "v3-r-depth-g-height-b-morphology-a-concavity";
  orientation: "equirect-u-repeat-v-clamp-north-up";
  width: number;
  height: number;
  levelCount: number;
  sourceSha256: string;
  generatorVersion: string;
  byteLength: number;
  levels: TruthLevel[];
}

function readTruth(relativePath: string) {
  const filePath = path.join(process.cwd(), relativePath);
  const buffer = readFileSync(filePath);
  const headerLength = buffer.readUInt32LE(0);
  const header = JSON.parse(buffer.subarray(4, 4 + headerLength).toString("utf8")) as TruthHeader;
  const payloadOffset = 4 + headerLength;
  return { buffer, filePath, header, payloadOffset };
}

async function readPng(relativePath: string) {
  const decoded = await sharp(path.join(process.cwd(), relativePath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(
      decoded.data.buffer,
      decoded.data.byteOffset,
      decoded.data.byteLength
    ),
    height: decoded.info.height,
    width: decoded.info.width
  };
}

function downsampleMean(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  targetWidth: number,
  targetHeight: number
) {
  const x0 = Math.floor((x * sourceWidth) / targetWidth);
  const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sourceWidth) / targetWidth));
  const y0 = Math.floor((y * sourceHeight) / targetHeight);
  const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sourceHeight) / targetHeight));
  const sums = [0, 0, 0, 0];
  let count = 0;
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const index = (yy * sourceWidth + xx) * 4;
      sums[0] += source[index];
      sums[1] += source[index + 1];
      sums[2] += source[index + 2];
      sums[3] += source[index + 3];
      count += 1;
    }
  }
  return sums.map((value) => Math.round(value / count));
}

function quarticClosedFormIntegral(
  local: [number, number, number],
  direction: [number, number, number],
  segment: number
) {
  const localR2 = local[0] * local[0] + local[1] * local[1] + local[2] * local[2];
  const localRayA = direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2];
  const localRayB = local[0] * direction[0] + local[1] * direction[1] + local[2] * direction[2];
  const coreRadius = Math.max(1 - localR2, 0);
  const segment2 = segment * segment;
  const segment3 = segment2 * segment;
  const segment5 = segment3 * segment2;
  return Math.max(
    coreRadius * coreRadius * segment +
      (4 * localRayB * localRayB - 2 * coreRadius * localRayA) * segment3 / 12 +
      localRayA * localRayA * segment5 / 80,
    0
  );
}

function quadraticClosedFormIntegral(
  local: [number, number, number],
  direction: [number, number, number],
  segment: number
) {
  const localR2 = local[0] * local[0] + local[1] * local[1] + local[2] * local[2];
  const localRayA = direction[0] * direction[0] + direction[1] * direction[1] +
    direction[2] * direction[2];
  const coreRadius = Math.max(1 - localR2, 0);
  return Math.max(
    coreRadius * segment - localRayA * segment * segment * segment / 12,
    0
  );
}

function quarticNumericalIntegral(
  local: [number, number, number],
  direction: [number, number, number],
  segment: number
) {
  const steps = 20_000;
  const step = segment / steps;
  let sum = 0;
  for (let index = 0; index < steps; index += 1) {
    const s = -segment * 0.5 + (index + 0.5) * step;
    const x = local[0] + direction[0] * s;
    const y = local[1] + direction[1] * s;
    const z = local[2] + direction[2] * s;
    const r = Math.max(1 - (x * x + y * y + z * z), 0);
    sum += r * r * step;
  }
  return sum;
}

function quarticDirectionalClosedFormIntegral(
  local: [number, number, number],
  direction: [number, number, number],
  from: number,
  to: number
) {
  const a = direction[0] * direction[0] + direction[1] * direction[1] +
    direction[2] * direction[2];
  const b = local[0] * direction[0] + local[1] * direction[1] +
    local[2] * direction[2];
  const c = 1 - (local[0] * local[0] + local[1] * local[1] + local[2] * local[2]);
  const primitive = (t: number) => (
    c * c * t - 2 * b * c * t * t +
    (4 * b * b - 2 * a * c) * t * t * t / 3 +
    a * b * t * t * t * t + a * a * t * t * t * t * t / 5
  );
  return Math.max(primitive(to) - primitive(from), 0);
}

function quarticDirectionalNumericalIntegral(
  local: [number, number, number],
  direction: [number, number, number],
  from: number,
  to: number
) {
  const steps = 20_000;
  const step = (to - from) / steps;
  let sum = 0;
  for (let index = 0; index < steps; index += 1) {
    const t = from + (index + 0.5) * step;
    const x = local[0] + direction[0] * t;
    const y = local[1] + direction[1] * t;
    const z = local[2] + direction[2] * t;
    const rho = Math.max(1 - (x * x + y * y + z * z), 0);
    sum += rho * rho * step;
  }
  return sum;
}

function quadraticNumericalIntegral(
  local: [number, number, number],
  direction: [number, number, number],
  segment: number
) {
  const steps = 20_000;
  const step = segment / steps;
  let sum = 0;
  for (let index = 0; index < steps; index += 1) {
    const s = -segment * 0.5 + (index + 0.5) * step;
    const x = local[0] + direction[0] * s;
    const y = local[1] + direction[1] * s;
    const z = local[2] + direction[2] * s;
    sum += Math.max(1 - (x * x + y * y + z * z), 0) * step;
  }
  return sum;
}

test("emits bounded global and native-patch CPU truth assets aligned with the V3 PNG field", async () => {
  const truth = readTruth("apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-v3-cpu-truth.bin");
  const phase12Truth = readTruth(
    "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-v3-phase12-patch-truth.bin"
  );
  const png = await readPng("apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png");
  const sourceSha256 = createHash("sha256")
    .update(readFileSync(path.join(
      process.cwd(),
      "apps/site/public/assets/lubirth/textures/earth-clouds-2k-light.jpg"
    )))
    .digest("hex");

  expect(statSync(truth.filePath).size).toBeLessThanOrEqual(cloudAssetBudgets.cloudFieldCpuTruthBin);
  expect(truth.header.byteLength).toBe(truth.buffer.byteLength);
  expect(truth.header.magic).toBe("MLHC");
  expect(truth.header.version).toBe(1);
  expect(truth.header.layoutId).toBe("v3-r-depth-g-height-b-morphology-a-concavity");
  expect(truth.header.orientation).toBe("equirect-u-repeat-v-clamp-north-up");
  expect(truth.header.width).toBe(512);
  expect(truth.header.height).toBe(256);
  expect(truth.header.sourceSha256).toBe(sourceSha256);
  expect(truth.header.levelCount).toBe(truth.header.levels.length);
  expect(phase12Truth.header.generatorVersion).toBe(
    "home-cloud-field-v3-phase12-native-patch-truth-1"
  );
  expect(phase12Truth.header.sourceResolution).toEqual([2048, 1024]);
  expect(phase12Truth.header.sourceSha256).toBe(
    createHash("sha256")
      .update(readFileSync(path.join(
        process.cwd(),
        "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png"
      )))
      .digest("hex")
  );
  expect(phase12Truth.header.sourceUvBounds).toEqual([
    370 / 512,
    105 / 256,
    405 / 512,
    138 / 256
  ]);

  let previousWidth = truth.header.width * 2;
  let previousHeight = truth.header.height * 2;
  for (const level of truth.header.levels) {
    expect(level.width).toBe(Math.max(1, Math.floor(previousWidth / 2)));
    expect(level.height).toBe(Math.max(1, Math.floor(previousHeight / 2)));
    expect(level.rgbaLength).toBe(level.width * level.height * 4);
    expect(level.minMaxLength).toBe(
      Math.max(1, Math.floor(level.width / 2)) *
        Math.max(1, Math.floor(level.height / 2)) *
        8
    );
    expect(truth.payloadOffset + level.minMaxOffset + level.minMaxLength)
      .toBeLessThanOrEqual(truth.buffer.byteLength);
    previousWidth = level.width;
    previousHeight = level.height;
  }

  const level0 = truth.header.levels[0];
  const samplePoints = [
    [0, 0],
    [1, 1],
    [127, 63],
    [255, 127],
    [384, 192],
    [511, 255]
  ];
  for (const [x, y] of samplePoints) {
    const truthIndex = truth.payloadOffset + level0.rgbaOffset + (y * level0.width + x) * 4;
    const expected = downsampleMean(png.data, png.width, png.height, x, y, level0.width, level0.height);
    expect(Array.from(truth.buffer.subarray(truthIndex, truthIndex + 4))).toEqual(expected);
  }

  const firstMinMaxIndex = truth.payloadOffset + level0.minMaxOffset;
  const firstFourTexels = [
    truth.payloadOffset + level0.rgbaOffset,
    truth.payloadOffset + level0.rgbaOffset + 4,
    truth.payloadOffset + level0.rgbaOffset + level0.width * 4,
    truth.payloadOffset + level0.rgbaOffset + (level0.width + 1) * 4
  ];
  for (let channel = 0; channel < 4; channel += 1) {
    const values = firstFourTexels.map((index) => truth.buffer[index + channel]);
    expect(truth.buffer[firstMinMaxIndex + channel]).toBe(Math.min(...values));
    expect(truth.buffer[firstMinMaxIndex + 4 + channel]).toBe(Math.max(...values));
  }
});

test("Phase -1 kill-spike is query-only and uses the real V3 CPU truth contract", () => {
  const routeSource = readFileSync(
    path.join(process.cwd(), "apps/site/app/lubirth-hybrid-cloud-kill-spike/page.tsx"),
    "utf8"
  );
  const componentSource = readFileSync(
    path.join(process.cwd(), "apps/site/components/LuBirthHybridCloudKillSpikeRoute.tsx"),
    "utf8"
  );
  const metricsSource = readFileSync(
    path.join(process.cwd(), "apps/site/components/lubirthHybridCloudMetrics.ts"),
    "utf8"
  );

  expect(routeSource).toContain("LuBirthHybridCloudKillSpikeRoute");
  expect(componentSource).toContain(
    "/assets/lubirth/textures/earth-cloud-field-nasa-lite-v3-phase12-patch-truth.bin"
  );
  expect(componentSource).toContain("EXT_disjoint_timer_query_webgl2");
  expect(componentSource).toContain("__MiraLithLuBirthHybridKillSpike");
  expect(componentSource).toContain("coordinateSpace: \"earth-local-v3\"");
  expect(componentSource).toContain("uViewProjection");
  expect(componentSource).toContain("createEarthProgram");
  expect(componentSource).toContain("createEarthSphereMesh");
  expect(componentSource).toContain("isEarthOccluded");
  expect(componentSource.indexOf("gl.depthMask(true);")).toBeLessThan(
    componentSource.indexOf("gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);")
  );
  expect(componentSource).toContain("probeRgba16fAdditive");
  expect(componentSource).toContain("candidateHashSchema: \"fnv1a-instance-buffer-v3\"");
  expect(componentSource).toContain(
    "densityProfileVersion: \"source-native-patch-height-field-v4\""
  );
  expect(componentSource).toContain("hierarchyVersion: \"base-tower-detail-v4\"");
  expect(componentSource).toContain("topologyDistanceSpace: \"earth-local-tangent-normalized-radius\"");
  expect(componentSource).toContain("parentId: parent?.id ?? null");
  expect(componentSource).toContain(
    'lobe.role === "base" && !lobe.isCarrier'
  );
  expect(componentSource).toContain("baseCarrierContainmentRatio");
  expect(componentSource).toContain("baseCarrierFootprintUnionCoverageRatio");
  expect(componentSource).toContain("isPointInsideHybridEllipse(baseEllipse.center, carrierEllipse, 0.0001)");
  expect(componentSource).toContain("measureHybridEllipseUnionCoverage(");
  expect(metricsSource).toContain("normalizedEllipseRadiusSquared");
  expect(metricsSource).toContain("gridSize = 96");
  expect(componentSource).toContain("density: average((lobe) => lobe.density)");
  expect(componentSource).not.toContain("density: 0.28");
  expect(componentSource).toContain("coverageTemporalP95Estimate: percentile(spatialP95Samples, 0.95)");
  expect(componentSource).toContain("membershipChurnTemporalP95");
  expect(componentSource).toContain("function resolveDepthBinMode()");
  expect(componentSource).toContain("uFarAccumulation");
  expect(componentSource).toContain("uNearAccumulation");
  expect(componentSource).toContain("quarticDensityIntegral");
  expect(componentSource).toContain("sunwardExit");
  expect(componentSource).toContain("camera === \"mid-oblique\"");
  expect(componentSource).toContain("depthBinMode: DepthBinMode");
  expect(componentSource).toContain("camera === \"sweep\"");
  expect(componentSource).toContain(
    "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png"
  );
  expect(componentSource).not.toContain("role: 3");
  expect(componentSource).toContain("depth: true");
  expect(componentSource).toContain("buildLobes(truth, tier)");
  expect(componentSource).toContain("candidateBudget = tier === \"mobile\" ? 320 : 1000");
  expect(componentSource).toContain("const renderScale = 0.5");
  expect(componentSource).toContain("Math.ceil(physicalWidth * renderScale)");
  expect(componentSource).toContain("Math.ceil(physicalHeight * renderScale)");
  expect(componentSource).toContain("{ height: 270, width: 480 }");
  expect(componentSource).toContain("{ height: 640, width: 960 }");
  expect(componentSource).toContain("header.sourceSha256");
  expect(componentSource).not.toContain("lubirth-hybrid-kill-spike__earth");
  expect(componentSource).not.toContain("LuBirthRevisedRoute");
  expect(componentSource).not.toContain("LandingReliefCloud");
});

test("Phase -1 carrier metrics reject anisotropic diagonal false positives and deduplicate union coverage", () => {
  const carrier = { center: [0, 0] as const, radiusEast: 4, radiusNorth: 1 };
  // A directional support-radius test would accept this point; the actual
  // normalized ellipse correctly rejects it.
  expect(isPointInsideHybridEllipse([3, 0.8], carrier)).toBe(false);
  expect(isPointInsideHybridEllipse([3, 0.4], carrier)).toBe(true);

  const base = { center: [0, 0] as const, radiusEast: 1.2, radiusNorth: 0.6 };
  const oneBaseCoverage = measureHybridEllipseUnionCoverage(carrier, [base], 96);
  const duplicatedCoverage = measureHybridEllipseUnionCoverage(carrier, [base, base], 96);
  const fullCoverage = measureHybridEllipseUnionCoverage(carrier, [carrier], 96);
  const emptyCoverage = measureHybridEllipseUnionCoverage(carrier, [{
    center: [10, 10] as const,
    radiusEast: 0.1,
    radiusNorth: 0.1
  }], 96);

  expect(oneBaseCoverage).toBeGreaterThan(0);
  expect(oneBaseCoverage).toBeLessThan(1);
  expect(duplicatedCoverage).toBeCloseTo(oneBaseCoverage, 12);
  expect(fullCoverage).toBe(1);
  expect(emptyCoverage).toBe(0);

  const rotatedCarrier = {
    center: [0, 0] as const,
    radiusEast: 4,
    radiusNorth: 1,
    rotationRadians: Math.PI / 2
  };
  const rotatedBase = {
    center: [0.2, -0.1] as const,
    radiusEast: 0.9,
    radiusNorth: 0.45,
    rotationRadians: Math.PI / 4
  };
  const rotatedOneBaseCoverage = measureHybridEllipseUnionCoverage(
    rotatedCarrier,
    [rotatedBase],
    96
  );
  const rotatedDuplicatedCoverage = measureHybridEllipseUnionCoverage(
    rotatedCarrier,
    [rotatedBase, rotatedBase],
    96
  );
  expect(measureHybridEllipseUnionCoverage(rotatedCarrier, [rotatedCarrier], 96)).toBe(1);
  expect(rotatedOneBaseCoverage).toBeGreaterThan(0);
  expect(rotatedDuplicatedCoverage).toBeCloseTo(rotatedOneBaseCoverage, 12);
});

test("Phase -1 hierarchical density integrals match numerical references", () => {
  expect(quadraticClosedFormIntegral([0, 0, 0], [1, 0, 0], 2)).toBeCloseTo(4 / 3, 8);
  expect(quarticClosedFormIntegral([0, 0, 0], [1, 0, 0], 2)).toBeCloseTo(16 / 15, 8);

  const cases: Array<[[number, number, number], [number, number, number], number]> = [
    [[0.12, -0.08, 0.18], [0.72, 0.18, -0.09], 1.42],
    [[-0.21, 0.05, -0.12], [0.22, 0.68, 0.31], 1.18],
    [[0.04, 0.26, -0.18], [-0.12, 0.27, 0.74], 1.05]
  ];
  for (const [local, direction, segment] of cases) {
    expect(quadraticClosedFormIntegral(local, direction, segment)).toBeCloseTo(
      quadraticNumericalIntegral(local, direction, segment),
      4
    );
    expect(quarticClosedFormIntegral(local, direction, segment)).toBeCloseTo(
      quarticNumericalIntegral(local, direction, segment),
      4
    );
  }
});

test("Phase -1.1 sunward quartic self-tau matches an asymmetric numerical segment", () => {
  const local: [number, number, number] = [0.14, -0.22, 0.06];
  const direction: [number, number, number] = [0.18, 0.43, 0.29];
  const from = 0;
  const to = 1.47;
  expect(quarticDirectionalClosedFormIntegral(local, direction, from, to)).toBeCloseTo(
    quarticDirectionalNumericalIntegral(local, direction, from, to),
    4
  );
});

test("Phase -1.2 local-density candidate remains V3-derived and sample-bounded", () => {
  const componentSource = readFileSync(
    path.join(process.cwd(), "apps/site/components/LuBirthHybridCloudKillSpikeRoute.tsx"),
    "utf8"
  );
  const architectureSource = readFileSync(
    path.join(process.cwd(), "docs/lubirth-hybrid-cloud-architecture.md"),
    "utf8"
  );
  const localVolumeMathSource = readFileSync(
    path.join(process.cwd(), "apps/site/components/lubirthHybridLocalVolumeMath.ts"),
    "utf8"
  );

  expect(componentSource).toContain('type HybridRendererMode = "ellipsoid" | "local-volume"');
  expect(componentSource).toContain("function buildLocalVolumeField(");
  expect(componentSource).toContain("buildLocalVolumeField(truth, lobes, baseCarrier, tier)");
  expect(componentSource).toContain("sampleTruthLevel(");
  expect(componentSource).toContain("gl.TEXTURE_3D");
  expect(componentSource).toContain("gl.RGBA8");
  expect(componentSource).toContain("uLocalVolumeField");
  expect(componentSource).toContain("uLocalVolumeViewSamples");
  expect(componentSource).toContain("resolveLocalVolumeSamplingBudget(tier, depthBinMode)");
  expect(localVolumeMathSource).toContain('tier === "mobile" ? 3 : 4');
  expect(componentSource).toContain("for (int sampleIndex = 0; sampleIndex < 4; sampleIndex += 1)");
  expect(componentSource).toContain("out vec3 vFieldEast;");
  expect(componentSource).toContain("out vec3 vFieldNorth;");
  expect(componentSource).toContain("intersectLocalVolumeField");
  expect(componentSource).toContain("worldPointToLocalVolume(fieldExitPoint)");
  expect(componentSource).toContain(
    "vec3 sampleLocal = mix(fieldEntryLocal, fieldExitLocal, samplePosition);"
  );
  expect(componentSource).toContain("vec4 localVolumeSample = texture(uLocalVolumeField, sampleUv)");
  expect(componentSource).toContain("sourceFootprint < 0.049");
  expect(componentSource).toContain("layout(location = 1) out vec4 outNearColor;");
  expect(componentSource).toContain("float farBinWeight = 1.0 - nearBinWeight;");
  expect(componentSource).toContain("farPremultipliedRadiance += farTransmittance");
  expect(componentSource).toContain("localVolumeAccumulationDrawCount");
  expect(componentSource).toContain("localVolumeFieldVersion");
  expect(componentSource).not.toContain("new THREE.Data3DTexture");
  expect(architectureSource).toContain("Phase -1.2 - Local-density rejection spike");
  expect(architectureSource).toContain("desktop: 4 view samples + 1 sun-density lookup");
  expect(architectureSource).toContain("mobile:  3 view samples + 1 sun-density lookup");
  expect(architectureSource).toContain("one MRT accumulation");
});
