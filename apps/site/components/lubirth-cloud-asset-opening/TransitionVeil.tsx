"use client";

import { openingCloudManifest } from "../../content/lubirthOpeningCloudManifest";
import type { OpeningCloudSnapshot } from "./types";
import styles from "../LuBirthCloudAssetOpeningRoute.module.css";

export function TransitionVeil({ snapshot }: { snapshot: OpeningCloudSnapshot }) {
  return (
    <div
      aria-hidden="true"
      className={styles.transitionVeil}
      data-layer-above="cloud canvas"
      data-transition-veil
      data-veil-phase={snapshot.state}
      style={{
        backgroundColor: openingCloudManifest.handoff.veilColorSrgb,
        opacity: snapshot.veilOpacity,
        visibility: snapshot.veilOpacity > 0 ? "visible" : "hidden"
      }}
    />
  );
}
