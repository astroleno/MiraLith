import type {
  CinematicPreludeVariant
} from "../../content/lubirthCinematicPreludeManifest";
import type {
  FrameAvailability,
  FrameProvider,
  FrameProviderMetadata
} from "./types";

export function frameToMediaTime(frame: number, frameRate: number) {
  return frame / frameRate;
}

export class HTMLVideoFrameProvider implements FrameProvider {
  readonly tier: "desktop" | "mobile";
  readonly frameRate: number;
  readonly frameCount: number;
  readonly metadata: FrameProviderMetadata;
  readonly #video: HTMLVideoElement;
  readonly #firstFrameDeadlineMs: number;
  #disposed = false;
  #requestToken = 0;

  constructor({
    video,
    variant,
    manifestId
  }: {
    video: HTMLVideoElement;
    variant: CinematicPreludeVariant;
    manifestId: string;
  }) {
    this.#video = video;
    this.tier = variant.tier;
    this.frameRate = variant.frameRate;
    this.frameCount = variant.frameCount;
    this.#firstFrameDeadlineMs = variant.firstFrameDeadlineMs;
    this.metadata = { manifestId, src: variant.src };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
  }

  async arm() {
    if (this.#disposed) return { state: "failed", reason: "disposed" } as const;
    if (typeof this.#video.requestVideoFrameCallback !== "function") {
      return { state: "failed", reason: "unsupported" } as const;
    }
    if (this.#video.currentSrc !== this.metadata.src && this.#video.src !== this.metadata.src) {
      this.#video.src = this.metadata.src;
      this.#video.load();
    }
    return this.requestFrame(0, this.#firstFrameDeadlineMs);
  }

  async requestFrame(frame: number, deadlineMs: number): Promise<FrameAvailability> {
    if (this.#disposed) return { state: "failed", reason: "disposed" };
    if (typeof this.#video.requestVideoFrameCallback !== "function") {
      return { state: "failed", reason: "unsupported" };
    }
    const boundedFrame = Math.min(this.frameCount - 1, Math.max(0, Math.round(frame)));
    const targetTime = frameToMediaTime(boundedFrame, this.frameRate);
    const token = ++this.#requestToken;

    return new Promise<FrameAvailability>((resolve) => {
      let settled = false;
      let callbackId: number | null = null;
      const settle = (result: FrameAvailability) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.#video.removeEventListener("error", onError);
        if (callbackId !== null && typeof this.#video.cancelVideoFrameCallback === "function") {
          this.#video.cancelVideoFrameCallback(callbackId);
        }
        resolve(result);
      };
      const onError = () => settle({ state: "failed", reason: "decode" });
      const timeoutId = window.setTimeout(
        () => settle({ state: "failed", reason: "timeout" }),
        deadlineMs
      );
      this.#video.addEventListener("error", onError, { once: true });
      callbackId = this.#video.requestVideoFrameCallback((_now, metadata) => {
        if (token !== this.#requestToken) {
          settle({ state: "pending", requestedFrame: boundedFrame });
          return;
        }
        const renderedFrame = Math.min(
          this.frameCount - 1,
          Math.max(0, Math.round(metadata.mediaTime * this.frameRate))
        );
        const withinOneFrame = Math.abs(metadata.mediaTime - targetTime) <= 1 / this.frameRate;
        settle(
          withinOneFrame
            ? { state: "ready", renderedFrame }
            : { state: "pending", requestedFrame: boundedFrame }
        );
      });
      try {
        this.#video.currentTime = targetTime;
      } catch {
        settle({ state: "failed", reason: "decode" });
      }
    });
  }

  releasePresentationResources() {
    if (this.#disposed) return;
    this.#requestToken += 1;
    this.#video.pause();
    this.#video.removeAttribute("src");
    this.#video.load();
  }

  dispose() {
    if (this.#disposed) return;
    this.releasePresentationResources();
    this.#disposed = true;
  }
}
