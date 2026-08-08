"use client";

import type {
  TakramParityDiagnostic,
  TakramParityInput,
  TakramParityTelemetry
} from "./TakramParityContract";
import { TakramStockParityPipeline } from "./TakramStockParityPipeline";

export interface LuBirthTakramParitySceneProps {
  altitudeMeters?: number;
  diagnostic?: TakramParityDiagnostic;
  input: TakramParityInput;
  onTelemetry?: (telemetry: TakramParityTelemetry) => void;
  progress: number;
}

/**
 * Both stock and V3 retain the exact Task -1R opening transform/camera; input
 * only selects the adapter-owned weather mapping and cloud-layer contract.
 */
export function LuBirthTakramParityScene({
  altitudeMeters,
  diagnostic,
  input,
  onTelemetry,
  progress
}: LuBirthTakramParitySceneProps) {
  return (
    <TakramStockParityPipeline
      altitudeMeters={altitudeMeters}
      diagnostic={diagnostic}
      input={input}
      onTelemetry={onTelemetry}
      progress={progress}
      view="opening"
    />
  );
}
