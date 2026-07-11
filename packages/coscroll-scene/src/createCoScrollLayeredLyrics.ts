import type { CoScrollLyricSegment } from "./types";

export type CoScrollLayeredLyricLayer = "front" | "back-near" | "back-far";
export type CoScrollLayerVerticalAlign = "top" | "center" | "bottom";

export interface CoScrollLayeredLyricsOptions {
  movementAxis?: "horizontal";
  range?: number;
  horizontalOffset?: number;
  verticalSpacing?: number;
  travelSpacing?: number;
  topLaneY?: number;
  bottomLaneY?: number;
  frontDepth?: number;
  backNearDepth?: number;
  backFarDepth?: number;
  edgeFeatherStart?: number;
  edgeFadeStart?: number;
  edgeFeatherExponent?: number;
}

export interface CoScrollLayeredLyricItem {
  key: string;
  text: string;
  x: number;
  y: number;
  z: number;
  opacity: number;
  scale: number;
  layer: CoScrollLayeredLyricLayer;
  isCurrent: boolean;
  emphasis?: CoScrollLyricSegment["emphasis"];
  verticalAlign: CoScrollLayerVerticalAlign;
  edgeFeather: number;
  renderOrder: number;
}

export interface CoScrollLayeredLyricsResult {
  front: CoScrollLayeredLyricItem[];
  back: CoScrollLayeredLyricItem[];
}

const SCROLL_AHEAD_MARGIN = 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

function resolveOriginalContinuousIndex(targetAbsoluteIndex: number, currentIndexContinuous: number) {
  return targetAbsoluteIndex - currentIndexContinuous;
}

