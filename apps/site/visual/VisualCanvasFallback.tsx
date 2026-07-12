"use client";

import { useEffect, type ReactNode } from "react";

declare global {
  interface Window {
    __MiraLithVisualFallbackCreatedAt?: number;
  }
}

function markVisualFallbackCreated() {
  if (typeof window === "undefined" || window.__MiraLithVisualFallbackCreatedAt) {
    return;
  }

  window.__MiraLithVisualFallbackCreatedAt = performance.now();
}

interface VisualCanvasFallbackProps {
  scene: "lubirth" | "radio-gaga" | "coscroll";
  posterSrc?: string;
  label: string;
  children?: ReactNode;
}

export function VisualCanvasFallback({ scene, posterSrc, label, children }: VisualCanvasFallbackProps) {
  useEffect(() => {
    markVisualFallbackCreated();
  }, []);

  return (
    <div
      className="visual-canvas-fallback"
      data-visual-fallback={scene}
      role="img"
      aria-label={label}
      style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
    >
      {children}
    </div>
  );
}
