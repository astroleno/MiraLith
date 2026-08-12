import { expect, test } from "@playwright/test";
import {
  narrativeInputOwnerForPhase,
  reduceNarrativeControllerState,
  type NarrativeControllerEvent,
  type NarrativeControllerPhase,
  type NarrativeControllerState
} from "../../apps/site/components/post-coscroll/narrativeControllerState";

const phases = [
  "scrub",
  "await-send",
  "answer-starting",
  "manual-ready",
  "autoplay",
  "reverse-before-complete",
  "released-hold",
  "reverse-after-complete",
  "transitioning"
] as const satisfies readonly NarrativeControllerPhase[];

const eventKinds = [
  "reach-await",
  "reverse-completed",
  "attempt-began",
  "skip",
  "reverse",
  "play-accepted",
  "play-rejected",
  "cancel",
  "ended",
  "settled",
  "inertia-settled",
  "fresh-forward-input",
  "return-to-tail",
  "route-transition",
  "reset"
] as const satisfies readonly NarrativeControllerEvent["kind"][];

const acceptedKinds = {
  scrub: ["reach-await", "reverse-completed", "route-transition"],
  "await-send": ["attempt-began", "skip", "reverse", "route-transition"],
  "answer-starting": [
    "play-accepted",
    "play-rejected",
    "cancel",
    "skip",
    "reverse",
    "route-transition"
  ],
  "manual-ready": ["attempt-began", "skip", "reverse", "route-transition"],
  autoplay: ["ended", "skip", "reverse", "route-transition"],
  "reverse-before-complete": ["settled", "route-transition"],
  "released-hold": [
    "attempt-began",
    "reverse",
    "inertia-settled",
    "fresh-forward-input",
    "route-transition"
  ],
  "reverse-after-complete": ["attempt-began", "settled", "return-to-tail", "route-transition"],
  transitioning: ["reset"]
} as const satisfies Record<NarrativeControllerPhase, readonly NarrativeControllerEvent["kind"][]>;

function stateForPhase(
  phase: NarrativeControllerPhase,
  overrides: Partial<NarrativeControllerState> = {}
): NarrativeControllerState {
  const hasAttempt = phase === "answer-starting" || phase === "autoplay";
  const released = phase === "released-hold" || phase === "reverse-after-complete";
  return {
    segmentId: "prompt",
    phase,
    progress: 0.5,
    activeMediaId: hasAttempt ? "active" : null,
    attemptGeneration: hasAttempt ? 41 : null,
    completedMediaIds: released ? ["replay"] : ["completed"],
    skippedMediaIds: ["skipped"],
    gateReleased: released,
    resumePhase: phase === "reverse-before-complete" ? "manual-ready" : null,
    freshInputArmed: phase === "released-hold",
    ...overrides
  };
}

function eventForKind(
  kind: NarrativeControllerEvent["kind"],
  phase: NarrativeControllerPhase
): NarrativeControllerEvent {
  switch (kind) {
    case "reach-await":
    case "reverse":
    case "cancel":
    case "inertia-settled":
    case "return-to-tail":
    case "route-transition":
      return { kind };
    case "reverse-completed":
      return { kind, completedSegmentId: "opening" };
    case "attempt-began":
      return {
        kind,
        mediaId: phase === "released-hold" || phase === "reverse-after-complete" ? "replay" : "active",
        generation: 42
      };
    case "skip":
      return { kind, mediaId: phase === "autoplay" || phase === "answer-starting" ? "active" : "answer" };
    case "play-accepted":
    case "play-rejected":
      return { kind, generation: 41 };
    case "ended":
      return { kind, mediaId: "active", generation: 41 };
    case "settled":
      return {
        kind,
        previousSegmentId: phase === "reverse-before-complete"
          || phase === "reverse-after-complete"
          ? "prompt"
          : "opening"
      };
    case "fresh-forward-input":
      return { kind, nextSegmentId: "answer" };
    case "reset":
      return { kind, segmentId: "opening" };
  }
}

function expectCoreStateInvariants(state: NarrativeControllerState) {
  if (state.phase === "released-hold") {
    expect(state.gateReleased, "released-hold must keep its gate released").toBe(true);
  }
  expect(state.completedMediaIds.filter((mediaId) => state.skippedMediaIds.includes(mediaId)))
    .toEqual([]);
  if (state.activeMediaId !== null) {
    expect(state.completedMediaIds).not.toContain(state.activeMediaId);
    expect(state.skippedMediaIds).not.toContain(state.activeMediaId);
  }
}

