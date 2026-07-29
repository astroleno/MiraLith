"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties
} from "react";

type ValidationStatus = "disabled" | "waiting" | "warming" | "running" | "passed" | "failed";
type TargetBrowser = "android-chrome" | "ios-safari" | "other";

interface GpuTimerSnapshot {
  lastMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  sampleCount: number;
  supported: boolean;
}

interface ReliefCloudSnapshot {
  channelLayout?: string;
  cloudOffset?: number;
  compressedTextureActive?: boolean;
  densityIntegration?: string;
  estimatedActiveTextureBytes?: number;
  fragmentTextureReads?: number;
  gpuTimer?: GpuTimerSnapshot;
  integrationPath?: string;
  mobile?: boolean;
  rendererTextureCount?: number;
  shellCount?: number;
  sunDirection?: [number, number, number];
  sunSteps?: number;
  thinShellIntegration?: boolean;
  textureCompression?: "rgba8" | "uastc";
  textureSource?: string;
  viewSteps?: number;
}

interface LimbAtmosphereSnapshot {
  gpuTimer?: GpuTimerSnapshot;
  loopIterations?: number;
  sunDirection?: [number, number, number];
  textureReads?: number;
}

interface LimbDiffuseGlowSnapshot {
  active?: boolean;
  additiveMode?: "one-one";
  diffuseRadiusScale?: number;
  geometry?: string;
  gpuTimer?: GpuTimerSnapshot;
  includesInternalLimb?: boolean;
  innerLimbRadiusScale?: number;
  supportRadiusScale?: number;
  sunDirection?: [number, number, number];
  textureReads?: number;
}

interface EarthSurfaceSnapshot {
  active?: boolean;
  cloudOffset?: number;
  cloudShadowActive?: boolean;
  dayTextureSource?: string;
  internalLimbActive?: boolean;
  lightsOnlyTextureSource?: string;
  sunDirection?: [number, number, number];
}

interface ReliefLitePathSnapshot {
  diffuseGlow?: LimbDiffuseGlowSnapshot;
  earth?: EarthSurfaceSnapshot;
  legacyNasaLiteCloudActive: boolean;
  policy?: {
    atmosphereMode?: string;
    cloudMode?: string;
    postEffectMode?: string;
  };
  postEffectActive?: boolean;
  postEffectMode?: string;
  spaceResolution?: [number, number];
  spaceTexture?: string;
}

interface ValidationConfig {
  autoSweep: boolean;
  deviceLabel: string;
  durationMs: number;
  enabled: boolean;
  operatorDeclaredPhysical: boolean;
}

interface FrameStats {
  count: number;
  estimatedDroppedFrames: number;
  estimatedDroppedRatio: number;
  maximumMs: number;
  maxOver34MsBurst: number;
  over25Ms: number;
  over34Ms: number;
  over34Ratio: number;
  over50Ms: number;
  over50Ratio: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

interface ReliefLiteValidationReport {
  atmosphere?: LimbAtmosphereSnapshot;
  build: {
    dirty: boolean;
    revision: string;
  };
  cloud?: ReliefCloudSnapshot;
  completedAt?: string;
  config: {
    autoSweep: boolean;
    deviceLabel: string;
    durationTargetMs: number;
    operatorDeclaredPhysical: boolean;
  };
  contextLosses: number;
  device: {
    automationControlled: boolean;
    devicePixelRatio: number;
    hardwareConcurrency?: number;
    maxTouchPoints: number;
    platform: string;
    targetBrowser: TargetBrowser;
    userAgent: string;
  };
  elapsedMs: number;
  diffuseGlow?: LimbDiffuseGlowSnapshot;
  frameStats?: FrameStats;
  path: ReliefLitePathSnapshot;
  progress: number;
  progressRange?: [number, number];
  renderedProgressRange?: [number, number];
  raster?: {
    antialias: boolean;
    canvasPixels: [number, number];
    cssPixels: [number, number];
    effectiveDpr: number;
  };
  reasons: string[];
  startedAt?: string;
  status: ValidationStatus;
  visibilityInterruptions: number;
  verdict?: {
    localPass: boolean;
    promotionBlockers: string[];
    promotableDeviceEvidence: boolean;
  };
  version: 2;
  webgl?: {
    maxTextureSize?: number;
    renderer?: string;
    vendor?: string;
    version?: string;
  };
}

declare global {
  interface Window {
    __MiraLithReliefLiteValidation?: ReliefLiteValidationReport;
  }
}

const PANEL_STYLE: CSSProperties = {
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 2_147_483_000,
  width: "min(360px, calc(100vw - 24px))",
  padding: "12px 14px",
  border: "1px solid rgba(151, 201, 255, 0.35)",
  borderRadius: 10,
  color: "#d9e8f6",
  background: "rgba(3, 8, 16, 0.9)",
  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.48)",
  font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  backdropFilter: "blur(12px)"
};

