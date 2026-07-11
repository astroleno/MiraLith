"use client";

import { lazy, useEffect } from "react";
import type { LuBirthVisualSlotProps } from "../../components/LuBirthRevisedRoute";
import type { HomeChapterRuntime } from "../../components/home/homeChapterTypes";
import { LuBirthSceneSlot } from "./LuBirthSceneSlot";

const loadRadioGagaSceneSlot = () => import("./RadioGagaSceneSlot");
const LazyRadioGagaSceneSlot = lazy(async () => {
  const sceneModule = await loadRadioGagaSceneSlot();
  return { default: sceneModule.RadioGagaSceneSlot };
});

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
  useEffect(() => {
    if (!radioMounted) {
      return;
    }

    void loadRadioGagaSceneSlot()
      .then(({ preloadRadioGagaSceneAssets }) => {
        preloadRadioGagaSceneAssets();
      })
      .catch(() => undefined);
  }, [radioMounted]);

  if (activeScene === "radio-gaga" && radioMounted) {
    return (
      <LazyRadioGagaSceneSlot
        active={radio.active}
        progressRef={radio.progressRef}
      />
    );
  }

  return <LuBirthSceneSlot {...lubirth} />;
}