test("maps every public phase to exactly one input owner", () => {
  expect(Object.fromEntries(phases.map((phase) => [phase, narrativeInputOwnerForPhase(phase)])))
    .toEqual({
      scrub: "scroll-timeline",
      "await-send": "await-send",
      "answer-starting": "autoplay-controls",
      "manual-ready": "autoplay-controls",
      autoplay: "autoplay-controls",
      "reverse-before-complete": "scroll-timeline",
      "released-hold": "release-gate",
      "reverse-after-complete": "scroll-timeline",
      transitioning: "route-transition"
    });
});

test("implements the complete phase by event acceptance table without mutating rejected state", () => {
  for (const phase of phases) {
    for (const kind of eventKinds) {
      const original = stateForPhase(phase);
      const frozen = Object.freeze({
        ...original,
        completedMediaIds: Object.freeze([...original.completedMediaIds]),
        skippedMediaIds: Object.freeze([...original.skippedMediaIds])
      });
      const result = reduceNarrativeControllerState(frozen, eventForKind(kind, phase));
      const shouldAccept = acceptedKinds[phase].includes(kind as never);

      expect(result.accepted, `${phase} × ${kind}`).toBe(shouldAccept);
      if (shouldAccept) {
        expect(narrativeInputOwnerForPhase(result.state.phase)).toBeTruthy();
        expectCoreStateInvariants(result.state);
      } else {
        expect(result.state, `${phase} × ${kind} must preserve identity`).toBe(frozen);
      }
    }
  }
});

test("uses the caller generation as a receipt and rejects stale play continuations", () => {
  const began = reduceNarrativeControllerState(
    stateForPhase("await-send", { completedMediaIds: ["answer"], skippedMediaIds: [] }),
    { kind: "attempt-began", mediaId: "answer", generation: 77 }
  );
  expect(began).toMatchObject({
    accepted: true,
    state: {
      phase: "answer-starting",
      activeMediaId: "answer",
      attemptGeneration: 77,
      completedMediaIds: [],
      skippedMediaIds: []
    }
  });
  if (!began.accepted) {
    throw new Error("attempt fixture was rejected");
  }

  expect(reduceNarrativeControllerState(began.state, {
    kind: "play-accepted",
    generation: 76
  })).toEqual({ accepted: false, state: began.state });
  expect(reduceNarrativeControllerState(began.state, {
    kind: "play-rejected",
    generation: 76
  })).toEqual({ accepted: false, state: began.state });
  expect(reduceNarrativeControllerState(began.state, {
    kind: "play-accepted",
    generation: 77
  })).toMatchObject({ accepted: true, state: { phase: "autoplay", attemptGeneration: 77 } });

  const rejected = reduceNarrativeControllerState(began.state, {
    kind: "play-rejected",
    generation: 77
  });
  expect(rejected).toMatchObject({
    accepted: true,
    state: { phase: "manual-ready", activeMediaId: null, attemptGeneration: null }
  });
});

test("rejects delayed ended events even when they name the current media", () => {
  const state = stateForPhase("autoplay");
  expect(reduceNarrativeControllerState(state, {
    kind: "ended",
    mediaId: "active",
    generation: 40
  })).toEqual({ accepted: false, state });
  expect(reduceNarrativeControllerState(state, {
    kind: "ended",
    mediaId: "other",
    generation: 41
  })).toEqual({ accepted: false, state });
});

test("retains interrupted gate intent across reverse and explicit re-entry", () => {
  const fromAwait = reduceNarrativeControllerState(stateForPhase("await-send"), { kind: "reverse" });
  expect(fromAwait).toMatchObject({
    accepted: true,
    state: { phase: "reverse-before-complete", resumePhase: "await-send", attemptGeneration: null }
  });
  if (!fromAwait.accepted) {
    throw new Error("reverse fixture was rejected");
  }
  const settled = reduceNarrativeControllerState(fromAwait.state, { kind: "settled", previousSegmentId: "prompt" });
  expect(settled).toMatchObject({ accepted: true, state: { phase: "scrub", resumePhase: "await-send" } });
  if (!settled.accepted) {
    throw new Error("settled fixture was rejected");
  }
  expect(reduceNarrativeControllerState(settled.state, { kind: "reach-await" }))
    .toMatchObject({ accepted: true, state: { phase: "await-send", resumePhase: null } });

  const fromAutoplay = reduceNarrativeControllerState(stateForPhase("autoplay"), { kind: "reverse" });
  expect(fromAutoplay).toMatchObject({
    accepted: true,
    state: {
      phase: "reverse-before-complete",
      resumePhase: "manual-ready",
      activeMediaId: null,
      attemptGeneration: null
    }
  });
});

