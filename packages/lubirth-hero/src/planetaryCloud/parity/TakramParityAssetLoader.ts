import {
  Data3DTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  Texture,
  TextureLoader,
  UnsignedByteType
} from "three";
import { useEffect, useState } from "react";
import {
  TAKRAM_PARITY_STOCK_ASSETS,
  type TakramParityInput,
  type TakramParityStockAsset
} from "./TakramParityContract";
import { TAKRAM_PARITY_V3_ADAPTER } from "./TakramParityV3Adapter";

type TakramParityRuntimeAssetId = Exclude<TakramParityStockAsset["id"], "upstreamTokyo">;
type TakramParityRuntimeAsset = TakramParityStockAsset & { runtimeUrl: string };

function getRuntimeAsset(assetId: TakramParityRuntimeAssetId): TakramParityRuntimeAsset {
  const asset = TAKRAM_PARITY_STOCK_ASSETS.find((candidate) => candidate.id === assetId);
  if (!asset?.runtimeUrl) {
    throw new Error(`Takram parity asset ${assetId} does not have a local runtime URL.`);
  }
  return { ...asset, runtimeUrl: asset.runtimeUrl };
}

export const TAKRAM_PARITY_RUNTIME_ASSET_URLS = Object.freeze({
  localWeather: getRuntimeAsset("localWeather").runtimeUrl,
  shape: getRuntimeAsset("shape").runtimeUrl,
  shapeDetail: getRuntimeAsset("shapeDetail").runtimeUrl,
  stbn: getRuntimeAsset("stbn").runtimeUrl,
  turbulence: getRuntimeAsset("turbulence").runtimeUrl
});

export interface TakramParityRuntimeAssets {
  localWeather: Texture;
  localWeatherSha256: string;
  localWeatherSource: "stock" | "v3";
  shape: Data3DTexture;
  shapeDetail: Data3DTexture;
  stbn: Data3DTexture;
  turbulence: Texture;
}

export interface TakramParityRuntimeAssetsState {
  assetGeneration: number;
  assets: TakramParityRuntimeAssets | null;
  error: Error | null;
  ready: boolean;
}

export type TakramParityTextureDomain = "stock" | "v3";

function configureTwoDimensionalTexture(
  texture: Texture,
  domain: TakramParityTextureDomain = "stock"
) {
  texture.colorSpace = NoColorSpace;
  texture.flipY = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.wrapS = RepeatWrapping;
  // Stock Takram textures are local cube-sphere fields and retain upstream
  // repeat semantics. V3 is equirectangular: longitude repeats, latitude
  // clamps so polar filtering never wraps the north pole into the south.
  texture.wrapT = domain === "v3" ? ClampToEdgeWrapping : RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function configureThreeDimensionalTexture(texture: Data3DTexture, stbn: boolean) {
  texture.colorSpace = NoColorSpace;
  texture.format = RedFormat;
  texture.magFilter = stbn ? NearestFilter : LinearFilter;
  texture.minFilter = stbn ? NearestFilter : LinearFilter;
  texture.type = UnsignedByteType;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.wrapR = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function isData3DTexture(texture: Texture): texture is Data3DTexture {
  return (texture as Data3DTexture).isData3DTexture === true;
}

export function configureTakramParityTexture<T extends Texture>(
  assetId: "localWeather" | "turbulence",
  texture: T,
  domain?: TakramParityTextureDomain
): T;
export function configureTakramParityTexture(
  assetId: "shape" | "shapeDetail" | "stbn",
  texture: Data3DTexture
): Data3DTexture;
export function configureTakramParityTexture(
  assetId: TakramParityRuntimeAssetId,
  texture: Texture,
  domain: TakramParityTextureDomain = "stock"
): Texture {
  if (assetId === "localWeather" || assetId === "turbulence") {
    return configureTwoDimensionalTexture(texture, domain);
  }

  if (!isData3DTexture(texture)) {
    throw new Error(`Takram parity asset ${assetId} requires a Data3DTexture.`);
  }
  return configureThreeDimensionalTexture(texture, assetId === "stbn");
}

function loadTextureAtUrl(
  runtimeUrl: string,
  domain: TakramParityTextureDomain = "stock"
): Promise<Texture> {
  const loader = new TextureLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      runtimeUrl,
      (texture) => resolve(configureTwoDimensionalTexture(texture, domain)),
      undefined,
      reject
    );
  });
}

