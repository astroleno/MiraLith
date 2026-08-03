"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_RELIEF_SCATTERING_CANDIDATE_ID,
  resolveLandingReferenceAbsorptionCloudDebugMode,
  resolveLandingReferenceAbsorptionVariant,
  resolveReliefScatteringCandidate,
  type LandingReferenceAbsorptionCloudDebugMode,
  type LandingReferenceAbsorptionVariant
} from "@miralith/lubirth-hero";
import { LuBirthRevisedRoute } from "./LuBirthRevisedRoute";

interface ReferenceAbsorptionConfig {
  cloudDebugMode: LandingReferenceAbsorptionCloudDebugMode;
  forceEarthMaterialFailure: boolean;
  gpuTimerEnabled: boolean;
  scatteringCandidateId: string;
  variant: LandingReferenceAbsorptionVariant;
}

const DEFAULT_CONFIG: ReferenceAbsorptionConfig = {
  cloudDebugMode: "none",
  forceEarthMaterialFailure: false,
  gpuTimerEnabled: false,
  scatteringCandidateId: DEFAULT_RELIEF_SCATTERING_CANDIDATE_ID,
  variant: "baseline"
};

let cachedSearch = "";
let cachedConfig = DEFAULT_CONFIG;

function readConfig(): ReferenceAbsorptionConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  return {
    cloudDebugMode: resolveLandingReferenceAbsorptionCloudDebugMode(params.get("debug")),
    forceEarthMaterialFailure:
      params.get("referenceAbsorptionForceEarthMaterialFailure") === "on",
    gpuTimerEnabled: params.get("referenceAbsorptionGpuTimer") === "on",
    scatteringCandidateId: resolveReliefScatteringCandidate(
      params.get("scatteringCandidate")
    ).id,
    variant: resolveLandingReferenceAbsorptionVariant(params.get("variant"))
  };
}

function subscribeConfig() {
  return () => undefined;
}

function getConfigSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  if (window.location.search !== cachedSearch) {
    cachedSearch = window.location.search;
    cachedConfig = readConfig();
  }

  return cachedConfig;
}

export function LuBirthReferenceAbsorptionSpikeRoute() {
  const config = useSyncExternalStore(
    subscribeConfig,
    getConfigSnapshot,
    () => DEFAULT_CONFIG
  );

  return (
    <div
      className="lubirth-reference-absorption-spike"
      data-reference-absorption-cloud-debug={config.cloudDebugMode}
      data-reference-absorption-variant={config.variant}
      data-reference-absorption-scattering-candidate={config.scatteringCandidateId}
    >
      <LuBirthRevisedRoute
        referenceAbsorptionCloudDebugMode={config.cloudDebugMode}
        referenceAbsorptionForceEarthMaterialFailure={config.forceEarthMaterialFailure}
        referenceAbsorptionGpuTimerEnabled={config.gpuTimerEnabled}
        referenceAbsorptionScatteringCandidateId={config.scatteringCandidateId}
        referenceAbsorptionVariant={config.variant}
      />
    </div>
  );
}
