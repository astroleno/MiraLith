import type { QualityProfile } from "@miralith/visual-core";
import type { LandingCloudVolumeModel } from "./types";

export interface CloudVolumeV3Profile {
  groundShadowStrength: number;
  model: "legacy" | "v3";
  sunSamples: number;
}

export function resolveCloudVolumeV3Profile({
  qualityTier,
  referenceLook,
  requestedModel = "v3"
}: {
  qualityTier: QualityProfile["tier"];
  referenceLook: boolean;
  requestedModel?: LandingCloudVolumeModel;
}): CloudVolumeV3Profile {
  if (requestedModel === "v3" && qualityTier === "high" && referenceLook) {
    return {
      groundShadowStrength: 0.54,
      model: "v3",
      sunSamples: 5
    };
  }

  return {
    groundShadowStrength: 0,
    model: "legacy",
    sunSamples: 0
  };
}
