"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  EarthMoonScene,
  computeRuntimeMoonPhase,
  computeRuntimeSolarDirection,
  geodeticToTextureVector,
  resolveLandingAssets,
  resolveLandingPreset,
  resolveLuBirthAtmospherePolicy
} from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type {
  LandingAssetManifest,
  LandingAtmosphereLook,
  LandingAtmospherePolicy,
  LandingAtmosphereVariant,
  LandingAuroraProfile,
  LandingCompositionOverrides,
  EarthMoonHeroMode,
  LandingLocationConfig,
  LandingMoonLightingMode,
  LandingMoonPhase,
  LandingRenderProfile,
  LandingVisualDebugLayer,
  LuBirthAtmosphereRouteVariant,
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
  },
  earthNormal: {
    id: "earth-normal-2k",
    src: "/assets/lubirth/textures/earth-normal-2k.jpg",
    width: 2048,
    height: 1024,
    format: "jpg",
    colorSpace: "linear"
  },
  earthDisplacement: {
    id: "earth-displacement-8k",
    src: "/assets/lubirth/textures/earth-displacement-8k.jpg",
    width: 8192,
    height: 4096,
    format: "jpg",
    colorSpace: "linear"
  }
};

const HIGH_DETAIL_REFERENCE_EARTH_ASSETS: Partial<LandingAssetManifest> = {
  ...HIGH_DETAIL_EARTH_ASSETS,
  earthCloudDeck: {
    id: "earth-cloud-deck-4k",
    src: "/assets/lubirth/textures/earth-cloud-deck-4k.webp",
    width: 4096,
    height: 2048,
    format: "webp",
    colorSpace: "linear"
  }
};

const VISITOR_LOCATION_CACHE_KEY = "miralith:lubirth-runtime-location:v1";
// Matches the reference demo's default slider sunTheta=80, sunPhi=3 without tying light to the camera.
const REFERENCE_ATMOSPHERE_SUN_DIRECTION: [number, number, number] = [0.1734, 0.0523, 0.9835];

