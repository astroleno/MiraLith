import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { mapOpeningProgress } from "../../packages/visual-core/src/theatre/openingTimeline";
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";

// Each diagnostic intentionally cold-loads the local volume assets and
// atmosphere LUTs in its own route. Leave enough headroom for five real native
// runs on the desktop GPU test project instead of silently truncating the final review.
test.setTimeout(600_000);

declare global {
  interface Window {
    __MiraLithTakramParity?: {
      active: boolean;
      adapter: {
        disableDefaultLayers: boolean;
        globalWeatherMapping: boolean;
        localWeatherOffset: [number, number] | null;
        localWeatherRepeat: [number, number] | null;
        localWeatherSource: "stock" | "v3" | null;
      };
      cameraPosition: [number, number, number];
      cameraMatrixWorld: number[];
      coordinateMode: "lubirth-bridge" | "upstream-ecef";
      diagnosticState: {
        aerialPerspectiveComposite: boolean;
        beerShadowOcclusion: boolean;
        cloudRawOutput: boolean;
        historyResetFirstFrame: boolean;
      };
      earthMatrixWorld: number[];
      native: {
        aerialPerspective: boolean;
        beerShadowMaps: boolean;
        temporalUpscale: boolean;
      };
      nativeFrameCount: number;
      temporalConverged: boolean;
      transformFallback: string | null;
    };
  }
}

function resolveTask1ROpeningMatrices(progress: number) {
  // This is deliberately an independent copy of Task -1R's opening setup,
  // rather than importing the parity scene. It pins the cross-route camera /
  // Earth contract while keeping the rendering stacks separate.
  const openingFrame = mapOpeningProgress(progress);
  const earthMatrixWorld = new Matrix4().compose(
    new Vector3(openingFrame.earthX, openingFrame.earthY, 0),
    new Quaternion().setFromEuler(new Euler(
      openingFrame.earthPitchDeg * Math.PI / 180,
      openingFrame.earthYawDeg * Math.PI / 180,
      0,
      "YXZ"
    )),
    new Vector3().setScalar(openingFrame.earthScale)
  );
  const camera = new PerspectiveCamera(45, 1, 0.01, 100);
  camera.up.set(0, 1, 0);
  camera.position.set(
    Math.sin(openingFrame.cameraAzimuth) * openingFrame.cameraDistance,
    Math.sin(openingFrame.cameraElevation) * openingFrame.cameraDistance,
    Math.cos(openingFrame.cameraAzimuth) * openingFrame.cameraDistance
  );
  camera.lookAt(0, openingFrame.cameraLookAtY, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return {
    cameraMatrixWorld: camera.matrixWorld.toArray(),
    cameraPosition: camera.position.toArray(),
    earthMatrixWorld: earthMatrixWorld.toArray()
  };
}

function expectMatrixCloseTo(actual: number[] | undefined, expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  actual?.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index]!, 6);
  });
}

const evidenceDirectory = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/captures"
);
const shouldCaptureEvidence = process.env.MIRALITH_TAKRAM_PARITY_CAPTURE === "1";

async function waitForNativeParity(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(
    () => page.evaluate(() => window.__MiraLithTakramParity?.active ?? false),
    { timeout: 120_000 }
  ).toBe(true);
  await expect(page.locator("[data-visual-fallback]")).toHaveCount(0);
}

async function captureIfRequested(
  page: import("@playwright/test").Page,
  name: string
) {
  if (!shouldCaptureEvidence) {
    return;
  }
  mkdirSync(evidenceDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDirectory, `${name}.png`),
    scale: "css"
  });
}

