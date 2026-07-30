import { expect, test, type Page } from "@playwright/test";

const RADIO_GAGA_SCROLL_DISTANCE_VH = 11.6;

async function waitForIdle(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-chapter-transition-state", /.+/, { timeout: 12_000 });
}

async function enterHomepageRuntime(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeSkipReady === "true";
  });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>(".lubirth-revised");
    return root?.dataset.homeIntroComplete === "true";
  });
}

async function armHomepageTerminal(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.2, behavior: "instant" }));
  await expect(page.locator(".lubirth-revised [data-chapter-terminal='armed']").first()).toBeAttached();
}

async function armRadioGagaTerminal(page: Page) {
  await page.evaluate((scrollDistanceVh) => {
    window.scrollTo({ top: window.innerHeight * scrollDistanceVh, behavior: "instant" });
  }, RADIO_GAGA_SCROLL_DISTANCE_VH);
  await expect(page.locator(".radio-gaga-route [data-chapter-terminal='armed']").first()).toBeAttached();
}

async function crossTerminalThreshold(page: Page) {
  await page.mouse.wheel(0, 240);
  await page.mouse.wheel(0, 240);
}

async function swipePastTerminal(page: Page) {
  await page.evaluate(() => {
    const dispatchTouch = (type: "touchstart" | "touchmove", y: number) => {
      const touch = new Touch({
        identifier: 1,
        target: document.body,
        clientX: window.innerWidth * 0.5,
        clientY: y
      });
      document.body.dispatchEvent(new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch]
      }));
    };
    dispatchTouch("touchstart", window.innerHeight * 0.82);
    dispatchTouch("touchmove", window.innerHeight * 0.64);
    dispatchTouch("touchmove", window.innerHeight * 0.46);
    dispatchTouch("touchmove", window.innerHeight * 0.28);
    dispatchTouch("touchmove", window.innerHeight * 0.12);
  });
}

async function installRadioResetFault(page: Page, mode: "reject" | "hang") {
  const install = (faultMode: "reject" | "hang") => {
    const nativeScrollTo = window.scrollTo.bind(window);
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const state = window as typeof window & {
      __chapterResetFaultTriggered?: boolean;
      __chapterTargetResetScrollCount?: number;
      __releaseChapterReset?: () => void;
    };
    let targetScrollCount = 0;
    let holdRadioAnimationFrames = false;
    const heldAnimationFrames: FrameRequestCallback[] = [];

    window.scrollTo = ((first: number | ScrollToOptions, second?: number) => {
      const transitionId = document.documentElement.dataset.chapterTransitionId;
      const resettingEntry = Boolean(
        transitionId && performance.getEntriesByName(
          `miralith:chapter-transition:${transitionId}:resetting-entry`,
          "mark"
        ).length > 0
      );
      if (window.location.pathname === "/radio-gaga" && resettingEntry) {
        targetScrollCount += 1;
        state.__chapterTargetResetScrollCount = targetScrollCount;
        if (faultMode === "reject" && targetScrollCount === 1) {
          state.__chapterResetFaultTriggered = true;
          throw new Error("Injected Radio Gaga reset rejection");
        }
      }

      if (typeof first === "number") {
        nativeScrollTo(first, second ?? 0);
      } else {
        nativeScrollTo(first);
      }

      if (faultMode === "hang" && targetScrollCount === 1 && !state.__chapterResetFaultTriggered) {
        state.__chapterResetFaultTriggered = true;
        holdRadioAnimationFrames = true;
      }
    }) as typeof window.scrollTo;

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      if (holdRadioAnimationFrames && window.location.pathname === "/radio-gaga") {
        heldAnimationFrames.push(callback);
        state.__releaseChapterReset = () => {
          delete state.__releaseChapterReset;
          holdRadioAnimationFrames = false;
          heldAnimationFrames.splice(0).forEach((heldCallback) => {
            nativeRequestAnimationFrame(heldCallback);
          });
        };
        return 2_147_000_000 + heldAnimationFrames.length;
      }
      return nativeRequestAnimationFrame(callback);
    }) as typeof window.requestAnimationFrame;
  };
  await page.addInitScript(install, mode);
  await page.evaluate(install, mode);
}

async function installHomepageResetRejection(page: Page) {
  const install = () => {
    const nativeScrollTo = window.scrollTo.bind(window);
    const state = window as typeof window & { __chapterHomeResetFaultTriggered?: boolean };

    window.scrollTo = ((first: number | ScrollToOptions, second?: number) => {
      const transitionId = document.documentElement.dataset.chapterTransitionId;
      const resettingEntry = Boolean(
        transitionId && performance.getEntriesByName(
          `miralith:chapter-transition:${transitionId}:resetting-entry`,
          "mark"
        ).length > 0
      );
      if (
        window.location.pathname === "/" &&
        resettingEntry &&
        !state.__chapterHomeResetFaultTriggered
      ) {
        state.__chapterHomeResetFaultTriggered = true;
        throw new Error("Injected homepage reset rejection");
      }

      if (typeof first === "number") {
        nativeScrollTo(first, second ?? 0);
      } else {
        nativeScrollTo(first);
      }
    }) as typeof window.scrollTo;
  };
  await page.addInitScript(install);
  await page.evaluate(install);
}

async function holdCoordinatorRecoveryHistoryGo(page: Page) {
  await page.evaluate(() => {
    const nativeHistoryGo = window.history.go.bind(window.history);
    const state = window as typeof window & {
      __chapterNativeHistoryGo?: (delta?: number) => void;
      __heldChapterRecoveryDelta?: number;
    };
    state.__chapterNativeHistoryGo = nativeHistoryGo;
    window.history.go = ((delta?: number) => {
      const transitionId = document.documentElement.dataset.chapterTransitionId;
      const recoveryBegun = Boolean(
        transitionId && performance.getEntriesByName(
          `miralith:chapter-transition:${transitionId}:recovery-begin`,
          "mark"
        ).length > 0
      );
      if (recoveryBegun) {
        state.__heldChapterRecoveryDelta = delta;
        return;
      }
      nativeHistoryGo(delta);
    }) as typeof window.history.go;
  });
}

async function readTransitionPhases(page: Page) {
  return page.evaluate(() => performance.getEntriesByType("mark")
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("miralith:chapter-transition:"))
    .map((name) => name.slice(name.lastIndexOf(":") + 1)));
}

async function readTransitionPhasesForId(page: Page, transitionId: string) {
  return page.evaluate((id) => performance.getEntriesByType("mark")
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(`miralith:chapter-transition:${id}:`))
    .map((name) => name.slice(name.lastIndexOf(":") + 1)), transitionId);
}

