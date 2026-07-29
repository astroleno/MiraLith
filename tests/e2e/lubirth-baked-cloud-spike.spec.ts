import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

interface BakedCloudTelemetry {
  anchor: {
    latitudeDeg: number;
    longitudeDeg: number;
  };
  anchorLocalPosition: [number, number, number];
  candidateVisible: boolean;
  decodedGpuResidencyBytes: number;
  farOpticalWeight: number;
  gpuTimer: {
    p95Ms?: number;
    sampleCount: number;
    supported: boolean;
  };
  locationReady: boolean;
  maxGpuResidencyBytes: number;
  maxTransferBytes: number;
  nearOpticalWeight: number;
  openingTimeline: "mapOpeningProgress";
  progress: number;
  resourceGeneration: number;
  resourceState: "idle" | "invalid" | "loading" | "ready" | "released";
  selectedViewIds: string[];
  sharedCloudOffset: number;
  tier: "desktop" | "mobile" | null;
  transferBytes: number;
}

declare global {
  interface Window {
    __MiraLithLuBirthBakedCloud?: BakedCloudTelemetry;
    __MiraLithLuBirthVisualPolicy?: { cloudMode?: string };
  }
}

async function telemetry(page: Page) {
  return page.evaluate(() => window.__MiraLithLuBirthBakedCloud ?? null);
}

async function waitForTelemetry(page: Page) {
  await expect.poll(
    async () => telemetry(page),
    { timeout: 20_000 }
  ).not.toBeNull();
  return telemetry(page) as Promise<BakedCloudTelemetry>;
}

