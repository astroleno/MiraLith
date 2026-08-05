import { Ellipsoid } from "@takram/three-geospatial";

export const TAKRAM_PARITY_BOTTOM_RADIUS_M = 6_360_000;
export const TAKRAM_PARITY_ELLIPSOID = new Ellipsoid(
  TAKRAM_PARITY_BOTTOM_RADIUS_M,
  TAKRAM_PARITY_BOTTOM_RADIUS_M,
  TAKRAM_PARITY_BOTTOM_RADIUS_M
);

export type TakramParityInput = "stock" | "v3";
export type TakramParityView = "control" | "opening";
export type TakramParityCoordinateMode = "lubirth-bridge" | "upstream-ecef";
export type TakramParityDiagnostic =
  | "full"
  | "bsm-off"
  | "history-reset-first"
  | "cloud-raw"
  | "aerial-final";
export type UpstreamControlDecision = "PASS" | "UPSTREAM_CONTROL_FAIL";
export type StockOpeningDecision =
  | "PASS"
  | "STOCK_OPENING_LIMITATION"
  | "TAKRAM_NATIVE_OPENING_FAIL";

export const TAKRAM_PARITY_CONTROL = Object.freeze({
  altitudeMeters: 2_500,
  coverage: 0.4,
  fovDegrees: 50,
  pitchDegrees: -8,
  sunAzimuthDegrees: 135,
  sunElevationDegrees: 25
});

export type TakramParityRouteQuery = {
  diagnostic: TakramParityDiagnostic;
  input: TakramParityInput;
  progress: number;
  view: TakramParityView;
};

export type TakramParityRouteQueryResult =
  | { ok: true; value: TakramParityRouteQuery }
  | { ok: false; reason: "control-requires-stock" };

export function resolveTakramParityRouteQuery(
  input: Pick<URLSearchParams, "get">
): TakramParityRouteQueryResult {
  const requestedInput = input.get("input");
  const requestedView = input.get("view");
  const requestedDiagnostic = input.get("diagnostic");
  const parsedProgress = Number.parseFloat(input.get("progress") ?? "0");
  const value: TakramParityRouteQuery = {
    diagnostic: requestedDiagnostic === "bsm-off" ||
      requestedDiagnostic === "history-reset-first" ||
      requestedDiagnostic === "cloud-raw" ||
      requestedDiagnostic === "aerial-final"
      ? requestedDiagnostic
      : "full",
    input: requestedInput === "v3" ? "v3" : "stock",
    progress: Number.isFinite(parsedProgress) ? Math.max(0, Math.min(0.18, parsedProgress)) : 0,
    view: requestedView === "control" ? "control" : "opening"
  };

  if (value.view === "control" && value.input !== "stock") {
    return { ok: false, reason: "control-requires-stock" };
  }

  // Opening has one narrow debug readback: stock/V3 review can compare the
  // native cloud buffer with the complete aerial composite. The control-only
  // BSM/history/Aerial probes are deliberately not exposed in this path.
  return {
    ok: true,
    value: value.view === "opening" && value.diagnostic !== "cloud-raw"
      ? { ...value, diagnostic: "full" }
      : value
  };
}

export const TAKRAM_PARITY_NPM_PACKAGES = Object.freeze({
  "@react-three/postprocessing": "3.0.4",
  "@takram/three-atmosphere": "0.19.1",
  "@takram/three-clouds": "0.7.6",
  "@takram/three-geospatial": "0.9.1",
  postprocessing: "6.39.1"
});

export const TAKRAM_PARITY_LICENSE = "MIT" as const;

export const TAKRAM_PARITY_UPSTREAM = Object.freeze({
  repository: "https://github.com/takram-design-engineering/three-geospatial",
  visualReferenceCommit: "b012ad06d858fc035d88aacfd73f092f93c994e4"
});

export const TAKRAM_PARITY_DEFAULTS = Object.freeze({
  haze: true,
  lightShafts: true,
  qualityPreset: "high" as const,
  resolutionScale: 1,
  shapeDetail: true,
  temporalUpscale: true,
  turbulence: true
});

/**
 * The stock renderer fingerprint is intentionally independent from its input.
 * Task 0V may only add adapter-owned fields around this frozen native path.
 */
export const TAKRAM_PARITY_RENDERER_FINGERPRINT = Object.freeze({
  aerialPerspective: true,
  beerShadowMaps: true,
  composerOrder: "Clouds>AerialPerspective",
  defaultCloudLayers: true,
  ...TAKRAM_PARITY_DEFAULTS
});

export interface TakramParityNativeFeatures {
  aerialPerspective: boolean;
  beerShadowMaps: boolean;
  defaultCloudLayers: boolean;
  haze: boolean;
  lightShafts: boolean;
  qualityPreset: "high";
  resolutionScale: number;
  shapeDetail: boolean;
  temporalUpscale: boolean;
  turbulence: boolean;
}

/**
 * Capture-only switches used to make the stock pipeline's individual native
 * contributions reviewable. `beerShadowMaps` in `native` remains a renderer
 * capability; this state says whether the stock cloud layers contribute
 * extinction to those maps for the current diagnostic frame.
 */
export interface TakramParityDiagnosticState {
  aerialPerspectiveComposite: boolean;
  beerShadowOcclusion: boolean;
  cloudRawOutput: boolean;
  historyResetFirstFrame: boolean;
}

