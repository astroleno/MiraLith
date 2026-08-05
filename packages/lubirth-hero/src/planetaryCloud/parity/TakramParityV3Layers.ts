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
    shapeAmount: 0.7,
    shapeDetailAmount: 0.45,
    coverageFilterWidth: 0.6,
    shadow: true
  }),
  Object.freeze({
    channel: "g",
    altitude: 10_000,
    height: 50_000,
    densityScale: 0.11,
    shapeAmount: 0.85,
    shapeDetailAmount: 0.7,
    weatherExponent: 1.15,
    coverageFilterWidth: 0.52,
    shadow: true
  }),
  Object.freeze({
    channel: "b",
    altitude: 8_000,
    height: 36_000,
    densityScale: 0.06,
    shapeAmount: 0.9,
    shapeDetailAmount: 0.85,
    weatherExponent: 1.2,
    coverageFilterWidth: 0.45
  }),
  Object.freeze({
    channel: "a",
    altitude: 18_000,
    height: 20_000,
    densityScale: 0.035,
    shapeAmount: 0.55,
    shapeDetailAmount: 0.25,
    weatherExponent: 1.4,
    coverageFilterWidth: 0.5
  })
] as const satisfies readonly CloudLayerLike[]);
