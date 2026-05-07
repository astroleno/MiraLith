"use client";

import { useEffect, useLayoutEffect, useState } from "react";
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

type SpikeAtmosphereMode = LandingAtmosphereVariant | "split";

interface SpikeConfig {
  atmosphereMode: SpikeAtmosphereMode;
  atmosphereLook: LandingAtmosphereLook;
  copyHidden: boolean;
  fixedProgress: number;
  hasFixedProgress: boolean;
  quality: LandingQuality;
  renderProfile: LandingRenderProfile;
  visualDebugLayer: LandingVisualDebugLayer;
}

const DEFAULT_CONFIG: SpikeConfig = {
  atmosphereLook: "reference",
  atmosphereMode: "volumetric",
  copyHidden: false,
  fixedProgress: 0,
  hasFixedProgress: false,
  quality: "auto",
  renderProfile: "nasa",
  visualDebugLayer: "all"
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function readVisualDebugLayer(params: URLSearchParams): LandingVisualDebugLayer {
  const debug = params.get("debug");
  return debug === "stars" ||
    debug === "clouds" ||
    debug === "atmosphere" ||
    debug === "aurora" ||
    debug === "all"
    ? debug
    : "all";
}

function renderProfileFromDebug(layer: LandingVisualDebugLayer): LandingRenderProfile {
  if (layer === "stars") {
    return "debug-stars";
  }
  if (layer === "clouds") {
    return "debug-clouds";
  }
  if (layer === "atmosphere") {
    return "debug-atmosphere";
  }
  if (layer === "aurora") {
    return "debug-aurora";
  }

  return "nasa";
}

function readRenderProfile(params: URLSearchParams, layer: LandingVisualDebugLayer): LandingRenderProfile {
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

  return renderProfileFromDebug(layer);
}

function readQuality(params: URLSearchParams): LandingQuality {
  const quality = params.get("quality");
  return quality === "high" || quality === "medium" || quality === "low" || quality === "auto"
    ? quality
    : "auto";
}

function readAtmosphereMode(params: URLSearchParams): SpikeAtmosphereMode {
  const atmo = params.get("atmo");
  return atmo === "stack" || atmo === "split" || atmo === "volumetric" ? atmo : "volumetric";
}

function readAtmosphereLook(params: URLSearchParams): LandingAtmosphereLook {
  const look = params.get("look");
  return look === "lubirth" || look === "reference" ? look : "reference";
}

function readConfig(): SpikeConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  const progressParam = params.get("progress");
  const parsedProgress = progressParam === null ? Number.NaN : Number.parseFloat(progressParam);
  const copyMode = params.get("copy");
  const visualPixelMode = params.get("visualTest") === "pixels";
  const visualDebugLayer = readVisualDebugLayer(params);

  return {
    atmosphereLook: readAtmosphereLook(params),
    atmosphereMode: readAtmosphereMode(params),
    copyHidden: copyMode === "visible" ? false : copyMode === "hidden" || (visualPixelMode && copyMode !== "visible"),
    fixedProgress: Number.isFinite(parsedProgress) ? clamp01(parsedProgress) : 0,
    hasFixedProgress: Number.isFinite(parsedProgress),
    quality: readQuality(params),
    renderProfile: readRenderProfile(params, visualDebugLayer),
    visualDebugLayer
  };
}

function ScenePane({
  atmosphereVariant,
  label,
  config
}: {
  atmosphereVariant: LandingAtmosphereVariant;
  config: SpikeConfig;
  label: string;
}) {
  return (
    <section className="lubirth-atmo-spike__pane" data-atmo-pane={atmosphereVariant} aria-label={label}>
      {!config.copyHidden ? <p className="lubirth-atmo-spike__pane-label">{label}</p> : null}
      <VisualCanvas
        decorative
        dpr={config.hasFixedProgress ? 2 : [1.35, 1.8]}
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
          paused={config.hasFixedProgress}
          cloudDeckEnabled
          visualDebugLayer={config.visualDebugLayer}
          renderProfile={config.renderProfile}
          atmosphereVariant={atmosphereVariant}
          atmosphereLook={config.atmosphereLook}
        />
      </VisualCanvas>
    </section>
  );
}