async function readActiveTransitionId(page: Page) {
  const transitionId = await page.locator("html").getAttribute("data-chapter-transition-id");
  if (!transitionId) {
    throw new Error("Expected an active chapter transition id");
  }
  return transitionId;
}

async function readStoredReturnSnapshot(page: Page, pathname: string) {
  return page.evaluate((targetPathname) => {
    const value = window.sessionStorage.getItem(`miralith:chapter-return:${targetPathname}`);
    return value ? JSON.parse(value) as {
      pathname: string;
      scrollY: number;
      routeProgress: number | null;
      terminalState: boolean;
      timestamp: number;
    } : null;
  }, pathname);
}

async function waitForReplacementTransition(page: Page, interruptedId: string) {
  await expect.poll(async () => {
    const transitionId = await page.locator("html").getAttribute("data-chapter-transition-id");
    return transitionId && transitionId !== interruptedId ? transitionId : null;
  }).not.toBeNull();
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-kind", "direct");
  return readActiveTransitionId(page);
}

async function expectGatedHistoryAttempt(page: Page, transitionId: string) {
  const phases = await readTransitionPhasesForId(page, transitionId);
  const resetIndex = phases.indexOf("entry-reset");
  const readyIndex = Math.max(phases.indexOf("visual-ready"), phases.indexOf("fallback-ready"));
  const revealingIndex = phases.indexOf("revealing");
  expect(resetIndex, phases.join("\n")).toBeGreaterThanOrEqual(0);
  expect(readyIndex, phases.join("\n")).toBeGreaterThanOrEqual(0);
  expect(revealingIndex, phases.join("\n")).toBeGreaterThan(resetIndex);
  expect(revealingIndex, phases.join("\n")).toBeGreaterThan(readyIndex);
}

async function extendReadinessTestBudget(page: Page) {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout = 0, ...args: unknown[]) => {
      const adjustedTimeout = timeout === 2_600 || timeout === 3_000 ? timeout * 4 : timeout;
      return nativeSetTimeout(handler, adjustedTimeout, ...args);
    }) as typeof window.setTimeout;
  });
}

async function readPreviewEvidence(page: Page) {
  return page.evaluate(() => {
    const stored = window.sessionStorage.getItem("miralith:chapter-preview:v1");
    const marker = (window.history.state as Record<string, unknown> | null)?.__miralithChapterPreview as {
      v?: unknown;
      scope?: unknown;
    } | undefined;
    let storedScope: string | null = null;
    try {
      const parsed = stored ? JSON.parse(stored) as { scope?: unknown } : null;
      storedScope = typeof parsed?.scope === "string" ? parsed.scope : null;
    } catch {
      storedScope = null;
    }
    return {
      storedScope,
      markerScope: marker?.v === 1 && typeof marker.scope === "string" ? marker.scope : null
    };
  });
}

async function installPreviewMarkerWriteRecorder(page: Page) {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __chapterPreviewMarkerWrites?: Array<{ pathname: string; scope: string }>;
    };
    const nativeReplaceState = window.history.replaceState.bind(window.history);
    state.__chapterPreviewMarkerWrites = [];
    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      const marker = data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>).__miralithChapterPreview
        : null;
      if (
        marker &&
        typeof marker === "object" &&
        !Array.isArray(marker) &&
        (marker as Record<string, unknown>).v === 1 &&
        typeof (marker as Record<string, unknown>).scope === "string"
      ) {
        const pathname = url === undefined || url === null
          ? window.location.pathname
          : new URL(String(url), window.location.href).pathname;
        state.__chapterPreviewMarkerWrites?.push({
          pathname,
          scope: (marker as Record<string, string>).scope
        });
      }
      nativeReplaceState(data, unused, url);
    }) as typeof window.history.replaceState;
  });
}

async function readPreviewMarkerWrites(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __chapterPreviewMarkerWrites?: Array<{ pathname: string; scope: string }>;
    };
    return state.__chapterPreviewMarkerWrites ?? [];
  });
}

async function rejectPreviewTargetMarkerWrite(page: Page) {
  await page.evaluate(() => {
    const nativeReplaceState = window.history.replaceState.bind(window.history);
    const state = window as typeof window & {
      __chapterPreviewMarkerWriteRejected?: boolean;
    };

    window.history.replaceState = ((nextState: unknown, unused: string, url?: string | URL | null) => {
      const marker = nextState && typeof nextState === "object"
        ? (nextState as Record<string, unknown>).__miralithChapterPreview
        : null;
      if (window.location.pathname === "/coscroll" && marker) {
        state.__chapterPreviewMarkerWriteRejected = true;
        throw new DOMException("Injected preview marker write rejection", "InvalidStateError");
      }
      nativeReplaceState(nextState, unused, url);
    }) as typeof window.history.replaceState;
  });
}

async function bootstrapPreviewAtRadioGaga(page: Page) {
  await page.goto("/radio-gaga?preview=post-coscroll-v1");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect.poll(() => readPreviewEvidence(page)).toMatchObject({
    storedScope: expect.stringMatching(/^[a-f0-9]{64}$/),
    markerScope: expect.stringMatching(/^[a-f0-9]{64}$/)
  });
  return readPreviewEvidence(page);
}

async function navigateRadioGagaPreviewToCoScroll(page: Page) {
  await armRadioGagaTerminal(page);
  await page.locator(".radio-gaga-title-rail .miralith-chapter-nav__terminal a").click();
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
}

test("preview query is tab-scoped, query-free, and writes its target marker only after pathname commit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This lifecycle contract only needs one browser profile.");

  const preview = await bootstrapPreviewAtRadioGaga(page);
  expect(preview.storedScope).toBe(preview.markerScope);
  await armRadioGagaTerminal(page);
  await installPreviewMarkerWriteRecorder(page);

  await page.locator(".radio-gaga-title-rail .miralith-chapter-nav__terminal a").click();
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-target", "/coscroll");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  expect(await readPreviewMarkerWrites(page)).toEqual([]);

  await expect(page).toHaveURL(/\/coscroll$/);
  await expect.poll(() => readPreviewMarkerWrites(page)).toEqual([
    { pathname: "/coscroll", scope: preview.storedScope }
  ]);
  await waitForIdle(page);
});

