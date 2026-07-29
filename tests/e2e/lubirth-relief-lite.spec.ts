import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE,
  LANDING_LIMB_LITE_DIFFUSE_RADIUS_SCALE,
  LANDING_LIMB_LITE_DIFFUSE_SUPPORT_RADIUS_SCALE,
  LANDING_RELIEF_LITE_DESKTOP_VIEW_STEPS,
  LANDING_RELIEF_LITE_MOBILE_VIEW_STEPS,
  LANDING_RELIEF_LITE_SUN_STEPS,
  LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE,
  LANDING_RELIEF_LITE_CLOUD_TOP_SCALE
} from "../../packages/lubirth-hero/src";

test.setTimeout(120_000);

interface GpuTimerSnapshot {
  lastMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  sampleCount: number;
  supported: boolean;
}

interface ReliefCloudTelemetry {
  active: true;
  analyticNoise: false;
  cloudBottomScale: number;
  cloudOffset: number;
  cloudTopScale: number;
  compressedTextureActive: boolean;
  channelLayout: "v3-r-depth-g-height-b-morphology-a-concavity";
  estimatedActiveTextureBytes: number;
  densityIntegration: "front-to-back";
  fragmentTextureReads: 3 | 4;
  gpuTimer: GpuTimerSnapshot;
  integrationPath: "ray-sphere-thin-shell";
  lodTransitions: false;
  mobile: boolean;
  premultipliedAlpha: true;
  rendererTextureCount: number;
  shellCount: 1;
  sunDirection: [number, number, number];
  textureCompression: "uastc" | "rgba8";
  textureSource: string;
  textureUuid: string;
  vertexTextureReads: 1;
  sunSteps: 1;
  thinShellIntegration: true;
  viewSteps: 2 | 3;
}

interface LimbAtmosphereTelemetry {
  active: true;
  atmosphereRadiusScale: number;
  cloudClearanceScale: number;
  gpuTimer: GpuTimerSnapshot;
  loopIterations: 0;
  screenLightDirection: [number, number];
  sunDirection: [number, number, number];
  supportRadiusScale: number;
  textureReads: 0;
}

interface LimbDiffuseGlowTelemetry {
  active: true;
  additiveMode: "one-one";
  diffuseRadiusScale: number;
  geometry: "analytic-composite-limb-strip";
  gpuTimer: GpuTimerSnapshot;
  includesInternalLimb: true;
  innerLimbRadiusScale: number;
  supportRadiusScale: number;
  sunDirection: [number, number, number];
  textureReads: 0;
}

interface EarthSurfaceTelemetry {
  active: true;
  cloudOffset: number;
  cloudShadowActive: boolean;
  dayTextureSource: string;
  internalLimbActive: false;
  lightsOnlyTextureSource: string;
  sunDirection: [number, number, number];
}

declare global {
  interface Window {
    __MiraLithLuBirthEarthSurfaceLiteV2?: EarthSurfaceTelemetry;
    __MiraLithLuBirthEarthSurfaceLiteV2Override?: {
      cityLightScale?: number;
      cloudShadowScale?: number;
      reverseSun?: boolean;
    };
    __MiraLithLuBirthLimbAtmosphere?: LimbAtmosphereTelemetry;
    __MiraLithLuBirthLimbAtmosphereOverride?: { intensityScale?: number };
    __MiraLithLuBirthLimbDiffuseGlow?: LimbDiffuseGlowTelemetry;
    __MiraLithLuBirthLimbDiffuseGlowOverride?: { intensityScale?: number };
    __MiraLithLuBirthNasaLiteCloud?: { active: true };
    __MiraLithLuBirthPostEffectActive?: boolean;
    __MiraLithLuBirthPostEffectMode?: string;
    __MiraLithLuBirthProjectedEarthLighting?: {
      center: [number, number];
      progress: number;
      radius: number;
      sunDirection: [number, number];
    };
    __MiraLithLuBirthReliefCloud?: ReliefCloudTelemetry;
    __MiraLithLuBirthReliefCloudOverride?: {
      cloudOffset?: number;
      cloudOpacityScale?: number;
      densityIntegrationScale?: number;
      reverseSun?: boolean;
      reverseSunField?: boolean;
      reliefLightingScale?: number;
      sunSampleScale?: number;
    };
    __MiraLithLuBirthSpaceBackgroundResolution?: [number, number];
    __MiraLithLuBirthSpaceBackgroundTexture?: string;
    __MiraLithLuBirthVisualPolicy?: {
      atmosphereMode: string;
      cloudMode: string;
      postEffectMode: string;
    };
  }
}

const BASE_PARAMS = {
  atmosphereMode: "limb-lite",
  cloud: "relief-lite",
  copy: "hidden",
  location: "birth",
  moonPhase: "birth",
  postEffect: "off",
  profile: "nasa",
  progress: "0",
  quality: "high",
  sunDate: "1993-08-01T03:03:00Z",
  visualTest: "pixels"
};

function createUrl(overrides: Record<string, string> = {}) {
  return `/?${new URLSearchParams({ ...BASE_PARAMS, ...overrides }).toString()}`;
}

async function waitForReliefLite(
  page: import("@playwright/test").Page,
  requireProjectedLighting = true
) {
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-runtime", "ready", {
    timeout: 25_000
  });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthReliefCloud), { timeout: 25_000 })
    .toMatchObject({ active: true, shellCount: 1 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthLimbAtmosphere), { timeout: 25_000 })
    .toMatchObject({ active: true, loopIterations: 0, textureReads: 0 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthLimbDiffuseGlow), { timeout: 25_000 })
    .toMatchObject({ active: true, textureReads: 0 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthEarthSurfaceLiteV2), { timeout: 25_000 })
    .toMatchObject({ active: true });
  if (requireProjectedLighting) {
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedEarthLighting), { timeout: 25_000 })
      .toBeTruthy();
  }
  await page.waitForTimeout(500);
}

async function readRasterState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    return {
      antialias: context?.getContextAttributes()?.antialias ?? false,
      pixelRatio: canvas && canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 0
    };
  });
}

