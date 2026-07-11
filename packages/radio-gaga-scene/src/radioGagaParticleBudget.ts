import type { ResolvedQualityTier } from "@miralith/visual-core";

export interface RadioGagaParticleBudget {
  count: number;
  pointSize: number;
}

export function resolveRadioGagaParticleBudget(
  tier: ResolvedQualityTier,
  reducedMotion: boolean
): RadioGagaParticleBudget {
  if (reducedMotion || tier === "fallback") {
    return { count: 0, pointSize: 0 };
  }

  if (tier === "high") {
    return { count: 9000, pointSize: 0.014 };
  }

  if (tier === "medium") {
    return { count: 5600, pointSize: 0.017 };
  }

  return { count: 2600, pointSize: 0.023 };
}
