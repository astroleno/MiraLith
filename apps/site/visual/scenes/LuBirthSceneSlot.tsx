"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  EarthMoonScene,
  computeRuntimeMoonPhase,
  computeRuntimeSolarDirection,
  geodeticToTextureVector,
  resolveLandingAssets,
  resolveLandingPreset
} from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type {
  LandingAssetManifest,
  LandingAuroraProfile,
  LandingCompositionOverrides,
  EarthMoonHeroMode,
  LandingLocationConfig,
  LandingMoonLightingMode,
  LandingMoonPhase,
  LandingRenderProfile,
  LandingVisualDebugLayer,
  LuBirthProjectionFrame
} from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";

const HIGH_DETAIL_EARTH_ASSETS: Partial<LandingAssetManifest> = {
  earthDay: {
    id: "earth-day-8k",
    src: "/assets/lubirth/textures/earth-day-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  },
  earthNight: {
    id: "earth-night-8k",
    src: "/assets/lubirth/textures/earth-night-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  },
  earthClouds: {
    id: "earth-clouds-8k",
    src: "/assets/lubirth/textures/earth-clouds-8k.webp",
    width: 8192,
    height: 4096,
    format: "webp",
    colorSpace: "srgb"
  }
};

declare global {
  interface Window {
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthAuroraEnabled?: boolean;
    __MiraLithLuBirthAuroraProfile?: LandingAuroraProfile;
    __MiraLithLuBirthMoonPhase?: LandingMoonPhase;
    __MiraLithLuBirthRuntimeLocation?: LandingLocationConfig;
    __MiraLithLuBirthSolarState?: {
      date: string;
      localTime?: string;
      locationLabel?: string;
      locationSunDot?: number;
      source: "runtime-solar";
      sunDirection: [number, number, number];
      timeZone?: string;
    };
  }
}

interface LuBirthSceneSlotProps {
  mode: EarthMoonHeroMode;
  quality?: LandingQuality;
  debugMianyang?: boolean;
  visualDebugLayer?: LandingVisualDebugLayer;
  renderProfile?: LandingRenderProfile;
  paused?: boolean;
  onProjectionFrame?: (frame: LuBirthProjectionFrame) => void;
  onVisualReadyEnough?: () => void;
  onMoonTextureReady?: () => void;
}

function readMoonLightingMode(): LandingMoonLightingMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const mode = new URLSearchParams(window.location.search).get("moonLight");
  return mode === "birthPhase" || mode === "sceneLit" || mode === "mixed" ? mode : undefined;
}

function readQualityOverride(): LandingQuality | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const quality = new URLSearchParams(window.location.search).get("quality");
  return quality === "high" || quality === "medium" || quality === "low" || quality === "auto" ? quality : undefined;
}

function readAuroraProfile(): LandingAuroraProfile {
  if (typeof window === "undefined") {
    return "hero";
  }

  const profile = new URLSearchParams(window.location.search).get("auroraProfile");
  return profile === "debug" ? "debug" : "hero";
}

function readRenderProfileOverride(): LandingRenderProfile | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const profile = new URLSearchParams(window.location.search).get("profile");
  if (
    profile === "clean" ||
    profile === "nasa" ||
    profile === "debug-stars" ||
    profile === "debug-clouds" ||
    profile === "debug-atmosphere" ||
    profile === "debug-aurora"
  ) {
    return profile;
  }

  return undefined;
}

