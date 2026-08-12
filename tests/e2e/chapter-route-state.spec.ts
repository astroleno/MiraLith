import { expect, test, type Page } from "@playwright/test";

const previewQuery = "?preview=post-coscroll-v1";
const returnSnapshotKey = "miralith:chapter-return:/artbreeze";
const maxRevision = 1_000_000_000;

const mediaIds = {
  first: "artbreeze-first-sequence",
  cycle: "artbreeze-cycle",
  prompt: "artbreeze-prompt",
  answer: "artbreeze-answer"
} as const;

async function waitForIdle(page: Page) {
  await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "idle", {
    timeout: 12_000
  });
}

async function enterArtBreeze(page: Page) {
  await page.goto(`/artbreeze${previewQuery}`);
  const route = page.locator("[data-post-coscroll-route='artbreeze']");
  await expect(route).toHaveAttribute("data-post-coscroll-resolver-status", "ready");
  await expect(page.locator("a[aria-label^='05 Floating Constellation']")).toBeVisible();
  return route;
}

async function readPreviewScope(page: Page) {
  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem("miralith:chapter-preview:v1");
    const scope = raw ? (JSON.parse(raw) as { scope?: unknown }).scope : null;
    if (typeof scope !== "string") {
      throw new Error("Expected an active preview scope");
    }
    return scope;
  });
}

interface SeedSnapshotOptions {
  revision?: number;
  buildScope?: string;
  semanticStop?: "entry" | "poster-ready" | "playing" | "media-tail";
  completedMediaIds?: string[];
  skippedMediaIds?: string[];
  activeMedia?: {
    id: string;
    playbackState: "ready" | "playing" | "paused-ready";
    timeSeconds: number;
  } | null;
  gateReleased?: boolean;
  mutePreference?: boolean;
  playbackRequested?: boolean;
  audioEnabled?: boolean;
}

