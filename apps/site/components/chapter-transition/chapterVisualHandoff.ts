import type { CSSProperties } from "react";
import {
  CHAPTER_VISUAL_HANDOFF_VERSION,
  type ChapterVisualHandoff,
  type CoScrollRingFallbackHandoff,
  type CoScrollRingLiveHandoff,
  type CosmicWaterHandoff,
  type FocuenceStarsHandoff,
  type NormalizedChapterPoint
} from "./chapterTransitionTypes";

type UnknownRecord = Record<string, unknown>;
type ChapterHandoffCssProperties = CSSProperties & Record<`--chapter-handoff-${string}`, string>;

const LIVE_RING_KEYS = [
  "version",
  "kind",
  "sourceHref",
  "targetHref",
  "center",
  "diameter",
  "lineWidth",
  "exitProgress",
  "direction",
  "signalSource",
  "angleRadians",
  "angularVelocityRadiansPerSecond"
] as const;

const FALLBACK_RING_KEYS = [
  "version",
  "kind",
  "sourceHref",
  "targetHref",
  "center",
  "diameter",
  "lineWidth",
  "exitProgress",
  "direction",
  "signalSource",
  "gapPhaseRadians"
] as const;

const STARS_KEYS = [
  "version",
  "kind",
  "sourceHref",
  "targetHref",
  "collapseOrigin",
  "seed",
  "collapsePhase"
] as const;

const WATER_KEYS = [
  "version",
  "kind",
  "sourceHref",
  "targetHref",
  "highlightOrigin",
  "radius",
  "ripplePhase"
] as const;

