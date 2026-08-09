import type { CSSProperties } from "react";
import {
  CHAPTER_VISUAL_HANDOFF_VERSION,
  type ChapterVisualHandoff,
  type ChapterTransitionKind,
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

function snapshotPlainDataRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const snapshot: UnknownRecord = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      return null;
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      return null;
    }
    Object.defineProperty(snapshot, key, {
      configurable: false,
      enumerable: true,
      value: descriptor.value,
      writable: false
    });
  }
  return Object.freeze(snapshot);
}

function hasExactSnapshotKeys(value: UnknownRecord, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNormalizedScalar(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function parseNormalizedPoint(value: unknown): Readonly<NormalizedChapterPoint> | null {
  const snapshot = snapshotPlainDataRecord(value);
  if (!snapshot || !hasExactSnapshotKeys(snapshot, ["x", "y"])) {
    return null;
  }
  if (!isNormalizedScalar(snapshot.x) || !isNormalizedScalar(snapshot.y)) {
    return null;
  }
  return Object.freeze({ x: snapshot.x, y: snapshot.y });
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
      !hasExactSnapshotKeys(value, LIVE_RING_KEYS) ||
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
    if (
      !hasExactSnapshotKeys(value, FALLBACK_RING_KEYS) ||
      !isFiniteNumber(value.gapPhaseRadians)
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
    !hasExactSnapshotKeys(value, STARS_KEYS) ||
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
    !hasExactSnapshotKeys(value, WATER_KEYS) ||
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
    const snapshot = snapshotPlainDataRecord(value);
    if (
      !snapshot ||
      snapshot.version !== CHAPTER_VISUAL_HANDOFF_VERSION ||
      typeof snapshot.kind !== "string"
    ) {
      return null;
    }

    if (snapshot.kind === "coscroll-ring") {
      return parseRing(snapshot, sourceHref, targetHref);
    }
    if (snapshot.kind === "focuence-stars") {
      return parseStars(snapshot, sourceHref, targetHref);
    }
    if (snapshot.kind === "cosmic-water") {
      return parseWater(snapshot, sourceHref, targetHref);
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveChapterTransitionHandoff(
  value: unknown,
  sourceHref: string,
  targetHref: string
): {
  kind: "direct" | ChapterVisualHandoff["kind"];
  handoff: ChapterVisualHandoff | null;
} {
  const handoff = parseChapterVisualHandoff(value, sourceHref, targetHref);
  return handoff
    ? { kind: handoff.kind, handoff }
    : { kind: "direct", handoff: null };
}

export function resetChapterTransitionVisualForRecovery(
  runtimeVisual: {
    kind: ChapterTransitionKind;
    handoff: ChapterVisualHandoff | null;
  }
): void {
  runtimeVisual.kind = "direct";
  runtimeVisual.handoff = null;
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
