import { expect, test } from "@playwright/test";
import { stepSourceCausticMotion } from "../../packages/coscroll-scene/src/sourceCausticMotion";

const repoRoot = process.cwd();

async function readProjectFile(projectPath: string) {
  const [{ readFileSync }, path] = await Promise.all([import("node:fs"), import("node:path")]);
  return readFileSync(path.join(repoRoot, projectPath), "utf8");
}

async function waitForCoScrollPixels(page: import("@playwright/test").Page, threshold = 18) {
  await expect(page.locator("canvas")).toHaveCount(1);
  const nonblank = await page.waitForFunction((thresholdValue) => {
    const source = document.querySelector("canvas");
    if (!source) return false;
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) return false;
    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > thresholdValue) return true;
    }
    return false;
  }, threshold);
  expect(await nonblank.jsonValue()).toBe(true);
}

async function measureSourceShellColorBalance(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      throw new Error("No canvas found for source shell measurement");
    }

    const width = 144;
    const height = 90;
    const sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    const context = sample.getContext("2d");
    if (!context) {
      throw new Error("Could not create source shell sample context");
    }
    context.drawImage(source, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let sampled = 0;
    let neutralShell = 0;
    let cyanCore = 0;

    for (let y = 25; y < 65; y += 1) {
      for (let x = 50; x < 94; x += 1) {
        const pixel = (y * width + x) * 4;
        const r = pixels[pixel];
        const g = pixels[pixel + 1];
        const b = pixels[pixel + 2];
        sampled += 1;
        if (r > 170 && g > 170 && b > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 55) {
          neutralShell += 1;
        }
        if (b > 150 && g > 110 && r < 150) {
          cyanCore += 1;
        }
      }
    }

    return {
      neutralShellShare: neutralShell / sampled,
      cyanCoreShare: cyanCore / sampled
    };
  });
}

async function compareSourceMatchCanvasToReference(page: import("@playwright/test").Page) {
  const [{ readFileSync }, path] = await Promise.all([import("node:fs"), import("node:path")]);
  const referenceBase64 = readFileSync(
    path.join(repoRoot, "docs/coscroll-source-match/reference/source-coscroll-live-active-desktop.jpg")
  ).toString("base64");

  return page.evaluate(async (encodedReference) => {
    const width = 160;
    const height = 100;
    const currentSource = document.querySelector("canvas");
    if (!currentSource) {
      throw new Error("No canvas found for source-match visual comparison");
    }

    const makeCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };
    const current = makeCanvas();
    const currentContext = current.getContext("2d");
    if (!currentContext) {
      throw new Error("Could not create current sample context");
    }
    currentContext.drawImage(currentSource, 0, 0, width, height);

    const referenceImage = new Image();
    referenceImage.src = `data:image/jpeg;base64,${encodedReference}`;
    await referenceImage.decode();
    const reference = makeCanvas();
    const referenceContext = reference.getContext("2d");
    if (!referenceContext) {
      throw new Error("Could not create reference sample context");
    }
    referenceContext.drawImage(referenceImage, 0, 0, width, height);

    const summarize = (pixels: Uint8ClampedArray) => {
      let weightedX = 0;
      let weightedY = 0;
      let weight = 0;
      let lit = 0;
      let dark = 0;
      let cyanWhite = 0;
      let lumaSum = 0;

      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        const index = pixel / 4;
        const x = index % width;
        const y = Math.floor(index / width);
        const r = pixels[pixel];
        const g = pixels[pixel + 1];
        const b = pixels[pixel + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lumaSum += luma;

        if (luma < 20) {
          dark += 1;
        }

        if (luma > 42) {
          lit += 1;
          weightedX += x * luma;
          weightedY += y * luma;
          weight += luma;

          if (b >= r * 0.82 && g >= r * 0.78) {
            cyanWhite += 1;
          }
        }
      }

      return {
        centroidX: weight > 0 ? weightedX / weight / width : 0,
        centroidY: weight > 0 ? weightedY / weight / height : 0,
        litShare: lit / (width * height),
        darkShare: dark / (width * height),
        cyanWhiteShare: lit > 0 ? cyanWhite / lit : 0,
        meanLuma: lumaSum / (width * height)
      };
    };

    const currentPixels = currentContext.getImageData(0, 0, width, height).data;
    const referencePixels = referenceContext.getImageData(0, 0, width, height).data;
    let rms = 0;
    for (let pixel = 0; pixel < currentPixels.length; pixel += 4) {
      const currentLuma = 0.2126 * currentPixels[pixel] + 0.7152 * currentPixels[pixel + 1] + 0.0722 * currentPixels[pixel + 2];
      const referenceLuma = 0.2126 * referencePixels[pixel] + 0.7152 * referencePixels[pixel + 1] + 0.0722 * referencePixels[pixel + 2];
      rms += (currentLuma - referenceLuma) ** 2;
    }

    return {
      current: summarize(currentPixels),
      reference: summarize(referencePixels),
      rmsLuma: Math.sqrt(rms / (width * height))
    };
  }, referenceBase64);
}

async function compareSourceMatchRegionsToReference(page: import("@playwright/test").Page) {
  const [{ readFileSync }, path] = await Promise.all([import("node:fs"), import("node:path")]);
  const referenceBase64 = readFileSync(
    path.join(repoRoot, "docs/coscroll-source-match/reference/source-coscroll-live-active-desktop.jpg")
  ).toString("base64");

  return page.evaluate(async (encodedReference) => {
    const width = 160;
    const height = 100;
    const currentSource = document.querySelector("canvas");
    if (!currentSource) {
      throw new Error("No canvas found for source-match region comparison");
    }

    const makeCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };

    const current = makeCanvas();
    const currentContext = current.getContext("2d");
    if (!currentContext) {
      throw new Error("Could not create current region sample context");
    }
    currentContext.drawImage(currentSource, 0, 0, width, height);

    const referenceImage = new Image();
    referenceImage.src = `data:image/jpeg;base64,${encodedReference}`;
    await referenceImage.decode();
    const reference = makeCanvas();
    const referenceContext = reference.getContext("2d");
    if (!referenceContext) {
      throw new Error("Could not create reference region sample context");
    }
    referenceContext.drawImage(referenceImage, 0, 0, width, height);

    const readRegion = (pixels: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number) => {
      let lumaSum = 0;
      let litPixels = 0;
      let cyanPixels = 0;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const pixel = (y * width + x) * 4;
          const r = pixels[pixel];
          const g = pixels[pixel + 1];
          const b = pixels[pixel + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumaSum += luma;

          if (luma > 42) {
            litPixels += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            if (b >= r * 0.82 && g >= r * 0.78) {
              cyanPixels += 1;
            }
          }
        }
      }

      return {
        meanLuma: lumaSum / Math.max(1, (x1 - x0) * (y1 - y0)),
        litShare: litPixels / Math.max(1, (x1 - x0) * (y1 - y0)),
        cyanShare: litPixels > 0 ? cyanPixels / litPixels : 0,
        bbox:
          maxX >= 0
            ? {
                width: maxX - minX + 1,
                height: maxY - minY + 1,
                centroidX: (minX + maxX) / 2 / width,
                centroidY: (minY + maxY) / 2 / height
              }
            : null
      };
    };

    const currentPixels = currentContext.getImageData(0, 0, width, height).data;
    const referencePixels = referenceContext.getImageData(0, 0, width, height).data;
    const regions = {
      backgroundBand: [0, 0, width, 36] as const,
      anchorWindow: [44, 14, 118, 88] as const,
      leftLyrics: [0, 8, 40, 96] as const,
      rightLyrics: [120, 8, width, 96] as const
    };

    return {
      current: {
        backgroundBand: readRegion(currentPixels, ...regions.backgroundBand),
        anchorWindow: readRegion(currentPixels, ...regions.anchorWindow),
        leftLyrics: readRegion(currentPixels, ...regions.leftLyrics),
        rightLyrics: readRegion(currentPixels, ...regions.rightLyrics)
      },
      reference: {
        backgroundBand: readRegion(referencePixels, ...regions.backgroundBand),
        anchorWindow: readRegion(referencePixels, ...regions.anchorWindow),
        leftLyrics: readRegion(referencePixels, ...regions.leftLyrics),
        rightLyrics: readRegion(referencePixels, ...regions.rightLyrics)
      }
    };
  }, referenceBase64);
}

