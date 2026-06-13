"use client";

import { useEffect, type ReactNode } from "react";

declare global {
  interface Window {
    __MiraLithFirstUsableAt?: number;
  }
}

function markFirstUsable() {
  if (typeof window === "undefined" || window.__MiraLithFirstUsableAt) {
    return;
  }

  window.__MiraLithFirstUsableAt = performance.now();
}

interface VisualCanvasFallbackProps {
  scene: "lubirth" | "radio-gaga";
  posterSrc?: string;
  label: string;
  children?: ReactNode;
}

export function VisualCanvasFallback({ scene, posterSrc, label, children }: VisualCanvasFallbackProps) {
  useEffect(() => {
    markFirstUsable();
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
