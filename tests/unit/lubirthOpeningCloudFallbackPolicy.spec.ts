import { expect, test } from "@playwright/test";
import { resolveOpeningCloudMemoryFallback } from "../../apps/site/components/lubirth-cloud-asset-opening/fallbackPolicy";

test("low-memory devices preserve the live Relief-lite fallback", () => {
  expect(resolveOpeningCloudMemoryFallback(4)).toBe("low-memory");
  expect(resolveOpeningCloudMemoryFallback(3)).toBe("low-memory");
  expect(resolveOpeningCloudMemoryFallback(8)).toBeNull();
  expect(resolveOpeningCloudMemoryFallback(undefined)).toBeNull();
});
