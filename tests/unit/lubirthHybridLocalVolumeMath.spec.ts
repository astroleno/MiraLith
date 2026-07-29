import { expect, test } from "@playwright/test";
import {
  accumulateLocalVolumeFrontToBack,
  interpolateLocalVolumeRayUv,
  resolveSourcePatchLocalUv,
  resolveSourceNativeOpticalMass,
  resolveSourceNativeVerticalProfile,
  resolveBeerLambertTransmittance,
  selectLocalVolumeActiveTiles,
  resolveV3SourceCoverage,
  resolveV3SourceFootprintMask,
  resolveLocalVolumeDepthPartition,
  resolveLocalVolumeSamplingBudget,
  encodeOctahedralNormal,
  decodeOctahedralNormal
} from "../../apps/site/components/lubirthHybridLocalVolumeMath";

test("local-volume octahedral normals preserve top, side, and underside directions", () => {
  const directions: Array<[number, number, number]> = [
    [0, 0, 1],
    [0, 0, -1],
    [1, 0, 0],
    [0, -1, 0],
    [0.42, -0.31, 0.85]
  ];

  for (const direction of directions) {
    const decoded = decodeOctahedralNormal(encodeOctahedralNormal(direction));
    const length = Math.hypot(...direction);
    const expected = direction.map((value) => value / length) as [number, number, number];
    const dot = decoded[0] * expected[0] + decoded[1] * expected[1] + decoded[2] * expected[2];
    expect(dot).toBeGreaterThan(0.995);
  }
});

test("local-volume keeps near and far depth ownership in camera order", () => {
  const near = resolveLocalVolumeDepthPartition(0.8, 1.0, 0.05, 2);
  const far = resolveLocalVolumeDepthPartition(1.2, 1.0, 0.05, 2);

  expect(near.near).toBeGreaterThan(0.99);
  expect(near.far).toBeLessThan(0.01);
  expect(far.far).toBeGreaterThan(0.99);
  expect(far.near).toBeLessThan(0.01);
  expect(near.far + near.near).toBeCloseTo(1, 8);
  expect(far.far + far.near).toBeCloseTo(1, 8);
});

test("local-volume composites front radiance over a farther layer", () => {
  const result = accumulateLocalVolumeFrontToBack([
    { radiance: [1, 0, 0], tau: 2, t: 0.8 },
    { radiance: [0, 0, 1], tau: 2, t: 1.2 }
  ], 1, 0.01, 2);

  expect(result.near.premultipliedRadiance[0]).toBeGreaterThan(
    result.near.premultipliedRadiance[2]
  );
  expect(result.far.premultipliedRadiance[2]).toBeGreaterThan(
    result.far.premultipliedRadiance[0]
  );
  expect(result.compositePremultipliedRadiance[0]).toBeGreaterThan(
    result.compositePremultipliedRadiance[2]
  );
});

test("local-volume sample budget stays fixed across the two-bin desktop path", () => {
  expect(resolveLocalVolumeSamplingBudget("desktop", 2)).toEqual({
    accumulationDrawCount: 1,
    sunTextureLookupsPerPixel: 0,
    viewTextureLookupsPerPixel: 4
  });
  expect(resolveLocalVolumeSamplingBudget("mobile", 2)).toEqual({
    accumulationDrawCount: 1,
    sunTextureLookupsPerPixel: 0,
    viewTextureLookupsPerPixel: 3
  });
});

test("source-native field does not turn hierarchy support into synthetic cloud mass", () => {
  const emptySource = resolveSourceNativeOpticalMass({
    carrierDensity: 0.9,
    carrierRadiusSquared: 0.02,
    erosionWeight: 1,
    hierarchyFootprint: 1,
    sourceConcavity: 0,
    sourceCoverage: 0,
    sourceFootprintMask: 0,
    sourceMorphology: 1,
    sourceVerticalProfile: 1
  });
  const sparseSource = resolveSourceNativeOpticalMass({
    carrierDensity: 0.9,
    carrierRadiusSquared: 0.02,
    erosionWeight: 1,
    hierarchyFootprint: 0,
    sourceConcavity: 0.15,
    sourceCoverage: 0.68,
    sourceFootprintMask: 1,
    sourceMorphology: 0.7,
    sourceVerticalProfile: 0.8
  });
  const supportedSource = resolveSourceNativeOpticalMass({
    carrierDensity: 0.9,
    carrierRadiusSquared: 0.02,
    erosionWeight: 1,
    hierarchyFootprint: 1,
    sourceConcavity: 0.15,
    sourceCoverage: 0.68,
    sourceFootprintMask: 1,
    sourceMorphology: 0.7,
    sourceVerticalProfile: 0.8
  });

  // A selected carrier/base may shape height, but must never manufacture
  // opacity where the locked V3 source says there is clear air.
  expect(emptySource.opticalMass).toBe(0);
  // A sparse V3 core remains a cloud even where hierarchy sampling is sparse;
  // otherwise selected lobes cut the source into visible ellipsoid islands.
  expect(sparseSource.opticalMass).toBeGreaterThan(0);
  expect(supportedSource.opticalMass).toBeGreaterThan(sparseSource.opticalMass * 0.9);
  // The source term remains dominant so hierarchy can sculpt silhouette and
  // ceiling without recreating the old opaque lobe beads.
  expect(supportedSource.hierarchyGlueMass).toBeLessThan(
    supportedSource.sourceOpticalMass * 0.12
  );
});