export interface TakramParityTelemetry {
  active: boolean;
  assetGeneration: number;
  assetsReady: boolean;
  atmosphereGeneration: number;
  atmosphereReady: boolean;
  cameraMatrixWorld: number[];
  cameraPosition: [number, number, number];
  coordinateMode: TakramParityCoordinateMode;
  control: typeof TAKRAM_PARITY_CONTROL | null;
  diagnostic: TakramParityDiagnostic;
  diagnosticApplied: boolean;
  diagnosticState: TakramParityDiagnosticState;
  earthMatrixWorld: number[];
  ecefSunDirection: [number, number, number] | null;
  input: TakramParityInput;
  native: TakramParityNativeFeatures;
  nativeFrameCount: number;
  progress: number;
  rendererFingerprint: typeof TAKRAM_PARITY_RENDERER_FINGERPRINT;
  stockCoverage: number | null;
  stockWeatherRepeat: [number, number] | null;
  temporalConverged: boolean;
  transformFallback:
    | "invalid-composition-radius"
    | "negative-determinant"
    | "non-uniform-scale"
    | "singular-scale"
    | null;
  view: TakramParityView;
}

export type TakramParityStockAssetId =
  | "localWeather"
  | "shape"
  | "shapeDetail"
  | "stbn"
  | "turbulence"
  | "upstreamTokyo";

export interface TakramParityStockAsset {
  byteLength: number;
  dimensions: readonly [number, number, number];
  format: "rgba8" | "r8" | "rgb8";
  id: TakramParityStockAssetId;
  localPath: string;
  runtimeUrl: string | null;
  sha256: string;
  sourceRef: string;
  sourceUrl: string;
}

const CLOUDS_ASSET_REF = "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff";
const GEOSPATIAL_STBN_ASSET_REF = "9627216cc50057994c98a2118f3c4a23765d43b9";
const STOCK_ASSET_BASE_PATH = "apps/site/public/assets/lubirth/takram-parity/stock";
const STOCK_ASSET_BASE_URL = "/assets/lubirth/takram-parity/stock";
const UPSTREAM_MEDIA_BASE_URL =
  "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial";

export const TAKRAM_PARITY_STOCK_ASSETS: readonly TakramParityStockAsset[] = Object.freeze([
  {
    byteLength: 679_653,
    dimensions: [512, 512, 1],
    format: "rgba8",
    id: "localWeather",
    localPath: `${STOCK_ASSET_BASE_PATH}/local-weather.png`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/local-weather.png`,
    sha256: "b84daef855dc5eebcc9b174fe832ba75a98e44b846dde201bce354417cc08031",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/local_weather.png`
  },
  {
    byteLength: 2_097_152,
    dimensions: [128, 128, 128],
    format: "r8",
    id: "shape",
    localPath: `${STOCK_ASSET_BASE_PATH}/shape.bin`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/shape.bin`,
    sha256: "ef65cf6156894720c00bf572c49e3e254f8899c4b5158246e5a35a1922e2519c",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/shape.bin`
  },
  {
    byteLength: 32_768,
    dimensions: [32, 32, 32],
    format: "r8",
    id: "shapeDetail",
    localPath: `${STOCK_ASSET_BASE_PATH}/shape-detail.bin`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/shape-detail.bin`,
    sha256: "c09112199c6e0281b74ff5283c11c2943ae082650b9b67978cf5d59ed2956e4f",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/shape_detail.bin`
  },
  {
    byteLength: 49_691,
    dimensions: [128, 128, 1],
    format: "rgba8",
    id: "turbulence",
    localPath: `${STOCK_ASSET_BASE_PATH}/turbulence.png`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/turbulence.png`,
    sha256: "ec2b1b0af4a6a6104102b21e58beb300b0a3d334c0281d84fde8c91d322910f9",
    sourceRef: CLOUDS_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${CLOUDS_ASSET_REF}/packages/clouds/assets/turbulence.png`
  },
  {
    byteLength: 1_048_576,
    dimensions: [128, 128, 64],
    format: "r8",
    id: "stbn",
    localPath: `${STOCK_ASSET_BASE_PATH}/stbn.bin`,
    runtimeUrl: `${STOCK_ASSET_BASE_URL}/stbn.bin`,
    sha256: "51f52f21e5578384585050390821a0a486dcb81e11a716fa7b92fbb6515ba852",
    sourceRef: GEOSPATIAL_STBN_ASSET_REF,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${GEOSPATIAL_STBN_ASSET_REF}/packages/core/assets/stbn.bin`
  },
  {
    byteLength: 1_728_473,
    dimensions: [1920, 1080, 1],
    format: "rgb8",
    id: "upstreamTokyo",
    localPath: "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/reference/upstream-tokyo.jpg",
    runtimeUrl: null,
    sha256: "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5",
    sourceRef: TAKRAM_PARITY_UPSTREAM.visualReferenceCommit,
    sourceUrl: `${UPSTREAM_MEDIA_BASE_URL}/${TAKRAM_PARITY_UPSTREAM.visualReferenceCommit}/packages/clouds/docs/tokyo.jpg`
  }
]);

export function isTakramParityLocalAssetUrl(value: string) {
  return value.startsWith("/assets/lubirth/takram-parity/");
}
