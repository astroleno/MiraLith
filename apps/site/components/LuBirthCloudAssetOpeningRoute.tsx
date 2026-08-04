"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "@miralith/visual-core";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";
import {
  openingCloudManifest,
  type OpeningCloudTier
} from "../content/lubirthOpeningCloudManifest";
import { OpeningCloudStack } from "./lubirth-cloud-asset-opening/OpeningCloudStack";
import { resolveOpeningCloudMemoryFallback } from "./lubirth-cloud-asset-opening/fallbackPolicy";
import type {
  OpeningCloudDirection,
  OpeningCloudFallbackReason,
  OpeningCloudMetricEvent,
  OpeningCloudRuntimeMetrics,
  OpeningCloudSnapshot
} from "./lubirth-cloud-asset-opening/types";
import styles from "./LuBirthCloudAssetOpeningRoute.module.css";

declare global {
  interface Navigator {
    deviceMemory?: number;
  }

  interface Window {
    __MiraLithOpeningProgress?: number;
    __MiraLithLuBirthOpeningCloud?: OpeningCloudSnapshot & {
      selectedTier: OpeningCloudTier;
      cloudOnly: true;
      liveScene: "ip-relief-lite";
      metrics: OpeningCloudRuntimeMetrics;
    };
  }
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function selectTier(): OpeningCloudTier {
  return Math.min(window.innerWidth, window.innerHeight) < 760 ? "mobile" : "desktop";
}

function readFixedProgress() {
  const value = Number.parseFloat(new URLSearchParams(window.location.search).get("progress") ?? "");
  return Number.isFinite(value) ? clamp01(value) : null;
}

function p95(samples: readonly number[]) {
  if (samples.length === 0) return null;
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)];
}

function rounded(value: number | null) {
  return value === null ? null : Math.round(value * 100) / 100;
}

function createRuntimeMetrics(): OpeningCloudRuntimeMetrics {
  return {
    coldStartFirstFrameMs: null,
    decodeErrorCount: 0,
    droppedFrameCount: 0,
    droppedFrameRate: 0,
    rAFSampleCount: 0,
    rAFP95Ms: null,
    targetFrameLatencyP95Ms: null,
    targetFrameLatencySampleCount: 0
  };
}

