"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState
} from "react";
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
import {
  DeterministicTestFrameProvider,
  isCinematicPreludeTestMode,
  type CinematicPreludeTestMode
} from "./lubirth-cinematic-prelude/testFrameProvider";
import type {
  PreludeDirection,
  PreludeFallbackReason,
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
  testMode: CinematicPreludeTestMode | null;
}

export interface CinematicPreludeRouteSearchParams {
  copy?: string | string[];
  geoLat?: string | string[];
  geoLon?: string | string[];
  preludeTest?: string | string[];
  progress?: string | string[];
  quality?: string | string[];
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
  sourceCutCount: number;
  presentationResourcesReleased: boolean;
  locationMode: "normalized-ip-composition";
  manifestId: string;
  manifestSha256: string;
}

declare global {
  interface Window {
    __MiraLithOpeningProgress?: number;
    __MiraLithSetCinematicPreludeProgress?: (progress: number) => void;
    __MiraLithTriggerCinematicPreludeLowMemory?: () => void;
    __MiraLithLuBirthCinematicPrelude?: LuBirthCinematicPreludeTelemetry;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function firstParameter(parameter: string | string[] | undefined) {
  return Array.isArray(parameter) ? parameter[0] : parameter;
}

function finiteQueryNumber(parameter: string | string[] | undefined, fallback: number) {
  const valueString = firstParameter(parameter);
  if (valueString === undefined || valueString.trim() === "") return fallback;
  const value = Number(valueString);
  return Number.isFinite(value) ? value : fallback;
}

function readConfig(params: CinematicPreludeRouteSearchParams): RouteConfig {
  const quality = firstParameter(params.quality);
  const testMode = firstParameter(params.preludeTest) ?? null;
  return {
    copyHidden: firstParameter(params.copy) !== "visible",
    latitudeDeg: clamp(
      finiteQueryNumber(params.geoLat, DEFAULT_LUBIRTH_LOCATION.latitudeDeg),
      -90,
      90
    ),
    longitudeDeg: clamp(
      finiteQueryNumber(params.geoLon, DEFAULT_LUBIRTH_LOCATION.longitudeDeg),
      -180,
      180
    ),
    progress: clamp(finiteQueryNumber(params.progress, 0), 0, 1),
    quality:
      quality === "high" || quality === "medium" || quality === "low"
        ? quality
        : "auto",
    testMode: isCinematicPreludeTestMode(testMode) ? testMode : null
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

export function LuBirthCinematicPreludeRoute({
  initialSearchParams = {}
}: {
  initialSearchParams?: CinematicPreludeRouteSearchParams;
}) {
  const config = useMemo(() => readConfig(initialSearchParams), [initialSearchParams]);
  const [tier, setTier] = useState<CinematicPreludeTier>("desktop");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [forcedFallbackReason, setForcedFallbackReason] =
    useState<PreludeFallbackReason | null>(null);
  const [motion, setProgress] = useReducer(motionReducer, {
    direction: "forward",
    progress: config.progress
  });
  const normalizedComposition = useMemo(
    () => normalizePreludeComposition(config.latitudeDeg, config.longitudeDeg),
    [config.latitudeDeg, config.longitudeDeg]
  );
  const providerFactory = useMemo(() => {
    if (!config.testMode) return undefined;
    return ({
      manifestId,
      variant
    }: {
      video: HTMLVideoElement;
      variant: (typeof manifest.variants)[CinematicPreludeTier];
      manifestId: string;
    }) =>
      new DeterministicTestFrameProvider({
        manifestId,
        mode: config.testMode as CinematicPreludeTestMode,
        variant
      });
  }, [config.testMode]);

  useEffect(() => {
    const updateTier = () => setTier(selectTier());
    updateTier();
    window.addEventListener("resize", updateTier);
    return () => window.removeEventListener("resize", updateTier);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches);
    updateReducedMotion();
    mediaQuery.addEventListener("change", updateReducedMotion);
    return () => mediaQuery.removeEventListener("change", updateReducedMotion);
  }, []);

  useLayoutEffect(() => {
    window.__MiraLithOpeningProgress = motion.progress;
    window.__MiraLithSetCinematicPreludeProgress = setProgress;
    window.__MiraLithTriggerCinematicPreludeLowMemory = () =>
      setForcedFallbackReason("low-memory");
    return () => {
      delete window.__MiraLithSetCinematicPreludeProgress;
      delete window.__MiraLithTriggerCinematicPreludeLowMemory;
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
        sourceCutCount: snapshot.sourceCutCount,
        presentationResourcesReleased: snapshot.presentationResourcesReleased,
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
          forcedFallbackReason={forcedFallbackReason}
          manifest={manifest}
          onSnapshot={publishSnapshot}
          progress={motion.progress}
          providerFactory={providerFactory}
          reducedMotion={reducedMotion || config.testMode === "reduced-motion"}
          tier={tier}
        >
          <VisualCanvas
            decorative
            dpr={config.quality === "high" ? [1.4, 1.8] : [1, 1.35]}
            onFallback={() => setForcedFallbackReason("rendering-fallback")}
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