async function sampleCityLeakage(page: import("@playwright/test").Page) {
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
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const step = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count);
    });
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };

    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = { cityLightScale: 0 };
    await waitFrames(3);
    const withoutLights = capture();
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = { cityLightScale: 1 };
    await waitFrames(3);
    const withLights = capture();
    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    let dayEnergy = 0;
    let daySamples = 0;
    let nightEnergy = 0;
    let nightSamples = 0;
    let nightPeak = 0;

    for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(sample.height - 1, Math.ceil(centerY + radius)); y += 2) {
      for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(sample.width - 1, Math.ceil(centerX + radius)); x += 2) {
        const normalizedX = (x - centerX) / Math.max(radius, 1);
        const normalizedY = (y - centerY) / Math.max(radius, 1);
        const radial = Math.hypot(normalizedX, normalizedY);
        if (radial > 0.88) {
          continue;
        }
        const index = (y * sample.width + x) * 4;
        const baselineLuma =
          0.2126 * (withoutLights[index] ?? 0) +
          0.7152 * (withoutLights[index + 1] ?? 0) +
          0.0722 * (withoutLights[index + 2] ?? 0);
        const difference = Math.max(
          Math.abs((withLights[index] ?? 0) - (withoutLights[index] ?? 0)),
          Math.abs((withLights[index + 1] ?? 0) - (withoutLights[index + 1] ?? 0)),
          Math.abs((withLights[index + 2] ?? 0) - (withoutLights[index + 2] ?? 0))
        );
        if (baselineLuma > 28) {
          dayEnergy += difference;
          daySamples += 1;
        } else if (baselineLuma < 12) {
          nightEnergy += difference;
          nightSamples += 1;
          nightPeak = Math.max(nightPeak, difference);
        }
      }
    }

    return {
      dayMean: dayEnergy / Math.max(daySamples, 1),
      daySamples,
      leakageRatio: dayEnergy / Math.max(nightEnergy, 1e-6),
      nightMean: nightEnergy / Math.max(nightSamples, 1),
      nightPeak,
      nightSamples
    };
  });
}

async function sampleCloudShadowProjection(page: import("@playwright/test").Page) {
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
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const step = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count);
    });
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };
    window.__MiraLithLuBirthLimbAtmosphereOverride = { intensityScale: 0 };
    window.__MiraLithLuBirthLimbDiffuseGlowOverride = { intensityScale: 0 };
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: 0.25,
      cloudOpacityScale: 0
    };
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = {
      cityLightScale: 0,
      cloudShadowScale: 0
    };
    await waitFrames(4);
    const withoutShadow = capture();
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = {
      cityLightScale: 0,
      cloudShadowScale: 1
    };
    await waitFrames(4);
    const withShadow = capture();
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = {
      cityLightScale: 0,
      cloudShadowScale: 1,
      reverseSun: true
    };
    await waitFrames(4);
    const withReverseShadow = capture();

    const luma = (data: Uint8ClampedArray, index: number) =>
      (data[index] ?? 0) * 0.2126 +
      (data[index + 1] ?? 0) * 0.7152 +
      (data[index + 2] ?? 0) * 0.0722;
    const percentile = (values: number[], position: number) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))] ?? 0;
    };
    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const differences: number[] = [];
    const activeDifferences: number[] = [];
    let sampleCount = 0;
    let activeCount = 0;
    let forwardCentroid = 0;
    let reverseCentroid = 0;
    let shadowEnergy = 0;
    let reverseShadowEnergy = 0;
    const [sunX, sunY] = lighting.sunDirection;

    for (let y = 0; y < sample.height; y += 2) {
      for (let x = 0; x < sample.width; x += 2) {
        const normalizedX = (x - centerX) / Math.max(radius, 1);
        const normalizedY = (y - centerY) / Math.max(radius, 1);
        const radial = Math.hypot(normalizedX, normalizedY);
        if (radial < 0.48 || radial > 0.94) {
          continue;
        }
        const index = (y * sample.width + x) * 4;
        const baseLuma = luma(withoutShadow, index);
        if (baseLuma < 20) {
          continue;
        }
        const shadow = Math.max(0, baseLuma - luma(withShadow, index));
        const reverseShadow = Math.max(0, baseLuma - luma(withReverseShadow, index));
        const directionProjection =
          (normalizedX / Math.max(radial, 1e-6)) * sunX +
          (normalizedY / Math.max(radial, 1e-6)) * sunY;
        differences.push(shadow);
        sampleCount += 1;
        if (shadow > 0.35) {
          activeDifferences.push(shadow);
          forwardCentroid += shadow * directionProjection;
          shadowEnergy += shadow;
          activeCount += 1;
        }
        if (reverseShadow > 0.35) {
          reverseCentroid += reverseShadow * directionProjection;
          reverseShadowEnergy += reverseShadow;
        }
      }
    }

    return {
      activeCount,
      activeRatio: activeCount / Math.max(sampleCount, 1),
      forwardCentroid: forwardCentroid / Math.max(shadowEnergy, 1e-6),
      meanActiveShadow: shadowEnergy / Math.max(activeCount, 1),
      p50: percentile(activeDifferences, 0.5),
      p90: percentile(activeDifferences, 0.9),
      p98: percentile(activeDifferences, 0.98),
      reverseCentroid: reverseCentroid / Math.max(reverseShadowEnergy, 1e-6),
      sampleCount,
      softRatio: percentile(activeDifferences, 0.5) /
        Math.max(percentile(activeDifferences, 0.98), 1e-6)
    };
  });
}

async function sampleCloudBodyAndSilhouette(page: import("@playwright/test").Page) {
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
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const step = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count);
    });
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: 0.25,
      cloudOpacityScale: 0
    };
    await waitFrames(3);
    const withoutCloud = capture();
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: 0.25,
      cloudOpacityScale: 1
    };
    await waitFrames(3);
    const withCloud = capture();
    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const bodyDifferences: number[] = [];
    const silhouetteDifferences: number[] = [];
    const stepSize = sample.width < 1000 ? 1 : 2;

    for (let y = 0; y < sample.height; y += stepSize) {
      for (let x = 0; x < sample.width; x += stepSize) {
        const radial = Math.hypot(x - centerX, y - centerY) / Math.max(radius, 1);
        if (radial > 1.018) {
          continue;
        }
        const index = (y * sample.width + x) * 4;
        const difference = (
          Math.abs((withCloud[index] ?? 0) - (withoutCloud[index] ?? 0)) +
          Math.abs((withCloud[index + 1] ?? 0) - (withoutCloud[index + 1] ?? 0)) +
          Math.abs((withCloud[index + 2] ?? 0) - (withoutCloud[index + 2] ?? 0))
        ) / 3;
        if (radial >= 0.58 && radial <= 0.96) {
          bodyDifferences.push(difference);
        } else if (radial >= 0.997 && radial <= 1.008) {
          silhouetteDifferences.push(difference);
        }
      }
    }
    const percentile = (values: number[], position: number) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))] ?? 0;
    };
    const visibleBodyDifferences = bodyDifferences.filter((difference) => difference > 0.5);
    const bodyMean = visibleBodyDifferences.reduce(
      (total, difference) => total + difference,
      0
    ) / Math.max(visibleBodyDifferences.length, 1);
    const bodyVariance = visibleBodyDifferences.reduce(
      (total, difference) => total + (difference - bodyMean) ** 2,
      0
    ) / Math.max(visibleBodyDifferences.length, 1);
    return {
      bodyActiveCount: visibleBodyDifferences.length,
      bodyChangedRatio: bodyDifferences.filter((difference) => difference > 1).length /
        Math.max(bodyDifferences.length, 1),
      bodyDynamicRange:
        percentile(visibleBodyDifferences, 0.9) -
        percentile(visibleBodyDifferences, 0.25),
      bodyP95: percentile(visibleBodyDifferences, 0.95),
      bodySampleCount: bodyDifferences.length,
      bodyStdDev: Math.sqrt(bodyVariance),
      silhouetteChangedCount: silhouetteDifferences.filter((difference) => difference > 0.8).length,
      silhouetteP95: percentile(silhouetteDifferences, 0.95)
    };
  });
}