test("a preview session lost after transition begin fails closed at pathname commit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This lifecycle contract only needs one browser profile.");

  const preview = await bootstrapPreviewAtRadioGaga(page);
  await armRadioGagaTerminal(page);
  await installPreviewMarkerWriteRecorder(page);

  await page.locator(".radio-gaga-title-rail .miralith-chapter-nav__terminal a").click();
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-target", "/coscroll");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await page.evaluate(() => window.sessionStorage.removeItem("miralith:chapter-preview:v1"));

  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  expect(await readPreviewMarkerWrites(page)).toEqual([]);
  expect(await readPreviewEvidence(page)).toEqual({
    storedScope: null,
    markerScope: null
  });

  await page.evaluate((scope) => {
    window.sessionStorage.setItem("miralith:chapter-preview:v1", JSON.stringify({
      v: 1,
      token: "post-coscroll-v1",
      scope
    }));
  }, preview.storedScope);
  await page.locator(".coscroll-chapter-nav a[href='/']").click();
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  expect(await readPreviewMarkerWrites(page)).toEqual([]);
  expect(await readPreviewEvidence(page)).toEqual({
    storedScope: preview.storedScope,
    markerScope: null
  });
});

test("a rejected preview target-marker write fails closed without an uncaught runtime error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This lifecycle contract only needs one browser profile.");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const preview = await bootstrapPreviewAtRadioGaga(page);
  await armRadioGagaTerminal(page);
  await installPreviewMarkerWriteRecorder(page);
  await rejectPreviewTargetMarkerWrite(page);

  await page.locator(".radio-gaga-title-rail .miralith-chapter-nav__terminal a").click();
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  expect(await page.evaluate(() => Boolean(
    (window as typeof window & { __chapterPreviewMarkerWriteRejected?: boolean })
      .__chapterPreviewMarkerWriteRejected
  ))).toBe(true);
  expect(pageErrors).toEqual([]);
  expect(await readPreviewMarkerWrites(page)).toEqual([]);
  expect(await readPreviewEvidence(page)).toEqual({
    storedScope: preview.storedScope,
    markerScope: null
  });
});

test("preview markers remain valid through committed back and forward entries", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This lifecycle contract only needs one browser profile.");

  const preview = await bootstrapPreviewAtRadioGaga(page);
  await navigateRadioGagaPreviewToCoScroll(page);
  await expect.poll(() => readPreviewEvidence(page)).toEqual({
    storedScope: preview.storedScope,
    markerScope: preview.storedScope
  });

  await page.goBack();
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await expect.poll(() => readPreviewEvidence(page)).toEqual({
    storedScope: preview.storedScope,
    markerScope: preview.storedScope
  });

  await page.goForward();
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  await expect.poll(() => readPreviewEvidence(page)).toEqual({
    storedScope: preview.storedScope,
    markerScope: preview.storedScope
  });
});

test("a cancelled preview transition cannot write a stale target marker", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This lifecycle contract only needs one browser profile.");

  await page.goto("/?preview=post-coscroll-v1");
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => readPreviewEvidence(page)).toMatchObject({
    storedScope: expect.stringMatching(/^[a-f0-9]{64}$/),
    markerScope: expect.stringMatching(/^[a-f0-9]{64}$/)
  });
  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await page.locator(".miralith-chapter-nav__terminal a").click();
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);

  await armRadioGagaTerminal(page);
  await installPreviewMarkerWriteRecorder(page);
  await crossTerminalThreshold(page);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-target", "/coscroll");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  await page.waitForTimeout(400);
  expect((await readPreviewMarkerWrites(page)).some((write) => write.pathname === "/coscroll")).toBe(false);
});

test("a scope or forged history-marker mismatch cannot re-enable preview marking", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This lifecycle contract only needs one browser profile.");

  const preview = await bootstrapPreviewAtRadioGaga(page);
  const forgedScope = "0".repeat(64) === preview.storedScope ? "f".repeat(64) : "0".repeat(64);
  await page.evaluate((scope) => {
    window.history.replaceState({
      ...(window.history.state as Record<string, unknown>),
      __miralithChapterPreview: { v: 1, scope }
    }, "");
  }, forgedScope);
  await page.reload();
  await expect(page).toHaveURL(/\/radio-gaga$/);
  expect(await readPreviewEvidence(page)).toEqual({
    storedScope: preview.storedScope,
    markerScope: forgedScope
  });

  await armRadioGagaTerminal(page);
  await installPreviewMarkerWriteRecorder(page);
  await page.locator(".radio-gaga-title-rail .miralith-chapter-nav__terminal a").click();
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  expect(await readPreviewMarkerWrites(page)).toEqual([]);
  expect(await readPreviewEvidence(page)).toEqual({
    storedScope: preview.storedScope,
    markerScope: null
  });
});

test("a stored build-scope mismatch cannot re-enable preview marking", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This lifecycle contract only needs one browser profile.");

  const preview = await bootstrapPreviewAtRadioGaga(page);
  const mismatchedScope = "f".repeat(64) === preview.storedScope ? "e".repeat(64) : "f".repeat(64);
  await page.evaluate((scope) => {
    window.sessionStorage.setItem("miralith:chapter-preview:v1", JSON.stringify({
      v: 1,
      token: "post-coscroll-v1",
      scope
    }));
  }, mismatchedScope);
  await page.reload();
  await expect(page).toHaveURL(/\/radio-gaga$/);
  expect(await readPreviewEvidence(page)).toEqual({
    storedScope: mismatchedScope,
    markerScope: preview.markerScope
  });

  await armRadioGagaTerminal(page);
  await installPreviewMarkerWriteRecorder(page);
  await page.locator(".radio-gaga-title-rail .miralith-chapter-nav__terminal a").click();
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  expect(await readPreviewMarkerWrites(page)).toEqual([]);
  expect(await readPreviewEvidence(page)).toEqual({
    storedScope: mismatchedScope,
    markerScope: null
  });
});

test("a known preview history target stays native when its session proof is invalidated before popstate", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The inaccessible-history fallback only needs one browser profile.");

  await page.goto("/coscroll?preview=post-coscroll-v1");
  await expect(page).toHaveURL(/\/coscroll$/);
  await expect.poll(() => readPreviewEvidence(page)).toMatchObject({
    storedScope: expect.stringMatching(/^[a-f0-9]{64}$/),
    markerScope: expect.stringMatching(/^[a-f0-9]{64}$/)
  });

  await page.evaluate(() => {
    window.sessionStorage.removeItem("miralith:chapter-preview:v1");
    History.prototype.pushState.call(window.history, window.history.state, "", "/artbreeze");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/artbreeze$/);
  await expect(page.locator("html")).not.toHaveAttribute("data-chapter-transition-state", /.+/, { timeout: 700 });
});

