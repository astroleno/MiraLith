import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __MiraLithCanvasCreatedAt?: number;
    __MiraLithFirstUsableAt?: number;
    __MiraLithHomeIntroCompleteAt?: number;
    __MiraLithHomeLoadingReadySource?: "scene" | "fallback";
    __MiraLithHomeLoadingReadyAt?: number;
    __MiraLithHomeMemoryImageReadyAt?: number;
    __MiraLithHomeMoonTextureReadyAt?: number;
    __MiraLithHomeVisualReadyAt?: number;
    __MiraLithHomeVisualReadySource?: "day-texture" | "grace";
    __MiraLithHomeProjectionFrame?: {
      width: number;
      height: number;
      earthHorizonPath: string;
      moon: {
        x: number;
        y: number;
        radius: number;
      };
    };
  }
}

test.describe.configure({ mode: "parallel" });

test("homepage composes LuBirth then Radio Gaga in one production canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('[data-home-chapter="lubirth"]')).toBeVisible();
  expect(await page.evaluate(() => {
    const lubirth = document.querySelector('[data-home-chapter="lubirth"]');
    const radio = document.querySelector('[data-home-chapter="radio-gaga"]');
    if (!(lubirth instanceof HTMLElement) || !(radio instanceof HTMLElement)) return false;
    return radio.offsetTop > lubirth.offsetTop;
  })).toBe(true);
  await expect(page.locator('[data-visual-canvas="production"]')).toHaveCount(1);
});

test("homepage keeps readable SSR fallback text before runtime animations", async ({ page }) => {
  await page.goto("/?visual=fallback", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised__home-loading-prelude")).toBeVisible({ timeout: 2_000 });
  await expect(page.locator(".lubirth-revised__home-loading-title")).toBeHidden({ timeout: 2_000 });
  await expect(page.locator(".lubirth-revised__home-loading-subtitle")).toBeHidden({ timeout: 2_000 });
  await expect(page.getByText("MiraLith").first()).toBeVisible({ timeout: 2_000 });
  await expect(page.getByLabel("MiraLith opening loading")).toContainText("MiraLith");
});

test("homepage exits loading within tightened scene and fallback budgets", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 7_000 });
  const sceneTiming = await page.evaluate(() => ({
    canvasCreatedAt: window.__MiraLithCanvasCreatedAt,
    completeAt: window.__MiraLithHomeIntroCompleteAt,
    firstUsableAt: window.__MiraLithFirstUsableAt,
    memoryImageReadyAt: window.__MiraLithHomeMemoryImageReadyAt,
    projectionReadyAt: window.__MiraLithHomeLoadingReadyAt,
    source: window.__MiraLithHomeLoadingReadySource,
    visualReadyAt: window.__MiraLithHomeVisualReadyAt,
    visualSource: window.__MiraLithHomeVisualReadySource
  }));

  expect(sceneTiming.source).toBe("scene");
  expect(sceneTiming.visualSource).toMatch(/^(day-texture|grace)$/);
  expect(sceneTiming.canvasCreatedAt).toBeGreaterThan(0);
  expect(sceneTiming.memoryImageReadyAt ?? 0).toBeGreaterThan(0);
  expect(sceneTiming.projectionReadyAt).toBeGreaterThan(0);
  expect(sceneTiming.visualReadyAt).toBeGreaterThan(0);
  expect(sceneTiming.completeAt).toBeGreaterThanOrEqual(sceneTiming.projectionReadyAt ?? 0);
  expect(sceneTiming.completeAt).toBeGreaterThanOrEqual(sceneTiming.visualReadyAt ?? 0);
  expect(sceneTiming.completeAt).toBeLessThanOrEqual(6_500);
  expect(sceneTiming.firstUsableAt).toBeGreaterThanOrEqual(sceneTiming.completeAt ?? 0);
  expect(sceneTiming.firstUsableAt).toBeLessThanOrEqual(6_700);

  await page.goto("/?visual=fallback&visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 6_500 });
  const fallbackTiming = await page.evaluate(() => ({
    completeAt: window.__MiraLithHomeIntroCompleteAt,
    firstUsableAt: window.__MiraLithFirstUsableAt,
    memoryImageReadyAt: window.__MiraLithHomeMemoryImageReadyAt,
    projectionReadyAt: window.__MiraLithHomeLoadingReadyAt,
    source: window.__MiraLithHomeLoadingReadySource,
    visualReadyAt: window.__MiraLithHomeVisualReadyAt,
    visualSource: window.__MiraLithHomeVisualReadySource
  }));

  expect(fallbackTiming.source).toBe("fallback");
  expect(fallbackTiming.visualSource).toBe("grace");
  expect(fallbackTiming.memoryImageReadyAt ?? 0).toBeGreaterThan(0);
  expect(fallbackTiming.completeAt).toBeGreaterThanOrEqual(fallbackTiming.projectionReadyAt ?? 0);
  expect(fallbackTiming.completeAt).toBeGreaterThanOrEqual(fallbackTiming.visualReadyAt ?? 0);
  expect(fallbackTiming.completeAt).toBeLessThanOrEqual(5_600);
  expect(fallbackTiming.firstUsableAt).toBeGreaterThanOrEqual(fallbackTiming.completeAt ?? 0);
  expect(fallbackTiming.firstUsableAt).toBeLessThanOrEqual(5_800);
});

