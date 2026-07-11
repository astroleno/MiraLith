import { expect, test } from "@playwright/test";

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
  expect(caustics).toContain('sourceMatch ? "#6f3b1b"');
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

test("coscroll jade material keeps the original dual-layer loader path with MiraLith amber tuning", async () => {
  const jade = await readProjectFile("packages/coscroll-scene/src/CoScrollJadeAnchor.tsx");
  const sceneContent = await readProjectFile("packages/coscroll-scene/src/CoScrollSceneContent.tsx");
  const spikeExperience = await readProjectFile("apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx");

  expect(jade).toContain("jadeMaterialPresets");
  expect(jade).toContain("jadeMaterialPresets[materialPreset]");
  expect(jade).toContain("OBJLoader");
  expect(jade).toContain("GLTFLoader");
  expect(jade).toContain("MeshoptDecoder");
  expect(jade).toContain("RGBELoader");
  expect(jade).toContain("deterministicPose");
  expect(jade).toContain("sourceMaterial");
  expect(jade).toContain("qwantani_moon_noon_puresky_1k.hdr");
  expect(jade).toContain('"/assets/coscroll/textures/normal.jpg"');
  expect(jade).toContain("SOURCE_JADE_MATERIAL");
  expect(jade).toContain("innerColor: 0xd99552");
  expect(jade).toContain("innerMetalness: 0.85");
  expect(jade).toContain("innerRoughness: 1");
  expect(jade).toContain("innerTransmission: 0");
  expect(jade).toContain("innerOpacity: 1");
  expect(jade).toContain("innerEmissive: 0x8b401e");
  expect(jade).toContain("innerEmissiveIntensity: 11.4");
  expect(jade).toContain("innerEnvMapIntensity: 2");
  expect(jade).toContain("outerColor: 0xffe8c2");
  expect(jade).toContain("outerRoughness: 0.82");
  expect(jade).toContain("outerTransmission: 0.92");
  expect(jade).toContain("outerIor: 1.52");
  expect(jade).toContain("outerReflectivity: 0.3");
  expect(jade).toContain("outerThickness: 0.28");
  expect(jade).toContain("outerAttenuationColor: 0xf1aa64");
  expect(jade).toContain("outerAttenuationDistance: 0.62");
  expect(jade).toContain("outerEmissiveIntensity: 0.16");
  expect(jade).toContain("outerClearcoat: 0");
  expect(jade).toContain("outerClearcoatRoughness: 1");
  expect(jade).toContain("outerEnvMapIntensity: 5");
  expect(jade).toContain("normalScale: 0.3");
  expect(jade).toContain("normalRepeat: 3");
  expect(jade).not.toContain("createJadeDensityTexture");
  expect(jade).not.toContain("subsurfaceMaterial");
  expect(jade).toContain("geometry.inner");
  expect(jade).toContain("geometry.outer");
  expect(jade).toContain("new THREE.MeshPhysicalMaterial");
  expect(jade).toContain("new THREE.MeshStandardMaterial");
  expect(jade).toContain("transparent: false");
  expect(jade).toContain("depthWrite: true");
  expect(jade).toContain("CoScrollModelCaustics");
  expect(jade).toContain("WebGLRenderTarget");
  expect(jade).toContain("causticComputeFragmentShader");
  expect(jade).toContain("refract(lightDir, normal, 1.0 / 1.25)");
  expect(jade).toContain("normalMesh.rotation.copy(anchorGroup.current.rotation)");
  expect(jade).toContain("createSmoothedGeometry");
  expect(jade).toContain("mergeVertices(geometry.clone(), 1e-4)");
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
  expect(sceneContent).toContain('ambientLight intensity={sourceMatchMode ? 0.66 : 0.34}');
  expect(sceneContent).toContain('intensity={sourceMatchMode ? 2.15 : 1.12}');
  expect(sceneContent).toContain('color={sourceMatchMode ? "#f4b066" : "#7ed6e8"}');
  expect(sceneContent).toContain('color={sourceMatchMode ? "#3a2113" : undefined}');
  expect(sceneContent).toContain("causticsActive={sourceMatchMode}");
  expect(sceneContent).toContain("causticsOpacity={sourceMatchMode ? state.backgroundIntensity");
  expect(spikeExperience).not.toContain("onPointerMove");
  expect(spikeExperience).not.toContain("PointerEvent");
  expect(spikeExperience).not.toContain("DRAG_THRESHOLD");
  expect(spikeExperience).toContain("onTouchMove={handleTouchMove}");
  for (const oldMineralColor of ["#2f5b4f", "#344d44", "#5a5135"]) {
    expect(jade).not.toContain(oldMineralColor);
  }
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
  expect(composition.anchor.amberShare).toBeGreaterThan(0.12);

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
  expect(composition.whole.litPixels).toBeLessThan(3600);

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