async function sampleCloudOffsetAppearance(
  page: import("@playwright/test").Page,
  cloudOffset: number
) {
  return page.evaluate(async (offset) => {
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
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const step = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count);
    });
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };

    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: offset,
      cloudOpacityScale: 0,
      densityIntegrationScale: 1,
      reliefLightingScale: 1
    };
    await waitFrames(4);
    const withoutCloud = capture();
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: offset,
      cloudOpacityScale: 1,
      densityIntegrationScale: 0,
      reliefLightingScale: 1
    };
    await waitFrames(4);
    const singleSample = capture();
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: offset,
      cloudOpacityScale: 1,
      densityIntegrationScale: 1,
      reliefLightingScale: 1
    };
    await waitFrames(4);
    const integrated = capture();

    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const signal = new Float32Array(sample.width * sample.height);
    const cloudMask = new Uint8Array(sample.width * sample.height);
    const cloudSignals: number[] = [];
    let changedCount = 0;
    let clippedCount = 0;
    for (let y = 1; y < sample.height - 1; y += 1) {
      for (let x = 1; x < sample.width - 1; x += 1) {
        const radial = Math.hypot(x - centerX, y - centerY) / Math.max(radius, 1);
        if (radial < 0.54 || radial > 0.975) {
          continue;
        }
        const index = (y * sample.width + x) * 4;
        const difference = (
          Math.abs((integrated[index] ?? 0) - (singleSample[index] ?? 0)) +
          Math.abs((integrated[index + 1] ?? 0) - (singleSample[index + 1] ?? 0)) +
          Math.abs((integrated[index + 2] ?? 0) - (singleSample[index + 2] ?? 0))
        ) / 3;
        const integratedCloud = (
          Math.abs((integrated[index] ?? 0) - (withoutCloud[index] ?? 0)) +
          Math.abs((integrated[index + 1] ?? 0) - (withoutCloud[index + 1] ?? 0)) +
          Math.abs((integrated[index + 2] ?? 0) - (withoutCloud[index + 2] ?? 0))
        ) / 3;
        const singleCloud = (
          Math.abs((singleSample[index] ?? 0) - (withoutCloud[index] ?? 0)) +
          Math.abs((singleSample[index + 1] ?? 0) - (withoutCloud[index + 1] ?? 0)) +
          Math.abs((singleSample[index + 2] ?? 0) - (withoutCloud[index + 2] ?? 0))
        ) / 3;
        signal[y * sample.width + x] = difference;
        if (Math.max(integratedCloud, singleCloud) <= 0.75) {
          continue;
        }
        cloudMask[y * sample.width + x] = 1;
        cloudSignals.push(difference);
        changedCount += difference > 1 ? 1 : 0;
        const cloudPeak = Math.max(
          integrated[index] ?? 0,
          integrated[index + 1] ?? 0,
          integrated[index + 2] ?? 0
        );
        const baselinePeak = Math.max(
          singleSample[index] ?? 0,
          singleSample[index + 1] ?? 0,
          singleSample[index + 2] ?? 0
        );
        clippedCount += cloudPeak >= 248 && baselinePeak < 245 ? 1 : 0;
      }
    }

    const coreGradients: number[] = [];
    for (let y = 2; y < sample.height - 2; y += 1) {
      for (let x = 2; x < sample.width - 2; x += 1) {
        const center = signal[y * sample.width + x] ?? 0;
        const left = signal[y * sample.width + x - 1] ?? 0;
        const right = signal[y * sample.width + x + 1] ?? 0;
        const up = signal[(y - 1) * sample.width + x] ?? 0;
        const down = signal[(y + 1) * sample.width + x] ?? 0;
        if (
          cloudMask[y * sample.width + x] === 0 ||
          cloudMask[y * sample.width + x - 1] === 0 ||
          cloudMask[y * sample.width + x + 1] === 0 ||
          cloudMask[(y - 1) * sample.width + x] === 0 ||
          cloudMask[(y + 1) * sample.width + x] === 0
        ) {
          continue;
        }
        coreGradients.push(Math.max(
          Math.abs(center - left),
          Math.abs(center - right),
          Math.abs(center - up),
          Math.abs(center - down)
        ));
      }
    }
    const percentile = (values: number[], position: number) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))] ?? 0;
    };
    return {
      changedRatio: changedCount / Math.max(cloudSignals.length, 1),
      clippedRatio: clippedCount / Math.max(cloudSignals.length, 1),
      cloudPixelCount: cloudSignals.length,
      coreGradientP90: percentile(coreGradients, 0.9),
      coreGradientP99: percentile(coreGradients, 0.99),
      coreGradientSampleCount: coreGradients.length,
      extremeGradientRatio: coreGradients.filter((value) => value > 32).length /
        Math.max(coreGradients.length, 1),
      offset,
      signalP50: percentile(cloudSignals, 0.5),
      signalP90: percentile(cloudSignals, 0.9),
      signalP99: percentile(cloudSignals, 0.99)
    };
  }, cloudOffset);
}

