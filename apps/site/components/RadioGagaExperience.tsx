"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { RadioGagaCopyLayer } from "./RadioGagaCopyLayer";
import { useRadioGagaProgress, type RadioGagaHost } from "./useRadioGagaProgress";

const RADIO_GAGA_SCROLL_DISTANCE_VH = 11.6;
const radioGagaModelAssets = [
  "/model/radio_gaga.glb",
  "/model/xiaozhi_esp32.glb"
] as const;

export type RadioGagaAssetState = "checking" | "ready" | "failed";

export interface RadioGagaChapterPresence {
  near: boolean;
  active: boolean;
}

export interface RadioGagaExperienceProps {
  host: RadioGagaHost;
  initialForcedVisualFallback?: boolean;
  progressRef: { current: number };
  renderVisual?: (input: {
    progressRef: { current: number };
    active: boolean;
    near: boolean;
    assetState: RadioGagaAssetState;
    fallback: ReactNode;
  }) => ReactNode;
  onPresenceChange?: (presence: RadioGagaChapterPresence) => void;
}

function subscribeForcedVisualFallback(_onStoreChange: () => void) {
  return () => undefined;
}

function getForcedVisualFallbackSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("visual") === "fallback";
}

function RadioGagaFallback() {
  return (
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
}

export function RadioGagaExperience({
  host,
  initialForcedVisualFallback = false,
  progressRef,
  renderVisual,
  onPresenceChange
}: RadioGagaExperienceProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [presence, setPresence] = useState<RadioGagaChapterPresence>(() => ({
    near: host === "standalone",
    active: host === "standalone"
  }));
  const [assetState, setAssetState] = useState<RadioGagaAssetState>("checking");
  const forcedVisualFallback = useSyncExternalStore(
    subscribeForcedVisualFallback,
    getForcedVisualFallbackSnapshot,
    () => initialForcedVisualFallback
  );

  useRadioGagaProgress({
    host,
    progressRef,
    rootRef,
    scrollDistanceVh: RADIO_GAGA_SCROLL_DISTANCE_VH
  });

  useEffect(() => {
    if (host === "standalone") {
      return;
    }

    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      return;
    }

    const updatePresence = (patch: Partial<RadioGagaChapterPresence>) => {
      setPresence((current) => {
        const next = { ...current, ...patch };
        return next.near === current.near && next.active === current.active ? current : next;
      });
    };
    const nearObserver = new IntersectionObserver(
      ([entry]) => updatePresence({ near: entry?.isIntersecting ?? false }),
      { rootMargin: "150% 0px 150% 0px", threshold: 0 }
    );
    const activeObserver = new IntersectionObserver(
      ([entry]) => updatePresence({ active: entry?.isIntersecting ?? false }),
      { rootMargin: "-25% 0px -25% 0px", threshold: 0.01 }
    );
    nearObserver.observe(root);
    activeObserver.observe(root);

    return () => {
      nearObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [host]);

  useEffect(() => {
    onPresenceChange?.(presence);
  }, [onPresenceChange, presence]);

  useEffect(() => {
    if (
      forcedVisualFallback ||
      assetState !== "checking" ||
      (host === "home" && !presence.near)
    ) {
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
        if (!controller.signal.aborted) {
          setAssetState(responses.every((response) => response.ok) ? "ready" : "failed");
        }
      } catch {
        if (!controller.signal.aborted) {
          setAssetState("failed");
        }
      }
    })();

    return () => controller.abort();
  }, [assetState, forcedVisualFallback, host, presence.near]);

  const fallback = <RadioGagaFallback />;
  const showFallback = forcedVisualFallback || assetState === "failed";
  const active = presence.active && assetState === "ready" && !showFallback;
  const Root = host === "standalone" ? "main" : "div";

  return (
    <Root
      ref={(node) => {
        rootRef.current = node;
      }}
      className="radio-gaga-route"
      aria-label="radioGAGA care radio scene"
      data-radio-gaga-experience={host}
      data-radio-gaga-host={host}
      data-radio-gaga-runtime="case-study"
    >
      {showFallback
        ? fallback
        : renderVisual?.({
            progressRef,
            active,
            near: presence.near,
            assetState,
            fallback
          })}
      {showFallback ? null : <RadioGagaCopyLayer host={host} />}
      <div className="sr-only">
        02 - Care. radioGAGA. A radio of local news, family memory, and my own voice.
        I filter local news through my own perspective, then let it return home in my voice.
        The radio asks what changed today, and I tune the answer into a line my parents can hold.
        妈，社区门口那条路明天施工，出门从东门绕一下。
        ESP32, a small voice core. The ESP32 carries my voice to reminders that land at home.
        A small machine for staying close.
      </div>
    </Root>
  );
}
