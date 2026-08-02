export type PreludeSource = "plate" | "live";

export type PreludeState =
  | "arming"
  | "plate"
  | "forward-veil-close"
  | "forward-veil-open"
  | "live"
  | "reverse-veil-close"
  | "reverse-wait-frame"
  | "fallback-live";

export type PreludeDirection = "forward" | "reverse";

export type PreludeFallbackReason =
  | "late-first-frame"
  | "reduced-motion"
  | "decode-error"
  | "unsupported"
  | "background-unverified"
  | "low-memory"
  | "rendering-fallback"
  | "reverse-timeout";

export type FrameFailureReason =
  | "decode"
  | "timeout"
  | "unsupported"
  | "disposed";

export type FrameAvailability =
  | { state: "ready"; renderedFrame: number }
  | { state: "pending"; requestedFrame: number }
  | { state: "failed"; reason: FrameFailureReason };

export interface FrameProviderMetadata {
  manifestId: string;
  src: string;
}

export interface FrameProvider {
  readonly tier: "desktop" | "mobile";
  readonly frameRate: number;
  readonly frameCount: number;
  readonly metadata: FrameProviderMetadata;
  arm(): Promise<FrameAvailability>;
  requestFrame(frame: number, deadlineMs: number): Promise<FrameAvailability>;
  releasePresentationResources(): void;
  dispose(): void;
}

export interface PreludeSnapshot {
  source: PreludeSource;
  state: PreludeState;
  progress: number;
  veilOpacity: number;
  forwardCycleLockedToLive: boolean;
  requestedFrame: number | null;
  renderedFrame: number | null;
  fallbackReason: PreludeFallbackReason | null;
  sourceCutCount: number;
  presentationResourcesReleased: boolean;
}

export interface PreludeProviderMetrics {
  armEndedAtMs?: number;
  armStartedAtMs?: number;
  firstFrameMs?: number;
  lastTargetFrameLatencyMs?: number;
}