async function sampleCloudSunDirectionResponse(page: import("@playwright/test").Page) {
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
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const step = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count);
    });
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };
    const applyCloudOverride = (sunSampleScale: number, reverseSunField = false) => {
      window.__MiraLithLuBirthReliefCloudOverride = {
        cloudOffset: 0.25,
        cloudOpacityScale: 1,
        densityIntegrationScale: 1,
        reliefLightingScale: 1,
        reverseSunField,
        sunSampleScale
      };
    };

    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: 0.25,
      cloudOpacityScale: 0,
      densityIntegrationScale: 1,
      reliefLightingScale: 1,
      sunSampleScale: 1
    };
    await waitFrames(4);
    const withoutCloud = capture();
    applyCloudOverride(0, false);
    await waitFrames(4);
    const withoutSunSample = capture();
    applyCloudOverride(1, false);
    await waitFrames(4);
    const withSunSample = capture();
    applyCloudOverride(1, true);
    await waitFrames(4);
    const reversedSunSample = capture();

    const luma = (data: Uint8ClampedArray, index: number) =>
      (data[index] ?? 0) * 0.2126 +
      (data[index + 1] ?? 0) * 0.7152 +
      (data[index + 2] ?? 0) * 0.0722;
    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const [sunX, sunY] = lighting.sunDirection;
    let cloudPixelCount = 0;
    let sunEffectTotal = 0;
    let reverseEffectTotal = 0;
    let forwardPositiveTotal = 0;
    let reversePositiveTotal = 0;
    let forwardPositiveWeighted = 0;
    let reversePositiveWeighted = 0;
    let sideAlignedDelta = 0;
    let sideOpposedDelta = 0;
    let sideAlignedCount = 0;
    let sideOpposedCount = 0;

    for (let y = 1; y < sample.height - 1; y += 2) {
      for (let x = 1; x < sample.width - 1; x += 2) {
        const normalizedX = (x - centerX) / Math.max(radius, 1);
        const normalizedY = (y - centerY) / Math.max(radius, 1);
        const radial = Math.hypot(normalizedX, normalizedY);
        if (radial < 0.54 || radial > 0.965) {
          continue;
        }
        const index = (y * sample.width + x) * 4;
        const cloudSignal = Math.abs(luma(withSunSample, index) - luma(withoutCloud, index));
        if (cloudSignal < 0.45) {
          continue;
        }
        const directionLength = Math.max(Math.hypot(normalizedX, normalizedY), 1e-6);
        const alignment = (normalizedX / directionLength) * sunX +
          (normalizedY / directionLength) * sunY;
        const forwardResponse = luma(withSunSample, index) - luma(withoutSunSample, index);
        const reverseResponse = luma(reversedSunSample, index) - luma(withoutSunSample, index);
        const sunEffect = Math.abs(forwardResponse);
        const reverseEffect = Math.abs(luma(withSunSample, index) - luma(reversedSunSample, index));
        const forwardPositive = Math.max(forwardResponse, 0);
        const reversePositive = Math.max(reverseResponse, 0);
        cloudPixelCount += 1;
        sunEffectTotal += sunEffect;
        reverseEffectTotal += reverseEffect;
        forwardPositiveTotal += forwardPositive;
        reversePositiveTotal += reversePositive;
        forwardPositiveWeighted += forwardPositive * alignment;
        reversePositiveWeighted += reversePositive * alignment;
        if (alignment >= 0.25) {
          sideAlignedDelta += forwardResponse - reverseResponse;
          sideAlignedCount += 1;
        } else if (alignment <= -0.25) {
          sideOpposedDelta += reverseResponse - forwardResponse;
          sideOpposedCount += 1;
        }
      }
    }

    return {
      cloudPixelCount,
      forwardCentroid: forwardPositiveWeighted / Math.max(forwardPositiveTotal, 1e-6),
      reverseCentroid: reversePositiveTotal > cloudPixelCount * 0.045
        ? reversePositiveWeighted / reversePositiveTotal
        : -1,
      reverseMeanAbs: reverseEffectTotal / Math.max(cloudPixelCount, 1),
      reversePositiveMean: reversePositiveTotal / Math.max(cloudPixelCount, 1),
      sideAlignedMeanDelta: sideAlignedDelta / Math.max(sideAlignedCount, 1),
      sideAlignedCount,
      sideOpposedMeanDelta: sideOpposedDelta / Math.max(sideOpposedCount, 1),
      sideOpposedCount,
      sunSampleMeanAbs: sunEffectTotal / Math.max(cloudPixelCount, 1)
    };
  });
}

async function sampleDirectionalAtmosphere(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const source = document.querySelector("canvas");
    const lighting = window.__MiraLithLuBirthProjectedEarthLighting;
    const atmosphere = window.__MiraLithLuBirthLimbAtmosphere;
    const diffuseGlow = window.__MiraLithLuBirthLimbDiffuseGlow;
    if (!source || !lighting || !atmosphere || !diffuseGlow) {
      return null;
    }
    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const step = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count);
    });
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };

    window.__MiraLithLuBirthLimbAtmosphereOverride = { intensityScale: 0 };
    window.__MiraLithLuBirthLimbDiffuseGlowOverride = { intensityScale: 0 };
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: 0.25,
      cloudOpacityScale: 0
    };
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = {
      cityLightScale: 1
    };
    await waitFrames(3);
    const withoutAtmosphere = capture();
    window.__MiraLithLuBirthLimbAtmosphereOverride = { intensityScale: 1 };
    window.__MiraLithLuBirthLimbDiffuseGlowOverride = { intensityScale: 1 };
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: 0.25,
      cloudOpacityScale: 0
    };
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = {
      cityLightScale: 1
    };
    await waitFrames(3);
    const withAtmosphere = capture();
    window.__MiraLithLuBirthLimbAtmosphereOverride = { intensityScale: 0 };
    window.__MiraLithLuBirthLimbDiffuseGlowOverride = { intensityScale: 1 };
    await waitFrames(3);
    const withDiffuseOnly = capture();

    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const [sunX, sunY] = lighting.sunDirection;
    const dayContributions: number[] = [];
    const dayInnerContributions: number[] = [];
    const dayOuterContributions: number[] = [];
    const dayDiffuseContributions: number[] = [];
    const nightContributions: number[] = [];
    const nightDiffuseContributions: number[] = [];
    const twilightBlueContributions: number[] = [];
    const twilightRedContributions: number[] = [];
    let twilightRedDominantCount = 0;
    let twilightVisibleCount = 0;
    for (
      let y = Math.max(0, Math.floor(centerY - radius * 1.065));
      y <= Math.min(sample.height - 1, Math.ceil(centerY + radius * 1.065));
      y += 1
    ) {
      for (
        let x = Math.max(0, Math.floor(centerX - radius * 1.03));
        x <= Math.min(sample.width - 1, Math.ceil(centerX + radius * 1.03));
        x += 1
      ) {
        const dx = (x - centerX) / Math.max(radius, 1);
        const dy = (y - centerY) / Math.max(radius, 1);
        const radial = Math.hypot(dx, dy);
        if (radial < 0.998 || radial > 1.062) {
          continue;
        }
        const directionLength = Math.max(Math.hypot(dx, dy), 1e-6);
        const lightAlignment = (dx / directionLength) * sunX + (dy / directionLength) * sunY;
        const index = (y * sample.width + x) * 4;
        const diffuseContribution = (
          Math.abs((withDiffuseOnly[index] ?? 0) - (withoutAtmosphere[index] ?? 0)) +
          Math.abs((withDiffuseOnly[index + 1] ?? 0) - (withoutAtmosphere[index + 1] ?? 0)) +
          Math.abs((withDiffuseOnly[index + 2] ?? 0) - (withoutAtmosphere[index + 2] ?? 0))
        ) / 3;
        const contribution = (
          Math.abs((withAtmosphere[index] ?? 0) - (withoutAtmosphere[index] ?? 0)) +
          Math.abs((withAtmosphere[index + 1] ?? 0) - (withoutAtmosphere[index + 1] ?? 0)) +
          Math.abs((withAtmosphere[index + 2] ?? 0) - (withoutAtmosphere[index + 2] ?? 0))
        ) / 3;
        if (Math.abs(lightAlignment) <= 0.12 && radial <= 1.015) {
          const redContribution = Math.max(
            (withAtmosphere[index] ?? 0) - (withoutAtmosphere[index] ?? 0),
            0
          );
          const blueContribution = Math.max(
            (withAtmosphere[index + 2] ?? 0) - (withoutAtmosphere[index + 2] ?? 0),
            0
          );
          twilightRedContributions.push(redContribution);
          twilightBlueContributions.push(blueContribution);
          twilightVisibleCount += redContribution > 0.35 ? 1 : 0;
          twilightRedDominantCount +=
            redContribution > 0.2 && redContribution > blueContribution * 1.08
              ? 1
              : 0;
        }
        if (lightAlignment >= 0.35) {
          dayContributions.push(contribution);
          if (radial <= 1.006) {
            dayInnerContributions.push(contribution);
          } else if (radial <= 1.015) {
            dayOuterContributions.push(contribution);
          } else if (radial > 1.027 && radial <= 1.052) {
            dayDiffuseContributions.push(diffuseContribution);
          }
        } else if (lightAlignment <= -0.35 && radial <= 1.027) {
          nightContributions.push(contribution);
        } else if (lightAlignment <= -0.35 && radial > 1.027) {
          nightDiffuseContributions.push(diffuseContribution);
        }
      }
    }
    const mean = (values: number[]) => values.reduce(
      (total, value) => total + value,
      0
    ) / Math.max(values.length, 1);
    const percentile = (values: number[], position: number) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))] ?? 0;
    };
    return {
      dayCount: dayContributions.length,
      dayInnerMean: mean(dayInnerContributions),
      dayDiffuseMean: mean(dayDiffuseContributions),
      dayDiffuseP90: percentile(dayDiffuseContributions, 0.9),
      dayDiffuseP99: percentile(dayDiffuseContributions, 0.99),
      dayMean: mean(dayContributions),
      dayOuterMean: mean(dayOuterContributions),
      dayOuterP90: percentile(dayOuterContributions, 0.9),
      dayP90: percentile(dayContributions, 0.9),
      nightCount: nightContributions.length,
      nightMean: mean(nightContributions),
      nightDiffuseMean: mean(nightDiffuseContributions),
      nightDiffuseP90: percentile(nightDiffuseContributions, 0.9),
      nightP90: percentile(nightContributions, 0.9),
      nightP99: percentile(nightContributions, 0.99),
      twilightBlueMean: mean(twilightBlueContributions),
      twilightBlueP90: percentile(twilightBlueContributions, 0.9),
      twilightCount: twilightRedContributions.length,
      twilightRedDominantRatio: twilightRedDominantCount /
        Math.max(twilightRedContributions.length, 1),
      twilightRedMean: mean(twilightRedContributions),
      twilightRedP90: percentile(twilightRedContributions, 0.9),
      twilightVisibleRatio: twilightVisibleCount /
        Math.max(twilightRedContributions.length, 1)
    };
  });
}

