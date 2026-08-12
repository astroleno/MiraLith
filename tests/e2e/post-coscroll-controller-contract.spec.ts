import { expect, test, type Page } from "@playwright/test";

interface PlayCall {
  generation: number;
  trigger: "click" | "enter";
  isActive: boolean;
}

async function installControlledPlay(page: Page) {
  await page.addInitScript(() => {
    const pending = new Map<number, {
      resolve: () => void;
      reject: (reason?: unknown) => void;
    }>();
    const calls: Array<{ generation: number; trigger: string; isActive: boolean }> = [];
    Object.defineProperty(window, "__miralithContractPlay", {
      value: {
        calls,
        resolve(generation: number) {
          pending.get(generation)?.resolve();
          pending.delete(generation);
        },
        reject(generation: number) {
          pending.get(generation)?.reject(new DOMException("Injected rejection", "NotAllowedError"));
          pending.delete(generation);
        }
      },
      configurable: true
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value(this: HTMLMediaElement) {
        const generation = Number(this.dataset.contractGeneration);
        calls.push({
          generation,
          trigger: this.dataset.contractTrigger ?? "unknown",
          isActive: navigator.userActivation.isActive
        });
        return new Promise<void>((resolve, reject) => {
          pending.set(generation, { resolve, reject });
        });
      }
    });
  });
}

async function playCalls(page: Page): Promise<PlayCall[]> {
  return page.evaluate(() => (
    window as typeof window & { __miralithContractPlay: { calls: PlayCall[] } }
  ).__miralithContractPlay.calls);
}

async function settlePlay(page: Page, generation: number, outcome: "resolve" | "reject") {
  await page.evaluate(({ generation: target, outcome: result }) => {
    const harness = (
      window as typeof window & {
        __miralithContractPlay: {
          resolve: (generation: number) => void;
          reject: (generation: number) => void;
        };
      }
    ).__miralithContractPlay;
    harness[result](target);
  }, { generation, outcome });
}

async function openFixture(page: Page) {
  await installControlledPlay(page);
  await page.goto("/spikes/post-coscroll-controller-contract");
  const root = page.locator("[data-post-coscroll-controller-contract]");
  await expect(root).toHaveAttribute("data-mounted", "true");
  await expect(root).toHaveAttribute("data-synchronized", "true");
  return root;
}

async function enterPhase(
  page: Page,
  phase: "scrub" | "await-send" | "answer-starting" | "manual-ready" | "autoplay"
    | "reverse-before-complete" | "released-hold" | "reverse-after-complete" | "transitioning"
) {
  const root = await openFixture(page);
  if (phase === "await-send") return root;

  if (phase === "scrub") {
    await root.locator("[data-contract-action='reset']").click();
  } else if (phase === "released-hold" || phase === "reverse-after-complete") {
    await root.locator("[data-contract-action='skip']").click();
    if (phase === "reverse-after-complete") {
      await root.locator("[data-contract-action='reverse']").click();
    }
  } else if (phase === "transitioning") {
    await root.locator("[data-contract-action='route-transition']").click();
  } else {
    await page.getByRole("button", { name: "Send answer" }).click();
    const [call] = await playCalls(page);
    if (phase === "manual-ready") {
      await settlePlay(page, call.generation, "reject");
    } else if (phase === "autoplay") {
      await settlePlay(page, call.generation, "resolve");
    } else if (phase === "reverse-before-complete") {
      await root.locator("[data-contract-action='reverse']").click();
    }
  }

  await expect(root).toHaveAttribute("data-phase", phase);
  return root;
}

