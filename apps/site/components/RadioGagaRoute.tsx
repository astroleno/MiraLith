"use client";

import { mapRadioGagaChoreography, mapRadioGagaFinalOutput } from "@miralith/radio-gaga-scene";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { RadioGagaSceneSlot } from "../visual/scenes/RadioGagaSceneSlot";
import { MiraLithChapterNavigation } from "./MiraLithChapterNavigation";
import { RadioGagaCopyLayer } from "./RadioGagaCopyLayer";

const radioGagaModelAssets = [
  "/model/radio_gaga.glb",
  "/model/xiaozhi_esp32.glb"
] as const;
const RADIO_GAGA_SCROLL_DISTANCE_VH = 11.6;
const RADIO_GAGA_NAV_ACCESS_PROGRESS = 0.14;

type RadioGagaAssetState = "checking" | "ready" | "failed";

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
  const [assetState, setAssetState] = useState<RadioGagaAssetState>("checking");
  const [chapterNavigationInteractive, setChapterNavigationInteractive] = useState(false);
  const [finalOutputState, setFinalOutputState] = useState(() => mapRadioGagaFinalOutput(0));
  const forcedVisualFallback = useSyncExternalStore(
    subscribeForcedVisualFallback,
    getForcedVisualFallbackSnapshot,
    () => initialForcedVisualFallback
  );

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const updateProgress = (nextProgress: number) => {
      progressRef.current = nextProgress;

      const nextChapterNavigationInteractive = nextProgress >= RADIO_GAGA_NAV_ACCESS_PROGRESS;
      if (chapterNavigationInteractiveRef.current !== nextChapterNavigationInteractive) {
        chapterNavigationInteractiveRef.current = nextChapterNavigationInteractive;
        setChapterNavigationInteractive(nextChapterNavigationInteractive);
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
    if (forcedVisualFallback) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const responses = await Promise.all(
          radioGagaModelAssets.map((assetPath) =>
            fetch(assetPath, {
              cache: "force-cache",
              method: "HEAD",
              signal: controller.signal
            })
          )
        );

        if (controller.signal.aborted) {
          return;
        }

        setAssetState(responses.every((response) => response.ok) ? "ready" : "failed");
      } catch {
        if (!controller.signal.aborted) {
          setAssetState("failed");
        }
      }
    })();

    return () => controller.abort();
  }, [forcedVisualFallback]);

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
  const showFallback = forcedVisualFallback || assetState === "failed";

  return (
    <main
      ref={routeRef}
      className="radio-gaga-route"
      data-visual-fallback={showFallback ? "true" : "false"}
      aria-label="radioGAGA care radio scene"
    >
      {showFallback ? (
        fallback
      ) : (
        <VisualCanvas decorative fallback={fallback}>
          <RadioGagaSceneSlot progressRef={progressRef} active />
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