test("source-native field retains low V3 bridge density without filling clear air", () => {
  const clear = resolveV3SourceCoverage(0.04);
  const bridge = resolveV3SourceCoverage(0.15);
  const core = resolveV3SourceCoverage(0.62);

  expect(clear).toBe(0);
  // This range is widespread in the locked V3 patch. Dropping it entirely
  // fractures one weather system into the selected lobe beads we are trying
  // to eliminate; it should remain a weak, source-derived bridge.
  expect(bridge).toBeGreaterThan(0.1);
  expect(resolveV3SourceFootprintMask(bridge)).toBeGreaterThan(0.5);
  expect(core).toBeGreaterThan(bridge);
  expect(resolveV3SourceFootprintMask(clear)).toBe(0);
});

test("source-native vertical profile creates height only from V3-supported mass", () => {
  const clearAir = resolveSourceNativeVerticalProfile({
    localZ: 0.66,
    sourceFootprintMask: 0,
    sourceHeight: 0.62,
    sourceMorphology: 0.8,
    towerSupport: 1
  });
  const broadSource = resolveSourceNativeVerticalProfile({
    localZ: 0.66,
    sourceFootprintMask: 1,
    sourceHeight: 0.3,
    sourceMorphology: 0.46,
    towerSupport: 0
  });
  const towerSupportedSource = resolveSourceNativeVerticalProfile({
    localZ: 0.78,
    sourceFootprintMask: 1,
    sourceHeight: 0.3,
    sourceMorphology: 0.46,
    towerSupport: 1
  });

  // A selected tower may lift a real V3 column, but cannot manufacture a
  // vertical cloud where the locked source is clear.
  expect(clearAir.profile).toBe(0);
  expect(clearAir.ceiling).toBeLessThanOrEqual(broadSource.ceiling);
  // A representative V3 height reaches well above the old shallow ceiling,
  // giving the local volume a readable top/side/underside interval.
  expect(broadSource.ceiling).toBeGreaterThan(0.55);
  expect(broadSource.profile).toBeGreaterThan(0.35);
  // Tower support only extends an already source-backed top and remains
  // bounded inside the fixed local-volume proxy.
  expect(towerSupportedSource.ceiling).toBeGreaterThan(broadSource.ceiling);
  expect(towerSupportedSource.ceiling).toBeLessThanOrEqual(0.9);
  expect(towerSupportedSource.profile).toBeGreaterThan(0);
});

test("local-volume samples the full locked V3 patch instead of a carrier-center subset", () => {
  const bounds = { u0: 370 / 512, u1: 405 / 512, v0: 105 / 256, v1: 138 / 256 };

  expect(resolveSourcePatchLocalUv(-1, -1, bounds)).toEqual([bounds.u0, bounds.v0]);
  expect(resolveSourcePatchLocalUv(1, 1, bounds)).toEqual([bounds.u1, bounds.v1]);
  expect(resolveSourcePatchLocalUv(0, 0, bounds)).toEqual([
    (bounds.u0 + bounds.u1) * 0.5,
    (bounds.v0 + bounds.v1) * 0.5
  ]);
});

test("local-volume transports each ray sample between its real shell endpoint UVs", () => {
  const entry: [number, number] = [-0.82, -0.44];
  const exit: [number, number] = [0.46, 0.68];

  expect(interpolateLocalVolumeRayUv(entry, exit, 0)).toEqual(entry);
  expect(interpolateLocalVolumeRayUv(entry, exit, 1)).toEqual(exit);
  const quarter = interpolateLocalVolumeRayUv(entry, exit, 0.25);
  expect(quarter[0]).toBeCloseTo(-0.5, 8);
  expect(quarter[1]).toBeCloseTo(-0.16, 8);
  // A grazing ray must not collapse every view sample to the same midpoint
  // V3 column; otherwise local density becomes a soft 2.5D card again.
  expect(quarter).not.toEqual(interpolateLocalVolumeRayUv(entry, exit, 0.75));
});

test("local-volume directional light decreases monotonically with sunward optical depth", () => {
  expect(resolveBeerLambertTransmittance(0)).toBe(1);
  const thin = resolveBeerLambertTransmittance(0.2);
  const dense = resolveBeerLambertTransmittance(1.2);

  expect(thin).toBeGreaterThan(dense);
  expect(dense).toBeGreaterThan(0);
  expect(resolveBeerLambertTransmittance(-2)).toBe(1);
});

test("local-volume tile selection submits source-bearing cells without reviving empty proxy space", () => {
  const active = selectLocalVolumeActiveTiles([
    { meanDensity: 0.042, peakDensity: 0.18 },
    { meanDensity: 0.002, peakDensity: 0.018 },
    { meanDensity: 0.009, peakDensity: 0.31 },
    { meanDensity: 0.013, peakDensity: 0.05 },
    // A thin but real V3 filament must retain its tile when it has a strong
    // source peak, even if its full-cell mean is low.
    { meanDensity: 0.001, peakDensity: 0.19 },
    // Conversely, a broad proxy tile with neither useful mass nor a strong
    // filament should not spend a full field march on clear air.
    { meanDensity: 0.001, peakDensity: 0.16 }
  ]);

  expect(active).toEqual([0, 2, 3, 4]);
});
