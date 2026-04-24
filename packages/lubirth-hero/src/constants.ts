export const DEFAULT_LUBIRTH_DATE = "1993-08-01T12:00:00Z" as const;
export const DEFAULT_LUBIRTH_MOON_PHASE = {
  date: DEFAULT_LUBIRTH_DATE,
  illumination: 0.97,
  phaseAngleRad: 0.24,
  sunDirection: [0.68, 0.42, 0.6] as [number, number, number],
  positionAngleRad: 0,
  source: "precomputed"
} as const;
export const FIXED_SUN_POSITION = [4.2, 2.8, 4.8] as const;
export const CAMERA_TARGET = [0, 0.04, 0] as const;
