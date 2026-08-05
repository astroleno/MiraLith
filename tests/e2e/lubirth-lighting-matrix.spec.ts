import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

const LIGHTING_EVIDENCE_DIR = path.join(process.cwd(), "output/playwright/lubirth-lighting-revision");

function lightingEvidencePath(name: string) {
  mkdirSync(LIGHTING_EVIDENCE_DIR, { recursive: true });
  return path.join(LIGHTING_EVIDENCE_DIR, `${name}.png`);
}

declare global {
  interface Window {
    __MiraLithHomeProjectionFrame?: {
      width: number;
      height: number;
      earthHorizonPath: string;
    };
    __MiraLithLuBirthProjectedEarthLighting?: {
      center: [number, number];
      progress: number;
      radius: number;
      sunDirection: [number, number];
    };
    __MiraLithLuBirthCloudShellCount?: number;
    __MiraLithLuBirthCloudDiagnosticMode?: number;
    __MiraLithLuBirthCloudReliefLightingStrength?: number;
    __MiraLithLuBirthCloudShellOffset?: number;
    __MiraLithLuBirthCloudShellTextureUuid?: string;
    __MiraLithLuBirthRuntimeProfile?: string;
    __MiraLithLuBirthWorldLightDirection?: [number, number, number];
    __MiraLithOpeningProgress?: number;
  }
}

async function waitForLightingFrame(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1, { timeout: 25_000 });
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeProfile), { timeout: 25_000 })
    .toBe("home-lite");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedEarthLighting), { timeout: 25_000 })
    .toBeTruthy();
  await page.waitForTimeout(800);
}

async function sampleEarthLighting(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    const frame = window.__MiraLithLuBirthProjectedEarthLighting;
    if (!source || !frame) {
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

    const patchMedian = (centerX: number, centerY: number, radius: number) => {
      const values: number[] = [];
      const minX = Math.max(0, Math.floor(centerX - radius));
      const maxX = Math.min(sample.width - 1, Math.ceil(centerX + radius));
      const minY = Math.max(0, Math.floor(centerY - radius));
      const maxY = Math.min(sample.height - 1, Math.ceil(centerY + radius));
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (Math.hypot(x - centerX, y - centerY) > radius) {
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
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length * 0.5)] ?? 0;
    };

    const [centerX, centerY] = frame.center;
    const [sunX, sunY] = frame.sunDirection;
    const interiorOffset = frame.radius * 0.52;
    const patchRadius = Math.max(3, frame.radius * 0.055);
    const day = patchMedian(centerX + sunX * interiorOffset, centerY + sunY * interiorOffset, patchRadius);
    const night = patchMedian(centerX - sunX * interiorOffset, centerY - sunY * interiorOffset, patchRadius);
    const perpendicularX = -sunY;
    const perpendicularY = sunX;
    const background = patchMedian(
      centerX + perpendicularX * frame.radius * 1.22,
      centerY + perpendicularY * frame.radius * 1.22,
      patchRadius
    );

    return {
      background,
      day,
      night,
      ratio: day / Math.max(night, 1),
      sampleFrame: {
        center: [centerX, centerY],
        dayPoint: [centerX + sunX * interiorOffset, centerY + sunY * interiorOffset],
        nightPoint: [centerX - sunX * interiorOffset, centerY - sunY * interiorOffset],
        radius: frame.radius,
        sunDirection: [sunX, sunY]
      }
    };
  });
}

