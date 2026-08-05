"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { gsap } from "gsap";
import {
  CoScrollStandaloneDemo,
  type CoScrollAssetManifest,
  type CoScrollFallbackReason,
  type CoScrollLyricSegment,
  type CoScrollTimelineConfig
} from "@miralith/coscroll-scene";
import type { QualityProfile } from "@miralith/visual-core";
import { MiraLithChapterNavigation } from "../../components/MiraLithChapterNavigation";
import { useChapterTransitionDestination } from "../../components/chapter-transition/ChapterTransitionProvider";
import {
  throwIfChapterTransitionAborted,
  waitForChapterTransitionFrames
} from "../../components/chapter-transition/chapterTransitionAbort";
import type {
  ChapterDestinationFallbackContext,
  ChapterDestinationResetContext
} from "../../components/chapter-transition/chapterTransitionTypes";
import { VisualCanvasFallback } from "../../visual/VisualCanvasFallback";

interface CoScrollSpikeExperienceProps {
  sourceMatch: boolean;
  staticFrame: boolean;
  initialProgress: number;
  timeline: CoScrollTimelineConfig;
  assets: CoScrollAssetManifest;
  lyrics: CoScrollLyricSegment[];
  chapterNavigation?: boolean;
}

const PIXELS_PER_SECOND = 22;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapTime = (time: number, duration: number) => {
  const safeDuration = Math.max(1, duration || 1);
  return ((time % safeDuration) + safeDuration) % safeDuration;
};

function readinessGenerationFor(context: {
  transitionId: string;
  destinationAttempt: number;
}) {
  return `${context.transitionId}:${context.destinationAttempt}`;
}

