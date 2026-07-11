"use client";

import { mapRadioGagaFinalOutput, mapRadioGagaProgress } from "@miralith/radio-gaga-scene";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { RadioGagaSceneSlot } from "../visual/scenes/RadioGagaSceneSlot";
import { RadioGagaCopyLayer } from "./RadioGagaCopyLayer";

const radioGagaModelAssets = [
  "/model/radio_gaga.glb",
  "/model/xiaozhi_esp32.glb"
] as const;
const RADIO_GAGA_SCROLL_DISTANCE_VH = 11.6;

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

function setNumberVariable(element: HTMLElement, name: string, value: number) {
  element.style.setProperty(name, value.toFixed(4));
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const mobilePhase = (progress: number, enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) =>
  smooth(range(progress, enterStart, enterEnd)) * (1 - smooth(range(progress, exitStart, exitEnd)));
const radioGagaTuningSequence = [1, 2, 3, 4, 5, 4, 3] as const;

function getRadioGagaTuningSignal(progress: number) {
  const tuningProgress = range(progress, 0.48, 0.58);
  const segmentCount = radioGagaTuningSequence.length - 1;
  const scaledProgress = tuningProgress * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress));
  const segmentProgress = smooth(scaledProgress - segmentIndex);
  const fromChannel = radioGagaTuningSequence[segmentIndex] ?? 3;
  const toChannel = radioGagaTuningSequence[segmentIndex + 1] ?? fromChannel;
  const channel = lerp(fromChannel, toChannel, segmentProgress);
  const signalPresence = smooth(range(progress, 0.49, 0.54)) * (1 - smooth(range(progress, 0.68, 0.78)));
  const boosts = [1, 2, 3, 4, 5].map((dial) => {
    const distance = Math.abs(channel - dial);
    return smooth(1 - clamp01(distance)) * signalPresence;
  });

  return {
    boosts,
    position: (channel - 1) / 4,
    scanOpacity: signalPresence * (1 - smooth(range(progress, 0.58, 0.68)) * 0.42)
  };
}

