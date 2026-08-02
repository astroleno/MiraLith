import type { CinematicPreludeVariant } from "../../content/lubirthCinematicPreludeManifest";
import type { FrameAvailability, FrameProvider } from "./types";

export type CinematicPreludeTestMode =
  | "late-first-frame"
  | "reverse-pending"
  | "reverse-timeout"
  | "reverse-ready"
  | "decode-error"
  | "background-resume"
  | "low-memory"
  | "reduced-motion";

export function isCinematicPreludeTestMode(
  value: string | null
): value is CinematicPreludeTestMode {
  return value === "late-first-frame" ||
    value === "reverse-pending" ||
    value === "reverse-timeout" ||
    value === "reverse-ready" ||
    value === "decode-error" ||
    value === "background-resume" ||
    value === "low-memory" ||
    value === "reduced-motion";
}

export class DeterministicTestFrameProvider implements FrameProvider {
  readonly tier: "desktop" | "mobile";
  readonly frameRate: number;
  readonly frameCount: number;
  readonly metadata: { manifestId: string; src: string };
  readonly #mode: CinematicPreludeTestMode;
  #disposed = false;

  constructor({
    manifestId,
    mode,
    variant
  }: {
    manifestId: string;
    mode: CinematicPreludeTestMode;
    variant: CinematicPreludeVariant;
  }) {
    this.tier = variant.tier;
    this.frameRate = variant.frameRate;
    this.frameCount = variant.frameCount;
    this.metadata = { manifestId, src: variant.src };
    this.#mode = mode;
  }

  async arm(): Promise<FrameAvailability> {
    if (this.#disposed) return { state: "failed", reason: "disposed" };
    if (this.#mode === "late-first-frame") {
      return { state: "pending", requestedFrame: 0 };
    }
    if (this.#mode === "decode-error") {
      return { state: "failed", reason: "decode" };
    }
    return { state: "ready", renderedFrame: 0 };
  }

  async requestFrame(frame: number): Promise<FrameAvailability> {
    if (this.#disposed) return { state: "failed", reason: "disposed" };
    if (this.#mode === "reverse-pending") {
      return { state: "pending", requestedFrame: frame };
    }
    if (this.#mode === "reverse-timeout") {
      return { state: "failed", reason: "timeout" };
    }
    return { state: "ready", renderedFrame: frame };
  }

  releasePresentationResources() {}

  dispose() {
    this.#disposed = true;
  }
}
