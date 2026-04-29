import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __MiraLithFirstUsableAt?: number;
    __MiraLithHomeIntroCompleteAt?: number;
    __MiraLithHomeLoadingReadySource?: "scene" | "fallback";
  }
}

test("homepage keeps readable SSR fallback text before runtime animations", async ({ page }) => {
  await page.goto("/?visual=fallback", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised__home-loading-title")).toBeVisible({ timeout: 2_000 });
  await expect(page.locator(".lubirth-revised__home-loading-subtitle")).toBeVisible({ timeout: 2_000 });
  await expect(page.getByText("MiraLith").first()).toBeVisible({ timeout: 2_000 });
  await expect(page.getByLabel("LuBirth opening status")).toContainText("LuBirth");
});

test("homepage exits loading within the entry budget", async ({ page }) => {
  await page.goto("/?visual=fallback", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 8_000 });
  const completeAt = await page.waitForFunction(() => window.__MiraLithHomeIntroCompleteAt, null, { timeout: 8_000 });
  expect(await completeAt.jsonValue()).toBeLessThan(8_000);
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
    const contour = document.querySelector<SVGPathElement>(
      ".lubirth-revised__home-loading-contour-path:not(.lubirth-revised__home-loading-contour-path--gold)"
    );

    if (!root || !overlay || !contour) {
      return null;
    }

    return {
      animationName: window.getComputedStyle(contour).animationName,
      loadingState: root.dataset.homeLoading,
      projection: overlay.dataset.projection,
      ready: root.dataset.homeLoadingReady
    };
  });

  expect(await holdState.jsonValue()).toEqual({
    animationName: "none",
    loadingState: "hold",
    projection: "pending",
    ready: "false"
  });

  const fallbackState = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const contour = document.querySelector<SVGPathElement>(
      ".lubirth-revised__home-loading-contour-path:not(.lubirth-revised__home-loading-contour-path--gold)"
    );

    if (!root || !overlay || !contour || root.dataset.homeProjection !== "fallback") {
      return null;
    }

    return {
      animationName: window.getComputedStyle(contour).animationName,
      loadingState: root.dataset.homeLoading,
      projection: overlay.dataset.projection,
      ready: root.dataset.homeLoadingReady,
      source: window.__MiraLithHomeLoadingReadySource
    };
  });

  expect(await fallbackState.jsonValue()).toEqual({
    animationName: "lubirth-home-contour",
    loadingState: "active",
    projection: "fallback",
    ready: "true",
    source: "fallback"
  });
});

test("homepage loading moon draws a circular projection clockwise from twelve", async ({ page }) => {
  await page.goto("/?visual=fallback&visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const moonProjection = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const moonSvg = document.querySelector<SVGSVGElement>(".lubirth-revised__home-loading-moon");
    const paths = Array.from(document.querySelectorAll<SVGPathElement>(".lubirth-revised__home-loading-moon-path"));
    const path = paths[0];

    if (!root || !moonSvg || !path) {
      return null;
    }

    const bounds = path.getBBox();

    return {
      animationName: window.getComputedStyle(path).animationName,
      pathCount: paths.length,
      d: path.getAttribute("d"),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
  });

  expect(await moonProjection.jsonValue()).toMatchObject({
    animationName: "none",
    pathCount: 1,
    d: expect.stringMatching(/^M60 8/),
    width: 104,
    height: 104
  });
});