test("homepage keeps the memory face visibly readable for at least two seconds", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const visibleStart = await page.waitForFunction(() => {
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const memory = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-memory");
    if (!overlay || !memory || window.getComputedStyle(overlay).visibility === "hidden") {
      return false;
    }

    return Number.parseFloat(window.getComputedStyle(memory).opacity) > 0.55 ? performance.now() : false;
  });

  await page.waitForTimeout(2_000);
  const afterTwoSeconds = await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const memory = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-memory");
    const helmet = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-helmet");

    return {
      elapsed: performance.now(),
      helmetOpacity: Number.parseFloat(window.getComputedStyle(helmet).opacity),
      memoryOpacity: Number.parseFloat(window.getComputedStyle(memory).opacity),
      overlayVisible: window.getComputedStyle(overlay).visibility !== "hidden"
    };
  });

  expect(afterTwoSeconds.elapsed - await visibleStart.jsonValue()).toBeGreaterThanOrEqual(2_000);
  expect(afterTwoSeconds.overlayVisible).toBe(true);
  expect(afterTwoSeconds.memoryOpacity).toBeGreaterThan(0.3);
  expect(afterTwoSeconds.helmetOpacity).toBeGreaterThan(0.1);
});

test("homepage renders the LuBirth two-line opening in one production-owned canvas", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible");

  await expect(page.getByLabel("MiraLith LuBirth opening frame")).toBeVisible();
  await expect(page.locator(".lubirth-revised__loading")).toBeHidden({ timeout: 25_000 });
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeLoadingReady === "true";
  });
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible({
    timeout: 25_000
  });
  await expect(page.locator(".lubirth-revised__opening-title").getByText("地月人")).toBeVisible({
    timeout: 12_000
  });
  await expect(page.locator(".lubirth-revised__project-intro")).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
});

