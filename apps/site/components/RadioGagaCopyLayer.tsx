"use client";

import { radioGagaFinalOutputs } from "@miralith/radio-gaga-scene";
import {
  radioGagaCopy,
  radioGagaProofFrames,
  radioGagaProcessSteps,
  radioGagaSiteChapters,
  radioGagaStages
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
  activeFinalOutputText: string;
  visibleFinalOutputCount: number;
}

export function RadioGagaCopyLayer({
  activeFinalOutputIndex,
  activeFinalOutputText,
  visibleFinalOutputCount
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
      <div className="radio-gaga-copy__panel radio-gaga-copy__voice">
        <p>{radioGagaCopy.voiceEn.join(" ")}</p>
        <p>{radioGagaCopy.voiceZh.join("")}</p>
      </div>
      <div className="radio-gaga-copy__intro">
        <p>{radioGagaCopy.introEn.join(" ")}</p>
        <p>{radioGagaCopy.introZh.join("")}</p>
      </div>
      <div className="radio-gaga-copy__memory">
        <p>{radioGagaCopy.memoryEn.join(" ")}</p>
        <p>{radioGagaCopy.memoryZh.join("")}</p>
      </div>
      <div className="radio-gaga-proof-strip">
        {radioGagaProofFrames.map((proof, index) => (
          <figure className="radio-gaga-proof-strip__item" data-radio-gaga-proof={index + 1} key={proof.title}>
            <figcaption>
              <strong>{proof.title}</strong>
              <span>{proof.detail}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="radio-gaga-step-marker">
        <p>Now</p>
        {radioGagaStages.map((stage, index) => (
          <div className="radio-gaga-step-marker__stage" data-radio-gaga-stage={index + 1} key={stage.count}>
            <span>{stage.count}</span>
            <strong>{stage.en}</strong>
            <em>{stage.zh}</em>
          </div>
        ))}
      </div>
      <div className="radio-gaga-instrument">
        <div className="radio-gaga-instrument__scale">
          {radioGagaProcessSteps.map((step, index) => (
            <div className="radio-gaga-instrument__step" data-radio-gaga-dial={index + 1} key={step.en}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.en}</strong>
              <em>{step.zh}</em>
            </div>
          ))}
        </div>
      </div>
      <div className="radio-gaga-copy__core">
        <p className="radio-gaga-copy__core-title">{radioGagaCopy.coreTitleEn}</p>
        <p className="radio-gaga-copy__core-title-zh">{radioGagaCopy.coreTitleZh}</p>
        <div className="radio-gaga-copy__core-note">
          <p>{radioGagaCopy.coreBodyEn.join(" ")}</p>
          <p>{radioGagaCopy.coreBodyZh.join("")}</p>
        </div>
      </div>
      <div className="radio-gaga-copy__final">
        <p>{radioGagaCopy.finalEn}</p>
        <p>{radioGagaCopy.finalZh}</p>
      </div>
      <div className="radio-gaga-final-dialog">
        {radioGagaFinalOutputs.map((output, index) => (
          <div
            className="radio-gaga-final-dialog__item"
            data-active={index === activeFinalOutputIndex ? "true" : "false"}
            data-visible={index < visibleFinalOutputCount ? "true" : "false"}
            key={output.zh}
          >
            <span className="radio-gaga-final-dialog__source">{output.source}</span>
            <strong>{index === activeFinalOutputIndex ? activeFinalOutputText || output.zh : output.zh}</strong>
            <span>{output.en}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
