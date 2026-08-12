"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import { flushSync } from "react-dom";
import {
  createMediaPlaybackAttemptController,
  type MediaPlaybackAttemptToken,
  type MediaPlaybackInvalidationReason
} from "./mediaPlaybackAttempt";
import {
  narrativeInputOwnerForPhase,
  reduceNarrativeControllerState,
  type NarrativeControllerEvent,
  type NarrativeControllerPhase,
  type NarrativeControllerState
} from "./narrativeControllerState";

const MEDIA_ID = "answer-media";
const CONTRACT_LIFECYCLE_ACTIONS = [
  "skip",
  "cancel",
  "reverse",
  "pause",
  "route-transition",
  "reset"
] as const;

type ContractLifecycleAction = (typeof CONTRACT_LIFECYCLE_ACTIONS)[number];

const ALLOWED_LIFECYCLE_ACTIONS = {
  scrub: ["route-transition", "reset"],
  "await-send": ["skip", "reverse", "route-transition", "reset"],
  "answer-starting": ["skip", "cancel", "reverse", "pause", "route-transition", "reset"],
  "manual-ready": ["skip", "reverse", "route-transition", "reset"],
  autoplay: ["skip", "reverse", "route-transition", "reset"],
  "reverse-before-complete": ["route-transition", "reset"],
  "released-hold": ["reverse", "route-transition", "reset"],
  "reverse-after-complete": ["route-transition", "reset"],
  transitioning: ["reset"]
} as const satisfies Readonly<Record<NarrativeControllerPhase, readonly ContractLifecycleAction[]>>;

function canRunLifecycleAction(
  phase: NarrativeControllerPhase,
  action: ContractLifecycleAction
) {
  return ALLOWED_LIFECYCLE_ACTIONS[phase].some((allowedAction) => allowedAction === action);
}

function initialState(): NarrativeControllerState {
  return {
    segmentId: "prompt",
    phase: "await-send",
    progress: 1,
    activeMediaId: null,
    attemptGeneration: null,
    completedMediaIds: [],
    skippedMediaIds: [],
    gateReleased: false,
    resumePhase: null,
    freshInputArmed: false
  };
}

function contractReducer(state: NarrativeControllerState, event: NarrativeControllerEvent) {
  const result = reduceNarrativeControllerState(state, event);
  return result.accepted ? result.state : state;
}

interface HarnessProps {
  onRequestUnmount: () => void;
  onUnmounted: (pauseCount: number) => void;
}

