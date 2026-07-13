"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { gsap } from "gsap";
import {
  CoScrollStandaloneDemo,
  type CoScrollAssetManifest,
  type CoScrollLyricSegment,
  type CoScrollTimelineConfig
} from "@miralith/coscroll-scene";
import type { QualityProfile } from "@miralith/visual-core";
import { MiraLithChapterNavigation } from "../../components/MiraLithChapterNavigation";
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
  const interactive = sourceMatch && !staticFrame;
  const [progress, setProgress] = useState(initialProgress);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const shellRef = useRef<HTMLElement>(null);
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
      aria-label={sourceMatch ? "CoScroll Heart Sutra source match" : "CoScroll Heart Sutra spike"}
      tabIndex={interactive ? 0 : undefined}
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
        fallback={
          <VisualCanvasFallback
            scene="coscroll"
            label="CoScroll Heart Sutra source poster"
            posterSrc="/assets/coscroll/posters/coscroll-poster.webp"
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
            interactive
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
