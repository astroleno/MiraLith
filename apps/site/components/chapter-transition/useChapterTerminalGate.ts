"use client";

import { useEffect, useMemo, useRef } from "react";
import { useChapterTransition } from "./ChapterTransitionProvider";

interface UseChapterTerminalGateOptions {
  currentHref: string;
  armed: boolean;
  enabled?: boolean;
}

const INPUT_WINDOW_MS = 520;
const MIN_THRESHOLD_PX = 120;

export function useChapterTerminalGate({
  currentHref,
  armed,
  enabled = true
}: UseChapterTerminalGateOptions) {
  const { beginTransition, getNextAccessibleChapter, snapshot } = useChapterTransition();
  const nextChapter = useMemo(
    () => getNextAccessibleChapter(currentHref),
    [currentHref, getNextAccessibleChapter]
  );
  const committingRef = useRef(false);

  useEffect(() => {
    if (!armed || !enabled || !snapshot.inputEnabled || !nextChapter) {
      committingRef.current = false;
      return;
    }

    let accumulatedPixels = 0;
    let lastForwardInputAt = 0;
    let touchY: number | null = null;
    const threshold = Math.max(MIN_THRESHOLD_PX, window.innerHeight * 0.22);
    const reset = () => {
      accumulatedPixels = 0;
      lastForwardInputAt = 0;
    };
    const commit = (event: Event) => {
      if (committingRef.current) {
        return;
      }
      committingRef.current = true;
      if (event.cancelable) {
        event.preventDefault();
      }
      beginTransition(nextChapter.href, "scroll");
    };
    const addForwardDelta = (pixels: number, event: Event) => {
      if (pixels <= 0 || committingRef.current) {
        return;
      }
      const now = performance.now();
      if (now - lastForwardInputAt > INPUT_WINDOW_MS) {
        accumulatedPixels = 0;
      }
      lastForwardInputAt = now;
      accumulatedPixels += Math.min(pixels, window.innerHeight * 0.14);
      if (event.cancelable) {
        event.preventDefault();
      }
      if (accumulatedPixels >= threshold) {
        commit(event);
      }
    };
    const handleWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
      const delta = event.deltaY * unit;
      if (delta < 0) {
        reset();
        return;
      }
      addForwardDelta(delta, event);
    };
    const handleTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      const nextY = event.touches[0]?.clientY;
      if (touchY === null || nextY === undefined) {
        return;
      }
      const delta = touchY - nextY;
      touchY = nextY;
      if (delta < 0) {
        reset();
        return;
      }
      addForwardDelta(delta * 1.15, event);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.matches("input, textarea, select")) {
        return;
      }
      if (event.key === "PageDown" || event.key === " " || event.key === "End") {
        commit(event);
      } else if (event.key === "ArrowDown") {
        addForwardDelta(threshold * 0.55, event);
      } else if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") {
        reset();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [armed, beginTransition, enabled, nextChapter, snapshot.inputEnabled]);

  return nextChapter;
}
