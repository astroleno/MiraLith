"use client";

import { useCallback, useLayoutEffect, useMemo, useReducer, useState } from "react";
import {
  DEFAULT_LUBIRTH_LOCATION,
  type LandingVisualPolicy
} from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";
import rawManifest from "../public/assets/lubirth/cinematic-prelude/manifest.json";
import {
  type CinematicPreludeTier,
  validateCinematicPreludeManifest
} from "../content/lubirthCinematicPreludeManifest";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";
import { LuBirthCinematicPreludeStack } from "./lubirth-cinematic-prelude/LuBirthCinematicPreludeStack";
import type {
  PreludeDirection,
  PreludeSnapshot,
  PreludeState
} from "./lubirth-cinematic-prelude/types";
import styles from "./LuBirthCinematicPreludeRoute.module.css";

const manifest = validateCinematicPreludeManifest(rawManifest);
const RELIEF_LITE_POLICY: Partial<
  Pick<LandingVisualPolicy, "atmosphereMode" | "cloudMode" | "postEffectMode">
> = {
  cloudMode: "relief-lite",
  atmosphereMode: "limb-lite",
  postEffectMode: "off"
};

interface RouteConfig {
  copyHidden: boolean;
  latitudeDeg: number;
  longitudeDeg: number;
  progress: number;
  quality: LandingQuality;
}

interface MotionState {
  direction: PreludeDirection;
  progress: number;
}

export interface LuBirthCinematicPreludeTelemetry {
  source: "plate" | "live";
  state: PreludeState;
  progress: number;
  normalizedComposition: { x: number; y: number; scale: number };
  selectedTier: CinematicPreludeTier | null;
  armStatus: "ready" | "late" | "failed" | "skipped";
  requestedFrame: number | null;
  renderedFrame: number | null;
  veilOpacity: number;
  fallbackReason: string | null;
  locationMode: "normalized-ip-composition";
  manifestId: string;
  manifestSha256: string;
}

