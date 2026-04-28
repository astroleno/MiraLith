"use client";

import { useEffect, useRef, useState } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { RadioGagaSceneSlot } from "../visual/scenes/RadioGagaSceneSlot";
import { RadioGagaCopyLayer } from "./RadioGagaCopyLayer";

export function RadioGagaRoute() {
  const routeRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);

      if (disposed || !routeRef.current) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.getById("miralith-radio-gaga-route")?.kill();

      const scrollTrigger = ScrollTrigger.create({
        id: "miralith-radio-gaga-route",
        trigger: routeRef.current,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 3.4)}`,
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: (self) => setProgress(self.progress),
        onUpdate: (self) => setProgress(self.progress)
      });

      cleanup = () => scrollTrigger.kill();
      ScrollTrigger.refresh();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <main ref={routeRef} className="radio-gaga-route" aria-label="radioGAGA care radio scene">
      <VisualCanvas
        decorative
        fallback={
          <VisualCanvasFallback scene="radio-gaga" label="radioGAGA care radio fallback">
            <div className="radio-gaga-fallback-copy">
              <p>02 - Care</p>
              <h1>radioGAGA</h1>
              <p>A small machine for staying close.</p>
              <p>一台让距离变近的小机器。</p>
            </div>
          </VisualCanvasFallback>
        }
      >
        <RadioGagaSceneSlot progress={progress} active />
      </VisualCanvas>
      <RadioGagaCopyLayer progress={progress} />
      <div className="sr-only">
        02 - Care. radioGAGA. A radio of local news, family memory, and my own voice.
        I filter local news through my own perspective, then let it return home in my voice.
        It translates the news into a daily language my parents can hold.
        Inside, a small core of care. ESP32 is only the path that lets a voice arrive.
        A small machine for staying close.
      </div>
    </main>
  );
}