test("homepage loading holds contour animation until projection readiness or fallback deadline", async ({ page }) => {
  await page.goto("/?visual=fallback&visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const holdState = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const contour = document.querySelector<SVGPathElement>(".lubirth-revised__home-loading-contour-path--line");

    const prelude = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-prelude");
    const title = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-title");

    if (!root || !overlay || !contour || !prelude || !title) {
      return null;
    }

    const contourStyle = window.getComputedStyle(contour);
    const titleStyle = window.getComputedStyle(title);
    const preludeStyle = window.getComputedStyle(prelude);

    return {
      animationName: window.getComputedStyle(contour).animationName,
      loadingState: root.dataset.homeLoading,
      preludeVisible: preludeStyle.visibility !== "hidden" && Number.parseFloat(preludeStyle.opacity) > 0.2,
      projection: overlay.dataset.projection,
      ready: root.dataset.homeLoadingReady,
      titleVisible: titleStyle.visibility !== "hidden" && Number.parseFloat(titleStyle.opacity) > 0.2
    };
  });

  expect(await holdState.jsonValue()).toEqual({
    animationName: "none",
    loadingState: "hold",
    preludeVisible: true,
    projection: "pending",
    ready: "false",
    titleVisible: false
  });

  const fallbackState = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const contour = document.querySelector<SVGPathElement>(".lubirth-revised__home-loading-contour-path--line");

    const prelude = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-prelude");
    const title = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-title");

    if (!root || !overlay || !contour || !prelude || !title || root.dataset.homeProjection !== "fallback") {
      return null;
    }

    const contourStyle = window.getComputedStyle(contour);
    const preludeStyle = window.getComputedStyle(prelude);
    const titleStyle = window.getComputedStyle(title);
    const preludeVisible = preludeStyle.visibility !== "hidden" && Number.parseFloat(preludeStyle.opacity) > 0.2;

    if (preludeVisible) {
      return null;
    }

    return {
      animationDuration: contourStyle.animationDuration,
      animationName: contourStyle.animationName,
      loadingState: root.dataset.homeLoading,
      preludeVisible,
      projection: overlay.dataset.projection,
      ready: root.dataset.homeLoadingReady,
      source: window.__MiraLithHomeLoadingReadySource,
      titleAnimation: titleStyle.animationName
    };
  });

  expect(await fallbackState.jsonValue()).toMatchObject({
    animationName: "lubirth-home-contour-line",
    animationDuration: "2.28s",
    loadingState: "active",
    preludeVisible: false,
    projection: "fallback",
    ready: "true",
    source: "fallback",
    titleAnimation: "lubirth-home-title"
  });
});

test("homepage chapter targets are unique and unfinished rail items are inert", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 7_000 });
  await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight * 2, null, {
    timeout: 35_000
  });
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.9, behavior: "instant" }));
  await page.waitForFunction(() => (window.__MiraLithOpeningProgress ?? 0) > 0.82);

  await expect(page.locator("#lubirth-project-intro-title")).toHaveCount(1);
  await expect(page.locator("#lubirth-project-intro-anchor")).toHaveCount(1);
  await expect(page.locator("#miralith-chapter-radio-gaga")).toHaveCount(0);
  await expect(page.locator("#miralith-chapter-coscroll")).toHaveCount(0);

  const rail = page.locator(".lubirth-revised__title-rail");
  await expect(rail.locator("a")).toHaveCount(1);
  await expect(rail.locator("a")).toHaveAttribute("href", /#lubirth-project-intro-anchor$/);
  await expect(rail.locator("[aria-disabled='true']")).toHaveCount(6);
  await expect(rail.locator("[aria-disabled='true']").first()).toHaveAttribute("tabindex", "-1");
  await expect(page.locator(".lubirth-revised__mobile-title-bar a")).toHaveAttribute(
    "href",
    /#lubirth-project-intro-anchor$/
  );
});

