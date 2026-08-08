import {
  DataUtils,
  HalfFloatType,
  Matrix3,
  Matrix4,
  Vector2,
  Vector3,
  type Camera,
  type WebGLRenderTarget,
  type WebGLRenderer
} from "three";
import {
  raySphereIntervalGeneral,
  resolveCloudShellWorldSegment
} from "../planetaryCloudMath";
import { TAKRAM_PARITY_BOTTOM_RADIUS_M } from "./TakramParityContract";

export interface TakramAltitudeLadderReadback {
  values: Float32Array;
  width: number;
  height: number;
  precision: "half-float" | "unorm8";
}

export interface TakramAltitudeLadderDensitySummary {
  shellIntervalLengthMeters: number | null;
  validPrimarySampleCount: number | null;
  maxDensity: number | null;
  averageDensity: number | null;
}

export interface TakramAltitudeLadderRadianceSummary {
  averageLuma: number | null;
  peakLuma: number | null;
  centerLuma: number | null;
  averageTransmittance: number | null;
  minimumTransmittance: number | null;
  centerTransmittance: number | null;
  accumulatedOpticalDepth: number | null;
  peakAccumulatedOpticalDepth: number | null;
  centerAccumulatedOpticalDepth: number | null;
}

const scratchOriginEcef = new Vector3();
const scratchDirectionEcef = new Vector3();
const scratchWorldDirection = new Vector3();
const scratchMatrix3 = new Matrix3();

function readHalfFloat(value: number) {
  return DataUtils.fromHalfFloat(value);
}

export function readTakramAltitudeLadderRenderTarget(
  renderer: WebGLRenderer,
  target: WebGLRenderTarget
): TakramAltitudeLadderReadback | null {
  const width = target.width;
  const height = target.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null;
  }

  const halfFloat = target.texture.type === HalfFloatType;
  const raw = halfFloat
    ? new Uint16Array(width * height * 4)
    : new Uint8Array(width * height * 4);
  try {
    renderer.readRenderTargetPixels(target, 0, 0, width, height, raw);
  } catch {
    return null;
  }

  const values = new Float32Array(raw.length);
  if (halfFloat) {
    for (let index = 0; index < raw.length; index += 1) {
      values[index] = readHalfFloat(raw[index] ?? 0);
    }
  } else {
    for (let index = 0; index < raw.length; index += 1) {
      values[index] = (raw[index] ?? 0) / 255;
    }
  }

  return {
    values,
    width,
    height,
    precision: halfFloat ? "half-float" : "unorm8"
  };
}

function finite(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function summarizeTakramAltitudeLadderDensity(
  readback: TakramAltitudeLadderReadback
): TakramAltitudeLadderDensitySummary {
  let shellLengthSum = 0;
  let sampleCountSum = 0;
  let densitySum = 0;
  let maxDensity = 0;
  let validPixels = 0;
  const pixelCount = readback.width * readback.height;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const shellFraction = finite(readback.values[offset] ?? 0);
    const samples = finite(readback.values[offset + 1] ?? 0) * 500;
    const pixelMaxDensity = finite(readback.values[offset + 2] ?? 0);
    const pixelAverageDensity = finite(readback.values[offset + 3] ?? 0);
    if (samples <= 0) continue;
    validPixels += 1;
    shellLengthSum += shellFraction * 1_000_000;
    sampleCountSum += samples;
    densitySum += pixelAverageDensity;
    maxDensity = Math.max(maxDensity, pixelMaxDensity);
  }

  return {
    shellIntervalLengthMeters: validPixels > 0 ? shellLengthSum / validPixels : null,
    validPrimarySampleCount: validPixels > 0 ? sampleCountSum / validPixels : null,
    maxDensity: validPixels > 0 ? maxDensity : null,
    averageDensity: validPixels > 0 ? densitySum / validPixels : null
  };
}

