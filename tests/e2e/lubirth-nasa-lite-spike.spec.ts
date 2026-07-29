import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";
import path from "node:path";
import {
  LANDING_NASA_LITE_ATMOSPHERE_RADIUS_SCALE,
  LANDING_NASA_LITE_CLOUD_TOP_SCALE,
  LUBIRTH_NASA_LITE_DESKTOP_ASSETS,
  getLandingAssetBudget
} from "../../packages/lubirth-hero/src";
import { resolveLandingNasaLiteBand } from "../../packages/lubirth-hero/src/landingNasaLitePolicy";

test.setTimeout(120_000);

interface GpuTimerSnapshot {
  lastMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  sampleCount: number;
  supported: boolean;
}

interface CloudTelemetry {
  active: boolean;
  activeLightTextureReads: number;
  activeTextureReads: number;
  activeViewTextureReads: number;
  band: "far" | "middle" | "near";
  cloudLightSamples: 0 | 1;
  cloudBottomScale: number;
  cloudOffset: number;
  cloudTopScale: number;
  cloudViewSteps: 1 | 2 | 4;
  estimatedActiveTextureBytes: number;
  gpuTimer: GpuTimerSnapshot;
  lodBlend: number;
  mobile: boolean;
  pendingCloudLightSamples: 0 | 1 | null;
  pendingCloudViewSteps: 1 | 2 | 4 | null;
  previousCloudLightSamples: 0 | 1;
  previousCloudViewSteps: 1 | 2 | 4;
  projectedRadiusRatio: number;
  requestedCloudLightSamples: 0 | 1;
  requestedCloudViewSteps: 1 | 2 | 4;
  rendererTextureCount: number;
  shellCount: number;
  steadyTextureReads: number;
  textureSource?: string;
  textureUuid?: string;
  transitioning: boolean;
}

interface AtmosphereTelemetry {
  active: boolean;
  atmosphereRadiusScale: number;
  band: "far" | "middle" | "near";
  geometryHeightSegments: number;
  geometryWidthSegments: number;
  gpuTimer: GpuTimerSnapshot;
  mobile: boolean;
  opticalThicknessScale: number;
  projectedRadiusRatio: number;
  screenLightDirection: [number, number];
  supportRadiusScale: number;
  viewSteps: 1 | 2 | 4;
}

declare global {
  interface Window {
    __MiraLithHomeProjectionFrame?: {
      earthHorizonPath: string;
      height: number;
      width: number;
    };
    __MiraLithLuBirthDirectionalAtmosphere?: AtmosphereTelemetry;
    __MiraLithLuBirthGroundCloudFieldTextureUuid?: string;
    __MiraLithLuBirthGroundCloudShadowActive?: boolean;
    __MiraLithLuBirthNasaLiteCloud?: CloudTelemetry;
    __MiraLithLuBirthNasaLiteBudgetOverride?: {
      atmosphereLightScreenSide?: -1 | 1;
      atmosphereSteps?: 1 | 2 | 4;
      cloudLightSamples?: 0 | 1;
      cloudOffset?: number;
      cloudOpacityScale?: number;
      cloudViewSteps?: 1 | 2 | 4;
    };
    __MiraLithLuBirthProjectedEarthLighting?: {
      center: [number, number];
      progress: number;
      radius: number;
      sunDirection: [number, number];
    };
    __MiraLithLuBirthMoonPhase?: {
      illumination: number;
      phaseAngleRad: number;
    };
    __MiraLithLuBirthVisualPolicy?: {
      atmosphereMode: string;
      cloudMode: string;
      groundShadow: boolean;
      postEffectMode: string;
    };
    __MiraLithOpeningProgress?: number;
  }
}

const BASE_SPIKE_PARAMS = {
  atmosphereMode: "directional-lite",
  cloud: "nasa-lite",
  copy: "hidden",
  location: "birth",
  moonPhase: "birth",
  nasaLiteGpuTimer: "on",
  postEffect: "off",
  progress: "0",
  quality: "high",
  sunDate: "1993-08-01T03:03:00Z",
  visualTest: "pixels"
};

function createSpikeUrl(overrides: Record<string, string> = {}) {
  return `/?${new URLSearchParams({ ...BASE_SPIKE_PARAMS, ...overrides }).toString()}`;
}

const SPIKE_URL = createSpikeUrl();
const HORIZON_CLOUD_OFFSET = 0.18;

async function waitForCloud(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-runtime", "ready", {
    timeout: 25_000
  });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthNasaLiteCloud), {
      timeout: 25_000
    })
    .toMatchObject({ active: true, shellCount: 1 });
}

async function waitForSpike(page: import("@playwright/test").Page) {
  await waitForCloud(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthDirectionalAtmosphere), {
      timeout: 25_000
    })
    .toMatchObject({ active: true });
}

async function waitForAtmosphere(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-runtime", "ready", {
    timeout: 25_000
  });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthDirectionalAtmosphere), {
      timeout: 25_000
    })
    .toMatchObject({ active: true });
}

async function readCanvasRasterState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    return {
      antialias: context?.getContextAttributes()?.antialias ?? false,
      pixelRatio: canvas && canvas.clientWidth > 0
        ? canvas.width / canvas.clientWidth
        : 0
    };
  });
}

