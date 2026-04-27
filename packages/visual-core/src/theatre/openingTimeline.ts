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
export const OPENING_FIELD_AUTO_ROTATE_START = 0.96;

const ORIGINAL_CAMERA_DISTANCE = 15;
const ORIGINAL_CAMERA_FOV = 45;
const ORIGINAL_WORLD_UNIT = ORIGINAL_CAMERA_DISTANCE * Math.tan(degToRad(ORIGINAL_CAMERA_FOV) / 2);
const FIELD_FRAME = {
  cameraElevationDeg: 3.46402,
  lookAtDistanceRatio: 0,
  earthSize: 0.33,
  earthY: -2.48,
  earthPitchDeg: 0,
  earthYawDeg: -106.6,
  moonScale: 1
};

const CLOSE_FRAME = {
  cameraAzimuthDeg: 88.1438565849,
  cameraElevationDeg: -16.4,
  lookAtDistanceRatio: 1.08,
  earthSize: 1.68,
  earthY: -1.18,
  earthPitchDeg: -28.5,
  earthYawDeg: -104.25,
  moonScale: 1.5
};

const THEATRE_OPENING_STATE = {
  sheetsById: {},
  definitionVersion: "0.4.0",
  revisionHistory: []
};

export function mapOpeningProgress(progressInput: number): OpeningTimelineFrame {
  const progress = clamp01(progressInput);
  const eased = easeInOut(progress);
  const fieldEarthScale = FIELD_FRAME.earthSize * ORIGINAL_WORLD_UNIT;
  const closeEarthScale = CLOSE_FRAME.earthSize * ORIGINAL_WORLD_UNIT;

  return {
    progress,
    cameraDistance: ORIGINAL_CAMERA_DISTANCE,
    cameraAzimuth: degToRad(CLOSE_FRAME.cameraAzimuthDeg),
    cameraElevation: degToRad(lerp(
      CLOSE_FRAME.cameraElevationDeg,
      FIELD_FRAME.cameraElevationDeg,
      eased
    )),
    cameraLookAtY: lerp(
      CLOSE_FRAME.lookAtDistanceRatio * ORIGINAL_CAMERA_DISTANCE,
      FIELD_FRAME.lookAtDistanceRatio * ORIGINAL_CAMERA_DISTANCE,
      eased
    ),
    earthScale: lerp(closeEarthScale, fieldEarthScale, eased),
    earthX: 0,
    earthY: lerp(CLOSE_FRAME.earthY, FIELD_FRAME.earthY, eased),
    earthPitchDeg: lerp(CLOSE_FRAME.earthPitchDeg, FIELD_FRAME.earthPitchDeg, eased),
    earthYawDeg: lerp(CLOSE_FRAME.earthYawDeg, FIELD_FRAME.earthYawDeg, eased),
    moonX: 0.5,
    moonY: 0.75,
    moonScale: lerp(CLOSE_FRAME.moonScale, FIELD_FRAME.moonScale, eased),
    lightIntensity: lerp(2.45, 2.45, eased),
    windowOpacity: 1 - clamp01((progress - 0.3) / 0.28)
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