test("terminal scrolling follows the published 01 → 02 → 03 sequence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The full ordered sequence only needs one browser profile.");

  await enterHomepageRuntime(page);
  await page.evaluate(() => {
    const state = window as typeof window & { __MiraLithMaxCanvasCount?: number };
    const updateCount = () => {
      state.__MiraLithMaxCanvasCount = Math.max(
        state.__MiraLithMaxCanvasCount ?? 0,
        document.querySelectorAll("canvas").length
      );
    };
    updateCount();
    new MutationObserver(updateCount).observe(document.body, { childList: true, subtree: true });
  });
  await armHomepageTerminal(page);
  await expect(page.locator(".miralith-chapter-nav__terminal")).toContainText("02");
  await expect(page.locator(".miralith-chapter-nav__terminal")).toContainText("Radio Gaga");
  await page.screenshot({ path: "test-results/chapter-transition-arrival-source-terminal.png" });

  await crossTerminalThreshold(page);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-kind", "arrival-to-signal");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await page.screenshot({ path: "test-results/chapter-transition-arrival-covered.png" });
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "revealing");
  await page.screenshot({ path: "test-results/chapter-transition-arrival-revealing.png" });
  await waitForIdle(page);
  await expect(page.locator(".radio-gaga-route")).toHaveAttribute("data-radio-gaga-progress", "0.0000");
  await page.screenshot({ path: "test-results/chapter-transition-arrival-revealed.png" });

  await armRadioGagaTerminal(page);
  await expect(page.locator(".miralith-chapter-nav__terminal")).toContainText("03");
  await expect(page.locator(".miralith-chapter-nav__terminal")).toContainText("CoScroll");
  await crossTerminalThreshold(page);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-kind", "signal-to-sutra");
  await expect(page).toHaveURL(/\/coscroll$/);
  await page.screenshot({ path: "test-results/chapter-transition-sutra-covered.png" });
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "revealing");
  await page.screenshot({ path: "test-results/chapter-transition-sutra-revealing.png" });
  await waitForIdle(page);
  await expect(page.locator("[data-coscroll-progress]")).toHaveAttribute("data-coscroll-input-enabled", "true");
  await page.screenshot({ path: "test-results/chapter-transition-sutra-revealed.png" });
  const maxCanvasCount = await page.evaluate(() =>
    (window as typeof window & { __MiraLithMaxCanvasCount?: number }).__MiraLithMaxCanvasCount ?? 0
  );
  expect(maxCanvasCount).toBeLessThanOrEqual(1);
});

test("touch handoff stays ordered and exposes the compact prompt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "This contract targets touch viewport profiles.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await expect(page.locator(".lubirth-revised__mobile-title-bar .miralith-chapter-bar__terminal")).toContainText(
    "Radio Gaga"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await swipePastTerminal(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await page.screenshot({ path: `test-results/chapter-transition-${testInfo.project.name}-arrival-covered.png` });
  await waitForIdle(page);

  await armRadioGagaTerminal(page);
  await expect(page.locator(".radio-gaga-mobile-title-bar .miralith-chapter-bar__terminal")).toContainText("CoScroll");
  await swipePastTerminal(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("automatic warmup requests only the next published chapter", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The request boundary only needs one browser profile.");
  const requestedAssets: string[] = [];
  page.on("request", (request) => requestedAssets.push(request.url()));

  await page.goto("/");
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".lubirth-revised")?.dataset.homeSkipReady === "true");
  expect(requestedAssets.some((url) => url.includes("/model/radio_gaga.glb"))).toBe(false);
  expect(requestedAssets.some((url) => url.includes("/assets/coscroll/"))).toBe(false);

  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".lubirth-revised")?.dataset.homeIntroComplete === "true");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.25, behavior: "instant" }));
  await expect.poll(() => requestedAssets.some((url) => url.includes("/model/radio_gaga.glb"))).toBe(true);
  expect(requestedAssets.some((url) => url.includes("/assets/coscroll/"))).toBe(false);

  await page.goto("/radio-gaga");
  requestedAssets.length = 0;
  await page.waitForTimeout(250);
  expect(requestedAssets.some((url) => url.includes("/assets/coscroll/"))).toBe(false);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.4, behavior: "instant" }));
  await expect.poll(() => requestedAssets.some((url) => url.includes("/assets/coscroll/source-models/101_"))).toBe(true);
});

test("preview access admits the ArtBreeze review link and warmup without enabling a CoScroll terminal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The preview access parity contract only needs one browser profile.");
  const artBreezeRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/artbreeze") {
      artBreezeRequests.push(request.url());
    }
  });

  await page.goto("/coscroll?preview=post-coscroll-v1");
  await expect(page).toHaveURL(/\/coscroll$/);
  const navigation = page.locator(".coscroll-chapter-nav");
  await expect(navigation.locator("a[aria-label^='04 ArtBreeze']")).toBeVisible();
  await expect.poll(() => artBreezeRequests.length).toBeGreaterThan(0);
  await expect(navigation).toHaveAttribute("data-chapter-terminal", "idle");
  await expect(navigation.locator("[data-chapter-terminal] a")).toHaveCount(0);
});

test("public access rejects ArtBreeze warmup while a direct known entry remains veil-free", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The public access parity contract only needs one browser profile.");
  const artBreezeRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/artbreeze") {
      artBreezeRequests.push(request.url());
    }
  });

  await page.goto("/coscroll");
  await expect(page.locator(".coscroll-chapter-nav a[aria-label^='04 ArtBreeze']")).toHaveCount(0);
  await page.waitForTimeout(250);
  expect(artBreezeRequests).toEqual([]);

  await page.goto("/artbreeze");
  await expect(page.locator("html")).not.toHaveAttribute("data-chapter-transition-state", /.+/);
});

test("browser back restores the source and forward always uses the direct veil", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "History restoration only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  const homeTerminalScroll = await page.evaluate(() => window.scrollY);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  await expect(page.locator(".lubirth-revised [data-chapter-terminal='armed']").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(homeTerminalScroll * 0.85);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/$/);

  await page.evaluate(() => window.history.forward());
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-kind", "direct");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await expect(page.locator(".radio-gaga-route")).toHaveAttribute("data-radio-gaga-progress", "1.0000");
  await expect(page.locator(".radio-gaga-route [data-chapter-terminal='armed']").first()).toBeAttached();
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/radio-gaga$/);

  await page.evaluate(() => window.history.forward());
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-kind", "direct");
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
});

test("a failed history traversal returns to the prior entry without replacing either history item", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "History failure recovery only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);

  await installRadioResetFault(page, "reject");
  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);

  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);

  const recoveryCount = await page.evaluate(() => performance.getEntriesByType("mark")
    .filter((entry) => entry.name.endsWith(":recovery-begin")).length);
  await installRadioResetFault(page, "reject");
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .filter((entry) => entry.name.endsWith(":recovery-begin")).length)).toBe(recoveryCount + 1);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
});

test("a failed multi-step history traversal returns to its original entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Multi-step history recovery only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);

  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);

  await page.locator(".coscroll-chapter-nav a[href='/']").click();
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  const historyLength = await page.evaluate(() => window.history.length);

  await installRadioResetFault(page, "reject");
  await page.evaluate(() => window.history.go(-2));
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

