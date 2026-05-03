import { NextResponse, type NextRequest } from "next/server";

interface GeoPayload {
  located: boolean;
  latitudeDeg?: number;
  longitudeDeg?: number;
  label?: string;
  timeZone?: string;
  source: "edge-geo" | "ipapi" | "ipinfo" | "manual" | "unavailable";
}

const GEO_CACHE_HEADERS = {
  "Cache-Control": "private, max-age=3600"
} as const;

function parseCoordinate(value: string | null, min: number, max: number) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) {
      return value;
    }
  }

  return null;
}

function decodeHeaderLabel(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function response(payload: GeoPayload) {
  return NextResponse.json(payload, { headers: GEO_CACHE_HEADERS });
}

function edgeGeoPayload(request: NextRequest): GeoPayload | null {
  const latitudeDeg = parseCoordinate(
    firstHeader(request.headers, ["x-vercel-ip-latitude", "cf-iplatitude"]),
    -90,
    90
  );
  const longitudeDeg = parseCoordinate(
    firstHeader(request.headers, ["x-vercel-ip-longitude", "cf-iplongitude"]),
    -180,
    180
  );

  if (latitudeDeg === null || longitudeDeg === null) {
    return null;
  }

  const city = decodeHeaderLabel(firstHeader(request.headers, ["x-vercel-ip-city", "cf-ipcity"]));
  const region = decodeHeaderLabel(firstHeader(request.headers, ["x-vercel-ip-country-region", "cf-region"]));
  const country = decodeHeaderLabel(firstHeader(request.headers, ["x-vercel-ip-country", "cf-ipcountry"]));
  const timeZone = firstHeader(request.headers, ["x-vercel-ip-timezone", "cf-timezone"]);
  const label = [city, region, country].filter(Boolean).join(", ") || "Visitor location";

  return {
    located: true,
    latitudeDeg,
    longitudeDeg,
    label,
    ...(timeZone ? { timeZone } : {}),
    source: "edge-geo"
  };
}

function isPrivateIp(ip: string) {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^fc|^fd/i.test(ip)
  );
}

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  return firstForwarded || request.headers.get("x-real-ip") || null;
}

async function lookupPublicIp(ip: string | null): Promise<GeoPayload | null> {
  if (process.env.LUBIRTH_IP_GEO_LOOKUP === "off") {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 900);
  const endpoint = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/";

  try {
    const result = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!result.ok) {
      return null;
    }

    const data = await result.json() as {
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country_name?: string;
      timezone?: string;
      error?: boolean;
    };

    if (
      data.error ||
      typeof data.latitude !== "number" ||
      typeof data.longitude !== "number" ||
      data.latitude < -90 ||
      data.latitude > 90 ||
      data.longitude < -180 ||
      data.longitude > 180
    ) {
      return null;
    }

    return {
      located: true,
      latitudeDeg: data.latitude,
      longitudeDeg: data.longitude,
      label: [data.city, data.region, data.country_name].filter(Boolean).join(", ") || "Visitor location",
      ...(data.timezone ? { timeZone: data.timezone } : {}),
      source: "ipapi"
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupIpInfo(ip: string | null): Promise<GeoPayload | null> {
  if (process.env.LUBIRTH_IP_GEO_LOOKUP === "off") {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1600);
  const endpoint = ip ? `https://ipinfo.io/${encodeURIComponent(ip)}/json` : "https://ipinfo.io/json";

  try {
    const result = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!result.ok) {
      return null;
    }

    const data = await result.json() as {
      loc?: string;
      city?: string;
      region?: string;
      country?: string;
      timezone?: string;
      bogon?: boolean;
      error?: unknown;
    };
    const [latitudeRaw, longitudeRaw] = data.loc?.split(",") ?? [];
    const latitudeDeg = Number.parseFloat(latitudeRaw ?? "");
    const longitudeDeg = Number.parseFloat(longitudeRaw ?? "");

    if (
      data.bogon ||
      data.error ||
      !Number.isFinite(latitudeDeg) ||
      !Number.isFinite(longitudeDeg) ||
      latitudeDeg < -90 ||
      latitudeDeg > 90 ||
      longitudeDeg < -180 ||
      longitudeDeg > 180
    ) {
      return null;
    }

    return {
      located: true,
      latitudeDeg,
      longitudeDeg,
      label: [data.city, data.region, data.country].filter(Boolean).join(", ") || "Visitor location",
      ...(data.timezone ? { timeZone: data.timezone } : {}),
      source: "ipinfo"
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const manualLatitude = parseCoordinate(request.nextUrl.searchParams.get("lat"), -90, 90);
  const manualLongitude = parseCoordinate(request.nextUrl.searchParams.get("lon"), -180, 180);

  if (manualLatitude !== null && manualLongitude !== null) {
    return response({
      located: true,
      latitudeDeg: manualLatitude,
      longitudeDeg: manualLongitude,
      label: request.nextUrl.searchParams.get("label") || "Manual location",
      ...(request.nextUrl.searchParams.get("timeZone") || request.nextUrl.searchParams.get("tz")
        ? { timeZone: request.nextUrl.searchParams.get("timeZone") || request.nextUrl.searchParams.get("tz") || undefined }
        : {}),
      source: "manual"
    });
  }

  const headerLocation = edgeGeoPayload(request);
  if (headerLocation) {
    return response(headerLocation);
  }

  const ip = clientIp(request);
  if (ip && !isPrivateIp(ip)) {
    const ipLocation = await lookupPublicIp(ip) ?? await lookupIpInfo(ip);
    if (ipLocation) {
      return response(ipLocation);
    }
  }

  if (!ip || isPrivateIp(ip)) {
    const currentIpLocation = await lookupPublicIp(null) ?? await lookupIpInfo(null);
    if (currentIpLocation) {
      return response(currentIpLocation);
    }
  }

  return response({ located: false, source: "unavailable" });
}
