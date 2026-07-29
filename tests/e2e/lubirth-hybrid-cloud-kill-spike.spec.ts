import { expect, type Page, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

declare global {
  interface Window {
    __MiraLithLuBirthHybridKillSpike?: {
      active: boolean;
      camera: "near" | "mid-oblique" | "oblique" | "sweep";
      capability: "webgl2" | "fallback";
      coverageMeanEstimate: number;
      coverageAreaTemporalP95Estimate: number;
      coverageSpatialP95Estimate: number;
      coverageTemporalP95Estimate: number;
      frameP95Ms: number;
      accumulationProbe: {
        additiveDraw: boolean;
        colorBufferFloat: boolean;
        floatBlend: boolean;
        framebufferComplete: boolean;
        multipleRenderTargets: boolean;
        readbackMode: "float" | "rgba8-copy" | "none";
        rgba16fTexture: boolean;
        verified: boolean;
        verdict: "pass" | "fail";
      };
      accumulationSize: [number, number];
      accumulationTargetCount: number;
      depthBinBoundary: number;
      depthBinMode: 1 | 2;
      depthBinRolePriorMassEstimate: {
        far: number;
        near: number;
      };
      depthBinSegmentation: "view-ray-clipped" | "view-ray-overlap-partition";
      depthBinSubmittedLobeCount: {
        far: number;
        near: number;
      };
      compositeScissor: [number, number, number, number];
      candidateHash: string;
      candidateHashSchema: "fnv1a-instance-buffer-v3";
      candidateSetCount: number;
      candidateSeedRange: [number, number];
      coordinateSpace: "earth-local-v3";
      densityProfileVersion: "source-native-patch-height-field-v4";
      cameraMatrixSignature: string;
      cameraFrameId: string;
      earthOccludedCenterCount: number;
      frustumCulledCount: number;
      gpuP50Ms: number | null;
      gpuP95Ms: number | null;
      gpuTimingSamplesMs: number[];
      gpuFieldResolution: [number, number];
      gpuFieldSource: string;
      gpuRenderer: string;
      gpuPhaseSampleCount: number;
      gpuPhaseP95Ms: {
        accumulation: number | null;
        clear: number | null;
        composite: number | null;
      };
      gpuSampleCount: number;
      gpuDisjointResetCount: number;
      gpuPhaseSampleInterval: number;
      gpuTotalSampleInterval: number;
      gpuTimingScope: "rgba16f-depth-layer-accumulation-composite";
      gpuTimerSupported: boolean;
      gpuWarmupFrames: number;
      gpuWindowSize: number;
      generatorVersion: string;
      hierarchyHash: string;
      hierarchyMetrics: {
        baseCarrierContainmentRatio: number;
        baseCarrierFootprintUnionCoverageRatio: number;
        baseCount: number;
        baseComponentCount: number;
        detailMeanElevation: number;
        maxBaseNearestNeighborDistance: number;
        maxBaseNormalizedNearestSeparation: number;
        maxNormalizedTangentAttachment: number;
        towerMeanElevation: number;
      };
      hierarchyVersion: "base-tower-detail-v4";
      hierarchyMembershipChurnRatio: number;
      hierarchyMembershipChurnTemporalP95: number;
      hierarchySubmittedLobeCount: number;
      hierarchySubmittedMembershipHash: string;
      hierarchySubmittedRoleCounts: {
        base: number;
        detail: number;
        tower: number;
      };
      baseCarrierCount: number;
      layoutId: string;
      lobeCount: number;
      localVolumeFieldResolution: [number, number, number] | null;
      localVolumeFieldVersion: "v9-source-native-patch-oct-normal-directional-light-rgba8" | null;
      localVolumeTileCount: number;
      localVolumeAccumulationDrawCount: number;
      localVolumeSourceMaskTextureLookupCountPerPixel: number;
      localVolumeSunTextureLookupCountPerPixel: number;
      localVolumeTotalTextureLookupCountPerPixel: number;
      localVolumeViewSamples: number;
      localVolumeViewTextureLookupCountPerPixel: number;
      lobeHierarchy: Array<{
        id: number;
        isCarrier: boolean;
        parentId: number | null;
        role: "base" | "detail" | "tower";
      }>;
      lobeRoleCounts: {
        base: number;
        detail: number;
        tower: number;
      };
      membershipChurnRatio: number;
      membershipChurnTemporalP95: number;
      offset: [number, number];
      occludedCount: number;
      opticalMassEstimate: number;
      orientation: "equirect-u-repeat-v-clamp-north-up";
      orphanChildCount: number;
      parentedLobeCount: number;
      physicalSize: [number, number];
      resolvedSize: [number, number];
      scissorEnabled: boolean;
      sourceSha256: string;
      rendererMode: "ellipsoid" | "local-volume";
      sourcePatchFootprintCoverageRatio: number;
      sourcePatchHeightP05: number;
      sourcePatchHeightP95: number;
      sourcePatchMeanCoverage: number;
      sourceUvBounds: [number, number, number, number];
      submittedLobeCount: number;
      submittedMembershipHash: string;
      submittedRoleCounts: {
        base: number;
        detail: number;
        tower: number;
      };
      sunDirection: [number, number, number];
      sweepProgress: number;
      tier: "desktop" | "mobile";
      topologyDistanceSpace: "earth-local-tangent-normalized-radius";
      visibleCount: number;
    };
  }
}

async function waitForKillSpikeTelemetry(
  page: Page,
  options: { fullGpuWindow?: boolean } = {}
) {
  await page.waitForFunction(({ fullGpuWindow }) => {
    const telemetry = window.__MiraLithLuBirthHybridKillSpike;
    const requiredGpuSamples = fullGpuWindow
      ? telemetry?.gpuWindowSize ?? 30
      : 30;
    return telemetry?.active === true && telemetry.lobeCount > 0 &&
      (telemetry.gpuTimerSupported === false || telemetry.gpuSampleCount >= requiredGpuSamples);
  }, options, { timeout: options.fullGpuWindow ? 55_000 : 45_000 });
  return page.evaluate(() => window.__MiraLithLuBirthHybridKillSpike);
}

async function hideKillSpikeHud(page: Page) {
  await page.locator(".lubirth-hybrid-kill-spike__hud").evaluate((element) => {
    (element as HTMLElement).style.visibility = "hidden";
  });
}

async function screenshotKillSpike(
  page: Page,
  options?: Parameters<Page["screenshot"]>[0]
) {
  // A black Playwright mask looks like a missing portion of the Earth/cloud
  // render in visual evidence. Hide only the fixed DOM HUD so screenshots and
  // pixel metrics retain the actual WebGL image underneath.
  await hideKillSpikeHud(page);
  return page.screenshot(options);
}

async function screenshotPixels(page: Page) {
  const screenshot = await screenshotKillSpike(page);
  return sharp(screenshot).removeAlpha().raw().toBuffer({
    resolveWithObject: true
  });
}

async function screenshotRgb(page: Page) {
  const decoded = await screenshotPixels(page);
  return decoded.data;
}

function measureTauSilhouetteRoughness(
  data: Buffer,
  width: number,
  height: number,
  channels: number
) {
  const foreground: Array<[number, number, number]> = [];
  const foregroundMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const luminance =
        data[offset] * 0.2126 +
        data[offset + 1] * 0.7152 +
        data[offset + 2] * 0.0722;
      if (luminance > 28) {
        foreground.push([x, y, luminance]);
        foregroundMask[y * width + x] = 1;
      }
    }
  }
  if (foreground.length === 0) {
    return {
      contourResidualRms: Number.POSITIVE_INFINITY,
      foregroundPixels: 0,
      mainComponentPixels: 0,
      satellitePixels: 0
    };
  }

  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  for (const [x, y, luminance] of foreground) {
    weightedX += x * luminance;
    weightedY += y * luminance;
    totalWeight += luminance;
  }
  const centerX = weightedX / totalWeight;
  const centerY = weightedY / totalWeight;
  const radii = new Array<number>(360).fill(0);
  for (const [x, y] of foreground) {
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    const angle = Math.floor(
      ((Math.atan2(deltaY, deltaX) + Math.PI) / (Math.PI * 2)) * radii.length
    ) % radii.length;
    radii[angle] = Math.max(radii[angle], Math.hypot(deltaX, deltaY));
  }
  const smooth = (radius: number) => radii.map((_, index) => {
    let total = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      total += radii[(index + offset + radii.length) % radii.length];
    }
    return total / (radius * 2 + 1);
  });
  const detail = smooth(4);
  const macro = smooth(18);
  const contourResidualRms = Math.sqrt(
    detail.reduce((total, value, index) => {
      const residual = value - macro[index];
      return total + residual * residual;
    }, 0) / detail.length
  );

  // A smooth radial contour alone can still hide several detached lobe balls.
  // Verify that the final tau field is one coherent optical mass, allowing at
  // most tiny antialiasing islands at the threshold.
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(foreground.length);
  let mainComponentPixels = 0;
  let satellitePixels = 0;
  for (const [x, y] of foreground) {
    const origin = y * width + x;
    if (visited[origin]) {
      continue;
    }
    let head = 0;
    let tail = 1;
    let componentPixels = 0;
    queue[0] = origin;
    visited[origin] = 1;
    while (head < tail) {
      const current = queue[head++];
      componentPixels += 1;
      const currentX = current % width;
      const currentY = Math.floor(current / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const sampleY = currentY + offsetY;
        if (sampleY < 0 || sampleY >= height) {
          continue;
        }
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = currentX + offsetX;
          if (
            (offsetX === 0 && offsetY === 0) ||
            sampleX < 0 ||
            sampleX >= width
          ) {
            continue;
          }
          const neighbour = sampleY * width + sampleX;
          if (!foregroundMask[neighbour] || visited[neighbour]) {
            continue;
          }
          visited[neighbour] = 1;
          queue[tail++] = neighbour;
        }
      }
    }
    if (componentPixels > mainComponentPixels) {
      satellitePixels += mainComponentPixels;
      mainComponentPixels = componentPixels;
    } else {
      satellitePixels += componentPixels;
    }
  }
  return {
    contourResidualRms,
    foregroundPixels: foreground.length,
    mainComponentPixels,
    satellitePixels
  };
}