async function seedSnapshot(page: Page, options: SeedSnapshotOptions = {}) {
  const scope = options.buildScope ?? await readPreviewScope(page);
  const snapshot = {
    schema: "chapter-return-v2",
    buildScope: scope,
    pathname: "/artbreeze",
    revision: options.revision ?? 8,
    scrollY: 0,
    routeProgress: null,
    terminalState: false,
    semantic: {
      kind: "semantic",
      semanticStop: options.semanticStop ?? "playing",
      segmentId: "route-shell",
      segmentProgress: options.semanticStop === "media-tail" ? 1 : 0.5,
      narrativeProgress: options.semanticStop === "media-tail" ? 1 : 0.5,
      completedMediaIds: options.completedMediaIds ?? [],
      skippedMediaIds: options.skippedMediaIds ?? [],
      activeMedia: options.activeMedia === undefined
        ? { id: mediaIds.first, playbackState: "playing", timeSeconds: 4 }
        : options.activeMedia,
      gateReleased: options.gateReleased ?? false,
      mutePreference: options.mutePreference ?? true,
      routeState: {
        playbackRequested: options.playbackRequested ?? options.activeMedia !== null,
        audioEnabled: options.audioEnabled ?? false
      }
    },
    timestamp: Date.now()
  };
  await page.evaluate(({ key, value }) => {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, { key: returnSnapshotKey, value: snapshot });
  return snapshot;
}

async function readSnapshot(page: Page) {
  return page.evaluate((key) => {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as {
      revision: number;
      buildScope: string;
      semantic: {
        completedMediaIds: string[];
        skippedMediaIds: string[];
        activeMedia: { id: string; playbackState: string; timeSeconds: number } | null;
        gateReleased: boolean;
        mutePreference: boolean;
      };
    } : null;
  }, returnSnapshotKey);
}

async function seedSnapshotOnNextDocument(page: Page, options: SeedSnapshotOptions) {
  const snapshot = await seedSnapshot(page, options);
  const marker = `miralith:test-seed:${Date.now()}:${Math.random()}`;
  await page.addInitScript(({ key, value, markerKey }) => {
    if (window.sessionStorage.getItem(markerKey) === "done") {
      return;
    }
    window.sessionStorage.setItem(markerKey, "done");
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, { key: returnSnapshotKey, value: snapshot, markerKey: marker });
  return snapshot;
}

async function navigateToConstellationAndBack(page: Page) {
  await page.locator("a[aria-label^='05 Floating Constellation']").click();
  await expect(page).toHaveURL(/\/constellation$/);
  await waitForIdle(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/artbreeze$/);
  await waitForIdle(page);
  return page.locator("[data-post-coscroll-route='artbreeze']");
}

test("restores poster-ready media without mounting or requesting playback", async ({ page }) => {
  let route = await enterArtBreeze(page);
  await expect(route).toHaveAttribute("data-post-coscroll-semantic-stop", "poster-ready");
  await expect(page.getByRole("button", { name: "Play verified local ArtBreeze media" })).toBeEnabled();
  await expect(route.locator("video")).toHaveCount(0);

  route = await navigateToConstellationAndBack(page);
  await expect(route).toHaveAttribute("data-post-coscroll-semantic-stop", "poster-ready");
  await expect(route.locator("video")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play verified local ArtBreeze media" })).toBeEnabled();
});

test("history restore remains covered until the restored poster really loads", async ({ page }) => {
  let holdRestoredPoster = false;
  let restoredPosterRequested = false;
  let releaseRestoredPoster!: () => void;
  const restoredPosterGate = new Promise<void>((resolve) => {
    releaseRestoredPoster = resolve;
  });
  const posterPattern = "**/media/post-coscroll/artbreeze-first-sequence/poster.jpg";
  await page.route(posterPattern, async (route) => {
    if (!holdRestoredPoster) {
      await route.continue();
      return;
    }
    restoredPosterRequested = true;
    await restoredPosterGate;
    await route.continue();
  });

  try {
    const route = await enterArtBreeze(page);
    await expect(route).toHaveAttribute("data-post-coscroll-poster-state", "loaded");
    await page.locator("a[aria-label^='05 Floating Constellation']").click();
    await expect(page).toHaveURL(/\/constellation$/);
    await waitForIdle(page);

    holdRestoredPoster = true;
    const backNavigation = page.goBack();
    await expect(page).toHaveURL(/\/artbreeze$/);
    await expect.poll(() => restoredPosterRequested).toBe(true);
    await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "waiting-ready");

    releaseRestoredPoster();
    await backNavigation;
    await waitForIdle(page);
    await expect(page.locator("[data-post-coscroll-route='artbreeze']"))
      .toHaveAttribute("data-post-coscroll-poster-state", "loaded");
  } finally {
    releaseRestoredPoster();
    await page.unroute(posterPattern);
  }
});

test("a restored poster failure releases history through fallback readiness", async ({ page }) => {
  let failRestoredPoster = false;
  let restoredPosterRequested = false;
  let releaseRestoredPoster!: () => void;
  const restoredPosterGate = new Promise<void>((resolve) => {
    releaseRestoredPoster = resolve;
  });
  const posterPattern = "**/media/post-coscroll/artbreeze-first-sequence/poster.jpg";
  await page.route(posterPattern, async (route) => {
    if (!failRestoredPoster) {
      await route.continue();
      return;
    }
    restoredPosterRequested = true;
    await restoredPosterGate;
    await route.fulfill({
      status: 503,
      contentType: "text/plain",
      body: "Injected restored poster failure"
    });
  });

  try {
    const route = await enterArtBreeze(page);
    await expect(route).toHaveAttribute("data-post-coscroll-poster-state", "loaded");
    await page.locator("a[aria-label^='05 Floating Constellation']").click();
    await expect(page).toHaveURL(/\/constellation$/);
    await waitForIdle(page);

    failRestoredPoster = true;
    const backNavigation = page.goBack();
    await expect(page).toHaveURL(/\/artbreeze$/);
    await expect.poll(() => restoredPosterRequested).toBe(true);
    await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "waiting-ready");

    releaseRestoredPoster();
    await backNavigation;
    const restoredRoute = page.locator("[data-post-coscroll-route='artbreeze']");
    await expect(restoredRoute).toHaveAttribute("data-post-coscroll-poster-state", "error");
    await expect(restoredRoute).toHaveAttribute("data-post-coscroll-fallback", "true");
    await expect(restoredRoute.locator("[data-post-coscroll-fallback-content]")).toBeVisible();
    await waitForIdle(page);
  } finally {
    releaseRestoredPoster();
    await page.unroute(posterPattern);
  }
});

test("restores active ArtBreeze media near its captured time without audible autoplay", async ({ page }) => {
  const route = await enterArtBreeze(page);
  await page.getByRole("button", { name: "Play verified local ArtBreeze media" }).click();
  const video = route.locator("video");
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate((element) => {
    element.currentTime = 4;
    element.dispatchEvent(new Event("seeked"));
  });
  await page.getByRole("button", { name: "Enable sound" }).click();
  await page.getByRole("button", { name: "Mute sound" }).click();

  const restoredRoute = await navigateToConstellationAndBack(page);
  const restoredVideo = restoredRoute.locator("video");
  await expect(restoredRoute).toHaveAttribute("data-post-coscroll-active-media", mediaIds.first);
  await expect(restoredRoute).toHaveAttribute("data-post-coscroll-playback-state", "paused-ready");
  await expect(restoredVideo).toHaveCount(1);
  await expect.poll(() => restoredVideo.evaluate((element) => element.currentTime)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => restoredVideo.evaluate((element) => element.currentTime)).toBeLessThanOrEqual(6);
  expect(await restoredVideo.evaluate((element) => ({ paused: element.paused, muted: element.muted })))
    .toEqual({ paused: true, muted: true });
});

test("restores completed media without replay and records skip as the latest replay outcome", async ({ page }) => {
  let route = await enterArtBreeze(page);
  await page.getByRole("button", { name: "Play verified local ArtBreeze media" }).click();
  await route.locator("video").dispatchEvent("ended");
  await expect(route).toHaveAttribute("data-post-coscroll-completed-media", mediaIds.first);
  await expect(route).toHaveAttribute("data-post-coscroll-gate-released", "true");
  await expect(route.locator("video")).toHaveCount(0);

  route = await navigateToConstellationAndBack(page);
  await expect(route).toHaveAttribute("data-post-coscroll-completed-media", mediaIds.first);
  await expect(route.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "Replay verified local ArtBreeze media" }).click();
  await expect(route.locator("video")).toHaveCount(1);
  await page.getByRole("button", { name: "Skip verified local ArtBreeze media" }).click();
  await expect(route).toHaveAttribute("data-post-coscroll-completed-media", "");
  await expect(route).toHaveAttribute("data-post-coscroll-skipped-media", mediaIds.first);
  await expect(route.locator("[data-post-coscroll-skipped-summary]")).toBeVisible();
});

