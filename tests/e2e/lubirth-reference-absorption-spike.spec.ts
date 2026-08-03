import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

test("cloud scattering contract keeps the Relief-lite integration bounded", async ({ page }) => {
  const input = {
    location: LOCATIONS[0],
    progress: 0.22,
    quality: "high" as const
  };

  await page.goto(createUrl({ ...input, variant: "baseline" }));
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthReliefCloud), {
      timeout: 25_000
    })
    .toMatchObject({
      active: true,
      densityIntegration: "front-to-back",
      fragmentTextureReads: 4,
      multiScatterStrength: null,
      phaseG: null,
      premultipliedAlpha: true,
      scatteringCandidateId: null,
      scatteringModel: "relief-baseline",
      sunSteps: 1,
      temporalJitter: false,
      viewSteps: 3
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
      fragmentTextureReads: 4,
      multiScatterStrength: 0.28,
      phaseG: 0.72,
      premultipliedAlpha: true,
      scatteringCandidateId: "g072-ms028",
      scatteringModel: "hg-ms-v1",
      sunSteps: 1,
      temporalJitter: false,
      viewSteps: 3
    });
});
