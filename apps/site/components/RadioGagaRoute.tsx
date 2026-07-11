"use client";

import { useRef } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { RadioGagaSceneSlot } from "../visual/scenes/RadioGagaSceneSlot";
import { RadioGagaExperience } from "./RadioGagaExperience";

interface RadioGagaRouteProps {
  initialForcedVisualFallback?: boolean;
}

export function RadioGagaRoute({ initialForcedVisualFallback = false }: RadioGagaRouteProps) {
  const progressRef = useRef(0);

  return (
    <RadioGagaExperience
      host="standalone"
      initialForcedVisualFallback={initialForcedVisualFallback}
      progressRef={progressRef}
      renderVisual={({ active, assetState, fallback, progressRef: visualProgressRef }) => (
        <VisualCanvas decorative fallback={fallback}>
          <RadioGagaSceneSlot
            active={active && assetState === "ready"}
            progressRef={visualProgressRef}
          />
        </VisualCanvas>
      )}
    />
  );
}