test("preserves two completed, one skipped, and a distinct replay item across refresh and history", async ({ page }) => {
  let route = await enterArtBreeze(page);
  await seedSnapshot(page, {
    completedMediaIds: [mediaIds.first, mediaIds.cycle],
    skippedMediaIds: [mediaIds.answer],
    activeMedia: { id: mediaIds.prompt, playbackState: "playing", timeSeconds: 3 },
    gateReleased: true,
    mutePreference: true,
    playbackRequested: true
  });
  await page.reload();
  route = page.locator("[data-post-coscroll-route='artbreeze']");
  await expect(route).toHaveAttribute("data-post-coscroll-completed-media", `${mediaIds.first},${mediaIds.cycle}`);
  await expect(route).toHaveAttribute("data-post-coscroll-skipped-media", mediaIds.answer);
  await expect(route).toHaveAttribute("data-post-coscroll-active-media", mediaIds.prompt);
  await expect(route).toHaveAttribute("data-post-coscroll-gate-released", "true");
  expect(await route.locator("video").evaluate((element) => ({ paused: element.paused, muted: element.muted })))
    .toEqual({ paused: true, muted: true });

  route = await navigateToConstellationAndBack(page);
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect.poll(async () => (await readSnapshot(page))?.semantic.mutePreference).toBe(false);
  const stored = await readSnapshot(page);
  expect(stored?.semantic.completedMediaIds).toEqual([mediaIds.first, mediaIds.cycle]);
  expect(stored?.semantic.skippedMediaIds).toEqual([mediaIds.answer]);
  expect(stored?.semantic.activeMedia?.id).toBe(mediaIds.prompt);
});

test("invalid build scope or media id falls back to the deterministic entry poster", async ({ page }) => {
  let route = await enterArtBreeze(page);
  await seedSnapshotOnNextDocument(page, { buildScope: "0".repeat(64) });
  await page.reload();
  route = page.locator("[data-post-coscroll-route='artbreeze']");
  await expect(route.locator("video")).toHaveCount(0);
  await expect(route).toHaveAttribute("data-post-coscroll-completed-media", "");
  await expect(page.getByRole("button", { name: "Play verified local ArtBreeze media" })).toBeVisible();

  await seedSnapshotOnNextDocument(page, {
    activeMedia: { id: "https://example.invalid/video.mp4", playbackState: "playing", timeSeconds: 3 }
  });
  await page.reload();
  route = page.locator("[data-post-coscroll-route='artbreeze']");
  await expect(route.locator("video")).toHaveCount(0);
  await expect(route).toHaveAttribute("data-post-coscroll-active-media", "");
  await expect(page.getByRole("button", { name: "Play verified local ArtBreeze media" })).toBeVisible();
});

