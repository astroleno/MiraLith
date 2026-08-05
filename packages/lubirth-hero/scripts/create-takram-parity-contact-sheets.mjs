import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const evidenceDirectory = resolve(
  repositoryRoot,
  "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity"
);
const capturesDirectory = resolve(evidenceDirectory, "captures");
const referenceDirectory = resolve(evidenceDirectory, "reference");
const panelWidth = 640;
const panelHeight = 360;
const labelHeight = 34;
const gutter = 12;
const background = "#070b12";

function panelLabel(label) {
  return Buffer.from(
    `<svg width="${panelWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111a28"/>
      <text x="14" y="22" fill="#e8f3ff" font-family="ui-monospace, Menlo, monospace" font-size="15">${label}</text>
    </svg>`
  );
}

async function makePanel({ label, path }) {
  await stat(path);
  const image = await sharp(path)
    .resize({
      width: panelWidth,
      height: panelHeight,
      fit: "contain",
      background
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: panelWidth,
      height: panelHeight + labelHeight,
      channels: 4,
      background
    }
  })
    .composite([
      { input: panelLabel(label), top: 0, left: 0 },
      { input: image, top: labelHeight, left: 0 }
    ])
    .png()
    .toBuffer();
}

async function writeSheet({ output, panels, columns }) {
  const panelBuffers = await Promise.all(panels.map(makePanel));
  const rows = Math.ceil(panelBuffers.length / columns);
  const panelBoxHeight = panelHeight + labelHeight;
  const width = columns * panelWidth + (columns + 1) * gutter;
  const height = rows * panelBoxHeight + (rows + 1) * gutter;
  const composites = panelBuffers.map((input, index) => ({
    input,
    left: gutter + (index % columns) * (panelWidth + gutter),
    top: gutter + Math.floor(index / columns) * (panelBoxHeight + gutter)
  }));
  await sharp({
    create: { width, height, channels: 4, background }
  })
    .composite(composites)
    .png()
    .toFile(output);
}

await mkdir(evidenceDirectory, { recursive: true });

await writeSheet({
  output: resolve(evidenceDirectory, "upstream-control-contact-sheet.png"),
  columns: 3,
  panels: [
    { label: "Upstream reference (Tokyo)", path: resolve(referenceDirectory, "upstream-tokyo.jpg") },
    { label: "Control — full composite", path: resolve(capturesDirectory, "control-full.png") },
    { label: "Control — BSM occlusion off", path: resolve(capturesDirectory, "control-bsm-off.png") },
    { label: "Control — history reset first frame", path: resolve(capturesDirectory, "control-history-reset-first.png") },
    { label: "Control — raw cloud buffer", path: resolve(capturesDirectory, "control-cloud-raw.png") },
    { label: "Control — AerialPerspective final", path: resolve(capturesDirectory, "control-aerial-final.png") }
  ]
});

await writeSheet({
  output: resolve(evidenceDirectory, "stock-opening-contact-sheet.png"),
  columns: 4,
  panels: [
    { label: "0.00 — full", path: resolve(capturesDirectory, "opening-stock-0-00-full.png") },
    { label: "0.00 — raw cloud", path: resolve(capturesDirectory, "opening-stock-0-00-cloud-raw.png") },
    { label: "0.06 — full", path: resolve(capturesDirectory, "opening-stock-0-06-full.png") },
    { label: "0.06 — raw cloud", path: resolve(capturesDirectory, "opening-stock-0-06-cloud-raw.png") },
    { label: "0.12 — full", path: resolve(capturesDirectory, "opening-stock-0-12-full.png") },
    { label: "0.12 — raw cloud", path: resolve(capturesDirectory, "opening-stock-0-12-cloud-raw.png") },
    { label: "0.18 — full", path: resolve(capturesDirectory, "opening-stock-0-18-full.png") },
    { label: "0.18 — raw cloud", path: resolve(capturesDirectory, "opening-stock-0-18-cloud-raw.png") }
  ]
});

const openingFrames = ["0-00", "0-06", "0-12", "0-18"];
const openingDiagnostics = [
  { label: "full", suffix: "full" },
  { label: "raw cloud", suffix: "cloud-raw" }
];

await writeSheet({
  output: resolve(evidenceDirectory, "opening-parity-contact-sheet.png"),
  columns: 3,
  panels: openingFrames.flatMap((frame) => openingDiagnostics.flatMap((diagnostic) => [
    {
      label: `${frame.replace("-", ".")} — upstream control ${diagnostic.label}`,
      path: resolve(
        capturesDirectory,
        diagnostic.suffix === "full" ? "control-full.png" : "control-cloud-raw.png"
      )
    },
    {
      label: `${frame.replace("-", ".")} — stock ${diagnostic.label}`,
      path: resolve(capturesDirectory, `opening-stock-${frame}-${diagnostic.suffix}.png`)
    },
    {
      label: `${frame.replace("-", ".")} — V3 ${diagnostic.label}`,
      path: resolve(capturesDirectory, `opening-v3-${frame}-${diagnostic.suffix}.png`)
    }
  ]))
});
