"use client";

import {
  mapRadioGagaChoreography,
  mapRadioGagaFinalOutput,
  preloadRadioGagaFinaleAssets
} from "@miralith/radio-gaga-scene";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { RadioGagaSceneSlot } from "../visual/scenes/RadioGagaSceneSlot";
import { useChapterTerminalGate } from "./chapter-transition/useChapterTerminalGate";
import { useChapterTransitionDestination } from "./chapter-transition/ChapterTransitionProvider";
import {
  throwIfChapterTransitionAborted,
  waitForChapterTransitionFrame,
  waitForChapterTransitionFrames
} from "./chapter-transition/chapterTransitionAbort";
import type { ChapterDestinationResetContext } from "./chapter-transition/chapterTransitionTypes";
import { MiraLithChapterNavigation } from "./MiraLithChapterNavigation";
import { RadioGagaCopyLayer } from "./RadioGagaCopyLayer";

const RADIO_GAGA_SCROLL_DISTANCE_VH = 11.6;
const RADIO_GAGA_NAV_ACCESS_PROGRESS = 0.14;
const RADIO_GAGA_TERMINAL_PROGRESS = 0.997;
const RADIO_GAGA_FINALE_PRELOAD_PROGRESS = 0.58;

function subscribeForcedVisualFallback(_onStoreChange: () => void) {
  return () => undefined;
}

function getForcedVisualFallbackSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("visual") === "fallback";
}

function setOpacityVariable(element: HTMLElement, name: string, value: number) {
  element.style.setProperty(name, Math.max(0, Math.min(1, value)).toFixed(4));
}

function setPercentageVariable(element: HTMLElement, name: string, value: number) {
  element.style.setProperty(name, `${Math.max(0, Math.min(1, value)) * 100}%`);
}

function applyRadioGagaProgressStyles(element: HTMLElement, progress: number) {
  const isMobileCopy = typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
  const { copy } = mapRadioGagaChoreography(progress, isMobileCopy ? "compact" : "desktop");

  setOpacityVariable(element, "--radio-gaga-title-opacity", copy.titleOpacity);
  setOpacityVariable(element, "--radio-gaga-voice-opacity", copy.voiceOpacity);
  setOpacityVariable(element, "--radio-gaga-memory-opacity", copy.memoryOpacity);
  setOpacityVariable(element, "--radio-gaga-final-opacity", copy.finalOpacity);
  setOpacityVariable(element, "--radio-gaga-title-rail-opacity", copy.titleRailOpacity);
  setOpacityVariable(element, "--radio-gaga-copy-scrim-opacity", copy.copyScrimOpacity);
  setOpacityVariable(element, "--radio-gaga-instrument-opacity", copy.instrumentOpacity);
  setOpacityVariable(element, "--radio-gaga-tuner-scan-opacity", copy.tunerScanOpacity);
  setPercentageVariable(element, "--radio-gaga-tuner-position-x", copy.tunerPosition);
  copy.stageOpacities.forEach((opacity, index) => {
    setOpacityVariable(element, `--radio-gaga-stage-${index + 1}-opacity`, opacity);
  });
  copy.dialOpacities.forEach((opacity, index) => {
    setOpacityVariable(element, `--radio-gaga-dial-${index + 1}-opacity`, opacity);
  });
}

interface RadioGagaRouteProps {
  initialForcedVisualFallback?: boolean;
}

