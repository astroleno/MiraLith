import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  Data3DTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  Texture,
  UnsignedByteType
} from "three";

interface TakramParityContractModule {
  resolveTakramParityRouteQuery(input: { get(name: string): string | null }):
    | {
      ok: true;
      value: {
        cloudCoverageMode?: "parity" | "presentation";
        cloudScale?: 80 | 120 | 160;
        stockWeatherMode?: "unscaled" | "similarity";
        diagnostic: "altitude-ladder" | "altitude-ladder-cloud-off" | "aerial-final" | "bsm-off" | "cloud-raw" | "cloud-raw-off" | "depth-off" | "density-debug" | "full" | "history-reset-first" | "sample-count-debug" | "stage-readback" | "uv-debug";
        input: "stock" | "v3";
        progress: number;
        view: "control" | "opening";
      };
    }
    | {
      ok: false;
      reason:
        | "cloud-coverage-requires-scale"
        | "cloud-scale-requires-coverage-mode"
        | "cloud-scale-requires-opening"
        | "conflicting-scale-contracts"
        | "control-requires-stock"
        | "unknown-cloud-coverage-mode"
        | "unknown-cloud-scale"
        | "unknown-stock-weather-mode"
        | "stock-weather-mode-requires-scale"
        | "stock-weather-mode-requires-stock";
    };
  TAKRAM_PARITY_BOTTOM_RADIUS_M: number;
  TAKRAM_PARITY_CONTROL: {
    altitudeMeters: number;
    coverage: number;
    fovDegrees: number;
    pitchDegrees: number;
    sunAzimuthDegrees: number;
    sunElevationDegrees: number;
  };
  TAKRAM_PARITY_DEFAULTS: {
    haze: boolean;
    lightShafts: boolean;
    qualityPreset: "high";
    resolutionScale: number;
    shapeDetail: boolean;
    temporalUpscale: boolean;
    turbulence: boolean;
  };
  TAKRAM_PARITY_V3_OPENING_PRESET: {
    coverage: number;
    shapeRepeat: number;
    shapeDetailRepeat: number;
  };
  TAKRAM_PARITY_LICENSE: "MIT";
  TAKRAM_PARITY_ELLIPSOID: {
    radii: { x: number; y: number; z: number };
  };
  TAKRAM_PARITY_NPM_PACKAGES: Record<string, string>;
  TAKRAM_PARITY_STOCK_ASSETS: ReadonlyArray<{
    byteLength: number;
    dimensions: readonly [number, number, number];
    format: "rgba8" | "r8" | "rgb8";
    id: "localWeather" | "shape" | "shapeDetail" | "stbn" | "turbulence" | "upstreamTokyo";
    localPath: string;
    runtimeUrl: string | null;
    sha256: string;
    sourceRef: string;
    sourceUrl: string;
  }>;
  TAKRAM_PARITY_UPSTREAM: {
    repository: "https://github.com/takram-design-engineering/three-geospatial";
    visualReferenceCommit: "b012ad06d858fc035d88aacfd73f092f93c994e4";
  };
  isTakramParityLocalAssetUrl(value: string): boolean;
  buildTakramParityRendererFingerprint(input: {
    clouds: Record<string, unknown>;
    aerialPerspective: Record<string, unknown>;
    cloudScaleRuntime?: Record<string, unknown>;
    sharedAssets: Record<string, string>;
  }): Record<string, unknown>;
  hashTakramParityRendererFingerprint(fingerprint: Record<string, unknown>): string;
  hashTakramParityCameraEarthTransform(input: {
    cameraMatrixWorld: readonly number[];
    cameraProjectionMatrix: readonly number[];
    earthMatrixWorld: readonly number[];
  }): string;
  buildTakramParityHistoryEpoch(input: {
    assetGeneration: number;
    atmosphereGeneration: number;
    cameraEarthTransformHash: string;
    cloudCoverage: number | null;
    cloudCoverageMode: string | null;
    cloudScale: number | null;
    coordinateMode: string;
    diagnostic: string;
    input: string;
    localWeatherHash: string | null;
    mipDistancePatchActive: boolean;
    mipDistanceRuntimeIdentity: string | null;
    morphologyCandidate: string | null;
    morphologyView: string | null;
    progress: number;
    rendererConfigurationHash: string | null;
    stockWeatherMode: string | null;
    view: string;
  }): string;
  hashTakramParityHistoryEpoch(epoch: string): string;
  shouldCaptureTakramMatchedTemporalFrame(input: {
    nativeFrameCount: number;
    targetNativeFrameCount: number;
    alreadyCaptured: boolean;
  }): boolean;
  resolveTakramParityTemporalFrameMetadata(input: {
    cloudsFrame: number;
    resolveFrame: number;
    shadowFrame: number;
    stbnDepth: number;
    historyEpoch: string;
  }): {
    cloudsFrame: number;
    resolveFrame: number;
    shadowFrame: number;
    temporalJitterIndex: number;
    stbnSliceIndex: number;
    historyEpochHash: string;
    frameLockPass: boolean;
  };
}