function readMoonPhaseOverride(activeRenderProfile: LandingRenderProfile | undefined): "birth" | "today" {
  if (typeof window === "undefined") {
    return "birth";
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("moonPhase");
  if (mode === "birth" || mode === "fixed") {
    return "birth";
  }
  if (mode === "today" || mode === "runtime") {
    return "today";
  }

  return activeRenderProfile === "nasa" ? "today" : "birth";
}

function readMoonDateOverride(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const value = new URLSearchParams(window.location.search).get("moonDate");
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? value : undefined;
}

function readSunDateOverride(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const params = new URLSearchParams(window.location.search);
  const value = params.get("sunDate") || params.get("solarDate");
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? value : undefined;
}

function readLocationOverride(activeRenderProfile: LandingRenderProfile | undefined): "birth" | "ip" {
  if (typeof window === "undefined") {
    return "birth";
  }

  const params = new URLSearchParams(window.location.search);
  const location = params.get("location");
  if (location === "birth" || location === "mianyang") {
    return "birth";
  }
  if (location === "ip" || location === "visitor") {
    return "ip";
  }
  if (params.has("geoLat") && params.has("geoLon")) {
    return "ip";
  }
  if (params.get("visualTest") === "pixels") {
    return "birth";
  }

  return activeRenderProfile === "nasa" ? "ip" : "birth";
}

function buildGeoEndpoint() {
  const params = new URLSearchParams(window.location.search);
  const latitude = params.get("geoLat");
  const longitude = params.get("geoLon");
  if (!latitude || !longitude) {
    return "/api/lubirth-geo";
  }

  const endpoint = new URLSearchParams({
    lat: latitude,
    lon: longitude
  });
  const label = params.get("geoLabel");
  if (label) {
    endpoint.set("label", label);
  }
  const timeZone = params.get("geoTimeZone") || params.get("timeZone") || params.get("tz");
  if (timeZone) {
    endpoint.set("timeZone", timeZone);
  }

  return `/api/lubirth-geo?${endpoint.toString()}`;
}

function readManualGeoLocation(): LandingLocationConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (!params.has("geoLat") || !params.has("geoLon")) {
    return null;
  }

  const latitude = Number(params.get("geoLat"));
  const longitude = Number(params.get("geoLon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitudeDeg: latitude,
    longitudeDeg: longitude,
    label: params.get("geoLabel") || "Visitor location",
    ...(params.get("geoTimeZone") || params.get("timeZone") || params.get("tz")
      ? { timeZone: params.get("geoTimeZone") || params.get("timeZone") || params.get("tz") || undefined }
      : {}),
    source: "manual"
  };
}

function dotTextureVectors(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function formatLocationLocalTime(date: Date, location: LandingLocationConfig | null) {
  if (!location?.timeZone) {
    return undefined;
  }

  try {
    return new Intl.DateTimeFormat("en-CA", {
      dateStyle: "short",
      timeStyle: "medium",
      hour12: false,
      timeZone: location.timeZone
    }).format(date);
  } catch {
    return undefined;
  }
}

export function LuBirthSceneSlot({
  mode,
  quality = "auto",
  debugMianyang = false,
  visualDebugLayer = "all",
  renderProfile,
  paused = false,
  onProjectionFrame,
  onVisualReadyEnough,
  onMoonTextureReady
}: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityOverride = readQualityOverride();
  const auroraProfile = readAuroraProfile();
  const renderProfileOverride = readRenderProfileOverride();
  const activeRenderProfile = renderProfileOverride ?? renderProfile;
  const moonPhaseOverride = readMoonPhaseOverride(activeRenderProfile);
  const moonDateOverride = readMoonDateOverride();
  const sunDateOverride = readSunDateOverride();
  const locationOverride = readLocationOverride(activeRenderProfile);
  const manualGeoLocation = useMemo(() => readManualGeoLocation(), []);
  const geoEndpoint =
    locationOverride === "ip" && typeof window !== "undefined" && !manualGeoLocation
      ? buildGeoEndpoint()
      : null;
  const qualityProfile = useQualityTier(qualityOverride ?? quality, reducedMotion);
  const moonLightingMode = readMoonLightingMode();
  const todayMoonPhase = useMemo(
    () => computeRuntimeMoonPhase(moonDateOverride ? new Date(moonDateOverride) : new Date()),
    [moonDateOverride]
  );
  const runtimeSolarDate = useMemo(
    () => sunDateOverride ? new Date(sunDateOverride) : new Date(),
    [sunDateOverride]
  );
  const runtimeSunDirection = useMemo(
    () => computeRuntimeSolarDirection(runtimeSolarDate),
    [runtimeSolarDate]
  );
  const [visitorLocationState, setVisitorLocationState] = useState<{
    endpoint: string;
    location: LandingLocationConfig;
  } | null>(null);
  const activeVisitorLocation =
    manualGeoLocation ??
    (geoEndpoint && visitorLocationState?.endpoint === geoEndpoint ? visitorLocationState.location : null);
  const compositionOverrides = useMemo<LandingCompositionOverrides>(
    () => {
      const useRuntimeSolar = activeRenderProfile === "nasa" || moonPhaseOverride === "today" || Boolean(activeVisitorLocation);
      const moon: NonNullable<LandingCompositionOverrides["moon"]> = {
        ...(moonLightingMode ? { lightingMode: moonLightingMode } : {}),
        ...(moonPhaseOverride === "today"
          ? {
              date: todayMoonPhase.date,
              phaseMode: "runtime-ephemeris",
              fixedPhase: todayMoonPhase
            }
          : {})
      };

      return {
        ...(Object.keys(moon).length > 0 ? { moon } : {}),
        ...(useRuntimeSolar ? { light: { fixedSunDir: runtimeSunDirection } } : {}),
        ...(activeVisitorLocation ? { location: activeVisitorLocation } : {})
      };
    },
    [activeRenderProfile, activeVisitorLocation, moonLightingMode, moonPhaseOverride, runtimeSunDirection, todayMoonPhase]
  );
  const composition = useMemo(
    () => resolveLandingPreset(mode, compositionOverrides),
    [compositionOverrides, mode]
  );
  const useHighDetailEarthAssets = qualityProfile.tier === "high" && activeRenderProfile !== "clean";
  const assets = resolveLandingAssets(useHighDetailEarthAssets ? HIGH_DETAIL_EARTH_ASSETS : undefined);

  useEffect(() => {
    let cancelled = false;

    if (!geoEndpoint) {
      window.__MiraLithLuBirthRuntimeLocation = manualGeoLocation ?? undefined;
      return undefined;
    }

    fetch(geoEndpoint, { cache: "no-store" })
      .then((response) => response.json() as Promise<{
        located?: boolean;
        latitudeDeg?: number;
        longitudeDeg?: number;
        label?: string;
        source?: string;
        timeZone?: string;
      }>)
      .then((payload) => {
        if (
          cancelled ||
          !payload.located ||
          typeof payload.latitudeDeg !== "number" ||
          typeof payload.longitudeDeg !== "number"
        ) {
          return;
        }

        const nextLocation: LandingLocationConfig = {
          latitudeDeg: payload.latitudeDeg,
          longitudeDeg: payload.longitudeDeg,
          label: payload.label || "Visitor location",
          ...(payload.timeZone ? { timeZone: payload.timeZone } : {}),
          source: payload.source === "manual" ? "manual" : "ip-geo"
        };
        setVisitorLocationState({ endpoint: geoEndpoint, location: nextLocation });
        window.__MiraLithLuBirthRuntimeLocation = nextLocation;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [geoEndpoint, manualGeoLocation]);

  useLayoutEffect(() => {
    window.__MiraLithLuBirthQualityTier = qualityProfile.tier;
    window.__MiraLithLuBirthAuroraEnabled = qualityProfile.aurora;
    window.__MiraLithLuBirthAuroraProfile = auroraProfile;
    window.__MiraLithLuBirthMoonPhase = composition.moon.fixedPhase;
    const locationVector = geodeticToTextureVector(
      composition.location.latitudeDeg,
      composition.location.longitudeDeg
    );
    window.__MiraLithLuBirthSolarState = {
      date: runtimeSolarDate.toISOString(),
      localTime: formatLocationLocalTime(runtimeSolarDate, activeVisitorLocation),
      locationLabel: activeVisitorLocation?.label,
      locationSunDot: Number(dotTextureVectors(locationVector, runtimeSunDirection).toFixed(4)),
      source: "runtime-solar",
      sunDirection: [runtimeSunDirection[0], runtimeSunDirection[1], runtimeSunDirection[2]],
      timeZone: activeVisitorLocation?.timeZone
    };
  }, [
    activeVisitorLocation,
    auroraProfile,
    composition.location.latitudeDeg,
    composition.location.longitudeDeg,
    composition.moon.fixedPhase,
    qualityProfile.aurora,
    qualityProfile.tier,
    runtimeSolarDate,
    runtimeSunDirection
  ]);

  if (qualityProfile.tier === "fallback") {
    return null;
  }

  return (
    <EarthMoonScene
      mode={mode}
      composition={composition}
      assets={assets}
      quality={qualityProfile}
      debugMianyang={debugMianyang}
      visualDebugLayer={visualDebugLayer}
      renderProfile={activeRenderProfile}
      auroraProfile={auroraProfile}
      reducedMotion={reducedMotion}
      paused={paused}
      onProjectionFrame={onProjectionFrame}
      onVisualReadyEnough={onVisualReadyEnough}
      onMoonTextureReady={onMoonTextureReady}
    />
  );
}
