export type LocalVolumeTier = "desktop" | "mobile";
export type LocalVolumeDepthBinMode = 1 | 2;

export interface LocalVolumeDepthPartition {
  far: number;
  near: number;
}

export interface LocalVolumeSamplingBudget {
  accumulationDrawCount: number;
  sunTextureLookupsPerPixel: number;
  viewTextureLookupsPerPixel: number;
}

export interface LocalVolumeTileSignal {
  meanDensity: number;
  peakDensity: number;
}

/**
 * Submit every tile that carries even a weak V3 bridge. The local volume
 * resolves density per fragment, so discarding a low-mean tile at the CPU
 * level creates a rectangular hole between two valid weather columns. This
 * remains source-only: hierarchy candidates cannot reactivate a genuinely
 * transparent patch cell as an analytic proxy rectangle.
 */
export function selectLocalVolumeActiveTiles(
  signals: readonly LocalVolumeTileSignal[]
) {
  return signals.flatMap((signal, index) => (
    // The tiny coarse-cell mean is not enough by itself to justify a full
    // 4-view local-volume march. Keep a V3-supported bridge when its mean is
    // materially present, or retain a genuinely high-density filament by its
    // peak. The two clauses intentionally describe source density only;
    // hierarchy lobes can never reactivate a clear proxy cell.
    signal.meanDensity >= 0.003 || signal.peakDensity >= 0.18
      ? [index]
      : []
  ));
}

export interface SourceNativeOpticalMassInput {
  carrierDensity: number;
  carrierRadiusSquared: number;
  erosionWeight: number;
  hierarchyFootprint: number;
  sourceConcavity: number;
  sourceCoverage: number;
  sourceFootprintMask: number;
  sourceMorphology: number;
  sourceVerticalProfile: number;
}

export interface SourceNativeOpticalMass {
  hierarchyGlueMass: number;
  opticalMass: number;
  sourceOpticalMass: number;
}

export interface SourceNativeVerticalProfileInput {
  localZ: number;
  sourceFootprintMask: number;
  sourceHeight: number;
  sourceMorphology: number;
  towerSupport: number;
}

export interface SourceNativeVerticalProfile {
  ceiling: number;
  profile: number;
}

