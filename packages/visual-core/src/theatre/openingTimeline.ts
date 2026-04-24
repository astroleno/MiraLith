"use client";

import { getProject } from "@theatre/core";

export interface OpeningTimelineFrame {
  progress: number;
  cameraDistance: number;
  cameraAzimuth: number;
  cameraElevation: number;
  earthScale: number;
  earthX: number;
  moonX: number;
  moonY: number;
  lightIntensity: number;
  windowOpacity: number;
}

export interface OpeningTheatreBridge {
  duration: number;
  setProgress: (progress: number) => OpeningTimelineFrame;
  destroy: () => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeInOut = (value: number) => value * value * (3 - 2 * value);
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

export const OPENING_TIMELINE_DURATION = 7.2;

const THEATRE_OPENING_STATE = {
  sheetsById: {},
  definitionVersion: "0.4.0",
  revisionHistory: []
};

export function mapOpeningProgress(progressInput: number): OpeningTimelineFrame {
  const progress = clamp01(progressInput);
  const eased = easeInOut(progress);

  return {
    progress,
    cameraDistance: lerp(7.4, 5.15, eased),
    cameraAzimuth: lerp(-0.18, 0.26, eased),
    cameraElevation: lerp(0.48, 0.18, eased),
    earthScale: lerp(1.08, 0.72, eased),
    earthX: lerp(1.18, -1.14, eased),
    moonX: lerp(-1.7, 1.82, eased),
    moonY: lerp(1.05, 0.74, eased),
    lightIntensity: lerp(2.1, 1.58, eased),
    windowOpacity: clamp01((progress - 0.42) / 0.28)
  };
}

export function createOpeningTheatreBridge(): OpeningTheatreBridge {
  if (typeof window === "undefined") {
    return {
      duration: OPENING_TIMELINE_DURATION,
      setProgress: mapOpeningProgress,
      destroy: () => undefined
    };
  }

  let sheet: ReturnType<ReturnType<typeof getProject>["sheet"]>;

  try {
    const project = getProject("MiraLith LuBirth Opening", { state: THEATRE_OPENING_STATE });
    sheet = project.sheet("Opening to Project Window");
  } catch {
    return {
      duration: OPENING_TIMELINE_DURATION,
      setProgress: mapOpeningProgress,
      destroy: () => undefined
    };
  }

  return {
    duration: OPENING_TIMELINE_DURATION,
    setProgress(progress: number) {
      const position = clamp01(progress) * OPENING_TIMELINE_DURATION;
      (sheet.sequence as { position: number }).position = position;
      return mapOpeningProgress(progress);
    },
    destroy() {
      return undefined;
    }
  };
}