async function sampleCloudLimb(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
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
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const coordinates = projection.earthHorizonPath.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const horizonPoints: Array<[number, number]> = [];
    for (let index = 0; index + 1 < coordinates.length; index += 2) {
      const x = coordinates[index] ?? 0;
      const y = coordinates[index + 1] ?? 0;
      if (
        x >= sample.width * 0.08 &&
        x <= sample.width * 0.92 &&
        y >= sample.height * 0.36 &&
        y <= sample.height * 0.94
      ) {
        horizonPoints.push([x, y]);
      }
    }

    const [centerX, centerY] = lighting.center;
    const worldLightDirection = window.__MiraLithLuBirthWorldLightDirection ?? [0, 0, 0];
    const pixelAt = (x: number, y: number) => {
      const sampleX = Math.max(0, Math.min(sample.width - 1, Math.round(x)));
      const sampleY = Math.max(0, Math.min(sample.height - 1, Math.round(y)));
      const pixelIndex = (sampleY * sample.width + sampleX) * 4;
      return [
        pixels[pixelIndex] ?? 0,
        pixels[pixelIndex + 1] ?? 0,
        pixels[pixelIndex + 2] ?? 0
      ] as [number, number, number];
    };

    return {
      earthRadius: lighting.radius,
      worldLightDirection,
      samples: horizonPoints.map(([x, y]) => {
        const distanceFromCenter = Math.max(1, Math.hypot(x - centerX, y - centerY));
        const outwardX = (x - centerX) / distanceFromCenter;
        const outwardY = (y - centerY) / distanceFromCenter;
        const sampleRay = (direction: number) => Array.from({ length: 24 }, (_, index) => {
          const distance = index + 1;
          return pixelAt(
            x + outwardX * distance * direction,
            y + outwardY * distance * direction
          );
        });
        return {
          inward: sampleRay(-1),
          outward: sampleRay(1)
        };
      })
    };
  });
}

async function sampleCloudBodyRoi(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
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
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const [centerX, centerY] = lighting.center;
    const radius = lighting.radius;
    const left = Math.max(0, Math.floor(centerX - radius * 0.72));
    const right = Math.min(sample.width, Math.ceil(centerX + radius * 0.72));
    const top = Math.max(0, Math.floor(centerY - radius * 0.94));
    const bottom = Math.min(sample.height, Math.ceil(centerY - radius * 0.35));
    const colors: Array<[number, number, number]> = [];
    const luminances: number[] = [];
    for (let y = top; y < bottom; y += 2) {
      for (let x = left; x < right; x += 2) {
        const index = (y * sample.width + x) * 4;
        const color = [
          pixels[index] ?? 0,
          pixels[index + 1] ?? 0,
          pixels[index + 2] ?? 0
        ] as [number, number, number];
        colors.push(color);
        luminances.push(Math.round(
          0.2126 * color[0] +
          0.7152 * color[1] +
          0.0722 * color[2]
        ));
      }
    }

    return {
      colors,
      luminances,
      rect: {
        height: Math.max(1, bottom - top),
        width: Math.max(1, right - left),
        x: left,
        y: top
      }
    };
  });
}

const cloudColorDistance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const cloudLuminance = (color: [number, number, number]) =>
  color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;

const mean = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);

function percentile(values: number[], fraction: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function compareCloudLimbSamples(
  surface: Awaited<ReturnType<typeof sampleCloudLimb>>,
  shell: Awaited<ReturnType<typeof sampleCloudLimb>>
) {
  if (!surface || !shell) {
    return null;
  }

  const sampleCount = Math.min(surface.samples.length, shell.samples.length);
  const baseShellOffset = Math.max(1, Math.round(surface.earthRadius * 0.008));
  const protrusions: number[] = [];
  const displacedProtrusions: number[] = [];
  const displacedColorDistances: number[] = [];
  const strongDisplacedColumns: number[] = [];

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const surfaceSample = surface.samples[sampleIndex];
    const shellSample = shell.samples[sampleIndex];
    if (!surfaceSample || !shellSample) {
      continue;
    }

    let protrusion = 0;
    let hasStrongDisplacedPixel = false;
    const outwardCount = Math.min(surfaceSample.outward.length, shellSample.outward.length);
    for (let distanceIndex = 0; distanceIndex < outwardCount; distanceIndex += 1) {
      const surfaceColor = surfaceSample.outward[distanceIndex];
      const shellColor = shellSample.outward[distanceIndex];
      if (surfaceColor && shellColor) {
        const distance = cloudColorDistance(surfaceColor, shellColor);
        if (distance >= 3) {
          protrusion = distanceIndex + 1;
        }
        if (distanceIndex + 1 > baseShellOffset) {
          displacedColorDistances.push(distance);
          hasStrongDisplacedPixel ||= distance >= 8;
        }
      }
    }
    protrusions.push(protrusion);
    displacedProtrusions.push(Math.max(0, protrusion - baseShellOffset));
    strongDisplacedColumns.push(hasStrongDisplacedPixel ? 1 : 0);
  }

  const activeProtrusions = protrusions.filter((value) => value > 0);
  const activeDisplacedProtrusions = displacedProtrusions.filter((value) => value > 0);
  const activeMean = mean(activeProtrusions);
  const activeVariance = mean(activeProtrusions.map((value) => (value - activeMean) ** 2));
  return {
    activeColumnFraction: activeProtrusions.length / Math.max(protrusions.length, 1),
    displacedColumnFraction: activeDisplacedProtrusions.length / Math.max(displacedProtrusions.length, 1),
    displacedProtrusionMean: mean(activeDisplacedProtrusions),
    displacedColorDistanceMean: mean(displacedColorDistances),
    strongDisplacedColumnFraction: mean(strongDisplacedColumns),
    activeProtrusionMean: activeMean,
    activeProtrusionStdDev: Math.sqrt(activeVariance),
    maxProtrusion: Math.max(0, ...protrusions),
    baseShellOffset,
    earthRadius: surface.earthRadius,
    sampleCount
  };
}

