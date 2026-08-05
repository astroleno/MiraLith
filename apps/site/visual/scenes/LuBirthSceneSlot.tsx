"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  EarthMoonScene,
  EMPTY_CLOSE_ATMOSPHERE_TUNING,
  LUBIRTH_NASA_LITE_DESKTOP_ASSETS,
  LUBIRTH_NASA_LITE_MOBILE_ASSETS,
  LUBIRTH_RELIEF_LITE_DESKTOP_ASSETS,
  LUBIRTH_RELIEF_LITE_MOBILE_ASSETS,
  DEFAULT_LUBIRTH_DATE,
  computeRuntimeMoonPhase,
  computeRuntimeSolarDirection,
  geodeticToTextureVector,
  isLandingReliefLiteMobileViewport,
  isLandingNasaLiteMobileViewport,
  resolveLandingAssets,
  resolveLandingCloseAtmosphereTuning,
  resolveLandingPreset,
  resolveLandingVisualPolicy,
  resolveLuBirthAtmospherePolicy
} from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type {
  LandingAssetManifest,
  LandingAtmosphereLook,
  LandingAtmosphereMode,
  LandingAtmospherePolicy,
  LandingAtmosphereVariant,
  LandingAuroraProfile,
  LandingPostEffectMode,
  LandingCloseAtmosphereTuning,
  LandingCloudMode,
  LandingCompositionOverrides,
  EarthMoonHeroMode,
  LandingLocationConfig,
  LandingMoonLightingMode,
  LandingMoonPhase,
  LandingRenderProfile,
  LandingRuntimeProfile,
  LandingVisualDebugLayer,
  LandingVisualPolicy,
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

const VISITOR_LOCATION_CACHE_KEY = "miralith:lubirth-runtime-location:v2";
const VISITOR_LOCATION_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
// Matches the reference demo's default slider sunTheta=80, sunPhi=3 without tying light to the camera.
const REFERENCE_ATMOSPHERE_SUN_DIRECTION: [number, number, number] = [0.34, 0.18, 0.923];

export function resolveHomeEarthEdgeProfile(
  routeVariant: LuBirthAtmosphereRouteVariant
): NonNullable<LandingCompositionOverrides["earth"]> | undefined {
  if (routeVariant !== "home") {
    return undefined;
  }

  return {
    rimStrength: 0.68,
    rimWidth: 1.9,
    edgeLightStrength: 0.54,
    edgeLightWidth: 6.6,
    edgeNeedleStrength: 0.16,
    edgeShadowSoftness: 0.22
  };
}

export function resolveHomeEarthSurfaceProfile(
  routeVariant: LuBirthAtmosphereRouteVariant
): NonNullable<LandingCompositionOverrides["earth"]> | undefined {
  if (routeVariant !== "home") {
    return undefined;
  }

  return {
    segments: 144,
    cloudOpacity: 0.62,
    nightIntensity: 0.76,
    nightSurfaceLift: 0.16
  };
}

export function resolveLandingRuntimeProfile(
  routeVariant: LuBirthAtmosphereRouteVariant
): LandingRuntimeProfile {
  return routeVariant === "home" ? "home-lite" : "full";
}

declare global {
  interface Window {
    __MiraLithLuBirthQualityTier?: string;
    __MiraLithLuBirthRuntimeProfile?: LandingRuntimeProfile;
    __MiraLithLuBirthVisualPolicy?: LandingVisualPolicy;
    __MiraLithLuBirthAuroraEnabled?: boolean;
    __MiraLithLuBirthAuroraProfile?: LandingAuroraProfile;
    __MiraLithLuBirthAtmospherePolicy?: LandingAtmospherePolicy;
    __MiraLithLuBirthAtmospherePolicyReason?: string;
    __MiraLithLuBirthAtmosphereLook?: LandingAtmosphereLook;
    __MiraLithLuBirthMoonPhase?: LandingMoonPhase;
    __MiraLithLuBirthMoonPhaseMode?: "birth" | "today";
    __MiraLithLuBirthMoonLightingMode?: LandingMoonLightingMode;
    __MiraLithLuBirthCloseAtmosphereTuning?: {
      allowed: boolean;
      effective: LandingCloseAtmosphereTuning;
      requested: LandingCloseAtmosphereTuning;
    };
    __MiraLithLuBirthRuntimeLocation?: LandingLocationConfig;
    __MiraLithLuBirthSolarState?: {
      date: string;
      localTime?: string;
      locationLabel?: string;
      locationSunDot?: number;
      source: "birth-preset-solar" | "explicit-solar-date" | "runtime-solar";
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
  closeAtmosphereTuning?: Partial<LandingCloseAtmosphereTuning>;
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

function readPostEffectModeOverride(): LandingPostEffectMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("postEffect") ?? params.get("bloom");
  if (mode === "off") {
    return "off";
  }
  if (mode === "analytic-halo" || mode === "lite") {
    return "analytic-halo";
  }
  if (mode === "full-bloom" || mode === "full") {
    return "full-bloom";
  }
  return undefined;
}

function readCloudModeOverride(): LandingCloudMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const mode = new URLSearchParams(window.location.search).get("cloud");
  return mode === "surface" ||
    mode === "shell-lite" ||
    mode === "nasa-lite" ||
    mode === "relief-lite" ||
    mode === "lookdev"
    ? mode
    : undefined;
}

function readAtmosphereVisualModeOverride(): LandingAtmosphereMode | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const mode = new URLSearchParams(window.location.search).get("atmosphereMode");
  return mode === "surface-glow" ||
    mode === "directional-lite" ||
    mode === "limb-lite" ||
    mode === "lookdev"
    ? mode
    : undefined;
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

export function resolveMoonPhaseMode({
  renderProfile,
  requestedMode,
  routeVariant
}: {
  renderProfile?: LandingRenderProfile;
  requestedMode?: string | null;
  routeVariant: LuBirthAtmosphereRouteVariant;
}): "birth" | "today" {
  const mode = requestedMode;
  if (mode === "birth" || mode === "fixed") {
    return "birth";
  }
  if (mode === "today" || mode === "runtime") {
    return "today";
  }

  if (routeVariant === "home") {
    return "birth";
  }

  return renderProfile === "nasa" ? "today" : "birth";
}

function readMoonPhaseOverride(
  activeRenderProfile: LandingRenderProfile | undefined,
  routeVariant: LuBirthAtmosphereRouteVariant
): "birth" | "today" {
  return resolveMoonPhaseMode({
    renderProfile: activeRenderProfile,
    requestedMode: typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("moonPhase"),
    routeVariant
  });
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

function resolveDefaultLuBirthSolarDate() {
  const explicitChinaTime = `${DEFAULT_LUBIRTH_DATE}+08:00`;
  const parsed = new Date(explicitChinaTime);
  return Number.isFinite(parsed.getTime())
    ? parsed
    : new Date(DEFAULT_LUBIRTH_DATE);
}

function isAtmosphereSpikeRoute() {
  return typeof window !== "undefined" && (
    window.location.pathname.includes("/lubirth-atmosphere-spike") ||
    window.location.pathname.includes("/lubirth-close-atmosphere-spike")
  );
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

function readLocationOverride(
  activeRenderProfile: LandingRenderProfile | undefined,
  routeVariant: LuBirthAtmosphereRouteVariant
): "birth" | "ip" {
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
  if (routeVariant === "home") {
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
      cachedAt?: number;
      endpoint?: string;
      location?: Partial<LandingLocationConfig>;
    };
    const location = cached.location;
    if (
      typeof cached.cachedAt !== "number" ||
      Date.now() - cached.cachedAt > VISITOR_LOCATION_CACHE_TTL_MS ||
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
    const payload = JSON.stringify({ cachedAt: Date.now(), endpoint, location });
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
  closeAtmosphereTuning,
  onProjectionFrame,
  onVisualReadyEnough,
  onMoonTextureReady
}: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityOverride = readQualityOverride();
  const postEffectModeOverride = readPostEffectModeOverride();
  const cloudModeOverride = readCloudModeOverride();
  const atmosphereVisualModeOverride = readAtmosphereVisualModeOverride();
  const auroraProfile = readAuroraProfile();
  const renderProfileOverride = readRenderProfileOverride();
  const activeRenderProfile = renderProfileOverride ?? renderProfile;
  const activeRouteVariant: LuBirthAtmosphereRouteVariant =
    routeVariant ?? (isAtmosphereSpikeRoute() ? "spike" : "study");
  const runtimeProfile = resolveLandingRuntimeProfile(activeRouteVariant);
  const moonPhaseOverride = readMoonPhaseOverride(activeRenderProfile, activeRouteVariant);
  const moonDateOverride = readMoonDateOverride();
  const sunDateOverride = readSunDateOverride();
  const explicitRuntimeSolarInput = hasExplicitRuntimeSolarInput();
  const locationOverride = readLocationOverride(activeRenderProfile, activeRouteVariant);
  const manualGeoLocation = useMemo(() => readManualGeoLocation(), []);
  const geoEndpoint =
    locationOverride === "ip" && typeof window !== "undefined" && !manualGeoLocation
      ? buildGeoEndpoint()
      : null;
  const qualityProfile = useQualityTier(qualityOverride ?? quality, reducedMotion);
  const visualPolicy = useMemo(
    () => resolveLandingVisualPolicy({
      runtimeProfile,
      qualityTier: qualityProfile.tier,
      renderProfile: activeRenderProfile ?? "nasa",
      overrides: {
        ...(postEffectModeOverride ? { postEffectMode: postEffectModeOverride } : {}),
        ...(cloudModeOverride ? { cloudMode: cloudModeOverride } : {}),
        ...(atmosphereVisualModeOverride
          ? { atmosphereMode: atmosphereVisualModeOverride }
          : {})
      }
    }),
    [
      activeRenderProfile,
      atmosphereVisualModeOverride,
      cloudModeOverride,
      postEffectModeOverride,
      qualityProfile.tier,
      runtimeProfile
    ]
  );
  const requestedCloseAtmosphereTuning = useMemo<LandingCloseAtmosphereTuning>(
    () => resolveLandingCloseAtmosphereTuning({
      runtimeProfile,
      overrides: closeAtmosphereTuning
    }),
    [closeAtmosphereTuning, runtimeProfile]
  );
  const closeAtmosphereAllowed = qualityProfile.tier !== "low" && qualityProfile.tier !== "fallback";
  const effectiveCloseAtmosphereTuning = useMemo<LandingCloseAtmosphereTuning>(
    () => closeAtmosphereAllowed
      ? requestedCloseAtmosphereTuning
      : { ...EMPTY_CLOSE_ATMOSPHERE_TUNING },
    [closeAtmosphereAllowed, requestedCloseAtmosphereTuning]
  );
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
  const runtimeSolarDate = useMemo(() => {
    if (sunDateOverride) {
      return new Date(sunDateOverride);
    }
    if (moonPhaseOverride === "today" || explicitRuntimeSolarInput) {
      return new Date();
    }
    return resolveDefaultLuBirthSolarDate();
  }, [explicitRuntimeSolarInput, moonPhaseOverride, sunDateOverride]);
  const solarStateSource = sunDateOverride
    ? "explicit-solar-date"
    : moonPhaseOverride === "today" || explicitRuntimeSolarInput
      ? "runtime-solar"
      : "birth-preset-solar";
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
      const referenceAtmosphereLook = atmosphereLook === "reference";
      const unifyReferenceMoonLighting =
        activeRouteVariant === "spike" &&
        activeRenderProfile === "nasa" &&
        referenceAtmosphereLook;
      const useRuntimeSolar =
        !unifyReferenceMoonLighting &&
        !freezeAtmosphereSpikeSolar &&
        (moonPhaseOverride === "today" || explicitRuntimeSolarInput || solarStateSource === "birth-preset-solar");
      const referenceCloseOrbitLook = unifyReferenceMoonLighting;
      const homeEarthEdgeProfile = resolveHomeEarthEdgeProfile(activeRouteVariant);
      const homeEarthSurfaceProfile = resolveHomeEarthSurfaceProfile(activeRouteVariant);
      const resolvedMoonLightingMode =
        moonLightingMode ??
        (unifyReferenceMoonLighting
          ? "sceneLit"
          : moonPhaseOverride === "today"
            ? "birthPhase"
            : undefined);
      const moon: NonNullable<LandingCompositionOverrides["moon"]> = {
        ...(referenceCloseOrbitLook ? { visible: true, nightLift: 0.012 } : {}),
        ...(resolvedMoonLightingMode ? { lightingMode: resolvedMoonLightingMode } : {}),
        ...(moonPhaseOverride === "today"
          ? {
              date: todayMoonPhase.date,
              phaseMode: "runtime-ephemeris",
              fixedPhase: todayMoonPhase
            }
          : {})
      };
      const earth: NonNullable<LandingCompositionOverrides["earth"]> = {
        ...homeEarthEdgeProfile,
        ...homeEarthSurfaceProfile,
        ...(referenceAtmosphereLook
          ? {
              cloudOpacity: 3.0,
              edgeLightStrength: 0,
              edgeLightWidth: 2.2,
              edgeNeedleStrength: 0,
              rimStrength: 0
            }
          : {})
      };

      return {
        ...(Object.keys(moon).length > 0 ? { moon } : {}),
        ...(Object.keys(earth).length > 0 ? { earth } : {}),
        ...(useRuntimeSolar ? { light: { fixedSunDir: runtimeSunDirection } } : {}),
        ...(referenceAtmosphereLook
          ? {
              ...(referenceCloseOrbitLook ? { camera: { fov: 40 } } : {}),
              atmosphere: { intensity: 1.0 },
              light: {
                fixedSunDir: useRuntimeSolar ? runtimeSunDirection : REFERENCE_ATMOSPHERE_SUN_DIRECTION,
                ambientIntensity: 0.024,
                intensity: 2.55
              }
            }
          : {}),
        ...(activeVisitorLocation ? { location: activeVisitorLocation } : {})
      };
    },
    [
      activeRenderProfile,
      atmosphereLook,
      activeRouteVariant,
      activeVisitorLocation,
      explicitRuntimeSolarInput,
      freezeAtmosphereSpikeSolar,
      moonLightingMode,
      moonPhaseOverride,
      runtimeSunDirection,
      solarStateSource,
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
  const useReliefLiteAssets =
    visualPolicy.cloudMode === "relief-lite" ||
    visualPolicy.atmosphereMode === "limb-lite";
  const useNasaLiteAssets =
    visualPolicy.cloudMode === "nasa-lite" ||
    visualPolicy.atmosphereMode === "directional-lite";
  const useMobileLiteAssets =
    typeof window !== "undefined" &&
    (
      useReliefLiteAssets
        ? isLandingReliefLiteMobileViewport(
            window.innerWidth,
            window.innerHeight,
            navigator.maxTouchPoints
          )
        : isLandingNasaLiteMobileViewport(
            window.innerWidth,
            window.innerHeight,
            navigator.maxTouchPoints
          )
    );
  const assets = resolveLandingAssets(
    useReliefLiteAssets
      ? useMobileLiteAssets
        ? LUBIRTH_RELIEF_LITE_MOBILE_ASSETS
        : LUBIRTH_RELIEF_LITE_DESKTOP_ASSETS
      : useNasaLiteAssets
      ? useMobileLiteAssets
        ? LUBIRTH_NASA_LITE_MOBILE_ASSETS
        : LUBIRTH_NASA_LITE_DESKTOP_ASSETS
      : useHighDetailEarthAssets
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

    fetch(geoEndpoint)
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
          if (!cancelled) {
            setVisitorLocationState(null);
            window.__MiraLithLuBirthRuntimeLocation = undefined;
          }
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
    window.__MiraLithLuBirthRuntimeProfile = runtimeProfile;
    window.__MiraLithLuBirthVisualPolicy = visualPolicy;
    window.__MiraLithLuBirthAuroraEnabled = qualityProfile.aurora;
    window.__MiraLithLuBirthAuroraProfile = auroraProfile;
    window.__MiraLithLuBirthAtmospherePolicy = atmospherePolicy ?? atmosphereVariant;
    window.__MiraLithLuBirthAtmospherePolicyReason = resolvedAtmospherePolicy.reason;
    window.__MiraLithLuBirthAtmosphereLook = resolvedAtmospherePolicy.atmosphereLook;
    window.__MiraLithLuBirthCloseAtmosphereTuning = {
      allowed: closeAtmosphereAllowed,
      effective: effectiveCloseAtmosphereTuning,
      requested: requestedCloseAtmosphereTuning
    };
    window.__MiraLithLuBirthMoonPhase = composition.moon.fixedPhase;
    window.__MiraLithLuBirthMoonPhaseMode = moonPhaseOverride;
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
      source: solarStateSource,
      sunDirection: [runtimeSunDirection[0], runtimeSunDirection[1], runtimeSunDirection[2]],
      timeZone: activeVisitorLocation?.timeZone
    };
  }, [
    activeVisitorLocation,
    atmospherePolicy,
    atmosphereVariant,
    auroraProfile,
    closeAtmosphereAllowed,
    composition.location.latitudeDeg,
    composition.location.longitudeDeg,
    composition.moon.fixedPhase,
    composition.moon.lightingMode,
    effectiveCloseAtmosphereTuning,
    qualityProfile.aurora,
    qualityProfile.tier,
    moonPhaseOverride,
    runtimeProfile,
    visualPolicy,
    requestedCloseAtmosphereTuning,
    resolvedAtmospherePolicy.atmosphereLook,
    solarStateSource,
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
      runtimeProfile={runtimeProfile}
      visualPolicy={visualPolicy}
      atmosphereVariant={resolvedAtmospherePolicy.atmosphereVariant}
      atmosphereLook={resolvedAtmospherePolicy.atmosphereLook}
      auroraProfile={auroraProfile}
      reducedMotion={reducedMotion}
      paused={paused}
      cloudDeckEnabled={cloudDeckEnabled}
      closeAtmosphereTuning={effectiveCloseAtmosphereTuning}
      onProjectionFrame={onProjectionFrame}
      onVisualReadyEnough={onVisualReadyEnough}
      onMoonTextureReady={onMoonTextureReady}
    />
  );
}
