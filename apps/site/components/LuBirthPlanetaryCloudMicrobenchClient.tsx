"use client";

import { useEffect, useState } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import {
  LuBirthCloudShellMicrobench,
  type CloudShellMicrobenchDebugMode,
  type CloudShellMicrobenchOccluderMode,
  type CloudShellMicrobenchTelemetry,
  type CloudShellMicrobenchTransformScenario
} from "../../../packages/lubirth-hero/src/planetaryCloud/microbench/LuBirthCloudShellMicrobench";
import type { CloudShellMicrobenchCaseId } from "../../../packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchContract";

interface MicrobenchQuery {
  caseId: CloudShellMicrobenchCaseId;
  debugMode: CloudShellMicrobenchDebugMode;
  measure: boolean;
  occluderMode: CloudShellMicrobenchOccluderMode;
  progress: number;
  showSceneDepthClamp: boolean;
  transformScenario: CloudShellMicrobenchTransformScenario;
  visualGateConfirmed: boolean;
}

function readMicrobenchQuery(): MicrobenchQuery {
  if (typeof window === "undefined") {
    return {
      caseId: "24/6",
      debugMode: "raw",
      measure: false,
      occluderMode: "none",
      progress: 0,
      showSceneDepthClamp: false,
      transformScenario: "enlarged",
      visualGateConfirmed: false
    };
  }

  const query = new URLSearchParams(window.location.search);
  const caseParam = query.get("case");
  const debugParam = query.get("debug");
  const occluderParam = query.get("occluder");
  const transformParam = query.get("transform");
  const parsedProgress = Number.parseFloat(query.get("progress") ?? "0");
  return {
    caseId: caseParam === "32/2" || caseParam === "48/6" ? caseParam : "24/6",
    debugMode: debugParam === "cloud" || debugParam === "earth" || debugParam === "density"
      ? debugParam
      : "raw",
    measure: query.get("measure") === "1",
    occluderMode: occluderParam === "front" || occluderParam === "middle" || occluderParam === "behind"
      ? occluderParam
      : "none",
    progress: Number.isFinite(parsedProgress) ? Math.max(0, Math.min(0.18, parsedProgress)) : 0,
    showSceneDepthClamp: query.get("showSceneDepthClamp") === "1",
    transformScenario: transformParam === "identity" || transformParam === "reduced"
      ? transformParam
      : "enlarged",
    visualGateConfirmed: query.get("visualGate") === "pass"
  };
}

export function LuBirthPlanetaryCloudMicrobenchClient() {
  const [query, setQuery] = useState<MicrobenchQuery>({
    caseId: "24/6",
    debugMode: "raw",
    measure: false,
    occluderMode: "none",
    progress: 0,
    showSceneDepthClamp: false,
    transformScenario: "enlarged",
    visualGateConfirmed: false
  });
  const [telemetry, setTelemetry] = useState<CloudShellMicrobenchTelemetry | null>(null);

  useEffect(() => {
    setQuery(readMicrobenchQuery());
  }, []);

  const runtimeState = telemetry?.active ? "ready" : "loading";

  return (
    <main
      className="lubirth-planetary-cloud-microbench"
      data-case={query.caseId}
      data-debug={query.debugMode}
      data-runtime={runtimeState}
      data-show-scene-depth-clamp={String(query.showSceneDepthClamp)}
      data-transform={query.transformScenario}
    >
      <VisualCanvas
        antialias={false}
        ariaLabel="LuBirth planetary cloud pre-integration microbenchmark"
        decorative={false}
        dpr={1}
        fallback={<div className="visual-canvas-fallback" data-visual-fallback="lubirth-microbench" />}
      >
        <LuBirthCloudShellMicrobench
          caseId={query.caseId}
          debugMode={query.debugMode}
          measure={query.measure}
          occluderMode={query.occluderMode}
          progress={query.progress}
          showSceneDepthClamp={query.showSceneDepthClamp}
          transformScenario={query.transformScenario}
          visualGateConfirmed={query.visualGateConfirmed}
          onTelemetry={setTelemetry}
        />
      </VisualCanvas>
      <output
        aria-live="polite"
        data-microbench-hud="true"
        style={{
          color: "rgba(232, 243, 255, 0.88)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          left: 18,
          maxWidth: 440,
          pointerEvents: "none",
          position: "fixed",
          top: 18,
          whiteSpace: "pre-wrap",
          zIndex: 3
        }}
      >
        {telemetry
          ? `case ${telemetry.caseId}\ncoordinate ${telemetry.coordinateGate}\nhdr ${telemetry.hdrColorGate}\nGPU ${telemetry.gpu.p95Ms ?? "pending"} ms p95`
          : "Preparing V3 cloud-shell microbenchmark…"}
      </output>
    </main>
  );
}
