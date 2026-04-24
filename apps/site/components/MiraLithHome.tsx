"use client";

import { useEffect, useRef, useState } from "react";
import { createScrollProgressDriver } from "@miralith/visual-core";
import type { EarthMoonHeroMode } from "@miralith/lubirth-hero";
import { LuBirthExpandedView } from "./LuBirthExpandedView";
import { LuBirthWindow } from "./LuBirthWindow";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

export function MiraLithHome() {
  const [windowHovered, setWindowHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sectionProgress, setSectionProgress] = useState(0);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const baseMode: EarthMoonHeroMode = sectionProgress > 0.55 ? "window" : "field";
  const mode: EarthMoonHeroMode = expanded ? "expanded" : windowHovered ? "zoomed" : baseMode;

  useEffect(() => {
    const driver = createScrollProgressDriver({
      startRatio: 0,
      endRatio: 1.15,
      onProgress: (progress) => {
        window.__MiraLithOpeningProgress = progress;
        setSectionProgress(progress);
      }
    });

    return () => driver.destroy();
  }, []);

  return (
    <main className="site-shell" aria-label="MiraLith interface frame">
      <VisualCanvas
        decorative
        fallback={
          <VisualCanvasFallback
            scene="lubirth"
            label="LuBirth earth and moon field"
            posterSrc="/assets/lubirth/poster-field.webp"
          />
        }
      >
        <LuBirthSceneSlot mode={mode} />
      </VisualCanvas>

      <section
        className="opening-screen"
        id="opening"
        data-screen-label="01 Opening"
        aria-label="Opening frame"
      >
        <div className="opening-screen__copy">
          <p>MiraLith</p>
          <h1>把看见之物，刻成作品。</h1>
          <p>A personal field of vision, intelligence, and form.</p>
        </div>
      </section>

      <section className="window-screen" aria-label="Project window frame">
        <LuBirthWindow
          onHoverChange={setWindowHovered}
          onExpand={() => setExpanded(true)}
          expandButtonRef={expandButtonRef}
        />
      </section>

      <LuBirthExpandedView
        open={expanded}
        onClose={() => setExpanded(false)}
        returnFocusRef={expandButtonRef}
      />
    </main>
  );
}