async function samplePhysicalHorizonEdge(
  page: import("@playwright/test").Page,
  screenshot: Buffer
) {
  return page.evaluate(async (base64) => {
    const lighting = window.__MiraLithLuBirthProjectedEarthLighting;
    if (!lighting) {
      return null;
    }

    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const sample = document.createElement("canvas");
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const scaleX = sample.width / window.innerWidth;
    const scaleY = sample.height / window.innerHeight;
    const [centerCssX, centerCssY] = lighting.center;
    const centerX = centerCssX * scaleX;
    const centerY = centerCssY * scaleY;
    const radius = lighting.radius * 1.014 * ((scaleX + scaleY) * 0.5);
    const luminance = (x: number, y: number) => {
      const sampleX = Math.max(0, Math.min(sample.width - 1, Math.round(x)));
      const sampleY = Math.max(0, Math.min(sample.height - 1, Math.round(y)));
      const index = (sampleY * sample.width + sampleX) * 4;
      return (
        0.2126 * (pixels[index] ?? 0) +
        0.7152 * (pixels[index + 1] ?? 0) +
        0.0722 * (pixels[index + 2] ?? 0)
      );
    };
    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    };
    const smoothedLuminance = (x: number, y: number) => {
      const values: number[] = [];
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          values.push(luminance(x + offsetX, y + offsetY));
        }
      }
      return median(values);
    };
    const edges: Array<{ expected: number; y: number }> = [];
    for (let index = 0; index <= 180; index += 1) {
      const horizontal = (-0.78 + 1.56 * index / 180) * radius;
      const x = centerX + horizontal;
      const expected = centerY - Math.sqrt(Math.max(0, radius * radius - horizontal * horizontal));
      const background = smoothedLuminance(x, expected - 22);
      let edgeY: number | null = null;
      for (
        let y = Math.floor(expected - 12);
        y <= Math.ceil(expected + 24);
        y += 1
      ) {
        const currentDelta = Math.abs(smoothedLuminance(x, y) - background);
        const nextDelta = Math.abs(smoothedLuminance(x, y + 1) - background);
        if (currentDelta > 3.2 && nextDelta > 3.2) {
          edgeY = y;
          break;
        }
      }
      if (edgeY !== null) {
        edges.push({ expected, y: edgeY });
      }
    }

    const adjacentErrors = edges.slice(1).map((edge, index) => Math.abs(
      (edge.y - (edges[index]?.y ?? edge.y)) -
      (edge.expected - (edges[index]?.expected ?? edge.expected))
    )).sort((a, b) => a - b);
    let longestFlatRun = 0;
    let flatRun = 0;
    let previousY: number | null = null;
    edges.forEach((edge) => {
      flatRun = edge.y === previousY ? flatRun + 1 : 1;
      previousY = edge.y;
      longestFlatRun = Math.max(longestFlatRun, flatRun);
    });

    return {
      deviceScale: scaleX,
      longestFlatRun,
      physicalHeight: sample.height,
      physicalWidth: sample.width,
      p95AdjacentError: adjacentErrors[
        Math.min(adjacentErrors.length - 1, Math.floor(adjacentErrors.length * 0.95))
      ] ?? 0,
      sampleCount: edges.length
    };
  }, screenshot.toString("base64"));
}

async function setOpeningProgress(
  page: import("@playwright/test").Page,
  progress: number,
  expected: {
    atmosphereSteps: 1 | 2 | 4;
    band: "far" | "middle" | "near";
    cloudLightSamples: 0 | 1;
    cloudViewSteps: 1 | 2 | 4;
  }
) {
  await page.evaluate((value) => {
    window.__MiraLithOpeningProgress = value;
  }, progress);
  await expect
    .poll(
      () => page.evaluate(() => ({
        atmosphere: window.__MiraLithLuBirthDirectionalAtmosphere,
        cloud: window.__MiraLithLuBirthNasaLiteCloud
      })),
      { timeout: 15_000 }
    )
    .toMatchObject({
      atmosphere: {
        band: expected.band,
        viewSteps: expected.atmosphereSteps
      },
      cloud: {
        band: expected.band,
        cloudLightSamples: expected.cloudLightSamples,
        cloudViewSteps: expected.cloudViewSteps
      }
    });
  await waitForCloudTransition(
    page,
    expected.cloudViewSteps,
    expected.cloudLightSamples
  );
}

async function sampleDroppedFrameRatio(page: import("@playwright/test").Page, durationMs = 1_600) {
  const deltas = await page.evaluate((duration) => new Promise<number[]>((resolve) => {
    const samples: number[] = [];
    let previous = 0;
    let startedAt = 0;

    const tick = (timestamp: number) => {
      if (startedAt === 0) {
        startedAt = timestamp;
      }
      if (previous !== 0) {
        samples.push(timestamp - previous);
      }
      previous = timestamp;

      if (timestamp - startedAt >= duration) {
        resolve(samples);
        return;
      }
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  }), durationMs);

  return {
    count: deltas.length,
    ratio: deltas.filter((delta) => delta > 25).length / Math.max(deltas.length, 1)
  };
}

async function sampleMoonVisibility(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const centerX = sample.width * 0.5;
    const centerY = sample.height * 0.245;
    const radius = Math.min(sample.width, sample.height) * 0.072;
    const disk: number[] = [];
    const background: number[] = [];

    for (let y = Math.floor(centerY - radius * 1.75); y <= Math.ceil(centerY + radius * 1.75); y += 2) {
      for (let x = Math.floor(centerX - radius * 1.75); x <= Math.ceil(centerX + radius * 1.75); x += 2) {
        const distance = Math.hypot(x - centerX, y - centerY) / radius;
        if (distance > 1.7 || x < 0 || y < 0 || x >= sample.width || y >= sample.height) {
          continue;
        }
        const index = (y * sample.width + x) * 4;
        const luma =
          0.2126 * (pixels[index] ?? 0) +
          0.7152 * (pixels[index + 1] ?? 0) +
          0.0722 * (pixels[index + 2] ?? 0);
        if (distance <= 0.72) {
          disk.push(luma);
        } else if (distance >= 1.28) {
          background.push(luma);
        }
      }
    }

    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) /
      Math.max(values.length, 1);
    const diskMean = mean(disk);
    const backgroundMean = mean(background);
    return {
      backgroundMean,
      contrast: diskMean - backgroundMean,
      diskMean,
      diskSamples: disk.length
    };
  });
}