function measurePhysicalPlaneLighting(
  planes: Awaited<ReturnType<typeof screenshotPixels>>,
  radiance: Awaited<ReturnType<typeof screenshotPixels>>
) {
  if (
    planes.info.width !== radiance.info.width ||
    planes.info.height !== radiance.info.height ||
    planes.info.channels !== radiance.info.channels
  ) {
    throw new Error("Plane and radiance diagnostics must use the same framebuffer.");
  }

  const luminance = (data: Buffer, offset: number) => (
    data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
  );
  const planesByFacing = {
    side: { pixels: 0, radiance: 0 },
    top: { pixels: 0, radiance: 0 },
    underside: { pixels: 0, radiance: 0 }
  };

  for (let offset = 0; offset < planes.data.length; offset += planes.info.channels) {
    const red = planes.data[offset];
    const green = planes.data[offset + 1];
    const blue = planes.data[offset + 2];
    // The planes view is authored from the exact final analytic normal:
    // top=orange, side=green, underside=blue. Classifying those colours is
    // invariant under camera rotation, unlike splitting the screenshot into
    // arbitrary horizontal bands.
    const plane = red > 42 && red > green * 1.3 && red > blue * 1.5
      ? planesByFacing.top
      : green > 42 && green > red * 1.2 && green > blue * 1.2
        ? planesByFacing.side
        : blue > 42 && blue > red * 1.2 && blue > green * 1.15
          ? planesByFacing.underside
          : null;
    if (!plane) {
      continue;
    }
    plane.pixels += 1;
    plane.radiance += luminance(radiance.data, offset);
  }

  return {
    side: {
      pixels: planesByFacing.side.pixels,
      radiance: planesByFacing.side.radiance / Math.max(planesByFacing.side.pixels, 1)
    },
    top: {
      pixels: planesByFacing.top.pixels,
      radiance: planesByFacing.top.radiance / Math.max(planesByFacing.top.pixels, 1)
    },
    underside: {
      pixels: planesByFacing.underside.pixels,
      radiance: planesByFacing.underside.radiance /
        Math.max(planesByFacing.underside.pixels, 1)
    }
  };
}