const BUTTON_STYLE: CSSProperties = {
  appearance: "none",
  padding: "6px 9px",
  border: "1px solid rgba(151, 201, 255, 0.32)",
  borderRadius: 6,
  color: "#d9e8f6",
  background: "rgba(82, 143, 201, 0.14)",
  cursor: "pointer",
  font: "inherit"
};

const BUILD_REVISION =
  process.env.NEXT_PUBLIC_MIRALITH_BUILD_REVISION ?? "unknown";
const BUILD_DIRTY =
  process.env.NEXT_PUBLIC_MIRALITH_BUILD_DIRTY !== "false";
const DISABLED_CONFIG: ValidationConfig = {
  autoSweep: true,
  deviceLabel: "",
  durationMs: 30_000,
  enabled: false,
  operatorDeclaredPhysical: false
};

function subscribeToHydration() {
  return () => undefined;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] ?? 0;
}

function readValidationConfig(): ValidationConfig {
  if (typeof window === "undefined") {
    return DISABLED_CONFIG;
  }
  const params = new URLSearchParams(window.location.search);
  const seconds = Number.parseFloat(params.get("validationSeconds") ?? "30");
  return {
    autoSweep: params.get("reliefLiteAutoSweep") !== "off",
    deviceLabel: (params.get("deviceLabel") ?? "").trim().slice(0, 80),
    durationMs: clamp(Number.isFinite(seconds) ? seconds : 30, 1, 60) * 1_000,
    enabled:
      params.get("reliefLiteValidation") === "on" &&
      params.get("cloud") === "relief-lite" &&
      params.get("atmosphereMode") === "limb-lite",
    operatorDeclaredPhysical: params.get("physicalDevice") === "1"
  };
}

function identifyTargetBrowser(userAgent: string, platform: string, maxTouchPoints: number) {
  const iosDevice =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
  const iosSafari =
    iosDevice &&
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  if (iosSafari) {
    return "ios-safari" as const;
  }
  if (/Android/i.test(userAgent) && /Chrome/i.test(userAgent)) {
    if (!/EdgA|Firefox|OPR|SamsungBrowser/i.test(userAgent)) {
      return "android-chrome" as const;
    }
  }
  return "other" as const;
}

function createInitialReport(config: ValidationConfig): ReliefLiteValidationReport {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const platform = typeof navigator === "undefined" ? "" : navigator.platform;
  const maxTouchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints;
  return {
    build: {
      dirty: BUILD_DIRTY,
      revision: BUILD_REVISION
    },
    config: {
      autoSweep: config.autoSweep,
      deviceLabel: config.deviceLabel,
      durationTargetMs: config.durationMs,
      operatorDeclaredPhysical: config.operatorDeclaredPhysical
    },
    contextLosses: 0,
    device: {
      automationControlled:
        typeof navigator !== "undefined" &&
        (navigator.webdriver === true || /HeadlessChrome|Playwright/i.test(userAgent)),
      devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
      hardwareConcurrency:
        typeof navigator === "undefined" ? undefined : navigator.hardwareConcurrency,
      maxTouchPoints,
      platform,
      targetBrowser: identifyTargetBrowser(userAgent, platform, maxTouchPoints),
      userAgent
    },
    elapsedMs: 0,
    path: {
      legacyNasaLiteCloudActive: false
    },
    progress: 0,
    reasons: [],
    status: config.enabled ? "waiting" : "disabled",
    visibilityInterruptions: 0,
    version: 2
  };
}

