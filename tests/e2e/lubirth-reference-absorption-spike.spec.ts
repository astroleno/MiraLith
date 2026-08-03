import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RELIEF_SCATTERING_CANDIDATES } from "../../packages/lubirth-hero/src";

test.setTimeout(180_000);

const requireFromHero = createRequire(
  path.resolve(process.cwd(), "packages/lubirth-hero/package.json")
);
const sharp = requireFromHero("sharp");
const evidenceDir = process.env.MIRALITH_REFERENCE_ABSORPTION_EVIDENCE_DIR ??
  path.resolve(process.cwd(), "docs/lubirth-reference-absorption-evidence/2026-08-03");

interface GpuTimerSnapshot {
  disjointResetCount: number;
  p50Ms?: number;
  p95Ms?: number;
  sampleCount: number;
  supported: boolean;
}

interface EarthSurfaceTelemetry {
  active: true;
  gpuTimer: GpuTimerSnapshot;
  materialFragmentTextureReads: 0 | 1;
  materialMapActive: boolean;
  materialModel: "baseline" | "packed-v1";
  referenceAbsorptionVariant: string;
}

interface ReliefCloudTelemetry {
  active: true;
  densityIntegration: "front-to-back";
  fragmentTextureReads: 3 | 4;
  gpuTimer: GpuTimerSnapshot;
  multiScatterStrength: number | null;
  phaseG: number | null;
  premultipliedAlpha: true;
  referenceAbsorptionVariant: string;
  scatteringCandidateId: string | null;
  scatteringModel: "hg-ms-v1" | "relief-baseline";
  sunSteps: 1;
  temporalJitter: false;
  viewSteps: 2 | 3;
}

interface ProjectedEarthLighting {
  center: [number, number];
  radius: number;
}

interface RawImage {
  data: Buffer;
  height: number;
  width: number;
}

interface LocationCase {
  id: string;
  latitude: number;
  longitude: number;
}

interface Capture {
  earth: EarthSurfaceTelemetry;
  image: RawImage;
  location: { latitudeDeg: number; longitudeDeg: number } | null;
  projection: ProjectedEarthLighting;
  viewport: { height: number; width: number };
}

declare global {
  interface Window {
    __MiraLithLuBirthEarthSurfaceLiteV2?: EarthSurfaceTelemetry;
    __MiraLithLuBirthEarthSurfaceLiteV2Override?: {
      reverseSun?: boolean;
    };
    __MiraLithLuBirthProjectedEarthLighting?: ProjectedEarthLighting;
    __MiraLithLuBirthRuntimeLocation?: {
      latitudeDeg: number;
      longitudeDeg: number;
    };
    __MiraLithLuBirthReliefCloud?: ReliefCloudTelemetry;
  }
}

const LOCATIONS: LocationCase[] = [
  { id: "mianyang", latitude: 31.47, longitude: 104.68 },
  { id: "equator", latitude: 0, longitude: 0 },
  { id: "dateline-north", latitude: 45, longitude: 179 }
];
const PROGRESS_POINTS = [0, 0.22, 0.55];

function createUrl(input: {
  cloudOffset?: number;
  debug?: "cloud-alpha" | "cloud-lighting";
  location: LocationCase;
  progress: number;
  quality: "high" | "medium";
  scatteringCandidate?: string;
  variant: "baseline" | "cloud-scattering-v1" | "earth-material-v1";
}) {
  const params = new URLSearchParams({
    copy: "hidden",
    geoLabel: input.location.id,
    geoLat: String(input.location.latitude),
    geoLon: String(input.location.longitude),
    progress: String(input.progress),
    quality: input.quality,
    referenceAbsorptionGpuTimer: "on",
    sunDate: "1993-08-01T03:03:00Z",
    variant: input.variant,
    visualTest: "pixels"
  });
  if (input.debug) {
    params.set("debug", input.debug);
  }
  if (input.cloudOffset !== undefined) {
    params.set("cloudOffset", String(input.cloudOffset));
  }
  if (input.scatteringCandidate) {
    params.set("scatteringCandidate", input.scatteringCandidate);
  }
  return `/lubirth-reference-absorption-spike?${params.toString()}`;
}

function fileStem(
  tier: string,
  location: LocationCase,
  progress: number,
  variant: string,
  direction: "forward" | "reverse" | "night"
) {
  return `earth-material-${tier}-${location.id}-p${Math.round(progress * 100)
    .toString()
    .padStart(2, "0")}-${variant}-${direction}.png`;
}

function luminance(data: Buffer, offset: number) {
  return (
    data[offset] * 0.2126 +
    data[offset + 1] * 0.7152 +
    data[offset + 2] * 0.0722
  ) / 255;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function relativeChange(baseline: number, variant: number) {
  return Math.abs(variant - baseline) / Math.max(Math.abs(baseline), 1e-5);
}

function scaledProjection(capture: Capture) {
  const scaleX = capture.image.width / capture.viewport.width;
  const scaleY = capture.image.height / capture.viewport.height;
  return {
    centerX: capture.projection.center[0] * scaleX,
    centerY: capture.projection.center[1] * scaleY,
    radius: capture.projection.radius * Math.min(scaleX, scaleY)
  };
}

function imageMetrics(capture: Capture) {
  const { data, height, width } = capture.image;
  const { centerX, centerY, radius } = scaledProjection(capture);
  const landLuma: number[] = [];
  const oceanLuma: number[] = [];
  const daylightLuma: number[] = [];
  const localContrast: number[] = [];

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance > radius * 0.96) {
        continue;
      }

      const offset = (y * width + x) * 3;
      const red = data[offset] / 255;
      const green = data[offset + 1] / 255;
      const blue = data[offset + 2] / 255;
      const value = luminance(data, offset);
      if (value < 0.016) {
        continue;
      }

      daylightLuma.push(value);
      const north = luminance(data, ((y - 1) * width + x) * 3);
      const south = luminance(data, ((y + 1) * width + x) * 3);
      const west = luminance(data, (y * width + x - 1) * 3);
      const east = luminance(data, (y * width + x + 1) * 3);
      localContrast.push(Math.abs(value - (north + south + west + east) * 0.25));

      if (blue > red * 1.08 && blue > green * 0.96) {
        oceanLuma.push(value);
      } else if (green > blue * 0.82 || red > blue * 0.88) {
        landLuma.push(value);
      }
    }
  }

  return {
    landMean: mean(landLuma),
    midFrequencyContrast: mean(localContrast),
    oceanLandSeparation: Math.abs(mean(oceanLuma) - mean(landLuma)),
    p99: percentile(daylightLuma, 0.99)
  };
}