function applyRadioGagaProgressStyles(element: HTMLElement, progress: number) {
  const frame = mapRadioGagaProgress(progress);
  const tuningSignal = getRadioGagaTuningSignal(progress);
  const isMobileCopy = typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
  const mobileScrimOpacity = Math.min(0.84, frame.calloutOpacity * 0.54 + frame.finalLineOpacity * 0.76);
  const copyScrimOpacity = isMobileCopy
    ? mobileScrimOpacity
    : Math.min(0.42, frame.bodyOpacity * 0.16 + frame.memoryLayerOpacity * 0.32 + frame.finalLineOpacity * 0.18);
  const titleOpacity = isMobileCopy
    ? frame.titleOpacity * (1 - smooth(range(progress, 0.14, 0.24)))
    : frame.titleOpacity;
  const voiceOpacity = isMobileCopy
    ? mobilePhase(progress, 0.2, 0.3, 0.34, 0.42)
    : frame.bodyOpacity;
  const memoryOpacity = isMobileCopy
    ? mobilePhase(progress, 0.5, 0.6, 0.68, 0.76)
    : frame.memoryLayerOpacity;
  const baseCoreOpacity = isMobileCopy
    ? mobilePhase(progress, 0.74, 0.82, 0.86, 0.92)
    : frame.calloutOpacity;
  const finalOpacity = isMobileCopy
    ? smooth(range(progress, 0.835, 0.9))
    : frame.finalLineOpacity;
  const finalChromeExit = smooth(range(progress, 0.84, 0.9));
  const coreOpacity = baseCoreOpacity * (1 - smooth(range(progress, 0.84, 0.88)));
  const stageOpacities = [
    1 - smooth(range(progress, 0.16, 0.28)),
    mobilePhase(progress, 0.18, 0.26, 0.36, 0.42),
    mobilePhase(progress, 0.5, 0.58, 0.68, 0.78),
    mobilePhase(progress, 0.74, 0.82, 0.86, 0.92),
    smooth(range(progress, 0.84, 0.94))
  ];
  const stagePresence = Math.max(...stageOpacities);
  const finalDialogOpacity = isMobileCopy
    ? smooth(range(progress, 0.955, 0.975))
    : smooth(range(progress, 0.925, 0.955));
  const titleRailOpacity = 1 - smooth(range(progress, 0.035, 0.095));
  const markerChromeOpacity = isMobileCopy
    ? lerp(1, 0.04, finalChromeExit)
    : lerp(1, 0.16, finalChromeExit);
  const markerFinaleExit = isMobileCopy
    ? 1 - smooth(range(progress, 0.9, 0.925))
    : 1;
  const markerOpacity = stagePresence * markerChromeOpacity * markerFinaleExit;
  const proofOneOpacity = isMobileCopy
    ? smooth(range(progress, 0.36, 0.42)) * (1 - smooth(range(progress, 0.49, 0.55)))
    : smooth(range(progress, 0.36, 0.44)) * (1 - smooth(range(progress, 0.56, 0.66)));
  const proofTwoOpacity = isMobileCopy
    ? smooth(range(progress, 0.48, 0.54)) * (1 - smooth(range(progress, 0.58, 0.64)))
    : smooth(range(progress, 0.52, 0.58)) * (1 - smooth(range(progress, 0.66, 0.78)));
  const embeddedInstrumentOpacity = isMobileCopy
    ? smooth(range(progress, 0.62, 0.68)) * (1 - smooth(range(progress, 0.78, 0.86)))
    : smooth(range(progress, 0.49, 0.58)) *
      (1 - smooth(range(progress, 0.72, 0.82)) * 0.74) *
      (1 - smooth(range(progress, 0.8, 0.88)) * 0.94);
  const dialOpacities = [
    Math.max(mobilePhase(progress, 0.18, 0.25, 0.3, 0.36), tuningSignal.boosts[0] * 0.78),
    Math.max(mobilePhase(progress, 0.3, 0.36, 0.38, 0.43), tuningSignal.boosts[1] * 0.78),
    Math.max(mobilePhase(progress, 0.52, 0.62, 0.68, 0.78), tuningSignal.boosts[2]),
    Math.max(mobilePhase(progress, 0.74, 0.82, 0.86, 0.92), tuningSignal.boosts[3] * 0.78),
    Math.max(mobilePhase(progress, 0.86, 0.94, 0.97, 1), tuningSignal.boosts[4] * 0.78)
  ];

  setOpacityVariable(element, "--radio-gaga-title-opacity", titleOpacity);
  setOpacityVariable(element, "--radio-gaga-voice-opacity", voiceOpacity);
  setOpacityVariable(element, "--radio-gaga-memory-opacity", memoryOpacity);
  setOpacityVariable(element, "--radio-gaga-core-opacity", coreOpacity);
  setOpacityVariable(element, "--radio-gaga-final-opacity", finalOpacity);
  setOpacityVariable(element, "--radio-gaga-final-dialog-opacity", finalDialogOpacity);
  setOpacityVariable(element, "--radio-gaga-title-rail-opacity", titleRailOpacity);
  setOpacityVariable(element, "--radio-gaga-copy-scrim-opacity", copyScrimOpacity);
  setOpacityVariable(element, "--radio-gaga-instrument-opacity", embeddedInstrumentOpacity);
  setOpacityVariable(element, "--radio-gaga-marker-opacity", markerOpacity);
  setOpacityVariable(element, "--radio-gaga-proof-1-opacity", proofOneOpacity);
  setOpacityVariable(element, "--radio-gaga-proof-2-opacity", proofTwoOpacity);
  setOpacityVariable(element, "--radio-gaga-tuner-scan-opacity", tuningSignal.scanOpacity);
  setNumberVariable(element, "--radio-gaga-tuner-position", tuningSignal.position);
  stageOpacities.forEach((opacity, index) => {
    setOpacityVariable(element, `--radio-gaga-stage-${index + 1}-opacity`, opacity);
  });
  dialOpacities.forEach((opacity, index) => {
    setOpacityVariable(element, `--radio-gaga-dial-${index + 1}-opacity`, opacity);
  });
}

interface RadioGagaRouteProps {
  initialForcedVisualFallback?: boolean;
}

export function RadioGagaRoute({ initialForcedVisualFallback = false }: RadioGagaRouteProps) {
  const routeRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [assetState, setAssetState] = useState<RadioGagaAssetState>("checking");
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

      if (routeRef.current) {
        applyRadioGagaProgressStyles(routeRef.current, nextProgress);
      }

      const nextFinalOutputState = mapRadioGagaFinalOutput(nextProgress);
      setFinalOutputState((currentState) =>
        currentState.activeIndex === nextFinalOutputState.activeIndex &&
        currentState.displayText === nextFinalOutputState.displayText &&
        currentState.visibleCount === nextFinalOutputState.visibleCount
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
    <main ref={routeRef} className="radio-gaga-route" aria-label="radioGAGA care radio scene">
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
          activeFinalOutputText={finalOutputState.displayText}
          visibleFinalOutputCount={finalOutputState.visibleCount}
        />
      )}
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
