import type { OpeningCloudFallbackReason } from "./types";

export function resolveOpeningCloudMemoryFallback(
  deviceMemory: number | undefined
): OpeningCloudFallbackReason | null {
  return typeof deviceMemory === "number" && deviceMemory <= 4
    ? "low-memory"
    : null;
}