function cityMean(capture: Capture) {
  const { data, height, width } = capture.image;
  const { centerX, centerY, radius } = scaledProjection(capture);
  const values: number[] = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (Math.hypot(x - centerX, y - centerY) > radius * 0.94) {
        continue;
      }
      const offset = (y * width + x) * 3;
      const value = luminance(data, offset);
      const red = data[offset] / 255;
      const blue = data[offset + 2] / 255;
      if (value > 0.02 && value < 0.7 && red > blue * 0.9) {
        values.push(value);
      }
    }
  }
  return mean(values);
}

function projectedSilhouetteDrift(baseline: Capture, variant: Capture) {
  return Math.max(
    Math.abs(baseline.projection.center[0] - variant.projection.center[0]),
    Math.abs(baseline.projection.center[1] - variant.projection.center[1]),
    Math.abs(baseline.projection.radius - variant.projection.radius)
  );
}

function meanAbsolutePixelDelta(a: RawImage, b: RawImage) {
  const length = Math.min(a.data.length, b.data.length);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(a.data[index] - b.data[index]);
  }
  return total / Math.max(length, 1) / 255;
}

async function decodePng(buffer: Buffer): Promise<RawImage> {
  const decoded = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: decoded.data,
    height: decoded.info.height,
    width: decoded.info.width
  };
}

async function capture(
  page: import("@playwright/test").Page,
  input: {
    direction: "forward" | "reverse" | "night";
    location: LocationCase;
    progress: number;
    quality: "high" | "medium";
    tier: string;
    variant: "baseline" | "earth-material-v1";
  }
) {
  await page.goto(createUrl(input));
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-reference-absorption-variant",
    input.variant,
    { timeout: 25_000 }
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthEarthSurfaceLiteV2), {
      timeout: 25_000
    })
    .toMatchObject({
      active: true,
      materialMapActive: input.variant === "earth-material-v1",
      materialModel: input.variant === "earth-material-v1" ? "packed-v1" : "baseline"
    });

  if (input.direction === "night") {
    await page.evaluate(() => {
      window.__MiraLithLuBirthEarthSurfaceLiteV2Override = { reverseSun: true };
    });
    await page.waitForTimeout(300);
  }

  const snapshot = await page.evaluate(() => ({
    earth: window.__MiraLithLuBirthEarthSurfaceLiteV2,
    location: window.__MiraLithLuBirthRuntimeLocation ?? null,
    projection: window.__MiraLithLuBirthProjectedEarthLighting,
    viewport: { height: window.innerHeight, width: window.innerWidth }
  }));
  expect(snapshot.earth).toBeTruthy();
  expect(snapshot.projection).toBeTruthy();
  expect(snapshot.location).toMatchObject({
    latitudeDeg: input.location.latitude,
    longitudeDeg: input.location.longitude
  });

  const screenshotPath = path.join(
    evidenceDir,
    fileStem(input.tier, input.location, input.progress, input.variant, input.direction)
  );
  const screenshot = await page.screenshot({ animations: "disabled", path: screenshotPath });
  return {
    earth: snapshot.earth as EarthSurfaceTelemetry,
    image: await decodePng(screenshot),
    location: snapshot.location,
    projection: snapshot.projection as ProjectedEarthLighting,
    viewport: snapshot.viewport
  } satisfies Capture;
}

async function collectTimer(
  page: import("@playwright/test").Page,
  input: Omit<Parameters<typeof capture>[1], "direction">
) {
  await page.goto(createUrl({ ...input, direction: "forward" }));
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthEarthSurfaceLiteV2), {
      timeout: 25_000
    })
    .toMatchObject({ active: true });
  await page.waitForTimeout(4_000);
  return page.evaluate(() => window.__MiraLithLuBirthEarthSurfaceLiteV2?.gpuTimer);
}

async function readEvidence() {
  try {
    return JSON.parse(
      await readFile(path.join(evidenceDir, "earth-material-telemetry.json"), "utf8")
    ) as Record<string, unknown>;
  } catch {
    return { tiers: {} };
  }
}