for (const camera of ["near", "mid-oblique", "oblique"] as const) {
  test(`Phase -1 hybrid cloud kill-spike renders ${camera} camera with bounded telemetry`, async ({
    page,
    viewport
  }, testInfo) => {
    await page.goto(`/lubirth-hybrid-cloud-kill-spike?camera=${camera}`);
    const telemetry = await waitForKillSpikeTelemetry(page, { fullGpuWindow: true });
    const evidenceDirectory = process.env.MIRALITH_PHASE1_EVIDENCE_DIR;
    if (evidenceDirectory) {
      mkdirSync(evidenceDirectory, { recursive: true });
      await screenshotKillSpike(page, {
        path: join(evidenceDirectory, `desktop-${camera}.png`)
      });
      const body = `${JSON.stringify(telemetry, null, 2)}\n`;
      writeFileSync(join(evidenceDirectory, `desktop-${camera}.telemetry.json`), body);
      await testInfo.attach(`phase1-${camera}-telemetry.json`, {
        body,
        contentType: "application/json"
      });
    }

    expect(telemetry).toBeTruthy();
    expect(telemetry?.camera).toBe(camera);
    expect(telemetry?.capability).toBe("webgl2");
    expect(telemetry?.layoutId).toBe("v3-r-depth-g-height-b-morphology-a-concavity");
    expect(telemetry?.coordinateSpace).toBe("earth-local-v3");
    expect(telemetry?.densityProfileVersion).toBe("source-native-patch-height-field-v4");
    expect(telemetry?.topologyDistanceSpace).toBe("earth-local-tangent-normalized-radius");
    expect(telemetry?.hierarchyVersion).toBe("base-tower-detail-v4");
    expect(telemetry?.baseCarrierCount).toBe(1);
    expect(telemetry?.cameraFrameId).toContain(camera);
    expect(telemetry?.cameraMatrixSignature).toMatch(/^[a-f0-9]{8}$/);
    expect(telemetry?.candidateHash).toMatch(/^[a-f0-9]{8}$/);
    expect(telemetry?.candidateHashSchema).toBe("fnv1a-instance-buffer-v3");
    expect(telemetry?.hierarchyHash).toMatch(/^[a-f0-9]{8}$/);
    expect(telemetry?.candidateSetCount).toBe(telemetry?.lobeCount);
    expect(telemetry?.sourceUvBounds).toEqual([
      370 / 512,
      105 / 256,
      405 / 512,
      138 / 256
    ]);
    // The one local-volume proxy covers the entire immutable V3 patch. Base
    // selectors are intentionally sparse support points, so their ellipse
    // union is diagnostic only; source-backed coverage is the real proof that
    // the selected patch contains broad mass and a usable height gradient.
    expect(telemetry?.sourcePatchFootprintCoverageRatio).toBeGreaterThanOrEqual(0.3);
    expect(telemetry?.sourcePatchMeanCoverage).toBeGreaterThanOrEqual(0.12);
    expect(
      (telemetry?.sourcePatchHeightP95 ?? 0) - (telemetry?.sourcePatchHeightP05 ?? 0)
    ).toBeGreaterThanOrEqual(0.18);
    expect(telemetry?.offset).toEqual([0.045, 0.018]);
    expect(telemetry?.orientation).toBe("equirect-u-repeat-v-clamp-north-up");
    expect(telemetry?.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(telemetry?.generatorVersion.length).toBeGreaterThan(0);
    expect(telemetry?.gpuFieldSource).toBe(
      "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png"
    );
    expect(telemetry?.gpuFieldResolution).toEqual([2048, 1024]);
    expect(telemetry?.gpuRenderer.length).toBeGreaterThan(0);
    expect(telemetry?.candidateSeedRange[0]).toBe(0);
    expect(telemetry?.candidateSeedRange[1]).toBeGreaterThan(0);
    expect(telemetry?.coverageMeanEstimate).toBeGreaterThan(0);
    expect(telemetry?.coverageAreaTemporalP95Estimate).toBeGreaterThan(0);
    expect(telemetry?.coverageSpatialP95Estimate).toBeGreaterThanOrEqual(0);
    expect(telemetry?.coverageSpatialP95Estimate).toBeLessThanOrEqual(3.5);
    expect(telemetry?.coverageTemporalP95Estimate).toBeGreaterThanOrEqual(0);
    expect(telemetry?.coverageTemporalP95Estimate).toBeLessThanOrEqual(3.5);
    expect(telemetry?.frameP95Ms).toBeGreaterThanOrEqual(0);
    expect(telemetry?.accumulationProbe.verdict).toBe("pass");
    expect(telemetry?.accumulationProbe.framebufferComplete).toBe(true);
    expect(telemetry?.accumulationProbe.rgba16fTexture).toBe(true);
    expect(telemetry?.accumulationProbe.additiveDraw).toBe(true);
    expect(telemetry?.accumulationProbe.multipleRenderTargets).toBe(true);
    expect(telemetry?.accumulationProbe.verified).toBe(true);
    expect(telemetry?.accumulationProbe.readbackMode).not.toBe("none");
    expect(telemetry?.gpuTimerSupported).toBe(true);
    expect(telemetry?.gpuDisjointResetCount).toBe(0);
    expect(telemetry?.gpuTimingScope).toBe("rgba16f-depth-layer-accumulation-composite");
    expect(telemetry?.depthBinMode).toBe(2);
    expect(telemetry?.accumulationTargetCount).toBe(2);
    expect(telemetry?.depthBinSegmentation).toBe("view-ray-overlap-partition");
    expect(telemetry?.depthBinBoundary).toBeGreaterThan(0);
    expect(telemetry?.depthBinRolePriorMassEstimate.far).toBeGreaterThan(0);
    expect(telemetry?.depthBinRolePriorMassEstimate.near).toBeGreaterThan(0);
    expect(telemetry?.depthBinSubmittedLobeCount.far).toBeGreaterThan(0);
    expect(telemetry?.depthBinSubmittedLobeCount.near).toBeGreaterThan(0);
    expect(telemetry?.rendererMode).toBe("local-volume");
    expect(telemetry?.localVolumeFieldVersion).toBe("v9-source-native-patch-oct-normal-directional-light-rgba8");
    expect(telemetry?.localVolumeTileCount).toBeGreaterThan(0);
    expect(telemetry?.localVolumeSunTextureLookupCountPerPixel).toBe(0);
    expect(telemetry?.localVolumeSourceMaskTextureLookupCountPerPixel).toBe(1);
    expect(telemetry?.localVolumeTotalTextureLookupCountPerPixel).toBe(
      (telemetry?.localVolumeViewTextureLookupCountPerPixel ?? 0) + 1
    );
    expect(telemetry?.gpuWarmupFrames).toBe(240);
    expect(telemetry?.gpuWindowSize).toBe(120);
    expect(telemetry?.gpuPhaseSampleInterval).toBe(8);
    expect(telemetry?.gpuTotalSampleInterval).toBe(4);
    expect(telemetry?.gpuSampleCount).toBe(telemetry?.gpuWindowSize);
    expect(telemetry?.gpuTimingSamplesMs).toHaveLength(telemetry?.gpuSampleCount ?? 0);
    expect(telemetry?.gpuPhaseSampleCount).toBeGreaterThanOrEqual(30);
    expect(telemetry?.gpuPhaseTimingSamplesMs.clear).toHaveLength(
      telemetry?.gpuPhaseSampleCount ?? 0
    );
    expect(telemetry?.gpuPhaseTimingSamplesMs.accumulation).toHaveLength(
      telemetry?.gpuPhaseSampleCount ?? 0
    );
    expect(telemetry?.gpuPhaseTimingSamplesMs.composite).toHaveLength(
      telemetry?.gpuPhaseSampleCount ?? 0
    );
    expect(telemetry?.gpuP50Ms).not.toBeNull();
    expect(telemetry?.gpuP95Ms).not.toBeNull();
    expect(telemetry?.gpuP95Ms ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(3);
    expect(telemetry?.gpuPhaseP95Ms.clear).not.toBeNull();
    expect(telemetry?.gpuPhaseP95Ms.accumulation).not.toBeNull();
    expect(telemetry?.gpuPhaseP95Ms.composite).not.toBeNull();

    const expectedTier = Math.min(viewport?.width ?? 1440, viewport?.height ?? 960) < 520
      ? "mobile"
      : "desktop";
    const maxResolved = expectedTier === "mobile"
      ? { height: 270, width: 480 }
      : { height: 640, width: 960 };
    const renderScale = 0.5;

    expect(telemetry?.tier).toBe(expectedTier);
    expect(telemetry?.localVolumeFieldResolution).toEqual(
      expectedTier === "mobile" ? [96, 72, 20] : [160, 120, 32]
    );
    expect(telemetry?.localVolumeViewSamples).toBe(expectedTier === "mobile" ? 3 : 4);
    expect(telemetry?.localVolumeViewTextureLookupCountPerPixel).toBe(
      expectedTier === "mobile" ? 3 : 4
    );
    expect(telemetry?.localVolumeAccumulationDrawCount).toBe(1);
    expect(telemetry?.lobeCount).toBeGreaterThanOrEqual(expectedTier === "mobile" ? 8 : 12);
    expect(telemetry?.lobeCount).toBeLessThanOrEqual(expectedTier === "mobile" ? 24 : 48);
    expect(telemetry?.lobeRoleCounts.base).toBeGreaterThan(0);
    expect(telemetry?.lobeRoleCounts.tower).toBeGreaterThan(0);
    expect(telemetry?.lobeRoleCounts.detail).toBeGreaterThan(0);
    expect(
      telemetry!.lobeRoleCounts.base +
      telemetry!.lobeRoleCounts.tower +
      telemetry!.lobeRoleCounts.detail
    ).toBe(telemetry?.lobeCount);
    expect(telemetry?.parentedLobeCount).toBe(
      telemetry!.lobeRoleCounts.tower + telemetry!.lobeRoleCounts.detail
    );
    expect(telemetry?.orphanChildCount).toBe(0);
    expect(telemetry?.hierarchyMetrics.towerMeanElevation).toBeGreaterThan(
      telemetry?.hierarchyMetrics.detailMeanElevation ?? 0
    );
    expect(telemetry?.hierarchyMetrics.detailMeanElevation).toBeGreaterThan(0);
    // The carrier is an aggregate optical envelope. These gates deliberately
    // inspect only real V3 base samples, so a broad carrier cannot turn a
    // disconnected base set into a false single component.
    expect(telemetry?.hierarchyMetrics.baseCount).toBeGreaterThan(1);
    expect(telemetry?.hierarchyMetrics.baseComponentCount).toBe(1);
    expect(telemetry?.hierarchyMetrics.baseCarrierContainmentRatio).toBeGreaterThanOrEqual(0.99);
    expect(
      telemetry?.hierarchyMetrics.baseCarrierFootprintUnionCoverageRatio
    ).toBeGreaterThan(0);
    expect(
      telemetry?.hierarchyMetrics.baseCarrierFootprintUnionCoverageRatio
    ).toBeLessThanOrEqual(1);
    expect(
      telemetry?.hierarchyMetrics.maxBaseNearestNeighborDistance
    ).toBeLessThan(0.06);
    expect(
      telemetry?.hierarchyMetrics.maxBaseNormalizedNearestSeparation
    ).toBeLessThanOrEqual(1.05);
    expect(telemetry?.hierarchyMetrics.maxNormalizedTangentAttachment).toBeLessThan(1.5);
    const baseIds = new Set(
      telemetry!.lobeHierarchy
        .filter((lobe) => lobe.role === "base" && !lobe.isCarrier)
        .map((lobe) => lobe.id)
    );
    expect(telemetry?.lobeHierarchy).toHaveLength(telemetry!.lobeCount);
    for (const lobe of telemetry!.lobeHierarchy) {
      if (lobe.role === "base") {
        expect(lobe.parentId).toBeNull();
      } else {
        expect(lobe.parentId).not.toBeNull();
        expect(baseIds.has(lobe.parentId!)).toBe(true);
      }
    }
    expect(telemetry?.opticalMassEstimate).toBeGreaterThan(0);
    expect(telemetry?.submittedLobeCount).toBeGreaterThan(0);
    expect(telemetry?.submittedLobeCount).toBeLessThanOrEqual(telemetry?.lobeCount ?? 0);
    expect(telemetry?.submittedLobeCount).toBe(telemetry?.visibleCount);
    expect(telemetry?.hierarchySubmittedLobeCount).toBeGreaterThanOrEqual(
      telemetry?.submittedLobeCount ?? 0
    );
    expect(telemetry?.hierarchySubmittedMembershipHash).toMatch(/^[a-f0-9]{8}$/);
    expect(
      telemetry!.hierarchySubmittedRoleCounts.base +
      telemetry!.hierarchySubmittedRoleCounts.tower +
      telemetry!.hierarchySubmittedRoleCounts.detail
    ).toBe(telemetry?.hierarchySubmittedLobeCount);
    // Local-volume has exactly one source-bearing patch proxy. Its telemetry
    // must describe the object submitted to the renderer, rather than the
    // hierarchy candidates used to build that proxy.
    if (telemetry?.rendererMode === "local-volume") {
      expect(telemetry.submittedLobeCount).toBe(telemetry.localVolumeTileCount);
      expect(telemetry.depthBinSubmittedLobeCount.far).toBe(
        telemetry.localVolumeTileCount
      );
      expect(telemetry.depthBinSubmittedLobeCount.near).toBe(
        telemetry.localVolumeTileCount
      );
    }
    expect(telemetry?.submittedMembershipHash).toMatch(/^[a-f0-9]{8}$/);
    expect(
      telemetry!.submittedRoleCounts.base +
      telemetry!.submittedRoleCounts.tower +
      telemetry!.submittedRoleCounts.detail
    ).toBe(telemetry?.submittedLobeCount);
    expect(telemetry?.visibleCount).toBeGreaterThan(0);
    expect(telemetry?.visibleCount).toBeLessThanOrEqual(telemetry?.lobeCount ?? 0);
    expect(telemetry?.resolvedSize[0]).toBeLessThanOrEqual(maxResolved.width);
    expect(telemetry?.resolvedSize[1]).toBeLessThanOrEqual(maxResolved.height);
    expect(telemetry?.resolvedSize[0]).toBeLessThanOrEqual(
      Math.ceil((telemetry?.physicalSize[0] ?? 1) * renderScale)
    );
    expect(telemetry?.resolvedSize[1]).toBeLessThanOrEqual(
      Math.ceil((telemetry?.physicalSize[1] ?? 1) * renderScale)
    );
    expect(telemetry?.accumulationSize).toEqual(telemetry?.resolvedSize);
    expect(telemetry?.scissorEnabled).toBe(true);
    expect(telemetry?.compositeScissor[2]).toBeGreaterThan(0);
    expect(telemetry?.compositeScissor[3]).toBeGreaterThan(0);
  });
}

test("Phase -1 near and oblique cameras reuse the same tier-specific Earth-local lobe set", async ({
  page
}) => {
  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=near");
  const nearTelemetry = await waitForKillSpikeTelemetry(page);
  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=oblique");
  const obliqueTelemetry = await waitForKillSpikeTelemetry(page);

  expect(nearTelemetry?.tier).toBe(obliqueTelemetry?.tier);
  expect(nearTelemetry?.candidateHash).toBe(obliqueTelemetry?.candidateHash);
  expect(nearTelemetry?.hierarchyHash).toBe(obliqueTelemetry?.hierarchyHash);
  expect(nearTelemetry?.lobeHierarchy).toEqual(obliqueTelemetry?.lobeHierarchy);
  expect(nearTelemetry?.candidateSetCount).toBe(obliqueTelemetry?.candidateSetCount);
  expect(nearTelemetry?.lobeCount).toBe(obliqueTelemetry?.lobeCount);
  expect(nearTelemetry?.lobeRoleCounts).toEqual(obliqueTelemetry?.lobeRoleCounts);
  expect(nearTelemetry?.sourceUvBounds).toEqual(obliqueTelemetry?.sourceUvBounds);
  expect(nearTelemetry?.cameraFrameId).not.toBe(obliqueTelemetry?.cameraFrameId);
  expect(nearTelemetry?.cameraMatrixSignature).not.toBe(
    obliqueTelemetry?.cameraMatrixSignature
  );
});

test("Phase -1.1 mid-oblique A/B keeps one hierarchy while enabling the near depth layer", async ({
  page
}, testInfo) => {
  const evidenceDirectory = process.env.MIRALITH_PHASE1_EVIDENCE_DIR;
  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=mid-oblique&freeze=1&bins=1");
  const oneBin = await waitForKillSpikeTelemetry(page);
  if (evidenceDirectory) {
    mkdirSync(evidenceDirectory, { recursive: true });
    await screenshotKillSpike(page, {
      path: join(evidenceDirectory, "mid-oblique-1bin.png")
    });
    writeFileSync(
      join(evidenceDirectory, "mid-oblique-1bin.telemetry.json"),
      `${JSON.stringify(oneBin, null, 2)}\n`
    );
  }
  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=mid-oblique&freeze=1&bins=2");
  const twoBin = await waitForKillSpikeTelemetry(page);
  if (evidenceDirectory) {
    await screenshotKillSpike(page, {
      path: join(evidenceDirectory, "mid-oblique-2bin.png")
    });
    const body = `${JSON.stringify(twoBin, null, 2)}\n`;
    writeFileSync(join(evidenceDirectory, "mid-oblique-2bin.telemetry.json"), body);
    await testInfo.attach("phase1-1-mid-oblique-ab-telemetry.json", {
      body,
      contentType: "application/json"
    });
  }

  expect(oneBin?.depthBinMode).toBe(1);
  expect(oneBin?.accumulationTargetCount).toBe(1);
  expect(twoBin?.depthBinMode).toBe(2);
  expect(twoBin?.accumulationTargetCount).toBe(2);
  expect(twoBin?.candidateHash).toBe(oneBin?.candidateHash);
  expect(twoBin?.hierarchyHash).toBe(oneBin?.hierarchyHash);
  expect(twoBin?.lobeHierarchy).toEqual(oneBin?.lobeHierarchy);
  expect(twoBin?.depthBinSegmentation).toBe("view-ray-overlap-partition");
  expect(twoBin?.depthBinBoundary).toBeGreaterThan(0);
  expect(twoBin?.depthBinRolePriorMassEstimate.far).toBeGreaterThan(0);
  expect(twoBin?.depthBinRolePriorMassEstimate.near).toBeGreaterThan(0);
  expect(twoBin?.depthBinSubmittedLobeCount.far).toBeGreaterThan(0);
  expect(twoBin?.depthBinSubmittedLobeCount.near).toBeGreaterThan(0);
});

test("Phase -1 desktop tau silhouette suppresses lobe-bead contour noise", async ({
  page,
  viewport
}, testInfo) => {
  test.skip(viewport?.width !== 1440, "The contour gate is calibrated on the desktop reference viewport.");
  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=near&freeze=1&debug=tau-only");
  await waitForKillSpikeTelemetry(page);
  const evidenceDirectory = process.env.MIRALITH_PHASE1_EVIDENCE_DIR;
  if (evidenceDirectory) {
    mkdirSync(evidenceDirectory, { recursive: true });
    await screenshotKillSpike(page, {
      path: join(evidenceDirectory, "desktop-near-tau-only.png")
    });
    await testInfo.attach("phase1-near-tau-only.png", {
      path: join(evidenceDirectory, "desktop-near-tau-only.png"),
      contentType: "image/png"
    });
  }
  const decoded = await screenshotPixels(page);
  const silhouette = measureTauSilhouetteRoughness(
    decoded.data,
    decoded.info.width,
    decoded.info.height,
    decoded.info.channels
  );

  expect(silhouette.foregroundPixels).toBeGreaterThan(8_000);
  expect(silhouette.contourResidualRms).toBeLessThanOrEqual(3.75);
  expect(silhouette.mainComponentPixels / silhouette.foregroundPixels).toBeGreaterThanOrEqual(0.995);
  expect(silhouette.satellitePixels).toBeLessThanOrEqual(64);
});

test("Phase -1 desktop oblique radiance preserves physical top, side, and underside ordering", async ({
  page,
  viewport
}, testInfo) => {
  test.skip(viewport?.width !== 1440, "The lighting gate is calibrated on the desktop reference viewport.");
  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=oblique&freeze=1&debug=planes");
  await waitForKillSpikeTelemetry(page);
  const evidenceDirectory = process.env.MIRALITH_PHASE1_EVIDENCE_DIR;
  if (evidenceDirectory) {
    mkdirSync(evidenceDirectory, { recursive: true });
    await screenshotKillSpike(page, {
      path: join(evidenceDirectory, "desktop-oblique-planes.png")
    });
  }
  const planes = await screenshotPixels(page);
  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=oblique&freeze=1&debug=radiance-only");
  await waitForKillSpikeTelemetry(page);
  if (evidenceDirectory) {
    await screenshotKillSpike(page, {
      path: join(evidenceDirectory, "desktop-oblique-radiance-only.png")
    });
    await testInfo.attach("phase1-oblique-radiance-only.png", {
      path: join(evidenceDirectory, "desktop-oblique-radiance-only.png"),
      contentType: "image/png"
    });
  }
  const radiance = await screenshotPixels(page);
  const lighting = measurePhysicalPlaneLighting(planes, radiance);

  // The exit gate needs actual analytic surface planes, not a screen-space
  // top/middle/bottom proxy. The thresholds deliberately require a visible
  // side and underside in the final Earth-local oblique view.
  expect(lighting.top.pixels).toBeGreaterThan(2_500);
  expect(lighting.side.pixels).toBeGreaterThan(280);
  expect(lighting.underside.pixels).toBeGreaterThan(500);
  expect(lighting.top.radiance).toBeGreaterThan(lighting.side.radiance * 1.35);
  expect(lighting.side.radiance).toBeGreaterThan(lighting.underside.radiance * 1.25);
});

test("Phase -1 motion sweep preserves hierarchy identity and bounded temporal overdraw", async ({
  page
}, testInfo) => {
  const evidenceDirectory = process.env.MIRALITH_PHASE1_EVIDENCE_DIR;
  const captureEvidence = async (label: string) => {
    const telemetry = await page.evaluate(() => window.__MiraLithLuBirthHybridKillSpike);
    if (evidenceDirectory) {
      mkdirSync(evidenceDirectory, { recursive: true });
      await screenshotKillSpike(page, {
        path: join(evidenceDirectory, `sweep-${label}.png`)
      });
    }
    return telemetry;
  };

  await page.goto("/lubirth-hybrid-cloud-kill-spike?camera=sweep");
  await page.waitForFunction(() => {
    const telemetry = window.__MiraLithLuBirthHybridKillSpike;
    return telemetry?.active === true && telemetry.sweepProgress > 0.04 &&
      telemetry.sweepProgress < 0.18;
  }, null, { timeout: 15_000 });
  const near = await captureEvidence("near");

  await page.waitForFunction(() => {
    const telemetry = window.__MiraLithLuBirthHybridKillSpike;
    return telemetry?.active === true && telemetry.sweepProgress > 0.2 &&
      telemetry.sweepProgress < 0.65;
  }, null, { timeout: 15_000 });
  const middle = await captureEvidence("middle");

  await page.waitForFunction(() => {
    const telemetry = window.__MiraLithLuBirthHybridKillSpike;
    return telemetry?.active === true && telemetry.sweepProgress > 0.85;
  }, null, { timeout: 8_000 });
  const oblique = await captureEvidence("oblique");

  const sampledTelemetry = { near, middle, oblique };
  await testInfo.attach("phase1-sweep-telemetry.json", {
    body: JSON.stringify(sampledTelemetry, null, 2),
    contentType: "application/json"
  });
  if (evidenceDirectory) {
    writeFileSync(
      join(evidenceDirectory, "sweep-telemetry.json"),
      `${JSON.stringify(sampledTelemetry, null, 2)}\n`
    );
  }

  expect(near?.camera).toBe("sweep");
  expect(middle?.camera).toBe("sweep");
  expect(oblique?.camera).toBe("sweep");
  expect(near?.candidateHash).toBe(middle?.candidateHash);
  expect(middle?.candidateHash).toBe(oblique?.candidateHash);
  expect(near?.hierarchyHash).toBe(middle?.hierarchyHash);
  expect(middle?.hierarchyHash).toBe(oblique?.hierarchyHash);
  expect(middle?.lobeHierarchy).toEqual(oblique?.lobeHierarchy);
  expect(middle?.lobeCount).toBe(oblique?.lobeCount);
  expect(middle?.cameraMatrixSignature).not.toBe(oblique?.cameraMatrixSignature);
  expect(oblique?.membershipChurnTemporalP95).toBeLessThanOrEqual(0.1);
  expect(oblique?.coverageTemporalP95Estimate).toBeGreaterThanOrEqual(0);
  expect(oblique?.coverageTemporalP95Estimate).toBeLessThanOrEqual(3.5);
  expect(oblique?.opticalMassEstimate).toBeCloseTo(middle?.opticalMassEstimate ?? 0, 6);
});

test("Phase -1 conservative scissor is pixel-equivalent to the unclipped reference", async ({
  page
}) => {
  await page.goto(
    "/lubirth-hybrid-cloud-kill-spike?camera=near&freeze=1"
  );
  const clippedTelemetry = await waitForKillSpikeTelemetry(page);
  const clipped = await screenshotRgb(page);

  await page.goto(
    "/lubirth-hybrid-cloud-kill-spike?camera=near&freeze=1&scissor=off"
  );
  const unclippedTelemetry = await waitForKillSpikeTelemetry(page);
  const unclipped = await screenshotRgb(page);

  expect(clippedTelemetry?.candidateHash).toBe(unclippedTelemetry?.candidateHash);
  expect(clippedTelemetry?.scissorEnabled).toBe(true);
  expect(unclippedTelemetry?.scissorEnabled).toBe(false);
  expect(clipped.length).toBe(unclipped.length);

  let changed = 0;
  let totalDifference = 0;
  for (let index = 0; index < clipped.length; index += 1) {
    const difference = Math.abs(clipped[index] - unclipped[index]);
    totalDifference += difference;
    if (difference > 1) {
      changed += 1;
    }
  }
  expect(totalDifference / clipped.length).toBeLessThan(0.05);
  expect(changed / clipped.length).toBeLessThan(0.0005);
});