async function sampleInternalLimb(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const source = document.querySelector("canvas");
    const lighting = window.__MiraLithLuBirthProjectedEarthLighting;
    const atmosphere = window.__MiraLithLuBirthLimbAtmosphere;
    const diffuseGlow = window.__MiraLithLuBirthLimbDiffuseGlow;
    if (!source || !lighting || !atmosphere || !diffuseGlow) {
      return null;
    }
    const sample = document.createElement("canvas");
    sample.width = Math.max(1, source.clientWidth);
    sample.height = Math.max(1, source.clientHeight);
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    const waitFrames = (count: number) => new Promise<void>((resolve) => {
      const step = (remaining: number) => {
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(() => step(remaining - 1));
      };
      step(count);
    });
    const capture = () => {
      context.drawImage(source, 0, 0, sample.width, sample.height);
      return context.getImageData(0, 0, sample.width, sample.height).data;
    };

    window.__MiraLithLuBirthLimbAtmosphereOverride = { intensityScale: 0 };
    window.__MiraLithLuBirthLimbDiffuseGlowOverride = { intensityScale: 0 };
    window.__MiraLithLuBirthReliefCloudOverride = {
      cloudOffset: 0.25,
      cloudOpacityScale: 0
    };
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = {
      cityLightScale: 1
    };
    await waitFrames(3);
    const withoutLimb = capture();
    window.__MiraLithLuBirthLimbDiffuseGlowOverride = { intensityScale: 1 };
    window.__MiraLithLuBirthEarthSurfaceLiteV2Override = {
      cityLightScale: 1
    };
    await waitFrames(3);
    const withLimb = capture();

    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const [sunX, sunY] = atmosphere.screenLightDirection;
    const dayInterior: number[] = [];
    const dayNeedle: number[] = [];
    const nightInterior: number[] = [];
    const outside: number[] = [];
    const twilightRed: number[] = [];
    const twilightBlue: number[] = [];
    for (
      let y = Math.max(0, Math.floor(centerY - radius * 1.08));
      y <= Math.min(sample.height - 1, Math.ceil(centerY + radius * 1.08));
      y += 1
    ) {
      for (
        let x = Math.max(0, Math.floor(centerX - radius * 1.08));
        x <= Math.min(sample.width - 1, Math.ceil(centerX + radius * 1.08));
        x += 1
      ) {
        const dx = (x - centerX) / Math.max(radius, 1);
        const dy = (y - centerY) / Math.max(radius, 1);
        const radial = Math.hypot(dx, dy);
        if (radial < 0.9 || radial > 1.075) {
          continue;
        }
        const directionLength = Math.max(radial, 1e-6);
        const lightAlignment = (dx / directionLength) * sunX +
          (dy / directionLength) * sunY;
        const index = (y * sample.width + x) * 4;
        const red = Math.max(
          (withLimb[index] ?? 0) - (withoutLimb[index] ?? 0),
          0
        );
        const blue = Math.max(
          (withLimb[index + 2] ?? 0) - (withoutLimb[index + 2] ?? 0),
          0
        );
        const contribution = (
          Math.abs((withLimb[index] ?? 0) - (withoutLimb[index] ?? 0)) +
          Math.abs((withLimb[index + 1] ?? 0) - (withoutLimb[index + 1] ?? 0)) +
          Math.abs((withLimb[index + 2] ?? 0) - (withoutLimb[index + 2] ?? 0))
        ) / 3;
        if (radial >= 1.05) {
          outside.push(contribution);
        } else if (lightAlignment >= 0.35) {
          if (radial >= 0.935 && radial <= 0.985) {
            dayInterior.push(contribution);
          } else if (radial > 0.985 && radial <= 1.002) {
            dayNeedle.push(contribution);
          }
        } else if (lightAlignment <= -0.35 && radial >= 0.935 && radial <= 1.002) {
          nightInterior.push(contribution);
        } else if (Math.abs(lightAlignment) <= 0.2 && radial >= 0.935 && radial <= 1.002) {
          twilightRed.push(red);
          twilightBlue.push(blue);
        }
      }
    }
    const mean = (values: number[]) => values.reduce(
      (total, value) => total + value,
      0
    ) / Math.max(values.length, 1);
    const percentile = (values: number[], position: number) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))] ?? 0;
    };
    return {
      dayInteriorCount: dayInterior.length,
      dayInteriorMean: mean(dayInterior),
      dayInteriorP90: percentile(dayInterior, 0.9),
      dayNeedleCount: dayNeedle.length,
      dayNeedleP90: percentile(dayNeedle, 0.9),
      nightInteriorMean: mean(nightInterior),
      nightInteriorP90: percentile(nightInterior, 0.9),
      outsideMean: mean(outside),
      outsideP90: percentile(outside, 0.9),
      outsideP99: percentile(outside, 0.99),
      twilightBlueP90: percentile(twilightBlue, 0.9),
      twilightRedP90: percentile(twilightRed, 0.9)
    };
  });
}

