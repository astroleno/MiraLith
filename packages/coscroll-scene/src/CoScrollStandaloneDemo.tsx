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

// Source jade uses a #2D6D8B inner core beneath a white transmissive outer shell. This is the
// lifted, lower-saturation bridge colour from that real material—not an independent neon blue.
const REVIEW_JADE_PARTICLE_COLOR = "#b6ccd6";

const REVIEW_ANCHOR_RESIDUE = {
  color: REVIEW_JADE_PARTICLE_COLOR,
  intensity: 0.82,
  particleCount: 640,
  historySeconds: 0.62
};

const REVIEW_ANCHOR_PARTICLEIZATION = {
  color: REVIEW_JADE_PARTICLE_COLOR,
  intensity: 1,
  particleCount: 2_400,
  historySeconds: 0.72,
  reviewAutoParticleization: true
};

// Local ignored proxy made from ArtBreeze [n=355,n=…); it exists only for the review query.
const REVIEW_ARTBREEZE_HANDOFF_SRC = "/.generated/post-coscroll-editorial/artbreeze-ring-handoff-review.mp4";

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
  const [previewAnchorResidueMode, setPreviewAnchorResidueMode] = useState<
    "none" | "residue" | "particleize"
  >("none");
  const [reviewArtBreezeHandoff, setReviewArtBreezeHandoff] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const reviewHandoffVideoRef = useRef<HTMLVideoElement>(null);
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
  const handleReviewHandoff = useCallback(() => {
    const video = reviewHandoffVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setReviewArtBreezeHandoff(true);
  }, []);
  const reviewParticleizationResidue = useMemo(
    () => ({ ...REVIEW_ANCHOR_PARTICLEIZATION, onReviewHandoff: handleReviewHandoff }),
    [handleReviewHandoff]
  );
  const anchorResidue = props.anchorResidue ?? (sourceMatchMode
    ? previewAnchorResidueMode === "particleize"
      ? reviewParticleizationResidue
      : previewAnchorResidueMode === "residue"
        ? REVIEW_ANCHOR_RESIDUE
        : undefined
    : undefined);

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
    const params = new URLSearchParams(window.location.search);
    const previewValue = params.get("anchorResidue");
    setPreviewAnchorResidueMode(
      previewValue === "particleize" ? "particleize" : previewValue === "preview" ? "residue" : "none"
    );
  }, []);

  useEffect(() => {
    setReviewArtBreezeHandoff(false);
    const video = reviewHandoffVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }, [previewAnchorResidueMode]);

  useEffect(() => {
    const video = reviewHandoffVideoRef.current;
    if (!reviewArtBreezeHandoff || !video || typeof window === "undefined") {
      return;
    }

    // Present the decoded proxy's real n=355 first frame for one 30fps review beat before it
    // advances. The residue layer has just rendered the matching n=355 gap phase, so letting
    // `play()` race ahead here would invalidate the frame-level handoff proof.
    const startPlayback = window.setTimeout(() => {
      void video.play().catch(() => undefined);
    }, 34);
    return () => window.clearTimeout(startPlayback);
  }, [reviewArtBreezeHandoff]);

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
      data-coscroll-anchor-residue={anchorResidue ? "enabled" : undefined}
      data-coscroll-artbreeze-review-handoff={reviewArtBreezeHandoff ? "active" : undefined}
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
              anchorResidue={anchorResidue}
              viewport={viewport}
              reducedMotion={effectiveReducedMotion}
              onReadinessGenerationChange={handleVisualGenerationChange}
              onFallback={handleFallback}
            />
          </Suspense>
        </Canvas>
      </CoScrollCanvasBoundary>
      {sourceMatchMode && previewAnchorResidueMode === "particleize" ? (
        <video
          ref={reviewHandoffVideoRef}
          aria-hidden="true"
          data-coscroll-artbreeze-review-proxy
          muted
          playsInline
          preload="auto"
          src={REVIEW_ARTBREEZE_HANDOFF_SRC}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none",
            opacity: reviewArtBreezeHandoff ? 1 : 0,
            background: "#000",
            transition: "none"
          }}
        />
      ) : null}
    </div>
  );
}