test("homepage loading moon draws clockwise then swaps to a closed circular projection", async ({ page }) => {
  await page.goto("/?visual=fallback&visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const moonProjection = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const moonSvg = document.querySelector<SVGSVGElement>(".lubirth-revised__home-loading-moon");
    const circles = Array.from(document.querySelectorAll<SVGCircleElement>(".lubirth-revised__home-loading-moon-path"));
    const draw = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--draw");
    const complete = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--complete");

    if (!root || !moonSvg || !draw || !complete) {
      return null;
    }

    const drawBounds = draw.getBBox();
    const completeBounds = complete.getBBox();
    const drawStyle = window.getComputedStyle(draw);
    const completeStyle = window.getComputedStyle(complete);

    return {
      drawAnimationName: drawStyle.animationName,
      drawDasharray: drawStyle.strokeDasharray,
      drawPathLength: draw.getAttribute("pathLength"),
      completeAnimationName: completeStyle.animationName,
      completeDasharray: completeStyle.strokeDasharray,
      completePathLength: complete.getAttribute("pathLength"),
      circleCount: circles.length,
      drawCx: draw.getAttribute("cx"),
      drawCy: draw.getAttribute("cy"),
      drawR: draw.getAttribute("r"),
      completeCx: complete.getAttribute("cx"),
      completeCy: complete.getAttribute("cy"),
      completeR: complete.getAttribute("r"),
      sameStrokeWidth: drawStyle.strokeWidth === completeStyle.strokeWidth,
      strokeLinecap: drawStyle.strokeLinecap,
      completeStrokeLinecap: completeStyle.strokeLinecap,
      transform: draw.getAttribute("transform"),
      completeTransform: complete.getAttribute("transform"),
      width: Math.round(drawBounds.width),
      height: Math.round(drawBounds.height),
      completeWidth: Math.round(completeBounds.width),
      completeHeight: Math.round(completeBounds.height)
    };
  });

  expect(await moonProjection.jsonValue()).toMatchObject({
    circleCount: 2,
    drawCx: "60",
    drawCy: "60",
    drawR: "52",
    completeCx: "60",
    completeCy: "60",
    completeR: "52",
    drawDasharray: "1px",
    drawPathLength: "1",
    completeDasharray: "none",
    completePathLength: null,
    sameStrokeWidth: true,
    strokeLinecap: "butt",
    completeStrokeLinecap: "butt",
    transform: "rotate(-90 60 60)",
    completeTransform: null,
    width: 104,
    height: 104,
    completeWidth: 104,
    completeHeight: 104
  });

  const closedMoonProjection = await page.waitForFunction(() => {
    const draw = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--draw");
    const complete = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--complete");

    if (!draw || !complete) {
      return null;
    }

    const drawStyle = window.getComputedStyle(draw);
    const completeStyle = window.getComputedStyle(complete);
    const drawOpacity = Number.parseFloat(drawStyle.opacity);
    const completeOpacity = Number.parseFloat(completeStyle.opacity);
    const drawDashOffset = Number.parseFloat(drawStyle.strokeDashoffset);

    if (completeOpacity < 0.82 || drawOpacity > 0.12 || drawDashOffset > 0.02) {
      return null;
    }

    return {
      completeOpacity,
      completeDasharray: completeStyle.strokeDasharray,
      drawOpacity,
      drawDashOffset,
      sameStrokeWidth: drawStyle.strokeWidth === completeStyle.strokeWidth
    };
  });

  expect(await closedMoonProjection.jsonValue()).toMatchObject({
    completeDasharray: "none",
    sameStrokeWidth: true
  });
});

test("homepage first visible loading contour uses scene projection", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const firstVisibleContour = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const moonDraw = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--draw");
    const moonComplete = document.querySelector<SVGCircleElement>(".lubirth-revised__home-loading-moon-path--complete");
    const contour = document.querySelector<SVGPathElement>(".lubirth-revised__home-loading-contour-path--line");
    const contourSvg = document.querySelector<SVGSVGElement>(".lubirth-revised__home-loading-contour");
    const projectionFrame = window.__MiraLithHomeProjectionFrame;

    if (!root || !overlay || !moonDraw || !moonComplete || !contour || !contourSvg || !projectionFrame) {
      return null;
    }

    const overlayStyle = window.getComputedStyle(overlay);
    const overlayOpacity = Number.parseFloat(overlayStyle.opacity);
    const moonDrawStyle = window.getComputedStyle(moonDraw);
    const moonCompleteStyle = window.getComputedStyle(moonComplete);
    const moonDrawOpacity = Number.parseFloat(moonDrawStyle.opacity);
    const moonCompleteOpacity = Number.parseFloat(moonCompleteStyle.opacity);
    const moonDrawDashOffset = Number.parseFloat(moonDrawStyle.strokeDashoffset);
    const opacity = Number.parseFloat(window.getComputedStyle(contour).opacity);
    if (overlayStyle.visibility === "hidden" || overlayOpacity <= 0.2) {
      return null;
    }

    if (
      opacity <= 0.05 ||
      ((moonDrawOpacity <= 0.05 || moonDrawDashOffset >= 0.98) && moonCompleteOpacity <= 0.05)
    ) {
      return null;
    }

    return {
      loadingState: root.dataset.homeLoading,
      overlayOpacity,
      moonDrawDashOffset,
      moonDrawOpacity,
      moonCompleteOpacity,
      opacity,
      contourPath: contour.getAttribute("d"),
      contourLineSegments: (contour.getAttribute("d")?.match(/\bL\b/g) ?? []).length,
      projectionPath: projectionFrame.earthHorizonPath,
      contourViewBox: contourSvg.getAttribute("viewBox"),
      projectionViewBox: `0 0 ${projectionFrame.width} ${projectionFrame.height}`,
      projection: overlay.dataset.projection,
      rootProjection: root.dataset.homeProjection,
      visualProjection: root.dataset.homeProjectionVisual,
      source: window.__MiraLithHomeLoadingReadySource
    };
  });

  expect(await firstVisibleContour.jsonValue()).toMatchObject({
    loadingState: "active",
    projection: "scene",
    rootProjection: "scene",
    contourPath: expect.any(String),
    projectionPath: expect.any(String),
    visualProjection: "scene",
    source: "scene"
  });
  const visibleContour = await firstVisibleContour.jsonValue();
  expect(visibleContour.contourPath).toBe(visibleContour.projectionPath);
  expect(visibleContour.contourViewBox).toBe(visibleContour.projectionViewBox);
  expect(visibleContour.contourLineSegments).toBeGreaterThanOrEqual(120);
  expect(visibleContour.contourPath).toContain(" L ");
  expect(visibleContour.contourPath).not.toContain(" Q ");
});

