import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

test.setTimeout(900_000);

type AltitudeLadderTelemetry = {
  completed: boolean;
  cameraHeightMeters: number | null;
  requestedAltitudeMeters: number;
  sphericalUv: readonly [number, number];
  centerRayShellIntervalMeters: number | null;
  shellIntervalLengthMeters: number | null;
  validPrimarySampleCount: number | null;
  maxDensity: number | null;
  averageDensity: number | null;
  weatherMaxDensity: number | null;
  weatherAverageDensity: number | null;
  accumulatedOpticalDepth: number | null;
  peakAccumulatedOpticalDepth: number | null;
  centerAccumulatedOpticalDepth: number | null;
  transmittance: number | null;
  minimumTransmittance: number | null;
  centerTransmittance: number | null;
  preTemporalInScatteredRadiance: number | null;
  preTemporalInScatteredRadiancePeak: number | null;
  preTemporalInScatteredRadianceCenter: number | null;
  postTemporalInScatteredRadiance: number | null;
  postTemporalInScatteredRadiancePeak: number | null;
  postTemporalInScatteredRadianceCenter: number | null;
  aerialPerspectiveResult: number | null;
  aerialPerspectiveResultPeak: number | null;
  aerialPerspectiveResultCenter: number | null;
  readback: {
    cloudTargetWidth: number;
    cloudTargetHeight: number;
    precision: "half-float" | "unorm8";
    source: "gpu-readback-v1";
  } | null;
};

type SignalStatus = "unavailable" | "near-zero" | "attenuated" | "visible";

type SignalStageMeasurement = {
  average: number | null;
  peak: number | null;
  center: number | null;
  status: SignalStatus;
};

type LadderWindowTelemetry = {
  active: boolean;
  altitudeLadder: AltitudeLadderTelemetry | null;
  cameraHeightMeters: number | null;
  cameraPosition: [number, number, number];
  diagnostic: "altitude-ladder" | "full";
  input: "stock" | "v3";
  nativeFrameCount: number;
  rendererFingerprintHash: string | null;
  presentationPreset: string;
  sceneDepthScale: number;
  temporalConverged: boolean;
  transformFallback: string | null;
  view: "opening";
};

declare global {
  interface Window {
    __MiraLithTakramParity?: LadderWindowTelemetry;
  }
}

const evidencePath = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/altitude-ladder.json"
);

async function waitForActiveParity(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(
    () => page.evaluate(() => window.__MiraLithTakramParity?.active ?? false),
    { timeout: 180_000 }
  ).toBe(true);
  await expect(page.locator("[data-visual-fallback]")).toHaveCount(0);
}

async function readTelemetry(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__MiraLithTakramParity ?? null);
}

