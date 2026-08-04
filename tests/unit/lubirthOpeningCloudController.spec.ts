import { expect, test } from "@playwright/test";
import { OpeningCloudController } from "../../apps/site/components/lubirth-cloud-asset-opening/controller";
import type {
  CloudFrameAvailability,
  CloudFrameProvider
} from "../../apps/site/components/lubirth-cloud-asset-opening/types";

class FakeCloudProvider implements CloudFrameProvider {
  readonly tier: "desktop" | "mobile" = "desktop";
  readonly frameRate = 30;
  readonly frameCount = 48;
  readonly metadata = {
    manifestId: "lubirth-opening-cloud-pack-v1",
    src: "/assets/lubirth/opening-clouds/desktop.mp4"
  };
  readonly requestedFrames: number[] = [];
  releaseCalls = 0;
  disposeCalls = 0;
  armResult: CloudFrameAvailability = { state: "ready", renderedFrame: 0 };
  requestResult: CloudFrameAvailability | ((frame: number) => CloudFrameAvailability) =
    (frame) => ({ state: "ready", renderedFrame: frame });

  async arm() {
    return this.armResult;
  }

  async requestFrame(frame: number, _deadlineMs: number) {
    this.requestedFrames.push(frame);
    return typeof this.requestResult === "function"
      ? this.requestResult(frame)
      : this.requestResult;
  }

  releasePresentationResources() {
    this.releaseCalls += 1;
  }

  dispose() {
    this.disposeCalls += 1;
  }
}

test("keeps the real Earth visible for a late first cloud frame", async () => {
  const provider = new FakeCloudProvider();
  provider.armResult = { state: "pending", requestedFrame: 0 };
  const controller = new OpeningCloudController({ provider, tier: "desktop" });

  await controller.armForwardCycle();

  expect(controller.getSnapshot()).toMatchObject({
    source: "live",
    state: "fallback-live",
    fallbackReason: "late-first-frame",
    veilOpacity: 0,
    forwardCycleLockedToLive: true
  });
  expect(provider.releaseCalls).toBe(1);
});

test("seeks cloud frames, atomically cuts below a closed veil, then releases at 0.22", async () => {
  const provider = new FakeCloudProvider();
  const controller = new OpeningCloudController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  await controller.updateProgress(0.12, "forward");
  expect(controller.getSnapshot()).toMatchObject({
    source: "cloud",
    state: "cloud",
    veilOpacity: 0,
    renderedFrame: 26
  });

  await controller.updateProgress(0.19, "forward");
  expect(controller.getSnapshot()).toMatchObject({
    source: "cloud",
    state: "forward-veil-close"
  });
  expect(controller.getSnapshot().veilOpacity).toBeGreaterThan(0);

  await controller.updateProgress(0.195, "forward");
  expect(controller.getSnapshot()).toMatchObject({
    source: "live",
    state: "forward-veil-open",
    veilOpacity: 1,
    sourceCutCount: 1,
    presentationResourcesReleased: false
  });

  await controller.updateProgress(0.22, "forward");
  expect(controller.getSnapshot()).toMatchObject({
    source: "live",
    state: "live",
    veilOpacity: 0,
    presentationResourcesReleased: true
  });
  expect(provider.releaseCalls).toBe(1);
});

test("preloads the reverse target under the closing veil before showing the cloud layer", async () => {
  const provider = new FakeCloudProvider();
  const controller = new OpeningCloudController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  await controller.updateProgress(0.22, "forward");
  await controller.updateProgress(0.207, "reverse");
  expect(controller.getSnapshot()).toMatchObject({
    source: "live",
    state: "reverse-veil-close"
  });
  expect(provider.requestedFrames).toContain(42);

  await controller.updateProgress(0.195, "reverse");
  expect(controller.getSnapshot()).toMatchObject({
    source: "cloud",
    state: "reverse-veil-open",
    veilOpacity: 1,
    renderedFrame: 42,
    sourceCutCount: 2
  });

  await controller.updateProgress(0.18, "reverse");
  expect(controller.getSnapshot()).toMatchObject({
    source: "cloud",
    state: "cloud",
    veilOpacity: 0
  });
});

test("a reverse seek timeout reopens live instead of trapping an opaque veil", async () => {
  const provider = new FakeCloudProvider();
  const controller = new OpeningCloudController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  await controller.updateProgress(0.22, "forward");
  provider.requestResult = { state: "failed", reason: "timeout" };
  await controller.updateProgress(0.207, "reverse");

  expect(controller.getSnapshot()).toMatchObject({
    source: "live",
    state: "fallback-live",
    veilOpacity: 0,
    fallbackReason: "reverse-timeout",
    forwardCycleLockedToLive: true
  });
});

test("a cloud decode failure drops directly to the live Earth without a false cloud success", async () => {
  const provider = new FakeCloudProvider();
  const controller = new OpeningCloudController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  provider.requestResult = { state: "failed", reason: "decode" };
  await controller.updateProgress(0.12, "forward");

  expect(controller.getSnapshot()).toMatchObject({
    source: "live",
    state: "fallback-live",
    veilOpacity: 0,
    fallbackReason: "decode-error",
    presentationResourcesReleased: true
  });
  expect(provider.releaseCalls).toBe(1);
});

test("reverse hysteresis keeps live visible until the re-entry arm point", async () => {
  const provider = new FakeCloudProvider();
  const controller = new OpeningCloudController({ provider, tier: "desktop" });

  await controller.armForwardCycle();
  await controller.updateProgress(0.22, "forward");
  await controller.updateProgress(0.218, "reverse");
  expect(controller.getSnapshot()).toMatchObject({ source: "live", state: "live", veilOpacity: 0 });

  await controller.updateProgress(0.213, "reverse");
  expect(controller.getSnapshot()).toMatchObject({ source: "live", state: "reverse-veil-close" });
  expect(controller.getSnapshot().veilOpacity).toBeGreaterThan(0);
});
