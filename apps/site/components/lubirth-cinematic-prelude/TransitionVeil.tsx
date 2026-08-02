"use client";

import type { CinematicPreludeManifest } from "../../content/lubirthCinematicPreludeManifest";
import type { PreludeSnapshot } from "./types";
import styles from "../LuBirthCinematicPreludeRoute.module.css";

export function TransitionVeil({
  manifest,
  snapshot
}: {
  manifest: CinematicPreludeManifest;
  snapshot: PreludeSnapshot;
}) {
  const profile = manifest.handoff.veilProfile;

  return (
    <div
      aria-hidden="true"
      className={styles.veil}
      data-layer-above="plate canvas"
      data-transition-veil
      data-veil-phase={snapshot.state}
      style={{
        backgroundColor: profile.colorSrgb,
        opacity: snapshot.veilOpacity,
        visibility: snapshot.veilOpacity > 0 ? "visible" : "hidden"
      }}
    />
  );
}