test("makes initial release sticky but requires inertia and a fresh forward input", () => {
  const skipped = reduceNarrativeControllerState(
    stateForPhase("await-send", { gateReleased: false, freshInputArmed: false }),
    { kind: "skip", mediaId: "answer" }
  );
  expect(skipped).toMatchObject({
    accepted: true,
    state: {
      phase: "released-hold",
      skippedMediaIds: ["skipped", "answer"],
      gateReleased: true,
      freshInputArmed: false
    }
  });
  if (!skipped.accepted) {
    throw new Error("skip fixture was rejected");
  }

  expect(reduceNarrativeControllerState(skipped.state, {
    kind: "fresh-forward-input",
    nextSegmentId: "answer"
  })).toEqual({ accepted: false, state: skipped.state });

  const armed = reduceNarrativeControllerState(skipped.state, { kind: "inertia-settled" });
  expect(armed).toMatchObject({ accepted: true, state: { phase: "released-hold", freshInputArmed: true } });
  if (!armed.accepted) {
    throw new Error("inertia fixture was rejected");
  }
  expect(reduceNarrativeControllerState(armed.state, {
    kind: "fresh-forward-input",
    nextSegmentId: "answer"
  })).toMatchObject({
    accepted: true,
    state: {
      segmentId: "answer",
      phase: "scrub",
      progress: 0,
      gateReleased: false,
      freshInputArmed: false,
      resumePhase: null
    }
  });
});

test("keeps release sticky while replay replaces completed and skipped outcomes", () => {
  for (const outcome of ["completed", "skipped"] as const) {
    const initial = stateForPhase("released-hold", {
      completedMediaIds: outcome === "completed" ? ["replay", "other-complete"] : ["other-complete"],
      skippedMediaIds: outcome === "skipped" ? ["replay", "other-skip"] : ["other-skip"],
      gateReleased: true,
      freshInputArmed: true
    });
    const replay = reduceNarrativeControllerState(initial, {
      kind: "attempt-began",
      mediaId: "replay",
      generation: 91
    });
    expect(replay).toMatchObject({
      accepted: true,
      state: {
        phase: "answer-starting",
        activeMediaId: "replay",
        attemptGeneration: 91,
        completedMediaIds: ["other-complete"],
        skippedMediaIds: ["other-skip"],
        gateReleased: true
      }
    });
    if (!replay.accepted) {
      throw new Error("replay fixture was rejected");
    }
    const autoplay = reduceNarrativeControllerState(replay.state, {
      kind: "play-accepted",
      generation: 91
    });
    if (!autoplay.accepted) {
      throw new Error("replay play fixture was rejected");
    }

    expect(reduceNarrativeControllerState(autoplay.state, {
      kind: "ended",
      mediaId: "replay",
      generation: 91
    })).toMatchObject({
      accepted: true,
      state: {
        phase: "released-hold",
        activeMediaId: null,
        attemptGeneration: null,
        completedMediaIds: ["other-complete", "replay"],
        skippedMediaIds: ["other-skip"],
        gateReleased: true,
        freshInputArmed: true
      }
    });

    expect(reduceNarrativeControllerState(autoplay.state, {
      kind: "skip",
      mediaId: "replay"
    })).toMatchObject({
      accepted: true,
      state: {
        phase: "released-hold",
        activeMediaId: null,
        attemptGeneration: null,
        completedMediaIds: ["other-complete"],
        skippedMediaIds: ["other-skip", "replay"],
        gateReleased: true,
        freshInputArmed: true
      }
    });
  }
});

test("preserves outcomes through reverse-after-complete until explicit replay", () => {
  const released = stateForPhase("released-hold", {
    completedMediaIds: ["replay"],
    skippedMediaIds: ["skipped"],
    gateReleased: true,
    freshInputArmed: true
  });
  const reversed = reduceNarrativeControllerState(released, { kind: "reverse" });
  expect(reversed).toMatchObject({
    accepted: true,
    state: {
      phase: "reverse-after-complete",
      completedMediaIds: ["replay"],
      skippedMediaIds: ["skipped"]
    }
  });
  if (!reversed.accepted) {
    throw new Error("reverse fixture was rejected");
  }
  expect(reduceNarrativeControllerState(reversed.state, {
    kind: "settled",
    previousSegmentId: "prompt"
  })).toMatchObject({
    accepted: true,
    state: {
      segmentId: "prompt",
      phase: "scrub",
      progress: 1,
      completedMediaIds: ["replay"],
      skippedMediaIds: ["skipped"]
    }
  });
  expect(reduceNarrativeControllerState(reversed.state, { kind: "return-to-tail" }))
    .toMatchObject({ accepted: true, state: { phase: "released-hold", freshInputArmed: true } });
});

