"use client";

import { lazy, useEffect, useState } from "react";
import {
  resolveTakramParityRouteQuery,
  type TakramParityRouteQueryResult,
  type TakramParityTelemetry
} from "../../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
import { VisualCanvas } from "../visual/VisualCanvas";

// Keep Takram in a Canvas-native lazy boundary: this leaves V3 inert during
// Task 0T and prevents product routes from requesting the parity subpath.
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
  }
}

export function LuBirthTakramParitySpikeClient() {
  const [routeResult, setRouteResult] = useState<TakramParityRouteQueryResult | null>(null);
  const [telemetry, setTelemetry] = useState<TakramParityTelemetry | null>(null);

  useEffect(() => {
    setRouteResult(resolveTakramParityRouteQuery(new URLSearchParams(window.location.search)));
  }, []);

  useEffect(() => {
    if (telemetry) {
      window.__MiraLithTakramParity = telemetry;
    }
  }, [telemetry]);

  const query = routeResult?.ok ? routeResult.value : null;
  const runtime = routeResult === null
    ? "resolving"
    : !routeResult.ok
      ? "invalid-query"
      : query?.input === "v3"
        ? "v3-not-authorized"
        : telemetry?.active
          ? "ready"
          : "loading";

  return (
    <main
      className="lubirth-takram-parity-spike"
      data-diagnostic={query?.diagnostic ?? "pending"}
      data-input={query?.input ?? "pending"}
      data-runtime={runtime}
      data-takram-parity-route="true"
      data-view={query?.view ?? "pending"}
    >
      {query?.input === "stock" ? (
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
              onTelemetry={setTelemetry}
            />
          ) : (
            <LuBirthTakramParityScene
              diagnostic={query.diagnostic}
              onTelemetry={setTelemetry}
              progress={query.progress}
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
        {runtime === "v3-not-authorized"
          ? "V3 adapter remains locked until Task 0V."
          : telemetry
            ? `Takram ${telemetry.view} ${telemetry.active ? "native path active" : "preparing"}`
            : "Preparing Takram stock parity…"}
      </output>
    </main>
  );
}