test("a failed multi-step forward traversal returns to its original entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Multi-step history recovery only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);

  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);

  await page.locator(".coscroll-chapter-nav a[href='/']").click();
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  const historyLength = await page.evaluate(() => window.history.length);

  await page.evaluate(() => window.history.go(-2));
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);

  await installHomepageResetRejection(page);
  await page.evaluate(() => window.history.go(2));
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

test("an unknown history direction recovers with a safe push instead of guessing an entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Unknown-direction history recovery only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  await page.reload();

  const navigationIndexDisabled = await page.evaluate(() => {
    try {
      Object.defineProperty(window, "navigation", {
        configurable: true,
        value: undefined
      });
      return !("navigation" in window) || window.navigation === undefined;
    } catch {
      return false;
    }
  });
  expect(navigationIndexDisabled).toBe(true);
  const historyLengthBeforeRecovery = await page.evaluate(() => window.history.length);
  await installRadioResetFault(page, "reject");

  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLengthBeforeRecovery + 1);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
});

test("a Navigation API sentinel index falls back to safe history recovery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Sentinel-index recovery only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  await page.reload();

  // Re-establish a real prior navigation index while keeping the reloaded
  // pathname-only ledger unable to prove the following direction.
  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);

  const navigationIndexSentinelInstalled = await page.evaluate(() => {
    try {
      Object.defineProperty(window, "navigation", {
        configurable: true,
        value: { currentEntry: { index: -1 } }
      });
      return window.navigation?.currentEntry?.index === -1;
    } catch {
      return false;
    }
  });
  expect(navigationIndexSentinelInstalled).toBe(true);
  const historyLengthBeforeRecovery = await page.evaluate(() => window.history.length);
  await installRadioResetFault(page, "reject");

  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLengthBeforeRecovery + 1);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
});

test("a same-path user traversal interrupts a pending recovery instead of being consumed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Recovery identity matching only needs one browser profile.");

  await enterHomepageRuntime(page);
  const firstHomeEntryKey = await page.evaluate(() => window.navigation?.currentEntry?.key ?? null);
  expect(firstHomeEntryKey).not.toBeNull();

  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await armRadioGagaTerminal(page);
  await page.locator(".radio-gaga-title-rail a[href='/']").first().click();
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  const recoverySourceEntryKey = await page.evaluate(() => window.navigation?.currentEntry?.key ?? null);
  expect(recoverySourceEntryKey).not.toBeNull();
  expect(recoverySourceEntryKey).not.toBe(firstHomeEntryKey);

  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.navigation?.currentEntry?.key ?? null)).toBe(recoverySourceEntryKey);

  await installRadioResetFault(page, "reject");
  await holdCoordinatorRecoveryHistoryGo(page);
  const historyLength = await page.evaluate(() => window.history.length);
  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  const interruptedId = await readActiveTransitionId(page);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as typeof window & {
    __heldChapterRecoveryDelta?: number;
  }).__heldChapterRecoveryDelta ?? null)).toBe(-1);

  await page.evaluate(() => {
    const state = window as typeof window & { __chapterNativeHistoryGo?: (delta?: number) => void };
    state.__chapterNativeHistoryGo?.(-3);
  });
  await expect(page).toHaveURL(/\/$/);
  const replacementId = await waitForReplacementTransition(page, interruptedId);
  await waitForIdle(page);
  expect(await readTransitionPhasesForId(page, interruptedId)).toContain("history-interrupted");
  await expectGatedHistoryAttempt(page, replacementId);
  expect(await page.evaluate(() => window.navigation?.currentEntry?.key ?? null)).toBe(firstHomeEntryKey);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

test("history forward during covering replaces the active attempt with a gated direct transition", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Active covering interruption only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  const historyLength = await page.evaluate(() => window.history.length);
  const stableHomeSnapshot = await readStoredReturnSnapshot(page, "/");
  expect(stableHomeSnapshot).not.toBeNull();
  if (!stableHomeSnapshot) {
    throw new Error("Expected a settled homepage return snapshot");
  }
  expect(stableHomeSnapshot.terminalState).toBe(true);
  expect(stableHomeSnapshot.routeProgress).not.toBeNull();

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "covering");
  await expect(page.locator(".lubirth-revised")).toBeAttached();
  const interruptedId = await readActiveTransitionId(page);
  await page.evaluate(() => window.history.forward());

  await expect(page).toHaveURL(/\/radio-gaga$/);
  const replacementId = await waitForReplacementTransition(page, interruptedId);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  expect(await readTransitionPhasesForId(page, interruptedId)).toContain("history-interrupted");
  expect(await readStoredReturnSnapshot(page, "/")).toEqual(stableHomeSnapshot);
  await expectGatedHistoryAttempt(page, replacementId);
  await expect(page.locator(".radio-gaga-route")).toHaveAttribute("data-radio-gaga-progress", "0.0000");
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", "true");

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  await expect(page.locator(".lubirth-revised [data-chapter-terminal='armed']").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.__MiraLithOpeningProgress ?? null))
    .toBeCloseTo(stableHomeSnapshot.routeProgress ?? 0, 2);
  await expect.poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(stableHomeSnapshot.scrollY * 0.85);
});

test("history interruption during resetting-entry preserves the settled return snapshot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Reset snapshot preservation only needs one browser profile.");

  await page.goto("/radio-gaga");
  await armRadioGagaTerminal(page);
  const radioTerminalScroll = await page.evaluate(() => window.scrollY);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
  const stableRadioSnapshot = await readStoredReturnSnapshot(page, "/radio-gaga");
  expect(stableRadioSnapshot).not.toBeNull();
  if (!stableRadioSnapshot) {
    throw new Error("Expected a settled Radio Gaga return snapshot");
  }
  expect(stableRadioSnapshot.routeProgress).toBeCloseTo(1, 2);
  expect(stableRadioSnapshot.terminalState).toBe(true);
  expect(stableRadioSnapshot.scrollY).toBeGreaterThan(radioTerminalScroll * 0.85);

  await installRadioResetFault(page, "hang");
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "resetting-entry");
  const interruptedId = await readActiveTransitionId(page);
  await page.evaluate(() => window.history.forward());

  await expect(page).toHaveURL(/\/coscroll$/);
  const replacementId = await waitForReplacementTransition(page, interruptedId);
  await waitForIdle(page);
  expect(await readTransitionPhasesForId(page, interruptedId)).toContain("history-interrupted");
  expect(await readStoredReturnSnapshot(page, "/radio-gaga")).toEqual(stableRadioSnapshot);
  await expectGatedHistoryAttempt(page, replacementId);
  await page.evaluate(() => {
    const state = window as typeof window & { __releaseChapterReset?: () => void };
    state.__releaseChapterReset?.();
  });

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await expect(page.locator(".radio-gaga-route")).toHaveAttribute("data-radio-gaga-progress", "1.0000");
  await expect(page.locator(".radio-gaga-route [data-chapter-terminal='armed']").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(stableRadioSnapshot.scrollY * 0.85);
});

