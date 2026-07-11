"use client";

import type { EarthMoonHeroMode } from "@miralith/lubirth-hero";
import { CoScrollSceneSlot } from "./CoScrollSceneSlot";
import { LuBirthSceneSlot } from "./LuBirthSceneSlot";

export type HomeVisualScene = "lubirth" | "coscroll";

interface HomeVisualSceneSlotProps {
  scene: HomeVisualScene;
  debugMianyang?: boolean;
  lubirthMode?: EarthMoonHeroMode;
  coscrollProgress?: number;
  coscrollActive?: boolean;
  paused?: boolean;
}

export function HomeVisualSceneSlot({
  scene,
  debugMianyang = false,
  lubirthMode = "field",
  coscrollProgress = 0,
  coscrollActive = false,
  paused = false
}: HomeVisualSceneSlotProps) {
  if (scene === "coscroll") {
    return <CoScrollSceneSlot progress={coscrollProgress} active={coscrollActive} paused={paused} />;
  }

  return <LuBirthSceneSlot mode={lubirthMode} debugMianyang={debugMianyang} paused={paused} />;
}
