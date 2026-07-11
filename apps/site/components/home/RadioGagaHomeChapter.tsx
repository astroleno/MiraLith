"use client";

import {
  RadioGagaExperience,
  type RadioGagaChapterPresence
} from "../RadioGagaExperience";

interface RadioGagaHomeChapterProps {
  enabled: boolean;
  progressRef: { current: number };
  onPresenceChange: (presence: RadioGagaChapterPresence) => void;
}

export function RadioGagaHomeChapter({
  enabled,
  progressRef,
  onPresenceChange
}: RadioGagaHomeChapterProps) {
  return (
    <section data-home-chapter="radio-gaga" id="radio-gaga">
      {enabled ? (
        <RadioGagaExperience
          host="home"
          progressRef={progressRef}
          onPresenceChange={onPresenceChange}
        />
      ) : null}
    </section>
  );
}
