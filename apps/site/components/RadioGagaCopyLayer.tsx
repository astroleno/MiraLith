"use client";

import { radioGagaCopy, radioGagaProcessSteps, radioGagaStages } from "../content/radioGaga";

export function RadioGagaCopyLayer() {
  return (
    <div className="radio-gaga-copy" aria-hidden="true">
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
      <div className="radio-gaga-copy__memory">
        <p>{radioGagaCopy.memoryEn.join(" ")}</p>
        <p>{radioGagaCopy.memoryZh.join("")}</p>
      </div>
      <div className="radio-gaga-step-marker">
        <p>02 — Care</p>
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
        <div className="radio-gaga-instrument__broadcast">
          <strong>{radioGagaCopy.homeLineZh}</strong>
          <span>{radioGagaCopy.homeLineEn}</span>
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
    </div>
  );
}
