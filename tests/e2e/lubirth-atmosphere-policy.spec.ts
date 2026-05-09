import { expect, test } from "@playwright/test";
import { resolveLuBirthAtmospherePolicy } from "../../packages/lubirth-hero/src/atmospherePolicy";
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