async function measureSourceMatchExcerptComposition(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      throw new Error("No canvas found for CoScroll excerpt composition");
    }

    const width = 160;
    const height = 100;
    const sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    const context = sample.getContext("2d");
    if (!context) {
      throw new Error("Could not create excerpt composition context");
    }

    context.drawImage(source, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);

    const readRegion = (x0: number, y0: number, x1: number, y1: number, threshold = 48) => {
      let litPixels = 0;
      let cyanPixels = 0;
      let amberPixels = 0;
      let lumaSum = 0;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const pixel = (y * width + x) * 4;
          const r = data[pixel];
          const g = data[pixel + 1];
          const b = data[pixel + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumaSum += luma;

          if (luma > threshold) {
            litPixels += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            if (b >= r * 0.82 && g >= r * 0.78) {
              cyanPixels += 1;
            }
            if (r >= b * 1.08 && g >= b * 0.9 && r >= g * 0.9) {
              amberPixels += 1;
            }
          }
        }
      }

      return {
        litPixels,
        cyanShare: litPixels > 0 ? cyanPixels / litPixels : 0,
        amberShare: litPixels > 0 ? amberPixels / litPixels : 0,
        meanLuma: lumaSum / Math.max(1, (x1 - x0) * (y1 - y0)),
        bbox:
          maxX >= 0
            ? {
                width: maxX - minX + 1,
                height: maxY - minY + 1,
                centroidX: (minX + maxX) / 2 / width,
                centroidY: (minY + maxY) / 2 / height
              }
            : null
      };
    };

    return {
      topTravelLane: readRegion(0, 12, width, 58, 24),
      centerTravelField: readRegion(42, 18, 118, 88, 24),
      bottomTravelLane: readRegion(0, 50, width, 96, 10),
      anchor: readRegion(60, 28, 102, 82, 54),
      whole: readRegion(0, 0, width, height, 42)
    };
  });
}

async function measureCanvasCenterEnergy(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      throw new Error("No canvas found for center energy sample");
    }

    const sample = document.createElement("canvas");
    sample.width = source.width || 160;
    sample.height = source.height || 100;
    const context = sample.getContext("2d");
    if (!context) {
      throw new Error("Could not create sample context");
    }
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const { data } = context.getImageData(0, 0, sample.width, sample.height);
    const x0 = Math.round(sample.width * (sample.height > sample.width ? 0.38 : 0.36));
    const x1 = Math.round(sample.width * (sample.height > sample.width ? 0.62 : 0.64));
    const y0 = Math.round(sample.height * (sample.height > sample.width ? 0.35 : 0.32));
    const y1 = Math.round(sample.height * (sample.height > sample.width ? 0.65 : 0.72));

    let litPixels = 0;
    let lumaSum = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const pixel = (y * sample.width + x) * 4;
        const luma = 0.2126 * data[pixel] + 0.7152 * data[pixel + 1] + 0.0722 * data[pixel + 2];
        lumaSum += luma;
        if (luma > 44) {
          litPixels += 1;
        }
      }
    }

    return { litPixels, meanLuma: lumaSum / Math.max(1, (y1 - y0) * (x1 - x0)) };
  });
}

async function readCanvasMotionSample(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      throw new Error("No canvas found for motion sample");
    }

    const sample = document.createElement("canvas");
    sample.width = 96;
    sample.height = 96;
    const context = sample.getContext("2d");
    if (!context) {
      throw new Error("Could not create motion sample context");
    }

    context.drawImage(source, 0, 0, sample.width, sample.height);
    const { data } = context.getImageData(34, 28, 30, 44);
    const luma: number[] = [];
    for (let index = 0; index < data.length; index += 16) {
      luma.push(Math.round(0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]));
    }
    return luma;
  });
}

function meanSampleDelta(before: number[], after: number[]) {
  const length = Math.min(before.length, after.length);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(before[index] - after[index]);
  }
  return total / Math.max(1, length);
}

async function measureBackgroundScreenshotMotion(
  page: import("@playwright/test").Page,
  delayMs = 2_200
) {
  const clip = { x: 0, y: 0, width: 1440, height: 220 };
  const before = await page.screenshot({ clip });
  await page.waitForTimeout(delayMs);
  const after = await page.screenshot({ clip });

  return page.evaluate(
    async ({ beforeBase64, afterBase64 }) => {
      const width = 180;
      const height = 28;
      const decode = (encoded: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Could not decode CoScroll motion frame"));
          image.src = `data:image/png;base64,${encoded}`;
        });
      const readLuma = async (encoded: string) => {
        const image = await decode(encoded);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Could not create CoScroll background motion context");
        }
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const luma: number[] = [];
        for (let index = 0; index < pixels.length; index += 4) {
          luma.push(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
        }
        return luma;
      };

      const [beforeLuma, afterLuma] = await Promise.all([readLuma(beforeBase64), readLuma(afterBase64)]);
      let deltaSum = 0;
      let changedPixels = 0;
      for (let index = 0; index < beforeLuma.length; index += 1) {
        const delta = Math.abs(beforeLuma[index] - afterLuma[index]);
        deltaSum += delta;
        if (delta > 4) {
          changedPixels += 1;
        }
      }

      return {
        meanDelta: deltaSum / Math.max(1, beforeLuma.length),
        changedShare: changedPixels / Math.max(1, beforeLuma.length)
      };
    },
    { beforeBase64: before.toString("base64"), afterBase64: after.toString("base64") }
  );
}

async function measureBackgroundCanvasFrameMotion(
  page: import("@playwright/test").Page,
  frameCount = 4
) {
  return page.evaluate(async (requestedFrameCount) => {
    const source = document.querySelector("canvas");
    if (!source) {
      throw new Error("No canvas found for CoScroll frame-motion measurement");
    }

    const width = 240;
    const height = 37;
    const sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Could not create CoScroll frame-motion context");
    }

    const frames: number[][] = [];
    const timestamps: number[] = [];
    const sourceBandHeight = Math.min(
      source.height,
      source.height * (220 / Math.max(1, source.clientHeight))
    );

    for (let frame = 0; frame < requestedFrameCount; frame += 1) {
      const timestamp = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      context.clearRect(0, 0, width, height);
      context.drawImage(
        source,
        0,
        0,
        source.width,
        sourceBandHeight,
        0,
        0,
        width,
        height
      );
      const pixels = context.getImageData(0, 0, width, height).data;
      const luma: number[] = [];
      for (let index = 0; index < pixels.length; index += 4) {
        luma.push(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
      }
      frames.push(luma);
      timestamps.push(timestamp);
    }

    const meanDeltas: number[] = [];
    const changedShares: number[] = [];
    for (let frame = 1; frame < frames.length; frame += 1) {
      const before = frames[frame - 1];
      const after = frames[frame];
      const elapsed = Math.max(1, timestamps[frame] - timestamps[frame - 1]);
      let deltaSum = 0;
      let changedPixels = 0;
      for (let index = 0; index < before.length; index += 1) {
        const delta = Math.abs(before[index] - after[index]) * (16.667 / elapsed);
        deltaSum += delta;
        if (delta > 0.75) {
          changedPixels += 1;
        }
      }
      meanDeltas.push(deltaSum / Math.max(1, before.length));
      changedShares.push(changedPixels / Math.max(1, before.length));
    }

    const median = (values: number[]) => {
      const sorted = [...values].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    };

    return {
      meanDelta: median(meanDeltas),
      changedShare: median(changedShares),
      meanDeltas,
      changedShares
    };
  }, frameCount);
}

