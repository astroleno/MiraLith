"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import type {
  CinematicPreludeManifest,
  CinematicPreludeTier,
  CinematicPreludeVariant
} from "../../content/lubirthCinematicPreludeManifest";
import { CinematicPreludeController } from "./controller";
import { CinematicPlate, type PreludeCompositionOffset } from "./CinematicPlate";
import { HTMLVideoFrameProvider } from "./frameProvider";
import { TransitionVeil } from "./TransitionVeil";
import type {
  FrameProvider,
  PreludeDirection,
  PreludeFallbackReason,
  PreludeProviderMetrics,
  PreludeSnapshot
} from "./types";
import styles from "../LuBirthCinematicPreludeRoute.module.css";

const INITIAL_SNAPSHOT: PreludeSnapshot = {
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

type ProviderFactory = (input: {
  video: HTMLVideoElement;
  variant: CinematicPreludeVariant;
  manifestId: string;
}) => FrameProvider;

const defaultProviderFactory: ProviderFactory = (input) =>
  new HTMLVideoFrameProvider(input);

export function LuBirthCinematicPreludeStack({
  children,
  composition,
  direction,
  forcedFallbackReason = null,
  manifest,
  onProviderMetrics,
  onSnapshot,
  progress,
  providerFactory = defaultProviderFactory,
  reducedMotion = false,
  tier
}: {
  children: ReactNode;
  composition: PreludeCompositionOffset;
  direction: PreludeDirection;
  forcedFallbackReason?: PreludeFallbackReason | null;
  manifest: CinematicPreludeManifest;
  onProviderMetrics?: (metrics: PreludeProviderMetrics) => void;
  onSnapshot?: (snapshot: PreludeSnapshot) => void;
  progress: number;
  providerFactory?: ProviderFactory;
  reducedMotion?: boolean;
  tier: CinematicPreludeTier;
}) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [snapshot, setSnapshot] = useState<PreludeSnapshot>(INITIAL_SNAPSHOT);
  const controllerRef = useRef<CinematicPreludeController | null>(null);
  const pendingFallbackReasonRef = useRef<PreludeFallbackReason | null>(null);
  const updateSequenceRef = useRef(0);
  const latestInputRef = useRef({ direction, progress });
  const onProviderMetricsRef = useRef(onProviderMetrics);
  const onSnapshotRef = useRef(onSnapshot);
  const variant = manifest.variants[tier];

  useLayoutEffect(() => {
    latestInputRef.current = { direction, progress };
    onProviderMetricsRef.current = onProviderMetrics;
    onSnapshotRef.current = onSnapshot;
  }, [direction, onProviderMetrics, onSnapshot, progress]);

  const publish = useCallback((nextSnapshot: PreludeSnapshot) => {
    setSnapshot(nextSnapshot);
    onSnapshotRef.current?.(nextSnapshot);
  }, []);

  const forceFallback = useCallback(
    (reason: PreludeFallbackReason) => {
      const controller = controllerRef.current;
      if (!controller) {
        pendingFallbackReasonRef.current = reason;
        return;
      }
      pendingFallbackReasonRef.current = null;
      controller.forceFallback(reason);
      void controller
        .updateProgress(
          latestInputRef.current.progress,
          latestInputRef.current.direction
        )
        .then(publish);
    },
    [publish]
  );

  useEffect(() => {
    if (!videoElement) return;

    let cancelled = false;
    const provider = providerFactory({
      video: videoElement,
      variant,
      manifestId: manifest.id
    });
    const controller = new CinematicPreludeController({ provider, tier });
    const initialProgress = latestInputRef.current.progress;
    const pendingFallbackReason = pendingFallbackReasonRef.current;
    const armStartedAtMs = performance.now();
    onProviderMetricsRef.current?.({ armStartedAtMs });

    if (pendingFallbackReason) {
      controllerRef.current = controller;
      forceFallback(pendingFallbackReason);
    } else if (reducedMotion) {
      controllerRef.current = controller;
      forceFallback("reduced-motion");
    } else if (initialProgress > 0) {
      controllerRef.current = controller;
      forceFallback("late-first-frame");
    } else {
      void controller.armForwardCycle().then((armedSnapshot) => {
        if (cancelled) return;
        const armEndedAtMs = performance.now();
        onProviderMetricsRef.current?.({
          armEndedAtMs,
          armStartedAtMs,
          ...(armedSnapshot.renderedFrame === 0 && !armedSnapshot.fallbackReason
            ? { firstFrameMs: armEndedAtMs - armStartedAtMs }
            : {})
        });
        controllerRef.current = controller;
        const fallbackAfterArm = pendingFallbackReasonRef.current;
        if (fallbackAfterArm) {
          forceFallback(fallbackAfterArm);
          return;
        }
        if (latestInputRef.current.progress > 0) {
          forceFallback("late-first-frame");
          return;
        }
        publish(armedSnapshot);
      });
    }

    return () => {
      cancelled = true;
      updateSequenceRef.current += 1;
      controllerRef.current = null;
      provider.dispose();
    };
  }, [
    forceFallback,
    manifest.id,
    providerFactory,
    publish,
    reducedMotion,
    tier,
    variant,
    videoElement
  ]);

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
    const updateSequence = ++updateSequenceRef.current;
    const targetStartedAtMs = performance.now();
    void controller.updateProgress(progress, direction).then((nextSnapshot) => {
      if (updateSequence !== updateSequenceRef.current) return;
      if (nextSnapshot.requestedFrame !== null) {
        onProviderMetricsRef.current?.({
          lastTargetFrameLatencyMs: performance.now() - targetStartedAtMs
        });
      }
      publish(nextSnapshot);
    });
  }, [direction, progress, publish]);

  return (
    <div
      className={styles.stack}
      data-cinematic-prelude-stack
      data-prelude-source={snapshot.source}
      data-prelude-state={snapshot.state}
    >
      <div className={styles.liveLayer} data-cinematic-live-layer>
        {children}
      </div>
      <CinematicPlate
        composition={composition}
        setVideoElement={setVideoElement}
        snapshot={snapshot}
        variant={variant}
      />
      <TransitionVeil manifest={manifest} snapshot={snapshot} />
    </div>
  );
}