test("continues valid revisions and safely restarts saturated or malformed revisions", async ({ page }) => {
  let route = await enterArtBreeze(page);
  await seedSnapshotOnNextDocument(page, { revision: 20 });
  await page.reload();
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect.poll(async () => (await readSnapshot(page))?.revision).toBe(21);

  await seedSnapshotOnNextDocument(page, { revision: maxRevision - 1 });
  await page.reload();
  route = page.locator("[data-post-coscroll-route='artbreeze']");
  await route.locator("video").dispatchEvent("timeupdate");
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect.poll(async () => (await readSnapshot(page))?.revision).toBe(1);
  await page.waitForTimeout(2_200);
  expect((await readSnapshot(page))?.revision).toBe(1);

  await seedSnapshotOnNextDocument(page, { revision: maxRevision });
  await page.addInitScript(({ key }) => {
    const state = window as typeof window & { __routeStateWrittenRevisions?: number[] };
    state.__routeStateWrittenRevisions = [];
    const original = Storage.prototype.setItem;
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value(this: Storage, itemKey: string, value: string) {
        if (itemKey === key) {
          try {
            const revision = (JSON.parse(value) as { revision?: unknown }).revision;
            if (typeof revision === "number") {
              state.__routeStateWrittenRevisions?.push(revision);
            }
          } catch {
            // The production codec owns malformed-value handling; this hook records valid writes only.
          }
        }
        return original.call(this, itemKey, value);
      }
    });
  }, { key: returnSnapshotKey });
  await page.reload();
  await page.getByRole("button", { name: "Play verified local ArtBreeze media" }).click();
  await expect.poll(() => page.evaluate(() => ((window as typeof window & {
    __routeStateWrittenRevisions?: number[];
  }).__routeStateWrittenRevisions ?? []).includes(1))).toBe(true);
  const writtenRevisions = await page.evaluate(() => (window as typeof window & {
    __routeStateWrittenRevisions?: number[];
  }).__routeStateWrittenRevisions ?? []);
  expect(writtenRevisions).toContain(1);
  expect((await readSnapshot(page))?.revision).toBeLessThan(maxRevision);
});

test("route-state storage get, set, and reset failures never trap the coordinator veil", async ({ page }) => {
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    await enterArtBreeze(page);
    if (method === "removeItem") {
      await seedSnapshotOnNextDocument(page, { revision: maxRevision - 1 });
      await page.reload();
    }
    await page.evaluate(({ targetMethod, keyPrefix }) => {
      const state = window as typeof window & { __routeStateStorageCalls?: string[] };
      state.__routeStateStorageCalls = [];
      const prototype = Storage.prototype;
      for (const method of ["getItem", "setItem", "removeItem"] as const) {
        const original = prototype[method] as (...args: string[]) => string | null | void;
        Object.defineProperty(prototype, method, {
          configurable: true,
          value(this: Storage, key: string, ...args: string[]) {
            if (key.startsWith(keyPrefix)) {
              state.__routeStateStorageCalls?.push(method);
              if (method === targetMethod) {
                throw new Error(`Injected ${targetMethod} failure`);
              }
            }
            return original.call(this, key, ...args);
          }
        });
      }
    }, { targetMethod: method, keyPrefix: "miralith:chapter-return:" });

    await page.locator("a[aria-label^='05 Floating Constellation']").click();
    await expect(page).toHaveURL(/\/constellation$/);
    await waitForIdle(page);
    const calls = await page.evaluate(() => (window as typeof window & {
      __routeStateStorageCalls?: string[];
    }).__routeStateStorageCalls ?? []);
    expect(calls).toContain(method);
    if (method === "setItem") {
      expect(calls).toContain("getItem");
    }
  }
});

test("pagehide synchronously persists the newest media time and invalidates the old throttle", async ({ page }) => {
  let route = await enterArtBreeze(page);
  await seedSnapshotOnNextDocument(page, {
    revision: 10,
    activeMedia: { id: mediaIds.first, playbackState: "paused-ready", timeSeconds: 1 }
  });
  await page.reload();
  route = page.locator("[data-post-coscroll-route='artbreeze']");
  const video = route.locator("video");
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate((element) => {
    element.currentTime = 3;
    element.dispatchEvent(new Event("timeupdate"));
    element.currentTime = 7;
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
  });
  await page.waitForTimeout(2_200);
  const stored = await readSnapshot(page);
  expect(stored?.revision).toBe(11);
  expect(stored?.semantic.activeMedia?.timeSeconds).toBeGreaterThanOrEqual(6.5);

  await page.reload();
  route = page.locator("[data-post-coscroll-route='artbreeze']");
  await expect.poll(() => route.locator("video").evaluate((element) => element.currentTime))
    .toBeGreaterThanOrEqual(6.5);
  expect(await route.locator("video").evaluate((element) => element.paused)).toBe(true);
});