async function captureEvidence(page: Page, label: string) {
  const directory = process.env.MIRALITH_BAKED_CLOUD_EVIDENCE_DIR;
  if (!directory) {
    return;
  }

  mkdirSync(directory, { recursive: true });
  const snapshot = await telemetry(page);
  writeFileSync(join(directory, `${label}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  await page.screenshot({ path: join(directory, `${label}.png`) });
}

test("uses the real opening timeline for the bounded near-to-far baked-cloud handoff", async ({ page }) => {
  await page.goto(
    "/lubirth-baked-cloud-spike?copy=hidden&geoLat=31.2&geoLon=103.8&location=ip&progress=0.08&quality=high"
  );

  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 20_000 }
  ).toBe("ready");
  const near = await waitForTelemetry(page);
  expect(near.openingTimeline).toBe("mapOpeningProgress");
  expect(near.progress).toBeCloseTo(0.08, 2);
  expect(near.locationReady).toBe(true);
  expect(near.candidateVisible).toBe(true);
  expect(near.nearOpticalWeight).toBeGreaterThan(0.85);
  expect(near.farOpticalWeight).toBeLessThan(0.15);
  expect(near.selectedViewIds.length).toBeGreaterThanOrEqual(1);
  expect(near.sharedCloudOffset).toBeGreaterThanOrEqual(0);

  expect(await page.evaluate(() => window.__MiraLithLuBirthVisualPolicy?.cloudMode)).toBe("relief-lite");

  await captureEvidence(page, "near");

  await page.goto(
    "/lubirth-baked-cloud-spike?copy=hidden&geoLat=31.2&geoLon=103.8&location=ip&progress=0.82&quality=high"
  );
  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 20_000 }
  ).toBe("ready");
  const far = await waitForTelemetry(page);
  expect(far.openingTimeline).toBe("mapOpeningProgress");
  expect(far.progress).toBeCloseTo(0.82, 2);
  expect(far.candidateVisible).toBe(false);
  expect(far.nearOpticalWeight).toBeLessThan(0.03);
  expect(far.farOpticalWeight).toBeGreaterThan(0.97);
  await captureEvidence(page, "far");
});

test("keeps the candidate hidden until delayed IP location resolution is safe to anchor", async ({ page }) => {
  await page.route("**/api/lubirth-geo", async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        label: "Delayed visitor",
        latitudeDeg: -33.8688,
        located: true,
        longitudeDeg: 151.2093,
        source: "manual"
      })
    });
  });

  await page.goto(
    "/lubirth-baked-cloud-spike?copy=hidden&location=ip&progress=0.1&quality=high"
  );

  await expect.poll(
    async () => (await telemetry(page))?.locationReady,
    { timeout: 10_000 }
  ).toBe(false);
  const waiting = await waitForTelemetry(page);
  expect(waiting.candidateVisible).toBe(false);

  await expect.poll(
    async () => (await telemetry(page))?.locationReady,
    { timeout: 20_000 }
  ).toBe(true);
  await expect.poll(
    async () => (await telemetry(page))?.candidateVisible,
    { timeout: 20_000 }
  ).toBe(true);
  const resolved = await waitForTelemetry(page);
  expect(resolved.anchor.latitudeDeg).toBeCloseTo(-33.8688, 3);
  expect(resolved.anchor.longitudeDeg).toBeCloseTo(151.2093, 3);
});

test("selects the bounded mobile tier without fetching desktop-only baked views", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/lubirth-baked-cloud-spike?copy=hidden&geoLat=35.6762&geoLon=139.6503&location=ip&progress=0.12&quality=high"
  );

  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 20_000 }
  ).toBe("ready");
  const mobile = await waitForTelemetry(page);
  expect(mobile.tier).toBe("mobile");
  expect(mobile.selectedViewIds.length).toBeGreaterThanOrEqual(1);
});

test("shares field drift and stays inside the declared resource budgets without rapid-reverse reallocation", async ({
  page
}) => {
  await page.goto(
    "/lubirth-baked-cloud-spike?copy=hidden&geoLat=64.1466&geoLon=-21.9426&location=ip&quality=high"
  );
  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 20_000 }
  ).toBe("ready");
  const initial = await waitForTelemetry(page);

  expect(initial.transferBytes).toBeGreaterThan(0);
  expect(initial.transferBytes).toBeLessThanOrEqual(initial.maxTransferBytes);
  expect(initial.decodedGpuResidencyBytes).toBeGreaterThan(0);
  expect(initial.decodedGpuResidencyBytes).toBeLessThanOrEqual(initial.maxGpuResidencyBytes);
  const resourceGeneration = initial.resourceGeneration;

  await page.waitForTimeout(180);
  const drifted = await waitForTelemetry(page);
  expect(drifted.sharedCloudOffset).not.toBe(initial.sharedCloudOffset);
  expect(drifted.anchorLocalPosition).not.toEqual(initial.anchorLocalPosition);

  await page.evaluate(() => {
    window.__MiraLithOpeningProgress = 0.64;
  });
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    window.__MiraLithOpeningProgress = 0.08;
  });
  await expect.poll(
    async () => (await telemetry(page))?.candidateVisible,
    { timeout: 10_000 }
  ).toBe(true);
  const reversed = await waitForTelemetry(page);
  expect(reversed.resourceGeneration).toBe(resourceGeneration);
  expect(reversed.resourceState).toBe("ready");
  if (reversed.gpuTimer.supported && reversed.gpuTimer.sampleCount >= 20) {
    expect(reversed.gpuTimer.p95Ms ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(3);
  }
});

test("releases near-cloud textures only after a stable far handoff and reloads only after a real rewind", async ({
  page
}) => {
  await page.goto(
    "/lubirth-baked-cloud-spike?copy=hidden&geoLat=31.2&geoLon=103.8&location=ip&progress=0.98&quality=high"
  );
  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 20_000 }
  ).toBe("ready");
  const beforeRelease = await waitForTelemetry(page);

  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 8_000 }
  ).toBe("released");
  const released = await waitForTelemetry(page);
  expect(released.selectedViewIds).toEqual([]);
  expect(released.decodedGpuResidencyBytes).toBe(0);

  await page.evaluate(() => {
    window.__MiraLithOpeningProgress = 0.08;
  });
  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 20_000 }
  ).toBe("ready");
  const rewound = await waitForTelemetry(page);
  expect(rewound.resourceGeneration).toBeGreaterThan(beforeRelease.resourceGeneration);
  expect(rewound.candidateVisible).toBe(true);
});

test("keeps the Earth-local art-directed anchor available for northern, southern, dateline, and birth-default locations", async ({
  page
}) => {
  const samples = [
    { latitudeDeg: 64.1466, longitudeDeg: -21.9426, query: "geoLat=64.1466&geoLon=-21.9426&location=ip" },
    { latitudeDeg: -33.8688, longitudeDeg: 151.2093, query: "geoLat=-33.8688&geoLon=151.2093&location=ip" },
    { latitudeDeg: 18.2, longitudeDeg: 179.7, query: "geoLat=18.2&geoLon=179.7&location=ip" },
    { query: "location=birth" }
  ];

  for (const sample of samples) {
    await page.goto(
      `/lubirth-baked-cloud-spike?copy=hidden&progress=0.1&quality=high&${sample.query}`
    );
    await expect.poll(
      async () => (await telemetry(page))?.resourceState,
      { timeout: 20_000 }
    ).toBe("ready");
    const current = await waitForTelemetry(page);
    expect(current.locationReady).toBe(true);
    expect(current.candidateVisible).toBe(true);
    if ("latitudeDeg" in sample) {
      expect(current.anchor.latitudeDeg).toBeCloseTo(sample.latitudeDeg, 3);
      expect(current.anchor.longitudeDeg).toBeCloseTo(sample.longitudeDeg, 3);
    }
  }
});

test("records frame cadence and an optional sub-3ms near-cloud GPU draw gate for the route decision", async ({ page }) => {
  await page.goto(
    "/lubirth-baked-cloud-spike?copy=hidden&geoLat=31.2&geoLon=103.8&location=ip&progress=0.1&quality=high&bakedCloudValidation=on"
  );
  await expect.poll(
    async () => (await telemetry(page))?.resourceState,
    { timeout: 20_000 }
  ).toBe("ready");

  const frameIntervals = await page.evaluate(async () => new Promise<number[]>((resolve) => {
    const intervals: number[] = [];
    let previous = performance.now();
    const tick = (now: number) => {
      intervals.push(now - previous);
      previous = now;
      if (intervals.length >= 45) {
        resolve(intervals);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const sorted = [...frameIntervals].sort((left, right) => left - right);
  const frameP95 = sorted[Math.floor(sorted.length * 0.95)];
  expect(Number.isFinite(frameP95)).toBe(true);
  expect(frameP95).toBeGreaterThan(0);

  const current = await waitForTelemetry(page);
  if (current.gpuTimer.supported && current.gpuTimer.sampleCount >= 20) {
    expect(current.gpuTimer.p95Ms ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(3);
  }
});
