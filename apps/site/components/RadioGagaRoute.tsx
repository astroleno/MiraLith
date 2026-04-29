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

function applyRadioGagaProgressStyles(element: HTMLElement, progress: number) {
  const frame = mapRadioGagaProgress(progress);
  const decorativeExitOpacity = Math.max(0, 1 - frame.calloutOpacity * 4.2);
  const heroHintOpacity = Math.max(0, 1 - progress / 0.24) * 0.72;
  const mobileScrimOpacity = Math.min(0.84, frame.calloutOpacity * 0.54 + frame.finalLineOpacity * 0.76);

  setOpacityVariable(element, "--radio-gaga-title-opacity", frame.titleOpacity);
  setOpacityVariable(element, "--radio-gaga-voice-opacity", frame.bodyOpacity);
  setOpacityVariable(element, "--radio-gaga-memory-opacity", frame.memoryLayerOpacity);
  setOpacityVariable(element, "--radio-gaga-process-opacity", frame.memoryLayerOpacity * decorativeExitOpacity);
  setOpacityVariable(element, "--radio-gaga-core-opacity", frame.calloutOpacity);
  setOpacityVariable(element, "--radio-gaga-final-opacity", frame.finalLineOpacity);
  setOpacityVariable(element, "--radio-gaga-hint-opacity", heroHintOpacity);
  setOpacityVariable(element, "--radio-gaga-mobile-scrim-opacity", mobileScrimOpacity);
}

export function RadioGagaRoute() {
  const routeRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [assetState, setAssetState] = useState<RadioGagaAssetState>("checking");
  const forcedVisualFallback = useSyncExternalStore(
    subscribeForcedVisualFallback,
    getForcedVisualFallbackSnapshot,
    () => false
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
        <span />
      </div>
      <div className="radio-gaga-fallback-copy">
        <p>02 - Care</p>
        <h1>radioGAGA</h1>
        <p>A small machine for staying close.</p>
        <p>一台让距离变近的小机器。</p>
      </div>
    </VisualCanvasFallback>
  );
  const showFallback = forcedVisualFallback || assetState !== "ready";

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
        Inside, a small core of care. ESP32 is only the path that lets a voice arrive.
        A small machine for staying close.
      </div>
    </main>
  );
}