async function sampleMoonPhaseStructure(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    const phase = window.__MiraLithLuBirthMoonPhase;
    if (!source || !phase) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const centerX = sample.width * 0.5;
    const centerY = sample.height * 0.245;
    const radius = Math.min(sample.width, sample.height) * 0.072;
    const expectedSide = Math.sign(Math.sin(phase.phaseAngleRad)) || 1;
    const expectedLimb: number[] = [];
    const darkCore: number[] = [];
    const oppositeLimb: number[] = [];
    const background: number[] = [];

    for (let y = Math.floor(centerY - radius * 1.7); y <= Math.ceil(centerY + radius * 1.7); y += 1) {
      for (let x = Math.floor(centerX - radius * 1.7); x <= Math.ceil(centerX + radius * 1.7); x += 1) {
        const normalizedX = (x - centerX) / radius;
        const normalizedY = (y - centerY) / radius;
        const distance = Math.hypot(normalizedX, normalizedY);
        if (distance > 1.68 || x < 0 || y < 0 || x >= sample.width || y >= sample.height) {
          continue;
        }
        const index = (y * sample.width + x) * 4;
        const luma =
          0.2126 * (pixels[index] ?? 0) +
          0.7152 * (pixels[index + 1] ?? 0) +
          0.0722 * (pixels[index + 2] ?? 0);
        const signedX = normalizedX * expectedSide;
        if (distance >= 1.28) {
          background.push(luma);
        } else if (distance <= 0.64 && signedX > -0.32 && signedX < 0.22) {
          darkCore.push(luma);
        } else if (
          distance <= 0.98 &&
          signedX >= 0.78 &&
          Math.abs(normalizedY) <= 0.52
        ) {
          expectedLimb.push(luma);
        } else if (
          distance <= 0.98 &&
          signedX <= -0.78 &&
          Math.abs(normalizedY) <= 0.52
        ) {
          oppositeLimb.push(luma);
        }
      }
    }

    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) /
      Math.max(values.length, 1);
    const percentile = (values: number[], position: number) => {
      const sorted = [...values].sort((left, right) => left - right);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))] ?? 0;
    };
    const backgroundMean = mean(background);
    return {
      backgroundMean,
      darkCoreContrast: mean(darkCore) - backgroundMean,
      darkCoreMean: mean(darkCore),
      expectedLimbMean: mean(expectedLimb),
      expectedLimbP90: percentile(expectedLimb, 0.9),
      expectedSide,
      illumination: phase.illumination,
      oppositeLimbMean: mean(oppositeLimb),
      oppositeLimbP90: percentile(oppositeLimb, 0.9),
      sampleCount: Math.min(expectedLimb.length, darkCore.length, oppositeLimb.length)
    };
  });
}

async function setCloudOffset(
  page: import("@playwright/test").Page,
  cloudOffset: number
) {
  await page.evaluate((value) => {
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      ...window.__MiraLithLuBirthNasaLiteBudgetOverride,
      cloudOffset: value
    };
  }, cloudOffset);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthNasaLiteCloud?.cloudOffset))
    .toBeCloseTo(cloudOffset, 4);
  await page.waitForTimeout(160);
}

async function waitForCloudTransition(
  page: import("@playwright/test").Page,
  cloudViewSteps: 1 | 2 | 4,
  cloudLightSamples: 0 | 1 = cloudViewSteps === 1 ? 0 : 1
) {
  const steadyTextureReads = cloudViewSteps + cloudLightSamples;
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthNasaLiteCloud), {
      timeout: 15_000
    })
    .toMatchObject({
      activeLightTextureReads: cloudLightSamples,
      activeTextureReads: steadyTextureReads,
      activeViewTextureReads: cloudViewSteps,
      cloudLightSamples,
      cloudViewSteps,
      lodBlend: 1,
      pendingCloudLightSamples: null,
      pendingCloudViewSteps: null,
      previousCloudLightSamples: cloudLightSamples,
      previousCloudViewSteps: cloudViewSteps,
      requestedCloudLightSamples: cloudLightSamples,
      requestedCloudViewSteps: cloudViewSteps,
      steadyTextureReads,
      transitioning: false
    });
}

async function sampleHorizonContinuity(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const source = document.querySelector("canvas");
    const projection = window.__MiraLithHomeProjectionFrame;
    const lighting = window.__MiraLithLuBirthProjectedEarthLighting;
    if (!source || !projection || !lighting) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const tick = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        window.requestAnimationFrame(() => tick(remaining - 1));
      };
      tick(count);
    });
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      ...window.__MiraLithLuBirthNasaLiteBudgetOverride,
      cloudOpacityScale: 1
    };
    await waitFrames(3);
    const withCloudPixels = capture();
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      ...window.__MiraLithLuBirthNasaLiteBudgetOverride,
      cloudOpacityScale: 0
    };
    await waitFrames(3);
    const withoutCloudPixels = capture();
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      ...window.__MiraLithLuBirthNasaLiteBudgetOverride,
      cloudOpacityScale: 1
    };
    await waitFrames(3);
    const coordinates = projection.earthHorizonPath.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const [centerX, centerY] = lighting.center;
    const luminanceAt = (
      pixels: Uint8ClampedArray,
      x: number,
      y: number
    ) => {
      const values: number[] = [];
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = Math.max(0, Math.min(sample.width - 1, Math.round(x + offsetX)));
          const sampleY = Math.max(0, Math.min(sample.height - 1, Math.round(y + offsetY)));
          const index = (sampleY * sample.width + sampleX) * 4;
          values.push(
            0.2126 * (pixels[index] ?? 0) +
            0.7152 * (pixels[index + 1] ?? 0) +
            0.0722 * (pixels[index + 2] ?? 0)
          );
        }
      }
      values.sort((a, b) => a - b);
      return values[4] ?? 0;
    };
    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    };
    const percentile = (values: number[], position: number) => {
      if (values.length === 0) {
        return 0;
      }
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))] ?? 0;
    };

    const rays: Array<{ extent: number; fragmented: boolean; peak: number; x: number }> = [];
    for (let index = 0; index + 1 < coordinates.length; index += 4) {
      const x = coordinates[index] ?? 0;
      const y = coordinates[index + 1] ?? 0;
      if (
        x < sample.width * 0.06 ||
        x > sample.width * 0.94 ||
        y < sample.height * 0.36 ||
        y > Math.min(sample.height * 0.94, centerY)
      ) {
        continue;
      }
      const distance = Math.max(1, Math.hypot(x - centerX, y - centerY));
      const outwardX = (x - centerX) / distance;
      const outwardY = (y - centerY) / distance;
      const withCloud = Array.from({ length: 26 }, (_, radialIndex) => luminanceAt(
        withCloudPixels,
        x + outwardX * (radialIndex + 1),
        y + outwardY * (radialIndex + 1)
      ));
      const cloudDelta = Array.from({ length: 26 }, (_, radialIndex) => Math.abs(
        withCloud[radialIndex] - luminanceAt(
          withoutCloudPixels,
          x + outwardX * (radialIndex + 1),
          y + outwardY * (radialIndex + 1)
        )
      ));
      const backgroundDelta = median(cloudDelta.slice(19));
      const threshold = Math.max(0.9, backgroundDelta + 0.6);
      const bright = cloudDelta.slice(0, 19).map((value, radialIndex, values) =>
        value > threshold && (
          (values[radialIndex - 1] ?? 0) > threshold ||
          (values[radialIndex + 1] ?? 0) > threshold
        )
      );
      let runs = 0;
      let extent = -1;
      let active = false;
      bright.forEach((value, radialIndex) => {
        if (value && !active) {
          runs += 1;
        }
        if (value) {
          extent = radialIndex;
        }
        active = value;
      });
      rays.push({
        extent,
        fragmented: runs > 1,
        peak: Math.max(...withCloud.slice(0, 19)),
        x
      });
    }

    const cloudRays = rays.filter((ray) => ray.extent >= 0).sort((a, b) => a.x - b.x);
    const jumps = cloudRays.slice(1).map((ray, index) =>
      Math.abs(ray.extent - (cloudRays[index]?.extent ?? ray.extent))
    );
    return {
      brightPeakP95: percentile(cloudRays.map((ray) => ray.peak), 0.95),
      cloudRayCount: cloudRays.length,
      fragmentedRatio: cloudRays.filter((ray) => ray.fragmented).length /
        Math.max(cloudRays.length, 1),
      p95AdjacentExtentJump: percentile(jumps, 0.95),
      rayCount: rays.length
    };
  });
}