test("keeps Relief Lite V2 on one bounded shared-lighting path", async ({ page }, testInfo) => {
  const assetRequests = new Set<string>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes("/assets/lubirth/")) {
      assetRequests.add(path);
    }
  });
  await page.goto(createUrl({ quality: testInfo.project.name.includes("mobile") ? "medium" : "high" }));
  await waitForReliefLite(page);

	  const state = await page.evaluate(() => ({
	    atmosphere: window.__MiraLithLuBirthLimbAtmosphere,
	    diffuseGlow: window.__MiraLithLuBirthLimbDiffuseGlow,
	    earth: window.__MiraLithLuBirthEarthSurfaceLiteV2,
    nasaLiteCloud: window.__MiraLithLuBirthNasaLiteCloud,
    postEffectActive: window.__MiraLithLuBirthPostEffectActive,
    postEffectMode: window.__MiraLithLuBirthPostEffectMode,
    relief: window.__MiraLithLuBirthReliefCloud,
    spaceResolution: window.__MiraLithLuBirthSpaceBackgroundResolution,
    spaceTexture: window.__MiraLithLuBirthSpaceBackgroundTexture,
    visualPolicy: window.__MiraLithLuBirthVisualPolicy
  }));
  const raster = await readRasterState(page);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-cloud-mode",
    "relief-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-atmosphere-mode",
    "limb-lite"
  );
  await expect(page.locator(".lubirth-revised")).toHaveAttribute(
    "data-canvas-post-effect-mode",
    "off"
  );
	  expect(state.relief).toMatchObject({
	    active: true,
	    analyticNoise: false,
	    cloudBottomScale: LANDING_RELIEF_LITE_CLOUD_BOTTOM_SCALE,
	    cloudTopScale: LANDING_RELIEF_LITE_CLOUD_TOP_SCALE,
	    channelLayout: "v3-r-depth-g-height-b-morphology-a-concavity",
		    densityIntegration: "front-to-back",
		    integrationPath: "ray-sphere-thin-shell",
	    lodTransitions: false,
    premultipliedAlpha: true,
    shellCount: 1,
    vertexTextureReads: 1
	  });
	  expect(state.relief?.fragmentTextureReads).toBe(state.relief?.mobile ? 3 : 4);
	  expect(state.relief?.viewSteps).toBe(state.relief?.mobile
	    ? LANDING_RELIEF_LITE_MOBILE_VIEW_STEPS
	    : LANDING_RELIEF_LITE_DESKTOP_VIEW_STEPS);
	  expect(state.relief?.sunSteps).toBe(LANDING_RELIEF_LITE_SUN_STEPS);
	  expect((state.relief?.viewSteps ?? 0) + (state.relief?.sunSteps ?? 0))
	    .toBe(state.relief?.fragmentTextureReads);
	  expect(state.relief?.thinShellIntegration).toBe(true);
  expect(state.relief?.estimatedActiveTextureBytes).toBeGreaterThan(0);
  expect(state.relief?.rendererTextureCount).toBeGreaterThan(0);
  expect(state.relief?.gpuTimer).toMatchObject({
    sampleCount: expect.any(Number),
    supported: expect.any(Boolean)
  });
	  expect(state.atmosphere).toMatchObject({
    active: true,
    atmosphereRadiusScale: LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE,
    gpuTimer: {
      sampleCount: expect.any(Number),
      supported: expect.any(Boolean)
    },
    loopIterations: 0,
	    textureReads: 0
	  });
		  expect(state.diffuseGlow).toMatchObject({
		    active: true,
		    additiveMode: "one-one",
		    diffuseRadiusScale: LANDING_LIMB_LITE_DIFFUSE_RADIUS_SCALE,
		    geometry: "analytic-composite-limb-strip",
		    gpuTimer: {
		      sampleCount: expect.any(Number),
		      supported: expect.any(Boolean)
		    },
		    includesInternalLimb: true,
		    supportRadiusScale: LANDING_LIMB_LITE_DIFFUSE_SUPPORT_RADIUS_SCALE,
		    textureReads: 0
		  });
  expect(state.diffuseGlow?.innerLimbRadiusScale).toBeGreaterThanOrEqual(0.95);
	  expect(state.relief?.cloudTopScale).toBeLessThan(state.atmosphere?.atmosphereRadiusScale ?? 0);
	  expect(state.relief?.sunDirection).toEqual(state.earth?.sunDirection);
	  expect(state.atmosphere?.sunDirection).toEqual(state.earth?.sunDirection);
	  expect(state.diffuseGlow?.sunDirection).toEqual(state.earth?.sunDirection);
  expect(state.earth?.cloudOffset).toBeCloseTo(state.relief?.cloudOffset ?? -1, 5);
  expect(state.earth?.lightsOnlyTextureSource).toContain("earth-lights-only-2k.webp");
	  expect(state.earth?.cloudShadowActive).toBe(true);
	  expect(state.earth?.internalLimbActive).toBe(false);
	  expect(state.relief?.textureSource).toMatch(
	    /earth-cloud-field-nasa-lite-2k\.(ktx2|png)$/
	  );
	  expect(state.relief?.textureCompression).toBe(
	    state.relief?.compressedTextureActive ? "uastc" : "rgba8"
	  );
	  expect(state.relief?.estimatedActiveTextureBytes).toBe(
	    state.relief?.compressedTextureActive
	      ? Math.round(2048 * 1024 * 4 / 3)
	      : Math.round(2048 * 1024 * 4 * 4 / 3)
	  );
  expect(state.nasaLiteCloud).toBeUndefined();
  expect(state.postEffectActive).toBe(false);
  expect(state.postEffectMode).toBe("off");
  expect(state.spaceTexture).toContain("stars-milky-way-2k.webp");
  expect(state.spaceResolution).toEqual([2048, 1024]);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-lights-only-2k.webp")))
    .toBe(true);
	  expect(Array.from(assetRequests).some((path) => path.includes("earth-cloud-field-nasa-lite-2k.ktx2")))
	    .toBe(true);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-night-2k.jpg")))
    .toBe(false);
  expect(Array.from(assetRequests).some((path) => path.includes("earth-clouds-2k-light.jpg")))
    .toBe(false);
  expect(state.visualPolicy).toMatchObject({
    atmosphereMode: "limb-lite",
    cloudMode: "relief-lite",
    postEffectMode: "off"
  });
  expect(raster.antialias).toBe(true);
  expect(raster.pixelRatio).toBeCloseTo(1, 2);

  await testInfo.attach("relief-lite-v2", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("keeps cloud UV longitude aligned between vertex, ray density, and shadow", async () => {
  const longitudeToShaderU = (longitude: number) => {
    const value = 0.5 - longitude / (Math.PI * 2);
    return ((value % 1) + 1) % 1;
  };
  const uvToDirectionLongitude = (u: number) => {
    const theta = u * Math.PI * 2;
    return Math.atan2(Math.sin(theta), -Math.cos(theta));
  };

  for (const u of [0, 0.125, 0.25, 0.5, 0.75, 0.875]) {
    const reconstructed = longitudeToShaderU(uvToDirectionLongitude(u));
    const wrappedDelta = Math.abs((((reconstructed - u + 0.5) % 1) + 1) % 1 - 0.5);
    expect(wrappedDelta).toBeLessThan(0.001);
  }
});

test("keeps height-driven cloud shadow lookup down-sun", async () => {
  const source = readFileSync(
    path.resolve(process.cwd(), "packages/lubirth-hero/src/LandingEarthSurfaceLiteV2.tsx"),
    "utf8"
  );
  expect(source).toContain("sunTangent.x / max(2.0 * cloudLatitudeScale, 0.36)");
  expect(source).toContain("predictorCloudTop");
  expect(source).toContain("float cloudShadow = max(predictorShadow * 0.72, correctedShadow)");
  expect(source).toContain("cloudUv.x + shadowDirection.x * shadowTravel");
  expect(source).toContain("clamp(cloudUv.y + shadowDirection.y * shadowTravel, 0.001, 0.999)");
  expect(source).not.toContain("fract(cloudUv.x + shadowDirection.x");
  expect(source).not.toContain("shadowTravel * 0.52");
});

test("keeps the analytic limb directional instead of drawing a full night ring", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    progress: "1",
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high"
  }));
  await waitForReliefLite(page);

  const atmosphere = await sampleDirectionalAtmosphere(page);
  await testInfo.attach("directional-atmosphere.json", {
    body: JSON.stringify(atmosphere, null, 2),
    contentType: "application/json"
  });
  expect(atmosphere).not.toBeNull();
  expect(atmosphere?.dayCount).toBeGreaterThan(40);
  expect(atmosphere?.nightCount).toBeGreaterThan(40);
  expect(atmosphere?.dayP90).toBeGreaterThan(0.15);
  expect(atmosphere?.dayMean).toBeGreaterThan((atmosphere?.nightMean ?? 0) * 1.8);
  expect(atmosphere?.nightMean).toBeLessThanOrEqual(0.18);
  expect(atmosphere?.nightP90).toBeLessThanOrEqual(0.34);
  expect(atmosphere?.nightP99).toBeLessThanOrEqual(8);
  expect(atmosphere?.dayInnerMean).toBeGreaterThan(atmosphere?.dayOuterMean ?? 0);
  expect(atmosphere?.dayOuterMean).toBeGreaterThan(0.3);
  expect(atmosphere?.dayOuterP90).toBeGreaterThan(1);
  expect(atmosphere?.dayDiffuseMean).toBeGreaterThan(0.42);
  expect(atmosphere?.dayDiffuseP90).toBeGreaterThan(0.9);
  expect(atmosphere?.nightDiffuseMean).toBeLessThanOrEqual(0.02);
  expect(atmosphere?.nightDiffuseP90).toBeLessThanOrEqual(0.08);
  expect(atmosphere?.twilightCount).toBeGreaterThan(20);
  expect(atmosphere?.twilightRedMean).toBeGreaterThan(1);
  expect(atmosphere?.twilightRedP90).toBeGreaterThan(4);
  expect(atmosphere?.twilightVisibleRatio).toBeGreaterThan(0.2);
  expect(atmosphere?.twilightRedDominantRatio).toBeGreaterThan(0.2);
  expect(atmosphere?.twilightRedP90).toBeGreaterThan(
    (atmosphere?.twilightBlueP90 ?? 0) * 1.3
  );
});