test("history back during waiting-ready cancels the stale destination before restoring source", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Active readiness interruption only needs one browser profile.");
  await extendReadinessTestBudget(page);

  let releaseModel!: () => void;
  const heldModel = new Promise<void>((resolve) => {
    releaseModel = resolve;
  });
  await page.route("**/model/radio_gaga.glb", async (route) => {
    await heldModel;
    await route.continue();
  });

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  const sourceScrollY = await page.evaluate(() => window.scrollY);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "waiting-ready");
  const historyLength = await page.evaluate(() => window.history.length);
  const interruptedId = await readActiveTransitionId(page);
  await page.evaluate(() => window.history.back());

  await expect(page).toHaveURL(/\/$/);
  const replacementId = await waitForReplacementTransition(page, interruptedId);
  releaseModel();
  await waitForIdle(page);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  expect(await readTransitionPhasesForId(page, interruptedId)).toContain("history-interrupted");
  await expectGatedHistoryAttempt(page, replacementId);
  await expect(page.locator(".lubirth-revised [data-chapter-terminal='armed']").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(sourceScrollY * 0.85);
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", "true");
});

test("history forward during revealing cancels the old finish before gating the traversed entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Active reveal interruption only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  const historyLength = await page.evaluate(() => window.history.length);

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "revealing");
  const interruptedId = await readActiveTransitionId(page);
  await page.evaluate(() => window.history.forward());

  await expect(page).toHaveURL(/\/radio-gaga$/);
  const replacementId = await waitForReplacementTransition(page, interruptedId);
  await waitForIdle(page);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  expect(await readTransitionPhasesForId(page, interruptedId)).toContain("history-interrupted");
  await expectGatedHistoryAttempt(page, replacementId);
  await expect(page.locator(".radio-gaga-route")).toHaveAttribute("data-radio-gaga-progress", "0.0000");
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", "true");
});

test("reduced motion keeps the explicit next link and uses an opacity-only veil", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The reduced-motion transition only needs one browser profile.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const terminalLink = page.locator(".lubirth-revised__title-rail .miralith-chapter-nav__terminal a");
  await expect(terminalLink).toBeVisible();
  await expect(terminalLink).toHaveAttribute("href", "/radio-gaga");
  await terminalLink.click();
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-kind", "arrival-to-signal");
  await expect(page.locator(".chapter-transition-visual__particles")).toHaveCSS("display", "none");
  await expect(page.locator(".chapter-transition-visual__threads")).toHaveCSS("display", "none");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
});

test("a non-adjacent chapter link uses the direct veil", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The pair classification only needs one browser profile.");

  await enterHomepageRuntime(page);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.25, behavior: "instant" }));
  const coScrollLink = page.locator(".lubirth-revised__title-rail a", { hasText: "CoScroll" });
  await expect(coScrollLink).toBeVisible();
  await coScrollLink.click();
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-kind", "direct");
  await expect(page).toHaveURL(/\/coscroll$/);
  await page.screenshot({ path: "test-results/chapter-transition-direct-covered.png" });
  await waitForIdle(page);
});

test("duplicate begin calls keep the first transition id and target", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The coordinator idempotency contract only needs one browser profile.");

  await enterHomepageRuntime(page);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.25, behavior: "instant" }));
  await page.evaluate(() => {
    const radioLink = Array.from(document.querySelectorAll<HTMLAnchorElement>(".lubirth-revised__title-rail a"))
      .find((link) => link.href.endsWith("/radio-gaga"));
    const coscrollLink = Array.from(document.querySelectorAll<HTMLAnchorElement>(".lubirth-revised__title-rail a"))
      .find((link) => link.href.endsWith("/coscroll"));
    radioLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    coscrollLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });

  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-target", "/radio-gaga");
  const transitionId = await page.locator("html").getAttribute("data-chapter-transition-id");
  expect(transitionId).toMatch(/^chapter-/);
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-id", transitionId ?? "");
  await waitForIdle(page);
});

test("chapter links preserve self, modifier, middle, target, download, and external semantics", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Native link semantics only need one browser profile.");

  await enterHomepageRuntime(page);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.25, behavior: "instant" }));
  const results = await page.evaluate(() => {
    const radioLink = Array.from(document.querySelectorAll<HTMLAnchorElement>(".lubirth-revised__title-rail a"))
      .find((link) => link.href.endsWith("/radio-gaga"));
    const selfLink = Array.from(document.querySelectorAll<HTMLAnchorElement>(".lubirth-revised__title-rail a"))
      .find((link) => new URL(link.href).pathname === "/");
    if (!radioLink || !selfLink) {
      throw new Error("Expected published chapter links");
    }

    const nativePreventDefault = Event.prototype.preventDefault;
    const dispatch = (anchor: HTMLAnchorElement, init: MouseEventInit) => {
      let preventedByReact = false;
      Event.prototype.preventDefault = function preventDefault() {
        preventedByReact = true;
        nativePreventDefault.call(this);
      };
      document.addEventListener("click", (event) => nativePreventDefault.call(event), { once: true });
      anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
      Event.prototype.preventDefault = nativePreventDefault;
      return preventedByReact;
    };

    const excluded: Record<string, boolean> = {
      self: dispatch(selfLink, {}),
      meta: dispatch(radioLink, { metaKey: true }),
      control: dispatch(radioLink, { ctrlKey: true }),
      shift: dispatch(radioLink, { shiftKey: true }),
      alt: dispatch(radioLink, { altKey: true }),
      middle: dispatch(radioLink, { button: 1 })
    };

    radioLink.target = "_blank";
    excluded.target = dispatch(radioLink, {});
    radioLink.removeAttribute("target");
    radioLink.setAttribute("download", "radio-gaga.html");
    excluded.download = dispatch(radioLink, {});
    radioLink.removeAttribute("download");
    const internalHref = radioLink.href;
    radioLink.href = "https://example.com/radio-gaga";
    excluded.external = dispatch(radioLink, {});
    radioLink.href = internalHref;

    const normal = dispatch(radioLink, {});
    return { excluded, normal };
  });

  expect(Object.values(results.excluded)).toEqual(Array(Object.keys(results.excluded).length).fill(false));
  expect(results.normal).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-target", "/radio-gaga");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
});

