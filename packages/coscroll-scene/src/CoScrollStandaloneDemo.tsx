"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CoScrollSceneContent } from "./CoScrollSceneContent";
import type { CoScrollFallbackReason, CoScrollSceneContentProps } from "./types";

interface CoScrollStandaloneDemoProps extends CoScrollSceneContentProps {
  className?: string;
  fallback?: ReactNode;
}

export function CoScrollStandaloneDemo({ className, fallback, onFallback, ...props }: CoScrollStandaloneDemoProps) {
  const [fallbackReason, setFallbackReason] = useState<CoScrollFallbackReason | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const forcedFallback =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("visual") === "fallback";
  const preserveDrawingBuffer = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("visualTest") === "pixels" || params.get("motionTest") === "1";
  }, []);
  const effectiveReducedMotion = Boolean(props.reducedMotion || prefersReducedMotion);
  const sourceMatchMode = props.quality.reason === "source-match";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setPrefersReducedMotion(media.matches);
    updateReducedMotion();
    media.addEventListener("change", updateReducedMotion);

    return () => media.removeEventListener("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewport = () => setViewport(window.innerWidth < 768 ? "mobile" : "desktop");
    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const handleFallback = useCallback((reason: CoScrollFallbackReason) => {
    setFallbackReason(reason);
    onFallback?.(reason);
  }, [onFallback]);

  if (forcedFallback) {
    return (
      <div className={className} data-coscroll-standalone data-coscroll-fallback="forced">
        {fallback}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-coscroll-standalone
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        background: "#010205"
      }}
    >
      <Canvas
        orthographic={sourceMatchMode}
        dpr={[1, Math.max(1, props.quality.dpr)]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer }}
        camera={
          sourceMatchMode
            ? { position: [0, 0, 12], zoom: viewport === "mobile" ? 92 : 100, near: 0.1, far: 50 }
            : { fov: 42, position: [0, 0, 7.2], near: 0.1, far: 60 }
        }
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <CoScrollSceneContent
            {...props}
            viewport={viewport}
            reducedMotion={effectiveReducedMotion}
            onFallback={handleFallback}
          />
        </Suspense>
      </Canvas>
      {fallbackReason ? (
        <span
          style={{
            position: "absolute",
            left: 24,
            bottom: 22,
            color: "rgba(232, 218, 176, 0.72)",
            font: "12px/1.4 ui-sans-serif, system-ui, sans-serif"
          }}
        >
          CoScroll fallback: {fallbackReason}
        </span>
      ) : null}
    </div>
  );
}
