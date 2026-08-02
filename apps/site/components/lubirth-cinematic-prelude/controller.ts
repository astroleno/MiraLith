import type {
  FrameAvailability,
  FrameProvider,
  PreludeDirection,
  PreludeFallbackReason,
  PreludeSnapshot
} from "./types";

export const PRELUDE_TIMING = {
  plateEnd: 0.18,
  veilPeak: 0.195,
  liveStart: 0.22,
  reverseDesktopDeadlineMs: 450,
  reverseMobileDeadlineMs: 700
} as const;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function frameForProgress(progress: number, frameCount: number) {
  const clamped = Math.min(PRELUDE_TIMING.liveStart, Math.max(0, progress));
  return Math.min(
    frameCount - 1,
    Math.floor((clamped / PRELUDE_TIMING.liveStart) * frameCount)
  );
}

function failureReason(availability: Extract<FrameAvailability, { state: "failed" }>) {
  if (availability.reason === "timeout") return "reverse-timeout" as const;
  if (availability.reason === "unsupported" || availability.reason === "disposed") {
    return "unsupported" as const;
  }
  return "decode-error" as const;
}

export class CinematicPreludeController {
  readonly provider: FrameProvider;
  readonly tier: "desktop" | "mobile";
  #armed = false;
  #forwardCut = false;
  #released = false;
  #snapshot: PreludeSnapshot = {
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

  constructor({ provider, tier }: { provider: FrameProvider; tier: "desktop" | "mobile" }) {
    this.provider = provider;
    this.tier = tier;
  }

  getSnapshot() {
    return { ...this.#snapshot };
  }

  async armForwardCycle() {
    const result = await this.provider.arm();
    if (result.state !== "ready" || result.renderedFrame !== 0) {
      return this.forceFallback(
        result.state === "failed" ? failureReason(result) : "late-first-frame"
      );
    }
    this.#armed = true;
    this.#released = false;
    this.#forwardCut = false;
    this.#snapshot = {
      ...this.#snapshot,
      source: "plate",
      state: "plate",
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

  forceFallback(reason: PreludeFallbackReason) {
    if (!this.#released) {
      this.provider.releasePresentationResources();
      this.#released = true;
    }
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

  async updateProgress(progress: number, direction: PreludeDirection) {
    const normalizedProgress = Math.max(0, progress);
    this.#snapshot.progress = normalizedProgress;
    if (this.#snapshot.state === "fallback-live") return this.getSnapshot();
    if (!this.#armed) return this.forceFallback("late-first-frame");
    return direction === "forward"
      ? this.#updateForward(normalizedProgress)
      : this.#updateReverse(normalizedProgress);
  }

  #releaseOnce() {
    if (this.#released) return;
    this.provider.releasePresentationResources();
    this.#released = true;
  }

  #updateForward(progress: number) {
    if (progress >= PRELUDE_TIMING.liveStart) {
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
        forwardCycleLockedToLive: false,
        requestedFrame: null,
        fallbackReason: null,
        presentationResourcesReleased: true
      };
      return this.getSnapshot();
    }

    if (this.#forwardCut || progress >= PRELUDE_TIMING.veilPeak) {
      if (!this.#forwardCut) {
        this.#forwardCut = true;
        this.#snapshot.sourceCutCount += 1;
      }
      const reveal = clamp01(
        (progress - PRELUDE_TIMING.veilPeak) /
          (PRELUDE_TIMING.liveStart - PRELUDE_TIMING.veilPeak)
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

    if (progress >= PRELUDE_TIMING.plateEnd) {
      const close = clamp01(
        (progress - PRELUDE_TIMING.plateEnd) /
          (PRELUDE_TIMING.veilPeak - PRELUDE_TIMING.plateEnd)
      );
      this.#snapshot = {
        ...this.#snapshot,
        source: "plate",
        state: "forward-veil-close",
        veilOpacity: close,
        requestedFrame: null,
        fallbackReason: null
      };
      return this.getSnapshot();
    }

    this.#snapshot = {
      ...this.#snapshot,
      source: "plate",
      state: "plate",
      veilOpacity: 0,
      requestedFrame: null,
      fallbackReason: null
    };
    return this.getSnapshot();
  }

  async #updateReverse(progress: number) {
    if (!this.#forwardCut && this.#snapshot.source === "plate") {
      this.#snapshot = {
        ...this.#snapshot,
        state: "plate",
        veilOpacity: 0,
        requestedFrame: null
      };
      return this.getSnapshot();
    }

    if (progress > PRELUDE_TIMING.veilPeak) {
      const close = clamp01(
        (PRELUDE_TIMING.liveStart - progress) /
          (PRELUDE_TIMING.liveStart - PRELUDE_TIMING.veilPeak)
      );
      this.#snapshot = {
        ...this.#snapshot,
        source: "live",
        state: "reverse-veil-close",
        veilOpacity: close,
        requestedFrame: null,
        fallbackReason: null
      };
      return this.getSnapshot();
    }

    const requestedFrame = frameForProgress(progress, this.provider.frameCount);
    const deadlineMs =
      this.tier === "desktop"
        ? PRELUDE_TIMING.reverseDesktopDeadlineMs
        : PRELUDE_TIMING.reverseMobileDeadlineMs;
    this.#snapshot = {
      ...this.#snapshot,
      source: "live",
      state: "reverse-wait-frame",
      veilOpacity: 1,
      requestedFrame,
      fallbackReason: null
    };
    const result = await this.provider.requestFrame(requestedFrame, deadlineMs);
    if (result.state === "failed") return this.forceFallback(failureReason(result));
    if (result.state === "pending") return this.getSnapshot();

    this.#forwardCut = false;
    this.#released = false;
    const open = clamp01(
      (progress - PRELUDE_TIMING.plateEnd) /
        (PRELUDE_TIMING.veilPeak - PRELUDE_TIMING.plateEnd)
    );
    this.#snapshot = {
      ...this.#snapshot,
      source: "plate",
      state: "plate",
      veilOpacity: open,
      forwardCycleLockedToLive: false,
      requestedFrame,
      renderedFrame: result.renderedFrame,
      fallbackReason: null,
      sourceCutCount: this.#snapshot.sourceCutCount + 1,
      presentationResourcesReleased: false
    };
    return this.getSnapshot();
  }
}