async function sampleCloudContribution(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const source = document.querySelector("canvas");
    const lighting = window.__MiraLithLuBirthProjectedEarthLighting;
    if (!source || !lighting) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      const values: number[] = [];
      const left = Math.max(0, Math.floor(centerX - radius * 0.74));
      const right = Math.min(sample.width - 1, Math.ceil(centerX + radius * 0.74));
      const top = Math.max(0, Math.floor(centerY - radius * 0.96));
      const bottom = Math.min(sample.height - 1, Math.ceil(centerY - radius * 0.18));
      for (let y = top; y <= bottom; y += 4) {
        for (let x = left; x <= right; x += 4) {
          const normalizedX = (x - centerX) / Math.max(radius, 1);
          const normalizedY = (y - centerY) / Math.max(radius, 1);
          if (normalizedX * normalizedX + normalizedY * normalizedY > 0.98) {
            continue;
          }
          const index = (y * sample.width + x) * 4;
          values.push(
            0.2126 * (pixels[index] ?? 0) +
            0.7152 * (pixels[index + 1] ?? 0) +
            0.0722 * (pixels[index + 2] ?? 0)
          );
        }
      }
      return values;
    };
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const tick = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        window.requestAnimationFrame(() => tick(remaining - 1));
      };
      tick(count);
    });

    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      ...window.__MiraLithLuBirthNasaLiteBudgetOverride,
      cloudOpacityScale: 0
    };
    await waitFrames(3);
    const withoutCloud = capture();
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      ...window.__MiraLithLuBirthNasaLiteBudgetOverride,
      cloudOpacityScale: 1
    };
    await waitFrames(3);
    const withCloud = capture();
    const differences = withCloud.map((value, index) =>
      Math.abs(value - (withoutCloud[index] ?? value))
    );
    const sorted = [...differences].sort((a, b) => a - b);
    return {
      changedRatio: differences.filter((difference) => difference > 1).length /
        Math.max(differences.length, 1),
      meanAbs: differences.reduce((sum, difference) => sum + difference, 0) /
        Math.max(differences.length, 1),
      p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
      p99: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 0,
      sampleCount: differences.length
    };
  });
}

async function sampleAtmosphereDirection(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    const projection = window.__MiraLithHomeProjectionFrame;
    const lighting = window.__MiraLithLuBirthProjectedEarthLighting;
    const atmosphere = window.__MiraLithLuBirthDirectionalAtmosphere;
    if (!source || !projection || !lighting || !atmosphere) {
      return null;
    }

    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const coordinates = projection.earthHorizonPath.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const [centerX, centerY] = lighting.center;
    const [sunX, sunY] = atmosphere.screenLightDirection;
    const colorAt = (x: number, y: number) => {
      const sampleX = Math.max(0, Math.min(sample.width - 1, Math.round(x)));
      const sampleY = Math.max(0, Math.min(sample.height - 1, Math.round(y)));
      const index = (sampleY * sample.width + sampleX) * 4;
      return [
        pixels[index] ?? 0,
        pixels[index + 1] ?? 0,
        pixels[index + 2] ?? 0
      ] as [number, number, number];
    };
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) /
      Math.max(values.length, 1);
    const day: number[] = [];
    const night: number[] = [];
    const sides: number[] = [];

    for (let index = 0; index + 1 < coordinates.length; index += 4) {
      const x = coordinates[index] ?? 0;
      const y = coordinates[index + 1] ?? 0;
      if (x < sample.width * 0.04 || x > sample.width * 0.96 || y > sample.height * 0.96) {
        continue;
      }
      const distance = Math.max(1, Math.hypot(x - centerX, y - centerY));
      const outwardX = (x - centerX) / distance;
      const outwardY = (y - centerY) / distance;
      const side = outwardX * sunX + outwardY * sunY;
      sides.push(side);
      if (Math.abs(side) < 0.3) {
        continue;
      }
      const band = Array.from({ length: 10 }, (_, radialIndex) => {
        const color = colorAt(
          x + outwardX * (radialIndex + 2),
          y + outwardY * (radialIndex + 2)
        );
        return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
      });
      const background = Array.from({ length: 8 }, (_, radialIndex) => {
        const color = colorAt(
          x + outwardX * (radialIndex + 22),
          y + outwardY * (radialIndex + 22)
        );
        return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
      });
      const energy = Math.max(0, mean(band) - mean(background));
      (side > 0 ? day : night).push(energy);
    }

    const dayMean = mean(day);
    const nightMean = mean(night);
    return {
      dayMean,
      daySamples: day.length,
      nightMean,
      nightSamples: night.length,
      ratio: dayMean / Math.max(nightMean, 0.1),
      sideMax: Math.max(...sides),
      sideMin: Math.min(...sides),
      sunDirection: atmosphere.screenLightDirection
    };
  });
}

