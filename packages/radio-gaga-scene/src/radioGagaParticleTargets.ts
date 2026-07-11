const PROOF_ASPECT = 2.15;
const PROOF_WIDTH = 2.72;
const PROOF_HEIGHT = PROOF_WIDTH / PROOF_ASPECT;

export interface RadioGagaParticleTargets {
  radio: Float32Array;
  proofOne: Float32Array;
  proofTwo: Float32Array;
  esp32: Float32Array;
  home: Float32Array;
}

export interface CreateRadioGagaParticleTargetsInput {
  count: number;
  seed: number;
  radioSurface: Float32Array;
  esp32Surface: Float32Array;
  proofOnePixels: Uint8ClampedArray;
  proofTwoPixels: Uint8ClampedArray;
}

function random01(seed: number, index: number, salt: number) {
  let value = (seed | 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4_294_967_296;
}

function copySurfacePoint(
  source: Float32Array,
  target: Float32Array,
  targetOffset: number,
  seed: number,
  index: number,
  salt: number
) {
  const pointCount = Math.floor(source.length / 3);
  if (pointCount === 0) {
    target[targetOffset] = 0;
    target[targetOffset + 1] = 0;
    target[targetOffset + 2] = 0;
    return;
  }

  const sourceOffset = Math.min(pointCount - 1, Math.floor(random01(seed, index, salt) * pointCount)) * 3;
  target[targetOffset] = source[sourceOffset];
  target[targetOffset + 1] = source[sourceOffset + 1];
  target[targetOffset + 2] = source[sourceOffset + 2];
}

function proofLuminance(pixels: Uint8ClampedArray, seed: number, index: number, salt: number) {
  const pixelCount = Math.floor(pixels.length / 4);
  if (pixelCount === 0) {
    return 0.5;
  }

  const pixelOffset = Math.min(pixelCount - 1, Math.floor(random01(seed, index, salt) * pixelCount)) * 4;
  return (
    pixels[pixelOffset] * 0.2126 +
    pixels[pixelOffset + 1] * 0.7152 +
    pixels[pixelOffset + 2] * 0.0722
  ) / 255;
}

export function createRadioGagaParticleTargets(
  input: CreateRadioGagaParticleTargetsInput
): RadioGagaParticleTargets {
  const count = Math.max(0, Math.floor(input.count));
  const radio = new Float32Array(count * 3);
  const proofOne = new Float32Array(count * 3);
  const proofTwo = new Float32Array(count * 3);
  const esp32 = new Float32Array(count * 3);
  const home = new Float32Array(count * 3);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * PROOF_ASPECT)));
  const rows = Math.max(1, Math.ceil(count / columns));

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    copySurfacePoint(input.radioSurface, radio, offset, input.seed, index, 0x13579bdf);
    copySurfacePoint(input.esp32Surface, esp32, offset, input.seed, index, 0x2468ace0);

    const column = index % columns;
    const row = Math.floor(index / columns) % rows;
    const u = (column + 0.12 + random01(input.seed, index, 0x10293847) * 0.76) / columns;
    const v = (row + 0.12 + random01(input.seed, index, 0x56473829) * 0.76) / rows;
    const proofX = (u - 0.5) * PROOF_WIDTH;
    const proofY = (0.5 - v) * PROOF_HEIGHT;

    proofOne[offset] = proofX;
    proofOne[offset + 1] = proofY;
    proofOne[offset + 2] = (proofLuminance(input.proofOnePixels, input.seed, index, 0x0f1e2d3c) - 0.5) * 0.018;
    proofTwo[offset] = proofX;
    proofTwo[offset + 1] = proofY;
    proofTwo[offset + 2] = (proofLuminance(input.proofTwoPixels, input.seed, index, 0x4b5a6978) - 0.5) * 0.018;

    const phase = random01(input.seed, index, 0x7f4a7c15) * Math.PI * 2;
    const radius = 0.006 + random01(input.seed, index, 0x6c8e9cf5) * 0.022;
    home[offset] = esp32[offset] + Math.cos(phase) * radius;
    home[offset + 1] = esp32[offset + 1] + Math.sin(phase) * radius * 0.72;
    home[offset + 2] = esp32[offset + 2] + (random01(input.seed, index, 0x5bd1e995) - 0.5) * radius;
  }

  return { radio, proofOne, proofTwo, esp32, home };
}