test("homepage scroll moves LuBirth into the title list and reveals the project intro", async ({ page }) => {
  await page.goto("/");
  const usesDesktopRail = (page.viewportSize()?.width ?? 0) >= 768;

  await expect(page.getByRole("main", { name: "MiraLith LuBirth opening" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__loading")).toHaveCount(0);
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeLoadingReady === "true";
  });

  await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight * 2, null, {
    timeout: 35_000
  });
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.9, behavior: "instant" }));
  await page.waitForFunction(() => (window.__MiraLithOpeningProgress ?? 0) > 0.82);
  await page.waitForFunction(() => {
    const activeCopy = document.querySelector<HTMLElement>(
      ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-copy"
    );
    const opening = document.querySelector<HTMLElement>(".lubirth-revised__opening-title");

    if (!activeCopy || !opening) {
      return false;
    }

    return (
      Number.parseFloat(window.getComputedStyle(activeCopy).opacity) > 0.85 &&
      window.getComputedStyle(opening).visibility === "hidden"
    );
  });

  const railHandoff = await page.evaluate(() => {
    const opening = document.querySelector<HTMLElement>(".lubirth-revised__opening-title");
    const activeTitle = window.innerWidth >= 768
      ? document.querySelector<HTMLElement>(
          ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-title"
        )
      : document.querySelector<HTMLElement>(".lubirth-revised__mobile-title-title");
    const activeMeta = document.querySelector<HTMLElement>(
      ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-meta"
    );
    const inactiveTitle = document.querySelector<HTMLElement>(
      ".lubirth-revised__title-rail li:not([data-active='true']) .lubirth-revised__rail-title"
    );
    const activeCopy = document.querySelector<HTMLElement>(
      ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-copy"
    );

    if (!opening || !activeTitle || !inactiveTitle || !activeCopy) {
      return null;
    }

    const openingStyle = window.getComputedStyle(opening);
    const activeTitleStyle = window.getComputedStyle(activeTitle);
    const inactiveTitleStyle = window.getComputedStyle(inactiveTitle);
    const activeCopyStyle = window.getComputedStyle(activeCopy);

    return {
      activeCopyOpacity: Number.parseFloat(activeCopyStyle.opacity),
      activeFontSize: activeTitleStyle.fontSize,
      inactiveFontSize: inactiveTitleStyle.fontSize,
      metaText: activeMeta?.textContent?.replace(/\s+/g, " ").trim(),
      openingOpacity: Number.parseFloat(openingStyle.opacity),
      openingVisibility: openingStyle.visibility
    };
  });
  expect(railHandoff).not.toBeNull();
  expect(railHandoff?.activeCopyOpacity).toBeGreaterThan(0.85);
  if (usesDesktopRail) {
    expect(railHandoff?.activeFontSize).toBe(railHandoff?.inactiveFontSize);
  } else {
    expect(Number.parseFloat(railHandoff?.activeFontSize ?? "0")).toBeGreaterThanOrEqual(15);
  }
  expect(railHandoff?.metaText).toBe("出生时刻的地月合影 / Birth-Time Earth-Moon Portrait");
  expect(railHandoff?.openingOpacity).toBeLessThan(0.08);
  expect(railHandoff?.openingVisibility).toBe("hidden");
  if (usesDesktopRail) {
    await expect(page.locator(".lubirth-revised__title-rail")).toBeVisible();
    await expect(page.locator(".lubirth-revised__title-rail").getByText("Radio Gaga")).toBeVisible();
    await expect(page.locator(".lubirth-revised__title-rail a")).toHaveCount(1);
    await expect(page.locator(".lubirth-revised__title-rail [aria-disabled='true']")).toHaveCount(6);
    await expect(page.locator(".lubirth-revised__title-rail a", { hasText: "LuBirth" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".lubirth-revised__title-rail [aria-disabled='true']", { hasText: "Radio Gaga" })).toBeVisible();
  } else {
    await expect(page.locator(".lubirth-revised__mobile-title-bar")).toBeVisible();
    await expect(page.locator(".lubirth-revised__mobile-title-bar a")).toHaveAttribute("aria-current", "page");
  }
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy-interactive", "true");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-project-interactive", "true");
  await expect(page.locator(".lubirth-revised__project-intro").getByRole("heading", { name: "LuBirth 地月人" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__project-intro").getByText("A cosmological interface")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("homepage scroll handoff stays geometrically aligned through the title rail transfer", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 7_000 });
  await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight * 2, null, {
    timeout: 35_000
  });

  const samples: Array<{
    progress: number;
    maxDelta: number;
    openingVisible: boolean;
    railVisible: boolean;
    expectHiddenVisibility?: boolean;
  }> = [
    { progress: 0.34, maxDelta: 320, openingVisible: true, railVisible: false },
    { progress: 0.52, maxDelta: 56, openingVisible: true, railVisible: false },
    { progress: 0.82, maxDelta: 10, openingVisible: false, railVisible: true, expectHiddenVisibility: true }
  ];

  for (const sample of samples) {
    await page.evaluate((progress) => {
      window.scrollTo({ top: window.innerHeight * 2.1 * progress, behavior: "instant" });
    }, sample.progress);
    await page.waitForFunction(
      (progress) => Math.abs((window.__MiraLithOpeningProgress ?? 0) - progress) < 0.08,
      sample.progress
    );

    const geometry = await page.evaluate(() => {
      const opening = document.querySelector<HTMLElement>(".lubirth-revised__opening-title");
      const activeTitle = document.querySelector<HTMLElement>(
        ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-title"
      );

      if (!opening || !activeTitle) {
        return null;
      }

      const openingBounds = opening.getBoundingClientRect();
      const titleBounds = activeTitle.getBoundingClientRect();
      const openingStyle = window.getComputedStyle(opening);
      const activeStyle = window.getComputedStyle(activeTitle);

      return {
        delta: Math.hypot(openingBounds.left - titleBounds.left, openingBounds.top - titleBounds.top),
        openingOpacity: Number.parseFloat(openingStyle.opacity),
        openingVisibility: openingStyle.visibility,
        railVisible: activeStyle.visibility !== "hidden" && Number.parseFloat(activeStyle.opacity) > 0.5
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.delta).toBeLessThanOrEqual(sample.maxDelta);
    if (sample.railVisible) {
      expect(geometry?.railVisible).toBe(true);
    }
    if (sample.openingVisible) {
      expect(geometry?.openingOpacity).toBeGreaterThan(0.35);
      expect(geometry?.openingVisibility).toBe("visible");
    } else {
      expect(geometry?.openingOpacity).toBeLessThan(0.12);
      if (sample.expectHiddenVisibility) {
        expect(geometry?.openingVisibility).toBe("hidden");
      }
    }
  }
});

test("homepage intro can be skipped with keyboard input", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-runtime", "ready");
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeSkipReady === "true" && root.dataset.homeIntroComplete === "false";
  });
  await expect(page.locator(".lubirth-revised__home-loading")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 2_500 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-intro-complete", "true");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy-interactive", "false");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-project-interactive", "false");
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible();
});