export function CoScrollSpikeExperience({
  sourceMatch,
  staticFrame,
  initialProgress,
  timeline,
  assets,
  lyrics,
  chapterNavigation = false
}: CoScrollSpikeExperienceProps) {
  const duration = Math.max(1, timeline.duration);
  const initialTime = initialProgress * duration;
  const baseInteractive = sourceMatch && !staticFrame;
  const [progress, setProgress] = useState(initialProgress);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [entryReadinessGeneration, setEntryReadinessGeneration] = useState<string | null>(null);
  const [expectedVisualGeneration, setExpectedVisualGeneration] = useState<string | null>(null);
  const [visualReadyGeneration, setVisualReadyGeneration] = useState<string | null>(null);
  const [visualFallback, setVisualFallback] = useState<{
    reason: CoScrollFallbackReason;
    generation: string;
  } | null>(null);
  const [transitionForcedFallbackGeneration, setTransitionForcedFallbackGeneration] = useState<string | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const entryReadinessGenerationRef = useRef<string | null>(null);
  const expectedVisualGenerationRef = useRef<string | null>(null);
  const transitionForcedFallbackGenerationRef = useRef<string | null>(null);
  const timeProxyRef = useRef({ time: initialTime });
  const targetTimeRef = useRef(initialTime);
  const touchYRef = useRef(0);
  const velocityTimeoutRef = useRef<number | null>(null);

  const renderTime = useCallback(
    (time: number) => {
      setProgress(wrapTime(time, duration) / duration);
    },
    [duration]
  );

  const clearVelocityTimeout = useCallback(() => {
    if (velocityTimeoutRef.current) {
      window.clearTimeout(velocityTimeoutRef.current);
      velocityTimeoutRef.current = null;
    }
  }, []);

  const resetEntry = useCallback(async (context: ChapterDestinationResetContext) => {
    throwIfChapterTransitionAborted(context.signal);
    const readinessGeneration = readinessGenerationFor(context);
    const forcedFallbackActive = transitionForcedFallbackGenerationRef.current === readinessGeneration;
    entryReadinessGenerationRef.current = readinessGeneration;
    expectedVisualGenerationRef.current = forcedFallbackActive ? readinessGeneration : null;
    if (!forcedFallbackActive) {
      transitionForcedFallbackGenerationRef.current = null;
    }
    setEntryReadinessGeneration(readinessGeneration);
    setExpectedVisualGeneration(forcedFallbackActive ? readinessGeneration : null);
    setVisualReadyGeneration(null);
    setVisualFallback(null);
    setTransitionForcedFallbackGeneration((current) => current === readinessGeneration ? current : null);
    const restoredProgress = context.initiator === "history" ? context.returnSnapshot?.routeProgress : null;
    const nextProgress = typeof restoredProgress === "number"
      ? clamp(restoredProgress, 0, 1)
      : initialProgress;
    const nextTime = nextProgress * duration;
    clearVelocityTimeout();
    gsap.killTweensOf(timeProxyRef.current);
    timeProxyRef.current.time = nextTime;
    targetTimeRef.current = nextTime;
    setScrollVelocity(0);
    setProgress(nextProgress);
    window.scrollTo({ top: 0, behavior: "instant" });
    await waitForChapterTransitionFrames(context.signal, 2);
    throwIfChapterTransitionAborted(context.signal);
  }, [clearVelocityTimeout, duration, initialProgress]);
  const destinationControls = useMemo(() => ({
    resetEntry,
    forceFallback: (context: ChapterDestinationFallbackContext) => {
      const readinessGeneration = readinessGenerationFor(context);
      entryReadinessGenerationRef.current = readinessGeneration;
      expectedVisualGenerationRef.current = readinessGeneration;
      transitionForcedFallbackGenerationRef.current = readinessGeneration;
      setEntryReadinessGeneration(readinessGeneration);
      setExpectedVisualGeneration(readinessGeneration);
      setVisualReadyGeneration(null);
      setVisualFallback(null);
      setTransitionForcedFallbackGeneration(readinessGeneration);
    }
  }), [resetEntry]);
  const destination = useChapterTransitionDestination("/coscroll", destinationControls, chapterNavigation);
  const reportVisualPending = destination.reportVisualPending;
  const interactive = baseInteractive && (!chapterNavigation || destination.inputEnabled);
  const handleVisualGenerationChange = useCallback((readinessGeneration: string) => {
    const entryGeneration = entryReadinessGenerationRef.current;
    if (
      !entryGeneration ||
      transitionForcedFallbackGenerationRef.current === entryGeneration ||
      !readinessGeneration.startsWith(`${entryGeneration}|`)
    ) {
      return;
    }
    reportVisualPending();
    expectedVisualGenerationRef.current = readinessGeneration;
    setExpectedVisualGeneration(readinessGeneration);
    setVisualReadyGeneration((current) => current === readinessGeneration ? current : null);
    setVisualFallback((current) => current?.generation === readinessGeneration ? current : null);
  }, [reportVisualPending]);
  const handleVisualReady = useCallback((readinessGeneration?: string) => {
    if (readinessGeneration && readinessGeneration === expectedVisualGenerationRef.current) {
      setVisualReadyGeneration(readinessGeneration);
    }
  }, []);
  const handleVisualFallback = useCallback((
    reason: CoScrollFallbackReason,
    readinessGeneration?: string
  ) => {
    if (!readinessGeneration) {
      return;
    }
    const entryGeneration = entryReadinessGenerationRef.current;
    if (
      readinessGeneration !== expectedVisualGenerationRef.current &&
      readinessGeneration !== entryGeneration
    ) {
      return;
    }
    reportVisualPending();
    if (readinessGeneration === entryGeneration) {
      expectedVisualGenerationRef.current = readinessGeneration;
      setExpectedVisualGeneration(readinessGeneration);
      setVisualReadyGeneration(null);
    }
    setVisualFallback({ reason, generation: readinessGeneration });
  }, [reportVisualPending]);

  useEffect(() => {
    if (!chapterNavigation) {
      return;
    }
    if (!entryReadinessGeneration || !expectedVisualGeneration || !destination.isTransitionTarget) {
      return;
    }
    if (visualFallback?.generation === expectedVisualGeneration) {
      destination.reportFallbackReady();
    } else if (visualReadyGeneration === expectedVisualGeneration) {
      destination.reportVisualReady();
    }
  }, [
    chapterNavigation,
    destination,
    entryReadinessGeneration,
    expectedVisualGeneration,
    visualFallback,
    visualReadyGeneration
  ]);

  const seekByDelta = useCallback(
    (deltaSeconds: number) => {
      if (!interactive || !Number.isFinite(deltaSeconds) || deltaSeconds === 0) {
        return;
      }

      const nextTime = targetTimeRef.current + deltaSeconds;
      targetTimeRef.current = nextTime;
      setScrollVelocity(clamp(deltaSeconds / 24, -0.22, 0.22));
      clearVelocityTimeout();
      velocityTimeoutRef.current = window.setTimeout(() => {
        setScrollVelocity(0);
        velocityTimeoutRef.current = null;
      }, 360);

      gsap.to(timeProxyRef.current, {
        time: nextTime,
        duration: 0.36,
        ease: "power3.out",
        overwrite: true,
        onUpdate: () => renderTime(timeProxyRef.current.time)
      });
    },
    [clearVelocityTimeout, interactive, renderTime]
  );

  useEffect(() => {
    const timeProxy = timeProxyRef.current;

    return () => {
      clearVelocityTimeout();
      gsap.killTweensOf(timeProxy);
    };
  }, [clearVelocityTimeout]);

  const handleWheel = useCallback(
    (event: globalThis.WheelEvent) => {
      if (!interactive) {
        return;
      }

      const unit = event.deltaMode === 1 ? 16 : 1;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const pixels = horizontal ? -event.deltaX * unit : event.deltaY * unit;
      if (!pixels) {
        return;
      }

      event.preventDefault();
      seekByDelta(pixels / PIXELS_PER_SECOND);
    },
    [interactive, seekByDelta]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!interactive) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        seekByDelta(4);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        seekByDelta(-4);
      }
    },
    [interactive, seekByDelta]
  );

  const handleTouchStart = useCallback(
    (event: globalThis.TouchEvent) => {
      if (!interactive || event.touches.length === 0) {
        return;
      }

      touchYRef.current = event.touches[0].clientY;
    },
    [interactive]
  );

  const handleTouchMove = useCallback(
    (event: globalThis.TouchEvent) => {
      if (!interactive || event.touches.length === 0) {
        return;
      }

      const y = event.touches[0].clientY;
      const dy = touchYRef.current - y;
      touchYRef.current = y;
      if (dy === 0) {
        return;
      }

      event.preventDefault();
      seekByDelta((dy * 1.15) / PIXELS_PER_SECOND);
    },
    [interactive, seekByDelta]
  );

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !interactive) {
      return;
    }

    shell.addEventListener("wheel", handleWheel, { passive: false });
    shell.addEventListener("touchstart", handleTouchStart, { passive: true });
    shell.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      shell.removeEventListener("wheel", handleWheel);
      shell.removeEventListener("touchstart", handleTouchStart);
      shell.removeEventListener("touchmove", handleTouchMove);
    };
  }, [handleTouchMove, handleTouchStart, handleWheel, interactive]);

  const quality: QualityProfile = {
    tier: "medium",
    dpr: 1.25,
    segments: 72,
    aurora: false,
    stars: 0,
    reason: sourceMatch ? "source-match" : "spike"
  };
  const sourceMatchViewportStyle: CSSProperties | undefined = sourceMatch
    ? {
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        minHeight: "100svh",
        overflow: "hidden",
        overscrollBehavior: "none",
        touchAction: "none",
        background: "#010205"
      }
    : undefined;

  return (
    <main
      ref={shellRef}
      className="coscroll-section"
      data-coscroll-spike="heart-sutra"
      data-coscroll-source-match={sourceMatch ? "clean" : "copy"}
      data-coscroll-runtime={interactive ? "scroll-driven" : staticFrame ? "static-review" : "static-copy"}
      data-coscroll-progress={progress.toFixed(4)}
      data-coscroll-input-enabled={interactive ? "true" : "false"}
      data-chapter-focus-root={chapterNavigation ? "true" : undefined}
      aria-label={sourceMatch ? "CoScroll Heart Sutra source match" : "CoScroll Heart Sutra spike"}
      tabIndex={interactive ? 0 : chapterNavigation ? -1 : undefined}
      onKeyDown={handleKeyDown}
      style={sourceMatchViewportStyle}
    >
      <CoScrollStandaloneDemo
        className="coscroll-section__visual"
        progress={progress}
        active
        quality={quality}
        reducedMotion={false}
        timeline={timeline}
        assets={assets}
        scrollVelocity={scrollVelocity}
        paused={staticFrame}
        readinessGeneration={entryReadinessGeneration ?? "unscoped"}
        forceFallback={
          entryReadinessGeneration !== null &&
          transitionForcedFallbackGeneration === entryReadinessGeneration
        }
        onReadinessGenerationChange={handleVisualGenerationChange}
        onReady={handleVisualReady}
        onFallback={handleVisualFallback}
        fallback={
          <VisualCanvasFallback
            scene="coscroll"
            label="CoScroll Heart Sutra fallback field"
          >
            <span className="coscroll-section__fallback-mark" aria-hidden="true">心</span>
          </VisualCanvasFallback>
        }
      />

      {sourceMatch ? null : (
        <section className="coscroll-section__copy" aria-labelledby="coscroll-spike-title">
          <p>CoScroll / Heart Sutra</p>
          <h1 id="coscroll-spike-title">心 / 空 / 道</h1>
          <p>
            Silk darkness, pale-amber jelly anchors, and a scroll-derived ritual clock for the next MiraLith visual chapter.
          </p>
        </section>
      )}

      <ol className="sr-only" aria-label="Heart Sutra lyric source">
        {lyrics.slice(0, 12).map((line) => (
          <li key={line.id}>{line.text}</li>
        ))}
      </ol>

      {chapterNavigation ? (
        <>
          <MiraLithChapterNavigation
            activeIndex="03"
            interactive={destination.inputEnabled}
            className="coscroll-chapter-nav"
            compactClassName="coscroll-chapter-bar"
          />
          <section className="sr-only" aria-labelledby="coscroll-public-title">
            <h1 id="coscroll-public-title">CoScroll Heart Sutra</h1>
            <p>CoScroll is MiraLith&apos;s digital sutra chapter, driven by scrolling through a source-matched Heart Sutra field.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}
