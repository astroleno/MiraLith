export const RELIEF_SCATTERING_CONFIG = {
  octaves: [
    { gScale: 1, strengthPower: 0, tauScale: 1 },
    { gScale: 0.5, strengthPower: 1, tauScale: 0.25 },
    { gScale: 0.25, strengthPower: 2, tauScale: 0.0625 }
  ],
  phaseEpsilon: 0.001
} as const;

export const RELIEF_SCATTERING_CANDIDATES = [
  { id: "g065-ms018", g: 0.65, multiScatter: 0.18 },
  { id: "g065-ms028", g: 0.65, multiScatter: 0.28 },
  { id: "g072-ms018", g: 0.72, multiScatter: 0.18 },
  { id: "g072-ms028", g: 0.72, multiScatter: 0.28 },
  { id: "g078-ms018", g: 0.78, multiScatter: 0.18 },
  { id: "g078-ms028", g: 0.78, multiScatter: 0.28 }
] as const;

export type ReliefScatteringCandidate = (typeof RELIEF_SCATTERING_CANDIDATES)[number];
export type ReliefScatteringCandidateId = ReliefScatteringCandidate["id"];

export const DEFAULT_RELIEF_SCATTERING_CANDIDATE_ID =
  RELIEF_SCATTERING_CANDIDATES[0].id;

export function resolveReliefScatteringCandidate(
  id: string | null | undefined
): ReliefScatteringCandidate {
  return RELIEF_SCATTERING_CANDIDATES.find((candidate) => candidate.id === id) ??
    RELIEF_SCATTERING_CANDIDATES[0];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function resolveHenyeyGreenstein(cosTheta: number, g: number) {
  const clampedCosTheta = clamp(cosTheta, -1, 1);
  const clampedG = clamp(g, -0.999, 0.999);
  const gg = clampedG * clampedG;
  const denominator = Math.pow(
    Math.max(1 + gg - 2 * clampedG * clampedCosTheta, RELIEF_SCATTERING_CONFIG.phaseEpsilon),
    1.5
  );

  return (1 - gg) / denominator;
}

export function resolveBeerTransmittance(tau: number) {
  return Math.exp(-Math.max(tau, 0));
}

export function resolveCheapMultiScatter(
  tau: number,
  g: number,
  strength: number,
  cosTheta = 1
) {
  const safeStrength = Math.max(strength, 0);

  return RELIEF_SCATTERING_CONFIG.octaves.reduce((total, octave) => (
    total + (
      resolveBeerTransmittance(tau * octave.tauScale) *
      resolveHenyeyGreenstein(cosTheta, g * octave.gScale) *
      Math.pow(safeStrength, octave.strengthPower)
    )
  ), 0);
}

const [singleOctave, firstScatterOctave, secondScatterOctave] =
  RELIEF_SCATTERING_CONFIG.octaves;

function glslFloat(value: number) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

export const RELIEF_SCATTERING_GLSL = `
float hgPhase(float cosTheta, float g) {
  float gg = g * g;
  float denominator = pow(
    max(1.0 + gg - 2.0 * g * cosTheta, ${RELIEF_SCATTERING_CONFIG.phaseEpsilon}),
    1.5
  );
  return (1.0 - gg) / denominator;
}

float cheapMultiScatter(float tau, float cosTheta, float g, float strength) {
  float single = exp(-tau * ${glslFloat(singleOctave.tauScale)}) *
    hgPhase(cosTheta, g * ${glslFloat(singleOctave.gScale)});
  float octave1 = exp(-tau * ${glslFloat(firstScatterOctave.tauScale)}) *
    hgPhase(cosTheta, g * ${glslFloat(firstScatterOctave.gScale)}) *
    pow(strength, ${glslFloat(firstScatterOctave.strengthPower)});
  float octave2 = exp(-tau * ${glslFloat(secondScatterOctave.tauScale)}) *
    hgPhase(cosTheta, g * ${glslFloat(secondScatterOctave.gScale)}) *
    pow(strength, ${glslFloat(secondScatterOctave.strengthPower)});
  return single + octave1 + octave2;
}
`;
