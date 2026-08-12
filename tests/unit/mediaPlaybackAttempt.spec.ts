import { expect, test } from "@playwright/test";
import {
  createMediaPlaybackAttemptController,
  type MediaPlaybackAttemptController,
  type MediaPlaybackAttemptToken
} from "../../apps/site/components/post-coscroll/mediaPlaybackAttempt";
import {
  reduceNarrativeControllerState,
  type NarrativeControllerState
} from "../../apps/site/components/post-coscroll/narrativeControllerState";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

interface FakeMediaFixture {
  element: HTMLMediaElement;
  pauseCount: () => number;
  playCount: () => number;
  setPaused: (value: boolean) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeMedia(play: () => Promise<void> = async () => undefined): FakeMediaFixture {
  let paused = true;
  let pauses = 0;
  let plays = 0;
  const element = {
    get paused() {
      return paused;
    },
    pause() {
      pauses += 1;
      paused = true;
    },
    play() {
      plays += 1;
      return play();
    }
  } as HTMLMediaElement;
  return {
    element,
    pauseCount: () => pauses,
    playCount: () => plays,
    setPaused: (value) => {
      paused = value;
    }
  };
}

function begin(
  controller: MediaPlaybackAttemptController,
  media: FakeMediaFixture,
  overrides: Partial<Omit<MediaPlaybackAttemptToken, "generation" | "element">> = {}
) {
  return controller.begin({
    segmentId: "prompt",
    element: media.element,
    transitionId: null,
    ...overrides
  });
}

test("allocates monotonic ownership tokens and pauses the superseded element", () => {
  const controller = createMediaPlaybackAttemptController();
  const firstMedia = fakeMedia();
  const secondMedia = fakeMedia();
  const first = begin(controller, firstMedia);
  const second = begin(controller, secondMedia, { segmentId: "answer", transitionId: "transition-2" });

  expect(second.generation).toBeGreaterThan(first.generation);
  expect(firstMedia.pauseCount()).toBe(1);
  expect(controller.isCurrent(first)).toBe(false);
  expect(controller.isCurrent(second)).toBe(true);
  expect(controller.isCurrent({ ...second, generation: second.generation + 1 })).toBe(false);
  expect(controller.isCurrent({ ...second, segmentId: "other" })).toBe(false);
  expect(controller.isCurrent({ ...second, element: firstMedia.element })).toBe(false);
  expect(controller.isCurrent({ ...second, transitionId: "other" })).toBe(false);
});

test("invalidates every lifecycle reason through the same monotonic owner", () => {
  const reasons = [
    "skip",
    "cancel",
    "reverse",
    "pause",
    "ended",
    "new-attempt",
    "rejected",
    "route-transition",
    "navigation",
    "reset",
    "hidden",
    "unmount"
  ] as const satisfies readonly Parameters<MediaPlaybackAttemptController["invalidate"]>[0][];

  for (const reason of reasons) {
    const controller = createMediaPlaybackAttemptController();
    const media = fakeMedia();
    const token = begin(controller, media);
    controller.invalidate(reason);

    expect(controller.isCurrent(token), reason).toBe(false);
    expect(media.pauseCount(), reason).toBe(1);
    expect(begin(controller, fakeMedia()).generation, reason).toBeGreaterThan(token.generation);
  }
});

test("guards continuations and re-pauses a stale element that starts later", () => {
  const controller = createMediaPlaybackAttemptController();
  const media = fakeMedia();
  const token = begin(controller, media);
  let continuationCount = 0;

  expect(controller.guard(token, () => {
    continuationCount += 1;
  })).toBe(true);
  controller.invalidate("cancel");
  media.setPaused(false);
  expect(controller.guard(token, () => {
    continuationCount += 1;
  })).toBe(false);

  expect(continuationCount).toBe(1);
  expect(media.pauseCount()).toBe(2);
});

test("calls play synchronously and reports a current fulfillment as playing", async () => {
  const pending = deferred<void>();
  const media = fakeMedia(() => pending.promise);
  const controller = createMediaPlaybackAttemptController();
  const token = begin(controller, media);

  const result = controller.requestPlay(token);
  expect(media.playCount()).toBe(1);
  pending.resolve(undefined);

  await expect(result).resolves.toBe("playing");
  expect(controller.isCurrent(token)).toBe(true);
});

test("returns stale and re-pauses when an invalidated play fulfills late", async () => {
  const pending = deferred<void>();
  const media = fakeMedia(() => pending.promise);
  const controller = createMediaPlaybackAttemptController();
  const token = begin(controller, media);
  const result = controller.requestPlay(token);

  controller.invalidate("reverse");
  media.setPaused(false);
  pending.resolve(undefined);

  await expect(result).resolves.toBe("stale");
  expect(media.pauseCount()).toBe(2);
});

test("invalidates current synchronous and asynchronous play rejection before reporting it", async () => {
  const asynchronous = deferred<void>();
  const asyncMedia = fakeMedia(() => asynchronous.promise);
  const asyncController = createMediaPlaybackAttemptController();
  const asyncToken = begin(asyncController, asyncMedia);
  const asyncResult = asyncController.requestPlay(asyncToken);
  asynchronous.reject(new Error("blocked"));

  await expect(asyncResult).resolves.toBe("rejected");
  expect(asyncController.isCurrent(asyncToken)).toBe(false);
  expect(asyncMedia.pauseCount()).toBe(1);

  const syncMedia = fakeMedia(() => {
    throw new Error("sync blocked");
  });
  const syncController = createMediaPlaybackAttemptController();
  const syncToken = begin(syncController, syncMedia);
  const syncResult = syncController.requestPlay(syncToken);

  expect(syncMedia.playCount()).toBe(1);
  await expect(syncResult).resolves.toBe("rejected");
  expect(syncController.isCurrent(syncToken)).toBe(false);
  expect(syncMedia.pauseCount()).toBe(1);
});

test("a stale rejection cannot invalidate the replacement attempt", async () => {
  const pending = deferred<void>();
  const firstMedia = fakeMedia(() => pending.promise);
  const secondMedia = fakeMedia();
  const controller = createMediaPlaybackAttemptController();
  const first = begin(controller, firstMedia);
  const firstResult = controller.requestPlay(first);
  const second = begin(controller, secondMedia);

  pending.reject(new Error("late rejection"));

  await expect(firstResult).resolves.toBe("stale");
  expect(controller.isCurrent(second)).toBe(true);
  expect(secondMedia.pauseCount()).toBe(0);
});

test("a stale promise cannot pause a replacement that owns the same element", async () => {
  for (const staleOutcome of ["resolve", "reject"] as const) {
    const firstPlay = deferred<void>();
    const secondPlay = deferred<void>();
    let requestCount = 0;
    const media = fakeMedia(() => {
      requestCount += 1;
      return requestCount === 1 ? firstPlay.promise : secondPlay.promise;
    });
    const controller = createMediaPlaybackAttemptController();
    const first = begin(controller, media);
    const firstResult = controller.requestPlay(first);
    const second = begin(controller, media);
    const secondResult = controller.requestPlay(second);

    secondPlay.resolve(undefined);
    await expect(secondResult).resolves.toBe("playing");
    media.setPaused(false);
    if (staleOutcome === "resolve") {
      firstPlay.resolve(undefined);
    } else {
      firstPlay.reject(new Error("late rejection"));
    }

    await expect(firstResult).resolves.toBe("stale");
    expect(controller.isCurrent(second), staleOutcome).toBe(true);
    expect(media.pauseCount(), staleOutcome).toBe(1);
  }
});

test("a stale guard cannot pause the element owned by a replacement token", () => {
  const media = fakeMedia();
  const controller = createMediaPlaybackAttemptController();
  const first = begin(controller, media);
  const second = begin(controller, media);
  media.setPaused(false);

  expect(controller.guard(first, () => {
    throw new Error("stale continuation ran");
  })).toBe(false);
  expect(controller.isCurrent(second)).toBe(true);
  expect(media.pauseCount()).toBe(1);
});

test("shares the controller generation with the reducer until synchronous invalidation", () => {
  const controller = createMediaPlaybackAttemptController();
  const token = begin(controller, fakeMedia());
  const initial: NarrativeControllerState = {
    segmentId: "prompt",
    phase: "await-send",
    progress: 1,
    activeMediaId: null,
    attemptGeneration: null,
    completedMediaIds: [],
    skippedMediaIds: [],
    gateReleased: false,
    resumePhase: null,
    freshInputArmed: false
  };
  const began = reduceNarrativeControllerState(initial, {
    kind: "attempt-began",
    mediaId: "answer-media",
    generation: token.generation
  });

  expect(began).toMatchObject({
    accepted: true,
    state: { activeMediaId: "answer-media", attemptGeneration: token.generation }
  });
  expect(controller.isCurrent(token)).toBe(true);
  if (!began.accepted) {
    throw new Error("attempt-began fixture was rejected");
  }

  controller.invalidate("cancel");
  const cancelled = reduceNarrativeControllerState(began.state, { kind: "cancel" });
  expect(controller.isCurrent(token)).toBe(false);
  expect(cancelled).toMatchObject({
    accepted: true,
    state: { activeMediaId: null, attemptGeneration: null, phase: "manual-ready" }
  });
});
