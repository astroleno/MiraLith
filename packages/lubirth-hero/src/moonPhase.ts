import { DEFAULT_LUBIRTH_SUN_DIRECTION } from "./constants";
import type { LandingMoonPhase } from "./types";

const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const DAY_MS = 86_400_000;

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeRuntimeMoonPhase(date: Date = new Date()): LandingMoonPhase {
  const daysSinceKnownNewMoon = (date.getTime() - KNOWN_NEW_MOON_UTC_MS) / DAY_MS;
  const phase = positiveModulo(daysSinceKnownNewMoon / SYNODIC_MONTH_DAYS, 1);
  const phaseAngleRad = phase <= 0.5
    ? Math.PI * (1 - phase * 2)
    : -Math.PI * ((phase - 0.5) * 2);
  const illumination = (1 + Math.cos(phaseAngleRad)) * 0.5;

  return {
    date: toLocalDateKey(date),
    illumination,
    phaseAngleRad,
    sunDirection: [...DEFAULT_LUBIRTH_SUN_DIRECTION],
    positionAngleRad: phaseAngleRad,
    source: "runtime-ephemeris"
  };
}
