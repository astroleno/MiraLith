import {
  mapOpeningGlobeCloudProgressToFrame,
  openingGlobeCloudManifest
} from "../../content/lubirthOpeningGlobeCloudManifest";
import type {
  CloudFrameAvailability,
  CloudFrameProvider,
  OpeningCloudDirection,
  OpeningCloudFallbackReason,
  OpeningCloudSnapshot
} from "./types";

export const OPENING_CLOUD_TIMING = {
  cloudStableEnd: openingGlobeCloudManifest.handoff.plateEndProgress,
  cutProgress: openingGlobeCloudManifest.handoff.cutProgress,
  liveStart: openingGlobeCloudManifest.handoff.liveProgress,
  reverseArmHysteresis: 0.006,
  forwardDesktopDeadlineMs: 250,
  forwardMobileDeadlineMs: 400,
  reverseDesktopDeadlineMs: 450,
  reverseMobileDeadlineMs: 700
} as const;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function failureReason(
  availability: Extract<CloudFrameAvailability, { state: "failed" }>
): OpeningCloudFallbackReason {
  if (availability.reason === "timeout") return "reverse-timeout";
  if (availability.reason === "unsupported" || availability.reason === "disposed") {
    return "unsupported";
  }
  return "decode-error";
}

function isUsableFrame(availability: CloudFrameAvailability): availability is Extract<CloudFrameAvailability, { state: "ready" }> {
  return availability.state === "ready";
}

