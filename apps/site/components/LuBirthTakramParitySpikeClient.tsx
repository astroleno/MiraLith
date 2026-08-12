"use client";

import { useSearchParams } from "next/navigation";
import { lazy, useCallback, useEffect, useMemo, useState } from "react";
import {
  resolveTakramParityRouteQuery,
  type TakramParityHistoryFirstFrameCapture,
  type TakramParityRouteQueryResult,
  type TakramParityTelemetry
} from "../../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
import { VisualCanvas } from "../visual/VisualCanvas";

// Keep Takram in a Canvas-native lazy boundary so the parity-only route owns
// the optional renderer and V3 weather request; product routes stay inert.
const TakramUpstreamControlScene = lazy(
  () => import(
    "../../../packages/lubirth-hero/src/planetaryCloud/parity/TakramUpstreamControlScene"
  ).then((module) => ({ default: module.TakramUpstreamControlScene }))
);

const LuBirthTakramParityScene = lazy(
  () => import(
    "../../../packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene"
  ).then((module) => ({ default: module.LuBirthTakramParityScene }))
);

declare global {
  interface Window {
    __MiraLithTakramParity?: TakramParityTelemetry;
    __MiraLithTakramHistoryFirstFrame?: TakramParityHistoryFirstFrameCapture;
  }
}

export function LuBirthTakramParitySpikeClient() {
  const searchParams = useSearchParams();
  const routeResult = useMemo<TakramParityRouteQueryResult>(
    () => resolveTakramParityRouteQuery(searchParams),
    [searchParams]
  );
  const queryKey = searchParams.toString();
  const [telemetryState, setTelemetryState] = useState<{
    queryKey: string;
    value: TakramParityTelemetry;
  } | null>(null);
  const telemetry = telemetryState?.queryKey === queryKey
    ? telemetryState.value
    : null;
  const handleTelemetry = useCallback((value: TakramParityTelemetry) => {
    setTelemetryState({ queryKey, value });
  }, [queryKey]);

  useEffect(() => {
    delete window.__MiraLithTakramParity;
    delete window.__MiraLithTakramHistoryFirstFrame;
  }, [queryKey]);

  useEffect(() => {
    if (telemetry) {
      window.__MiraLithTakramParity = telemetry;
    }
  }, [telemetry]);

  const query = routeResult.ok ? routeResult.value : null;
  const orbitalLookdev = query?.orbitalPreset !== undefined &&
    query.orbitalCoverage !== undefined &&
    query.verticalScale !== undefined &&
    query.opticalDepthScale !== undefined
    ? {
        preset: query.orbitalPreset,
        coverage: query.orbitalCoverage,
        verticalScale: query.verticalScale,
        opticalDepthScale: query.opticalDepthScale,
        stepScaleMode: query.orbitalStepScale ?? "control"
      }
    : undefined;
  const runtime = !routeResult.ok
    ? "invalid-query"
    : telemetry?.active
      ? "ready"
      : "loading";

  return (
    <main
      className="lubirth-takram-parity-spike"
      data-cloud-coverage={query?.cloudCoverageMode ?? "none"}
      data-cloud-scale={query?.cloudScale ?? "none"}
      data-diagnostic={query?.diagnostic ?? "pending"}
      data-input={query?.input ?? "pending"}
      data-morphology-candidate={query?.morphologyCandidate ?? "none"}
      data-morphology-view={query?.morphologyView ?? "none"}
      data-optical-depth-scale={query?.opticalDepthScale ?? "none"}
      data-orbital-coverage={query?.orbitalCoverage ?? "none"}
      data-orbital-preset={query?.orbitalPreset ?? "none"}
      data-orbital-step-scale={query?.orbitalStepScale ?? "none"}
      data-runtime={runtime}
      data-stock-weather={query?.stockWeatherMode ?? "none"}
      data-takram-parity-route="true"
      data-view={query?.view ?? "pending"}
      data-vertical-scale={query?.verticalScale ?? "none"}
      data-weather-adapter-comparison={query?.weatherAdapterComparison ?? "none"}
    >
      {query !== null ? (
        <VisualCanvas
          antialias={false}
          ariaLabel="LuBirth Takram parity spike"
          decorative={false}
          dpr={1}
          fallback={<div className="visual-canvas-fallback" data-visual-fallback="lubirth-takram-parity" />}
        >
          {query.view === "control" ? (
            <TakramUpstreamControlScene
              diagnostic={query.diagnostic}
              onTelemetry={handleTelemetry}
            />
          ) : (
            <LuBirthTakramParityScene
              altitudeMeters={query.altitudeMeters}
              cloudCoverageMode={query.cloudCoverageMode}
              cloudScale={query.cloudScale}
              diagnostic={query.diagnostic}
              input={query.input}
              morphologyCandidate={query.morphologyCandidate}
              morphologyView={query.morphologyView}
              orbitalLookdev={orbitalLookdev}
              onTelemetry={handleTelemetry}
              progress={query.progress}
              stockWeatherMode={query.stockWeatherMode}
              weatherAdapterComparison={query.weatherAdapterComparison}
            />
          )}
        </VisualCanvas>
      ) : null}
      <output
        aria-live="polite"
        data-takram-parity-hud="true"
        style={{
          color: "rgba(232, 243, 255, 0.88)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          left: 18,
          maxWidth: 520,
          pointerEvents: "none",
          position: "fixed",
          top: 18,
          whiteSpace: "pre-wrap",
          zIndex: 3
        }}
      >
        {telemetry
          ? `Takram ${telemetry.input} ${telemetry.view} ${telemetry.active ? "native path active" : "preparing"}`
          : "Preparing Takram parity…"}
      </output>
    </main>
  );
}
