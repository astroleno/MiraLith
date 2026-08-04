"use client";

import { openingGlobeCloudManifest } from "../../content/lubirthOpeningGlobeCloudManifest";
import type { OpeningCloudSnapshot } from "./types";
import styles from "../LuBirthCloudAssetOpeningRoute.module.css";

export function TransitionVeil({ snapshot }: { snapshot: OpeningCloudSnapshot }) {
  return (
    <div
      aria-hidden="true"
      className={styles.transitionVeil}
      data-layer-above="earth canvas and globe cloud shell"
      data-transition-veil
      data-veil-phase={snapshot.state}
      style={{
        backgroundColor: openingGlobeCloudManifest.handoff.veilColorSrgb,
        opacity: snapshot.veilOpacity,
        visibility: snapshot.veilOpacity > 0 ? "visible" : "hidden"
      }}
    />
  );
}
