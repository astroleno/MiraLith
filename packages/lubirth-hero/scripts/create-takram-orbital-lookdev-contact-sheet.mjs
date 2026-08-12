import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");

function readInputPath(argv) {
  const index = argv.indexOf("--input");
  if (index === -1 || argv[index + 1] === undefined) {
    throw new Error("Usage: create-takram-orbital-lookdev-contact-sheet --input <sheet.json>");
  }
  return resolve(repositoryRoot, argv[index + 1]);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const inputPath = readInputPath(process.argv.slice(2));
const input = JSON.parse(await readFile(inputPath, "utf8"));
const panelWidth = input.panelWidth ?? 360;
const panelHeight = input.panelHeight ?? 240;
const labelHeight = input.labelHeight ?? 32;
const gutter = input.gutter ?? 8;
const columns = input.columns;
const background = input.background ?? "#080d15";

if (!Number.isInteger(columns) || columns < 1 || !Array.isArray(input.panels) ||
  input.panels.length === 0) {
  throw new Error("Sheet input requires positive columns and at least one panel");
}

async function makePanel(panel) {
  const imagePath = resolve(dirname(inputPath), panel.path);
  await stat(imagePath);
  const image = await sharp(imagePath)
    .resize({ width: panelWidth, height: panelHeight, fit: "fill" })
    .png()
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${panelWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="100%" height="100%" fill="#101827"/>` +
    `<text x="10" y="21" fill="#edf4ff" font-family="ui-monospace,Menlo,monospace" font-size="13">` +
    `${escapeXml(panel.label)}</text></svg>`
  );
  return sharp({
    create: {
      background,
      channels: 4,
      height: panelHeight + labelHeight,
      width: panelWidth
    }
  }).composite([
    { input: image, left: 0, top: 0 },
    { input: label, left: 0, top: panelHeight }
  ]).png().toBuffer();
}

const panels = await Promise.all(input.panels.map(makePanel));
const rows = Math.ceil(panels.length / columns);
const panelBoxHeight = panelHeight + labelHeight;
const outputPath = resolve(dirname(inputPath), input.output);
await mkdir(dirname(outputPath), { recursive: true });
await sharp({
  create: {
    background,
    channels: 4,
    height: rows * panelBoxHeight + (rows + 1) * gutter,
    width: columns * panelWidth + (columns + 1) * gutter
  }
}).composite(panels.map((panel, index) => ({
  input: panel,
  left: gutter + (index % columns) * (panelWidth + gutter),
  top: gutter + Math.floor(index / columns) * (panelBoxHeight + gutter)
}))).png().toFile(outputPath);
