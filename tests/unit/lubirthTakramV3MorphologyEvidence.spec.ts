import { expect, test } from "@playwright/test";
import { writeTakramV3FormalEvidence } from "../helpers/takramV3MorphologyEvidence";

test("does not mutate formal evidence outside capture mode", () => {
  let writeCount = 0;
  const written = writeTakramV3FormalEvidence(false, () => {
    writeCount += 1;
  });

  expect(written).toBe(false);
  expect(writeCount).toBe(0);
});

test("writes formal evidence only when capture mode is explicit", () => {
  let writeCount = 0;
  const written = writeTakramV3FormalEvidence(true, () => {
    writeCount += 1;
  });

  expect(written).toBe(true);
  expect(writeCount).toBe(1);
});