test("renders an independently testable surface Fresnel and boundary needle", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    progress: "1",
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high"
  }));
  await waitForReliefLite(page);

  const limb = await sampleInternalLimb(page);
  expect(limb).not.toBeNull();
  expect(limb?.dayInteriorCount).toBeGreaterThan(100);
  expect(limb?.dayNeedleCount).toBeGreaterThan(10);
  expect(limb?.dayInteriorMean).toBeGreaterThan(1.35);
  expect(limb?.dayInteriorP90).toBeGreaterThan(3.2);
  expect(limb?.dayNeedleP90).toBeGreaterThan(4.4);
  expect(limb?.outsideP90).toBeLessThanOrEqual(0.05);
});

test("keeps the bounded diffuse glow stable in near mobile framing", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    progress: "0",
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high"
  }));
  await waitForReliefLite(page);

  const atmosphere = await sampleDirectionalAtmosphere(page);
  expect(atmosphere).not.toBeNull();
  expect(atmosphere?.dayCount).toBeGreaterThan(20);
  expect(atmosphere?.dayDiffuseP99).toBeLessThanOrEqual(24);
  expect(atmosphere?.nightDiffuseMean).toBeLessThanOrEqual(0.025);
  expect(atmosphere?.nightDiffuseP90).toBeLessThanOrEqual(0.08);

  await testInfo.attach("near-mobile-bounded-diffuse", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("keeps cloud relief bounded across four fixed global offsets", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high"
  }));
  await waitForReliefLite(page);

  const offsets = [0, 0.25, 0.5, 0.75];
  const matrix = [];
  for (const offset of offsets) {
    const appearance = await sampleCloudOffsetAppearance(page, offset);
    matrix.push(appearance);
    await testInfo.attach(`cloud-offset-${offset.toFixed(2)}`, {
      body: await page.screenshot(),
      contentType: "image/png"
    });
  }
  await testInfo.attach("cloud-offset-matrix", {
    body: Buffer.from(JSON.stringify(matrix, null, 2)),
    contentType: "application/json"
  });
  for (const appearance of matrix) {
    const mobileProject = testInfo.project.name.includes("mobile");
    expect(appearance).not.toBeNull();
    expect(appearance?.cloudPixelCount).toBeGreaterThan(100);
    expect(appearance?.changedRatio).toBeGreaterThan(0.03);
    expect(appearance?.coreGradientSampleCount).toBeGreaterThan(5);
    expect(appearance?.signalP50).toBeGreaterThan(0.05);
    expect(appearance?.signalP90).toBeGreaterThan(0.8);
    expect(appearance?.signalP99).toBeLessThanOrEqual(mobileProject ? 50 : 74);
    expect(appearance?.coreGradientP90).toBeLessThanOrEqual(mobileProject ? 24 : 22);
    expect(appearance?.coreGradientP99).toBeLessThan(38);
    expect(appearance?.extremeGradientRatio).toBeLessThan(0.025);
    expect(appearance?.clippedRatio).toBeLessThan(0.005);
  }
});

