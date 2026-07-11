"use client";

import type { LuBirthVisualSlotProps } from "../../components/LuBirthRevisedRoute";
import type { HomeChapterRuntime } from "../../components/home/homeChapterTypes";
import { LuBirthSceneSlot } from "./LuBirthSceneSlot";
import { RadioGagaSceneSlot } from "./RadioGagaSceneSlot";

interface HomeVisualSceneSlotProps {
  activeScene: "lubirth" | "radio-gaga";
  lubirth: LuBirthVisualSlotProps;
  radio: HomeChapterRuntime;
  radioMounted: boolean;
}

export function HomeVisualSceneSlot({
  activeScene,
  lubirth,
  radio,
  radioMounted
}: HomeVisualSceneSlotProps) {
  if (activeScene === "radio-gaga" && radioMounted) {
    return (
      <RadioGagaSceneSlot
        active={radio.active}
        progressRef={radio.progressRef}
      />
    );
  }

  return <LuBirthSceneSlot {...lubirth} />;
}
