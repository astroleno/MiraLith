import {
  HOME_CLOUD_FIELD_OFFSET_X,
  HOME_CLOUD_FIELD_OFFSET_Y
} from "../../homeCloudField";

export const TAKRAM_PARITY_V3_CLEAR_AIR_THRESHOLD = 0.05;

export const TAKRAM_PARITY_V3_ADAPTER = Object.freeze({
  clearAirThreshold: TAKRAM_PARITY_V3_CLEAR_AIR_THRESHOLD,
  flipU: true,
  flipY: true,
  globalWeatherMapping: true,
  localWeatherSha256: "ff2b7715cc59a4031a7eb6ff7e77ce52a730996c9dfe9d529dfa25aa01481a9b",
  offset: [-HOME_CLOUD_FIELD_OFFSET_X, HOME_CLOUD_FIELD_OFFSET_Y] as const,
  orientation: "equirectangular-y-up-source-to-z-up-ecef" as const,
  repeat: [1, 1] as const,
  runtimeUrl: "/assets/lubirth/takram-parity/v3/weather.png"
});

/**
 * The source values are intentionally pinned before the narrow pnpm patch is
 * applied. The patched hashes pin the browser-facing ESM bundle as well as
 * the source used to regenerate the patch; R3F remains byte-for-byte upstream.
 */
export const TAKRAM_PARITY_V3_PATCH_AUDIT = Object.freeze({
  patchedSourceHashes: Object.freeze({
    "build/shared.cjs": "b099d176aa70e9c938b0599fece0180aeb33af4b3b81936f40092c9ae89ed602",
    "build/shared.js": "c2115702324e01760429187faf6203c2a118812c508429edbebe37e2e1d7c018",
    "src/CloudsEffect.ts": "ccc1d0db7627e5d2e13e81748619e5e6c52a96ceb2d2ba8f34a43a03e2778cff",
    "src/r3f/Clouds.tsx": "5a05e9c5fe97386be85b54dec588ba84237f857bb21404726179c53f018d4e53",
    "src/shaders/clouds.glsl": "1fc4a4de4927c12dea23bf0590b24babf7251a0e6a6a442ac141d43c60caae19"
  }),
  upstreamSourceHashes: Object.freeze({
    "build/shared.js": "cb1b4ec2400f873c1fe8cac6a00331a3972c9b7cdbc6349496e3c2de06886804",
    "src/CloudsEffect.ts": "db3800833dfb13e96ec292a631f9a782f7637909fb167c9443cd64583c9b43c3",
    "src/r3f/Clouds.tsx": "5a05e9c5fe97386be85b54dec588ba84237f857bb21404726179c53f018d4e53",
    "src/shaders/clouds.glsl": "bbb3f037e55aed6c989d77d197af33f44ee5565b0ca7988eab44f52ddd509eb5"
  })
});

export interface TakramParityAdapterFields {
  disableDefaultLayers: boolean;
  globalWeatherMapping: boolean;
  localWeatherOffset: readonly [number, number];
  localWeatherRepeat: readonly [number, number];
  localWeatherSource: "stock" | "v3";
}

const STOCK_ADAPTER_FIELDS: TakramParityAdapterFields = Object.freeze({
  disableDefaultLayers: false,
  globalWeatherMapping: false,
  localWeatherOffset: [0, 0] as const,
  localWeatherRepeat: [100, 100] as const,
  localWeatherSource: "stock"
});

const V3_ADAPTER_FIELDS: TakramParityAdapterFields = Object.freeze({
  disableDefaultLayers: true,
  globalWeatherMapping: true,
  localWeatherOffset: TAKRAM_PARITY_V3_ADAPTER.offset,
  localWeatherRepeat: TAKRAM_PARITY_V3_ADAPTER.repeat,
  localWeatherSource: "v3"
});

/**
 * Adapter-owned fields are the complete allow-list for the stock/V3
 * comparison. Takram's raymarch, BSM, shape/detail, lighting, temporal,
 * resolve/history and atmosphere composition remain outside this structure.
 */
export function resolveTakramParityAdapter(
  input: "stock" | "v3"
): TakramParityAdapterFields {
  return input === "v3" ? V3_ADAPTER_FIELDS : STOCK_ADAPTER_FIELDS;
}

/**
 * Convert V3's semantic R/G/B/A controls to Takram's base/tower/structure/
 * wisp channels. The R footprint gates every result, so G/B/A cannot create
 * cloud coverage outside source V3 coverage.
 */
export function adaptTakramParityV3WeatherPixel(
  input: readonly number[]
): Uint8Array {
  if (input.length !== 4) {
    throw new Error("Takram V3 weather pixels require exactly four RGBA bytes.");
  }
  const sourceCoverage = (input[0] ?? 0) / 255;
  if (sourceCoverage < TAKRAM_PARITY_V3_CLEAR_AIR_THRESHOLD) {
    return new Uint8Array(4);
  }
  return Uint8Array.from([
    Math.round(sourceCoverage * 255),
    Math.round(sourceCoverage * (input[1] ?? 0)),
    Math.round(sourceCoverage * (input[2] ?? 0)),
    Math.round(sourceCoverage * (input[3] ?? 0))
  ]);
}
