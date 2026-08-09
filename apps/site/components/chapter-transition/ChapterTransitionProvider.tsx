"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  getNextAccessibleMiraLithChapter,
  normalizeMiraLithChapterHref,
  resolveMiraLithChapterAccess,
  type MiraLithAccessResolution,
  type MiraLithKnownChapter
} from "../../content/miraLithChapters";
import { ChapterTransitionLayer } from "./ChapterTransitionLayer";
import {
  bootstrapChapterPreviewSession,
  markChapterPreviewHistoryEntry,
  revalidateChapterPreviewSession,
  type ChapterPreviewSessionState
} from "./chapterPreviewSession";
import { resolveChapterTransitionHandoff } from "./chapterVisualHandoff";
import type {
  ChapterDestinationControls,
  ChapterDestinationSignal,
  ChapterReturnSnapshot,
  ChapterTransitionInitiator,
  ChapterTransitionKind,
  ChapterTransitionSnapshot,
  ChapterTransitionState,
  ChapterVisualHandoff,
  ResolvedChapterTransitionEndpoint
} from "./chapterTransitionTypes";

const RETURN_SNAPSHOT_PREFIX = "miralith:chapter-return:";
const DESTINATION_FALLBACK_REQUEST_MS = 2_600;
const DESTINATION_HARD_DEADLINE_MS = 3_000;
const DESTINATION_FALLBACK_COMMIT_DEADLINE_MS = 1_000;
const INPUT_INERTIA_SETTLE_MS = 160;

const idleSnapshot: ChapterTransitionSnapshot = {
  id: null,
  state: "idle",
  sourceHref: null,
  targetHref: null,
  sourceEndpoint: null,
  targetEndpoint: null,
  kind: null,
  handoff: null,
  initiator: null,
  destinationAttempt: null,
  inputEnabled: true,
  error: null
};

declare const historyTraversalDeltaBrand: unique symbol;

/**
 * The exact non-zero distance between two Navigation API entries.
 *
 * This must not be reduced to a direction: a history-menu selection or
 * `history.go(±N)` can traverse more than one entry at once, and recovery
 * needs to return across that same number of entries.
 */
type HistoryTraversalDelta = number & {
  readonly [historyTraversalDeltaBrand]: true;
};

interface HistoryTraversalRecord {
  navigationDelta: HistoryTraversalDelta | null;
  sourceEntryKey: string | null;
  targetEntryKey: string | null;
}

interface StartRuntimeOptions {
  handoff?: unknown;
  historyTraversalDelta?: HistoryTraversalDelta | null;
  sourceEntryKey?: string | null;
  allowSamePathHistoryTraversal?: boolean;
  skipSourceSnapshot?: boolean;
}

interface ActiveChapterTransition {
  id: string;
  state: ChapterTransitionState;
  sourceHref: string;
  targetHref: string;
  sourceEndpoint: ResolvedChapterTransitionEndpoint;
  targetEndpoint: ResolvedChapterTransitionEndpoint;
  kind: ChapterTransitionKind;
  handoff: ChapterVisualHandoff | null;
  initiator: ChapterTransitionInitiator;
  destinationAttempt: number;
  destinationController: AbortController | null;
  historyTraversalDelta: HistoryTraversalDelta | null;
  sourceEntryKey: string | null;
  navigationCommitted: boolean;
  recoveryHistoryDelta: HistoryTraversalDelta | null;
  recoveryExpectedEntryKey: string | null;
  recoveryPushPending: boolean;
  coverComplete: boolean;
  mounted: boolean;
  resetStarted: boolean;
  resetComplete: boolean;
  visualReady: boolean;
  fallbackReady: boolean;
  fallbackRequested: boolean;
  recovering: boolean;
  error: string | null;
  deadlineTimer: number | null;
  fallbackTimer: number | null;
  finishTimer: number | null;
}

interface ChapterTransitionContextValue {
  snapshot: ChapterTransitionSnapshot;
  previewActive: boolean;
  scope: string | null;
  resolveChapterAccess: (href: string) => MiraLithAccessResolution;
  getNextAccessibleChapter: (href: string) => MiraLithKnownChapter | undefined;
  beginTransition: (
    targetHref: string,
    initiator: Exclude<ChapterTransitionInitiator, "history">,
    handoff?: ChapterVisualHandoff | null
  ) => string | null;
  registerDestination: (pathname: string, controls: ChapterDestinationControls) => () => void;
  reportDestination: (signal: ChapterDestinationSignal) => void;
}

const ChapterTransitionContext = createContext<ChapterTransitionContextValue | null>(null);

function transitionKindForPair(sourceHref: string, targetHref: string): ChapterTransitionKind {
  if (sourceHref === "/" && targetHref === "/radio-gaga") {
    return "arrival-to-signal";
  }
  if (sourceHref === "/radio-gaga" && targetHref === "/coscroll") {
    return "signal-to-sutra";
  }
  return "direct";
}

function endpointFromAccess(access: MiraLithAccessResolution): ResolvedChapterTransitionEndpoint | null {
  if (
    !access.chapter ||
    !access.coordinatorAllowed ||
    (access.level !== "published" && access.level !== "preview")
  ) {
    return null;
  }
  return {
    chapter: access.chapter,
    level: access.level
  };
}

function runtimeCanReveal(runtime: ActiveChapterTransition) {
  return (
    runtime.coverComplete &&
    runtime.mounted &&
    runtime.resetComplete &&
    (runtime.fallbackRequested
      ? runtime.fallbackReady
      : runtime.visualReady || runtime.fallbackReady)
  );
}

