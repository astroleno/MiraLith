"use client";

import {
  mapRadioGagaFinalOutput,
  mapRadioGagaProgress,
  radioGagaFinalOutputs
} from "@miralith/radio-gaga-scene";
import { useEffect, type RefObject } from "react";

export type RadioGagaHost = "standalone" | "home";

interface UseRadioGagaProgressInput {
  host: RadioGagaHost;
  progressRef: { current: number };
  rootRef: RefObject<HTMLElement | null>;
  scrollDistanceVh: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const mobilePhase = (progress: number, enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) =>
  smooth(range(progress, enterStart, enterEnd)) * (1 - smooth(range(progress, exitStart, exitEnd)));
const radioGagaTuningSequence = [1, 2, 3, 4, 5, 4, 3] as const;

function setOpacityVariable(element: HTMLElement, name: string, value: number) {
  element.style.setProperty(name, clamp01(value).toFixed(4));
}

function setNumberVariable(element: HTMLElement, name: string, value: number) {
  element.style.setProperty(name, value.toFixed(4));
}

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
  const boosts = [1, 2, 3, 4, 5].map((dial) =>
    smooth(1 - clamp01(Math.abs(channel - dial))) * signalPresence
  );

  return {
    boosts,
    position: (channel - 1) / 4,
    scanOpacity: signalPresence * (1 - smooth(range(progress, 0.58, 0.68)) * 0.42)
  };
}

function applyFinalOutput(element: HTMLElement, progress: number) {
  const state = mapRadioGagaFinalOutput(progress);
  const items = element.querySelectorAll<HTMLElement>(".radio-gaga-final-dialog__item");

  items.forEach((item, index) => {
    item.dataset.active = index === state.activeIndex ? "true" : "false";
    item.dataset.visible = index < state.visibleCount ? "true" : "false";
    const strong = item.querySelector("strong");
    const output = radioGagaFinalOutputs[index];
    if (!strong || !output) {
      return;
    }
    const nextText = index === state.activeIndex ? state.displayText || output.zh : output.zh;
    if (strong.textContent !== nextText) {
      strong.textContent = nextText;
    }
  });
}

function applyRadioGagaProgressStyles(element: HTMLElement, progress: number) {
  const frame = mapRadioGagaProgress(progress);
  const tuningSignal = getRadioGagaTuningSignal(progress);
  const isMobileCopy = window.matchMedia("(max-width: 820px)").matches;
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
  const finalOpacity = isMobileCopy ? smooth(range(progress, 0.835, 0.9)) : frame.finalLineOpacity;
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
  const markerFinaleExit = isMobileCopy ? 1 - smooth(range(progress, 0.9, 0.925)) : 1;
  const markerOpacity = stagePresence * markerChromeOpacity * markerFinaleExit;
  const proofOneOpacity = isMobileCopy
    ? smooth(range(progress, 0.36, 0.42)) * (1 - smooth(range(progress, 0.49, 0.55)))
    : smooth(range(progress, 0.36, 0.44)) * (1 - smooth(range(progress, 0.56, 0.66)));
  const proofTwoOpacity = isMobileCopy
    ? smooth(range(progress, 0.48, 0.54)) * (1 - smooth(range(progress, 0.58, 0.64)))
    : smooth(range(progress, 0.52, 0.58)) * (1 - smooth(range(progress, 0.66, 0.78)));
  const instrumentOpacity = isMobileCopy
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
  setOpacityVariable(element, "--radio-gaga-instrument-opacity", instrumentOpacity);
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
  applyFinalOutput(element, progress);
}

export function useRadioGagaProgress({
  host,
  progressRef,
  rootRef,
  scrollDistanceVh
}: UseRadioGagaProgressInput) {
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const updateProgress = (nextProgress: number) => {
      progressRef.current = nextProgress;
      applyRadioGagaProgressStyles(root, nextProgress);
    };
    updateProgress(progressRef.current);

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);
      if (disposed) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);
      const triggerId = `miralith-radio-gaga-${host}`;
      ScrollTrigger.getById(triggerId)?.kill();
      const scrollTrigger = ScrollTrigger.create({
        id: triggerId,
        trigger: root,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * scrollDistanceVh)}`,
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
  }, [host, progressRef, rootRef, scrollDistanceVh]);
}
