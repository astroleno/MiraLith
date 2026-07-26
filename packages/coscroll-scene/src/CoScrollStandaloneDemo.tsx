"use client";

import { Canvas } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode
} from "react";
import { CoScrollSceneContent } from "./CoScrollSceneContent";
import type { CoScrollFallbackReason, CoScrollSceneContentProps } from "./types";

interface CoScrollStandaloneDemoProps extends CoScrollSceneContentProps {
  className?: string;
  fallback?: ReactNode;
  forceFallback?: boolean;
}

interface CoScrollCanvasBoundaryProps {
  children: ReactNode;
  onFallback: (reason: CoScrollFallbackReason) => void;
}

class CoScrollCanvasBoundary extends Component<CoScrollCanvasBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFallback("webgl-unavailable");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function CoScrollStandaloneDemo({
  className,
  fallback,
  forceFallback = false,
  onFallback,
  onReadinessGenerationChange,
  ...props
}: CoScrollStandaloneDemoProps) {
  const [fallbackState, setFallbackState] = useState<{
    reason: CoScrollFallbackReason;
    baseGeneration: string;
    reportedGeneration: string;
  } | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const readinessGeneration = props.readinessGeneration ?? "default";
  const visualGenerationRef = useRef(readinessGeneration);
  const visualGenerationBaseRef = useRef(readinessGeneration);
  if (visualGenerationBaseRef.current !== readinessGeneration) {
    visualGenerationBaseRef.current = readinessGeneration;
    visualGenerationRef.current = readinessGeneration;
  }
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

  const handleFallback = useCallback((
    reason: CoScrollFallbackReason,
    reportedGeneration = readinessGeneration
  ) => {
    if (
      reportedGeneration !== readinessGeneration &&
      !reportedGeneration.startsWith(`${readinessGeneration}|`)
    ) {
      return;
    }
    setFallbackState({
      reason,
      baseGeneration: readinessGeneration,
      reportedGeneration
    });
  }, [readinessGeneration]);
  const handleVisualGenerationChange = useCallback((reportedGeneration: string) => {
    if (
      reportedGeneration !== readinessGeneration &&
      !reportedGeneration.startsWith(`${readinessGeneration}|`)
    ) {
      return;
    }
    visualGenerationRef.current = reportedGeneration;
    onReadinessGenerationChange?.(reportedGeneration);
  }, [onReadinessGenerationChange, readinessGeneration]);
  const handleCanvasFallback = useCallback((reason: CoScrollFallbackReason) => {
    handleFallback(reason, visualGenerationRef.current);
  }, [handleFallback]);

  useEffect(() => {
    if (fallbackState?.baseGeneration === readinessGeneration) {
      onFallback?.(fallbackState.reason, fallbackState.reportedGeneration);
    }
  }, [fallbackState, onFallback, readinessGeneration]);

  useEffect(() => {
    if (forceFallback) {
      handleFallback("timeout", readinessGeneration);
    } else if (forcedFallback) {
      handleFallback("forced", readinessGeneration);
    }
  }, [forceFallback, forcedFallback, handleFallback, readinessGeneration]);

  const fallbackReason = fallbackState?.baseGeneration === readinessGeneration ? fallbackState.reason : null;
  if (fallbackReason) {
    return (
      <div className={className} data-coscroll-standalone data-coscroll-fallback={fallbackReason}>
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
        height: sourceMatchMode ? "100%" : undefined,
        minHeight: sourceMatchMode ? "100%" : "100vh",
        width: "100%",
        overflow: "hidden",
        background: "#010205"
      }}
    >
      <CoScrollCanvasBoundary key={readinessGeneration} onFallback={handleCanvasFallback}>
        <Canvas
          orthographic={sourceMatchMode}
          dpr={[1, Math.max(1, props.quality.dpr)]}
          gl={{ antialias: true, alpha: sourceMatchMode, powerPreference: "high-performance", preserveDrawingBuffer }}
          camera={
            sourceMatchMode
              ? { position: [0, 0, 12], zoom: viewport === "mobile" ? 92 : 100, near: 0.1, far: 50 }
              : { fov: 42, position: [0, 0, 7.2], near: 0.1, far: 60 }
          }
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (event) => {
              event.preventDefault();
              handleCanvasFallback("context-lost");
            }, { once: true });
          }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <Suspense fallback={null}>
            <CoScrollSceneContent
              {...props}
              viewport={viewport}
              reducedMotion={effectiveReducedMotion}
              onReadinessGenerationChange={handleVisualGenerationChange}
              onFallback={handleFallback}
            />
          </Suspense>
        </Canvas>
      </CoScrollCanvasBoundary>
    </div>
  );
}
