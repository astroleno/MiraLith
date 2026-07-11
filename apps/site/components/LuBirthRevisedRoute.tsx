"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type {
  LandingAtmospherePolicy,
  LandingRenderProfile,
  LandingVisualDebugLayer,
  LuBirthProjectionFrame
} from "@miralith/lubirth-hero";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

declare global {
  interface Window {
    __MiraLithCanvasCreatedAt?: number;
    __MiraLithOpeningProgress?: number;
    __MiraLithFirstUsableAt?: number;
    __MiraLithHomeIntroCompleteAt?: number;
    __MiraLithHomeLoadingReadyAt?: number;
    __MiraLithHomeLoadingReadySource?: ReadyHomeProjectionSource;
    __MiraLithHomeMemoryImageReadyAt?: number;
    __MiraLithHomeMoonTextureReadyAt?: number;
    __MiraLithHomeVisualReadyAt?: number;
    __MiraLithHomeVisualReadySource?: HomeVisualReadySource;
    __MiraLithHomeProjectionFrame?: LuBirthProjectionFrame;
  }
}

const SCROLL_TRIGGER_ID_PREFIX = "miralith-lubirth-opening";
const LUBIRTH_PROJECT_INTRO_ANCHOR_ID = "lubirth-project-intro-anchor";
const HOME_PROJECTION_FALLBACK_DEADLINE_MS = 900;
const HOME_VISUAL_GRACE_DEADLINE_MS = 700;
const HOME_LOADING_SCROLL_DELAY_MS = 3900;
const HOME_LOADING_HARD_COMPLETE_DEADLINE_MS = 4550;
const HOME_LOADING_MIN_COMPLETE_AFTER_READY_MS = 3000;
const HOME_PROJECT_ACCESS_PROGRESS = 0.34;
const HOME_RAIL_ACCESS_PROGRESS = 0.52;

type HomeProjectionSource = "pending" | "scene" | "fallback";
type ReadyHomeProjectionSource = Exclude<HomeProjectionSource, "pending">;
type HomeVisualReadySource = "day-texture" | "grace";

type LuBirthRevisedRouteVariant = "home" | "study";

interface ScreenshotDebugOptions {
  atmospherePolicy: LandingAtmospherePolicy;
  fixedProgress: number | null;
  copyHidden: boolean;
  visualPixelMode: boolean;
  rafPerfMode: boolean;
  visualDebugLayer: LandingVisualDebugLayer;
  renderProfile: LandingRenderProfile;
}

interface LuBirthRevisedRouteProps {
  variant?: LuBirthRevisedRouteVariant;
  ariaLabel?: string;
  stageLabel?: string;
}

const DEFAULT_SCREENSHOT_DEBUG_OPTIONS: ScreenshotDebugOptions = {
  atmospherePolicy: "stack",
  fixedProgress: null,
  copyHidden: false,
  visualPixelMode: false,
  rafPerfMode: false,
  visualDebugLayer: "all",
  renderProfile: "nasa"
};

const copy = {
  loading: {
    titleZh: "我只在创造中找到自己",
    titleEn: "Only in creation I found myself",
    triadZh: "出生 / 照护 / 念持",
    triadEn: "Birth / Care / Devotion",
    enterZh: "向下进入",
    enterEn: "Scroll to enter"
  },
  site: {
    title: "MiraLith",
    zh: "把看见之物，刻成作品",
    en: "A personal field of vision, intelligence, and form"
  },
  lubirth: {
    index: "01",
    eyebrowZh: "来处",
    eyebrowEn: "Arrival",
    title: "LuBirth",
    shortZh: "地月人",
    introEn: "A cosmological interface for birth, time, and self-recognition",
    subtitleZh: "我出生那一刻的地球与月相合影",
    subtitleEn: "A portrait of the Earth and Moon at the hour of my birth",
    bodyZh: "LuBirth 将出生理解为天地人与个体此在的一次相遇。它不是天文图像，而是一份关于来处的见证。",
    bodyEn:
      "LuBirth imagines birth as an alignment of heaven, earth, and human presence. It is not an astronomical diagram, but a witness of arrival."
  }
};

const chapters = [
  {
    index: "01",
    targetId: LUBIRTH_PROJECT_INTRO_ANCHOR_ID,
    title: "LuBirth",
    zh: "出生时刻的地月合影",
    en: "Birth-Time Earth-Moon Portrait",
    active: true
  },
  {
    index: "02",
    title: "Radio Gaga",
    zh: "照护",
    en: "Care",
    active: false
  },
  {
    index: "03",
    title: "CoScroll",
    zh: "赛博转经筒",
    en: "Devotion",
    active: false
  },
  {
    index: "04",
    title: "ArtBreeze",
    zh: "艺息",
    en: "Art Flow",
    active: false
  },
  {
    index: "05",
    title: "Floating Constellation",
    zh: "群星项目",
    en: "Project Field",
    active: false
  },
  {
    index: "06",
    title: "Client Works",
    zh: "商业作品",
    en: "Commissioned Systems",
    active: false
  },
  {
    index: "07",
    title: "Now Building",
    zh: "主业与关于",
    en: "Work / About",
    active: false
  }
] as const;

type Chapter = (typeof chapters)[number];

const activeChapter = chapters.find((chapter) => chapter.active) ?? chapters[0];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function setOpeningProgress(progress: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.__MiraLithOpeningProgress = clamp01(progress);
}

function readScreenshotDebugOptions(defaultCopyHidden = false): ScreenshotDebugOptions {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SCREENSHOT_DEBUG_OPTIONS, copyHidden: defaultCopyHidden };
  }

  const params = new URLSearchParams(window.location.search);
  const copyMode = params.get("copy");
  const visualPixelMode = params.get("visualTest") === "pixels";
  const rafPerfMode = params.get("perfTest") === "raf";
  const progressParam = params.get("progress");
  const parsedProgress = progressParam === null ? Number.NaN : Number.parseFloat(progressParam);
  const policyParam = visualPixelMode || rafPerfMode ? params.get("atmoPolicy") : null;
  const atmospherePolicy: LandingAtmospherePolicy =
    policyParam === "volumetric" || policyParam === "hybrid" || policyParam === "stack"
      ? policyParam
      : "stack";
  const debugParam = params.get("debug");
  const visualDebugLayer: LandingVisualDebugLayer =
    debugParam === "stars" ||
    debugParam === "clouds" ||
    debugParam === "atmosphere" ||
    debugParam === "aurora" ||
    debugParam === "all"
      ? debugParam
      : "all";
  const profileParam = params.get("profile");
  const profileFromQuery: LandingRenderProfile | undefined =
    profileParam === "clean" ||
    profileParam === "nasa" ||
    profileParam === "debug-stars" ||
    profileParam === "debug-clouds" ||
    profileParam === "debug-atmosphere" ||
    profileParam === "debug-aurora"
      ? profileParam
      : undefined;
  const profileFromDebug: LandingRenderProfile =
    visualDebugLayer === "stars"
      ? "debug-stars"
      : visualDebugLayer === "clouds"
        ? "debug-clouds"
        : visualDebugLayer === "atmosphere"
          ? "debug-atmosphere"
          : visualDebugLayer === "aurora"
            ? "debug-aurora"
            : "nasa";

  return {
    atmospherePolicy,
    fixedProgress: Number.isFinite(parsedProgress) ? clamp01(parsedProgress) : null,
    copyHidden: copyMode === "visible"
      ? false
      : defaultCopyHidden || copyMode === "hidden" || ((visualPixelMode || rafPerfMode) && copyMode !== "visible"),
    visualPixelMode,
    rafPerfMode,
    visualDebugLayer,
    renderProfile: profileFromQuery ?? profileFromDebug
  };
}

