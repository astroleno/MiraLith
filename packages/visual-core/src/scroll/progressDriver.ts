export interface ScrollProgressDriverOptions {
  startRatio?: number;
  endRatio?: number;
  onProgress: (progress: number) => void;
}

export interface ScrollProgressDriver {
  destroy: () => void;
}

declare global {
  interface Window {
    __MiraLithOpeningProgress?: number;
  }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createScrollProgressDriver(options: ScrollProgressDriverOptions): ScrollProgressDriver {
  if (typeof window === "undefined") {
    return { destroy: () => undefined };
  }

  const startRatio = options.startRatio ?? 0;
  const endRatio = options.endRatio ?? 1.4;
  let frameId = 0;
  let destroyed = false;
  let lastProgress = -1;

  const update = () => {
    if (destroyed) {
      return;
    }

    const viewport = Math.max(window.innerHeight, 1);
    const start = viewport * startRatio;
    const end = viewport * endRatio;
    const raw = (window.scrollY - start) / Math.max(end - start, 1);
    const progress = clamp01(raw);

    if (Math.abs(progress - lastProgress) > 0.001) {
      lastProgress = progress;
      options.onProgress(progress);
    }

    frameId = window.requestAnimationFrame(update);
  };

  frameId = window.requestAnimationFrame(update);

  return {
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(frameId);
    }
  };
}

export function getRuntimeOpeningProgress(fallback = 0) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return clamp01(window.__MiraLithOpeningProgress ?? fallback);
}