function ControllerHarness({ onRequestUnmount, onUnmounted }: HarnessProps) {
  const [state, dispatch] = useReducer(contractReducer, undefined, initialState);
  const [pauseCount, setPauseCount] = useState(0);
  const [lastResult, setLastResult] = useState("idle");
  const [observedControllerGeneration, setObservedControllerGeneration] = useState<number | null>(null);
  const [mediaSlots, setMediaSlots] = useState<readonly number[]>([]);
  const pauseCountRef = useRef(0);
  const mediaSlotSequenceRef = useRef(0);
  const mediaElementsRef = useRef(new Map<number, HTMLVideoElement>());
  const mediaTokensRef = useRef(new WeakMap<HTMLVideoElement, MediaPlaybackAttemptToken>());
  const instrumentedMediaRef = useRef(new WeakSet<HTMLVideoElement>());
  const tokenRef = useRef<MediaPlaybackAttemptToken | null>(null);
  const controller = useMemo(() => createMediaPlaybackAttemptController(), []);

  const clearAttempt = useCallback((reason: MediaPlaybackInvalidationReason) => {
    controller.invalidate(reason);
    tokenRef.current = null;
    setObservedControllerGeneration(null);
  }, [controller]);

  const invalidateExternalLifecycle = useCallback((reason: "navigation" | "hidden") => {
    clearAttempt(reason);
    dispatch({ kind: "route-transition" });
  }, [clearAttempt]);

  const runLifecycleAction = (action: ContractLifecycleAction) => {
    if (!canRunLifecycleAction(state.phase, action)) return;

    clearAttempt(action);

    switch (action) {
      case "skip":
        dispatch({ kind: "skip", mediaId: MEDIA_ID });
        break;
      case "cancel":
      case "pause":
        dispatch({ kind: "cancel" });
        break;
      case "reverse":
        dispatch({ kind: "reverse" });
        break;
      case "reset":
        dispatch({ kind: "route-transition" });
        dispatch({ kind: "reset", segmentId: "opening" });
        break;
      case "route-transition":
        dispatch({ kind: "route-transition" });
        break;
    }
  };

  const registerMediaElement = useCallback((slot: number, element: HTMLVideoElement | null) => {
    if (!element) {
      mediaElementsRef.current.delete(slot);
      return;
    }
    mediaElementsRef.current.set(slot, element);
    if (instrumentedMediaRef.current.has(element)) return;
    instrumentedMediaRef.current.add(element);

    const nativePause = element.pause.bind(element);
    Object.defineProperty(element, "pause", {
      configurable: true,
      value: () => {
        pauseCountRef.current += 1;
        setPauseCount(pauseCountRef.current);
        nativePause();
      }
    });
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        invalidateExternalLifecycle("hidden");
      }
    };
    const onHistoryNavigation = () => invalidateExternalLifecycle("navigation");
    const onPageHide = () => invalidateExternalLifecycle("navigation");
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("popstate", onHistoryNavigation);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("popstate", onHistoryNavigation);
      window.removeEventListener("pagehide", onPageHide);
      controller.invalidate("unmount");
      tokenRef.current = null;
      onUnmounted(pauseCountRef.current);
    };
  }, [controller, invalidateExternalLifecycle, onUnmounted]);

  const replayAvailable = state.completedMediaIds.includes(MEDIA_ID)
    || state.skippedMediaIds.includes(MEDIA_ID);
  const canBeginPlayback = state.phase === "await-send"
    || state.phase === "manual-ready"
    || ((state.phase === "released-hold" || state.phase === "reverse-after-complete")
      && replayAvailable);
  const canReplacePlayback = state.phase === "answer-starting"
    && state.attemptGeneration !== null
    && state.attemptGeneration === observedControllerGeneration;

  const beginPlayback = (trigger: "click" | "enter", replaceCurrent = false) => {
    if (replaceCurrent ? !canReplacePlayback : !canBeginPlayback) return;

    const slot = mediaSlotSequenceRef.current + 1;
    mediaSlotSequenceRef.current = slot;
    flushSync(() => {
      setMediaSlots((current) => [...current, slot]);
    });
    const element = mediaElementsRef.current.get(slot);
    if (!element) throw new Error("Contract media element did not mount synchronously.");

    if (replaceCurrent && tokenRef.current) {
      dispatch({ kind: "cancel" });
    }
    const token = controller.begin({
      segmentId: state.segmentId,
      element,
      transitionId: null
    });
    tokenRef.current = token;
    mediaTokensRef.current.set(element, token);
    setObservedControllerGeneration(token.generation);
    element.dataset.contractGeneration = String(token.generation);
    element.dataset.contractTrigger = trigger;
    dispatch({ kind: "attempt-began", mediaId: MEDIA_ID, generation: token.generation });
    setLastResult("pending");

    void controller.requestPlay(token).then((result) => {
      setLastResult(result);
      if (result === "playing") {
        dispatch({ kind: "play-accepted", generation: token.generation });
      } else if (result === "rejected") {
        if (tokenRef.current?.generation === token.generation) {
          tokenRef.current = null;
          setObservedControllerGeneration(null);
        }
        dispatch({ kind: "play-rejected", generation: token.generation });
      }
    });
  };

  const onPlayButton = (event: ReactMouseEvent<HTMLButtonElement>) => {
    beginPlayback(event.detail === 0 ? "enter" : "click");
  };

  const onReplaceAttempt = () => beginPlayback("click", true);

  const onEnded = (element: HTMLVideoElement) => {
    const token = mediaTokensRef.current.get(element);
    if (!token) return;
    controller.guard(token, () => {
      clearAttempt("ended");
      dispatch({ kind: "ended", mediaId: MEDIA_ID, generation: token.generation });
    });
  };

  const synchronized = observedControllerGeneration === state.attemptGeneration;

  return (
    <main
      data-post-coscroll-controller-contract
      data-mounted="true"
      data-phase={state.phase}
      data-owner={narrativeInputOwnerForPhase(state.phase)}
      data-controller-generation={observedControllerGeneration ?? ""}
      data-reducer-generation={state.attemptGeneration ?? ""}
      data-synchronized={String(synchronized)}
      data-pause-count={pauseCount}
      data-completed-media={state.completedMediaIds.join(",")}
      data-skipped-media={state.skippedMediaIds.join(",")}
      data-last-result={lastResult}
      data-can-begin-playback={String(canBeginPlayback)}
      data-can-replace-playback={String(canReplacePlayback)}
      data-can-lifecycle-skip={String(canRunLifecycleAction(state.phase, "skip"))}
      data-can-lifecycle-cancel={String(canRunLifecycleAction(state.phase, "cancel"))}
      data-can-lifecycle-reverse={String(canRunLifecycleAction(state.phase, "reverse"))}
      data-can-lifecycle-pause={String(canRunLifecycleAction(state.phase, "pause"))}
      data-can-lifecycle-route-transition={String(canRunLifecycleAction(state.phase, "route-transition"))}
      data-can-lifecycle-reset={String(canRunLifecycleAction(state.phase, "reset"))}
    >
      <div data-contract-media-container>
        {mediaSlots.map((slot) => (
          <video
            key={slot}
            ref={(element) => registerMediaElement(slot, element)}
            data-contract-video
            data-contract-slot={slot}
            preload="none"
            muted
            playsInline
            onEnded={(event) => onEnded(event.currentTarget)}
          />
        ))}
      </div>
      <button type="button" disabled={!canBeginPlayback} onClick={onPlayButton}>
        {replayAvailable && (state.phase === "released-hold" || state.phase === "reverse-after-complete")
          ? "Replay answer"
          : state.phase === "manual-ready" ? "Retry answer" : "Send answer"}
      </button>
      <button type="button" disabled={!canReplacePlayback} onClick={onReplaceAttempt}>
        Replace attempt
      </button>
      {CONTRACT_LIFECYCLE_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          data-contract-action={action}
          disabled={!canRunLifecycleAction(state.phase, action)}
          onClick={() => runLifecycleAction(action)}
        >
          {action}
        </button>
      ))}
      {CONTRACT_LIFECYCLE_ACTIONS.map((action) => (
        <button
          key={`force-${action}`}
          type="button"
          hidden
          data-contract-force-action={action}
          onClick={() => runLifecycleAction(action)}
        >
          force {action}
        </button>
      ))}
      <button type="button" data-contract-action="unmount" onClick={onRequestUnmount}>
        unmount
      </button>
    </main>
  );
}

export function PostCoScrollControllerContractFixture() {
  const [mounted, setMounted] = useState(true);
  const [finalPauseCount, setFinalPauseCount] = useState(0);
  const onUnmounted = useCallback((pauseCount: number) => {
    setFinalPauseCount(pauseCount);
  }, []);

  if (!mounted) {
    return (
      <main
        data-post-coscroll-controller-contract
        data-mounted="false"
        data-phase="unmounted"
        data-owner="route-transition"
        data-controller-generation=""
        data-reducer-generation=""
        data-synchronized="true"
        data-pause-count={finalPauseCount}
        data-completed-media=""
      />
    );
  }

  return (
    <ControllerHarness
      onRequestUnmount={() => setMounted(false)}
      onUnmounted={onUnmounted}
    />
  );
}
