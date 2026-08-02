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
  manifest,
  onSnapshot,
  progress,
  providerFactory = defaultProviderFactory,
  reducedMotion = false,
  tier
}: {
  children: ReactNode;
  composition: PreludeCompositionOffset;
  direction: PreludeDirection;
  manifest: CinematicPreludeManifest;
  onSnapshot?: (snapshot: PreludeSnapshot) => void;
  progress: number;
  providerFactory?: ProviderFactory;
  reducedMotion?: boolean;
  tier: CinematicPreludeTier;
}) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [snapshot, setSnapshot] = useState<PreludeSnapshot>(INITIAL_SNAPSHOT);
  const controllerRef = useRef<CinematicPreludeController | null>(null);
  const updateSequenceRef = useRef(0);
  const latestInputRef = useRef({ direction, progress });
  const onSnapshotRef = useRef(onSnapshot);
  const variant = manifest.variants[tier];

  useLayoutEffect(() => {
    latestInputRef.current = { direction, progress };
    onSnapshotRef.current = onSnapshot;
  }, [direction, onSnapshot, progress]);

  const publish = useCallback((nextSnapshot: PreludeSnapshot) => {
    setSnapshot(nextSnapshot);
    onSnapshotRef.current?.(nextSnapshot);
  }, []);

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

    if (reducedMotion) {
      controllerRef.current = controller;
      controller.forceFallback("reduced-motion");
      void controller
        .updateProgress(initialProgress, latestInputRef.current.direction)
        .then(publish);
    } else if (initialProgress > 0) {
      controllerRef.current = controller;
      controller.forceFallback("late-first-frame");
      void controller
        .updateProgress(initialProgress, latestInputRef.current.direction)
        .then(publish);
    } else {
      void controller.armForwardCycle().then((armedSnapshot) => {
        if (cancelled) return;
        controllerRef.current = controller;
        if (latestInputRef.current.progress > 0) {
          controller.forceFallback("late-first-frame");
          void controller
            .updateProgress(
              latestInputRef.current.progress,
              latestInputRef.current.direction
            )
            .then(publish);
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
  }, [manifest.id, providerFactory, publish, reducedMotion, tier, variant, videoElement]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const updateSequence = ++updateSequenceRef.current;
    void controller.updateProgress(progress, direction).then((nextSnapshot) => {
      if (updateSequence !== updateSequenceRef.current) return;
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