function LoadingOverlay() {
  return (
    <section className="lubirth-revised__loading" aria-label="Opening statement">
      <div className="lubirth-revised__loading-vignette" aria-hidden="true" />
      <div className="lubirth-revised__loading-orbit" aria-hidden="true" />
      <div className="lubirth-revised__loading-dot" aria-hidden="true" />

      <div className="lubirth-revised__loading-copy">
        <p className="lubirth-revised__loading-line lubirth-revised__loading-title">
          {copy.loading.titleZh}
        </p>
        <p className="lubirth-revised__loading-line lubirth-revised__loading-subtitle">
          {copy.loading.titleEn}
        </p>
        <div className="lubirth-revised__loading-line lubirth-revised__loading-triad">
          <p>{copy.loading.triadZh}</p>
          <p>{copy.loading.triadEn}</p>
        </div>
        <div className="lubirth-revised__loading-line lubirth-revised__loading-enter">
          <span>{copy.loading.enterZh}</span>
          <span>{copy.loading.enterEn}</span>
        </div>
      </div>
    </section>
  );
}

function HomeLoadingOverlay({
  projection,
  projectionSource,
  introComplete,
  onMemoryImageReady
}: {
  projection: LuBirthProjectionFrame | null;
  projectionSource: HomeProjectionSource;
  introComplete: boolean;
  onMemoryImageReady: () => void;
}) {
  const visibleProjectionSource =
    projectionSource === "scene" && projection ? "scene" : projectionSource === "fallback" ? "fallback" : "pending";
  const contourViewBox = projection ? `0 0 ${projection.width} ${projection.height}` : "0 0 1200 800";
  const contourPath = projection?.earthHorizonPath ?? "M -60 570 Q 600 390 1260 570";
  const moonOutlineSize = projection ? projection.moon.radius * 2 * (120 / 104) : null;
  const moonStyle = projection
    ? {
        left: `${projection.moon.x}px`,
        top: `${projection.moon.y}px`,
        width: `${moonOutlineSize}px`
      }
    : undefined;

  return (
    <section
      className="lubirth-revised__home-loading"
      data-projection={visibleProjectionSource}
      aria-label={visibleProjectionSource === "pending" ? "MiraLith opening loading" : "MiraLith opening status"}
      aria-hidden={introComplete ? "true" : undefined}
    >
      <p className="sr-only">
        {visibleProjectionSource === "pending"
          ? "MiraLith opening is loading."
          : "MiraLith opening is ready. Scroll, press Enter, or press Space to enter."}
      </p>
      <div className="lubirth-revised__home-loading-curtain" aria-hidden="true" />
      <div className="lubirth-revised__home-loading-prelude" aria-hidden="true">
        <div className="lubirth-revised__home-loading-prelude-track">
          <span />
        </div>
        <p className="lubirth-revised__home-loading-prelude-title">{copy.site.title}</p>
        <p className="lubirth-revised__home-loading-prelude-status">{copy.site.zh}</p>
      </div>
      <svg
        className="lubirth-revised__home-loading-moon"
        viewBox="0 0 120 120"
        focusable="false"
        aria-hidden="true"
        style={moonStyle}
      >
        <circle
          className="lubirth-revised__home-loading-moon-path lubirth-revised__home-loading-moon-path--draw"
          cx="60"
          cy="60"
          r="52"
          pathLength={1}
          transform="rotate(-90 60 60)"
        />
      </svg>

      <svg className="lubirth-revised__home-loading-contour" viewBox={contourViewBox} focusable="false" aria-hidden="true">
        <path
          className="lubirth-revised__home-loading-contour-path lubirth-revised__home-loading-contour-path--aura"
          pathLength={1}
          d={contourPath}
        />
        <path
          className="lubirth-revised__home-loading-contour-path lubirth-revised__home-loading-contour-path--line"
          pathLength={1}
          d={contourPath}
        />
        <path
          className="lubirth-revised__home-loading-contour-path lubirth-revised__home-loading-contour-path--segment lubirth-revised__home-loading-contour-path--segment-left"
          pathLength={1}
          d={contourPath}
        />
        <path
          className="lubirth-revised__home-loading-contour-path lubirth-revised__home-loading-contour-path--segment lubirth-revised__home-loading-contour-path--segment-right"
          pathLength={1}
          d={contourPath}
        />
      </svg>

      <div className="lubirth-revised__home-loading-memory" aria-hidden="true">
        <Image
          src="/img/mainPerosna.png"
          alt=""
          width={1280}
          height={720}
          priority
          quality={70}
          sizes="100vw"
          decoding="async"
          onLoad={onMemoryImageReady}
          onError={onMemoryImageReady}
        />
      </div>

      <div className="lubirth-revised__home-loading-mark">
        <p className="lubirth-revised__home-loading-title">{copy.site.title}</p>
        <p className="lubirth-revised__home-loading-subtitle">{copy.site.zh}</p>
      </div>

      <div className="lubirth-revised__home-loading-hint">
        <div />
        <div>
          <span>{copy.loading.enterZh}</span>
          <span>Scroll</span>
        </div>
      </div>
    </section>
  );
}

function AtmosphereOverlay() {
  return (
    <div className="lubirth-revised__atmosphere" aria-hidden="true">
      <div className="lubirth-revised__focus-vignette" />
      <div className="lubirth-revised__readability-wash" />
      <div className="lubirth-revised__bottom-wash" />
      <div className="lubirth-revised__star lubirth-revised__star--a" />
      <div className="lubirth-revised__star lubirth-revised__star--b" />
      <div className="lubirth-revised__star lubirth-revised__star--c" />
    </div>
  );
}

function WorldMark() {
  return (
    <header className="lubirth-revised__world-mark" aria-label="MiraLith">
      <p>{copy.site.title}</p>
      <p>{copy.site.zh}</p>
      <p>{copy.site.en}</p>
    </header>
  );
}

function HomeSignature() {
  return (
    <header className="lubirth-revised__home-signature" aria-label="MiraLith site identity">
      <p>{copy.site.title}</p>
      <p>{copy.site.zh}</p>
    </header>
  );
}

function TravellingTitle() {
  return (
    <section className="lubirth-revised__travelling-title" aria-labelledby="lubirth-opening-title">
      <h1 id="lubirth-opening-title">{copy.lubirth.title}</h1>
      <p>{copy.lubirth.shortZh}</p>
    </section>
  );
}

function HeroText() {
  return (
    <article className="lubirth-revised__hero-copy" aria-labelledby="lubirth-revised-title">
      <div className="lubirth-revised__eyebrow">
        <span>{copy.lubirth.index}</span>
        <span aria-hidden="true" />
        <span>{copy.lubirth.eyebrowZh}</span>
        <span>{copy.lubirth.eyebrowEn}</span>
      </div>

      <h1 id="lubirth-revised-title" className="lubirth-revised__main-title">
        {copy.lubirth.title}
      </h1>

      <div className="lubirth-revised__details">
        <p className="lubirth-revised__subtitle-zh">{copy.lubirth.subtitleZh}</p>
        <p className="lubirth-revised__subtitle-en">{copy.lubirth.subtitleEn}</p>
        <div className="lubirth-revised__body">
          <p>{copy.lubirth.bodyZh}</p>
          <p>{copy.lubirth.bodyEn}</p>
        </div>
      </div>
    </article>
  );
}

