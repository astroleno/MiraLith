"use client";

import type { TakramParityDiagnostic, TakramParityTelemetry } from "./TakramParityContract";
import { TakramStockParityPipeline } from "./TakramStockParityPipeline";

export interface TakramUpstreamControlSceneProps {
  diagnostic?: TakramParityDiagnostic;
  onTelemetry?: (telemetry: TakramParityTelemetry) => void;
}

/** The frozen near-ground upstream control; it never reads V3. */
export function TakramUpstreamControlScene({
  diagnostic,
  onTelemetry
}: TakramUpstreamControlSceneProps) {
  return (
    <TakramStockParityPipeline
      diagnostic={diagnostic}
      input="stock"
      onTelemetry={onTelemetry}
      progress={0}
      view="control"
    />
  );
}