test("click and Enter call play synchronously with active user activation and one canonical generation", async ({ page }) => {
  const root = await openFixture(page);
  await page.getByRole("button", { name: "Send answer" }).click();
  await expect.poll(() => playCalls(page)).toHaveLength(1);
  const [clickCall] = await playCalls(page);
  expect(clickCall).toMatchObject({ trigger: "click", isActive: true });
  await expect(root).toHaveAttribute("data-controller-generation", String(clickCall.generation));
  await expect(root).toHaveAttribute("data-reducer-generation", String(clickCall.generation));
  await expect(root).toHaveAttribute("data-synchronized", "true");

  await settlePlay(page, clickCall.generation, "reject");
  await expect(root).toHaveAttribute("data-phase", "manual-ready");
  await expect(root).toHaveAttribute("data-controller-generation", "");
  await expect(root).toHaveAttribute("data-reducer-generation", "");

  const video = root.locator("video");
  await video.dispatchEvent("playing");
  await video.dispatchEvent("ended");
  await expect(root).toHaveAttribute("data-phase", "manual-ready");
  await expect(root).toHaveAttribute("data-completed-media", "");

  const retry = page.getByRole("button", { name: "Retry answer" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => playCalls(page)).toHaveLength(2);
  const [, enterCall] = await playCalls(page);
  expect(enterCall).toMatchObject({ trigger: "enter", isActive: true });
  expect(enterCall.generation).toBeGreaterThan(clickCall.generation);
  await expect(root).toHaveAttribute("data-controller-generation", String(enterCall.generation));
  await expect(root).toHaveAttribute("data-reducer-generation", String(enterCall.generation));

  await settlePlay(page, enterCall.generation, "resolve");
  await expect(root).toHaveAttribute("data-phase", "autoplay");
  await expect(root).toHaveAttribute("data-synchronized", "true");
});

test("a replacement attempt owns the reducer before the first play promise resolves", async ({ page }) => {
  const root = await openFixture(page);
  await page.getByRole("button", { name: "Send answer" }).click();
  await expect.poll(() => playCalls(page)).toHaveLength(1);
  const [first] = await playCalls(page);
  const firstVideo = root.locator(`video[data-contract-generation='${first.generation}']`);
  await expect(firstVideo).toHaveCount(1);

  await page.getByRole("button", { name: "Replace attempt" }).click();
  await expect.poll(() => playCalls(page)).toHaveLength(2);
  const [, second] = await playCalls(page);
  expect(second.generation).toBeGreaterThan(first.generation);
  await expect(root).toHaveAttribute("data-controller-generation", String(second.generation));
  await expect(root).toHaveAttribute("data-reducer-generation", String(second.generation));
  const secondVideo = root.locator(`video[data-contract-generation='${second.generation}']`);
  await expect(secondVideo).toHaveCount(1);

  await firstVideo.dispatchEvent("playing");
  await firstVideo.dispatchEvent("ended");
  await expect(root).toHaveAttribute("data-phase", "answer-starting");
  await expect(root).toHaveAttribute("data-controller-generation", String(second.generation));
  await expect(root).toHaveAttribute("data-completed-media", "");

  await settlePlay(page, first.generation, "resolve");
  await expect(root).toHaveAttribute("data-phase", "answer-starting");
  await expect(root).toHaveAttribute("data-controller-generation", String(second.generation));
  await expect(root).toHaveAttribute("data-completed-media", "");

  await settlePlay(page, second.generation, "resolve");
  await expect(root).toHaveAttribute("data-phase", "autoplay");
  await firstVideo.dispatchEvent("playing");
  await firstVideo.dispatchEvent("ended");
  await expect(root).toHaveAttribute("data-phase", "autoplay");
  await expect(root).toHaveAttribute("data-controller-generation", String(second.generation));
  await expect(root).toHaveAttribute("data-completed-media", "");
  await expect(root.locator("[data-contract-action='pause']")).toBeDisabled();
  await expect(root).toHaveAttribute("data-synchronized", "true");
});

test("real media ownership stays invalid after lifecycle exits and delayed resolution", async ({ page }) => {
  const cases = [
    { reason: "skip", phase: "released-hold" },
    { reason: "cancel", phase: "manual-ready" },
    { reason: "reverse", phase: "reverse-before-complete" },
    { reason: "pause", phase: "manual-ready" },
    { reason: "route-transition", phase: "transitioning" },
    { reason: "direct-navigation", phase: "transitioning" },
    { reason: "history-navigation", phase: "transitioning" },
    { reason: "reset", phase: "scrub" },
    { reason: "hidden", phase: "transitioning" }
  ] as const;

  for (const entry of cases) {
    const root = await openFixture(page);
    await page.getByRole("button", { name: "Send answer" }).click();
    await expect.poll(() => playCalls(page)).toHaveLength(1);
    const [call] = await playCalls(page);

    if (entry.reason === "direct-navigation") {
      await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide")));
    } else if (entry.reason === "history-navigation") {
      await page.evaluate(() => {
        history.pushState({}, "", "?history-contract=1");
        dispatchEvent(new PopStateEvent("popstate"));
      });
    } else if (entry.reason === "hidden") {
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden"
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    } else {
      await page.locator(`[data-contract-action='${entry.reason}']`).click();
    }

    await expect(root).toHaveAttribute("data-phase", entry.phase);
    await expect(root).toHaveAttribute("data-controller-generation", "");
    await expect(root).toHaveAttribute("data-reducer-generation", "");
    await settlePlay(page, call.generation, "resolve");
    await expect(root).toHaveAttribute("data-phase", entry.phase);
    await expect(root).toHaveAttribute("data-completed-media", "");
    await expect(root).toHaveAttribute(
      "data-skipped-media",
      entry.reason === "skip" ? "answer-media" : ""
    );
    await expect.poll(async () => Number(await root.getAttribute("data-pause-count"))).toBeGreaterThan(0);
  }
});

test("ended and unmount invalidate a real element without allowing late events to revive it", async ({ page }) => {
  const root = await openFixture(page);
  await page.getByRole("button", { name: "Send answer" }).click();
  const [call] = await playCalls(page);
  await settlePlay(page, call.generation, "resolve");
  await expect(root).toHaveAttribute("data-phase", "autoplay");
  await root.locator("video").dispatchEvent("ended");
  await expect(root).toHaveAttribute("data-phase", "released-hold");
  await expect(root).toHaveAttribute("data-completed-media", "answer-media");
  await expect(root).toHaveAttribute("data-controller-generation", "");

  await page.reload();
  const reloaded = page.locator("[data-post-coscroll-controller-contract]");
  await page.getByRole("button", { name: "Send answer" }).click();
  const pending = (await playCalls(page)).at(-1);
  expect(pending).toBeTruthy();
  await page.locator("[data-contract-action='unmount']").click();
  await expect(reloaded).toHaveAttribute("data-mounted", "false");
  await settlePlay(page, pending!.generation, "resolve");
  await expect(reloaded).toHaveAttribute("data-mounted", "false");
  await expect.poll(async () => Number(await reloaded.getAttribute("data-pause-count"))).toBeGreaterThan(0);
});

test("playback entry permissions match every reducer phase", async ({ page }) => {
  const matrix = [
    { phase: "scrub", begin: false, replace: false },
    { phase: "await-send", begin: true, replace: false },
    { phase: "answer-starting", begin: false, replace: true },
    { phase: "manual-ready", begin: true, replace: false },
    { phase: "autoplay", begin: false, replace: false },
    { phase: "reverse-before-complete", begin: false, replace: false },
    { phase: "released-hold", begin: true, replace: false },
    { phase: "reverse-after-complete", begin: true, replace: false },
    { phase: "transitioning", begin: false, replace: false }
  ] as const;

  for (const entry of matrix) {
    const root = await enterPhase(page, entry.phase);
    await expect(root).toHaveAttribute("data-can-begin-playback", String(entry.begin));
    await expect(root).toHaveAttribute("data-can-replace-playback", String(entry.replace));
    const beginButton = root.getByRole("button", { name: /^(Send|Retry|Replay) answer$/ });
    const replaceButton = root.getByRole("button", { name: "Replace attempt" });
    if (entry.begin) await expect(beginButton).toBeEnabled();
    else await expect(beginButton).toBeDisabled();
    if (entry.replace) await expect(replaceButton).toBeEnabled();
    else await expect(replaceButton).toBeDisabled();
    await expect(root).toHaveAttribute("data-synchronized", "true");
  }
});

test("autoplay rejects forced Send and Replace activation without allocating or playing", async ({ page }) => {
  const root = await enterPhase(page, "autoplay");
  const callsBefore = await playCalls(page);
  const controllerBefore = await root.getAttribute("data-controller-generation");
  const reducerBefore = await root.getAttribute("data-reducer-generation");

  for (const button of [
    root.getByRole("button", { name: "Send answer" }),
    root.getByRole("button", { name: "Replace attempt" })
  ]) {
    await button.evaluate((element) => {
      element.removeAttribute("disabled");
      (element as HTMLButtonElement).click();
    });
  }

  expect(await playCalls(page)).toEqual(callsBefore);
  await expect(root).toHaveAttribute("data-controller-generation", controllerBefore ?? "");
  await expect(root).toHaveAttribute("data-reducer-generation", reducerBefore ?? "");
  await expect(root).toHaveAttribute("data-phase", "autoplay");
  await expect(root).toHaveAttribute("data-synchronized", "true");
});

test("lifecycle controls match the reducer phase matrix", async ({ page }) => {
  const actions = ["skip", "cancel", "reverse", "pause", "route-transition", "reset"] as const;
  const matrix = [
    { phase: "scrub", allowed: ["route-transition", "reset"] },
    { phase: "await-send", allowed: ["skip", "reverse", "route-transition", "reset"] },
    {
      phase: "answer-starting",
      allowed: ["skip", "cancel", "reverse", "pause", "route-transition", "reset"]
    },
    { phase: "manual-ready", allowed: ["skip", "reverse", "route-transition", "reset"] },
    { phase: "autoplay", allowed: ["skip", "reverse", "route-transition", "reset"] },
    { phase: "reverse-before-complete", allowed: ["route-transition", "reset"] },
    { phase: "released-hold", allowed: ["reverse", "route-transition", "reset"] },
    { phase: "reverse-after-complete", allowed: ["route-transition", "reset"] },
    { phase: "transitioning", allowed: ["reset"] }
  ] as const;

  for (const entry of matrix) {
    const root = await enterPhase(page, entry.phase);
    for (const action of actions) {
      const allowed = (entry.allowed as readonly string[]).includes(action);
      await expect(root).toHaveAttribute(`data-can-lifecycle-${action}`, String(allowed));
      const button = root.locator(`[data-contract-action='${action}']`);
      if (allowed) await expect(button).toBeEnabled();
      else await expect(button).toBeDisabled();
    }
    await expect(root).toHaveAttribute("data-synchronized", "true");
  }
});

test("autoplay rejects Cancel and forced Pause before invalidating ownership", async ({ page }) => {
  for (const action of ["cancel", "pause"] as const) {
    const root = await enterPhase(page, "autoplay");
    const callsBefore = await playCalls(page);
    const controllerBefore = await root.getAttribute("data-controller-generation");
    const reducerBefore = await root.getAttribute("data-reducer-generation");
    const pauseCountBefore = await root.getAttribute("data-pause-count");
    const resultBefore = await root.getAttribute("data-last-result");
    const button = root.locator(`[data-contract-action='${action}']`);

    await expect(button).toBeDisabled();
    const forceButton = root.locator(`[data-contract-force-action='${action}']`);
    await expect(forceButton).toHaveCount(1);
    await forceButton.dispatchEvent("click");

    expect(await playCalls(page)).toEqual(callsBefore);
    await expect(root).toHaveAttribute("data-controller-generation", controllerBefore ?? "");
    await expect(root).toHaveAttribute("data-reducer-generation", reducerBefore ?? "");
    await expect(root).toHaveAttribute("data-pause-count", pauseCountBefore ?? "0");
    await expect(root).toHaveAttribute("data-last-result", resultBefore ?? "playing");
    await expect(root).toHaveAttribute("data-phase", "autoplay");
    await expect(root).toHaveAttribute("data-synchronized", "true");
  }
});
