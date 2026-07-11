import { expect, test } from "@playwright/test";
import * as luBirthSceneSlot from "../../apps/site/visual/scenes/LuBirthSceneSlot";
import * as landingCloudLayer from "../../packages/lubirth-hero/src/LandingCloudLayer";
import { resolveLuBirthAtmospherePolicy } from "../../packages/lubirth-hero/src/atmospherePolicy";
import { resolveLandingVisualPolicy } from "../../packages/lubirth-hero/src/landingVisualPolicy";
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

test("resolves the production home medium visual policy", () => {
  expect(resolveLandingVisualPolicy({
    runtimeProfile: "home-lite",
    qualityTier: "medium",
    renderProfile: "nasa"
  })).toEqual({
    cloudMode: "shell-lite",
    groundShadow: true,
    atmosphereMode: "surface-glow",
    bloomMode: "lite",
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
    bloomMode: "off",
    reason: "quality-low"
  });
});

test("keeps study and debug routes on full lookdev policies", () => {
  expect(resolveLandingVisualPolicy({
    runtimeProfile: "full",
    qualityTier: "medium",
    renderProfile: "nasa"
  })).toMatchObject({ cloudMode: "lookdev", groundShadow: true, bloomMode: "full" });

  expect(resolveLandingVisualPolicy({
    runtimeProfile: "home-lite",
    qualityTier: "medium",
    renderProfile: "debug-atmosphere"
  })).toMatchObject({
    cloudMode: "lookdev",
    groundShadow: true,
    atmosphereMode: "lookdev",
    bloomMode: "full"
  });
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
    nightIntensity: 1.05,
    nightSurfaceLift: 1,
    segments: 144
  });
  expect(resolveHomeEarthSurfaceProfile?.("home")?.nightIntensity).toBeGreaterThanOrEqual(0.62);
  expect(resolveHomeEarthSurfaceProfile?.("home")?.nightSurfaceLift).toBeGreaterThanOrEqual(0.3);
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
