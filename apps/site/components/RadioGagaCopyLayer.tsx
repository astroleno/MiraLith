"use client";

import { radioGagaFinalOutputs } from "@miralith/radio-gaga-scene";
import {
  radioGagaBroadcastStages,
  radioGagaCopy,
  radioGagaSiteChapters
} from "../content/radioGaga";

function RadioGagaTitleRail() {
  const activeIndex = Math.max(0, radioGagaSiteChapters.findIndex((chapter) => chapter.active));
  const activeChapter = radioGagaSiteChapters[activeIndex] ?? radioGagaSiteChapters[0];
  const visibleChapters = radioGagaSiteChapters.filter((_, index) => Math.abs(index - activeIndex) <= 1);

  return (
    <>
      <aside className="radio-gaga-title-rail">
        <ol>
          {visibleChapters.map((chapter) => (
            <li key={chapter.index} data-active={chapter.active ? "true" : "false"}>
              <span className="radio-gaga-title-rail__item">
                <span className="radio-gaga-title-rail__index">{chapter.index}</span>
                <span className="radio-gaga-title-rail__copy">
                  <span className="radio-gaga-title-rail__title">{chapter.title}</span>
                  <span className="radio-gaga-title-rail__meta">
                    {chapter.zh} / <span>{chapter.en}</span>
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      </aside>
      <div className="radio-gaga-mobile-title-bar">
        <span className="radio-gaga-mobile-title-bar__main">
          <span>{activeChapter.index}</span>
          <span className="radio-gaga-mobile-title-bar__title">{activeChapter.title}</span>
        </span>
        <span className="radio-gaga-mobile-title-bar__label">{activeChapter.zh}</span>
      </div>
    </>
  );
}

interface RadioGagaCopyLayerProps {
  activeFinalOutputIndex: number;
  activeFinalOutputComplete: boolean;
  activeFinalOutputText: string;
}

function RadioGagaBroadcastTuner({
  activeFinalOutputComplete,
  activeFinalOutputIndex,
  activeFinalOutputText
}: RadioGagaCopyLayerProps) {
  const activeOutput = activeFinalOutputIndex >= 0
    ? radioGagaFinalOutputs[activeFinalOutputIndex]
    : null;

  return (
    <aside className="radio-gaga-broadcast-tuner" aria-label="radioGAGA broadcast progress">
      <div className="radio-gaga-broadcast-tuner__masthead">
        <span className="radio-gaga-broadcast-tuner__station">care band · local 88.5</span>
        <div className="radio-gaga-broadcast-tuner__stage-stack">
          {radioGagaBroadcastStages.map((stage, index) => (
            <div data-radio-gaga-stage={index + 1} key={stage.count}>
              <span>{stage.count}</span>
              <strong>{stage.stageEn}</strong>
              <em>{stage.stageZh}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="radio-gaga-broadcast-tuner__scale">
        <span className="radio-gaga-broadcast-tuner__scan" />
        {radioGagaBroadcastStages.map((stage, index) => (
          <div
            className="radio-gaga-broadcast-tuner__step"
            data-radio-gaga-step={index + 1}
            key={stage.stepEn}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>
              <strong>{stage.stepEn}</strong>
              <em>{stage.stepZh}</em>
            </span>
          </div>
        ))}
      </div>

      <div className="radio-gaga-broadcast-tuner__readout">
        {radioGagaBroadcastStages.map((stage, index) => (
          <div data-radio-gaga-readout={index + 1} key={stage.readoutTitle}>
            {index === 4 && activeOutput ? (
              <>
                <span className="radio-gaga-broadcast-tuner__kicker">{activeOutput.source}</span>
                <strong className="radio-gaga-broadcast-tuner__output">{activeFinalOutputText}</strong>
                <span
                  className="radio-gaga-broadcast-tuner__translation"
                  data-complete={activeFinalOutputComplete ? "true" : "false"}
                >
                  {activeOutput.en}
                </span>
              </>
            ) : (
              <>
                <span className="radio-gaga-broadcast-tuner__kicker">{stage.readoutKicker}</span>
                <strong>{stage.readoutTitle}</strong>
                <span>{stage.readoutDetail}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function RadioGagaCopyLayer({
  activeFinalOutputIndex,
  activeFinalOutputComplete,
  activeFinalOutputText
}: RadioGagaCopyLayerProps) {
  return (
    <div className="radio-gaga-copy" aria-hidden="true">
      <RadioGagaTitleRail />
      <div className="radio-gaga-copy__panel">
        <p className="radio-gaga-copy__eyebrow">{radioGagaCopy.eyebrow}</p>
        <h1>{radioGagaCopy.title}</h1>
        <p>{radioGagaCopy.subtitleEn}</p>
        <p>{radioGagaCopy.subtitleZh}</p>
      </div>
      <div className="radio-gaga-copy__reading">
        <div className="radio-gaga-copy__voice">
          <p>{radioGagaCopy.voiceEn.join(" ")}</p>
          <p>{radioGagaCopy.voiceZh.join("")}</p>
        </div>
      </div>
      <div className="radio-gaga-copy__memory">
        <p>{radioGagaCopy.memoryEn.join(" ")}</p>
        <p>{radioGagaCopy.memoryZh.join("")}</p>
      </div>
      <RadioGagaBroadcastTuner
        activeFinalOutputComplete={activeFinalOutputComplete}
        activeFinalOutputIndex={activeFinalOutputIndex}
        activeFinalOutputText={activeFinalOutputText}
      />
      <div className="radio-gaga-copy__final">
        <p>{radioGagaCopy.finalEn}</p>
        <p>{radioGagaCopy.finalZh}</p>
      </div>
    </div>
  );
}
