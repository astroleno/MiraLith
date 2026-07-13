"use client";

import { Canvas } from "@react-three/fiber";
import { Component, type ErrorInfo, type ReactNode, Suspense, useState, useSyncExternalStore } from "react";

declare global {
  interface Window {
    __MiraLithCanvasCreatedAt?: number;
  }
}

function markCanvasCreated() {
  if (typeof window === "undefined" || window.__MiraLithCanvasCreatedAt) {
    return;
  }

  window.__MiraLithCanvasCreatedAt = performance.now();
}

function subscribeForcedVisualFallback(_onStoreChange: () => void) {
  return () => undefined;
}

function getForcedVisualFallbackSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("visual") === "fallback";
}

interface VisualCanvasErrorBoundaryProps {
  fallback: ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
}

interface VisualCanvasErrorBoundaryState {
  failed: boolean;
}

class VisualCanvasErrorBoundary extends Component<
  VisualCanvasErrorBoundaryProps,
  VisualCanvasErrorBoundaryState
> {
  state: VisualCanvasErrorBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface VisualCanvasProps {
  antialias?: boolean;
  ariaLabel?: string;
  decorative?: boolean;
  dpr?: number | [number, number];
  fallback: ReactNode;
  children: ReactNode;
}

export function VisualCanvas({
  antialias = true,
  ariaLabel,
  decorative = true,
  dpr = [1, 1.1],
  fallback,
  children
}: VisualCanvasProps) {
  const [contextLost, setContextLost] = useState(false);
  const forcedFallback = useSyncExternalStore(
    subscribeForcedVisualFallback,
    getForcedVisualFallbackSnapshot,
    () => false
  );
  const preserveDrawingBuffer = typeof window !== "undefined"
    ? (() => {
        const params = new URLSearchParams(window.location.search);
        return params.get("visualTest") === "pixels" && params.get("perfTest") !== "raf";
      })()
    : false;

  if (forcedFallback || contextLost) {
    return <>{fallback}</>;
  }

  return (
    <div
      className="visual-canvas"
      data-visual-canvas="production"
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : ariaLabel}
    >
      <VisualCanvasErrorBoundary fallback={fallback}>
        <Canvas
          dpr={dpr}
          gl={{ antialias, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer }}
          camera={{ fov: 42, position: [0, 2.8, 7.4], near: 0.1, far: 90 }}
          onCreated={({ gl }) => {
            markCanvasCreated();
            gl.domElement.addEventListener("webglcontextlost", (event) => {
              event.preventDefault();
              setContextLost(true);
            });
          }}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      </VisualCanvasErrorBoundary>
    </div>
  );
}
