export const CHAPTER_RETURN_SNAPSHOT_VERSION = "chapter-return-v2" as const;
export const MAX_CHAPTER_RETURN_REVISION = 1_000_000_000 as const;

export type ChapterPlaybackState = "ready" | "playing" | "paused-ready";

export interface ChapterActiveMediaState {
  id: string;
  playbackState: ChapterPlaybackState;
  timeSeconds: number;
}

export interface ChapterSemanticRouteState {
  kind: "semantic";
  semanticStop: string;
  segmentId: string;
  segmentProgress: number;
  narrativeProgress: number;
  completedMediaIds: readonly string[];
  skippedMediaIds: readonly string[];
  activeMedia: ChapterActiveMediaState | null;
  gateReleased: boolean;
  mutePreference: boolean;
  routeState: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ChapterLegacyRouteState {
  kind: "legacy-progress";
  routeProgress: number | null;
  terminalState: boolean;
}

export interface ChapterReturnSnapshot {
  schema: typeof CHAPTER_RETURN_SNAPSHOT_VERSION;
  buildScope: string;
  pathname: string;
  revision: number;
  scrollY: number;
  routeProgress: number | null;
  terminalState: boolean;
  semantic: ChapterSemanticRouteState | ChapterLegacyRouteState;
  timestamp: number;
}

export interface ChapterRouteStateManifest {
  pathname: string;
  stopIds: readonly string[];
  segmentIds: readonly string[];
  mediaIds: readonly string[];
  routeState: Readonly<Record<string,
    | { kind: "boolean" }
    | { kind: "number"; min: number; max: number }
    | { kind: "enum"; values: readonly string[] }
  >>;
  mediaTailSeconds?: Readonly<Record<string, number>>;
}

export interface ChapterRouteStateAdapter {
  manifest: ChapterRouteStateManifest;
  capture: () => ChapterSemanticRouteState;
}

export type ChapterRouteStateCaptureReason =
  | "semantic"
  | "media-time"
  | "pagehide"
  | "transition";

export interface ChapterReturnRevisionPlan {
  revision: number;
  resetStorage: boolean;
}
