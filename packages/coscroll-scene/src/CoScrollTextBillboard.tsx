"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { CoScrollLyricSegment } from "./types";
import type { CoScrollLayerVerticalAlign } from "./createCoScrollLayeredLyrics";

interface CoScrollTextBillboardProps {
  text: string;
  position: [number, number, number];
  opacity: number;
  fontSize: number;
  layer: "front" | "back";
  current?: boolean;
  emphasis?: CoScrollLyricSegment["emphasis"];
  verticalAlign?: CoScrollLayerVerticalAlign;
  edgeFeather?: number;
  scale?: number;
  sourceFont?: boolean;
  depthTest: boolean;
  depthWrite: boolean;
  renderOrder?: number;
}

interface BillboardData {
  texture: THREE.CanvasTexture;
  aspect: number;
  heightMultiplier: number;
}

const BASE_FONT_PX = 96;
const PADDING_RATIO = 0.42;
const VERTICAL_SPACING_RATIO = 1.08;
const SYSTEM_FONT_STACK = "\"Iowan Old Style\", \"Songti SC\", \"STSong\", \"Noto Serif CJK SC\", \"PingFang SC\", ui-serif, Georgia, serif";
const SOURCE_FONT_FAMILY = "RunZhiJiaKangXiZidian";
const SOURCE_FONT_STACK = `"${SOURCE_FONT_FAMILY}", "Songti SC", "STSong", "Noto Serif CJK SC", serif`;
const SOURCE_FONT_URL = "/assets/coscroll/fonts/runzhi-kangxi.ttf";
const billboardTextureCache = new Map<string, BillboardData>();
let sourceFontPromise: Promise<void> | null = null;

const emphasisStyles = {
  quiet: {
    fill: "rgba(203, 171, 121, 0.52)",
    stroke: "rgba(16, 7, 5, 0.72)",
    shadow: "rgba(240, 201, 133, 0.14)"
  },
  normal: {
    fill: "rgba(226, 188, 124, 0.7)",
    stroke: "rgba(16, 7, 5, 0.78)",
    shadow: "rgba(240, 201, 133, 0.2)"
  },
  bright: {
    fill: "rgba(246, 220, 165, 0.86)",
    stroke: "rgba(16, 7, 5, 0.82)",
    shadow: "rgba(255, 225, 166, 0.28)"
  }
} satisfies Record<NonNullable<CoScrollLyricSegment["emphasis"]>, {
  fill: string;
  stroke: string;
  shadow: string;
}>;

function sourceTextStyle(sourceFont: boolean) {
  return sourceFont ? SOURCE_FONT_STACK : SYSTEM_FONT_STACK;
}

function createVerticalTextBillboard({
  text,
  layer,
  emphasis,
  current,
  sourceFont
}: {
  text: string;
  layer: "front" | "back";
  emphasis: NonNullable<CoScrollLyricSegment["emphasis"]>;
  current: boolean;
  sourceFont: boolean;
}): BillboardData | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fontPx = BASE_FONT_PX * dpr;
  const padding = fontPx * (sourceFont ? 0.46 : PADDING_RATIO);
  const glyphs = Array.from(text.trim() || " ");
  const glyphCount = Math.max(1, glyphs.length);
  const verticalSpacing = fontPx * (sourceFont ? 1.03 : VERTICAL_SPACING_RATIO);
  const columnWidth = fontPx * (sourceFont ? 1.06 : 1.16);
  const canvasWidth = Math.ceil(columnWidth + padding * 2);
  const canvasHeight = Math.ceil(verticalSpacing * glyphCount + padding * 2);
  const style = sourceFont
    ? {
        fill: current ? "#f8fafc" : "#cbd5f5",
        stroke: "rgba(1, 2, 5, 0.72)",
        shadow: "rgba(207, 242, 255, 0.2)"
      }
    : emphasisStyles[emphasis];

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.font = `${fontPx}px ${sourceTextStyle(sourceFont)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.shadowColor = style.shadow;
  ctx.shadowBlur = layer === "front" ? fontPx * 0.18 : fontPx * 0.11;
  ctx.lineWidth = Math.max(1.5 * dpr, fontPx * (sourceFont ? 0.026 : 0.035));
  ctx.strokeStyle = style.stroke;
  ctx.fillStyle = style.fill;

  glyphs.forEach((glyph, index) => {
    const x = canvasWidth / 2;
    const y = padding + verticalSpacing * (index + 0.5);
    ctx.strokeText(glyph, x, y);
    ctx.fillText(glyph, x, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const baseCanvasHeight = fontPx * (VERTICAL_SPACING_RATIO + 2 * PADDING_RATIO);

  return {
    texture,
    aspect: canvasWidth / canvasHeight,
    heightMultiplier: canvasHeight / baseCanvasHeight
  };
}

function getCachedVerticalTextBillboard(input: {
  text: string;
  layer: "front" | "back";
  emphasis: NonNullable<CoScrollLyricSegment["emphasis"]>;
  current: boolean;
  sourceFont: boolean;
  fontRevision: number;
}) {
  const key = [
    input.text,
    input.layer,
    input.emphasis,
    input.current ? "current" : "rest",
    input.sourceFont ? "source" : "system",
    input.fontRevision
  ].join("|");
  const cached = billboardTextureCache.get(key);
  if (cached) {
    return cached;
  }

  const billboard = createVerticalTextBillboard(input);
  if (billboard) {
    billboardTextureCache.set(key, billboard);
  }

  return billboard;
}

function loadSourceFont() {
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    return Promise.resolve();
  }

  if (!sourceFontPromise) {
    sourceFontPromise = new FontFace(SOURCE_FONT_FAMILY, `url(${SOURCE_FONT_URL})`).load().then((font) => {
      document.fonts.add(font);
    }).catch(() => undefined);
  }

  return sourceFontPromise;
}

export function CoScrollTextBillboard({
  text,
  position,
  opacity,
  fontSize,
  layer,
  current = false,
  emphasis = "normal",
  verticalAlign = "center",
  edgeFeather = 0,
  scale = 1,
  sourceFont = false,
  depthTest,
  depthWrite,
  renderOrder
}: CoScrollTextBillboardProps) {
  const [fontRevision, setFontRevision] = useState(0);

  useEffect(() => {
    if (!sourceFont) {
      return;
    }

    let cancelled = false;
    loadSourceFont().then(() => {
      if (!cancelled) {
        setFontRevision((revision) => revision + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sourceFont]);

  const billboard = useMemo(() => {
    if (typeof window === "undefined" || opacity <= 0) {
      return null;
    }

    return getCachedVerticalTextBillboard({ text, layer, emphasis, current, sourceFont, fontRevision });
  }, [current, emphasis, fontRevision, layer, sourceFont, text, opacity]);

  if (!billboard || opacity <= 0) {
    return null;
  }

  const edgeOpacity = Math.max(0, Math.min(1, 1 - edgeFeather));
  const planeHeight = fontSize * billboard.heightMultiplier * scale;
  const planeWidth = planeHeight * billboard.aspect;
  const verticalOffset = verticalAlign === "top" ? -planeHeight * 0.5 : verticalAlign === "bottom" ? planeHeight * 0.5 : 0;

  return (
    <mesh
      position={[position[0], position[1] + verticalOffset, position[2]]}
      renderOrder={renderOrder}
      frustumCulled={false}
    >
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        map={billboard.texture}
        transparent
        opacity={opacity * edgeOpacity}
        depthTest={depthTest}
        depthWrite={depthWrite}
        toneMapped={false}
      />
    </mesh>
  );
}