export class OpeningCloudController {
  readonly provider: CloudFrameProvider;
  readonly tier: "desktop" | "mobile";
  #armed = false;
  #forwardCut = false;
  #released = false;
  #reversePreparedFrame: number | null = null;
  #operation = 0;
  #snapshot: OpeningCloudSnapshot = {
    source: "live",
    state: "arming",
    progress: 0,
    veilOpacity: 0,
    forwardCycleLockedToLive: false,
    requestedFrame: null,
    renderedFrame: null,
    fallbackReason: null,
    sourceCutCount: 0,
    presentationResourcesReleased: false
  };

  constructor({
    provider,
    tier
  }: {
    provider: CloudFrameProvider;
    tier: "desktop" | "mobile";
  }) {
    this.provider = provider;
    this.tier = tier;
  }

  getSnapshot() {
    return { ...this.#snapshot };
  }

  async armForwardCycle() {
    const operation = ++this.#operation;
    const result = await this.provider.arm();
    if (operation !== this.#operation) return this.getSnapshot();
    if (!isUsableFrame(result) || result.renderedFrame !== 0) {
      return this.#applyFallback(
        result.state === "failed" ? failureReason(result) : "late-first-frame"
      );
    }

    this.#armed = true;
    this.#forwardCut = false;
    this.#released = false;
    this.#reversePreparedFrame = 0;
    this.#snapshot = {
      ...this.#snapshot,
      source: "cloud",
      state: "cloud",
      progress: 0,
      veilOpacity: 0,
      forwardCycleLockedToLive: false,
      requestedFrame: null,
      renderedFrame: 0,
      fallbackReason: null,
      presentationResourcesReleased: false
    };
    return this.getSnapshot();
  }

  forceFallback(reason: OpeningCloudFallbackReason) {
    ++this.#operation;
    return this.#applyFallback(reason);
  }

  async updateProgress(progress: number, direction: OpeningCloudDirection) {
    const operation = ++this.#operation;
    const normalizedProgress = clamp01(progress);
    this.#snapshot = { ...this.#snapshot, progress: normalizedProgress };

    if (this.#snapshot.state === "fallback-live") return this.getSnapshot();
    if (!this.#armed) return this.#applyFallback("late-first-frame");
    return direction === "forward"
      ? this.#updateForward(normalizedProgress, operation)
      : this.#updateReverse(normalizedProgress, operation);
  }

  #deadline(direction: OpeningCloudDirection) {
    if (direction === "forward") {
      return this.tier === "desktop"
        ? OPENING_CLOUD_TIMING.forwardDesktopDeadlineMs
        : OPENING_CLOUD_TIMING.forwardMobileDeadlineMs;
    }
    return this.tier === "desktop"
      ? OPENING_CLOUD_TIMING.reverseDesktopDeadlineMs
      : OPENING_CLOUD_TIMING.reverseMobileDeadlineMs;
  }

  #releaseOnce() {
    if (this.#released) return;
    this.provider.releasePresentationResources();
    this.#released = true;
  }

  #applyFallback(reason: OpeningCloudFallbackReason) {
    this.#releaseOnce();
    this.#armed = false;
    this.#forwardCut = true;
    this.#reversePreparedFrame = null;
    this.#snapshot = {
      ...this.#snapshot,
      source: "live",
      state: "fallback-live",
      veilOpacity: 0,
      forwardCycleLockedToLive: true,
      requestedFrame: null,
      fallbackReason: reason,
      presentationResourcesReleased: true
    };
    return this.getSnapshot();
  }

  async #requestFrame(
    frame: number,
    direction: OpeningCloudDirection,
    operation: number
  ) {
    this.#released = false;
    this.#snapshot = { ...this.#snapshot, requestedFrame: frame, presentationResourcesReleased: false };
    const result = await this.provider.requestFrame(frame, this.#deadline(direction));
    return operation === this.#operation ? result : null;
  }

  async #updateForward(progress: number, operation: number) {
    if (progress >= OPENING_CLOUD_TIMING.liveStart) {
      if (!this.#forwardCut) {
        this.#forwardCut = true;
        this.#snapshot.sourceCutCount += 1;
      }
      this.#releaseOnce();
      this.#snapshot = {
        ...this.#snapshot,
        source: "live",
        state: "live",
        veilOpacity: 0,
        requestedFrame: null,
        fallbackReason: null,
        presentationResourcesReleased: true
      };
      return this.getSnapshot();
    }

    if (progress >= OPENING_CLOUD_TIMING.cutProgress) {
      if (!this.#forwardCut) {
        this.#forwardCut = true;
        this.#snapshot.sourceCutCount += 1;
      }
      const reveal = clamp01(
        (progress - OPENING_CLOUD_TIMING.cutProgress) /
          (OPENING_CLOUD_TIMING.liveStart - OPENING_CLOUD_TIMING.cutProgress)
      );
      this.#snapshot = {
        ...this.#snapshot,
        source: "live",
        state: "forward-veil-open",
        veilOpacity: 1 - reveal,
        requestedFrame: null,
        fallbackReason: null
      };
      return this.getSnapshot();
    }

    const requestedFrame = mapOpeningGlobeCloudProgressToFrame(openingGlobeCloudManifest, progress);
    if (requestedFrame !== this.#snapshot.renderedFrame) {
      const result = await this.#requestFrame(requestedFrame, "forward", operation);
      if (result === null) return this.getSnapshot();
      if (result.state === "failed" && result.reason !== "timeout") {
        return this.#applyFallback(failureReason(result));
      }
      if (isUsableFrame(result)) {
        this.#snapshot.renderedFrame = result.renderedFrame;
        this.#reversePreparedFrame = result.renderedFrame;
      }
    }

    if (progress >= OPENING_CLOUD_TIMING.cloudStableEnd) {
      const close = clamp01(
        (progress - OPENING_CLOUD_TIMING.cloudStableEnd) /
          (OPENING_CLOUD_TIMING.cutProgress - OPENING_CLOUD_TIMING.cloudStableEnd)
      );
      this.#snapshot = {
        ...this.#snapshot,
        source: "cloud",
        state: "forward-veil-close",
        veilOpacity: close,
        requestedFrame,
        fallbackReason: null
      };
      return this.getSnapshot();
    }

    this.#snapshot = {
      ...this.#snapshot,
      source: "cloud",
      state: "cloud",
      veilOpacity: 0,
      requestedFrame,
      fallbackReason: null
    };
    return this.getSnapshot();
  }

  async #updateReverseCloud(progress: number, operation: number) {
    const requestedFrame = mapOpeningGlobeCloudProgressToFrame(openingGlobeCloudManifest, progress);
    if (requestedFrame !== this.#snapshot.renderedFrame) {
      const result = await this.#requestFrame(requestedFrame, "reverse", operation);
      if (result === null) return this.getSnapshot();
      if (result.state === "failed" && result.reason !== "timeout") {
        return this.#applyFallback(failureReason(result));
      }
      if (isUsableFrame(result)) {
        this.#snapshot.renderedFrame = result.renderedFrame;
        this.#reversePreparedFrame = result.renderedFrame;
      }
    }
    const opening = clamp01(
      (progress - OPENING_CLOUD_TIMING.cloudStableEnd) /
        (OPENING_CLOUD_TIMING.cutProgress - OPENING_CLOUD_TIMING.cloudStableEnd)
    );
    this.#snapshot = {
      ...this.#snapshot,
      source: "cloud",
      state: progress > OPENING_CLOUD_TIMING.cloudStableEnd ? "reverse-veil-open" : "cloud",
      veilOpacity: opening,
      requestedFrame,
      fallbackReason: null,
      presentationResourcesReleased: false
    };
    return this.getSnapshot();
  }

  async #updateReverse(progress: number, operation: number) {
    if (!this.#forwardCut) {
      return this.#updateReverseCloud(progress, operation);
    }

    const reverseArmStart = OPENING_CLOUD_TIMING.liveStart - OPENING_CLOUD_TIMING.reverseArmHysteresis;
    if (progress > reverseArmStart) {
      this.#snapshot = {
        ...this.#snapshot,
        source: "live",
        state: "live",
        veilOpacity: 0,
        requestedFrame: null,
        fallbackReason: null
      };
      return this.getSnapshot();
    }

    const targetFrame = progress >= OPENING_CLOUD_TIMING.cutProgress
      ? openingGlobeCloudManifest.handoff.cutFrame
      : mapOpeningGlobeCloudProgressToFrame(openingGlobeCloudManifest, progress);
    if (this.#reversePreparedFrame !== targetFrame) {
      const result = await this.#requestFrame(targetFrame, "reverse", operation);
      if (result === null) return this.getSnapshot();
      if (result.state === "failed") return this.#applyFallback(failureReason(result));
      if (isUsableFrame(result)) {
        this.#reversePreparedFrame = result.renderedFrame;
        this.#snapshot.renderedFrame = result.renderedFrame;
      }
    }

    if (progress > OPENING_CLOUD_TIMING.cutProgress) {
      const close = clamp01(
        (OPENING_CLOUD_TIMING.liveStart - progress) /
          (OPENING_CLOUD_TIMING.liveStart - OPENING_CLOUD_TIMING.cutProgress)
      );
      this.#snapshot = {
        ...this.#snapshot,
        source: "live",
        state: "reverse-veil-close",
        veilOpacity: close,
        requestedFrame: targetFrame,
        fallbackReason: null,
        presentationResourcesReleased: false
      };
      return this.getSnapshot();
    }

    if (this.#reversePreparedFrame !== targetFrame) {
      this.#snapshot = {
        ...this.#snapshot,
        source: "live",
        state: "reverse-wait-frame",
        veilOpacity: 1,
        requestedFrame: targetFrame,
        fallbackReason: null,
        presentationResourcesReleased: false
      };
      return this.getSnapshot();
    }

    this.#forwardCut = false;
    const opening = clamp01(
      (progress - OPENING_CLOUD_TIMING.cloudStableEnd) /
        (OPENING_CLOUD_TIMING.cutProgress - OPENING_CLOUD_TIMING.cloudStableEnd)
    );
    this.#snapshot = {
      ...this.#snapshot,
      source: "cloud",
      state: progress > OPENING_CLOUD_TIMING.cloudStableEnd ? "reverse-veil-open" : "cloud",
      veilOpacity: opening,
      requestedFrame: targetFrame,
      renderedFrame: this.#reversePreparedFrame,
      fallbackReason: null,
      sourceCutCount: this.#snapshot.sourceCutCount + 1,
      presentationResourcesReleased: false
    };
    return this.getSnapshot();
  }
}
