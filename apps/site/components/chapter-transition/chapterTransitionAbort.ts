function abortError(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("Chapter destination attempt was cancelled", "AbortError");
}

export function throwIfChapterTransitionAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw abortError(signal);
  }
}

export function waitForChapterTransitionFrame(signal: AbortSignal) {
  throwIfChapterTransitionAborted(signal);

  return new Promise<void>((resolve, reject) => {
    let frameId = 0;
    const handleAbort = () => {
      window.cancelAnimationFrame(frameId);
      reject(abortError(signal));
    };
    frameId = window.requestAnimationFrame(() => {
      signal.removeEventListener("abort", handleAbort);
      if (signal.aborted) {
        reject(abortError(signal));
        return;
      }
      resolve();
    });
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function waitForChapterTransitionFrames(signal: AbortSignal, count: number) {
  for (let frame = 0; frame < count; frame += 1) {
    await waitForChapterTransitionFrame(signal);
  }
}
