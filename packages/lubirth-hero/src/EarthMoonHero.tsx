"use client";

import { Canvas } from "@react-three/fiber";
import { Component, type ErrorInfo, type ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { resolveQualityTier, useQualityTier } from "@miralith/visual-core";
import { EarthMoonScene } from "./EarthMoonScene";
import { PosterFallback } from "./PosterFallback";
import { resolveLandingAssets } from "./assetManifest";
import { resolveLandingPreset } from "./presets";
import type { EarthMoonHeroProps } from "./types";

interface CanvasErrorBoundaryProps {
  fallback: ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
}

interface CanvasErrorBoundaryState {
  failed: boolean;
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function canUseWebGL() {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function EarthMoonHero({
  mode = "field",
  preset = "field",
  quality = "auto",
  className,
  style,
  reducedMotion = false,
  paused = false,
  posterSrc,
  assets,
  composition,
  onReady,
  onQualityChange,
  onError
}: EarthMoonHeroProps) {
  const [webglAvailable, setWebglAvailable] = useState(true);
  const initialQuality = useMemo(() => resolveQualityTier({ requested: quality, reducedMotion }), [quality, reducedMotion]);
  const qualityProfile = useQualityTier(quality, reducedMotion);
  const resolvedComposition = useMemo(
    () => resolveLandingPreset(preset, composition),
    [composition, preset]
  );
  const resolvedAssets = useMemo(() => resolveLandingAssets(assets), [assets]);

  useEffect(() => {
    setWebglAvailable(canUseWebGL());
  }, []);

  useEffect(() => {
    onQualityChange?.(qualityProfile.tier);
  }, [onQualityChange, qualityProfile.tier]);

  if (!webglAvailable || qualityProfile.tier === "fallback") {
    return <PosterFallback posterSrc={posterSrc} className={className} />;
  }

  return (
    <div className={["lubirth-hero", className].filter(Boolean).join(" ")} style={style} aria-hidden="true">
      <CanvasErrorBoundary
        fallback={<PosterFallback posterSrc={posterSrc} />}
        onError={(error) => onError?.({ message: error.message })}
      >
        <Canvas
          dpr={[1, qualityProfile.dpr || initialQuality.dpr]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
          camera={{ fov: 42, position: [0, 2.8, resolvedComposition.camera.distance], near: 0.1, far: 90 }}
          onCreated={() => onReady?.({ mode, quality: qualityProfile.tier })}
        >
          <Suspense fallback={null}>
            <EarthMoonScene
              mode={mode}
              composition={resolvedComposition}
              assets={resolvedAssets}
              quality={qualityProfile}
              reducedMotion={reducedMotion}
              paused={paused}
            />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
