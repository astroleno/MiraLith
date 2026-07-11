"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import type { LandingCloseAtmosphereTuning } from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

interface CloseAtmosphereSpikeConfig {
  copyHidden: boolean;
  fixedProgress: number;
  live: boolean;
  quality: LandingQuality;
  tuning: LandingCloseAtmosphereTuning;
}

const DEFAULT_TUNING: LandingCloseAtmosphereTuning = {
  edgeGlowStrength: 1,
  verticalGradientStrength: 1,
  depthShadowStrength: 1,
  groundProjectionStrength: 1,
  cloudVolumeShadowStrength: 1
};

const DEFAULT_CONFIG: CloseAtmosphereSpikeConfig = {
  copyHidden: true,
  fixedProgress: 0,
  live: false,
  quality: "high",
  tuning: DEFAULT_TUNING
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function readScalar(params: URLSearchParams, key: string, fallback: number) {
  const value = Number.parseFloat(params.get(key) ?? "");
  return Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : fallback;
}

function readQuality(params: URLSearchParams): LandingQuality {
  const quality = params.get("quality");
  return quality === "auto" || quality === "high" || quality === "medium" || quality === "low"
    ? quality
    : "high";
}

function readConfig(): CloseAtmosphereSpikeConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  const progress = Number.parseFloat(params.get("progress") ?? "0");
  const copy = params.get("copy");

  return {
    copyHidden: copy === "visible" ? false : true,
    fixedProgress: Number.isFinite(progress) ? clamp01(progress) : 0,
    live: params.get("live") === "1",
    quality: readQuality(params),
    tuning: {
      edgeGlowStrength: readScalar(params, "edge", DEFAULT_TUNING.edgeGlowStrength),
      verticalGradientStrength: readScalar(params, "gradient", DEFAULT_TUNING.verticalGradientStrength),
      depthShadowStrength: readScalar(params, "depth", DEFAULT_TUNING.depthShadowStrength),
      groundProjectionStrength: readScalar(params, "projection", DEFAULT_TUNING.groundProjectionStrength),
      cloudVolumeShadowStrength: readScalar(params, "cloudDepth", DEFAULT_TUNING.cloudVolumeShadowStrength)
    }
  };
}

export function LuBirthCloseAtmosphereSpikeRoute() {
  const [config] = useState<CloseAtmosphereSpikeConfig>(() => readConfig());

  useLayoutEffect(() => {
    window.__MiraLithOpeningProgress = config.fixedProgress;
  }, [config.fixedProgress]);

  const label = useMemo(
    () => `LuBirth close atmosphere spike ${config.fixedProgress.toFixed(2)}`,
    [config.fixedProgress]
  );

  return (
    <main
      className="lubirth-close-atmo-spike"
      data-copy={config.copyHidden ? "hidden" : "visible"}
      data-progress={config.fixedProgress}
      data-quality={config.quality}
      data-edge={config.tuning.edgeGlowStrength}
      data-gradient={config.tuning.verticalGradientStrength}
      data-depth={config.tuning.depthShadowStrength}
      data-projection={config.tuning.groundProjectionStrength}
      data-cloud-depth={config.tuning.cloudVolumeShadowStrength}
      aria-label={label}
      style={{ minHeight: "100svh", overflow: "hidden", background: "#000102" }}
    >
      {!config.copyHidden ? (
        <div className="lubirth-close-atmo-spike__hud" aria-hidden="true">
          <span>LuBirth close atmosphere</span>
          <span>{config.quality}</span>
          <span>{config.fixedProgress.toFixed(2)}</span>
        </div>
      ) : null}
      <VisualCanvas
        decorative
        dpr={config.quality === "high" ? [1.4, 1.8] : 1}
        fallback={
          <VisualCanvasFallback
            scene="lubirth"
            label={label}
            posterSrc="/assets/lubirth/poster-field.webp"
          />
        }
      >
        <LuBirthSceneSlot
          mode="field"
          quality={config.quality}
          paused={!config.live}
          cloudDeckEnabled
          visualDebugLayer="all"
          renderProfile="nasa"
          atmospherePolicy="stack"
          atmosphereVariant="stack"
          routeVariant="spike"
          productionSurface={false}
          closeAtmosphereTuning={config.tuning}
        />
      </VisualCanvas>
    </main>
  );
}
