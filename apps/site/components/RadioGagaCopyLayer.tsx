"use client";

import { mapRadioGagaProgress } from "@miralith/radio-gaga-scene";
import {
  radioGagaCopy,
  radioGagaFloatingWords,
  radioGagaMemoryFragments
} from "../content/radioGaga";

interface RadioGagaCopyLayerProps {
  progress: number;
}

const floatingWordSlots = [
  { x: "58vw", y: "28vh", delay: 0 },
  { x: "66vw", y: "40vh", delay: 0.12 },
  { x: "60vw", y: "56vh", delay: 0.24 },
  { x: "72vw", y: "62vh", delay: 0.36 }
];

export function RadioGagaCopyLayer({ progress }: RadioGagaCopyLayerProps) {
  const frame = mapRadioGagaProgress(progress);

  return (
    <div className="radio-gaga-copy" aria-hidden="true">
      <div className="radio-gaga-copy__panel" style={{ opacity: Math.max(frame.titleOpacity, frame.bodyOpacity) }}>
        <p className="radio-gaga-copy__eyebrow">{radioGagaCopy.eyebrow}</p>
        <h1>{radioGagaCopy.title}</h1>
        <p>{radioGagaCopy.subtitleEn}</p>
        <p>{radioGagaCopy.subtitleZh}</p>
      </div>
      <div className="radio-gaga-copy__panel radio-gaga-copy__voice" style={{ opacity: frame.bodyOpacity }}>
        <p>{radioGagaCopy.voiceEn.join(" ")}</p>
        <p>{radioGagaCopy.voiceZh.join("")}</p>
      </div>
      <div className="radio-gaga-copy__core" style={{ opacity: frame.calloutOpacity }}>
        <p className="radio-gaga-copy__eyebrow">{radioGagaCopy.coreTitleEn}</p>
        <p>{radioGagaCopy.coreTitleZh}</p>
        <p>{radioGagaCopy.coreBodyEn.join(" ")}</p>
        <p>{radioGagaCopy.coreBodyZh.join("")}</p>
      </div>
      <div className="radio-gaga-copy__final" style={{ opacity: frame.finalLineOpacity }}>
        <p>{radioGagaCopy.finalEn}</p>
        <p>{radioGagaCopy.finalZh}</p>
      </div>
      <div className="radio-gaga-copy__floating" style={{ opacity: frame.voiceLinesOpacity }}>
        {radioGagaFloatingWords.map((word, index) => (
          <span
            key={word.en}
            data-floating-index={index}
            style={{
              left: floatingWordSlots[index].x,
              top: floatingWordSlots[index].y,
              transitionDelay: `${floatingWordSlots[index].delay}s`
            }}
          >
            {word.en} / {word.zh}
          </span>
        ))}
      </div>
      <div className="radio-gaga-copy__fragments" style={{ opacity: frame.memoryLayerOpacity }}>
        {radioGagaMemoryFragments.map((fragment, index) => (
          <span key={fragment} data-fragment-index={index}>
            {fragment}
          </span>
        ))}
      </div>
    </div>
  );
}