function compareCloudBodyReliefLighting(
  disabled: Awaited<ReturnType<typeof sampleCloudBodyRoi>>,
  enabled: Awaited<ReturnType<typeof sampleCloudBodyRoi>>,
  mask: Awaited<ReturnType<typeof sampleCloudBodyRoi>>
) {
  if (!disabled || !enabled || !mask) {
    return null;
  }

  const sampleCount = Math.min(
    disabled.luminances.length,
    enabled.luminances.length,
    mask.colors.length
  );
  const coreDeltas: number[] = [];
  const edgeDeltas: number[] = [];
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const maskColor = mask.colors[sampleIndex];
    if (!maskColor) {
      continue;
    }

    const delta = (enabled.luminances[sampleIndex] ?? 0) - (disabled.luminances[sampleIndex] ?? 0);
    const isCore = maskColor[0] >= 220 && maskColor[1] <= 35 && maskColor[2] >= 220;
    const isEdge = maskColor[0] <= 35 && maskColor[1] >= 220 && maskColor[2] >= 220;
    if (isCore) {
      coreDeltas.push(delta);
    } else if (isEdge) {
      edgeDeltas.push(delta);
    }
  }

  const summarize = (deltas: number[]) => {
    const activeDeltas = deltas.filter((value) => Math.abs(value) >= 1);
    const positiveDeltas = activeDeltas.filter((value) => value > 0);
    const negativeDeltas = activeDeltas.filter((value) => value < 0).map((value) => Math.abs(value));
    const deltaMean = mean(deltas);
    const deltaVariance = mean(deltas.map((value) => (value - deltaMean) ** 2));
    const absoluteDeltas = deltas.map((value) => Math.abs(value));
    return {
      activePixelFraction: activeDeltas.length / Math.max(deltas.length, 1),
      maxAbsoluteDelta: Math.max(0, ...absoluteDeltas),
      meanAbsoluteDelta: mean(absoluteDeltas),
      negativeP90: percentile(negativeDeltas, 0.9),
      negativePixelCount: negativeDeltas.length,
      p90AbsoluteDelta: percentile(absoluteDeltas, 0.9),
      positiveP90: percentile(positiveDeltas, 0.9),
      positivePixelCount: positiveDeltas.length,
      sampleCount: deltas.length,
      stdDev: Math.sqrt(deltaVariance)
    };
  };

  const core = summarize(coreDeltas);
  const edge = summarize(edgeDeltas);
  return {
    core,
    edge,
    edgeToCoreMeanRatio: edge.meanAbsoluteDelta / Math.max(core.meanAbsoluteDelta, 0.001),
    sampleCount,
  };
}

function compareCloudBodyContribution(
  surface: Awaited<ReturnType<typeof sampleCloudBodyRoi>>,
  shell: Awaited<ReturnType<typeof sampleCloudBodyRoi>>
) {
  if (!surface || !shell) {
    return null;
  }

  const sampleCount = Math.min(
    surface.luminances.length,
    shell.luminances.length
  );
  const positiveLifts: number[] = [];
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const lift = Math.max(
      0,
      (shell.luminances[sampleIndex] ?? 0) - (surface.luminances[sampleIndex] ?? 0)
    );
    if (lift >= 1) {
      positiveLifts.push(lift);
    }
  }

  return {
    activePixelCount: positiveLifts.length,
    activePixelFraction: positiveLifts.length / Math.max(sampleCount, 1),
    max: Math.max(0, ...positiveLifts),
    mean: mean(positiveLifts),
    p95: percentile(positiveLifts, 0.95),
    p99: percentile(positiveLifts, 0.99),
    sampleCount
  };
}

