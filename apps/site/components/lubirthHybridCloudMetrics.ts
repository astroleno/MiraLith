export type HybridEllipse2D = {
  center: readonly [number, number];
  radiusEast: number;
  radiusNorth: number;
  rotationRadians?: number;
};

export function normalizedEllipseRadiusSquared(
  point: readonly [number, number],
  ellipse: HybridEllipse2D
) {
  const rotation = ellipse.rotationRadians ?? 0;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const deltaEast = point[0] - ellipse.center[0];
  const deltaNorth = point[1] - ellipse.center[1];
  const localEast = (deltaEast * cosine + deltaNorth * sine) /
    Math.max(ellipse.radiusEast, 0.000001);
  const localNorth = (-deltaEast * sine + deltaNorth * cosine) /
    Math.max(ellipse.radiusNorth, 0.000001);
  return localEast * localEast + localNorth * localNorth;
}

export function isPointInsideHybridEllipse(
  point: readonly [number, number],
  ellipse: HybridEllipse2D,
  epsilon = 0
) {
  return normalizedEllipseRadiusSquared(point, ellipse) <= 1 + epsilon;
}

/**
 * A deterministic, non-overlapping footprint measurement. Sampling happens in
 * the carrier's normalized disk, so the result is always an actual coverage
 * ratio in [0, 1] rather than a sum of potentially overlapping base areas.
 */
export function measureHybridEllipseUnionCoverage(
  carrier: HybridEllipse2D,
  bases: readonly HybridEllipse2D[],
  gridSize = 96
) {
  if (bases.length === 0 || gridSize <= 0) {
    return 0;
  }
  let carrierSamples = 0;
  let coveredSamples = 0;
  const carrierRotation = carrier.rotationRadians ?? 0;
  const carrierCosine = Math.cos(carrierRotation);
  const carrierSine = Math.sin(carrierRotation);
  for (let y = 0; y < gridSize; y += 1) {
    const normalizedNorth = ((y + 0.5) / gridSize) * 2 - 1;
    for (let x = 0; x < gridSize; x += 1) {
      const normalizedEast = ((x + 0.5) / gridSize) * 2 - 1;
      if (normalizedEast * normalizedEast + normalizedNorth * normalizedNorth > 1) {
        continue;
      }
      carrierSamples += 1;
      const localEast = normalizedEast * carrier.radiusEast;
      const localNorth = normalizedNorth * carrier.radiusNorth;
      const point: [number, number] = [
        carrier.center[0] + localEast * carrierCosine - localNorth * carrierSine,
        carrier.center[1] + localEast * carrierSine + localNorth * carrierCosine
      ];
      if (bases.some((base) => isPointInsideHybridEllipse(point, base))) {
        coveredSamples += 1;
      }
    }
  }
  return coveredSamples / Math.max(carrierSamples, 1);
}