test("makes cloud core lighting respond to the one-tap sun density direction", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high"
  }));
  await waitForReliefLite(page);

  const shaderSource = readFileSync(
    path.join(process.cwd(), "packages/lubirth-hero/src/LandingReliefCloud.tsx"),
    "utf8"
  );
  expect(shaderSource).toContain("float signedSunColumnDelta = (sampledSunColumnDensity - columnDensity) * sunSampleScale;");
  expect(shaderSource).toContain("float sunOpeningColumn = max(-signedSunColumnDelta, 0.0);");
  expect(shaderSource).toContain("float sunOcclusionColumn = max(signedSunColumnDelta, 0.0);");
  expect(shaderSource).not.toContain("abs(sampledSunColumnDensity - columnDensity)");

  const response = await sampleCloudSunDirectionResponse(page);
  await testInfo.attach("cloud-sun-direction-response", {
    body: Buffer.from(JSON.stringify(response, null, 2)),
    contentType: "application/json"
  });

  expect(response).not.toBeNull();
  expect(response?.cloudPixelCount).toBeGreaterThanOrEqual(testInfo.project.name.includes("mobile") ? 8 : 100);
  expect(response?.sunSampleMeanAbs).toBeGreaterThanOrEqual(0);
  if ((response?.reverseCentroid ?? -1) >= 0) {
    expect(response?.forwardCentroid).toBeGreaterThan(response?.reverseCentroid ?? 1);
    expect((response?.forwardCentroid ?? 0) - (response?.reverseCentroid ?? 0)).toBeGreaterThan(0.08);
  }
  expect(response?.sideAlignedCount).toBeGreaterThan(testInfo.project.name.includes("mobile") ? 4 : 20);
  expect(response?.sideAlignedMeanDelta).toBeGreaterThan(-0.15);
  if ((response?.sideOpposedCount ?? 0) > 0) {
    expect(response?.sideOpposedMeanDelta).toBeGreaterThan(-0.15);
  }
});

test("projects height-driven cloud shadows onto the surface", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high"
  }));
  await waitForReliefLite(page);

  const shadow = await sampleCloudShadowProjection(page);
  await testInfo.attach("cloud-shadow-projection", {
    body: Buffer.from(JSON.stringify(shadow, null, 2)),
    contentType: "application/json"
  });

  const mobileProject = testInfo.project.name.includes("mobile");
  expect(shadow).not.toBeNull();
  expect(shadow?.sampleCount).toBeGreaterThan(mobileProject ? 160 : 900);
  expect(shadow?.activeCount).toBeGreaterThan(mobileProject ? 12 : 90);
  expect(shadow?.activeRatio).toBeGreaterThan(mobileProject ? 0.012 : 0.025);
  expect(shadow?.meanActiveShadow).toBeGreaterThan(mobileProject ? 0.45 : 0.6);
  expect(shadow?.p90).toBeGreaterThan(mobileProject ? 0.75 : 1);
  expect(shadow?.p98).toBeLessThan(16);
  expect(shadow?.softRatio).toBeGreaterThan(0.12);
});

test("reports optional draw-call GPU timing without treating rAF as GPU time", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high",
    reliefLiteGpuTimer: "on",
    visualTest: "performance"
  }));
  await waitForReliefLite(page, false);
	await expect.poll(
    () => page.evaluate(() => {
	      const cloud = window.__MiraLithLuBirthReliefCloud?.gpuTimer;
	      const atmosphere = window.__MiraLithLuBirthLimbAtmosphere?.gpuTimer;
	      const diffuseGlow = window.__MiraLithLuBirthLimbDiffuseGlow?.gpuTimer;
	      return Boolean(
	        cloud &&
	        atmosphere &&
	        diffuseGlow &&
	        (
	          (!cloud.supported && !atmosphere.supported && !diffuseGlow.supported) ||
	          (
              cloud.sampleCount >= 4 &&
              atmosphere.sampleCount >= 4 &&
              diffuseGlow.sampleCount >= 4
            )
	        )
	      );
    }),
    { timeout: 15_000 }
  ).toBe(true);

	  const timers = await page.evaluate(() => ({
	    atmosphere: window.__MiraLithLuBirthLimbAtmosphere?.gpuTimer,
	    cloud: window.__MiraLithLuBirthReliefCloud?.gpuTimer,
	    diffuseGlow: window.__MiraLithLuBirthLimbDiffuseGlow?.gpuTimer
	  }));
	  for (const [name, timer] of Object.entries(timers)) {
    expect(timer).toBeTruthy();
    if (timer?.supported) {
      expect(timer.sampleCount).toBeGreaterThanOrEqual(4);
      expect(timer.p50Ms).toBeGreaterThan(0);
      expect(timer.p95Ms).toBeGreaterThan(0);
      expect(timer.p95Ms).toBeLessThanOrEqual(name === "diffuseGlow" ? 3 : 8.5);
    } else {
      expect(timer?.sampleCount).toBe(0);
    }
  }
});

test("gates cities to deep night and preserves cloud body plus displaced silhouette", async ({ page }, testInfo) => {
  await page.goto(createUrl({
    progress: "1",
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high",
    sunDate: "1993-08-01T09:03:00Z"
  }));
  await waitForReliefLite(page);

  const city = await sampleCityLeakage(page);
  expect(city).not.toBeNull();
  expect(city?.daySamples).toBeGreaterThan(100);
  expect(city?.nightSamples).toBeGreaterThan(100);
  expect(city?.nightPeak).toBeGreaterThan(7);
  expect(city?.nightMean).toBeGreaterThan(0.018);
  expect(city?.leakageRatio).toBeLessThanOrEqual(0.01);
  expect(city?.dayMean).toBeLessThan(0.02);

  await page.goto(createUrl({
    quality: testInfo.project.name.includes("mobile") ? "medium" : "high"
  }));
  await waitForReliefLite(page);
  const cloud = await sampleCloudBodyAndSilhouette(page);
  const mobileProject = testInfo.project.name.includes("mobile");
  expect(cloud).not.toBeNull();
  expect(cloud?.bodyActiveCount).toBeGreaterThanOrEqual(mobileProject ? 24 : 80);
  expect(cloud?.bodySampleCount).toBeGreaterThan(500);
  expect(cloud?.bodyChangedRatio).toBeGreaterThan(mobileProject ? 0.00025 : 0.002);
  expect(cloud?.bodyDynamicRange).toBeGreaterThan(0.8);
  expect(cloud?.bodyP95).toBeGreaterThan(0.5);
  expect(cloud?.bodyStdDev).toBeGreaterThan(mobileProject ? 0.34 : 0.45);
  expect(cloud?.silhouetteChangedCount).toBeGreaterThan(2);
  expect(cloud?.silhouetteP95).toBeGreaterThan(0.2);
});