function compareMaskedCloudContribution(
  surface: Awaited<ReturnType<typeof sampleCloudBodyRoi>>,
  shell: Awaited<ReturnType<typeof sampleCloudBodyRoi>>,
  mask: Awaited<ReturnType<typeof sampleCloudBodyRoi>>
) {
  if (!surface || !shell || !mask) {
    return null;
  }

  const sampleCount = Math.min(
    surface.luminances.length,
    shell.luminances.length,
    mask.colors.length
  );
  const coreLifts: number[] = [];
  const edgeLifts: number[] = [];
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const maskColor = mask.colors[sampleIndex];
    if (!maskColor) {
      continue;
    }

    const lift = Math.max(
      0,
      (shell.luminances[sampleIndex] ?? 0) - (surface.luminances[sampleIndex] ?? 0)
    );
    const isCore = maskColor[0] >= 220 && maskColor[1] <= 35 && maskColor[2] >= 220;
    const isEdge = maskColor[0] <= 35 && maskColor[1] >= 220 && maskColor[2] >= 220;
    if (isCore) {
      coreLifts.push(lift);
    } else if (isEdge) {
      edgeLifts.push(lift);
    }
  }

  const summarize = (values: number[]) => ({
    activePixelFraction: values.filter((value) => value >= 1).length / Math.max(values.length, 1),
    max: Math.max(0, ...values),
    mean: mean(values),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    sampleCount: values.length
  });
  return {
    core: summarize(coreLifts),
    edge: summarize(edgeLifts),
    sampleCount
  };
}

function measureBacklitCloudLimb(
  surface: Awaited<ReturnType<typeof sampleCloudLimb>>,
  shell: Awaited<ReturnType<typeof sampleCloudLimb>>
) {
  if (!surface || !shell) {
    return null;
  }

  const sampleCount = Math.min(surface.samples.length, shell.samples.length);
  const baseShellOffset = Math.max(1, Math.round(surface.earthRadius * 0.008));
  const shellLuminances: number[] = [];
  const surfaceLuminances: number[] = [];
  const positiveLifts: number[] = [];
  let activeColumns = 0;
  let candidatePixels = 0;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const surfaceSample = surface.samples[sampleIndex];
    const shellSample = shell.samples[sampleIndex];
    if (!surfaceSample || !shellSample) {
      continue;
    }

    let activeColumn = false;
    const outwardCount = Math.min(surfaceSample.outward.length, shellSample.outward.length, 20);
    for (let distanceIndex = baseShellOffset; distanceIndex < outwardCount; distanceIndex += 1) {
      const surfaceColor = surfaceSample.outward[distanceIndex];
      const shellColor = shellSample.outward[distanceIndex];
      if (!surfaceColor || !shellColor) {
        continue;
      }

      candidatePixels += 1;
      if (cloudColorDistance(surfaceColor, shellColor) < 2) {
        continue;
      }

      activeColumn = true;
      const surfaceValue = cloudLuminance(surfaceColor);
      const shellValue = cloudLuminance(shellColor);
      surfaceLuminances.push(surfaceValue);
      shellLuminances.push(shellValue);
      positiveLifts.push(Math.max(0, shellValue - surfaceValue));
    }
    activeColumns += activeColumn ? 1 : 0;
  }

  return {
    activeColumnCount: activeColumns,
    activePixelCount: shellLuminances.length,
    activePixelFraction: shellLuminances.length / Math.max(candidatePixels, 1),
    backlitColumnCount: sampleCount,
    luminanceMax: Math.max(0, ...shellLuminances),
    luminanceP95: percentile(shellLuminances, 0.95),
    positiveLiftP95: percentile(positiveLifts, 0.95),
    sampleCount,
    surfaceLuminanceP95: percentile(surfaceLuminances, 0.95),
    worldLightZ: shell.worldLightDirection[2]
  };
}

