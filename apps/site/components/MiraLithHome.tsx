import { LuBirthWindow } from "./LuBirthWindow";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

export function MiraLithHome() {
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
        <LuBirthSceneSlot mode="field" />
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
        <LuBirthWindow />
      </section>
    </main>
  );
}
