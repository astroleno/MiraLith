import type { ReactNode } from "react";

interface VisualCanvasFallbackProps {
  scene: "lubirth";
  posterSrc?: string;
  label: string;
  children?: ReactNode;
}

export function VisualCanvasFallback({ scene, posterSrc, label, children }: VisualCanvasFallbackProps) {
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