test("homepage wheel and touch skip fade without leaking scroll into the pinned intro", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeSkipReady === "true" && root.dataset.homeIntroComplete === "false";
  });
  await expect(page.locator(".lubirth-revised__home-loading")).toHaveCount(1);

  const wheelPrevented = await page.evaluate(() => {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 900 });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(wheelPrevented).toBe(true);

  const wheelSkipState = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const openingTitle = document.querySelector<HTMLElement>(".lubirth-revised__opening-title");

    const overlayStyle = overlay ? window.getComputedStyle(overlay) : null;
    const openingStyle = openingTitle ? window.getComputedStyle(openingTitle) : null;
    return {
      copyInteractive: root?.dataset.copyInteractive,
      openingVisible: openingStyle?.visibility !== "hidden" && Number.parseFloat(openingStyle?.opacity ?? "0") > 0.5,
      overlayOpacity: Number.parseFloat(overlayStyle?.opacity ?? "0"),
      overlayVisible: overlayStyle?.visibility !== "hidden",
      scrollY: window.scrollY
    };
  });

  expect(wheelSkipState.scrollY).toBeLessThanOrEqual(2);
  expect(wheelSkipState.copyInteractive).toBe("false");
  expect(wheelSkipState.openingVisible).toBe(true);

  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 2_500 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-intro-complete", "true");
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
  await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight * 2, null, {
    timeout: 35_000
  });
  await page.mouse.wheel(0, 900);
  await page.waitForFunction(() => window.scrollY > 20, null, { timeout: 2_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeSkipReady === "true" && root.dataset.homeIntroComplete === "false";
  });
  const touchPrevented = await page.evaluate(() => {
    const event = new Event("touchstart", { bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(touchPrevented).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
});

test("mobile landscape keeps the two-line LuBirth opening usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-landscape", "mobile landscape only");

  await page.goto("/");

  await expect(page.locator(".lubirth-revised__loading")).toBeHidden({ timeout: 25_000 });
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__opening-title").getByText("地月人")).toBeVisible();
  await expect(page.locator(".lubirth-revised__project-intro")).toBeHidden();
});

