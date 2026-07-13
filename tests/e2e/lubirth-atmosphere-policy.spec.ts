import { expect, test } from "@playwright/test";
import * as luBirthSceneSlot from "../../apps/site/visual/scenes/LuBirthSceneSlot";
import * as landingCloudLayer from "../../packages/lubirth-hero/src/LandingCloudLayer";
import * as landingEarthLite from "../../packages/lubirth-hero/src/LandingEarthLite";
import * as landingPostEffect from "../../packages/lubirth-hero/src/LandingPostEffect";
import { resolveLuBirthAtmospherePolicy } from "../../packages/lubirth-hero/src/atmospherePolicy";
import { resolveLandingVisualPolicy } from "../../packages/lubirth-hero/src/landingVisualPolicy";
import {
  EMPTY_CLOSE_ATMOSPHERE_TUNING,
  HOME_CLOSE_ATMOSPHERE_TUNING,
  resolveLandingCloseAtmosphereTuning
} from "../../packages/lubirth-hero/src/landingAtmosphereTuning";
import type { LuBirthAtmospherePolicyInput } from "../../packages/lubirth-hero/src/atmospherePolicy";

const baseInput: LuBirthAtmospherePolicyInput = {
  policy: "stack",
  routeVariant: "study",
  renderProfile: "nasa",
  requestedQuality: "high",
  resolvedQualityTier: "high",
  reducedMotion: false,
  mobileLandscape: false,
  homeIntroRendering: false,
  productionSurface: true,
  productionLook: "lubirth"
};

function resolve(overrides: Partial<LuBirthAtmospherePolicyInput>) {
  return resolveLuBirthAtmospherePolicy({ ...baseInput, ...overrides });
}

test("defaults only the production home to the birth moon unless today is explicit", () => {
  type ResolveMoonPhaseMode = (input: {
    renderProfile?: "clean" | "nasa";
    requestedMode?: string | null;
    routeVariant: "home" | "study" | "spike";
  }) => "birth" | "today";
  const resolveMoonPhaseMode = (
    luBirthSceneSlot as unknown as { resolveMoonPhaseMode?: ResolveMoonPhaseMode }
  ).resolveMoonPhaseMode;

  expect(resolveMoonPhaseMode).toBeDefined();
  expect(resolveMoonPhaseMode?.({ renderProfile: "nasa", routeVariant: "home" })).toBe("birth");
  expect(resolveMoonPhaseMode?.({ renderProfile: "nasa", requestedMode: "today", routeVariant: "home" })).toBe("today");
  expect(resolveMoonPhaseMode?.({ renderProfile: "nasa", requestedMode: "runtime", routeVariant: "home" })).toBe("today");
  expect(resolveMoonPhaseMode?.({ renderProfile: "nasa", requestedMode: "fixed", routeVariant: "home" })).toBe("birth");
  expect(resolveMoonPhaseMode?.({ renderProfile: "nasa", routeVariant: "study" })).toBe("today");
});

test("keeps every analytic halo texture boundary pixel fully transparent", () => {
  type CreateLiteBloomTextureData = () => {
    pixels: Uint8Array;
    size: number;
  };
  const createLiteBloomTextureData = (
    landingPostEffect as unknown as { createLiteBloomTextureData?: CreateLiteBloomTextureData }
  ).createLiteBloomTextureData;

  expect(createLiteBloomTextureData).toBeDefined();
  const data = createLiteBloomTextureData?.();
  expect(data).toBeDefined();
  if (!data) {
    return;
  }

  const boundaryAlpha: number[] = [];
  for (let index = 0; index < data.size; index += 1) {
    const top = index * 4 + 3;
    const bottom = ((data.size - 1) * data.size + index) * 4 + 3;
    const left = (index * data.size) * 4 + 3;
    const right = (index * data.size + data.size - 1) * 4 + 3;
    boundaryAlpha.push(data.pixels[top], data.pixels[bottom], data.pixels[left], data.pixels[right]);
  }

  expect(Math.max(...boundaryAlpha)).toBe(0);
});