test("restores the released gate when fresh progress reverses back to the completed tail", () => {
  const advanced = reduceNarrativeControllerState(stateForPhase("released-hold", {
    segmentId: "opening",
    completedMediaIds: ["opening-media"],
    skippedMediaIds: [],
    gateReleased: true,
    freshInputArmed: true
  }), { kind: "fresh-forward-input", nextSegmentId: "prompt" });
  if (!advanced.accepted) {
    throw new Error("fresh-forward fixture was rejected");
  }
  expect(advanced.state).toMatchObject({
    segmentId: "prompt",
    phase: "scrub",
    gateReleased: false
  });

  const reversed = reduceNarrativeControllerState(advanced.state, {
    kind: "reverse-completed",
    completedSegmentId: "opening"
  });
  expect(reversed).toMatchObject({
    accepted: true,
    state: {
      phase: "reverse-after-complete",
      segmentId: "opening",
      gateReleased: true,
      resumePhase: null,
      completedMediaIds: ["opening-media"]
    }
  });
  if (!reversed.accepted) {
    throw new Error("reverse-completed fixture was rejected");
  }

  const returned = reduceNarrativeControllerState(reversed.state, { kind: "return-to-tail" });
  expect(returned).toMatchObject({
    accepted: true,
    state: {
      phase: "released-hold",
      segmentId: "opening",
      gateReleased: true,
      freshInputArmed: true,
      completedMediaIds: ["opening-media"]
    }
  });
  if (returned.accepted) {
    expectCoreStateInvariants(returned.state);
  } else {
    throw new Error("return-to-tail fixture was rejected");
  }

  expect(reduceNarrativeControllerState(returned.state, {
    kind: "fresh-forward-input",
    nextSegmentId: "prompt"
  })).toMatchObject({
    accepted: true,
    state: {
      segmentId: "prompt",
      phase: "scrub",
      gateReleased: false
    }
  });
});

test("keeps the previous completed segment released after reverse-completed settles", () => {
  const advanced = reduceNarrativeControllerState(stateForPhase("released-hold", {
    segmentId: "opening",
    completedMediaIds: [],
    skippedMediaIds: ["opening-media"],
    gateReleased: true,
    freshInputArmed: true
  }), { kind: "fresh-forward-input", nextSegmentId: "prompt" });
  if (!advanced.accepted) {
    throw new Error("fresh-forward fixture was rejected");
  }
  const reversed = reduceNarrativeControllerState(advanced.state, {
    kind: "reverse-completed",
    completedSegmentId: "opening"
  });
  if (!reversed.accepted) {
    throw new Error("reverse-completed fixture was rejected");
  }

  const settled = reduceNarrativeControllerState(reversed.state, {
    kind: "settled",
    previousSegmentId: "opening"
  });
  expect(settled).toMatchObject({
    accepted: true,
    state: {
      segmentId: "opening",
      phase: "scrub",
      progress: 1,
      gateReleased: true,
      resumePhase: null,
      skippedMediaIds: ["opening-media"]
    }
  });
});

test("rejects a stale settled segment after reverse-completed establishes ownership", () => {
  const state = stateForPhase("scrub", {
    segmentId: "prompt",
    gateReleased: false
  });
  const reversed = reduceNarrativeControllerState(state, {
    kind: "reverse-completed",
    completedSegmentId: "opening"
  });
  if (!reversed.accepted) {
    throw new Error("reverse-completed fixture was rejected");
  }

  expect(reduceNarrativeControllerState(reversed.state, {
    kind: "settled",
    previousSegmentId: "prompt"
  })).toEqual({ accepted: false, state: reversed.state });
});

test("rejects empty and stale settled receipts before completion", () => {
  const state = stateForPhase("reverse-before-complete", {
    segmentId: "prompt"
  });

  expect(reduceNarrativeControllerState(state, {
    kind: "settled",
    previousSegmentId: ""
  })).toEqual({ accepted: false, state });
  expect(reduceNarrativeControllerState(state, {
    kind: "settled",
    previousSegmentId: "opening"
  })).toEqual({ accepted: false, state });
});

test("rejects reverse-completed without a concrete completed segment", () => {
  const state = stateForPhase("scrub", {
    segmentId: "prompt",
    gateReleased: false
  });
  expect(reduceNarrativeControllerState(state, {
    kind: "reverse-completed",
    completedSegmentId: ""
  })).toEqual({ accepted: false, state });
});

test("route transitions clear attempts and reset starts a clean segment", () => {
  const transitioning = reduceNarrativeControllerState(stateForPhase("autoplay"), {
    kind: "route-transition"
  });
  expect(transitioning).toMatchObject({
    accepted: true,
    state: { phase: "transitioning", activeMediaId: null, attemptGeneration: null }
  });
  if (!transitioning.accepted) {
    throw new Error("route transition fixture was rejected");
  }
  expect(reduceNarrativeControllerState(transitioning.state, {
    kind: "reset",
    segmentId: "opening"
  })).toEqual({
    accepted: true,
    state: {
      segmentId: "opening",
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
  });
});
