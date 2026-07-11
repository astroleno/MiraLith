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
    __MiraLithRadioSceneEnvironmentActive?: boolean;
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

const HOME_INTRO_TIMEOUT_MS = 20_000;

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

test("homepage defers Radio Gaga assets until the second act is near", async ({ page }) => {
  const radioAssets: string[] = [];
  page.on("request", (request) => {
    if (/radio_gaga|xiaozhi_esp32|website1|website2/i.test(request.url())) {
      radioAssets.push(request.url());
    }
  });

  await page.goto("/");
  await page.waitForTimeout(500);
  expect(radioAssets).toEqual([]);

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-intro-complete", "true", {
    timeout: 15_000
  });
  await page.locator('[data-home-chapter="radio-gaga"]').scrollIntoViewIfNeeded();
  await expect.poll(() => radioAssets.length, { timeout: 15_000 }).toBeGreaterThan(0);
});

test("homepage switches the shared scene to Radio Gaga and restores LuBirth", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible");

  const home = page.locator(".lubirth-revised");
  await expect(home).toHaveAttribute("data-home-scene", "lubirth");
  await expect(page.locator('[data-visual-canvas="production"]')).toHaveCount(1);
  await expect(home).toHaveAttribute("data-home-intro-complete", "true", { timeout: 15_000 });

  await page.locator('[data-home-chapter="radio-gaga"]').scrollIntoViewIfNeeded();
  await expect(home).toHaveAttribute("data-home-scene", "radio-gaga", { timeout: 15_000 });
  await expect(page.locator('[data-visual-canvas="production"]')).toHaveCount(1);
  await expect(
    page.locator(".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-title")
  ).toHaveText("Radio Gaga");
  await page.waitForFunction(() => window.__MiraLithRadioSceneEnvironmentActive === true);

  const radioPixels = await page.waitForFunction(() => {
    const source = document.querySelector("canvas");
    if (!source) return false;
    const sample = document.createElement("canvas");
    sample.width = 32;
    sample.height = 32;
    const context = sample.getContext("2d");
    if (!context) return false;
    context.drawImage(source, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    return pixels.some((value, index) => index % 4 !== 3 && value > 8);
  });
  expect(await radioPixels.jsonValue()).toBe(true);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(home).toHaveAttribute("data-home-scene", "lubirth", { timeout: 15_000 });
  await page.waitForFunction(() => window.__MiraLithRadioSceneEnvironmentActive === false);
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

test("homepage exits loading within bounded scene and fallback budgets", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 10_000 });
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

  expect(sceneTiming.source).toMatch(/^(scene|fallback)$/);
  expect(sceneTiming.visualSource).toMatch(/^(day-texture|grace)$/);
  expect(sceneTiming.canvasCreatedAt).toBeGreaterThan(0);
  expect(sceneTiming.memoryImageReadyAt ?? 0).toBeGreaterThan(0);
  expect(sceneTiming.projectionReadyAt).toBeGreaterThan(0);
  expect(sceneTiming.visualReadyAt).toBeGreaterThan(0);
  expect(sceneTiming.completeAt).toBeGreaterThanOrEqual(sceneTiming.projectionReadyAt ?? 0);
  expect(sceneTiming.completeAt).toBeGreaterThanOrEqual(sceneTiming.visualReadyAt ?? 0);
  const sceneCompleteAfterCanvas = (sceneTiming.completeAt ?? Number.POSITIVE_INFINITY) - (sceneTiming.canvasCreatedAt ?? 0);
  const sceneUsableAfterCanvas = (sceneTiming.firstUsableAt ?? Number.POSITIVE_INFINITY) - (sceneTiming.canvasCreatedAt ?? 0);
  expect(sceneCompleteAfterCanvas).toBeLessThanOrEqual(9_000);
  expect(sceneTiming.firstUsableAt).toBeGreaterThanOrEqual(sceneTiming.completeAt ?? 0);
  expect(sceneUsableAfterCanvas).toBeLessThanOrEqual(9_200);

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
  expect(fallbackTiming.completeAt).toBeLessThanOrEqual(7_000);
  expect(fallbackTiming.firstUsableAt).toBeGreaterThanOrEqual(fallbackTiming.completeAt ?? 0);
  expect(fallbackTiming.firstUsableAt).toBeLessThanOrEqual(7_200);
});

