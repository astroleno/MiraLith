"use client";

import type {
  TakramParityDiagnostic,
  TakramParityTelemetry
} from "./TakramParityContract";
import { TakramStockParityPipeline } from "./TakramStockParityPipeline";

export interface LuBirthTakramParitySceneProps {
  diagnostic?: TakramParityDiagnostic;
  onTelemetry?: (telemetry: TakramParityTelemetry) => void;
  progress: number;
}

/**
 * The stock opening is intentionally a transform/camera mirror only. V3 stays
 * absent until Task 0V authorizes the adapter path.
 */
export function LuBirthTakramParityScene({
  diagnostic,
  onTelemetry,
  progress
}: LuBirthTakramParitySceneProps) {
  return (
    <TakramStockParityPipeline
      diagnostic={diagnostic}
      input="stock"
      onTelemetry={onTelemetry}
      progress={progress}
      view="opening"
    />
  );
}