function ProjectIntro({ interactive = true }: { interactive?: boolean }) {
  return (
    <article
      className="lubirth-revised__project-intro"
      aria-labelledby="lubirth-project-intro-title"
      aria-hidden={interactive ? undefined : "true"}
      inert={interactive ? undefined : true}
    >
      <span id={LUBIRTH_PROJECT_INTRO_ANCHOR_ID} className="lubirth-revised__project-anchor" aria-hidden="true" />
      <p className="lubirth-revised__project-kicker">
        {copy.lubirth.index} / {copy.lubirth.eyebrowZh} / {copy.lubirth.eyebrowEn}
      </p>
      <h2 id="lubirth-project-intro-title">
        {copy.lubirth.title} {copy.lubirth.shortZh}
      </h2>
      <p className="lubirth-revised__project-subtitle">{copy.lubirth.introEn}.</p>
      <div className="lubirth-revised__project-body">
        <p>{copy.lubirth.subtitleZh}</p>
        <p>{copy.lubirth.bodyZh}</p>
        <p>{copy.lubirth.bodyEn}</p>
      </div>
    </article>
  );
}

function TitleRail({ activeChapter, interactive }: { activeChapter: Chapter; interactive: boolean }) {
  return (
    <nav
      className="lubirth-revised__title-rail"
      aria-label="MiraLith chapters"
      aria-hidden={interactive ? undefined : "true"}
      inert={interactive ? undefined : true}
    >
      <ol>
        {chapters.map((chapter) => {
          const isActive = chapter.index === activeChapter.index;

          const titleContent = isActive ? (
            <span className="lubirth-revised__rail-title-anchor" aria-hidden="true">
              <span className="lubirth-revised__rail-title-placeholder">{chapter.title}</span>
            </span>
          ) : (
            <span className="lubirth-revised__rail-title">{chapter.title}</span>
          );

          const linkContent = (
            <>
              <span className="lubirth-revised__rail-index">{chapter.index}</span>
              <span className="lubirth-revised__rail-copy">
                {titleContent}
                <span className="lubirth-revised__rail-meta">
                  {chapter.zh} / <span>{chapter.en}</span>
                </span>
              </span>
            </>
          );

          return (
            <li key={chapter.index} data-active={isActive ? "true" : "false"}>
              {isActive ? (
                <a
                  className="lubirth-revised__rail-link"
                  href={`#${LUBIRTH_PROJECT_INTRO_ANCHOR_ID}`}
                  aria-current="page"
                  aria-label={`${chapter.index} ${chapter.title} ${chapter.zh}`}
                  tabIndex={interactive ? undefined : -1}
                >
                  {linkContent}
                </a>
              ) : (
                <span
                  className="lubirth-revised__rail-link"
                  aria-disabled="true"
                  tabIndex={-1}
                >
                  {linkContent}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MobileTitleBar({ activeChapter, interactive }: { activeChapter: Chapter; interactive: boolean }) {
  return (
    <nav
      className="lubirth-revised__mobile-title-bar"
      aria-label="Current MiraLith chapter"
      aria-hidden={interactive ? undefined : "true"}
      inert={interactive ? undefined : true}
    >
      <a href={`#${LUBIRTH_PROJECT_INTRO_ANCHOR_ID}`} aria-current="page" tabIndex={interactive ? undefined : -1}>
        <span className="lubirth-revised__mobile-title-main">
          <span>{activeChapter.index}</span>
          <span className="lubirth-revised__mobile-title-anchor" aria-hidden="true">
            <span className="lubirth-revised__mobile-title-placeholder">{activeChapter.title}</span>
          </span>
        </span>
        <span className="lubirth-revised__mobile-title-label">{activeChapter.zh}</span>
      </a>
    </nav>
  );
}

function ScrollHint() {
  return (
    <div className="lubirth-revised__scroll-hint" aria-hidden="true">
      <div />
      <div>
        <span>{copy.loading.enterZh}</span>
        <span>Scroll</span>
      </div>
    </div>
  );
}

export function LuBirthRevisedRoute({
  variant = "study",
  ariaLabel,
  stageLabel
}: LuBirthRevisedRouteProps) {
  const rootRef = useRef<HTMLElement>(null);
  const isHome = variant === "home";
  const triggerId = `${SCROLL_TRIGGER_ID_PREFIX}-${variant}`;
  const [sceneEnabled, setSceneEnabled] = useState(() => variant === "home");
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [copyInteractive, setCopyInteractive] = useState(false);
  const [projectInteractive, setProjectInteractive] = useState(() => variant !== "home");
  const [homeIntroComplete, setHomeIntroComplete] = useState(() => variant !== "home");
  const [homeProjection, setHomeProjection] = useState<LuBirthProjectionFrame | null>(null);
  const [homeProjectionSource, setHomeProjectionSource] = useState<HomeProjectionSource>("pending");
  const [homeVisualReadySource, setHomeVisualReadySource] = useState<HomeVisualReadySource | "pending">("pending");
  const [homeSkipReady, setHomeSkipReady] = useState(() => variant !== "home");
  const [debugOptions, setDebugOptions] = useState<ScreenshotDebugOptions>(() => ({
    ...DEFAULT_SCREENSHOT_DEBUG_OPTIONS,
    copyHidden: variant !== "home"
  }));
  const [debugOptionsReady, setDebugOptionsReady] = useState(false);
  const homeProjectionSourceRef = useRef<HomeProjectionSource>("pending");
  const homeVisualReadySourceRef = useRef<HomeVisualReadySource | "pending">("pending");
  const homeDayTextureReadyRef = useRef(false);
  const homeMemoryImageReadyRef = useRef(false);
  const homeMoonTextureReadyRef = useRef(false);
  const homeReadinessHandlersRef = useRef(new Set<(source: ReadyHomeProjectionSource) => void>());
  const homeVisualReadinessHandlersRef = useRef(new Set<(source: HomeVisualReadySource) => void>());
  const homeReadinessDispatchedRef = useRef(false);
  const homeVisualReadinessDispatchedRef = useRef(false);
  const showCopy = !debugOptions.copyHidden;
  const isScreenshotMode = debugOptions.fixedProgress !== null;
  const homeIntroRendering = isHome && !homeIntroComplete && !isScreenshotMode;
  const homeLoadingReady = homeProjectionSource !== "pending";
  const homeLoadingProjection = homeProjection;
  const homeLoadingProjectionSource =
    homeProjection ? "scene" : homeProjectionSource;
  const homeVisualReady = homeVisualReadySource !== "pending";
  const markHomeLoadingReady = useCallback((source: ReadyHomeProjectionSource) => {
    if (!isHome || homeProjectionSourceRef.current !== "pending") {
      return;
    }

    homeProjectionSourceRef.current = source;
    setHomeProjectionSource(source);

    if (typeof window !== "undefined") {
      window.__MiraLithHomeLoadingReadyAt = performance.now();
      window.__MiraLithHomeLoadingReadySource = source;
    }
    homeReadinessDispatchedRef.current = true;
    homeReadinessHandlersRef.current.forEach((handler) => handler(source));
  }, [isHome]);
  const markHomeVisualReady = useCallback((source: HomeVisualReadySource) => {
    if (!isHome || homeVisualReadySourceRef.current !== "pending") {
      return;
    }

    homeVisualReadySourceRef.current = source;
    setHomeVisualReadySource(source);

    if (typeof window !== "undefined") {
      window.__MiraLithHomeVisualReadyAt = performance.now();
      window.__MiraLithHomeVisualReadySource = source;
    }
    homeVisualReadinessDispatchedRef.current = true;
    homeVisualReadinessHandlersRef.current.forEach((handler) => handler(source));
  }, [isHome]);
  const markHomeVisualAssetReady = useCallback((asset: "day-texture" | "memory-image" | "moon-texture") => {
    if (!isHome) {
      return;
    }

    if (asset === "day-texture") {
      homeDayTextureReadyRef.current = true;
    } else if (asset === "memory-image") {
      homeMemoryImageReadyRef.current = true;
      if (typeof window !== "undefined" && !window.__MiraLithHomeMemoryImageReadyAt) {
        window.__MiraLithHomeMemoryImageReadyAt = performance.now();
      }
    } else {
      homeMoonTextureReadyRef.current = true;
      if (typeof window !== "undefined" && !window.__MiraLithHomeMoonTextureReadyAt) {
        window.__MiraLithHomeMoonTextureReadyAt = performance.now();
      }
    }

    if (homeVisualReadySourceRef.current !== "pending") {
      return;
    }

    if (homeDayTextureReadyRef.current && homeMemoryImageReadyRef.current && homeMoonTextureReadyRef.current) {
      markHomeVisualReady("day-texture");
    }
  }, [isHome, markHomeVisualReady]);
  const handleProjectionFrame = useCallback((frame: LuBirthProjectionFrame) => {
    if (typeof window !== "undefined") {
      window.__MiraLithHomeProjectionFrame = frame;
    }

    setHomeProjection((current) => {
      if (
        current &&
        current.width === frame.width &&
        current.height === frame.height &&
        current.earthHorizonPath === frame.earthHorizonPath &&
        current.moon.x === frame.moon.x &&
        current.moon.y === frame.moon.y &&
        current.moon.radius === frame.moon.radius
      ) {
        return current;
      }

      return frame;
    });
    markHomeLoadingReady("scene");
  }, [markHomeLoadingReady]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) {
        return;
      }

      setDebugOptions(readScreenshotDebugOptions(!isHome));
      setDebugOptionsReady(true);
    });

    return () => {
      active = false;
    };
  }, [isHome]);

  useEffect(() => {
    if (!isHome || homeProjectionSource === "pending" || homeReadinessDispatchedRef.current) {
      return;
    }

    homeReadinessDispatchedRef.current = true;
    homeReadinessHandlersRef.current.forEach((handler) => handler(homeProjectionSource));
  }, [homeLoadingReady, homeProjectionSource, isHome]);

  useEffect(() => {
    if (!isHome || homeVisualReadySource === "pending" || homeVisualReadinessDispatchedRef.current) {
      return;
    }

    homeVisualReadinessDispatchedRef.current = true;
    homeVisualReadinessHandlersRef.current.forEach((handler) => handler(homeVisualReadySource));
  }, [homeVisualReady, homeVisualReadySource, isHome]);

  useEffect(() => {
    if (!debugOptionsReady) {
      return;
    }

    let disposed = false;
    let cleanupAnimations: (() => void) | undefined;
    let cleanupHomeReadyHandler: (() => void) | undefined;
    let restoreHomeScrollLock: (() => void) | undefined;
    void (async () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);

      if (disposed || !rootRef.current) {
        return;
      }

      const rootElement = rootRef.current;
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const forcedFallback = new URLSearchParams(window.location.search).get("visual") === "fallback";
      const screenshotDebug = debugOptions;
      setRuntimeReady(true);
      setCopyInteractive(false);
      setProjectInteractive(!isHome);
      setHomeIntroComplete(!isHome);

      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.getById(triggerId)?.kill();
      setOpeningProgress(screenshotDebug.fixedProgress ?? 0);
      rootElement.dataset.motion = screenshotDebug.fixedProgress === null
        ? prefersReduced ? "reduced" : "full"
        : "debug";
      rootElement.dataset.variant = variant;
      rootElement.dataset.debugLayer = screenshotDebug.visualDebugLayer;
      rootElement.dataset.renderProfile = screenshotDebug.renderProfile;
      if (
        forcedFallback ||
        isHome ||
        screenshotDebug.copyHidden ||
        screenshotDebug.visualPixelMode ||
        screenshotDebug.rafPerfMode
      ) {
        setSceneEnabled(true);
      }

      const selector = gsap.utils.selector(rootElement);
      let loadTimeline: ReturnType<typeof gsap.timeline> | undefined;
      let scrollTimeline: ReturnType<typeof gsap.timeline> | undefined;
      const homeLoadTimeouts: number[] = [];

      const context = gsap.context(() => {
        const stage = selector(".lubirth-revised__stage")[0] as HTMLElement | undefined;
        const setIfPresent = (query: string, vars: Parameters<typeof gsap.set>[1]) => {
          const targets = selector(query);
          if (targets.length > 0) {
            gsap.set(targets, vars);
          }
        };

        const getOpeningTitleTarget = () => {
          const sourceContainer = selector(".lubirth-revised__travelling-title")[0] as HTMLElement | undefined;
          const sourceTitle = selector(".lubirth-revised__travelling-title h1")[0] as HTMLElement | undefined;
          const titleRail = selector(".lubirth-revised__title-rail")[0] as HTMLElement | undefined;
          const desktopActiveItem = selector(".lubirth-revised__title-rail li[data-active='true']")[0] as
            | HTMLElement
            | undefined;
          const desktopTitle = selector(
            ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-title-anchor"
          )[0] as HTMLElement | undefined;
          const mobileTitleBar = selector(".lubirth-revised__mobile-title-bar")[0] as HTMLElement | undefined;
          const mobileTitle = selector(".lubirth-revised__mobile-title-anchor")[0] as HTMLElement | undefined;
          const canUseRail = window.innerWidth >= 768 && desktopTitle;
          const targetTitle = canUseRail ? desktopTitle : mobileTitle;
          const targetBounds = targetTitle?.getBoundingClientRect();
          const stageBounds = stage?.getBoundingClientRect();
          const sourceFontSize = sourceTitle ? Number.parseFloat(window.getComputedStyle(sourceTitle).fontSize) : 96;
          const targetFontSize = targetTitle ? Number.parseFloat(window.getComputedStyle(targetTitle).fontSize) : 24;
          const targetItemOffsetX = canUseRail && desktopActiveItem
            ? Number(gsap.getProperty(desktopActiveItem, "x"))
            : 0;
          const targetItemOffsetY = canUseRail && desktopActiveItem
            ? Number(gsap.getProperty(desktopActiveItem, "y"))
            : 0;
          const targetRailOffsetY = canUseRail && titleRail ? Number(gsap.getProperty(titleRail, "y")) : 0;
          const targetOffsetX = targetItemOffsetX;
          const targetOffsetY = canUseRail
            ? targetRailOffsetY + targetItemOffsetY
            : mobileTitleBar ? Number(gsap.getProperty(mobileTitleBar, "y")) : 0;
          const left = targetBounds ? targetBounds.left - targetOffsetX : (canUseRail ? 84 : 52);
          const top = targetBounds ? targetBounds.top - targetOffsetY : (canUseRail ? 86 : 18);
          const baseLeft = sourceContainer?.offsetLeft ?? window.innerWidth * 0.5;
          const baseTop = sourceContainer?.offsetTop ?? window.innerHeight * 0.5;
          const scale = canUseRail
            ? Math.min(0.34, Math.max(0.12, targetFontSize / sourceFontSize))
            : Math.min(0.28, Math.max(0.14, targetFontSize / sourceFontSize));

          return {
            x: left - (stageBounds?.left ?? 0) - baseLeft,
            y: top - (stageBounds?.top ?? 0) - baseTop,
            scale
          };
        };

        setIfPresent(".lubirth-revised__travelling-title", {
          autoAlpha: 0,
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: 0,
          scale: 1,
          transformOrigin: "left top"
        });
        setIfPresent(".lubirth-revised__hero-copy", { autoAlpha: 0, y: 12 });
        setIfPresent(".lubirth-revised__project-intro", { autoAlpha: 0, y: 24 });
        setIfPresent(".lubirth-revised__scroll-hint", { autoAlpha: 0, y: 8 });
        setIfPresent(".lubirth-revised__atmosphere", { autoAlpha: 0 });
        setIfPresent(".lubirth-revised__world-mark", { autoAlpha: 0, y: -8 });
        setIfPresent(".lubirth-revised__title-rail", { autoAlpha: 0, y: isHome ? 18 : 16 });
        if (isHome) {
          setIfPresent(".lubirth-revised__title-rail li", { autoAlpha: 0, x: -14, y: 6 });
          setIfPresent(".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-copy", {
            autoAlpha: 0
          });
          setIfPresent(
            ".lubirth-revised__project-kicker, .lubirth-revised__project-intro h2, .lubirth-revised__project-subtitle, .lubirth-revised__project-body p",
            { autoAlpha: 0, y: 12 }
          );
        }
        setIfPresent(".lubirth-revised__mobile-title-bar", { autoAlpha: 0, y: -12 });
        setIfPresent(".lubirth-revised__loading-line", { y: 10, autoAlpha: 0 });
        setIfPresent(".lubirth-revised__loading-dot", { scale: 0.4, autoAlpha: 0 });
        setIfPresent(".lubirth-revised__loading-orbit", { scale: 0.84, autoAlpha: 0 });

        if (screenshotDebug.fixedProgress !== null) {
          setSceneEnabled(true);
          const homeRailVisible = screenshotDebug.fixedProgress >= HOME_RAIL_ACCESS_PROGRESS;
          const homeProjectVisible = screenshotDebug.fixedProgress >= HOME_PROJECT_ACCESS_PROGRESS;
          setCopyInteractive(!screenshotDebug.copyHidden && (!isHome || homeRailVisible));
          setProjectInteractive(!screenshotDebug.copyHidden && (!isHome || homeProjectVisible));
          setHomeIntroComplete(true);
          setOpeningProgress(screenshotDebug.fixedProgress);
          setIfPresent(".lubirth-revised__loading", { autoAlpha: 0 });
          setIfPresent(".lubirth-revised__home-loading", { autoAlpha: 0 });
          setIfPresent(".lubirth-revised__atmosphere", { autoAlpha: 1 });
          setIfPresent(".lubirth-revised__scroll-hint", { autoAlpha: 0 });
          if (!screenshotDebug.copyHidden) {
            setIfPresent(".lubirth-revised__travelling-title", {
              autoAlpha: isHome ? 1 : 0,
              ...(isHome && homeRailVisible
                ? {
                    x: getOpeningTitleTarget().x,
                    y: getOpeningTitleTarget().y,
                    xPercent: 0,
                    yPercent: 0,
                    scale: getOpeningTitleTarget().scale
                  }
                : {
                    x: 0,
                    y: 0,
                    xPercent: -50,
                    yPercent: -50,
                    scale: 1
                  })
            });
            setIfPresent(".lubirth-revised__hero-copy", { autoAlpha: isHome ? 0 : 1, y: 0, scale: 1 });
            setIfPresent(".lubirth-revised__world-mark", { autoAlpha: isHome ? 0 : 1, y: 0 });
            setIfPresent(".lubirth-revised__title-rail", { autoAlpha: isHome && homeRailVisible ? 1 : 0, y: 0 });
            setIfPresent(".lubirth-revised__title-rail li", { autoAlpha: isHome && homeRailVisible ? 1 : 0, x: 0, y: 0 });
            setIfPresent(".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-copy", {
              autoAlpha: isHome && homeRailVisible ? 1 : 0
            });
            setIfPresent(".lubirth-revised__project-intro", { autoAlpha: isHome && homeProjectVisible ? 1 : 0, y: 0 });
            setIfPresent(
              ".lubirth-revised__project-kicker, .lubirth-revised__project-intro h2, .lubirth-revised__project-subtitle, .lubirth-revised__project-body p",
              { autoAlpha: isHome && homeProjectVisible ? 1 : 0, y: 0 }
            );
            setIfPresent(".lubirth-revised__mobile-title-bar", { autoAlpha: isHome && homeRailVisible ? 1 : 0, y: 0 });
          } else {
            setIfPresent(
              ".lubirth-revised__travelling-title, .lubirth-revised__world-mark, .lubirth-revised__hero-copy, .lubirth-revised__title-rail, .lubirth-revised__project-intro, .lubirth-revised__mobile-title-bar",
              { autoAlpha: 0 }
            );
          }
          return;
        }

        if (prefersReduced) {
          setSceneEnabled(true);
          setCopyInteractive(!isHome);
          setProjectInteractive(true);
          setHomeIntroComplete(true);
          if (typeof window !== "undefined") {
            window.__MiraLithFirstUsableAt = performance.now();
            window.__MiraLithHomeIntroCompleteAt = performance.now();
          }
          setIfPresent(".lubirth-revised__loading", { autoAlpha: 0 });
          setIfPresent(".lubirth-revised__home-loading", { autoAlpha: 0 });
          setIfPresent(".lubirth-revised__atmosphere", { autoAlpha: 1 });
          setIfPresent(".lubirth-revised__project-intro", { autoAlpha: 1, y: 0 });
          setIfPresent(
            ".lubirth-revised__project-kicker, .lubirth-revised__project-intro h2, .lubirth-revised__project-subtitle, .lubirth-revised__project-body p",
            { autoAlpha: 1, y: 0 }
          );
          setIfPresent(".lubirth-revised__scroll-hint", { autoAlpha: 0 });
          if (isHome) {
            setIfPresent(".lubirth-revised__travelling-title", {
              autoAlpha: 1,
              xPercent: -50,
              yPercent: -50,
              x: 0,
              y: 0,
              scale: 1
            });
            setIfPresent(".lubirth-revised__title-rail", { autoAlpha: 0, y: 0 });
            setIfPresent(".lubirth-revised__title-rail li", { autoAlpha: 0, x: 0 });
            setIfPresent(".lubirth-revised__mobile-title-bar", { autoAlpha: 0, y: 0 });
          } else {
            setIfPresent(".lubirth-revised__title-rail", { autoAlpha: 1, y: 0 });
            setIfPresent(".lubirth-revised__title-rail li", { autoAlpha: 1, x: 0 });
            setIfPresent(".lubirth-revised__mobile-title-bar", { autoAlpha: 1, y: 0 });
            setIfPresent(".lubirth-revised__hero-copy", { autoAlpha: 1, y: 0, scale: 1 });
            setIfPresent(".lubirth-revised__world-mark", { autoAlpha: 1, y: 0 });
          }
          setOpeningProgress(0);
          return;
        }

        let railAccess = false;
        let projectAccess = false;
        const syncHomeScrollAccess = (progress: number) => {
          if (!isHome || screenshotDebug.copyHidden) {
            return;
          }

          const nextRailAccess = progress >= HOME_RAIL_ACCESS_PROGRESS;
          const nextProjectAccess = progress >= HOME_PROJECT_ACCESS_PROGRESS;
          if (nextRailAccess !== railAccess) {
            railAccess = nextRailAccess;
            setCopyInteractive(nextRailAccess);
          }
          if (nextProjectAccess !== projectAccess) {
            projectAccess = nextProjectAccess;
            setProjectInteractive(nextProjectAccess);
          }
        };

        const createScrollTimeline = () => {
          const timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              id: triggerId,
              trigger: rootElement,
              start: "top top",
              end: () => `+=${Math.round(window.innerHeight * 2.1)}`,
              scrub: 0.75,
              pin: stage ?? true,
              invalidateOnRefresh: true,
              onRefresh: (self) => {
                setOpeningProgress(self.progress);
                syncHomeScrollAccess(self.progress);
              },
              onUpdate: (self) => {
                setOpeningProgress(self.progress);
                syncHomeScrollAccess(self.progress);
              }
            }
          });

          if (screenshotDebug.copyHidden) {
            return timeline;
          }

          if (isHome) {
            if (window.innerWidth < 768) {
              timeline
                .to(selector(".lubirth-revised__scroll-hint"), { autoAlpha: 0, y: 12, duration: 0.12 }, 0)
                .to(
                  selector(".lubirth-revised__home-signature"),
                  { autoAlpha: 0, y: -8, duration: 0.22, ease: "power1.out" },
                  0.06
                )
                .to(selector(".lubirth-revised__travelling-title p"), { autoAlpha: 0, y: -4, duration: 0.14 }, 0.02)
                .to(
                  selector(".lubirth-revised__travelling-title"),
                  {
                    x: () => getOpeningTitleTarget().x,
                    y: () => getOpeningTitleTarget().y,
                    xPercent: 0,
                    yPercent: 0,
                    scale: () => getOpeningTitleTarget().scale,
                    duration: 0.52,
                    ease: "power2.inOut"
                  },
                  0
                )
                .to(
                  selector(".lubirth-revised__mobile-title-bar"),
                  { autoAlpha: 1, y: 0, duration: 0.24, ease: "power2.out" },
                  0.14
                )
                .to(selector(".lubirth-revised__project-intro"), { autoAlpha: 1, y: 0, duration: 0.28 }, 0.26)
                .to(
                  selector(
                    ".lubirth-revised__project-kicker, .lubirth-revised__project-intro h2, .lubirth-revised__project-subtitle, .lubirth-revised__project-body p"
                  ),
                  { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.035, ease: "power2.out" },
                  0.32
                )
                .to(selector(".lubirth-revised__title-rail"), { autoAlpha: 0, y: 0, duration: 0.01 }, 0);

              return timeline;
            }

            timeline
              .to(selector(".lubirth-revised__scroll-hint"), { autoAlpha: 0, y: 12, duration: 0.12 }, 0)
              .to(selector(".lubirth-revised__travelling-title p"), { autoAlpha: 0, y: -4, duration: 0.14 }, 0.02)
              .to(
                selector(".lubirth-revised__travelling-title"),
                {
                  x: () => getOpeningTitleTarget().x,
                  y: () => getOpeningTitleTarget().y,
                  xPercent: 0,
                  yPercent: 0,
                  scale: () => getOpeningTitleTarget().scale,
                  duration: 0.52,
                  ease: "power2.inOut"
                },
                0
              )
              .to(selector(".lubirth-revised__title-rail"), { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out" }, 0.14)
              .to(
                selector(".lubirth-revised__title-rail li[data-active='true']"),
                { autoAlpha: 1, x: 0, y: 0, duration: 0.2, ease: "power2.out" },
                0.34
              )
              .to(
                selector(".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-copy"),
                { autoAlpha: 1, duration: 0.24, ease: "power2.out" },
                0.4
              )
              .to(selector(".lubirth-revised__project-intro"), { autoAlpha: 1, y: 0, duration: 0.24 }, 0.28)
              .to(
                selector(
                  ".lubirth-revised__project-kicker, .lubirth-revised__project-intro h2, .lubirth-revised__project-subtitle, .lubirth-revised__project-body p"
                ),
                { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.035, ease: "power2.out" },
                0.34
              )
              .to(
                selector(".lubirth-revised__title-rail li:not([data-active='true'])"),
                { autoAlpha: 1, x: 0, y: 0, duration: 0.26, stagger: 0.035, ease: "power2.out" },
                0.54
              );

            return timeline;
          }

          timeline
            .to(selector(".lubirth-revised__scroll-hint"), { autoAlpha: 0, y: 12, duration: 0.12 }, 0)
            .to(selector(".lubirth-revised__world-mark"), { autoAlpha: 0.42, y: -6, duration: 0.28 }, 0.08)
            .to(
              selector(".lubirth-revised__hero-copy"),
              {
                x: () => (window.innerWidth >= 768 ? -54 : 0),
                y: () => (window.innerWidth >= 768 ? -118 : -88),
                scale: () => (window.innerWidth >= 768 ? 0.72 : 0.82),
                transformOrigin: "left top",
                duration: 0.55
              },
              0
            )
            .to(selector(".lubirth-revised__body"), { autoAlpha: 0, y: -18, duration: 0.3 }, 0.06)
            .to(selector(".lubirth-revised__details"), { autoAlpha: 0.28, y: -18, duration: 0.38 }, 0.14)
            .to(selector(".lubirth-revised__eyebrow"), { autoAlpha: 0.32, duration: 0.36 }, 0.16)
            .to(selector(".lubirth-revised__main-title"), { color: "rgba(246,241,232,0.46)", duration: 0.42 }, 0.18)
            .to(selector(".lubirth-revised__title-rail"), { autoAlpha: 1, y: 0, duration: 0.35 }, 0.32)
            .to(selector(".lubirth-revised__mobile-title-bar"), { autoAlpha: 1, y: 0, duration: 0.28 }, 0.26)
            .to(selector(".lubirth-revised__hero-copy"), { autoAlpha: 0, duration: 0.28 }, 0.54);

          return timeline;
        };

        if (screenshotDebug.copyHidden) {
          setSceneEnabled(true);
          setCopyInteractive(false);
          setProjectInteractive(false);
          setHomeIntroComplete(true);
          setIfPresent(".lubirth-revised__loading", { autoAlpha: 0 });
          setIfPresent(".lubirth-revised__home-loading", { autoAlpha: 0 });
          setIfPresent(".lubirth-revised__atmosphere", { autoAlpha: 1 });
          scrollTimeline = createScrollTimeline();
          ScrollTrigger.refresh();
          return;
        }

        if (isHome) {
          setSceneEnabled(true);
          const homeIntroStartedAt = performance.now();
          let revealScheduled = false;
          let completionScheduled = false;
          let introCompleted = false;
          let introFinalized = false;
          let scrollLocked = false;
          const previousHtmlOverflow = document.documentElement.style.overflow;
          const previousBodyOverflow = document.body.style.overflow;
          const lockHomeScroll = () => {
            if (scrollLocked) {
              return;
            }

            scrollLocked = true;
            window.scrollTo(0, 0);
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";
          };
          const unlockHomeScroll = () => {
            if (!scrollLocked) {
              return;
            }

            scrollLocked = false;
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.overflow = previousBodyOverflow;
            window.scrollTo(0, 0);
          };
          restoreHomeScrollLock = unlockHomeScroll;
          lockHomeScroll();
          const revealHomeIntro = () => {
            setIfPresent(".lubirth-revised__atmosphere", { autoAlpha: 1 });
            setIfPresent(".lubirth-revised__travelling-title", { autoAlpha: 1 });
            setIfPresent(".lubirth-revised__home-signature", { autoAlpha: 1, y: 0 });
            setIfPresent(".lubirth-revised__scroll-hint", { autoAlpha: 1, y: 0 });
          };
          const finalizeHomeIntro = () => {
            if (introFinalized || disposed) {
              return;
            }

            introFinalized = true;
            cleanupHomeReadyHandler?.();
            cleanupHomeReadyHandler = undefined;
            setIfPresent(".lubirth-revised__home-loading", { autoAlpha: 0 });
            setCopyInteractive(false);
            setProjectInteractive(false);
            unlockHomeScroll();
            if (typeof window !== "undefined") {
              const now = performance.now();
              window.__MiraLithHomeIntroCompleteAt = now;
              window.__MiraLithFirstUsableAt = now;
            }
            setHomeIntroComplete(true);
            scrollTimeline = createScrollTimeline();
            window.requestAnimationFrame(() => {
              if (!disposed) {
                ScrollTrigger.refresh();
              }
            });
          };
          const completeHomeIntro = (immediate = false, fadeDuration = 0.86, finalizeDelayOverrideMs?: number) => {
            if (introCompleted || disposed) {
              return;
            }

            introCompleted = true;
            if (immediate) {
              revealHomeIntro();
              setIfPresent(".lubirth-revised__home-loading", { autoAlpha: 0 });
              finalizeHomeIntro();
            } else {
              const exitTimeline = gsap.timeline({
                defaults: {
                  ease: "power2.inOut",
                  overwrite: true
                }
              });
              exitTimeline.set(selector(".lubirth-revised__home-loading-memory"), {
                autoAlpha: 0.68,
                y: 2
              }, 0);
              exitTimeline.to(
                selector(".lubirth-revised__home-loading-mark, .lubirth-revised__home-loading-hint, .lubirth-revised__home-loading-prelude"),
                {
                  autoAlpha: 0,
                  duration: Math.max(0.32, fadeDuration * 0.52)
                },
                0
              );
              exitTimeline.to(
                selector(".lubirth-revised__home-loading-contour-path--segment-left"),
                {
                  autoAlpha: 0,
                  x: -74,
                  duration: Math.max(0.56, fadeDuration * 0.92)
                },
                0.34
              );
              exitTimeline.to(
                selector(".lubirth-revised__home-loading-contour-path--segment-right"),
                {
                  autoAlpha: 0,
                  x: 74,
                  duration: Math.max(0.56, fadeDuration * 0.92)
                },
                0.34
              );
              exitTimeline.to(
                selector(".lubirth-revised__home-loading-contour-path--aura, .lubirth-revised__home-loading-contour-path--line"),
                {
                  autoAlpha: 0,
                  scaleX: 0.72,
                  transformOrigin: "50% 50%",
                  duration: Math.max(0.5, fadeDuration * 0.82)
                },
                0.42
              );
              exitTimeline.to(
                selector(".lubirth-revised__home-loading-moon"),
                {
                  autoAlpha: 0,
                  y: -8,
                  scale: 0.96,
                  duration: Math.max(0.48, fadeDuration * 0.72)
                },
                0.52
              );
              exitTimeline.to(
                selector(".lubirth-revised__home-loading-memory"),
                {
                  autoAlpha: 0,
                  y: -6,
                  duration: Math.max(0.62, fadeDuration * 0.9)
                },
                0.86
              );
              exitTimeline.to(
                selector(".lubirth-revised__home-loading-curtain"),
                {
                  autoAlpha: 0,
                  duration: Math.max(0.52, fadeDuration * 0.78)
                },
                0.88
              );
              exitTimeline.call(() => {
                revealHomeIntro();
              }, [], 0.9);
              const exitFinalizeDelayMs = Math.max(1480, (0.88 + Math.max(0.52, fadeDuration * 0.78)) * 1000 + 80);
              const finalizeDelayMs =
                finalizeDelayOverrideMs === undefined
                  ? exitFinalizeDelayMs
                  : Math.max(finalizeDelayOverrideMs, exitFinalizeDelayMs);
              homeLoadTimeouts.push(
                window.setTimeout(() => {
                  finalizeHomeIntro();
                }, finalizeDelayMs)
              );
            }
          };
          const skipHomeIntro = () => {
            if (introCompleted || disposed) {
              return;
            }

            if (homeProjectionSourceRef.current === "pending") {
              markHomeLoadingReady("fallback");
            }
            if (homeVisualReadySourceRef.current === "pending") {
              markHomeVisualReady("grace");
            }
            window.scrollTo(0, 0);
            completeHomeIntro(false, 0.68, 1120);
          };
          const scheduleHomePostReady = () => {
            if (disposed || homeProjectionSourceRef.current === "pending") {
              return;
            }

            const now = performance.now();
            const elapsedSinceIntroStart = now - homeIntroStartedAt;
            const projectionReadyStartedAt = window.__MiraLithHomeLoadingReadyAt ?? now;
            const remainingDelay = (delay: number, minimumAfterReady: number) =>
              Math.max(0, delay - elapsedSinceIntroStart, minimumAfterReady - (now - projectionReadyStartedAt));

            if (!revealScheduled) {
              revealScheduled = true;
            }

            if (completionScheduled || homeVisualReadySourceRef.current === "pending") {
              return;
            }

            completionScheduled = true;
            homeLoadTimeouts.push(
              window.setTimeout(() => {
                completeHomeIntro();
              }, remainingDelay(HOME_LOADING_SCROLL_DELAY_MS, HOME_LOADING_MIN_COMPLETE_AFTER_READY_MS))
            );
          };
          const handleSkipInput = (event: KeyboardEvent | WheelEvent | TouchEvent) => {
            if (introFinalized || disposed) {
              return;
            }

            if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") {
              return;
            }

            if (event.cancelable) {
              event.preventDefault();
            }
            window.scrollTo(0, 0);
            if (introCompleted) {
              return;
            }

            skipHomeIntro();
          };
          const handleHomeReady = () => scheduleHomePostReady();
          const handleHomeVisualReady = () => scheduleHomePostReady();
          window.addEventListener("wheel", handleSkipInput, { passive: false });
          window.addEventListener("touchstart", handleSkipInput, { passive: false });
          window.addEventListener("keydown", handleSkipInput);
          document.addEventListener("keydown", handleSkipInput);
          setHomeSkipReady(true);
          homeReadinessHandlersRef.current.add(handleHomeReady);
          homeVisualReadinessHandlersRef.current.add(handleHomeVisualReady);
          cleanupHomeReadyHandler = () => {
            window.removeEventListener("wheel", handleSkipInput);
            window.removeEventListener("touchstart", handleSkipInput);
            window.removeEventListener("keydown", handleSkipInput);
            document.removeEventListener("keydown", handleSkipInput);
            homeReadinessHandlersRef.current.delete(handleHomeReady);
            homeVisualReadinessHandlersRef.current.delete(handleHomeVisualReady);
          };
          if (homeProjectionSourceRef.current !== "pending") {
            scheduleHomePostReady();
          }
          if (homeVisualReadySourceRef.current !== "pending") {
            scheduleHomePostReady();
          }
          homeLoadTimeouts.push(
            window.setTimeout(() => {
              if (disposed) {
                return;
              }

              markHomeLoadingReady("fallback");
            }, Math.max(0, HOME_PROJECTION_FALLBACK_DEADLINE_MS - (performance.now() - homeIntroStartedAt))),
            window.setTimeout(() => {
              if (disposed) {
                return;
              }

              markHomeVisualReady("grace");
            }, Math.max(0, HOME_VISUAL_GRACE_DEADLINE_MS - (performance.now() - homeIntroStartedAt))),
            window.setTimeout(() => {
              if (disposed || introCompleted) {
                return;
              }

              if (homeProjectionSourceRef.current === "pending") {
                markHomeLoadingReady("fallback");
              }
              if (homeVisualReadySourceRef.current === "pending") {
                markHomeVisualReady("grace");
              }
              completeHomeIntro();
            }, Math.max(0, HOME_LOADING_HARD_COMPLETE_DEADLINE_MS - (performance.now() - homeIntroStartedAt)))
          );
          return;
        }

        loadTimeline = gsap.timeline({
          defaults: { ease: "power3.out" },
          onComplete: () => {
            if (disposed) {
              return;
            }

            setSceneEnabled(true);
            setCopyInteractive(true);
            if (typeof window !== "undefined" && !window.__MiraLithFirstUsableAt) {
              window.__MiraLithFirstUsableAt = performance.now();
            }
            window.requestAnimationFrame(() => {
              if (disposed) {
                return;
              }

              scrollTimeline = createScrollTimeline();
              ScrollTrigger.refresh();
            });
          }
        });

        loadTimeline
          .to(selector(".lubirth-revised__loading-dot"), { autoAlpha: 1, scale: 1, duration: 0.7 })
          .to(selector(".lubirth-revised__loading-orbit"), { autoAlpha: 1, scale: 1, duration: 1.2 }, 0.1)
          .to(selector(".lubirth-revised__loading-title"), { autoAlpha: 1, y: 0, duration: 0.95 }, 0.45)
          .to(
            selector(".lubirth-revised__loading-line:not(.lubirth-revised__loading-title)"),
            { autoAlpha: 1, y: 0, duration: 0.75, stagger: 0.16 },
            0.95
          )
          .to(selector(".lubirth-revised__loading-dot"), { scale: 1.45, duration: 0.9, ease: "sine.inOut" }, 1.65)
          .to(selector(".lubirth-revised__loading"), { autoAlpha: 0, duration: 1.1, ease: "power2.inOut", delay: 0.65 })
          .to(selector(".lubirth-revised__atmosphere"), { autoAlpha: 1, duration: 1.2 }, "-=0.75")
          .to(selector(".lubirth-revised__world-mark"), { autoAlpha: 1, y: 0, duration: 0.8 }, "-=0.8")
          .to(selector(".lubirth-revised__hero-copy"), { autoAlpha: 1, y: 0, duration: 1.15 }, "-=0.7")
          .to(selector(".lubirth-revised__scroll-hint"), { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.5");
      }, rootElement);

      cleanupAnimations = () => {
        cleanupHomeReadyHandler?.();
        restoreHomeScrollLock?.();
        homeLoadTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
        loadTimeline?.kill();
        scrollTimeline?.kill();
        ScrollTrigger.getById(triggerId)?.kill();
        context.revert();
      };
    })();

    return () => {
      disposed = true;
      cleanupAnimations?.();
    };
  }, [debugOptions, debugOptionsReady, isHome, markHomeLoadingReady, markHomeVisualReady, triggerId, variant]);

  return (
    <main
      ref={rootRef}
      className="lubirth-revised"
      data-copy={showCopy ? "visible" : "hidden"}
      data-runtime={runtimeReady ? "ready" : "fallback"}
      data-copy-interactive={copyInteractive ? "true" : "false"}
      data-project-interactive={projectInteractive ? "true" : "false"}
      data-home-loading={isHome ? (homeLoadingReady ? "active" : "hold") : undefined}
      data-home-loading-ready={isHome ? String(homeLoadingReady) : undefined}
      data-home-visual-ready={isHome ? String(homeVisualReady) : undefined}
      data-home-skip-ready={isHome ? String(homeSkipReady) : undefined}
      data-home-intro-complete={isHome ? String(homeIntroComplete) : undefined}
      data-home-projection={isHome ? homeProjectionSource : undefined}
      data-home-projection-visual={isHome ? homeLoadingProjectionSource : undefined}
      data-atmo-policy={debugOptions.atmospherePolicy}
      aria-label={ariaLabel ?? (isHome ? "MiraLith LuBirth opening" : "LuBirth revised opening route")}
    >
      <section
        className="lubirth-revised__stage"
        aria-label={stageLabel ?? (isHome ? "MiraLith LuBirth opening frame" : "LuBirth revised opening frame")}
      >
        <AtmosphereOverlay />
        {showCopy && isHome ? <HomeSignature /> : null}
        {showCopy ? isHome ? <TravellingTitle /> : <WorldMark /> : null}
        {showCopy ? isHome ? (
          <HomeLoadingOverlay
            projection={homeLoadingProjection}
            projectionSource={homeLoadingProjectionSource}
            introComplete={homeIntroComplete}
            onMemoryImageReady={() => markHomeVisualAssetReady("memory-image")}
          />
        ) : (
          <LoadingOverlay />
        ) : null}
        {showCopy ? isHome ? <ProjectIntro interactive={projectInteractive} /> : <HeroText /> : null}
        {showCopy ? <TitleRail activeChapter={activeChapter} interactive={copyInteractive} /> : null}
        {showCopy ? <MobileTitleBar activeChapter={activeChapter} interactive={copyInteractive} /> : null}
        {showCopy ? <ScrollHint /> : null}
      </section>

      {sceneEnabled ? (
        <VisualCanvas
          key={isScreenshotMode ? "lubirth-screenshot-canvas" : isHome ? "lubirth-home-canvas" : "lubirth-runtime-canvas"}
          antialias={!isHome}
          decorative
          dpr={isScreenshotMode && !isHome ? 2 : isHome ? 0.85 : [1.5, 2.1]}
          fallback={
            <VisualCanvasFallback
              scene="lubirth"
              label="LuBirth near-earth arc and moon field"
              posterSrc="/assets/lubirth/poster-field.webp"
            />
          }
        >
          <LuBirthSceneSlot
            mode="field"
            quality={isHome ? "medium" : isScreenshotMode ? "high" : "auto"}
            paused={isScreenshotMode}
            cloudDeckEnabled={!isHome}
            visualDebugLayer={debugOptions.visualDebugLayer}
            renderProfile={debugOptions.renderProfile}
            atmospherePolicy={debugOptions.atmospherePolicy}
            routeVariant={variant}
            homeIntroRendering={homeIntroRendering}
            productionSurface
            onProjectionFrame={isHome ? handleProjectionFrame : undefined}
            onVisualReadyEnough={isHome ? () => markHomeVisualAssetReady("day-texture") : undefined}
            onMoonTextureReady={isHome ? () => markHomeVisualAssetReady("moon-texture") : undefined}
          />
        </VisualCanvas>
      ) : null}
    </main>
  );
}
