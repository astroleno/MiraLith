import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  listSiblingStagingDirectories,
  pathExists,
  writeTakramCloudScaleEvidenceAtomically
} from "../helpers/takramCloudScaleEvidence";

test("does not touch formal cloud-scale evidence outside capture mode", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "miralith-cloud-scale-evidence-"));
  const finalDirectory = path.join(root, "formal");
  let buildCount = 0;

  try {
    const written = await writeTakramCloudScaleEvidenceAtomically({
      build: async () => {
        buildCount += 1;
      },
      enabled: false,
      finalDirectory
    });
    expect(written).toBe(false);
    expect(buildCount).toBe(0);
    expect(pathExists(finalDirectory)).toBe(false);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("publishes a complete staging directory and replaces prior evidence atomically", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "miralith-cloud-scale-evidence-"));
  const finalDirectory = path.join(root, "formal");

  try {
    await writeTakramCloudScaleEvidenceAtomically({
      build: async (stagingDirectory: string) => {
        writeFileSync(path.join(stagingDirectory, "manifest.json"), "first");
      },
      enabled: true,
      finalDirectory
    });
    expect(readFileSync(path.join(finalDirectory, "manifest.json"), "utf8"))
      .toBe("first");

    await writeTakramCloudScaleEvidenceAtomically({
      build: async (stagingDirectory: string) => {
        expect(pathExists(finalDirectory)).toBe(true);
        writeFileSync(path.join(stagingDirectory, "manifest.json"), "second");
        writeFileSync(path.join(stagingDirectory, "checkpoint.json"), "complete");
      },
      enabled: true,
      finalDirectory
    });
    expect(readFileSync(path.join(finalDirectory, "manifest.json"), "utf8"))
      .toBe("second");
    expect(readFileSync(path.join(finalDirectory, "checkpoint.json"), "utf8"))
      .toBe("complete");
    expect(listSiblingStagingDirectories(finalDirectory)).toEqual([]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
