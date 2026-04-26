"use client";

import type { RefObject } from "react";

interface LuBirthWindowProps {
  onHoverChange: (hovered: boolean) => void;
  onExpand: () => void;
  expandButtonRef: RefObject<HTMLButtonElement | null>;
}

export function LuBirthWindow({ onHoverChange, onExpand, expandButtonRef }: LuBirthWindowProps) {
  return (
    <article
      className="project-window"
      data-screen-label="02 Project Window"
      id="lubirth"
      aria-label="Project frame"
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
    >
      <button
        ref={expandButtonRef}
        className="project-window__preview"
        type="button"
        aria-label="Open LuBirth expanded view"
        onClick={onExpand}
      >
        <span className="project-window__preview-frame" aria-hidden="true" />
        <span className="project-window__preview-copy">
          <span>LuBirth Field</span>
          <span>Moon / Earth / You</span>
        </span>
      </button>
      <div className="project-window__meta">
        <p>02 Project Window</p>
        <h2>LuBirth 地月人</h2>
        <p>A cosmological interface for birth, time, and self-recognition.</p>
        <button className="project-window__meta-action" type="button" onClick={onExpand}>
          进入地月场
        </button>
      </div>
    </article>
  );
}