test("homepage first visible loading contour uses scene projection", async ({ page }) => {
  await page.goto("/?visualTest=pixels&copy=visible", { waitUntil: "domcontentloaded" });

  const firstVisibleContour = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    const overlay = document.querySelector<HTMLElement>(".lubirth-revised__home-loading");
    const moon = document.querySelector<SVGPathElement>(".lubirth-revised__home-loading-moon-path--projection");
    const contour = document.querySelector<SVGPathElement>(
      ".lubirth-revised__home-loading-contour-path:not(.lubirth-revised__home-loading-contour-path--gold)"
    );

    if (!root || !overlay || !moon || !contour) {
      return null;
    }

    const overlayStyle = window.getComputedStyle(overlay);
    const overlayOpacity = Number.parseFloat(overlayStyle.opacity);
    const moonStyle = window.getComputedStyle(moon);
    const moonOpacity = Number.parseFloat(moonStyle.opacity);
    const moonDashOffset = Number.parseFloat(moonStyle.strokeDashoffset);
    const opacity = Number.parseFloat(window.getComputedStyle(contour).opacity);
    if (overlayStyle.visibility === "hidden" || overlayOpacity <= 0.2) {
      return null;
    }

    if (moonOpacity <= 0.05 || moonDashOffset >= 0.98 || opacity <= 0.05) {
      return null;
    }

    return {
      loadingState: root.dataset.homeLoading,
      overlayOpacity,
      moonDashOffset,
      moonOpacity,
      opacity,
      projection: overlay.dataset.projection,
      rootProjection: root.dataset.homeProjection,
      source: window.__MiraLithHomeLoadingReadySource
    };
  });

  expect(await firstVisibleContour.jsonValue()).toMatchObject({
    loadingState: "active",
    projection: "scene",
    rootProjection: "scene",
    source: "scene"
  });
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
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.45, behavior: "instant" }));
  await page.waitForFunction(() => (window.__MiraLithOpeningProgress ?? 0) > 0.64);

  const dockedTitle = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>(".lubirth-revised__opening-title");
    const target =
      window.innerWidth >= 768
        ? document.querySelector<HTMLElement>(
            ".lubirth-revised__title-rail li[data-active='true'] .lubirth-revised__rail-title"
          )
        : document.querySelector<HTMLElement>(".lubirth-revised__mobile-title-title");

    if (!title || !target) {
      return null;
    }

    const titleBounds = title.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const titleStyle = window.getComputedStyle(title);

    return {
      left: titleBounds.left,
      leftDelta: Math.abs(titleBounds.left - targetBounds.left),
      topDelta: Math.abs(titleBounds.top - targetBounds.top),
      visible: titleStyle.visibility !== "hidden" && Number.parseFloat(titleStyle.opacity) > 0.8
    };
  });
  expect(dockedTitle).not.toBeNull();
  expect(dockedTitle?.left).toBeLessThan(140);
  expect(dockedTitle?.leftDelta).toBeLessThanOrEqual(8);
  expect(dockedTitle?.topDelta).toBeLessThanOrEqual(8);
  expect(dockedTitle?.visible).toBe(true);
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible();
  if (usesDesktopRail) {
    await expect(page.locator(".lubirth-revised__title-rail")).toBeVisible();
    await expect(page.locator(".lubirth-revised__title-rail").getByText("Radio Gaga")).toBeVisible();
    await expect(page.locator(".lubirth-revised__title-rail a")).toHaveCount(7);
    await expect(page.locator(".lubirth-revised__title-rail a", { hasText: "LuBirth" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".lubirth-revised__title-rail a", { hasText: "Radio Gaga" })).toBeVisible();
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

test("homepage intro can be skipped with keyboard input", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-runtime", "ready");
  await page.keyboard.press("Enter");
  await expect(page.locator(".lubirth-revised__home-loading")).toBeHidden({ timeout: 1_500 });
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-home-intro-complete", "true");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy-interactive", "false");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-project-interactive", "false");
  await expect(page.locator(".lubirth-revised__opening-title").getByRole("heading", { name: "LuBirth" })).toBeVisible();
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
  const marker = await page.waitForFunction(() => window.__MiraLithFirstUsableAt, null, { timeout: 3000 });
  expect(await marker.jsonValue()).toBeLessThan(3000);
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
  const responseSizes: Promise<number>[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== "http://127.0.0.1:3100") {
      return;
    }

    responseSizes.push(
      response
        .body()
        .then((body) => body.byteLength)
        .catch(() => 0)
    );
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const total = (await Promise.all(responseSizes)).reduce((sum, value) => sum + value, 0);
  expect(total).toBeLessThanOrEqual(3_000_000);
});
