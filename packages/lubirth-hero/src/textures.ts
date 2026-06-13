import { CanvasTexture, SRGBColorSpace } from "three";

function makeTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context unavailable for procedural texture");
  }

  draw(context, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createEarthTexture(size = 1024) {
  return makeTexture(size, (ctx, s) => {
    const ocean = ctx.createLinearGradient(0, 0, s, s);
    ocean.addColorStop(0, "#23394a");
    ocean.addColorStop(0.5, "#102233");
    ocean.addColorStop(1, "#07111d");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, s, s);

    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "#52706f";
    const landMasses = [
      [0.14, 0.24, 0.22, 0.17],
      [0.46, 0.21, 0.18, 0.13],
      [0.66, 0.42, 0.24, 0.2],
      [0.29, 0.58, 0.2, 0.18],
      [0.58, 0.72, 0.16, 0.1]
    ];

    for (const [x, y, w, h] of landMasses) {
      ctx.beginPath();
      ctx.ellipse(x * s, y * s, w * s, h * s, -0.35, 0, Math.PI * 2);
      ctx.ellipse((x + 0.06) * s, (y + 0.04) * s, w * 0.55 * s, h * 0.72 * s, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = "#d9e2e4";
    ctx.lineWidth = 1;
    for (let y = 0.12; y < 0.92; y += 0.08) {
      ctx.beginPath();
      ctx.moveTo(0, y * s);
      ctx.bezierCurveTo(0.28 * s, (y - 0.04) * s, 0.68 * s, (y + 0.04) * s, s, y * s);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#f4efe2";
    for (let index = 0; index < 220; index += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const radius = Math.random() * 1.6 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  });
}

export function createMoonTexture(size = 512) {
  return makeTexture(size, (ctx, s) => {
    const base = ctx.createRadialGradient(s * 0.32, s * 0.3, s * 0.02, s * 0.5, s * 0.5, s * 0.62);
    base.addColorStop(0, "#fff6d5");
    base.addColorStop(0.52, "#c9c1aa");
    base.addColorStop(1, "#615f58");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);

    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#6f6b62";
    for (let index = 0; index < 42; index += 1) {
      const x = (0.12 + Math.random() * 0.76) * s;
      const y = (0.12 + Math.random() * 0.76) * s;
      const radius = (0.008 + Math.random() * 0.032) * s;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#1c1d1c";
    ctx.fillRect(s * 0.67, 0, s * 0.33, s);
    ctx.globalAlpha = 1;
  });
}
