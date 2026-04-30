"use client";

import { LuBirthLookdevSceneSlot, type LuBirthLookdevPass } from "../visual/scenes/LuBirthLookdevSceneSlot";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";

interface LuBirthLookdevRouteProps {
  pass: LuBirthLookdevPass;
}

function isScreenshotMode() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("visualTest") === "pixels";
}

export function LuBirthLookdevRoute({ pass }: LuBirthLookdevRouteProps) {
  return (
    <main
      className="lubirth-lookdev"
      data-lookdev-pass={pass}
      aria-label={`LuBirth ${pass} lookdev`}
      style={{ minHeight: "100svh", background: "#000307" }}
    >
      <VisualCanvas
        decorative
        fallback={
          <VisualCanvasFallback
            scene="lubirth"
            label={`LuBirth ${pass} lookdev fallback`}
            posterSrc="/assets/lubirth/poster-field.webp"
          />
        }
      >
        <LuBirthLookdevSceneSlot
          pass={pass}
          quality={isScreenshotMode() ? "high" : "auto"}
          paused={isScreenshotMode()}
        />
      </VisualCanvas>
    </main>
  );
}