test("captures one immutable matched temporal frame and hashes its epoch", async () => {
  const contract = await loadTakramParityContract();
  expect(contract).not.toBeNull();

  expect(contract?.shouldCaptureTakramMatchedTemporalFrame({
    nativeFrameCount: 32,
    targetNativeFrameCount: 32,
    alreadyCaptured: false
  })).toBe(true);
  expect(contract?.shouldCaptureTakramMatchedTemporalFrame({
    nativeFrameCount: 33,
    targetNativeFrameCount: 32,
    alreadyCaptured: false
  })).toBe(false);
  expect(contract?.shouldCaptureTakramMatchedTemporalFrame({
    nativeFrameCount: 32,
    targetNativeFrameCount: 32,
    alreadyCaptured: true
  })).toBe(false);
  expect(contract?.hashTakramParityHistoryEpoch("[1,2,\"full\"]")).toMatch(
    /^fnv1a-64:[0-9a-f]{16}$/
  );
  expect(contract?.hashTakramParityHistoryEpoch("[1,2,\"full\"]")).not.toBe(
    contract?.hashTakramParityHistoryEpoch("[1,2,\"bsm-off\"]")
  );
  expect(contract?.resolveTakramParityTemporalFrameMetadata({
    cloudsFrame: 32,
    resolveFrame: 32,
    shadowFrame: 32,
    stbnDepth: 64,
    historyEpoch: "[1,2,\"full\"]"
  })).toEqual({
    cloudsFrame: 32,
    resolveFrame: 32,
    shadowFrame: 32,
    temporalJitterIndex: 0,
    stbnSliceIndex: 32,
    historyEpochHash: contract?.hashTakramParityHistoryEpoch("[1,2,\"full\"]"),
    frameLockPass: true
  });

  const identityMatrix = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
  const cameraEarthTransformHash = contract!.hashTakramParityCameraEarthTransform({
    cameraMatrixWorld: identityMatrix,
    cameraProjectionMatrix: identityMatrix,
    earthMatrixWorld: identityMatrix
  });
  expect(cameraEarthTransformHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
  expect(contract!.hashTakramParityCameraEarthTransform({
    cameraMatrixWorld: [...identityMatrix.slice(0, 12), 2, 0, 0, 1],
    cameraProjectionMatrix: identityMatrix,
    earthMatrixWorld: identityMatrix
  })).not.toBe(cameraEarthTransformHash);

  const historyInput = {
    assetGeneration: 1,
    atmosphereGeneration: 2,
    cameraEarthTransformHash,
    cloudCoverage: 0.3,
    cloudCoverageMode: "parity",
    cloudScale: 80,
    coordinateMode: "lubirth-bridge",
    diagnostic: "full",
    input: "stock",
    localWeatherHash: "stock-weather",
    mipDistancePatchActive: false,
    mipDistanceRuntimeIdentity: "native-shader",
    morphologyCandidate: null,
    morphologyView: null,
    progress: 0.06,
    rendererConfigurationHash: "renderer",
    stockWeatherMode: "unscaled",
    view: "opening"
  };
  const historyEpoch = contract!.buildTakramParityHistoryEpoch(historyInput);
  expect(contract!.buildTakramParityHistoryEpoch({ ...historyInput, cloudScale: 120 }))
    .not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({
    ...historyInput,
    cloudCoverageMode: "presentation"
  })).not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({ ...historyInput, cloudCoverage: 0.55 }))
    .not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({
    ...historyInput,
    mipDistancePatchActive: true
  })).not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({
    ...historyInput,
    stockWeatherMode: "similarity"
  })).not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({
    ...historyInput,
    mipDistanceRuntimeIdentity: "patched-shader"
  })).not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({ ...historyInput, progress: 0.12 }))
    .not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({ ...historyInput, view: "control" }))
    .not.toBe(historyEpoch);
  expect(contract!.buildTakramParityHistoryEpoch({
    ...historyInput,
    cameraEarthTransformHash: "fnv1a-64:0000000000000000"
  })).not.toBe(historyEpoch);
});

