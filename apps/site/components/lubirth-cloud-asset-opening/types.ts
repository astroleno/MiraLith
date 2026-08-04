export type OpeningCloudSource = "cloud" | "live";

export type OpeningCloudState =
  | "arming"
  | "cloud"
  | "forward-veil-close"
  | "forward-veil-open"
  | "live"
  | "reverse-veil-close"
  | "reverse-wait-frame"
  | "reverse-veil-open"
  | "fallback-live";

export type OpeningCloudDirection = "forward" | "reverse";

export type OpeningCloudFallbackReason =
  | "late-first-frame"
  | "reduced-motion"
  | "decode-error"
  | "unsupported"
  | "background-unverified"
  | "low-memory"
  | "rendering-fallback"
  | "reverse-timeout";

export type CloudFrameFailureReason =
  | "decode"
  | "timeout"
  | "unsupported"
  | "disposed";

export type CloudFrameAvailability =
  | { state: "ready"; renderedFrame: number }
  | { state: "pending"; requestedFrame: number }
  | { state: "failed"; reason: CloudFrameFailureReason };

export interface CloudFrameProviderMetadata {
  manifestId: string;
  src: string;
}

export interface CloudFrameProvider {
  readonly tier: "desktop" | "mobile";
  readonly frameRate: number;
  readonly frameCount: number;
  readonly metadata: CloudFrameProviderMetadata;
  arm(): Promise<CloudFrameAvailability>;
  requestFrame(frame: number, deadlineMs: number): Promise<CloudFrameAvailability>;
  releasePresentationResources(): void;
  dispose(): void;
}

export interface OpeningCloudSnapshot {
  source: OpeningCloudSource;
  state: OpeningCloudState;
  progress: number;
  veilOpacity: number;
  forwardCycleLockedToLive: boolean;
  requestedFrame: number | null;
  renderedFrame: number | null;
  fallbackReason: OpeningCloudFallbackReason | null;
  sourceCutCount: number;
  presentationResourcesReleased: boolean;
}

export type OpeningCloudMetricEvent =
  | { type: "cold-start-first-frame"; milliseconds: number }
  | { type: "target-frame"; milliseconds: number }
  | { type: "decode-error" };

export interface OpeningCloudRuntimeMetrics {
  coldStartFirstFrameMs: number | null;
  decodeErrorCount: number;
  droppedFrameCount: number;
  droppedFrameRate: number;
  rAFSampleCount: number;
  rAFP95Ms: number | null;
  targetFrameLatencyP95Ms: number | null;
  targetFrameLatencySampleCount: number;
}
