"use client";

import type {
  TakramCloudCoverageMode,
  TakramCloudScale,
  TakramStockWeatherControlMode
} from "./TakramCloudScaleContract";
import type {
  TakramParityDiagnostic,
  TakramParityInput,
  TakramOrbitalFeatureState,
  TakramParityTelemetry,
  TakramWeatherAdapterComparison
} from "./TakramParityContract";
import type {
  TakramV3MorphologyCandidateId,
  TakramV3MorphologyViewId
} from "./TakramV3MorphologyContract";
import type { TakramOrbitalLookdevInput } from "./TakramOrbitalLookdevContract";
import { TakramStockParityPipeline } from "./TakramStockParityPipeline";

export interface LuBirthTakramParitySceneProps {
  altitudeMeters?: number;
  cloudCoverageMode?: TakramCloudCoverageMode;
  cloudScale?: TakramCloudScale;
  stockWeatherMode?: TakramStockWeatherControlMode;
  diagnostic?: TakramParityDiagnostic;
  input: TakramParityInput;
  morphologyCandidate?: TakramV3MorphologyCandidateId;
  morphologyView?: TakramV3MorphologyViewId;
  orbitalLookdev?: TakramOrbitalLookdevInput;
  orbitalFeatureState?: TakramOrbitalFeatureState;
  onTelemetry?: (telemetry: TakramParityTelemetry) => void;
  progress: number;
  weatherAdapterComparison?: TakramWeatherAdapterComparison;
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
  orbitalLookdev,
  orbitalFeatureState,
  onTelemetry,
  progress,
  stockWeatherMode,
  weatherAdapterComparison
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
      orbitalLookdev={orbitalLookdev}
      orbitalFeatureState={orbitalFeatureState}
      onTelemetry={onTelemetry}
      progress={progress}
      stockWeatherMode={stockWeatherMode}
      view="opening"
      weatherAdapterComparison={weatherAdapterComparison}
    />
  );
}
