import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  evaluateTakramMipDiagnostic,
  TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE,
  type TakramMipDiagnosticEvaluation,
  type TakramMipDiagnosticPopulationInput,
  type TakramMipDiagnosticScale
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramMipDiagnostic";

type ManifestFrame = {
  byteLength: number;
  compression: "gzip";
  file: string;
  nativeFrame: number;
  recordCount: number;
  recordStride: number;
  sha256: string;
  uncompressedByteLength: number;
  uncompressedSha256: string;
};

type Manifest = {
  evaluation: TakramMipDiagnosticEvaluation;
  populations: Array<{
    scale: TakramMipDiagnosticScale;
    frames: ManifestFrame[];
  }>;
};

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function float32LittleEndian(bytes: Uint8Array) {
  if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error("Takram mip evidence is not aligned to float32 values.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Float32Array(bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
  }
  return values;
}

export function verifyTakramMipDiagnosticEvidence(evidenceDirectory: string) {
  const manifest = JSON.parse(
    readFileSync(path.join(evidenceDirectory, "manifest.json"), "utf8")
  ) as Manifest;
  const populations: TakramMipDiagnosticPopulationInput[] = manifest.populations.map(
    (population) => ({
      scale: population.scale,
      frames: population.frames.map((frame) => {
        if (frame.compression !== "gzip" ||
          frame.recordStride !== TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE) {
          throw new Error(`Unexpected Task M encoding for ${frame.file}.`);
        }
        const compressed = readFileSync(path.join(evidenceDirectory, frame.file));
        if (compressed.byteLength !== frame.byteLength ||
          sha256(compressed) !== frame.sha256) {
          throw new Error(`Compressed Task M evidence mismatch for ${frame.file}.`);
        }
        const uncompressed = gunzipSync(compressed);
        if (uncompressed.byteLength !== frame.uncompressedByteLength ||
          sha256(uncompressed) !== frame.uncompressedSha256) {
          throw new Error(`Uncompressed Task M evidence mismatch for ${frame.file}.`);
        }
        const records = float32LittleEndian(uncompressed);
        if (records.length !== frame.recordCount * frame.recordStride) {
          throw new Error(`Task M record count mismatch for ${frame.file}.`);
        }
        return { nativeFrame: frame.nativeFrame, records };
      })
    })
  );
  const healthy = populations.find((population) => population.scale === 1);
  if (!healthy) throw new Error("Task M evidence is missing the S=1 healthy population.");
  const evaluation = evaluateTakramMipDiagnostic({
    healthy,
    candidates: populations.filter((population) => population.scale !== 1)
  });
  return {
    evaluation,
    manifestEvaluation: manifest.evaluation,
    scales: populations.map((population) => population.scale),
    verifiedFileCount: populations.reduce(
      (count, population) => count + population.frames.length,
      0
    )
  };
}