function isPlainObject(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: UnknownRecord, expectedKeys: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expectedKeys.length) {
    return false;
  }

  return keys.every((key) => {
    if (typeof key !== "string" || !expectedKeys.includes(key)) {
      return false;
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor?.enumerable && "value" in descriptor);
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNormalizedScalar(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function parseNormalizedPoint(value: unknown): Readonly<NormalizedChapterPoint> | null {
  if (!isPlainObject(value) || !hasExactKeys(value, ["x", "y"])) {
    return null;
  }
  if (!isNormalizedScalar(value.x) || !isNormalizedScalar(value.y)) {
    return null;
  }
  return Object.freeze({ x: value.x, y: value.y });
}

function isExactEdge(
  value: UnknownRecord,
  sourceHref: string,
  targetHref: string,
  expectedSource: string,
  expectedTarget: string
): boolean {
  return value.sourceHref === expectedSource &&
    value.targetHref === expectedTarget &&
    sourceHref === expectedSource &&
    targetHref === expectedTarget;
}

function parseRing(
  value: UnknownRecord,
  sourceHref: string,
  targetHref: string
): CoScrollRingLiveHandoff | CoScrollRingFallbackHandoff | null {
  if (!isExactEdge(value, sourceHref, targetHref, "/coscroll", "/artbreeze")) {
    return null;
  }
  const center = parseNormalizedPoint(value.center);
  if (
    !center ||
    !isFiniteNumber(value.diameter) ||
    value.diameter <= 0 ||
    value.diameter > 1 ||
    !isFiniteNumber(value.lineWidth) ||
    value.lineWidth <= 0 ||
    value.lineWidth > 0.25 ||
    value.lineWidth > value.diameter / 2 ||
    !isNormalizedScalar(value.exitProgress) ||
    value.direction !== "clockwise"
  ) {
    return null;
  }

  if (value.signalSource === "live") {
    if (
      !hasExactKeys(value, LIVE_RING_KEYS) ||
      !isFiniteNumber(value.angleRadians) ||
      !isFiniteNumber(value.angularVelocityRadiansPerSecond)
    ) {
      return null;
    }
    return Object.freeze({
      version: CHAPTER_VISUAL_HANDOFF_VERSION,
      kind: "coscroll-ring",
      sourceHref: "/coscroll",
      targetHref: "/artbreeze",
      center,
      diameter: value.diameter,
      lineWidth: value.lineWidth,
      exitProgress: value.exitProgress,
      direction: "clockwise",
      signalSource: "live",
      angleRadians: value.angleRadians,
      angularVelocityRadiansPerSecond: value.angularVelocityRadiansPerSecond
    });
  }

  if (value.signalSource === "fallback") {
    if (!hasExactKeys(value, FALLBACK_RING_KEYS) || !isFiniteNumber(value.gapPhaseRadians)) {
      return null;
    }
    return Object.freeze({
      version: CHAPTER_VISUAL_HANDOFF_VERSION,
      kind: "coscroll-ring",
      sourceHref: "/coscroll",
      targetHref: "/artbreeze",
      center,
      diameter: value.diameter,
      lineWidth: value.lineWidth,
      exitProgress: value.exitProgress,
      direction: "clockwise",
      signalSource: "fallback",
      gapPhaseRadians: value.gapPhaseRadians
    });
  }

  return null;
}

function parseStars(
  value: UnknownRecord,
  sourceHref: string,
  targetHref: string
): FocuenceStarsHandoff | null {
  const collapseOrigin = parseNormalizedPoint(value.collapseOrigin);
  if (
    !hasExactKeys(value, STARS_KEYS) ||
    !isExactEdge(value, sourceHref, targetHref, "/artbreeze", "/constellation") ||
    !collapseOrigin ||
    !Number.isInteger(value.seed) ||
    !isFiniteNumber(value.seed) ||
    value.seed < 0 ||
    value.seed > 0xffff_ffff ||
    !isNormalizedScalar(value.collapsePhase)
  ) {
    return null;
  }
  return Object.freeze({
    version: CHAPTER_VISUAL_HANDOFF_VERSION,
    kind: "focuence-stars",
    sourceHref: "/artbreeze",
    targetHref: "/constellation",
    collapseOrigin,
    seed: value.seed,
    collapsePhase: value.collapsePhase
  });
}

function parseWater(
  value: UnknownRecord,
  sourceHref: string,
  targetHref: string
): CosmicWaterHandoff | null {
  const highlightOrigin = parseNormalizedPoint(value.highlightOrigin);
  if (
    !hasExactKeys(value, WATER_KEYS) ||
    !isExactEdge(value, sourceHref, targetHref, "/constellation", "/client-works") ||
    !highlightOrigin ||
    !isFiniteNumber(value.radius) ||
    value.radius <= 0 ||
    value.radius > 1 ||
    !isNormalizedScalar(value.ripplePhase)
  ) {
    return null;
  }
  return Object.freeze({
    version: CHAPTER_VISUAL_HANDOFF_VERSION,
    kind: "cosmic-water",
    sourceHref: "/constellation",
    targetHref: "/client-works",
    highlightOrigin,
    radius: value.radius,
    ripplePhase: value.ripplePhase
  });
}

export function parseChapterVisualHandoff(
  value: unknown,
  sourceHref: string,
  targetHref: string
): ChapterVisualHandoff | null {
  try {
    if (
      !isPlainObject(value) ||
      value.version !== CHAPTER_VISUAL_HANDOFF_VERSION ||
      typeof value.kind !== "string"
    ) {
      return null;
    }

    if (value.kind === "coscroll-ring") {
      return parseRing(value, sourceHref, targetHref);
    }
    if (value.kind === "focuence-stars") {
      return parseStars(value, sourceHref, targetHref);
    }
    if (value.kind === "cosmic-water") {
      return parseWater(value, sourceHref, targetHref);
    }
    return null;
  } catch {
    return null;
  }
}

function percentage(value: number): string {
  return `${Number((value * 100).toFixed(12))}%`;
}

export function chapterVisualHandoffCssVariables(
  handoff: ChapterVisualHandoff
): ChapterHandoffCssProperties {
  if (handoff.kind === "coscroll-ring") {
    const shared = {
      "--chapter-handoff-center-x": percentage(handoff.center.x),
      "--chapter-handoff-center-y": percentage(handoff.center.y),
      "--chapter-handoff-diameter": percentage(handoff.diameter),
      "--chapter-handoff-line-width": percentage(handoff.lineWidth),
      "--chapter-handoff-exit-progress": `${handoff.exitProgress}`
    };
    return handoff.signalSource === "live"
      ? {
          ...shared,
          "--chapter-handoff-angle": `${handoff.angleRadians}rad`,
          "--chapter-handoff-angular-velocity": `${handoff.angularVelocityRadiansPerSecond}rad/s`
        }
      : {
          ...shared,
          "--chapter-handoff-gap-phase": `${handoff.gapPhaseRadians}rad`
        };
  }

  if (handoff.kind === "focuence-stars") {
    return {
      "--chapter-handoff-collapse-origin-x": percentage(handoff.collapseOrigin.x),
      "--chapter-handoff-collapse-origin-y": percentage(handoff.collapseOrigin.y),
      "--chapter-handoff-seed": `${handoff.seed}`,
      "--chapter-handoff-collapse-phase": `${handoff.collapsePhase}`
    };
  }

  return {
    "--chapter-handoff-highlight-origin-x": percentage(handoff.highlightOrigin.x),
    "--chapter-handoff-highlight-origin-y": percentage(handoff.highlightOrigin.y),
    "--chapter-handoff-radius": percentage(handoff.radius),
    "--chapter-handoff-ripple-phase": `${handoff.ripplePhase}`
  };
}
