"use client";

import { Canvas } from "@react-three/fiber";
import { Component, type ErrorInfo, type ReactNode, Suspense, useState } from "react";

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
  ariaLabel?: string;
  decorative?: boolean;
  fallback: ReactNode;
  children: ReactNode;
}

export function VisualCanvas({ ariaLabel, decorative = true, fallback, children }: VisualCanvasProps) {
  const [contextLost, setContextLost] = useState(false);
  const preserveDrawingBuffer =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("visualTest") === "pixels";

  if (contextLost) {
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
          dpr={[1, 1.25]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer }}
          camera={{ fov: 42, position: [0, 2.8, 7.4], near: 0.1, far: 90 }}
          onCreated={({ gl }) => {
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