test("earth material preserves Earth-local geography and records the A-track matrix", async ({
  page
}, testInfo) => {
  await mkdir(evidenceDir, { recursive: true });

  const tier = testInfo.project.name;
  const quality = tier.includes("mobile") ? "medium" : "high";
  const captures: Array<{
    baseline: Capture;
    location: string;
    progress: number;
    reverse: Capture;
    variant: Capture;
  }> = [];

  for (const location of LOCATIONS) {
    for (const progress of PROGRESS_POINTS) {
      const baseline = await capture(page, {
        direction: "forward",
        location,
        progress,
        quality,
        tier,
        variant: "baseline"
      });
      const variant = await capture(page, {
        direction: "forward",
        location,
        progress,
        quality,
        tier,
        variant: "earth-material-v1"
      });
      const reverse = await capture(page, {
        direction: "reverse",
        location,
        progress,
        quality,
        tier,
        variant: "earth-material-v1"
      });
      captures.push({
        baseline,
        location: location.id,
        progress,
        reverse,
        variant
      });
    }
  }

  const nightLocation = LOCATIONS[0];
  const nightBaseline = await capture(page, {
    direction: "night",
    location: nightLocation,
    progress: 0.22,
    quality,
    tier,
    variant: "baseline"
  });
  const nightVariant = await capture(page, {
    direction: "night",
    location: nightLocation,
    progress: 0.22,
    quality,
    tier,
    variant: "earth-material-v1"
  });
  const baselineTimer = await collectTimer(page, {
    location: LOCATIONS[0],
    progress: 0.22,
    quality,
    tier,
    variant: "baseline"
  });
  const variantTimer = await collectTimer(page, {
    location: LOCATIONS[0],
    progress: 0.22,
    quality,
    tier,
    variant: "earth-material-v1"
  });

  const frameMetrics = captures.map((captureResult) => {
    const baseline = imageMetrics(captureResult.baseline);
    const variant = imageMetrics(captureResult.variant);
    return {
      daylightContrastGainPercent:
        (variant.midFrequencyContrast / Math.max(baseline.midFrequencyContrast, 1e-5) - 1) * 100,
      edgeDriftPx: projectedSilhouetteDrift(captureResult.baseline, captureResult.variant),
      location: captureResult.location,
      oceanLandSeparationGainPercent:
        (variant.oceanLandSeparation / Math.max(baseline.oceanLandSeparation, 1e-5) - 1) * 100,
      progress: captureResult.progress,
      reversePixelDelta: meanAbsolutePixelDelta(captureResult.variant.image, captureResult.reverse.image),
      variantP99: variant.p99 * 255
    };
  });
  const cityMeanChangePercent = relativeChange(cityMean(nightBaseline), cityMean(nightVariant)) * 100;
  const supported = Boolean(baselineTimer?.supported && variantTimer?.supported);
  const timerSamplesSufficient = Boolean(
    supported &&
    baselineTimer &&
    variantTimer &&
    baselineTimer.sampleCount >= 60 &&
    variantTimer.sampleCount >= 60 &&
    baselineTimer.disjointResetCount === 0 &&
    variantTimer.disjointResetCount === 0
  );
  const baselineP95 = baselineTimer?.p95Ms ?? null;
  const variantP95 = variantTimer?.p95Ms ?? null;
  const absoluteP95Limit = tier.includes("mobile") ? 1.0 : 1.5;
  const deltaP95Limit = tier.includes("mobile") ? 0.25 : 0.35;
  const performancePass = Boolean(
    timerSamplesSufficient &&
    baselineP95 !== null &&
    variantP95 !== null &&
    variantP95 <= absoluteP95Limit &&
    variantP95 - baselineP95 <= deltaP95Limit
  );
  const baselineBlocked = Boolean(
    timerSamplesSufficient &&
    baselineP95 !== null &&
    variantP95 !== null &&
    baselineP95 > absoluteP95Limit &&
    variantP95 > absoluteP95Limit &&
    variantP95 - baselineP95 <= deltaP95Limit
  );
  const visualPass = frameMetrics.every((metric) =>
    metric.daylightContrastGainPercent >= 10 &&
    metric.oceanLandSeparationGainPercent >= 12 &&
    metric.variantP99 <= 250 &&
    metric.edgeDriftPx <= 1 &&
    metric.reversePixelDelta <= 1 / 255
  ) && cityMeanChangePercent <= 3;
  const verdict = performancePass && visualPass
    ? "pass"
    : baselineBlocked
      ? "blocked-by-baseline"
      : "reject";

  const evidence = await readEvidence();
  const tiers = (evidence.tiers as Record<string, unknown>) ?? {};
  tiers[tier] = {
    baselineTimer,
    cityMeanChangePercent,
    frameMetrics,
    gates: {
      performancePass,
      timerSamplesSufficient,
      visualPass
    },
    verdict,
    variantTimer
  };
  await writeFile(
    path.join(evidenceDir, "earth-material-telemetry.json"),
    `${JSON.stringify({ ...evidence, tiers }, null, 2)}\n`
  );

  for (const metric of frameMetrics) {
    expect(metric.reversePixelDelta).toBeLessThanOrEqual(1 / 255);
    expect(metric.edgeDriftPx).toBeLessThanOrEqual(1);
  }
});

test("cloud scattering contract keeps the Relief-lite integration bounded", async ({ page }, testInfo) => {
  const input = {
    location: LOCATIONS[0],
    progress: 0.22,
    quality: "high" as const
  };
  const expectedBudget = testInfo.project.name === "mobile-landscape"
    ? { fragmentTextureReads: 3, viewSteps: 2 }
    : { fragmentTextureReads: 4, viewSteps: 3 };

  await page.goto(createUrl({ ...input, variant: "baseline" }));
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthReliefCloud), {
      timeout: 25_000
    })
    .toMatchObject({
      active: true,
      densityIntegration: "front-to-back",
      ...expectedBudget,
      multiScatterStrength: null,
      phaseG: null,
      premultipliedAlpha: true,
      scatteringCandidateId: null,
      scatteringModel: "relief-baseline",
      sunSteps: 1,
      temporalJitter: false
    });

  await page.goto(createUrl({
    ...input,
    debug: "cloud-lighting",
    scatteringCandidate: "g072-ms028",
    variant: "cloud-scattering-v1"
  }));
  await expect(page.locator(".lubirth-reference-absorption-spike")).toHaveAttribute(
    "data-reference-absorption-cloud-debug",
    "cloud-lighting"
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthReliefCloud), {
      timeout: 25_000
    })
    .toMatchObject({
      active: true,
      densityIntegration: "front-to-back",
      ...expectedBudget,
      multiScatterStrength: 0.28,
      phaseG: 0.72,
      premultipliedAlpha: true,
      scatteringCandidateId: "g072-ms028",
      scatteringModel: "hg-ms-v1",
      sunSteps: 1,
      temporalJitter: false
    });
});

interface CloudDiagnosticCapture {
  alphaMetrics?: CloudAlphaMetrics;
  cloud: ReliefCloudTelemetry;
  image: RawImage;
  location: { latitudeDeg: number; longitudeDeg: number } | null;
  projection: ProjectedEarthLighting;
  viewport: { height: number; width: number };
}

interface CloudAlphaMetrics {
  activePixelCount: number;
  centerX: number;
  centerY: number;
  maxX: number;
  maxY: number;
  mean: number;
  minX: number;
  minY: number;
}