test("stock control exposes the frozen full, BSM, history, raw and aerial diagnostics", async ({ page }) => {
  const diagnostics = [
    "full",
    "bsm-off",
    "history-reset-first",
    "cloud-raw",
    "aerial-final"
  ] as const;

  for (const diagnostic of diagnostics) {
    await page.goto(
      `/lubirth-takram-parity-spike?input=stock&view=control&progress=0&diagnostic=${diagnostic}&visualTest=pixels`
    );
    await expect(page.locator("[data-takram-parity-route='true']")).toHaveAttribute(
      "data-diagnostic",
      diagnostic
    );
    await waitForNativeParity(page);
    const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
    expect(telemetry?.coordinateMode).toBe("upstream-ecef");
    expect(telemetry?.transformFallback).toBeNull();
    expect(telemetry?.native.aerialPerspective).toBe(true);
    expect(telemetry?.native.temporalUpscale).toBe(true);
    expect(telemetry?.native.beerShadowMaps).toBe(true);
    expect(telemetry?.diagnosticState.beerShadowOcclusion).toBe(
      diagnostic !== "bsm-off"
    );
    expect(telemetry?.diagnosticState.aerialPerspectiveComposite).toBe(
      diagnostic !== "cloud-raw"
    );
    expect(telemetry?.diagnosticState.cloudRawOutput).toBe(
      diagnostic === "cloud-raw"
    );
    expect(telemetry?.diagnosticState.historyResetFirstFrame).toBe(
      diagnostic === "history-reset-first"
    );
    expect(telemetry?.temporalConverged).toBe(diagnostic !== "history-reset-first");
    expect(telemetry?.nativeFrameCount).toBeGreaterThan(
      diagnostic === "history-reset-first" ? 0 : 31
    );
    await captureIfRequested(page, `control-${diagnostic}`);
  }
});

test("stock and V3 opening preserve the Task -1R bridge across all review frames", async ({ page }) => {
  for (const input of ["stock", "v3"] as const) {
    for (const progress of ["0.00", "0.06", "0.12", "0.18"] as const) {
      for (const diagnostic of ["full", "cloud-raw"] as const) {
        await page.goto(
          `/lubirth-takram-parity-spike?input=${input}&view=opening&progress=${progress}&diagnostic=${diagnostic}&visualTest=pixels`
        );
        await waitForNativeParity(page);
        const telemetry = await page.evaluate(() => window.__MiraLithTakramParity);
        expect(telemetry?.coordinateMode).toBe("lubirth-bridge");
        expect(telemetry?.transformFallback).toBeNull();
        expect(telemetry?.cameraMatrixWorld).toHaveLength(16);
        expect(telemetry?.earthMatrixWorld).toHaveLength(16);
        const task1r = resolveTask1ROpeningMatrices(Number(progress));
        expectMatrixCloseTo(telemetry?.cameraMatrixWorld, task1r.cameraMatrixWorld);
        expectMatrixCloseTo(telemetry?.earthMatrixWorld, task1r.earthMatrixWorld);
        telemetry?.cameraPosition.forEach((value, index) => {
          expect(value).toBeCloseTo(task1r.cameraPosition[index]!, 6);
        });
        expect(telemetry?.native.beerShadowMaps).toBe(true);
        expect(telemetry?.native.aerialPerspective).toBe(true);
        expect(telemetry?.adapter).toMatchObject(input === "v3" ? {
          disableDefaultLayers: true,
          globalWeatherMapping: true,
          localWeatherOffset: [-0.045, 0.018],
          localWeatherRepeat: [1, 1],
          localWeatherSource: "v3"
        } : {
          disableDefaultLayers: false,
          globalWeatherMapping: false,
          localWeatherOffset: [0, 0],
          localWeatherRepeat: [100, 100],
          localWeatherSource: "stock"
        });
        expect(telemetry?.diagnosticState.cloudRawOutput).toBe(
          diagnostic === "cloud-raw"
        );
        expect(telemetry?.diagnosticState.aerialPerspectiveComposite).toBe(
          diagnostic === "full"
        );
        await page.waitForTimeout(2_000);
        await captureIfRequested(
          page,
          `opening-${input}-${progress.replace(".", "-")}-${diagnostic}`
        );
      }
    }
  }
});
