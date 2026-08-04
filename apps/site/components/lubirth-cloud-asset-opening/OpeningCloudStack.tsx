"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import {
  openingGlobeCloudManifest,
  type OpeningGlobeCloudTier
} from "../../content/lubirthOpeningGlobeCloudManifest";
import { OpeningCloudController } from "./controller";
import { PackedCloudVideoFrameProvider } from "./frameProvider";
import { TransitionVeil } from "./TransitionVeil";
import type {
  OpeningCloudDirection,
  OpeningCloudFallbackReason,
  OpeningCloudMetricEvent,
  OpeningCloudSnapshot
} from "./types";
import styles from "../LuBirthCloudAssetOpeningRoute.module.css";

const INITIAL_SNAPSHOT: OpeningCloudSnapshot = {
  source: "live",
  state: "arming",
  progress: 0,
  veilOpacity: 0,
  forwardCycleLockedToLive: false,
  requestedFrame: null,
  renderedFrame: null,
  fallbackReason: null,
  sourceCutCount: 0,
  presentationResourcesReleased: false
};

export function OpeningCloudStack({
  children,
  direction,
  forcedFallbackReason = null,
  onMetric,
  onSnapshot,
  progress,
  reducedMotion,
  tier
}: {
  children: (context: {
    snapshot: OpeningCloudSnapshot;
    video: HTMLVideoElement | null;
  }) => ReactNode;
  direction: OpeningCloudDirection;
  forcedFallbackReason?: OpeningCloudFallbackReason | null;
  onMetric?: (event: OpeningCloudMetricEvent) => void;
  onSnapshot?: (snapshot: OpeningCloudSnapshot) => void;
  progress: number;
  reducedMotion: boolean;
  tier: OpeningGlobeCloudTier;
}) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [snapshot, setSnapshot] = useState<OpeningCloudSnapshot>(INITIAL_SNAPSHOT);
  const controllerRef = useRef<OpeningCloudController | null>(null);
  const pendingFallbackRef = useRef<OpeningCloudFallbackReason | null>(null);
  const inputRef = useRef({ direction, progress });
  const operationRef = useRef(0);
  const lastFallbackReasonRef = useRef<OpeningCloudFallbackReason | null>(null);
  const onMetricRef = useRef(onMetric);
  const onSnapshotRef = useRef(onSnapshot);
  const variant = openingGlobeCloudManifest.variants[tier];

  useLayoutEffect(() => {
    inputRef.current = { direction, progress };
    onMetricRef.current = onMetric;
    onSnapshotRef.current = onSnapshot;
  }, [direction, onMetric, onSnapshot, progress]);

  const reportMetric = useCallback((event: OpeningCloudMetricEvent) => {
    onMetricRef.current?.(event);
  }, []);

  const publish = useCallback((nextSnapshot: OpeningCloudSnapshot) => {
    if (
      nextSnapshot.fallbackReason === "decode-error" &&
      lastFallbackReasonRef.current !== "decode-error"
    ) {
      reportMetric({ type: "decode-error" });
    }
    lastFallbackReasonRef.current = nextSnapshot.fallbackReason;
    setSnapshot(nextSnapshot);
    onSnapshotRef.current?.(nextSnapshot);
  }, [reportMetric]);

  const forceFallback = useCallback((reason: OpeningCloudFallbackReason) => {
    const controller = controllerRef.current;
    if (!controller) {
      pendingFallbackRef.current = reason;
      return;
    }
    pendingFallbackRef.current = null;
    publish(controller.forceFallback(reason));
  }, [publish]);

  useEffect(() => {
    if (!videoElement) return;
    let cancelled = false;
    const provider = new PackedCloudVideoFrameProvider({
      video: videoElement,
      variant,
      manifestId: openingGlobeCloudManifest.id
    });
    const controller = new OpeningCloudController({ provider, tier });

    const pendingFallback = pendingFallbackRef.current;
    if (pendingFallback) {
      controllerRef.current = controller;
      forceFallback(pendingFallback);
    } else if (reducedMotion) {
      controllerRef.current = controller;
      forceFallback("reduced-motion");
    } else if (inputRef.current.progress > 0) {
      controllerRef.current = controller;
      forceFallback("late-first-frame");
    } else {
      const armStartedAt = performance.now();
      void controller.armForwardCycle().then((armedSnapshot) => {
        if (cancelled) return;
        controllerRef.current = controller;
        if (inputRef.current.progress > 0) {
          publish(controller.forceFallback("late-first-frame"));
          return;
        }
        if (armedSnapshot.source === "cloud" && armedSnapshot.renderedFrame === 0) {
          reportMetric({
            type: "cold-start-first-frame",
            milliseconds: performance.now() - armStartedAt
          });
        }
        publish(armedSnapshot);
      });
    }

    return () => {
      cancelled = true;
      operationRef.current += 1;
      controllerRef.current = null;
      provider.dispose();
    };
  }, [forceFallback, publish, reducedMotion, reportMetric, tier, variant, videoElement]);

  useEffect(() => {
    if (forcedFallbackReason) forceFallback(forcedFallbackReason);
  }, [forceFallback, forcedFallbackReason]);

  useEffect(() => {
    if (!videoElement) return;
    const onMediaError = () => forceFallback("decode-error");
    videoElement.addEventListener("error", onMediaError);
    return () => videoElement.removeEventListener("error", onMediaError);
  }, [forceFallback, videoElement]);

  useEffect(() => {
    let wasHidden = document.visibilityState === "hidden";
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      } else if (wasHidden) {
        forceFallback("background-unverified");
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) forceFallback("background-unverified");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [forceFallback]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const operation = ++operationRef.current;
    const beforeSnapshot = controller.getSnapshot();
    const requestStartedAt = performance.now();
    void controller.updateProgress(progress, direction).then((nextSnapshot) => {
      if (operation !== operationRef.current) return;
      if (
        nextSnapshot.requestedFrame !== null &&
        nextSnapshot.requestedFrame !== beforeSnapshot.requestedFrame &&
        nextSnapshot.renderedFrame === nextSnapshot.requestedFrame
      ) {
        reportMetric({
          type: "target-frame",
          milliseconds: performance.now() - requestStartedAt
        });
      }
      publish(nextSnapshot);
    });
  }, [direction, progress, publish, reportMetric]);

  const presentationMounted = !snapshot.presentationResourcesReleased &&
    (snapshot.source === "cloud" || snapshot.state === "reverse-veil-close" || snapshot.state === "reverse-wait-frame");

  return (
    <div
      className={styles.cloudStack}
      data-cloud-fallback-reason={snapshot.fallbackReason ?? ""}
      data-cloud-source={snapshot.source}
      data-cloud-state={snapshot.state}
      data-opening-cloud-stack
    >
      <div className={styles.liveLayer} data-live-ip-relief-lite>
        {children({
          snapshot,
          video: presentationMounted ? videoElement : null
        })}
      </div>
      <video
        aria-hidden="true"
        className={styles.cloudMedia}
        data-opening-globe-cloud-media
        data-tier={tier}
        muted
        playsInline
        preload="auto"
        ref={setVideoElement}
        src={variant.src}
      />
      <TransitionVeil snapshot={snapshot} />
    </div>
  );
}
