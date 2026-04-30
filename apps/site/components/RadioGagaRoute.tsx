"use client";

import { mapRadioGagaProgress } from "@miralith/radio-gaga-scene";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { RadioGagaSceneSlot } from "../visual/scenes/RadioGagaSceneSlot";
import { RadioGagaCopyLayer } from "./RadioGagaCopyLayer";

const radioGagaModelAssets = ["/model/radio_gaga.glb", "/model/xiaozhi_esp32.glb"] as const;

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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const mobilePhase = (progress: number, enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) =>
  smooth(range(progress, enterStart, enterEnd)) * (1 - smooth(range(progress, exitStart, exitEnd)));

function applyRadioGagaProgressStyles(element: HTMLElement, progress: number) {
  const frame = mapRadioGagaProgress(progress);
  const isMobileCopy = typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
  const mobileScrimOpacity = Math.min(0.84, frame.calloutOpacity * 0.54 + frame.finalLineOpacity * 0.76);
  const titleOpacity = isMobileCopy
    ? frame.titleOpacity * (1 - smooth(range(progress, 0.14, 0.24)))
    : frame.titleOpacity;
  const voiceOpacity = isMobileCopy
    ? mobilePhase(progress, 0.2, 0.28, 0.36, 0.46)
    : frame.bodyOpacity;
  const memoryOpacity = isMobileCopy
    ? mobilePhase(progress, 0.42, 0.5, 0.55, 0.62)
    : frame.memoryLayerOpacity;
  const coreOpacity = isMobileCopy
    ? mobilePhase(progress, 0.64, 0.7, 0.8, 0.86)
    : frame.calloutOpacity;
  const finalOpacity = isMobileCopy
    ? smooth(range(progress, 0.86, 0.94))
    : frame.finalLineOpacity;
  const embeddedInstrumentOpacity = Math.max(
    frame.bodyOpacity * 0.28,
    frame.memoryLayerOpacity * 1.4,
    frame.calloutOpacity * 0.68,
    frame.finalLineOpacity * 0.22
  ) * (1 - finalOpacity * 0.7);
  const broadcastOpacity = mobilePhase(progress, 0.42, 0.5, 0.58, 0.68);
  const stageOpacities = [
    1 - smooth(range(progress, 0.16, 0.28)),
    mobilePhase(progress, 0.18, 0.26, 0.36, 0.46),
    mobilePhase(progress, 0.4, 0.48, 0.56, 0.66),
    mobilePhase(progress, 0.62, 0.7, 0.8, 0.88),
    smooth(range(progress, 0.84, 0.94))
  ];
  const dialOpacities = [
    Math.max(frame.bodyOpacity * 0.34, frame.memoryLayerOpacity * 0.5),
    Math.max(frame.memoryLayerOpacity * 0.62, frame.calloutOpacity * 0.24),
    Math.max(frame.memoryLayerOpacity * 0.9, broadcastOpacity * 0.7),
    Math.max(frame.bodyOpacity * 0.52, frame.memoryLayerOpacity * 0.52),
    Math.max(frame.finalLineOpacity * 0.55, frame.memoryLayerOpacity * 0.36)
  ];

  setOpacityVariable(element, "--radio-gaga-title-opacity", titleOpacity);
  setOpacityVariable(element, "--radio-gaga-voice-opacity", voiceOpacity);
  setOpacityVariable(element, "--radio-gaga-memory-opacity", memoryOpacity);
  setOpacityVariable(element, "--radio-gaga-core-opacity", coreOpacity);
  setOpacityVariable(element, "--radio-gaga-final-opacity", finalOpacity);
  setOpacityVariable(element, "--radio-gaga-mobile-scrim-opacity", mobileScrimOpacity);
  setOpacityVariable(element, "--radio-gaga-instrument-opacity", embeddedInstrumentOpacity);
  setOpacityVariable(element, "--radio-gaga-broadcast-opacity", broadcastOpacity);
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
        end: () => `+=${Math.round(window.innerHeight * 3.4)}`,
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
          <span>local news</span>
          <span>my voice</span>
          <span>{"parents' radio"}</span>
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
      {showFallback ? null : <RadioGagaCopyLayer />}
      <div className="sr-only">
        02 - Care. radioGAGA. A radio of local news, family memory, and my own voice.
        I filter local news through my own perspective, then let it return home in my voice.
        It translates the news into a daily language my parents can hold.
        妈，社区门口那条路明天施工，出门绕一下。
        Inside, a small core of care. ESP32 is only the path that lets a voice arrive.
        A small machine for staying close.
      </div>
    </main>
  );
}