interface CloudLightingMetrics {
  bodyContrast: number;
  bodyPixelCount: number;
  p99: number;
  sideCount: number;
  sideMean: number;
  topCount: number;
  topMean: number;
  undersideCount: number;
  undersideMean: number;
}

interface CloudTimerSummary {
  disjointResetCount: number;
  p95Ms: number | null;
  sampleCount: number;
  sufficient: boolean;
  supported: boolean;
}

const CLOUD_ALPHA_DELTA_LIMIT = 0.5 / 255;
const CLOUD_ALPHA_THRESHOLD = 0.035;
const CLOUD_GPU_ABSOLUTE_LIMIT_MS = 3;
const CLOUD_GPU_DELTA_LIMIT_MS = 0.2;
const CLOUD_GPU_MINIMUM_SAMPLES = 120;
const CLOUD_MOTION_SEQUENCE = [0, 0.22, 0.55, 0.22, 0] as const;
const CLOUD_PROGRESS_POINTS = [0, 0.22, 0.55] as const;
const CLOUD_SCORING_FRAMES = [
  { id: "near", location: LOCATIONS[0], progress: 0 },
  { id: "oblique", location: LOCATIONS[1], progress: 0.22 },
  { id: "mid", location: LOCATIONS[2], progress: 0.55 }
] as const;
const SYSTEM_CHROME_EVIDENCE_ENABLED =
  process.env.MIRALITH_REFERENCE_ABSORPTION_SYSTEM_CHROME === "1";

function cloudFrameKey(location: LocationCase, progress: number) {
  return `${location.id}-${Math.round(progress * 100)}`;
}

function cloudFileStem(
  tier: string,
  candidateId: string,
  location: LocationCase,
  progress: number,
  diagnostic: "cloud-alpha" | "cloud-lighting",
  direction: "baseline" | "forward" | "lighting" | "reverse"
) {
  return `cloud-scattering-${tier}-${candidateId}-${location.id}-p${Math.round(progress * 100)
    .toString()
    .padStart(2, "0")}-${diagnostic}-${direction}.png`;
}

function cloudCropBounds(capture: CloudDiagnosticCapture) {
  const { centerX, centerY, radius } = scaledProjection(capture);
  return {
    centerX,
    centerY,
    maxX: Math.min(capture.image.width - 1, Math.ceil(centerX + radius * 0.96)),
    maxY: Math.min(capture.image.height - 1, Math.ceil(centerY + radius * 0.96)),
    minX: Math.max(0, Math.floor(centerX - radius * 0.96)),
    minY: Math.max(0, Math.floor(centerY - radius * 0.96)),
    radius
  };
}

function resolveCloudAlphaMetrics(capture: CloudDiagnosticCapture): CloudAlphaMetrics {
  if (capture.alphaMetrics) {
    return capture.alphaMetrics;
  }

  const { data, width } = capture.image;
  const { centerX, centerY, maxX, maxY, minX, minY, radius } = cloudCropBounds(capture);
  let activePixelCount = 0;
  let alphaTotal = 0;
  let sampleCount = 0;
  let activeXTotal = 0;
  let activeYTotal = 0;
  let activeMinX = maxX;
  let activeMinY = maxY;
  let activeMaxX = minX;
  let activeMaxY = minY;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (Math.hypot(x - centerX, y - centerY) > radius * 0.95) {
        continue;
      }
      const alpha = luminance(data, (y * width + x) * 3);
      alphaTotal += alpha;
      sampleCount += 1;
      if (alpha < CLOUD_ALPHA_THRESHOLD) {
        continue;
      }
      activePixelCount += 1;
      activeXTotal += x;
      activeYTotal += y;
      activeMinX = Math.min(activeMinX, x);
      activeMinY = Math.min(activeMinY, y);
      activeMaxX = Math.max(activeMaxX, x);
      activeMaxY = Math.max(activeMaxY, y);
    }
  }

  const metrics = {
    activePixelCount,
    centerX: activePixelCount > 0 ? activeXTotal / activePixelCount : centerX,
    centerY: activePixelCount > 0 ? activeYTotal / activePixelCount : centerY,
    maxX: activePixelCount > 0 ? activeMaxX : centerX,
    maxY: activePixelCount > 0 ? activeMaxY : centerY,
    mean: alphaTotal / Math.max(sampleCount, 1),
    minX: activePixelCount > 0 ? activeMinX : centerX,
    minY: activePixelCount > 0 ? activeMinY : centerY
  };
  capture.alphaMetrics = metrics;
  return metrics;
}

