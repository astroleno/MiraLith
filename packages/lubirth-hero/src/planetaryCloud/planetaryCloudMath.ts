import { Matrix3, Matrix4, Vector3 } from "three";

export const TAKRAM_BOTTOM_RADIUS_M = 6_360_000;

export interface RaySphereInterval {
  near: number;
  far: number;
}

export interface CloudShellWorldSegment {
  enter: number;
  exit: number;
}

const RAY_QUADRATIC_EPSILON = 1e-12;
const WORLD_SCALE_EPSILON = 1e-4;
const localYUpToEcefZUp = new Matrix4().makeRotationX(Math.PI / 2);

export interface LuBirthWorldToEcefBridge {
  valid: boolean;
  worldToEcef: Matrix4 | null;
  /** Metres represented by one Earth-local composition unit in ECEF. */
  worldToEcefScale: number | null;
  /** Metres represented by one rendered world unit after earth.matrixWorld. */
  worldToEcefDistanceScale: number | null;
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
    return {
      valid: false,
      worldToEcef: null,
      worldToEcefScale: null,
      worldToEcefDistanceScale: null,
      reason: "invalid-composition-radius"
    };
  }

  const invalidTransformReason = resolvePlanetTransformInvalidReason(earthMatrixWorld);
  if (invalidTransformReason) {
    return {
      valid: false,
      worldToEcef: null,
      worldToEcefScale: null,
      worldToEcefDistanceScale: null,
      reason: invalidTransformReason
    };
  }

  const meterScale = TAKRAM_BOTTOM_RADIUS_M / compositionRadius;
  const worldToEcef = new Matrix4()
    .makeScale(meterScale, meterScale, meterScale)
    .multiply(localYUpToEcefZUp)
    .multiply(earthMatrixWorld.clone().invert());

  // Clouds' ray direction is transformed by the complete worldToECEF matrix,
  // including the current rendered Earth scale. Scene depth is still measured
  // in rendered world units, so its conversion must use that complete uniform
  // scale rather than the local composition-radius scale alone.
  const worldToEcefDistanceScale = worldToEcef.getMaxScaleOnAxis();

  return {
    valid: true,
    worldToEcef,
    worldToEcefScale: meterScale,
    worldToEcefDistanceScale: Number.isFinite(worldToEcefDistanceScale)
      ? worldToEcefDistanceScale
      : null
  };
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

/**
 * Selects the first positive segment of an outer sphere after the inner sphere
 * has carved out the opaque/clear interior. The returned parameter is always
 * in world-space distance units when the input ray came from the scale bridge.
 */
export function resolveCloudShellWorldSegment(
  outerInterval: RaySphereInterval | null,
  innerInterval: RaySphereInterval | null
): CloudShellWorldSegment | null {
  if (!outerInterval || !Number.isFinite(outerInterval.near) ||
    !Number.isFinite(outerInterval.far) || outerInterval.far <= 0) {
    return null;
  }

  let enter = Math.max(outerInterval.near, 0);
  let exit = outerInterval.far;
  if (innerInterval) {
    if (innerInterval.near > enter) {
      exit = Math.min(exit, innerInterval.near);
    } else if (innerInterval.far > enter) {
      enter = Math.max(enter, innerInterval.far);
    }
  }

  return Number.isFinite(enter) && Number.isFinite(exit) && exit > enter
    ? { enter, exit }
    : null;
}

/**
 * Returns how far a cloud sample can see towards the sun while staying in its
 * first cloud-shell segment. Rays that enter the cloud-base sphere terminate
 * there: marching through the planet to an opposite shell is not physical.
 */
export function resolveForwardCloudShellLightDistance(
  originEcef: Vector3,
  directionEcefPerWorldUnit: Vector3,
  cloudBaseRadiusEcef: number,
  outerRadiusEcef: number
) {
  if (!Number.isFinite(cloudBaseRadiusEcef) || !Number.isFinite(outerRadiusEcef) ||
    cloudBaseRadiusEcef <= 0 || outerRadiusEcef <= cloudBaseRadiusEcef) {
    return 0;
  }

  const outerInterval = raySphereIntervalGeneral(
    originEcef,
    directionEcefPerWorldUnit,
    outerRadiusEcef
  );
  if (!outerInterval || outerInterval.far <= 0) {
    return 0;
  }

  const enter = Math.max(outerInterval.near, 0);
  const exit = outerInterval.far;
  if (exit <= enter) {
    return 0;
  }

  const cloudBaseInterval = raySphereIntervalGeneral(
    originEcef,
    directionEcefPerWorldUnit,
    cloudBaseRadiusEcef
  );
  if (!cloudBaseInterval) {
    return exit - enter;
  }

  if (cloudBaseInterval.near > enter && cloudBaseInterval.near < exit) {
    return cloudBaseInterval.near - enter;
  }

  if (cloudBaseInterval.far > enter) {
    return 0;
  }

  return exit - enter;
}
