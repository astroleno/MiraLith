export type NarrativeControllerPhase =
  | "scrub"
  | "await-send"
  | "answer-starting"
  | "manual-ready"
  | "autoplay"
  | "reverse-before-complete"
  | "released-hold"
  | "reverse-after-complete"
  | "transitioning";

export type NarrativeInputOwner =
  | "scroll-timeline"
  | "await-send"
  | "autoplay-controls"
  | "release-gate"
  | "route-transition";

export type NarrativeResumePhase = "await-send" | "manual-ready";

export interface NarrativeControllerState {
  segmentId: string;
  phase: NarrativeControllerPhase;
  progress: number;
  activeMediaId: string | null;
  attemptGeneration: number | null;
  completedMediaIds: readonly string[];
  skippedMediaIds: readonly string[];
  gateReleased: boolean;
  resumePhase: NarrativeResumePhase | null;
  freshInputArmed: boolean;
}

export type NarrativeControllerEvent =
  | { kind: "reach-await" }
  | { kind: "reverse-completed"; completedSegmentId: string }
  | { kind: "attempt-began"; mediaId: string; generation: number }
  | { kind: "skip"; mediaId: string }
  | { kind: "reverse" }
  | { kind: "play-accepted"; generation: number }
  | { kind: "play-rejected"; generation: number }
  | { kind: "cancel" }
  | { kind: "ended"; mediaId: string; generation: number }
  | { kind: "settled"; previousSegmentId: string }
  | { kind: "inertia-settled" }
  | { kind: "fresh-forward-input"; nextSegmentId: string }
  | { kind: "return-to-tail" }
  | { kind: "route-transition" }
  | { kind: "reset"; segmentId: string };

export type NarrativeControllerResult =
  | { accepted: true; state: NarrativeControllerState }
  | { accepted: false; state: NarrativeControllerState };

export function narrativeInputOwnerForPhase(
  phase: NarrativeControllerPhase
): NarrativeInputOwner {
  switch (phase) {
    case "scrub":
    case "reverse-before-complete":
    case "reverse-after-complete":
      return "scroll-timeline";
    case "await-send":
      return "await-send";
    case "answer-starting":
    case "manual-ready":
    case "autoplay":
      return "autoplay-controls";
    case "released-hold":
      return "release-gate";
    case "transitioning":
      return "route-transition";
  }
}

function reject(state: NarrativeControllerState): NarrativeControllerResult {
  return { accepted: false, state };
}

function accept(
  state: NarrativeControllerState,
  changes: Partial<NarrativeControllerState>
): NarrativeControllerResult {
  return { accepted: true, state: { ...state, ...changes } };
}

function isNonEmptyId(value: string) {
  return value.length > 0;
}