test("homepage authors the memory face with a four-second hold", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const authoredHold = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const memory = document.querySelector<HTMLElement>(".lubirth-revised__home-loading-memory");
    if (!root || !memory || root.dataset.homeLoading !== "active") {
      return null;
    }

    const style = window.getComputedStyle(memory);
    return {
      animationDelay: style.animationDelay,
      animationDuration: style.animationDuration,
      animationName: style.animationName
    };
  }, null, { timeout: HOME_INTRO_TIMEOUT_MS });

  const hold = await authoredHold.jsonValue();
  expect(hold.animationName).toMatch(/^lubirth-home-memory/);
  expect(Number.parseFloat(hold.animationDuration)).toBeGreaterThanOrEqual(4);
  expect(Number.parseFloat(hold.animationDelay)).toBeGreaterThanOrEqual(0.3);
});

test("homepage renders the LuBirth two-line opening in one production-owned canvas", async ({ page }) => {
  await page.goto("/?progress=0&copy=visible");

  await expect(page.getByLabel("MiraLith LuBirth opening frame")).toBeVisible();
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible({
    timeout: 10_000
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
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: HOME_INTRO_TIMEOUT_MS });
  await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight * 2, null, {
    timeout: 35_000
  });
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.9, behavior: "instant" }));
  await page.waitForFunction(() => (window.__MiraLithOpeningProgress ?? 0) > 0.82);
  await page.waitForTimeout(1_000);

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

test("homepage loading contour uses a coherent projection source", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const projectionState = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const contour = document.querySelector<SVGPathElement>(".lubirth-revised__home-loading-contour-path--line");
    const contourSvg = document.querySelector<SVGSVGElement>(".lubirth-revised__home-loading-contour");
    const projectionFrame = window.__MiraLithHomeProjectionFrame;
    const source = window.__MiraLithHomeLoadingReadySource;

    if (
      !root ||
      !overlay ||
      !contour ||
      !contourSvg ||
      root.dataset.homeLoadingReady !== "true" ||
      (source !== "scene" && source !== "fallback")
    ) {
      return null;
    }

    return {
      loadingState: root.dataset.homeLoading,
      contourPath: contour.getAttribute("d"),
      contourLineSegments: (contour.getAttribute("d")?.match(/\bL\b/g) ?? []).length,
      projectionPath: projectionFrame?.earthHorizonPath,
      contourViewBox: contourSvg.getAttribute("viewBox"),
      projectionViewBox: projectionFrame ? `0 0 ${projectionFrame.width} ${projectionFrame.height}` : undefined,
      projection: overlay.dataset.projection,
      rootProjection: root.dataset.homeProjection,
      visualProjection: root.dataset.homeProjectionVisual,
      source
    };
  });

  const resolvedProjection = await projectionState.jsonValue();
  expect(resolvedProjection).toMatchObject({
    loadingState: "active",
    contourPath: expect.any(String)
  });
  expect(resolvedProjection.projection).toBe(resolvedProjection.source);
  expect(resolvedProjection.rootProjection).toBe(resolvedProjection.source);
  expect(resolvedProjection.visualProjection).toBe(resolvedProjection.source);
  if (resolvedProjection.source === "scene") {
    expect(resolvedProjection.contourPath).toBe(resolvedProjection.projectionPath);
    expect(resolvedProjection.contourViewBox).toBe(resolvedProjection.projectionViewBox);
    expect(resolvedProjection.contourLineSegments).toBeGreaterThanOrEqual(120);
    expect(resolvedProjection.contourPath).toContain(" L ");
    expect(resolvedProjection.contourPath).not.toContain(" Q ");
  }
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
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-intro-complete", "true", {
    timeout: HOME_INTRO_TIMEOUT_MS
  });

  await page.waitForFunction(() => document.documentElement.scrollHeight > window.innerHeight * 2, null, {
    timeout: 35_000
  });
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.9, behavior: "instant" }));
  await page.waitForFunction(() => (window.__MiraLithOpeningProgress ?? 0) > 0.82);
  await page.goto("/?progress=0.9&copy=visible");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-motion", "debug");

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

