export interface MediaPlaybackAttemptToken {
  readonly generation: number;
  readonly segmentId: string;
  readonly element: HTMLMediaElement;
  readonly transitionId: string | null;
}

export type MediaPlaybackInvalidationReason =
  | "skip"
  | "cancel"
  | "reverse"
  | "pause"
  | "ended"
  | "new-attempt"
  | "rejected"
  | "route-transition"
  | "navigation"
  | "reset"
  | "hidden"
  | "unmount";

export interface MediaPlaybackAttemptController {
  begin(input: Omit<MediaPlaybackAttemptToken, "generation">): MediaPlaybackAttemptToken;
  isCurrent(token: MediaPlaybackAttemptToken): boolean;
  guard(token: MediaPlaybackAttemptToken, continuation: () => void): boolean;
  invalidate(reason: MediaPlaybackInvalidationReason): void;
  requestPlay(token: MediaPlaybackAttemptToken): Promise<"playing" | "rejected" | "stale">;
}

function pauseElement(element: HTMLMediaElement) {
  try {
    element.pause();
  } catch {
    // Ownership still expires if a detached or hostile media element refuses pause().
  }
}

function pauseStaleElement(element: HTMLMediaElement) {
  try {
    if (!element.paused) pauseElement(element);
  } catch {
    pauseElement(element);
  }
}

export function createMediaPlaybackAttemptController(): MediaPlaybackAttemptController {
  let generation = 0;
  let current: MediaPlaybackAttemptToken | null = null;

  const isCurrent = (token: MediaPlaybackAttemptToken) => current !== null
    && current.generation === token.generation
    && current.segmentId === token.segmentId
    && current.element === token.element
    && current.transitionId === token.transitionId;

  const pauseIfUnowned = (token: MediaPlaybackAttemptToken) => {
    if (current?.element !== token.element) {
      pauseStaleElement(token.element);
    }
  };

  const invalidate = (_reason: MediaPlaybackInvalidationReason) => {
    generation += 1;
    const invalidated = current;
    current = null;
    if (invalidated) pauseElement(invalidated.element);
  };

  const begin = (
    input: Omit<MediaPlaybackAttemptToken, "generation">
  ): MediaPlaybackAttemptToken => {
    if (current) invalidate("new-attempt");
    generation += 1;
    current = Object.freeze({ generation, ...input });
    return current;
  };

  const guard = (token: MediaPlaybackAttemptToken, continuation: () => void) => {
    if (!isCurrent(token)) {
      pauseIfUnowned(token);
      return false;
    }
    continuation();
    return true;
  };

  const requestPlay = async (
    token: MediaPlaybackAttemptToken
  ): Promise<"playing" | "rejected" | "stale"> => {
    if (!isCurrent(token)) {
      pauseIfUnowned(token);
      return "stale";
    }

    let request: Promise<void>;
    try {
      request = token.element.play();
    } catch {
      if (isCurrent(token)) {
        invalidate("rejected");
        return "rejected";
      }
      pauseIfUnowned(token);
      return "stale";
    }

    try {
      await request;
    } catch {
      if (isCurrent(token)) {
        invalidate("rejected");
        return "rejected";
      }
      pauseIfUnowned(token);
      return "stale";
    }

    if (!isCurrent(token)) {
      pauseIfUnowned(token);
      return "stale";
    }
    return "playing";
  };

  return { begin, isCurrent, guard, invalidate, requestPlay };
}
