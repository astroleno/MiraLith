"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type Wrapping
} from "three";
import type { TextureRef } from "./types";

interface LandingTextureOptions {
  colorSpace?: TextureRef["colorSpace"];
  wrapS?: Wrapping;
  wrapT?: Wrapping;
  anisotropy?: number;
}

interface CachedTextureEntry {
  texture: Texture | null;
  failed: boolean;
  refs: number;
  subscribers: Set<() => void>;
  disposeTimer: ReturnType<typeof setTimeout> | null;
  loading: boolean;
}

const textureCache = new Map<string, CachedTextureEntry>();
const DEFAULT_ANISOTROPY = 16;
const DISPOSE_DELAY_MS = 1200;

function makeTextureKey(src: string, options: Required<LandingTextureOptions>) {
  return [
    src,
    options.colorSpace,
    options.wrapS,
    options.wrapT,
    options.anisotropy
  ].join("|");
}

function notifySubscribers(entry: CachedTextureEntry) {
  entry.subscribers.forEach((subscriber) => subscriber());
}

function configureTexture(texture: Texture, options: Required<LandingTextureOptions>) {
  texture.colorSpace = options.colorSpace === "srgb" ? SRGBColorSpace : texture.colorSpace;
  texture.wrapS = options.wrapS;
  texture.wrapT = options.wrapT;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = options.anisotropy;
  texture.needsUpdate = true;
}

function acquireTexture(src: string, options: Required<LandingTextureOptions>, key: string) {
  let entry = textureCache.get(key);

  if (!entry) {
    entry = {
      texture: null,
      failed: false,
      refs: 0,
      subscribers: new Set(),
      disposeTimer: null,
      loading: true
    };
    textureCache.set(key, entry);

    const loader = new TextureLoader();
    loader.load(
      src,
      (texture) => {
        const activeEntry = textureCache.get(key);
        if (!activeEntry) {
          texture.dispose();
          return;
        }

        configureTexture(texture, options);
        activeEntry.texture = texture;
        activeEntry.loading = false;
        activeEntry.failed = false;
        notifySubscribers(activeEntry);
      },
      undefined,
      () => {
        const activeEntry = textureCache.get(key);
        if (!activeEntry) {
          return;
        }

        activeEntry.texture = null;
        activeEntry.loading = false;
        activeEntry.failed = true;
        notifySubscribers(activeEntry);
      }
    );
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
  const resolvedOptions = useMemo<Required<LandingTextureOptions>>(
    () => ({
      colorSpace: options.colorSpace ?? "srgb",
      wrapS: options.wrapS ?? RepeatWrapping,
      wrapT: options.wrapT ?? ClampToEdgeWrapping,
      anisotropy: options.anisotropy ?? DEFAULT_ANISOTROPY
    }),
    [options.anisotropy, options.colorSpace, options.wrapS, options.wrapT]
  );
  const key = useMemo(
    () => (src ? makeTextureKey(src, resolvedOptions) : ""),
    [resolvedOptions, src]
  );
  const [texture, setTexture] = useState<Texture | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setTexture(null);
      setFailed(false);
      return undefined;
    }

    const entry = acquireTexture(src, resolvedOptions, key);
    const sync = () => {
      setTexture(entry.texture);
      setFailed(entry.failed);
    };

    entry.subscribers.add(sync);
    sync();

    return () => {
      entry.subscribers.delete(sync);
      releaseTexture(key);
    };
  }, [key, resolvedOptions, src]);

  return { texture, failed };
}

