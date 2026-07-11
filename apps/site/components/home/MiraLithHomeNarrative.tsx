"use client";

import { useCallback, useRef, useState } from "react";
import { HomeVisualSceneSlot } from "../../visual/scenes/HomeVisualSceneSlot";
import { LuBirthRevisedRoute, type LuBirthVisualSlotProps } from "../LuBirthRevisedRoute";
import type { RadioGagaChapterPresence } from "../RadioGagaExperience";
import { RadioGagaHomeChapter } from "./RadioGagaHomeChapter";

export function MiraLithHomeNarrative() {
  const radioProgressRef = useRef(0);
  const [homeIntroComplete, setHomeIntroComplete] = useState(false);
  const [radioPresence, setRadioPresence] = useState<RadioGagaChapterPresence>({
    near: false,
    active: false
  });
  const activeScene = radioPresence.active ? "radio-gaga" : "lubirth";
  const renderVisualSlot = useCallback((lubirth: LuBirthVisualSlotProps) => (
    <HomeVisualSceneSlot
      activeScene={activeScene}
      lubirth={lubirth}
      radio={{
        id: "radio-gaga",
        ...radioPresence,
        progressRef: radioProgressRef
      }}
      radioMounted={radioPresence.near}
    />
  ), [activeScene, radioPresence]);

  return (
    <>
      <LuBirthRevisedRoute
        variant="home"
        activeChapterId={activeScene}
        onHomeIntroCompleteChange={setHomeIntroComplete}
        renderVisualSlot={renderVisualSlot}
      />
      <RadioGagaHomeChapter
        enabled={homeIntroComplete}
        progressRef={radioProgressRef}
        onPresenceChange={setRadioPresence}
      />
    </>
  );
}