interface TakramParityAssetLoaderModule {
  configureTakramParityTexture<T extends Texture>(
    assetId: "localWeather" | "shape" | "shapeDetail" | "stbn" | "turbulence",
    texture: T,
    domain?: "stock" | "v3"
  ): T;
  getNextTakramParityAssetGeneration(generation: number): number;
  TAKRAM_PARITY_RUNTIME_ASSET_URLS: {
    localWeather: string;
    shape: string;
    shapeDetail: string;
    stbn: string;
    turbulence: string;
  };
}

const contractModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
const assetLoaderModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityAssetLoader";

async function loadTakramParityContract(): Promise<TakramParityContractModule | null> {
  try {
    return await import(contractModulePath) as TakramParityContractModule;
  } catch {
    return null;
  }
}

async function loadTakramParityAssetLoader(): Promise<TakramParityAssetLoaderModule | null> {
  try {
    return await import(assetLoaderModulePath) as TakramParityAssetLoaderModule;
  } catch {
    return null;
  }
}

async function readLuBirthHeroPackageDependencies() {
  const { readFile } = await import("node:fs/promises");
  const packageJson = JSON.parse(await readFile(
    `${process.cwd()}/packages/lubirth-hero/package.json`,
    "utf8"
  )) as {
    dependencies?: Record<string, string>;
  };
  return packageJson.dependencies ?? {};
}

async function readTakramParityStockManifest() {
  const { readFile } = await import("node:fs/promises");
  const manifestPath = `${process.cwd()}/apps/site/public/assets/lubirth/takram-parity/stock/manifest.json`;
  return JSON.parse(await readFile(manifestPath, "utf8")) as {
    assets: TakramParityContractModule["TAKRAM_PARITY_STOCK_ASSETS"];
    license: string;
    npmPackages: Record<string, string>;
    schemaVersion: number;
    upstream: TakramParityContractModule["TAKRAM_PARITY_UPSTREAM"];
  };
}