function transitionSnapshot(runtime: ActiveChapterTransition): ChapterTransitionSnapshot {
  return {
    id: runtime.id,
    state: runtime.state,
    sourceHref: runtime.sourceHref,
    targetHref: runtime.targetHref,
    sourceEndpoint: runtime.sourceEndpoint,
    targetEndpoint: runtime.targetEndpoint,
    kind: runtime.kind,
    handoff: runtime.handoff,
    initiator: runtime.initiator,
    destinationAttempt: runtime.destinationAttempt,
    inputEnabled: false,
    error: runtime.error
  };
}

function cancelDestinationAttempt(runtime: ActiveChapterTransition) {
  runtime.destinationController?.abort();
  runtime.destinationController = null;
}

function readNavigationEntryIndex() {
  const navigation = (window as typeof window & {
    navigation?: { currentEntry?: { index?: number } };
  }).navigation;
  const index = navigation?.currentEntry?.index;
  // NavigationHistoryEntry uses -1 as its unavailable-entry sentinel, not as
  // a position in the session history list. Treat it like a missing index so
  // recovery falls back to the ledger or safe push path.
  return typeof index === "number" && Number.isSafeInteger(index) && index >= 0 ? index : null;
}

function readNavigationEntryKey() {
  const navigation = (window as typeof window & {
    navigation?: { currentEntry?: { key?: string } };
  }).navigation;
  const key = navigation?.currentEntry?.key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

function toHistoryTraversalDelta(value: number): HistoryTraversalDelta | null {
  if (!Number.isSafeInteger(value) || value === 0) {
    return null;
  }
  return value as HistoryTraversalDelta;
}

function reverseHistoryTraversalDelta(delta: HistoryTraversalDelta): HistoryTraversalDelta {
  return (-delta) as HistoryTraversalDelta;
}

function performanceMark(runtime: ActiveChapterTransition, phase: string) {
  if (typeof performance !== "undefined") {
    performance.mark(`miralith:chapter-transition:${runtime.id}:${phase}`);
  }
}

function readRouteProgress(pathname: string) {
  if (pathname === "/") {
    return typeof window.__MiraLithOpeningProgress === "number" ? window.__MiraLithOpeningProgress : null;
  }
  if (pathname === "/radio-gaga") {
    const value = document.querySelector<HTMLElement>(".radio-gaga-route")?.dataset.radioGagaProgress;
    const parsed = value === undefined ? Number.NaN : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (pathname === "/coscroll") {
    const value = document.querySelector<HTMLElement>("[data-coscroll-progress]")?.dataset.coscrollProgress;
    const parsed = value === undefined ? Number.NaN : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function writeReturnSnapshot(pathname: string) {
  try {
    const terminalElement = document.querySelector<HTMLElement>("[data-chapter-terminal]");
    const snapshot: ChapterReturnSnapshot = {
      pathname,
      scrollY: window.scrollY,
      routeProgress: readRouteProgress(pathname),
      terminalState: terminalElement?.dataset.chapterTerminal === "armed",
      timestamp: Date.now()
    };
    window.sessionStorage.setItem(`${RETURN_SNAPSHOT_PREFIX}${pathname}`, JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable in hardened browsing modes. The route reset still has a deterministic default.
  }
}

function readReturnSnapshot(pathname: string): ChapterReturnSnapshot | null {
  try {
    const value = window.sessionStorage.getItem(`${RETURN_SNAPSHOT_PREFIX}${pathname}`);
    if (!value) {
      return null;
    }
    const snapshot = JSON.parse(value) as Partial<ChapterReturnSnapshot>;
    if (snapshot.pathname !== pathname || typeof snapshot.timestamp !== "number") {
      return null;
    }
    return {
      pathname,
      scrollY: typeof snapshot.scrollY === "number" ? snapshot.scrollY : 0,
      routeProgress: typeof snapshot.routeProgress === "number" ? snapshot.routeProgress : null,
      terminalState: snapshot.terminalState === true,
      timestamp: snapshot.timestamp
    };
  } catch {
    return null;
  }
}

function clearRuntimeTimers(runtime: ActiveChapterTransition) {
  [runtime.deadlineTimer, runtime.fallbackTimer, runtime.finishTimer].forEach((timer) => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  });
  runtime.deadlineTimer = null;
  runtime.fallbackTimer = null;
  runtime.finishTimer = null;
}

export function ChapterTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = normalizeMiraLithChapterHref(usePathname() || "/");
  const [snapshot, setSnapshot] = useState<ChapterTransitionSnapshot>(idleSnapshot);
  const [announcement, setAnnouncement] = useState("");
  const [previewSession, setPreviewSession] = useState<ChapterPreviewSessionState>({
    previewActive: false,
    scope: null
  });
  const activeRef = useRef<ActiveChapterTransition | null>(null);
  const previewSessionRef = useRef<ChapterPreviewSessionState>(previewSession);
  const pendingPreviewMarkerRef = useRef<{
    transitionId: string;
    targetHref: string;
    scope: string;
  } | null>(null);
  const currentPathRef = useRef(pathname);
  const destinationControlsRef = useRef(new Map<string, ChapterDestinationControls>());
  const transitionSequenceRef = useRef(0);
  const originalScrollRestorationRef = useRef<History["scrollRestoration"] | null>(null);
  const navigationEntryIndexRef = useRef<number | null>(null);
  const navigationEntryKeyRef = useRef<string | null>(null);
  const historyLedgerRef = useRef<string[]>([pathname]);
  const historyCursorRef = useRef(0);
  const processDestinationRef = useRef<(runtime: ActiveChapterTransition) => void>(() => undefined);
  const tryAdvanceRef = useRef<(runtime: ActiveChapterTransition) => void>(() => undefined);
  const requestFallbackRef = useRef<(runtime: ActiveChapterTransition, reason: string) => void>(() => undefined);
  const recoverSourceRef = useRef<(runtime: ActiveChapterTransition, reason: string) => void>(() => undefined);

  const updatePreviewSession = useCallback((nextSession: ChapterPreviewSessionState) => {
    previewSessionRef.current = nextSession;
    setPreviewSession(nextSession);
  }, []);

  const resolveChapterAccess = useCallback((href: string) =>
    resolveMiraLithChapterAccess(href, { previewActive: previewSession.previewActive }), [previewSession.previewActive]);
  const getNextAccessibleChapter = useCallback((href: string) =>
    getNextAccessibleMiraLithChapter(href, { previewActive: previewSession.previewActive }), [previewSession.previewActive]);
  // A history event can invalidate preview storage before React has committed the
  // corresponding state update. Coordinator decisions must therefore use the
  // synchronous session ref, while the public resolver remains state-derived so
  // navigation consumers rerender when preview access changes.
  const resolveRuntimeChapterAccess = useCallback((href: string) =>
    resolveMiraLithChapterAccess(href, { previewActive: previewSessionRef.current.previewActive }), []);

  const publish = useCallback((runtime: ActiveChapterTransition, state: ChapterTransitionState, error?: string) => {
    runtime.state = state;
    if (error !== undefined) {
      runtime.error = error;
    }
    setSnapshot(transitionSnapshot(runtime));
    performanceMark(runtime, state);
  }, []);

  const restoreScrollRestoration = useCallback(() => {
    if (originalScrollRestorationRef.current !== null) {
      window.history.scrollRestoration = originalScrollRestorationRef.current;
      originalScrollRestorationRef.current = null;
    }
  }, []);

  const recordCommittedPush = useCallback((nextPathname: string) => {
    const normalizedPathname = normalizeMiraLithChapterHref(nextPathname);
    const cursor = historyCursorRef.current;
    const ledger = historyLedgerRef.current;
    if (ledger[cursor] !== normalizedPathname) {
      historyLedgerRef.current = [...ledger.slice(0, cursor + 1), normalizedPathname];
      historyCursorRef.current = cursor + 1;
    }
    navigationEntryIndexRef.current = readNavigationEntryIndex();
    navigationEntryKeyRef.current = readNavigationEntryKey();
  }, []);

  const recordHistoryTraversal = useCallback((targetHref: string): HistoryTraversalRecord => {
    const normalizedTarget = normalizeMiraLithChapterHref(targetHref);
    const previousNavigationIndex = navigationEntryIndexRef.current;
    const sourceEntryKey = navigationEntryKeyRef.current;
    const nextNavigationIndex = readNavigationEntryIndex();
    const targetEntryKey = readNavigationEntryKey();
    const cursor = historyCursorRef.current;
    const ledger = historyLedgerRef.current;
    const previousMatches = cursor > 0 && ledger[cursor - 1] === normalizedTarget;
    const nextMatches = cursor + 1 < ledger.length && ledger[cursor + 1] === normalizedTarget;
    const navigationDelta =
      previousNavigationIndex !== null && nextNavigationIndex !== null
        ? toHistoryTraversalDelta(nextNavigationIndex - previousNavigationIndex)
        : null;
    const ledgerDelta = previousMatches !== nextMatches
      ? toHistoryTraversalDelta(previousMatches ? -1 : 1)
      : null;
    const delta = navigationDelta ?? ledgerDelta;

    if (delta === null) {
      historyLedgerRef.current = [normalizedTarget];
      historyCursorRef.current = 0;
    } else {
      const expectedCursor = cursor + delta;
      if (ledger[expectedCursor] === normalizedTarget) {
        historyCursorRef.current = expectedCursor;
      } else {
        historyLedgerRef.current = [normalizedTarget];
        historyCursorRef.current = 0;
      }
    }
    navigationEntryIndexRef.current = nextNavigationIndex;
    navigationEntryKeyRef.current = targetEntryKey;
    return {
      navigationDelta,
      sourceEntryKey,
      targetEntryKey
    };
  }, []);

  const finishTransition = useCallback((runtime: ActiveChapterTransition) => {
    if (activeRef.current !== runtime) {
      return;
    }
    clearRuntimeTimers(runtime);
    cancelDestinationAttempt(runtime);
    if (pendingPreviewMarkerRef.current?.transitionId === runtime.id) {
      pendingPreviewMarkerRef.current = null;
    }
    activeRef.current = null;
    restoreScrollRestoration();
    setSnapshot(idleSnapshot);
    setAnnouncement("");
    performanceMark(runtime, "idle");

    if (runtime.initiator !== "history") {
      const focusTarget = document.querySelector<HTMLElement>("[data-chapter-focus-root]");
      focusTarget?.focus({ preventScroll: true });
    }
  }, [restoreScrollRestoration]);

  const beginReveal = useCallback((runtime: ActiveChapterTransition) => {
    if (activeRef.current !== runtime || runtime.state === "revealing") {
      return;
    }
    if (runtime.deadlineTimer !== null) {
      window.clearTimeout(runtime.deadlineTimer);
      runtime.deadlineTimer = null;
    }
    if (runtime.fallbackTimer !== null) {
      window.clearTimeout(runtime.fallbackTimer);
      runtime.fallbackTimer = null;
    }
    publish(runtime, "revealing");
  }, [publish]);

  const recoverSource = useCallback((runtime: ActiveChapterTransition, reason: string) => {
    if (activeRef.current !== runtime || runtime.recovering) {
      return;
    }
    const failedTargetHref = runtime.targetHref;
    const currentPath = normalizeMiraLithChapterHref(window.location.pathname);
    const candidateRecoveryDelta: HistoryTraversalDelta | null = currentPath === runtime.sourceHref
      ? null
      : runtime.initiator === "history"
        ? runtime.historyTraversalDelta === null
          ? null
          : reverseHistoryTraversalDelta(runtime.historyTraversalDelta)
        : currentPath === failedTargetHref || runtime.navigationCommitted
          ? toHistoryTraversalDelta(-1)
          : null;
    const recoveryHistoryDelta = candidateRecoveryDelta !== null && runtime.sourceEntryKey !== null
      ? candidateRecoveryDelta
      : null;
    const recoveryExpectedEntryKey = recoveryHistoryDelta === null ? null : runtime.sourceEntryKey;
    const recoveryPushPending = currentPath !== runtime.sourceHref && recoveryHistoryDelta === null;

    runtime.recovering = true;
    runtime.error = reason;
    runtime.recoveryHistoryDelta = recoveryHistoryDelta;
    runtime.recoveryExpectedEntryKey = recoveryExpectedEntryKey;
    runtime.recoveryPushPending = recoveryPushPending;
    cancelDestinationAttempt(runtime);
    if (runtime.deadlineTimer !== null) {
      window.clearTimeout(runtime.deadlineTimer);
      runtime.deadlineTimer = null;
    }
    if (runtime.fallbackTimer !== null) {
      window.clearTimeout(runtime.fallbackTimer);
      runtime.fallbackTimer = null;
    }
    runtime.targetHref = runtime.sourceHref;
    runtime.targetEndpoint = runtime.sourceEndpoint;
    runtime.kind = "direct";
    runtime.destinationAttempt += 1;
    runtime.mounted = false;
    runtime.resetStarted = false;
    runtime.resetComplete = false;
    runtime.visualReady = false;
    runtime.fallbackReady = false;
    runtime.fallbackRequested = false;
    setAnnouncement("章节暂时无法载入，正在返回上一章节。");
    performanceMark(runtime, "recovery-begin");

    runtime.fallbackTimer = window.setTimeout(() => {
      const current = activeRef.current;
      if (current !== runtime || !runtime.recovering || runtimeCanReveal(runtime)) {
        return;
      }
      if (runtime.mounted && destinationControlsRef.current.has(runtime.targetHref)) {
        requestFallbackRef.current(runtime, "来源章节恢复时间过长");
      }
    }, DESTINATION_FALLBACK_REQUEST_MS);
    runtime.deadlineTimer = window.setTimeout(() => {
      const current = activeRef.current;
      if (current !== runtime || runtime.state === "revealing") {
        return;
      }
      if (runtimeCanReveal(runtime)) {
        tryAdvanceRef.current(runtime);
        return;
      }

      runtime.error = "来源章节在恢复上限内未就绪";
      restoreScrollRestoration();
      window.location.replace(runtime.sourceHref);
    }, DESTINATION_HARD_DEADLINE_MS);

    if (currentPath === runtime.targetHref) {
      publish(runtime, "waiting-mount", reason);
      processDestinationRef.current(runtime);
      return;
    }

    publish(runtime, "navigating", reason);
    if (recoveryHistoryDelta !== null) {
      window.history.go(recoveryHistoryDelta);
      return;
    }

    if (recoveryPushPending) {
      try {
        router.push(runtime.sourceHref, { scroll: false });
        window.queueMicrotask(() => {
          if (activeRef.current === runtime && runtime.state === "navigating") {
            publish(runtime, "waiting-mount", reason);
          }
        });
      } catch {
        restoreScrollRestoration();
        window.location.replace(runtime.sourceHref);
      }
      return;
    }

    restoreScrollRestoration();
    window.location.replace(runtime.sourceHref);
  }, [publish, restoreScrollRestoration, router]);

  const tryAdvance = useCallback((runtime: ActiveChapterTransition) => {
    if (
      activeRef.current !== runtime ||
      !runtime.coverComplete ||
      !runtime.mounted ||
      !runtime.resetComplete
    ) {
      return;
    }

    if (runtime.fallbackRequested ? runtime.fallbackReady : runtime.visualReady || runtime.fallbackReady) {
      beginReveal(runtime);
      return;
    }
    publish(runtime, "waiting-ready");
  }, [beginReveal, publish]);

  const armFallbackCommitDeadline = useCallback((runtime: ActiveChapterTransition) => {
    if (runtime.deadlineTimer !== null) {
      window.clearTimeout(runtime.deadlineTimer);
    }
    runtime.deadlineTimer = window.setTimeout(() => {
      if (activeRef.current !== runtime || runtime.state === "revealing") {
        return;
      }
      if (runtimeCanReveal(runtime)) {
        tryAdvanceRef.current(runtime);
        return;
      }
      if (runtime.recovering) {
        restoreScrollRestoration();
        window.location.replace(runtime.sourceHref);
        return;
      }
      recoverSourceRef.current(runtime, "目标章节降级画面未能在提交上限内就绪");
    }, DESTINATION_FALLBACK_COMMIT_DEADLINE_MS);
  }, [restoreScrollRestoration]);

  const requestFallback = useCallback((runtime: ActiveChapterTransition, reason: string) => {
    if (activeRef.current !== runtime || runtime.fallbackRequested) {
      return;
    }
    const controls = destinationControlsRef.current.get(runtime.targetHref);
    if (!runtime.mounted || !controls) {
      if (!runtime.recovering) {
        recoverSourceRef.current(runtime, "目标章节未能挂载");
      }
      return;
    }
    runtime.fallbackRequested = true;
    armFallbackCommitDeadline(runtime);
    runtime.error = reason;
    const resetNeedsRetry = !runtime.resetComplete;
    cancelDestinationAttempt(runtime);
    runtime.destinationAttempt += 1;
    runtime.visualReady = false;
    runtime.fallbackReady = false;
    if (resetNeedsRetry) {
      runtime.resetStarted = false;
      runtime.resetComplete = false;
    }
    const destinationAttempt = runtime.destinationAttempt;
    const destinationHref = runtime.targetHref;
    publish(runtime, "waiting-ready", reason);
    Promise.resolve().then(() => controls.forceFallback({
      transitionId: runtime.id,
      pathname: destinationHref,
      destinationAttempt
    })).then(() => {
      if (
        activeRef.current === runtime &&
        runtime.destinationAttempt === destinationAttempt &&
        runtime.targetHref === destinationHref
      ) {
        if (resetNeedsRetry) {
          performanceMark(runtime, runtime.recovering ? "recovery-fallback-entry" : "fallback-entry");
          processDestinationRef.current(runtime);
        } else {
          tryAdvanceRef.current(runtime);
        }
      }
    }).catch(() => {
      if (
        activeRef.current !== runtime ||
        runtime.destinationAttempt !== destinationAttempt ||
        runtime.targetHref !== destinationHref
      ) {
        return;
      }
      if (runtime.recovering) {
        restoreScrollRestoration();
        window.location.replace(runtime.sourceHref);
      } else {
        recoverSourceRef.current(runtime, "目标章节降级画面不可用");
      }
    });
  }, [armFallbackCommitDeadline, publish, restoreScrollRestoration]);

  const processDestination = useCallback((runtime: ActiveChapterTransition) => {
    if (
      activeRef.current !== runtime ||
      !runtime.coverComplete ||
      normalizeMiraLithChapterHref(window.location.pathname) !== runtime.targetHref
    ) {
      return;
    }
    runtime.mounted = true;
    const controls = destinationControlsRef.current.get(runtime.targetHref);
    if (!controls || runtime.resetStarted) {
      if (!controls) {
        publish(runtime, "waiting-mount");
      }
      return;
    }

    cancelDestinationAttempt(runtime);
    const destinationController = new AbortController();
    runtime.destinationController = destinationController;
    runtime.resetStarted = true;
    runtime.visualReady = false;
    runtime.fallbackReady = false;
    publish(runtime, "resetting-entry");
    const destinationAttempt = runtime.destinationAttempt;
    const destinationHref = runtime.targetHref;
    const resetInitiator = runtime.recovering ? "history" : runtime.initiator;
    const returnSnapshot = resetInitiator === "history" ? readReturnSnapshot(runtime.targetHref) : null;
    Promise.resolve().then(() =>
      controls.resetEntry({
        transitionId: runtime.id,
        pathname: runtime.targetHref,
        initiator: resetInitiator,
        handoff: runtime.handoff,
        returnSnapshot,
        destinationAttempt,
        signal: destinationController.signal
      })
    ).then(() => {
      if (
        activeRef.current !== runtime ||
        runtime.destinationAttempt !== destinationAttempt ||
        runtime.targetHref !== destinationHref ||
        destinationController.signal.aborted
      ) {
        return;
      }
      runtime.resetComplete = true;
      performanceMark(runtime, runtime.recovering ? "recovery-entry-reset" : "entry-reset");
      tryAdvanceRef.current(runtime);
    }).catch(() => {
      if (
        activeRef.current !== runtime ||
        runtime.destinationAttempt !== destinationAttempt ||
        runtime.targetHref !== destinationHref ||
        destinationController.signal.aborted
      ) {
        return;
      }
      if (runtime.recovering) {
        requestFallbackRef.current(runtime, "来源章节入口重置失败");
      } else {
        recoverSourceRef.current(runtime, "目标章节入口重置失败");
      }
    });
  }, [publish]);

  useEffect(() => {
    recoverSourceRef.current = recoverSource;
    tryAdvanceRef.current = tryAdvance;
    requestFallbackRef.current = requestFallback;
    processDestinationRef.current = processDestination;
  }, [processDestination, recoverSource, requestFallback, tryAdvance]);

  const startRuntime = useCallback((
    sourceHref: string,
    targetHref: string,
    initiator: ChapterTransitionInitiator,
    options: StartRuntimeOptions = {}
  ) => {
    const {
      handoff: requestedHandoff,
      historyTraversalDelta = null,
      sourceEntryKey = readNavigationEntryKey(),
      allowSamePathHistoryTraversal = false,
      skipSourceSnapshot = false
    } = options;
    if (activeRef.current) {
      return activeRef.current.id;
    }
    const normalizedSource = normalizeMiraLithChapterHref(sourceHref);
    const normalizedTarget = normalizeMiraLithChapterHref(targetHref);
    const sourceEndpoint = endpointFromAccess(resolveRuntimeChapterAccess(normalizedSource));
    const targetEndpoint = endpointFromAccess(resolveRuntimeChapterAccess(normalizedTarget));
    if (
      !sourceEndpoint ||
      !targetEndpoint ||
      (normalizedSource === normalizedTarget && !allowSamePathHistoryTraversal)
    ) {
      return null;
    }

    if (!skipSourceSnapshot) {
      writeReturnSnapshot(normalizedSource);
    }
    if (originalScrollRestorationRef.current === null) {
      originalScrollRestorationRef.current = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
    }
    const resolvedHandoff = initiator === "history"
      ? { kind: "direct" as const, handoff: null }
      : requestedHandoff === undefined
        ? { kind: transitionKindForPair(normalizedSource, normalizedTarget), handoff: null }
        : resolveChapterTransitionHandoff(requestedHandoff, normalizedSource, normalizedTarget);
    const runtime: ActiveChapterTransition = {
      id: `chapter-${Date.now().toString(36)}-${++transitionSequenceRef.current}`,
      state: "covering",
      sourceHref: normalizedSource,
      targetHref: normalizedTarget,
      sourceEndpoint,
      targetEndpoint,
      kind: resolvedHandoff.kind,
      handoff: resolvedHandoff.handoff,
      initiator,
      destinationAttempt: 1,
      destinationController: null,
      historyTraversalDelta,
      sourceEntryKey,
      navigationCommitted: initiator === "history",
      recoveryHistoryDelta: null,
      recoveryExpectedEntryKey: null,
      recoveryPushPending: false,
      coverComplete: false,
      mounted: false,
      resetStarted: false,
      resetComplete: false,
      visualReady: false,
      fallbackReady: false,
      fallbackRequested: false,
      recovering: false,
      error: null,
      deadlineTimer: null,
      fallbackTimer: null,
      finishTimer: null
    };
    activeRef.current = runtime;
    setSnapshot(transitionSnapshot(runtime));
    setAnnouncement(`正在进入 ${targetEndpoint.chapter.index} ${targetEndpoint.chapter.title}`);
    performanceMark(runtime, "begin");
    return runtime.id;
  }, [resolveRuntimeChapterAccess]);

  const beginTransition = useCallback((
    targetHref: string,
    initiator: Exclude<ChapterTransitionInitiator, "history">,
    handoff?: ChapterVisualHandoff | null
  ) => {
    const transitionId = startRuntime(currentPathRef.current, targetHref, initiator, { handoff });
    const activePreview = previewSessionRef.current;
    if (transitionId && activePreview.previewActive && activePreview.scope) {
      pendingPreviewMarkerRef.current = {
        transitionId,
        targetHref: normalizeMiraLithChapterHref(targetHref),
        scope: activePreview.scope
      };
    }
    return transitionId;
  }, [startRuntime]);

  const registerDestination = useCallback((pathnameToRegister: string, controls: ChapterDestinationControls) => {
    const normalizedPathname = normalizeMiraLithChapterHref(pathnameToRegister);
    destinationControlsRef.current.set(normalizedPathname, controls);
    const runtime = activeRef.current;
    if (
      runtime &&
      runtime.targetHref === normalizedPathname &&
      normalizeMiraLithChapterHref(window.location.pathname) === normalizedPathname
    ) {
      runtime.mounted = true;
      performanceMark(runtime, "mount");
      processDestinationRef.current(runtime);
    }

    return () => {
      if (destinationControlsRef.current.get(normalizedPathname) === controls) {
        destinationControlsRef.current.delete(normalizedPathname);
      }
    };
  }, []);

  const reportDestination = useCallback((signal: ChapterDestinationSignal) => {
    const runtime = activeRef.current;
    const signalPathname = normalizeMiraLithChapterHref(signal.pathname);
    if (
      !runtime ||
      runtime.id !== signal.transitionId ||
      runtime.targetHref !== signalPathname ||
      runtime.destinationAttempt !== signal.destinationAttempt
    ) {
      return;
    }

    if (signal.phase === "mount") {
      runtime.mounted = true;
      performanceMark(runtime, "mount");
      processDestinationRef.current(runtime);
      return;
    }
    if (signal.phase === "visual-pending") {
      runtime.visualReady = false;
      runtime.fallbackReady = false;
      performanceMark(runtime, runtime.recovering ? "recovery-visual-pending" : "visual-pending");
      return;
    }
    if (signal.phase === "visual-ready") {
      runtime.visualReady = true;
      performanceMark(runtime, runtime.recovering ? "recovery-visual-ready" : "visual-ready");
    } else {
      runtime.fallbackReady = true;
      performanceMark(runtime, runtime.recovering ? "recovery-fallback-ready" : "fallback-ready");
    }
    tryAdvanceRef.current(runtime);
  }, []);

  const handleCovered = useCallback((transitionId: string) => {
    const runtime = activeRef.current;
    if (!runtime || runtime.id !== transitionId || runtime.state !== "covering") {
      return;
    }
    runtime.coverComplete = true;
    performanceMark(runtime, "covered");
    runtime.fallbackTimer = window.setTimeout(() => {
      const current = activeRef.current;
      if (current === runtime && !runtime.visualReady && !runtime.fallbackReady) {
        requestFallbackRef.current(runtime, "目标章节准备时间过长");
      }
    }, DESTINATION_FALLBACK_REQUEST_MS);
    runtime.deadlineTimer = window.setTimeout(() => {
      const current = activeRef.current;
      if (current !== runtime || runtime.state === "revealing") {
        return;
      }
      if (runtimeCanReveal(runtime)) {
        tryAdvanceRef.current(runtime);
      } else {
        const reason = !runtime.mounted
          ? "目标章节在等待上限内未能挂载"
          : !runtime.resetComplete
            ? "目标章节入口重置超过等待上限"
            : "目标章节在等待上限内未能显示降级画面";
        recoverSourceRef.current(runtime, reason);
      }
    }, DESTINATION_HARD_DEADLINE_MS);

    if (runtime.initiator === "history") {
      publish(runtime, "waiting-mount");
      processDestinationRef.current(runtime);
      return;
    }

    publish(runtime, "navigating");
    try {
      router.push(runtime.targetHref, { scroll: false });
      window.queueMicrotask(() => {
        if (activeRef.current === runtime && runtime.state === "navigating") {
          publish(runtime, "waiting-mount");
        }
      });
    } catch {
      recoverSourceRef.current(runtime, "章节导航失败");
    }
  }, [publish, router]);

  const handleRevealed = useCallback((transitionId: string) => {
    const runtime = activeRef.current;
    if (!runtime || runtime.id !== transitionId || runtime.state !== "revealing") {
      return;
    }
    runtime.finishTimer = window.setTimeout(() => finishTransition(runtime), INPUT_INERTIA_SETTLE_MS);
  }, [finishTransition]);

  useEffect(() => {
    let disposed = false;
    window.queueMicrotask(() => {
      if (!disposed) {
        updatePreviewSession(bootstrapChapterPreviewSession());
      }
    });
    return () => {
      disposed = true;
    };
  }, [updatePreviewSession]);

  useEffect(() => {
    currentPathRef.current = pathname;
    const runtime = activeRef.current;
    if (!runtime) {
      return;
    }

    if (pathname === runtime.targetHref) {
      if (runtime.recovering && runtime.recoveryPushPending) {
        runtime.recoveryPushPending = false;
        recordCommittedPush(pathname);
      } else if (!runtime.recovering && runtime.initiator !== "history" && !runtime.navigationCommitted) {
        runtime.navigationCommitted = true;
        recordCommittedPush(pathname);
      }
      const pendingPreviewMarker = pendingPreviewMarkerRef.current;
      if (
        pendingPreviewMarker?.transitionId === runtime.id &&
        pendingPreviewMarker.targetHref === pathname &&
        previewSessionRef.current.previewActive &&
        previewSessionRef.current.scope === pendingPreviewMarker.scope
      ) {
        if (!markChapterPreviewHistoryEntry(pendingPreviewMarker.scope)) {
          updatePreviewSession(revalidateChapterPreviewSession());
        }
        pendingPreviewMarkerRef.current = null;
      }
      runtime.mounted = true;
      performanceMark(runtime, "pathname-confirmed");
      processDestinationRef.current(runtime);
    }
  }, [pathname, recordCommittedPush, updatePreviewSession]);

  useEffect(() => {
    navigationEntryIndexRef.current = readNavigationEntryIndex();
    navigationEntryKeyRef.current = readNavigationEntryKey();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      updatePreviewSession(revalidateChapterPreviewSession());
      const targetHref = normalizeMiraLithChapterHref(window.location.pathname);
      const sourceHref = currentPathRef.current;
      const activeRuntime = activeRef.current;
      const targetAccess = resolveRuntimeChapterAccess(targetHref);
      const traversal = recordHistoryTraversal(targetHref);
      if (targetAccess.chapter && !targetAccess.coordinatorAllowed) {
        if (activeRuntime) {
          clearRuntimeTimers(activeRuntime);
          cancelDestinationAttempt(activeRuntime);
          if (pendingPreviewMarkerRef.current?.transitionId === activeRuntime.id) {
            pendingPreviewMarkerRef.current = null;
          }
          activeRef.current = null;
        }
        restoreScrollRestoration();
        setSnapshot(idleSnapshot);
        setAnnouncement("");
        return;
      }
      const targetEndpoint = endpointFromAccess(targetAccess);
      const coordinatorRecoveryMatched =
        activeRuntime?.recovering &&
        activeRuntime.recoveryHistoryDelta !== null &&
        activeRuntime.recoveryExpectedEntryKey !== null &&
        traversal.navigationDelta === activeRuntime.recoveryHistoryDelta &&
        traversal.targetEntryKey === activeRuntime.recoveryExpectedEntryKey;
      if (activeRuntime) {
        if (coordinatorRecoveryMatched) {
          activeRuntime.recoveryHistoryDelta = null;
          activeRuntime.recoveryExpectedEntryKey = null;
          return;
        }

        const skipSourceSnapshot =
          sourceHref === activeRuntime.targetHref && !activeRuntime.resetComplete;
        clearRuntimeTimers(activeRuntime);
        cancelDestinationAttempt(activeRuntime);
        if (pendingPreviewMarkerRef.current?.transitionId === activeRuntime.id) {
          pendingPreviewMarkerRef.current = null;
        }
        activeRef.current = null;
        performanceMark(activeRuntime, "history-interrupted");
        const replacementId = targetEndpoint
          ? startRuntime(sourceHref, targetHref, "history", {
              historyTraversalDelta: traversal.navigationDelta,
              sourceEntryKey: traversal.sourceEntryKey,
              allowSamePathHistoryTraversal: true,
              skipSourceSnapshot
            })
          : null;
        if (!replacementId) {
          restoreScrollRestoration();
          setSnapshot(idleSnapshot);
          setAnnouncement("");
        }
        return;
      }
      if (sourceHref !== targetHref && targetEndpoint) {
        startRuntime(sourceHref, targetHref, "history", {
          historyTraversalDelta: traversal.navigationDelta,
          sourceEntryKey: traversal.sourceEntryKey
        });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [recordHistoryTraversal, resolveRuntimeChapterAccess, restoreScrollRestoration, startRuntime, updatePreviewSession]);

  useEffect(() => {
    const locked = snapshot.state !== "idle";
    const root = document.documentElement;
    const body = document.body;
    if (!locked) {
      delete root.dataset.chapterTransitionState;
      delete root.dataset.chapterTransitionKind;
      delete root.dataset.chapterTransitionSource;
      delete root.dataset.chapterTransitionTarget;
      delete root.dataset.chapterTransitionId;
      body.removeAttribute("aria-busy");
      return;
    }

    root.dataset.chapterTransitionState = snapshot.state;
    root.dataset.chapterTransitionKind = snapshot.kind ?? "direct";
    root.dataset.chapterTransitionSource = snapshot.sourceHref ?? "";
    root.dataset.chapterTransitionTarget = snapshot.targetHref ?? "";
    root.dataset.chapterTransitionId = snapshot.id ?? "";
    body.setAttribute("aria-busy", "true");

    const preventScroll = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();
    };
    const preventNavigationKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.matches("input, textarea, select")) {
        return;
      }
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
        preventScroll(event);
      }
    };
    window.addEventListener("wheel", preventScroll, { passive: false, capture: true });
    window.addEventListener("touchmove", preventScroll, { passive: false, capture: true });
    window.addEventListener("keydown", preventNavigationKey, { capture: true });

    return () => {
      window.removeEventListener("wheel", preventScroll, { capture: true });
      window.removeEventListener("touchmove", preventScroll, { capture: true });
      window.removeEventListener("keydown", preventNavigationKey, { capture: true });
    };
  }, [snapshot]);

  useEffect(() => () => {
    const runtime = activeRef.current;
    if (runtime) {
      clearRuntimeTimers(runtime);
      cancelDestinationAttempt(runtime);
      activeRef.current = null;
    }
    pendingPreviewMarkerRef.current = null;
    restoreScrollRestoration();
  }, [restoreScrollRestoration]);

  const value = useMemo<ChapterTransitionContextValue>(() => ({
    snapshot,
    previewActive: previewSession.previewActive,
    scope: previewSession.scope,
    resolveChapterAccess,
    getNextAccessibleChapter,
    beginTransition,
    registerDestination,
    reportDestination
  }), [
    beginTransition,
    getNextAccessibleChapter,
    previewSession.previewActive,
    previewSession.scope,
    registerDestination,
    reportDestination,
    resolveChapterAccess,
    snapshot
  ]);

  return (
    <ChapterTransitionContext.Provider value={value}>
      {children}
      <ChapterTransitionLayer
        snapshot={snapshot}
        announcement={announcement}
        onCovered={handleCovered}
        onRevealed={handleRevealed}
      />
    </ChapterTransitionContext.Provider>
  );
}

export function useChapterTransition() {
  const value = useContext(ChapterTransitionContext);
  if (!value) {
    throw new Error("useChapterTransition must be used inside ChapterTransitionProvider");
  }
  return value;
}

export function useChapterTransitionDestination(
  pathname: string,
  controls: ChapterDestinationControls,
  enabled = true
) {
  const { snapshot, registerDestination, reportDestination } = useChapterTransition();
  const normalizedPathname = normalizeMiraLithChapterHref(pathname);
  const stableControls = useMemo(() => controls, [controls]);
  const transitionId =
    enabled && snapshot.state !== "idle" && snapshot.targetHref === normalizedPathname
      ? snapshot.id
      : null;
  const destinationAttempt = transitionId ? snapshot.destinationAttempt : null;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const unregister = registerDestination(normalizedPathname, stableControls);
    if (transitionId && destinationAttempt !== null) {
      reportDestination({
        transitionId,
        pathname: normalizedPathname,
        destinationAttempt,
        phase: "mount"
      });
    }
    return unregister;
  }, [
    destinationAttempt,
    enabled,
    normalizedPathname,
    registerDestination,
    reportDestination,
    stableControls,
    transitionId
  ]);

  const reportVisualReady = useCallback(() => {
    if (transitionId && destinationAttempt !== null) {
      reportDestination({
        transitionId,
        pathname: normalizedPathname,
        destinationAttempt,
        phase: "visual-ready"
      });
    }
  }, [destinationAttempt, normalizedPathname, reportDestination, transitionId]);
  const reportVisualPending = useCallback(() => {
    if (transitionId && destinationAttempt !== null) {
      reportDestination({
        transitionId,
        pathname: normalizedPathname,
        destinationAttempt,
        phase: "visual-pending"
      });
    }
  }, [destinationAttempt, normalizedPathname, reportDestination, transitionId]);
  const reportFallbackReady = useCallback(() => {
    if (transitionId && destinationAttempt !== null) {
      reportDestination({
        transitionId,
        pathname: normalizedPathname,
        destinationAttempt,
        phase: "fallback-ready"
      });
    }
  }, [destinationAttempt, normalizedPathname, reportDestination, transitionId]);

  return {
    transitionId,
    destinationAttempt,
    isTransitionTarget: transitionId !== null,
    inputEnabled: snapshot.inputEnabled,
    snapshot,
    reportVisualPending,
    reportVisualReady,
    reportFallbackReady
  };
}
