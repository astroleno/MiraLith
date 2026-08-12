import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync
} from "node:fs";
import path from "node:path";

export async function writeTakramOrbitalLookdevEvidenceAtomically(input: {
  build: (stagingDirectory: string) => Promise<void>;
  enabled: boolean;
  finalDirectory: string;
}) {
  if (!input.enabled) return false;

  const parent = path.dirname(input.finalDirectory);
  const base = path.basename(input.finalDirectory);
  const nonce = `${process.pid}-${Date.now()}`;
  const stagingDirectory = path.join(parent, `${base}.staging-${nonce}`);
  const backupDirectory = path.join(parent, `${base}.backup-${nonce}`);
  mkdirSync(parent, { recursive: true });
  rmSync(stagingDirectory, { force: true, recursive: true });
  mkdirSync(stagingDirectory, { recursive: true });

  try {
    await input.build(stagingDirectory);
  } catch (error) {
    rmSync(stagingDirectory, { force: true, recursive: true });
    throw error;
  }

  const hadPreviousEvidence = existsSync(input.finalDirectory);
  if (hadPreviousEvidence) renameSync(input.finalDirectory, backupDirectory);
  try {
    renameSync(stagingDirectory, input.finalDirectory);
  } catch (error) {
    rmSync(input.finalDirectory, { force: true, recursive: true });
    if (hadPreviousEvidence && existsSync(backupDirectory)) {
      renameSync(backupDirectory, input.finalDirectory);
    }
    rmSync(stagingDirectory, { force: true, recursive: true });
    throw error;
  }
  rmSync(backupDirectory, { force: true, recursive: true });
  return true;
}