function cloudAlphaEdgeDrift(
  baseline: CloudDiagnosticCapture,
  variant: CloudDiagnosticCapture
) {
  const baselineMetrics = resolveCloudAlphaMetrics(baseline);
  const variantMetrics = resolveCloudAlphaMetrics(variant);
  if (baselineMetrics.activePixelCount === 0 || variantMetrics.activePixelCount === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(
    Math.abs(baselineMetrics.centerX - variantMetrics.centerX),
    Math.abs(baselineMetrics.centerY - variantMetrics.centerY),
    Math.abs(baselineMetrics.minX - variantMetrics.minX),
    Math.abs(baselineMetrics.minY - variantMetrics.minY),
    Math.abs(baselineMetrics.maxX - variantMetrics.maxX),
    Math.abs(baselineMetrics.maxY - variantMetrics.maxY)
  );
}

function croppedPixelDelta(
  baseline: CloudDiagnosticCapture,
  variant: CloudDiagnosticCapture
) {
  const { data: baselineData, width: baselineWidth } = baseline.image;
  const { data: variantData, width: variantWidth } = variant.image;
  const { centerX, centerY, maxX, maxY, minX, minY, radius } = cloudCropBounds(baseline);
  let total = 0;
  let count = 0;

  for (let y = minY; y <= maxY && y < variant.image.height; y += 2) {
    for (let x = minX; x <= maxX && x < variant.image.width; x += 2) {
      if (Math.hypot(x - centerX, y - centerY) > radius * 0.95) {
        continue;
      }
      const baselineOffset = (y * baselineWidth + x) * 3;
      const variantOffset = (y * variantWidth + x) * 3;
      total += Math.abs(baselineData[baselineOffset] - variantData[variantOffset]);
      total += Math.abs(baselineData[baselineOffset + 1] - variantData[variantOffset + 1]);
      total += Math.abs(baselineData[baselineOffset + 2] - variantData[variantOffset + 2]);
      count += 3;
    }
  }

  return total / Math.max(count, 1) / 255;
}

function resolveCloudLightingMetrics(
  lighting: CloudDiagnosticCapture,
  alpha: CloudDiagnosticCapture
): CloudLightingMetrics {
  const { data: lightingData, width } = lighting.image;
  const { data: alphaData } = alpha.image;
  const { centerX, centerY, maxX, maxY, minX, minY, radius } = cloudCropBounds(lighting);
  let sunX = lighting.projection.sunDirection[0];
  let sunY = lighting.projection.sunDirection[1];
  const sunLength = Math.hypot(sunX, sunY);
  if (sunLength < 0.001) {
    sunX = 0;
    sunY = -1;
  } else {
    sunX /= sunLength;
    sunY /= sunLength;
  }

  const body: Array<{ sunAxis: number; value: number }> = [];
  const rgb: number[] = [];

  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      const offset = (y * width + x) * 3;
      const alphaValue = luminance(alphaData, offset);
      const radialDistance = Math.hypot(x - centerX, y - centerY) / radius;
      if (alphaValue < CLOUD_ALPHA_THRESHOLD || radialDistance > 0.9) {
        continue;
      }

      const value = luminance(lightingData, offset);
      const dx = (x - centerX) / radius;
      const dy = (y - centerY) / radius;
      const sunAxis = dx * sunX + dy * sunY;

      body.push({ sunAxis, value });
      rgb.push(
        lightingData[offset] / 255,
        lightingData[offset + 1] / 255,
        lightingData[offset + 2] / 255
      );
    }
  }
  const orderedBody = body.sort((left, right) => left.sunAxis - right.sunAxis);
  const lowerEnd = Math.floor(orderedBody.length / 3);
  const upperStart = Math.ceil(orderedBody.length * (2 / 3));
  const underside = orderedBody.slice(0, lowerEnd).map((sample) => sample.value);
  const side = orderedBody.slice(lowerEnd, upperStart).map((sample) => sample.value);
  const top = orderedBody.slice(upperStart).map((sample) => sample.value);
  const bodyValues = orderedBody.map((sample) => sample.value);

  return {
    bodyContrast: percentile(bodyValues, 0.9) - percentile(bodyValues, 0.1),
    bodyPixelCount: bodyValues.length,
    p99: percentile(rgb, 0.99) * 255,
    sideCount: side.length,
    sideMean: mean(side),
    topCount: top.length,
    topMean: mean(top),
    undersideCount: underside.length,
    undersideMean: mean(underside)
  };
}

function scoreNormalizedRatio(value: number, requiredRatio: number) {
  return Math.max(0, Math.min(1, (value - 1) / (requiredRatio - 1)));
}

function scoreNormalizedPercent(value: number, requiredPercent: number) {
  return Math.max(0, Math.min(1, value / requiredPercent));
}

function summarizeCloudTimers(
  timers: Array<GpuTimerSnapshot | null>
): CloudTimerSummary {
  const available = timers.filter((timer): timer is GpuTimerSnapshot => Boolean(timer));
  const p95Values = available
    .map((timer) => timer.p95Ms)
    .filter((value): value is number => value !== undefined);
  const sampleCount = available.length === timers.length && available.length > 0
    ? Math.min(...available.map((timer) => timer.sampleCount))
    : 0;
  const disjointResetCount = available.reduce(
    (total, timer) => total + timer.disjointResetCount,
    0
  );
  const supported = available.length === timers.length &&
    available.every((timer) => timer.supported);

  return {
    disjointResetCount,
    p95Ms: p95Values.length > 0 ? Math.max(...p95Values) : null,
    sampleCount,
    sufficient: supported &&
      sampleCount >= CLOUD_GPU_MINIMUM_SAMPLES &&
      disjointResetCount === 0,
    supported
  };
}

async function captureCloudDiagnostic(
  page: import("@playwright/test").Page,
  input: {
    candidateId?: string;
    diagnostic: "cloud-alpha" | "cloud-lighting";
    direction: "baseline" | "forward" | "lighting" | "reverse";
    location: LocationCase;
    progress: number;
    quality: "high" | "medium";
    tier: string;
    variant: "baseline" | "cloud-scattering-v1";
  }
): Promise<CloudDiagnosticCapture> {
  await page.goto(createUrl({
    cloudOffset: 0,
    debug: input.diagnostic,
    location: input.location,
    progress: input.progress,
    quality: input.quality,
    scatteringCandidate: input.candidateId,
    variant: input.variant
  }));
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect(page.locator(".lubirth-reference-absorption-spike")).toHaveAttribute(
    "data-reference-absorption-cloud-debug",
    input.diagnostic
  );
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthReliefCloud), {
      timeout: 25_000
    })
    .toMatchObject({
      active: true,
      densityIntegration: "front-to-back",
      premultipliedAlpha: true,
      referenceAbsorptionVariant: input.variant,
      scatteringModel: input.variant === "cloud-scattering-v1"
        ? "hg-ms-v1"
        : "relief-baseline",
      temporalJitter: false
    });
  await expect
    .poll(() => page.evaluate((progress) => {
      const projected = window.__MiraLithLuBirthProjectedEarthLighting;
      return Boolean(projected && Math.abs(projected.progress - progress) <= 0.001);
    }, input.progress), { timeout: 25_000 })
    .toBe(true);
  await page.waitForTimeout(100);

  const snapshot = await page.evaluate(() => ({
    cloud: window.__MiraLithLuBirthReliefCloud,
    location: window.__MiraLithLuBirthRuntimeLocation ?? null,
    projection: window.__MiraLithLuBirthProjectedEarthLighting,
    viewport: { height: window.innerHeight, width: window.innerWidth }
  }));
  expect(snapshot.cloud).toBeTruthy();
  expect(snapshot.projection).toBeTruthy();
  expect(snapshot.location).toMatchObject({
    latitudeDeg: input.location.latitude,
    longitudeDeg: input.location.longitude
  });
  expect(snapshot.projection.progress).toBeCloseTo(input.progress, 3);

  const screenshotPath = path.join(
    evidenceDir,
    cloudFileStem(
      input.tier,
      input.candidateId ?? "baseline",
      input.location,
      input.progress,
      input.diagnostic,
      input.direction
    )
  );
  const screenshot = await page.screenshot({ animations: "disabled", path: screenshotPath });
  return {
    cloud: snapshot.cloud as ReliefCloudTelemetry,
    image: await decodePng(screenshot),
    location: snapshot.location,
    projection: snapshot.projection as ProjectedEarthLighting,
    viewport: snapshot.viewport
  };
}