async function measureLodTransition(
  page: import("@playwright/test").Page,
  sequence: "downshift" | "rapid-reverse" = "downshift"
) {
  return page.evaluate((transitionSequence) => new Promise<{
    finalCloudViewSteps: number;
    finalPreviousCloudViewSteps: number;
    finalTransitioning: boolean;
    frameCount: number;
    maxActiveTextureReads: number;
    maxFrameMad: number;
    p95FrameMad: number;
    sawQueuedTarget: boolean;
    totalMad: number;
  }>((resolve) => {
    const source = document.querySelector("canvas");
    const lighting = window.__MiraLithLuBirthProjectedEarthLighting;
    if (!source || !lighting) {
      resolve({
        finalCloudViewSteps: 0,
        finalPreviousCloudViewSteps: 0,
        finalTransitioning: true,
        frameCount: 0,
        maxActiveTextureReads: 0,
        maxFrameMad: 1,
        p95FrameMad: 1,
        sawQueuedTarget: false,
        totalMad: 1
      });
      return;
    }
    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      resolve({
        finalCloudViewSteps: 0,
        finalPreviousCloudViewSteps: 0,
        finalTransitioning: true,
        frameCount: 0,
        maxActiveTextureReads: 0,
        maxFrameMad: 1,
        p95FrameMad: 1,
        sawQueuedTarget: false,
        totalMad: 1
      });
      return;
    }
    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      const values: number[] = [];
      const left = Math.max(0, Math.floor(centerX - radius * 0.72));
      const right = Math.min(sample.width - 1, Math.ceil(centerX + radius * 0.72));
      const top = Math.max(0, Math.floor(centerY - radius * 0.98));
      const bottom = Math.min(sample.height - 1, Math.ceil(centerY - radius * 0.28));
      for (let y = top; y <= bottom; y += 7) {
        for (let x = left; x <= right; x += 7) {
          const index = (y * sample.width + x) * 4;
          values.push(
            0.2126 * (pixels[index] ?? 0) +
            0.7152 * (pixels[index + 1] ?? 0) +
            0.0722 * (pixels[index + 2] ?? 0)
          );
        }
      }
      return values;
    };
    const difference = (left: number[], right: number[]) => left.reduce(
      (sum, value, index) => sum + Math.abs(value - (right[index] ?? value)),
      0
    ) / Math.max(left.length, 1) / 255;
    const start = capture();
    let previous = start;
    const frameDiffs: number[] = [];
    let frames = 0;
    let maxActiveTextureReads = 0;
    let reverseRequested = false;
    let sawQueuedTarget = false;
    window.__MiraLithLuBirthNasaLiteBudgetOverride = transitionSequence === "rapid-reverse"
      ? { cloudLightSamples: 1, cloudViewSteps: 2 }
      : { cloudLightSamples: 0, cloudViewSteps: 1 };

    const tick = () => {
      window.requestAnimationFrame(() => {
        const current = capture();
        frameDiffs.push(difference(previous, current));
        previous = current;
        frames += 1;
        const cloud = window.__MiraLithLuBirthNasaLiteCloud;
        maxActiveTextureReads = Math.max(
          maxActiveTextureReads,
          cloud?.activeTextureReads ?? 0
        );
        if (
          transitionSequence === "rapid-reverse" &&
          !reverseRequested &&
          cloud?.cloudViewSteps === 2 &&
          cloud.transitioning &&
          cloud.lodBlend >= 0.18
        ) {
          window.__MiraLithLuBirthNasaLiteBudgetOverride = {
            cloudLightSamples: 1,
            cloudViewSteps: 4
          };
          reverseRequested = true;
        }
        if (cloud?.pendingCloudViewSteps === 4) {
          sawQueuedTarget = true;
        }
        const stableTarget = transitionSequence === "rapid-reverse" ? 4 : 1;
        const finished = frames >= 4 &&
          cloud?.cloudViewSteps === stableTarget &&
          cloud.previousCloudViewSteps === stableTarget &&
          !cloud.transitioning;
        if (finished || frames >= 140) {
          const sorted = [...frameDiffs].sort((a, b) => a - b);
          resolve({
            finalCloudViewSteps: cloud?.cloudViewSteps ?? 0,
            finalPreviousCloudViewSteps: cloud?.previousCloudViewSteps ?? 0,
            finalTransitioning: cloud?.transitioning ?? true,
            frameCount: frames,
            maxActiveTextureReads,
            maxFrameMad: frameDiffs.length > 0 ? Math.max(...frameDiffs) : 1,
            p95FrameMad: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 1,
            sawQueuedTarget,
            totalMad: difference(start, current)
          });
          return;
        }
        tick();
      });
    };
    tick();
  }), sequence);
}

test("keeps the Nasa-lite budget resolver stable at hysteresis boundaries", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Pure policy check only needs one project.");

  expect(resolveLandingNasaLiteBand(0.65)).toBe("near");
  expect(resolveLandingNasaLiteBand(0.64, "near")).toBe("near");
  expect(resolveLandingNasaLiteBand(0.59, "near")).toBe("middle");
  expect(resolveLandingNasaLiteBand(0.21, "far")).toBe("far");
  expect(resolveLandingNasaLiteBand(0.31, "far")).toBe("middle");
  expect(LANDING_NASA_LITE_CLOUD_TOP_SCALE).toBeLessThan(
    LANDING_NASA_LITE_ATMOSPHERE_RADIUS_SCALE
  );
  expect(
    LANDING_NASA_LITE_ATMOSPHERE_RADIUS_SCALE - LANDING_NASA_LITE_CLOUD_TOP_SCALE
  ).toBeGreaterThanOrEqual(0.0015);

  const assetBudgets = new Map(
    getLandingAssetBudget(LUBIRTH_NASA_LITE_DESKTOP_ASSETS)
      .map((asset) => [asset.id, asset.bytesBudget])
  );
  expect(assetBudgets.get("earth-day-nasa-lite-4k")).toBe(800_000);
  expect(assetBudgets.get("earth-cloud-field-nasa-lite-2k")).toBe(6_100_000);
  expect(statSync(path.join(
    process.cwd(),
    "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png"
  )).size).toBeLessThanOrEqual(assetBudgets.get("earth-cloud-field-nasa-lite-2k") ?? 0);

  const reliefAssetBudgets = new Map(
    getLandingAssetBudget({
      earthCloudField: {
        id: "earth-cloud-field-relief-lite-2k",
        src: "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.ktx2",
        width: 2048,
        height: 1024,
        format: "ktx2",
        colorSpace: "linear"
      }
    })
      .map((asset) => [asset.id, asset.bytesBudget])
  );
  expect(reliefAssetBudgets.get("earth-cloud-field-relief-lite-2k")).toBe(2_500_000);
  expect(statSync(path.join(
    process.cwd(),
    "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.ktx2"
  )).size).toBeLessThanOrEqual(reliefAssetBudgets.get("earth-cloud-field-relief-lite-2k") ?? 0);

  const defaultAssetBudgets = new Map(
    getLandingAssetBudget()
      .map((asset) => [asset.id, asset.bytesBudget])
  );
  expect(defaultAssetBudgets.get("earth-cloud-field-home")).toBe(1_600_000);
  expect(statSync(path.join(
    process.cwd(),
    "apps/site/public/assets/lubirth/textures/earth-cloud-field-home.png"
  )).size).toBeLessThanOrEqual(defaultAssetBudgets.get("earth-cloud-field-home") ?? 0);
});