async function measureBackgroundLumaProfile(
  page: import("@playwright/test").Page,
  options: {
    clipWidth?: number;
    clipHeight?: number;
    sampleWidth?: number;
    sampleHeight?: number;
  } = {}
) {
  const clipWidth = options.clipWidth ?? 1440;
  const clipHeight = options.clipHeight ?? 220;
  const sampleWidth = options.sampleWidth ?? 180;
  const sampleHeight = options.sampleHeight ?? 28;
  const frame = await page.screenshot({ clip: { x: 0, y: 0, width: clipWidth, height: clipHeight } });

  return page.evaluate(async ({ frameBase64, width, height }) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Could not decode CoScroll background profile frame"));
      nextImage.src = `data:image/png;base64,${frameBase64}`;
    });
    const sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    const context = sample.getContext("2d");
    if (!context) {
      throw new Error("Could not create CoScroll background profile context");
    }
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let darkPixels = 0;
    let brightPixels = 0;
    let lumaSum = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const luma = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      lumaSum += luma;
      if (luma < 18) {
        darkPixels += 1;
      }
      if (luma > 85) {
        brightPixels += 1;
      }
    }

    const pixelCount = pixels.length / 4;
    return {
      darkShare: darkPixels / pixelCount,
      brightShare: brightPixels / pixelCount,
      meanLuma: lumaSum / pixelCount
    };
  }, { frameBase64: frame.toString("base64"), width: sampleWidth, height: sampleHeight });
}

async function waitForSourceMatchAnchorEnergy(
  page: import("@playwright/test").Page,
  minimumLitPixels: number,
  minimumMeanLuma: number
) {
  await page.waitForFunction(
    ({ litThreshold, lumaThreshold }) => {
      const source = document.querySelector("canvas");
      if (!source) {
        return false;
      }

      const sample = document.createElement("canvas");
      sample.width = source.width || 160;
      sample.height = source.height || 100;
      const context = sample.getContext("2d");
      if (!context) {
        return false;
      }
      context.drawImage(source, 0, 0, sample.width, sample.height);
      const { data } = context.getImageData(0, 0, sample.width, sample.height);
      const x0 = Math.round(sample.width * (sample.height > sample.width ? 0.38 : 0.36));
      const x1 = Math.round(sample.width * (sample.height > sample.width ? 0.62 : 0.64));
      const y0 = Math.round(sample.height * (sample.height > sample.width ? 0.35 : 0.32));
      const y1 = Math.round(sample.height * (sample.height > sample.width ? 0.65 : 0.72));

      let litPixels = 0;
      let lumaSum = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const pixel = (y * sample.width + x) * 4;
          const luma = 0.2126 * data[pixel] + 0.7152 * data[pixel + 1] + 0.0722 * data[pixel + 2];
          lumaSum += luma;
          if (luma > 44) {
            litPixels += 1;
          }
        }
      }

      const meanLuma = lumaSum / Math.max(1, (y1 - y0) * (x1 - x0));
      return litPixels >= litThreshold && meanLuma >= lumaThreshold;
    },
    { litThreshold: minimumLitPixels, lumaThreshold: minimumMeanLuma }
  );
}

async function readHomepageCoScrollState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const section = document.querySelector<HTMLElement>(".coscroll-section");
    const canvasLayer = document.querySelector<HTMLElement>(".visual-canvas");
    const inViewport = (element: HTMLElement | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const zIndex = (element: HTMLElement | null) => {
      if (!element) return Number.NaN;
      const value = getComputedStyle(element).zIndex;
      return value === "auto" ? 0 : Number(value);
    };

    return {
      hasCanvasLayer: Boolean(canvasLayer),
      hasSection: Boolean(section),
      sectionInViewport: inViewport(section),
      sectionZIndex: zIndex(section),
      canvasZIndex: zIndex(canvasLayer),
      scrollY: window.scrollY,
      sectionTop: section?.getBoundingClientRect().top ?? Number.NaN
    };
  });
}

async function scrollHomepageCoScrollIntoView(page: import("@playwright/test").Page) {
  await page.locator(".coscroll-section").waitFor({ state: "attached" });
  await page.evaluate(() => {
    document.querySelector(".coscroll-section")?.scrollIntoView({ block: "center" });
  });
  await expect.poll(async () => {
    const state = await readHomepageCoScrollState(page);
    return state.sectionInViewport;
  }).toBe(true);
}

test("coscroll spike renders one standalone canvas with visible pixels", async ({ page }) => {
  await page.goto("/coscroll-spike?visualTest=pixels");
  await waitForCoScrollPixels(page);
});

test("coscroll spike exposes review DOM and site-owned fallback", async ({ page }) => {
  await page.goto("/coscroll-spike?visual=fallback");

  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".coscroll-section")).toBeVisible();
  await expect(page.locator('[data-coscroll-spike="heart-sutra"]')).toBeVisible();
  await expect(page.locator('[data-visual-fallback="coscroll"]')).toBeVisible();
  await expect(page.getByText("心 / 空 / 道")).toBeVisible();
  await expect(page.locator("audio, video")).toHaveCount(0);
});

test("coscroll fallback uses a real poster layer", async ({ page }) => {
  await page.goto("/coscroll-spike?visual=fallback");
  const fallback = page.locator('[data-visual-fallback="coscroll"]');
  await expect(fallback).toBeVisible();

  const backgroundImage = await fallback.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(backgroundImage).toContain("coscroll-poster.webp");

  const poster = await page.evaluate(async () => {
    const response = await fetch("/assets/coscroll/posters/coscroll-poster.webp");
    const bytes = await response.arrayBuffer();
    const image = new Image();
    image.src = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
    await image.decode();
    return {
      bytes: bytes.byteLength,
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  });

  expect(poster.bytes).toBeGreaterThanOrEqual(30_000);
  expect(poster.width).toBeGreaterThanOrEqual(1_000);
  expect(poster.height).toBeGreaterThanOrEqual(560);

  const globals = await readProjectFile("apps/site/app/globals.css");
  const coscrollFallbackRule = globals.match(/\.visual-canvas-fallback\[data-visual-fallback="coscroll"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  expect(coscrollFallbackRule).toContain("--visual-fallback-poster");
  expect(coscrollFallbackRule).not.toMatch(/\bbackground\s*:/);
});

test("homepage keeps CoScroll behind a shared scene arbiter and off the first screen", async ({ page }) => {
  const [{ existsSync }, path] = await Promise.all([import("node:fs"), import("node:path")]);

  expect(existsSync(path.join(repoRoot, "apps/site/visual/scenes/HomeVisualSceneSlot.tsx"))).toBe(true);
  expect(existsSync(path.join(repoRoot, "apps/site/visual/scenes/CoScrollSceneSlot.tsx"))).toBe(true);
  expect(await readProjectFile("apps/site/components/MiraLithHome.tsx")).toContain("HomeVisualSceneSlot");

  const coscrollRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/assets/coscroll/")) {
      coscrollRequests.push(url);
    }
  });

  await page.goto("/");
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
  const section = page.locator(".coscroll-section");
  await expect(section).toHaveCount(1);
  await expect(section).toBeVisible();
  expect(await readHomepageCoScrollState(page)).toMatchObject({
    hasCanvasLayer: true,
    hasSection: true,
    sectionInViewport: false
  });
  expect(coscrollRequests).toEqual([]);

  await scrollHomepageCoScrollIntoView(page);
  const scrolledState = await readHomepageCoScrollState(page);
  expect(scrolledState.sectionInViewport).toBe(true);
  expect(scrolledState.sectionZIndex).toBeGreaterThan(scrolledState.canvasZIndex);
});

test("coscroll first pass ships only three lightweight anchor models", async () => {
  const [{ readdirSync, statSync }, path] = await Promise.all([import("node:fs"), import("node:path")]);
  const anchorDir = path.join(repoRoot, "apps/site/public/assets/coscroll/anchors");
  const anchors = readdirSync(anchorDir).filter((file) => file.endsWith(".glb")).sort();

  expect(anchors).toEqual(["dao.glb", "kong.glb", "xin.glb"]);

  for (const anchor of anchors) {
    const stat = statSync(path.join(anchorDir, anchor));
    expect(stat.size).toBeLessThanOrEqual(350_000);
  }

  const manifest = await readProjectFile("packages/coscroll-scene/src/assetManifest.ts");
  expect(manifest).toContain("dao.glb");
  expect(manifest).toContain("kong.glb");
  expect(manifest).toContain("xin.glb");
  expect(manifest).not.toContain("guan.glb");
  expect(manifest).not.toContain("wu2.glb");
});

