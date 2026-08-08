import { expect, test, type Page } from "@playwright/test";

const previewQuery = "?preview=post-coscroll-v1";

async function waitForIdle(page: Page) {
  await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "idle", {
    timeout: 12_000
  });
}

async function expectDirectRouteWithoutVeil(page: Page, routeId: string, href: string) {
  await page.goto(href);
  await expect(page).toHaveURL(new RegExp(`${href.replace("/", "\\/")}$`));
  await expect(page.locator(`[data-post-coscroll-route='${routeId}']`)).toBeVisible();
  await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "idle");
}

test("known post-CoScroll routes mount directly without a permanent transition veil", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The deterministic route-shell contract needs one desktop profile.");

  await expectDirectRouteWithoutVeil(page, "artbreeze", "/artbreeze");
  await expect(page.locator("[data-post-coscroll-route='artbreeze'] video")).toHaveCount(0);

  await expectDirectRouteWithoutVeil(page, "constellation", "/constellation");
  await expectDirectRouteWithoutVeil(page, "client-works", "/client-works");
  await expectDirectRouteWithoutVeil(page, "now-building", "/now-building");
});

test("a preview review rail can traverse CoScroll through all known post-CoScroll routes and history", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The review rail contract needs one desktop profile.");

  await page.goto(`/coscroll${previewQuery}`);
  await expect(page).toHaveURL(/\/coscroll$/);

  await page.locator("a[aria-label^='04 ArtBreeze']").click();
  await expect(page).toHaveURL(/\/artbreeze$/);
  await waitForIdle(page);
  await expect(page.locator("[data-post-coscroll-route='artbreeze']")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  await page.goForward();
  await expect(page).toHaveURL(/\/artbreeze$/);
  await waitForIdle(page);

  for (const chapter of [
    { index: "05", title: "Floating Constellation", routeId: "constellation", href: "/constellation" },
    { index: "06", title: "Client Works", routeId: "client-works", href: "/client-works" },
    { index: "07", title: "Now Building", routeId: "now-building", href: "/now-building" }
  ]) {
    await page.locator(`a[aria-label^='${chapter.index} ${chapter.title}']`).click();
    await expect(page).toHaveURL(new RegExp(`${chapter.href}$`));
    await waitForIdle(page);
    await expect(page.locator(`[data-post-coscroll-route='${chapter.routeId}']`)).toBeVisible();
  }
});

test("the CoScroll to ArtBreeze coordinator remains covered until its poster is ready", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The destination readiness contract needs one desktop profile.");

  let posterRequested = false;
  let releasePoster!: () => void;
  const heldPoster = new Promise<void>((resolve) => {
    releasePoster = resolve;
  });
  await page.route("**/media/post-coscroll/artbreeze-first-sequence/poster.jpg", async (route) => {
    posterRequested = true;
    await heldPoster;
    await route.continue();
  });

  try {
    await page.goto(`/coscroll${previewQuery}`);
    await page.locator("a[aria-label^='04 ArtBreeze']").click();
    await expect(page).toHaveURL(/\/artbreeze$/);
    await expect.poll(() => posterRequested).toBe(true);
    await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "waiting-ready");

    releasePoster();
    await expect(page.locator("[data-post-coscroll-route='artbreeze']")).toBeVisible();
    await waitForIdle(page);
  } finally {
    releasePoster();
    await page.unroute("**/media/post-coscroll/artbreeze-first-sequence/poster.jpg");
  }
});

test("a failed ArtBreeze poster releases the covered coordinator through its verified fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The destination fallback contract needs one desktop profile.");

  let posterRequested = false;
  let releasePoster!: () => void;
  const heldPoster = new Promise<void>((resolve) => {
    releasePoster = resolve;
  });
  await page.route("**/media/post-coscroll/artbreeze-first-sequence/poster.jpg", async (route) => {
    posterRequested = true;
    await heldPoster;
    await route.fulfill({
      status: 503,
      contentType: "text/plain",
      body: "Injected local-preview poster failure"
    });
  });

  try {
    await page.goto(`/coscroll${previewQuery}`);
    await page.locator("a[aria-label^='04 ArtBreeze']").click();
    await expect(page).toHaveURL(/\/artbreeze$/);
    await expect.poll(() => posterRequested).toBe(true);
    await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "waiting-ready");

    releasePoster();
    const artBreeze = page.locator("[data-post-coscroll-route='artbreeze']");
    await expect(artBreeze).toHaveAttribute("data-post-coscroll-poster-state", "error");
    await expect(artBreeze).toHaveAttribute("data-post-coscroll-fallback", "true");
    await expect(artBreeze.locator("[data-post-coscroll-fallback-content]")).toBeVisible();
    await waitForIdle(page);

    const nextChapter = artBreeze.locator("a[aria-label^='05 Floating Constellation']");
    await expect(nextChapter).toBeVisible();
    await nextChapter.click();
    await expect(page).toHaveURL(/\/constellation$/);
    await waitForIdle(page);
  } finally {
    releasePoster();
    await page.unroute("**/media/post-coscroll/artbreeze-first-sequence/poster.jpg");
  }
});

test("ArtBreeze explicitly plays the verified local video instead of treating the poster as playback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The local playback contract needs one desktop profile.");

  await page.goto(`/artbreeze${previewQuery}`);
  const route = page.locator("[data-post-coscroll-route='artbreeze']");
  await expect(route).toHaveAttribute("data-post-coscroll-resolver-status", "ready");
  await expect(route).toHaveAttribute("data-post-coscroll-media-id", "artbreeze-first-sequence");
  await expect(route.locator("video")).toHaveCount(0);

  await page.getByRole("button", { name: "Play verified local ArtBreeze media" }).click();
  const video = route.locator("video");
  await expect(video).toHaveAttribute("src", /\/media\/post-coscroll\/artbreeze-first-sequence\/desktop\.mp4$/);
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
});

test("expired or forged preview evidence hides the review rail but leaves a direct known shell veil-free", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The preview failure boundary needs one desktop profile.");

  await page.goto(`/artbreeze${previewQuery}`);
  await expect(page.locator("a[aria-label^='05 Floating Constellation']")).toBeVisible();
  await page.evaluate(() => window.sessionStorage.removeItem("miralith:chapter-preview:v1"));
  await page.reload();
  await expect(page.locator("a[aria-label^='05 Floating Constellation']")).toHaveCount(0);
  await expect(page.locator("[data-post-coscroll-route='artbreeze']")).toBeVisible();
  await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "idle");

  await page.goto(`/artbreeze${previewQuery}`);
  await expect(page.locator("a[aria-label^='05 Floating Constellation']")).toBeVisible();
  await page.evaluate(() => {
    window.history.replaceState({
      ...(window.history.state as Record<string, unknown>),
      __miralithChapterPreview: { v: 1, scope: "0".repeat(64) }
    }, "");
  });
  await page.reload();
  await expect(page.locator("a[aria-label^='05 Floating Constellation']")).toHaveCount(0);
  await expect(page.locator("[data-post-coscroll-route='artbreeze']")).toBeVisible();
  await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "idle");
});