test("V3 opening exposes the planetary optical-signal altitude ladder", async ({ page }) => {
  await page.goto(
    "/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=full"
  );
  await waitForActiveParity(page);
  const opening = await readTelemetry(page);
  expect(opening?.input).toBe("v3");
  expect(opening?.view).toBe("opening");
  expect(opening?.cameraHeightMeters).toBeGreaterThan(0);

  const openingAltitudeMeters = Math.max(
    2_500,
    Math.round(opening?.cameraHeightMeters ?? 2_500)
  );
  const requestedAltitudes = Array.from(new Set([
    2_500,
    50_000,
    200_000,
    openingAltitudeMeters
  ])).sort((left, right) => left - right);
  const windows: Array<{
    requestedAltitudeMeters: number;
    telemetry: LadderWindowTelemetry;
  }> = [];

  for (const altitudeMeters of requestedAltitudes) {
    await page.goto(
      `/lubirth-takram-parity-spike?input=v3&view=opening&progress=0.06&diagnostic=altitude-ladder&altitudeMeters=${altitudeMeters}`
    );
    await waitForActiveParity(page);
    const telemetry = await readTelemetry(page);
    expect(telemetry?.diagnostic).toBe("altitude-ladder");
    expect(telemetry?.altitudeLadder?.completed).toBe(true);
    expect(telemetry?.altitudeLadder?.readback?.source).toBe("gpu-readback-v1");
    expect(telemetry?.transformFallback).toBeNull();
    expect(telemetry?.nativeFrameCount).toBeGreaterThanOrEqual(32);
    expect(telemetry?.altitudeLadder?.requestedAltitudeMeters).toBe(altitudeMeters);
    expect(telemetry?.altitudeLadder?.sphericalUv).toEqual(
      windows[0]?.telemetry.altitudeLadder?.sphericalUv ?? telemetry?.altitudeLadder?.sphericalUv
    );
    windows.push({ requestedAltitudeMeters: altitudeMeters, telemetry: telemetry! });
  }

  const signalThresholds = {
    visibleRadiance: 1e-4,
    nearZeroRadiance: 1e-6
  };
  const statusForSignal = (value: number | null): SignalStatus => {
    if (value === null || !Number.isFinite(value)) return "unavailable";
    if (value <= signalThresholds.nearZeroRadiance) return "near-zero";
    if (value >= signalThresholds.visibleRadiance) return "visible";
    return "attenuated";
  };
  const measurements = windows.map(({ requestedAltitudeMeters, telemetry }) => {
    const ladder = telemetry.altitudeLadder!;
    const signalStages: Record<string, SignalStageMeasurement> = {
      preTemporal: {
        average: ladder.preTemporalInScatteredRadiance,
        peak: ladder.preTemporalInScatteredRadiancePeak,
        center: ladder.preTemporalInScatteredRadianceCenter,
        status: statusForSignal(ladder.preTemporalInScatteredRadiancePeak)
      },
      postTemporal: {
        average: ladder.postTemporalInScatteredRadiance,
        peak: ladder.postTemporalInScatteredRadiancePeak,
        center: ladder.postTemporalInScatteredRadianceCenter,
        status: statusForSignal(ladder.postTemporalInScatteredRadiancePeak)
      },
      aerialPerspective: {
        average: ladder.aerialPerspectiveResult,
        peak: ladder.aerialPerspectiveResultPeak,
        center: ladder.aerialPerspectiveResultCenter,
        status: statusForSignal(ladder.aerialPerspectiveResultPeak)
      }
    };
    const signalValues = Object.values(signalStages)
      .map((stage) => stage.peak)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const averageSignalValues = Object.values(signalStages)
      .map((stage) => stage.average)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const maxSignal = signalValues.length > 0 ? Math.max(...signalValues) : null;
    const averageSignal = averageSignalValues.length > 0 ? Math.max(...averageSignalValues) : null;
    return {
      requestedAltitudeMeters,
      sphericalUv: ladder.sphericalUv,
      cameraHeightMeters: ladder.cameraHeightMeters ?? telemetry.cameraHeightMeters,
      centerRayShellIntervalMeters: ladder.centerRayShellIntervalMeters,
      shellIntervalLengthMeters: ladder.shellIntervalLengthMeters,
      validPrimarySampleCount: ladder.validPrimarySampleCount,
      maxDensity: ladder.maxDensity,
      averageDensity: ladder.averageDensity,
      weatherMaxDensity: ladder.weatherMaxDensity,
      weatherAverageDensity: ladder.weatherAverageDensity,
      accumulatedOpticalDepth: ladder.accumulatedOpticalDepth,
      peakAccumulatedOpticalDepth: ladder.peakAccumulatedOpticalDepth,
      centerAccumulatedOpticalDepth: ladder.centerAccumulatedOpticalDepth,
      transmittance: ladder.transmittance,
      minimumTransmittance: ladder.minimumTransmittance,
      centerTransmittance: ladder.centerTransmittance,
      preTemporalInScatteredRadiance: ladder.preTemporalInScatteredRadiance,
      preTemporalInScatteredRadiancePeak: ladder.preTemporalInScatteredRadiancePeak,
      preTemporalInScatteredRadianceCenter: ladder.preTemporalInScatteredRadianceCenter,
      postTemporalInScatteredRadiance: ladder.postTemporalInScatteredRadiance,
      postTemporalInScatteredRadiancePeak: ladder.postTemporalInScatteredRadiancePeak,
      postTemporalInScatteredRadianceCenter: ladder.postTemporalInScatteredRadianceCenter,
      aerialPerspectiveResult: ladder.aerialPerspectiveResult,
      aerialPerspectiveResultPeak: ladder.aerialPerspectiveResultPeak,
      aerialPerspectiveResultCenter: ladder.aerialPerspectiveResultCenter,
      signalStages,
      averageSignal,
      maxSignal,
      signalStatus: statusForSignal(maxSignal)
    };
  });
  const firstNearZero = measurements.find((measurement) =>
    measurement.signalStatus === "near-zero"
  ) ?? null;
  const firstNearZeroStage = measurements
    .flatMap((measurement) => Object.entries(measurement.signalStages)
      .filter(([, stage]) => stage.status === "near-zero")
      .map(([stage]) => ({ altitudeMeters: measurement.requestedAltitudeMeters, stage })))
    .at(0) ?? null;

  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 2,
    baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    generatedAt: new Date().toISOString(),
    route: {
      input: "v3",
      view: "opening",
      progress: 0.06,
      fixedRenderer: "stock-takram-0.7.6",
      weather: "v3",
      sun: "LuBirth opening default"
    },
    openingAltitudeMeters,
    requestedAltitudes,
    thresholds: signalThresholds,
    firstNearZeroAltitudeMeters: firstNearZero?.requestedAltitudeMeters ?? null,
    firstNearZeroStage,
    signalConclusion: firstNearZero
      ? "FIRST_NEAR_ZERO_RECORDED"
      : "NO_NEAR_ZERO_COLLAPSE_IN_SAMPLED_RANGE",
    rendererFingerprintHash: windows[0]?.telemetry.rendererFingerprintHash ?? null,
    presentationPreset: windows[0]?.telemetry.presentationPreset ?? null,
    sphericalUv: windows[0]?.telemetry.altitudeLadder?.sphericalUv ?? null,
    measurements
  }, null, 2)}\n`, "utf8");

  expect(measurements).toHaveLength(requestedAltitudes.length);
  expect(measurements.every((measurement) =>
    measurement.shellIntervalLengthMeters !== null &&
    measurement.validPrimarySampleCount !== null &&
    measurement.maxDensity !== null &&
    measurement.averageDensity !== null &&
    measurement.accumulatedOpticalDepth !== null &&
    measurement.transmittance !== null &&
    measurement.preTemporalInScatteredRadiance !== null &&
    measurement.postTemporalInScatteredRadiance !== null &&
    measurement.aerialPerspectiveResult !== null
  )).toBe(true);
});