test("coscroll scene stays canvasless without blocking source-match palette", async () => {
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const standalone = await readProjectFile("packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx");
  const packageSources = [
    sceneContent,
    standalone,
    await readProjectFile("packages/coscroll-scene/src/CoScrollJadeAnchor.tsx"),
    await readProjectFile("packages/coscroll-scene/src/CoScrollTextBillboard.tsx"),
    await readProjectFile("packages/coscroll-scene/src/CoScrollMineralField.tsx")
  ].join("\n");

  expect(sceneContent).not.toContain("Canvas");
  expect(standalone).toContain("Canvas");
  expect(packageSources).toContain("#010205");
  expect(packageSources).toContain("#070707");
  const testSource = await readProjectFile("tests/e2e/coscroll.spec.ts");
  for (const color of ["#ffd700", "#1f2e38"]) {
    expect(testSource).not.toContain(`not.toContain("${color}")`);
  }
});

test("coscroll scene ports the original SilkR3F background without owning Canvas", async () => {
  const silk = await readProjectFile("packages/coscroll-scene/src/CoScrollSilkBackground.tsx");
  const caustics = await readProjectFile("packages/coscroll-scene/src/CoScrollCausticLightField.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const packageIndex = await readProjectFile("packages/coscroll-scene/src/index.ts");

  expect(silk).not.toContain("Canvas");
  expect(silk).toContain("fragmentShader");
  expect(silk).toContain("rotateUvs");
  expect(silk).toContain("speed = 4.9");
  expect(silk).toContain("noiseIntensity = 1.3");
  expect(silk).toContain("rotation = 2.42");
  expect(silk).toContain('"#1f2e38"');
  expect(caustics).not.toContain("Canvas");
  expect(caustics).not.toContain("WebGLRenderTarget");
  expect(caustics).toContain("fragmentShader");
  expect(caustics).toContain("uAnchorPresence");
  expect(caustics).toContain("uScrollVelocity");
  expect(caustics).toContain("uSourceMatch");
  expect(caustics).toContain("THREE.AdditiveBlending");
  expect(caustics).toContain("smoothstep(0.22");
  expect(caustics).toContain('sourceMatch ? "#2d6d8b"');
  expect(sceneContent).toContain("CoScrollSilkBackground");
  expect(sceneContent).toContain("CoScrollCausticLightField");
  expect(sceneContent.indexOf("<CoScrollSilkBackground")).toBeLessThan(sceneContent.indexOf("<CoScrollCausticLightField"));
  expect(sceneContent).not.toContain("CoScrollMineralField");
  expect(packageIndex).toContain("CoScrollSilkBackground");
  expect(packageIndex).toContain("CoScrollCausticLightField");
});

test("coscroll source-match lyrics use horizontal travel lanes instead of clustered index positions", async () => {
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const layeredLyrics = await readProjectFile("packages/coscroll-scene/src/createCoScrollLayeredLyrics.ts");
  const billboard = await readProjectFile("packages/coscroll-scene/src/CoScrollTextBillboard.tsx");

  expect(sceneContent).not.toContain("function lyricPosition");
  expect(sceneContent).toContain("createCoScrollLayeredLyrics");
  expect(sceneContent).toContain("edgeFeather");
  expect(sceneContent).toContain("verticalAlign");
  expect(layeredLyrics).toContain('movementAxis: "horizontal"');
  expect(layeredLyrics).toContain("travelSpacing");
  expect(layeredLyrics).toContain("horizontalOffset");
  expect(layeredLyrics).toContain("topLaneY");
  expect(layeredLyrics).toContain("bottomLaneY");
  expect(layeredLyrics).toContain("edgeFeatherStart");
  expect(layeredLyrics).toContain('"back-far"');
  expect(layeredLyrics).toContain('"back-near"');
  expect(layeredLyrics).toContain("resolveOriginalContinuousIndex");
  expect(layeredLyrics).toContain("x: travelOffset");
  expect(layeredLyrics).not.toContain("travelOffset + sideOffset");
  expect(billboard).toContain("edgeFeather");
  expect(billboard).toContain("verticalAlign");
  expect(billboard).toContain("billboardTextureCache");
  expect(billboard).toContain("getCachedVerticalTextBillboard");
  expect(billboard).toContain("opacity * edgeOpacity");
  expect(billboard).not.toContain("[current, edgeFeather, emphasis, fontRevision, layer, opacity, sourceFont, text]");
  expect(billboard).not.toContain("199, 176, 107");
});

test("coscroll jade source material preserves the original blue-jade dual shell", async () => {
  const jade = await readProjectFile("packages/coscroll-scene/src/CoScrollJadeAnchor.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const spikeExperience = await readProjectFile("apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx");

  expect(jade).toContain("jadeMaterialPresets");
  expect(jade).toContain("jadeMaterialPresets[materialPreset]");
  expect(jade).toContain("OBJLoader");
  expect(jade).toContain("GLTFLoader");
  expect(jade).toContain("MeshoptDecoder");
  expect(jade).toContain("HDRLoader");
  expect(jade).not.toContain("RGBELoader");
  expect(jade).toContain("deterministicPose");
  expect(jade).toContain("sourceMaterial");
  expect(jade).toContain("qwantani_moon_noon_puresky_1k.hdr");
  expect(jade).toContain('"/assets/coscroll/textures/normal.jpg"');
  expect(jade).toContain("SOURCE_JADE_MATERIAL");
  expect(jade).toContain("innerColor: 0x2d6d8b");
  expect(jade).toContain("innerMetalness: 1");
  expect(jade).toContain("innerRoughness: 1");
  expect(jade).toContain("innerTransmission: 0");
  expect(jade).toContain("innerOpacity: 1");
  expect(jade).toContain("innerEmissive: 0x0f2b38");
  expect(jade).toContain("innerEmissiveIntensity: 12");
  expect(jade).toContain("innerEnvMapIntensity: 2");
  expect(jade).toContain("emissiveIntensity: preset.innerEmissiveIntensity");
  expect(jade).toContain("outerColor: 0xffffff");
  expect(jade).toContain("outerRoughness: 0.82");
  expect(jade).toContain("outerTransmission: 1");
  expect(jade).toContain("outerIor: 1.52");
  expect(jade).toContain("outerReflectivity: 0.3");
  expect(jade).toContain("outerThickness: 0.24");
  expect(jade).not.toContain("outerAttenuationColor");
  expect(jade).not.toContain("outerAttenuationDistance");
  expect(jade).toContain("outerClearcoat: 0");
  expect(jade).toContain("outerClearcoatRoughness: 1");
  expect(jade).toContain("outerEnvMapIntensity: 5");
  expect(jade).toContain("normalScale: 0.3");
  expect(jade).toContain("normalRepeat: 3");
  expect(jade).toContain('import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js"');
  expect(jade).toContain("mergeVertices, toCreasedNormals");
  expect(jade).toContain("function createSourceOffsetGeometry");
  expect(jade).toContain("new TessellateModifier(0.15)");
  expect(jade).toContain("toCreasedNormals(workingGeometry, THREE.MathUtils.degToRad(30))");
  expect(jade).toContain("function createSourcePreparedAnchorGeometry");
  expect(jade).toContain("sourceMode && !fallback");
  expect(jade).not.toContain("texture.colorSpace = THREE.SRGBColorSpace");
  expect(jade).toContain("color: preset.outerColor");
  expect(jade).toContain("transmission: preset.outerTransmission");
  expect(jade).not.toContain("material.side = THREE.DoubleSide");
  expect(jade).not.toContain("SOURCE_AMBER_VISUAL_TUNING");
  expect(jade).not.toContain("jadeBodyFragmentShader");
  expect(jade).not.toContain("volumeGlowFragmentShader");
  expect(jade).not.toContain("volumeMaterial");
  expect(jade).not.toContain("createJadeDensityTexture");
  expect(jade).not.toContain("subsurfaceMaterial");
  expect(jade).toContain("geometry.inner");
  expect(jade).toContain("geometry.outer");
  expect(jade).toContain("new THREE.MeshPhysicalMaterial");
  expect(jade).toContain("new THREE.MeshStandardMaterial");
  expect(jade).toContain("transparent: opacity < 1");
  expect(jade).toContain("depthWrite: opacity >= 1");
  expect(jade).toContain("depthWrite: true");
  expect(jade).not.toContain("CoScrollModelCaustics");
  expect(jade).not.toContain("viewport.width * 1.22");
  expect(jade).toContain("createSmoothedGeometry");
  expect(jade).toContain("mergeVertices(child.geometry.clone(), 1e-4)");
  expect(jade).toContain("preparedAnchorGeometryCache");
  expect(jade).toContain("preloadCoScrollAnchorGeometry");
  expect(jade).toContain("targetSpeedRef");
  expect(jade).toContain("smoothedManualVelocityRef");
  expect(jade).toContain('window.addEventListener("wheel"');
  expect(jade).toContain('canvas.addEventListener("touchmove"');
  expect(jade).toContain("maxRotationPerFrame");
  expect(jade).toContain("listenToScrollInput");
  expect(jade).toContain("reducedMotion || paused || !listenToScrollInput");
  expect(jade).not.toContain("rimOpacity");
  expect(jade).toContain("outerOffset: 0.001");
  expect(jade).not.toContain("useGLTF");
  expect(sceneContent).toContain("preloadCoScrollAnchorGeometry(anchor.modelSrc, true)");
  expect(sceneContent).not.toContain("key={currentAnchorAsset.id}");
  expect(sceneContent).not.toContain("key={currentAnchorAsset.modelSrc}");
  expect(sceneContent).toContain("listenToScrollInput={!sourceMatchMode}");
  expect(sceneContent).toContain('ambientLight intensity={sourceMatchMode ? 0.4 : 0.34}');
  expect(sceneContent).toContain('position={sourceMatchMode ? [2, 2, 2] : [3.4, 3.8, 5.2]}');
  expect(sceneContent).toContain('intensity={sourceMatchMode ? 1.2 : 1.12}');
  expect(sceneContent).toContain('position={sourceMatchMode ? [-2, 2, -2] : [-2.8, -1.8, 2.8]}');
  expect(sceneContent).toContain('intensity={sourceMatchMode ? 0.3 : 0.48}');
  expect(sceneContent).toContain('color={sourceMatchMode ? "#4A90E2" : "#7ed6e8"}');
  expect(sceneContent).not.toContain('<pointLight position={[1.8, -1.4, 2.6]}');
  expect(sceneContent).toContain("const SOURCE_MATCH_MODEL_SCALE = 2.8 * 1.2 * 1.1;");
  expect(sceneContent).toContain("? 2.2 * 1.2 * 1.1");
  expect(sceneContent).toContain(": SOURCE_MATCH_MODEL_SCALE");
  expect(sceneContent).not.toContain("causticsActive={sourceMatchMode}");
  expect(sceneContent).not.toContain("causticsOpacity={sourceMatchMode ? state.backgroundIntensity");
  expect(spikeExperience).not.toContain("onPointerMove");
  expect(spikeExperience).not.toContain("PointerEvent");
  expect(spikeExperience).not.toContain("DRAG_THRESHOLD");
  expect(spikeExperience).toContain('shell.addEventListener("wheel", handleWheel, { passive: false })');
  expect(spikeExperience).toContain('shell.addEventListener("touchmove", handleTouchMove, { passive: false })');
  for (const oldMineralColor of ["#2f5b4f", "#344d44", "#5a5135"]) {
    expect(jade).not.toContain(oldMineralColor);
  }
});

test("coscroll source-match keeps lyric glyph size constant while scrolling", async () => {
  const billboard = await readProjectFile("packages/coscroll-scene/src/CoScrollTextBillboard.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");

  expect(billboard).toContain("ctx.font = `${fontPx}px ${sourceTextStyle(sourceFont)}`");
  expect(billboard).not.toContain("current ? fontPx * 1.04 : fontPx");
  expect(sceneContent).toContain("const SOURCE_MATCH_DESKTOP_FONT_SIZE = 0.5;");
  expect(sceneContent).toContain("const SOURCE_MATCH_MOBILE_FONT_SIZE = 0.4;");
  expect(sceneContent).toContain("? SOURCE_MATCH_MOBILE_FONT_SIZE");
  expect(sceneContent).toContain(": SOURCE_MATCH_DESKTOP_FONT_SIZE");
  expect(sceneContent).not.toContain("sourceCurrentFrontLift");
  expect(sceneContent).toContain("scale={sourceMatchMode ? 1 : line.scale}");
});

test("coscroll source-match current lyric changes highlight only", async () => {
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const billboard = await readProjectFile("packages/coscroll-scene/src/CoScrollTextBillboard.tsx");

  expect(sceneContent).toContain("opacity={sourceMatchMode ? 1 : line.opacity * layerOpacity}");
  expect(sceneContent).toContain("edgeFeather={sourceMatchMode ? 0 : line.edgeFeather}");
  expect(sceneContent).not.toContain("line.isCurrent ? 0.58 : 0.5");
  expect(sceneContent).not.toContain("line.isCurrent ? 0.56 : 0.46");
  expect(billboard).toContain('fill: current ? "#f8fafc" : "#cbd5f5"');
});

test("coscroll source-match lyric fills stay opaque without halo shadows", async () => {
  const billboard = await readProjectFile("packages/coscroll-scene/src/CoScrollTextBillboard.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");

  expect(billboard).toContain('shadow: "rgba(0, 0, 0, 0)"');
  expect(billboard).toContain("ctx.shadowBlur = sourceFont ? 0 :");
  expect(billboard).toContain("if (!sourceFont) {");
  expect(billboard).toContain("ctx.strokeText(glyph, x, y);");
  expect(billboard).toContain("transparent\n");
  expect(billboard).not.toContain("transparent={!sourceFont}");
  expect(billboard).toContain("opacity={sourceFont ? 1 : opacity * edgeOpacity}");
  expect(billboard).not.toContain("alphaTest=");
  expect(billboard).not.toContain("alphaToCoverage=");
  expect(billboard).toContain("premultipliedAlpha={false}");
  expect(sceneContent).toContain("depthTest");
  expect(sceneContent).toContain("depthWrite");
});

test("coscroll source-match shares anchor rotation phase with the caustic field", async () => {
  const types = await readProjectFile("packages/coscroll-scene/src/types.ts");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const jade = await readProjectFile("packages/coscroll-scene/src/CoScrollJadeAnchor.tsx");
  const caustics = await readProjectFile("packages/coscroll-scene/src/CoScrollCausticLightField.tsx");

  expect(types).toContain("export interface CoScrollRotationSignal");
  expect(sceneContent).toContain("const sourceRotationSignalRef = useRef<CoScrollRotationSignal>");
  expect(sceneContent.match(/rotationSignalRef=\{sourceRotationSignalRef\}/g)).toHaveLength(2);
  expect(sceneContent).toContain("const sourceAnchorPosition");
  expect(sceneContent).toContain("const sourceAnchorScale");
  expect(sceneContent).toContain("anchorPosition={sourceAnchorPosition}");
  expect(sceneContent).toContain("anchorScale={sourceAnchorScale}");
  expect(jade).toContain("rotationSignalRef.current.angle = rotationRef.current");
  expect(jade).toContain("rotationSignalRef.current.speed = currentSpeedRef.current");
  expect(caustics).toContain('import { stepSourceCausticMotion } from "./sourceCausticMotion"');
  expect(caustics).toContain('import { coScrollSourceCausticFragmentShader } from "./shaders/coScrollSourceCausticShader"');
  expect(caustics).toContain("const legacyFragmentShader = `");
  expect(caustics).toContain("const sourceMotionEnergyRef = useRef(0);");
  expect(caustics).toContain("const motion = stepSourceCausticMotion({");
  expect(caustics).toContain("angle: rotationSignalRef?.current.angle ?? 0");
  expect(caustics).toContain("speed: rotationSignalRef?.current.speed ?? 0");
  expect(caustics).toContain("uAnchorCenter");
  expect(caustics).toContain("uAnchorFieldScale");
  expect(caustics).toContain("uAnchorFacing");
  expect(caustics).toContain("uLensStrength");
  expect(caustics).toContain("THREE.NormalBlending");
  expect(caustics).toContain("transparent={!sourceMatch}");
  expect(caustics).toContain('key={sourceMatch ? "source-organic-caustic" : "legacy-caustic"}');
  expect(caustics).toContain("? coScrollSourceCausticFragmentShader");
  expect(caustics).toContain(": legacyFragmentShader");
});

test("source caustic remains calm at the anchor base speed", () => {
  const motion = stepSourceCausticMotion({
    angle: -0.62,
    speed: -0.32,
    previousEnergy: 0,
    delta: 1 / 60
  });

  expect(motion.energy).toBeCloseTo(0, 4);
  expect(motion.anchorFacing).toBeCloseTo(Math.sin(-0.62), 4);
  expect(motion.lensStrength).toBeCloseTo(0.32, 4);
  expect(motion.fieldRotation).toBeCloseTo(-0.2604, 4);
  expect(motion.timeScale).toBeCloseTo(0.3, 4);
  expect(motion.chromaOffset).toBeCloseTo(0.00045, 5);
});

test("source caustic acceleration is independent of scroll direction", () => {
  const forward = stepSourceCausticMotion({
    angle: 1,
    speed: 2.2,
    previousEnergy: 0,
    delta: 1
  });
  const reverse = stepSourceCausticMotion({
    angle: 1,
    speed: -2.2,
    previousEnergy: 0,
    delta: 1
  });

  expect(forward).toEqual(reverse);
  expect(forward.anchorFacing).toBeCloseTo(Math.sin(1), 4);
  expect(forward.lensStrength).toBeGreaterThan(0.41);
  expect(forward.lensStrength).toBeLessThanOrEqual(0.42);
  expect(forward.timeScale).toBeGreaterThan(1.28);
  expect(forward.warpAmount).toBeGreaterThan(0.47);
  expect(forward.chromaOffset).toBeLessThanOrEqual(0.0022);
});

test("source caustic uses organic layers without global postprocessing", async () => {
  const shader = await readProjectFile(
    "packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts"
  );
  const field = await readProjectFile(
    "packages/coscroll-scene/src/CoScrollCausticLightField.tsx"
  );

  expect(shader).toContain("macroStream");
  expect(shader).toContain("pulseStreak");
  expect(shader).toContain("microCaustic");
  expect(shader).toContain("spectralRidge");
  expect(shader).toContain("uFieldRotation");
  expect(shader).toContain("uMotionEnergy");
  expect(shader).toContain("uniform vec2 uAnchorCenter");
  expect(shader).toContain("uniform vec2 uAnchorFieldScale");
  expect(shader).toContain("uniform float uAnchorFacing");
  expect(shader).toContain("uniform float uLensStrength");
  expect(shader).toContain("float capsuleSdf(");
  expect(shader).toContain("float sourceAnchorSdf(");
  expect(shader).toContain("float macroStream");
  expect(shader).toContain("float anchorRim");
  expect(shader).toContain("vec3 amberEdge");
  expect(shader).toContain("gl_FragColor = vec4(color, 1.0);");
  expect(shader).toContain("float macroLight =");
  expect(shader).toContain("float pulseLight =");
  expect(shader).toContain("float microLight =");
  expect(shader).toContain("float lightSignal = macroLight + pulseLight + microLight + rimLight;");
  expect(shader).toContain("mix(1.0, 0.92, readingChannel * readingChannel)");
  expect(shader).not.toContain("mix(1.0, 0.46, readingChannel)");
  expect(field).not.toContain("EffectComposer");
  expect(field).not.toContain("ChromaticAberration");
  expect(field).not.toContain("WebGLRenderTarget");
  expect(shader).not.toContain("WebGLRenderTarget");
});

test("coscroll source-match scroll input accelerates rotation in its current direction", async () => {
  const jade = await readProjectFile("packages/coscroll-scene/src/CoScrollJadeAnchor.tsx");

  expect(jade).toContain("const baseDirection = Math.sign(baseSpeed) || 1;");
  expect(jade).toContain("baseDirection * Math.abs(scrollVelocity * velocityMultiplier)");
  expect(jade).not.toContain("const propVelocity = reducedMotion || paused ? 0 : scrollVelocity * velocityMultiplier;");
});

test("coscroll source-match uses the original black-blue and cold-white palette", async () => {
  const spikeExperience = await readProjectFile("apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const billboard = await readProjectFile("packages/coscroll-scene/src/CoScrollTextBillboard.tsx");
  const caustics = await readProjectFile("packages/coscroll-scene/src/CoScrollCausticLightField.tsx");

  expect(spikeExperience).toContain('background: "#010205"');
  expect(sceneContent).toContain('{sourceMatchMode ? null : <color attach="background" args={["#010205"]} />}');
  expect(billboard).toContain('fill: current ? "#f8fafc" : "#cbd5f5"');
  expect(billboard).toContain('shadow: "rgba(0, 0, 0, 0)"');
  expect(caustics).toContain('sourceMatch ? "#2d6d8b" : "#386f70"');
  expect(caustics).toContain('sourceMatch ? "#cbd5f5" : "#e5fff7"');
});

test("coscroll source-match keeps the original transmissive shell isolated from the backdrop", async () => {
  const standalone = await readProjectFile("packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");

  expect(standalone).toContain('alpha: sourceMatchMode');
  expect(standalone).toContain('background: "#010205"');
  expect(sceneContent).toContain('{sourceMatchMode ? null : <color attach="background" args={["#010205"]} />}');
});

test("coscroll source-match lifts the complete desktop composition as one unit", async () => {
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");

  expect(sceneContent).toContain("const SOURCE_MATCH_DESKTOP_Y_LIFT = 0.34;");
  expect(sceneContent).toContain("-0.82 + SOURCE_MATCH_DESKTOP_Y_LIFT");
  expect(sceneContent).toContain("-0.41 + SOURCE_MATCH_DESKTOP_Y_LIFT");
});

test("coscroll source-match mode uses the original OBJ anchor model set", async ({ page }) => {
  const [{ existsSync }, path] = await Promise.all([import("node:fs"), import("node:path")]);
  const assetManifest = await readProjectFile("packages/coscroll-scene/src/assetManifest.ts");
  const sourceTimeline = await readProjectFile("packages/coscroll-scene/src/sourceTimeline.ts");
  const globals = await readProjectFile("apps/site/app/globals.css");
  const billboard = await readProjectFile("packages/coscroll-scene/src/CoScrollTextBillboard.tsx");

  for (const sourceModel of ["101_观.obj", "001_空.obj", "002_心.obj", "003_道.obj", "009_真.obj"]) {
    expect(existsSync(path.join(repoRoot, "apps/site/public/assets/coscroll/source-models", sourceModel))).toBe(true);
    expect(assetManifest).toContain(sourceModel);
  }
  expect(sourceTimeline).toContain('anchor: "观"');
  expect(sourceTimeline).toContain('anchor: "真"');
  expect(sourceTimeline).toContain('easing: "linear"');
  expect(existsSync(path.join(repoRoot, "apps/site/public/assets/coscroll/fonts/runzhi-kangxi.ttf"))).toBe(true);
  expect(existsSync(path.join(repoRoot, "apps/site/public/assets/coscroll/textures/qwantani_moon_noon_puresky_1k.hdr"))).toBe(true);
  expect(existsSync(path.join(repoRoot, "apps/site/public/assets/coscroll/textures/normal.jpg"))).toBe(true);
  expect(globals).not.toContain("runzhi-kangxi.ttf");
  expect(billboard).toContain("loadSourceFont");
  expect(billboard).toContain("sourceFont");

  const requestedAssets: string[] = [];
  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (
      url.includes("/assets/coscroll/source-models/") ||
      url.includes("/assets/coscroll/fonts/") ||
      url.includes("/assets/coscroll/textures/")
    ) {
      requestedAssets.push(url);
    }
  });

  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page);
  expect(requestedAssets.some((url) => url.includes("101_观.obj"))).toBe(true);
  expect(requestedAssets.some((url) => url.includes("runzhi-kangxi.ttf"))).toBe(true);
  expect(requestedAssets.some((url) => url.includes("qwantani_moon_noon_puresky_1k.hdr"))).toBe(true);
  expect(requestedAssets.some((url) => url.includes("normal.jpg"))).toBe(true);
});