function cloneSnapshot<T>(value: T | undefined): T | undefined {
  if (!value) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function capturePathSnapshot(): ReliefLitePathSnapshot {
  return {
    diffuseGlow: cloneSnapshot(window.__MiraLithLuBirthLimbDiffuseGlow),
    earth: cloneSnapshot(window.__MiraLithLuBirthEarthSurfaceLiteV2),
    legacyNasaLiteCloudActive:
      window.__MiraLithLuBirthNasaLiteCloud?.active === true,
    policy: cloneSnapshot(window.__MiraLithLuBirthVisualPolicy),
    postEffectActive: window.__MiraLithLuBirthPostEffectActive,
    postEffectMode: window.__MiraLithLuBirthPostEffectMode,
    spaceResolution: cloneSnapshot(window.__MiraLithLuBirthSpaceBackgroundResolution),
    spaceTexture: window.__MiraLithLuBirthSpaceBackgroundTexture
  };
}

function vectorDistance(
  left: [number, number, number] | undefined,
  right: [number, number, number] | undefined
) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2]
  );
}

function wrappedUnitDistance(left: number | undefined, right: number | undefined) {
  if (left === undefined || right === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const difference = Math.abs(left - right);
  return Math.min(difference, Math.abs(1 - difference));
}

function readWebGlState(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!context) {
    return {
      raster: {
        antialias: false,
        canvasPixels: [canvas.width, canvas.height] as [number, number],
        cssPixels: [canvas.clientWidth, canvas.clientHeight] as [number, number],
        effectiveDpr: 0
      },
      webgl: undefined
    };
  }
  const debugRenderer = context.getExtension("WEBGL_debug_renderer_info");
  return {
    raster: {
      antialias: Boolean(context.getContextAttributes()?.antialias),
      canvasPixels: [canvas.width, canvas.height] as [number, number],
      cssPixels: [canvas.clientWidth, canvas.clientHeight] as [number, number],
      effectiveDpr:
        canvas.clientWidth > 0 && canvas.clientHeight > 0
          ? Math.min(canvas.width / canvas.clientWidth, canvas.height / canvas.clientHeight)
          : 0
    },
    webgl: {
      maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE) as number,
      renderer: debugRenderer
        ? context.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL) as string
        : undefined,
      vendor: debugRenderer
        ? context.getParameter(debugRenderer.UNMASKED_VENDOR_WEBGL) as string
        : undefined,
      version: context.getParameter(context.VERSION) as string
    }
  };
}

function buildFrameStats(deltas: number[]): FrameStats {
  const stableDeltas = deltas.filter((delta) => Number.isFinite(delta) && delta > 0);
  let currentOver34MsBurst = 0;
  let maxOver34MsBurst = 0;
  for (const delta of stableDeltas) {
    if (delta > 34) {
      currentOver34MsBurst += 1;
      maxOver34MsBurst = Math.max(maxOver34MsBurst, currentOver34MsBurst);
    } else {
      currentOver34MsBurst = 0;
    }
  }
  const over34Ms = stableDeltas.filter((delta) => delta > 34).length;
  const over50Ms = stableDeltas.filter((delta) => delta > 50).length;
  const estimatedDroppedFrames = stableDeltas.reduce(
    (total, delta) => total + Math.max(0, Math.round(delta / (1_000 / 60)) - 1),
    0
  );
  return {
    count: stableDeltas.length,
    estimatedDroppedFrames,
    estimatedDroppedRatio:
      estimatedDroppedFrames / Math.max(stableDeltas.length + estimatedDroppedFrames, 1),
    maximumMs: Math.max(0, ...stableDeltas),
    maxOver34MsBurst,
    over25Ms: stableDeltas.filter((delta) => delta > 25).length,
    over34Ms,
    over34Ratio: over34Ms / Math.max(stableDeltas.length, 1),
    over50Ms,
    over50Ratio: over50Ms / Math.max(stableDeltas.length, 1),
    p50Ms: percentile(stableDeltas, 0.5),
    p95Ms: percentile(stableDeltas, 0.95),
    p99Ms: percentile(stableDeltas, 0.99)
  };
}