test("homepage production canvas renders nonblank pixels", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible");
  await expect(page.locator(".lubirth-revised__loading")).toBeHidden({ timeout: 25_000 });

  const nonblank = await page.waitForFunction(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return false;
    }

    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) {
      return false;
    }
    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) {
        return true;
      }
    }
    return false;
  });

  expect(await nonblank.jsonValue()).toBe(true);
});

test("homepage forced visual fallback keeps DOM content available", async ({ page }) => {
  await page.goto("/?visual=fallback");

  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="lubirth"]')).toBeVisible();
  await expect(page.locator(".lubirth-revised__loading")).toBeHidden({ timeout: 25_000 });
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__opening-title").getByText("地月人")).toBeVisible();
  const marker = await page.waitForFunction(() => window.__MiraLithFirstUsableAt, null, { timeout: 6000 });
  expect(await marker.jsonValue()).toBeGreaterThanOrEqual(
    await page.evaluate(() => window.__MiraLithHomeIntroCompleteAt ?? 0)
  );
  expect(await marker.jsonValue()).toBeLessThan(5_800);
});

test("homepage visual pixel mode removes visible copy", async ({ page }) => {
  await page.goto("/?visualTest=pixels", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy", "hidden");
  await expect(page.locator(".lubirth-revised__home-loading")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__opening-title")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__project-intro")).toHaveCount(0);
  await expect(page.locator(".lubirth-revised__title-rail")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("homepage reduced motion skips pinned scroll choreography", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy-interactive", "false");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-project-interactive", "true");
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__project-intro").getByRole("heading", { name: "LuBirth 地月人" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__title-rail")).toBeHidden();

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(scrollHeight).toBeLessThanOrEqual(Math.ceil(viewportHeight * 1.35));
});

test("homepage first screen transfer budget stays below 3MB", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 7_000 });
  const total = await page.evaluate(() => {
    const firstUsableAt = window.__MiraLithFirstUsableAt ?? performance.now();
    const entries = [
      ...performance.getEntriesByType("navigation"),
      ...performance.getEntriesByType("resource")
    ] as PerformanceResourceTiming[];

    return entries
      .filter((entry) => entry.name.startsWith(window.location.origin))
      .filter((entry) => entry.startTime <= firstUsableAt)
      .reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
  });

  expect(total).toBeLessThanOrEqual(3_000_000);
});
