"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LandingVisualDebugLayer, LuBirthProjectionFrame } from "@miralith/lubirth-hero";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

declare global {
  interface Window {
    __MiraLithOpeningProgress?: number;
    __MiraLithFirstUsableAt?: number;
    __MiraLithHomeIntroCompleteAt?: number;
    __MiraLithHomeLoadingReadyAt?: number;
    __MiraLithHomeLoadingReadySource?: ReadyHomeProjectionSource;
  }
}

const SCROLL_TRIGGER_ID_PREFIX = "miralith-lubirth-opening";
const HOME_PROJECTION_FALLBACK_DEADLINE_MS = 1900;
const HOME_LOADING_REVEAL_DELAY_MS = 2400;
const HOME_LOADING_SCROLL_DELAY_MS = 3300;
const HOME_LOADING_MIN_REVEAL_AFTER_READY_MS = 1200;
const HOME_LOADING_MIN_COMPLETE_AFTER_READY_MS = 2600;
const HOME_PROJECT_ACCESS_PROGRESS = 0.34;
const HOME_RAIL_ACCESS_PROGRESS = 0.52;

type HomeProjectionSource = "pending" | "scene" | "fallback";
type ReadyHomeProjectionSource = Exclude<HomeProjectionSource, "pending">;

type LuBirthRevisedRouteVariant = "home" | "study";

interface ScreenshotDebugOptions {
  fixedProgress: number | null;
  copyHidden: boolean;
  visualDebugLayer: LandingVisualDebugLayer;
}

interface LuBirthRevisedRouteProps {
  variant?: LuBirthRevisedRouteVariant;
  ariaLabel?: string;
  stageLabel?: string;
}

const DEFAULT_SCREENSHOT_DEBUG_OPTIONS: ScreenshotDebugOptions = {
  fixedProgress: null,
  copyHidden: false,
  visualDebugLayer: "all"
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
    targetId: "lubirth-project-intro-title",
    title: "LuBirth",
    zh: "地月人",
    en: "Earth / Moon / Human",
    active: true
  },
  {
    index: "02",
    targetId: "miralith-chapter-radio-gaga",
    title: "Radio Gaga",
    zh: "照护",
    en: "Care",
    active: false
  },
  {
    index: "03",
    targetId: "miralith-chapter-coscroll",
    title: "CoScroll",
    zh: "赛博转经筒",
    en: "Devotion",
    active: false
  },
  {
    index: "04",
    targetId: "miralith-chapter-artbreeze",
    title: "ArtBreeze",
    zh: "艺息",
    en: "Art Flow",
    active: false
  },
  {
    index: "05",
    targetId: "miralith-chapter-floating-constellation",
    title: "Floating Constellation",
    zh: "群星项目",
    en: "Project Field",
    active: false
  },
  {
    index: "06",
    targetId: "miralith-chapter-client-works",
    title: "Client Works",
    zh: "商业作品",
    en: "Commissioned Systems",
    active: false
  },
  {
    index: "07",
    targetId: "miralith-chapter-now-building",
    title: "Now Building",
    zh: "主业与关于",
    en: "Work / About",
    active: false
  }
] as const;

type Chapter = (typeof chapters)[number];

const activeChapter = chapters.find((chapter) => chapter.active) ?? chapters[0];

