"use client";

import { getProject } from "@theatre/core";

export interface OpeningTimelineFrame {
  progress: number;
  cameraDistance: number;
  cameraAzimuth: number;
  cameraElevation: number;
  cameraLookAtY: number;
  earthScale: number;
  earthX: number;
  earthY: number;
  earthPitchDeg: number;
  earthYawDeg: number;
  moonX: number;
  moonY: number;
  moonScale: number;
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
const degToRad = (value: number) => (value * Math.PI) / 180;

export const OPENING_TIMELINE_DURATION = 7.2;

const ORIGINAL_CAMERA_DISTANCE = 15;
const ORIGINAL_CAMERA_FOV = 45;
const ORIGINAL_WORLD_UNIT = ORIGINAL_CAMERA_DISTANCE * Math.tan(degToRad(ORIGINAL_CAMERA_FOV) / 2);
const MIANYANG_XIU = {
  cameraAzimuthDeg: 88.1438565849,
  initialCameraElevationDeg: 3.46402,
  finalCameraElevationDeg: -16.4,
  lookAtDistanceRatio: 1.08,
  earthSize: 1.68,
  initialEarthPitchDeg: 0,
  earthPitchDeg: -28.5,
  initialEarthYawDeg: -106.6,
  earthYawDeg: -104.25
};

const THEATRE_OPENING_STATE = {
  sheetsById: {},
  definitionVersion: "0.4.0",
  revisionHistory: []
};

export function mapOpeningProgress(progressInput: number): OpeningTimelineFrame {
  const progress = clamp01(progressInput);
  const eased = easeInOut(progress);
  const firstStageEarthScale = 0.33 * ORIGINAL_WORLD_UNIT;
  const xiuEarthScale = MIANYANG_XIU.earthSize * ORIGINAL_WORLD_UNIT;

  return {
    progress,
    cameraDistance: ORIGINAL_CAMERA_DISTANCE,
    cameraAzimuth: degToRad(MIANYANG_XIU.cameraAzimuthDeg),
    cameraElevation: degToRad(lerp(
      MIANYANG_XIU.initialCameraElevationDeg,
      MIANYANG_XIU.finalCameraElevationDeg,
      eased
    )),
    cameraLookAtY: lerp(0, MIANYANG_XIU.lookAtDistanceRatio * ORIGINAL_CAMERA_DISTANCE, eased),
    earthScale: lerp(firstStageEarthScale, xiuEarthScale, eased),
    earthX: 0,
    earthY: lerp(-2.48, -1.18, eased),
    earthPitchDeg: lerp(MIANYANG_XIU.initialEarthPitchDeg, MIANYANG_XIU.earthPitchDeg, eased),
    earthYawDeg: lerp(MIANYANG_XIU.initialEarthYawDeg, MIANYANG_XIU.earthYawDeg, eased),
    moonX: 0.5,
    moonY: 0.75,
    moonScale: lerp(1, 1.15, eased),
    lightIntensity: lerp(2.45, 2.45, eased),
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