export interface SourcePatchUvBounds {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Linearly transports the local V3 patch coordinate along a clipped cloud
 * shell ray. The local volume is shallow and its source patch is small, so
 * endpoint interpolation preserves the meaningful oblique parallax while
 * avoiding an expensive spherical normal reconstruction at every view sample.
 */
export function interpolateLocalVolumeRayUv(
  entry: readonly [number, number],
  exit: readonly [number, number],
  samplePosition: number
): [number, number] {
  const t = clamp01(samplePosition);
  if (t === 0) {
    return [entry[0], entry[1]];
  }
  if (t === 1) {
    return [exit[0], exit[1]];
  }
  return [
    entry[0] + (exit[0] - entry[0]) * t,
    entry[1] + (exit[1] - entry[1]) * t
  ];
}

export interface LocalVolumeRadianceSample {
  radiance: [number, number, number];
  t: number;
  tau: number;
}

export interface LocalVolumeOpticalLayer {
  alpha: number;
  premultipliedRadiance: [number, number, number];
  tau: number;
}

export interface LocalVolumeFrontToBackResult {
  compositePremultipliedRadiance: [number, number, number];
  far: LocalVolumeOpticalLayer;
  near: LocalVolumeOpticalLayer;
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Encodes a local-volume density normal into the two channels available next
 * to the precomputed sun transmittance and optical density. Octahedral
 * encoding retains the complete three-dimensional density gradient without
 * adding a runtime 3D texture lookup.
 */
export function encodeOctahedralNormal(
  direction: readonly [number, number, number]
): [number, number] {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  let x = length > 0.000001 ? direction[0] / length : 0;
  let y = length > 0.000001 ? direction[1] / length : 0;
  let z = length > 0.000001 ? direction[2] / length : 1;
  const inverseL1 = 1 / Math.max(Math.abs(x) + Math.abs(y) + Math.abs(z), 0.000001);
  x *= inverseL1;
  y *= inverseL1;
  z *= inverseL1;
  if (z < 0) {
    const previousX = x;
    x = (1 - Math.abs(y)) * Math.sign(previousX || 1);
    y = (1 - Math.abs(previousX)) * Math.sign(y || 1);
  }
  return [
    Math.round(clamp01(x * 0.5 + 0.5) * 255),
    Math.round(clamp01(y * 0.5 + 0.5) * 255)
  ];
}

/**
 * CPU mirror for the shader decoder. It is deliberately exported for the
 * field-packing contract test: a top, side, or underside gradient must not be
 * flattened into the prior two-dimensional lateral-normal representation.
 */
export function decodeOctahedralNormal(encoded: readonly [number, number]): [number, number, number] {
  let x = encoded[0] / 255 * 2 - 1;
  let y = encoded[1] / 255 * 2 - 1;
  let z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) {
    const previousX = x;
    x = (1 - Math.abs(y)) * Math.sign(previousX || 1);
    y = (1 - Math.abs(previousX)) * Math.sign(y || 1);
  }
  const length = Math.hypot(x, y, z);
  return length > 0.000001
    ? [x / length, y / length, z / length]
    : [0, 0, 1];
}

/**
 * The only transmittance mapping used by the local-volume light field. Keeping
 * it explicit lets the CPU-built sunward volume and the shader share the same
 * Beer–Lambert contract without a second runtime shadow texture lookup.
 */
export function resolveBeerLambertTransmittance(opticalDepth: number) {
  return Math.exp(-Math.max(opticalDepth, 0));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge1 <= edge0) {
    return value >= edge1 ? 1 : 0;
  }
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * A view ray advances away from the camera as `sampleT` increases. The near
 * layer therefore owns values below the shared boundary and the far layer
 * owns values above it. The two weights are a partition of unity so a soft
 * transition cannot change total optical depth.
 */
export function resolveLocalVolumeDepthPartition(
  sampleT: number,
  boundary: number,
  feather: number,
  depthBinMode: LocalVolumeDepthBinMode
): LocalVolumeDepthPartition {
  if (depthBinMode === 1) {
    return { far: 1, near: 0 };
  }
  const safeFeather = Math.max(feather, Number.EPSILON);
  const far = smoothstep(boundary - safeFeather, boundary + safeFeather, sampleT);
  return { far, near: 1 - far };
}

/**
 * The local-density experiment evaluates the carrier once and writes both
 * depth layers with MRT. The directional transmittance is precomputed into
 * the transient source-native field, so the constrained two-bin path stays
 * below the documented 4+1 / 3+1 cap at four / three view reads.
 */
export function resolveLocalVolumeSamplingBudget(
  tier: LocalVolumeTier,
  _depthBinMode: LocalVolumeDepthBinMode
): LocalVolumeSamplingBudget {
  return {
    accumulationDrawCount: 1,
    sunTextureLookupsPerPixel: 0,
    viewTextureLookupsPerPixel: tier === "mobile" ? 3 : 4
  };
}

/**
 * Maps V3 optical depth into the transient local-volume density range.
 *
 * Values around 0.10–0.20 are the V3 weather bridges between dense cloud
 * cores. Treating them as hard zero creates isolated ellipsoid-looking
 * islands; values below the documented clear-air floor remain zero.
 */
export function resolveV3SourceCoverage(sourceDepth: number) {
  return clamp01((sourceDepth - 0.05) / 0.66);
}

/**
 * Turns the continuous source coverage into a soft lateral occupancy mask.
 * This is deliberately derived from source coverage, never from carrier or
 * hierarchy support, so clear air cannot turn into a proxy-shaped cloud.
 */
export function resolveV3SourceFootprintMask(sourceCoverage: number) {
  return smoothstep(0.035, 0.17, clamp01(sourceCoverage));
}

/**
 * Maps a carrier-local horizontal coordinate into the immutable V3 patch
 * recorded by the kill-spike.  Sampling by world-normal alone can collapse a
 * broad patch to a tiny carrier-center subset, erasing its real broken edges
 * and weather valleys before the shallow volume integration sees them.
 */
export function resolveSourcePatchLocalUv(
  localX: number,
  localY: number,
  bounds: SourcePatchUvBounds
): [number, number] {
  const x01 = clamp01(localX * 0.5 + 0.5);
  const y01 = clamp01(localY * 0.5 + 0.5);
  return [
    bounds.u0 + (bounds.u1 - bounds.u0) * x01,
    bounds.v0 + (bounds.v1 - bounds.v0) * y01
  ];
}

/**
 * Builds the only vertical occupancy profile used by the transient local
 * volume.  Its ceiling comes from V3's cloud-top/morphology channels; the
 * hierarchy may extend that ceiling a little, but only under existing V3
 * source coverage.  This keeps the broad carrier as a conservative proxy
 * rather than turning it into an independent soft ellipsoid.
 */
export function resolveSourceNativeVerticalProfile(
  input: SourceNativeVerticalProfileInput
): SourceNativeVerticalProfile {
  const sourceMask = clamp01(input.sourceFootprintMask);
  const sourceCeiling = Math.min(Math.max(
    -0.28 + clamp01(input.sourceHeight) * 2.75 +
      clamp01(input.sourceMorphology) * 0.24,
    0.1
  ), 0.82);
  // Towers are parented V3 columns, not independent density blobs. Giving
  // them a bounded but visible ceiling lift lets the one local shell show
  // real cloud-top parallax rather than flattening every selected tower back
  // into the broad carrier plane.
  const towerLift = clamp01(input.towerSupport) * sourceMask * 0.18;
  // Weak bridge coverage gets a low, soft layer; full V3 coverage can occupy
  // a tall column.  Clear air is left below the field's lower occupancy edge
  // and always returns zero density below.
  const ceiling = -0.82 + (Math.min(sourceCeiling + towerLift, 0.9) + 0.82) * sourceMask;
  const baseProfile = smoothstep(-0.98, -0.56, input.localZ);
  const topProfile = 1 - smoothstep(ceiling - 0.07, ceiling + 0.17, input.localZ);
  return {
    ceiling,
    profile: sourceMask * baseProfile * topProfile
  };
}

/**
 * Keeps the transient local-volume field faithful to the locked V3 source.
 *
 * The Phase -1 hierarchy is useful for choosing a ceiling and a conservative
 * proxy, but it must not manufacture density where V3 reports clear air. A
 * previous version added base/tower quartic masses directly here, which made
 * the selected analytic lobes visible as round cloud beads. The hierarchy is
 * now only a bounded support modulation; the carrier glue is explicitly
 * proportional to source-backed optical mass.
 */
export function resolveSourceNativeOpticalMass(
  input: SourceNativeOpticalMassInput
): SourceNativeOpticalMass {
  const coverage = clamp01(input.sourceCoverage);
  const sourceOpticalMass = coverage * coverage * Math.sqrt(coverage) *
    clamp01(input.sourceVerticalProfile) *
    clamp01(input.erosionWeight) *
    (1.06 + clamp01(input.sourceMorphology) * 0.14) *
    (1.04 - clamp01(input.sourceConcavity) * 0.12);
  const sourceBackedMask = clamp01(input.sourceFootprintMask);
  const hierarchySupport = 0.76 + clamp01(input.hierarchyFootprint) * 0.24;
  const sourceBackedMass = sourceOpticalMass * sourceBackedMask * hierarchySupport;
  const carrierCore = Math.max(1 - Math.max(input.carrierRadiusSquared, 0), 0);
  const hierarchyGlueMass = sourceBackedMass * carrierCore * carrierCore *
    clamp01(input.carrierDensity) * 0.035;

  return {
    hierarchyGlueMass,
    opticalMass: sourceBackedMass + hierarchyGlueMass,
    sourceOpticalMass
  };
}

function createLayer(): LocalVolumeOpticalLayer {
  return {
    alpha: 0,
    premultipliedRadiance: [0, 0, 0],
    tau: 0
  };
}

function accumulateLayer(
  layer: LocalVolumeOpticalLayer,
  radiance: [number, number, number],
  tau: number
) {
  if (tau <= 0) {
    return;
  }
  const transmittance = Math.exp(-layer.tau);
  const alpha = 1 - Math.exp(-tau);
  layer.premultipliedRadiance[0] += transmittance * alpha * radiance[0];
  layer.premultipliedRadiance[1] += transmittance * alpha * radiance[1];
  layer.premultipliedRadiance[2] += transmittance * alpha * radiance[2];
  layer.tau += tau;
  layer.alpha = 1 - Math.exp(-layer.tau);
}

/**
 * CPU reference for the shader's front-to-back bin accumulation. It is used
 * only by unit tests to keep depth ownership and compositing semantics
 * inspectable without relying on a browser framebuffer readback.
 */
export function accumulateLocalVolumeFrontToBack(
  samples: readonly LocalVolumeRadianceSample[],
  boundary: number,
  feather: number,
  depthBinMode: LocalVolumeDepthBinMode
): LocalVolumeFrontToBackResult {
  const far = createLayer();
  const near = createLayer();
  for (const sample of [...samples].sort((a, b) => a.t - b.t)) {
    const partition = resolveLocalVolumeDepthPartition(
      sample.t,
      boundary,
      feather,
      depthBinMode
    );
    accumulateLayer(near, sample.radiance, sample.tau * partition.near);
    accumulateLayer(far, sample.radiance, sample.tau * partition.far);
  }
  const nearTransmittance = Math.exp(-near.tau);
  return {
    far,
    near,
    compositePremultipliedRadiance: [
      near.premultipliedRadiance[0] + nearTransmittance * far.premultipliedRadiance[0],
      near.premultipliedRadiance[1] + nearTransmittance * far.premultipliedRadiance[1],
      near.premultipliedRadiance[2] + nearTransmittance * far.premultipliedRadiance[2]
    ]
  };
}