test("pins the official stock Takram contract to auditable local assets", async () => {
  const contract = await loadTakramParityContract();

  expect(contract).not.toBeNull();
  expect(contract?.TAKRAM_PARITY_NPM_PACKAGES).toEqual({
    "@react-three/postprocessing": "3.0.4",
    "@takram/three-atmosphere": "0.19.1",
    "@takram/three-clouds": "0.7.6",
    "@takram/three-geospatial": "0.9.1",
    postprocessing: "6.39.1"
  });
  expect(await readLuBirthHeroPackageDependencies()).toMatchObject(
    contract?.TAKRAM_PARITY_NPM_PACKAGES
  );
  expect(contract?.TAKRAM_PARITY_LICENSE).toBe("MIT");
  expect(contract?.TAKRAM_PARITY_UPSTREAM).toEqual({
    repository: "https://github.com/takram-design-engineering/three-geospatial",
    visualReferenceCommit: "b012ad06d858fc035d88aacfd73f092f93c994e4"
  });
  expect(contract?.TAKRAM_PARITY_DEFAULTS).toEqual({
    haze: true,
    lightShafts: true,
    qualityPreset: "high",
    resolutionScale: 1,
    shapeDetail: true,
    temporalUpscale: true,
    turbulence: true
  });
  expect(contract?.TAKRAM_PARITY_V3_OPENING_PRESET).toEqual({
    coverage: 0.55,
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006
  });
  expect(contract?.TAKRAM_PARITY_BOTTOM_RADIUS_M).toBe(6_360_000);
  expect(contract?.TAKRAM_PARITY_ELLIPSOID.radii).toMatchObject({
    x: 6_360_000,
    y: 6_360_000,
    z: 6_360_000
  });
  expect(contract?.TAKRAM_PARITY_CONTROL).toEqual({
    altitudeMeters: 2_500,
    coverage: 0.4,
    fovDegrees: 50,
    pitchDegrees: -8,
    sunAzimuthDegrees: 135,
    sunElevationDegrees: 25
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=control&progress=0.24"
  ))).toEqual({
    ok: true,
    value: { diagnostic: "full", input: "stock", progress: 0.18, view: "control" }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&progress=0.06"
  ))).toEqual({
    ok: true,
    value: { diagnostic: "full", input: "v3", progress: 0.06, view: "opening" }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&progress=0.06&cloudScale=80&cloudCoverage=parity"
  ))).toEqual({
    ok: true,
    value: {
      cloudCoverageMode: "parity",
      cloudScale: 80,
      diagnostic: "full",
      input: "stock",
      progress: 0.06,
      stockWeatherMode: "unscaled",
      view: "opening"
    }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&progress=0.12&cloudScale=160&cloudCoverage=presentation"
  ))).toEqual({
    ok: true,
    value: {
      cloudCoverageMode: "presentation",
      cloudScale: 160,
      diagnostic: "full",
      input: "v3",
      progress: 0.12,
      view: "opening"
    }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&progress=0.06&cloudScale=80&cloudCoverage=parity&stockWeather=similarity"
  ))).toEqual({
    ok: true,
    value: {
      cloudCoverageMode: "parity",
      cloudScale: 80,
      diagnostic: "full",
      input: "stock",
      progress: 0.06,
      stockWeatherMode: "similarity",
      view: "opening"
    }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&cloudScale=80&cloudCoverage=parity&stockWeather=similarity"
  ))).toEqual({ ok: false, reason: "stock-weather-mode-requires-stock" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&stockWeather=similarity"
  ))).toEqual({ ok: false, reason: "stock-weather-mode-requires-scale" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&cloudScale=80&cloudCoverage=parity&stockWeather=scaled"
  ))).toEqual({ ok: false, reason: "unknown-stock-weather-mode" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=control&cloudScale=80&cloudCoverage=parity"
  ))).toEqual({ ok: false, reason: "cloud-scale-requires-opening" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&cloudScale=81&cloudCoverage=parity"
  ))).toEqual({ ok: false, reason: "unknown-cloud-scale" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&cloudScale=80"
  ))).toEqual({ ok: false, reason: "cloud-scale-requires-coverage-mode" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&cloudCoverage=parity"
  ))).toEqual({ ok: false, reason: "cloud-coverage-requires-scale" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&cloudScale=80&cloudCoverage=legacy"
  ))).toEqual({ ok: false, reason: "unknown-cloud-coverage-mode" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&cloudScale=80&cloudCoverage=parity&morphologyView=opening-orbit"
  ))).toEqual({ ok: false, reason: "conflicting-scale-contracts" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&diagnostic=cloud-raw"
  ))).toEqual({
    ok: true,
    value: { diagnostic: "cloud-raw", input: "stock", progress: 0, view: "opening" }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&diagnostic=cloud-raw-off&morphologyView=near-oblique&morphologyCandidate=baseline"
  ))).toEqual({
    ok: true,
    value: {
      diagnostic: "cloud-raw-off",
      input: "v3",
      morphologyCandidate: "baseline",
      morphologyView: "near-oblique",
      progress: 0,
      view: "opening"
    }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&diagnostic=depth-off"
  ))).toEqual({
    ok: true,
    value: { diagnostic: "depth-off", input: "v3", progress: 0, view: "opening" }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&diagnostic=uv-debug"
  ))).toEqual({
    ok: true,
    value: { diagnostic: "uv-debug", input: "v3", progress: 0, view: "opening" }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&diagnostic=stage-readback&morphologyView=opening-orbit&morphologyCandidate=opening-shape-260-detail-40"
  ))).toEqual({
    ok: true,
    value: {
      diagnostic: "stage-readback",
      input: "v3",
      morphologyCandidate: "opening-shape-260-detail-40",
      morphologyView: "opening-orbit",
      progress: 0,
      view: "opening"
    }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&diagnostic=bsm-off"
  ))).toEqual({
    ok: true,
    value: { diagnostic: "full", input: "stock", progress: 0, view: "opening" }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=control"
  ))).toEqual({ ok: false, reason: "control-requires-stock" });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&diagnostic=altitude-ladder&altitudeMeters=200000"
  ))).toEqual({
    ok: true,
    value: {
      diagnostic: "altitude-ladder",
      input: "v3",
      progress: 0,
      view: "opening",
      altitudeMeters: 200_000
    }
  });
  expect(contract?.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&diagnostic=altitude-ladder-cloud-off&altitudeMeters=200000"
  ))).toEqual({
    ok: true,
    value: {
      diagnostic: "altitude-ladder-cloud-off",
      input: "v3",
      progress: 0,
      view: "opening",
      altitudeMeters: 200_000
    }
  });

  expect(contract?.TAKRAM_PARITY_STOCK_ASSETS).toEqual([
    {
      byteLength: 679_653,
      dimensions: [512, 512, 1],
      format: "rgba8",
      id: "localWeather",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/local-weather.png",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/local-weather.png",
      sha256: "b84daef855dc5eebcc9b174fe832ba75a98e44b846dde201bce354417cc08031",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/local_weather.png"
    },
    {
      byteLength: 2_097_152,
      dimensions: [128, 128, 128],
      format: "r8",
      id: "shape",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/shape.bin",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/shape.bin",
      sha256: "ef65cf6156894720c00bf572c49e3e254f8899c4b5158246e5a35a1922e2519c",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/shape.bin"
    },
    {
      byteLength: 32_768,
      dimensions: [32, 32, 32],
      format: "r8",
      id: "shapeDetail",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/shape-detail.bin",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/shape-detail.bin",
      sha256: "c09112199c6e0281b74ff5283c11c2943ae082650b9b67978cf5d59ed2956e4f",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/shape_detail.bin"
    },
    {
      byteLength: 49_691,
      dimensions: [128, 128, 1],
      format: "rgba8",
      id: "turbulence",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/turbulence.png",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/turbulence.png",
      sha256: "ec2b1b0af4a6a6104102b21e58beb300b0a3d334c0281d84fde8c91d322910f9",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/turbulence.png"
    },
    {
      byteLength: 1_048_576,
      dimensions: [128, 128, 64],
      format: "r8",
      id: "stbn",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/stbn.bin",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/stbn.bin",
      sha256: "51f52f21e5578384585050390821a0a486dcb81e11a716fa7b92fbb6515ba852",
      sourceRef: "9627216cc50057994c98a2118f3c4a23765d43b9",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/9627216cc50057994c98a2118f3c4a23765d43b9/packages/core/assets/stbn.bin"
    },
    {
      byteLength: 1_728_473,
      dimensions: [1920, 1080, 1],
      format: "rgb8",
      id: "upstreamTokyo",
      localPath: "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/reference/upstream-tokyo.jpg",
      runtimeUrl: null,
      sha256: "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5",
      sourceRef: "b012ad06d858fc035d88aacfd73f092f93c994e4",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/b012ad06d858fc035d88aacfd73f092f93c994e4/packages/clouds/docs/tokyo.jpg"
    }
  ]);
  expect(contract?.isTakramParityLocalAssetUrl(
    "/assets/lubirth/takram-parity/stock/local-weather.png"
  )).toBe(true);
  expect(contract?.isTakramParityLocalAssetUrl(
    "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/local_weather.png"
  )).toBe(false);
});

