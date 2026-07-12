"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import type {
  LandingAtmosphereLook,
  LandingAtmosphereVariant,
  LandingRenderProfile,
  LandingVisualDebugLayer
} from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

type CloudTruthMode =
  | "baseline"
  | "edge"
  | "volume"
  | "shadow"
  | "all"
  | "clouds"
  | "atmosphere"
  | "aurora"
  | "stars";

interface CloudTruthConfig {
  atmosphereLook: LandingAtmosphereLook;
  atmosphereVariant: LandingAtmosphereVariant;
  copyHidden: boolean;
  fixedProgress: number;
  hasFixedProgress: boolean;
  mode: CloudTruthMode;
  quality: LandingQuality;
  renderProfile: LandingRenderProfile;
  visualDebugLayer: LandingVisualDebugLayer;
}

declare global {
  interface Window {
    __MiraLithLuBirthCloudTruthMode?: CloudTruthMode;
  }
}

const DEFAULT_CONFIG: CloudTruthConfig = {
  atmosphereLook: "reference",
  atmosphereVariant: "stack",
  copyHidden: false,
  fixedProgress: 0,
  hasFixedProgress: false,
  mode: "all",
  quality: "auto",
  renderProfile: "nasa",
  visualDebugLayer: "all"
};

let cachedConfigSearch = "";
let cachedConfig = DEFAULT_CONFIG;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function readMode(params: URLSearchParams): CloudTruthMode {
  const mode = params.get("mode") ?? params.get("debug");
  if (
    mode === "baseline" ||
    mode === "edge" ||
    mode === "volume" ||
    mode === "shadow" ||
    mode === "clouds" ||
    mode === "atmosphere" ||
    mode === "aurora" ||
    mode === "stars"
  ) {
    return mode;
  }

  return "all";
}

function debugLayerForMode(mode: CloudTruthMode): LandingVisualDebugLayer {
  if (mode === "clouds" || mode === "aurora" || mode === "stars") {
    return mode;
  }
  if (mode === "atmosphere") {
    return "atmosphere";
  }

  return "all";
}

function readQuality(params: URLSearchParams): LandingQuality {
  const quality = params.get("quality");
  return quality === "high" || quality === "medium" || quality === "low" || quality === "auto"
    ? quality
    : "auto";
}

function readRenderProfile(params: URLSearchParams): LandingRenderProfile {
  const profile = params.get("profile");
  if (
    profile === "clean" ||
    profile === "nasa" ||
    profile === "debug-stars" ||
    profile === "debug-clouds" ||
    profile === "debug-atmosphere" ||
    profile === "debug-aurora"
  ) {
    return profile;
  }

  return "nasa";
}

function readAtmosphereVariant(params: URLSearchParams): LandingAtmosphereVariant {
  const atmo = params.get("atmo");
  return atmo === "stack" || atmo === "volumetric" ? atmo : "stack";
}

function readAtmosphereLook(params: URLSearchParams): LandingAtmosphereLook {
  const look = params.get("look");
  return look === "lubirth" || look === "reference" ? look : "reference";
}

function readConfig(): CloudTruthConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  const progressParam = params.get("progress");
  const parsedProgress = progressParam === null ? Number.NaN : Number.parseFloat(progressParam);
  const mode = readMode(params);
  const copyMode = params.get("copy");
  const visualPixelMode = params.get("visualTest") === "pixels";
  const visualDebugLayer = debugLayerForMode(mode);

  return {
    atmosphereLook: readAtmosphereLook(params),
    atmosphereVariant: readAtmosphereVariant(params),
    copyHidden: copyMode === "hidden" || (visualPixelMode && copyMode !== "visible"),
    fixedProgress: Number.isFinite(parsedProgress) ? clamp01(parsedProgress) : 0,
    hasFixedProgress: Number.isFinite(parsedProgress),
    mode,
    quality: readQuality(params),
    renderProfile: readRenderProfile(params),
    visualDebugLayer
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
  if (search !== cachedConfigSearch) {
    cachedConfigSearch = search;
    cachedConfig = readConfig();
  }

  return cachedConfig;
}

export function LuBirthCloudTruthSpikeRoute() {
  const config = useSyncExternalStore(subscribeConfig, getConfigSnapshot, () => DEFAULT_CONFIG);

  useLayoutEffect(() => {
    window.__MiraLithOpeningProgress = config.fixedProgress;
    window.__MiraLithLuBirthCloudTruthMode = config.mode;
    return () => {
      window.__MiraLithLuBirthCloudTruthMode = undefined;
    };
  }, [config.fixedProgress, config.mode]);

  return (
    <main
      className="lubirth-cloud-truth-spike"
      data-copy={config.copyHidden ? "hidden" : "visible"}
      data-mode={config.mode}
      data-progress={config.fixedProgress}
    >
      <style>{`
        .lubirth-cloud-truth-spike {
          min-height: 100svh;
          overflow: hidden;
          background: #000102;
          color: rgba(240, 247, 255, 0.86);
        }

        .lubirth-cloud-truth-spike__stage {
          position: fixed;
          inset: 0;
          z-index: 1;
          background: #000102;
        }

        .lubirth-cloud-truth-spike__stage .visual-canvas,
        .lubirth-cloud-truth-spike__stage .visual-canvas-fallback {
          position: absolute;
          inset: 0;
        }

        .lubirth-cloud-truth-spike__hud {
          position: fixed;
          right: 20px;
          bottom: 18px;
          z-index: 4;
          display: flex;
          gap: 12px;
          align-items: center;
          margin: 0;
          border: 1px solid rgba(168, 213, 255, 0.2);
          border-radius: 999px;
          padding: 9px 12px;
          background: rgba(0, 6, 12, 0.54);
          color: rgba(225, 240, 255, 0.72);
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          pointer-events: none;
          backdrop-filter: blur(10px);
        }
      `}</style>

      <div className="lubirth-cloud-truth-spike__stage">
        <VisualCanvas
          decorative
          dpr={config.hasFixedProgress ? 2 : [1.35, 1.8]}
          fallback={
            <VisualCanvasFallback
              scene="lubirth"
              label="LuBirth cloud truth spike"
              posterSrc="/assets/lubirth/poster-field.webp"
            />
          }
        >
          <LuBirthSceneSlot
            mode="field"
            quality={config.quality}
            paused={config.hasFixedProgress}
            cloudDeckEnabled={config.mode !== "baseline"}
            visualDebugLayer={config.visualDebugLayer}
            renderProfile={config.renderProfile}
            atmospherePolicy={config.atmosphereVariant}
            atmosphereVariant={config.atmosphereVariant}
            atmosphereLook={config.atmosphereLook}
            routeVariant="spike"
            productionSurface={false}
          />
        </VisualCanvas>
      </div>

      {!config.copyHidden ? (
        <p className="lubirth-cloud-truth-spike__hud" aria-hidden="true">
          <span>LuBirth cloud truth</span>
          <span>{config.mode}</span>
          <span>{config.quality}</span>
          <span>{config.atmosphereLook}</span>
        </p>
      ) : null}
    </main>
  );
}