test("separates lite Earth day, deep night, city gate, and a narrow terminator", () => {
  type ResolveLiteEarthLightingWeights = (ndl: number, terminatorSoftness: number) => {
    cityGate: number;
    dayWeight: number;
    deepNightWeight: number;
    nightWeight: number;
    terminatorBand: number;
  };
  const resolveLiteEarthLightingWeights = (
    landingEarthLite as unknown as { resolveLiteEarthLightingWeights?: ResolveLiteEarthLightingWeights }
  ).resolveLiteEarthLightingWeights;

  expect(resolveLiteEarthLightingWeights).toBeDefined();
  const day = resolveLiteEarthLightingWeights?.(0.65, 0.13);
  const twilight = resolveLiteEarthLightingWeights?.(0, 0.13);
  const deepNight = resolveLiteEarthLightingWeights?.(-0.65, 0.13);

  expect(day).toMatchObject({ dayWeight: 1, nightWeight: 0, cityGate: 0 });
  expect(deepNight).toMatchObject({ dayWeight: 0, nightWeight: 1, deepNightWeight: 1 });
  expect((day?.cityGate ?? 1) / Math.max(deepNight?.cityGate ?? 0, 1e-6)).toBeLessThan(0.05);
  expect(twilight?.terminatorBand).toBeGreaterThan(0.95);
  expect(twilight?.dayWeight).toBeCloseTo(0.5, 6);
  expect((twilight?.dayWeight ?? 0) + (twilight?.nightWeight ?? 0)).toBeCloseTo(1, 6);

  const model = (
    landingEarthLite as unknown as {
      LITE_EARTH_LIGHTING_MODEL?: { closeExposureMax: number; closeExposureMin: number; terminatorTintStrength: number };
    }
  ).LITE_EARTH_LIGHTING_MODEL;
  expect(model).toBeDefined();
  expect((model?.closeExposureMax ?? 2) - (model?.closeExposureMin ?? 0)).toBeLessThanOrEqual(0.1);
  expect(model?.terminatorTintStrength).toBeGreaterThanOrEqual(0.035);
  expect(model?.terminatorTintStrength).toBeLessThanOrEqual(0.065);
});

test("resolves the production home medium visual policy", () => {
  expect(resolveLandingVisualPolicy({
    runtimeProfile: "home-lite",
    qualityTier: "medium",
    renderProfile: "nasa"
  })).toEqual({
    cloudMode: "shell-lite",
    groundShadow: true,
    atmosphereMode: "surface-glow",
    postEffectMode: "analytic-halo",
    reason: "home-lite"
  });
});

test("resolves low quality to the surface-only safety policy", () => {
  expect(resolveLandingVisualPolicy({
    runtimeProfile: "home-lite",
    qualityTier: "low",
    renderProfile: "nasa"
  })).toEqual({
    cloudMode: "surface",
    groundShadow: false,
    atmosphereMode: "surface-glow",
    postEffectMode: "off",
    reason: "quality-low"
  });
});

test("keeps study and debug routes on full lookdev policies", () => {
  expect(resolveLandingVisualPolicy({
    runtimeProfile: "full",
    qualityTier: "medium",
    renderProfile: "nasa"
  })).toMatchObject({ cloudMode: "lookdev", groundShadow: true, postEffectMode: "full-bloom" });

  expect(resolveLandingVisualPolicy({
    runtimeProfile: "home-lite",
    qualityTier: "medium",
    renderProfile: "debug-atmosphere"
  })).toMatchObject({
    cloudMode: "lookdev",
    groundShadow: true,
    atmosphereMode: "lookdev",
    postEffectMode: "full-bloom"
  });
});

