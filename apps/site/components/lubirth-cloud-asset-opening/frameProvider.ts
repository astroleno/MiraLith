import type { OpeningGlobeCloudVariant } from "../../content/lubirthOpeningGlobeCloudManifest";
import type {
  CloudFrameAvailability,
  CloudFrameProvider,
  CloudFrameProviderMetadata
} from "./types";

export function frameToMediaTime(frame: number, frameRate: number) {
  return frame / frameRate;
}

export function firstCloudFrameDeadlineMs(tier: "desktop" | "mobile") {
  return tier === "desktop" ? 1_200 : 1_800;
}

export class PackedCloudVideoFrameProvider implements CloudFrameProvider {
  readonly tier: "desktop" | "mobile";
  readonly frameRate: number;
  readonly frameCount: number;
  readonly metadata: CloudFrameProviderMetadata;
  readonly #video: HTMLVideoElement;
  #disposed = false;
  #requestToken = 0;
  #lastRenderedFrame: number | null = null;

  constructor({
    video,
    variant,
    manifestId
  }: {
    video: HTMLVideoElement;
    variant: OpeningGlobeCloudVariant;
    manifestId: string;
  }) {
    this.#video = video;
    this.tier = variant.tier;
    this.frameRate = variant.frameRate;
    this.frameCount = variant.frameCount;
    this.metadata = { manifestId, src: variant.src };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
  }

  async arm() {
    return this.requestFrame(0, firstCloudFrameDeadlineMs(this.tier));
  }

  async requestFrame(frame: number, deadlineMs: number): Promise<CloudFrameAvailability> {
    if (this.#disposed) return { state: "failed", reason: "disposed" };
    if (typeof this.#video.requestVideoFrameCallback !== "function") {
      return { state: "failed", reason: "unsupported" };
    }

    const boundedFrame = Math.min(this.frameCount - 1, Math.max(0, Math.round(frame)));
    const targetTime = frameToMediaTime(boundedFrame, this.frameRate);
    const token = ++this.#requestToken;
    if (this.#video.getAttribute("src") !== this.metadata.src) {
      this.#lastRenderedFrame = null;
      this.#video.src = this.metadata.src;
      this.#video.load();
    }

    if (
      this.#lastRenderedFrame === boundedFrame &&
      this.#video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return { state: "ready", renderedFrame: boundedFrame };
    }

    return new Promise<CloudFrameAvailability>((resolve) => {
      let settled = false;
      let callbackId: number | null = null;
      let metadataListenerAttached = false;
      const settle = (result: CloudFrameAvailability) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        this.#video.removeEventListener("error", onError);
        if (metadataListenerAttached) {
          this.#video.removeEventListener("loadedmetadata", seekTarget);
        }
        if (callbackId !== null && typeof this.#video.cancelVideoFrameCallback === "function") {
          this.#video.cancelVideoFrameCallback(callbackId);
        }
        resolve(result);
      };
      const onError = () => settle({ state: "failed", reason: "decode" });
      const seekTarget = () => {
        metadataListenerAttached = false;
        try {
          this.#video.currentTime = targetTime;
          callbackId = this.#video.requestVideoFrameCallback?.((_now, metadata) => {
            if (token !== this.#requestToken) {
              settle({ state: "pending", requestedFrame: boundedFrame });
              return;
            }
            const renderedFrame = Math.min(
              this.frameCount - 1,
              Math.max(0, Math.round(metadata.mediaTime * this.frameRate))
            );
            if (Math.abs(metadata.mediaTime - targetTime) > 1 / this.frameRate) {
              settle({ state: "pending", requestedFrame: boundedFrame });
              return;
            }
            this.#lastRenderedFrame = renderedFrame;
            settle({ state: "ready", renderedFrame });
          }) ?? null;
        } catch {
          settle({ state: "failed", reason: "decode" });
        }
      };
      const timeoutId = window.setTimeout(
        () => settle({ state: "failed", reason: "timeout" }),
        deadlineMs
      );
      this.#video.addEventListener("error", onError, { once: true });
      if (this.#video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        seekTarget();
      } else {
        metadataListenerAttached = true;
        this.#video.addEventListener("loadedmetadata", seekTarget, { once: true });
      }
    });
  }

  releasePresentationResources() {
    if (this.#disposed) return;
    this.#requestToken += 1;
    this.#lastRenderedFrame = null;
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
