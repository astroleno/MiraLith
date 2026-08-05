import { Matrix3, Matrix4, Vector3 } from "three";

export const TAKRAM_BOTTOM_RADIUS_M = 6_360_000;

export interface RaySphereInterval {
  near: number;
  far: number;
}

const RAY_QUADRATIC_EPSILON = 1e-12;
const WORLD_SCALE_EPSILON = 1e-4;
const localYUpToEcefZUp = new Matrix4().makeRotationX(Math.PI / 2);

export interface LuBirthWorldToEcefBridge {
  valid: boolean;
  worldToEcef: Matrix4 | null;
  reason?: PlanetTransformInvalidReason | "invalid-composition-radius";
}

export type PlanetTransformInvalidReason =
  | "non-uniform-scale"
  | "negative-determinant"
  | "singular-scale";

function resolvePlanetTransformInvalidReason(
  earthMatrixWorld: Matrix4
): PlanetTransformInvalidReason | null {
  const elements = earthMatrixWorld.elements;
  const scaleX = Math.hypot(elements[0], elements[1], elements[2]);
  const scaleY = Math.hypot(elements[4], elements[5], elements[6]);
  const scaleZ = Math.hypot(elements[8], elements[9], elements[10]);
  const largestScale = Math.max(scaleX, scaleY, scaleZ);

  if (!Number.isFinite(largestScale) ||
    scaleX <= WORLD_SCALE_EPSILON ||
    scaleY <= WORLD_SCALE_EPSILON ||
    scaleZ <= WORLD_SCALE_EPSILON) {
    return "singular-scale";
  }

  if (earthMatrixWorld.determinant() <= 0) {
    return "negative-determinant";
  }

  if (Math.abs(scaleX - scaleY) > largestScale * WORLD_SCALE_EPSILON ||
    Math.abs(scaleX - scaleZ) > largestScale * WORLD_SCALE_EPSILON) {
    return "non-uniform-scale";
  }

  return null;
}

export function validateUniformPlanetScale(earthMatrixWorld: Matrix4) {
  return resolvePlanetTransformInvalidReason(earthMatrixWorld) === null;
}

export function buildLuBirthWorldToEcef(
  earthMatrixWorld: Matrix4,
  compositionRadius: number
): LuBirthWorldToEcefBridge {
  if (!Number.isFinite(compositionRadius) || compositionRadius <= WORLD_SCALE_EPSILON) {
    return { valid: false, worldToEcef: null, reason: "invalid-composition-radius" };
  }

  const invalidTransformReason = resolvePlanetTransformInvalidReason(earthMatrixWorld);
  if (invalidTransformReason) {
    return { valid: false, worldToEcef: null, reason: invalidTransformReason };
  }

  const meterScale = TAKRAM_BOTTOM_RADIUS_M / compositionRadius;
  const worldToEcef = new Matrix4()
    .makeScale(meterScale, meterScale, meterScale)
    .multiply(localYUpToEcefZUp)
    .multiply(earthMatrixWorld.clone().invert());

  return { valid: true, worldToEcef };
}

export function transformWorldRayToEcefParameterization(
  originWorld: Vector3,
  directionWorld: Vector3,
  worldToEcef: Matrix4
) {
  return {
    originEcef: originWorld.clone().applyMatrix4(worldToEcef),
    directionEcefPerWorldUnit: directionWorld.clone().applyMatrix3(
      new Matrix3().setFromMatrix4(worldToEcef)
    )
  };
}

export function resolveSceneWorldDistance(
  rayOriginWorld: Vector3,
  rayDirectionWorld: Vector3,
  scenePositionWorld: Vector3 | null
) {
  if (!scenePositionWorld) {
    return Infinity;
  }

  const distance = scenePositionWorld.clone().sub(rayOriginWorld).dot(rayDirectionWorld);
  return Number.isFinite(distance) && distance >= 0 ? distance : Infinity;
}

/**
 * Intersects an ECEF sphere while retaining the world-space ray parameter.
 * `directionEcefPerWorldUnit` must not be normalized: the bridge may contain
 * a uniform scale, so each increment of t still represents one world unit.
 */
export function raySphereIntervalGeneral(
  originEcef: Vector3,
  directionEcefPerWorldUnit: Vector3,
  radiusEcef: number
): RaySphereInterval | null {
  const a = directionEcefPerWorldUnit.dot(directionEcefPerWorldUnit);
  if (!Number.isFinite(a) || a <= RAY_QUADRATIC_EPSILON || radiusEcef <= 0) {
    return null;
  }

  const halfB = originEcef.dot(directionEcefPerWorldUnit);
  const c = originEcef.lengthSq() - radiusEcef * radiusEcef;
  const discriminant = halfB * halfB - a * c;
  if (!Number.isFinite(discriminant) || discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const near = (-halfB - root) / a;
  const far = (-halfB + root) / a;
  return Number.isFinite(near) && Number.isFinite(far) ? { near, far } : null;
}