async function collectCloudGpuTimer(
  page: import("@playwright/test").Page,
  input: {
    candidateId?: string;
    location: LocationCase;
    progress: number;
    quality: "high" | "medium";
    variant: "baseline" | "cloud-scattering-v1";
  }
) {
  await page.goto(createUrl({
    cloudOffset: 0,
    location: input.location,
    progress: input.progress,
    quality: input.quality,
    scatteringCandidate: input.candidateId,
    variant: input.variant
  }));
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthReliefCloud), {
      timeout: 25_000
    })
    .toMatchObject({ active: true });
  await expect
    .poll(() => page.evaluate((progress) => {
      const projected = window.__MiraLithLuBirthProjectedEarthLighting;
      return Boolean(projected && Math.abs(projected.progress - progress) <= 0.001);
    }, input.progress), { timeout: 25_000 })
    .toBe(true);

  let timer = await page.evaluate(
    () => window.__MiraLithLuBirthReliefCloud?.gpuTimer ?? null
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!timer?.supported || timer.sampleCount >= CLOUD_GPU_MINIMUM_SAMPLES) {
      return timer as GpuTimerSnapshot | null;
    }
    await page.waitForTimeout(250);
    timer = await page.evaluate(
      () => window.__MiraLithLuBirthReliefCloud?.gpuTimer ?? null
    );
  }
  return timer as GpuTimerSnapshot | null;
}

async function collectCloudSweepTimers(
  page: import("@playwright/test").Page,
  input: Omit<Parameters<typeof collectCloudGpuTimer>[1], "progress">
) {
  const timers: Array<GpuTimerSnapshot | null> = [];
  for (const progress of CLOUD_MOTION_SEQUENCE) {
    timers.push(await collectCloudGpuTimer(page, { ...input, progress }));
  }
  return timers;
}

async function readCloudEvidence(fileName: string) {
  try {
    return JSON.parse(await readFile(path.join(evidenceDir, fileName), "utf8")) as {
      tiers?: Record<string, unknown>;
    };
  } catch {
    return { tiers: {} };
  }
}