declare global {
  interface Window {
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthAuroraEnabled?: boolean;
    __MiraLithLuBirthAuroraProfile?: LandingAuroraProfile;
    __MiraLithLuBirthAtmospherePolicy?: LandingAtmospherePolicy;
    __MiraLithLuBirthAtmospherePolicyReason?: string;
    __MiraLithLuBirthAtmosphereLook?: LandingAtmosphereLook;
    __MiraLithLuBirthMoonPhase?: LandingMoonPhase;
    __MiraLithLuBirthMoonLightingMode?: LandingMoonLightingMode;
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
  atmospherePolicy?: LandingAtmospherePolicy;
  atmosphereVariant?: LandingAtmosphereVariant;
  atmosphereLook?: LandingAtmosphereLook;
  routeVariant?: LuBirthAtmosphereRouteVariant;
  homeIntroRendering?: boolean;
  productionSurface?: boolean;
  paused?: boolean;
  cloudDeckEnabled?: boolean;
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

function isAtmosphereSpikeRoute() {
  return typeof window !== "undefined" && window.location.pathname.includes("/lubirth-atmosphere-spike");
}

function hasExplicitRuntimeSolarInput() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const location = params.get("location");
  return params.has("sunDate") ||
    params.has("solarDate") ||
    location === "ip" ||
    location === "visitor" ||
    params.has("geoLat") ||
    params.has("geoLon");
}

function readMobileLandscape() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth > window.innerHeight && Math.min(window.innerWidth, window.innerHeight) < 760;
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
  if (isAtmosphereSpikeRoute()) {
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

function readCachedVisitorLocation(endpoint: string): { endpoint: string; location: LandingLocationConfig } | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(VISITOR_LOCATION_CACHE_KEY) ??
      window.localStorage.getItem(VISITOR_LOCATION_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as {
      endpoint?: string;
      location?: Partial<LandingLocationConfig>;
    };
    const location = cached.location;
    if (
      cached.endpoint !== endpoint ||
      !location ||
      typeof location.latitudeDeg !== "number" ||
      typeof location.longitudeDeg !== "number"
    ) {
      return null;
    }

    return {
      endpoint,
      location: {
        latitudeDeg: location.latitudeDeg,
        longitudeDeg: location.longitudeDeg,
        label: location.label || "Visitor location",
        ...(location.timeZone ? { timeZone: location.timeZone } : {}),
        source: location.source === "manual" ? "manual" : "ip-geo"
      }
    };
  } catch {
    return null;
  }
}

function cacheVisitorLocation(endpoint: string, location: LandingLocationConfig) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload = JSON.stringify({ endpoint, location });
    window.sessionStorage.setItem(VISITOR_LOCATION_CACHE_KEY, payload);
    window.localStorage.setItem(VISITOR_LOCATION_CACHE_KEY, payload);
  } catch {
    // Cache is a smoothness enhancement only.
  }
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
  atmospherePolicy,
  atmosphereVariant = "stack",
  atmosphereLook = "lubirth",
  routeVariant,
  homeIntroRendering = false,
  productionSurface,
  paused = false,
  cloudDeckEnabled = true,
  onProjectionFrame,
  onVisualReadyEnough,
  onMoonTextureReady
}: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityOverride = readQualityOverride();
  const auroraProfile = readAuroraProfile();
  const renderProfileOverride = readRenderProfileOverride();
  const activeRenderProfile = renderProfileOverride ?? renderProfile;
  const activeRouteVariant: LuBirthAtmosphereRouteVariant =
    routeVariant ?? (isAtmosphereSpikeRoute() ? "spike" : "study");
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
  const resolvedAtmospherePolicy = resolveLuBirthAtmospherePolicy({
    policy: atmospherePolicy ?? atmosphereVariant,
    routeVariant: activeRouteVariant,
    renderProfile: activeRenderProfile ?? "nasa",
    requestedQuality: qualityOverride ?? quality,
    resolvedQualityTier: qualityProfile.tier,
    reducedMotion,
    mobileLandscape: readMobileLandscape(),
    homeIntroRendering,
    productionSurface: productionSurface ?? activeRouteVariant !== "spike",
    productionLook: atmosphereLook
  });
  const moonLightingMode = readMoonLightingMode();
  const freezeAtmosphereSpikeSolar = isAtmosphereSpikeRoute() && !hasExplicitRuntimeSolarInput();
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
  const cachedVisitorLocationState = useMemo(
    () => geoEndpoint ? readCachedVisitorLocation(geoEndpoint) : null,
    [geoEndpoint]
  );
  const [visitorLocationState, setVisitorLocationState] = useState<{
    endpoint: string;
    location: LandingLocationConfig;
  } | null>(() => cachedVisitorLocationState);
  const activeVisitorLocation =
    manualGeoLocation ??
    (geoEndpoint && visitorLocationState?.endpoint === geoEndpoint ? visitorLocationState.location : null);

  useEffect(() => {
    if (!cachedVisitorLocationState || visitorLocationState?.endpoint === cachedVisitorLocationState.endpoint) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setVisitorLocationState(cachedVisitorLocationState);
      window.__MiraLithLuBirthRuntimeLocation = cachedVisitorLocationState.location;
    });

    return () => {
      cancelled = true;
    };
  }, [cachedVisitorLocationState, visitorLocationState?.endpoint]);

  const compositionOverrides = useMemo<LandingCompositionOverrides>(
    () => {
      const useRuntimeSolar =
        !freezeAtmosphereSpikeSolar &&
        (activeRenderProfile === "nasa" || moonPhaseOverride === "today" || Boolean(activeVisitorLocation));
      const referenceAtmosphereLook = atmosphereLook === "reference";
      const resolvedMoonLightingMode =
        moonLightingMode ?? (moonPhaseOverride === "today" ? "birthPhase" : undefined);
      const moon: NonNullable<LandingCompositionOverrides["moon"]> = {
        ...(resolvedMoonLightingMode ? { lightingMode: resolvedMoonLightingMode } : {}),
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
        ...(referenceAtmosphereLook
          ? {
              atmosphere: { intensity: 1.0 },
              earth: {
                cloudOpacity: 3.0,
                edgeLightStrength: 0,
                edgeLightWidth: 2.2,
                edgeNeedleStrength: 0,
                rimStrength: 0
              },
              light: {
                fixedSunDir: useRuntimeSolar ? runtimeSunDirection : REFERENCE_ATMOSPHERE_SUN_DIRECTION,
                ambientIntensity: 0.014,
                intensity: 2.2
              }
            }
          : {}),
        ...(activeVisitorLocation ? { location: activeVisitorLocation } : {})
      };
    },
    [
      activeRenderProfile,
      atmosphereLook,
      activeVisitorLocation,
      freezeAtmosphereSpikeSolar,
      moonLightingMode,
      moonPhaseOverride,
      runtimeSunDirection,
      todayMoonPhase
    ]
  );
  const composition = useMemo(
    () => resolveLandingPreset(mode, compositionOverrides),
    [compositionOverrides, mode]
  );
  const forceReferenceSpikeHighDetailAssets =
    isAtmosphereSpikeRoute() &&
    resolvedAtmospherePolicy.atmosphereVariant === "volumetric" &&
    atmosphereLook === "reference" &&
    quality !== "low" &&
    typeof window !== "undefined" &&
    Math.min(window.innerWidth, window.innerHeight) >= 760;
  const useHighDetailEarthAssets = qualityProfile.tier === "high" || forceReferenceSpikeHighDetailAssets;
  const assets = resolveLandingAssets(
    useHighDetailEarthAssets
      ? forceReferenceSpikeHighDetailAssets
        ? HIGH_DETAIL_REFERENCE_EARTH_ASSETS
        : HIGH_DETAIL_EARTH_ASSETS
      : undefined
  );

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
        cacheVisitorLocation(geoEndpoint, nextLocation);
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
    window.__MiraLithLuBirthAtmospherePolicy = atmospherePolicy ?? atmosphereVariant;
    window.__MiraLithLuBirthAtmospherePolicyReason = resolvedAtmospherePolicy.reason;
    window.__MiraLithLuBirthAtmosphereLook = resolvedAtmospherePolicy.atmosphereLook;
    window.__MiraLithLuBirthMoonPhase = composition.moon.fixedPhase;
    window.__MiraLithLuBirthMoonLightingMode = composition.moon.lightingMode;
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
    atmospherePolicy,
    atmosphereVariant,
    auroraProfile,
    composition.location.latitudeDeg,
    composition.location.longitudeDeg,
    composition.moon.fixedPhase,
    composition.moon.lightingMode,
    qualityProfile.aurora,
    qualityProfile.tier,
    resolvedAtmospherePolicy.atmosphereLook,
    resolvedAtmospherePolicy.reason,
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
      atmosphereVariant={resolvedAtmospherePolicy.atmosphereVariant}
      atmosphereLook={resolvedAtmospherePolicy.atmosphereLook}
      auroraProfile={auroraProfile}
      reducedMotion={reducedMotion}
      paused={paused}
      cloudDeckEnabled={cloudDeckEnabled}
      onProjectionFrame={onProjectionFrame}
      onVisualReadyEnough={onVisualReadyEnough}
      onMoonTextureReady={onMoonTextureReady}
    />
  );
}