test("gives production home an explicit close atmosphere preset", () => {
  const homeTuning = resolveLandingCloseAtmosphereTuning({ runtimeProfile: "home-lite" });
  const studyTuning = resolveLandingCloseAtmosphereTuning({ runtimeProfile: "full" });

  expect(homeTuning).toEqual(HOME_CLOSE_ATMOSPHERE_TUNING);
  expect(homeTuning.edgeGlowStrength).toBeGreaterThan(0);
  expect(homeTuning.groundProjectionStrength).toBeGreaterThan(0);
  expect(studyTuning).toEqual(EMPTY_CLOSE_ATMOSPHERE_TUNING);
  expect(resolveLandingCloseAtmosphereTuning({
    runtimeProfile: "home-lite",
    overrides: { edgeGlowStrength: 1.4 }
  }).edgeGlowStrength).toBe(1.4);
});

test("explicit stack policy stays on the stack path", () => {
  expect(resolve({ policy: "stack" })).toEqual({
    atmosphereLook: "lubirth",
    atmosphereVariant: "stack",
    reason: "policy-stack"
  });
});

test("spike volumetric review allows high and medium desktop but keeps low on stack", () => {
  expect(resolve({
    policy: "volumetric",
    productionSurface: false,
    routeVariant: "spike",
    requestedQuality: "high",
    resolvedQualityTier: "high"
  }).atmosphereVariant).toBe("volumetric");

  expect(resolve({
    policy: "volumetric",
    productionSurface: false,
    routeVariant: "spike",
    requestedQuality: "medium",
    resolvedQualityTier: "medium"
  }).atmosphereVariant).toBe("volumetric");

  expect(resolve({
    policy: "volumetric",
    productionSurface: false,
    routeVariant: "spike",
    requestedQuality: "low",
    resolvedQualityTier: "low"
  })).toMatchObject({
    atmosphereVariant: "stack",
    reason: "quality-low-stack"
  });
});

test("mobile landscape medium remains stack while explicit high can be reviewed in spike", () => {
  expect(resolve({
    policy: "volumetric",
    productionSurface: false,
    routeVariant: "spike",
    requestedQuality: "medium",
    resolvedQualityTier: "medium",
    mobileLandscape: true
  })).toMatchObject({
    atmosphereVariant: "stack",
    reason: "mobile-landscape-safe-stack"
  });

  expect(resolve({
    policy: "volumetric",
    productionSurface: false,
    routeVariant: "spike",
    requestedQuality: "high",
    resolvedQualityTier: "high",
    mobileLandscape: true
  }).atmosphereVariant).toBe("volumetric");
});

test("production safety beats explicit volumetric requests", () => {
  expect(resolve({
    policy: "volumetric",
    requestedQuality: "high",
    resolvedQualityTier: "high",
    mobileLandscape: true
  })).toMatchObject({
    atmosphereVariant: "stack",
    reason: "production-mobile-landscape-stack"
  });

  expect(resolve({
    policy: "volumetric",
    requestedQuality: "high",
    resolvedQualityTier: "high",
    reducedMotion: true
  })).toMatchObject({
    atmosphereVariant: "stack",
    reason: "reduced-motion-stack"
  });

  expect(resolve({
    policy: "volumetric",
    renderProfile: "debug-atmosphere",
    requestedQuality: "high",
    resolvedQualityTier: "high"
  })).toMatchObject({
    atmosphereVariant: "stack",
    reason: "production-debug-profile-stack"
  });
});

test("hybrid only chooses volumetric for nasa high production after intro", () => {
  expect(resolve({ policy: "hybrid" })).toMatchObject({
    atmosphereVariant: "volumetric",
    reason: "hybrid-nasa-high-production"
  });

  expect(resolve({
    policy: "hybrid",
    requestedQuality: "medium",
    resolvedQualityTier: "medium"
  })).toMatchObject({
    atmosphereVariant: "stack",
    reason: "hybrid-safe-stack"
  });

  expect(resolve({
    policy: "hybrid",
    homeIntroRendering: true
  })).toMatchObject({
    atmosphereVariant: "stack",
    reason: "home-intro-stack"
  });
});

