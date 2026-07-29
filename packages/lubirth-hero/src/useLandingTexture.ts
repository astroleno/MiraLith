"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type WebGLRenderer,
  type Wrapping
} from "three";
import type { TextureRef } from "./types";

interface LandingTextureOptions {
  fallbackSrc?: string;
  colorSpace?: TextureRef["colorSpace"];
  wrapS?: Wrapping;
  wrapT?: Wrapping;
  anisotropy?: number;
  renderer?: WebGLRenderer;
}

interface ResolvedLandingTextureOptions {
  anisotropy: number;
  colorSpace: TextureRef["colorSpace"];
  fallbackSrc?: string;
  renderer?: WebGLRenderer;
  wrapS: Wrapping;
  wrapT: Wrapping;
}

interface CachedTextureEntry {
  texture: Texture | null;
  failed: boolean;
  refs: number;
  subscribers: Set<() => void>;
  disposeTimer: ReturnType<typeof setTimeout> | null;
  loading: boolean;
  version: number;
}

const textureCache = new Map<string, CachedTextureEntry>();
const rendererCacheIds = new WeakMap<WebGLRenderer, number>();
const DEFAULT_ANISOTROPY = 16;
const DISPOSE_DELAY_MS = 1200;
const KTX2_LOAD_TIMEOUT_MS = 20_000;
let nextRendererCacheId = 1;

function getRendererCacheId(renderer: WebGLRenderer | undefined) {
  if (!renderer) {
    return 0;
  }
  const existing = rendererCacheIds.get(renderer);
  if (existing) {
    return existing;
  }
  const id = nextRendererCacheId;
  nextRendererCacheId += 1;
  rendererCacheIds.set(renderer, id);
  return id;
}

function makeTextureKey(src: string, options: ResolvedLandingTextureOptions) {
  return [
    src,
    options.fallbackSrc ?? "",
    options.colorSpace,
    options.wrapS,
    options.wrapT,
    options.anisotropy,
    src.endsWith(".ktx2") ? getRendererCacheId(options.renderer) : 0
  ].join("|");
}

function notifySubscribers(entry: CachedTextureEntry) {
  entry.subscribers.forEach((subscriber) => subscriber());
}

function configureTexture(texture: Texture, options: ResolvedLandingTextureOptions) {
  texture.colorSpace = options.colorSpace === "srgb" ? SRGBColorSpace : texture.colorSpace;
  texture.wrapS = options.wrapS;
  texture.wrapT = options.wrapT;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = options.anisotropy;
  texture.needsUpdate = true;
}

function acquireTexture(src: string, options: ResolvedLandingTextureOptions, key: string) {
  let entry = textureCache.get(key);

  if (!entry) {
    entry = {
      texture: null,
      failed: false,
      refs: 0,
      subscribers: new Set(),
      disposeTimer: null,
      loading: true,
      version: 0
    };
    textureCache.set(key, entry);

    const commitTexture = (texture: Texture) => {
      const activeEntry = textureCache.get(key);
      if (!activeEntry) {
        texture.dispose();
        return;
      }

      configureTexture(texture, options);
      activeEntry.texture = texture;
      activeEntry.loading = false;
      activeEntry.failed = false;
      activeEntry.version += 1;
      notifySubscribers(activeEntry);
    };
    const commitFailure = () => {
      const activeEntry = textureCache.get(key);
      if (!activeEntry) {
        return;
      }

      activeEntry.texture = null;
      activeEntry.loading = false;
      activeEntry.failed = true;
      activeEntry.version += 1;
      notifySubscribers(activeEntry);
    };
    const loadStandardTexture = (source: string, onFailure = commitFailure) => {
      const loader = new TextureLoader();
      loader.load(source, commitTexture, undefined, onFailure);
    };
    const loadFallback = () => {
      if (options.fallbackSrc && options.fallbackSrc !== src) {
        loadStandardTexture(options.fallbackSrc);
        return;
      }
      commitFailure();
    };

    if (src.endsWith(".ktx2")) {
      if (!options.renderer) {
        loadFallback();
      } else {
        void import("three/examples/jsm/loaders/KTX2Loader.js")
          .then(({ KTX2Loader }) => {
            let settled = false;
            const loader = new KTX2Loader()
              .setTranscoderPath("/assets/three/basis/")
              .setWorkerLimit(2)
              .detectSupport(options.renderer as WebGLRenderer);
            const timeout = setTimeout(() => {
              if (settled) {
                return;
              }
              settled = true;
              loader.dispose();
              loadFallback();
            }, KTX2_LOAD_TIMEOUT_MS);
            loader.load(
              src,
              (texture) => {
                if (settled) {
                  texture.dispose();
                  return;
                }
                settled = true;
                clearTimeout(timeout);
                loader.dispose();
                commitTexture(texture);
              },
              undefined,
              () => {
                if (settled) {
                  return;
                }
                settled = true;
                clearTimeout(timeout);
                loader.dispose();
                loadFallback();
              }
            );
          })
          .catch(loadFallback);
      }
    } else {
      loadStandardTexture(src);
    }
  }

  if (entry.disposeTimer) {
    clearTimeout(entry.disposeTimer);
    entry.disposeTimer = null;
  }
  entry.refs += 1;
  return entry;
}

function releaseTexture(key: string) {
  const entry = textureCache.get(key);
  if (!entry) {
    return;
  }

  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0 || entry.disposeTimer) {
    return;
  }

  entry.disposeTimer = setTimeout(() => {
    const latest = textureCache.get(key);
    if (!latest || latest.refs > 0) {
      return;
    }

    latest.texture?.dispose();
    textureCache.delete(key);
  }, DISPOSE_DELAY_MS);
}

export function useLandingTexture(src: string | undefined, options: LandingTextureOptions = {}) {
  const resolvedOptions = useMemo<ResolvedLandingTextureOptions>(
    () => ({
      colorSpace: options.colorSpace ?? "srgb",
      fallbackSrc: options.fallbackSrc,
      wrapS: options.wrapS ?? RepeatWrapping,
      wrapT: options.wrapT ?? ClampToEdgeWrapping,
      anisotropy: options.anisotropy ?? DEFAULT_ANISOTROPY,
      renderer: options.renderer
    }),
    [
      options.anisotropy,
      options.colorSpace,
      options.fallbackSrc,
      options.renderer,
      options.wrapS,
      options.wrapT
    ]
  );
  const key = useMemo(
    () => (src ? makeTextureKey(src, resolvedOptions) : ""),
    [resolvedOptions, src]
  );
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!src) {
        return () => undefined;
      }

      const entry = acquireTexture(src, resolvedOptions, key);
      entry.subscribers.add(onStoreChange);

      return () => {
        entry.subscribers.delete(onStoreChange);
        releaseTexture(key);
      };
    },
    [key, resolvedOptions, src]
  );
  const getSnapshot = useCallback(
    () => (key ? textureCache.get(key)?.version ?? 0 : 0),
    [key]
  );
  useSyncExternalStore(subscribe, getSnapshot, () => 0);

  const entry = key ? textureCache.get(key) : undefined;
  return {
    texture: entry?.texture ?? null,
    failed: entry?.failed ?? false
  };
}
