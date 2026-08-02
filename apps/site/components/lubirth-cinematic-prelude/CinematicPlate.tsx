"use client";

import type { RefCallback } from "react";
import type { CinematicPreludeVariant } from "../../content/lubirthCinematicPreludeManifest";
import type { PreludeSnapshot } from "./types";
import styles from "../LuBirthCinematicPreludeRoute.module.css";

export interface PreludeCompositionOffset {
  x: number;
  y: number;
  scale?: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function CinematicPlate({
  composition,
  setVideoElement,
  snapshot,
  variant
}: {
  composition: PreludeCompositionOffset;
  setVideoElement: RefCallback<HTMLVideoElement>;
  snapshot: PreludeSnapshot;
  variant: CinematicPreludeVariant;
}) {
  const normalizedX = clamp(composition.x, -1, 1);
  const normalizedY = clamp(composition.y, -1, 1);
  const compositionScale = clamp(composition.scale ?? 1, 0.99, 1.01);
  const translateX = normalizedX * variant.maxNormalizedTranslation.x * 100;
  const translateY = normalizedY * variant.maxNormalizedTranslation.y * 100;
  const scale = variant.runtimeOverscanScale * compositionScale;
  const plateVisible = snapshot.source === "plate";

  return (
    <div
      aria-hidden="true"
      className={styles.plate}
      data-active-source={snapshot.source}
      data-cinematic-plate
      data-visible={plateVisible ? "true" : "false"}
      style={{ visibility: plateVisible ? "visible" : "hidden" }}
    >
      <video
        className={styles.plateMedia}
        data-cinematic-prelude-media
        data-tier={variant.tier}
        muted
        playsInline
        preload="auto"
        ref={setVideoElement}
        style={{
          transform: `translate3d(${translateX}%, ${translateY}%, 0) scale(${scale})`
        }}
      />
    </div>
  );
}