export function RadioGagaRoute({ initialForcedVisualFallback = false }: RadioGagaRouteProps) {
  const routeRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const chapterNavigationInteractiveRef = useRef(false);
  const terminalRef = useRef(false);
  const entryResetInProgressRef = useRef(false);
  const entryResetAttemptRef = useRef<number | null>(null);
  const transitionInputEnabledRef = useRef(true);
  const transitionTargetRef = useRef(false);
  const [chapterNavigationInteractive, setChapterNavigationInteractive] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [copyReady, setCopyReady] = useState(false);
  const [transitionFallback, setTransitionFallback] = useState(false);
  const [finaleAssetsEnabled, setFinaleAssetsEnabled] = useState(false);
  const [finalOutputState, setFinalOutputState] = useState(() => mapRadioGagaFinalOutput(0));
  const forcedVisualFallback = useSyncExternalStore(
    subscribeForcedVisualFallback,
    getForcedVisualFallbackSnapshot,
    () => initialForcedVisualFallback
  );
  const resetEntry = useCallback(async (context: ChapterDestinationResetContext) => {
    throwIfChapterTransitionAborted(context.signal);
    const restoredProgress = context.initiator === "history" ? context.returnSnapshot?.routeProgress : null;
    const nextProgress = typeof restoredProgress === "number" ? Math.max(0, Math.min(1, restoredProgress)) : 0;
    const nextScrollY = context.initiator === "history" && context.returnSnapshot
      ? context.returnSnapshot.scrollY
      : Math.round(window.innerHeight * RADIO_GAGA_SCROLL_DISTANCE_VH * nextProgress);

    entryResetInProgressRef.current = true;
    entryResetAttemptRef.current = context.destinationAttempt;
    try {
      progressRef.current = nextProgress;
      if (routeRef.current) {
        routeRef.current.dataset.radioGagaProgress = nextProgress.toFixed(4);
        applyRadioGagaProgressStyles(routeRef.current, nextProgress);
      }
      const nextNavigationInteractive = nextProgress >= RADIO_GAGA_NAV_ACCESS_PROGRESS;
      chapterNavigationInteractiveRef.current = nextNavigationInteractive;
      setChapterNavigationInteractive(nextNavigationInteractive);
      const nextTerminal = nextProgress >= RADIO_GAGA_TERMINAL_PROGRESS;
      terminalRef.current = nextTerminal;
      setTerminal(nextTerminal);
      setFinalOutputState(mapRadioGagaFinalOutput(
        nextProgress,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ));
      window.scrollTo({ top: nextScrollY, behavior: "instant" });

      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);
      throwIfChapterTransitionAborted(context.signal);
      await waitForChapterTransitionFrame(context.signal);
      throwIfChapterTransitionAborted(context.signal);
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.refresh();
      throwIfChapterTransitionAborted(context.signal);
      window.scrollTo({ top: nextScrollY, behavior: "instant" });
      await waitForChapterTransitionFrames(context.signal, 2);
      throwIfChapterTransitionAborted(context.signal);
    } finally {
      if (entryResetAttemptRef.current === context.destinationAttempt) {
        entryResetAttemptRef.current = null;
        entryResetInProgressRef.current = false;
      }
    }
  }, []);
  const destinationControls = useMemo(() => ({
    resetEntry,
    forceFallback: () => {
      setTransitionFallback(true);
    }
  }), [resetEntry]);
  const destination = useChapterTransitionDestination("/radio-gaga", destinationControls);
  useEffect(() => {
    transitionInputEnabledRef.current = destination.inputEnabled;
    transitionTargetRef.current = destination.isTransitionTarget;
  }, [destination.inputEnabled, destination.isTransitionTarget]);
  useChapterTerminalGate({
    currentHref: "/radio-gaga",
    armed: terminal,
    enabled: destination.inputEnabled
  });

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const updateProgress = (nextProgress: number) => {
      if (
        transitionTargetRef.current &&
        !transitionInputEnabledRef.current &&
        !entryResetInProgressRef.current
      ) {
        return;
      }
      progressRef.current = nextProgress;
      if (routeRef.current) {
        routeRef.current.dataset.radioGagaProgress = nextProgress.toFixed(4);
      }

      const nextChapterNavigationInteractive = nextProgress >= RADIO_GAGA_NAV_ACCESS_PROGRESS;
      if (chapterNavigationInteractiveRef.current !== nextChapterNavigationInteractive) {
        chapterNavigationInteractiveRef.current = nextChapterNavigationInteractive;
        setChapterNavigationInteractive(nextChapterNavigationInteractive);
      }

      const nextTerminal = nextProgress >= RADIO_GAGA_TERMINAL_PROGRESS;
      if (terminalRef.current !== nextTerminal) {
        terminalRef.current = nextTerminal;
        setTerminal(nextTerminal);
      }

      if (nextProgress >= RADIO_GAGA_FINALE_PRELOAD_PROGRESS) {
        preloadRadioGagaFinaleAssets();
        setFinaleAssetsEnabled(true);
      }

      if (routeRef.current) {
        applyRadioGagaProgressStyles(routeRef.current, nextProgress);
      }

      const nextFinalOutputState = mapRadioGagaFinalOutput(
        nextProgress,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
      setFinalOutputState((currentState) =>
        currentState.activeIndex === nextFinalOutputState.activeIndex &&
        currentState.displayText === nextFinalOutputState.displayText &&
        currentState.isComplete === nextFinalOutputState.isComplete
          ? currentState
          : nextFinalOutputState
      );
    };

    if (routeRef.current) {
      routeRef.current.dataset.radioGagaProgress = progressRef.current.toFixed(4);
      applyRadioGagaProgressStyles(routeRef.current, progressRef.current);
    }

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);

      if (disposed || !routeRef.current) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.getById("miralith-radio-gaga-route")?.kill();

      const scrollTrigger = ScrollTrigger.create({
        id: "miralith-radio-gaga-route",
        trigger: routeRef.current,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * RADIO_GAGA_SCROLL_DISTANCE_VH)}`,
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: (self) => updateProgress(self.progress),
        onUpdate: (self) => updateProgress(self.progress)
      });

      cleanup = () => scrollTrigger.kill();
      ScrollTrigger.refresh();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          setCopyReady(true);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallback = (
    <VisualCanvasFallback scene="radio-gaga" label="radioGAGA care radio fallback">
      <div className="radio-gaga-fallback-poster" aria-hidden="true">
        <span className="radio-gaga-fallback-poster__antenna" />
        <span className="radio-gaga-fallback-poster__dial" />
      </div>
      <div className="radio-gaga-fallback-copy">
        <p>02 - Care</p>
        <h1>radioGAGA</h1>
        <p>A small machine for staying close.</p>
        <p>一台让距离变近的小机器。</p>
        <div className="radio-gaga-fallback-flow" aria-hidden="true">
          <span>what&apos;s new?</span>
          <span>my voice</span>
          <span>still loved</span>
        </div>
      </div>
    </VisualCanvasFallback>
  );
  const showFallback = forcedVisualFallback || transitionFallback;

  useEffect(() => {
    if (showFallback) {
      destination.reportFallbackReady();
    } else if (sceneReady && copyReady) {
      destination.reportVisualReady();
    }
  }, [copyReady, destination, sceneReady, showFallback]);

  return (
    <main
      ref={routeRef}
      className="radio-gaga-route"
      data-visual-fallback={showFallback ? "true" : "false"}
      data-chapter-focus-root
      tabIndex={-1}
      aria-label="radioGAGA care radio scene"
    >
      {showFallback ? (
        fallback
      ) : (
        <VisualCanvas
          decorative
          fallback={fallback}
          onFallback={() => setTransitionFallback(true)}
        >
          <RadioGagaSceneSlot
            progressRef={progressRef}
            active
            loadFinale={finaleAssetsEnabled}
            onReady={() => setSceneReady(true)}
            onFallback={() => setTransitionFallback(true)}
          />
        </VisualCanvas>
      )}
      {showFallback ? null : (
        <RadioGagaCopyLayer
          activeFinalOutputIndex={finalOutputState.activeIndex}
          activeFinalOutputComplete={finalOutputState.isComplete}
          activeFinalOutputText={finalOutputState.displayText}
        />
      )}
      <MiraLithChapterNavigation
        activeIndex="02"
        interactive={showFallback || chapterNavigationInteractive}
        className="radio-gaga-title-rail"
        compactClassName="radio-gaga-mobile-title-bar"
        terminal={terminal}
      />
      <div className="sr-only">
        02 - Care. radioGAGA. A radio of local news, family memory, and my own voice.
        I filter local news through my own perspective, then let it return home in my voice.
        The radio asks what changed today, and I tune the answer into a line my parents can hold.
        妈，社区门口那条路明天施工，出门从东门绕一下。
        ESP32, a small voice core. The ESP32 carries my voice to reminders that land at home.
        A small machine for staying close.
      </div>
    </main>
  );
}
