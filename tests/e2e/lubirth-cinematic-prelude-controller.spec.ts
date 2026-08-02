import { expect, test } from "@playwright/test";
import {
  CinematicPreludeController,
  PRELUDE_TIMING
} from "../../apps/site/components/lubirth-cinematic-prelude/controller";
import type {
  FrameAvailability,
  FrameProvider,
  PreludeFallbackReason
} from "../../apps/site/components/lubirth-cinematic-prelude/types";

class FakeFrameProvider implements FrameProvider {
  readonly tier: "desktop" | "mobile";
  readonly frameRate = 30;
  readonly frameCount = 48;
  readonly metadata = { manifestId: "test-manifest", src: "/test.mp4" };
  armResult: FrameAvailability = { state: "ready", renderedFrame: 0 };
  requestResult: FrameAvailability = { state: "ready", renderedFrame: 0 };
  requested: Array<{ frame: number; deadlineMs: number }> = [];
  releaseCount = 0;
  disposed = false;

  constructor(tier: "desktop" | "mobile" = "desktop") {
    this.tier = tier;
  }

  async arm() {
    return this.armResult;
  }

  async requestFrame(frame: number, deadlineMs: number) {
    this.requested.push({ frame, deadlineMs });
    return this.requestResult;
  }

  releasePresentationResources() {
    this.releaseCount += 1;
  }

  dispose() {
    this.disposed = true;
  }
}

test("locks the whole forward cycle to live when frame zero is not armed", async () => {
  const provider = new FakeFrameProvider();
  provider.armResult = { state: "pending", requestedFrame: 0 };
  const controller = new CinematicPreludeController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  const atOpening = await controller.updateProgress(0.1, "forward");

  expect(atOpening).toMatchObject({
    source: "live",
    state: "fallback-live",
    veilOpacity: 0,
    forwardCycleLockedToLive: true,
    fallbackReason: "late-first-frame"
  });
});

test("performs one veil-protected forward source cut and releases at live lock", async () => {
  const provider = new FakeFrameProvider();
  const controller = new CinematicPreludeController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  expect(await controller.updateProgress(0.1, "forward")).toMatchObject({
    source: "plate",
    state: "plate",
    veilOpacity: 0,
    renderedFrame: 0
  });
  expect(await controller.updateProgress(0.1875, "forward")).toMatchObject({
    source: "plate",
    state: "forward-veil-close",
    veilOpacity: 0.5
  });
  expect(await controller.updateProgress(PRELUDE_TIMING.veilPeak, "forward")).toMatchObject({
    source: "live",
    state: "forward-veil-open",
    veilOpacity: 1,
    sourceCutCount: 1
  });
  expect(await controller.updateProgress(PRELUDE_TIMING.liveStart, "forward")).toMatchObject({
    source: "live",
    state: "live",
    veilOpacity: 0,
    sourceCutCount: 1,
    presentationResourcesReleased: true
  });
  expect(provider.releaseCount).toBe(1);
});

test("does not perform a second cut while progress jitters inside the dead band", async () => {
  const provider = new FakeFrameProvider();
  const controller = new CinematicPreludeController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  await controller.updateProgress(0.196, "forward");
  await controller.updateProgress(0.19, "forward");
  await controller.updateProgress(0.205, "forward");
  const snapshot = await controller.updateProgress(0.185, "forward");

  expect(snapshot.source).toBe("live");
  expect(snapshot.sourceCutCount).toBe(1);
});

test("reverse waits for the requested frame and exposes it only at the veil peak", async () => {
  const provider = new FakeFrameProvider();
  const controller = new CinematicPreludeController({ provider, tier: "desktop" });
  await controller.armForwardCycle();
  await controller.updateProgress(0.22, "forward");
  provider.requestResult = { state: "ready", renderedFrame: 41 };

  const closing = await controller.updateProgress(0.205, "reverse");
  expect(closing).toMatchObject({
    source: "live",
    state: "reverse-veil-close"
  });

  const ready = await controller.updateProgress(0.19, "reverse");
  expect(provider.requested).toEqual([{ frame: 41, deadlineMs: 450 }]);
  expect(ready).toMatchObject({
    source: "plate",
    state: "plate",
    requestedFrame: 41,
    renderedFrame: 41,
    sourceCutCount: 2
  });
});

test("reverse timeout reopens live instead of holding an opaque veil", async () => {
  const provider = new FakeFrameProvider("mobile");
  const controller = new CinematicPreludeController({ provider, tier: "mobile" });
  await controller.armForwardCycle();
  await controller.updateProgress(0.22, "forward");
  provider.requestResult = { state: "failed", reason: "timeout" };

  const timedOut = await controller.updateProgress(0.19, "reverse");

  expect(provider.requested).toEqual([{ frame: 41, deadlineMs: 700 }]);
  expect(timedOut).toMatchObject({
    source: "live",
    state: "fallback-live",
    veilOpacity: 0,
    fallbackReason: "reverse-timeout"
  });
});

test("release preserves provider metadata and happens only once", async () => {
  const provider = new FakeFrameProvider();
  const metadata = provider.metadata;
  const controller = new CinematicPreludeController({ provider, tier: "desktop" });
  await controller.armForwardCycle();

  await controller.updateProgress(0.22, "forward");
  await controller.updateProgress(0.3, "forward");

  expect(provider.releaseCount).toBe(1);
  expect(provider.metadata).toBe(metadata);
  expect(provider.metadata.manifestId).toBe("test-manifest");
});

for (const reason of [
  "reduced-motion",
  "decode-error",
  "background-unverified",
  "low-memory"
] satisfies PreludeFallbackReason[]) {
  test(`${reason} selects explicit live fallback`, async () => {
    const provider = new FakeFrameProvider();
    const controller = new CinematicPreludeController({ provider, tier: "desktop" });
    await controller.armForwardCycle();

    const snapshot = controller.forceFallback(reason);

    expect(snapshot).toMatchObject({
      source: "live",
      state: "fallback-live",
      veilOpacity: 0,
      fallbackReason: reason,
      forwardCycleLockedToLive: true
    });
  });
}
