"use client";

import type {
  TakramCloudCoverageMode,
  TakramCloudScale
} from "./TakramCloudScaleContract";
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
  cloudCoverageMode?: TakramCloudCoverageMode;
  cloudScale?: TakramCloudScale;
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
  cloudCoverageMode,
  cloudScale,
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
      cloudCoverageMode={cloudCoverageMode}
      cloudScale={cloudScale}
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