test("plain coscroll spike does not load source-match OBJ, font, or source texture assets", async ({ page }) => {
  const requestedAssets: string[] = [];
  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (
      url.includes("/assets/coscroll/source-models/") ||
      url.includes("/assets/coscroll/fonts/") ||
      url.includes("/assets/coscroll/textures/")
    ) {
      requestedAssets.push(url);
    }
  });

  await page.goto("/coscroll-spike?visualTest=pixels");
  await waitForCoScrollPixels(page);
  await page.waitForTimeout(500);

  expect(requestedAssets).toEqual([]);
});

test("coscroll source-match frame uses the original-project travel composition", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page, 60);
  await page.waitForFunction(() => document.fonts.check('16px "RunZhiJiaKangXiZidian"'));

  const composition = await measureSourceMatchExcerptComposition(page);
  expect(composition.topTravelLane.bbox).not.toBeNull();
  expect(composition.centerTravelField.bbox).not.toBeNull();
  expect(composition.bottomTravelLane.bbox).not.toBeNull();
  expect(composition.anchor.bbox).not.toBeNull();
  expect(composition.anchor.cyanShare).toBeGreaterThan(0.12);

  const anchorBox = composition.anchor.bbox;
  if (!anchorBox) {
    throw new Error("Expected source-match excerpt anchor bounding box");
  }

  expect(anchorBox.width).toBeGreaterThan(8);
  expect(anchorBox.width).toBeLessThan(46);
  expect(anchorBox.height).toBeGreaterThan(22);
  expect(anchorBox.height).toBeLessThan(62);
  expect(composition.topTravelLane.litPixels).toBeGreaterThan(80);
  expect(composition.centerTravelField.litPixels).toBeGreaterThan(70);
  expect(composition.bottomTravelLane.litPixels).toBeGreaterThan(20);
  expect(composition.whole.litPixels).toBeGreaterThan(150);
  expect(composition.whole.litPixels).toBeLessThan(6500);

  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  expect(sceneContent).not.toContain("sourcePairAnchorAssets");
  expect(sceneContent).not.toContain("excerpt-duet");
  expect(sceneContent).toContain("topLaneY: sourceMatchMode ? (mobileSourceMatch ? 2.62 : 2.72)");
  expect(sceneContent).toContain("bottomLaneY: sourceMatchMode ? (mobileSourceMatch ? -1.34 : -2.56)");
  expect(sceneContent).toContain("line.y + lyricYOffset");
});