function isAttemptGeneration(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function withoutMediaId(values: readonly string[], mediaId: string) {
  return values.filter((value) => value !== mediaId);
}

function withLatestMediaOutcome(values: readonly string[], mediaId: string) {
  return [...withoutMediaId(values, mediaId), mediaId];
}

function beginAttempt(
  state: NarrativeControllerState,
  mediaId: string,
  generation: number,
  replayOnly: boolean
): NarrativeControllerResult {
  if (!isNonEmptyId(mediaId) || !isAttemptGeneration(generation)) {
    return reject(state);
  }
  const completed = state.completedMediaIds.includes(mediaId);
  const skipped = state.skippedMediaIds.includes(mediaId);
  if (replayOnly && !completed && !skipped) {
    return reject(state);
  }
  return accept(state, {
    phase: "answer-starting",
    activeMediaId: mediaId,
    attemptGeneration: generation,
    completedMediaIds: withoutMediaId(state.completedMediaIds, mediaId),
    skippedMediaIds: withoutMediaId(state.skippedMediaIds, mediaId),
    resumePhase: null
  });
}

function releaseWithOutcome(
  state: NarrativeControllerState,
  mediaId: string,
  outcome: "completed" | "skipped"
): NarrativeControllerResult {
  if (!isNonEmptyId(mediaId)) {
    return reject(state);
  }
  const wasAlreadyReleased = state.gateReleased;
  return accept(state, {
    phase: "released-hold",
    activeMediaId: null,
    attemptGeneration: null,
    completedMediaIds: outcome === "completed"
      ? withLatestMediaOutcome(state.completedMediaIds, mediaId)
      : withoutMediaId(state.completedMediaIds, mediaId),
    skippedMediaIds: outcome === "skipped"
      ? withLatestMediaOutcome(state.skippedMediaIds, mediaId)
      : withoutMediaId(state.skippedMediaIds, mediaId),
    gateReleased: true,
    resumePhase: null,
    freshInputArmed: wasAlreadyReleased
  });
}

function matchesAttempt(
  state: NarrativeControllerState,
  generation: number,
  mediaId?: string
) {
  return isAttemptGeneration(generation)
    && state.attemptGeneration === generation
    && state.activeMediaId !== null
    && (mediaId === undefined || state.activeMediaId === mediaId);
}

function clearAttempt(state: NarrativeControllerState) {
  return {
    activeMediaId: null,
    attemptGeneration: null
  } as const;
}

export function reduceNarrativeControllerState(
  state: NarrativeControllerState,
  event: NarrativeControllerEvent
): NarrativeControllerResult {
  if (event.kind === "route-transition") {
    return state.phase === "transitioning"
      ? reject(state)
      : accept(state, { phase: "transitioning", ...clearAttempt(state) });
  }
  if (state.phase === "transitioning") {
    if (event.kind !== "reset" || !isNonEmptyId(event.segmentId)) {
      return reject(state);
    }
    return {
      accepted: true,
      state: {
        segmentId: event.segmentId,
        phase: "scrub",
        progress: 0,
        activeMediaId: null,
        attemptGeneration: null,
        completedMediaIds: [],
        skippedMediaIds: [],
        gateReleased: false,
        resumePhase: null,
        freshInputArmed: false
      }
    };
  }

  switch (state.phase) {
    case "scrub":
      if (event.kind === "reach-await") {
        return accept(state, {
          phase: state.resumePhase ?? "await-send",
          resumePhase: null
        });
      }
      if (event.kind === "reverse-completed") {
        if (!isNonEmptyId(event.completedSegmentId)) {
          return reject(state);
        }
        return accept(state, {
          segmentId: event.completedSegmentId,
          phase: "reverse-after-complete",
          gateReleased: true,
          resumePhase: null
        });
      }
      return reject(state);

    case "await-send":
      if (event.kind === "attempt-began") {
        return beginAttempt(state, event.mediaId, event.generation, false);
      }
      if (event.kind === "skip") {
        return releaseWithOutcome(state, event.mediaId, "skipped");
      }
      if (event.kind === "reverse") {
        return accept(state, {
          phase: "reverse-before-complete",
          resumePhase: "await-send",
          ...clearAttempt(state)
        });
      }
      return reject(state);

    case "answer-starting":
      if (event.kind === "play-accepted") {
        return matchesAttempt(state, event.generation)
          ? accept(state, { phase: "autoplay" })
          : reject(state);
      }
      if (event.kind === "play-rejected") {
        return matchesAttempt(state, event.generation)
          ? accept(state, { phase: "manual-ready", ...clearAttempt(state) })
          : reject(state);
      }
      if (event.kind === "cancel") {
        return accept(state, { phase: "manual-ready", ...clearAttempt(state) });
      }
      if (event.kind === "skip") {
        return state.activeMediaId === event.mediaId
          ? releaseWithOutcome(state, event.mediaId, "skipped")
          : reject(state);
      }
      if (event.kind === "reverse") {
        return accept(state, {
          phase: "reverse-before-complete",
          resumePhase: "manual-ready",
          ...clearAttempt(state)
        });
      }
      return reject(state);

    case "manual-ready":
      if (event.kind === "attempt-began") {
        return beginAttempt(state, event.mediaId, event.generation, false);
      }
      if (event.kind === "skip") {
        return releaseWithOutcome(state, event.mediaId, "skipped");
      }
      if (event.kind === "reverse") {
        return accept(state, {
          phase: "reverse-before-complete",
          resumePhase: "manual-ready",
          ...clearAttempt(state)
        });
      }
      return reject(state);

    case "autoplay":
      if (event.kind === "ended") {
        return matchesAttempt(state, event.generation, event.mediaId)
          ? releaseWithOutcome(state, event.mediaId, "completed")
          : reject(state);
      }
      if (event.kind === "skip") {
        return state.activeMediaId === event.mediaId
          ? releaseWithOutcome(state, event.mediaId, "skipped")
          : reject(state);
      }
      if (event.kind === "reverse") {
        return accept(state, {
          phase: "reverse-before-complete",
          resumePhase: "manual-ready",
          ...clearAttempt(state)
        });
      }
      return reject(state);

    case "reverse-before-complete":
      if (event.kind === "settled") {
        return isNonEmptyId(event.previousSegmentId)
          && event.previousSegmentId === state.segmentId
          ? accept(state, { phase: "scrub", progress: 0 })
          : reject(state);
      }
      return reject(state);

    case "released-hold":
      if (event.kind === "inertia-settled") {
        return accept(state, { freshInputArmed: true });
      }
      if (event.kind === "fresh-forward-input") {
        if (!state.freshInputArmed || !isNonEmptyId(event.nextSegmentId)) {
          return reject(state);
        }
        return accept(state, {
          segmentId: event.nextSegmentId,
          phase: "scrub",
          progress: 0,
          gateReleased: false,
          resumePhase: null,
          freshInputArmed: false,
          ...clearAttempt(state)
        });
      }
      if (event.kind === "reverse") {
        return accept(state, { phase: "reverse-after-complete" });
      }
      if (event.kind === "attempt-began") {
        return beginAttempt(state, event.mediaId, event.generation, true);
      }
      return reject(state);

    case "reverse-after-complete":
      if (event.kind === "settled") {
        return isNonEmptyId(event.previousSegmentId)
          && event.previousSegmentId === state.segmentId
          ? accept(state, {
              phase: "scrub",
              progress: 1,
              resumePhase: null,
              ...clearAttempt(state)
            })
          : reject(state);
      }
      if (event.kind === "return-to-tail") {
        return accept(state, { phase: "released-hold", freshInputArmed: true });
      }
      if (event.kind === "attempt-began") {
        return beginAttempt(state, event.mediaId, event.generation, true);
      }
      return reject(state);
  }
}