function resolveLocalWeatherSource(input: TakramParityInput) {
  if (input === "v3") {
    return {
      runtimeUrl: TAKRAM_PARITY_V3_ADAPTER.runtimeUrl,
      sha256: TAKRAM_PARITY_V3_ADAPTER.localWeatherSha256,
      source: "v3" as const
    };
  }
  return {
    runtimeUrl: TAKRAM_PARITY_RUNTIME_ASSET_URLS.localWeather,
    sha256: getRuntimeAsset("localWeather").sha256,
    source: "stock" as const
  };
}

async function loadLocalData3DTexture(
  assetId: "shape" | "shapeDetail" | "stbn",
  signal?: AbortSignal
): Promise<Data3DTexture> {
  const asset = getRuntimeAsset(assetId);
  const response = await fetch(asset.runtimeUrl, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load local Takram parity asset ${assetId} (${response.status}).`);
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength !== asset.byteLength) {
    throw new Error(`Takram parity asset ${assetId} has ${data.byteLength} bytes; expected ${asset.byteLength}.`);
  }
  const [width, height, depth] = asset.dimensions;
  return configureTakramParityTexture(
    assetId,
    new Data3DTexture(data, width, height, depth)
  );
}

export async function loadTakramParityRuntimeAssets(
  input: TakramParityInput,
  signal?: AbortSignal
): Promise<TakramParityRuntimeAssets> {
  const localWeatherSource = resolveLocalWeatherSource(input);
  const [localWeather, turbulence, shape, shapeDetail, stbn] = await Promise.all([
    loadTextureAtUrl(localWeatherSource.runtimeUrl, localWeatherSource.source),
    loadTextureAtUrl(TAKRAM_PARITY_RUNTIME_ASSET_URLS.turbulence),
    loadLocalData3DTexture("shape", signal),
    loadLocalData3DTexture("shapeDetail", signal),
    loadLocalData3DTexture("stbn", signal)
  ]);
  return {
    localWeather,
    localWeatherSha256: localWeatherSource.sha256,
    localWeatherSource: localWeatherSource.source,
    shape,
    shapeDetail,
    stbn,
    turbulence
  };
}

export function disposeTakramParityRuntimeAssets(
  assets: TakramParityRuntimeAssets | null | undefined
) {
  assets?.localWeather.dispose();
  assets?.shape.dispose();
  assets?.shapeDetail.dispose();
  assets?.stbn.dispose();
  assets?.turbulence.dispose();
}

export function getNextTakramParityAssetGeneration(generation: number) {
  return Number.isSafeInteger(generation) && generation >= 0 ? generation + 1 : 0;
}

/**
 * The browser can restore a WebGL context while the page remains mounted. A
 * fresh generation deliberately creates new Texture/Data3DTexture instances,
 * rather than relying on an already-uploaded resource from the lost context.
 */
export function useTakramParityRuntimeAssets(
  canvas: HTMLCanvasElement | null,
  input: TakramParityInput
): TakramParityRuntimeAssetsState {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<TakramParityRuntimeAssetsState>({
    assetGeneration: 0,
    assets: null,
    error: null,
    ready: false
  });

  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const onContextRestored = () => {
      setGeneration((current) => getNextTakramParityAssetGeneration(current));
    };
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    return () => canvas.removeEventListener("webglcontextrestored", onContextRestored);
  }, [canvas]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let loadedAssets: TakramParityRuntimeAssets | null = null;
    setState({ assetGeneration: generation, assets: null, error: null, ready: false });

    void loadTakramParityRuntimeAssets(input, controller.signal)
      .then((assets) => {
        loadedAssets = assets;
        if (!active) {
          disposeTakramParityRuntimeAssets(assets);
          return;
        }
        setState({ assetGeneration: generation, assets, error: null, ready: true });
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setState({
          assetGeneration: generation,
          assets: null,
          error: error instanceof Error ? error : new Error(String(error)),
          ready: false
        });
      });

    return () => {
      active = false;
      controller.abort();
      disposeTakramParityRuntimeAssets(loadedAssets);
    };
  }, [generation, input]);

  return state;
}
