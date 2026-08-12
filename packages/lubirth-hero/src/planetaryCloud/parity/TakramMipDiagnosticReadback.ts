import {
  DataUtils,
  HalfFloatType,
  RedFormat,
  UnsignedByteType,
  type WebGLRenderer,
  type WebGLRenderTarget
} from "three";
import {
  TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE,
  type TakramMipDiagnosticScale
} from "./TakramMipDiagnostic";
import {
  configureTakramMipDiagnosticSample,
  disableTakramMipDiagnosticSample,
  type TakramMipDiagnosticMaterial
} from "./TakramMipDiagnosticInstrumentation";

interface OrdinalReadback {
  color: Float32Array;
  depthVelocity: Float32Array;
  opacity: Float32Array;
  width: number;
  height: number;
}

export function packTakramMipDiagnosticOrdinal(input: OrdinalReadback & {
  scale: TakramMipDiagnosticScale;
  sampleOrdinal: number;
}) {
  const values: number[] = [];
  const pixelCount = input.width * input.height;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const colorOffset = pixel * 4;
    const depthOffset = pixel * 4;
    const valid = (input.depthVelocity[depthOffset] ?? 0) >= 0.5;
    if (!valid) continue;
    const rayDistanceMeters = (input.color[colorOffset] ?? 0) * 1_000;
    const rayStartTexelsPerPixel = input.color[colorOffset + 1] ?? 0;
    const actualMip = input.color[colorOffset + 2] ?? 0;
    const weatherDensity = input.color[colorOffset + 3] ?? 0;
    const weatherHit = (input.depthVelocity[depthOffset + 1] ?? 0) >= 0.5;
    const primaryHit = (input.depthVelocity[depthOffset + 2] ?? 0) >= 0.5;
    const counterfactualMip = Math.log2(Math.max(
      1,
      rayStartTexelsPerPixel + (rayDistanceMeters / input.scale) * 1e-5
    ));
    const flags = 1 + (weatherHit ? 2 : 0) + (primaryHit ? 4 : 0);
    values.push(
      pixel,
      input.sampleOrdinal,
      rayDistanceMeters,
      rayStartTexelsPerPixel,
      actualMip,
      counterfactualMip,
      weatherDensity,
      flags,
      input.opacity[pixel] ?? 0
    );
  }
  return Float32Array.from(values);
}

function readAttachment(
  renderer: WebGLRenderer,
  target: WebGLRenderTarget,
  textureIndex: number
) {
  const texture = target.textures[textureIndex];
  if (!texture) return null;
  const channelCount = texture.format === RedFormat ? 1 : 4;
  const elementCount = target.width * target.height * channelCount;
  let raw: Uint16Array | Uint8Array;
  if (texture.type === HalfFloatType) {
    raw = new Uint16Array(elementCount);
  } else if (texture.type === UnsignedByteType) {
    raw = new Uint8Array(elementCount);
  } else {
    return null;
  }
  renderer.readRenderTargetPixels(
    target,
    0,
    0,
    target.width,
    target.height,
    raw,
    undefined,
    textureIndex
  );
  return Float32Array.from(raw, (value) =>
    texture.type === HalfFloatType ? DataUtils.fromHalfFloat(value) : value / 255
  );
}

export interface TakramMipDiagnosticPass {
  currentMaterial: TakramMipDiagnosticMaterial;
  currentPass: {
    render(
      renderer: WebGLRenderer,
      inputBuffer: null,
      outputBuffer: WebGLRenderTarget
    ): void;
  };
  currentRenderTarget: WebGLRenderTarget;
}

/**
 * Replay the already-prepared native current pass at a frozen exact frame.
 * Resolve/history buffers are never touched; each replay selects one primary
 * sample ordinal and reads the three existing half-float MRT attachments.
 */
export function captureTakramMipDiagnosticFrame(input: {
  renderer: WebGLRenderer;
  pass: TakramMipDiagnosticPass;
  scale: TakramMipDiagnosticScale;
  maxSampleOrdinal?: number;
}) {
  const { renderer, pass } = input;
  const target = pass.currentRenderTarget;
  if (target.textures.length < 3) {
    throw new Error("Takram mip diagnostic requires color, depth/velocity and shadow-length MRT attachments.");
  }
  const maxSampleOrdinal = input.maxSampleOrdinal ?? 499;
  const chunks: Float32Array[] = [];
  let totalLength = 0;
  let lastSampleOrdinal = -1;
  const previousTarget = renderer.getRenderTarget();
  try {
    for (let sampleOrdinal = 0; sampleOrdinal <= maxSampleOrdinal; sampleOrdinal += 1) {
      configureTakramMipDiagnosticSample(pass.currentMaterial, sampleOrdinal);
      pass.currentPass.render(renderer, null, target);
      const color = readAttachment(renderer, target, 0);
      const depthVelocity = readAttachment(renderer, target, 1);
      const opacity = readAttachment(renderer, target, 2);
      if (!color || !depthVelocity || !opacity) {
        throw new Error("Takram mip diagnostic could not read all native MRT attachments.");
      }
      const records = packTakramMipDiagnosticOrdinal({
        scale: input.scale,
        sampleOrdinal,
        color,
        depthVelocity,
        opacity,
        width: target.width,
        height: target.height
      });
      if (records.length === 0) break;
      chunks.push(records);
      totalLength += records.length;
      lastSampleOrdinal = sampleOrdinal;
    }
  } finally {
    disableTakramMipDiagnosticSample(pass.currentMaterial);
    renderer.setRenderTarget(previousTarget);
  }

  const records = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    records.set(chunk, offset);
    offset += chunk.length;
  }
  return {
    width: target.width,
    height: target.height,
    recordCount: records.length / TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE,
    lastSampleOrdinal,
    records
  };
}
