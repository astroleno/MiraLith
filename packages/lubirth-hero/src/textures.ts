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
    const seeded = (seed: number) => {
      const value = Math.sin(seed * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };

    const base = ctx.createRadialGradient(s * 0.34, s * 0.28, s * 0.02, s * 0.5, s * 0.5, s * 0.68);
    base.addColorStop(0, "#e5e5df");
    base.addColorStop(0.48, "#a8aaa7");
    base.addColorStop(1, "#4d5050");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);

    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#636665";
    [
      [0.58, 0.34, 0.14, 0.07, -0.08],
      [0.42, 0.52, 0.11, 0.06, 0.28],
      [0.63, 0.64, 0.1, 0.052, 0.12],
      [0.31, 0.31, 0.072, 0.038, -0.22],
      [0.72, 0.48, 0.074, 0.042, 0.44]
    ].forEach(([x, y, w, h, rotation]) => {
      ctx.beginPath();
      ctx.ellipse(x * s, y * s, w * s, h * s, rotation, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#f1f2ee";
    ctx.lineWidth = Math.max(0.75, s * 0.002);
    for (let index = 0; index < 62; index += 1) {
      const x = (0.08 + seeded(index + 3) * 0.84) * s;
      const y = (0.08 + seeded(index + 31) * 0.84) * s;
      const radius = (0.004 + seeded(index + 67) * 0.022) * s;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#303333";
    for (let index = 0; index < 110; index += 1) {
      const x = seeded(index + 101) * s;
      const y = seeded(index + 211) * s;
      const radius = (0.0018 + seeded(index + 331) * 0.006) * s;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const shade = ctx.createLinearGradient(s * 0.52, 0, s, 0);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(12, 14, 15, 0.26)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 1;
  });
}