test("reverse input clears terminal accumulation and keyboard input starts a fresh handoff", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The normalized input contract only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: -80, bubbles: true, cancelable: true }));
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(650);
  await expect(page).toHaveURL(/\/$/);

  await page.keyboard.press("PageDown");
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await armRadioGagaTerminal(page);
  const firstArrowPrevented = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(firstArrowPrevented).toBe(true);
  expect(page.url()).toMatch(/\/radio-gaga$/);
  const secondArrowPrevented = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(secondArrowPrevented).toBe(true);
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
});

test("focused current chapter links cannot activate during the transition input lock", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The keyboard input-lock contract only needs one browser profile.");

  await page.goto("/radio-gaga");
  await armRadioGagaTerminal(page);
  const currentLink = page.locator(".radio-gaga-title-rail a[aria-current='page']").first();
  await expect(currentLink).toBeVisible();
  await currentLink.focus();
  await page.evaluate(() => {
    window.sessionStorage.removeItem("miralith:test:locked-self-link-click");
    document.addEventListener("click", (event) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a");
      if (anchor && new URL(anchor.href).pathname === "/radio-gaga") {
        window.sessionStorage.setItem("miralith:test:locked-self-link-click", String(event.defaultPrevented));
      }
    });
  });

  await page.keyboard.press("PageDown");
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "covering");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("miralith:test:locked-self-link-click")))
    .toBe("true");
  await expect(page).toHaveURL(/\/coscroll$/);
  await waitForIdle(page);
});

test("the veil locks target input until a real Radio Gaga frame is ready", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The readiness timing contract only needs one browser profile.");

  let releaseModel!: () => void;
  const heldModel = new Promise<void>((resolve) => {
    releaseModel = resolve;
  });
  await page.route("**/model/radio_gaga.glb", async (route) => {
    await heldModel;
    await route.continue();
  });

  await enterHomepageRuntime(page);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.25, behavior: "instant" }));
  await page.locator(".lubirth-revised__title-rail a", { hasText: "Radio Gaga" }).click();
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "waiting-ready");
  await page.screenshot({ path: "test-results/chapter-transition-readiness-hold.png" });
  await page.mouse.wheel(0, 800);
  await expect(page.locator(".radio-gaga-route")).toHaveAttribute("data-radio-gaga-progress", "0.0000");

  releaseModel();
  await waitForIdle(page);
});

test("the veil holds CoScroll until its current anchor is ready", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The CoScroll readiness contract only needs one browser profile.");
  await extendReadinessTestBudget(page);

  let releaseAnchor!: () => void;
  const heldAnchor = new Promise<void>((resolve) => {
    releaseAnchor = resolve;
  });
  await page.route("**/assets/coscroll/source-models/101_*", async (route) => {
    await heldAnchor;
    await route.continue();
  });

  await page.goto("/radio-gaga");
  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "waiting-ready");
  const heldProgress = await page.locator("[data-coscroll-progress]").getAttribute("data-coscroll-progress");
  await page.mouse.wheel(0, 800);
  await expect(page.locator("[data-coscroll-progress]")).toHaveAttribute("data-coscroll-progress", heldProgress ?? "");

  releaseAnchor();
  await waitForIdle(page);
  await expect(page.locator("[data-coscroll-progress]")).toHaveAttribute("data-coscroll-input-enabled", "true");
});

test("history restore waits for the non-initial CoScroll anchor generation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The restored-anchor readiness contract only needs one browser profile.");
  await extendReadinessTestBudget(page);

  let anchorRequested = false;
  let releaseAnchor!: () => void;
  const heldAnchor = new Promise<void>((resolve) => {
    releaseAnchor = resolve;
  });
  await page.route("**/assets/coscroll/source-models/001_*", async (route) => {
    anchorRequested = true;
    await heldAnchor;
    await route.continue();
  });

  await page.goto("/coscroll");
  await expect(page.locator("[data-coscroll-progress]")).toHaveAttribute("data-coscroll-input-enabled", "true");
  await page.locator("[data-coscroll-progress]").dispatchEvent("wheel", {
    deltaY: 720,
    bubbles: true,
    cancelable: true
  });
  await expect.poll(async () => Number.parseFloat(
    await page.locator("[data-coscroll-progress]").getAttribute("data-coscroll-progress") ?? "0"
  )).toBeGreaterThan(0.075);
  await expect.poll(() => anchorRequested).toBe(true);

  await page.locator(".coscroll-chapter-nav a[href='/']").click();
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/coscroll$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-id", /chapter-/);
  const transitionId = await page.locator("html").getAttribute("data-chapter-transition-id");
  expect(transitionId).not.toBeNull();
  await expect.poll(() => page.evaluate((id) => performance.getEntriesByName(
    `miralith:chapter-transition:${id}:visual-pending`,
    "mark"
  ).length, transitionId)).toBeGreaterThan(0);
  await expect(page.locator("body")).toHaveAttribute("aria-busy", "true");

  const anchorReleaseTime = await page.evaluate(() => performance.now());
  releaseAnchor();
  await waitForIdle(page);
  const readinessOrder = await page.evaluate((releaseTime) => performance.getEntriesByType("mark")
    .filter((entry) => entry.startTime >= releaseTime)
    .map((entry) => entry.name)
    .filter((name) =>
      name.startsWith("miralith:coscroll-readiness:") ||
      name.startsWith("miralith:chapter-transition:")
    ), anchorReleaseTime);
  const anchorReadyIndex = readinessOrder.findIndex((name) => name.endsWith(":anchor"));
  const committedFrameIndex = readinessOrder.findIndex((name) => name.endsWith(":frame"));
  const visualReadyIndex = readinessOrder.findIndex((name) => name.endsWith(":visual-ready"));
  expect(anchorReadyIndex).toBeGreaterThanOrEqual(0);
  expect(committedFrameIndex).toBeGreaterThan(anchorReadyIndex);
  expect(visualReadyIndex, readinessOrder.join("\n")).toBeGreaterThan(committedFrameIndex);
  await expect.poll(async () => Number.parseFloat(
    await page.locator("[data-coscroll-progress]").getAttribute("data-coscroll-progress") ?? "0"
  )).toBeGreaterThan(0.075);
  await expect(page.locator("[data-coscroll-progress]")).toHaveAttribute("data-coscroll-input-enabled", "true");
});

test("a CoScroll context loss reports the committed fallback for the current visual generation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The Canvas fallback generation contract only needs one browser profile.");

  let releaseAnchor!: () => void;
  const heldAnchor = new Promise<void>((resolve) => {
    releaseAnchor = resolve;
  });
  await page.route("**/assets/coscroll/source-models/101_*", async (route) => {
    await heldAnchor;
    await route.continue();
  });

  await page.goto("/radio-gaga");
  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "waiting-ready");
  await page.locator("canvas").dispatchEvent("webglcontextlost");
  await expect(page.locator('[data-visual-fallback="coscroll"]')).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-chapter-transition-state", /.+/, { timeout: 2_200 });
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", "true");

  const phases = await readTransitionPhases(page);
  expect(phases).toContain("fallback-ready");
  expect(phases).not.toContain("fallback-entry");
  releaseAnchor();
});