function evaluateVerdict(report: ReliefLiteValidationReport) {
  const reasons: string[] = [];
  const targetDuration = report.config.durationTargetMs;
  const cloud = report.cloud;
  const atmosphere = report.atmosphere;
  const frames = report.frameStats;
  const path = report.path;
  const diffuseGlow = report.diffuseGlow ?? path.diffuseGlow;
  const mobileBudget = report.device.targetBrowser !== "other" || cloud?.mobile === true;

  if (report.elapsedMs < targetDuration - 150) {
    reasons.push("validation-duration-incomplete");
  }
  if (report.contextLosses > 0) {
    reasons.push("webgl-context-lost");
  }
  if (report.visibilityInterruptions > 0) {
    reasons.push("page-visibility-interrupted");
  }
  if (!report.raster?.antialias) {
    reasons.push("msaa-disabled");
  }
  if ((report.raster?.effectiveDpr ?? 0) < 0.99) {
    reasons.push("dpr-below-1");
  }
  if (
    !report.raster ||
    report.raster.cssPixels[0] <= report.raster.cssPixels[1]
  ) {
    reasons.push("landscape-orientation-required");
  }
  if (!frames || frames.count < Math.max(20, targetDuration / 1_000 * 45)) {
    reasons.push("insufficient-frame-samples");
  } else {
    if (frames.p95Ms > 25) {
      reasons.push("frame-p95-over-25ms");
    }
    if (frames.maximumMs > 100) {
      reasons.push("single-frame-stall-over-100ms");
    }
    if (frames.estimatedDroppedRatio > 0.01) {
      reasons.push("estimated-dropped-frames-over-1pct");
    }
    if (frames.over34Ratio > 0.01) {
      reasons.push("dropped-frame-ratio-over-1pct");
    }
    if (frames.maxOver34MsBurst > 2) {
      reasons.push("dropped-frame-burst-over-2");
    }
    if (frames.over50Ratio > 0.005) {
      reasons.push("long-frame-ratio-over-0.5pct");
    }
  }
  if (!report.progressRange || report.progressRange[0] > 0.08 || report.progressRange[1] < 0.92) {
    reasons.push("commanded-near-far-sweep-incomplete");
  }
  if (
    !report.renderedProgressRange ||
    report.renderedProgressRange[0] > 0.08 ||
    report.renderedProgressRange[1] < 0.92
  ) {
    reasons.push("rendered-near-far-sweep-incomplete");
  }
  if (cloud?.shellCount !== 1) {
    reasons.push("cloud-shell-count-invalid");
  }
  const expectedCloudViewSteps = mobileBudget ? 2 : 3;
  const expectedCloudTextureReads = mobileBudget ? 3 : 4;
  if (mobileBudget && cloud?.fragmentTextureReads !== expectedCloudTextureReads) {
    reasons.push("mobile-cloud-budget-not-3");
  }
  if (!mobileBudget && cloud?.fragmentTextureReads !== expectedCloudTextureReads) {
    reasons.push("desktop-cloud-budget-not-4");
  }
  if (
    cloud?.densityIntegration !== "front-to-back" ||
    cloud?.channelLayout !== "v3-r-depth-g-height-b-morphology-a-concavity" ||
    cloud?.viewSteps !== expectedCloudViewSteps ||
    cloud?.sunSteps !== 1 ||
    cloud?.fragmentTextureReads !== expectedCloudViewSteps + 1 ||
    cloud?.thinShellIntegration !== true ||
    cloud?.integrationPath !== "ray-sphere-thin-shell"
  ) {
    reasons.push("cloud-density-integration-invalid");
  }
  if (
    cloud?.compressedTextureActive !== true ||
    cloud?.textureCompression !== "uastc"
  ) {
    reasons.push("relief-cloud-compression-inactive");
  }
  if (atmosphere?.loopIterations !== 0 || atmosphere?.textureReads !== 0) {
    reasons.push("atmosphere-budget-invalid");
  }
  if (
    diffuseGlow?.active !== true ||
    diffuseGlow.textureReads !== 0 ||
    diffuseGlow.additiveMode !== "one-one" ||
    diffuseGlow.geometry !== "analytic-composite-limb-strip" ||
    diffuseGlow.includesInternalLimb !== true
  ) {
    reasons.push("diffuse-glow-runtime-invalid");
  }
  if ((diffuseGlow?.innerLimbRadiusScale ?? 0) < 0.95) {
    reasons.push("internal-limb-too-wide");
  }
  if ((cloud?.rendererTextureCount ?? Number.POSITIVE_INFINITY) > 8) {
    reasons.push("renderer-texture-count-over-8");
  }
  if (path.earth?.active !== true) {
    reasons.push("earth-v2-inactive");
  }
  if (!path.earth?.lightsOnlyTextureSource?.endsWith("/earth-lights-only-2k.webp")) {
    reasons.push("lights-only-map-invalid");
  }
  const expectedDayTexture = mobileBudget
    ? "/earth-day-2k.jpg"
    : "/earth-day-nasa-lite-4k.webp";
  if (!path.earth?.dayTextureSource?.endsWith(expectedDayTexture)) {
    reasons.push("earth-day-texture-lod-invalid");
  }
  if (path.earth?.cloudShadowActive !== true) {
    reasons.push("shared-cloud-shadow-inactive");
  }
  if (path.earth?.internalLimbActive !== false) {
    reasons.push("surface-internal-limb-still-active");
  }
  if (
    path.policy?.cloudMode !== "relief-lite" ||
    path.policy?.atmosphereMode !== "limb-lite" ||
    path.policy?.postEffectMode !== "off"
  ) {
    reasons.push("relief-lite-policy-mismatch");
  }
  if (path.postEffectActive !== false || path.postEffectMode !== "off") {
    reasons.push("post-effect-not-disabled");
  }
  if (path.legacyNasaLiteCloudActive) {
    reasons.push("legacy-nasa-lite-cloud-active");
  }
  if (!path.spaceTexture?.endsWith("/stars-milky-way-2k.webp")) {
    reasons.push("independent-star-background-missing");
  }
  if (
    !path.spaceResolution ||
    path.spaceResolution[0] < 2_048 ||
    path.spaceResolution[1] < 1_024
  ) {
    reasons.push("star-background-resolution-invalid");
  }
  if (vectorDistance(cloud?.sunDirection, path.earth?.sunDirection) > 1e-4) {
    reasons.push("cloud-earth-sun-direction-mismatch");
  }
  if (vectorDistance(atmosphere?.sunDirection, path.earth?.sunDirection) > 1e-4) {
    reasons.push("atmosphere-earth-sun-direction-mismatch");
  }
  if (vectorDistance(diffuseGlow?.sunDirection, path.earth?.sunDirection) > 1e-4) {
    reasons.push("diffuse-glow-earth-sun-direction-mismatch");
  }
  if (wrappedUnitDistance(cloud?.cloudOffset, path.earth?.cloudOffset) > 1e-4) {
    reasons.push("cloud-shadow-offset-mismatch");
  }
  const expectedCloudTexture = "/earth-cloud-field-nasa-lite-2k.ktx2";
  if (!cloud?.textureSource?.endsWith(expectedCloudTexture)) {
    reasons.push("relief-cloud-texture-lod-invalid");
  }
  const cloudGpu = cloud?.gpuTimer;
  const atmosphereGpu = atmosphere?.gpuTimer;
  const diffuseGlowGpu = diffuseGlow?.gpuTimer;
  if (cloudGpu?.supported && (cloudGpu.p95Ms ?? Number.POSITIVE_INFINITY) > 6) {
    reasons.push("cloud-gpu-p95-over-6ms");
  }
  if (atmosphereGpu?.supported && (atmosphereGpu.p95Ms ?? Number.POSITIVE_INFINITY) > 6) {
    reasons.push("atmosphere-gpu-p95-over-6ms");
  }
  if (diffuseGlowGpu?.supported && (diffuseGlowGpu.p95Ms ?? Number.POSITIVE_INFINITY) > 3) {
    reasons.push("diffuse-glow-gpu-p95-over-3ms");
  }

  const localPass = reasons.length === 0;
  const promotionBlockers: string[] = [];
  if (!localPass) {
    promotionBlockers.push("local-gate-failed");
  }
  if (!report.config.operatorDeclaredPhysical) {
    promotionBlockers.push("physical-device-not-attested");
  }
  if (report.config.durationTargetMs < 30_000 || report.elapsedMs < 29_850) {
    promotionBlockers.push("promotion-duration-under-30s");
  }
  if (report.build.revision === "unknown") {
    promotionBlockers.push("build-revision-unknown");
  }
  if (report.build.dirty) {
    promotionBlockers.push("build-worktree-dirty");
  }
  if (report.device.automationControlled) {
    promotionBlockers.push("automation-controlled-browser");
  }
  if (report.device.targetBrowser === "other") {
    promotionBlockers.push("browser-is-not-target-mobile-browser");
  }
  if (report.config.deviceLabel.length === 0) {
    promotionBlockers.push("device-label-required");
  } else if (
    report.device.targetBrowser === "ios-safari" &&
    !/iphone/i.test(report.config.deviceLabel)
  ) {
    promotionBlockers.push("iphone-device-label-required");
  } else if (
    report.device.targetBrowser === "android-chrome" &&
    !/pixel/i.test(report.config.deviceLabel)
  ) {
    promotionBlockers.push("pixel-device-label-required");
  }
  const promotableDeviceEvidence =
    promotionBlockers.length === 0;
  return {
    reasons,
    verdict: { localPass, promotionBlockers, promotableDeviceEvidence }
  };
}

