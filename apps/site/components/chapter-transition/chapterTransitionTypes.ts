import type { MiraLithKnownChapter } from "../../content/miraLithChapters";

export interface ResolvedChapterTransitionEndpoint {
  chapter: MiraLithKnownChapter;
  level: "published" | "preview";
}

export const CHAPTER_VISUAL_HANDOFF_VERSION = "chapter-visual-handoff-v1" as const;

export interface NormalizedChapterPoint {
  x: number;
  y: number;
}

interface CoScrollRingHandoffBase {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "coscroll-ring";
  sourceHref: "/coscroll";
  targetHref: "/artbreeze";
  center: NormalizedChapterPoint;
  diameter: number;
  lineWidth: number;
  exitProgress: number;
  direction: "clockwise";
}

export interface CoScrollRingLiveHandoff extends CoScrollRingHandoffBase {
  signalSource: "live";
  angleRadians: number;
  angularVelocityRadiansPerSecond: number;
}

export interface CoScrollRingFallbackHandoff extends CoScrollRingHandoffBase {
  signalSource: "fallback";
  gapPhaseRadians: number;
}

export type CoScrollRingHandoff = CoScrollRingLiveHandoff | CoScrollRingFallbackHandoff;

export interface FocuenceStarsHandoff {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "focuence-stars";
  sourceHref: "/artbreeze";
  targetHref: "/constellation";
  collapseOrigin: NormalizedChapterPoint;
  seed: number;
  collapsePhase: number;
}

export interface CosmicWaterHandoff {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "cosmic-water";
  sourceHref: "/constellation";
  targetHref: "/client-works";
  highlightOrigin: NormalizedChapterPoint;
  radius: number;
  ripplePhase: number;
}

export type ChapterVisualHandoff =
  | CoScrollRingHandoff
  | FocuenceStarsHandoff
  | CosmicWaterHandoff;

export type ChapterTransitionState =
  | "idle"
  | "covering"
  | "navigating"
  | "waiting-mount"
  | "resetting-entry"
  | "waiting-ready"
  | "revealing";

export type ChapterTransitionKind =
  | "arrival-to-signal"
  | "signal-to-sutra"
  | "direct"
  | ChapterVisualHandoff["kind"];
export type ChapterTransitionInitiator = "link" | "scroll" | "history";
export type ChapterDestinationSignalPhase = "mount" | "visual-pending" | "visual-ready" | "fallback-ready";

export interface ChapterReturnSnapshot {
  pathname: string;
  scrollY: number;
  routeProgress: number | null;
  terminalState: boolean;
  timestamp: number;
}

export interface ChapterDestinationResetContext {
  transitionId: string;
  pathname: string;
  initiator: ChapterTransitionInitiator;
  handoff: ChapterVisualHandoff | null;
  returnSnapshot: ChapterReturnSnapshot | null;
  destinationAttempt: number;
  signal: AbortSignal;
}

export interface ChapterDestinationFallbackContext {
  transitionId: string;
  pathname: string;
  destinationAttempt: number;
}

export interface ChapterDestinationControls {
  resetEntry: (context: ChapterDestinationResetContext) => void | Promise<void>;
  forceFallback: (context: ChapterDestinationFallbackContext) => void | Promise<void>;
}

export interface ChapterDestinationSignal {
  transitionId: string;
  pathname: string;
  destinationAttempt: number;
  phase: ChapterDestinationSignalPhase;
}

export interface ChapterTransitionSnapshot {
  id: string | null;
  state: ChapterTransitionState;
  sourceHref: string | null;
  targetHref: string | null;
  sourceEndpoint: ResolvedChapterTransitionEndpoint | null;
  targetEndpoint: ResolvedChapterTransitionEndpoint | null;
  kind: ChapterTransitionKind | null;
  handoff: ChapterVisualHandoff | null;
  initiator: ChapterTransitionInitiator | null;
  destinationAttempt: number | null;
  inputEnabled: boolean;
  error: string | null;
}