test("scopes strong cloud shells to the full lookdev renderer", () => {
  type CloudShellPolicy = {
    opacity: number;
    limbFadeEnd: number;
  };
  type ResolveLandingCloudShells = (
    qualityTier: "high" | "medium" | "low" | "fallback",
    referenceLook: boolean
  ) => readonly CloudShellPolicy[];

  const resolveLandingCloudShells = (
    landingCloudLayer as unknown as { resolveLandingCloudShells?: ResolveLandingCloudShells }
  ).resolveLandingCloudShells;

  expect(resolveLandingCloudShells).toBeDefined();

  const lookdevShells = resolveLandingCloudShells?.("high", false) ?? [];
  const referenceShells = resolveLandingCloudShells?.("high", true) ?? [];

  expect(lookdevShells).toHaveLength(3);
  expect(referenceShells).toHaveLength(3);
  expect(lookdevShells[0]?.opacity).toBeLessThanOrEqual(0.56);
  expect(referenceShells[0]?.opacity).toBeGreaterThan(lookdevShells[0]?.opacity ?? 1);
  expect(lookdevShells.every((shell) => shell.limbFadeEnd <= 0.92)).toBe(true);
});

test("uses a restrained Earth edge profile only on the production home route", () => {
  type ResolveHomeEarthEdgeProfile = (routeVariant: "home" | "study" | "spike") => {
    rimStrength: number;
    edgeLightStrength: number;
    edgeNeedleStrength: number;
  } | undefined;

  const resolveHomeEarthEdgeProfile = (
    luBirthSceneSlot as unknown as { resolveHomeEarthEdgeProfile?: ResolveHomeEarthEdgeProfile }
  ).resolveHomeEarthEdgeProfile;

  expect(resolveHomeEarthEdgeProfile).toBeDefined();
  expect(resolveHomeEarthEdgeProfile?.("home")).toMatchObject({
    rimStrength: 0.68,
    edgeLightStrength: 0.54,
    edgeNeedleStrength: 0.16
  });
  expect(resolveHomeEarthEdgeProfile?.("study")).toBeUndefined();
  expect(resolveHomeEarthEdgeProfile?.("spike")).toBeUndefined();
});

test("keeps the production home night surface readable without changing study routes", () => {
  type ResolveHomeEarthSurfaceProfile = (routeVariant: "home" | "study" | "spike") => {
    nightIntensity: number;
    nightSurfaceLift: number;
    segments: number;
  } | undefined;

  const resolveHomeEarthSurfaceProfile = (
    luBirthSceneSlot as unknown as { resolveHomeEarthSurfaceProfile?: ResolveHomeEarthSurfaceProfile }
  ).resolveHomeEarthSurfaceProfile;

  expect(resolveHomeEarthSurfaceProfile).toBeDefined();
  expect(resolveHomeEarthSurfaceProfile?.("home")).toMatchObject({
    nightIntensity: 0.76,
    nightSurfaceLift: 0.16,
    segments: 144
  });
  expect(resolveHomeEarthSurfaceProfile?.("home")?.nightIntensity).toBeLessThan(0.9);
  expect(resolveHomeEarthSurfaceProfile?.("home")?.nightSurfaceLift).toBeLessThanOrEqual(0.22);
  expect(resolveHomeEarthSurfaceProfile?.("home")?.nightSurfaceLift).toBeGreaterThanOrEqual(0.1);
  expect(resolveHomeEarthSurfaceProfile?.("study")).toBeUndefined();
  expect(resolveHomeEarthSurfaceProfile?.("spike")).toBeUndefined();
});

test("routes only the production home through the lightweight renderer", () => {
  type ResolveLandingRuntimeProfile = (
    routeVariant: "home" | "study" | "spike"
  ) => "home-lite" | "full";

  const resolveLandingRuntimeProfile = (
    luBirthSceneSlot as unknown as { resolveLandingRuntimeProfile?: ResolveLandingRuntimeProfile }
  ).resolveLandingRuntimeProfile;

  expect(resolveLandingRuntimeProfile).toBeDefined();
  expect(resolveLandingRuntimeProfile?.("home")).toBe("home-lite");
  expect(resolveLandingRuntimeProfile?.("study")).toBe("full");
  expect(resolveLandingRuntimeProfile?.("spike")).toBe("full");
});
