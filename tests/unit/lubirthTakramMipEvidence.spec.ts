import { expect, test } from "@playwright/test";
import path from "node:path";
import { verifyTakramMipDiagnosticEvidence } from "../helpers/takramMipDiagnosticEvidence";

test("recomputes the committed gzip populations and matches the manifest summary", async () => {
  const evidenceDirectory = path.resolve(
    process.cwd(),
    "docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale/task-m-mip-diagnostic"
  );

  const result = verifyTakramMipDiagnosticEvidence(evidenceDirectory);

  expect(result.verifiedFileCount).toBe(12);
  expect(result.scales).toEqual([1, 80, 120, 160]);
  expect(result.evaluation).toEqual(result.manifestEvaluation);
  expect(result.evaluation).toMatchObject({
    decision: "MIP_CAUSAL_HYPOTHESIS_REJECTED",
    patchAuthorized: false,
    qualifyingSecondaryScale: null
  });
  expect(result.evaluation.candidates.find(
    (candidate: { scale: number }) => candidate.scale === 120
  )).toMatchObject({
    mipExcessAtLeastOneFraction: 0.7147944495910906,
    prematureMipThresholdPass: false,
    valid: true
  });
});
