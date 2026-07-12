"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

function subscribeDebugQuery(_onStoreChange: () => void) {
  return () => undefined;
}

function getDebugQuerySnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("lubirthDebug") === "mianyang";
}

export function MiraLithHome() {
  const shellRef = useRef<HTMLElement>(null);
  const debugMianyang = useSyncExternalStore(subscribeDebugQuery, getDebugQuerySnapshot, () => false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const setProgress = (progress: number) => {
      const nextProgress = Math.min(1, Math.max(0, progress));
      window.__MiraLithOpeningProgress = nextProgress;
    };

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);

      if (disposed || !shellRef.current) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.getById("miralith-lubirth-opening")?.kill();
      setProgress(0);

      const scrollTrigger = ScrollTrigger.create({
        id: "miralith-lubirth-opening",
        trigger: shellRef.current,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 1.15)}`,
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: (self) => setProgress(self.progress),
        onUpdate: (self) => setProgress(self.progress)
      });

      cleanup = () => {
        scrollTrigger.kill();
      };

      ScrollTrigger.refresh();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <main ref={shellRef} className="site-shell site-shell--lubirth" aria-label="LuBirth near-earth pullback scene">
      <VisualCanvas
        decorative
        fallback={
          <VisualCanvasFallback
            scene="lubirth"
            label="LuBirth near-earth arc and moon field"
            posterSrc="/assets/lubirth/poster-field.webp"
          />
        }
      >
        <LuBirthSceneSlot mode="field" debugMianyang={debugMianyang} />
      </VisualCanvas>

      {debugMianyang ? (
        <div className="lubirth-debug-target" aria-hidden="true">
          <span>1029, 941</span>
        </div>
      ) : null}

      <section className="lubirth-scroll-stage" aria-label="LuBirth near-earth phase">
        <span className="sr-only">Phase one: near-earth daylight arc over Mianyang.</span>
      </section>

      <section className="lubirth-scroll-stage" aria-label="LuBirth pullback phase">
        <span className="sr-only">Phase two: pull back to the full moon and earth field.</span>
      </section>
    </main>
  );
}