export function LuBirthAtmosphereSpikeRoute() {
  const [config, setConfig] = useState<SpikeConfig>(DEFAULT_CONFIG);
  const isSplit = config.atmosphereMode === "split";
  const singleAtmosphereVariant: LandingAtmosphereVariant =
    config.atmosphereMode === "stack" ? "stack" : "volumetric";

  useEffect(() => {
    setConfig(readConfig());
  }, []);

  useLayoutEffect(() => {
    window.__MiraLithOpeningProgress = config.fixedProgress;
  }, [config.fixedProgress]);

  return (
    <main
      className="lubirth-atmo-spike"
      data-atmo={config.atmosphereMode}
      data-atmo-look={config.atmosphereLook}
      data-copy={config.copyHidden ? "hidden" : "visible"}
      data-debug-layer={config.visualDebugLayer}
      data-render-profile={config.renderProfile}
      data-progress={config.fixedProgress}
    >
      <style>{`
        .lubirth-atmo-spike {
          min-height: 100svh;
          overflow: hidden;
          background: #000102;
          color: rgba(240, 247, 255, 0.86);
        }

        .lubirth-atmo-spike__stage,
        .lubirth-atmo-spike__split {
          position: fixed;
          inset: 0;
          z-index: 1;
        }

        .lubirth-atmo-spike__split {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }

        .lubirth-atmo-spike__pane {
          position: relative;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          background: #000102;
        }

        .lubirth-atmo-spike__pane + .lubirth-atmo-spike__pane {
          border-left: 1px solid rgba(168, 213, 255, 0.18);
        }

        .lubirth-atmo-spike__pane .visual-canvas,
        .lubirth-atmo-spike__pane .visual-canvas-fallback {
          position: absolute;
          inset: 0;
        }

        .lubirth-atmo-spike__pane-label,
        .lubirth-atmo-spike__hud {
          position: fixed;
          z-index: 4;
          margin: 0;
          pointer-events: none;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .lubirth-atmo-spike__pane-label {
          top: 20px;
          left: 20px;
          font-size: 11px;
          color: rgba(225, 240, 255, 0.72);
        }

        .lubirth-atmo-spike__pane + .lubirth-atmo-spike__pane .lubirth-atmo-spike__pane-label {
          left: calc(50vw + 20px);
        }

        .lubirth-atmo-spike__hud {
          right: 20px;
          bottom: 18px;
          display: flex;
          gap: 12px;
          align-items: center;
          border: 1px solid rgba(168, 213, 255, 0.2);
          border-radius: 999px;
          padding: 9px 12px;
          background: rgba(0, 6, 12, 0.54);
          font-size: 10px;
          backdrop-filter: blur(10px);
        }

        @media (max-width: 760px) {
          .lubirth-atmo-spike__split {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
          }

          .lubirth-atmo-spike__pane + .lubirth-atmo-spike__pane {
            border-left: 0;
            border-top: 1px solid rgba(168, 213, 255, 0.18);
          }

          .lubirth-atmo-spike__pane + .lubirth-atmo-spike__pane .lubirth-atmo-spike__pane-label {
            top: calc(50svh + 16px);
            left: 16px;
          }
        }
      `}</style>

      {isSplit ? (
        <div className="lubirth-atmo-spike__split">
          <ScenePane atmosphereVariant="stack" config={config} label="Stack atmosphere" />
          <ScenePane atmosphereVariant="volumetric" config={config} label="Volumetric atmosphere" />
        </div>
      ) : (
        <div className="lubirth-atmo-spike__stage">
          <ScenePane
            atmosphereVariant={singleAtmosphereVariant}
            config={config}
            label={`${singleAtmosphereVariant} atmosphere`}
          />
        </div>
      )}

      {!config.copyHidden ? (
        <div className="lubirth-atmo-spike__hud" aria-hidden="true">
          <span>LuBirth atmosphere spike</span>
          <span>{config.atmosphereMode}</span>
          <span>{config.atmosphereLook}</span>
          <span>{config.quality}</span>
          <span>{config.renderProfile}</span>
        </div>
      ) : null}
    </main>
  );
}