export function summarizeTakramAltitudeLadderRadiance(
  readback: TakramAltitudeLadderReadback
): TakramAltitudeLadderRadianceSummary {
  const pixelCount = readback.width * readback.height;
  if (pixelCount <= 0) {
    return {
      averageLuma: null,
      peakLuma: null,
      centerLuma: null,
      averageTransmittance: null,
      minimumTransmittance: null,
      centerTransmittance: null,
      peakAccumulatedOpticalDepth: null,
      centerAccumulatedOpticalDepth: null,
      accumulatedOpticalDepth: null
    };
  }

  let lumaSum = 0;
  let peakLuma = 0;
  let transmittanceSum = 0;
  let minimumTransmittance = 1;
  let opticalDepthSum = 0;
  let peakOpticalDepth = 0;
  const centerPixel = Math.floor(readback.height / 2) * readback.width +
    Math.floor(readback.width / 2);
  let centerLuma = 0;
  let centerTransmittance = 1;
  let centerOpticalDepth = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const red = Math.max(0, finite(readback.values[offset] ?? 0));
    const green = Math.max(0, finite(readback.values[offset + 1] ?? 0));
    const blue = Math.max(0, finite(readback.values[offset + 2] ?? 0));
    const transmittance = Math.min(1, Math.max(1e-6, finite(readback.values[offset + 3] ?? 1)));
    const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const opticalDepth = -Math.log(transmittance);
    lumaSum += luma;
    peakLuma = Math.max(peakLuma, luma);
    transmittanceSum += transmittance;
    minimumTransmittance = Math.min(minimumTransmittance, transmittance);
    opticalDepthSum += opticalDepth;
    peakOpticalDepth = Math.max(peakOpticalDepth, opticalDepth);
    if (pixel === centerPixel) {
      centerLuma = luma;
      centerTransmittance = transmittance;
      centerOpticalDepth = opticalDepth;
    }
  }

  return {
    averageLuma: lumaSum / pixelCount,
    peakLuma,
    centerLuma,
    averageTransmittance: transmittanceSum / pixelCount,
    minimumTransmittance,
    centerTransmittance,
    accumulatedOpticalDepth: opticalDepthSum / pixelCount,
    peakAccumulatedOpticalDepth: peakOpticalDepth,
    centerAccumulatedOpticalDepth: centerOpticalDepth
  };
}

export function readTakramAltitudeLadderDefaultFramebuffer(
  renderer: WebGLRenderer
): TakramAltitudeLadderReadback | null {
  const size = renderer.getDrawingBufferSize(new Vector2());
  const width = Math.max(1, Math.floor(size.x));
  const height = Math.max(1, Math.floor(size.y));
  const values = new Uint8Array(width * height * 4);
  const context = renderer.getContext();
  try {
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, values);
  } catch {
    return null;
  }
  return {
    values: Float32Array.from(values, (value) => value / 255),
    width,
    height,
    precision: "unorm8"
  };
}

/** Resolve a center ray in ECEF metres and intersect the native cloud shell. */
export function resolveTakramAltitudeLadderShellInterval(
  camera: Camera,
  worldToEcefMatrix: Matrix4 | null,
  minHeightMeters: number,
  maxHeightMeters: number
) {
  if (!worldToEcefMatrix || maxHeightMeters <= minHeightMeters) return null;
  camera.getWorldPosition(scratchOriginEcef).applyMatrix4(worldToEcefMatrix);
  camera.getWorldDirection(scratchWorldDirection);
  scratchDirectionEcef
    .copy(scratchWorldDirection)
    .applyMatrix3(scratchMatrix3.setFromMatrix4(worldToEcefMatrix))
    .normalize();
  const outer = raySphereIntervalGeneral(
    scratchOriginEcef,
    scratchDirectionEcef,
    TAKRAM_PARITY_BOTTOM_RADIUS_M + maxHeightMeters
  );
  const inner = raySphereIntervalGeneral(
    scratchOriginEcef,
    scratchDirectionEcef,
    TAKRAM_PARITY_BOTTOM_RADIUS_M + minHeightMeters
  );
  const segment = resolveCloudShellWorldSegment(outer, inner);
  return segment ? segment.exit - segment.enter : null;
}
