export const DEFAULT_LUBIRTH_DATE = "1993-08-01T11:03:00" as const;

export const DEFAULT_LUBIRTH_LOCATION = {
  latitudeDeg: 31.467,
  longitudeDeg: 104.679
} as const;

const rad = Math.PI / 180;
const TWO_PI = Math.PI * 2;

export function geodeticToTextureVector(latitudeDeg: number, longitudeDeg: number) {
  const phi = ((longitudeDeg + 180) / 360) * TWO_PI;
  const theta = (90 - latitudeDeg) * rad;

  return [
    -Math.cos(phi) * Math.sin(theta),
    Math.cos(theta),
    Math.sin(phi) * Math.sin(theta)
  ] as const;
}

export const DEFAULT_LUBIRTH_LOCATION_VECTOR = geodeticToTextureVector(
  DEFAULT_LUBIRTH_LOCATION.latitudeDeg,
  DEFAULT_LUBIRTH_LOCATION.longitudeDeg
);

export const DEFAULT_LUBIRTH_LOCATION_TARGET = {
  desktopReferenceWidth: 2048,
  desktopReferenceHeight: 1159,
  x: 1029,
  y: 941,
  toleranceX: 24,
  toleranceY: 28
} as const;

function dayOfYearUtc(dateUtc: Date) {
  const start = Date.UTC(dateUtc.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate()) - start) / 86400000) + 1;
}

function normalizeLongitude(longitudeDeg: number) {
  let result = longitudeDeg;
  while (result > 180) result -= 360;
  while (result < -180) result += 360;
  return result;
}

export function computeRuntimeSolarDirection(dateUtc = new Date()) {
  const minutesUtc = dateUtc.getUTCHours() * 60 + dateUtc.getUTCMinutes() + dateUtc.getUTCSeconds() / 60;
  const fractionalYear = (2 * Math.PI / 365) * (
    dayOfYearUtc(dateUtc) - 1 + (minutesUtc / 60 - 12) / 24
  );
  const equationOfTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(fractionalYear) -
    0.032077 * Math.sin(fractionalYear) -
    0.014615 * Math.cos(2 * fractionalYear) -
    0.040849 * Math.sin(2 * fractionalYear)
  );
  const declination =
    0.006918 -
    0.399912 * Math.cos(fractionalYear) +
    0.070257 * Math.sin(fractionalYear) -
    0.006758 * Math.cos(2 * fractionalYear) +
    0.000907 * Math.sin(2 * fractionalYear) -
    0.002697 * Math.cos(3 * fractionalYear) +
    0.00148 * Math.sin(3 * fractionalYear);
  const subsolarLongitude = normalizeLongitude((720 - minutesUtc - equationOfTime) / 4);

  const [x, y, z] = geodeticToTextureVector(declination / rad, subsolarLongitude);
  return [x, y, z] as [number, number, number];
}

function computeSolarDirection(localISO: string, longitudeDeg: number, utcOffsetHours = 8) {
  const match = localISO.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return [0.68, 0.42, 0.6] as [number, number, number];
  }

  const [, year, month, day, hour, minute] = match;
  const utc = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - utcOffsetHours,
    Number(minute),
    0
  ));
  const minutesUtc = utc.getUTCHours() * 60 + utc.getUTCMinutes() + utc.getUTCSeconds() / 60;
  const fractionalYear = (2 * Math.PI / 365) * (
    dayOfYearUtc(utc) - 1 + (minutesUtc / 60 - 12) / 24
  );
  const equationOfTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(fractionalYear) -
    0.032077 * Math.sin(fractionalYear) -
    0.014615 * Math.cos(2 * fractionalYear) -
    0.040849 * Math.sin(2 * fractionalYear)
  );
  const declination =
    0.006918 -
    0.399912 * Math.cos(fractionalYear) +
    0.070257 * Math.sin(fractionalYear) -
    0.006758 * Math.cos(2 * fractionalYear) +
    0.000907 * Math.sin(2 * fractionalYear) -
    0.002697 * Math.cos(3 * fractionalYear) +
    0.00148 * Math.sin(3 * fractionalYear);
  const subsolarLongitude = normalizeLongitude((720 - minutesUtc - equationOfTime) / 4);
  const longitude = subsolarLongitude * rad;
  const ecefX = Math.cos(declination) * Math.cos(longitude);
  const ecefY = Math.cos(declination) * Math.sin(longitude);
  const ecefZ = Math.sin(declination);

  return [ecefX, ecefZ, ecefY] as [number, number, number];
}

export const DEFAULT_LUBIRTH_SUN_DIRECTION = computeSolarDirection(
  DEFAULT_LUBIRTH_DATE,
  DEFAULT_LUBIRTH_LOCATION.longitudeDeg,
  8
);

export const DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION = [-0.03, 0.05, 0.998] as const;

export const DEFAULT_LUBIRTH_MOON_PHASE = {
  date: DEFAULT_LUBIRTH_DATE,
  illumination: 0.984,
  phaseAngleRad: 0.253,
  sunDirection: DEFAULT_LUBIRTH_SUN_DIRECTION,
  positionAngleRad: 0,
  source: "precomputed"
} as const;
export const FIXED_SUN_POSITION = [4.2, 2.8, 4.8] as const;
export const CAMERA_TARGET = [0, 0.04, 0] as const;