function trackUnexpectedRuntimeMessages(page: import("@playwright/test").Page) {
  const runtimeMessages: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    const knownHarnessWarning =
      /THREE\.Clock: This module has been deprecated/.test(text) ||
      /GPU stall due to ReadPixels/.test(text);
    if (message.type() === "error" || (message.type() === "warning" && !knownHarnessWarning)) {
      runtimeMessages.push(text);
    }
  });
  page.on("pageerror", (error) => runtimeMessages.push(error.message));
  return runtimeMessages;
}

test("far view keeps a readable dark side with bounded day-night contrast", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Lighting pixels are calibrated once at 1440×960.");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    "/?progress=1&copy=hidden&quality=medium&visualTest=pixels&location=birth&sunDate=2026-07-12T09:00:00Z&moonPhase=birth&postEffect=off"
  );
  await waitForLightingFrame(page);

  const lighting = await sampleEarthLighting(page);
  expect(lighting).not.toBeNull();
  console.log(`far Earth lighting ${JSON.stringify(lighting)}`);
  await page.screenshot({ path: lightingEvidencePath("earth-far-night-readability"), timeout: 30_000 });
  expect(lighting?.ratio).toBeGreaterThanOrEqual(2);
  expect(lighting?.ratio).toBeLessThanOrEqual(20);
  expect(lighting?.night).toBeGreaterThanOrEqual(5.5);
  expect(lighting?.night).toBeGreaterThanOrEqual((lighting?.background ?? 0) + 3.5);
  await testInfo.attach("far-day-night-lighting-metrics", {
    body: Buffer.from(JSON.stringify(lighting, null, 2)),
    contentType: "application/json"
  });
  await testInfo.attach("far-day-night-lighting", {
    body: await page.screenshot(),
    contentType: "image/png"
  });
});

test("production home renders the 2K photographic star field above black", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Star-field pixels are calibrated once at 1440×960.");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    "/?progress=1&copy=hidden&quality=medium&visualTest=pixels&location=birth&sunDate=2026-07-12T09:00:00Z&moonPhase=birth&postEffect=off"
  );
  await waitForLightingFrame(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthSpaceBackgroundTexture), { timeout: 25_000 })
    .toBe("/assets/lubirth/backgrounds/stars-milky-way-2k.webp");

  const sky = await page.evaluate(() => {
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
    const values: number[] = [];
    const minX = Math.floor(sample.width * 0.06);
    const maxX = Math.floor(sample.width * 0.4);
    const minY = Math.floor(sample.height * 0.12);
    const maxY = Math.floor(sample.height * 0.44);
    for (let y = minY; y < maxY; y += 2) {
      for (let x = minX; x < maxX; x += 2) {
        const index = (y * sample.width + x) * 4;
        values.push(
          0.2126 * (pixels[index] ?? 0) +
          0.7152 * (pixels[index + 1] ?? 0) +
          0.0722 * (pixels[index + 2] ?? 0)
        );
      }
    }
    values.sort((a, b) => a - b);
    const mean = values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
    const p95 = values[Math.floor(values.length * 0.95)] ?? 0;
    const brightFraction = values.filter((value) => value >= 3).length / Math.max(values.length, 1);
    return { brightFraction, mean, p95 };
  });

  expect(sky).not.toBeNull();
  console.log(`production sky lighting ${JSON.stringify(sky)}`);
  expect(sky?.mean).toBeGreaterThanOrEqual(0.4);
  expect(sky?.p95).toBeGreaterThanOrEqual(0.75);
  expect(sky?.brightFraction).toBeGreaterThanOrEqual(0.002);
});

test("near view cloud shell displaces thick clouds beyond the base shell", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Cloud-limb pixels are calibrated once at 1440×960.");
  const runtimeMessages = trackUnexpectedRuntimeMessages(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  const fixedQuery =
    "progress=0&copy=hidden&quality=medium&visualTest=pixels&location=birth&moonPhase=today&sunDate=2026-07-12T09:00:00Z&debug=clouds&postEffect=off";

  await page.goto(`/?${fixedQuery}&cloud=surface`);
  await waitForLightingFrame(page);
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "debug-clouds");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudShellCount ?? 0))
    .toBe(0);
  const surface = await sampleCloudLimb(page);
  await testInfo.attach("near-cloud-surface-baseline", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  await page.goto(`/?${fixedQuery}&cloud=shell-lite&cloudDiagnostic=mask`);
  await waitForLightingFrame(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudShellCount ?? 0))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudDiagnosticMode))
    .toBe(1);
  const shell = await sampleCloudLimb(page);
  await testInfo.attach("near-cloud-shell-lite", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  const metrics = compareCloudLimbSamples(surface, shell);
  console.log(`near cloud limb ${JSON.stringify(metrics)}`);
  expect(metrics).not.toBeNull();
  expect(metrics?.sampleCount).toBeGreaterThanOrEqual(80);
  expect(metrics?.displacedColumnFraction).toBeGreaterThanOrEqual(0.13);
  expect(metrics?.strongDisplacedColumnFraction).toBeGreaterThanOrEqual(0.07);
  expect(metrics?.displacedProtrusionMean).toBeGreaterThanOrEqual(1.5);
  expect(metrics?.maxProtrusion).toBeGreaterThanOrEqual(10);
  expect(runtimeMessages).toEqual([]);
});