function ChapterTargets() {
  return (
    <div className="lubirth-revised__chapter-targets" aria-hidden="true">
      {chapters.map((chapter) => (
        <span key={chapter.targetId} id={chapter.targetId} />
      ))}
    </div>
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function setOpeningProgress(progress: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.__MiraLithOpeningProgress = clamp01(progress);
}

function readScreenshotDebugOptions(): ScreenshotDebugOptions {
  if (typeof window === "undefined") {
    return DEFAULT_SCREENSHOT_DEBUG_OPTIONS;
  }

  const params = new URLSearchParams(window.location.search);
  const copyMode = params.get("copy");
  const visualPixelMode = params.get("visualTest") === "pixels";
  const progressParam = params.get("progress");
  const parsedProgress = progressParam === null ? Number.NaN : Number.parseFloat(progressParam);
  const debugParam = params.get("debug");
  const visualDebugLayer: LandingVisualDebugLayer =
    debugParam === "stars" ||
    debugParam === "clouds" ||
    debugParam === "atmosphere" ||
    debugParam === "aurora" ||
    debugParam === "all"
      ? debugParam
      : "all";

  return {
    fixedProgress: Number.isFinite(parsedProgress) ? clamp01(parsedProgress) : null,
    copyHidden: copyMode === "hidden" || (visualPixelMode && copyMode !== "visible"),
    visualDebugLayer
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
  introComplete
}: {
  projection: LuBirthProjectionFrame | null;
  projectionSource: HomeProjectionSource;
  introComplete: boolean;
}) {
  const visibleProjectionSource =
    projectionSource === "scene" && projection ? "scene" : projectionSource === "fallback" ? "fallback" : "pending";
  const contourViewBox = projection ? `0 0 ${projection.width} ${projection.height}` : "0 0 1200 800";
  const contourPath = projection?.earthHorizonPath ?? "M -60 570 Q 600 390 1260 570";
  const moonStyle = projection
    ? {
        left: `${projection.moon.x}px`,
        top: `${projection.moon.y}px`,
        width: `${Math.max(52, Math.min(168, projection.moon.radius * 2.12))}px`
      }
    : undefined;

  return (
    <section
      className="lubirth-revised__home-loading"
      data-projection={visibleProjectionSource}
      aria-label="LuBirth opening status"
      aria-hidden={introComplete ? "true" : undefined}
    >
      <p className="sr-only">
        MiraLith opening. LuBirth 地月人 is ready. Scroll, press Enter, or press Space to enter.
      </p>
      <svg
        className="lubirth-revised__home-loading-moon"
        viewBox="0 0 120 120"
        focusable="false"
        aria-hidden="true"
        style={moonStyle}
      >
        <path
          className="lubirth-revised__home-loading-moon-path lubirth-revised__home-loading-moon-path--projection"
          pathLength={1}
          d="M60 8 A52 52 0 1 1 60 112 A52 52 0 1 1 60 8"
        />
      </svg>

      <svg className="lubirth-revised__home-loading-contour" viewBox={contourViewBox} focusable="false" aria-hidden="true">
        <path
          className="lubirth-revised__home-loading-contour-path lubirth-revised__home-loading-contour-path--gold"
          pathLength={1}
          d={contourPath}
        />
        <path
          className="lubirth-revised__home-loading-contour-path"
          pathLength={1}
          d={contourPath}
        />
      </svg>

      <div className="lubirth-revised__home-loading-mark">
        <p className="lubirth-revised__home-loading-title">{copy.lubirth.title}</p>
        <p className="lubirth-revised__home-loading-subtitle">{copy.lubirth.shortZh}</p>
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

function OpeningTitle() {
  return (
    <section className="lubirth-revised__opening-title" aria-labelledby="lubirth-opening-title">
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

          return (
            <li key={chapter.index} data-active={isActive ? "true" : "false"}>
              <a
                className="lubirth-revised__rail-link"
                href={`#${chapter.targetId}`}
                aria-current={isActive ? "page" : undefined}
                tabIndex={interactive ? undefined : -1}
              >
                <span className="lubirth-revised__rail-index">{chapter.index}</span>
                <span className="lubirth-revised__rail-copy">
                  <span className="lubirth-revised__rail-title">{chapter.title}</span>
                  <span className="lubirth-revised__rail-meta">
                    {chapter.zh} / <span>{chapter.en}</span>
                  </span>
                </span>
              </a>
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
      <a href={`#${activeChapter.targetId}`} aria-current="page" tabIndex={interactive ? undefined : -1}>
        <span className="lubirth-revised__mobile-title-main">
          <span>{activeChapter.index}</span>
          <span className="lubirth-revised__mobile-title-title">{activeChapter.title}</span>
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
  const [debugOptions, setDebugOptions] = useState<ScreenshotDebugOptions>(DEFAULT_SCREENSHOT_DEBUG_OPTIONS);
  const homeProjectionSourceRef = useRef<HomeProjectionSource>("pending");
  const homeReadinessHandlersRef = useRef(new Set<(source: ReadyHomeProjectionSource) => void>());
  const homeReadinessDispatchedRef = useRef(false);
  const showCopy = !debugOptions.copyHidden;
  const isScreenshotMode = debugOptions.fixedProgress !== null;
  const homeLoadingReady = homeProjectionSource !== "pending";
  const homeLoadingProjection = homeProjectionSource === "scene" ? homeProjection : null;
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
  }, [isHome]);
  const handleProjectionFrame = useCallback((frame: LuBirthProjectionFrame) => {
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
    if (!isHome || homeProjectionSource === "pending" || homeReadinessDispatchedRef.current) {
      return;
    }

    homeReadinessDispatchedRef.current = true;
    homeReadinessHandlersRef.current.forEach((handler) => handler(homeProjectionSource));
  }, [homeLoadingReady, homeProjectionSource, isHome]);

  useEffect(() => {
    let disposed = false;
    let cleanupAnimations: (() => void) | undefined;
    let cleanupHomeReadyHandler: (() => void) | undefined;
    const homeAnimationStartedAt =
      typeof performance !== "undefined" ? performance.now() : 0;

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
      const screenshotDebug = readScreenshotDebugOptions();
      setDebugOptions(screenshotDebug);
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
      if (forcedFallback || isHome || screenshotDebug.copyHidden) {
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
          const sourceContainer = selector(".lubirth-revised__opening-title")[0] as HTMLElement | undefined;
          const sourceTitle = selector(".lubirth-revised__opening-title h1")[0] as HTMLElement | undefined;
          const titleRail = selector(".lubirth-revised__title-rail")[0] as HTMLElement | undefined;
          const desktopActiveItem = selector(".lubirth-revised__title-rail li[data-active='true']")[0] as
            | HTMLElement
            | undefined;
          const desktopTitle = selector(
            ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-title"
          )[0] as HTMLElement | undefined;
          const mobileTitleBar = selector(".lubirth-revised__mobile-title-bar")[0] as HTMLElement | undefined;
          const mobileTitle = selector(".lubirth-revised__mobile-title-title")[0] as HTMLElement | undefined;
          const canUseRail = window.innerWidth >= 768 && desktopTitle;
          const targetTitle = canUseRail ? desktopTitle : mobileTitle;
          const targetBounds = targetTitle?.getBoundingClientRect();
          const sourceBounds = sourceContainer?.getBoundingClientRect();
          const sourceFontSize = sourceTitle ? Number.parseFloat(window.getComputedStyle(sourceTitle).fontSize) : 96;
          const targetFontSize = targetTitle ? Number.parseFloat(window.getComputedStyle(targetTitle).fontSize) : 24;
          const targetOffsetX = canUseRail && desktopActiveItem ? Number(gsap.getProperty(desktopActiveItem, "x")) : 0;
          const targetOffsetY = canUseRail
            ? titleRail ? Number(gsap.getProperty(titleRail, "y")) : 0
            : mobileTitleBar ? Number(gsap.getProperty(mobileTitleBar, "y")) : 0;
          const left = targetBounds ? targetBounds.left - targetOffsetX : (canUseRail ? 84 : 52);
          const top = targetBounds ? targetBounds.top - targetOffsetY : (canUseRail ? 86 : 18);
          const sourceTop = sourceBounds
            ? sourceBounds.top + sourceBounds.height * 0.5
            : window.innerHeight * 0.5;
          const scale = canUseRail
            ? Math.min(0.34, Math.max(0.12, targetFontSize / sourceFontSize))
            : Math.min(0.28, Math.max(0.14, targetFontSize / sourceFontSize));

          return {
            x: left - window.innerWidth * 0.5,
            y: top - sourceTop,
            scale
          };
        };

        setIfPresent(".lubirth-revised__opening-title", {
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
            setIfPresent(".lubirth-revised__opening-title", { autoAlpha: isHome ? 1 : 0 });
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
              ".lubirth-revised__opening-title, .lubirth-revised__world-mark, .lubirth-revised__hero-copy, .lubirth-revised__title-rail, .lubirth-revised__project-intro, .lubirth-revised__mobile-title-bar",
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
            setIfPresent(".lubirth-revised__opening-title", {
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
            timeline
              .to(selector(".lubirth-revised__scroll-hint"), { autoAlpha: 0, y: 12, duration: 0.12 }, 0)
              .to(
                selector(".lubirth-revised__opening-title"),
                {
                  x: () => getOpeningTitleTarget().x,
                  y: () => getOpeningTitleTarget().y,
                  xPercent: 0,
                  yPercent: 0,
                  scale: () => getOpeningTitleTarget().scale,
                  duration: 0.34,
                  ease: "power2.inOut"
                },
                0.04
              )
              .to(selector(".lubirth-revised__title-rail"), { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0.14)
              .to(
                selector(".lubirth-revised__title-rail li[data-active='true']"),
                { autoAlpha: 1, x: 0, y: 0, duration: 0.2, ease: "power2.out" },
                0.18
              )
              .to(selector(".lubirth-revised__mobile-title-bar"), { autoAlpha: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.3)
              .to(selector(".lubirth-revised__project-intro"), { autoAlpha: 1, y: 0, duration: 0.18 }, 0.36)
              .to(
                selector(
                  ".lubirth-revised__project-kicker, .lubirth-revised__project-intro h2, .lubirth-revised__project-subtitle, .lubirth-revised__project-body p"
                ),
                { autoAlpha: 1, y: 0, duration: 0.22, stagger: 0.045, ease: "power2.out" },
                0.38
              )
              .to(
                selector(".lubirth-revised__title-rail li:not([data-active='true'])"),
                { autoAlpha: 1, x: 0, y: 0, duration: 0.24, stagger: 0.035, ease: "power2.out" },
                0.46
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
          let postReadyScheduled = false;
          let introCompleted = false;
          const revealHomeIntro = () => {
            setIfPresent(".lubirth-revised__atmosphere", { autoAlpha: 1 });
            setIfPresent(".lubirth-revised__opening-title", { autoAlpha: 1 });
            setIfPresent(".lubirth-revised__home-signature", { autoAlpha: 1, y: 0 });
            setIfPresent(".lubirth-revised__scroll-hint", { autoAlpha: 1, y: 0 });
            if (typeof window !== "undefined" && !window.__MiraLithFirstUsableAt) {
              window.__MiraLithFirstUsableAt = performance.now();
            }
          };
          const completeHomeIntro = (immediate = false) => {
            if (introCompleted || disposed) {
              return;
            }

            introCompleted = true;
            revealHomeIntro();
            if (immediate) {
              setIfPresent(".lubirth-revised__home-loading", { autoAlpha: 0 });
            } else {
              gsap.to(selector(".lubirth-revised__home-loading"), {
                autoAlpha: 0,
                duration: 0.62,
                ease: "power2.inOut",
                overwrite: true
              });
            }
            setHomeIntroComplete(true);
            setCopyInteractive(false);
            setProjectInteractive(false);
            if (typeof window !== "undefined") {
              window.__MiraLithHomeIntroCompleteAt = performance.now();
            }
            scrollTimeline = createScrollTimeline();
            ScrollTrigger.refresh();
          };
          const skipHomeIntro = () => {
            if (introCompleted || disposed) {
              return;
            }

            if (homeProjectionSourceRef.current === "pending") {
              markHomeLoadingReady("fallback");
            }
            completeHomeIntro(true);
          };
          const scheduleHomePostReady = () => {
            if (postReadyScheduled || disposed) {
              return;
            }

            postReadyScheduled = true;
            const now = performance.now();
            const readyStartedAt = window.__MiraLithHomeLoadingReadyAt ?? now;
            const remainingDelay = (delay: number, minimumAfterReady: number) =>
              Math.max(0, delay - (now - homeAnimationStartedAt), minimumAfterReady - (now - readyStartedAt));
            homeLoadTimeouts.push(
              window.setTimeout(() => {
                if (!disposed) {
                  revealHomeIntro();
                }
              }, remainingDelay(HOME_LOADING_REVEAL_DELAY_MS, HOME_LOADING_MIN_REVEAL_AFTER_READY_MS)),
              window.setTimeout(() => {
                completeHomeIntro();
              }, remainingDelay(HOME_LOADING_SCROLL_DELAY_MS, HOME_LOADING_MIN_COMPLETE_AFTER_READY_MS))
            );
          };
          const handleSkipInput = (event: KeyboardEvent | WheelEvent | TouchEvent) => {
            if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") {
              return;
            }

            skipHomeIntro();
          };
          const handleHomeReady = () => scheduleHomePostReady();
          window.addEventListener("wheel", handleSkipInput, { passive: true });
          window.addEventListener("touchstart", handleSkipInput, { passive: true });
          window.addEventListener("keydown", handleSkipInput);
          homeReadinessHandlersRef.current.add(handleHomeReady);
          cleanupHomeReadyHandler = () => {
            window.removeEventListener("wheel", handleSkipInput);
            window.removeEventListener("touchstart", handleSkipInput);
            window.removeEventListener("keydown", handleSkipInput);
            homeReadinessHandlersRef.current.delete(handleHomeReady);
          };
          if (homeProjectionSourceRef.current !== "pending") {
            scheduleHomePostReady();
          }
          homeLoadTimeouts.push(
            window.setTimeout(() => {
              if (disposed) {
                return;
              }

              markHomeLoadingReady("fallback");
            }, HOME_PROJECTION_FALLBACK_DEADLINE_MS)
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
  }, [isHome, markHomeLoadingReady, triggerId, variant]);

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
      data-home-intro-complete={isHome ? String(homeIntroComplete) : undefined}
      data-home-projection={isHome ? homeProjectionSource : undefined}
      aria-label={ariaLabel ?? (isHome ? "MiraLith LuBirth opening" : "LuBirth revised opening route")}
    >
      <section
        className="lubirth-revised__stage"
        aria-label={stageLabel ?? (isHome ? "MiraLith LuBirth opening frame" : "LuBirth revised opening frame")}
      >
        <AtmosphereOverlay />
        {isHome ? <ChapterTargets /> : null}
        {showCopy && isHome ? <HomeSignature /> : null}
        {showCopy ? isHome ? <OpeningTitle /> : <WorldMark /> : null}
        {showCopy ? isHome ? (
          <HomeLoadingOverlay
            projection={homeLoadingProjection}
            projectionSource={homeProjectionSource}
            introComplete={homeIntroComplete}
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
          decorative
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
            quality={isScreenshotMode ? "high" : "auto"}
            paused={isScreenshotMode}
            visualDebugLayer={debugOptions.visualDebugLayer}
            onProjectionFrame={isHome ? handleProjectionFrame : undefined}
          />
        </VisualCanvas>
      ) : null}
    </main>
  );
}