test.describe("System Chrome cloud scattering evidence", () => {
  test.skip(
    !SYSTEM_CHROME_EVIDENCE_ENABLED,
    "The six-candidate evidence matrix only runs in headed System Chrome."
  );

  test("cloud scattering evidence scores the fixed candidate matrix", async ({
    page
  }, testInfo) => {
    testInfo.setTimeout(1_450_000);
    await mkdir(evidenceDir, { recursive: true });

    const tier = testInfo.project.name;
    const quality = tier === "mobile-landscape" ? "medium" as const : "high" as const;
    const expectedTextureReads = tier === "mobile-landscape" ? 3 : 4;
    const expectedViewSteps = tier === "mobile-landscape" ? 2 : 3;
    const baselineAlpha = new Map<string, CloudDiagnosticCapture>();
    const baselineLighting = new Map<string, CloudDiagnosticCapture>();

    for (const location of LOCATIONS) {
      for (const progress of CLOUD_PROGRESS_POINTS) {
        const captureResult = await captureCloudDiagnostic(page, {
          diagnostic: "cloud-alpha",
          direction: "baseline",
          location,
          progress,
          quality,
          tier,
          variant: "baseline"
        });
        baselineAlpha.set(cloudFrameKey(location, progress), captureResult);
      }
    }

    for (const frame of CLOUD_SCORING_FRAMES) {
      const captureResult = await captureCloudDiagnostic(page, {
        diagnostic: "cloud-lighting",
        direction: "lighting",
        location: frame.location,
        progress: frame.progress,
        quality,
        tier,
        variant: "baseline"
      });
      baselineLighting.set(cloudFrameKey(frame.location, frame.progress), captureResult);
    }

    const candidateResults = [];

    for (const candidate of RELIEF_SCATTERING_CANDIDATES) {
      const candidateAlpha = new Map<string, CloudDiagnosticCapture>();
      const motionMetrics: Array<{
        alphaDeltaFromBaseline: number;
        alphaEdgeDriftFromBaseline: number;
        direction: "forward" | "reverse";
        forwardReverseAlphaDelta: number | null;
        forwardReverseEdgeDrift: number | null;
        location: string;
        progress: number;
      }> = [];
      const telemetrySamples: ReliefCloudTelemetry[] = [];

      for (const location of LOCATIONS) {
        const forwardFrames = new Map<number, CloudDiagnosticCapture>();
        for (const [index, progress] of CLOUD_MOTION_SEQUENCE.entries()) {
          const direction = index <= 2 ? "forward" as const : "reverse" as const;
          const captureResult = await captureCloudDiagnostic(page, {
            candidateId: candidate.id,
            diagnostic: "cloud-alpha",
            direction,
            location,
            progress,
            quality,
            tier,
            variant: "cloud-scattering-v1"
          });
          telemetrySamples.push(captureResult.cloud);
          const baseline = baselineAlpha.get(cloudFrameKey(location, progress));
          expect(baseline).toBeTruthy();
          const forward = forwardFrames.get(progress);
          const forwardReverseAlphaDelta = forward
            ? croppedPixelDelta(forward, captureResult)
            : null;
          const forwardReverseEdgeDrift = forward
            ? cloudAlphaEdgeDrift(forward, captureResult)
            : null;

          motionMetrics.push({
            alphaDeltaFromBaseline: croppedPixelDelta(
              baseline as CloudDiagnosticCapture,
              captureResult
            ),
            alphaEdgeDriftFromBaseline: cloudAlphaEdgeDrift(
              baseline as CloudDiagnosticCapture,
              captureResult
            ),
            direction,
            forwardReverseAlphaDelta,
            forwardReverseEdgeDrift,
            location: location.id,
            progress
          });

          if (direction === "forward") {
            forwardFrames.set(progress, captureResult);
            candidateAlpha.set(cloudFrameKey(location, progress), captureResult);
          }
        }
      }

      const lightingFrames = [];
      for (const frame of CLOUD_SCORING_FRAMES) {
        const alpha = candidateAlpha.get(cloudFrameKey(frame.location, frame.progress));
        const baselineAlphaCapture = baselineAlpha.get(
          cloudFrameKey(frame.location, frame.progress)
        );
        const baselineLightingCapture = baselineLighting.get(
          cloudFrameKey(frame.location, frame.progress)
        );
        expect(alpha).toBeTruthy();
        expect(baselineAlphaCapture).toBeTruthy();
        expect(baselineLightingCapture).toBeTruthy();

        const lighting = await captureCloudDiagnostic(page, {
          candidateId: candidate.id,
          diagnostic: "cloud-lighting",
          direction: "lighting",
          location: frame.location,
          progress: frame.progress,
          quality,
          tier,
          variant: "cloud-scattering-v1"
        });
        telemetrySamples.push(lighting.cloud);
        const baselineMetrics = resolveCloudLightingMetrics(
          baselineLightingCapture as CloudDiagnosticCapture,
          baselineAlphaCapture as CloudDiagnosticCapture
        );
        const variantMetrics = resolveCloudLightingMetrics(
          lighting,
          alpha as CloudDiagnosticCapture
        );
        const topSideRatio = variantMetrics.topMean /
          Math.max(variantMetrics.sideMean, 1e-5);
        const sideUndersideRatio = variantMetrics.sideMean /
          Math.max(variantMetrics.undersideMean, 1e-5);
        lightingFrames.push({
          baseline: baselineMetrics,
          contrastGainPercent: (
            variantMetrics.bodyContrast / Math.max(baselineMetrics.bodyContrast, 1e-5) - 1
          ) * 100,
          id: frame.id,
          sideUndersideRatio,
          topSideRatio,
          variant: variantMetrics
        });
      }

      let gpuScenarios: Array<{
        baseline: CloudTimerSummary;
        baselineBlocked: boolean;
        deltaMs: number | null;
        id: string;
        pass: boolean;
        variant: CloudTimerSummary;
      }> = [];
      if (tier === "desktop") {
        const timerInputs = [
          { id: "near", location: CLOUD_SCORING_FRAMES[0].location, progress: 0 },
          { id: "oblique", location: CLOUD_SCORING_FRAMES[1].location, progress: 0.22 }
        ];
        for (const timerInput of timerInputs) {
          const baselineTimer = summarizeCloudTimers([
            await collectCloudGpuTimer(page, {
              location: timerInput.location,
              progress: timerInput.progress,
              quality,
              variant: "baseline"
            })
          ]);
          const variantTimer = summarizeCloudTimers([
            await collectCloudGpuTimer(page, {
              candidateId: candidate.id,
              location: timerInput.location,
              progress: timerInput.progress,
              quality,
              variant: "cloud-scattering-v1"
            })
          ]);
          const deltaMs = baselineTimer.p95Ms !== null && variantTimer.p95Ms !== null
            ? variantTimer.p95Ms - baselineTimer.p95Ms
            : null;
          const deltaPass = deltaMs !== null && deltaMs <= CLOUD_GPU_DELTA_LIMIT_MS;
          const absolutePass = variantTimer.p95Ms !== null &&
            variantTimer.p95Ms <= CLOUD_GPU_ABSOLUTE_LIMIT_MS;
          gpuScenarios.push({
            baseline: baselineTimer,
            baselineBlocked: Boolean(
              baselineTimer.sufficient &&
              variantTimer.sufficient &&
              deltaPass &&
              baselineTimer.p95Ms !== null &&
              variantTimer.p95Ms !== null &&
              baselineTimer.p95Ms > CLOUD_GPU_ABSOLUTE_LIMIT_MS &&
              variantTimer.p95Ms > CLOUD_GPU_ABSOLUTE_LIMIT_MS
            ),
            deltaMs,
            id: timerInput.id,
            pass: baselineTimer.sufficient && variantTimer.sufficient && deltaPass && absolutePass,
            variant: variantTimer
          });
        }

        const baselineSweep = summarizeCloudTimers(await collectCloudSweepTimers(page, {
          location: LOCATIONS[0],
          quality,
          variant: "baseline"
        }));
        const variantSweep = summarizeCloudTimers(await collectCloudSweepTimers(page, {
          candidateId: candidate.id,
          location: LOCATIONS[0],
          quality,
          variant: "cloud-scattering-v1"
        }));
        const sweepDeltaMs = baselineSweep.p95Ms !== null && variantSweep.p95Ms !== null
          ? variantSweep.p95Ms - baselineSweep.p95Ms
          : null;
        const sweepDeltaPass = sweepDeltaMs !== null &&
          sweepDeltaMs <= CLOUD_GPU_DELTA_LIMIT_MS;
        const sweepAbsolutePass = variantSweep.p95Ms !== null &&
          variantSweep.p95Ms <= CLOUD_GPU_ABSOLUTE_LIMIT_MS;
        gpuScenarios.push({
          baseline: baselineSweep,
          baselineBlocked: Boolean(
            baselineSweep.sufficient &&
            variantSweep.sufficient &&
            sweepDeltaPass &&
            baselineSweep.p95Ms !== null &&
            variantSweep.p95Ms !== null &&
            baselineSweep.p95Ms > CLOUD_GPU_ABSOLUTE_LIMIT_MS &&
            variantSweep.p95Ms > CLOUD_GPU_ABSOLUTE_LIMIT_MS
          ),
          deltaMs: sweepDeltaMs,
          id: "fixed-progress-sweep",
          pass: baselineSweep.sufficient &&
            variantSweep.sufficient &&
            sweepDeltaPass &&
            sweepAbsolutePass,
          variant: variantSweep
        });
      }

      const oblique = lightingFrames.find((frame) => frame.id === "oblique");
      expect(oblique).toBeTruthy();
      const alphaPass = motionMetrics.every((metric) =>
        metric.alphaDeltaFromBaseline <= CLOUD_ALPHA_DELTA_LIMIT &&
        metric.alphaEdgeDriftFromBaseline <= 1 &&
        (metric.forwardReverseAlphaDelta === null ||
          metric.forwardReverseAlphaDelta <= CLOUD_ALPHA_DELTA_LIMIT) &&
        (metric.forwardReverseEdgeDrift === null ||
          metric.forwardReverseEdgeDrift <= 1)
      );
      const budgetPass = telemetrySamples.every((telemetry) =>
        telemetry.fragmentTextureReads === expectedTextureReads &&
        telemetry.viewSteps === expectedViewSteps &&
        telemetry.sunSteps === 1 &&
        telemetry.densityIntegration === "front-to-back" &&
        telemetry.premultipliedAlpha &&
        telemetry.temporalJitter === false &&
        telemetry.scatteringModel === "hg-ms-v1" &&
        telemetry.scatteringCandidateId === candidate.id &&
        telemetry.phaseG === candidate.g &&
        telemetry.multiScatterStrength === candidate.multiScatter
      );
      const visualPass = Boolean(
        oblique &&
        oblique.variant.topCount >= 40 &&
        oblique.variant.sideCount >= 40 &&
        oblique.variant.undersideCount >= 40 &&
        oblique.topSideRatio >= 1.25 &&
        oblique.sideUndersideRatio >= 1.12 &&
        oblique.contrastGainPercent >= 12 &&
        lightingFrames.every((frame) => frame.variant.p99 <= 250)
      );
      const gpuPass = tier !== "desktop" || gpuScenarios.every((scenario) => scenario.pass);
      const baselineBlocked = tier === "desktop" &&
        gpuScenarios.length > 0 &&
        gpuScenarios.some((scenario) => scenario.baselineBlocked) &&
        gpuScenarios.every((scenario) =>
          scenario.pass || scenario.baselineBlocked
        );
      const score = oblique
        ? 0.45 * scoreNormalizedRatio(oblique.topSideRatio, 1.25) +
          0.30 * scoreNormalizedRatio(oblique.sideUndersideRatio, 1.12) +
          0.25 * scoreNormalizedPercent(oblique.contrastGainPercent, 12)
        : 0;

      candidateResults.push({
        candidate,
        eligible: alphaPass && budgetPass && visualPass && gpuPass,
        gates: {
          alphaPass,
          baselineBlocked,
          budgetPass,
          gpuPass,
          visualPass
        },
        gpuScenarios,
        lightingFrames,
        motionMetrics,
        score
      });
    }

    const eligibleCandidates = candidateResults
      .filter((candidate) => candidate.eligible)
      .sort((left, right) => right.score - left.score ||
        left.candidate.id.localeCompare(right.candidate.id));
    const winner = eligibleCandidates[0] ?? null;
    const tierVerdict = winner
      ? "pass"
      : candidateResults.some((candidate) =>
          candidate.gates.alphaPass &&
          candidate.gates.budgetPass &&
          candidate.gates.visualPass &&
          candidate.gates.baselineBlocked
        )
        ? "blocked-by-baseline"
        : "reject";

    const telemetryEvidence = await readCloudEvidence("cloud-scattering-telemetry.json");
    const telemetryTiers = telemetryEvidence.tiers ?? {};
    telemetryTiers[tier] = {
      candidateResults,
      gateLimits: {
        alphaDelta: CLOUD_ALPHA_DELTA_LIMIT,
        alphaEdgeDriftPx: 1,
        desktopGpuAbsoluteMs: CLOUD_GPU_ABSOLUTE_LIMIT_MS,
        desktopGpuDeltaMs: CLOUD_GPU_DELTA_LIMIT_MS,
        gpuMinimumSamples: CLOUD_GPU_MINIMUM_SAMPLES,
        p99: 250,
        sideUndersideRatio: 1.12,
        topSideRatio: 1.25
      },
      motionSequence: CLOUD_MOTION_SEQUENCE,
      scoringFormula:
        "0.45 * normalizedTopSideSeparation + 0.30 * normalizedSideBottomSeparation + 0.25 * normalizedInternalContrastGain",
      verdict: tierVerdict,
      winner: winner
        ? { id: winner.candidate.id, score: winner.score }
        : null
    };
    await writeFile(
      path.join(evidenceDir, "cloud-scattering-telemetry.json"),
      `${JSON.stringify({ ...telemetryEvidence, tiers: telemetryTiers }, null, 2)}\n`
    );

    const candidateEvidence = await readCloudEvidence("cloud-scattering-candidates.json");
    const candidateTiers = candidateEvidence.tiers ?? {};
    candidateTiers[tier] = {
      candidates: candidateResults.map((candidate) => ({
        candidate: candidate.candidate,
        eligible: candidate.eligible,
        gates: candidate.gates,
        score: candidate.score
      })),
      winner: winner
        ? { id: winner.candidate.id, score: winner.score }
        : null
    };
    await writeFile(
      path.join(evidenceDir, "cloud-scattering-candidates.json"),
      `${JSON.stringify({ ...candidateEvidence, tiers: candidateTiers }, null, 2)}\n`
    );

    expect(candidateResults).toHaveLength(RELIEF_SCATTERING_CANDIDATES.length);
    expect(candidateResults.every((candidate) => candidate.gates.budgetPass)).toBe(true);
  });
});
