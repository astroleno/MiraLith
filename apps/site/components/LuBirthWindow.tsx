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
      />
      <div className="project-window__meta">
        <p>LuBirth 地月人</p>
        <p>A cosmological interface for birth, time, and self-recognition.</p>
      </div>
    </article>
  );
}