test("coscroll source-match uses the original orthographic composition path", async () => {
  const standalone = await readProjectFile("packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");

  expect(standalone).toContain("orthographic={sourceMatchMode}");
  expect(standalone).toContain("zoom: viewport === \"mobile\" ? 92 : 100");
  expect(sceneContent).toContain("camera instanceof THREE.OrthographicCamera");
  expect(sceneContent).toContain("frontDepth: sourceMatchMode ? 6 : 0.78");
  expect(sceneContent).toContain("backNearDepth: sourceMatchMode ? -1.85 : -1.2");
  expect(sceneContent).toContain("backFarDepth: sourceMatchMode ? -3.25 : -2.08");
});

test("coscroll source-match keeps front lyrics in the same depth-aware composition", async () => {
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");

  expect(sceneContent).toContain("depthTest");
  expect(sceneContent).toContain("depthWrite");
  expect(sceneContent).not.toContain("depthTest={!isFront}");
  expect(sceneContent).not.toContain("depthWrite={!isFront}");
});

test("coscroll spike can render clean source-match screenshot artifacts", async ({ page }) => {
  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page);

  await expect(page.locator('[data-coscroll-source-match="clean"]')).toBeVisible();
  await expect(page.locator('[data-coscroll-runtime="static-review"]')).toBeVisible();
  await expect(page.locator(".coscroll-section__copy")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "心 / 空 / 道" })).toHaveCount(0);

  const spikePage = await readProjectFile("apps/site/app/coscroll-spike/page.tsx");
  expect(spikePage).toContain("SOURCE_COSCROLL_REVIEW_TIME / activeTimeline.duration");
  expect(spikePage).toContain("SOURCE_COSCROLL_EXCERPT_TIMELINE");
  expect(spikePage).toContain("resolveCoScrollSourceExcerptAssets()");
});