test("near view cloud cores carry relief instead of concentrating it on edges", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Cloud-body pixels are calibrated once at 1440×960.");
  const runtimeMessages = trackUnexpectedRuntimeMessages(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  const fixedQuery =
    "progress=0&copy=hidden&quality=medium&visualTest=pixels&location=birth&moonPhase=today&sunDate=2026-07-12T09:00:00Z&debug=clouds&cloud=shell-lite&postEffect=off";

  await page.goto(`/?${fixedQuery}&cloudReliefLighting=off`);
  await waitForLightingFrame(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudReliefLightingStrength))
    .toBe(0);
  const disabled = await sampleCloudBodyRoi(page);
  if (disabled) {
    await testInfo.attach("near-cloud-body-relief-off", {
      body: await page.screenshot({ clip: disabled.rect }),
      contentType: "image/png"
    });
  }

  await page.goto(`/?${fixedQuery}&cloudReliefLighting=on`);
  await waitForLightingFrame(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudReliefLightingStrength))
    .toBe(1);
  const enabled = await sampleCloudBodyRoi(page);
  if (enabled) {
    await testInfo.attach("near-cloud-body-relief-on", {
      body: await page.screenshot({ clip: enabled.rect }),
      contentType: "image/png"
    });
  }

  await page.goto(`/?${fixedQuery}&cloudDiagnostic=mask`);
  await waitForLightingFrame(page);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudDiagnosticMode))
    .toBe(1);
  const mask = await sampleCloudBodyRoi(page);
  if (mask) {
    await testInfo.attach("near-cloud-body-core-edge-mask", {
      body: await page.screenshot({ clip: mask.rect }),
      contentType: "image/png"
    });
  }

  const metrics = compareCloudBodyReliefLighting(disabled, enabled, mask);
  console.log(`near cloud body relief lighting ${JSON.stringify(metrics)}`);
  expect(metrics).not.toBeNull();
  expect(metrics?.sampleCount).toBeGreaterThanOrEqual(120_000);
  expect(metrics?.core.sampleCount).toBeGreaterThanOrEqual(5_000);
  expect(metrics?.edge.sampleCount).toBeGreaterThanOrEqual(5_000);
  expect(metrics?.core.activePixelFraction).toBeGreaterThanOrEqual(0.12);
  expect(metrics?.core.meanAbsoluteDelta).toBeGreaterThanOrEqual(1.5);
  expect(metrics?.core.p90AbsoluteDelta).toBeGreaterThanOrEqual(4);
  expect(metrics?.core.positivePixelCount).toBeGreaterThanOrEqual(500);
  expect(metrics?.core.negativePixelCount).toBeGreaterThanOrEqual(500);
  expect(metrics?.core.positiveP90).toBeGreaterThanOrEqual(5);
  expect(metrics?.core.negativeP90).toBeGreaterThanOrEqual(5);
  expect(metrics?.core.stdDev).toBeGreaterThanOrEqual(2);
  expect(metrics?.edgeToCoreMeanRatio).toBeLessThanOrEqual(2.5);
  expect(runtimeMessages).toEqual([]);
});

