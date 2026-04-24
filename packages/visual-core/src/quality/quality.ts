"use client";

import { useEffect, useState } from "react";

export type ResolvedQualityTier = "high" | "medium" | "low" | "fallback";
export type LandingQuality = "auto" | ResolvedQualityTier;

export interface QualityProfile {
  tier: ResolvedQualityTier;
  dpr: number;
  segments: number;
  aurora: boolean;
  stars: number;
  reason: string;
}

interface ResolveQualityInput {
  requested?: LandingQuality;
  reducedMotion?: boolean;
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

const PROFILES: Record<ResolvedQualityTier, QualityProfile> = {
  high: {
    tier: "high",
    dpr: 1.5,
    segments: 96,
    aurora: true,
    stars: 900,
    reason: "desktop-capable"
  },
  medium: {
    tier: "medium",
    dpr: 1.25,
    segments: 72,
    aurora: true,
    stars: 520,
    reason: "balanced"
  },
  low: {
    tier: "low",
    dpr: 1,
    segments: 48,
    aurora: false,
    stars: 260,
    reason: "mobile-or-reduced"
  },
  fallback: {
    tier: "fallback",
    dpr: 1,
    segments: 24,
    aurora: false,
    stars: 0,
    reason: "webgl-unavailable"
  }
};

export function resolveQualityTier(input: ResolveQualityInput = {}): QualityProfile {
  if (input.requested && input.requested !== "auto") {
    return PROFILES[input.requested];
  }

  if (input.reducedMotion) {
    return PROFILES.low;
  }

  const width = input.width ?? 1440;
  const height = input.height ?? 900;
  const dpr = input.devicePixelRatio ?? 1;
  const cores = input.hardwareConcurrency ?? 4;
  const memory = input.deviceMemory ?? 4;
  const shortestSide = Math.min(width, height);

  if (shortestSide < 520 || dpr > 2.5 || cores <= 4 || memory <= 4) {
    return PROFILES.low;
  }

  if (width >= 1180 && cores >= 8 && memory >= 8) {
    return PROFILES.high;
  }

  return PROFILES.medium;
}

export function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

export function useQualityTier(requested: LandingQuality = "auto", reducedMotion = false) {
  const [profile, setProfile] = useState<QualityProfile>(() =>
    resolveQualityTier({ requested, reducedMotion })
  );

  useEffect(() => {
    const update = () => {
      const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };

      setProfile(
        resolveQualityTier({
          requested,
          reducedMotion,
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: navigatorWithMemory.deviceMemory
        })
      );
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [requested, reducedMotion]);

  return profile;
}