test("coscroll source-match route is scroll-driven outside frozen screenshot mode", async ({ page }) => {
  await page.goto("/coscroll-spike?sourceMatch=1&motionTest=1");
  const scene = page.locator('[data-coscroll-source-match="clean"]');
  await expect(scene).toHaveAttribute("data-coscroll-runtime", "scroll-driven");
  const initialProgress = Number(await scene.getAttribute("data-coscroll-progress"));

  await page.mouse.wheel(0, 360);

  await expect.poll(async () => Number(await scene.getAttribute("data-coscroll-progress"))).not.toBe(initialProgress);
});

test("coscroll source-match owns the viewport while wheel input drives its timeline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?sourceMatch=1&motionTest=1");
  await waitForCoScrollPixels(page, 18);

  const scene = page.locator('[data-coscroll-source-match="clean"]');
  await page.evaluate(() => {
    document.documentElement.style.minHeight = "1800px";
    document.body.style.minHeight = "1800px";
  });

  const viewportOwnership = await scene.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return {
      position: style.position,
      overflow: style.overflow,
      overscrollBehavior: style.overscrollBehavior,
      touchAction: style.touchAction,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });

  expect(viewportOwnership).toMatchObject({
    position: "fixed",
    overflow: "hidden",
    overscrollBehavior: "none",
    touchAction: "none",
    top: 0,
    left: 0,
    width: viewportOwnership.viewportWidth,
    height: viewportOwnership.viewportHeight
  });

  const initialProgress = Number(await scene.getAttribute("data-coscroll-progress"));
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 360);

  await expect.poll(async () => Number(await scene.getAttribute("data-coscroll-progress"))).not.toBe(initialProgress);
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
});

test("coscroll source-match wheel input visibly drives bidirectional model motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?sourceMatch=1&motionTest=1");
  await waitForCoScrollPixels(page, 18);
  await page.waitForFunction(() => document.fonts.check('16px "RunZhiJiaKangXiZidian"'));

  const scene = page.locator('[data-coscroll-source-match="clean"]');
  const initialProgress = Number(await scene.getAttribute("data-coscroll-progress"));
  await page.mouse.move(720, 450);
  const before = await readCanvasMotionSample(page);

  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(260);
  const afterForward = await readCanvasMotionSample(page);
  const forwardProgress = Number(await scene.getAttribute("data-coscroll-progress"));

  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(260);
  const afterReverse = await readCanvasMotionSample(page);
  const reverseProgress = Number(await scene.getAttribute("data-coscroll-progress"));

  expect(forwardProgress).toBeGreaterThan(initialProgress);
  expect(reverseProgress).toBeLessThan(forwardProgress);
  expect(meanSampleDelta(before, afterForward)).toBeGreaterThan(0.6);
  expect(meanSampleDelta(afterForward, afterReverse)).toBeGreaterThan(0.6);
});

test("coscroll source-match keeps organic flow separate from the legacy profile", async () => {
  const caustics = await readProjectFile("packages/coscroll-scene/src/CoScrollCausticLightField.tsx");
  const sourceShader = await readProjectFile("packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts");
  const jade = await readProjectFile("packages/coscroll-scene/src/CoScrollJadeAnchor.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");

  expect(caustics).toContain("const legacyFragmentShader = `");
  expect(caustics).toContain("poolDriftA");
  expect(caustics).toContain("roamingCaustic");
  expect(caustics).toContain("sourceFlowA");
  expect(caustics).toContain("sourceFlowB");
  expect(caustics).toContain("sourceCoverageFloor");
  expect(caustics).toContain("float perlinNoise(vec2 p)");
  expect(caustics).toContain("float perlinFbm(vec2 p)");
  expect(caustics).toContain("uLyricCenters");
  expect(caustics).toContain("verticalReadingChannel(centered, uLyricCenters.x");
  expect(caustics).toContain("if (!active || paused || reducedMotion)");
  expect(sourceShader).toContain("macroStream");
  expect(sourceShader).toContain("pulseStreak");
  expect(sourceShader).toContain("microCaustic");
  expect(sceneContent).toContain("lyricCenters={sourceCausticLyricCenters}");
  expect(jade).not.toContain("SOURCE_MATCH_MODEL_CAUSTICS_OPACITY_SCALE");
  expect(jade).not.toContain("SOURCE_MATCH_MODEL_CAUSTICS_MAX_OPACITY");
});