test("near-to-far camera motion keeps one continuous cloud field", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Cloud transition is calibrated once at 1440×960.");
  const runtimeMessages = trackUnexpectedRuntimeMessages(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    "/?progress=0&copy=hidden&quality=medium&visualTest=pixels&location=birth&moonPhase=today&sunDate=2026-07-12T09:00:00Z&debug=clouds&cloud=shell-lite&postEffect=off"
  );
  await waitForLightingFrame(page);

  const frames: Array<{
    offset: number;
    progress: number;
    radius: number;
    textureUuid: string;
  }> = [];
  for (const sample of [
    { name: "near", progress: 0 },
    { name: "middle", progress: 0.5 },
    { name: "far", progress: 1 }
  ]) {
    await page.evaluate((progress) => {
      window.__MiraLithOpeningProgress = progress;
    }, sample.progress);
    await expect
      .poll(
        () => page.evaluate(() => window.__MiraLithLuBirthProjectedEarthLighting?.progress),
        { timeout: 5_000 }
      )
      .toBeCloseTo(sample.progress, 2);
    await page.waitForTimeout(240);
    const frame = await page.evaluate(() => ({
      offset: window.__MiraLithLuBirthCloudShellOffset ?? Number.NaN,
      progress: window.__MiraLithLuBirthProjectedEarthLighting?.progress ?? Number.NaN,
      radius: window.__MiraLithLuBirthProjectedEarthLighting?.radius ?? Number.NaN,
      textureUuid: window.__MiraLithLuBirthCloudShellTextureUuid ?? ""
    }));
    frames.push(frame);
    await testInfo.attach(`cloud-transition-${sample.name}`, {
      body: await page.screenshot(),
      contentType: "image/png"
    });
  }

  console.log(`cloud transition continuity ${JSON.stringify(frames)}`);
  expect(frames).toHaveLength(3);
  expect(frames.every((frame) => Number.isFinite(frame.offset))).toBe(true);
  expect(frames.every((frame) => frame.textureUuid === frames[0]?.textureUuid)).toBe(true);
  expect(frames[0]?.textureUuid).not.toBe("");
  expect(frames[0]?.radius ?? 0).toBeGreaterThan(frames[1]?.radius ?? 0);
  expect(frames[1]?.radius ?? 0).toBeGreaterThan(frames[2]?.radius ?? 0);
  expect(Math.abs((frames[2]?.offset ?? 0) - (frames[0]?.offset ?? 0))).toBeLessThan(0.0015);
  expect(runtimeMessages).toEqual([]);
});

test("backlit cloud avoids a gray second shell and a white edge ribbon", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Backlit cloud pixels are calibrated once at 1440×960.");
  const runtimeMessages = trackUnexpectedRuntimeMessages(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  const fixedQuery =
    "progress=0&copy=hidden&quality=medium&visualTest=pixels&location=birth&moonPhase=today&sunDate=2026-07-12T00:00:00Z&debug=clouds&postEffect=off";

  await page.goto(`/?${fixedQuery}&cloud=shell-lite&cloudDiagnostic=mask`);
  await waitForLightingFrame(page);
  const maskBody = await sampleCloudBodyRoi(page);

  await page.goto(`/?${fixedQuery}&cloud=surface`);
  await waitForLightingFrame(page);
  const surface = await sampleCloudLimb(page);
  const surfaceBody = await sampleCloudBodyRoi(page);

  await page.goto(`/?${fixedQuery}&cloud=shell-lite`);
  await waitForLightingFrame(page);
  const shell = await sampleCloudLimb(page);
  const shellBody = await sampleCloudBodyRoi(page);
  await testInfo.attach("near-cloud-backlit-shell", {
    body: await page.screenshot(),
    contentType: "image/png"
  });

  const metrics = measureBacklitCloudLimb(surface, shell);
  const bodyMetrics = compareCloudBodyContribution(surfaceBody, shellBody);
  const maskedBodyMetrics = compareMaskedCloudContribution(surfaceBody, shellBody, maskBody);
  console.log(`backlit cloud limb ${JSON.stringify({ bodyMetrics, maskedBodyMetrics, metrics })}`);
  expect(metrics).not.toBeNull();
  expect(bodyMetrics).not.toBeNull();
  expect(maskedBodyMetrics).not.toBeNull();
  expect(metrics?.worldLightZ).toBeLessThanOrEqual(-0.75);
  expect(metrics?.backlitColumnCount).toBeGreaterThanOrEqual(25);
  expect(metrics?.activeColumnCount).toBeLessThanOrEqual(10);
  expect(metrics?.activePixelFraction).toBeLessThanOrEqual(0.02);
  expect(metrics?.luminanceP95).toBeLessThanOrEqual(16);
  expect(metrics?.positiveLiftP95).toBeLessThanOrEqual(15);
  expect(metrics?.luminanceMax).toBeLessThanOrEqual(24);
  expect(bodyMetrics?.sampleCount).toBeGreaterThanOrEqual(120_000);
  expect(bodyMetrics?.activePixelFraction).toBeLessThanOrEqual(0.2);
  expect(maskedBodyMetrics?.core.sampleCount).toBeGreaterThanOrEqual(5_000);
  expect(maskedBodyMetrics?.edge.sampleCount).toBeGreaterThanOrEqual(10_000);
  expect(maskedBodyMetrics?.edge.p95).toBeLessThanOrEqual(32);
  expect(maskedBodyMetrics?.edge.p99).toBeLessThanOrEqual(48);
  expect(maskedBodyMetrics?.edge.max).toBeLessThanOrEqual(64);
  expect(runtimeMessages).toEqual([]);
});

