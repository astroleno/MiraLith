"use client";

import type {
  TakramParityDiagnostic,
  TakramParityInput,
  TakramParityTelemetry
} from "./TakramParityContract";
import type {
  TakramV3MorphologyCandidateId,
  TakramV3MorphologyViewId
} from "./TakramV3MorphologyContract";
import { TakramStockParityPipeline } from "./TakramStockParityPipeline";

export interface LuBirthTakramParitySceneProps {
  altitudeMeters?: number;
  diagnostic?: TakramParityDiagnostic;
  input: TakramParityInput;
  morphologyCandidate?: TakramV3MorphologyCandidateId;
  morphologyView?: TakramV3MorphologyViewId;
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
  morphologyCandidate,
  morphologyView,
  onTelemetry,
  progress
}: LuBirthTakramParitySceneProps) {
  return (
    <TakramStockParityPipeline
      altitudeMeters={altitudeMeters}
      diagnostic={diagnostic}
      input={input}
      morphologyCandidate={morphologyCandidate}
      morphologyView={morphologyView}
      onTelemetry={onTelemetry}
      progress={progress}
      view="opening"
    />
  );
}
