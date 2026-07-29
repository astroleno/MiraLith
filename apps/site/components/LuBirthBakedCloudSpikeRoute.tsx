"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import type { LandingQuality } from "@miralith/visual-core";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

interface BakedCloudSpikeConfig {
  copyHidden: boolean;
  fixedProgress: number;
  hasFixedProgress: boolean;
  quality: LandingQuality;
}

const DEFAULT_CONFIG: BakedCloudSpikeConfig = {
  copyHidden: true,
  fixedProgress: 0,
  hasFixedProgress: false,
  quality: "high"
};

let cachedSearch = "";
let cachedConfig = DEFAULT_CONFIG;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function readQuality(params: URLSearchParams): LandingQuality {
  const quality = params.get("quality");
  return quality === "auto" || quality === "high" || quality === "medium" || quality === "low"
    ? quality
    : "high";
}

function readConfig(): BakedCloudSpikeConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  const progress = Number.parseFloat(params.get("progress") ?? "");
  return {
    copyHidden: params.get("copy") !== "visible",
    fixedProgress: Number.isFinite(progress) ? clamp01(progress) : 0,
    hasFixedProgress: Number.isFinite(progress),
    quality: readQuality(params)
  };
}

function subscribeConfig() {
  return () => undefined;
}

function getConfigSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const search = window.location.search;
  if (search !== cachedSearch) {
    cachedSearch = search;
    cachedConfig = readConfig();
  }
  return cachedConfig;
}

export function LuBirthBakedCloudSpikeRoute() {
  const config = useSyncExternalStore(subscribeConfig, getConfigSnapshot, () => DEFAULT_CONFIG);

  useLayoutEffect(() => {
    window.__MiraLithOpeningProgress = config.fixedProgress;
  }, [config.fixedProgress]);

  return (
    <main
      className="lubirth-baked-cloud-spike"
      data-copy={config.copyHidden ? "hidden" : "visible"}
      data-progress={config.fixedProgress}
      data-quality={config.quality}
      style={{ minHeight: "100svh", overflow: "hidden", background: "#000102" }}
    >
      <VisualCanvas
        decorative
        dpr={config.hasFixedProgress ? 1.8 : [1.25, 1.8]}
        fallback={
          <VisualCanvasFallback
            scene="lubirth"
            label="LuBirth baked cloud spike"
            posterSrc="/assets/lubirth/poster-field.webp"
          />
        }
      >
        <LuBirthSceneSlot
          mode="field"
          quality={config.quality}
          paused={config.hasFixedProgress}
          cloudDeckEnabled={false}
          visualDebugLayer="all"
          renderProfile="nasa"
          atmospherePolicy="stack"
          atmosphereVariant="stack"
          atmosphereLook="lubirth"
          routeVariant="spike"
          productionSurface={false}
          bakedCloudSpike={{ enabled: true }}
        />
      </VisualCanvas>
    </main>
  );
}