test("source caustic preserves dark space with visible organic highlights", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page, 18);

  const profile = await measureBackgroundLumaProfile(page);
  const profileSummary = JSON.stringify(profile);
  expect(profile.darkShare, profileSummary).toBeGreaterThan(0.55);
  expect(profile.brightShare, profileSummary).toBeGreaterThan(0.01);
  expect(profile.brightShare, profileSummary).toBeLessThan(0.18);
  expect(profile.meanLuma, profileSummary).toBeGreaterThan(4);
  expect(profile.meanLuma, profileSummary).toBeLessThan(42);
});

test("source caustic remains visible on mobile without filling the frame", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page, 18);

  const profile = await measureBackgroundLumaProfile(page, {
    clipWidth: 390,
    clipHeight: 180,
    sampleWidth: 98,
    sampleHeight: 45
  });
  const profileSummary = JSON.stringify(profile);
  expect(profile.darkShare, profileSummary).toBeGreaterThan(0.55);
  expect(profile.darkShare, profileSummary).toBeLessThan(0.98);
  expect(profile.brightShare, profileSummary).toBeGreaterThan(0.005);
  expect(profile.brightShare, profileSummary).toBeLessThan(0.18);
  expect(profile.meanLuma, profileSummary).toBeGreaterThan(3);
  expect(profile.meanLuma, profileSummary).toBeLessThan(42);
});

test("source caustic does not collapse to black during mobile motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/coscroll-spike?sourceMatch=1&motionTest=1");
  await waitForCoScrollPixels(page, 18);

  for (let frame = 0; frame < 3; frame += 1) {
    const profile = await measureBackgroundLumaProfile(page, {
      clipWidth: 390,
      clipHeight: 180,
      sampleWidth: 98,
      sampleHeight: 45
    });
    const profileSummary = JSON.stringify({ frame, ...profile });
    expect(profile.darkShare, profileSummary).toBeLessThan(0.985);
    expect(profile.meanLuma, profileSummary).toBeGreaterThan(3);
    await page.waitForTimeout(480);
  }
});

test("coscroll source-match renders a neutral outer shell over the blue core", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page, 18);
  await expect.poll(
    async () => (await measureSourceShellColorBalance(page)).neutralShellShare,
    { timeout: 20_000 }
  ).toBeGreaterThan(0.01);

  const balance = await measureSourceShellColorBalance(page);
  expect(balance.cyanCoreShare).toBeGreaterThan(0.015);
});

test("coscroll source-match caustics visibly advect across the empty background band", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?sourceMatch=1&motionTest=1");
  await waitForCoScrollPixels(page, 18);
  await page.waitForTimeout(400);

  const motion = await measureBackgroundScreenshotMotion(page);
  expect(motion.meanDelta).toBeGreaterThan(1.2);
  expect(motion.changedShare).toBeGreaterThan(0.08);
});

test("source caustic visibly accelerates with actual model motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?sourceMatch=1&motionTest=1");
  await waitForCoScrollPixels(page, 18);
  await page.waitForTimeout(1_200);

  const idle = await measureBackgroundCanvasFrameMotion(page);

  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 110);
  await page.waitForTimeout(100);
  const boosted = await measureBackgroundCanvasFrameMotion(page);
  const motionSummary = JSON.stringify({ idle, boosted });

  expect(boosted.meanDelta, motionSummary).toBeGreaterThan(idle.meanDelta * 1.2);
  expect(boosted.changedShare, motionSummary).toBeGreaterThan(0.08);
});

test("coscroll reduced motion keeps a static anchor instead of collapsing to background-only pixels", async ({ page }) => {
  const requestedAssets: string[] = [];
  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (url.includes("/assets/coscroll/source-models/") || url.includes("/assets/coscroll/textures/")) {
      requestedAssets.push(url);
    }
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");

  await expect(page.locator("canvas")).toHaveCount(1);
  await waitForCoScrollPixels(page);
  await page.waitForFunction(() => document.fonts.check('16px "RunZhiJiaKangXiZidian"'));
  await waitForSourceMatchAnchorEnergy(page, 160, 13);
  await expect(page.locator('[data-coscroll-fallback="forced"]')).toHaveCount(0);
  const centerEnergy = await measureCanvasCenterEnergy(page);
  expect(centerEnergy.litPixels).toBeGreaterThan(160);
  expect(centerEnergy.meanLuma).toBeGreaterThan(13);
  expect(requestedAssets.some((url) => url.includes("101_观.obj"))).toBe(true);
  expect(requestedAssets.some((url) => url.includes("qwantani_moon_noon_puresky_1k.hdr"))).toBe(true);

  const visualState = await readProjectFile("packages/coscroll-scene/src/createCoScrollVisualState.ts");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  expect(visualState).toContain('fallbackMode === "none" || fallbackMode === "dom-static"');
  expect(sceneContent).toContain('state.fallbackMode === "dom-static"');
  expect(sceneContent).toContain("sourceMaterial={sourceMatchMode}");
});

test("coscroll source-match mobile route still renders the source asset stack", async ({ page }) => {
  const requestedAssets: string[] = [];
  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (
      url.includes("/assets/coscroll/source-models/") ||
      url.includes("/assets/coscroll/fonts/") ||
      url.includes("/assets/coscroll/textures/")
    ) {
      requestedAssets.push(url);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page, 44);
  await page.waitForFunction(() => document.fonts.check('16px "RunZhiJiaKangXiZidian"'));
  await waitForSourceMatchAnchorEnergy(page, 160, 18);
  const centerEnergy = await measureCanvasCenterEnergy(page);

  expect(centerEnergy.litPixels).toBeGreaterThan(160);
  expect(requestedAssets.some((url) => url.includes("101_观.obj"))).toBe(true);
  expect(requestedAssets.some((url) => url.includes("runzhi-kangxi.ttf"))).toBe(true);
  expect(requestedAssets.some((url) => url.includes("qwantani_moon_noon_puresky_1k.hdr"))).toBe(true);
});

test("coscroll homepage placeholder documents source-match reset", async () => {
  const home = await readProjectFile("apps/site/components/MiraLithHome.tsx");
  const globals = await readProjectFile("apps/site/app/globals.css");
  const nextPlan = await readProjectFile("docs/coscroll-implementation-plan/NEXT_STEPS_PLAN.md");

  expect(home).toContain('data-coscroll-stage="placeholder"');
  expect(nextPlan).toContain("temporary placeholder");
  expect(nextPlan).toContain("source-match gate");

  const homeSectionRule = globals.match(/\.coscroll-section--home\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  expect(homeSectionRule).toContain("#202734");
  expect(homeSectionRule).not.toContain("199, 176, 107");
});

test("shared canvas camera changes are guarded by active scene state", async () => {
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  expect(sceneContent).toMatch(/useFrame\(\(\{ camera \}\) => \{\n\s+if \(!active\) \{\n\s+return;\n\s+\}/);
});

test("desktop coscroll title stays on one line", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/coscroll-spike?visualTest=pixels");
  const title = page.getByRole("heading", { name: "心 / 空 / 道" });
  await expect(title).toBeVisible();

  const lineCount = await title.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 1 && rect.height > 1);
    range.detach();
    return lines.length;
  });

  expect(lineCount).toBe(1);
});

test("captures coscroll spike review screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Review screenshot artifacts are captured once.");

  await page.goto("/coscroll-spike?sourceMatch=1&visualTest=pixels");
  await waitForCoScrollPixels(page, 90);
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForCoScrollPixels(page, 90);
  await page.screenshot({ path: "test-results/coscroll-spike-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForCoScrollPixels(page, 90);
  await page.screenshot({ path: "test-results/coscroll-spike-mobile-portrait.png", fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  await waitForCoScrollPixels(page, 90);
  await page.screenshot({ path: "test-results/coscroll-spike-mobile-landscape.png", fullPage: true });
});