test("forced fallback is hydration-stable and serves its poster", async ({ page }) => {
  const runtimeErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|server rendered html|did not match/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydration|server rendered html|did not match/i.test(error.message)) {
      runtimeErrors.push(error.message);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes("/assets/lubirth/") && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url.pathname}`);
    }
  });

  const posterResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/assets/lubirth/poster-field.webp"
  );
  await page.goto("/?visual=fallback&copy=visible", { waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="lubirth"]')).toBeVisible();
  expect((await posterResponse).status()).toBe(200);
  await page.waitForTimeout(150);
  expect(runtimeErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

test("captures the deterministic loading, halo, moon, progress, and landscape matrix", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The visual matrix is captured once from Chromium.");

  await page.setViewportSize({ width: 1440, height: 960 });
  const fixedBase = "copy=hidden&quality=medium&visualTest=pixels&location=birth&sunDate=2026-07-12T09:00:00Z";
  const samples = [
    { name: "earth-close-birth-halo", query: `progress=0&${fixedBase}&moonPhase=birth&postEffect=analytic-halo` },
    { name: "earth-close-birth-no-halo", query: `progress=0&${fixedBase}&moonPhase=birth&postEffect=off` },
    { name: "earth-middle-birth-halo", query: `progress=0.5&${fixedBase}&moonPhase=birth&postEffect=analytic-halo` },
    { name: "earth-far-birth-halo", query: `progress=1&${fixedBase}&moonPhase=birth&postEffect=analytic-halo` },
    {
      name: "earth-close-today-halo",
      query: `progress=0&${fixedBase}&moonPhase=today&moonDate=2026-07-12T12:00:00Z&postEffect=analytic-halo`
    }
  ];

  for (const sample of samples) {
    await page.goto(`/?${sample.query}`);
    await waitForLightingFrame(page);
    await page.screenshot({ path: lightingEvidencePath(sample.name), timeout: 30_000 });
  }

  await page.setViewportSize({ width: 844, height: 390 });
  for (const sample of [
    { name: "landscape-close", progress: 0 },
    { name: "landscape-final", progress: 1 }
  ]) {
    await page.goto(`/?progress=${sample.progress}&${fixedBase}&moonPhase=birth&postEffect=analytic-halo`);
    await waitForLightingFrame(page);
    await page.screenshot({ path: lightingEvidencePath(sample.name), timeout: 30_000 });
  }

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/?visual=fallback&copy=visible", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const moon = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--draw");
    if (root?.dataset.homeLoading !== "active" || !moon) {
      return false;
    }
    const style = window.getComputedStyle(moon);
    const offset = Number.parseFloat(style.strokeDashoffset);
    return offset > 0.2 && offset < 0.8 && Number.parseFloat(style.opacity) > 0.5;
  });
  await page.screenshot({ path: lightingEvidencePath("loading-moon-drawing"), timeout: 30_000 });

  await page.waitForFunction(() => {
    const moon = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--draw");
    if (!moon) {
      return false;
    }
    const style = window.getComputedStyle(moon);
    return /1px,\s*0px/.test(style.strokeDasharray) && Number.parseFloat(style.opacity) > 0.82;
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: lightingEvidencePath("loading-moon-closed-hold"), timeout: 30_000 });
});