export function LuBirthCloudAssetOpeningRoute() {
  const rootRef = useRef<HTMLElement>(null);
  const previousProgressRef = useRef(0);
  const directionRef = useRef<OpeningCloudDirection>("forward");
  const animationFrameRef = useRef<number | null>(null);
  const snapshotRef = useRef<OpeningCloudSnapshot | null>(null);
  const metricsRef = useRef(createRuntimeMetrics());
  const droppedFrameSamplesRef = useRef<boolean[]>([]);
  const rAFSamplesRef = useRef<number[]>([]);
  const targetFrameSamplesRef = useRef<number[]>([]);
  const reducedMotion = useReducedMotionPreference();
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<OpeningCloudDirection>("forward");
  const [tier, setTier] = useState<OpeningCloudTier>("desktop");
  const [runtimeFallbackReason, setRuntimeFallbackReason] = useState<OpeningCloudFallbackReason | null>(null);
  const [snapshot, setSnapshot] = useState<OpeningCloudSnapshot | null>(null);
  const deviceMemory = typeof navigator === "undefined" ? undefined : navigator.deviceMemory;
  const forcedFallbackReason = reducedMotion
    ? "reduced-motion"
    : runtimeFallbackReason ?? resolveOpeningCloudMemoryFallback(deviceMemory);

  const publishTelemetry = useCallback(() => {
    const latestSnapshot = snapshotRef.current;
    if (!latestSnapshot) return;
    window.__MiraLithLuBirthOpeningCloud = {
      ...latestSnapshot,
      selectedTier: selectTier(),
      cloudOnly: true,
      liveScene: "ip-relief-lite",
      metrics: { ...metricsRef.current }
    };
  }, []);

  const publishSnapshot = useCallback((nextSnapshot: OpeningCloudSnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    publishTelemetry();
  }, [publishTelemetry]);

  const recordMetric = useCallback((event: OpeningCloudMetricEvent) => {
    if (event.type === "cold-start-first-frame") {
      metricsRef.current.coldStartFirstFrameMs = rounded(event.milliseconds);
    } else if (event.type === "target-frame") {
      targetFrameSamplesRef.current.push(event.milliseconds);
      if (targetFrameSamplesRef.current.length > 120) targetFrameSamplesRef.current.shift();
      metricsRef.current.targetFrameLatencySampleCount = targetFrameSamplesRef.current.length;
      metricsRef.current.targetFrameLatencyP95Ms = rounded(p95(targetFrameSamplesRef.current));
    } else {
      metricsRef.current.decodeErrorCount += 1;
    }
    publishTelemetry();
  }, [publishTelemetry]);

  useLayoutEffect(() => {
    const fixedProgress = readFixedProgress();
    const sync = () => {
      const root = rootRef.current;
      if (!root) return;
      const rootStart = root.getBoundingClientRect().top + window.scrollY;
      const scrollRange = Math.max(1, root.offsetHeight - window.innerHeight);
      const nextProgress = fixedProgress ?? clamp01((window.scrollY - rootStart) / scrollRange);
      const previous = previousProgressRef.current;
      const nextDirection: OpeningCloudDirection = nextProgress < previous - 0.0005
        ? "reverse"
        : nextProgress > previous + 0.0005
          ? "forward"
          : directionRef.current;
      previousProgressRef.current = nextProgress;
      directionRef.current = nextDirection;
      window.__MiraLithOpeningProgress = nextProgress;
      setProgress((current) => Math.abs(current - nextProgress) > 0.0005 ? nextProgress : current);
      setDirection((current) => current === nextDirection ? current : nextDirection);
    };
    const onScrollOrResize = () => {
      if (animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        sync();
      });
    };
    const syncTier = () => setTier(selectTier());
    syncTier();
    sync();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("resize", syncTier);
    return () => {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("resize", syncTier);
      delete window.__MiraLithOpeningProgress;
      delete window.__MiraLithLuBirthOpeningCloud;
    };
  }, []);

  useEffect(() => {
    let animationFrame: number | null = null;
    let previousTimestamp: number | null = null;
    const sample = (timestamp: number) => {
      if (previousTimestamp !== null) {
        const elapsed = timestamp - previousTimestamp;
        rAFSamplesRef.current.push(elapsed);
        droppedFrameSamplesRef.current.push(elapsed > 20);
        if (rAFSamplesRef.current.length > 240) {
          rAFSamplesRef.current.shift();
          droppedFrameSamplesRef.current.shift();
        }
        metricsRef.current.rAFSampleCount = rAFSamplesRef.current.length;
        metricsRef.current.droppedFrameCount = droppedFrameSamplesRef.current.filter(Boolean).length;
        metricsRef.current.droppedFrameRate = Math.round(
          (metricsRef.current.droppedFrameCount / metricsRef.current.rAFSampleCount) * 10_000
        ) / 10_000;
        metricsRef.current.rAFP95Ms = rounded(p95(rAFSamplesRef.current));
        if (metricsRef.current.rAFSampleCount % 30 === 0) publishTelemetry();
      }
      previousTimestamp = timestamp;
      animationFrame = window.requestAnimationFrame(sample);
    };
    animationFrame = window.requestAnimationFrame(sample);
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [publishTelemetry]);

  const label = snapshot?.fallbackReason
    ? "live Relief-lite fallback"
    : snapshot?.source === "cloud"
      ? "cloud-only asset over live IP Earth"
      : "live IP Relief-lite";

  return (
    <main
      className={styles.route}
      data-cloud-only={snapshot?.source === "cloud" ? "visible" : "hidden"}
      data-opening-cloud-route
      data-progress={progress.toFixed(4)}
      data-tier={tier}
      aria-label="LuBirth cloud asset opening study"
      ref={rootRef}
    >
      <OpeningCloudStack
        direction={direction}
        forcedFallbackReason={forcedFallbackReason}
        onMetric={recordMetric}
        onSnapshot={publishSnapshot}
        progress={progress}
        reducedMotion={reducedMotion}
        tier={tier}
      >
        <VisualCanvas
          antialias={false}
          decorative
          dpr={1}
          fallback={
            <VisualCanvasFallback
              label="LuBirth live Relief-lite fallback"
              posterSrc="/assets/lubirth/poster-field.webp"
              scene="lubirth"
            />
          }
          onFallback={() => setRuntimeFallbackReason("rendering-fallback")}
        >
          <LuBirthSceneSlot
            atmospherePolicy="stack"
            cloudDeckEnabled
            mode="field"
            paused={false}
            productionSurface
            quality="medium"
            renderProfile="nasa"
            routeVariant="study"
            visualAtmosphereMode="limb-lite"
            visualCloudMode="relief-lite"
            visualPostEffectMode="off"
          />
        </VisualCanvas>
      </OpeningCloudStack>
      <section className={styles.stage} aria-label="Cloud asset scroll review">
        <div className={styles.cue} aria-live="polite">
          <strong>LuBirth / cloud asset</strong>
          <span>{label}</span>
        </div>
      </section>
    </main>
  );
}