function reportFileName(report: ReliefLiteValidationReport) {
  const label = report.config.deviceLabel || report.device.targetBrowser || "device";
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `lubirth-relief-lite-${safeLabel || "device"}-${Date.now()}.json`;
}

export function ReliefLiteValidationHarness() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const config = useMemo(
    () => hydrated ? readValidationConfig() : DISABLED_CONFIG,
    [hydrated]
  );
  const [runId, setRunId] = useState(0);
  const [report, setReport] = useState<ReliefLiteValidationReport>(
    () => createInitialReport(config)
  );

  useEffect(() => {
    if (!config.enabled) {
      return undefined;
    }

    const runtimeWindow = window;
    let cancelled = false;
    let animationFrame = 0;
    let statusTimer = 0;
    let canvas: HTMLCanvasElement | null = null;
    let contextLosses = 0;
    let visibilityInterruptions = 0;
    const originalProgress = runtimeWindow.__MiraLithOpeningProgress;
    const initialReport = createInitialReport(config);
    runtimeWindow.__MiraLithReliefLiteValidation = initialReport;

    const publish = (next: ReliefLiteValidationReport) => {
      runtimeWindow.__MiraLithReliefLiteValidation = next;
      if (!cancelled) {
        setReport(next);
      }
    };
    const onContextLost = () => {
      contextLosses += 1;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        visibilityInterruptions += 1;
      }
    };

    const run = async () => {
      const waitStartedAt = performance.now();
      while (!cancelled) {
        canvas = document.querySelector("canvas");
        if (
          canvas &&
          runtimeWindow.__MiraLithLuBirthReliefCloud?.active &&
          runtimeWindow.__MiraLithLuBirthLimbAtmosphere?.active &&
          runtimeWindow.__MiraLithLuBirthLimbDiffuseGlow?.active &&
          runtimeWindow.__MiraLithLuBirthEarthSurfaceLiteV2?.active &&
          runtimeWindow.__MiraLithLuBirthSpaceBackgroundTexture &&
          runtimeWindow.__MiraLithLuBirthProjectedEarthLighting
        ) {
          break;
        }
        if (performance.now() - waitStartedAt > 20_000) {
          const failed = {
            ...initialReport,
            elapsedMs: performance.now() - waitStartedAt,
            path: capturePathSnapshot(),
            reasons: ["relief-lite-runtime-not-ready"],
            status: "failed" as const,
            verdict: {
              localPass: false,
              promotionBlockers: ["local-gate-failed"],
              promotableDeviceEvidence: false
            }
          };
          publish(failed);
          return;
        }
        await new Promise<void>((resolve) => {
          statusTimer = window.setTimeout(resolve, 100);
        });
      }
      if (cancelled || !canvas) {
        return;
      }

      canvas.addEventListener("webglcontextlost", onContextLost);
      document.addEventListener("visibilitychange", onVisibilityChange);
      publish({
        ...initialReport,
        status: "warming"
      });
      await new Promise<void>((resolve) => {
        statusTimer = window.setTimeout(resolve, 750);
      });
      if (cancelled) {
        return;
      }

      const deltas: number[] = [];
      const startedAt = performance.now();
      const startedAtIso = new Date().toISOString();
      let lastFrameAt = startedAt;
      let progressMinimum = 1;
      let progressMaximum = 0;
      let renderedProgressMinimum = 1;
      let renderedProgressMaximum = 0;
      let lastHudUpdateAt = 0;

      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          if (cancelled) {
            resolve();
            return;
          }
          const elapsed = now - startedAt;
          if (lastFrameAt !== startedAt || elapsed > 0) {
            deltas.push(now - lastFrameAt);
          }
          lastFrameAt = now;
          const unit = clamp(elapsed / config.durationMs, 0, 1);
          const sweepProgress = config.autoSweep
            ? 0.5 - 0.5 * Math.cos(unit * Math.PI * 4)
            : clamp(runtimeWindow.__MiraLithOpeningProgress ?? 0, 0, 1);
          if (config.autoSweep) {
            runtimeWindow.__MiraLithOpeningProgress = sweepProgress;
          }
          progressMinimum = Math.min(progressMinimum, sweepProgress);
          progressMaximum = Math.max(progressMaximum, sweepProgress);
          const renderedProgress =
            runtimeWindow.__MiraLithLuBirthProjectedEarthLighting?.progress;
          if (renderedProgress !== undefined) {
            renderedProgressMinimum = Math.min(renderedProgressMinimum, renderedProgress);
            renderedProgressMaximum = Math.max(renderedProgressMaximum, renderedProgress);
          }

          if (now - lastHudUpdateAt >= 250) {
            lastHudUpdateAt = now;
            publish({
              ...initialReport,
              atmosphere: cloneSnapshot(runtimeWindow.__MiraLithLuBirthLimbAtmosphere),
              cloud: cloneSnapshot(runtimeWindow.__MiraLithLuBirthReliefCloud),
              contextLosses,
              diffuseGlow: cloneSnapshot(runtimeWindow.__MiraLithLuBirthLimbDiffuseGlow),
              elapsedMs: elapsed,
              path: capturePathSnapshot(),
              progress: unit,
              progressRange: [progressMinimum, progressMaximum],
              renderedProgressRange: [renderedProgressMinimum, renderedProgressMaximum],
              startedAt: startedAtIso,
              status: "running",
              visibilityInterruptions
            });
          }

          if (elapsed >= config.durationMs) {
            resolve();
            return;
          }
          animationFrame = requestAnimationFrame(tick);
        };
        animationFrame = requestAnimationFrame(tick);
      });

      if (cancelled) {
        return;
      }
      const completedAt = new Date().toISOString();
      const elapsedMs = performance.now() - startedAt;
      const webGlState = readWebGlState(canvas);
      const completedReport: ReliefLiteValidationReport = {
        ...initialReport,
        atmosphere: cloneSnapshot(runtimeWindow.__MiraLithLuBirthLimbAtmosphere),
        cloud: cloneSnapshot(runtimeWindow.__MiraLithLuBirthReliefCloud),
        completedAt,
        contextLosses,
        diffuseGlow: cloneSnapshot(runtimeWindow.__MiraLithLuBirthLimbDiffuseGlow),
        elapsedMs,
        frameStats: buildFrameStats(deltas),
        path: capturePathSnapshot(),
        progress: 1,
        progressRange: [progressMinimum, progressMaximum],
        raster: webGlState.raster,
        renderedProgressRange: [renderedProgressMinimum, renderedProgressMaximum],
        startedAt: startedAtIso,
        status: "passed",
        visibilityInterruptions,
        webgl: webGlState.webgl
      };
      const evaluated = evaluateVerdict(completedReport);
      completedReport.reasons = evaluated.reasons;
      completedReport.verdict = evaluated.verdict;
      completedReport.status = evaluated.verdict.localPass ? "passed" : "failed";
      publish(completedReport);
    };

    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(statusTimer);
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (originalProgress === undefined) {
        delete runtimeWindow.__MiraLithOpeningProgress;
      } else {
        runtimeWindow.__MiraLithOpeningProgress = originalProgress;
      }
    };
  }, [config, runId]);

  const copyReport = useCallback(async () => {
    const serialized = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(serialized);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = serialized;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.append(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
  }, [report]);

  const downloadReport = useCallback(() => {
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = reportFileName(report);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }, [report]);

  if (!config.enabled) {
    return null;
  }

  const progressValue = clamp(
    report.elapsedMs / Math.max(report.config.durationTargetMs, 1),
    0,
    1
  );
  const statusColor =
    report.status === "passed"
      ? "#89e6b1"
      : report.status === "failed"
        ? "#ff9d9d"
        : "#9ecbff";

  return (
    <aside
      data-relief-lite-validation={report.status}
      aria-label="Earth Relief Lite device validation"
      style={PANEL_STYLE}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>RELIEF LITE · DEVICE GATE</strong>
        <span style={{ color: statusColor }}>{report.status.toUpperCase()}</span>
      </div>
      <div style={{ marginTop: 7, color: "rgba(217, 232, 246, 0.72)" }}>
        {report.config.deviceLabel || report.device.targetBrowser}
        {report.config.operatorDeclaredPhysical ? " · physical attested" : " · unverified device"}
        <br />
        build {report.build.revision.slice(0, 12)}
        {report.build.dirty ? " · dirty" : " · clean"}
      </div>
      <progress
        value={progressValue}
        max={1}
        style={{ width: "100%", height: 5, marginTop: 9, accentColor: statusColor }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", marginTop: 8 }}>
        <span>elapsed</span>
        <span>{(report.elapsedMs / 1_000).toFixed(1)}s</span>
        <span>frame p95</span>
        <span>{report.frameStats ? `${report.frameStats.p95Ms.toFixed(1)}ms` : "—"}</span>
        <span>frame max</span>
        <span>{report.frameStats ? `${report.frameStats.maximumMs.toFixed(1)}ms` : "—"}</span>
        <span>dropped est.</span>
        <span>
          {report.frameStats
            ? `${(report.frameStats.estimatedDroppedRatio * 100).toFixed(2)}%`
            : "—"}
        </span>
        <span>context loss</span>
        <span>{report.contextLosses}</span>
        <span>visibility loss</span>
        <span>{report.visibilityInterruptions}</span>
        <span>cloud GPU p95</span>
        <span>
          {report.cloud?.gpuTimer?.p95Ms === undefined
            ? "unsupported"
            : `${report.cloud.gpuTimer.p95Ms.toFixed(2)}ms`}
        </span>
        <span>atmo GPU p95</span>
        <span>
          {report.atmosphere?.gpuTimer?.p95Ms === undefined
            ? "unsupported"
            : `${report.atmosphere.gpuTimer.p95Ms.toFixed(2)}ms`}
        </span>
        <span>diffuse GPU p95</span>
        <span>
          {report.diffuseGlow?.gpuTimer?.p95Ms === undefined
            ? "unsupported"
            : `${report.diffuseGlow.gpuTimer.p95Ms.toFixed(2)}ms`}
        </span>
      </div>
      {report.reasons.length > 0 ? (
        <div style={{ marginTop: 8, color: "#ffb0b0" }}>
          {report.reasons.join(" · ")}
        </div>
      ) : null}
      {report.verdict ? (
        <div style={{ marginTop: 8, color: report.verdict.promotableDeviceEvidence ? "#89e6b1" : "#e7c784" }}>
          {report.verdict.promotableDeviceEvidence
            ? "PROMOTABLE DEVICE EVIDENCE"
            : report.verdict.localPass
              ? "LOCAL PASS · NOT PROMOTABLE"
              : "DEVICE GATE FAILED"}
          {!report.verdict.promotableDeviceEvidence ? (
            <div style={{ marginTop: 3, color: "rgba(231, 199, 132, 0.78)" }}>
              {report.verdict.promotionBlockers.join(" · ")}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
        <button type="button" onClick={copyReport} style={BUTTON_STYLE}>Copy JSON</button>
        <button type="button" onClick={downloadReport} style={BUTTON_STYLE}>Download JSON</button>
        <button type="button" onClick={() => setRunId((value) => value + 1)} style={BUTTON_STYLE}>Run again</button>
      </div>
    </aside>
  );
}
