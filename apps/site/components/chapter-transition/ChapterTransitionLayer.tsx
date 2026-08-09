"use client";

import { useEffect, useRef } from "react";
import { ChapterTransitionVisual } from "./ChapterTransitionVisual";
import type { ChapterTransitionSnapshot } from "./chapterTransitionTypes";

interface ChapterTransitionLayerProps {
  snapshot: ChapterTransitionSnapshot;
  announcement: string;
  onCovered: (transitionId: string) => void;
  onRevealed: (transitionId: string) => void;
}

export function ChapterTransitionLayer({
  snapshot,
  announcement,
  onCovered,
  onRevealed
}: ChapterTransitionLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const transitionId = snapshot.id;
    const state = snapshot.state;
    const layer = layerRef.current;
    if (!transitionId || !layer || (state !== "covering" && state !== "revealing")) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fallbackDelay = reducedMotion ? 240 : state === "covering" ? 680 : 560;
    let completed = false;
    const complete = () => {
      if (completed) {
        return;
      }
      completed = true;
      if (state === "covering") {
        onCovered(transitionId);
      } else {
        onRevealed(transitionId);
      }
    };
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === layer && event.propertyName === "opacity") {
        complete();
      }
    };
    const timeoutId = window.setTimeout(complete, fallbackDelay);
    layer.addEventListener("transitionend", handleTransitionEnd);

    return () => {
      window.clearTimeout(timeoutId);
      layer.removeEventListener("transitionend", handleTransitionEnd);
    };
  }, [onCovered, onRevealed, snapshot.id, snapshot.state]);

  return (
    <>
      <div
        ref={layerRef}
        className="chapter-transition-layer"
        data-chapter-transition-layer
        data-state={snapshot.state}
        data-kind={snapshot.kind ?? undefined}
        data-handoff-kind={snapshot.handoff?.kind}
        data-source={snapshot.sourceHref ?? undefined}
        data-target={snapshot.targetHref ?? undefined}
        data-transition-id={snapshot.id ?? undefined}
        aria-hidden="true"
      >
        <ChapterTransitionVisual snapshot={snapshot} />
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </>
  );
}