test("a CoScroll readiness timeout commits its visible fallback before releasing input", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The CoScroll timeout contract only needs one browser profile.");

  let releaseAnchor!: () => void;
  const heldAnchor = new Promise<void>((resolve) => {
    releaseAnchor = resolve;
  });
  await page.route("**/assets/coscroll/source-models/101_*", async (route) => {
    await heldAnchor;
    await route.continue();
  });

  await page.goto("/radio-gaga");
  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await expect(page.locator('[data-visual-fallback="coscroll"]')).toBeVisible({ timeout: 5_000 });
  await waitForIdle(page);
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", "true");
  const phases = await readTransitionPhases(page);
  expect(phases).toContain("fallback-ready");
  expect(phases).not.toContain("recovery-begin");
  releaseAnchor();
});

test("a CoScroll current-anchor failure reveals the same visible fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The CoScroll asset-failure contract only needs one browser profile.");
  await page.route("**/assets/coscroll/source-models/101_*", (route) => route.abort());

  await page.goto("/radio-gaga");
  await armRadioGagaTerminal(page);
  await crossTerminalThreshold(page);
  await expect(page).toHaveURL(/\/coscroll$/);
  await expect(page.locator('[data-visual-fallback="coscroll"]')).toBeVisible();
  await waitForIdle(page);
  await expect(page.locator("[data-coscroll-progress]")).toHaveAttribute("data-coscroll-input-enabled", "true");
});

test("an opening-model failure reveals the visible Radio Gaga fallback and releases the veil", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The fallback lifecycle only needs one browser profile.");
  await page.route("**/model/radio_gaga.glb", (route) => route.abort());

  await enterHomepageRuntime(page);
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.25, behavior: "instant" }));
  await page.locator(".lubirth-revised__title-rail a", { hasText: "Radio Gaga" }).click();
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect(page.locator('[data-visual-fallback="radio-gaga"]')).toBeVisible();
  await waitForIdle(page);
});

test("a rejected target reset restores the source through reset and readiness gates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The recovery lifecycle only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  const sourceScrollY = await page.evaluate(() => window.scrollY);
  await installRadioResetFault(page, "reject");
  await page.locator(".miralith-chapter-nav__terminal a").click();

  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  await expect(page.locator(".lubirth-revised [data-chapter-terminal='armed']").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(sourceScrollY * 0.85);
  expect(await page.evaluate(() => Boolean(
    (window as typeof window & { __chapterResetFaultTriggered?: boolean }).__chapterResetFaultTriggered
  ))).toBe(true);

  const phases = await readTransitionPhases(page);
  const recoveryBegin = phases.indexOf("recovery-begin");
  const recoveryReset = phases.indexOf("recovery-entry-reset", recoveryBegin);
  const recoveryReady = Math.max(
    phases.indexOf("recovery-visual-ready", recoveryBegin),
    phases.indexOf("recovery-fallback-ready", recoveryBegin)
  );
  const revealing = phases.indexOf("revealing", recoveryBegin);
  expect(recoveryBegin).toBeGreaterThanOrEqual(0);
  expect(recoveryReset).toBeGreaterThan(recoveryBegin);
  expect(recoveryReady).toBeGreaterThan(recoveryBegin);
  expect(revealing).toBeGreaterThan(recoveryReset);
  expect(revealing).toBeGreaterThan(recoveryReady);

  await page.evaluate(() => window.history.forward());
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await waitForIdle(page);
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
});

test("the hard deadline recovers when readiness arrives before a hanging reset", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The hard-deadline lifecycle only needs one browser profile.");

  await enterHomepageRuntime(page);
  await armHomepageTerminal(page);
  await installRadioResetFault(page, "hang");
  await page.locator(".miralith-chapter-nav__terminal a").click();
  await expect(page).toHaveURL(/\/radio-gaga$/);
  await expect(page.locator("html")).toHaveAttribute("data-chapter-transition-state", "resetting-entry");

  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("mark")
    .some((entry) => entry.name.endsWith(":recovery-begin"))), { timeout: 8_000 }).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await waitForIdle(page);
  const recoveredSourceState = await page.evaluate(() => ({
    scrollY: window.scrollY,
    progress: window.__MiraLithOpeningProgress ?? null,
    targetResetScrollCount: (window as typeof window & {
      __chapterTargetResetScrollCount?: number;
    }).__chapterTargetResetScrollCount ?? 0
  }));
  await page.evaluate(() => {
    const state = window as typeof window & { __releaseChapterReset?: () => void };
    state.__releaseChapterReset?.();
  });
  await page.waitForTimeout(500);
  const sourceStateAfterLateReset = await page.evaluate(() => ({
    scrollY: window.scrollY,
    progress: window.__MiraLithOpeningProgress ?? null,
    targetResetScrollCount: (window as typeof window & {
      __chapterTargetResetScrollCount?: number;
    }).__chapterTargetResetScrollCount ?? 0
  }));
  expect(Math.abs(sourceStateAfterLateReset.scrollY - recoveredSourceState.scrollY)).toBeLessThan(2);
  expect(sourceStateAfterLateReset.progress).toBe(recoveredSourceState.progress);
  expect(sourceStateAfterLateReset.targetResetScrollCount).toBe(recoveredSourceState.targetResetScrollCount);
  expect(await page.evaluate(() => Boolean(
    (window as typeof window & { __chapterResetFaultTriggered?: boolean }).__chapterResetFaultTriggered
  ))).toBe(true);

  const phases = await readTransitionPhases(page);
  const recoveryBegin = phases.indexOf("recovery-begin");
  const targetReady = Math.max(
    phases.lastIndexOf("visual-ready", recoveryBegin - 1),
    phases.lastIndexOf("fallback-ready", recoveryBegin - 1)
  );
  expect(targetReady).toBeGreaterThanOrEqual(0);
  expect(targetReady).toBeLessThan(recoveryBegin);
  expect(phases.filter((phase) => phase === "entry-reset")).toHaveLength(0);
  expect(phases.filter((phase) => phase === "recovery-entry-reset")).toHaveLength(1);
  expect(phases.indexOf("recovery-entry-reset", recoveryBegin)).toBeGreaterThan(recoveryBegin);
  expect(phases.indexOf("revealing", recoveryBegin)).toBeGreaterThan(recoveryBegin);
  await expect(page.locator("body")).not.toHaveAttribute("aria-busy", "true");
});