test("vendors byte-identical local stock assets and an audit manifest", async () => {
  const contract = await loadTakramParityContract();

  expect(contract).not.toBeNull();
  execFileSync(
    "node",
    ["packages/lubirth-hero/scripts/vendor-takram-parity-assets.mjs"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  const { readFile, stat } = await import("node:fs/promises");
  const heroPackage = JSON.parse(await readFile(
    `${process.cwd()}/packages/lubirth-hero/package.json`,
    "utf8"
  )) as { scripts?: Record<string, string> };
  expect(heroPackage.scripts?.["vendor:takram-parity-assets"]).toBe(
    "node scripts/vendor-takram-parity-assets.mjs"
  );

  const manifest = await readTakramParityStockManifest();
  expect(manifest).toMatchObject({
    assets: contract?.TAKRAM_PARITY_STOCK_ASSETS,
    license: "MIT",
    npmPackages: contract?.TAKRAM_PARITY_NPM_PACKAGES,
    schemaVersion: 1,
    upstream: contract?.TAKRAM_PARITY_UPSTREAM
  });

  for (const asset of contract?.TAKRAM_PARITY_STOCK_ASSETS ?? []) {
    const contents = await readFile(`${process.cwd()}/${asset.localPath}`);
    expect((await stat(`${process.cwd()}/${asset.localPath}`)).size).toBe(asset.byteLength);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(asset.sha256);
  }
});

test("configures each native Takram texture from an explicit local asset contract", async () => {
  const loader = await loadTakramParityAssetLoader();

  expect(loader).not.toBeNull();
  expect(loader?.TAKRAM_PARITY_RUNTIME_ASSET_URLS).toEqual({
    localWeather: "/assets/lubirth/takram-parity/stock/local-weather.png",
    shape: "/assets/lubirth/takram-parity/stock/shape.bin",
    shapeDetail: "/assets/lubirth/takram-parity/stock/shape-detail.bin",
    stbn: "/assets/lubirth/takram-parity/stock/stbn.bin",
    turbulence: "/assets/lubirth/takram-parity/stock/turbulence.png"
  });

  const weather = loader?.configureTakramParityTexture("localWeather", new Texture());
  const v3Weather = loader?.configureTakramParityTexture("localWeather", new Texture(), "v3");
  const turbulence = loader?.configureTakramParityTexture("turbulence", new Texture());
  const shape = loader?.configureTakramParityTexture(
    "shape",
    new Data3DTexture(new Uint8Array(128 * 128 * 128), 128, 128, 128)
  );
  const shapeDetail = loader?.configureTakramParityTexture(
    "shapeDetail",
    new Data3DTexture(new Uint8Array(32 * 32 * 32), 32, 32, 32)
  );
  const stbn = loader?.configureTakramParityTexture(
    "stbn",
    new Data3DTexture(new Uint8Array(128 * 128 * 64), 128, 128, 64)
  );

  for (const texture of [weather, turbulence]) {
    expect(texture?.colorSpace).toBe(NoColorSpace);
    expect(texture?.flipY).toBe(true);
    expect(texture?.magFilter).toBe(LinearFilter);
    expect(texture?.minFilter).toBe(LinearMipmapLinearFilter);
    expect(texture?.wrapS).toBe(RepeatWrapping);
    expect(texture?.wrapT).toBe(RepeatWrapping);
  }

  expect(v3Weather?.wrapS).toBe(RepeatWrapping);
  expect(v3Weather?.wrapT).toBe(ClampToEdgeWrapping);

  for (const texture of [shape, shapeDetail]) {
    expect(texture?.colorSpace).toBe(NoColorSpace);
    expect(texture?.format).toBe(RedFormat);
    expect(texture?.magFilter).toBe(LinearFilter);
    expect(texture?.minFilter).toBe(LinearFilter);
    expect(texture?.type).toBe(UnsignedByteType);
    expect(texture?.wrapS).toBe(RepeatWrapping);
    expect(texture?.wrapT).toBe(RepeatWrapping);
    expect(texture?.wrapR).toBe(RepeatWrapping);
  }

  expect(stbn?.colorSpace).toBe(NoColorSpace);
  expect(stbn?.format).toBe(RedFormat);
  expect(stbn?.magFilter).toBe(NearestFilter);
  expect(stbn?.minFilter).toBe(NearestFilter);
  expect(stbn?.type).toBe(UnsignedByteType);
  expect(stbn?.wrapS).toBe(RepeatWrapping);
  expect(stbn?.wrapT).toBe(RepeatWrapping);
  expect(stbn?.wrapR).toBe(RepeatWrapping);
  expect(loader?.getNextTakramParityAssetGeneration(4)).toBe(5);
});

test("fingerprints resolved native state and rejects non-adapter drift", async () => {
  const contract = await loadTakramParityContract();
  expect(contract).not.toBeNull();

  const runtime = {
    clouds: {
      cloudsPass: {
        currentMaterial: {
          defines: {
            PERSPECTIVE_CAMERA: "1",
            GLOBAL_WEATHER_MAPPING: "1"
          },
          temporalUpscale: true,
          shapeDetail: true,
          turbulence: true,
          shadowLength: true,
          haze: true,
          multiScatteringOctaves: 2,
          accurateSunSkyLight: true,
          accuratePhaseFunction: true,
          shadowCascadeCount: 4,
          shadowSampleCount: 8,
          scatterAnisotropy1: 0.7,
          scatterAnisotropy2: -0.2,
          scatterAnisotropyMix: 0.5,
          uniforms: {
            maxIterationCount: { value: 128 },
            minStepSize: { value: 100 },
            maxStepSize: { value: 1000 },
            maxRayDistance: { value: 100000 },
            perspectiveStepScale: { value: 1 },
            minDensity: { value: 0.01 },
            minExtinction: { value: 0.01 },
            minTransmittance: { value: 0.01 },
            maxIterationCountToSun: { value: 6 },
            maxIterationCountToGround: { value: 2 },
            minSecondaryStepSize: { value: 100 },
            secondaryStepScale: { value: 1 },
            maxShadowFilterRadius: { value: 6 },
            maxShadowLengthIterationCount: { value: 24 },
            minShadowLengthStepSize: { value: 100 },
            maxShadowLengthRayDistance: { value: 100000 },
            hazeDensityScale: { value: 0.00003 },
            hazeExponent: { value: 0.001 },
            hazeScatteringCoefficient: { value: 0.9 },
            hazeAbsorptionCoefficient: { value: 0.5 },
            skyLightScale: { value: 1 },
            groundBounceScale: { value: 1 },
            powderScale: { value: 0.8 },
            powderExponent: { value: 150 },
            scatteringCoefficient: { value: 1 },
            absorptionCoefficient: { value: 0 },
            coverage: { value: 0.3 },
            shapeRepeat: { value: 0.0003 },
            shapeDetailRepeat: { value: 0.006 }
          }
        },
        currentRenderTarget: { width: 64, height: 64, textures: [], texture: { format: 1023, type: 1016 } },
        resolveRenderTarget: { width: 256, height: 256, textures: [], texture: { format: 1023, type: 1016 } },
        historyRenderTarget: { width: 256, height: 256, textures: [], texture: { format: 1023, type: 1016 } }
      },
      shadowPass: {
        currentMaterial: {
          defines: { SHADOW: "1", GLOBAL_WEATHER_MAPPING: "1" },
          temporalPass: true,
          temporalJitter: true,
          shapeDetail: true,
          turbulence: true,
          cascadeCount: 4,
          uniforms: {
            maxIterationCount: { value: 64 },
            minStepSize: { value: 100 },
            maxStepSize: { value: 1000 },
            minDensity: { value: 0.01 },
            minExtinction: { value: 0.01 },
            minTransmittance: { value: 0.01 },
            opticalDepthTailScale: { value: 2 }
          }
        }
      }
    },
    aerialPerspective: {
      defines: { SUN_LIGHT: "1", SKY_LIGHT: "1", GLOBAL_WEATHER_MAPPING: "1" },
      correctGeometricError: true,
      sunLight: true,
      skyLight: true,
      transmittance: true,
      inscatter: true,
      sky: true,
      sun: false,
      moon: false,
      ground: true,
      octEncodedNormal: true,
      reconstructNormal: false,
      uniforms: {
        albedoScale: { value: 1 },
        geometricErrorCorrectionAmount: { value: 1 },
        shadowRadius: { value: 1 },
        lunarRadianceScale: { value: 1 }
      }
    },
    sharedAssets: {
      shape: "shape",
      shapeDetail: "detail",
      stbn: "stbn",
      turbulence: "turbulence"
    }
  };

  const first = contract!.buildTakramParityRendererFingerprint(runtime);
  const firstHash = contract!.hashTakramParityRendererFingerprint(first);
  expect(first).toMatchObject({ schemaVersion: 3 });
  expect(firstHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
  expect((first.clouds as Record<string, unknown>).defines).not.toHaveProperty(
    "GLOBAL_WEATHER_MAPPING"
  );
  expect((first.clouds as Record<string, unknown>).uniforms).toMatchObject({
    coverage: 0.3,
    shapeRepeat: 0.0003,
    shapeDetailRepeat: 0.006
  });

  (runtime.clouds.cloudsPass.currentMaterial.uniforms.maxIterationCount.value as number) = 129;
  const second = contract!.buildTakramParityRendererFingerprint(runtime);
  expect(contract!.hashTakramParityRendererFingerprint(second)).not.toBe(firstHash);

  (runtime.clouds.cloudsPass.currentMaterial.uniforms.coverage.value as number) = 0.55;
  const presentationVariant = contract!.buildTakramParityRendererFingerprint(runtime);
  expect(contract!.hashTakramParityRendererFingerprint(presentationVariant)).not.toBe(
    contract!.hashTakramParityRendererFingerprint(second)
  );

  const cloudScaleRuntime = {
    classification: "PUBLIC_PARAMETER_SIMILARITY",
    coverage: 0.55,
    layers: [{ channel: "r", height: 52_000, densityScale: 0.0025 }],
    scale: 80,
    turbulenceDisplacement: 28_000
  };
  const scaledFingerprint = contract!.buildTakramParityRendererFingerprint({
    ...runtime,
    cloudScaleRuntime
  });
  expect(scaledFingerprint).toMatchObject({
    cloudScale: cloudScaleRuntime,
    schemaVersion: 5
  });
  expect(contract!.hashTakramParityRendererFingerprint(scaledFingerprint)).not.toBe(
    contract!.hashTakramParityRendererFingerprint(presentationVariant)
  );
  const changedScaleFingerprint = contract!.buildTakramParityRendererFingerprint({
    ...runtime,
    cloudScaleRuntime: { ...cloudScaleRuntime, turbulenceDisplacement: 28_001 }
  });
  expect(contract!.hashTakramParityRendererFingerprint(changedScaleFingerprint)).not.toBe(
    contract!.hashTakramParityRendererFingerprint(scaledFingerprint)
  );
});