test("homepage exposes stable LuBirth opening and title-rail handoff endpoints", async ({ page }) => {
  const usesDesktopRail = (page.viewportSize()?.width ?? 0) >= 768;

  await page.goto("/?progress=0.34&copy=visible");
  const openingSurface = page.locator(".lubirth-revised__opening-title");
  const titleSurface = usesDesktopRail
    ? page.locator(".lubirth-revised__title-rail")
    : page.locator(".lubirth-revised__mobile-title-bar");
  await expect(openingSurface).toBeVisible();
  await expect(titleSurface).toBeHidden();

  await page.goto("/?progress=0.82&copy=visible");
  await expect(openingSurface).toBeHidden();
  await expect(titleSurface).toBeVisible();

  const activeTitle = usesDesktopRail
    ? page.locator(".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-title")
    : page.locator(".lubirth-revised__mobile-title-title");
  await expect(activeTitle).toHaveText("LuBirth");
  const titleBounds = await activeTitle.boundingBox();
  const viewport = page.viewportSize();
  expect(titleBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(titleBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(titleBounds?.y ?? -13).toBeGreaterThanOrEqual(-12);
  expect((titleBounds?.x ?? 0) + (titleBounds?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect((titleBounds?.y ?? 0) + (titleBounds?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
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
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 8_000 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-intro-complete", "true");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy-interactive", "false");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-project-interactive", "false");
  await expect(page.locator(".lubirth-revised__opening-title h1")).toHaveText("LuBirth");
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
  expect(wheelSkipState.overlayVisible).toBe(true);
  expect(wheelSkipState.overlayOpacity).toBeGreaterThan(0);

  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 4_000 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-intro-complete", "true");
  await expect(page.locator(".lubirth-revised__opening-title h1")).toHaveText("LuBirth");
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
  const restoredOverflow = await page.evaluate(() => ({
    body: document.body.style.overflow,
    html: document.documentElement.style.overflow
  }));
  expect(restoredOverflow.body).not.toBe("hidden");
  expect(restoredOverflow.html).not.toBe("hidden");

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

test("homepage reduced motion skips the LuBirth pin while keeping Radio Gaga readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy-interactive", "false");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-project-interactive", "true");
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__project-intro").getByRole("heading", { name: "LuBirth 地月人" })).toBeVisible();
  await expect(page.locator(".lubirth-revised__title-rail")).toBeHidden();

  const lubirthHeight = await page.locator(".lubirth-revised").evaluate((element) => element.offsetHeight);
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(lubirthHeight).toBeLessThanOrEqual(Math.ceil(viewportHeight * 1.35));
  expect(scrollHeight).toBeGreaterThan(viewportHeight * 5);

  const radioChapter = page.locator('[data-home-chapter="radio-gaga"]');
  await expect(radioChapter.locator('[data-radio-gaga-experience="home"]')).toHaveCount(1, { timeout: 15_000 });
  await radioChapter.scrollIntoViewIfNeeded();
  await expect(radioChapter.locator('[data-radio-gaga-motion="reduced"]')).toBeVisible();
  await expect(
    radioChapter.getByText("把附近发生的事，变成家里听得懂的一句提醒", { exact: true }).first()
  ).toBeVisible();
  await expect(page.locator('[data-visual-canvas="production"]')).toHaveCount(1);
});

test("homepage first screen transfer stays below 6MB", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: HOME_INTRO_TIMEOUT_MS });
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

  expect(total).toBeLessThanOrEqual(6_000_000);
});
