import type { PublishedMiraLithChapter } from "../../content/miraLithChapters";

export type ChapterTransitionState =
  | "idle"
  | "covering"
  | "navigating"
  | "waiting-mount"
  | "resetting-entry"
  | "waiting-ready"
  | "revealing";

export type ChapterTransitionKind = "arrival-to-signal" | "signal-to-sutra" | "direct";
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
  sourceChapter: PublishedMiraLithChapter | null;
  targetChapter: PublishedMiraLithChapter | null;
  kind: ChapterTransitionKind | null;
  initiator: ChapterTransitionInitiator | null;
  destinationAttempt: number | null;
  inputEnabled: boolean;
  error: string | null;
}