export function createCoScrollLayeredLyrics({
  lyrics,
  visualTime,
  duration,
  options = {}
}: {
  lyrics: CoScrollLyricSegment[];
  visualTime: number;
  duration: number;
  options?: CoScrollLayeredLyricsOptions;
}): CoScrollLayeredLyricsResult {
  const movementAxis: "horizontal" = options.movementAxis ?? "horizontal";
  const range = Math.max(1, Math.floor(options.range ?? 6));
  const horizontalOffset = options.horizontalOffset ?? 0.72;
  const verticalSpacing = options.verticalSpacing ?? 1.15;
  const travelSpacing = options.travelSpacing ?? verticalSpacing * 0.85;
  const topLaneY = options.topLaneY ?? 2.4;
  const bottomLaneY = options.bottomLaneY ?? -2.25;
  const frontDepth = options.frontDepth ?? 0.78;
  const backNearDepth = options.backNearDepth ?? -1.2;
  const backFarDepth = options.backFarDepth ?? -2.08;
  const edgeFeatherStart = options.edgeFeatherStart ?? 0.62;
  const edgeFadeStart = options.edgeFadeStart ?? 0.84;
  const edgeFeatherExponent = options.edgeFeatherExponent ?? 1.15;
  void movementAxis;
  void horizontalOffset;
  const safeDuration = Math.max(1, duration);
  const normalizedTime = positiveModulo(visualTime, safeDuration);
  const items: CoScrollLayeredLyricItem[] = [];
  const orderedLyrics = lyrics.slice().sort((a, b) => a.start - b.start);
  const totalLines = orderedLyrics.length;

  if (totalLines === 0) {
    return { front: [], back: [] };
  }

  let currentIndex = -1;
  for (let index = 0; index < totalLines; index += 1) {
    if (orderedLyrics[index].start <= normalizedTime) {
      currentIndex = index;
    } else {
      break;
    }
  }
  if (currentIndex < 0) {
    currentIndex = 0;
  }

  const loopCount = Math.floor(visualTime / safeDuration);
  const absoluteCurrentIndex = loopCount * totalLines + currentIndex;
  const currentLine = orderedLyrics[currentIndex];
  const currentTime = currentLine?.start ?? 0;
  let nextIndex = currentIndex + 1;
  let nextLoop = loopCount;
  if (nextIndex >= totalLines) {
    nextIndex = 0;
    nextLoop += 1;
  }

  const nextLine = orderedLyrics[nextIndex];
  const nextTime = nextLoop * safeDuration + (nextLine?.start ?? 0);
  const currentAbsoluteTime = loopCount * safeDuration + currentTime;
  let adjustedTime = loopCount * safeDuration + normalizedTime;
  if (adjustedTime < currentAbsoluteTime && nextLoop > loopCount) {
    adjustedTime += safeDuration;
  }

  let progressToNext = 0;
  if (nextTime > currentAbsoluteTime) {
    progressToNext = (adjustedTime - currentAbsoluteTime) / (nextTime - currentAbsoluteTime);
  }
  const progressWithLead = clamp(progressToNext + SCROLL_AHEAD_MARGIN, 0, 0.999);
  const currentIndexContinuous = absoluteCurrentIndex + progressWithLead;
  const travelStep = Math.max(0.01, travelSpacing);

  for (let offset = -range; offset <= range; offset += 1) {
    const targetAbsoluteIndex = absoluteCurrentIndex + offset;
    const wrappedIndex = positiveModulo(targetAbsoluteIndex, totalLines);
    const line = orderedLyrics[wrappedIndex];
    const text = line.text.trim();
    if (!text) {
      continue;
    }

    const relativeOffset = resolveOriginalContinuousIndex(targetAbsoluteIndex, currentIndexContinuous);
    const clampedOffset = clamp(relativeOffset, -range, range);
    const travelLimit = range * travelStep;
    const travelOffset = clamp(clampedOffset * travelStep, -travelLimit, travelLimit);
    const distanceRatio = travelLimit > 0 ? Math.abs(travelOffset) / travelLimit : 0;
    const isTopLane = wrappedIndex % 2 === 0;
    const patternIndex = wrappedIndex % 3;
    const isCurrent = targetAbsoluteIndex === absoluteCurrentIndex;

    let layer: CoScrollLayeredLyricLayer;
    let z: number;
    if (patternIndex === 0) {
      layer = "back-far";
      z = backFarDepth;
    } else if (patternIndex === 1) {
      layer = "front";
      z = frontDepth - 0.45;
    } else {
      layer = "front";
      z = frontDepth;
    }

    let opacity = 1;
    let edgeFeather = 0;
    if (distanceRatio >= edgeFeatherStart) {
      const denom = Math.max(1 - edgeFeatherStart, 0.001);
      const featherNorm = clamp((distanceRatio - edgeFeatherStart) / denom, 0, 1);
      edgeFeather = Math.pow(featherNorm, Math.max(0.1, edgeFeatherExponent));
    }
    if (distanceRatio >= edgeFadeStart) {
      const denom = Math.max(1 - edgeFadeStart, 0.001);
      const fadeNorm = clamp((distanceRatio - edgeFadeStart) / denom, 0, 1);
      const eased = fadeNorm * fadeNorm * (3 - 2 * fadeNorm);
      opacity = Math.max(0, 1 - eased);
    }

    const scale = 1;
    const verticalAlign: CoScrollLayerVerticalAlign = isTopLane ? "top" : "bottom";
    const y = isTopLane ? topLaneY : bottomLaneY;
    const renderOrder =
      layer === "front"
        ? 3300 + (isTopLane ? 120 : 80) + wrappedIndex
        : 2100 + wrappedIndex;

    items.push({
      key: `${line.id}-${targetAbsoluteIndex}`,
      text,
      x: travelOffset,
      y,
      z,
      opacity,
      scale,
      layer,
      isCurrent,
      emphasis: line.emphasis,
      verticalAlign,
      edgeFeather,
      renderOrder
    });
  }

  return {
    front: items.filter((item) => item.layer === "front").sort((a, b) => a.x - b.x),
    back: items.filter((item) => item.layer !== "front").sort((a, b) => a.x - b.x)
  };
}
