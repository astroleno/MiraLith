import type { CloudLayerLike } from "@takram/three-clouds";

/**
 * Adapter-owned interpretation of V3's R/G/B/A weather channels. This is the
 * only V3 layer contract in the parity spike; a later promoted path must
 * consume this frozen tuple rather than introduce a numeric copy.
 */
export const TAKRAM_PARITY_V3_LAYERS = Object.freeze([
  Object.freeze({
    channel: "r",
    altitude: 8_000,
    height: 26_000,
    densityScale: 0.18,
    // Keep the native shape/detail path enabled, but bias the V3 adapter
    // toward broad masses instead of a noisy cloudlet field.
    shapeAmount: 0.9,
    shapeDetailAmount: 0.18,
    coverageFilterWidth: 0.6,
    shadow: true
  }),
  Object.freeze({
    channel: "g",
    altitude: 10_000,
    height: 50_000,
    densityScale: 0.11,
    shapeAmount: 0.95,
    shapeDetailAmount: 0.22,
    weatherExponent: 1,
    coverageFilterWidth: 0.52,
    shadow: true
  }),
  Object.freeze({
    channel: "b",
    altitude: 8_000,
    height: 36_000,
    densityScale: 0.06,
    shapeAmount: 1,
    shapeDetailAmount: 0.28,
    weatherExponent: 1.05,
    coverageFilterWidth: 0.45
  }),
  Object.freeze({
    channel: "a",
    altitude: 18_000,
    height: 20_000,
    densityScale: 0.035,
    shapeAmount: 0.7,
    shapeDetailAmount: 0.1,
    weatherExponent: 1.1,
    coverageFilterWidth: 0.5
  })
] as const satisfies readonly CloudLayerLike[]);