declare global {
  interface Window {
    __MiraLithOpeningProgress?: number;
    __MiraLithSetCinematicPreludeProgress?: (progress: number) => void;
    __MiraLithLuBirthCinematicPrelude?: LuBirthCinematicPreludeTelemetry;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteQueryNumber(params: URLSearchParams, name: string, fallback: number) {
  const parameter = params.get(name);
  if (parameter === null || parameter.trim() === "") return fallback;
  const value = Number(parameter);
  return Number.isFinite(value) ? value : fallback;
}

function readConfig(): RouteConfig {
  if (typeof window === "undefined") {
    return {
      copyHidden: true,
      latitudeDeg: DEFAULT_LUBIRTH_LOCATION.latitudeDeg,
      longitudeDeg: DEFAULT_LUBIRTH_LOCATION.longitudeDeg,
      progress: 0,
      quality: "auto"
    };
  }

  const params = new URLSearchParams(window.location.search);
  const quality = params.get("quality");
  return {
    copyHidden: params.get("copy") !== "visible",
    latitudeDeg: clamp(
      finiteQueryNumber(params, "geoLat", DEFAULT_LUBIRTH_LOCATION.latitudeDeg),
      -90,
      90
    ),
    longitudeDeg: clamp(
      finiteQueryNumber(params, "geoLon", DEFAULT_LUBIRTH_LOCATION.longitudeDeg),
      -180,
      180
    ),
    progress: clamp(finiteQueryNumber(params, "progress", 0), 0, 1),
    quality:
      quality === "high" || quality === "medium" || quality === "low"
        ? quality
        : "auto"
  };
}

function normalizeLongitudeDelta(longitudeDeg: number) {
  let delta = longitudeDeg - DEFAULT_LUBIRTH_LOCATION.longitudeDeg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

export function normalizePreludeComposition(latitudeDeg: number, longitudeDeg: number) {
  return {
    x: clamp(normalizeLongitudeDelta(longitudeDeg) / 180, -1, 1),
    y: clamp((latitudeDeg - DEFAULT_LUBIRTH_LOCATION.latitudeDeg) / 90, -1, 1),
    scale: 1
  };
}

function selectTier(): CinematicPreludeTier {
  if (typeof window === "undefined") return "desktop";
  return Math.min(window.innerWidth, window.innerHeight) < 760 ? "mobile" : "desktop";
}

function readReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function armStatus(snapshot: PreludeSnapshot): LuBirthCinematicPreludeTelemetry["armStatus"] {
  if (!snapshot.fallbackReason && snapshot.renderedFrame !== null) return "ready";
  if (snapshot.fallbackReason === "late-first-frame") return "late";
  if (snapshot.fallbackReason === "reduced-motion") return "skipped";
  return "failed";
}

function motionReducer(_state: MotionState, nextProgress: number): MotionState {
  const progress = clamp(nextProgress, 0, 1);
  return {
    direction: progress < _state.progress ? "reverse" : "forward",
    progress
  };
}

export function LuBirthCinematicPreludeRoute() {
  const [config] = useState<RouteConfig>(() => readConfig());
  const [tier] = useState<CinematicPreludeTier>(() => selectTier());
  const [reducedMotion] = useState(() => readReducedMotion());
  const [motion, setProgress] = useReducer(motionReducer, {
    direction: "forward",
    progress: config.progress
  });
  const normalizedComposition = useMemo(
    () => normalizePreludeComposition(config.latitudeDeg, config.longitudeDeg),
    [config.latitudeDeg, config.longitudeDeg]
  );

  useLayoutEffect(() => {
    window.__MiraLithOpeningProgress = motion.progress;
    window.__MiraLithSetCinematicPreludeProgress = setProgress;
    return () => {
      delete window.__MiraLithSetCinematicPreludeProgress;
    };
  }, [motion.progress]);

  const publishSnapshot = useCallback(
    (snapshot: PreludeSnapshot) => {
      const variant = manifest.variants[tier];
      window.__MiraLithLuBirthCinematicPrelude = {
        source: snapshot.source,
        state: snapshot.state,
        progress: snapshot.progress,
        normalizedComposition,
        selectedTier: tier,
        armStatus: armStatus(snapshot),
        requestedFrame: snapshot.requestedFrame,
        renderedFrame: snapshot.renderedFrame,
        veilOpacity: snapshot.veilOpacity,
        fallbackReason: snapshot.fallbackReason,
        locationMode: "normalized-ip-composition",
        manifestId: manifest.id,
        manifestSha256: variant.sha256
      };
    },
    [normalizedComposition, tier]
  );

  return (
    <main
      className={styles.route}
      data-cinematic-prelude-route
      data-copy={config.copyHidden ? "hidden" : "visible"}
      data-progress={motion.progress}
      data-tier={tier}
    >
      <section className={styles.stage} aria-label="LuBirth cinematic opening validation">
        <LuBirthCinematicPreludeStack
          composition={normalizedComposition}
          direction={motion.direction}
          manifest={manifest}
          onSnapshot={publishSnapshot}
          progress={motion.progress}
          reducedMotion={reducedMotion}
          tier={tier}
        >
          <VisualCanvas
            decorative
            dpr={config.quality === "high" ? [1.4, 1.8] : [1, 1.35]}
            fallback={
              <VisualCanvasFallback
                scene="lubirth"
                label="LuBirth Relief-lite fallback"
                posterSrc="/assets/lubirth/poster-field.webp"
              />
            }
          >
            <LuBirthSceneSlot
              atmosphereLook="lubirth"
              atmospherePolicy="stack"
              atmosphereVariant="stack"
              cloudDeckEnabled
              homeIntroRendering
              mode="field"
              paused
              productionSurface
              quality={config.quality}
              renderProfile="nasa"
              routeVariant="home"
              visualPolicyOverrides={RELIEF_LITE_POLICY}
            />
          </VisualCanvas>
        </LuBirthCinematicPreludeStack>
      </section>

      {!config.copyHidden ? (
        <p className={styles.hud} aria-hidden="true">
          <span>Cinematic prelude</span>
          <span>{tier}</span>
          <span>{motion.progress.toFixed(3)}</span>
        </p>
      ) : null}
    </main>
  );
}
