const SOURCE_BASE_ANGULAR_SPEED = 0.32;
const SOURCE_MAX_ANGULAR_SPEED = 2.2;
const SOURCE_ENERGY_RESPONSE = 8;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep01 = (value: number) => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};

export interface SourceCausticMotionInput {
  angle: number;
  speed: number;
  previousEnergy: number;
  delta: number;
}

export interface SourceCausticMotion {
  energy: number;
  anchorFacing: number;
  fieldRotation: number;
  timeScale: number;
  warpAmount: number;
  pulseStrength: number;
  chromaOffset: number;
  lensStrength: number;
}

export function stepSourceCausticMotion({
  angle,
  speed,
  previousEnergy,
  delta
}: SourceCausticMotionInput): SourceCausticMotion {
  const speedMagnitude = Math.abs(speed);
  const normalizedExcess = clamp01(
    (speedMagnitude - SOURCE_BASE_ANGULAR_SPEED) /
      (SOURCE_MAX_ANGULAR_SPEED - SOURCE_BASE_ANGULAR_SPEED)
  );
  const targetEnergy = smoothstep01(normalizedExcess);
  const response = 1 - Math.exp(-SOURCE_ENERGY_RESPONSE * Math.max(0, delta));
  const energy =
    clamp01(previousEnergy) +
    (targetEnergy - clamp01(previousEnergy)) * response;

  return {
    energy,
    anchorFacing: Math.sin(angle),
    fieldRotation: angle * 0.42,
    timeScale: 0.3 + energy,
    warpAmount: 0.3 + energy * 0.18,
    pulseStrength: 0.12 + energy * 0.18,
    chromaOffset: 0.00045 + energy * 0.00135,
    lensStrength: 0.32 + energy * 0.1
  };
}