test("runs desktop Nasa-lite at 4/2/1 without reallocating the packed field", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop budget is verified in the desktop project.");

  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });

  await page.goto(SPIKE_URL);
  await page.waitForLoadState("networkidle");
  await waitForSpike(page);

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVisualPolicy))
    .toMatchObject({
      atmosphereMode: "directional-lite",
      cloudMode: "nasa-lite",
      groundShadow: true,
      postEffectMode: "off"
    });

  await setOpeningProgress(page, 0, {
    atmosphereSteps: 4,
    band: "near",
    cloudLightSamples: 1,
    cloudViewSteps: 4
  });
  const near = await page.evaluate(() => ({
    atmosphere: window.__MiraLithLuBirthDirectionalAtmosphere!,
    cloud: window.__MiraLithLuBirthNasaLiteCloud!,
    groundShadow: window.__MiraLithLuBirthGroundCloudShadowActive,
    groundTextureUuid: window.__MiraLithLuBirthGroundCloudFieldTextureUuid
  }));
  expect(near.cloud.mobile).toBe(false);
  expect(near.cloud.cloudTopScale).toBeLessThan(near.atmosphere.atmosphereRadiusScale);
  expect(near.atmosphere.supportRadiusScale).toBeGreaterThan(
    near.atmosphere.atmosphereRadiusScale
  );
  expect(near.cloud.textureSource).toBe(
    "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png"
  );
  expect(near.cloud.estimatedActiveTextureBytes).toBeLessThanOrEqual(11_200_000);
  expect(near.cloud.rendererTextureCount).toBeLessThanOrEqual(8);
  expect(near.cloud.textureUuid).toBeTruthy();
  expect(near.groundShadow).toBe(true);
  expect(near.groundTextureUuid).toBe(near.cloud.textureUuid);
  expect(typeof near.cloud.gpuTimer.supported).toBe("boolean");
  expect(typeof near.atmosphere.gpuTimer.supported).toBe("boolean");
  const desktopRaster = await readCanvasRasterState(page);
  expect(desktopRaster.antialias).toBe(true);
  expect(desktopRaster.pixelRatio).toBeGreaterThanOrEqual(0.99);
  expect(desktopRaster.pixelRatio).toBeLessThanOrEqual(1.01);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-cloud-mode",
    "nasa-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-atmosphere-mode",
    "directional-lite"
  );
  await testInfo.attach("nasa-lite-near-desktop", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await setOpeningProgress(page, 0.5, {
    atmosphereSteps: 2,
    band: "middle",
    cloudLightSamples: 1,
    cloudViewSteps: 2
  });
  const middleUuid = await page.evaluate(
    () => window.__MiraLithLuBirthNasaLiteCloud?.textureUuid
  );
  expect(middleUuid).toBe(near.cloud.textureUuid);
  await testInfo.attach("nasa-lite-middle-desktop", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await setOpeningProgress(page, 1, {
    atmosphereSteps: 1,
    band: "far",
    cloudLightSamples: 0,
    cloudViewSteps: 1
  });
  const farUuid = await page.evaluate(
    () => window.__MiraLithLuBirthNasaLiteCloud?.textureUuid
  );
  expect(farUuid).toBe(near.cloud.textureUuid);
  await testInfo.attach("nasa-lite-far-desktop", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await setOpeningProgress(page, 0, {
    atmosphereSteps: 4,
    band: "near",
    cloudLightSamples: 1,
    cloudViewSteps: 4
  });
  const frameStats = await sampleDroppedFrameRatio(page);
  testInfo.annotations.push({
    type: "nasa-lite-perf",
    description: `near dropped-frame ratio=${frameStats.ratio.toFixed(3)} over ${frameStats.count} frames`
  });
  // Headless Chromium uses software WebGL in CI, so this is only a liveness signal.
  // Promotion performance remains gated by the optional GPU timer and a physical device run.
  expect(frameStats.count).toBeGreaterThanOrEqual(8);
  if (process.env.LUBIRTH_NASA_LITE_PERF_STRICT === "1") {
    expect(frameStats.count).toBeGreaterThanOrEqual(45);
    expect(frameStats.ratio).toBeLessThanOrEqual(0.12);
  }

  await page.goto(createSpikeUrl({ sunDate: "1993-08-01T15:03:00Z" }));
  await waitForSpike(page);
  await waitForCloudTransition(page, 4, 1);
  await testInfo.attach("nasa-lite-backlit-birth-desktop", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
  expect(failures).toEqual([]);
});

test("keeps the birth Moon and low-phase earthshine readable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Moon pixels use the desktop reference viewport.");

  await page.goto(SPIKE_URL);
  await waitForSpike(page);
  await page.waitForTimeout(650);
  const birthMoon = await sampleMoonVisibility(page);
  expect(birthMoon).not.toBeNull();
  expect(birthMoon!.diskSamples).toBeGreaterThan(300);
  expect(birthMoon!.contrast).toBeGreaterThan(18);

  await page.goto(createSpikeUrl({
    moonDate: "2026-07-16T00:00:00Z",
    moonPhase: "today"
  }));
  await waitForSpike(page);
  await page.waitForTimeout(650);
  const lowPhaseMoon = await sampleMoonVisibility(page);
  const lowPhaseStructure = await sampleMoonPhaseStructure(page);
  expect(lowPhaseMoon).not.toBeNull();
  expect(lowPhaseStructure).not.toBeNull();
  expect(lowPhaseMoon!.contrast).toBeGreaterThan(3.5);
  expect(lowPhaseMoon!.contrast).toBeLessThan(birthMoon!.contrast * 0.75);
  expect(lowPhaseStructure!.illumination).toBeLessThan(0.05);
  expect(lowPhaseStructure!.sampleCount).toBeGreaterThan(120);
  expect(lowPhaseStructure!.darkCoreContrast).toBeGreaterThan(2.5);
  expect(lowPhaseStructure!.expectedLimbMean).toBeGreaterThan(
    lowPhaseStructure!.oppositeLimbMean + 1.2
  );
  expect(lowPhaseStructure!.expectedLimbP90).toBeGreaterThan(
    lowPhaseStructure!.oppositeLimbP90 + 2
  );
  await testInfo.attach("nasa-lite-low-phase-earthshine-desktop", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("keeps the Nasa-lite horizon, backlight, atmosphere, and LOD transition visually continuous", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Pixel guards use the desktop reference viewport.");

  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });

  const cloudIsolation = {
    atmosphereMode: "surface-glow",
    cloud: "nasa-lite",
    debug: "clouds",
    profile: "nasa"
  };
  await page.goto(createSpikeUrl(cloudIsolation));
  await waitForCloud(page);
  await setCloudOffset(page, HORIZON_CLOUD_OFFSET);
  await page.waitForTimeout(650);
  const dayHorizon = await sampleHorizonContinuity(page);
  const dayCloudContribution = await sampleCloudContribution(page);
  expect(dayHorizon).not.toBeNull();
  expect(dayCloudContribution).not.toBeNull();
  expect(dayHorizon!.rayCount).toBeGreaterThan(12);
  expect(dayHorizon!.cloudRayCount).toBeGreaterThan(4);
  expect(dayHorizon!.fragmentedRatio).toBeLessThanOrEqual(0.12);
  expect(dayHorizon!.p95AdjacentExtentJump).toBeLessThanOrEqual(8);
  expect(dayHorizon!.brightPeakP95).toBeLessThanOrEqual(220);
  expect(dayCloudContribution!.sampleCount).toBeGreaterThan(2_000);
  expect(dayCloudContribution!.changedRatio).toBeGreaterThan(0.01);
  expect(dayCloudContribution!.meanAbs).toBeGreaterThan(0.08);
  expect(dayCloudContribution!.p95).toBeGreaterThan(0.35);
  await testInfo.attach("nasa-lite-horizon-day", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await page.goto(createSpikeUrl({
    ...cloudIsolation,
    sunDate: "1993-08-01T15:03:00Z"
  }));
  await waitForCloud(page);
  await setCloudOffset(page, HORIZON_CLOUD_OFFSET);
  await page.waitForTimeout(650);
  const backlitHorizon = await sampleHorizonContinuity(page);
  const backlitCloudContribution = await sampleCloudContribution(page);
  expect(backlitHorizon).not.toBeNull();
  expect(backlitCloudContribution).not.toBeNull();
  expect(backlitHorizon!.rayCount).toBeGreaterThan(12);
  expect(backlitHorizon!.cloudRayCount).toBeGreaterThan(4);
  expect(backlitHorizon!.fragmentedRatio).toBeLessThanOrEqual(0.12);
  expect(backlitHorizon!.brightPeakP95).toBeLessThanOrEqual(130);
  expect(backlitCloudContribution!.sampleCount).toBeGreaterThan(2_000);
  expect(backlitCloudContribution!.changedRatio).toBeGreaterThan(0.006);
  expect(backlitCloudContribution!.meanAbs).toBeGreaterThan(0.05);
  expect(backlitCloudContribution!.p95).toBeGreaterThan(0.2);
  await testInfo.attach("nasa-lite-horizon-backlit", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await page.goto(createSpikeUrl({
    cloud: "surface",
    debug: "",
    atmosphereMode: "directional-lite"
  }));
  await waitForAtmosphere(page);
  await page.evaluate(() => {
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      atmosphereLightScreenSide: 1,
      atmosphereSteps: 4
    };
  });
  await expect
    .poll(() => page.evaluate(() => {
      const direction = window.__MiraLithLuBirthDirectionalAtmosphere?.screenLightDirection;
      return direction ? Math.abs(direction[0] - 1) + Math.abs(direction[1]) : 1;
    }))
    .toBeLessThan(0.01);
  await page.waitForTimeout(650);
  const atmosphere = await sampleAtmosphereDirection(page);
  expect(atmosphere).not.toBeNull();
  expect(atmosphere!.daySamples).toBeGreaterThan(5);
  expect(atmosphere!.nightSamples).toBeGreaterThan(5);
  expect(atmosphere!.dayMean).toBeGreaterThan(0.7);
  expect(atmosphere!.ratio).toBeGreaterThanOrEqual(1.35);
  await testInfo.attach("nasa-lite-directional-atmosphere", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await page.goto(createSpikeUrl(cloudIsolation));
  await waitForCloud(page);
  await page.evaluate(() => {
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      cloudLightSamples: 1,
      cloudViewSteps: 2
    };
  });
  await waitForCloudTransition(page, 2);
  const lodTransition = await measureLodTransition(page);
  expect(lodTransition.frameCount).toBeGreaterThanOrEqual(4);
  expect(lodTransition.finalCloudViewSteps).toBe(1);
  expect(lodTransition.finalPreviousCloudViewSteps).toBe(1);
  expect(lodTransition.finalTransitioning).toBe(false);
  expect(lodTransition.maxActiveTextureReads).toBe(4);
  expect(lodTransition.maxFrameMad).toBeLessThanOrEqual(0.035);
  expect(lodTransition.p95FrameMad).toBeLessThanOrEqual(0.028);
  expect(lodTransition.totalMad).toBeLessThanOrEqual(0.12);
  expect(lodTransition.totalMad).toBeGreaterThan(0.0002);

  await page.evaluate(() => {
    window.__MiraLithLuBirthNasaLiteBudgetOverride = {
      cloudLightSamples: 1,
      cloudViewSteps: 4
    };
  });
  await waitForCloudTransition(page, 4, 1);
  const rapidReverse = await measureLodTransition(page, "rapid-reverse");
  expect(rapidReverse.frameCount).toBeGreaterThanOrEqual(8);
  expect(rapidReverse.sawQueuedTarget).toBe(true);
  expect(rapidReverse.finalCloudViewSteps).toBe(4);
  expect(rapidReverse.finalPreviousCloudViewSteps).toBe(4);
  expect(rapidReverse.finalTransitioning).toBe(false);
  expect(rapidReverse.maxActiveTextureReads).toBe(7);
  expect(rapidReverse.maxFrameMad).toBeLessThanOrEqual(0.035);
  expect(rapidReverse.p95FrameMad).toBeLessThanOrEqual(0.028);
  testInfo.annotations.push({
    type: "nasa-lite-transition-cost",
    description: `4→2→4 peak packed-field reads=${rapidReverse.maxActiveTextureReads}`
  });

  expect(failures).toEqual([]);
});

test("uses the mobile 2/1/1 budget and 1K packed field", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-landscape",
    "Mobile budget is verified in the landscape mobile project."
  );

  await page.goto(SPIKE_URL);
  await page.waitForLoadState("networkidle");
  await waitForSpike(page);
  await setOpeningProgress(page, 0, {
    atmosphereSteps: 2,
    band: "near",
    cloudLightSamples: 1,
    cloudViewSteps: 2
  });

  const near = await page.evaluate(() => ({
    atmosphere: window.__MiraLithLuBirthDirectionalAtmosphere!,
    cloud: window.__MiraLithLuBirthNasaLiteCloud!
  }));
  expect(near.cloud.mobile).toBe(true);
  expect(near.cloud.textureSource).toBe("/assets/lubirth/textures/earth-cloud-field-home.png");
  expect(near.cloud.estimatedActiveTextureBytes).toBeLessThanOrEqual(2_800_000);
  expect(near.atmosphere.supportRadiusScale).toBeGreaterThan(
    near.atmosphere.atmosphereRadiusScale
  );
  const mobileRaster = await readCanvasRasterState(page);
  expect(mobileRaster.antialias).toBe(true);
  expect(mobileRaster.pixelRatio).toBeGreaterThanOrEqual(0.99);
  expect(mobileRaster.pixelRatio).toBeLessThanOrEqual(1.01);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-cloud-mode",
    "nasa-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-atmosphere-mode",
    "directional-lite"
  );
  const textureUuid = near.cloud.textureUuid;
  const nearScreenshot = await page.screenshot();
  const physicalHorizon = await samplePhysicalHorizonEdge(page, nearScreenshot);
  expect(physicalHorizon).not.toBeNull();
  expect(physicalHorizon!.physicalWidth).toBeGreaterThan(2_000);
  expect(physicalHorizon!.physicalHeight).toBeGreaterThan(1_000);
  expect(physicalHorizon!.deviceScale).toBeGreaterThan(2.5);
  expect(physicalHorizon!.sampleCount).toBeGreaterThan(165);
  expect(physicalHorizon!.longestFlatRun).toBeLessThanOrEqual(8);
  expect(physicalHorizon!.p95AdjacentError).toBeLessThanOrEqual(10);
  await testInfo.attach("nasa-lite-near-mobile-landscape", {
    body: nearScreenshot,
    contentType: "image/png"
  });

  await setOpeningProgress(page, 0.5, {
    atmosphereSteps: 1,
    band: "middle",
    cloudLightSamples: 0,
    cloudViewSteps: 1
  });
  expect(await page.evaluate(() => window.__MiraLithLuBirthNasaLiteCloud?.textureUuid)).toBe(
    textureUuid
  );

  await setOpeningProgress(page, 1, {
    atmosphereSteps: 1,
    band: "far",
    cloudLightSamples: 0,
    cloudViewSteps: 1
  });
  expect(await page.evaluate(() => window.__MiraLithLuBirthNasaLiteCloud?.textureUuid)).toBe(
    textureUuid
  );
  await testInfo.attach("nasa-lite-far-mobile-landscape", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await page.goto(createSpikeUrl({
    progress: "0",
    sunDate: "1993-08-01T15:03:00Z"
  }));
  await waitForSpike(page);
  await setCloudOffset(page, HORIZON_CLOUD_OFFSET);
  const mobileBacklitHorizon = await sampleHorizonContinuity(page);
  const mobileBacklitCloud = await sampleCloudContribution(page);
  expect(mobileBacklitHorizon).not.toBeNull();
  expect(mobileBacklitCloud).not.toBeNull();
  expect(mobileBacklitHorizon!.rayCount).toBeGreaterThan(10);
  expect(mobileBacklitHorizon!.cloudRayCount).toBeGreaterThan(2);
  expect(mobileBacklitHorizon!.fragmentedRatio).toBeLessThanOrEqual(0.2);
  expect(mobileBacklitHorizon!.brightPeakP95).toBeLessThanOrEqual(140);
  expect(mobileBacklitCloud!.sampleCount).toBeGreaterThan(500);
  expect(mobileBacklitCloud!.changedRatio).toBeGreaterThan(0.003);
  expect(mobileBacklitCloud!.meanAbs).toBeGreaterThan(0.008);
  expect(mobileBacklitCloud!.p99).toBeGreaterThan(0.04);
  await testInfo.attach("nasa-lite-backlit-mobile-landscape", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await page.goto(createSpikeUrl({
    moonDate: "2026-07-16T00:00:00Z",
    moonPhase: "today",
    progress: "0"
  }));
  await waitForSpike(page);
  const mobileLowPhaseVisibility = await sampleMoonVisibility(page);
  const mobileLowPhaseStructure = await sampleMoonPhaseStructure(page);
  expect(mobileLowPhaseVisibility).not.toBeNull();
  expect(mobileLowPhaseStructure).not.toBeNull();
  expect(mobileLowPhaseVisibility!.contrast).toBeGreaterThan(2.2);
  expect(mobileLowPhaseStructure!.sampleCount).toBeGreaterThan(50);
  expect(mobileLowPhaseStructure!.darkCoreContrast).toBeGreaterThan(1.5);
  expect(mobileLowPhaseStructure!.expectedLimbMean).toBeGreaterThan(
    mobileLowPhaseStructure!.oppositeLimbMean + 0.6
  );
  expect(mobileLowPhaseStructure!.expectedLimbP90).toBeGreaterThan(
    mobileLowPhaseStructure!.oppositeLimbP90 + 1
  );
  await testInfo.attach("nasa-lite-low-phase-mobile-landscape", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});
